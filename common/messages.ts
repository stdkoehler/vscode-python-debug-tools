// Message protocol for extension <-> webview communication (shared)

export type SetJsonMessage = { type: "set-json"; payload: unknown };
export type SetWorkspaceVariablesMessage = {
  type: "set-workspace-variables";
  payload: string[];
};
export type VariableValueMessage = {
  type: "variable-value";
  variable: string;
  value?: unknown;
  requestId: string;
  error?: string;
};

export type ToWebviewMessage =
  | SetJsonMessage
  | SetWorkspaceVariablesMessage
  | VariableValueMessage;

export type ReadyMessage = { type: "ready" };
export type RequestVariableValueMessage = {
  type: "request-variable-value";
  variable: string;
  requestId: string;
};

export type FromWebviewMessage = ReadyMessage | RequestVariableValueMessage;

export function isToWebviewMessage(msg: unknown): msg is ToWebviewMessage {
  if (!msg || typeof msg !== "object") {
    return false;
  }
  const m = msg as Record<string, unknown>;
  if (typeof m.type !== "string") {
    return false;
  }
  switch (m.type) {
    case "set-json":
      return "payload" in m;
    case "set-workspace-variables":
      return Array.isArray(m.payload);
    case "variable-value":
      return (
        typeof m.variable === "string" &&
        "value" in m &&
        typeof m.requestId === "string"
      );
    default:
      return false;
  }
}

export function isFromWebviewMessage(msg: unknown): msg is FromWebviewMessage {
  if (!msg || typeof msg !== "object") {
    return false;
  }
  const m = msg as Record<string, unknown>;
  if (typeof m.type !== "string") {
    return false;
  }
  switch (m.type) {
    case "ready":
      return true;
    case "request-variable-value":
      return typeof m.variable === "string" && typeof m.requestId === "string";
    default:
      return false;
  }
}
