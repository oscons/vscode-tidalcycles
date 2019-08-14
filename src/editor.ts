import {Range, TextEditor, TextDocument, Selection} from 'vscode';
import { ReplSelectionType } from './repl';
import { Config } from './config';

/**
 * Represents a single expression to be executed by Tidal.
 */
export class TidalExpression {
    public readonly expression: string;
    public readonly range: Range;

    constructor(expression: string, range: Range) {
        this.expression = expression;
        this.range = range;
    }
}

export interface ISelectionStrategy {
    getTidalExpressionUnderCursor(document: TextDocument, selection: Selection, selectionType: ReplSelectionType): TidalExpression | null;
}

export interface Type<T> extends Function {
    new (...args: any[]): T;
}

/**
 * Represents a document of Tidal commands.
 */
export class TidalEditor {    
    private availableStrategies = new Map<string, Type<ISelectionStrategy>>();

    constructor(
        private editor: TextEditor
        , private config: Config
    ) {
        this.availableStrategies.set("default", DefaultSelectionStrategy);
    }

    private getStrategy(name: string): ISelectionStrategy {
        const strategy = this.availableStrategies.get(name);
        if(typeof strategy === 'undefined' || strategy === null){
            return new DefaultSelectionStrategy();
        }
        return new strategy();
    }

    public getTidalExpressionUnderCursor(selectionType: ReplSelectionType): TidalExpression | null {
        const strategy = this.getStrategy(this.config.evalStrategy());

        return strategy.getTidalExpressionUnderCursor(this.editor.document, this.editor.selection, selectionType);
    }    
}

export class DefaultSelectionStrategy implements ISelectionStrategy {
    private isEmpty(document: TextDocument, line: number): boolean {
        return document.lineAt(line).text.trim().length === 0;
    }

    /**
     * Given a document and a range, find the first line which is not blank. 
     * Returns null if there are no non-blank lines before the end of the selection.
     */
    private getFirstNonBlankLineInRange(document: TextDocument, range: Range): number | null {
        for (let currentLineNumber = range.start.line; currentLineNumber <= range.end.line; currentLineNumber++) {
            if (!this.isEmpty(document, currentLineNumber)) {
                return currentLineNumber;
            }
        }

        return null;
    }

    /**
     * Assuming that the start position of the range is inside a Tidal expression, search backwards for the first line
     * of that expression.
     */
    private getFirstExpressionLineBeforeSelection(document: TextDocument, range: Range): number | null {
        let currentLineNumber = range.start.line;

        // If current line is empty, do not attempt to search.
        if (this.isEmpty(document, currentLineNumber)) {
            return null;
        }

        while (currentLineNumber >= 0 && !this.isEmpty(document, currentLineNumber)) {
            currentLineNumber--;
        }

        return currentLineNumber + 1;
    }

    private getStartLineNumber(document: TextDocument, range: Range): number | null {
        // If current line is empty, search forward for the expression start
        if (this.isEmpty(document, range.start.line)) {
            return this.getFirstNonBlankLineInRange(document, range);
        }
        // Else, current line has contents and so Tidal expression may start on a prior line
        return this.getFirstExpressionLineBeforeSelection(document, range);
    }

    private getEndLineNumber(document: TextDocument, startLineNumber: number): number {
        let currentLineNumber = startLineNumber;
        while (currentLineNumber < document.lineCount && !this.isEmpty(document, currentLineNumber)) {
            currentLineNumber++;
        }
        return currentLineNumber - 1;
    }

    public getTidalExpressionUnderCursor(document: TextDocument, selection: Selection, selectionType: ReplSelectionType): TidalExpression | null {
        const getMultiline = (selectionType === ReplSelectionType.MULTI);
        const position = selection.active;

        const line = document.lineAt(position);

        // If there is a single-line expression
        // TODO: decide the behaviour in case in multi-line selections
        if (!getMultiline) {
            if (this.isEmpty(document, position.line)) { return null; }
            let range = new Range(line.lineNumber, 0, line.lineNumber, line.text.length);
            return new TidalExpression(line.text, range);
        }

        // If there is a multi-line expression
        const selectedRange = new Range(selection.anchor, selection.active);
        const startLineNumber = this.getStartLineNumber(document, selectedRange);
        if (startLineNumber === null) {
            return null;
        }

        const endLineNumber = this.getEndLineNumber(document, startLineNumber);
        const endCol = document.lineAt(endLineNumber).text.length;

        let range = new Range(startLineNumber, 0, endLineNumber, endCol);

        return new TidalExpression(document.getText(range), range);
    }    
}
