import * as vscode from "vscode";
import { getNonce } from "../utils/getNonce";
import { WorkspaceVariablesTreeDataProvider } from "../tree/WorkspaceVariablesTreeDataProvider";
import {
  isFromWebviewMessage,
  FromWebviewMessage,
} from "../../common/messages";

export class ObjectVisualizerViewProvider
  implements vscode.WebviewViewProvider
{
  private _workspaceProvider: WorkspaceVariablesTreeDataProvider;
  private _view?: vscode.WebviewView;
  private _context: vscode.ExtensionContext;
  private _isReady: boolean = false;
  private _pendingJson: object | null = null;
  private _lastJson: object | null = null;

  constructor(
    context: vscode.ExtensionContext,
    workspaceProvider: WorkspaceVariablesTreeDataProvider
  ) {
    this._context = context;
    this._workspaceProvider = workspaceProvider;
  }

  resolveWebviewView(view: vscode.WebviewView) {
    this._view = view;
    this._isReady = false;

    view.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this._context.extensionUri, "media"),
      ],
    };

    const scriptUri = view.webview.asWebviewUri(
      vscode.Uri.joinPath(
        this._context.extensionUri,
        "media",
        "assets/index.js"
      )
    );
    const styleUri = view.webview.asWebviewUri(
      vscode.Uri.joinPath(
        this._context.extensionUri,
        "media",
        "assets/index.css"
      )
    );
    const nonce = getNonce();

    const config = vscode.workspace.getConfiguration("editor");
    const fontFamily = config.get<string>("fontFamily") || "default-font";

    view.webview.html = /* html */ `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${view.webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <link href="${styleUri}" rel="stylesheet" />
        <style> 
          :root {
            --vscode-editor-font-family: "${fontFamily}", monospace;
          }
        </style> 
        <title>D3 Visualizer</title>
      </head>
      <body>
        <div id="root"></div>
        <script nonce="${nonce}">window.initialView = 'json';</script>
        <script nonce="${nonce}" type="module" src="${scriptUri}"></script>
      </body>
      </html>
    `;

    view.webview.onDidReceiveMessage(async (message: FromWebviewMessage) => {
      try {
        if (!isFromWebviewMessage(message)) {
          console.warn(
            "[objectVisualizerViewProvider] Received invalid message:",
            message
          );
          return;
        }
        switch (message.type) {
          case "ready": {
            this._isReady = true;
            const currentVars =
              this._workspaceProvider.getCurrentVariableNames();
            if (currentVars.length > 0) {
              this.postWorkspaceVariables(currentVars);
            }
            if (this._pendingJson) {
              this.postJson(this._pendingJson);
              this._pendingJson = null;
            } else if (this._lastJson) {
              this.postJson(this._lastJson);
            }
            break;
          }
          case "request-variable-value": {
            console.warn(
              "[objectVisualizerViewProvider] request-variable-value not supported yet:",
              message
            );
            break;
          }
          default:
            console.warn(
              "[objectVisualizerViewProvider] Unknown message:",
              message
            );
        }
      } catch (err) {
        console.error(
          "[objectVisualizerViewProvider] Error handling message:",
          err,
          message
        );
      }
    });
  }

  postJson(json: object) {
    if (!this._view) {
      return;
    }
    this._lastJson = json;
    if (this._isReady) {
      this._view.webview.postMessage({
        type: "set-json",
        payload: json,
      });
    } else {
      this._pendingJson = json;
    }
  }

  postWorkspaceVariables(variableNames: string[]) {
    if (!this._view) {
      return;
    }
    if (this._isReady) {
      this._view.webview.postMessage({
        type: "set-workspace-variables",
        payload: variableNames,
      });
    }
  }
}
