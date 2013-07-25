/**
 *
 * Copyright 2013 David Herron
 * 
 * This file is part of AkashaCMS-booknav (http://akashacms.com/).
 *
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

var akasha   = require('akashacms');
var path     = require('path');
var util     = require('util');

/**
 * Add ourselves to the config data.
 **/
module.exports.config = function(config) {
    config.root_partials.push(path.join(__dirname, 'partials'));
    config.funcs.siblings = function(arg, callback) {
        var siblings = akasha.findSiblings(config, arg.fileName);
        siblings.sort(function(a, b) {
            var bnavWeightA = a.frontmatter.hasOwnProperty("booknav-weight")
                    ? a.frontmatter["booknav-weight"] : undefined;
            var bnavWeightB = b.frontmatter.hasOwnProperty("booknav-weight")
                    ? b.frontmatter["booknav-weight"] : undefined;
            if (bnavWeightA && bnavWeightB) {
                if (bnavWeightA < bnavWeightB) return -1;
                else if (bnavWeightA === bnavWeightB) return 0;
                else return 1;
            } else {
                var bnavTitleA = a.frontmatter.title;
                var bnavTitleB = b.frontmatter.title;
                if (bnavTitleA < bnavTitleB) return -1;
                else if (bnavTitleA === bnavTitleB) return 0;
                else return 1;
            }
        });
        for (var i = 0, len = siblings.length; i < len; ++i) {
            siblings[i].urlForFile = akasha.urlForFile(siblings[i].path);
        }
        // XXX there needs to be frontmatter for prev/next, could we use that
        //    to sort the siblings?
        var val = akasha.partialSync(config, "booknav-siblings.html.ejs", {
            siblings: siblings
        });
        if (callback) callback(undefined, val);
        return val;
    }
    config.funcs.prevNextBar = function(arg, callback) {
        var entry = akasha.getFileEntry(config.root_docs, arg.fileName);
        var bnavPrev = entry.frontmatter.hasOwnProperty("booknav-prev")
            ? akasha.getFileEntry(config.root_docs, entry.frontmatter["booknav-prev"])
            : undefined;
        var bnavNext = entry.frontmatter.hasOwnProperty("booknav-next")
            ? akasha.getFileEntry(config.root_docs, entry.frontmatter["booknav-next"])
            : undefined;
        if (bnavPrev) bnavPrev.urlForFile = akasha.urlForFile(bnavPrev.path);
        if (bnavNext) bnavNext.urlForFile = akasha.urlForFile(bnavNext.path);
        var val = akasha.partialSync(config, "booknav-prevnext.html.ejs", {
            prevURL:   bnavPrev ? bnavPrev.urlForFile        : undefined,
            prevTITLE: bnavPrev ? bnavPrev.frontmatter.title : undefined,
            nextURL:   bnavNext ? bnavNext.urlForFile        : undefined,
            nextTITLE: bnavNext ? bnavNext.frontmatter.title : undefined
        });
        if (callback) callback(undefined, val);
        return val;
    }
}
