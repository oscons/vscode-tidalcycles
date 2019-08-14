import * as vscode from 'vscode';
import { ITidal } from './tidal';
import { TidalEditor, TidalExpression } from './editor';
import { IHistory } from './history';
import { DecorationRenderOptions, TextEditorDecorationType } from 'vscode';
import { Config } from './config';

export enum ReplSelectionType {
    SINGLE
    , MULTI
}

/**
 * Provides the UI commands for an interactive Tidal session.
 */
export interface IRepl {
    hush(): Promise<void>;
    evaluate(selectionType: ReplSelectionType): Promise<void>;
}

export class Repl implements IRepl {
    public readonly postChannel: vscode.OutputChannel | null = null;

    constructor(private tidal: ITidal, 
        private textEditor: vscode.TextEditor, private history: IHistory, 
        private config: Config, 
        private createTextEditorDecorationType: (_: DecorationRenderOptions) => TextEditorDecorationType) {
    }

    private editingTidalFile(): boolean {
        return this.textEditor.document.fileName.endsWith('.tidal');
    }

    public async hush() {
        if (!this.editingTidalFile()) {
            return;
        }

        await this.tidal.sendTidalExpression('hush');
        this.history.log(new TidalExpression('hush', new vscode.Range(0, 0, 0, 0)));
    }

    public async evaluate(selectionType: ReplSelectionType) {
        if (!this.editingTidalFile()) { 
            return; 
        }

        const block = new TidalEditor(this.textEditor, this.config).getTidalExpressionUnderCursor(selectionType);
        
        if (block && block.length > 0) {
            for(let i=0;i<block.length;i++){
                await this.tidal.sendTidalExpression(block[i].expression);
                this.feedback(block[i].range);
                this.history.log(block[i]);
            }
        }
    }

    private feedback(range: vscode.Range): void {
        const flashDecorationType = this.createTextEditorDecorationType({
            backgroundColor: this.config.feedbackColor()
        });
        this.textEditor.setDecorations(flashDecorationType, [range]);
        setTimeout(function () {
            flashDecorationType.dispose();
        }, 250);
    }

}