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

var path     = require('path');
var util     = require('util');
var async    = require('async');

var akasha;
var config;
var logger;

var getPrevFileName = function(entry) {
    if (entry && entry.hasOwnProperty('frontmatter')
        && entry.frontmatter.hasOwnProperty("yaml")
        && entry.frontmatter.yaml.hasOwnProperty("booknav-prev"))
        return entry.frontmatter.yaml["booknav-prev"];
    else
        return undefined;
}
var getNextFileName = function(entry) {
    if (entry && entry.hasOwnProperty('frontmatter')
        && entry.frontmatter.hasOwnProperty("yaml")
        && entry.frontmatter.yaml.hasOwnProperty("booknav-next"))
        return entry.frontmatter.yaml["booknav-next"];
    else
        return undefined;
}
var getUpFileName = function(entry) {
    if (entry && entry.hasOwnProperty('frontmatter')
        && entry.frontmatter.hasOwnProperty("yaml")
        && entry.frontmatter.yaml.hasOwnProperty("booknav-up"))
        return entry.frontmatter.yaml["booknav-up"];
    else
        return undefined;
}

var findDirInEntryList = function(entryList, cmp) {
    for (var ch = 0; ch < entryList.length; ch++) {
        if (entryList[ch].type === 'dir' && entryList[ch].name === cmp) {
            return entryList[ch];
        }
    }
    return undefined;
}

/**
 * Add ourselves to the config data.
 **/
module.exports.config = function(_akasha, _config) {
	akasha = _akasha;
	config = _config;
    config.root_partials.push(path.join(__dirname, 'partials'));

    logger = akasha.getLogger("booknav");

    /* config.funcs.prevNextBar = function(arg, callback) {
		throw new Error("Called booknav.prevNextBar");
        var entry = akasha.getFileEntry(config.root_docs, arg.documentPath);
        var bnavUpFN   = getUpFileName(entry);
        var bnavPrevFN = getPrevFileName(entry);
        var bnavNextFN = getNextFileName(entry);
        var bnavUp   = bnavUpFN   ? akasha.getFileEntry(config.root_docs, bnavUpFN)   : undefined;
        var bnavPrev = bnavPrevFN ? akasha.getFileEntry(config.root_docs, bnavPrevFN) : undefined;
        var bnavNext = bnavNextFN ? akasha.getFileEntry(config.root_docs, bnavNextFN) : undefined;
        if (bnavUp)   bnavUp.urlForFile   = akasha.urlForFile(bnavUp.path);
        if (bnavPrev) bnavPrev.urlForFile = akasha.urlForFile(bnavPrev.path);
        if (bnavNext) bnavNext.urlForFile = akasha.urlForFile(bnavNext.path);
        var val = akasha.partialSync("booknav-prevnext.html.ejs", {
            upURL:     bnavUp   ? bnavUp.urlForFile          : undefined,
            prevURL:   bnavPrev ? bnavPrev.urlForFile        : undefined,
            prevTITLE: bnavPrev ? bnavPrev.frontmatter.yaml.title : undefined,
            nextURL:   bnavNext ? bnavNext.urlForFile        : undefined,
            nextTITLE: bnavNext ? bnavNext.frontmatter.yaml.title : undefined
        });
        if (callback) callback(undefined, val);
        return val;
    }; */
	return module.exports;
};

var findBookDocs = function(config, docDirPath) {
	var documents = akasha.findMatchingDocuments(config, {
		path: new RegExp('^'+ docDirPath +'/')
	});

	documents.sort(function(a, b) {
		var indexre = /^(.*)\/([^\/]+\.html)$/;
		var amatches = a.renderedFileName.match(indexre);
		var bmatches = b.renderedFileName.match(indexre);
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
	
	return documents;
};

module.exports.mahabhuta = [
	function($, metadata, dirty, done) {
		if ($('book-next-prev').get(0)) {
			logger.trace('book-next-prev');
			akasha.readDocumentEntry(config, metadata.documentPath, function(err, docEntry) {
				if (err) done(err);
				else {
					var bookRoot = $('book-next-prev').attr('book-root');
					if (bookRoot && bookRoot.charAt(0) === '/') {
						bookRoot = bookRoot.substring(1);
					}
					bookRoot = path.dirname(bookRoot);
					var bookDocs = findBookDocs(config, bookRoot);
					// util.log(util.inspect(bookDocs));
					// what's the current document
					// find it within documents
					var docIndex = -1;
					for (var j = 0; bookDocs && j < bookDocs.length; j++) {
						util.log('looking for '+ docEntry.path +' === '+ bookDocs[j].path);
						if (bookDocs[j].path === docEntry.path) {
							docIndex = j;
						}
					}
					if (docIndex >= 0) {
						var prevDoc = docIndex === 0 ? bookDocs[bookDocs.length - 1] : bookDocs[docIndex - 1];
						var nextDoc = docIndex === bookDocs.length - 1 ? bookDocs[0] : bookDocs[docIndex + 1];
						akasha.partial('booknav-next-prev.html.ejs', {
							prevDoc: prevDoc, nextDoc: nextDoc, thisDoc: docEntry, documents: bookDocs
						}, function(err, html) {
							if (err) done(err);
							else {
								$('book-next-prev').replaceWith(html);
								done();	
							}
						});
					} else {
						done(new Error('did not find document in book'));
					}
				}
			});
		} else done();
	},
	
	function($, metadata, dirty, done) {
		var elements = [];
		logger.trace('book-child-tree');
		$('book-child-tree').each(function(i, elem) { elements.push(elem); });
		async.eachSeries(elements, function(element, next) {
			// logger.info(element.name);
			
			var template = $(element).attr('template');
			var bookRoot = $(element).attr('book-root');
			if (bookRoot && bookRoot.charAt(0) === '/') {
				bookRoot = bookRoot.substring(1);
			}
			var docDirPath = path.dirname(bookRoot ? bookRoot : metadata.documentPath);
			
			// util.log('bookChildTree documentPath='+ metadata.documentPath +' docDirPath='+ docDirPath);
			var childTree = [];
			akasha.eachDocument(config, function(entry) {
				var docPath = entry.path;
				// util.log(entry.type +' docDirPath='+docDirPath +' docPath='+docPath +' '+ entry.fullpath);
				if (akasha.supportedForHtml(docPath) && (docPath.indexOf(docDirPath) === 0 || docDirPath === '.')) {
					
					var documentPath = docDirPath !== '.' ? docPath.substring(docDirPath.length + 1) : docPath;
					// util.log('documentPath='+documentPath);
					if (documentPath.indexOf('/') >= 0) {
						var components = documentPath.split('/');
						// util.log(util.inspect(components));
						var entryList = childTree;
						var dirEntry = undefined;
						for (var i = 0; i < components.length; i++) {
							var cmp = components[i];
							if (i === (components.length - 1)) {
								// The last component is going to be the file name
								// util.log('pushing '+ entry.path +' to dirEntry '+ util.inspect(dirEntry));
								if (akasha.isIndexHtml(entry.path)) {
									dirEntry.title = entry.frontmatter.yaml.title
												   ? entry.frontmatter.yaml.title
												   : undefined;
									dirEntry.path = entry.path;
									dirEntry.teaser = entry.frontmatter.yaml.teaser
													? entry.frontmatter.yaml.teaser
													: undefined;
								} else if (akasha.supportedForHtml(entry.path)) {
									dirEntry.entries.push({
										type: 'doc',
										path: entry.path,
										name: cmp,
										title: entry.frontmatter.yaml.title
											  ? entry.frontmatter.yaml.title
											  : undefined,
										teaser: entry.frontmatter.yaml.teaser
											  ? entry.frontmatter.yaml.teaser
											  : undefined,
										entry: entry,
										youtubeThumbnail: entry.frontmatter.yaml.youtubeThumbnail
											   ? entry.frontmatter.yaml.youtubeThumbnail
											   : undefined,
										videoThumbnail: entry.frontmatter.yaml.videoThumbnail
											   ? entry.frontmatter.yaml.videoThumbnail
											   : undefined
									});
								}
							} else {
								// Every other component is an intermediate directory name
								var de = findDirInEntryList(entryList, cmp);
								if (de) {
									dirEntry = de;
									entryList = dirEntry.entries;
								} else {
									dirEntry = {
										type: 'dir',
										name: cmp,
										entries: []
									};
									entryList.push(dirEntry);
									entryList = dirEntry.entries;
								}
							}
						}
					} else {
						if (!akasha.isIndexHtml(entry.path)) {
							childTree.push({
								type: 'doc',
								path: entry.path,
								name: entry.path,
								title: entry.frontmatter.yaml.title
									  ? entry.frontmatter.yaml.title
									  : undefined,
								teaser: entry.frontmatter.yaml.teaser
									  ? entry.frontmatter.yaml.teaser
									  : undefined,
								entry: entry,
								videoThumbnail: entry.frontmatter.yaml.videoThumbnail
									   ? entry.frontmatter.yaml.videoThumbnail
									   : undefined
							});
						}
					}
				}
			});
			
			/* * / util.log(util.inspect(childTree)); 
			/* var dumpTree = function(tree) {
				for (var i in tree) {
					util.log(util.inspect(tree[i]));
					if (tree[i].type === 'dir') {
						dumpTree(tree[i].entries);
					}
				}
			}
			dumpTree(childTree); /* */
			
			for (var i = 0; i < childTree.length; i++) {
				var entry = childTree[i];
				if (i.type === 'dir') {
					entry.entries.sort(function(a, b) {
						if (a.path < b.path) return -1;
						else if (a.path === b.path) return 0;
						else return 1;
					});
				}
			}
			
			// These are two local functions used during rendering of the tree
			var urlForDoc = function(doc) {
				return akasha.urlForFile(doc.path);
			};
			var urlForDir = function(dir) {
				if (!dir.path) {
					return "undefined";
				} else {
					return akasha.urlForFile(dir.path);
				}
			};
			var nameForDir = function(dir) {
				return dir.title;
			};
			
			var renderSubTree = function(dir) {
				return akasha.partialSync(template ? template : "booknav-child-tree.html.ejs", {
					tree: dir.entries,
					urlForDoc: urlForDoc,
					urlForDir: urlForDir,
					nameForDir: nameForDir,
					renderSubTree: renderSubTree
				});
			};
			
			// util.log(util.inspect(childTree));
			
			// Rendering of the tree starts here, and recursively uses the above
			// two functions to render sub-portions of the tree
			akasha.partial(template ? template : "booknav-child-tree.html.ejs", {
				tree: childTree,
				urlForDoc: urlForDoc,
				urlForDir: urlForDir,
				nameForDir: nameForDir,
				renderSubTree: renderSubTree
			},
			function(err, treeHtml) {
				if (err) next(err);
				else {
					$(element).replaceWith(treeHtml);
					next();
				}
			});
		
			/*akasha.eachDocument - selecting out any that are siblings or children of the current document
			sort that list by file name
			
			for any with a slash ....
				remove from list into a separate list
				split the pathname on slashes
			special kind of entry in document array for child directories
			add these entries into appropriate places
			
			[
				file {path },
				file {path},
				dir { path element, [
						file {path},
						file {path},
						dir { path element, [
							file {path}, ...
						]}
					] }
				dir { path element, [
					file {path}, ...
				]}
			]*/
			
		}, function(err) {
			if (err) done(err);
			else done();
		});
	}
];
