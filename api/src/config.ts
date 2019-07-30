import * as envalid from "envalid";

type LoggingLevel = "info" | "trace" | "debug" | "warn" | "error" | "fatal";
const loggingLevels = ["info", "trace", "debug", "warn", "error", "fatal"];

export type Config = Readonly<{
  API_URL: string;
  LOGGING_LEVEL: LoggingLevel;
  HTTP_PORT: number;
  HTTP_COOKIE_SECRET: string;
  REDIS_HOST: string;
  REDIS_PORT: number;
  SPOTIFY_CLIENT_SECRET: string;
  SPOTIFY_CLIENT_ID: string;
  SPOTIFY_AUTH_REDIRECT_URL: string;

  isDev: boolean;
  isProd: boolean;
  isTest: boolean;
}>;

function readConfig(): Config {
  const loggingLevelValidator = envalid.makeValidator<LoggingLevel>(
    validateLoggingLevel
  );

  const spec = {
    LOGGING_LEVEL: loggingLevelValidator({ default: "info" }),
    API_URL: envalid.url({ default: "http://localhost:3001/api" }),
    HTTP_PORT: envalid.port({ default: 3001 }),
    HTTP_COOKIE_SECRET: envalid.str(),
    REDIS_HOST: envalid.host({ default: "localhost" }),
    REDIS_PORT: envalid.port({ default: 6379 }),
    SPOTIFY_CLIENT_SECRET: envalid.str(),
    SPOTIFY_CLIENT_ID: envalid.str(),
    SPOTIFY_AUTH_REDIRECT_URL: envalid.url({
      default: "http://localhost:3000/#authCallback"
    })
  };

  const config = envalid.cleanEnv(process.env, spec, { strict: false });
  return pruneConfig(config, spec);
}

function validateLoggingLevel(input: string): LoggingLevel | undefined {
  if (loggingLevels.indexOf(input) < 0) {
    throw new Error("Invalid logging level");
  } else {
    return input as LoggingLevel;
  }
}

/**
  This is an alternative to envalid's { strict: true } behavior.
  Its magic proxy is less useful with causes issues when trying to print the
  config. Instead this method ensures that the config object only contains
  its declared properties, as well as the is(Dev|Prod|Test) flags.
*/
function pruneConfig(config: Config, spec: { [k: string]: any }): Config {
  const cleaned: any = {};

  for (const [k, v] of Object.entries(config)) {
    if (k in spec) {
      cleaned[k] = v;
    }
  }

  cleaned.isDev = config.isDev;
  cleaned.isProd = config.isProd;
  cleaned.isTest = config.isTest;

  return cleaned as Config;
}

export const config = readConfig();
