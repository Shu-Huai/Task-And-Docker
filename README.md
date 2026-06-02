# Task And Docker

Task And Docker is a Windows-native HTTP web console for two local operations tasks:

- Manage tasks inside one configured Windows Task Scheduler folder.
- Manage local Docker containers.

It is intentionally small: browse, inspect, run/start, stop/end, and disable task entries. It does not create, edit, delete, import, export, or SSH-manage resources.

## Features

- Password-protected web UI with an HTTP-only session cookie.
- Task Scheduler page for a configured folder such as `\Auto-Start-A\`.
- Docker page powered by the local Docker CLI.
- Desktop sidebar layout and mobile bottom navigation.
- Confirmation prompts for stop, end, and disable operations.
- Backend validation that actions target resources from the current local listing.

## Requirements

- Windows
- Node.js 24 or newer
- PowerShell with the Windows ScheduledTasks module
- Docker CLI available on `PATH`

## Configuration

Edit [config/app.config.json](config/app.config.json):

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
> Change the password before exposing the app. This project uses HTTP by requirement, so do not reuse an important password.

## Development

Install dependencies:

```powershell
npm install
```

Run the backend and Vite frontend:

```powershell
npm run dev
```

Open:

```text
http://127.0.0.1:5173
```

The Vite dev server proxies `/api` requests to the Express server on port `3000`.

## Verification

Run tests:

```powershell
npm test
```

Build the frontend:

```powershell
npm run build
```

## Runtime Notes

The final application runs commands on the same Windows machine where it is hosted:

- Task Scheduler uses local PowerShell commands.
- Docker uses the local `docker` CLI.

SSH was used only during development to validate command behavior against the target server. SSH code is not part of the product.

## Git Workflow

The repository uses:

- `master` for stable integrated code.
- `dev` for integration.
- `feature/*` branches for focused work.

This project was built with short commits for design, tooling, backend wrappers, API auth, UI, and documentation.
