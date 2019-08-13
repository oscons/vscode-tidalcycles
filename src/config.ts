import * as vscode from 'vscode';
import * as path from 'path';

export class Config {
    getConfiguration = vscode.workspace.getConfiguration;
    configSection: string = 'tidalcycles';

    constructor (
        private context: vscode.ExtensionContext
    ){
    }

    public bootTidalPath(): string | null {
        return this.getConfiguration(this.configSection).get('bootTidalPath', null);
    }

    public feedbackColor(): string {
        return this.getConfiguration(this.configSection).get('feedbackColor', 'rgba(100,250,100,0.3)');
    }

    public ghciPath(): string {
        return this.getConfiguration(this.configSection).get('ghciPath', 'ghci');
    }

    public showEvalCount(): boolean {
        return this.getConfiguration(this.configSection).get('showEvalCount', false);
    }

    public showGhciOutput(): boolean {
        return this.getConfiguration(this.configSection).get('showGhciOutput', false);
    }

    public showOutputInConsoleChannel(): boolean {
        return this.getConfiguration(this.configSection).get('showOutputInConsoleChannel', false);
    }

    public useBootFileInCurrentDirectory(): boolean {
        return this.getConfiguration(this.configSection).get('useBootFileInCurrentDirectory', false);
    }

    public useStackGhci(): boolean {
        return this.getConfiguration(this.configSection).get('useStackGhci', false);
    }

    public enablePebble(): boolean {
        return this.getConfiguration(this.configSection).get('pebble.enable', false);
    }

    public getExtensionFileUri(filePath:string[] | string): vscode.Uri {
        let pathComponents;
        if(typeof filePath === 'string'){
            pathComponents = [filePath];
        }
        else {
            pathComponents = filePath;
        }
        return vscode.Uri.file(path.join(this.context.extensionPath, ...pathComponents));
    }
}