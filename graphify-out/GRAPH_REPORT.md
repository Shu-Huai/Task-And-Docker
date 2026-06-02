# Graphify Report

Corpus: 20 files
Graph: 141 nodes, 187 edges, 12 communities

## God Nodes
- Task And Docker Design: degree 9
- runTaskCommand(): degree 8
- Task And Docker: degree 8
- scripts: degree 8
- Task And Docker Implementation Plan: degree 7
- createApp: degree 6
- listTasks: degree 6
- listContainers: degree 5

## Communities
- Community 0 (21 nodes, cohesion 0.15): AppServices, asyncRoute(), createApp, CreateAppOptions, defaultServices(), paramAsString(), SessionData, config
- Community 1 (17 nodes, cohesion 0.14): api, ContainerRow, requestJson(), TaskRow, App(), DockerPage(), formatTime(), Login()
- Community 2 (17 nodes, cohesion 0.12): devDependencies, concurrently, jsdom, supertest, @testing-library/jest-dom, @testing-library/react, @testing-library/user-event, tsx
- Community 3 (13 nodes, cohesion 0.15): package.json, name, private, scripts, build, dev, dev:client, dev:server
- Community 4 (13 nodes, cohesion 0.28): CommandResult, CommandRunner, runCommand(), assertContainerExists(), DockerContainer, DockerPsLine, listContainers, parseDockerPsJsonLines
- Community 5 (13 nodes, cohesion 0.33): runPowerShell, assertTaskExists(), disableTask, escapePowerShellSingleQuoted(), listTasks, parsePowerShellDate(), parseScheduledTaskJson, PowerShellTask
- Community 6 (10 nodes, cohesion 0.20): auth, password, docker, enabled, app.config.json, server, host, port
- Community 7 (10 nodes, cohesion 0.20): 2026-06-03-task-and-docker-design.md, Architecture, Authentication, Configuration, Goal, Safety, Scope, Task And Docker Design
- Community 8 (9 nodes, cohesion 0.22): dependencies, express, express-session, helmet, lucide-react, react, react-dom, @vitejs/plugin-react
- Community 9 (9 nodes, cohesion 0.22): Configuration, Development, Features, Git Workflow, README.md, Requirements, Runtime Notes, Task And Docker
- Community 10 (8 nodes, cohesion 0.25): 2026-06-03-task-and-docker.md, Task 1: Repository And Config, Task 2: Backend System Wrappers, Task 3: Backend API And Auth, Task 4: Frontend Application, Task 5: README And Graphify, Task 6: Branch Integration, Task And Docker Implementation Plan
- Community 11 (1 nodes, cohesion 1.00): setup.ts

## Surprising Connections
- {'source': 'makeApp()', 'target': 'createApp', 'source_files': ['src/server/app.test.ts', 'src/server/app.ts'], 'confidence': 'EXTRACTED', 'relation': 'calls', 'why': 'peripheral node `makeApp()` unexpectedly reaches hub `createApp`'}
- {'source': 'runTaskCommand()', 'target': 'normalizeTaskFolder', 'source_files': ['src/server/tasks.ts', 'src/server/config.ts'], 'confidence': 'EXTRACTED', 'relation': 'calls', 'why': 'bridges separate communities'}
- {'source': 'runTaskCommand()', 'target': 'runPowerShell', 'source_files': ['src/server/tasks.ts', 'src/server/command.ts'], 'confidence': 'EXTRACTED', 'relation': 'calls', 'why': 'cross-file semantic connection'}

## Notes
- Generated with local Graphify Python modules because the Graphify CLI required an external LLM API key in this environment.
