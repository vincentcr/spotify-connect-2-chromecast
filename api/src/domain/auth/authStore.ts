import * as uuid from "uuid/v4";
import * as dateFns from "date-fns";
import { AsyncRedisClient } from "../../lib/redis";

interface SpotifyAuthRecord {
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
  readonly refreshToken: string;
  accessToken: string;
  accessTokenExpiresAt: Date;
}

type CreateAuthRecordParams = Omit<
  SpotifyAuthRecord,
  "accessTokenExpiresAt"
> & {
  expiresIn: number;
};

export interface AuthRecord {
  accessToken: string;
  spotify: SpotifyAuthRecord;
}

export class AuthStore {
  private readonly redis: AsyncRedisClient;
  public constructor(redis: AsyncRedisClient) {
    this.redis = redis;
  }

  public async create(params: CreateAuthRecordParams): Promise<AuthRecord> {
    const accessToken = uuid();
    const auth = {
      accessToken,
      spotify: {
        displayName: params.displayName,
        id: params.id,
        email: params.email,
        images: params.images,
        uri: params.uri,
        accessToken: params.accessToken,
        accessTokenExpiresAt: this.expiresInToDate(params.expiresIn),
        refreshToken: params.refreshToken
      }
    };
    await this.save(auth);

    return auth;
  }

  private async save(record: AuthRecord) {
    await this.redis.set(
      this.mkKey(record.accessToken),
      JSON.stringify(record)
    );
  }

  public async updateSpotifyAccessToken(
    auth: AuthRecord,
    params: {
      accessToken: string;
      expiresIn: number;
    }
  ) {
    const { accessToken, expiresIn } = params;
    auth.spotify.accessToken = accessToken;
    auth.spotify.accessTokenExpiresAt = this.expiresInToDate(expiresIn);
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
