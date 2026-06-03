import type { CommandRunner } from "./command";
import { runCommand } from "./command";

export type DockerContainer = {
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

type DockerPsLine = {
  ID?: string;
  Names?: string;
  Image?: string;
  Ports?: string;
  RunningFor?: string;
  State?: string;
  Status?: string;
  Labels?: string;
};

function parseLabels(labels: string | undefined): Map<string, string> {
  const result = new Map<string, string>();
  for (const label of (labels ?? "").split(",")) {
    const index = label.indexOf("=");
    if (index <= 0) continue;
    result.set(label.slice(0, index).trim(), label.slice(index + 1).trim());
  }
  return result;
}

export function parseDockerPsJsonLines(stdout: string): DockerContainer[] {
  return stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as DockerPsLine)
    .map((item) => {
      const labels = parseLabels(item.Labels);
      return {
        id: item.ID ?? "",
        name: item.Names ?? "",
        image: item.Image ?? "",
        ports: item.Ports ?? "",
        lastStarted: item.RunningFor ?? "",
        state: item.State ?? "",
        status: item.Status ?? "",
        composeProject: labels.get("com.docker.compose.project") ?? null,
        composeService: labels.get("com.docker.compose.service") ?? null
      };
    });
}

export async function listContainers(runner: CommandRunner = runCommand): Promise<DockerContainer[]> {
  const result = await runner("docker", ["ps", "-a", "--format", "{{json .}}"]);
  if (result.exitCode !== 0) {
    throw new Error(result.stderr || "无法读取 Docker 容器");
  }
  return parseDockerPsJsonLines(result.stdout);
}

async function assertContainerExists(id: string, runner: CommandRunner): Promise<void> {
  const containers = await listContainers(runner);
  if (!containers.some((container) => container.id === id)) {
    throw new Error("未找到容器");
  }
}

async function listComposeProjectContainers(project: string, runner: CommandRunner): Promise<DockerContainer[]> {
  const containers = await listContainers(runner);
  const projectContainers = containers.filter((container) => container.composeProject === project);
  if (projectContainers.length === 0) {
    throw new Error("未找到 Compose 项目");
  }
  return projectContainers;
}

function isRunning(container: DockerContainer): boolean {
  return container.state.toLowerCase().includes("run");
}

export async function startContainer(id: string, runner: CommandRunner = runCommand): Promise<void> {
  await assertContainerExists(id, runner);
  const result = await runner("docker", ["start", id]);
  if (result.exitCode !== 0) {
    throw new Error(result.stderr || "无法启动容器");
  }
}

export async function stopContainer(id: string, runner: CommandRunner = runCommand): Promise<void> {
  await assertContainerExists(id, runner);
  const result = await runner("docker", ["stop", id]);
  if (result.exitCode !== 0) {
    throw new Error(result.stderr || "无法停止容器");
  }
}

export async function startComposeProject(project: string, runner: CommandRunner = runCommand): Promise<void> {
  const containers = await listComposeProjectContainers(project, runner);
  const ids = containers.filter((container) => !isRunning(container)).map((container) => container.id);
  if (ids.length === 0) return;
  const result = await runner("docker", ["start", ...ids]);
  if (result.exitCode !== 0) {
    throw new Error(result.stderr || "无法启动 Compose 项目");
  }
}

export async function stopComposeProject(project: string, runner: CommandRunner = runCommand): Promise<void> {
  const containers = await listComposeProjectContainers(project, runner);
  const ids = containers.filter(isRunning).map((container) => container.id);
  if (ids.length === 0) return;
  const result = await runner("docker", ["stop", ...ids]);
  if (result.exitCode !== 0) {
    throw new Error(result.stderr || "无法停止 Compose 项目");
  }
}
