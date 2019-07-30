import * as Logger from "bunyan";
import { config } from "../config";

export function getLogger(scope: string) {
  return Logger.createLogger({
    name: "sc2cc",
    level: config.LOGGING_LEVEL,
    serializers: Logger.stdSerializers
  }).child({ scope });
}
