use axum::{extract::State, http::StatusCode, response::IntoResponse, routing::get, Json, Router};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::{
    collections::VecDeque,
    env,
    fs::{create_dir_all, OpenOptions},
    io::{BufRead, BufReader, Write},
    path::Path,
    sync::{Arc, RwLock},
};
use tokio::net::TcpListener;

#[derive(Clone, Debug, Serialize, Deserialize)]
struct AuditEntry {
    id: String,
    actor: String,
    action: String,
    resource: String,
    details: String,
    timestamp: String,
}

#[derive(Deserialize)]
struct CreateAuditRequest {
    actor: Option<String>,
    action: String,
    resource: Option<String>,
    details: Option<String>,
}

struct AppState {
    entries: RwLock<VecDeque<AuditEntry>>,
    log_path: String,
}

impl AppState {
    fn new(log_path: String) -> Self {
        let mut entries = VecDeque::with_capacity(500);
        if let Ok(file) = std::fs::File::open(&log_path) {
            let reader = BufReader::new(file);
            for line in reader.lines().map_while(Result::ok) {
                if let Ok(entry) = serde_json::from_str::<AuditEntry>(&line) {
                    entries.push_front(entry);
                    if entries.len() > 500 {
                        entries.pop_back();
                    }
                }
            }
        }
        Self {
            entries: RwLock::new(entries),
            log_path,
        }
    }

    fn append(&self, entry: AuditEntry) {
        if let Some(parent) = Path::new(&self.log_path).parent() {
            let _ = create_dir_all(parent);
        }
        if let Ok(mut file) = OpenOptions::new()
            .create(true)
            .append(true)
            .open(&self.log_path)
        {
            if let Ok(line) = serde_json::to_string(&entry) {
                let _ = writeln!(file, "{}", line);
            }
        }

        if let Ok(mut guard) = self.entries.write() {
            guard.push_front(entry);
            if guard.len() > 500 {
                guard.pop_back();
            }
        }
    }
}

async fn health(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    let count = state.entries.read().map(|g| g.len()).unwrap_or(0);
    Json(serde_json::json!({
        "status": "UP",
        "service": "audit-service",
        "language": "Rust",
        "entriesCount": count,
        "logPath": state.log_path,
        "timestamp": Utc::now().to_rfc3339()
    }))
}

async fn list_audit(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    let entries: Vec<AuditEntry> = state
        .entries
        .read()
        .map(|g| g.iter().cloned().collect())
        .unwrap_or_default();
    Json(serde_json::json!({
        "count": entries.len(),
        "logs": entries
    }))
}

async fn create_audit(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<CreateAuditRequest>,
) -> impl IntoResponse {
    if payload.action.trim().is_empty() {
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({"error": "action is required"})),
        )
            .into_response();
    }

    let now = Utc::now();
    let entry = AuditEntry {
        id: format!("aud-{}", now.timestamp_nanos_opt().unwrap_or(0)),
        actor: payload.actor.unwrap_or_else(|| "system".to_string()),
        action: payload.action,
        resource: payload.resource.unwrap_or_else(|| "taskflow".to_string()),
        details: payload.details.unwrap_or_default(),
        timestamp: now.to_rfc3339(),
    };

    state.append(entry.clone());
    (StatusCode::CREATED, Json(entry)).into_response()
}

fn app_router(state: Arc<AppState>) -> Router {
    Router::new()
        .route("/health", get(health))
        .route("/api/audit", get(list_audit).post(create_audit))
        .with_state(state)
}

async fn shutdown_signal() {
    let ctrl_c = async {
        let _ = tokio::signal::ctrl_c().await;
    };
    #[cfg(unix)]
    let terminate = async {
        if let Ok(mut sig) =
            tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
        {
            sig.recv().await;
        }
    };
    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => {},
        _ = terminate => {},
    }
}

#[tokio::main]
async fn main() {
    let port = env::var("PORT").unwrap_or_else(|_| "8082".to_string());
    let log_path = env::var("AUDIT_LOG_PATH").unwrap_or_else(|_| "/data/audit.jsonl".to_string());

    let state = Arc::new(AppState::new(log_path));
    let addr = format!("0.0.0.0:{}", port);
    let listener = TcpListener::bind(&addr).await.expect("failed to bind port");
    println!("audit-service (Rust) listening on {}", addr);

    axum::serve(listener, app_router(state))
        .with_graceful_shutdown(shutdown_signal())
        .await
        .expect("server error");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn appends_and_reads_audit_entry() {
        let temp_file = env::temp_dir().join("taskflow_audit_test.jsonl");
        let _ = std::fs::remove_file(&temp_file);
        let state = AppState::new(temp_file.to_string_lossy().to_string());

        state.append(AuditEntry {
            id: "aud-1".to_string(),
            actor: "admin".to_string(),
            action: "TASK_CREATED".to_string(),
            resource: "task/1".to_string(),
            details: "Test entry".to_string(),
            timestamp: Utc::now().to_rfc3339(),
        });

        let entries = state.entries.read().unwrap();
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].action, "TASK_CREATED");
        let _ = std::fs::remove_file(&temp_file);
    }
}
