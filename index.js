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

const pluginName = "@akashacms/plugins-booknav";

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

async function findBookDocs(config, docDirPath) {

    // Performance testing
    // const _start = new Date();

    // console.log(`findBookDocs ${docDirPath}`);

    // Performance testing
    // console.log(`findBookDocs  after cache ${docDirPath} ${(new Date() - _start) / 1000} seconds`);

    const documents = (await akasha.filecache).documents;
    // await documents.isReady();
    // Performance testing
    // console.log(`findBookDocs  after documents ${docDirPath} ${(new Date() - _start) / 1000} seconds`);

    // console.log(`findBookDocs isReady ${docDirPath}`);
    let selector = {
        // For performance reasons, use pathmatch and renderpathmatch.
        // These are added to the Selector given to ForerunnerDB, and act
        // to decrease the result set and therefore the amount of processing
        // within the search function.

        // rootPath: docDirPath,
        renderpathmatch: /\.html$/
        // renderglob: '**/*.html',
        // renderers: [ akasha.HTMLRenderer ]
    };
    if (docDirPath && docDirPath !== '/') {
        selector.pathmatch = new RegExp(`^${docDirPath}\/`)
    }


    let results = documents.search(config, selector);
    // console.log(results);

    // Performance testing
    // console.log(`findBookDocs  after search ${docDirPath} ${(new Date() - _start) / 1000} seconds`);

    results.sort((a,b) => {
        var indexre = /^(.*)\/([^\/]+\.html)$/;
        var amatches = a.renderPath.match(indexre);
        var bmatches = b.renderPath.match(indexre);
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
        if (a.renderPath < b.renderPath) return -1;
        else if (a.renderPath === b.renderPath) return 0;
        else return 1;
    });
    // Performance testing
    // console.log(`findBookDocs  after sort ${docDirPath} ${(new Date() - _start) / 1000} seconds`);
    
    return results;
};


class NextPrevElement extends mahabhuta.CustomElement {
    get elementName() { return "book-next-prev"; }
    async process($element, metadata, dirty) {
        let bookRoot = $element.attr('book-root');
        if (bookRoot && bookRoot.charAt(0) === '/') {
            bookRoot = bookRoot.substring(1);
        }
        bookRoot = path.dirname(bookRoot);
        if (bookRoot === '.') bookRoot = '/';
        // console.log(`NextPrevElement root ${bookRoot}`);
        let bookdocs = await findBookDocs(this.array.options.config, bookRoot);
        // console.log(`NextPrevElement root ${bookRoot} ${bookdocs.length}`);
        var docIndex = -1;
        for (var j = 0; bookdocs && j < bookdocs.length; j++) {
            // console.log('looking for '+ metadata.document.path +' === '+ bookdocs[j].vpath);
            if (bookdocs[j].vpath === metadata.document.path) {
                docIndex = j;
            }
        }
        // console.log(`NexPrevElement docIndex ${docIndex}`);
        if (docIndex >= 0) {
            var prevDoc = docIndex === 0
                        ? bookdocs[bookdocs.length - 1]
                        : bookdocs[docIndex - 1];
            var nextDoc = docIndex === bookdocs.length - 1
                        ? bookdocs[0]
                        : bookdocs[docIndex + 1];
            // console.log(`NextPrevElement prevDoc `, prevDoc);
            // console.log(`NextPrevElement nextDoc `, nextDoc);
            return akasha.partial(this.array.options.config, 'booknav-next-prev.html.ejs', {
                prevDoc, nextDoc // , thisDoc: docEntry, documents: bookDocs
            });
        } else {
            throw new Error(`did not find document in book ${metadata.document.path}`);
        }
    }
}

/*
function pathdata(documents, rootPath) {
    const ret = {
        head: {
            url: undefined,
            title: undefined
        },
        items: []
    };

    for (let doc of documents) {
        let parent = path.dirname(doc.vpath);
        if (parent === '.') parent = '/';
        if (parent.indexOf('./') === 0) parent = parent.substr(2);
        // console.log(`pathdata path ${doc.path} parent ${parent} === rootPath ${rootPath}`);
        if (parent === rootPath) {
            ret.items.push({ type: 'file', doc: doc });
            // console.log(`pathdata pushed file ${doc.path} to items`);
            if (doc.renderPath.endsWith('index.html')) {
                ret.head.url = doc.renderPath;
                ret.head.title = doc.docMetadata 
                               ? doc.docMetadata.title
                               : undefined;
                // console.log(`pathdata head set to ${util.inspect(ret.head)}`);
            }
        }
        let gparent = path.dirname(path.dirname(doc.vpath));
        if (gparent === '.') gparent = '/';
        if (gparent.indexOf('./') === 0) gparent = gparent.substr(2);
        if (gparent === rootPath) {
            let childRoot = path.dirname(doc.vpath);
            if (childRoot === '.') childRoot = '/';
            if (childRoot.indexOf('./') === 0) {
                childRoot = childRoot.substr(2);
            }
            // console.log(`pathdata gparent ${gparent} === childRoot ${childRoot}`);
            let childItem;
            for (let item of ret.items) {
                if (item.type === 'dir' && item.vpath === childRoot) {
                    childItem = item;
                    break;
                }
            }
            if (!childItem) {
                // console.log(`pathdata pushed dir ${childRoot}`);
                ret.items.push({
                    type: 'dir',
                    path: childRoot
                });
            }
        }
    }

    // console.log(`pathdata ${rootPath} ${util.inspect(ret)}`);
    return ret;
}
*/

class ChildTreeElement extends mahabhuta.CustomElement {
    get elementName() { return "book-child-tree"; }
    async process($element, metadata, dirty) {

        // Performance testing
        const _start = new Date();
        const template = $element.attr('template');
        const childTemplate = $element.attr('child-template');

        const config = this.array.options.config;

        const documents = (await akasha.filecache).documents;

        let docDirPath = path.dirname(metadata.document.path);
        if (docDirPath.startsWith('/')) docDirPath = docDirPath.substring(1);
        if (docDirPath === '.') docDirPath = '/';
        const indexes = documents.indexFiles(docDirPath);

        let rootItem;
        for (let index of indexes) {
            if (index.dirname === docDirPath) {
                rootItem = index;
                break;
            }
        }
        if (!rootItem) {
            throw new Error(`Did not find root (${docDirPath}) index item in path ${metadata.document.path} indexes ${indexes.length}`);
        }

        const renderIndexItem = function(rootItem) {
            // console.log(`renderIndexItem `, rootItem);
            const siblings = documents.siblings(rootItem.vpath);
            const childItems = [];
            for (let index of indexes) {
                if (path.dirname(index.dirname) === rootItem.dirname
                 && index.vpath !== rootItem.vpath) {
                    childItems.push(index);
                }
            }
            return akasha.partialSync(config,
                template ? template : "booknav-tree-top-new.html.njk", {
                    rootItem, siblings, childItems, renderIndexItem
                });
        };

        return renderIndexItem(rootItem);
    }
}

/*
class ChildTreeElement extends mahabhuta.CustomElement {
    get elementName() { return "book-child-tree"; }
    async process($element, metadata, dirty) {
        // Performance testing
        const _start = new Date();
        const template = $element.attr('template');
        const childTemplate = $element.attr('child-template');

        const docDirPath = path.dirname(metadata.document.path);
        if (docDirPath.startsWith('/')) docDirPath = docDirPath.substring(1);
        let bookdocs = await findBookDocs(this.array.options.config, docDirPath);
        // Performance testing
        console.log(`book-child-tree ${metadata.document.path} findBookDocs bookdocs.length ${bookdocs.length} ${(new Date() - _start) / 1000} seconds`);
        if (!bookdocs) throw new Error("Did not find bookdocs for "+ docDirPath);

        let booktree = await findBookTree(docDirPath);
        console.log(`book-child-tree ${metadata.document.path} findBookDocs booktree.length ${booktree.length} ${(new Date() - _start) / 1000} seconds`);

        for (let bookitem of booktree) {
            console.log(`@@ book-child-tree item for ${bookitem.vpath}`);
        }

        for (let bookitem of booktree) {
            console.log(`book-child-tree item for ${bookitem.vpath}`);
            for (let sibling of bookitem.siblings) {
                console.log(`\t${sibling.vpath}`);
            }
        }

        const renderTreeLevel = (dir) => {
            // console.log(`renderTreeLevel ${dir}`);
            let paths = pathdata(bookdocs, dir);
            let ret = akasha.partialSync(this.array.options.config,
                childTemplate 
                    ? childTemplate : "booknav-tree-level.html.ejs", {
                paths: paths, renderTreeLevel
            });
            /* for (let item of paths.items) {
                if (item.type === 'file') {
                    console.log(`renderTreeLevel item ${dir} ==> ${item.doc.renderPath} ${item.doc.docMetadata ? item.doc.docMetadata.title : 'NO TITLE AVAILABLE'} ${item.doc.docMetadata ? item.doc.docMetadata.teaser : 'NO TEASER AVAILABLE'}`);
                } else if (item.type === 'dir') {
                    console.log(`renderTreeLevel item ${dir} ==> ${util.inspect(item)}`);
                }
            } *--/
            // console.log(`renderTreeLevel ${dir} ==> ${ret}`);
            return ret;
        };

        // console.log(`book-child-tree rendering tree for ${metadata.document.path} ${docDirPath}`);
        let paths = pathdata(bookdocs, docDirPath);
        // Performance testing
        console.log(`book-child-tree ${metadata.document.path} pathdata paths.length ${paths.length} ${(new Date() - _start) / 1000} seconds`);
        let ret = await akasha.partial(this.array.options.config,
            template ? template : "booknav-tree-top.html.ejs", {
            paths: paths, renderTreeLevel
        });
        /* for (let item of paths.items) {
            if (item.type === 'file') {
                console.log(`book-child-tree item ${docDirPath} ==> ${item.doc.renderPath} ${item.doc.docMetadata ? item.doc.docMetadata.title : 'NO TITLE AVAILABLE'} ${item.doc.docMetadata ? item.doc.docMetadata.teaser : 'NO TEASER AVAILABLE'}`);
            } else if (item.type === 'dir') {
                console.log(`renderTreeLevel item ${docDirPath} ==> ${util.inspect(item)}`);
            }
        }*--/
        // console.log(`book-child-tree ${docDirPath} ==> ${ret}`);
        // Performance testing
        console.log(`book-child-tree ${metadata.document.path} RENDERED ${(new Date() - _start) / 1000} seconds`);
        return ret;

        /*
        console.log(`ChildTreeElement before documentTree`)
        let bookTree = await akasha.documentTree(this.array.options.config, bookdocs);
        console.log(`ChildTreeElement after documentTree`, bookTree)

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
        *--/
    }
}

*/
