import { Context } from "koa";
import * as Router from "koa-router";
import { IMiddleware } from "koa-router";
import { AuthRecord } from "../domain/auth/authStore";
import { getLogger } from "../lib/logger";
import { VError } from "verror";
import { STATUS_CODES } from "http";
import * as http from "http";
import * as Cookies from "cookies";
import { Auth } from "../domain/auth/auth";

const logger = getLogger("middlewares");

export function authenticate(auth: Auth): IMiddleware {
  return async function authenticate(
    ctx: Router.IRouterContext,
    next: () => Promise<any>
  ) {
    const id = findRequestAuthToken(ctx);
    if (id == null) {
      return next();
    }

    const authRec = await auth.get(id);
    if (authRec == null) {
      ctx.status = 401;
      throw new VError(
        { name: "InvalidCredentialsError", info: { httpStatusCode: 401 } },
        "invalid token"
      );
    }

    ctx.state.auth = authRec;
    return next();
  };
}

export async function authenticateRequest(
  auth: Auth,
  req: http.IncomingMessage
): Promise<AuthRecord | undefined> {
  const cookies = Cookies(req, {} as http.ServerResponse);
  const tokenId = findRequestAuthToken({ headers: req.headers, cookies });
  if (tokenId == null) {
    return undefined;
  }
  return await auth.get(tokenId);
}

function findRequestAuthToken(ctx: {
  headers: any;
  cookies: Cookies;
}): string | undefined {
  if (typeof ctx.headers.authorization === "string") {
    const match = /^Bearer (.+)$/.exec(ctx.headers.authorization);
    if (match != null) {
      return match[1];
    }
  }

  const tok = ctx.cookies.get("token");

  if (typeof tok === "string") {
    return tok;
  }
}

export async function authorize(
  ctx: Router.IRouterContext,
  next: () => Promise<any>
) {
  if (ctx.state.auth == null) {
    ctx.status = 401;
    throw new VError(
      { name: "UserNotAuthorizedError", info: { httpStatusCode: 401 } },
      "User not authorized"
    );
  }
  return next();
}

export async function logRequest(ctx: Context, next: () => Promise<any>) {
  await next();
  const date = new Date();
  const userId = ctx.state.user && ctx.state.user.id;
  const { req, res } = ctx;
  logger.info(
    { req, res, userId, date },
    "%s %s HTTP/%s => %s",
    req.method,
    req.url,
    req.httpVersion,
    res.statusCode
  );
}

export class NotFoundError extends VError {
  public constructor(
    reason?: string,
    info?: { httpStatusCode: number; name?: string }
  ) {
    const { httpStatusCode = 404, name = undefined, ...infoRest } = info || {};
    const statusText = STATUS_CODES[httpStatusCode] || "Not Found";
    const nameOrStatusText = name || statusText;
    const reasonOrStatusText = reason || statusText;
    super(
      { name: nameOrStatusText, info: { httpStatusCode, ...infoRest } },
      reasonOrStatusText
    );
  }
}

export async function notFound(
  ctx: Router.IRouterContext,
  next: () => Promise<any>
) {
  await next();
  ctx.body;
  if (ctx.status === 404 || ctx.status === 405) {
    throw new NotFoundError(undefined, { httpStatusCode: ctx.status });
  }
}

export async function catchError(ctx: Context, next: () => Promise<any>) {
  try {
    await next();
  } catch (err) {
    const errInfo = VError.info(err);
    ctx.status = errInfo.httpStatusCode || 500;

    const statusText = errInfo.httpStatusText || STATUS_CODES[ctx.status];

    const isPublicErr =
      errInfo.isPublic != null ? errInfo.isPublic : ctx.status < 500;

    const name = isPublicErr ? err.name || statusText : statusText;

    ctx.body = {
      code: ctx.status,
      name,
      message: statusText
    };

    if (!isPublicErr) {
      ctx.app.emit("error", err, ctx);
    }
  }
}

export async function errorHandler(err: Error, ctx: Context) {
  const authId = ctx.state.auth != null ? ctx.state.auth.id : undefined;

  const errInfo = VError.info(err);

  logger.error(
    { req: ctx.request, err, errInfo, authId, resp: ctx.response },
    "request failed"
  );
}
