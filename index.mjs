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

import * as util from 'util';
import * as path from 'path';
import akasha, {
    Configuration,
    CustomElement,
    Munger,
    PageProcessor
} from 'akasharender';
const mahabhuta = akasha.mahabhuta;

const pluginName = "@akashacms/plugins-booknav";

const __dirname = import.meta.dirname;

export class BooknavPlugin extends akasha.Plugin {

    #config;

	constructor() {
		super(pluginName);
	}

    configure(config, options) {
        this.#config = config;
        this.options = options;
        options.config = config;
		config.addPartialsDir(path.join(__dirname, 'partials'));
        config.addMahabhuta(mahabhutaArray(options, config, this.akasha, this));
	}

    get config() { return this[_plugin_config]; }

}

export function mahabhutaArray(
            options,
            config, // ?: Configuration,
            akasha, // ?: any,
            plugin  // ?: Plugin) {
) {
    let ret = new mahabhuta.MahafuncArray(pluginName, options);
    ret.addMahafunc(new NextPrevElement(config, akasha, plugin));
    ret.addMahafunc(new ChildTreeElement(config, akasha, plugin));
    return ret;
};

// TODO
// BookDocs defined as
//    - rendersToHTML: true
//    - one of a given set of layouts
//    - Under a specific directory
async function findBookDocs(config, docDirPath) {

    // Performance testing
    // const _start = new Date();

    // console.log(`findBookDocs ${docDirPath}`);

    // Performance testing
    // console.log(`findBookDocs  after cache ${docDirPath} ${(new Date() - _start) / 1000} seconds`);

    const filecache = config.akasha.filecache;
    const documents = filecache.documentsCache;
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
        renderpathmatch: /\.html$/,
        // renderglob: '**/*.html',
        // renderers: [ akasha.HTMLRenderer ]
        sortFunc: (a,b) => {
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
        }
    };
    if (docDirPath && docDirPath !== '/') {
        selector.pathmatch = `^${docDirPath}/`;
    }


    let results = await documents.search(selector);
    // console.log(results);

    // Performance testing
    // console.log(`findBookDocs  after search ${docDirPath} ${(new Date() - _start) / 1000} seconds`);

    // Performance testing
    // console.log(`findBookDocs  after sort ${docDirPath} ${(new Date() - _start) / 1000} seconds`);
    
    return results;
};


class NextPrevElement extends CustomElement {
    get elementName() { return "book-next-prev"; }
    async process($element, metadata, dirty) {
        let bookRoot = $element.attr('book-root');
        if (bookRoot && bookRoot.charAt(0) === '/') {
            bookRoot = bookRoot.substring(1);
        }
        bookRoot = path.dirname(bookRoot);
        if (bookRoot === '.') bookRoot = '/';
        // console.log(`NextPrevElement root ${bookRoot}`);
        let bookdocs = await findBookDocs(this.config, bookRoot);
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
            return this.akasha.partial(this.config, 'booknav-next-prev.html.ejs', {
                prevDoc, nextDoc // , thisDoc: docEntry, documents: bookDocs
            });
        } else {
            throw new Error(`did not find document in book ${metadata.document.path}`);
        }
    }
}

class ChildTreeElement extends CustomElement {
    get elementName() { return "book-child-tree"; }
    async process($element, metadata, dirty) {

        // Performance testing
        const _start = new Date();
        const template = $element.attr('template');
        const childTemplate = $element.attr('child-template');

        const config = this.config;

        const filecache = await akasha.filecache;
        const documents = filecache.documentsCache;

        let docDirPath = path.dirname(metadata.document.path);
        if (docDirPath.startsWith('/')) docDirPath = docDirPath.substring(1);
        if (docDirPath === '.') docDirPath = '/';
        // const indexes = await documents.indexFiles(docDirPath);

        // let rootItem;
        // for (let index of indexes) {
        //     if (index.dirname === docDirPath
        //     || (docDirPath === '/' && index.dirname === '.')
        //     ) {
        //         rootItem = index;
        //         break;
        //     }
        // }
        // if (!rootItem) {
        //     throw new Error(`Did not find root (${docDirPath}) index item in path ${metadata.document.path} indexes ${indexes.length} ${util.inspect(indexes)}`);
        // }

        // const FUNC = this;
        const tree = await documents.childItemTree(metadata.document.path);

        const ret = this.akasha.partialSync(config,
            template ? template : "booknav-child-item-tree.html.njk",
            {
                rootItem: tree
            }
        );

        // console.log(`book-child-tree ${metadata.document.path}`, ret);

        return ret;

        // const renderIndexItem = async function(rootItem) {
        //     // console.log(`renderIndexItem `, rootItem);
        //     const siblings = await documents.siblings(rootItem.vpath);
        //     const childItems = [];
        //     for (let index of indexes) {
        //         if (path.dirname(index.dirname) === rootItem.dirname
        //          && index.vpath !== rootItem.vpath) {
        //             childItems.push(index);
        //         }
        //     }
        //     console.log(`book-child-tree renderIndexItem ${rootItem.vpath} ${util.inspect(siblings)} ${util.inspect(childItems)}`);
        //     return FUNC.array.options.config.akasha.partial(config,
        //         template ? template : "booknav-tree-top-new.html.njk", {
        //             rootItem, siblings, childItems, renderIndexItem
        //         });
        // };

        // return renderIndexItem(rootItem);
    }
}
