export type TaskRow = {
  name: string;
  state: string;
  lastRunTime: string | null;
  lastTaskResult: number | null;
};

export type ContainerRow = {
  id: string;
  name: string;
  image: string;
  ports: string;
  lastStarted: string;
  state: string;
  status: string;
  composeProject: string | null;
  composeService: string | null;
};

async function requestJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...options
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error || "请求失败");
  }
  return body as T;
}

export const api = {
  me: () => requestJson<{ authenticated: boolean }>("/api/me"),
  login: (password: string) =>
    requestJson<{ authenticated: boolean }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ password })
    }),
  logout: () => requestJson<{ authenticated: boolean }>("/api/auth/logout", { method: "POST" }),
  tasks: () => requestJson<{ items: TaskRow[] }>("/api/tasks"),
  runTask: (name: string) => requestJson("/api/tasks/" + encodeURIComponent(name) + "/run", { method: "POST" }),
  stopTask: (name: string) => requestJson("/api/tasks/" + encodeURIComponent(name) + "/stop", { method: "POST" }),
  disableTask: (name: string) => requestJson("/api/tasks/" + encodeURIComponent(name) + "/disable", { method: "POST" }),
  containers: () => requestJson<{ items: ContainerRow[] }>("/api/docker/containers"),
  startContainer: (id: string) => requestJson("/api/docker/containers/" + encodeURIComponent(id) + "/start", { method: "POST" }),
  stopContainer: (id: string) => requestJson("/api/docker/containers/" + encodeURIComponent(id) + "/stop", { method: "POST" }),
  startComposeProject: (project: string) => requestJson("/api/docker/projects/" + encodeURIComponent(project) + "/start", { method: "POST" }),
  stopComposeProject: (project: string) => requestJson("/api/docker/projects/" + encodeURIComponent(project) + "/stop", { method: "POST" })
};
