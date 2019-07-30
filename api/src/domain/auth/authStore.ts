import * as uuid from "uuid/v4";
import * as dateFns from "date-fns";
import { AsyncRedisClient } from "../../lib/redis";

interface UserRecord {
  readonly id: string;
  readonly uri: string;
  readonly displayName?: string;
  readonly email?: string;
  readonly images?: [
    {
      height: number | null;
      url: string;
      width: number | null;
    }
  ];
}

interface TokenRecord {
  accessToken: string;
  expiresAt: Date;
  readonly scope: string;
  readonly refreshToken: string;
}

interface CreateAuthRecordParams {
  user: UserRecord;
  token: Omit<TokenRecord, "expiresAt"> & { expiresIn: number };
}

export interface AuthRecord {
  id: string;
  token: TokenRecord;
  user: UserRecord;
}

export class AuthStore {
  private readonly redis: AsyncRedisClient;
  public constructor(redis: AsyncRedisClient) {
    this.redis = redis;
  }

  public async create(params: CreateAuthRecordParams): Promise<AuthRecord> {
    const id = uuid();
    const { user, token } = params;
    const auth = {
      id,
      user: {
        displayName: user.displayName,
        id: user.id,
        email: user.email,
        images: user.images,
        uri: user.uri
      },
      token: {
        accessToken: token.accessToken,
        expiresAt: this.expiresInToDate(token.expiresIn),
        refreshToken: token.refreshToken,
        scope: token.scope
      }
    };
    await this.save(auth);

    return auth;
  }

  private async save(record: AuthRecord) {
    await this.redis.set(this.mkKey(record.id), JSON.stringify(record));
  }

  public async updateAccessToken(
    auth: AuthRecord,
    params: {
      accessToken: string;
      expiresIn: number;
    }
  ) {
    const { accessToken, expiresIn } = params;
    auth.token.accessToken = accessToken;
    auth.token.expiresAt = this.expiresInToDate(expiresIn);
    await this.save(auth);
  }

  public async get(tokenId: string): Promise<AuthRecord | undefined> {
    const recJson = await this.redis.get(this.mkKey(tokenId));
    if (recJson != null) {
      return this.parseRecordJson(recJson);
    }
  }

  private parseRecordJson(json: string): AuthRecord {
    return JSON.parse(json, (key, value) =>
      key === "expiresAt" ? new Date(value) : value
    );
  }

  private expiresInToDate(expiresIn: number): Date {
    return dateFns.addSeconds(new Date(), expiresIn - 5);
  }

  private mkKey(tokenId: string) {
    return "spotify:token:" + tokenId;
  }
}

export interface StreamRecord {
  id: string;
}

export class StreamStore {
  private readonly redis: AsyncRedisClient;
  public constructor(redis: AsyncRedisClient) {
    this.redis = redis;
  }

  public async create(): Promise<StreamRecord> {
    const id = uuid();
    const record = { id };
    this.redis.set(this.mkKey(id), JSON.stringify(record));
    return record;
  }

  public async get(id: string): Promise<StreamRecord | undefined> {
    const json = await this.redis.get(this.mkKey(id));
    if (json != null) {
      const record = JSON.parse(json);
      return record;
    }
  }

  private mkKey(tokenId: string) {
    return "spotify:token:" + tokenId;
  }
}
