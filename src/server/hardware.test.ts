import { describe, expect, it, vi } from "vitest";
import { collectHardwareSnapshot, normalizeHardwareSnapshot, parseHardwareSnapshotJson, type HardwareSnapshot } from "./hardware";

const sample: HardwareSnapshot = {
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

  it("过滤虚拟显卡并保留真实显卡", () => {
    const snapshot = normalizeHardwareSnapshot({
      ...sample,
      gpus: [
        { name: "GameViewer Virtual Display Adapter", vendor: "unknown", usagePercent: null, memoryTotalBytes: null, memoryUsedBytes: null, temperatureCelsius: null, powerWatts: null },
        ...sample.gpus
      ]
    });

    expect(snapshot.gpus.map((gpu) => gpu.name)).toEqual(["NVIDIA GeForce RTX", "Intel UHD Graphics"]);
  });

  it("修复磁盘空间采样中的缺失使用量", () => {
    const snapshot = normalizeHardwareSnapshot(({
      ...sample,
      memory: { totalBytes: 137216507904, usedBytes: null, usagePercent: 0 },
      disks: [{ ...sample.disks[0], totalBytes: 1000, freeBytes: 250, usedBytes: null, usagePercent: 0 }]
    } as unknown) as HardwareSnapshot);

    expect(snapshot.disks[0].usedBytes).toBe(750);
    expect(snapshot.disks[0].usagePercent).toBe(75);
  });

  it("从传感器源补充 CPU 温度和功耗", () => {
    const snapshot = normalizeHardwareSnapshot(({
      ...sample,
      cpu: { ...sample.cpu, temperatureCelsius: null, powerWatts: null },
      sensorReadings: [
        { hardwareName: "Intel Core i9", name: "CPU Package", type: "Temperature", value: 71 },
        { hardwareName: "Intel Core i9", name: "CPU Package", type: "Power", value: 96 }
      ]
    } as unknown) as HardwareSnapshot);

    expect(snapshot.cpu.temperatureCelsius).toBe(71);
    expect(snapshot.cpu.powerWatts).toBe(96);
  });

  it("从 GPU 计数器补充核显占用和显存", () => {
    const snapshot = normalizeHardwareSnapshot(({
      ...sample,
      gpus: [{ name: "Intel(R) UHD Graphics 770", vendor: "intel", usagePercent: null, memoryTotalBytes: 2147479552, memoryUsedBytes: null, temperatureCelsius: null, powerWatts: null }],
      gpuCounters: [
        { luid: "0x00000000_0x0000E743", usagePercent: 7, totalCommittedBytes: 5201776640, dedicatedUsageBytes: 4086259712, sharedUsageBytes: 293445632 },
        { luid: "0x00000000_0x00010485", usagePercent: 12, totalCommittedBytes: 48193536, dedicatedUsageBytes: 0, sharedUsageBytes: 39010304 }
      ]
    } as unknown) as HardwareSnapshot);

    expect(snapshot.gpus[0].usagePercent).toBe(12);
    expect(snapshot.gpus[0].memoryUsedBytes).toBe(48193536);
  });
});
