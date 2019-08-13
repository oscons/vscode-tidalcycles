import { ILogger } from './logging';
import { IGhci } from './ghci';
import * as vscode from 'vscode';
import { Config } from './config';
import * as fs from 'fs';
import {callbackToPromise} from './util';

/**
 * Provides an interface to send instructions to the current Tidal instance.
 */
export interface ITidal {
    sendTidalExpression(expression: string): Promise<void>;
    sendPebbleRequest(request:string): Promise<string>;
}

export class Tidal implements ITidal {
    tidalBooted: boolean = false;
    pebbleAvailable: boolean = false;
    previousGhciId: string | null = null;

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

    private async bootTidal(): Promise<boolean> {
        return new Promise<boolean>(async (resolve, reject) => {
            if(this.previousGhciId === null){
                this.tidalBooted = false;
            }
            const currentGhciId = this.ghci.getId();
            if(currentGhciId === null){
                return Promise.reject("GHCI not started");
            }

            if(this.previousGhciId !== currentGhciId){
                this.tidalBooted = false;
                this.previousGhciId = currentGhciId;
            }

            if (this.tidalBooted) {
                return Promise.resolve(true);
            }
            this.pebbleAvailable = false;

            let pebbleLoaded:boolean = false;

            if(this.enablePebble){
                const uri = this.config.getExtensionFileUri(["pebble","Pebble.hs"]);
                await this.ghci.writeLn(`:l ${uri.fsPath}`);
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
                        await this.ghci.writeLn(command);
                    }
                }

            }

            this.tidalBooted = true;

            if(pebbleLoaded){
                const initString = "init";
                const response = await this.ghci.sendPebbleRequest(`"${initString}"`);
                const pres = eval(response);
                    
                if(pres === initString){
                    this.pebbleAvailable = true;
                    this.logger.log("Pebble loaded\n");
                }
                resolve(true);
                return;
            }
        
            resolve(true);
            return;
        });
    }

    public async sendTidalExpression(expression: string): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            try {
                if(await this.bootTidal()){
                    await this.ghci.writeLn(':{');
                    const splits = expression.split(/[\r\n]+/);
                    for (let i = 0; i < splits.length; i++) {
                        await this.ghci.writeLn(splits[i]);
                    }
                    await this.ghci.writeLn(':}');
                    resolve();
                }
            }
            catch(error){
                reject(error);
            }
        });
    }

    public async sendPebbleRequest(request: string): Promise<string> {
        return new Promise<string>(async (resolve, reject) => {
            try {
                await this.bootTidal()
                const response: string = await this.ghci.sendPebbleRequest(request);
                resolve(response);
            }
            catch(error){
                reject(error);
            }
        });
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
