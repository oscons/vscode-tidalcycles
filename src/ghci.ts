import { ChildProcess, spawn } from 'child_process';
import { ILogger } from './logging';
import * as vscode from 'vscode';
import * as split2 from 'split2';
import { EOL } from 'os';
import { EventEmitter } from 'events';
import { callbackToPromise, waitForPromise } from './util';

/**
 * Provides an interface for sending commands to a GHCi session.
 */
export interface IGhci {
    start(): Promise<boolean>;
    stop(): Promise<boolean>;
    writeLn(command: string): Promise<void>;
    getId(): string | null;
    sendPebbleRequest(request:string, timeout?:number): Promise<string>;
    on(type:string, listener:((e:any) => any)): IGhci;
}

export const MAGIC_STRING = "#:)))#";
export const ID_SEPARATOR = "#";

type spawntype = typeof spawn;

export class Ghci implements IGhci {
    private ghciProcess: ChildProcess | null = null;

    private readonly emitter: EventEmitter = new EventEmitter();
    private streamData : String = "";

    constructor(
        private logger: ILogger,
        private useStack: boolean,
        private ghciPath: string,
        private showGhciOutput: boolean,
        private readonly spawnImpl: spawntype = spawn
        ) {

        this.emitter.on('data-out', (x:string) => {
            this.streamData += x;

            const searchForData = () => {
                if(this.streamData.indexOf(MAGIC_STRING[0]) < 0){
                    this.streamData = "";
                    return null;
                }
                const p1off = this.streamData.indexOf(MAGIC_STRING);
                if(p1off < 0){
                    return null;
                }
                const p2off = this.streamData.indexOf(MAGIC_STRING, p1off+1);
                if(p2off < 0){
                    return null;
                }

                const tidalReply = this.streamData.substr(p1off+MAGIC_STRING.length, p2off-p1off-MAGIC_STRING.length);
                this.streamData = this.streamData.substr(p2off+MAGIC_STRING.length);
                return tidalReply;
            }

            for(var d = searchForData();d != null;d = searchForData()){
                const ID_END_INDICATOR = "#";
                console.log(">>> ",d, " <<<");
                const idend = d.indexOf(ID_END_INDICATOR);
                if(idend < 0){
                    console.log("no id on reply?")
                    return;
                }
                const id = d.substr(0, idend);
                
                this.emitter.emit(this.getListenerTopicForPebblId(id), d.substr(idend+ID_END_INDICATOR.length));
            }
        });
    }

    public on(type:string, listener:Function): IGhci {
        this.emitter.on(type, listener);
        return this;
    }

    public getId(): string | null {
        const currentProcess = this.ghciProcess;
        if(currentProcess === null){
            return(null);
        }
        return "pid:" + currentProcess.pid;
    }

    public async start(): Promise<boolean> {
        return this.getGhciProcess() !== null;
    }

    public async stop(): Promise<boolean> {
        /*
        do not use 'getGhciProcess' here, otherwise it might start before it stops
        */
        const process = this.ghciProcess;
        if(process == null){
            return(true);
        }

        let exited = new Promise<boolean>((resolve, reject) => {
            process.on("exit", () => {
                this.ghciProcess = null;
                resolve();
            })
        });
        
        await callbackToPromise(x => process.stdin.write(":quit\n",x));
        process.stdin.end();
        
        let rv = await waitForPromise(exited, 2000);
        if(rv.hadTimeout){
            this.ghciProcess = null;
            throw new Error(`Timeout: Process ${process.pid} did not exit in time`);
        }
        return true;
    }

    private pebbleIdCtr = 0;

    private getNextPebbleId(): string {
        return ""+(this.pebbleIdCtr++);
    }

    private getListenerTopicForPebblId(id:string){
        return `preq-${id}`;
    }

    public async sendPebbleRequest(request:string, timeout:number=5000): Promise<string> {
        const msgId = this.getNextPebbleId();
        const requestString = `answerMe "${msgId}" $ (${request})`;

        const replyId = this.getListenerTopicForPebblId(msgId);
        console.log("waiting for reply to ", replyId)
        
        let replyP = new Promise<string>((resolve, reject) => {
            this.emitter.on(replyId, (msg:any) => {
                resolve(msg);
            });
        });

        await this.writeLn(requestString);
        
        let rv = await waitForPromise(replyP, timeout);

        if(rv.hadTimeout){
            this.emitter.removeAllListeners(replyId);
            throw new Error(`Timeout while waiting for reply to ${msgId}: ${request}`);
        }

        return rv.value[0];
    }

    private getGhciProcess(): ChildProcess {
        if (this.ghciProcess !== null) {
            return this.ghciProcess;
        }

        if (this.useStack) {
            var stackOptions = ['--silent', 'ghci', '--ghci-options', '-XOverloadedStrings'];
            if (!this.showGhciOutput) {
                stackOptions.push('--ghci-options', '-v0');
            }
            this.ghciProcess = this.spawnImpl('stack', stackOptions,
                {
                    cwd: vscode.workspace.rootPath
                });
        } else {
            var ghciOptions = ['-XOverloadedStrings'];
            if (!this.showGhciOutput) {
                ghciOptions.push('-v0');
            }
            this.ghciProcess = this.spawnImpl(this.ghciPath, ghciOptions,
                {
                    cwd: vscode.workspace.rootPath
                });
        }

        // FIXME: This should be configurable
        const outputEncoding = 'utf8';

        // FIXME: make sure errors raise here are acutaly properly caught

        try {
            this.ghciProcess.stdout.setEncoding(outputEncoding);
            this.ghciProcess.stdout.on('data', (data: any) => {
                console.log("stdout", data);
                this.emitter.emit('data-out', data);
            });

            this.ghciProcess.stderr.setEncoding(outputEncoding);
            this.ghciProcess.stderr.pipe(split2()).on('data', (data: any) => {
                console.log("stderr", data);
                this.emitter.emit('data-error', data);
            });
        }
        catch(error){
            this.ghciProcess.stdin.end();
            this.ghciProcess = null;
            throw error;
        }

        this.logger.log(`GHCI started. PID: ${this.ghciProcess.pid}\n`);

        return this.ghciProcess;
    }

    private write(command: string): Promise<void> {
        return callbackToPromise(x => {
            const ghciProcess = this.getGhciProcess();
            ghciProcess.stdin.write(command, x);
        });
    }

    public writeLn(command: string): Promise<void> {
        return this.write(`${command}${EOL}`);
    }
}