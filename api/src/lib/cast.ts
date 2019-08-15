import { Client as CastClient, DefaultMediaReceiver } from "castv2-client";
import * as mdns from "mdns";

import { getLogger } from "./logger";

const logger = getLogger("cast");

export interface ChromeCastMediaDescriptor {
  contentId: string; // the source url
  contentType: string;
  streamType: "BUFFERED" | "LIVE";
  metadata: {
    type: 0;
    metadataType: 0;
    title: string;
    images: [
      {
        url: string;
      }
    ];
  };
}

export class ChromecastDevice {
  public readonly id: string;
  public readonly fullName: string;
  public readonly friendlyName: string;
  public readonly manufacturerDescription: string;
  public readonly address: string;
  public readonly port: number;

  private castClient: any;
  private castPlayer: any;

  public constructor(params: {
    id: string;
    fullName: string;
    friendlyName: string;
    manufacturerDescription: string;
    address: string;
    port: number;
  }) {
    const {
      id,
      fullName,
      friendlyName,
      manufacturerDescription,
      address,
      port
    } = params;
    this.id = id;
    this.fullName = fullName;
    this.friendlyName = friendlyName;
    this.manufacturerDescription = manufacturerDescription;
    this.address = address;
    this.port = port;
  }

  public async play(media: ChromeCastMediaDescriptor) {
    if (this.castPlayer == null) {
      await this.connect();
    }
    return new Promise((resolve, reject) => {
      this.castPlayer.load(media, { autoplay: true }, function(
        err: Error,
        status: any
      ) {
        if (err != null) {
          reject(err);
        } else {
          resolve(status);
        }
      });
    });
  }

  private connect(): Promise<void> {
    this.castClient = new CastClient();
    return new Promise((resolve, reject) => {
      this.castClient.once("error", reject);

      this.castClient.connect(this.address, () => {
        this.castClient.off("error", reject);
        this.castClient.on("error", (err: any) => {
          // TODO: need a better mechanism to handle these errors
          logger.error("Chromecast client error", err);
        });

        this.castClient.launch(
          DefaultMediaReceiver,
          (err: Error, player: any) => {
            if (err != null) {
              this.castClient.close();
              reject(err);
            } else {
              this.castPlayer = player;
              resolve();
            }
          }
        );
      });
    });
  }
}

export class ChromecastDeviceManager {
  private readonly browser = mdns.createBrowser(mdns.tcp("googlecast"));
  private readonly devices: { [name: string]: ChromecastDevice } = {};

  public start() {
    this.browser.on("serviceUp", this.onServiceUp.bind(this));
    this.browser.on("serviceDown", this.onServiceDown.bind(this));
    this.browser.start();
  }

  public stop() {
    this.browser.stop();
    this.browser.removeAllListeners();
  }

  public findDevice(fullName: string): ChromecastDevice | undefined {
    return this.devices[fullName];
  }

  public getDevices() {
    return Object.values(this.devices);
  }

  private onServiceUp(service: mdns.Service) {
    const device = new ChromecastDevice({
      id: service.txtRecord.id,
      fullName: service.fullname,
      friendlyName: service.txtRecord.fn,
      manufacturerDescription: service.txtRecord.md,
      address: service.addresses[0],
      port: service.port
    });

    logger.debug("device added:", device);
    this.devices[device.fullName] = device;
  }

  private onServiceDown(service: mdns.Service) {
    logger.debug("device removed:", service.fullname);
    delete this.devices[service.fullname];
  }
}
