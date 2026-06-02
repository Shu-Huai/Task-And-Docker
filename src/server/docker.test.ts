import { describe, expect, it, vi } from "vitest";
import { listContainers, parseDockerPsJsonLines, startContainer, stopContainer } from "./docker";

describe("parseDockerPsJsonLines", () => {
  it("maps Docker JSON lines into container rows", () => {
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

describe("Docker actions", () => {
  it("starts only containers returned by the current list", async () => {
    const run = vi
      .fn()
      .mockResolvedValueOnce({ stdout: '{"ID":"abc123","Names":"db","Image":"postgres","Ports":"","RunningFor":"1 day ago","State":"exited","Status":"Exited"}', stderr: "", exitCode: 0 })
      .mockResolvedValueOnce({ stdout: "abc123\n", stderr: "", exitCode: 0 });

    await startContainer("abc123", run);

    expect(run).toHaveBeenNthCalledWith(2, "docker", ["start", "abc123"]);
  });

  it("rejects stop for an unknown container id", async () => {
    const run = vi.fn().mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });

    await expect(stopContainer("missing", run)).rejects.toThrow("Container not found");
  });

  it("lists containers using docker ps", async () => {
    const run = vi.fn().mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });

    await listContainers(run);

    expect(run).toHaveBeenCalledWith("docker", ["ps", "-a", "--format", "{{json .}}"]);
  });
});
