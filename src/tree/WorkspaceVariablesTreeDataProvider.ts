import * as vscode from "vscode";
import {
  findVariableByEvaluateName,
  getActiveThread,
  Thread,
} from "../debugUtils";

export interface WorkspaceVariable {
  evaluateName: string;
  value?: string;
  error?: string;
}

const arrayTypes = ["array", "list", "set", "tuple", "ndarray"];

export class WorkspaceVariablesTreeDataProvider
  implements vscode.TreeDataProvider<WorkspaceVariable>
{
  private _disposables: vscode.Disposable[] = [];
  private _onWorkspaceVariablesChanged = new vscode.EventEmitter<string[]>();
  readonly onWorkspaceVariablesChanged =
    this._onWorkspaceVariablesChanged.event;
  private _onDidChangeTreeData = new vscode.EventEmitter<
    WorkspaceVariable | undefined | void
  >();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
  private context: vscode.ExtensionContext;
  protected items: WorkspaceVariable[] = [];
  public getItems(): WorkspaceVariable[] {
    return this.items;
  }
  private refreshTimer?: NodeJS.Timeout;

  public getCurrentVariableNames(): string[] {
    return this.items.map((v) => v.evaluateName);
  }

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.load();
    this.startAutoRefresh();
    this._disposables.push(
      vscode.debug.onDidChangeActiveDebugSession(() => this.refresh()),
      vscode.debug.onDidTerminateDebugSession(() => this.refresh()),
      vscode.debug.onDidReceiveDebugSessionCustomEvent(() => this.refresh())
    );
  }

  dispose() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
    }
    this._disposables.forEach((d) => d.dispose());
    this._onWorkspaceVariablesChanged.dispose();
    this._onDidChangeTreeData.dispose();
  }

  getTreeItem(element: WorkspaceVariable): vscode.TreeItem {
    const item = new vscode.TreeItem(
      element.evaluateName,
      vscode.TreeItemCollapsibleState.None
    );
    item.description = element.error
      ? `Error: ${element.error}`
      : element.value ?? "";
    item.contextValue = "workspaceVariables";
    return item;
  }

  getChildren(): Thenable<WorkspaceVariable[]> {
    return Promise.resolve(this.items);
  }

  async addVariable(evaluateName: string) {
    const session = vscode.debug.activeDebugSession;

    if (!session) {
      this.items.forEach((v) => {
        v.value = undefined;
        v.error = "No debug session";
      });
      return;
    }

    const thread = await getActiveThread();
    const result = await findVariableByEvaluateName(
      session,
      thread.frameId,
      evaluateName
    );

    if (arrayTypes.includes(result.type)) {
      if (!this.items.find((v) => v.evaluateName === evaluateName)) {
        this.items.push({ evaluateName: evaluateName });
        await this.save();
        this.refresh();
        this._onWorkspaceVariablesChanged.fire(
          this.items.map((v) => v.evaluateName)
        );
      }
    } else {
      vscode.window.showErrorMessage(
        `Variable ${evaluateName} is not an array type.`
      );
    }
  }

  async removeVariable(evaluateName: string) {
    this.items = this.items.filter((v) => v.evaluateName !== evaluateName);
    await this.save();
    this.refresh();
    this._onWorkspaceVariablesChanged.fire(
      this.items.map((v) => v.evaluateName)
    );
  }

  async refresh() {
    await this.evaluateAll();
    this._onDidChangeTreeData.fire();
  }

  private async evaluateAll() {
    const session = vscode.debug.activeDebugSession;

    if (!session) {
      this.items.forEach((v) => {
        v.value = undefined;
        v.error = "No debug session";
      });
      return;
    }

    let thread: Thread;
    try {
      thread = await getActiveThread();
    } catch (err) {
      this.items.forEach((v) => {
        v.value = undefined;
        v.error = "No active thread";
      });
      return;
    }

    await Promise.all(
      this.items.map(async (v) => {
        try {
          const result = await findVariableByEvaluateName(
            session,
            thread.frameId,
            v.evaluateName
          );
          v.value = result.result;
          v.error = undefined;
        } catch (e: any) {
          v.value = undefined;
          v.error = e?.message || "Eval error";
        }
      })
    );
  }

  private async save() {
    await this.context.workspaceState.update(
      "workspaceVariables",
      this.items.map((v) => v.evaluateName)
    );
  }

  private load() {
    const arr = this.context.workspaceState.get<string[]>(
      "workspaceVariables",
      []
    );
    this.items = arr.map((evaluateName) => ({ evaluateName }));
    setTimeout(() => {
      this._onWorkspaceVariablesChanged.fire(
        this.items.map((v) => v.evaluateName)
      );
    }, 0);
  }

  private startAutoRefresh() {
    this.refreshTimer = setInterval(() => this.refresh(), 2000);
  }
}
