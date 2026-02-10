import * as vscode from "vscode";

export interface Thread {
  threadId: number;
  frameId: number;
}

export function isDebugStackFrame(item: any): item is vscode.DebugStackFrame {
  return (
    item &&
    typeof item.threadId === "number" &&
    typeof item.frameId === "number"
  );
}

export function isDebugThread(item: any): item is vscode.DebugThread {
  return item && typeof item.threadId === "number";
}

export async function getActiveThread(): Promise<Thread> {
  const stackItem = vscode.debug.activeStackItem;

  if (isDebugStackFrame(stackItem)) {
    return {
      threadId: stackItem.threadId,
      frameId: stackItem.frameId,
    };
  } else if (isDebugThread(stackItem)) {
    const session = vscode.debug.activeDebugSession;
    if (!session) {
      throw new Error("No active debug session found.");
    }
    const stackTraceResponse = await session.customRequest("stackTrace", {
      threadId: stackItem.threadId,
      startFrame: 0,
      levels: 1,
    });
    const frame = stackTraceResponse.stackFrames[0];
    return {
      threadId: stackItem.threadId,
      frameId: frame.id,
    };
  }

  throw new Error("No active stack item found.");
}

export function getVariableName(
  clickedItem: any,
  editor: vscode.TextEditor
): string | undefined {
  if (clickedItem.variable === undefined) {
    let variable = editor.document.getText(editor.selection).trim();
    if (!variable) {
      const position = editor.selection.active;
      const wordRange = editor.document.getWordRangeAtPosition(position);
      if (wordRange) {
        variable = editor.document.getText(wordRange);
      }
    }
    return variable || undefined;
  } else {
    return clickedItem.variable.name;
  }
}

export async function findVariableByEvaluateName(
  session: vscode.DebugSession,
  frameId: number,
  evaluateName: string
): Promise<any | undefined> {
  const result = await session.customRequest("evaluate", {
    expression: evaluateName,
    context: "hover", // or "watch", both usually work
    frameId: frameId, // required!
  });
  return result;
}
