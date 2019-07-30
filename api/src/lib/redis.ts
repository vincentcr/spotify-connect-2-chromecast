import * as util from "util";
import * as redis from "redis";
import { Config } from "../config";

export interface AsyncRedisClient {
  get: (arg1: string) => Promise<string>;
  set: (arg1: string, arg2: string) => Promise<void>;
  setex: (arg1: string, arg2: number, arg3: string) => Promise<string>;
}

export async function createRedisClient(
  config: Config
): Promise<AsyncRedisClient> {
  const client = redis.createClient({
    host: config.REDIS_HOST,
    port: config.REDIS_PORT
  });

  return {
    get: util.promisify(client.get.bind(client)),
    set: util.promisify(client.set.bind(client)),
    setex: util.promisify(client.setex.bind(client))
  };
}
