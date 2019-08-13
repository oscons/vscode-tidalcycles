import { ILogger } from './logging';
import { IGhci } from './ghci';
import * as vscode from 'vscode';
import { Config } from './config';
import * as fs from 'fs';
import {callbackToPromise} from './util';
import { EventEmitter } from 'events';

/**
 * Provides an interface to send instructions to the current Tidal instance.
 */
export interface ITidal {
    start(): Promise<boolean>;
    stop(): Promise<boolean>;
    sendTidalExpression(expression: string): Promise<void>;
    on(type:string, listener:((e:any) => any)): ITidal;
}

export interface ITidalPebble extends ITidal {
    isPebbleAvailable(): boolean;
    sendPebbleRequest(request:string, timeout?:number): Promise<string>;
}

export class Tidal implements ITidalPebble {
    // FIXME: this should really be private but is currently used by some tests
    tidalBooted: boolean = false;
    private pebbleAvailable: boolean = false;
    private previousGhciId: string | null = null;

    private readonly emitter: EventEmitter = new EventEmitter();

    lineEnding = vscode.workspace
        .getConfiguration('files', null)
        .get('eol', '\n');

    constructor(
        private logger: ILogger,
        private readonly ghci: IGhci,
        private bootTidalPath: string | null,
        private useBootFileInCurrentDirectory: boolean,
        private enablePebble: boolean,
        private readonly config: Config
    ) {
    }

    public isPebbleAvailable(): boolean{
        return this.pebbleAvailable;
    }

    public on(event:string, listener:((e:any) => any)) {
        this.emitter.on(event, listener);
        return this;
    }

    public async start(): Promise<boolean> {
        return this.bootTidal();
    }

    public async stop(): Promise<boolean> {
        try {
            await this.ghci.stop();
            this.tidalBooted = false;
            this.pebbleAvailable = false;
            
            this.emitter.emit('pebble-stop', true);
            this.emitter.emit('stop', true);
            return true;
        }
        catch(error){
            this.emitter.emit('pebble-stop', true);
            this.emitter.emit('stop', false);
            throw error;
        }
    }

    private async bootTidal(): Promise<boolean> {
        if(this.previousGhciId === null){
            this.tidalBooted = false;
        }
        else {
            const currentGhciId = this.ghci.getId();
            if(currentGhciId === null){
                await this.ghci.start();
                this.tidalBooted = false;
            }
            else {
                if(this.previousGhciId !== currentGhciId){
                    this.tidalBooted = false;
                    this.previousGhciId = currentGhciId;
                }
            }
        }

        if (this.tidalBooted) {
            return true;
        }

        const ghci = this.ghci;
        if(ghci === null){
            return Promise.reject(new Error("GHCI not started"));
        }

        this.pebbleAvailable = false;

        let pebbleLoaded:boolean = false;

        if(this.enablePebble){
            const uri = this.config.getExtensionFileUri(["pebble","Pebble.hs"]);
            await ghci.writeLn(`:l ${uri.fsPath}`);
            pebbleLoaded = true;
        }

        const bootTidalPath = this.bootTidalPath;
        const useBootFileInCurrentDirectory = this.useBootFileInCurrentDirectory;

        let uri: vscode.Uri | null = null;

        if (useBootFileInCurrentDirectory) {
            const folders = vscode.workspace.workspaceFolders;

            if (folders !== undefined && folders.length > 0) {
                uri = vscode.Uri.parse(
                    `file://${folders[0].uri.path}/BootTidal.hs`
                );
            } else {
                this.logger.warning(
                    'You must open a folder or workspace in order to use the Tidal \
                useBootFileInCurrentDirectory setting.'
                );
            }
        } else if (bootTidalPath) {
            uri = vscode.Uri.file(`${bootTidalPath}`);
        }

        if (uri !== null) {
            if(uri.scheme === 'file'){
                let pathExists: boolean = false;
                const anUri = uri;
                
                if(anUri !== null){
                    pathExists = await callbackToPromise((x:any) => fs.exists(anUri.fsPath, x));
                }

                if(!pathExists){
                    uri = this.config.getExtensionFileUri("BootTidal.hs");
                }
                
            }

            let bootCommands = await this.getBootCommandsFromFile(uri);
            if (bootCommands !== null) {
                for (const command of bootCommands) {
                    await ghci.writeLn(command);
                }
            }
            /*
            TODO: Test if the Tidal boot was actually successful
            */
        }

        this.tidalBooted = true;
        this.previousGhciId = ghci.getId();

        if(pebbleLoaded){
            const initString = "init";
            const response = await this.ghci.sendPebbleRequest(`"'${initString}'"`, 3000);
            const pres = eval(response);
                
            if(pres === initString){
                this.pebbleAvailable = true;
                this.logger.log("Pebble loaded\n");
                
                this.emitter.emit('start', true);
                this.emitter.emit('pebble-start', true);
            }
            else {
                this.emitter.emit('start', true);
                this.emitter.emit('pebble-fail', true);
            }
            return true;
        }
    
        this.emitter.emit('start', true);
        return true;
    }

    public async sendTidalExpression(expression: string): Promise<void> {
        const tidalBooted = await this.bootTidal();
        if(tidalBooted){
            await this.ghci.writeLn(':{');
            const splits = expression.split(/[\r\n]+/);
            for (let i = 0; i < splits.length; i++) {
                await this.ghci.writeLn(splits[i]);
            }
            await this.ghci.writeLn(':}');
            return;
        }
        throw new Error("Tidal not booted");
    }

    public async sendPebbleRequest(request: string, timeout?:number): Promise<string> {
        await this.bootTidal()
        const response: string = await this.ghci.sendPebbleRequest(request, timeout);
        return response;
    }

    private async getBootCommandsFromFile(
        uri: vscode.Uri
    ): Promise<string[] | null> {
        this.logger.log(`Using Tidal boot file on disk at ${uri.fsPath}`);

        let doc: vscode.TextDocument;
        try {
            doc = await vscode.workspace.openTextDocument(uri);
            return doc.getText().split(/[\r\n]+/);
        } catch (e) {
            this.logger.error(`Failed to load boot commands from ${uri.fsPath}`);
            return null;
        }
    }

}
