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
- 服务进程页面按端口登记要管理的服务，只展示这些端口上当前监听的进程，例如 MySQL、Redis、Spring Boot、FastAPI、Node.js、Go 服务等。
- 桌面端使用左侧导航栏，手机端使用底部导航栏。
- 停止、结束、禁用等高影响操作会先弹出确认。
- 后端执行操作前会先确认目标资源存在于当前本机列表中。

## 运行要求

- Windows
- Node.js 24 或更新版本
- PowerShell
- Docker CLI 已加入 `PATH`
- 如需 CPU 温度和 CPU 功耗：安装本项目提供的本地传感器程序，并建议安装 PowerShell 7

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
  },
  "services": {
    "managedPorts": [8080, 3306, 6379]
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

Windows 自带 CIM 和性能计数器不会稳定暴露 CPU 温度、CPU 封装功耗。本项目提供安装脚本，把 LibreHardwareMonitor 作为本机传感器提供器安装到 `tools/LibreHardwareMonitor`。应用不会注册开机任务；运行 `npm run dev` 或 `npm start` 后，后端会在硬件采样前按需启动这个本地程序，并优先用 PowerShell 7 直接读取 LibreHardwareMonitor 传感器库。

在部署机器上运行：

```powershell
npm run install:sensors
```

安装完成后运行 `npm run dev` 或 `npm start`，再打开硬件资源页面。`tools/` 目录只保存本机下载的工具，不进入 Git 仓库。如果 CPU 传感器仍然为空，请用管理员 PowerShell 启动应用进程。

## 管理服务进程

服务进程页面把端口作为长期管理对象。添加 `8080`、`3306`、`6379` 这类端口后，页面会通过 Windows 监听端口查找当前 PID，并展示进程名、状态、CPU、内存、磁盘 I/O 和网络列。停止进程后 PID 会消失，但端口仍保留在列表中并显示为“未监听”，方便服务稍后重启后继续被同一个端口槽位追踪。

端口列表会写回 `config/app.config.json` 的 `services.managedPorts`。网络列在 Windows 无法稳定按进程采样时会显示 `-`；端口到进程的识别不依赖服务栈，因此适用于 MySQL、Redis、Java/Spring Boot、Python/FastAPI、Node.js、Go 等本机监听端口的服务。

## 运行说明

最终应用只管理它所在的那台 Windows 机器：

- 任务计划程序使用本机 PowerShell 命令。
- Docker 使用本机 `docker` CLI。
- 服务进程使用本机 PowerShell 的 `Get-NetTCPConnection`、`Get-Process` 和性能计数器按端口解析监听进程。
- 硬件资源使用本机 PowerShell、CIM 和性能计数器采样；NVIDIA GPU 会额外尝试读取 `nvidia-smi`，Intel、AMD 会尝试读取 Windows GPU 性能计数器。
- CPU 温度、CPU 功耗由本机 LibreHardwareMonitor 或 OpenHardwareMonitor WMI 传感器提供；应用会优先尝试启动 `tools/LibreHardwareMonitor` 中的本项目传感器程序。

开发阶段曾使用 SSH 验证目标服务器上的命令行为，但最终产品不包含 SSH 功能。

## Git 工作流

仓库使用：

- `master`：稳定集成分支。
- `dev`：开发集成分支。
- `feature/*`：功能分支。

开发过程采用短小提交，分别记录设计、工具链、后端包装器、鉴权 API、界面、文档和运行修复。
