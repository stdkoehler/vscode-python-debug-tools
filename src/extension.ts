import * as vscode from "vscode";

import {
  WorkspaceVariablesTreeDataProvider,
  WorkspaceVariable,
} from "./tree/WorkspaceVariablesTreeDataProvider";
import { ObjectVisualizerViewProvider } from "./webview/ObjectVisualizerViewProvider";
import { DataPlotViewProvider } from "./webview/DataPlotViewProvider";
import { getVariableJson } from "./variableUtils";

export function activate(context: vscode.ExtensionContext) {
  // --- Workspace Variables TreeView ---
  const workspaceProvider = new WorkspaceVariablesTreeDataProvider(context);
  // Register the WebviewViewProvider for the JSON Visualizer view
  const jsonProvider = new ObjectVisualizerViewProvider(
    context,
    workspaceProvider
  );
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      "objectVisualizerView",
      jsonProvider
    )
  );

  // Register the WebviewViewProvider for the Time Series Plot view
  const plotProvider = new DataPlotViewProvider(context, workspaceProvider);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider("dataPlotView", plotProvider)
  );

  const treeView = vscode.window.createTreeView("variableWorkspaceView", {
    treeDataProvider: workspaceProvider,
  });
  context.subscriptions.push(treeView, workspaceProvider);

  // Listen for workspace variable changes and send to both webviews
  workspaceProvider.onWorkspaceVariablesChanged((names) => {
    jsonProvider.postWorkspaceVariables(names);
    plotProvider.postWorkspaceVariables(names);
  });

  // Command: Add variable to workspace (from debug variable context menu)
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "python-debug-tools.addWorkspaceVariable",
      async (clickedItem) => {
        const evaluateName =
          clickedItem?.variable?.evaluateName || clickedItem?.variable?.name;
        if (evaluateName) {
          await workspaceProvider.addVariable(evaluateName);
        } else {
          vscode.window.showErrorMessage("No evaluateName found for variable.");
        }
      }
    )
  );

  // Command: Remove variable from workspace
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "python-debug-tools.removeWorkspaceVariable",
      async (item: WorkspaceVariable) => {
        await workspaceProvider.removeVariable(item.evaluateName);
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "python-debug-tools.visualizeObject",
      async (clickedItem: any) => {
        await vscode.commands.executeCommand("objectVisualizerView.focus");
        const result = await getVariableJson(clickedItem);
        if (result) {
          jsonProvider.postJson(JSON.parse(result.json));
        }
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "python-debug-tools.copyAsJson",
      async (clickedItem: any) => {
        const result = await getVariableJson(clickedItem);
        if (result) {
          await vscode.env.clipboard.writeText(result.json);
          vscode.window.showInformationMessage(
            `Copied as JSON (${result.type}).`
          );
        }
      }
    )
  );

  // Command: Copy selection to debug workspace (temporary Python file)
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "python-debug-tools.copySelectionToDebugEditor",
      async () => {
        const EDITOR_NAME = "PDT Debug Editor";
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
          vscode.window.showWarningMessage("No active editor found.");
          return;
        }
        const selection = editor.selection;
        const selectedText = editor.document.getText(selection);
        if (!selectedText) {
          vscode.window.showWarningMessage("No text selected.");
          return;
        }

        // Normalize indentation: remove minimum leading whitespace from all non-empty lines
        function normalizeIndent(text: string): string {
          const lines = text.split(/\r?\n/);
          // Find minimum indentation (spaces or tabs) for non-empty lines
          let minIndent: number | null = null;
          for (const line of lines) {
            if (line.trim().length === 0) {
              continue;
            }
            const match = line.match(/^(\s*)/);
            if (match) {
              const indent = match[1].length;
              if (minIndent === null || indent < minIndent) {
                minIndent = indent;
              }
            }
          }
          if (!minIndent || minIndent === 0) {
            return text;
          }
          // Remove minIndent from all lines
          return lines
            .map((line) =>
              line.trim().length === 0 ? "" : line.slice(minIndent!)
            )
            .join("\n");
        }
        const normalizedText = normalizeIndent(selectedText);

        // Try to reuse an existing untitled debug_workspace.py tab
        const openTabs = vscode.window.tabGroups.all.flatMap(
          (group) => group.tabs
        );
        let reused = false;
        for (const openTab of openTabs) {
          // Type guard: check if openTab.input has a uri property
          if (
            openTab.input &&
            typeof openTab.input === "object" &&
            "uri" in openTab.input
          ) {
            const document = await vscode.workspace.openTextDocument(
              (openTab.input as { uri: vscode.Uri }).uri
            );
            if (
              document.isUntitled &&
              document.languageId === "python" &&
              document.fileName.endsWith(EDITOR_NAME)
            ) {
              const edit = new vscode.WorkspaceEdit();
              const fullRange = new vscode.Range(
                document.positionAt(0),
                document.positionAt(document.getText().length)
              );
              edit.replace(document.uri, fullRange, normalizedText);
              await vscode.workspace.applyEdit(edit);
              await vscode.window.showTextDocument(document, {
                preview: false,
                viewColumn: vscode.ViewColumn.Active,
              });
              reused = true;
              break;
            }
          }
        }
        if (!reused) {
          // Create a new untitled file named 'PDT Debug Editor'
          const uri = vscode.Uri.parse(`untitled:${EDITOR_NAME}`);
          const doc = await vscode.workspace.openTextDocument(uri);
          // Set language to Python
          await vscode.languages.setTextDocumentLanguage(doc, "python");
          // Show the document in the editor
          const editor = await vscode.window.showTextDocument(doc, {
            preview: false,
            viewColumn: vscode.ViewColumn.Active,
          });
          // Insert normalized content
          const edit = new vscode.WorkspaceEdit();
          edit.insert(doc.uri, new vscode.Position(0, 0), normalizedText);
          await vscode.workspace.applyEdit(edit);
        }
        vscode.window.showInformationMessage(
          "Copied selection to temporary Python debug workspace."
        );
      }
    )
  );
}
