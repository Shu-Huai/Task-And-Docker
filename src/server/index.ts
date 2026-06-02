import { resolve } from "node:path";
import { createApp } from "./app";
import { loadConfig } from "./config";

const config = loadConfig();
const { app } = createApp({ config, staticDir: resolve("dist", "client") });

app.listen(config.server.port, config.server.host, () => {
  console.log(`Task And Docker listening on http://[${config.server.host}]:${config.server.port}`);
});
