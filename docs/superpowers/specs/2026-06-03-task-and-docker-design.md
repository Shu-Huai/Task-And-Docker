# 任务与 Docker 设计

## 目标

构建一个运行在 Windows 本机上的 HTTP 网页应用，用于管理一个配置好的 Windows 任务计划程序文件夹，以及本机 Docker 容器。应用运行在哪台机器上，就管理哪台机器上的资源。SSH 只用于开发期验证目标服务器上的命令方案。

## 范围

应用包含两个需要登录后访问的页面：

- 任务计划程序页面：浏览一个配置文件夹中的任务，查看名称、状态、上次运行时间、上次运行结果，并提供运行、结束、禁用操作。
- Docker 页面：浏览本机容器，查看名称、镜像、端口、状态、上次启动时间，并提供启动、停止操作。

应用不提供创建、编辑、删除、导入、导出，也不提供 SSH 管理功能。

## 架构

后端使用 Node.js 与 Express，前端使用 React、Vite 与 TypeScript。后端负责所有系统访问并提供 JSON API，前端负责响应式运维控制台界面。

任务计划程序访问使用本机 PowerShell 命令：

- `Get-ScheduledTask`
- `Get-ScheduledTaskInfo`
- `Start-ScheduledTask`
- `Stop-ScheduledTask`
- `Disable-ScheduledTask`

Docker 访问使用本机 Docker CLI：

- `docker ps -a --format "{{json .}}"`
- `docker start <id>`
- `docker stop <id>`

## 配置

启动时读取 `config/app.config.json`。配置包含：

- HTTP 监听地址和端口。
- 单密码登录使用的明文密码。
- 任务计划程序文件夹路径，例如 `\Auto-Start-A`。

密码按项目要求写在本地配置文件中。README 必须提醒用户在公网暴露前改成强密码。

## 鉴权

使用密码登录和 HTTP-only、same-site 会话 Cookie。除登录和会话状态接口外，所有 API 都需要登录。密码错误时返回统一错误信息。

## 安全

后端不能直接信任请求路径里的任务名或容器 ID。每次执行操作前，后端都先读取当前可管理资源列表，确认目标存在后再执行操作。

命令执行尽量使用参数数组。PowerShell 脚本通过 `-EncodedCommand` 传入，避免 `$_.TaskName` 这类表达式被外层 shell 二次解析。

## 界面

桌面端使用左侧导航栏加内容区。手机端使用固定底部导航栏加内容区。表格在小屏幕上折叠成紧凑列表，避免横向溢出。

界面风格克制、清晰、数据优先。状态、加载、错误和确认弹窗都必须明确。

## 验证结论

开发期通过 SSH 连接 `ms-7d30.ssh.lvshuhuai.cn` 验证：

- `Get-ScheduledTask -TaskPath '\Auto-Start-A\'` 可以列出任务。
- `Get-ScheduledTaskInfo` 可以返回上次运行时间和运行结果。
- `Start-ScheduledTask`、`Stop-ScheduledTask`、`Disable-ScheduledTask` 可用。
- `docker ps -a --format "{{json .}}"` 可以返回容器名称、镜像、端口、状态和运行时间等 JSON 行。

最终应用不包含 SSH 代码。
