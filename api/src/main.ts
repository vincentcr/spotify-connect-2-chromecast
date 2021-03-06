import * as http from "http";
import { createRedisClient } from "./lib/redis";
import { config } from "./config";
import { initApi } from "./api/api";
import { getLogger } from "./lib/logger";
import { Auth } from "./domain/auth/auth";
import { StreamStore } from "./domain/streaming";

const logger = getLogger("main");

async function main() {
  const redis = await createRedisClient(config);
  const auth = new Auth({ redis, config });
  const streams = new StreamStore({ config });

  const server = http.createServer();
  const app = await initApi({ server, config, auth, streams });
  server.on("request", app.callback());
  server.listen(config.HTTP_PORT, () => {
    logger.info("listening to port", config.HTTP_PORT);
  });
  server.on("error", die);
}

main().catch(die);

function die(err: Error) {
  logger.fatal(err);
  process.exit(1);
}
