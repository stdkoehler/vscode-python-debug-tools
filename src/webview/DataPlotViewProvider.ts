import * as vscode from "vscode";
import { getNonce } from "../utils/getNonce";
import { WorkspaceVariablesTreeDataProvider } from "../tree/WorkspaceVariablesTreeDataProvider";
import {
  isFromWebviewMessage,
  FromWebviewMessage,
  RequestVariableValueMessage,
} from "../../common/messages";
import { getVariableFlatNumericArrayJson } from "../variableUtils";

export class DataPlotViewProvider implements vscode.WebviewViewProvider {
  private _workspaceProvider: WorkspaceVariablesTreeDataProvider;
  private _view?: vscode.WebviewView;
  private _context: vscode.ExtensionContext;
  private _isReady: boolean = false;

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
        <title>Time Series Plot</title>
      </head>
      <body>
        <div id="root"></div>
        <script nonce="${nonce}">window.initialView = 'plot';</script>
        <script nonce="${nonce}" type="module" src="${scriptUri}"></script>
      </body>
      </html>
    `;

    view.webview.onDidReceiveMessage(async (message: FromWebviewMessage) => {
      try {
        if (!isFromWebviewMessage(message)) {
          console.warn(
            "[dataPlotViewProvider] Received invalid message:",
            message
          );
          return;
        }
        switch (message.type) {
          case "ready": {
            this._isReady = true;
            const currentVars =
              this._workspaceProvider.getCurrentVariableNames();
            this.postWorkspaceVariables(currentVars);
            break;
          }
          case "request-variable-value": {
            await this._handleRequestVariableValue(message, view);
            break;
          }
          default:
            console.warn("[dataPlotViewProvider] Unknown message:", message);
        }
      } catch (err) {
        console.error(
          "[dataPlotViewProvider] Error handling message:",
          err,
          message
        );
      }
    });
  }

  private async _handleRequestVariableValue(
    message: RequestVariableValueMessage,
    view: vscode.WebviewView
  ) {
    const variableName = message.variable;
    const requestId = message.requestId;
    let value: number[] | undefined = undefined;
    let error: string | undefined = undefined;
    try {
      const item = this._workspaceProvider
        .getItems()
        .find((v) => v.evaluateName === variableName);
      if (item && item.value !== undefined) {
        value = await getVariableFlatNumericArrayJson(item.evaluateName);
      } else {
        throw new Error(
          `Variable '${variableName}' not found or has no value.`
        );
      }
    } catch (e: any) {
      error = e?.message || "Unknown error";
    }

    view.webview.postMessage({
      type: "variable-value",
      variable: variableName,
      value,
      requestId,
      error,
    });
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
