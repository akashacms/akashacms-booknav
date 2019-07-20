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

const fs       = require('fs-extra');
const path     = require('path');
const util     = require('util');
const akasha   = require('akasharender');
const mahabhuta = akasha.mahabhuta;

const pluginName = "akashacms-booknav";

const _plugin_config = Symbol('config');
const _plugin_options = Symbol('options');

module.exports = class BooknavPlugin extends akasha.Plugin {
	constructor() {
		super(pluginName);
	}

    configure(config, options) {
        this[_plugin_config] = config;
        this[_plugin_options] = options;
        options.config = config;
		config.addPartialsDir(path.join(__dirname, 'partials'));
        config.addMahabhuta(module.exports.mahabhutaArray(options));
	}

    get config() { return this[_plugin_config]; }
    get options() { return this[_plugin_options]; }

}

module.exports.mahabhutaArray = function(options) {
    let ret = new mahabhuta.MahafuncArray(pluginName, options);
    ret.addMahafunc(new NextPrevElement());
    ret.addMahafunc(new ChildTreeElement());
    return ret;
};

var findBookDocs = async function(config, docDirPath) {

    var cachedBookDocs = akasha.cache.get("booknav", "bookDocs-"+docDirPath);
    if (cachedBookDocs) {
        return cachedBookDocs;
    }

    let results = await akasha.documentSearch(config, {
        rootPath: docDirPath,
        renderers: [ akasha.HTMLRenderer ]
    });
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
};


class NextPrevElement extends mahabhuta.CustomElement {
    get elementName() { return "book-next-prev"; }
    async process($element, metadata, dirty) {
        var bookRoot = $element.attr('book-root');
        if (bookRoot && bookRoot.charAt(0) === '/') {
            bookRoot = bookRoot.substring(1);
        }
        bookRoot = path.dirname(bookRoot);
        let bookdocs = await findBookDocs(this.array.options.config, bookRoot);
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
            return akasha.partial(this.array.options.config, 'booknav-next-prev.html.ejs', {
                prevDoc, nextDoc // , thisDoc: docEntry, documents: bookDocs
            });
        } else {
            throw new Error(`did not find document in book ${metadata.document.path}`);
        }
    }
}

class ChildTreeElement extends mahabhuta.CustomElement {
    get elementName() { return "book-child-tree"; }
    async process($element, metadata, dirty) {
        var template = $element.attr('template');

        var docDirPath = path.dirname(metadata.document.path);
        if (docDirPath.startsWith('/')) docDirPath = docDirPath.substring(1);
        let bookdocs = await findBookDocs(this.array.options.config, docDirPath);
        if (!bookdocs) throw new Error("Did not find bookdocs for "+ docDirPath);
        let bookTree = await akasha.documentTree(this.array.options.config, bookdocs);

        // These are two local functions used during rendering of the tree
        var urlForDoc = (doc) => {
            // console.log(`urlForDoc ${doc.renderpath}`);
            return '/'+ doc.renderpath;
        };
        var urlForDir = (dir) => {
            // console.log('urlForDir '+ util.inspect(dir));
            // console.log(`urlForDir ${dir.dirpath}`);
            if (!dir.dirpath) {
                return "undefined";
            } else {
                var p = '/'+ dir.dirpath;
                if (!fs.existsSync(p)) {
                    // console.log(`urlForDir ${p} ! exist, returning ${p}`);
                    return p;
                }
                var pStat = fs.statSync(p);
                if (pStat.isDirectory()) {
                    p = path.join(p, 'index.html');
                }
                if (fs.existsSync(p)) {
                    // console.log(`urlForDir ${p} exists returning <a> tag`);
                    return `<a href="${p}">${item.title ? item.title : p}</a>`;
                } else {
                    // console.log(`urlForDir ${p} ! exist, returning ${p}`);
                    return p;
                }

            }
        };

        var renderSubTree = (dir) => {
            // log('renderSubTree '+ util.inspect(dir));
            return akasha.partialSync(this.array.options.config, template ? template : "booknav-child-tree.html.ejs", {
                tree: dir,
                urlForDoc, urlForDir, renderSubTree
            });
        };
        
        return akasha.partial(this.array.options.config,
                template ? template : "booknav-child-tree.html.ejs", {
            tree: bookTree,
            urlForDoc, urlForDir, renderSubTree
        })
    }
}

/* 
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
				// console.log(`book-child-tree ${util.inspect(bookTree)}`);

                // These are two local functions used during rendering of the tree
                var urlForDoc = function(doc) {
                    // console.log(`urlForDoc ${doc.renderpath}`);
                    return '/'+ doc.renderpath;
                };
                var urlForDir = function(dir) {
					// console.log('urlForDir '+ util.inspect(dir));
                    // console.log(`urlForDir ${dir.dirpath}`);
                    if (!dir.dirpath) {
                        return "undefined";
                    } else {
                        var p = '/'+ dir.dirpath;
                        if (!fs.existsSync(p)) {
                            // console.log(`urlForDir ${p} ! exist, returning ${p}`);
                            return p;
                        }
                        var pStat = fs.statSync(p);
                        if (pStat.isDirectory()) {
                            p = path.join(p, 'index.html');
                        }
                        if (fs.existsSync(p)) {
                            // console.log(`urlForDir ${p} exists returning <a> tag`);
                            return `<a href="${p}">${item.title ? item.title : p}</a>`;
                        } else {
                            // console.log(`urlForDir ${p} ! exist, returning ${p}`);
                            return p;
                        }

                    }
                };

                var renderSubTree = function(dir) {
					// log('renderSubTree '+ util.inspect(dir));
                    return akasha.partialSync(metadata.config, template ? template : "booknav-child-tree.html.ejs", {
                        tree: dir,
                        urlForDoc, urlForDir, renderSubTree
                    });
                };

                // console.log('book-child-tree bookTree '+ util.inspect(bookTree));

                // Rendering of the tree starts here, and recursively uses the above
                // two functions to render sub-portions of the tree
				// log(`renderTree ${util.inspect(bookTree)}`);
                akasha.partial(metadata.config, template ? template : "booknav-child-tree.html.ejs", {
                    tree: bookTree,
                    urlForDoc, urlForDir, renderSubTree
                })
                .then(treeHtml => {
                    // console.log(`render booknav ${treeHtml}`);
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
*/