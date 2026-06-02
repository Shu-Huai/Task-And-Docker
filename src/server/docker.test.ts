import { describe, expect, it, vi } from "vitest";
import { listContainers, parseDockerPsJsonLines, startContainer, stopContainer } from "./docker";

describe("Docker 输出解析", () => {
  it("把 Docker JSON 行映射为容器行", () => {
    const lines = [
      JSON.stringify({
        ID: "671e293cb894",
        Names: "dbgate",
        Image: "dbgate/dbgate",
        Ports: "0.0.0.0:15472->3000/tcp, [::]:15472->3000/tcp",
        RunningFor: "5 weeks ago",
        State: "running",
        Status: "Up 34 hours"
      }),
      JSON.stringify({
        ID: "e88b59aecb25",
        Names: "convertx",
        Image: "ghcr.io/c4illin/convertx:latest",
        Ports: "",
        RunningFor: "2 months ago",
        State: "exited",
        Status: "Exited (0) 20 days ago"
      })
    ].join("\n");

    expect(parseDockerPsJsonLines(lines)).toEqual([
      {
        id: "671e293cb894",
        name: "dbgate",
        image: "dbgate/dbgate",
        ports: "0.0.0.0:15472->3000/tcp, [::]:15472->3000/tcp",
        lastStarted: "5 weeks ago",
        state: "running",
        status: "Up 34 hours"
      },
      {
        id: "e88b59aecb25",
        name: "convertx",
        image: "ghcr.io/c4illin/convertx:latest",
        ports: "",
        lastStarted: "2 months ago",
        state: "exited",
        status: "Exited (0) 20 days ago"
      }
    ]);
  });
});

describe("Docker 操作", () => {
  it("只启动当前列表中存在的容器", async () => {
    const run = vi
      .fn()
      .mockResolvedValueOnce({ stdout: '{"ID":"abc123","Names":"db","Image":"postgres","Ports":"","RunningFor":"1 day ago","State":"exited","Status":"Exited"}', stderr: "", exitCode: 0 })
      .mockResolvedValueOnce({ stdout: "abc123\n", stderr: "", exitCode: 0 });

    await startContainer("abc123", run);

    expect(run).toHaveBeenNthCalledWith(2, "docker", ["start", "abc123"]);
  });

  it("拒绝停止未知容器", async () => {
    const run = vi.fn().mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });

    await expect(stopContainer("missing", run)).rejects.toThrow("未找到容器");
  });

  it("使用 docker ps 列出容器", async () => {
    const run = vi.fn().mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });

    await listContainers(run);

    expect(run).toHaveBeenCalledWith("docker", ["ps", "-a", "--format", "{{json .}}"]);
  });
});
