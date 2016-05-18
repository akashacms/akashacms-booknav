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
const globfs   = require('globfs');
const akasha   = require('../akasharender');

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
            var amatches = a.path.match(indexre);
            var bmatches = b.path.match(indexre);
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
            if (a.path < b.path) return -1;
            else if (a.path === b.path) return 0;
            else return 1;
        });
        akasha.cache.set("booknav", "bookDocs-"+docDirPath, results);
        return results;
    });
};

/**
 * Used by makeBookTree to convert a pathname to an array like this:
 *
 * [ { type: 'dir', component: 'foo', entries: [] },
 *   { type: 'dir', component: 'bar', entries: [] },
 *   { type: 'dir', component: 'bas', entries: [] },
 *   { type: 'dir', component: 'baz', entries: [] },
 *   { type: 'file', component: 'xyzzy.html' } ]
 *
 */
var componentizeFileName = module.exports.componentizeFileName = function(filename) {
	var ret = [];
	ret.push({ type: 'file', component: path.basename(filename) });
	for (filename = path.dirname(filename); filename != '.' && filename != '/'; filename = path.dirname(filename)) {
		ret.unshift({ type: 'dir', component: path.basename(filename), entries: [] });
	}
	return ret;
};

/**
 *
 *
 *
    {
        type: "root",
        title: "copied from index.html",
        teaser: "copied from index.html",
        name: undefined,
        entries: [
            // Made up of entries of one of these two types
            {
                type: "file",
                title: "copied from metadata",
                teaser: "copied from metadata",
                name: "file name .ext",
                document: see object created in findBookDocs,
            },
            {
                type: "dir",
                title: "copied from metadata of index.html",
                teaser: "copied from metadata of index.html",
                name: "directory name",
                entries: [
                    // repeat 
                ]
            }
        ]
    }
 *
 */
var makeBookTree = function(config, docDirPath) {
	
	// log(`makeBookTree TOP ${docDirPath}`);
	
    var bookTreeRoot = {
        type: "root",
        entries: []
    };
	
	var findComponentEntry = function(treeEntry, component) {
		for (var i = 0; i < treeEntry.entries.length; i++) {
			var entry = treeEntry.entries[i];
			if (entry && entry.name === component.component) {
				return entry;
            }
        }
		return undefined;
	};
    
    return findBookDocs(config, docDirPath)
    .then(bookdocs => {
		
		// log(`makeBookTree ${util.inspect(bookdocs)}`);
        
        // split the path into components
        // for each directory component ensure it has an object in the tree
        // at the file portion of the name, add its data to the appropriate object in the tree
        // bookdocs already has full metadata
        
        for (let docidx in bookdocs) {
            
			let doc = bookdocs[docidx];
			// log(`makeBookTree ${util.inspect(doc)}`);
		
            let curDirInTree = bookTreeRoot;
			let components = componentizeFileName(doc.path);
			// log(`makeBookTree components ${doc.path} ${util.inspect(components)}`);
			
			/*
			 *
			 * [ { type: 'dir', component: 'foo', entries: [] },
			 *   { type: 'dir', component: 'bar', entries: [] },
			 *   { type: 'dir', component: 'bas', entries: [] },
			 *   { type: 'dir', component: 'baz', entries: [] },
			 *   { type: 'file', component: 'xyzzy.html' } ]
			 *
			 */
            for (let i = 0; i <  components.length; i++) {
                let component = components[i];
				if (component.type === 'file') {
					let entry = findComponentEntry(curDirInTree, component);
					if (!entry) {
						curDirInTree.entries.push({
							type: "file",
							name: component.component,
							path: doc.path,
							filepath: doc.filepath,
							filename: doc.filename,
							teaser: doc.metadata.teaser,
							title: doc.metadata.title,
							document: doc
						});
					}
                } else if (component.type === 'dir') {
					let entry = findComponentEntry(curDirInTree, component);
					if (!entry) {
						entry = {
                            type: "dir",
                            name: component.component,
                            entries: []
                        };
						entry.path = (curDirInTree.path)
								? path.join(curDirInTree.path, component.component)
							 	: component.component;
                        curDirInTree.entries.push(entry);
                    }
					curDirInTree = entry;
                } else {
					// ERROR
				}
            }
        }
        
        return bookTreeRoot;
    })
	.then(bookTree => {

		// log(`makeBookTree fixTree ${util.inspect(bookTree)}`);
		
		var fixTreeSegment = function(segment) {
			segment.entries.sort((a,b) => {
				if (a.name < b.name) return -1;
				else if (a.name === b.name) return 0;
				else return 1;
			});
			if (segment.type === "root" || segment.type === "dir") {
				for (let entryidx in segment.entries) {
					let entry = segment.entries[entryidx];
					if (entry.filename === "index.html") {
						segment.path = path.join(segment.path, 'index.html');
						segment.title = entry.document.metadata.title;
						if (entry.document.metadata.teaser) {
							segment.teaser = entry.document.metadata.teaser;
						}
					}
				}
			}
			// log(`makeBookTree fixed segment ${util.inspect(segment)}`);
			for (let entryidx in segment.entries) {
				let entry = segment.entries[entryidx];
				if (entry.type === "dir") {
					fixTreeSegment(entry);
				}
			}
		};
		
		// Sort the entries in the whole tree by their file name
		fixTreeSegment(bookTree);
		
		return bookTree;
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
            
            makeBookTree(metadata.config, docDirPath)
            .then(bookTree => {
				// log(`book-child-tree ${util.inspect(bookTree)}`);
                
                // These are two local functions used during rendering of the tree
                var urlForDoc = function(doc) {
                    return '/'+ doc.filepath;
                };
                var urlForDir = function(dir) {
					// log(`urlForDir ${util.inspect(dir)}`);
                    if (!dir.path) {
                        return "undefined";
                    } else {
                        return '/'+ dir.path;
                    }
                };
				
                var renderSubTree = function(dir) {
					// log(`renderSubTree ${util.inspect(dir)}`);
                    return akasha.partialSync(metadata.config, template ? template : "booknav-child-tree.html.ejs", {
                        tree: dir,
                        urlForDoc, urlForDir, renderSubTree
                    });
                };
                
                // util.log(util.inspect(childTree));
                
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
			if (err) done(err);
			else done();
		});
    },
    
];
