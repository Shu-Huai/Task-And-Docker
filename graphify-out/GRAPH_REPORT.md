# Graphify 报告

语料：21 个文件
图谱：143 个节点，190 条边，12 个社区

## 核心节点
- 任务与 Docker 设计：度数 9
- scripts：度数 9
- runTaskCommand()：度数 8
- 任务与 Docker：度数 8
- 任务与 Docker 实施计划：度数 7
- createApp：度数 6
- listTasks：度数 6
- listContainers：度数 5

## 社区
- 社区 0（22 个节点，凝聚度 0.14）：AppServices、asyncRoute()、createApp、CreateAppOptions、defaultServices()、paramAsString()、SessionData、config
- 社区 1（17 个节点，凝聚度 0.14）：api、ContainerRow、requestJson()、TaskRow、App()、DockerPage()、formatTime()、Login()
- 社区 2（17 个节点，凝聚度 0.12）：devDependencies、concurrently、jsdom、supertest、@testing-library/jest-dom、@testing-library/react、@testing-library/user-event、tsx
- 社区 3（14 个节点，凝聚度 0.14）：dependencies、express、express-session、helmet、lucide-react、react、react-dom、@vitejs/plugin-react
- 社区 4（14 个节点，凝聚度 0.26）：CommandResult、CommandRunner、runCommand()、runPowerShell、assertContainerExists()、DockerPsLine、listContainers、parseDockerPsJsonLines
- 社区 5（12 个节点，凝聚度 0.36）：assertTaskExists()、disableTask、escapePowerShellSingleQuoted()、listTasks、parsePowerShellDate()、parseScheduledTaskJson、PowerShellTask、runTask
- 社区 6（10 个节点，凝聚度 0.20）：auth、password、docker、enabled、app.config.json、server、host、port
- 社区 7（10 个节点，凝聚度 0.20）：2026-06-03-task-and-docker-design.md、任务与 Docker 设计、安全、架构、界面、目标、范围、配置
- 社区 8（9 个节点，凝聚度 0.22）：scripts、build、build:server、dev、dev:client、dev:server、start、test
- 社区 9（9 个节点，凝聚度 0.22）：Git 工作流、README.md、任务与 Docker、功能、开发、运行要求、运行说明、配置
- 社区 10（8 个节点，凝聚度 0.25）：2026-06-03-task-and-docker.md、任务 1：仓库与配置、任务 2：后端系统包装器、任务 3：后端 API 与鉴权、任务 4：前端应用、任务 5：README 与 Graphify、任务 6：分支集成、任务与 Docker 实施计划
- 社区 11（1 个节点，凝聚度 1.00）：setup.ts

## 意外连接
- makeApp() 通过 calls 连接到 createApp
- runTaskCommand() 通过 calls 连接到 runPowerShell
- runTaskCommand() 通过 calls 连接到 normalizeTaskFolder

## 说明
- 由于当前环境的 Graphify CLI 需要外部 LLM API key，本报告使用本地 Graphify Python 模块生成。
