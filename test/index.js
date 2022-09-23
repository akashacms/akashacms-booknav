'use strict';

const akasha   = require('akasharender');
const assert = require('chai').assert;
const booknav = require('../index');
const util = require('util');

let config;

describe('build site', function() {
    it('should construct configuration', async function() {

        this.timeout(15000);
        config = new akasha.Configuration();
        config.rootURL("https://example.akashacms.com");
        config.configDir = __dirname;
        config.addLayoutsDir('layouts')
            .addDocumentsDir('documents');
        config.use(booknav);
        config.setMahabhutaConfig({
            recognizeSelfClosing: true,
            recognizeCDATA: true,
            decodeEntities: true
        });
        config.prepare();

    });

    it('should run setup', async function() {
        this.timeout(75000);
        await akasha.setup(config);
        // await akasha.fileCachesReady(config);
    });

    it('should copy assets', async function() {
        this.timeout(75000);
        await config.copyAssets();
    });

    it('should build site', async function() {
        this.timeout(75000);
        try {
            let failed = false;
            let results = await akasha.render(config);
            for (let result of results) {
                if (result.error) {
                    failed = true;
                    console.error(result.error);
                }
            }
            assert.isFalse(failed);
        } catch (e) {
            console.error(e);
            throw e;
        }
    });
});

describe('check pages', function() {
    it('should have correct /folder/index.html', async function() {

        let { html, $ } = await akasha.readRenderedFile(config, 
                '/folder/index.html');

        assert.exists(html, 'result exists');
        assert.isString(html, 'result isString');

        // NOTE that this file has a repeated instance of Folder 3
        assert.equal($('.booknav-tree').length, 4);
        assert.equal($('.booknav-tree a[href="index.html"]').length, 1);
        assert.equal($('.booknav-tree a[href="folder/index.html"]').length, 1);
        assert.equal($('.booknav-tree a[href="folder/folder/index.html"]').length, 1);
        assert.equal($('.booknav-tree a[href="folder/folder/page1.html"]').length, 1);
        assert.equal($('.booknav-tree a[href="folder/folder/page2.html"]').length, 1);

        assert.equal($('.booknav-prevlink a[href="folder/index.html"]').length, 1);
        assert.equal($('.booknav-nextlink a[href="folder/folder/index.html"]').length, 1);
    });

    it('should have correct /folder/folder/index.html', async function() {

        let { html, $ } = await akasha.readRenderedFile(config, 
                '/folder/folder/index.html');

        assert.exists(html, 'result exists');
        assert.isString(html, 'result isString');

        assert.equal($('.booknav-tree').length, 3);
        assert.equal($('.booknav-tree a[href="../index.html"]').length, 0);
        assert.equal($('.booknav-tree a[href="index.html"]').length, 1);
        assert.equal($('.booknav-tree a[href="folder/index.html"]').length, 1);
        assert.equal($('.booknav-tree a[href="folder/page1.html"]').length, 1);
        assert.equal($('.booknav-tree a[href="folder/page2.html"]').length, 1);

        assert.equal($('.booknav-prevlink a[href="folder2/page2.html"]').length, 1);
        assert.equal($('.booknav-nextlink a[href="../index.html"]').length, 1);
    });

    it('should have correct /folder/folder/folder/index.html', async function() {

        let { html, $ } = await akasha.readRenderedFile(config, 
                '/folder/folder/folder/index.html');

        assert.exists(html, 'result exists');
        assert.isString(html, 'result isString');

        assert.equal($('.booknav-tree').length, 1);
        assert.equal($('.booknav-tree a[href="../.."]').length, 0);
        assert.equal($('.booknav-tree a[href=".."]').length, 0);
        assert.equal($('.booknav-tree a[href="index.html"]').length, 1);
        assert.equal($('.booknav-tree a[href="page1.html"]').length, 1);
        assert.equal($('.booknav-tree a[href="page2.html"]').length, 1);

        assert.equal($('.booknav-prevlink a[href="../../index.html"]').length, 1);
        assert.equal($('.booknav-nextlink a[href="page1.html"]').length, 1);
    });

    it('should have correct /folder/folder/folder/page1.html', async function() {

        let { html, $ } = await akasha.readRenderedFile(config, 
                '/folder/folder/folder/page1.html');

        assert.exists(html, 'result exists');
        assert.isString(html, 'result isString');

        assert.equal($('.booknav-tree').length, 0);
        assert.equal($('.booknav-tree a[href="/folder"]').length, 0);
        assert.equal($('.booknav-tree a[href="/folder/folder"]').length, 0);
        assert.equal($('.booknav-tree a[href="/folder/folder/folder/index.html"]').length, 0);
        assert.equal($('.booknav-tree a[href="/folder/folder/folder/page1.html"]').length, 0);
        assert.equal($('.booknav-tree a[href="/folder/folder/folder/page2.html"]').length, 0);

        assert.include($('h1').html(), "Page 1");

        assert.equal($('.booknav-prevlink a[href="index.html"]').length, 1);
        assert.equal($('.booknav-nextlink a[href="page2.html"]').length, 1);
    });

    it('should have correct /folder/folder/folder/page2.html', async function() {

        let { html, $ } = await akasha.readRenderedFile(config, 
                '/folder/folder/folder/page2.html');

        assert.exists(html, 'result exists');
        assert.isString(html, 'result isString');

        assert.equal($('.booknav-tree').length, 0);
        assert.equal($('.booknav-tree a[href="/folder"]').length, 0);
        assert.equal($('.booknav-tree a[href="/folder/folder"]').length, 0);
        assert.equal($('.booknav-tree a[href="/folder/folder/folder/index.html"]').length, 0);
        assert.equal($('.booknav-tree a[href="/folder/folder/folder/page1.html"]').length, 0);
        assert.equal($('.booknav-tree a[href="/folder/folder/folder/page2.html"]').length, 0);

        assert.include($('h1').html(), "Page 2");

        assert.equal($('.booknav-prevlink a[href="page1.html"]').length, 1);
        assert.equal($('.booknav-nextlink a[href="../folder2/index.html"]').length, 1);
    });
});


/* 
describe("Make Tree Test", function() {
    
    describe('compnentize', function() {
        it('one component', function() {
            var components = booknav.componentizeFileName("xyzzy.html");
            assert.equal(1, components.length);
            assert.equal("file", components[0].type);
            assert.equal("xyzzy.html", components[0].component);
        });
        it('one component leading slash', function() {
            var components = booknav.componentizeFileName("/xyzzy.html");
            assert.equal(1, components.length);
            assert.equal("file", components[0].type);
            assert.equal("xyzzy.html", components[0].component);
        });
        it('two components', function() {
            var components = booknav.componentizeFileName("foo/xyzzy.html");
            // console.log(util.inspect(components));
            assert.equal(2, components.length);
            assert.equal("dir", components[0].type);
            assert.equal("foo", components[0].component);
            assert.equal(0, components[0].entries.length);
            assert.equal("file", components[1].type);
            assert.equal("xyzzy.html", components[1].component);
        });
        it('../ two components', function() {
            var components = booknav.componentizeFileName("../foo/xyzzy.html");
            // console.log(util.inspect(components));
            assert.equal(3, components.length);
            
            assert.equal("dir", components[0].type);
            assert.equal("..", components[0].component);
            assert.equal(0, components[0].entries.length);
            
            assert.equal("dir", components[1].type);
            assert.equal("foo", components[1].component);
            assert.equal(0, components[1].entries.length);
            
            assert.equal("file", components[2].type);
            assert.equal("xyzzy.html", components[2].component);
        });
        it('./ two components', function() {
            var components = booknav.componentizeFileName("./foo/xyzzy.html");
            // console.log(util.inspect(components));
            assert.equal(2, components.length);
            assert.equal("dir", components[0].type);
            assert.equal("foo", components[0].component);
            assert.equal(0, components[0].entries.length);
            assert.equal("file", components[1].type);
            assert.equal("xyzzy.html", components[1].component);
        });
        it('four components', function() {
            var components = booknav.componentizeFileName("foo/bar/baz/xyzzy.html");
            // console.log(util.inspect(components));
            
            assert.equal(4, components.length);
            assert.equal("dir", components[0].type);
            assert.equal("foo", components[0].component);
            assert.equal(0, components[0].entries.length);
            
            assert.equal("dir", components[1].type);
            assert.equal("bar", components[1].component);
            assert.equal(0, components[1].entries.length);
            
            assert.equal("dir", components[2].type);
            assert.equal("baz", components[2].component);
            assert.equal(0, components[2].entries.length);
            
            assert.equal("file", components[3].type);
            assert.equal("xyzzy.html", components[3].component);
        });
        it('four components leading slash', function() {
            var components = booknav.componentizeFileName("foo/bar/baz/xyzzy.html");
            // console.log(util.inspect(components));
            
            assert.equal(4, components.length);
            assert.equal("dir", components[0].type);
            assert.equal("foo", components[0].component);
            assert.equal(0, components[0].entries.length);
            
            assert.equal("dir", components[1].type);
            assert.equal("bar", components[1].component);
            assert.equal(0, components[1].entries.length);
            
            assert.equal("dir", components[2].type);
            assert.equal("baz", components[2].component);
            assert.equal(0, components[2].entries.length);
            
            assert.equal("file", components[3].type);
            assert.equal("xyzzy.html", components[3].component);
        });
    });
});
*/


describe("Finish up", function() {
    it('should close the configuration', async function() {
        this.timeout(75000);
        await akasha.closeCaches();
    });
});
