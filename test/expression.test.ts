import { assert } from 'chai';

import { getSelectionContext } from './mock';
import { TextDocument, TextEditor } from 'vscode';

import { Config } from '../src/config';
import * as TypeMoq from 'typemoq';

import { expect } from 'chai';
import { ReplSelectionType } from '../src/repl';
import { TidalEditor } from '../src/editor';

suite("Editor", () => {
    type TestContext = ({
        mockConfig: TypeMoq.IMock<Config>
        , mockDocument: TypeMoq.IMock<TextDocument>
        , mockEditor: TypeMoq.IMock<TextEditor>
    });

    function generateContext(doc:string | string[], pos:(number | number[] | string | string[]), strategy:string): TestContext {
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

    suite("Strategy: default", () => {
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

});