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

export type HardwareSnapshot = {
  sampledAt: string;
  cpu: {
    name: string;
    usagePercent: number | null;
    powerWatts: number | null;
    temperatureCelsius: number | null;
    cores: Array<{ name: string; usagePercent: number | null }>;
  };
  memory: {
    totalBytes: number;
    usedBytes: number;
    usagePercent: number | null;
  };
  disks: Array<{
    name: string;
    label: string;
    totalBytes: number;
    freeBytes: number;
    usedBytes: number;
    usagePercent: number | null;
    readBytesPerSecond: number | null;
    writeBytesPerSecond: number | null;
  }>;
  gpus: Array<{
    name: string;
    vendor: "intel" | "nvidia" | "amd" | "unknown";
    usagePercent: number | null;
    memoryTotalBytes: number | null;
    memoryUsedBytes: number | null;
    temperatureCelsius: number | null;
    powerWatts: number | null;
  }>;
  networks: Array<{
    name: string;
    speedBitsPerSecond: number | null;
    receiveBytesPerSecond: number | null;
    transmitBytesPerSecond: number | null;
  }>;
};

export type ServiceProcessRow = {
  port: number;
  pid: number | null;
  name: string | null;
  status: "listening" | "not-listening";
  cpuPercent: number | null;
  memoryBytes: number | null;
  diskReadBytesPerSecond: number | null;
  diskWriteBytesPerSecond: number | null;
  networkReceiveBytesPerSecond: number | null;
  networkTransmitBytesPerSecond: number | null;
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
  hardware: () => requestJson<{ item: HardwareSnapshot }>("/api/hardware/snapshot"),
  serviceProcesses: () => requestJson<{ items: ServiceProcessRow[]; ports: number[] }>("/api/services/processes"),
  addServicePort: (port: number) =>
    requestJson<{ items: ServiceProcessRow[]; ports: number[] }>("/api/services/ports", {
      method: "POST",
      body: JSON.stringify({ port })
    }),
  removeServicePort: (port: number) =>
    requestJson<{ items: ServiceProcessRow[]; ports: number[] }>("/api/services/ports/" + encodeURIComponent(String(port)), {
      method: "DELETE"
    }),
  stopServicePort: (port: number) => requestJson("/api/services/ports/" + encodeURIComponent(String(port)) + "/stop", { method: "POST" }),
  startContainer: (id: string) => requestJson("/api/docker/containers/" + encodeURIComponent(id) + "/start", { method: "POST" }),
  stopContainer: (id: string) => requestJson("/api/docker/containers/" + encodeURIComponent(id) + "/stop", { method: "POST" }),
  startComposeProject: (project: string) => requestJson("/api/docker/projects/" + encodeURIComponent(project) + "/start", { method: "POST" }),
  stopComposeProject: (project: string) => requestJson("/api/docker/projects/" + encodeURIComponent(project) + "/stop", { method: "POST" })
};
