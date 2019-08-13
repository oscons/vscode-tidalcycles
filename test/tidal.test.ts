import { Ghci, IGhci } from '../src/ghci';
import { Tidal } from '../src/tidal';
import { Logger, ILogger } from '../src/logging';
import * as TypeMoq from "typemoq";
import { Config } from '../src/config';
import { assert } from 'chai';

suite("Tidal", () => {
    test("Single line sent to Tidal is passed to GHCi", async () => {
        let mockedLogger = TypeMoq.Mock.ofType<ILogger>();
        let mockedGhci = TypeMoq.Mock.ofType<IGhci>();
        let mockedConfig = TypeMoq.Mock.ofType<Config>();
        let tidal: Tidal = new Tidal(mockedLogger.object, mockedGhci.object, null, false, false, mockedConfig.object);
        tidal.tidalBooted = true;

        mockedGhci.setup(ghci => ghci.getId()).returns(() => "testid");

        mockedGhci.setup(ghci => ghci.writeLn(':{')).verifiable(TypeMoq.Times.once());
        mockedGhci.setup(ghci => ghci.writeLn('d1 $ sound "bd"')).verifiable(TypeMoq.Times.once());
        mockedGhci.setup(ghci => ghci.writeLn(':}')).verifiable(TypeMoq.Times.once());

        await tidal.sendTidalExpression('d1 $ sound "bd"');

        mockedGhci.verifyAll();
    });

    ['\r\n', '\n'].forEach(function(lineEnding) {
        test(`Multiple lines (separator: ${lineEnding}) sent to Tidal are passed to GHCi`, () => {
            let mockedLogger = TypeMoq.Mock.ofType<Logger>();
            let mockedGhci = TypeMoq.Mock.ofType<Ghci>();
            let mockedConfig = TypeMoq.Mock.ofType<Config>();
            let tidal: Tidal = new Tidal(mockedLogger.object, mockedGhci.object, null, false, false , mockedConfig.object);
            tidal.tidalBooted = true;

            mockedGhci.setup(ghci => ghci.getId()).returns(() => "testid");

            mockedGhci.setup(ghci => ghci.writeLn(':{')).verifiable(TypeMoq.Times.once());
            mockedGhci.setup(ghci => ghci.writeLn('d1 $')).verifiable(TypeMoq.Times.once());
            mockedGhci.setup(ghci => ghci.writeLn('sound "bd"')).verifiable(TypeMoq.Times.once());
            mockedGhci.setup(ghci => ghci.writeLn(':}')).verifiable(TypeMoq.Times.once());

            return tidal.sendTidalExpression(`d1 $${lineEnding}sound "bd"`).then(() => {
                mockedGhci.verifyAll();
            });
        });
    });

    test("Send pebble request", async () => {
        let mockedLogger = TypeMoq.Mock.ofType<ILogger>();
        let mockedGhci = TypeMoq.Mock.ofType<IGhci>();
        let mockedConfig = TypeMoq.Mock.ofType<Config>();
        let tidal: Tidal = new Tidal(mockedLogger.object, mockedGhci.object, null, false, false, mockedConfig.object);
        tidal.tidalBooted = true;

        mockedGhci.setup(ghci => ghci.getId()).returns(() => "testid");

        mockedGhci.setup(ghci => ghci.sendPebbleRequest("foobar"))
            .returns((x) => Promise.resolve(`${x}2`))
            .verifiable(TypeMoq.Times.once());

        const response = await tidal.sendPebbleRequest("foobar");
        assert.equal(response, "foobar2");

        mockedGhci.verifyAll();
    });
});