import { Ghci } from '../src/ghci';
import { ILogger } from '../src/logging';
import * as TypeMoq from "typemoq";
import { assert } from 'chai';

import { ChildProcess, spawn } from 'child_process';
import { Readable, Writable } from 'stream';

suite("GHCi", () => {
    test("Start stop", async () => {
        let mockedLogger = TypeMoq.Mock.ofType<ILogger>();
        
        let mockedSpawn = TypeMoq.Mock.ofInstance(spawn);

        let data = {id: 1337};

        const makeFakeChild = () => {
            let mockedChildProcess = TypeMoq.Mock.ofType<ChildProcess>();
            
            const myData: ({pid: number, listener:null | ((...arg:any[]) => any) }) = {
                pid: data.id++
                , listener: null
            };

            mockedChildProcess.setup(x => x.pid).returns(() => myData.pid);

            mockedChildProcess.setup(x => x.stderr).returns(() => {
                const mockedStream = TypeMoq.Mock.ofType<Readable>();
                mockedStream.setup(x => x.pipe(TypeMoq.It.isAny())).returns((f) => {
                    return mockedStream.object;
                });
                return mockedStream.object;
            });
            mockedChildProcess.setup(x => x.stdout).returns(() => {
                const mockedStream = TypeMoq.Mock.ofType<Readable>();
                mockedStream.setup(x => x.pipe(TypeMoq.It.isAny())).returns((f) => {
                    return mockedStream;
                });
                return mockedStream.object;
            });
            mockedChildProcess.setup(x => x.stdin).returns(() => {
                const mockedStream = TypeMoq.Mock.ofType<Writable>();
                mockedStream.setup(x => x.write(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns((v, cb) => {
                    cb(v);
                    return true;
                })
                mockedStream.setup(x => x.end()).returns(() => {
                    const lst = myData.listener;
                    console.log("End called, listener is",lst);
                    if(lst !== null){
                        lst();
                    }
                });
                return mockedStream.object;
            });

            mockedChildProcess.setup(x => x.on(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns((x, l) =>{
                myData.listener = l;
                console.log("Listener registered for", x,":", l);
                return mockedChildProcess.object;
            });

            return mockedChildProcess.object;
        }
        
        mockedSpawn.setup((x) => x(TypeMoq.It.isAny(),TypeMoq.It.isAny(),TypeMoq.It.isAny()))
            .returns(makeFakeChild).verifiable(TypeMoq.Times.atLeastOnce());

        let ghci = new Ghci(mockedLogger.object, false, "", true, mockedSpawn.object);

        // first start
        assert.isNull(ghci.getId());
        assert.isTrue(await ghci.start());
        const id = ghci.getId();
        assert.isNotNull(id);
        if(id !==  null){
            assert.isTrue(id.indexOf("1337") >= 0);
        }

        // first stop
        assert.isTrue(await ghci.stop());
        assert.isNull(ghci.getId());

        // implicit start by writeLn
        await ghci.writeLn("foobar");
        const nextId = ghci.getId();
        assert.isNotNull(nextId);
        assert.notEqual(nextId, id);

        // second stop
        assert.isTrue(await ghci.stop());
        assert.isNull(ghci.getId());
    });
});