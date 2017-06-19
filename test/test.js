'use strict';

const assert = require('chai').assert;
const booknav = require('../index');
const util = require('util');

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
