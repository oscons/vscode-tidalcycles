import { TextEditor, ExtensionContext, window, commands } from 'vscode';
import { Repl } from './repl';
import { Logger, ILogger } from './logging';
import { Config } from './config';
import { Ghci, IGhci } from './ghci';
import { Tidal, ITidal } from './tidal';
import { History } from './history';


export function activate(context: ExtensionContext) {
    const config = new Config(context);
    const logger:ILogger = new Logger(window.createOutputChannel('TidalCycles'));

    const ghci:IGhci = new Ghci(logger, config.useStackGhci(), config.ghciPath(), config.showGhciOutput());
    const tidal:ITidal = new Tidal(logger, ghci, config.bootTidalPath(), config.useBootFileInCurrentDirectory(), config.enablePebble(), config);
    const history = new History(logger, config);

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
        ghci.addListener('out', (data: any) => {
            logger.log(`${data}`, false);
        });

        ghci.addListener('error', (data: any) => {
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

    context.subscriptions.push(evalSingleCommand, evalMultiCommand, hushCommand);
}

export function deactivate() { }