import { AlertTriangle, Boxes, CalendarClock, ChevronDown, ChevronRight, LogOut, Play, RefreshCw, ShieldOff, Square } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { api, type ContainerRow, type TaskRow } from "./api";

type Page = "tasks" | "docker";
type ConfirmState = {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => Promise<void>;
};
type DockerDisplayGroup = {
  key: string;
  project: string | null;
  containers: ContainerRow[];
};

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

function groupContainers(items: ContainerRow[]): DockerDisplayGroup[] {
  const groups = new Map<string, ContainerRow[]>();
  const result: DockerDisplayGroup[] = [];
  for (const container of items) {
    if (!container.composeProject) {
      result.push({ key: "container:" + container.id, project: null, containers: [container] });
      continue;
    }
    const key = "project:" + container.composeProject;
    if (!groups.has(key)) {
      groups.set(key, []);
      result.push({ key, project: container.composeProject, containers: groups.get(key)! });
    }
    groups.get(key)!.push(container);
  }
  return result;
}

function projectState(containers: ContainerRow[]) {
  const running = containers.filter((container) => stateClass(container.state).includes("running")).length;
  if (running === containers.length && containers.length > 0) return "running";
  if (running > 0) return "partial";
  return "exited";
}

function ContainerResourceRow({ container, onAction, busyAction, nested = false }: { container: ContainerRow; onAction: (id: string, name: string, action: "start" | "stop") => void; busyAction: string; nested?: boolean }) {
  return (
    <article className={nested ? "resource-row container-child" : "resource-row"} key={container.id}>
      <strong>{nested ? (container.composeService || container.name) : container.name}</strong>
      <span>{container.image}</span>
      <span>{container.ports || "-"}</span>
      <span className={stateClass(container.state)}>{container.state || container.status || "-"}</span>
      <span>{container.lastStarted}</span>
      <div className="actions">
        <button aria-label={`启动容器 ${container.name}`} disabled={busyAction === container.id + ":start"} onClick={() => onAction(container.id, container.name, "start")}><Play size={16} /></button>
        <button aria-label={`停止容器 ${container.name}`} disabled={busyAction === container.id + ":stop"} onClick={() => onAction(container.id, container.name, "stop")}><Square size={16} /></button>
      </div>
    </article>
  );
}

function DockerPage({
  items,
  onRefresh,
  onAction,
  onProjectAction,
  busyAction
}: {
  items: ContainerRow[];
  onRefresh: () => void;
  onAction: (id: string, name: string, action: "start" | "stop") => void;
  onProjectAction: (project: string, action: "start" | "stop") => void;
  busyAction: string;
}) {
  const groups = useMemo(() => groupContainers(items), [items]);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

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
        {groups.map((group) => {
          if (!group.project) {
            return <ContainerResourceRow key={group.key} container={group.containers[0]} onAction={onAction} busyAction={busyAction} />;
          }
          const isCollapsed = collapsed[group.key] ?? false;
          const state = projectState(group.containers);
          return (
            <div className="container-group" key={group.key}>
              <article className="resource-row compose-row">
                <button
                  className="group-toggle"
                  aria-label={`${isCollapsed ? "展开" : "折叠"}项目 ${group.project}`}
                  aria-expanded={!isCollapsed}
                  onClick={() => setCollapsed((current) => ({ ...current, [group.key]: !isCollapsed }))}
                >
                  {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                </button>
                <strong>{group.project}</strong>
                <span className="muted">{group.containers.length} 个子容器</span>
                <span>-</span>
                <span className={stateClass(state)}>{state === "partial" ? "部分运行" : state}</span>
                <span>-</span>
                <div className="actions">
                  <button aria-label={`启动项目 ${group.project}`} disabled={busyAction === `project:${group.project}:start`} onClick={() => onProjectAction(group.project!, "start")}><Play size={16} /></button>
                  <button aria-label={`停止项目 ${group.project}`} disabled={busyAction === `project:${group.project}:stop`} onClick={() => onProjectAction(group.project!, "stop")}><Square size={16} /></button>
                </div>
              </article>
              {!isCollapsed && group.containers.map((container) => (
                <ContainerResourceRow key={container.id} container={container} onAction={onAction} busyAction={busyAction} nested />
              ))}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ConfirmDialog({ state, onCancel }: { state: ConfirmState; onCancel: () => void }) {
  return (
    <div className="dialog-backdrop" role="presentation">
      <section className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
        <div className="dialog-icon"><AlertTriangle size={20} /></div>
        <div>
          <h2 id="confirm-title">{state.title}</h2>
          <p>{state.message}</p>
        </div>
        <div className="dialog-actions">
          <button className="ghost-button" onClick={onCancel}>取消</button>
          <button className="primary-button danger-button" onClick={state.onConfirm}>{state.confirmLabel}</button>
        </div>
      </section>
    </div>
  );
}

export default function App() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [page, setPage] = useState<Page>("tasks");
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [containers, setContainers] = useState<ContainerRow[]>([]);
  const [error, setError] = useState("");
  const [busyAction, setBusyAction] = useState("");
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);

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

  async function executeTaskAction(name: string, action: "run" | "stop" | "disable") {
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

  async function taskAction(name: string, action: "run" | "stop" | "disable") {
    if (action === "stop" || action === "disable") {
      const label = action === "stop" ? "结束" : "禁用";
      setConfirmState({
        title: `确认${label}任务`,
        message: `即将${label}任务 ${name}，请确认这是你想执行的操作。`,
        confirmLabel: `确认${label}`,
        onConfirm: async () => {
          setConfirmState(null);
          await executeTaskAction(name, action);
        }
      });
      return;
    }
    await executeTaskAction(name, action);
  }

  async function executeContainerAction(id: string, name: string, action: "start" | "stop") {
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

  async function containerAction(id: string, name: string, action: "start" | "stop") {
    if (action === "stop") {
      setConfirmState({
        title: "确认停止容器",
        message: `即将停止容器 ${name}，正在处理的连接可能会中断。`,
        confirmLabel: "确认停止",
        onConfirm: async () => {
          setConfirmState(null);
          await executeContainerAction(id, name, action);
        }
      });
      return;
    }
    await executeContainerAction(id, name, action);
  }

  async function executeProjectAction(project: string, action: "start" | "stop") {
    setBusyAction(`project:${project}:${action}`);
    try {
      if (action === "start") await api.startComposeProject(project);
      if (action === "stop") await api.stopComposeProject(project);
      await refreshContainers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "项目操作失败");
    } finally {
      setBusyAction("");
    }
  }

  async function projectAction(project: string, action: "start" | "stop") {
    if (action === "stop") {
      setConfirmState({
        title: "确认停止项目",
        message: `即将停止 Compose 项目 ${project} 中正在运行的容器，正在处理的连接可能会中断。`,
        confirmLabel: "确认停止",
        onConfirm: async () => {
          setConfirmState(null);
          await executeProjectAction(project, action);
        }
      });
      return;
    }
    await executeProjectAction(project, action);
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
          <DockerPage items={containers} onRefresh={refreshContainers} onAction={containerAction} onProjectAction={projectAction} busyAction={busyAction} />
        )}
      </main>
      <nav className="bottom-nav">
        <NavButton page="tasks" active={page} icon={<CalendarClock size={20} />} label="任务计划程序" onClick={setPage} />
        <NavButton page="docker" active={page} icon={<Boxes size={20} />} label="Docker" onClick={setPage} />
      </nav>
      {confirmState && <ConfirmDialog state={confirmState} onCancel={() => setConfirmState(null)} />}
    </div>
  );
}
