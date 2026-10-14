# TaskFlow - To-Do List REST API

TaskFlow is a production-grade To-Do list REST API built with **Java 17** and **Spring Boot 3.3.x**, featuring Spring Data JPA, Bean Validation, Actuator monitoring, and OpenAPI / Swagger UI documentation.

---

## 📁 Project Structure

```text
taskflow-devops/
├── app/
│   ├── pom.xml                                  # Maven build file
│   ├── .env                                     # Local environment variables (ignored by git)
│   ├── .env.example                             # Environment template
│   └── src/
│       ├── main/
│       │   ├── java/com/taskflow/
│       │   │   ├── TaskflowApplication.java     # Entry point (main method)
│       │   │   ├── controller/                  # HTTP REST controllers
│       │   │   │   ├── TaskController.java      # CRUD /api/tasks endpoints
│       │   │   │   └── InfoController.java      # /api/info metadata endpoint
│       │   │   ├── service/
│       │   │   │   └── TaskService.java         # Business logic layer
│       │   │   ├── repository/
│       │   │   │   └── TaskRepository.java      # JPA repository
│       │   │   ├── model/                       # Data models & entities
│       │   │   │   ├── Task.java                # JPA Entity
│       │   │   │   ├── TaskRequest.java         # Request DTO with validations
│       │   │   │   ├── TaskResponse.java        # Response representation DTO
│       │   │   │   ├── TaskStatus.java          # Enum (TODO, IN_PROGRESS, DONE)
│       │   │   └── AppInfoResponse.java         # Info DTO
│       │   │   ├── exception/                   # Error handling
│       │   │   │   ├── TaskNotFoundException.java # 404 Exception
│       │   │   │   ├── GlobalExceptionHandler.java # @RestControllerAdvice (400, 404, 500)
│       │   │   │   └── ErrorResponse.java       # Standard error format
│       │   │   └── config/
│       │   │       ├── DataSeeder.java          # Inserts 3 sample tasks on startup
│       │   │       └── OpenApiConfig.java       # Swagger / OpenAPI specification
│       │   └── resources/
│       │       └── application.yml              # Config reading environment variables with defaults
│       └── test/
│           ├── java/com/taskflow/
│           │   ├── controller/
│           │   │   └── TaskControllerIntegrationTest.java # MockMvc API tests
│           │   └── service/
│           │       └── TaskServiceTest.java     # JUnit 5 & Mockito unit tests
│           └── resources/
│               └── application-test.yml         # Test profile configuration
├── .gitignore
└── README.md
```

---

## ⚙️ Environment Configuration (`.env`)

The application settings are externalized into `app/.env` with defaults in `app/src/main/resources/application.yml`.

| Variable | Default Value | Description |
|---|---|---|
| `SERVER_PORT` | `8080` | HTTP port for Tomcat |
| `SPRING_APPLICATION_NAME` | `TaskFlow` | Spring Application name |
| `SPRING_DATASOURCE_URL` | `jdbc:h2:mem:taskflowdb;...` | Database connection URL |
| `SPRING_DATASOURCE_USERNAME` | `sa` | Database username |
| `SPRING_DATASOURCE_PASSWORD` | `""` | Database password |
| `SPRING_DATASOURCE_DRIVER_CLASS_NAME` | `org.h2.Driver` | JDBC driver class name |
| `SPRING_JPA_DATABASE_PLATFORM` | `org.hibernate.dialect.H2Dialect` | Hibernate dialect |
| `SPRING_JPA_HIBERNATE_DDL_AUTO` | `update` | Schema generation strategy |
| `SPRING_H2_CONSOLE_ENABLED` | `true` | Enables `/h2-console` |

> To switch to **PostgreSQL**, simply uncomment the PostgreSQL block in `app/.env`.

---

## 🚀 How to Run the Application

Navigate into the `app/` folder and run:
```bash
cd app
mvn spring-boot:run
```

The application runs on `http://localhost:8080`.

---

## 📑 Interactive Swagger UI

Open in your browser:
- **Swagger UI**: [http://localhost:8080/swagger-ui.html](http://localhost:8080/swagger-ui.html)
- **OpenAPI 3 JSON Spec**: [http://localhost:8080/v3/api-docs](http://localhost:8080/v3/api-docs)
- **H2 Web Console**: [http://localhost:8080/h2-console](http://localhost:8080/h2-console)
  - JDBC URL: `jdbc:h2:mem:taskflowdb`
  - Username: `sa`
  - Password: *(blank)*
- **Actuator Health**: [http://localhost:8080/actuator/health](http://localhost:8080/actuator/health)

---

## 🧪 Run Automated Tests

Execute all 21 unit and integration tests:
```bash
cd app
mvn test
```

---

## 📡 API Testing Examples

### 1. GET /api/info
```powershell
Invoke-RestMethod -Uri "http://localhost:8080/api/info" | ConvertTo-Json
```

### 2. GET /api/tasks (All Tasks)
```powershell
Invoke-RestMethod -Uri "http://localhost:8080/api/tasks" | ConvertTo-Json
```

### 3. Filter by Status (`TODO`, `IN_PROGRESS`, `DONE`)
```powershell
Invoke-RestMethod -Uri "http://localhost:8080/api/tasks?status=IN_PROGRESS" | ConvertTo-Json
```

### 4. GET /api/tasks/{id}
```powershell
Invoke-RestMethod -Uri "http://localhost:8080/api/tasks/1" | ConvertTo-Json
```

### 5. POST /api/tasks (Create Task)
```powershell
$body = @{
    title = "Deploy to Kubernetes"
    description = "Create deployments and services"
    status = "TODO"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:8080/api/tasks" -Method Post -ContentType "application/json" -Body $body | ConvertTo-Json
```

### 6. PUT /api/tasks/{id} (Update Task)
```powershell
$update = @{
    title = "Set up development environment"
    description = "Java 17, Spring Boot, and Swagger configured"
    status = "DONE"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:8080/api/tasks/1" -Method Put -ContentType "application/json" -Body $update | ConvertTo-Json
```

### 7. DELETE /api/tasks/{id}
```powershell
Invoke-RestMethod -Uri "http://localhost:8080/api/tasks/1" -Method Delete
```
