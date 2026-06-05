import { describe, expect, it, vi } from "vitest";
import { collectHardwareSnapshot, parseHardwareSnapshotJson } from "./hardware";

const sample = {
  sampledAt: "2026-06-05T10:00:00.000Z",
  cpu: {
    name: "Intel Core i9",
    usagePercent: 24.5,
    powerWatts: 38.2,
    temperatureCelsius: 66,
    cores: [
      { name: "0", usagePercent: 11 },
      { name: "1", usagePercent: 42 }
    ]
  },
  memory: {
    totalBytes: 34359738368,
    usedBytes: 17179869184,
    usagePercent: 50
  },
  disks: [
    {
      name: "C:",
      label: "System",
      totalBytes: 1000,
      freeBytes: 250,
      usedBytes: 750,
      usagePercent: 75,
      readBytesPerSecond: 1024,
      writeBytesPerSecond: 2048
    }
  ],
  gpus: [
    {
      name: "NVIDIA GeForce RTX",
      vendor: "nvidia",
      usagePercent: 18,
      memoryTotalBytes: 8589934592,
      memoryUsedBytes: 2147483648,
      temperatureCelsius: 61,
      powerWatts: 92
    },
    {
      name: "Intel UHD Graphics",
      vendor: "intel",
      usagePercent: null,
      memoryTotalBytes: null,
      memoryUsedBytes: null,
      temperatureCelsius: null,
      powerWatts: null
    }
  ],
  networks: [
    {
      name: "Ethernet",
      speedBitsPerSecond: 1000000000,
      receiveBytesPerSecond: 4096,
      transmitBytesPerSecond: 2048
    }
  ]
};

describe("硬件资源快照", () => {
  it("把 PowerShell JSON 映射为硬件资源快照", () => {
    const snapshot = parseHardwareSnapshotJson(JSON.stringify(sample));

    expect(snapshot.cpu.usagePercent).toBe(24.5);
    expect(snapshot.cpu.cores).toHaveLength(2);
    expect(snapshot.memory.usedBytes).toBe(17179869184);
    expect(snapshot.disks[0].usagePercent).toBe(75);
    expect(snapshot.gpus.map((gpu) => gpu.vendor)).toEqual(["nvidia", "intel"]);
    expect(snapshot.networks[0].transmitBytesPerSecond).toBe(2048);
  });

  it("采样失败时返回清晰错误", async () => {
    const run = vi.fn().mockResolvedValue({ stdout: "", stderr: "计数器不可用", exitCode: 1 });

    await expect(collectHardwareSnapshot(run)).rejects.toThrow("计数器不可用");
  });

  it("通过 PowerShell 采样硬件资源", async () => {
    const run = vi.fn().mockResolvedValue({ stdout: JSON.stringify(sample), stderr: "", exitCode: 0 });

    await collectHardwareSnapshot(run);

    expect(run).toHaveBeenCalledWith("powershell.exe", expect.arrayContaining(["-EncodedCommand"]));
  });
});
