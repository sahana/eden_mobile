/**
 * Sahana Eden Mobile - Resource Subsets
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

EdenMobile.factory('Subset', [
    '$q',
    function ($q) {

        "use strict";

        // ====================================================================
        /**
         * Constructor
         */
        function Subset(resource, parentID, query) {

            this.resource = resource;

            this._db = resource._db;
            this.table = resource.table;

            if (parentID) {
                if (isNaN(parentID - 0)) {
                    query = parentID;
                } else {
                    this.parentID = parentID;
                }
            }

            if (query && query.exprType) {
                this.query = query;
            }
        }

        // --------------------------------------------------------------------
        /**
         * Return a filtered Subset of this Subset
         *
         * @param {Expression} query - expression to filter this Subset
         *
         * @returns {Subset} - the filtered Subset
         */
        Subset.prototype.where = function(query) {

            var subQuery = this.query;

            if (subQuery) {
                if (query) {
                    subQuery = subQuery.and(query);
                }
            } else {
                subQuery = query;
            }

            return new Subset(this.resource, this.parentID, subQuery);
        };

        // --------------------------------------------------------------------
        /**
         * Extract records from this Subset (DRAFT)
         *
         * @param {Array} fields - Array of Fields or field names to extract
         * @param {object} options - select options (orderby, limitby etc.)
         *
         * @returns {promise} - a promise that resolves into the extracted
         *                      records
         */
        Subset.prototype.select = function(fields, options) {

            var deferred = $q.defer();

            var parent = this.parentQuery(),
                table = this.table;

            var set = table;
            if (parent.joins) {
                parent.joins.forEach(function(join) {
                    set = set.join(join);
                }, this);
            }
            if (parent.query) {
                set = set.where(parent.query);
            }
            if (this.query) {
                set = set.where(this.query);
            }

            set.select(fields, options,
                function(rows) {
                    deferred.resolve(rows);
                },
                function(error) {
                    deferred.reject(error);
                });

            return deferred.promise;
        };

        // --------------------------------------------------------------------
        /**
         * Helper function to construct the parent query and joins
         *
         * @returns {Parent} - query and joins
         *
         * @typedef {object} Parent
         * @property {Expression} query - the parent query
         * @property {Array} joins - Array of on-expressions to join
         *                           the parent table
         */
        Subset.prototype.parentQuery = function() {

            var resource = this.resource,
                parent = resource.parent,
                parentID = this.parentID,
                joins,
                query;

            if (parent && parentID) {

                var parentTable = parent.table,
                    table = this.table,
                    link = resource.link,
                    pkey = resource.pkey,
                    fkey = resource.fkey;

                query = parentTable.$('id').equals(parentID);

                if (link) {

                    var linkTable = link.table,
                        lkey = resource.lkey,
                        rkey = resource.rkey;

                    joins = [
                        linkTable.on(linkTable.$(rkey).equals(table.$(fkey))),
                        parentTable.on(parentTable.$(pkey).equals(linkTable.$(lkey)))
                    ];

                } else {

                    joins = [
                        parentTable.on(parentTable.$(pkey).equals(table.$(fkey)))
                    ];
                }
            }

            return {joins: joins, query: query};
        };

        // ====================================================================
        // Return prototype
        //
        return Subset;
    }
]);

// END ========================================================================
