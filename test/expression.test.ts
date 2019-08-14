import { Position, Selection, TextDocument, TextEditor } from 'vscode';
import { expect, assert } from 'chai';
import { TidalEditor } from '../src/editor';
import { createMockDocument, createMockEditor } from './mock';
import { Config } from '../src/config';
import * as TypeMoq from 'typemoq';
import { ReplSelectionType } from '../src/repl';

type TestContext = ({
    mockConfig: TypeMoq.IMock<Config>
   , mockDocument: TypeMoq.IMock<TextDocument>
   , mockEditor: TypeMoq.IMock<TextEditor>
});

function genContext(
    document:string[]
    , pos1:number[]=[1,0]
    , pos2:number[]=[1,2]
    , strategy:string="default"
): TestContext {
    const mockConfig = TypeMoq.Mock.ofType<Config>();
    mockConfig.setup(x => x.evalStrategy()).returns(() => strategy);

    const mockDocument = createMockDocument(document)

    return ({
        mockConfig
        , mockDocument
        , mockEditor: createMockEditor(mockDocument.object, new Selection(new Position(pos1[0], pos1[1]), new Position(pos2[0], pos2[1])))
    });
}

suite("Editor", () => {
    test("Single-line expression retrieved", () => {
        const ctx = genContext(["Hello world"], [0,0],[0,0]);

        let tidalEditor = new TidalEditor(ctx.mockEditor.object, ctx.mockConfig.object);
        let expression = tidalEditor.getTidalExpressionUnderCursor(ReplSelectionType.SINGLE);

        assert.isNotNull(expression);
        if (expression !== null) {
            expect(expression.expression).to.be.equal("Hello world");
        }
    });

    test("Single-line expression between blank lines retrieved", () => {
        const ctx = genContext(["", "Hello world", ""], [1,0],[1,0]);

        let tidalEditor = new TidalEditor(ctx.mockEditor.object, ctx.mockConfig.object);
        let expression = tidalEditor.getTidalExpressionUnderCursor(ReplSelectionType.SINGLE);

        assert.isNotNull(expression);
        if (expression !== null) {
            expect(expression.expression).to.be.equal("Hello world");
        }
    });

    test("Blank line becomes null expression", () => {
        const ctx = genContext(["", "Hello world", ""], [0,0],[0,0]);
        
        let tidalEditor = new TidalEditor(ctx.mockEditor.object, ctx.mockConfig.object);
        let expression = tidalEditor.getTidalExpressionUnderCursor(ReplSelectionType.SINGLE);

        assert.isNull(expression);
    });

    test("Multi-line expression retrieved", () => {
        const ctx = genContext(["", "one", "two", " ", "three"], [1,0],[1,0]);
    
        let tidalEditor = new TidalEditor(ctx.mockEditor.object, ctx.mockConfig.object);
        let expression = tidalEditor.getTidalExpressionUnderCursor(ReplSelectionType.MULTI);

        assert.isNotNull(expression);
        if (expression !== null) {
            expect(expression.expression).to.be.equal("one\r\ntwo");
        }
    });

    test("Multi-line expression from split selection", () => {
        const ctx = genContext(["", "one", "two", " ", "three"], [1,0],[4,5]);
        
        let tidalEditor = new TidalEditor(ctx.mockEditor.object, ctx.mockConfig.object);
        let expression = tidalEditor.getTidalExpressionUnderCursor(ReplSelectionType.MULTI);

        assert.isNotNull(expression);
        if (expression !== null) {
            expect(expression.expression).to.be.equal("one\r\ntwo");
        }
    });

    test("Multi-line expression retrieved before selection", () => {
        const ctx = genContext(["", "one", "two", " ", "three"], [1,0],[4,2]);
        
        let tidalEditor = new TidalEditor(ctx.mockEditor.object, ctx.mockConfig.object);
        let expression = tidalEditor.getTidalExpressionUnderCursor(ReplSelectionType.MULTI);

        assert.isNotNull(expression);
        if (expression !== null) {
            expect(expression.expression).to.be.equal("one\r\ntwo");
        }
    });

    test("Multi-line expression becomes null from blank line", () => {
        const ctx = genContext(["", "one", "two", " ", "three"], [3,0],[3,0]);
        
        let tidalEditor = new TidalEditor(ctx.mockEditor.object, ctx.mockConfig.object);
        let expression = tidalEditor.getTidalExpressionUnderCursor(ReplSelectionType.MULTI);

        assert.isNull(expression);
    });
});
