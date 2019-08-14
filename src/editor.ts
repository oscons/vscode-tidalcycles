import {Range, TextEditor, TextDocument, Selection} from 'vscode';
import { ReplSelectionType } from './repl';
import { Config } from './config';

export enum TidalExpressionStatus {
    VALID
    , INVALID
}

/**
 * Represents a single expression to be executed by Tidal.
 */
export class TidalExpression {
    
    constructor(
        public readonly expression: string
        , public readonly range: Range
        , public readonly status: TidalExpressionStatus = TidalExpressionStatus.VALID
    ) {
    }
}

interface ISelectionStrategy {
    getTidalExpressionUnderCursor(document: TextDocument, selection: Selection, selectionType: ReplSelectionType): TidalExpression[] | null;
}

interface Type<T> extends Function {
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
        this.availableStrategies.set("fuzzy", FuzzySelectionStrategy);
    }

    private getStrategy(name: string): ISelectionStrategy {
        const strategy = this.availableStrategies.get(name);
        if(typeof strategy === 'undefined' || strategy === null){
            return new DefaultSelectionStrategy();
        }
        return new strategy(this.config);
    }

    public getTidalExpressionUnderCursor(selectionType: ReplSelectionType): TidalExpression[] | null {
        const strategy = this.getStrategy(this.config.evalStrategy());

        return strategy.getTidalExpressionUnderCursor(this.editor.document, this.editor.selection, selectionType);
    }    
}

class DefaultSelectionStrategy implements ISelectionStrategy {

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

    public getTidalExpressionUnderCursor(document: TextDocument, selection: Selection, selectionType: ReplSelectionType): TidalExpression[] | null {
        const getMultiline = (selectionType === ReplSelectionType.MULTI);
        const position = selection.active;

        const line = document.lineAt(position);

        // If there is a single-line expression
        // TODO: decide the behaviour in case in multi-line selections
        if (!getMultiline) {
            if (this.isEmpty(document, position.line)) { return null; }
            let range = new Range(line.lineNumber, 0, line.lineNumber, line.text.length);
            return [new TidalExpression(line.text, range)];
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

        return [new TidalExpression(document.getText(range), range)];
    }    
}

export function numLeadingWhitespace(s:string, tabWidth:number=4){
    return s.replace(/\S.*$/,'').split('')
            .map(z => z === "\t" ? tabWidth : (z === ' ' ? 1 : 0))
            .reduce((y,z) => y+z, 0);
}

class FuzzySelectionStrategy implements ISelectionStrategy{
    private tabWidth = 4;

    constructor(
    ){}

    public getTidalExpressionUnderCursor(document: TextDocument, selection: Selection, selectionType: ReplSelectionType): TidalExpression[] | null {
        const nothingSelected = (selection.start.line == selection.end.line && selection.start.character == selection.end.character);

        let range = new Range(selection.start.line, selection.start.character, selection.end.line, selection.end.character);

        if(nothingSelected){
            let newRange = FuzzySelectionStrategy.checkLineAboveOrBelow(selection.end.line, document, selectionType === ReplSelectionType.MULTI);
            if(newRange === null){
                return [];
            }
            range = newRange;
        }

        // First some logic to get the "real" selection
        if(selectionType === ReplSelectionType.SINGLE){
            if(nothingSelected){
                 range = new Range(range.start.line, range.start.character, range.end.line, document.lineAt(range.end.line).text.length);
            }
        }
        else {
            let startIndent = this._numLeadingWhitespace(document.lineAt(range.start.line).text);
            let selectionEndIndent = this._numLeadingWhitespace(document.lineAt(range.end.line).text);
            
            let startLine = range.start.line;
            if( nothingSelected
                || document.lineAt(range.start.line).text.trim() !== ''
                || range.end.line === range.start.line
            ){
                for(let sl = startLine-1;sl>=0;sl--){
                    const line = document.lineAt(sl).text;
                    if(startIndent == 0){
                        // TODO: Decide if comment-only lines should cause a break as well. Maybe worth a config item
                        if(
                            line.trim() === ''
                            || this._numLeadingWhitespace(line) > startIndent
                            || (!nothingSelected && this._numLeadingWhitespace(line) <= startIndent)
                            ){
                            startLine = sl+1;
                            break;
                        }
                    }
                    else {
                        const lineWs = this._numLeadingWhitespace(line);
                        if(lineWs == 0 || (!nothingSelected && this._numLeadingWhitespace(line) <= startIndent)){
                            startLine = sl;
                            break;
                        }
                    }
                    if(sl == 0){
                        startLine = sl;
                    }
                }
            }
            
            let endLine = range.end.line;
            if( nothingSelected
                || document.lineAt(range.end.line).text.trim() !== ''
                || range.end.line === range.start.line
            ) {
                startIndent  = this._numLeadingWhitespace(document.lineAt(nothingSelected ? startLine : range.end.line).text);
                for(let sl = endLine+1;sl<document.lineCount;sl++){
                    const line = document.lineAt(sl).text;

                    if(line.trim() === ''){
                        if(selectionEndIndent === 0){
                            endLine = sl-1;
                            break;
                        }
                        continue;
                    }

                    const lineWs = this._numLeadingWhitespace(line);
                    if(
                        lineWs < startIndent
                        || (nothingSelected && selectionEndIndent > 0 && lineWs == 0)
                        || (!nothingSelected && lineWs <= selectionEndIndent)
                    ){
                        endLine = sl-1;
                        break;
                    }

                    if(sl === document.lineCount-1){
                        endLine = sl;
                    }
                }
            }
                
            range = new Range(startLine, 0, endLine, document.lineAt(endLine).text.length);
        }

        return this.splitIntoTidalChunks(document, range)
            .map(c => {
                return new TidalExpression(c.l.join("\r\n"), c.r);
            })
            .filter(x => typeof x !== 'undefined' && x.expression.trim() !== '');
    }

    private splitIntoTidalChunks(document: TextDocument, selection:Range): ({r:Range,l:string[]})[] {
        const ret: ({r:Range,l:string[]})[] = [];

        /*
        Note:   document.getText returns a "valid" selection which sometimes is
                the whole line and also sometimes includes the line break to the
                next line. Hence we'r going line by line here and take care of
                start and end character ourselves.

                https://code.visualstudio.com/api/references/vscode-api#TextDocument.getText
        */
        const lines: string[] =  Array(1+selection.end.line-selection.start.line).fill("").map((_,i)=>document.lineAt(selection.start.line+i).text);
        // The order of the statements is important here!
        lines[lines.length-1] = lines[lines.length-1].substr(0,selection.end.character);
        lines[0] = lines[0].substr(selection.start.character);
        
        let lineOneIndented = false;
        let indent = -1;
        for(let i=0;i<lines.length;i++){
            // remove comments and blanks at end of line
            lines[i] = lines[i].replace(/\t/g, "".padEnd(this.tabWidth, " "));
            lines[i] = lines[i].replace(/\s*--.*$/, '').replace(/\s+$/,'');
            if(lines[i].length === 0 || indent == 0){
                continue;
            }

            const lindent = this._numLeadingWhitespace(lines[i]);
            
            if(indent === -1){
                lineOneIndented = lindent > 0;

                if(selection.start.character > 0){
                    let realFirstLine = document.lineAt(selection.start.line).text;
                    indent = this._numLeadingWhitespace(realFirstLine);
                }
                else {
                    indent = lindent;
                }
                
            }
            else {
                indent = Math.min(lindent, indent);
            }
        }

        for(let i=0;i<lines.length;i++){
            if(i == 0 && !lineOneIndented){
                continue
            }
            if(lines[i].length >= indent){
                lines[i] = lines[i].substr(indent);
            }
        }

        const lastline = (x:number) => x >= lines.length-1;

        let blockStart = -1;
        let lastNotEmpty = -1;
        for(let i=0;i<lines.length;i++){
            const line = lines[i];
            const lindent = this._numLeadingWhitespace(line);

            if(lindent === 0){
                if(line.length > 0){
                    if(blockStart >= 0){
                        const blockEnd = Math.min(Math.max(i-1,0),lastNotEmpty);
                        ret.push({
                            r: new Range(
                                selection.start.line+blockStart,indent
                                ,selection.start.line+blockEnd,indent+lines[blockEnd].length
                            )
                            , l: lines.slice(blockStart,i)
                        })
                        blockStart = -1;
                    }
                    lastNotEmpty = i;
                    if(!lastline(i)){
                        blockStart = i;
                        lastNotEmpty = i;
                        continue;
                    }
                }
            }
        
            if(line.trim().length > 0){
                lastNotEmpty = i;
                if(blockStart < 0){
                    blockStart = i;
                }
            }

            // last line
            if(lastline(i)){
                const blockEnd = lastNotEmpty;

                if(blockStart >= 0){
                    ret.push({
                        r: new Range(
                            selection.start.line+blockStart, indent
                            ,selection.start.line+blockEnd, indent+lines[blockEnd].length
                        )
                        , l: lines.slice(blockStart, blockEnd+1)
                    })
                }
            }
        }

        let tret = ret
            .map(x => {
                x.l = x.l.filter(x => x.length > 0);
                return x;
            })
            .filter(x => x.l.length > 0);
        return tret;
    } 

    private _numLeadingWhitespace(s:string):number {
        return numLeadingWhitespace(s, this.tabWidth);
    }

    private static checkLineAboveOrBelow(line:number, document:TextDocument, takeBoth:boolean=false): Range | null{
        let text = document.lineAt(line).text;
        
        if(text.trim() === ''){
            let tabove = line == 0 ? "" : document.lineAt(line-1).text;
            let tbelow = line < (document.lineCount-1) ? document.lineAt(line+1).text : "";

            if(tabove.trim() !== '' && tbelow.trim() === ''){
                return new Range(line-1, 0, line-1, tabove.length);
            }
            else if(tabove.trim() === '' && tbelow.trim() !== ''){
                return new Range(line+1, 0, line+1, tbelow.length);
            }
            else if(takeBoth && tabove.trim() !== '' && tbelow.trim() !== ''){
                return new Range(line-1, 0, line+1, tbelow.length);
            }
            return null;
        }
        return new Range(line, 0, line, 0);
    }

}
