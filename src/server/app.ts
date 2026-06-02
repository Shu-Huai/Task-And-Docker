import express, { type Request, type Response } from "express";
import session from "express-session";
import helmet from "helmet";
import type { AppConfig } from "./config";
import {
  listContainers,
  startContainer,
  stopContainer,
  type DockerContainer
} from "./docker";
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
};

type CreateAppOptions = {
  config: AppConfig;
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
    stopContainer
  };
}

function asyncRoute(handler: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response) => {
    handler(req, res).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : "Unexpected error";
      res.status(500).json({ error: message });
    });
  };
}

function paramAsString(value: string | string[]): string {
  return Array.isArray(value) ? value[0] : value;
}

export function createApp({ config, services: serviceOverrides = {}, staticDir }: CreateAppOptions) {
  const app = express();
  const services: AppServices = { ...defaultServices(), ...serviceOverrides };

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
      res.status(401).json({ error: "Invalid password" });
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
      res.status(401).json({ error: "Authentication required" });
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

  if (staticDir) {
    app.use(express.static(staticDir));
    app.use((_req, res) => {
      res.sendFile("index.html", { root: staticDir });
    });
  }

  return { app, services };
}
