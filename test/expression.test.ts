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
        , originalDoc: string[] 
    });

    function generateContext(doc:string[], pos:(number | number[] | string | string[]), strategy:string): TestContext {
        const adoc = doc.map(x=>x);
        const selectionContext = getSelectionContext(doc, pos);
    
        const mockConfig = TypeMoq.Mock.ofType<Config>();
        mockConfig.setup(x => x.evalStrategy()).returns(x => strategy);

        return {
            mockConfig
            , mockDocument: selectionContext.mockDocument
            , mockEditor: selectionContext.mockEditor
            , originalDoc: adoc
        };
    }

    function getExpression(ctx:TestContext, selectionType:ReplSelectionType){
        let tidalEditor = new TidalEditor(ctx.mockEditor.object, ctx.mockConfig.object);
        return tidalEditor.getTidalExpressionUnderCursor(selectionType);
    }

    suite("Strategy: default", () => {
        test("Single-line expression retrieved", () => {
            const ctx = generateContext(["?Hello world"], 1, "default");
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
            const ctx = generateContext(["", "?Hello world", ""], 1, "default");

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
            const ctx = generateContext(["?", "Hello world", ""], 1, "default");
            
            let expression = getExpression(ctx, ReplSelectionType.SINGLE);

            expect(expression).not.to.be.eq(null);
            expect(expression.length).to.be.eq(0);
        });

        test("Multi-line expression retrieved", () => {
            const ctx = generateContext(["", "?one", "two", " ", "three"], 1, "default");
        
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
            const ctx = generateContext(["", "?one", "two", " ", "three?"], [1, 2], "default");
            
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
            const ctx = generateContext(["", "?one", "two", " ", "th?ree"], [1, 2], "default");
            
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
            const ctx = generateContext(["", "one", "two", "? ", "three"], 1, "default");
            
            let expression = getExpression(ctx, ReplSelectionType.MULTI);
            expect(expression).not.to.be.eq(null);
            expect(expression.length).to.be.eq(0);
        });
    });

    type TestInfo = ({
        doc: (string | string[])[]
        , sel: (number | string | number[] | string[])
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
            // TODO add test for normalization
        });
        
//         const atestDoc = `
// ?_a?on?_b?e--no comment1
// t?_c?wo
//   ?_bl1?  ?_bl2?
//    ?_bl3?
//    ?_bl4? ?_bl5? 
// three

// do
// ...
//     f?_d?ou?_e?r
// ............
//         fi?_f?ve --no comment2
// ?_bl6?
// :sixer
// seven
// ?_bl8?
// eight
//         `;
        const tests: TestInfo[] = [
                {l:"No selection, one line, blank, far between blocks", sel: 1
                    , doc:  [["?","","one"],["one","","?","","two"],["one","","?"],["?","","....one"]
                            , ["one","","?","","....two"],["....one","","?"]]
                    , res: bm(ReplSelectionType.SINGLE, undefined, ReplSelectionType.MULTI, undefined)}
                , {l:"No selection, one line, blank, close between, top level", sel: 1
                    , doc: [["two","?","three"],["two","?","three","","four"]
                            , ["","two","?","three"],["one","","two","?","three","","four"]]
                    , res: bm(ReplSelectionType.SINGLE, undefined, ReplSelectionType.MULTI, ["two","three"])}
                , {l:"No selection, one line, blank, close between, indented blocks", sel: 1
                    , doc: [["one","?","....two"],["....one","?","........two"]]
                    , res: bm(ReplSelectionType.SINGLE, undefined, ReplSelectionType.MULTI, ["one\r\n....two"])}
                , {l:"No selection, one line, blank, above block", sel: 1
                    , doc: [["?","one","","two"],["start","","?","one","","two"],["?","one","","two","","end"]]
                    , res: bm(ReplSelectionType.SINGLE, "one", ReplSelectionType.MULTI, "one")}
                , {l:"No selection, one line, blank, above block, top level", sel: 1
                    , doc:  [["?","one","two"],["start","","?","one","two"],["?","one","two","","end"]
                            , ["?","....one","....two"],["?","....one","....two","","end"]]
                    , res: bm(ReplSelectionType.SINGLE, "one", ReplSelectionType.MULTI, ["one","two"])}
                , {l:"No selection, one line, blank, below block", sel: 1
                    , doc: [["two","three","?"],["one","","two","three","?"],["one","","two","three","?","","four"]
                            , ["....two","....three","?"], ["....two","....three","?","","four"]]
                    , res: bm(ReplSelectionType.SINGLE, "three", ReplSelectionType.MULTI, ["two", "three"])}
                , {l:"No selection, one line, not blank", sel: 1
                    , doc: [["?two","three"],["tw?o","three"],["two?","three"]
                            , ["one","","?two","three"],["one","","tw?o","three"],["one","","two?","three"]
                            , ["one","","?two","three","","four"],["one","","tw?o","three","","four"],["one","","two?","three","","four"]
                            , ["....?two","....three"],["....tw?o","....three"],["....two?","....three"]
                            , ["....?two","....three","four"],["....tw?o","....three","four"],["....two?","....three","four"]
                    ]
                    , res: bm(ReplSelectionType.SINGLE, "two", ReplSelectionType.MULTI, ["two", "three"])}
                , {l:"With selection, one line, blank", sel: [1,2]
                    , doc: [["one","two","..?..?..","","three"],["","two","?....?..","","three"],["","two","?....?","","three"]]
                    , res: bm(ReplSelectionType.SINGLE, undefined, ReplSelectionType.MULTI, ["two"])}
                , {l:"With selection, one line, blank", sel: [1,2]
                    , doc: [["one","two","..?..?..","....three"],["","two","?....?..","....three"],["","two","?....?","....three"]
                            ,["one","two","..?..?..","....three","four"],["","two","?....?..","....three","four"],["","two","?....?","....three","four"]]
                    , res: bm(ReplSelectionType.SINGLE, undefined, ReplSelectionType.MULTI, ["two\r\n....three"])}
                , {l:"With selection, multi line, blank, below block", sel: [1, 2]
                    , doc: [["one","two","..?..",".....?..","","three"],["one","two","","..?..",".....?..","three"]
                        ,["one","two","..?..",".....?..","three"],["one","two","","..?..",".....?..","","three"]]
                    , res: bm(ReplSelectionType.SINGLE, undefined, ReplSelectionType.MULTI, undefined)}
                // , {l:"With selection, one line", sel: ["a","b"]
                //     , res: bm(ReplSelectionType.SINGLE, "on", ReplSelectionType.MULTI, ["one"])}
                // , {l:"With selection, multi line", sel: ["a","c"]
                //     , res: bm(ReplSelectionType.SINGLE, ["one", "t"], ReplSelectionType.MULTI, ["one","two"])}
                // , {l:"No selection, one line, indented", sel: "d"
                //     , res: bm(ReplSelectionType.SINGLE, "four", ReplSelectionType.MULTI, ["do\r\n    four\r\n        five\r\n    sixer"])}
                // , {l:"With selection, one line, indented", sel: ["d","e"]
                //     , res: bm(ReplSelectionType.SINGLE, "ou", ReplSelectionType.MULTI, ["four\r\n    five"])}
                // , {l:"With selection, multi line, indented", sel: ["d","f"]
                //     , res: bm(ReplSelectionType.SINGLE, ["our\r\n    fi"], ReplSelectionType.MULTI, ["four\r\n    five"])}
        ];

        [ReplSelectionType.SINGLE, ReplSelectionType.MULTI].map((selectionType) => {
            suite("Selection tpye: "+ReplSelectionType[selectionType], () => {
                tests.map((t,testNum) => {
                    /*
                    split the test into batches, to avoid mocha warnings of
                    long run times.
                    */
                    t.doc.reduce((x:(({doc:string|string[],docNum:number})[])[], y, i) => {
                        const e = {doc: y, docNum: i};
                        if(i % 5 === 0){
                            x.push([e]);
                        }
                        else {
                            x[x.length-1].push(e);
                        }
                        return x;
                    }, []).map((docBatch, batchNum, batches) => {
                        test(t.l+" (test:"+(testNum+1)+"/"+tests.length+", batch:"+(batchNum+1)+"/"+batches.length+")", () =>{
                            docBatch.map(({doc, docNum}) => {
                                const errMsg = "Failed on doc "+docNum;
                                let testDoc = typeof doc === 'string' ? doc.split(/\r?\n/) :  doc;
                                let normalize = (x:string) => x.replace(/[.]/g,' ').replace(/,/g,"\t");

                                // TODO: comments should probably be fuzzed over the doc
                                // TODO: make one extra run with a large doc by adding ~ 1000 lines to start and bottom each
                                testDoc = testDoc
                                            .map(normalize)
                                            .map(x => x.trim().length === 0 ? x : x+" -- comment -- still a comment");
                                
                                const result = t.res.get(selectionType);
                                
                                const ctx = generateContext(testDoc, t.sel, "fuzzy");
                                
                                let expression = getExpression(ctx, selectionType);

                                if(typeof result === 'undefined'){
                                    if(!(expression === null || expression.length === 0)){
                                        expression = getExpression(ctx, selectionType);
                                    }
                                    assert.isTrue(expression === null || expression.length === 0, errMsg);
                                }
                                else {
                                    assert.isNotNull(expression, errMsg);
                                    if (expression !== null) {
                                        expect(expression.length).to.be.equal(result.length, errMsg);

                                        for(let j=0;j<expression.length;j++){
                                            expect(expression[j].expression).to.be.equal(normalize(result[j]), errMsg);
                                        }
                                    }
                                }
                            });
                        });
                    });
                });
            });
        });
    });

});