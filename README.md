# 任务与 Docker

这是一个运行在 Windows 本机上的 HTTP 运维控制台，用来管理两类本机资源：

- 指定文件夹中的 Windows 任务计划程序任务。
- 本机 Docker 容器。

应用刻意保持小而清晰：只提供浏览、查看、运行或启动、结束或停止、禁用任务这些能力。不提供创建、编辑、删除、导入、导出，也不提供 SSH 远程管理。

## 功能

- 基于本地配置密码的登录保护，并使用 HTTP-only 会话 Cookie。
- 任务计划程序页面读取配置中的文件夹，例如 `\Auto-Start-A\`。
- Docker 页面通过本机 Docker CLI 读取容器，并按 Docker Compose 项目折叠分组、启动或停止整组容器。
- 硬件资源页面展示 CPU、内存、磁盘、GPU 和网卡指标，并支持每秒、每五秒、每分钟刷新。
- 桌面端使用左侧导航栏，手机端使用底部导航栏。
- 停止、结束、禁用等高影响操作会先弹出确认。
- 后端执行操作前会先确认目标资源存在于当前本机列表中。

## 运行要求

- Windows
- Node.js 24 或更新版本
- PowerShell，并带有 Windows ScheduledTasks 模块
- Docker CLI 已加入 `PATH`
- 如需 CPU 温度和 CPU 功耗：安装本项目提供的本地传感器程序

## 配置

编辑 [config/app.config.json](config/app.config.json)：

```json
{
  "server": {
    "host": "::",
    "port": 3000
  },
  "auth": {
    "password": "change-me-now"
  },
  "tasks": {
    "folder": "\\Auto-Start-A"
  },
  "docker": {
    "enabled": true
  }
}
```

> [!IMPORTANT]
> 暴露到公网前请务必修改密码。本项目按要求只使用 HTTP，不使用 HTTPS，所以不要复用重要密码。

## 开发

安装依赖：

```powershell
npm install
```

启动后端和 Vite 前端：

```powershell
npm run dev
```

打开：

```text
http://127.0.0.1:5173
```

Vite 开发服务器会把 `/api` 请求代理到 `3000` 端口上的 Express 后端。

## 验证

运行测试：

```powershell
npm test
```

构建前端和后端：

```powershell
npm run build
```

## 启用 CPU 温度和功耗

Windows 自带 CIM 和性能计数器不会稳定暴露 CPU 温度、CPU 封装功耗。本项目提供安装脚本，把 LibreHardwareMonitor 作为本机传感器提供器安装到 `tools/LibreHardwareMonitor`，并注册一个高权限开机任务，让应用能从 `root\LibreHardwareMonitor` 读取 CPU 温度和功耗。

在部署机器上用管理员 PowerShell 运行：

```powershell
npm run install:sensors
```

安装完成后重启本应用，再打开硬件资源页面。`tools/` 目录只保存本机下载的工具，不进入 Git 仓库。

## 运行说明

最终应用只管理它所在的那台 Windows 机器：

- 任务计划程序使用本机 PowerShell 命令。
- Docker 使用本机 `docker` CLI。
- 硬件资源使用本机 PowerShell、CIM 和性能计数器采样；NVIDIA GPU 会额外尝试读取 `nvidia-smi`，Intel、AMD 会尝试读取 Windows GPU 性能计数器。
- CPU 温度、CPU 功耗由本机 LibreHardwareMonitor 或 OpenHardwareMonitor WMI 传感器提供；应用会优先尝试启动 `tools/LibreHardwareMonitor` 中的本项目传感器程序。

开发阶段曾使用 SSH 验证目标服务器上的命令行为，但最终产品不包含 SSH 功能。

## Git 工作流

仓库使用：

- `master`：稳定集成分支。
- `dev`：开发集成分支。
- `feature/*`：功能分支。

开发过程采用短小提交，分别记录设计、工具链、后端包装器、鉴权 API、界面、文档和运行修复。
