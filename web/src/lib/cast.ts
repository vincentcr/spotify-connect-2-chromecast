/// <reference types="chromecast-caf-sender" />

export function initCastSender() {
  window.__onGCastApiAvailable = function(isAvailable) {
    if (isAvailable) {
      init();
    } else {
      console.log("Google Chromecast framework unavailable");
    }
  };
  loadCastSdkScript();
}

function loadCastSdkScript() {
  const script = document.createElement("script");
  script.src =
    "https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1";
  script.async = true;
  document.body.appendChild(script);
}

function init() {
  const sessionRequest = new window.chrome.cast.SessionRequest(
    window.chrome.cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID,
    [window.chrome.cast.Capability.AUDIO_OUT]
  );
  const cfg = new window.chrome.cast.ApiConfig(
    sessionRequest,
    sessionListener,
    receiverListener,
    window.chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED
  );

  window.chrome.cast.initialize(
    cfg,
    () => {
      console.log("chrome.cast.initialize success");
      window.chrome.cast.requestSession(
        sess => {
          console.log("window.chrome.cast.requestSession: got session", sess);
        },
        err => {
          console.log("window.chrome.cast.requestSession: got error", err);
        }
      );
    },
    err => {
      console.log("chrome.cast.initialize error", err);
    }
  );

  const ctx = window.cast.framework.CastContext.getInstance();
  ctx.setOptions({
    receiverApplicationId:
      window.chrome.cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID,
    autoJoinPolicy: window.chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED
  });

  const player = new window.cast.framework.RemotePlayer();
  const controller = new window.cast.framework.RemotePlayerController(player);

  controller.addEventListener(
    window.cast.framework.RemotePlayerEventType.IS_CONNECTED_CHANGED,
    ev => {
      console.log("IS_CONNECTED_CHANGED", ev);
    }
  );

  controller.addEventListener(
    window.cast.framework.RemotePlayerEventType.IS_CONNECTED_CHANGED,
    ev => {
      console.log("IS_CONNECTED_CHANGED", ev);
    }
  );
}

function sessionListener(sess: chrome.cast.Session) {
  console.log("sessionListener", sess);
}
function receiverListener(receiver: chrome.cast.ReceiverAvailability) {
  console.log("receiverListener", receiver);
}
