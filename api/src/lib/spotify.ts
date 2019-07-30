import camelCase = require("lodash.camelcase");
import { fetch, FetchOptions } from "./fetch";
import { getLogger } from "./logger";

const logger = getLogger("spotify");

interface CreateTokenResponse {
  accessToken: string;
  scope: string;
  expiresIn: number;
  refreshToken: string;
}

interface RefreshTokenResponse {
  accessToken: string;
  scope: string;
  expiresIn: number;
}

interface UserProfileResponse {
  displayName: string;
  email: string;
  id: string;
  images: [
    {
      height: number;
      url: string;
      width: number;
    }
  ];
  uri: string;
}

export class SpotifyClient {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUrl: string;

  public constructor(params: {
    clientId: string;
    clientSecret: string;
    redirectUrl: string;
  }) {
    const { clientId, clientSecret, redirectUrl } = params;
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.redirectUrl = redirectUrl;
  }

  public async createToken(code: string): Promise<CreateTokenResponse> {
    const resp = await this.fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      data: {
        grant_type: "authorization_code",
        redirect_uri: this.redirectUrl,
        code
      }
    });

    const json = await resp.json();

    return toCamelCaseObject(json) as CreateTokenResponse;
  }

  public async refreshToken(
    refreshToken: string
  ): Promise<RefreshTokenResponse> {
    const resp = await this.fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      data: {
        grant_type: "refresh_token",
        redirect_uri: this.redirectUrl,
        refresh_token: refreshToken
      }
    });

    return toCamelCaseObject(await resp.json()) as RefreshTokenResponse;
  }

  public async me(accessToken: string): Promise<UserProfileResponse> {
    const resp = await this.fetch("https://api.spotify.com/v1/me", {
      accessToken
    });

    return toCamelCaseObject(await resp.json()) as UserProfileResponse;
  }

  private async fetch(
    url: string,
    options: FetchOptions & {
      accessToken?: string;
    } = {}
  ) {
    const auth =
      options.accessToken != null
        ? "Bearer " + options.accessToken
        : "Basic " +
          Buffer.from(this.clientId + ":" + this.clientSecret).toString(
            "base64"
          );
    const headers = {
      "content-type": "application/x-www-form-urlencoded",
      authorization: auth,
      ...options.headers
    };

    try {
      return await fetch(url, { ...options, headers });
    } catch (err) {
      logger.error(err, "Spotify API request failed");
      throw err;
    }
  }
}

function toCamelCaseObject(obj: any): any {
  if (obj == null || typeof obj !== "object") {
    return obj;
  } else if (Array.isArray(obj)) {
    return obj.map(toCamelCaseObject);
  } else {
    const newObj: { [k: string]: any } = {};
    for (const [k, v] of Object.entries(obj)) {
      const newK = camelCase(k);
      const newV = toCamelCaseObject(v);
      newObj[newK] = newV;
    }

    return newObj;
  }
}
