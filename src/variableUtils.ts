import { v4 as uuidv4 } from "uuid";
import * as vscode from "vscode";
import {
  getActiveThread,
  getVariableName,
  findVariableByEvaluateName,
} from "./debugUtils";

const arrayTypes = ["list", "tuple", "set"];
const numpyArrayTypes = ["ndarray"];
const dictTypes = ["dict"];
const numpyTypes = [
  "float16",
  "float32",
  "float64",
  "float128",
  "int8",
  "int16",
  "int32",
  "int64",
  "uint8",
  "uint16",
  "uint32",
  "uint64",
];

export interface VariableElement {
  name: string;
  value: unknown;
  type: string;
  variablesReference: number;
  evaluateName: string;
}

/**
 * Helper class to manage creation and cleanup of temporary debug variables.
 */
export class TempVarManager {
  private tempVars = new Set<string>();
  private disposed = false;
  constructor(private session: vscode.DebugSession, private frameId: number) {}

  async createFromExpression(expression: string): Promise<string> {
    const uuid = uuidv4().replaceAll("-", "_");
    const tempVarName = `__python_debug_${uuid}`;
    if (this.disposed) {
      return tempVarName;
    }
    if (
      !this.session ||
      !vscode.debug.activeDebugSession ||
      this.session.id !== vscode.debug.activeDebugSession.id
    ) {
      // Session is not active, skip creation
      return tempVarName;
    }
    try {
      await this.session.customRequest("evaluate", {
        expression: `${tempVarName} = __import__('copy').deepcopy(${expression})`,
        frameId: this.frameId,
        context: "repl",
      });
    } catch (err: any) {
      // If connection error, mark as disposed and clear tempVars
      if (
        err?.name === "CodeExpectedError" ||
        err?.name === "Canceled" ||
        (typeof err?.message === "string" &&
          (err.message.includes("connection was forcibly closed") ||
            err.message.includes("Canceled")))
      ) {
        this.disposed = true;
        this.tempVars.clear();
        return tempVarName;
      }
      console.error("[TempVarManager] Error creating temp variable:", err);
    }
    this.tempVars.add(tempVarName);
    return tempVarName;
  }

  async cleanup() {
    if (this.disposed) {
      this.tempVars.clear();
      return;
    }
    if (
      !this.session ||
      !vscode.debug.activeDebugSession ||
      this.session.id !== vscode.debug.activeDebugSession.id
    ) {
      this.tempVars.clear();
      return;
    }
    for (const tempVarName of this.tempVars) {
      try {
        await this.session.customRequest("evaluate", {
          expression: `del ${tempVarName}`,
          frameId: this.frameId,
          context: "repl",
        });
      } catch (err: any) {
        // If connection error, mark as disposed and clear tempVars
        if (
          err?.name === "CodeExpectedError" ||
          err?.name === "Canceled" ||
          (typeof err?.message === "string" &&
            (err.message.includes("connection was forcibly closed") ||
              err.message.includes("Canceled")))
        ) {
          this.disposed = true;
          this.tempVars.clear();
          return;
        }
        // Ignore other cleanup errors
      }
    }
    this.tempVars.clear();
  }
}

function stripQuotes(name: string): string {
  if (
    (name.startsWith("'") && name.endsWith("'")) ||
    (name.startsWith('"') && name.endsWith('"'))
  ) {
    return name.slice(1, -1);
  }
  return name;
}

function parseDebugValue(item: any): any {
  const value = item.value;
  if (item.type === "str") {
    return item.value.slice(1, -1);
  }
  if (item.type === "int" || item.type === "float") {
    return Number(value);
  }
  if (item.type === "bool") {
    return value === "True";
  }
  if (item.type === "NoneType") {
    return null;
  }
  return value;
}

export class VariableFetcher {
  /**
   * Factory method to create a VariableFetcher from the current editor context and a clicked item.
   * Returns { fetcher, variableName, target } or undefined if any step fails (and shows error message).
   */
  private static async _resolveFetcherAndTarget(
    evaluateName: string
  ): Promise<VariableFetcher | undefined> {
    const session = vscode.debug.activeDebugSession;
    if (!session) {
      vscode.window.showErrorMessage("No active debug session.");
      return;
    }
    let thread;
    try {
      thread = await getActiveThread();
    } catch (err: any) {
      vscode.window.showErrorMessage(
        `Failed to get active thread or frame - ${err.message || err}`
      );
      return;
    }
    let target: any = undefined;
    try {
      target = await findVariableByEvaluateName(
        session,
        thread.frameId,
        evaluateName!
      );
      if (!target) {
        vscode.window.showErrorMessage(
          `Variable "${evaluateName}" not found in current scope.`
        );
        return;
      }
    } catch (err: any) {
      vscode.window.showErrorMessage(
        `Failed to get variable ${evaluateName}: ${err.message || err}`
      );
      return;
    }
    const fetcher = new VariableFetcher(session, thread.frameId);
    fetcher.target = target;
    fetcher.variableName = evaluateName;
    return fetcher;
  }

  static async fromEvaluateName(
    evaluateName: string
  ): Promise<VariableFetcher | undefined> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage("No active editor.");
      return;
    }
    return this._resolveFetcherAndTarget(evaluateName);
  }

  static async fromEditorContext(
    clickedItem: any
  ): Promise<VariableFetcher | undefined> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage("No active editor.");
      return;
    }
    const variableName = getVariableName(clickedItem, editor);
    if (!variableName) {
      vscode.window.showErrorMessage("No variable found under cursor.");
      return;
    }
    let evaluateName: string;
    if (clickedItem && clickedItem.variable) {
      evaluateName = clickedItem.variable.evaluateName;
    } else {
      evaluateName = variableName;
    }
    return this._resolveFetcherAndTarget(evaluateName);
  }

  public target: any = undefined;
  public variableName: string | undefined = undefined;
  private tempVarManager: TempVarManager;
  constructor(private session: vscode.DebugSession, private frameId: number) {
    this.tempVarManager = new TempVarManager(session, frameId);
  }

  async fetchAllChildren(
    variablesReference: number
  ): Promise<VariableElement[]> {
    const allItems: VariableElement[] = [];
    const queue: number[] = [variablesReference];
    while (queue.length > 0) {
      const ref = queue.shift();
      if (!ref) {
        continue;
      }
      const response = await this.session.customRequest("variables", {
        variablesReference: ref,
      });
      for (const item of response.variables) {
        if (item.type === "MoreItemsRange" || item.type === "MoreItems") {
          queue.push(item.variablesReference);
        } else if (/^\d+$/.test(item.name)) {
          if (numpyTypes.includes(item.type)) {
            // If value is a string like 'np.float32(1.23232)', extract the number and cast to float
            if (typeof item.value === "string") {
              const match = item.value.match(
                /\(([-+]?\d*\.?\d+(?:[eE][-+]?\d+)?)\)/
              );
              if (match && match[1] !== undefined) {
                item.value = parseFloat(match[1]);
                item.type = "float";
              }
            }
          }
          allItems.push(item);
        }
      }
    }
    allItems.sort((a, b) => Number(a.name) - Number(b.name));
    return allItems;
  }

  async fetchDict(
    variablesReference: number,
    className?: string
  ): Promise<string | object> {
    const response = await this.session.customRequest("variables", {
      variablesReference,
    });
    const result: any = {};

    // check special type
    const isEnum = response.variables.some(
      (v: VariableElement) =>
        v.name === "'__objclass__'" && v.type === "EnumType"
    );
    if (isEnum) {
      const objclass = stripQuotes(
        response.variables.find(
          (v: VariableElement) => v.name === "'__objclass__'"
        )?.value
      );
      const value = stripQuotes(
        response.variables.find((v: VariableElement) => v.name === "'_value_'")
          ?.value
      );
      return `${objclass}.${value}`;
      // return {
      //   __class__: `${className} (Enum)`,
      //   name: stripQuotes(
      //     response.variables.find((v: VariableElement) => v.name === "'_name_'")
      //       ?.value
      //   ),
      //   value: stripQuotes(
      //     response.variables.find((v: VariableElement) => v.name === "'_value_'")
      //       ?.value
      //   ),
      // };
    }

    if (className) {
      result.__class__ = className;
    }
    for (const item of response.variables) {
      if (
        ["special variables", "function variables", "len()"].includes(item.name)
      ) {
        continue;
      }
      const cleanKey = stripQuotes(item.name);
      let content = await this.resolveVariable(item);
      if (typeof content === "string") {
        content = stripQuotes(content);
      }
      result[cleanKey] = content;
    }
    return result;
  }

  async fetchObjectAsDict(
    variableName: string,
    className: string
  ): Promise<any> {
    const tempVarName = await this.tempVarManager.createFromExpression(
      `${variableName}.__dict__`
    );
    const scopesResponse = await this.session.customRequest("scopes", {
      frameId: this.frameId,
    });
    const scope = scopesResponse.scopes[0];
    const vars = await this.session.customRequest("variables", {
      variablesReference: scope.variablesReference,
    });
    const tempTarget = vars.variables.find((v: any) => v.name === tempVarName);
    if (tempTarget !== undefined) {
      return await this.fetchDict(tempTarget.variablesReference, className);
    }
    return undefined;
  }

  async fetchNdarray(variableName: string): Promise<VariableElement[]> {
    const tempVarName = await this.tempVarManager.createFromExpression(
      `${variableName}.tolist()`
    );
    const scopesResponse = await this.session.customRequest("scopes", {
      frameId: this.frameId,
    });
    const scope = scopesResponse.scopes[0];
    const vars = await this.session.customRequest("variables", {
      variablesReference: scope.variablesReference,
    });
    const temp_target = vars.variables.find((v: any) => v.name === tempVarName);
    if (!temp_target) {
      throw new Error(`Temporary variable ${tempVarName} not found`);
    }
    return this.fetchAllChildren(temp_target.variablesReference);
  }

  async resolveVariable(variable: VariableElement): Promise<string | object> {
    const type = variable.type;
    const ref = variable.variablesReference;
    if (ref === 0) {
      return parseDebugValue(variable);
    }
    if (arrayTypes.includes(type)) {
      const items = await this.fetchAllChildren(ref);
      return Promise.all(items.map((item) => this.resolveVariable(item)));
    }
    if (numpyArrayTypes.includes(type)) {
      const items = await this.fetchNdarray(variable.evaluateName);
      return Promise.all(items.map((item) => this.resolveVariable(item)));
    }
    if (dictTypes.includes(type)) {
      return this.fetchDict(ref);
    }
    const d = await this.fetchObjectAsDict(variable.evaluateName, type);
    return d;
  }

  async convertToJson(
    target: any,
    variable: string
  ): Promise<{ json: string; type: string }> {
    if (arrayTypes.includes(target.type)) {
      const items = await this.fetchAllChildren(target.variablesReference);
      const array = await Promise.all(
        items.map((item) => this.resolveVariable(item))
      );
      return { json: JSON.stringify(array, null, 2), type: "array" };
    }
    if (numpyArrayTypes.includes(target.type)) {
      const items = await this.fetchNdarray(variable);
      const array = items.map((item) => parseDebugValue(item));
      return { json: JSON.stringify(array, null, 2), type: "ndarray" };
    }
    if (dictTypes.includes(target.type)) {
      const dict = await this.fetchDict(target.variablesReference);
      return { json: JSON.stringify(dict, null, 2), type: "dict" };
    }
    try {
      const dict = await this.fetchObjectAsDict(
        target.evaluateName !== undefined ? target.evaluateName : variable,
        target.type
      );
      if (dict === undefined) {
        throw new Error(
          `${target.name ? target.name : variable} is not JSON serializable.`
        );
      }
      return { json: JSON.stringify(dict, null, 2), type: target.type };
    } catch {
      throw new Error(
        `${target.name ? target.name : variable}  is not JSON serializable.`
      );
    }
  }

  async cleanup() {
    await this.tempVarManager.cleanup();
  }
}

export async function getVariableJson(
  clickedItem: any
): Promise<{ json: string; type: string; variableName: string } | undefined> {
  let fetcher: VariableFetcher | undefined;
  try {
    fetcher = await VariableFetcher.fromEditorContext(clickedItem);
    if (!fetcher) {
      return;
    }
    const { json, type } = await fetcher.convertToJson(
      fetcher.target,
      fetcher.variableName ?? ""
    );
    await fetcher.cleanup();
    return { json, type, variableName: fetcher.variableName ?? "" };
  } catch (err: any) {
    if (fetcher) {
      await fetcher.cleanup();
    }
    vscode.window.showErrorMessage(
      err.message || `Variable is not JSON serializable.`
    );
    return;
  }
}

/**
 * Fetches a variable as a flat numeric array (float/int), or throws on error.
 * Handles ndarrays and array-like variables.
 */
export async function getVariableFlatNumericArrayJson(
  evaluateName: string
): Promise<number[]> {
  const fetcher = await VariableFetcher.fromEvaluateName(evaluateName);
  if (!fetcher) {
    throw new Error("Could not resolve variable context.");
  }
  let arraydict: VariableElement[] | undefined = undefined;
  if (fetcher.target.type === "ndarray") {
    arraydict = await fetcher.fetchNdarray(evaluateName);
  } else {
    arraydict = await fetcher.fetchAllChildren(
      fetcher.target.variablesReference
    );
  }
  await fetcher.cleanup();
  return Array.from(
    arraydict.map((v) => {
      if (v.type !== "float" && v.type !== "int") {
        throw new Error(`Non-numeric member`);
      }
      const str = String(v.value).trim();
      const isSpecialFloat =
        v.type === "float" &&
        (str === "nan" || str === "inf" || str === "-inf");
      const num = Number(str);
      if (Number.isNaN(num) && !isSpecialFloat) {
        throw new Error(`Invalid number: ${v.value}`);
      }
      return num;
    })
  );
}
