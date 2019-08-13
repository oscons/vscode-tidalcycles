import * as TypeMoq from "typemoq";
import { Config } from '../src/config';
import { ExtensionContext, Uri } from "vscode";
import { assert } from 'chai';
import * as path from 'path';

suite("Util", () => {
    test("Paths relative to extension dir", () => {
        const basePath = "thequickbrownfoxistoolongasentence";
        const fooname = "foo";
        const foonames = ["foo","bar"];
        
        let context = TypeMoq.Mock.ofType<ExtensionContext>();
        
        context.setup(x => x.extensionPath).returns(() => basePath)

        const ctx = context.object;

        let config = new Config(ctx);
        
        let ret: Uri;
        
        ret = config.getExtensionFileUri(fooname);

        //context.verify(x => x.extensionPath,  TypeMoq.Times.atLeastOnce());
        
        assert.exists(ret);
        assert.equal(ret.scheme, "file");
        assert.isTrue(ret.path.endsWith(fooname));
        assert.isTrue(ret.path.indexOf(basePath) >= 0);

        ret = config.getExtensionFileUri(foonames);

        assert.exists(ret);
        assert.equal(ret.scheme, "file");
        assert.isTrue(ret.path.endsWith(foonames[foonames.length-1]));
        assert.isTrue(ret.path.indexOf(basePath) >= 0);
        assert.isTrue(ret.path.indexOf(path.join(...foonames)) >= 0);
        
    });
});