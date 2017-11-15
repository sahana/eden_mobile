/**
 * Sahana Eden Mobile - Join Trees for Resource Queries
 *
 * Copyright (c) 2016-2017: Sahana Software Foundation
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files (the
 * "Software"), to deal in the Software without restriction, including
 * without limitation the rights to use, copy, modify, merge, publish,
 * distribute, sublicense, and/or sell copies of the Software, and to
 * permit persons to whom the Software is furnished to do so, subject to
 * the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
 * LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
 * OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
 * WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

(function() {

    "use strict";

    /**
     * Class to represent a tree of joins
     *
     * @param {string} tableName - the name of the joined table
     * @param {string} lKey - the left key of the join
     * @param {string} rKey - the right key of the join
     * @param {string} alias - the component alias (if component, optional)
     */
    function Join(tableName, lKey, rKey, alias) {

        this.tableName = tableName;

        this.lKey = lKey;
        this.rKey = rKey;

        this.alias = alias;

        var tables = {};
        tables[tableName] = [this];

        this.tables = tables;
        this.joins = {};

        this.root = this;
        this.useAlias = false;
    }

    // ------------------------------------------------------------------------
    /**
     * Register a join with this tree
     *
     * @param {Join} join - the join to register
     */
    Join.prototype.register = function(join) {

        if (this.parent) {
            // Always register with the root node of the tree
            this.root.register(join);
        } else {
            var tables = this.tables,
                tableName = join.tableName;

            if (tables.hasOwnProperty(tableName)) {
                tables[tableName].push(join);
                join.useAlias = true;
            } else {
                tables[tableName] = [join];
                join.useAlias = false;
            }

            // Recursively register all sub-joins
            for (var path in join.joins) {
                this.register(join.joins[path]);
            }
        }
    };

    // ------------------------------------------------------------------------
    /**
     * Get a path description for this join (relative to its parent), used
     * to identify this join when merging trees as well as to generate table
     * aliases
     *
     * @returns {string} - the path description
     */
    Join.prototype.getPath = function() {

        var lKey = this.lKey,
            rKey = this.rKey,
            path;

        if (!lKey || !rKey) {
            return path;
        }

        if (lKey == rKey) {
            if (lKey == 'id') {
                path = '=';
            } else {
                path = '.' + lKey + ':';
            }
        } else {
            var left = '', right = '';
            if (lKey != 'id') {
                left = '.' + lKey;
            }
            if (rKey != 'id') {
                right = rKey + ':';
            }
            path = left + '=' + right;
        }
        return path + (this.alias || this.tableName);
    };

    // ------------------------------------------------------------------------
    /**
     * Add a sub-join
     *
     * @param {Join} join - the sub-join to add
     */
    Join.prototype.append = function(join) {

        var path = join.getPath(),
            joins = this.joins,
            existing = joins[path];

        if (existing) {
            // Merge into existing sub-join
            existing.merge(join);
        } else {
            // Add new sub-join and register it
            joins[path] = join;
            join.parent = this;
            join.root = this.root;
            this.register(join);
        }
    };

    // ------------------------------------------------------------------------
    /**
     * Merge another join (tree fragment) into this join
     *
     * @param {Join} other - the other join to merge
     */
    Join.prototype.merge = function(other) {

        var joins = other.joins;
        for (var path in joins) {
            this.append(joins[path]);
        }
    };

    // ------------------------------------------------------------------------
    /**
     * Get a table alias for this join
     *
     * @returns {string} - the table alias
     */
    Join.prototype.getAlias = function() {

        var alias,
            parent = this.parent;

        if (parent) {

            var parentAlias = parent.getAlias(),
                componentAlias = this.alias;

            if (!parent.parent && componentAlias && componentAlias != parentAlias) {
                alias = componentAlias;
            } else if (this.useAlias) {
                alias = parentAlias + this.getPath();
            }
        }

        return alias;
    };

    // ------------------------------------------------------------------------
    /**
     * Resolve a path array into the corresponding sub-join
     *
     * @param {Array} path - array of path names
     *
     * @returns {Join} - the corresponding sub-join
     */
    Join.prototype.resolvePath = function(path) {

        var join = this;

        if (path && path.length) {
            var head = path[0],
                tail = path.slice(1);
            join = this.joins[head];
            if (join && tail.length) {
                join = join.resolvePath(tail);
            }
        }
        return join;
    };

    // ------------------------------------------------------------------------
    /**
     * Add this join tree to a set
     *
     * @todo: call with Table (Set) instance
     * @todo: construct a Set rather than SQL
     */
    Join.prototype.extendSet = function(set, parentTable) {

        var db = set._db,
            table = db.tables[this.tableName],
            alias = this.getAlias();

        if (alias) {
            table = table.as(alias);
        }

        if (this.parent) {
            var cond = table.$(this.rKey).equals(parentTable.$(this.lKey));
            set = set.left(table.on(cond));
        }

        var joins = this.joins;
        for (alias in joins) {
            set = joins[alias].extendSet(set, table);
        }

        return set;
    };

    // ------------------------------------------------------------------------
    // Make injectable
    //
    angular.module('EdenMobile').constant('Join', Join);

})();
