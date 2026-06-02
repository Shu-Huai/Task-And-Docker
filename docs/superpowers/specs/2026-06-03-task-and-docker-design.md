# Task And Docker Design

## Goal

Build a Windows-native HTTP web app for managing a configured Windows Task Scheduler folder and local Docker containers. The app runs on the machine it manages. SSH is used only during development to validate command strategies against the target server.

## Scope

The app has two authenticated pages:

- Task Scheduler page: browse tasks in one configured folder, view name, state, last run time, and last run result, then run, stop, or disable a task.
- Docker page: browse local containers, view name, image, ports, last started, and state, then start or stop a container.

The app does not create, edit, delete, import, export, or SSH-manage tasks or containers.

## Architecture

Use a small Node.js and Express backend with a React, Vite, and TypeScript frontend. The backend owns all system access and serves JSON APIs. The frontend is a responsive operations console with desktop sidebar navigation and mobile bottom navigation.

Windows Task Scheduler access uses PowerShell cmdlets on the local machine:

- `Get-ScheduledTask`
- `Get-ScheduledTaskInfo`
- `Start-ScheduledTask`
- `Stop-ScheduledTask`
- `Disable-ScheduledTask`

Docker access uses the local Docker CLI:

- `docker ps -a --format "{{json .}}"`
- `docker start <id>`
- `docker stop <id>`

## Configuration

Read `config/app.config.json` at startup. The config contains:

- HTTP host and port.
- Plaintext password for the single app login.
- Task Scheduler folder path, for example `\Auto-Start-A`.

The password is intentionally local-file based because this project requires that behavior. The README must warn users to set a strong password when exposing the HTTP app publicly.

## Authentication

Use a password login backed by an HTTP-only same-site cookie session. Every API route except login and session status requires authentication. Failed login returns a generic error.

## Safety

The backend must not directly trust task names or container IDs from request paths. For each action, it first lists the current manageable resources, confirms the requested task/container exists, then runs the operation.

Command execution uses argument arrays rather than shell string concatenation where possible.

## UI

Desktop layout uses a left sidebar and content area. Mobile layout uses a fixed bottom navigation and content area. Tables collapse into compact list cards on small screens.

The interface is restrained, work-focused, and data-first. It uses clear status labels, loading states, error messages, and confirmation dialogs for stop, disable, and end actions.

## Verification Findings

Development-time SSH verification against `ms-7d30.ssh.lvshuhuai.cn` confirmed:

- `Get-ScheduledTask -TaskPath '\Auto-Start-A\'` can list tasks.
- `Get-ScheduledTaskInfo` can return last run time and result.
- `Start-ScheduledTask`, `Stop-ScheduledTask`, and `Disable-ScheduledTask` are available.
- `docker ps -a --format "{{json .}}"` returns JSON lines with container names, images, ports, status, state, and running age.

The final app must not include SSH code.
