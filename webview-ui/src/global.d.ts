import { FromWebviewMessage } from "../../common/messages";

interface VSCodeApi {
  postMessage: (msg: FromWebviewMessage) => void;
  setState?: (state: unknown) => void;
  getState?: () => unknown;
}

declare global {
  interface Window {
    acquireVsCodeApi?: () => {
      postMessage: (msg: FromWebviewMessage) => void;
      // You can add more VS Code API methods here if needed
    };
  }
}
