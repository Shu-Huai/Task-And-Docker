import { Boxes, CalendarClock, LogOut, Play, RefreshCw, ShieldOff, Square } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { api, type ContainerRow, type TaskRow } from "./api";

type Page = "tasks" | "docker";

function stateClass(state: string) {
  const normalized = state.toLowerCase();
  if (normalized.includes("run")) return "status status-running";
  if (normalized.includes("ready")) return "status status-ready";
  if (normalized.includes("disabled") || normalized.includes("exited")) return "status status-muted";
  return "status";
}

function formatTime(value: string | null) {
  if (!value) return "从未运行";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function NavButton({ page, active, icon, label, onClick }: { page: Page; active: Page; icon: React.ReactNode; label: string; onClick: (page: Page) => void }) {
  return (
    <button className={active === page ? "nav-item active" : "nav-item"} onClick={() => onClick(page)} aria-label={label}>
      {icon}
      <span>{label}</span>
    </button>
  );
}

function Login({ onLogin }: { onLogin: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api.login(password);
      onLogin();
    } catch (err) {
      setError(err instanceof Error ? err.message : "登录失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login-screen">
      <form className="login-panel" onSubmit={submit}>
        <div>
          <p className="eyebrow">任务与 Docker</p>
          <h1>运维控制台</h1>
        </div>
        <label>
          密码
          <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="current-password" />
        </label>
        {error && <p className="error">{error}</p>}
        <button className="primary-button" disabled={busy} type="submit">
          {busy ? "正在登录" : "登录"}
        </button>
      </form>
    </main>
  );
}

function TasksPage({ items, onRefresh, onAction, busyAction }: { items: TaskRow[]; onRefresh: () => void; onAction: (name: string, action: "run" | "stop" | "disable") => void; busyAction: string }) {
  return (
    <section className="page-section">
      <div className="section-toolbar">
        <div>
          <h1>任务计划程序</h1>
          <p>{items.length} 个任务</p>
        </div>
        <button className="icon-button" onClick={onRefresh} aria-label="刷新任务">
          <RefreshCw size={18} />
        </button>
      </div>
      <div className="resource-list task-grid">
        <div className="resource-row resource-head">
          <span>名称</span>
          <span>状态</span>
          <span>上次运行时间</span>
          <span>上次运行结果</span>
          <span>操作</span>
        </div>
        {items.map((task) => (
          <article className="resource-row" key={task.name}>
            <strong>{task.name}</strong>
            <span className={stateClass(task.state)}>{task.state}</span>
            <span>{formatTime(task.lastRunTime)}</span>
            <span>{task.lastTaskResult ?? "-"}</span>
            <div className="actions">
              <button aria-label={`运行任务 ${task.name}`} disabled={busyAction === task.name + ":run"} onClick={() => onAction(task.name, "run")}><Play size={16} /></button>
              <button aria-label={`结束任务 ${task.name}`} disabled={busyAction === task.name + ":stop"} onClick={() => onAction(task.name, "stop")}><Square size={16} /></button>
              <button aria-label={`禁用任务 ${task.name}`} disabled={busyAction === task.name + ":disable"} onClick={() => onAction(task.name, "disable")}><ShieldOff size={16} /></button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function DockerPage({ items, onRefresh, onAction, busyAction }: { items: ContainerRow[]; onRefresh: () => void; onAction: (id: string, name: string, action: "start" | "stop") => void; busyAction: string }) {
  return (
    <section className="page-section">
      <div className="section-toolbar">
        <div>
          <h1>Docker</h1>
          <p>{items.length} 个容器</p>
        </div>
        <button className="icon-button" onClick={onRefresh} aria-label="刷新容器">
          <RefreshCw size={18} />
        </button>
      </div>
      <div className="resource-list docker-grid">
        <div className="resource-row resource-head">
          <span>名称</span>
          <span>镜像</span>
          <span>端口</span>
          <span>状态</span>
          <span>上次启动</span>
          <span>操作</span>
        </div>
        {items.map((container) => (
          <article className="resource-row" key={container.id}>
            <strong>{container.name}</strong>
            <span>{container.image}</span>
            <span>{container.ports || "-"}</span>
            <span className={stateClass(container.state)}>{container.state || container.status || "-"}</span>
            <span>{container.lastStarted}</span>
            <div className="actions">
              <button aria-label={`启动容器 ${container.name}`} disabled={busyAction === container.id + ":start"} onClick={() => onAction(container.id, container.name, "start")}><Play size={16} /></button>
              <button aria-label={`停止容器 ${container.name}`} disabled={busyAction === container.id + ":stop"} onClick={() => onAction(container.id, container.name, "stop")}><Square size={16} /></button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export default function App() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [page, setPage] = useState<Page>("tasks");
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [containers, setContainers] = useState<ContainerRow[]>([]);
  const [error, setError] = useState("");
  const [busyAction, setBusyAction] = useState("");

  const title = useMemo(() => (page === "tasks" ? "任务计划程序" : "Docker"), [page]);

  async function refreshTasks() {
    const response = await api.tasks();
    setTasks(response.items);
  }

  async function refreshContainers() {
    const response = await api.containers();
    setContainers(response.items);
  }

  async function refreshAll() {
    setError("");
    try {
      await Promise.all([refreshTasks(), refreshContainers()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "无法刷新数据");
    }
  }

  useEffect(() => {
    api.me()
      .then((session) => {
        setAuthenticated(session.authenticated);
        if (session.authenticated) refreshAll();
      })
      .catch(() => setAuthenticated(false));
  }, []);

  async function afterLogin() {
    setAuthenticated(true);
    await refreshAll();
  }

  async function logout() {
    await api.logout();
    setAuthenticated(false);
  }

  async function taskAction(name: string, action: "run" | "stop" | "disable") {
    if ((action === "stop" || action === "disable") && !window.confirm(`确认${action === "stop" ? "结束" : "禁用"}任务 ${name}？`)) return;
    setBusyAction(name + ":" + action);
    try {
      if (action === "run") await api.runTask(name);
      if (action === "stop") await api.stopTask(name);
      if (action === "disable") await api.disableTask(name);
      await refreshTasks();
    } catch (err) {
      setError(err instanceof Error ? err.message : "任务操作失败");
    } finally {
      setBusyAction("");
    }
  }

  async function containerAction(id: string, name: string, action: "start" | "stop") {
    if (action === "stop" && !window.confirm(`确认停止容器 ${name}？`)) return;
    setBusyAction(id + ":" + action);
    try {
      if (action === "start") await api.startContainer(id);
      if (action === "stop") await api.stopContainer(id);
      await refreshContainers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "容器操作失败");
    } finally {
      setBusyAction("");
    }
  }

  if (authenticated === null) return <main className="loading">正在加载</main>;
  if (!authenticated) return <Login onLogin={afterLogin} />;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <Boxes size={24} />
          <span>任务与 Docker</span>
        </div>
        <nav>
          <NavButton page="tasks" active={page} icon={<CalendarClock size={20} />} label="任务计划程序" onClick={setPage} />
          <NavButton page="docker" active={page} icon={<Boxes size={20} />} label="Docker" onClick={setPage} />
        </nav>
      </aside>
      <main className="content">
        <header className="topbar">
          <h2>{title}</h2>
          <button className="ghost-button" onClick={logout}><LogOut size={16} /> 退出登录</button>
        </header>
        {error && <p className="error banner">{error}</p>}
        {page === "tasks" ? (
          <TasksPage items={tasks} onRefresh={refreshTasks} onAction={taskAction} busyAction={busyAction} />
        ) : (
          <DockerPage items={containers} onRefresh={refreshContainers} onAction={containerAction} busyAction={busyAction} />
        )}
      </main>
      <nav className="bottom-nav">
        <NavButton page="tasks" active={page} icon={<CalendarClock size={20} />} label="任务计划程序" onClick={setPage} />
        <NavButton page="docker" active={page} icon={<Boxes size={20} />} label="Docker" onClick={setPage} />
      </nav>
    </div>
  );
}
