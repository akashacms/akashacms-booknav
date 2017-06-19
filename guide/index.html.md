---
layout: plugin-documentation.html.ejs
title: AskashaCMS "Book-style-navigation" plugin documentation
---

The `akashacms-booknav` plugin is inspired by the Drupal `book` content type.  It consists of a tree-structured arrangement of pages, and at the content-area bottom of each page is navigational aids showing the "Next" and "Previous" items in the "book", as well as part of the book hierarchy.

The part of `akashacms-booknav` which works correctly generates an indented listing of all the child documents to the current document.  The `akashacms-breadcrumbs` plugin is useful in combination, as it automatically traces the hierarchy up to the website root directory.

# Installation

With an AkashaCMS website setup, add the following to `package.json`

```
  "dependencies": {
    ...
    "akashacms-booknav": ">=0.6",
    ...
  }
```

Once added to `package.json` run: `npm install`

# Configuration

In `config.js` for the website:

```
config.use(require('akashacms-booknav'));
```

## Page layout template

It's recommended to create a page layout template which renders the page index of content "below" its directory.  That is, suppose you want a "book" rooted at `/guides/nose-scratching`, every directory underneath that location should contain an `index.html` indexing the pages in the hierarchy.

With a template, say named `index-page.html.ejs`, each `index.html` would be generated from a content file like this:

```
---
layout: index-page.html.ejs
title: Nose Scratching for Fun and Profit
---
```

For a working example, see: https://github.com/akashacms/akashacms-example/tree/akasharender/documents/folder

An index page: https://github.com/akashacms/akashacms-example/blob/akasharender/documents/folder/index.html.md

The matching page template: https://github.com/akashacms/akashacms-example/blob/akasharender/layouts/index-page.html.ejs

# Custom Tags

#### Rendering the book hierarchy

The page layout template should contain this:

```
<book-child-tree></book-child-tree>
```

This function scans through the documents in directories underneath the current directory.  That scan finds every document under the directory containing the current document, and generating links to the pages.  The presentation is nested and indented to indicate the structure of the directory tree.

It's a quick and easy way to generate navigational pages for a group of documents.

The document metadata consulted is:

* ```title```: The title for the document.
* ```teaser```: The teaser (a short description) for the document.
* ```teaserthumb```: Path for a thumbnail image for the document.
* ```youtubeThumbnail```: URL of a YouTube video to use for thumbnail image.
* ```imageThumbnail```: URL of a video to use for thumbnail image.

#### Next/Previous

Use: `<book-next-prev>`
