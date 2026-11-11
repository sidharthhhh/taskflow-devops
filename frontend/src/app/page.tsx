'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  ArrowRight,
  BarChart3,
  Bell,
  CheckCircle2,
  Clock,
  Cpu,
  Database,
  FileText,
  Layers,
  Lock,
  LogOut,
  Plus,
  RefreshCw,
  Server,
  ShieldCheck,
  Trash2,
  User,
  X,
  Zap,
} from 'lucide-react';

type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE';

interface Task {
  id: number;
  title: string;
  description?: string;
  status: TaskStatus;
  createdAt?: string;
}

interface ServiceHealth {
  id: string;
  name: string;
  language: string;
  port: number;
  status: 'UP' | 'DOWN' | 'DEGRADED';
  latencyMs: number;
  redis?: string | null;
}

interface AnalyticsSummary {
  total: number;
  todo: number;
  inProgress: number;
  done: number;
  completionRate: number;
  cacheTtlSec?: number;
  cacheSource?: 'REDIS_HIT' | 'LIVE_COMPUTE';
  updatedAt?: string;
}

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  source: string;
  timestamp: string;
}

interface AuditEntry {
  id: string;
  actor: string;
  action: string;
  resource: string;
  details: string;
  timestamp: string;
}

interface SchedulerJob {
  id: string;
  jobName: string;
  triggerSource: string;
  status: string;
  tasksScanned: number;
  pendingCount: number;
  detail: string;
  executedAt: string;
}

interface AuthUser {
  email: string;
  name: string;
  role: string;
}

type ActiveTab = 'tasks' | 'analytics' | 'audit' | 'notifications' | 'scheduler';

const STATUS_META: Record<TaskStatus, { label: string; dot: string; badge: string }> = {
  TODO: {
    label: 'To Do',
    dot: 'bg-amber-400',
    badge: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
  },
  IN_PROGRESS: {
    label: 'In Progress',
    dot: 'bg-sky-400',
    badge: 'bg-sky-500/10 text-sky-300 border-sky-500/20',
  },
  DONE: {
    label: 'Done',
    dot: 'bg-emerald-400',
    badge: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
  },
};

export default function TaskFlowDashboard() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('tasks');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [health, setHealth] = useState<ServiceHealth[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([]);
  const [jobs, setJobs] = useState<SchedulerJob[]>([]);

  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newStatus, setNewStatus] = useState<TaskStatus>('TODO');
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  // Auth modal state
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authName, setAuthName] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);

  const actorName = user?.email || 'guest-operator';

  const loadMeshHealth = useCallback(async () => {
    try {
      const res = await fetch('/api/health', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setHealth(data.services || []);
      }
    } catch {
      /* ignore transient fetch failure */
    }
  }, []);

  const loadTasks = useCallback(async () => {
    try {
      const res = await fetch('/api/tasks', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setTasks(Array.isArray(data) ? data : []);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const loadAnalytics = useCallback(async (forceRefresh = false) => {
    try {
      const url = forceRefresh ? '/api/analytics?refresh=true' : '/api/analytics';
      const res = await fetch(url, { cache: 'no-store' });
      if (res.ok) {
        setAnalytics(await res.json());
      }
    } catch {
      /* ignore */
    }
  }, []);

  const loadNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const loadAudit = useCallback(async () => {
    try {
      const res = await fetch('/api/audit', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setAuditLogs(data.logs || []);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const loadScheduler = useCallback(async () => {
    try {
      const res = await fetch('/api/scheduler/jobs', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setJobs(data.jobs || []);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const refreshAll = useCallback(async () => {
    setBusy(true);
    await Promise.all([
      loadMeshHealth(),
      loadTasks(),
      loadAnalytics(false),
      loadNotifications(),
      loadAudit(),
      loadScheduler(),
    ]);
    setBusy(false);
  }, [loadMeshHealth, loadTasks, loadAnalytics, loadNotifications, loadAudit, loadScheduler]);

  useEffect(() => {
    const saved = localStorage.getItem('taskflow_token');
    if (saved) {
      fetch('/api/auth/me', { headers: { Authorization: `Bearer ${saved}` } })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (d?.user) setUser(d.user);
        })
        .catch(() => {});
    }
    refreshAll();
    const timer = setInterval(loadMeshHealth, 15000);
    return () => clearInterval(timer);
  }, [refreshAll, loadMeshHealth]);

  const showNotice = (text: string, kind: 'ok' | 'err' = 'ok') => {
    setBanner({ kind, text });
    setTimeout(() => setBanner(null), 4000);
  };

  async function handleCreateTask(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setBusy(true);
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-actor': actorName },
        body: JSON.stringify({
          title: newTitle.trim(),
          description: newDesc.trim() || undefined,
          status: newStatus,
        }),
      });
      if (res.ok) {
        setNewTitle('');
        setNewDesc('');
        showNotice('Task created -> Java API + Rust Audit + Go Notification synced');
        await Promise.all([loadTasks(), loadAnalytics(true), loadAudit(), loadNotifications()]);
      } else {
        const err = await res.json().catch(() => ({}));
        showNotice(err.message || err.error || `Create failed (HTTP ${res.status})`, 'err');
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleMoveTask(task: Task, nextStatus: TaskStatus) {
    setBusy(true);
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-actor': actorName },
        body: JSON.stringify({
          title: task.title,
          description: task.description || '',
          status: nextStatus,
        }),
      });
      if (res.ok) {
        await Promise.all([loadTasks(), loadAnalytics(true), loadAudit(), loadNotifications()]);
      } else {
        showNotice(`Update failed (HTTP ${res.status})`, 'err');
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteTask(id: number) {
    setBusy(true);
    try {
      const res = await fetch(`/api/tasks/${id}`, {
        method: 'DELETE',
        headers: { 'x-actor': actorName },
      });
      if (res.ok) {
        showNotice(`Deleted task #${id}`);
        await Promise.all([loadTasks(), loadAnalytics(true), loadAudit(), loadNotifications()]);
      } else {
        showNotice(`Delete failed (HTTP ${res.status})`, 'err');
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleTriggerScheduler() {
    setBusy(true);
    try {
      const res = await fetch('/api/scheduler/trigger', { method: 'POST' });
      if (res.ok) {
        showNotice('Scheduler sweep triggered -> Redis Pub/Sub -> Go Notifications + Rust Audit');
        await Promise.all([loadScheduler(), loadNotifications(), loadAudit()]);
      } else {
        showNotice(`Scheduler unavailable (HTTP ${res.status})`, 'err');
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleSendTestNotification() {
    await fetch('/api/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'MANUAL_PING',
        title: 'DevOps Health Ping',
        message: `Triggered from Next.js UI by ${actorName}`,
        source: 'frontend',
      }),
    });
    await loadNotifications();
  }

  async function handleClearNotifications() {
    await fetch('/api/notifications', { method: 'DELETE' });
    await loadNotifications();
  }

  async function handleAuthSubmit(e: React.FormEvent) {
    e.preventDefault();
    setAuthError(null);
    const endpoint = authMode === 'login' ? '/api/auth/login' : '/api/auth/register';
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: authEmail, password: authPassword, name: authName }),
    });
    const data = await res.json();
    if (!res.ok) {
      setAuthError(data.error || 'Authentication failed');
      return;
    }
    localStorage.setItem('taskflow_token', data.token);
    setUser(data.user);
    setAuthOpen(false);
    showNotice(`Signed in as ${data.user.email} (JWT issued by Node Auth Service)`);
  }

  function handleLogout() {
    localStorage.removeItem('taskflow_token');
    setUser(null);
    showNotice('Signed out');
  }

  const upCount = health.filter((s) => s.status === 'UP').length;
  const totalServices = health.length || 6;

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-950/30 via-slate-950 to-slate-950">
      {/* Top Navbar */}
      <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-500 shadow-lg shadow-indigo-500/20">
              <Layers className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold tracking-tight text-white">TaskFlow</h1>
                <span className="rounded-full border border-indigo-500/30 bg-indigo-500/10 px-2 py-0.5 text-[11px] font-medium text-indigo-300">
                  Microservices Control Plane
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Next.js · Java · Node.js · Golang · Rust · Redis · PostgreSQL
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={handleTriggerScheduler}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 text-xs font-medium text-cyan-300 transition hover:bg-cyan-500/20 disabled:opacity-50"
            >
              <Zap className="h-3.5 w-3.5" />
              Run Cron Sweep
            </button>

            <button
              onClick={refreshAll}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:border-slate-600 hover:bg-slate-800 disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${busy ? 'animate-spin' : ''}`} />
              Refresh Mesh
            </button>

            {user ? (
              <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs">
                <User className="h-3.5 w-3.5 text-emerald-400" />
                <span className="font-medium text-emerald-200">{user.name}</span>
                <button
                  onClick={handleLogout}
                  title="Sign out"
                  className="ml-1 text-slate-400 transition hover:text-white"
                >
                  <LogOut className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setAuthOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm shadow-indigo-500/30 transition hover:bg-indigo-500"
              >
                <Lock className="h-3.5 w-3.5" />
                Sign In
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
        {banner && (
          <div
            className={`flex items-center justify-between rounded-xl border px-4 py-2.5 text-sm ${
              banner.kind === 'err'
                ? 'border-rose-500/30 bg-rose-500/10 text-rose-200'
                : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
            }`}
          >
            <div className="flex items-center gap-2">
              <CheckCircle2
                className={`h-4 w-4 ${banner.kind === 'err' ? 'text-rose-400' : 'text-emerald-400'}`}
              />
              <span>{banner.text}</span>
            </div>
            <button onClick={() => setBanner(null)} className="opacity-70 hover:text-white">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Live Polyglot Microservices Mesh Strip */}
        <section className="rounded-2xl border border-slate-800/80 bg-slate-900/50 p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-emerald-400" />
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                Live Microservices Mesh ({upCount}/{totalServices} Services Healthy)
              </h2>
            </div>
            <span className="text-xs text-slate-400">
              Runtime DNS Discovery via Next.js BFF Gateway
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
            {(health.length > 0
              ? health
              : [
                  { id: 'task', name: 'Task Service', language: 'Java 17', port: 8080, status: 'DOWN' as const, latencyMs: 0 },
                  { id: 'auth', name: 'Auth Service', language: 'Node.js', port: 3001, status: 'DOWN' as const, latencyMs: 0 },
                  { id: 'analytics', name: 'Analytics Service', language: 'Node.js', port: 3002, status: 'DOWN' as const, latencyMs: 0 },
                  { id: 'scheduler', name: 'Scheduler Service', language: 'Node.js', port: 3003, status: 'DOWN' as const, latencyMs: 0 },
                  { id: 'notification', name: 'Notification Service', language: 'Golang', port: 8081, status: 'DOWN' as const, latencyMs: 0 },
                  { id: 'audit', name: 'Audit Logs Service', language: 'Rust', port: 8082, status: 'DOWN' as const, latencyMs: 0 },
                ]
            ).map((svc) => {
              const isUp = svc.status === 'UP';
              return (
                <div
                  key={svc.id}
                  className={`rounded-xl border p-3 transition ${
                    isUp
                      ? 'border-slate-800 bg-slate-900/80 hover:border-slate-700'
                      : 'border-rose-500/30 bg-rose-950/20'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] text-slate-300">
                      {svc.language}
                    </span>
                    <span className="flex items-center gap-1 text-[11px] font-medium">
                      <span
                        className={`h-2 w-2 rounded-full ${
                          isUp ? 'bg-emerald-400 shadow-sm shadow-emerald-400/50' : 'bg-rose-400'
                        }`}
                      />
                      <span className={isUp ? 'text-emerald-300' : 'text-rose-300'}>
                        {svc.status}
                      </span>
                    </span>
                  </div>
                  <p className="mt-2 truncate text-xs font-semibold text-white">{svc.name}</p>
                  <div className="mt-1 flex items-center justify-between font-mono text-[10px] text-slate-400">
                    <span>:{svc.port}</span>
                    <span>{svc.latencyMs}ms</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Navigation Tabs */}
        <nav className="flex flex-wrap gap-2 border-b border-slate-800 pb-3">
          {[
            { id: 'tasks' as const, label: 'Task Board', icon: Layers, count: tasks.length },
            { id: 'analytics' as const, label: 'Analytics & Redis', icon: BarChart3 },
            { id: 'audit' as const, label: 'Audit Logs (Rust)', icon: ShieldCheck, count: auditLogs.length },
            { id: 'notifications' as const, label: 'Notifications (Go)', icon: Bell, count: notifications.length },
            { id: 'scheduler' as const, label: 'Scheduler & Arch', icon: Clock, count: jobs.length },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition ${
                  active
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                    : 'border border-slate-800 bg-slate-900/60 text-slate-300 hover:border-slate-700 hover:text-white'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
                {typeof tab.count === 'number' && (
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      active ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* TAB 1: TASK BOARD */}
        {activeTab === 'tasks' && (
          <div className="space-y-6">
            {/* Summary Metrics Row */}
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                <p className="text-xs font-medium text-slate-400">Total Tasks</p>
                <p className="mt-1 text-2xl font-bold text-white">{analytics?.total ?? tasks.length}</p>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                <p className="text-xs font-medium text-slate-400">Pending (To Do + Active)</p>
                <p className="mt-1 text-2xl font-bold text-amber-300">
                  {analytics ? analytics.todo + analytics.inProgress : tasks.filter((t) => t.status !== 'DONE').length}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                <p className="text-xs font-medium text-slate-400">Completion Rate</p>
                <p className="mt-1 text-2xl font-bold text-emerald-300">
                  {analytics?.completionRate ?? 0}%
                </p>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                <p className="text-xs font-medium text-slate-400">Analytics Cache Mode</p>
                <p className="mt-1 font-mono text-sm font-semibold text-cyan-300">
                  {analytics?.cacheSource || 'DIRECT'}
                </p>
              </div>
            </div>

            {/* Create Task Form */}
            <form
              onSubmit={handleCreateTask}
              className="grid gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 md:grid-cols-12"
            >
              <input
                type="text"
                placeholder="New DevOps task title (e.g., Configure HPA & Redis cache)..."
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                required
                className="rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-indigo-500 md:col-span-5"
              />
              <input
                type="text"
                placeholder="Optional description..."
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                className="rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-indigo-500 md:col-span-4"
              />
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value as TaskStatus)}
                className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-indigo-500 md:col-span-2"
              >
                <option value="TODO">To Do</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="DONE">Done</option>
              </select>
              <button
                type="submit"
                disabled={busy}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-50 md:col-span-1"
              >
                <Plus className="h-4 w-4" />
                Add
              </button>
            </form>

            {/* 3-Column Kanban Board */}
            <div className="grid gap-4 lg:grid-cols-3">
              {(['TODO', 'IN_PROGRESS', 'DONE'] as TaskStatus[]).map((col) => {
                const colTasks = tasks.filter((t) => t.status === col);
                const meta = STATUS_META[col];
                return (
                  <div
                    key={col}
                    className="flex flex-col rounded-2xl border border-slate-800 bg-slate-900/40 p-4"
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`h-2.5 w-2.5 rounded-full ${meta.dot}`} />
                        <h3 className="text-sm font-semibold text-white">{meta.label}</h3>
                      </div>
                      <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-xs font-medium text-slate-300">
                        {colTasks.length}
                      </span>
                    </div>

                    <div className="space-y-3">
                      {colTasks.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-slate-800 p-6 text-center text-xs text-slate-500">
                          No tasks in {meta.label}
                        </div>
                      ) : (
                        colTasks.map((task) => (
                          <div
                            key={task.id}
                            className="rounded-xl border border-slate-800 bg-slate-950/70 p-3.5 transition hover:border-slate-700"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <span className="font-mono text-[10px] text-slate-500">#{task.id}</span>
                                <h4 className="text-sm font-semibold text-white">{task.title}</h4>
                              </div>
                              <button
                                onClick={() => handleDeleteTask(task.id)}
                                title="Delete task"
                                className="rounded-lg p-1 text-slate-500 transition hover:bg-rose-500/10 hover:text-rose-400"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                            {task.description && (
                              <p className="mt-1.5 text-xs text-slate-400">{task.description}</p>
                            )}
                            <div className="mt-3 flex flex-wrap items-center gap-1.5">
                              {(['TODO', 'IN_PROGRESS', 'DONE'] as TaskStatus[])
                                .filter((s) => s !== task.status)
                                .map((target) => (
                                  <button
                                    key={target}
                                    onClick={() => handleMoveTask(task, target)}
                                    className="inline-flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900 px-2 py-1 text-[11px] font-medium text-slate-300 transition hover:border-indigo-500/50 hover:text-white"
                                  >
                                    <ArrowRight className="h-3 w-3 text-indigo-400" />
                                    {STATUS_META[target].label}
                                  </button>
                                ))}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 2: ANALYTICS & REDIS */}
        {activeTab === 'analytics' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
              <div>
                <h2 className="text-base font-semibold text-white">
                  Node.js Analytics Service + Redis Caching Demo
                </h2>
                <p className="mt-1 text-xs text-slate-400">
                  Cache TTL: {analytics?.cacheTtlSec ?? 10}s · Last Source:{' '}
                  <span className="font-mono font-semibold text-cyan-300">
                    {analytics?.cacheSource || 'UNAVAILABLE'}
                  </span>
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => loadAnalytics(false)}
                  className="rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs font-medium text-white hover:bg-slate-700"
                >
                  Fetch (Use Redis Cache)
                </button>
                <button
                  onClick={() => loadAnalytics(true)}
                  className="rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-indigo-500"
                >
                  Force Live Recompute
                </button>
              </div>
            </div>

            {analytics && (
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-5">
                {[
                  { label: 'To Do', count: analytics.todo, color: 'bg-amber-400' },
                  { label: 'In Progress', count: analytics.inProgress, color: 'bg-sky-400' },
                  { label: 'Done', count: analytics.done, color: 'bg-emerald-400' },
                ].map((bar) => {
                  const pct = analytics.total > 0 ? Math.round((bar.count / analytics.total) * 100) : 0;
                  return (
                    <div key={bar.label} className="space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="font-medium text-slate-200">{bar.label}</span>
                        <span className="font-mono text-slate-400">
                          {bar.count} / {analytics.total} ({pct}%)
                        </span>
                      </div>
                      <div className="h-3 overflow-hidden rounded-full bg-slate-800">
                        <div className={`h-full rounded-full ${bar.color}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: AUDIT LOGS (RUST) */}
        {activeTab === 'audit' && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-orange-400" />
                <h2 className="text-base font-semibold text-white">
                  Immutable Audit Trail (Rust · Axum · `/data/audit.jsonl`)
                </h2>
              </div>
              <button
                onClick={loadAudit}
                className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-700"
              >
                Refresh Logs
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-800 text-slate-400">
                  <tr>
                    <th className="py-2.5 pr-4">Timestamp</th>
                    <th className="py-2.5 pr-4">Actor</th>
                    <th className="py-2.5 pr-4">Action</th>
                    <th className="py-2.5 pr-4">Resource</th>
                    <th className="py-2.5">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70 font-mono">
                  {auditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-slate-500">
                        No audit events recorded yet. Create or update a task to stream events to Rust!
                      </td>
                    </tr>
                  ) : (
                    auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-800/30">
                        <td className="py-2.5 pr-4 text-slate-400">{log.timestamp}</td>
                        <td className="py-2.5 pr-4 text-cyan-300">{log.actor}</td>
                        <td className="py-2.5 pr-4">
                          <span className="rounded bg-orange-500/15 px-2 py-0.5 text-orange-300">
                            {log.action}
                          </span>
                        </td>
                        <td className="py-2.5 pr-4 text-slate-300">{log.resource}</td>
                        <td className="py-2.5 text-slate-300">{log.details}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 4: NOTIFICATIONS (GOLANG) */}
        {activeTab === 'notifications' && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-cyan-400" />
                <h2 className="text-base font-semibold text-white">
                  Notification Center (Golang · Redis Pub/Sub `taskflow:events`)
                </h2>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleSendTestNotification}
                  className="rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-cyan-500"
                >
                  Send Test Alert
                </button>
                <button
                  onClick={handleClearNotifications}
                  className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700"
                >
                  Clear
                </button>
              </div>
            </div>
            <div className="space-y-2.5">
              {notifications.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-800 p-8 text-center text-xs text-slate-500">
                  No notifications yet. Trigger a Cron Sweep or create a task!
                </div>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    className="flex items-start justify-between gap-4 rounded-xl border border-slate-800 bg-slate-950/60 p-3.5"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-cyan-500/15 px-1.5 py-0.5 font-mono text-[10px] text-cyan-300">
                          {n.type}
                        </span>
                        <span className="text-sm font-semibold text-white">{n.title}</span>
                      </div>
                      <p className="mt-1 text-xs text-slate-300">{n.message}</p>
                    </div>
                    <div className="text-right font-mono text-[10px] text-slate-500">
                      <div>{n.source}</div>
                      <div>{n.timestamp}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB 5: SCHEDULER & ARCHITECTURE */}
        {activeTab === 'scheduler' && (
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-indigo-400" />
                  <h2 className="text-base font-semibold text-white">Scheduler Jobs (Node.js)</h2>
                </div>
                <button
                  onClick={handleTriggerScheduler}
                  className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500"
                >
                  Trigger Now
                </button>
              </div>
              <div className="space-y-2.5">
                {jobs.slice(0, 8).map((job) => (
                  <div
                    key={job.id}
                    className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-white">{job.jobName}</span>
                      <span className="rounded bg-emerald-500/15 px-2 py-0.5 font-mono text-[10px] text-emerald-300">
                        {job.status} ({job.triggerSource})
                      </span>
                    </div>
                    <p className="mt-1 text-slate-400">{job.detail}</p>
                    <p className="mt-1 font-mono text-[10px] text-slate-500">{job.executedAt}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
              <div className="mb-4 flex items-center gap-2">
                <Server className="h-4 w-4 text-emerald-400" />
                <h2 className="text-base font-semibold text-white">Container & DevOps Topology</h2>
              </div>
              <div className="space-y-2 text-xs">
                {[
                  { name: 'frontend', tech: 'Next.js 14 Standalone', port: '3000', base: 'node:22-alpine' },
                  { name: 'task-service (app)', tech: 'Java 17 Spring Boot 3', port: '8080', base: 'temurin:17-jre-alpine' },
                  { name: 'auth-service', tech: 'Node.js JWT + PostgreSQL', port: '3001', base: 'node:22-alpine' },
                  { name: 'analytics-service', tech: 'Node.js + Redis TTL', port: '3002', base: 'node:22-alpine' },
                  { name: 'scheduler-service', tech: 'Node.js Cron + Pub/Sub', port: '3003', base: 'node:22-alpine' },
                  { name: 'notification-service', tech: 'Golang Static Binary', port: '8081', base: 'alpine:3.20' },
                  { name: 'audit-service', tech: 'Rust Axum Static Binary', port: '8082', base: 'alpine:3.20' },
                  { name: 'redis', tech: 'Redis 7 Pub/Sub & Cache', port: '6379', base: 'redis:7-alpine' },
                  { name: 'postgres', tech: 'PostgreSQL 16 Relational DB', port: '5432', base: 'postgres:16-alpine' },
                ].map((row) => (
                  <div
                    key={row.name}
                    className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2"
                  >
                    <div className="flex items-center gap-2">
                      {row.name === 'redis' || row.name === 'postgres' ? (
                        <Database className="h-3.5 w-3.5 text-amber-400" />
                      ) : (
                        <Cpu className="h-3.5 w-3.5 text-indigo-400" />
                      )}
                      <span className="font-mono font-semibold text-white">{row.name}</span>
                    </div>
                    <span className="text-slate-400">{row.tech}</span>
                    <span className="rounded bg-slate-800 px-2 py-0.5 font-mono text-[10px] text-cyan-300">
                      {row.base} :{row.port}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Auth Modal */}
      {authOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">
                {authMode === 'login' ? 'Sign In to TaskFlow' : 'Create Account'}
              </h3>
              <button onClick={() => setAuthOpen(false)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            {authError && (
              <div className="mb-3 rounded-lg border border-rose-500/30 bg-rose-500/10 p-2.5 text-xs text-rose-300">
                {authError}
              </div>
            )}

            <form onSubmit={handleAuthSubmit} className="space-y-3">
              {authMode === 'register' && (
                <input
                  type="text"
                  placeholder="Full Name"
                  value={authName}
                  onChange={(e) => setAuthName(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white outline-none focus:border-indigo-500"
                />
              )}
              <input
                type="email"
                placeholder="Email"
                required
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white outline-none focus:border-indigo-500"
              />
              <input
                type="password"
                placeholder="Password"
                required
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white outline-none focus:border-indigo-500"
              />
              <button
                type="submit"
                className="w-full rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500"
              >
                {authMode === 'login' ? 'Sign In' : 'Register'}
              </button>
            </form>

            <div className="mt-4 flex items-center justify-between border-t border-slate-800 pt-3 text-xs">
              <button
                type="button"
                onClick={() => {
                  setAuthMode('login');
                  setAuthEmail('admin@taskflow.dev');
                  setAuthPassword('admin123');
                }}
                className="font-medium text-cyan-400 hover:text-cyan-300"
              >
                Fill Demo Credentials
              </button>
              <button
                type="button"
                onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
                className="text-slate-400 hover:text-white"
              >
                {authMode === 'login' ? 'Need an account? Register' : 'Already have an account? Login'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

