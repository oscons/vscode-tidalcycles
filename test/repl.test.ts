import { Position, Selection, TextEditorDecorationType, DecorationRenderOptions, TextEditor, TextDocument } from 'vscode';
import * as TypeMoq from 'typemoq';
import { createMockDocument, createMockEditor, createMockCreateTextEditorDecorationType } from './mock';
import { Repl, ReplSelectionType } from '../src/repl';
import { ITidal } from '../src/tidal';
import { IHistory } from '../src/history';
import { Config } from '../src/config';

type TestContext = ({
   mockTidal:TypeMoq.IMock<ITidal> 
   , mockConfig: TypeMoq.IMock<Config>
   , mockDocument: TypeMoq.IMock<TextDocument>
   , mockEditor: TypeMoq.IMock<TextEditor>
   , mockHistory: TypeMoq.IMock<IHistory>
   , mockCreateTextEditorDecorationType: TypeMoq.IMock<(options: DecorationRenderOptions) => TextEditorDecorationType>
});

function genContext(
    fileName:string='myfile.tidal'
    , document:string[]=['Foo','bar','','baz']
    , pos1:number[]=[1,0]
    , pos2:number[]=[1,2]
):TestContext {
    const mockDocument = createMockDocument(document);
    mockDocument.setup(d => d.fileName).returns(() => fileName);
    return {
        mockTidal: TypeMoq.Mock.ofType<ITidal>()
        , mockConfig: TypeMoq.Mock.ofType<Config>()
        , mockDocument
        , mockEditor: createMockEditor(mockDocument.object, new Selection(new Position(pos1[0], pos1[1]), new Position(pos2[0], pos2[1])))
        , mockHistory: TypeMoq.Mock.ofType<IHistory>()
        , mockCreateTextEditorDecorationType: createMockCreateTextEditorDecorationType()
    };
}

function getRepl(ctx:TestContext) {
    return new Repl(ctx.mockTidal.object, ctx.mockEditor.object, ctx.mockHistory.object, 
        ctx.mockConfig.object, ctx.mockCreateTextEditorDecorationType.object);
}

suite('Repl', () => {
    test('Hush executed in .tidal file', async () => {
        let ctx = genContext('myfile.tidal');
        let repl = getRepl(ctx);
        await repl.hush();

        ctx.mockTidal.verify(t => t.sendTidalExpression('hush'), TypeMoq.Times.once());
        ctx.mockHistory.verify(h => h.log(TypeMoq.It.isAny()), TypeMoq.Times.once());
    });

    test('Hush not executed in non-.tidal file', async () => {
        let ctx = genContext('myfile.ideal');
        let repl = getRepl(ctx);
        await repl.hush();

        ctx.mockTidal.verify(t => t.sendTidalExpression(TypeMoq.It.isAnyString()), TypeMoq.Times.never());
        ctx.mockHistory.verify(h => h.log(TypeMoq.It.isAny()), TypeMoq.Times.never());
    });

    test('Expression not evaluated in non-.tidal file', async () => {
        let ctx = genContext('myfile.ideal');
        let repl = getRepl(ctx);
        await repl.evaluate(ReplSelectionType.SINGLE);

        ctx.mockTidal.verify(t => t.sendTidalExpression(TypeMoq.It.isAnyString()), TypeMoq.Times.never());
        ctx.mockHistory.verify(h => h.log(TypeMoq.It.isAny()), TypeMoq.Times.never());
    });

    test('Multi-line expression evaluated in .tidal file', async () => {
        let ctx = genContext();
        let repl = getRepl(ctx);
        await repl.evaluate(ReplSelectionType.MULTI);

        ctx.mockTidal.verify(t => t.sendTidalExpression('Foo\r\nbar'), TypeMoq.Times.once());
        ctx.mockHistory.verify(h => h.log(TypeMoq.It.isAny()), TypeMoq.Times.once());
    });

    test('Single-line expression evaluated in .tidal file', async () => {
        let ctx = genContext();
        let repl = getRepl(ctx);
        await repl.evaluate(ReplSelectionType.SINGLE);

        ctx.mockTidal.verify(t => t.sendTidalExpression('bar'), TypeMoq.Times.once());
        ctx.mockHistory.verify(h => h.log(TypeMoq.It.isAny()), TypeMoq.Times.once());
    });
});
