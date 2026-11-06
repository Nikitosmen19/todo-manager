
import * as vscode from 'vscode';

// Одна найденная TODO-задача
interface TodoItem {
    file: vscode.Uri;
    line: number;
    text: string;
}

// Элемент дерева в боковой панели
class TodoProvider implements vscode.TreeDataProvider<TodoItem> {
    private todos: TodoItem[] = [];

    private changeEmitter = new vscode.EventEmitter<void>();
    readonly onDidChangeTreeData = this.changeEmitter.event;

    getTreeItem(item: TodoItem): vscode.TreeItem {
        const treeItem = new vscode.TreeItem(item.text);

        treeItem.description = `${vscode.workspace.asRelativePath(item.file)}:${item.line + 1}`;

        treeItem.command = {
            command: 'todo-manager.openTodo',
            title: 'Open TODO',
            arguments: [item]
        };

        return treeItem;
    }

    getChildren(): TodoItem[] {
        return this.todos;
    }

    async refresh() {
        this.todos = [];

        const files = await vscode.workspace.findFiles(
            '**/*',
            '**/{node_modules,out,.git,todo-manager}/**'
        );

        for (const file of files) {
            const document = await vscode.workspace.openTextDocument(file);

            for (let i = 0; i < document.lineCount; i++) {
                const line = document.lineAt(i).text;

                const isTodoComment =
    /(\/\/|\/\*|\*|<!--|^\s*#).*?\bTODO\b/.test(line);

                if (isTodoComment) {
                    this.todos.push({
                        file,
                        line: i,
                        text: line.trim()
                    });
                }
            }
        }

        this.changeEmitter.fire();
    }
}

export function activate(context: vscode.ExtensionContext) {
    const provider = new TodoProvider();

    vscode.window.registerTreeDataProvider('todoManager', provider);

    const openCommand = vscode.commands.registerCommand(
        'todo-manager.openTodo',
        (item: TodoItem) => {
            vscode.workspace.openTextDocument(item.file).then(document => {
                vscode.window.showTextDocument(document).then(editor => {
                    const position = new vscode.Position(item.line, 0);
                    editor.selection = new vscode.Selection(position, position);
                    editor.revealRange(new vscode.Range(position, position));
                });
            });
        }
    );

    const refreshCommand = vscode.commands.registerCommand(
        'todo-manager.refresh',
        () => provider.refresh()
    );

    context.subscriptions.push(openCommand, refreshCommand);
    const watcher = vscode.workspace.createFileSystemWatcher('**/*');

let refreshTimer: ReturnType<typeof setTimeout> | undefined;

const scheduleRefresh = () => {
    if (refreshTimer) {
        clearTimeout(refreshTimer);
    }

    refreshTimer = setTimeout(() => {
        provider.refresh();
    }, 300);
};

watcher.onDidCreate(scheduleRefresh);
watcher.onDidChange(scheduleRefresh);
watcher.onDidDelete(scheduleRefresh);

context.subscriptions.push(watcher);

    provider.refresh();
}

export function deactivate() {}
