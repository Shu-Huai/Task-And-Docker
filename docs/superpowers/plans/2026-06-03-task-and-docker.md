# Task And Docker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Windows-native authenticated web app for managing one configured Task Scheduler folder and local Docker containers.

**Architecture:** A TypeScript Express backend exposes authenticated APIs and wraps local PowerShell/Docker CLI calls. A React/Vite frontend renders two responsive management pages and calls those APIs.

**Tech Stack:** Node.js, TypeScript, Express, express-session, React, Vite, Vitest, Testing Library, Supertest, Lucide React.

---

### Task 1: Repository And Config

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `vitest.config.ts`
- Create: `config/app.config.json`
- Create: `.gitignore`

- [ ] Add project tooling and local configuration.
- [ ] Commit with `chore: initialize project tooling`.

### Task 2: Backend System Wrappers

**Files:**
- Create: `src/server/config.ts`
- Create: `src/server/command.ts`
- Create: `src/server/tasks.ts`
- Create: `src/server/docker.ts`
- Test: `src/server/*.test.ts`

- [ ] Write failing tests for config loading, Docker JSON parsing, Task Scheduler output mapping, and resource action validation.
- [ ] Implement minimal backend wrappers.
- [ ] Run targeted Vitest tests.
- [ ] Commit with `feat: add system resource wrappers`.

### Task 3: Backend API And Auth

**Files:**
- Create: `src/server/app.ts`
- Create: `src/server/index.ts`
- Test: `src/server/app.test.ts`

- [ ] Write failing tests for login, protected APIs, task actions, and Docker actions.
- [ ] Implement Express session auth and routes.
- [ ] Run backend tests.
- [ ] Commit with `feat: add authenticated api`.

### Task 4: Frontend Application

**Files:**
- Create: `index.html`
- Create: `src/client/main.tsx`
- Create: `src/client/App.tsx`
- Create: `src/client/api.ts`
- Create: `src/client/styles.css`

- [ ] Write failing component tests for login, navigation labels, and resource action rendering.
- [ ] Implement responsive app shell, task page, Docker page, and interaction states.
- [ ] Run frontend tests and build.
- [ ] Commit with `feat: build responsive management UI`.

### Task 5: README And Graphify

**Files:**
- Create: `README.md`
- Generated: `graphify-out/*`

- [ ] Write README with setup, config, Windows runtime notes, and security notes.
- [ ] Run Graphify on the project to generate architecture graph outputs.
- [ ] Commit documentation and graph outputs.

### Task 6: Branch Integration

- [ ] Create `dev` and feature branches for the implementation history.
- [ ] Merge feature branches into `dev`.
- [ ] Merge `dev` into `master`.
- [ ] Add remote `https://github.com/Shu-Huai/Task-And-Docker.git`.
- [ ] Push `master`, `dev`, and feature branches if authentication is available.
