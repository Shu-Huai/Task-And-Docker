import express, { type Request, type Response } from "express";
import session from "express-session";
import helmet from "helmet";
import { DEFAULT_CONFIG_PATH, saveManagedServicePorts, type AppConfig } from "./config";
import { collectHardwareSnapshot, type HardwareSnapshot } from "./hardware";
import {
  listContainers,
  startComposeProject,
  startContainer,
  stopComposeProject,
  stopContainer,
  type DockerContainer
} from "./docker";
import {
  listManagedServiceProcesses,
  stopManagedServiceProcess,
  type ServiceProcessRow
} from "./services";
import {
  disableTask,
  listTasks,
  runTask,
  stopTask,
  type ScheduledTask
} from "./tasks";

declare module "express-session" {
  interface SessionData {
    authenticated?: boolean;
  }
}

export type AppServices = {
  listTasks: (folder: string) => Promise<ScheduledTask[]>;
  runTask: (folder: string, taskName: string) => Promise<void>;
  stopTask: (folder: string, taskName: string) => Promise<void>;
  disableTask: (folder: string, taskName: string) => Promise<void>;
  listContainers: () => Promise<DockerContainer[]>;
  startContainer: (id: string) => Promise<void>;
  stopContainer: (id: string) => Promise<void>;
  startComposeProject: (project: string) => Promise<void>;
  stopComposeProject: (project: string) => Promise<void>;
  listManagedServiceProcesses: (ports: number[]) => Promise<ServiceProcessRow[]>;
  stopManagedServiceProcess: (port: number, managedPorts: number[]) => Promise<void>;
  collectHardwareSnapshot: () => Promise<HardwareSnapshot>;
};

type CreateAppOptions = {
  config: AppConfig;
  configPath?: string;
  services?: Partial<AppServices>;
  staticDir?: string;
};

function defaultServices(): AppServices {
  return {
    listTasks,
    runTask,
    stopTask,
    disableTask,
    listContainers,
    startContainer,
    stopContainer,
    startComposeProject,
    stopComposeProject,
    listManagedServiceProcesses,
    stopManagedServiceProcess,
    collectHardwareSnapshot
  };
}

function asyncRoute(handler: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response) => {
    handler(req, res).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : "发生未知错误";
      res.status(500).json({ error: message });
    });
  };
}

function paramAsString(value: string | string[]): string {
  return Array.isArray(value) ? value[0] : value;
}

export function createApp({ config, configPath = DEFAULT_CONFIG_PATH, services: serviceOverrides = {}, staticDir }: CreateAppOptions) {
  const app = express();
  const services: AppServices = { ...defaultServices(), ...serviceOverrides };
  let managedPorts = [...config.services.managedPorts];

  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(express.json());
  app.use(
    session({
      name: "task_docker_sid",
      secret: config.auth.password,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: "lax"
      }
    })
  );

  app.get("/api/me", (req, res) => {
    res.json({ authenticated: Boolean(req.session.authenticated) });
  });

  app.post("/api/auth/login", (req, res) => {
    if (req.body?.password !== config.auth.password) {
      res.status(401).json({ error: "密码错误" });
      return;
    }
    req.session.authenticated = true;
    res.json({ authenticated: true });
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy(() => {
      res.json({ authenticated: false });
    });
  });

  app.use("/api", (req, res, next) => {
    if (!req.session.authenticated) {
      res.status(401).json({ error: "需要先登录" });
      return;
    }
    next();
  });

  app.get(
    "/api/tasks",
    asyncRoute(async (_req, res) => {
      res.json({ items: await services.listTasks(config.tasks.folder) });
    })
  );

  app.post(
    "/api/tasks/:name/run",
    asyncRoute(async (req, res) => {
      await services.runTask(config.tasks.folder, paramAsString(req.params.name));
      res.json({ ok: true });
    })
  );

  app.post(
    "/api/tasks/:name/stop",
    asyncRoute(async (req, res) => {
      await services.stopTask(config.tasks.folder, paramAsString(req.params.name));
      res.json({ ok: true });
    })
  );

  app.post(
    "/api/tasks/:name/disable",
    asyncRoute(async (req, res) => {
      await services.disableTask(config.tasks.folder, paramAsString(req.params.name));
      res.json({ ok: true });
    })
  );

  app.get(
    "/api/docker/containers",
    asyncRoute(async (_req, res) => {
      res.json({ items: await services.listContainers() });
    })
  );

  app.get(
    "/api/hardware/snapshot",
    asyncRoute(async (_req, res) => {
      res.json({ item: await services.collectHardwareSnapshot() });
    })
  );

  app.get(
    "/api/services/processes",
    asyncRoute(async (_req, res) => {
      res.json({ items: await services.listManagedServiceProcesses(managedPorts), ports: managedPorts });
    })
  );

  app.post(
    "/api/services/ports",
    asyncRoute(async (req, res) => {
      const port = Number(req.body?.port);
      if (!Number.isInteger(port) || port < 1 || port > 65535) {
        res.status(400).json({ error: "端口号必须在 1 到 65535 之间" });
        return;
      }
      managedPorts = [...new Set([...managedPorts, port])].sort((left, right) => left - right);
      saveManagedServicePorts(configPath, managedPorts);
      res.json({ ports: managedPorts, items: await services.listManagedServiceProcesses(managedPorts) });
    })
  );

  app.delete(
    "/api/services/ports/:port",
    asyncRoute(async (req, res) => {
      const port = Number(paramAsString(req.params.port));
      managedPorts = managedPorts.filter((managedPort) => managedPort !== port);
      saveManagedServicePorts(configPath, managedPorts);
      res.json({ ports: managedPorts, items: await services.listManagedServiceProcesses(managedPorts) });
    })
  );

  app.post(
    "/api/docker/containers/:id/start",
    asyncRoute(async (req, res) => {
      await services.startContainer(paramAsString(req.params.id));
      res.json({ ok: true });
    })
  );

  app.post(
    "/api/docker/containers/:id/stop",
    asyncRoute(async (req, res) => {
      await services.stopContainer(paramAsString(req.params.id));
      res.json({ ok: true });
    })
  );

  app.post(
    "/api/services/ports/:port/stop",
    asyncRoute(async (req, res) => {
      await services.stopManagedServiceProcess(Number(paramAsString(req.params.port)), managedPorts);
      res.json({ ok: true });
    })
  );

  app.post(
    "/api/docker/projects/:project/start",
    asyncRoute(async (req, res) => {
      await services.startComposeProject(paramAsString(req.params.project));
      res.json({ ok: true });
    })
  );

  app.post(
    "/api/docker/projects/:project/stop",
    asyncRoute(async (req, res) => {
      await services.stopComposeProject(paramAsString(req.params.project));
      res.json({ ok: true });
    })
  );

  if (staticDir) {
    app.use(express.static(staticDir));
    app.use((_req, res) => {
      res.sendFile("index.html", { root: staticDir });
    });
  }

  return { app, services };
}
