import { TextEditor, ExtensionContext, window, commands } from 'vscode';
import { Repl } from './repl';
import { Logger, ILogger } from './logging';
import { Config } from './config';
import { Ghci, IGhci } from './ghci';
import { Tidal, ITidal } from './tidal';
import { History } from './history';
import * as vscode from 'vscode';

export function activate(context: ExtensionContext) {
    const config = new Config(context);
    const logger:ILogger = new Logger(window.createOutputChannel('TidalCycles'));

    const ghci:IGhci = new Ghci(logger, config.useStackGhci(), config.ghciPath(), config.showGhciOutput());
    const tidal:ITidal = new Tidal(logger, ghci, config.bootTidalPath(), config.useBootFileInCurrentDirectory(), config.enablePebble(), config);
    const history = new History(logger, config);

    const tidalStatusBarItem = window.createStatusBarItem(vscode.StatusBarAlignment.Right, 0);
    tidalStatusBarItem.text = "Tidal";
    tidalStatusBarItem.tooltip = "Tidal status: Unknown";
    tidalStatusBarItem.color = 'rgb(0.5,0.5,0.5)';
    tidalStatusBarItem.show();

    tidal.on("stop", (e) => {
        tidalStatusBarItem.tooltip = "Tidal status: Stopped";
        tidalStatusBarItem.color = 'rgb(1.0,0.0,0.0)';
    });
    tidal.on("start", (e) => {
        tidalStatusBarItem.tooltip = "Tidal status: Started";
        tidalStatusBarItem.color = 'rgb(0.0,1.0,0.0)';
    });

    function getRepl(repls: Map<TextEditor, Repl>, textEditor: TextEditor | undefined): Repl | undefined {
        if (textEditor === undefined) { return undefined; }
        if (!repls.has(textEditor)) {
            repls.set(textEditor,
                new Repl(tidal, textEditor, history, config, window.createTextEditorDecorationType));
        }
        return repls.get(textEditor);
    }

    const repls = new Map<TextEditor, Repl>();

    if (config.showOutputInConsoleChannel()) {
        ghci.on('data-out', (data: any) => {
            logger.log(`${data}`, false);
        });

        ghci.on('data-error', (data: any) => {
            logger.warning(`GHCi | ${data}`);
        });
    }

    const evalSingleCommand = commands.registerCommand('tidal.eval', function () {
        const repl = getRepl(repls, window.activeTextEditor);
        if (repl !== undefined) {
            repl.evaluate(false);
        }
    });

    const evalMultiCommand = commands.registerCommand('tidal.evalMulti', function () {
        const repl = getRepl(repls, window.activeTextEditor);
        if (repl !== undefined) {
            repl.evaluate(true);
        }
    });

    const hushCommand = commands.registerCommand('tidal.hush', function () {
        const repl = getRepl(repls, window.activeTextEditor);
        if (repl !== undefined) {
            repl.hush();
        }
    });

    const stopCommand = commands.registerCommand('tidal.stop', function () {
        tidal.stop().catch((e) => {
            vscode.window.showErrorMessage(""+e);
        });
    });

    const restartCommand = commands.registerCommand('tidal.restart', function () {
        tidal.stop().then(() => {
            tidal.start().then(() => {
                vscode.window.showInformationMessage("Tidal restarted");
            })
            .catch((e) => {
                vscode.window.showErrorMessage(""+e);
            });
        });
        
    });

    context.subscriptions.push(
        evalSingleCommand, evalMultiCommand, hushCommand
        , stopCommand, restartCommand
    );
}

export function deactivate() { }