import * as dateFns from "date-fns";
import { SpotifyClient } from "../../lib/spotify";
import { AuthStore, AuthRecord } from "./authStore";
import { getLogger } from "../../lib/logger";
import { AsyncRedisClient } from "../../lib/redis";
import { Config } from "../../config";

export { AuthRecord } from "./authStore";

const logger = getLogger("auth");

export class Auth {
  private readonly spotify: SpotifyClient;
  private readonly authStore: AuthStore;

  public constructor(params: { config: Config; redis: AsyncRedisClient }) {
    const { config, redis } = params;
    this.spotify = new SpotifyClient({
      clientId: config.SPOTIFY_CLIENT_ID,
      clientSecret: config.SPOTIFY_CLIENT_SECRET,
      redirectUrl: config.SPOTIFY_AUTH_REDIRECT_URL
    });
    this.authStore = new AuthStore(redis);
  }

  public async processSpotifyOauthCallback(code: string) {
    const token = await this.spotify.createToken(code);
    const user = await this.spotify.me(token.accessToken);
    return await this.authStore.create({ ...user, ...token });
  }

  public async get(id: string) {
    const authRec = await this.authStore.get(id);
    if (authRec != null) {
      await this.ensureAccessTokenUpToDate(authRec);
    }
    return authRec;
  }

  private async ensureAccessTokenUpToDate(authRec: AuthRecord) {
    const secondsRemaining = dateFns.differenceInSeconds(
      authRec.spotify.accessTokenExpiresAt,
      new Date()
    );

    if (secondsRemaining < 60) {
      logger.info("refreshing access token", {
        secondsRemaining,
        expiresAt: authRec.spotify.accessTokenExpiresAt
      });
      const { accessToken, expiresIn } = await this.spotify.refreshToken(
        authRec.spotify.refreshToken
      );
      await this.authStore.updateSpotifyAccessToken(authRec, {
        accessToken,
        expiresIn
      });
    }
  }
}
