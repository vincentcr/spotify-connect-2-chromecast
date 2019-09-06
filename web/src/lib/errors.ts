import { VError } from "verror";

export class AuthError extends VError {
  public constructor(message = "Authentication error", cause?: Error) {
    super({ name: "AuthError", cause }, message);
  }
}
export class FetchError extends VError {
  public readonly response: Response;
  public constructor(message: string, response: Response) {
    super({ name: "FetchError" }, message);
    this.name = "FetchError";
    this.response = response;
  }
}
