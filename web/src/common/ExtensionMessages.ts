export enum ExtMessageCode {
  streamDemo = "streamDemo",
  accessToken = "accessToken",
  captureTab = "captureTab"
}

export type ExtMessage =
  | {
      code: ExtMessageCode.streamDemo;
    }
  | {
      code: ExtMessageCode.accessToken;
      accessToken: string;
    }
  | {
      code: ExtMessageCode.captureTab;
      castDeviceName: string;
    };
