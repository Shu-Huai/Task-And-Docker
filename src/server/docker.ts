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
};

type DockerPsLine = {
  ID?: string;
  Names?: string;
  Image?: string;
  Ports?: string;
  RunningFor?: string;
  State?: string;
  Status?: string;
};

export function parseDockerPsJsonLines(stdout: string): DockerContainer[] {
  return stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as DockerPsLine)
    .map((item) => ({
      id: item.ID ?? "",
      name: item.Names ?? "",
      image: item.Image ?? "",
      ports: item.Ports ?? "",
      lastStarted: item.RunningFor ?? "",
      state: item.State ?? "",
      status: item.Status ?? ""
    }));
}

export async function listContainers(runner: CommandRunner = runCommand): Promise<DockerContainer[]> {
  const result = await runner("docker", ["ps", "-a", "--format", "{{json .}}"]);
  if (result.exitCode !== 0) {
    throw new Error(result.stderr || "Unable to list Docker containers");
  }
  return parseDockerPsJsonLines(result.stdout);
}

async function assertContainerExists(id: string, runner: CommandRunner): Promise<void> {
  const containers = await listContainers(runner);
  if (!containers.some((container) => container.id === id)) {
    throw new Error("Container not found");
  }
}

export async function startContainer(id: string, runner: CommandRunner = runCommand): Promise<void> {
  await assertContainerExists(id, runner);
  const result = await runner("docker", ["start", id]);
  if (result.exitCode !== 0) {
    throw new Error(result.stderr || "Unable to start container");
  }
}

export async function stopContainer(id: string, runner: CommandRunner = runCommand): Promise<void> {
  await assertContainerExists(id, runner);
  const result = await runner("docker", ["stop", id]);
  if (result.exitCode !== 0) {
    throw new Error(result.stderr || "Unable to stop container");
  }
}
