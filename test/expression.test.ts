import { assert } from 'chai';

import { getSelectionContext } from './mock';
import { TextDocument, TextEditor } from 'vscode';

import { Config } from '../src/config';
import * as TypeMoq from 'typemoq';

import { expect } from 'chai';
import { ReplSelectionType } from '../src/repl';
import { TidalEditor, numLeadingWhitespace } from '../src/editor';

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
            if(expression !=  null){
                assert.isTrue(expression.length > 0);
                if (expression !== null) {
                    expect(expression[0].expression).to.be.equal("Hello world");
                }
            }
        });

        test("Single-line expression between blank lines retrieved", () => {
            const ctx = generateContext(["", "?Hello world", ""], 0, "default");

            let expression = getExpression(ctx, ReplSelectionType.SINGLE);

            assert.isNotNull(expression);
            if(expression !=  null){
                assert.isTrue(expression.length > 0);
                if (expression !== null) {
                    expect(expression[0].expression).to.be.equal("Hello world");
                }
            }
        });

        test("Blank line becomes null expression", () => {
            const ctx = generateContext(["?", "Hello world", ""], 0, "default");
            
            let expression = getExpression(ctx, ReplSelectionType.SINGLE);

            expect(expression).to.be.oneOf([null, []]);
        });

        test("Multi-line expression retrieved", () => {
            const ctx = generateContext(["", "?one", "two", " ", "three"], 0, "default");
        
            let expression = getExpression(ctx, ReplSelectionType.MULTI);

            assert.isNotNull(expression);
            if(expression !=  null){
                assert.isTrue(expression.length > 0);
                if (expression !== null) {
                    expect(expression[0].expression).to.be.equal("one\r\ntwo");
                }
            }
        });

        test("Multi-line expression from split selection", () => {
            const ctx = generateContext(["", "?one", "two", " ", "three?"], [0, 1], "default");
            
            let expression = getExpression(ctx, ReplSelectionType.MULTI);

            assert.isNotNull(expression);
            if(expression !=  null){
                assert.isTrue(expression.length > 0);
                if (expression !== null) {
                    expect(expression[0].expression).to.be.equal("one\r\ntwo");
                }
            }
        });

        test("Multi-line expression retrieved before selection", () => {
            const ctx = generateContext(["", "?one", "two", " ", "th?ree"], [0, 1], "default");
            
            let expression = getExpression(ctx, ReplSelectionType.MULTI);

            assert.isNotNull(expression);
            if(expression !=  null){
                assert.isTrue(expression.length > 0);
                if (expression !== null) {
                    expect(expression[0].expression).to.be.equal("one\r\ntwo");
                }
            }
        });

        test("Multi-line expression becomes null from blank line", () => {
            const ctx = generateContext(["", "one", "two", "? ", "three"], 0, "default");
            
            let expression = getExpression(ctx, ReplSelectionType.MULTI);
            expect(expression).to.be.oneOf([null, []]);
        });
    });

    type TestInfo = ({
        sel: (number | string | number[] | string[])
        , res: Map<ReplSelectionType, undefined | string | string[]>
        , l: string
    });

    let bm = (
        ...args:(ReplSelectionType | undefined | string | string[])[]) => {
        let m = new Map<ReplSelectionType, undefined | string[]>();
            
        if(typeof args !== 'undefined' && args.length > 0){
            if(args.length % 2 == 1){
                throw new Error("Argument count unbalanced");
            }
            for(let i=0;i<args.length;i+=2){
                let v = args[i+1] as undefined | string | string[];
                if(typeof v !== 'undefined' && !Array.isArray(v)){
                    v = [v]
                }
                m.set(args[i] as ReplSelectionType, v);
            }
        }
        
        return m;
    }

    suite("Strategy: fuzzy", () => {
        suite("Utility functions", ()=>{
            ["","X","X ","X X","X\t","X\tX ","X\tX\t"].forEach((x,i) => {
                test("numLeadingWhitespace, "+" ("+(i+1)+")"+" suffix "+x, () => {
                    expect(numLeadingWhitespace(""+x)).to.be.eq(0);
                    expect(numLeadingWhitespace(" "+x)).to.be.eq(1);
                    expect(numLeadingWhitespace("    "+x)).to.be.eq(4);
                    expect(numLeadingWhitespace("\t"+x)).to.be.eq(4);
                    expect(numLeadingWhitespace("\t"+x,2)).to.be.eq(2);
                    expect(numLeadingWhitespace("\t "+x)).to.be.eq(5);
                    expect(numLeadingWhitespace(" \t "+x)).to.be.eq(6);
                    expect(numLeadingWhitespace(" \t \t"+x)).to.be.eq(10);
                });
            });
        });
        const testDoc = `
?_a?on?_b?e--no comment1
t?_c?wo
  ?_bl1?  ?_bl2?
   ?_bl3?
   ?_bl4? ?_bl5? 
three

do
...
    f?_d?ou?_e?r
............
        fi?_f?ve --no comment2
?_bl6?
:sixer
do
    seven
        `.replace(/[.]/g,' ').replace(/:/g,"\t");
        const tests: TestInfo[] = [
                {l:"No selection, one line, blank, far between blocks", sel: "bl3"
                    , res: bm(ReplSelectionType.SINGLE, undefined, ReplSelectionType.MULTI, undefined)}
                , {l:"No selection, one line, blank, close between blocks", sel: "bl6"
                    , res: bm(ReplSelectionType.SINGLE, undefined, ReplSelectionType.MULTI, ["do\r\n    four\r\n        five\r\n    sixer"])}
                , {l:"No selection, one line, blank, above block", sel: "bl4"
                    , res: bm(ReplSelectionType.SINGLE, "three", ReplSelectionType.MULTI, "three")}
                , {l:"No selection, one line, blank, below block", sel: "bl1"
                    , res: bm(ReplSelectionType.SINGLE, "two", ReplSelectionType.MULTI, ["one", "two"])}
                , {l:"With selection, one line, blank", sel: ["bl1","bl2"]
                    , res: bm(ReplSelectionType.SINGLE, undefined, ReplSelectionType.MULTI, ["two"])}
                , {l:"With selection, multi line, blank, below block", sel: ["bl1","bl3"]
                    , res: bm(ReplSelectionType.SINGLE, undefined, ReplSelectionType.MULTI, undefined)}
                , {l:"With selection, multi line, blank, above block", sel: ["bl3","bl5"]
                    , res: bm(ReplSelectionType.SINGLE, undefined, ReplSelectionType.MULTI, undefined)}
                , {l:"No selection, one line", sel: "a"
                    , res: bm(ReplSelectionType.SINGLE, "one", ReplSelectionType.MULTI, ["one", "two"])}
                , {l:"With selection, one line", sel: ["a","b"]
                    , res: bm(ReplSelectionType.SINGLE, "on", ReplSelectionType.MULTI, ["one"])}
                , {l:"With selection, multi line", sel: ["a","c"]
                    , res: bm(ReplSelectionType.SINGLE, ["one", "t"], ReplSelectionType.MULTI, ["one","two"])}
                , {l:"No selection, one line, indented", sel: "d"
                    , res: bm(ReplSelectionType.SINGLE, "four", ReplSelectionType.MULTI, ["do\r\n    four\r\n        five\r\n    sixer"])}
                , {l:"With selection, one line, indented", sel: ["d","e"]
                    , res: bm(ReplSelectionType.SINGLE, "ou", ReplSelectionType.MULTI, ["four\r\n    five"])}
                , {l:"With selection, multi line, indented", sel: ["d","f"]
                    , res: bm(ReplSelectionType.SINGLE, ["our\r\n    fi"], ReplSelectionType.MULTI, ["four\r\n    five"])}
        ];

        [ReplSelectionType.SINGLE,ReplSelectionType.MULTI].map((selectionType) => {
            suite("Selection tpye: "+ReplSelectionType[selectionType], () => {
                tests.map((t,i) => {
                    test(t.l+" ("+(i+1)+"/"+tests.length+")", () =>{
                        const ctx = generateContext(testDoc, t.sel, "fuzzy");
                        
                        let expression = getExpression(ctx, selectionType);
                        const result = t.res.get(selectionType);

                        if(typeof result === 'undefined'){
                            assert.isTrue(expression === null || expression.length === 0);
                        }
                        else {
                            assert.isNotNull(expression);
                            if (expression !== null) {
                                expect(expression.length).to.be.equal(result.length);

                                for(let j=0;j<expression.length;j++){
                                    expect(expression[j].expression).to.be.equal(result[j]);
                                }
                            }
                        }
                    });
                });
            });
        });
    });

});