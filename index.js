/**
 *
 * Copyright 2013-2015 David Herron
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

'use strict';

const path     = require('path');
const util     = require('util');
const async    = require('async');
// const globfs   = require('globfs');
const akasha   = require('akasharender');

const log   = require('debug')('akasha:booknav-plugin');
const error = require('debug')('akasha:error-booknav-plugin');

module.exports = class BooknavPlugin extends akasha.Plugin {
	constructor() {
		super("akashacms-booknav");
	}

	configure(config) {
        this._config = config;
		config.addPartialsDir(path.join(__dirname, 'partials'));
		config.addMahabhuta(module.exports.mahabhuta);
	}

}

/*
var getPrevFileName = function(entry) {
    if (entry && entry.hasOwnProperty('frontmatter')
        && entry.frontmatter.hasOwnProperty("yaml")
        && entry.frontmatter.yaml.hasOwnProperty("booknav-prev"))
        return entry.frontmatter.yaml["booknav-prev"];
    else
        return undefined;
};
var getNextFileName = function(entry) {
    if (entry && entry.hasOwnProperty('frontmatter')
        && entry.frontmatter.hasOwnProperty("yaml")
        && entry.frontmatter.yaml.hasOwnProperty("booknav-next"))
        return entry.frontmatter.yaml["booknav-next"];
    else
        return undefined;
};
var getUpFileName = function(entry) {
    if (entry && entry.hasOwnProperty('frontmatter')
        && entry.frontmatter.hasOwnProperty("yaml")
        && entry.frontmatter.yaml.hasOwnProperty("booknav-up"))
        return entry.frontmatter.yaml["booknav-up"];
    else
        return undefined;
};

var findDirInEntryList = function(entryList, cmp) {
    for (var ch = 0; ch < entryList.length; ch++) {
        if (entryList[ch].type === 'dir' && entryList[ch].name === cmp) {
            return entryList[ch];
        }
    }
    return undefined;
};
*/

var findBookDocs = function(config, docDirPath) {

    var cachedBookDocs = akasha.cache.get("booknav", "bookDocs-"+docDirPath);
    if (cachedBookDocs) {
        return Promise.resolve(cachedBookDocs);
    }

    return akasha.documentSearch(config, {
        rootPath: docDirPath,
        renderers: [ akasha.HTMLRenderer ]
    })
    .then(results => {
		// log(`findBookDocs ${util.inspect(results)}`);
        results.sort((a,b) => {
            var indexre = /^(.*)\/([^\/]+\.html)$/;
            var amatches = a.renderpath.match(indexre);
            var bmatches = b.renderpath.match(indexre);
            if (!amatches)
                return -1;
            else if (!bmatches)
                return 1;
            if (amatches[1] === bmatches[1]) {
                if (amatches[2] === "index.html") {
                    return -1;
                } else if (bmatches[2] === "index.html") {
                    return 1;
                } else if (amatches[2] < bmatches[2]) {
                    return -1;
                } else if (amatches[2] === bmatches[2]) {
                    return 0;
                } else return 1;
            }
            if (a.renderpath < b.renderpath) return -1;
            else if (a.renderpath === b.renderpath) return 0;
            else return 1;
        });
        akasha.cache.set("booknav", "bookDocs-"+docDirPath, results);
        return results;
    });
};

module.exports.mahabhuta = [
	function($, metadata, dirty, done) {
		if ($('book-next-prev').get(0)) {
			log('book-next-prev');
            var bookRoot = $('book-next-prev').attr('book-root');
            if (bookRoot && bookRoot.charAt(0) === '/') {
                bookRoot = bookRoot.substring(1);
            }
            bookRoot = path.dirname(bookRoot);
            findBookDocs(metadata.config, bookRoot)
            .then(bookdocs => {
                // util.log(util.inspect(bookDocs));
                // what's the current document
                // find it within documents
                var docIndex = -1;
                for (var j = 0; bookdocs && j < bookdocs.length; j++) {
                    // util.log('looking for '+ docEntry.path +' === '+ bookDocs[j].path);
                    if (bookdocs[j].path === metadata.document.path) {
                        docIndex = j;
                    }
                }
                if (docIndex >= 0) {
                    var prevDoc = docIndex === 0
                                ? bookdocs[bookdocs.length - 1]
                                : bookdocs[docIndex - 1];
                    var nextDoc = docIndex === bookdocs.length - 1
                                ? bookdocs[0]
                                : bookdocs[docIndex + 1];
                    akasha.partial(metadata.config, 'booknav-next-prev.html.ejs', {
                        prevDoc, nextDoc // , thisDoc: docEntry, documents: bookDocs
                    })
                    .then(html => {
                        $('book-next-prev').replaceWith(html);
                        done();
                    })
                    .catch(err => { done(err); });
                } else {
                    done(new Error('did not find document in book'));
                }
            })
			.catch(err => {
                error('book-next-prev '+ metadata.document.path +' Errored with '+ (err.stack ? err.stack : err));
                done('book-next-prev '+ metadata.document.path +' Errored with '+ (err.stack ? err.stack : err));
				done(err);
			});
		} else done();
	},

	function($, metadata, dirty, done) {
		var elements = [];
		$('book-child-tree').each(function(i, elem) { elements.push(elem); });
        if (elements.length <= 0) return done();
		log('book-child-tree');
		async.eachSeries(elements,
        (element, next) => {
			// logger.info(element.name);

			var template = $(element).attr('template');

			var docDirPath = path.dirname(metadata.document.path);
			if (docDirPath.startsWith('/')) docDirPath = docDirPath.substring(1);

			// log(`book-child-tree ${metadata.document.path} ==> ${docDirPath}`);

			findBookDocs(metadata.config, docDirPath)
			.then(bookdocs => {
				if (!bookdocs) throw new Error("Did not find bookdocs for "+ docDirPath);
				return akasha.documentTree(metadata.config, bookdocs);
			})
            .then(bookTree => {
				// log(`book-child-tree ${util.inspect(bookTree)}`);

                // These are two local functions used during rendering of the tree
                var urlForDoc = function(doc) {
                    return '/'+ doc.renderpath;
                };
                var urlForDir = function(dir) {
					log('urlForDir '+ util.inspect(dir));
                    if (!dir.dirpath) {
                        return "undefined";
                    } else {
                        return '/'+ dir.dirpath;
                    }
                };

                var renderSubTree = function(dir) {
					// log('renderSubTree '+ util.inspect(dir));
                    return akasha.partialSync(metadata.config, template ? template : "booknav-child-tree.html.ejs", {
                        tree: dir,
                        urlForDoc, urlForDir, renderSubTree
                    });
                };

                log('book-child-tree bookTree '+ util.inspect(bookTree));

                // Rendering of the tree starts here, and recursively uses the above
                // two functions to render sub-portions of the tree
				// log(`renderTree ${util.inspect(bookTree)}`);
                akasha.partial(metadata.config, template ? template : "booknav-child-tree.html.ejs", {
                    tree: bookTree,
                    urlForDoc, urlForDir, renderSubTree
                })
                .then(treeHtml => {
                    // util.log('rendered booknav '+ treeHtml);
                    $(element).replaceWith(treeHtml);
                    // util.log($.html());
                    next();
                })
                .catch(err => { next(err); });
            })
            .catch(err => { next(err); });
        },
        err => {
		    // util.log('FINI book-child-tree '+ $.html());
			if (err) {
                error('book-child-tree '+ metadata.document.path +' Errored with '+ (err.stack ? err.stack : err));
                done('book-child-tree '+ metadata.document.path +' Errored with '+ (err.stack ? err.stack : err));
			} else done();
		});
    },

];
