import { assert } from 'chai';
import { genDocInfo } from './mock';

import { getSelectionContext } from './mock';
import { TextDocument, TextEditor } from 'vscode';

import { Config } from '../src/config';
import * as TypeMoq from 'typemoq';

import { expect } from 'chai';
import { ReplSelectionType } from '../src/repl';
import { TidalEditor } from '../src/editor';


suite("Editor genDocInfo", () => {
    test("Document from one string", () => {
        const myTestDoc = genDocInfo(`
let x ?_a?= 1
let y = 4
    z = 2

do
    let a = 1
    let b = 1
?
do
    let v = 1
    let w = 2?_c?
        `);
        assert.equal(myTestDoc.doc.length, 13);
        assert.equal(myTestDoc.doc[1], "let x = 1");
        assert.equal(myTestDoc.doc[8], "");
        assert.equal(myTestDoc.doc[11], "    let w = 2");

        const pos = {"a": [1, 6], "1": [8, 0], "2": [11, 13]};
        Object.entries(pos).forEach(([k, v]) => {
            const m = myTestDoc.marks.get(k);
            assert.exists(m);
            if(typeof m !== 'undefined' && m !== null){
                assert.equal(m.join(","), v.join(","));
            }
        });

        const selCtx = getSelectionContext(myTestDoc, [1, 2]);
        assert.equal(selCtx.mockEditor.object.selection.anchor.line, 8);
        assert.equal(selCtx.mockEditor.object.selection.anchor.character, 0);
        assert.equal(selCtx.mockEditor.object.selection.end.line, 11);
        assert.equal(selCtx.mockEditor.object.selection.end.character, 13);

    });

    test("Document from array single", () => {
        const doc = ["", "one", "two", "? ", "three"];
        const myTestDoc = genDocInfo(doc);

        assert.equal(myTestDoc.doc.length, 5);
        assert.equal(myTestDoc.doc[1], "one");
        assert.equal(myTestDoc.doc[3], " ");

        const pos = {"0": [3, 0]};
        Object.entries(pos).forEach(([k, v]) => {
            const m = myTestDoc.marks.get(k);
            assert.exists(m);
            if(typeof m !== 'undefined' && m !== null){
                assert.equal(m.join(","), v.join(","));
            }
        });

        const selCtx = getSelectionContext(doc, 0);
        assert.equal(selCtx.mockEditor.object.selection.anchor.line, 3);
        assert.equal(selCtx.mockEditor.object.selection.anchor.character, 0);

    });
    
    test("Document from array multi", () => {
        const doc = ["", "?one", "two", " ?", "three"];
        const myTestDoc = genDocInfo(doc);

        assert.equal(myTestDoc.doc.length, 5);
        assert.equal(myTestDoc.doc[1], "one");
        assert.equal(myTestDoc.doc[3], " ");

        const pos = {"0": [1, 0], "1": [3, 1]};
        Object.entries(pos).forEach(([k, v]) => {
            const m = myTestDoc.marks.get(k);
            assert.exists(m);
            if(typeof m !== 'undefined' && m !== null){
                assert.equal(m.join(","), v.join(","));
            }
        });

        const selCtx = getSelectionContext(doc, [0,1]);
        assert.equal(selCtx.mockEditor.object.selection.anchor.line, 1);
        assert.equal(selCtx.mockEditor.object.selection.anchor.character, 0);
        assert.equal(selCtx.mockEditor.object.selection.end.line, 3);
        assert.equal(selCtx.mockEditor.object.selection.end.character, 1);

    });


    
});

type TestContext = ({
    mockConfig: TypeMoq.IMock<Config>
   , mockDocument: TypeMoq.IMock<TextDocument>
   , mockEditor: TypeMoq.IMock<TextEditor>
});

function generateContext(doc:string | string[], pos:(number | number[] | string | string[]), strategy:string="default"): TestContext {
    const selectionContext = getSelectionContext(doc, pos);

    const mockConfig = TypeMoq.Mock.ofType<Config>();
    mockConfig.setup(x => x.evalStrategy()).returns(x => strategy);

    return {
        mockConfig
        , mockDocument: selectionContext.mockDocument
        , mockEditor: selectionContext.mockEditor
    };
}

function getExpression(ctx:TestContext, selectionType:ReplSelectionType){
    let tidalEditor = new TidalEditor(ctx.mockEditor.object, ctx.mockConfig.object);
    return tidalEditor.getTidalExpressionUnderCursor(selectionType);
}

suite("Editor [Strategy: default]", () => {
    test("Single-line expression retrieved", () => {
        const ctx = generateContext("?Hello world", 0, "default");
        let expression = getExpression(ctx, ReplSelectionType.SINGLE);

        assert.isNotNull(expression);
        if (expression !== null) {
            expect(expression.expression).to.be.equal("Hello world");
        }
    });

    test("Single-line expression between blank lines retrieved", () => {
        const ctx = generateContext(["", "?Hello world", ""], 0, "default");

        let expression = getExpression(ctx, ReplSelectionType.SINGLE);

        assert.isNotNull(expression);
        if (expression !== null) {
            expect(expression.expression).to.be.equal("Hello world");
        }
    });

    test("Blank line becomes null expression", () => {
        const ctx = generateContext(["?", "Hello world", ""], 0, "default");
        
        let expression = getExpression(ctx, ReplSelectionType.SINGLE);

        assert.isNull(expression);
    });

    test("Multi-line expression retrieved", () => {
        const ctx = generateContext(["", "?one", "two", " ", "three"], 0, "default");
    
        let expression = getExpression(ctx, ReplSelectionType.MULTI);

        assert.isNotNull(expression);
        if (expression !== null) {
            expect(expression.expression).to.be.equal("one\r\ntwo");
        }
    });

    test("Multi-line expression from split selection", () => {
        const ctx = generateContext(["", "?one", "two", " ", "three?"], [0, 1], "default");
        
        let expression = getExpression(ctx, ReplSelectionType.MULTI);

        assert.isNotNull(expression);
        if (expression !== null) {
            expect(expression.expression).to.be.equal("one\r\ntwo");
        }
    });

    test("Multi-line expression retrieved before selection", () => {
        const ctx = generateContext(["", "?one", "two", " ", "th?ree"], [0, 1], "default");
        
        let expression = getExpression(ctx, ReplSelectionType.MULTI);

        assert.isNotNull(expression);
        if (expression !== null) {
            expect(expression.expression).to.be.equal("one\r\ntwo");
        }
    });

    test("Multi-line expression becomes null from blank line", () => {
        const ctx = generateContext(["", "one", "two", "? ", "three"], 0, "default");
        
        let expression = getExpression(ctx, ReplSelectionType.MULTI);

        assert.isNull(expression);
    });
});
