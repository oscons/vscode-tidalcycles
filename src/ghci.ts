import { ChildProcess, spawn } from 'child_process';
import { ILogger } from './logging';
import * as vscode from 'vscode';
import * as split2 from 'split2';
import { EOL } from 'os';
import { Stream } from 'stream';
import { EventEmitter } from 'events';
import { callbackToPromise } from './util';

/**
 * Provides an interface for sending commands to a GHCi session.
 */
export interface IGhci {
    writeLn(command: string): Promise<void>;
    getId(): string | null;
    sendPebbleRequest(request:string): Promise<string>;
    addListener(type:string, listener:Function): void;
}

export class Ghci implements IGhci {
    private ghciProcess: ChildProcess | null = null;
    public readonly stdout: Stream = new Stream();
    public readonly stderr: Stream = new Stream();

    private emitter: EventEmitter = new EventEmitter();

    constructor(
        private logger: ILogger,
        private useStack: boolean,
        private ghciPath: string,
        private showGhciOutput: boolean) {
    }

    public addListener(type:string, listener:Function): void{
        this.emitter.addListener(type, listener);
    }

    public getId(): string | null {
        const currentProcess = this.getGhciProcess();
        if(currentProcess === null){
            return(null);
        }
        return "pid:" + currentProcess.pid;
    }

    public sendPebbleRequest(request:string): Promise<string> {
        return Promise.reject("not implemented");
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
            this.ghciProcess = spawn('stack', stackOptions,
                {
                    cwd: vscode.workspace.rootPath
                });
        } else {
            var ghciOptions = ['-XOverloadedStrings'];
            if (!this.showGhciOutput) {
                ghciOptions.push('-v0');
            }
            this.ghciProcess = spawn(this.ghciPath, ghciOptions,
                {
                    cwd: vscode.workspace.rootPath
                });
        }

        this.ghciProcess.stderr.pipe(split2()).on('data', (data: any) => {
            this.stderr.emit('data', data);
            this.emitter.emit('out', data);
        });
        this.ghciProcess.stdout.on('data', (data: any) => {
            this.stdout.emit('data', data);
            this.emitter.emit('error', data);
        });

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