import { resolve } from "node:path";
import { createApp } from "./app";
import { loadConfig } from "./config";

const config = loadConfig();
const { app } = createApp({ config, staticDir: resolve("dist", "client") });

app.listen(config.server.port, config.server.host, () => {
  console.log(`任务与 Docker 已监听 http://[${config.server.host}]:${config.server.port}`);
});
