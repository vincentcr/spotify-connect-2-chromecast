import * as http from "http";
import * as fs from "fs";

import * as Koa from "koa";
import * as WebSocket from "ws";
import * as Router from "koa-router";
import * as cors from "@koa/cors";
import * as bodyParser from "koa-body";
import * as dateFns from "date-fns";

import { getLogger } from "../lib/logger";
import { Auth, AuthRecord } from "../domain/auth/auth";
import {
  catchError,
  authenticate,
  logRequest,
  authorize,
  notFound,
  errorHandler,
  authenticateRequest,
  NotFoundError
} from "./middlewares";
import { Config } from "../config";
import { StreamStore } from "../domain/streaming";
import { VError } from "verror";

const UUID_LEN = 36;

const logger = getLogger("api");

interface Services {
  auth: Auth;
  config: Config;
  server: http.Server;
}

interface ApiState {
  auth: AuthRecord;
}

export async function initApi(services: Services) {
  const app = new Koa();

  app.use(cors({ credentials: true }));
  app.use(bodyParser({ multipart: true }));
  app.use(logRequest);
  app.use(catchError);
  app.use(notFound);
  app.use(authenticate(services.auth));
  app.on("error", errorHandler);

  const router = initRoutes(services);
  app.use(router.routes()).use(router.allowedMethods());

  return app;
}

export function initRoutes(services: Services): Router {
  const router = new Router<ApiState>({ prefix: "/api" });

  router.get("/", async ctx => {
    ctx.body = { version: "1.0.0" };
  });

  for (const setup of [
    initAuthRoutes,
    initStreamingRoutes,
    initCastingRoutes
  ]) {
    const subRouter = setup(services);
    router.use(subRouter.routes()).use(subRouter.allowedMethods());
  }

  return router;
}

function initAuthRoutes(services: Services) {
  const { auth, config } = services;

  const router = new Router<ApiState>({ prefix: "/auth" });
  router.get("/config", async ctx => {
    ctx.body = {
      SPOTIFY_CLIENT_ID: config.SPOTIFY_CLIENT_ID,
      SPOTIFY_AUTH_REDIRECT_URL: config.SPOTIFY_CLIENT_ID
    };
  });

  router.post("/process-callback", async ctx => {
    const { code } = ctx.request.body;
    const authRec = await auth.processSpotifyOauthCallback(code);

    ctx.cookies.set("token", authRec.id, {
      expires: dateFns.addYears(new Date(), 100)
    });
    ctx.body = authView(authRec);
  });

  router.get("/", authorize, async ctx => {
    const authRec: AuthRecord = ctx.state.auth;
    ctx.body = authView(authRec);
  });

  router.get("/accessToken", authorize, async ctx => {
    const authRec: AuthRecord = ctx.state.auth;
    ctx.body = tokenView(authRec);
  });

  return router;
}

function authView(rec: AuthRecord) {
  return { id: rec.id, user: userView(rec), token: tokenView(rec) };
}

function userView(rec: AuthRecord) {
  return rec.user;
}
function tokenView(rec: AuthRecord) {
  return {
    accessToken: rec.token.accessToken,
    expiresAt: rec.token.expiresAt
  };
}

function initStreamingRoutes(services: Services) {
  const router = new Router<ApiState>({ prefix: "/stream" });

  // create a websocket server to allow streamed uploads.
  const ws = new WebSocket.Server({
    server: services.server,
    path: "/api/stream/ws",
    verifyClient: (info, callback) => {
      authenticateRequest(services.auth, info.req)
        .then(auth => {
          if (auth != null) {
            (info.req as any).state = { auth };
            callback(true);
          } else {
            callback(false, 401, "Unauthorized");
          }
        })
        .catch(err => {
          logger.error(err, "WebSocket client verification error", {
            origin: info.origin,
            secure: info.secure,
            cookies: info.req.headers.cookie
          });
          callback(false, 500, "Internal Error");
        });
    }
  });

  ws.on("connection", (conn, req) => {
    const auth: AuthRecord = (req as any).state.auth;
    conn.on("message", msg => {
      processMessage(conn, auth, msg);
    });
  });

  function processMessage(
    conn: WebSocket,
    authRec: AuthRecord,
    msg: WebSocket.Data
  ) {
    processMessageAsync(authRec, msg).catch(err => {
      logger.error(err, VError.info(err), "Failed to process data message");
      conn.send(
        JSON.stringify({
          error: "Failed to process data message (internal error)"
        })
      );
    });
  }

  async function processMessageAsync(authRec: AuthRecord, msg: WebSocket.Data) {
    if (!(msg instanceof Buffer)) {
      throw new Error("expected buffer got " + msg.constructor.name);
    }
    // msg format:
    // bytes [0...35]: uuid
    // bytes [36 ... n]: pcm data. if empty, it means the stream has ended.
    const streamId = msg.slice(0, UUID_LEN).toString("utf-8");
    const data = msg.slice(UUID_LEN);
    const src = StreamStore.get(streamId);
    if (src == null) {
      throw new Error("Stream source not found: " + streamId);
    }

    if (data.length > 0) {
      src.add(data);
    } else {
      src.complete();
    }
  }

  router.post("/", authorize, async ctx => {
    const { contentType } = ctx.request.body as {
      contentType: string;
      metadata: string;
    };
    const src = await StreamStore.create({ contentType });
    ctx.body = { id: src.id, contentType };
  });

  router.post("/upload", async ctx => {
    if (ctx.request.files == null || ctx.request.files.file == null) {
      ctx.status = 400;
      return;
    }

    const file = ctx.request.files.file;
    const contentType = ctx.request.body.contentType || file.type;

    const src = await StreamStore.create({ contentType });
    const outStream = src.getWritableStream();
    const inStream = fs.createReadStream(file.path);
    inStream.pipe(outStream);

    ctx.body = { id: src.id, contentType };
  });

  router.get("/:stream_id/stats", async ctx => {
    const streamId = ctx.params["stream_id"] as string;
    const src = StreamStore.get(streamId);
    if (src == null) {
      throw new NotFoundError("Stream Not Found");
    }

    ctx.body = {
      info: src.stats()
    };
  });

  router.get("/:stream_id", async ctx => {
    const streamId = ctx.params["stream_id"] as string;
    const src = StreamStore.get(streamId);
    if (src == null) {
      throw new NotFoundError("Stream Not Found");
    }

    const st = src.getReadableStream();
    ctx.response.type = src.contentType;
    ctx.body = st;
  });

  return router;
}
