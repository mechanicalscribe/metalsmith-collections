var debug = require('debug')('metalsmith-collections');
var multimatch = require('multimatch');
var unique = require('uniq');
var loadMetadata = require('read-metadata').sync;

/**
 * Expose `plugin`.
 */

module.exports = plugin;

/**
 * Metalsmith plugin that adds `collections` of files to the global
 * metadata as a sorted array.
 *
 * @param {Object} collections (optional)
 * @return {Function}
 */

function plugin(opts) {
  // options, in this iteration, is only a pattern for all relevant files and a sorting key and direction
  // opts = normalize(opts);
  // var keys = Object.keys(opts);
  // var match = matcher(opts);

  return function(files, metalsmith, done) {
    // metadata for this article
    var metadata = metalsmith.metadata();

    /**
     * Clear collections (to prevent multiple additions of the same file when running via metalsmith-browser-sync)
     */

    metadata.collections = {};
    metadata.collections_lookup = {};

    if (opts.generic) {
      metadata.collections[opts.generic] = [];
      if (!opts.hasOwnProperty('excludeFromGeneric')) {
        opts.excludeFromGeneric = [];
      }
    }
    /**
     * Find the files in each collection.
     */

    Object.keys(files).forEach(function(file) {
      var data = files[file];

      data.path = data.path || file;

      // console.log("PATH", file, data.path);

      if (!opts.filter.test(data.path)) {
        // debug("IGNORING", data.path, "SINCE IT'S NOT ELIGIBLE FOR A COLLECTION");
        return;
      }

      // const matches = match(file, data);
      debug('processing file: %s', file);

      if (!data.collection) {
        data.collection = []
      }

      // we can have an item in multiple collections
      if (!Array.isArray(data.collection)) {
        data.collection = [data.collection];
      }

      data.collection.forEach(key => {
        // debug("Adding to collection", key);
        if (!metadata.collections.hasOwnProperty(key)) {
          debug("Discovered new collection", key);
          metadata.collections[key] = [];
          metadata.collections_lookup[key] = [];
        }

        data.collection_key = key;

        debug("KEY", key);

        data.category_type = opts.metadata[key].category_title.replace(/s$/i, "");

        metadata.collections[key].push(data);

        if (data.id) {
          metadata.collections_lookup[key][data.id] = data;          
        }

        debug("Added", data.path, "to collection", key);
      });

      // console.log(opts.excludeFromGeneric, data.collection_key);

      if (opts.generic && !opts.excludeFromGeneric.indexOf(data.collection_key) === -1) {
        metadata.collections[opts.generic].push(data);
        debug("Added", data.path, "to generic collection", opts.generic);
      }
    });

    const keys = Object.keys(metadata.collections);

    metadata.gallery_posts = [];
    
    metadata.gallery.forEach(post_id => {
      metadata.gallery_posts.push(metadata.collections_lookup.gallery[post_id]);
    });

    debug("FINISHED WITH FILES", Object.keys(metadata.collections));
    // console.log(metadata.collections_lookup);


    /**
     * Sort the collections.
     */

    keys.forEach(function(key) {
      debug('sorting collection: %s', key);
      var sort = opts.sortBy || 'date';
      var col = metadata.collections[key];

      if ('function' == typeof sort) {
        col.sort(sort);
      } else {
        col.sort(function(a, b) {
          a = a[sort];
          b = b[sort];
          if (!a && !b) return 0;
          if (!a) return -1;
          if (!b) return 1;
          if (b > a) return -1;
          if (a > b) return 1;
          return 0;
        });
      }

      if (opts.reverse) col.reverse();
    });

    /**
     * Add `next` and `previous` references and apply the `limit` option
     */

    // keys.forEach(function(key) {
    //   debug('referencing collection: %s', key);
    //   var col = metadata.collections[key];
    //   var last = col.length - 1;
    //   if (opts.limit && opts.limit < col.length) {
    //     col = metadata.collections[key] = col.slice(0, opts.limit);
    //     last = opts[key].limit - 1;
    //   }
    //   if (settings.refer === false) return;
    //   col.forEach(function(file, i) {
    //     if (0 != i) file.previous = col[i - 1];
    //     if (last != i) file.next = col[i + 1];
    //   });
    // });

    /**
     * Add collection metadata
     */

    if (opts.order) {
      metadata.collections_order = opts.order;
    }

    keys.forEach(function(key) {
      debug('adding metadata: %s', key);

      let info = opts.metadata && opts.metadata[key] ? opts.metadata[key] : null;
      let collection = metadata.collections[key];
      collection.key = key;
      collection.top5 = collection.slice(0,5);

      if (info) {
        collection.category_title = info.category_title;
      }
    });

    /**
      Add landing pages
    */

    keys.forEach(function(key) {
      const collection = metadata.collections[key];
      let landing_page_layout = opts.metadata[key].landing_page_layout || opts.landing_page_layout;
      // console.log(key, landing_page_layout);

      if (landing_page_layout) {
        debug("Making landing page for collection", key, "with", collection.length, "posts");
        if (files[key + "/index.html"]) {
          debug ("Can't create landing page for collection '%s' since a file at '%s/index.html' already exists.", key, key);
          return;
        }
        files[key + "/index.html"] = {
          layout: landing_page_layout,
          collection: collection,
          contents: ""
        }
        debug ("Added landing page for collection '%s' at '%s/index.html'", key, key);
        files[key + "/index.html"].path = key + "/index.html";
        files[key + "/index.html"].date = new Date();
        files[key + "/index.html"].page_type = 'landing_page';

        // debug("COLLECTION META", collection.metadata);
      }
    });

    /**
     * Add them grouped together to the global metadata.
     */

    debug(Object.keys(metadata.collections));
    // keys.forEach(function(key) {
    //   return (metadata.collections[key] = metadata[key]);
    // });

    done();
  };
}
