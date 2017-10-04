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
     * @param {string} tableName - the name of the primary table
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
            for (var subjoin in join.joins) {
                this.register(subjoin);
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
     *
     * @todo: consider returning undefined if no alias shall be used
     */
    Join.prototype.getAlias = function() {

        var alias = this.tableName,
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
     * Convert this join into a Set (DRAFT!)
     *
     * @todo: call with Table (Set) instance
     * @todo: construct a Set rather than SQL
     */
    Join.prototype.getSet = function() {

        var set = [],
            alias;

        if (this.parent) {

            // @todo: produce Table.as (when implemented)
            alias = this.getAlias();
            var aliasExpr = '';
            if (this.useAlias || alias != this.tableName) {
                alias = '"' + alias + '"';
                aliasExpr = ' AS ' + alias;
            }

            // @todo: produce actual ON-Expression
            var on = alias + '.' + this.rKey,
                parentAlias = this.parent.getAlias();
            if (parentAlias != this.parent.tableName) {
                parentAlias = '"' + parentAlias + '"';
            }
            on += '=' + parentAlias + '.' + this.lKey;

            // @todo: extend passed-in Set
            set.push('LEFT JOIN ' + this.tableName + aliasExpr + ' ON ' + on);

        } else {
            // @todo: remove this part
            set.push(this.tableName);
        }

        var joins = this.joins;
        for (alias in joins) {
            // @todo: call getSet of sub-joins with (extended) set
            set = set.concat(joins[alias].getSet());
        }

        return set;
    };

    // ------------------------------------------------------------------------
    // Make injectable
    //
    angular.module('EdenMobile').constant('Join', Join);

})();
