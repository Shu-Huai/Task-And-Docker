# 任务与 Docker 实施计划

> **给自动化开发代理：** 需要按任务逐项执行。每个任务使用 checkbox 语法跟踪状态，并在完成后提交。

**目标：** 构建一个 Windows 本机运行的认证网页应用，用于管理一个配置的任务计划程序文件夹和本机 Docker 容器。

**架构：** TypeScript Express 后端提供认证 API，并包装本机 PowerShell 与 Docker CLI。React/Vite 前端渲染两个响应式管理页面并调用这些 API。

**技术栈：** Node.js、TypeScript、Express、express-session、React、Vite、Vitest、Testing Library、Supertest、Lucide React。

---

### 任务 1：仓库与配置

**文件：**
- 新建：`package.json`
- 新建：`tsconfig.json`
- 新建：`vite.config.ts`
- 新建：`vitest.config.ts`
- 新建：`config/app.config.json`
- 新建：`.gitignore`

- [ ] 添加项目工具链和本地配置。
- [ ] 提交信息：`chore: initialize project tooling`。

### 任务 2：后端系统包装器

**文件：**
- 新建：`src/server/config.ts`
- 新建：`src/server/command.ts`
- 新建：`src/server/tasks.ts`
- 新建：`src/server/docker.ts`
- 测试：`src/server/*.test.ts`

- [ ] 编写配置加载、Docker JSON 解析、任务计划程序输出映射、资源操作校验的失败测试。
- [ ] 实现最小后端包装器。
- [ ] 运行定向 Vitest 测试。
- [ ] 提交信息：`feat: add system resource wrappers`。

### 任务 3：后端 API 与鉴权

**文件：**
- 新建：`src/server/app.ts`
- 新建：`src/server/index.ts`
- 测试：`src/server/app.test.ts`

- [ ] 编写登录、受保护 API、任务操作、Docker 操作的失败测试。
- [ ] 实现 Express 会话鉴权和路由。
- [ ] 运行后端测试。
- [ ] 提交信息：`feat: add authenticated api`。

### 任务 4：前端应用

**文件：**
- 新建：`index.html`
- 新建：`src/client/main.tsx`
- 新建：`src/client/App.tsx`
- 新建：`src/client/api.ts`
- 新建：`src/client/styles.css`

- [ ] 编写登录、导航标签、资源操作渲染的失败组件测试。
- [ ] 实现响应式应用外壳、任务页面、Docker 页面和交互状态。
- [ ] 运行前端测试和构建。
- [ ] 提交信息：`feat: build responsive management UI`。

### 任务 5：README 与 Graphify

**文件：**
- 新建：`README.md`
- 生成：`graphify-out/*`

- [ ] 编写 README，包含安装、配置、Windows 运行说明和安全说明。
- [ ] 运行 Graphify 生成项目架构图谱输出。
- [ ] 提交文档和图谱输出。

### 任务 6：分支集成

- [ ] 创建 `dev` 和各个 `feature/*` 分支。
- [ ] 将功能分支合并到 `dev`。
- [ ] 将 `dev` 合并到 `master`。
- [ ] 添加远程仓库 `https://github.com/Shu-Huai/Task-And-Docker.git`。
- [ ] 如果认证可用，推送 `master`、`dev` 和功能分支。
