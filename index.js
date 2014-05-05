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

var getPrevFileName = function(entry) {
    if (entry && entry.hasOwnProperty('frontmatter')
        && entry.frontmatter.hasOwnProperty("booknav-prev"))
        return entry.frontmatter["booknav-prev"];
    else
        return undefined;
}
var getNextFileName = function(entry) {
    if (entry && entry.hasOwnProperty('frontmatter')
        && entry.frontmatter.hasOwnProperty("booknav-next"))
        return entry.frontmatter["booknav-next"];
    else
        return undefined;
}
var getUpFileName = function(entry) {
    if (entry && entry.hasOwnProperty('frontmatter')
        && entry.frontmatter.hasOwnProperty("booknav-up"))
        return entry.frontmatter["booknav-up"];
    else
        return undefined;
}


var gatherBookTree = function(akasha, config, documentPath) {
    var tree = [];
    var thisEntry = akasha.readDocumentEntry(config, documentPath);
    var prevEntry = undefined;
    for (var prevFN = getPrevFileName(thisEntry);
         prevFN;
         prevFN = getPrevFileName(prevEntry)) {
        prevEntry = akasha.readDocumentEntry(config, prevFN);
        if (prevEntry) tree.unshift(prevEntry);
    }
    tree.push(thisEntry);
    var nextEntry = undefined;
    for (var nextFN = getNextFileName(thisEntry);
         nextFN;
         nextFN = getNextFileName(nextEntry)) {
        nextEntry = akasha.readDocumentEntry(config, nextFN);
        if (nextEntry) tree.push(nextEntry);
    }
    // TBD for each tree entry
    //       akasha.eachDocument
    //          if document getUpFileName === thisEntry
    //                gatherBookTree(document)
    //                thisEntry.bookNavChildren
    return tree;
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
module.exports.config = function(akasha, config) {
    config.root_partials.push(path.join(__dirname, 'partials'));
    
    config.funcs.bookTreeNav = function(arg, callback) {
        var tree = gatherBookTree(akasha, config, arg.documentPath);
        var val = akasha.partialSync(config, "booknav-tree-nav.html.ejs", {
            tree: tree
        });
        if (callback) callback(undefined, val);
        return val;
    }
    
    config.funcs.bookChildTree = function(arg, callback) {
        if (!arg.template) {
            arg.template = "booknav-tree-nav2.html.ejs";
        }
        var docDirPath = path.dirname(arg.documentPath);
        // util.log('bookChildTree documentPath='+ arg.documentPath +' docDirPath='+ docDirPath);
        var childTree = [];
        akasha.eachDocument(config, function(entry) {
            var docPath = entry.path;
            // util.log('docPath='+docPath);
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
                                dirEntry.title = entry.frontmatter.title;
                                dirEntry.path = entry.path;
                                dirEntry.teaser = entry.frontmatter.teaser ? entry.frontmatter.teaser : undefined;
                            } else if (akasha.supportedForHtml(entry.path)) {
                                dirEntry.entries.push({
                                    type: 'doc',
                                    path: entry.path,
                                    name: cmp,
                                    title: entry.frontmatter.title,
                                    teaser: entry.frontmatter.teaser ? entry.frontmatter.teaser : undefined,
                                    entry: entry
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
                            title: entry.frontmatter.title,
                            teaser: entry.frontmatter.teaser ? entry.frontmatter.teaser : undefined,
                            entry: entry
                        });
                    }
                }
            }
        });
        
        /* util.log(util.inspect(childTree));
        var dumpTree = function(tree) {
            for (var i in tree) {
                util.log(util.inspect(tree[i]));
                if (tree[i].type === 'dir') {
                    dumpTree(tree[i].entries);
                }
            }
        }
        dumpTree(childTree); */
        
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
            return akasha.partialSync(config, arg.template, {
                tree: dir.entries,
                urlForDoc: urlForDoc,
                urlForDir: urlForDir,
                nameForDir: nameForDir,
                renderSubTree: renderSubTree
            });
        };
        
        
        // Rendering of the tree starts here, and recursively uses the above
        // two functions to render sub-portions of the tree
        var val = akasha.partialSync(config, arg.template, {
            tree: childTree,
            urlForDoc: urlForDoc,
            urlForDir: urlForDir,
            nameForDir: nameForDir,
            renderSubTree: renderSubTree
        });
        // util.log('rendered as ' + val);
        if (callback) callback(undefined, val);
        return val;
    
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
    }
    
    config.funcs.bookChildTreeBootstrap = function(arg, callback) {
        arg.template = "booknav-tree-nav2-bootstrap.html.ejs";
        return config.funcs.bookChildTree(arg, callback);
    }
        
    config.funcs.prevNextBar = function(arg, callback) {
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
        var val = akasha.partialSync(config, "booknav-prevnext.html.ejs", {
            upURL:     bnavUp   ? bnavUp.urlForFile          : undefined,
            prevURL:   bnavPrev ? bnavPrev.urlForFile        : undefined,
            prevTITLE: bnavPrev ? bnavPrev.frontmatter.title : undefined,
            nextURL:   bnavNext ? bnavNext.urlForFile        : undefined,
            nextTITLE: bnavNext ? bnavNext.frontmatter.title : undefined
        });
        if (callback) callback(undefined, val);
        return val;
    }
}
