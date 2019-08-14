import {
    TextEditor, TextLine, Range, Position, TextDocument, Selection,
    TextEditorDecorationType, window, DecorationRenderOptions
} from 'vscode';
import * as TypeMoq from 'typemoq';

class TestTextLine implements TextLine {
    lineNumber: number;
    text: string;
    range: Range;
    rangeIncludingLineBreak: Range;
    firstNonWhitespaceCharacterIndex: number;
    isEmptyOrWhitespace: boolean;

    constructor(lineNumber: number, text: string) {
        this.lineNumber = lineNumber;
        this.text = text;
        this.range = new Range(new Position(0, 0), new Position(0, text.length));
        this.rangeIncludingLineBreak = new Range(new Position(0, 0), new Position(0, text.length + 2));
        this.firstNonWhitespaceCharacterIndex = text.search('[^\s]');
        this.isEmptyOrWhitespace = text.trim().length === 0;
    }
}

export function createMockDocument(lines: string[]): TypeMoq.IMock<TextDocument> {
    let mockDocument = TypeMoq.Mock.ofType<TextDocument>();
    lines.forEach((line, index) => {
        mockDocument
            .setup(d => d.lineAt(
                TypeMoq.It.is((p: Position) => p.line === index && p.character <= line.length)))
            .returns(() => new TestTextLine(index, line));
        mockDocument.setup(d => d.lineAt(index))
            .returns(() => new TestTextLine(index, line));
    });
    mockDocument.setup(d => d.lineCount).returns(() => lines.length);

    mockDocument
        .setup(d => d.getText(TypeMoq.It.isAny()))
        .returns((r: Range) => {
            let result = "";
            for (let line = r.start.line; line <= r.end.line; line++) {
                if (line === r.start.line) {
                    result += mockDocument.object.lineAt(line).text.substring(r.start.character);
                    result += "\r\n";
                } else if (line < r.end.line) {
                    result += mockDocument.object.lineAt(line);
                    result += "\r\n";
                } else {
                    result += mockDocument.object.lineAt(line).text.substring(0, r.end.character);
                }
            }
            return result;
        });

    return mockDocument;
}

export function createMockEditor(document: TextDocument, selection: Selection): TypeMoq.IMock<TextEditor> {
    let mockEditor = TypeMoq.Mock.ofType<TextEditor>();
    mockEditor.setup(e => e.document).returns(() => document);
    mockEditor.setup(e => e.selection).returns(() => selection);
    mockEditor.setup(e => e.setDecorations(TypeMoq.It.isAny(), TypeMoq.It.isAny()));
    return mockEditor;
}

export function createMockCreateTextEditorDecorationType():
    TypeMoq.IMock<(options: DecorationRenderOptions) => TextEditorDecorationType> {
    let mockTextEditorDecorationType = TypeMoq.Mock.ofType<TextEditorDecorationType>();
    mockTextEditorDecorationType.setup(d => d.dispose());
    let mockCreateTextEditorDecorationType = TypeMoq.Mock.ofInstance(window.createTextEditorDecorationType);
    mockCreateTextEditorDecorationType.setup(f => f(TypeMoq.It.isAny())).returns(() => mockTextEditorDecorationType.object);
    return mockCreateTextEditorDecorationType;
}

export type TestDocInfo = ({
    doc: string[]
    , marks: Map<string, number[]>
})

export function genDocInfo(s:string | string[]): TestDocInfo {
    const ret: TestDocInfo = {
        doc: []
        , marks: new Map<string, number[]>()
    }
    if(typeof s === 'string'){
        ret.doc = s.split(/\r?\n/);
    }
    else {
        ret.doc = s;
    }
    let cnt = 0;
    const ndoc: string[] = [];
    for(let i=0;i<ret.doc.length;i++){
        let l = ret.doc[i];
        let m: RegExpExecArray | null;
        /*
        Find patterns that are either a single question mark or a string in the
        form of ?_XXXX? where the XXXX part is treated as a name for the mark.
        */
        const rex = /[?](_([^?]+)[?])?/;
        
        while((m = rex.exec(l)) !== null){
            if(typeof m[2] !== 'undefined'){
                ret.marks.set(m[2], [i, m.index]);
            }
            ret.marks.set(""+cnt, [i, m.index]);
            
            l = l.substr(0, m.index) + l.substr(m.index+m[0].length);
            cnt ++;
        }
        ndoc[i] = l;
    }
    ret.doc = ndoc;
    return ret;
}

export type TestEditorContext = ({
    mockDocument: TypeMoq.IMock<TextDocument>
    , mockEditor: TypeMoq.IMock<TextEditor>
});

function generateEditorContext(
    document:string[]
    , pos1:number[]
    , pos2:number[]
): TestEditorContext {
    const mockDocument = createMockDocument(document)

    return ({
        mockDocument
        , mockEditor: createMockEditor(mockDocument.object, new Selection(new Position(pos1[0], pos1[1]), new Position(pos2[0], pos2[1])))
    });
}

export function getSelectionContext(
    doc:string | string[] | TestDocInfo
    , selectionPositions:(string | number | string[] | number[])
): TestEditorContext{
    let docInfo: TestDocInfo = {doc:[], marks: new Map<string, number[]>()};

    if(typeof doc === 'string' || Array.isArray(doc)){
        docInfo = genDocInfo(doc);
    }
    else {
        docInfo = doc;
    }

    let pos: (number[]|undefined)[] = [];

    if(typeof selectionPositions === 'string'){
        pos = [docInfo.marks.get(selectionPositions)];
    }
    else if(typeof selectionPositions === 'number'){
        pos = [docInfo.marks.get(""+selectionPositions)];
    }
    else if(Array.isArray(selectionPositions)){
        const sa: any[] = selectionPositions;
        pos = sa.map(x => {
            if(typeof x === "string"){
                return docInfo.marks.get(x);
            }
            return docInfo.marks.get(""+x);
        });
    }
    
    let xordef = (x:undefined | number[], d: number[]): number[] => typeof x === 'undefined' ? d : x;

    let pos1: number[] = [0,0];
    let pos2: number[] = pos1;
    if(pos.length > 0){
        pos1 = xordef(pos[0], pos1);
    }
    pos2 = pos1;
    if(pos.length > 1){
        pos2 = xordef(pos[1], pos2);
    }
    
    return generateEditorContext(docInfo.doc, pos1, pos2);
}
