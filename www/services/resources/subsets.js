/**
 * Sahana Eden Mobile - Resource Subsets
 *
 * Copyright (c) 2016-2019 Sahana Software Foundation
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
         * Subset - a filtered subset of a resource
         *
         * @param {Resource} resource - the resource
         * @param {integer} parentID - the ID of the parent record
         * @param {Expression} query - the filter expression for the subset
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
         * Insert a new record into this subset, and establish the required
         * link to the parent record
         *
         * @param {object} data - the record data
         *
         * @returns {promise} - a promise that resolves into the ID of the
         *                      newly created record
         */
        Subset.prototype.insert = function(data) {

            var resource = this.resource,
                parent = resource.parent,
                parentID = this.parentID;

            if (parentID && parent && !resource.link) {

                var self = this;
                return this._lookupKey(parent, parentID, resource.pkey).then(
                    function(parentKey) {
                        data[resource.fkey] = parentKey;
                        return self._insertRecord(data);
                    });

            } else {

                return this._insertRecord(data);
            }
        };

        // --------------------------------------------------------------------
        /**
         * Extract records from this Subset
         *
         * @param {Array} fields - Array of Fields or field names to extract
         * @param {object} options - select options (orderby, limitby etc.)
         *
         * @returns {promise} - a promise that resolves into the extracted
         *                      records (Rows)
         */
        Subset.prototype.select = function(fields, options) {

            var deferred = $q.defer(),
                parent = this._parentQuery(),
                table = this.table,
                set = table;

            // Add parent joins+query
            if (parent.joins) {
                parent.joins.forEach(function(join) {
                    set = set.join(join);
                }, this);
            }
            if (parent.query) {
                set = set.where(parent.query);
            }

            // Add subset query
            if (this.query) {
                set = set.where(this.query);
            }

            // Extract the rows, then resolve
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
         * Bulk-update all records in this Subset
         *
         * @param {object} data - the data to write
         *
         * @returns {promise} - a promise that resolves into the number of
         *                      updated records (affectedRows)
         */
        Subset.prototype.update = function(data) {

            var self = this;

            return this._flatSet().then(function(set) {
                if (set) {
                    return self._update(set, data);
                } else {
                    // Subset is empty
                    return $q.resolve(0);
                }
            });
        };

        // --------------------------------------------------------------------
        /**
         * Bulk-delete all records in this subset
         *
         * @returns {promise} - a promise that resolves into the number of
         *                      deleted records (affectedRows)
         */
        Subset.prototype.delete = function() {

            var self = this;

            return this._flatSet().then(function(set) {
                if (set) {
                    return self._delete(set);
                } else {
                    // Subset is empty
                    return $q.resolve(0);
                }
            });
        };

        // --------------------------------------------------------------------
        /**
         * Count records in this subset
         *
         * @returns {promise} - a promise that resolves into the number of
         *                      records in this subset (numRows)
         */
        Subset.prototype.count = function() {

            var deferred = $q.defer(),
                parent = this._parentQuery(),
                table = this.table,
                set = table;

            // Add parent joins+query
            if (parent.joins) {
                parent.joins.forEach(function(join) {
                    set = set.join(join);
                }, this);
            }
            if (parent.query) {
                set = set.where(parent.query);
            }

            // Add subset query
            if (this.query) {
                set = set.where(this.query);
            }

            set.count(
                function(numRows) {
                    deferred.resolve(numRows);
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
        Subset.prototype._parentQuery = function() {

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

        // --------------------------------------------------------------------
        /**
         * Create a new record
         *
         * @param {object} data - the record data
         *
         * @returns {promise} - a promise that resolves into the record ID
         *                      of the newly created record
         */
        Subset.prototype._insertRecord = function(data) {

            var deferred = $q.defer(),
                resource = this.resource,
                parentID = this.parentID,
                record = resource.addDefaults(data, false, false),
                self = this;

            resource.table.insert(record,
                function(insertID) {
                    if (resource.link && parentID) {
                        self._insertLink(insertID).then(
                            function() {
                                deferred.resolve(insertID);
                            },
                            function(error) {
                                deferred.reject(error);
                            });
                    } else {
                         deferred.resolve(insertID);
                    }
                },
                function(error) {
                    deferred.reject(error);
                });

            return deferred.promise;
        };

        // --------------------------------------------------------------------
        /**
         * Create a link table entry for a new component record
         *
         * @param {integer} recordID - the record ID of the new component
         *                             record
         *
         * @returns {promise} - a promise that is resolved when the link
         *                      table entry has been created (linkID), or
         *                      no link table entry is required (undefined)
         */
        Subset.prototype._insertLink = function(recordID) {

            var resource = this.resource,
                parentID = this.parentID,
                link = resource.link;

            if (!parentID || !link) {
                return $q.resolve();
            }

            var parent = resource.parent,
                deferred = $q.defer(),
                self = this;

            self._lookupKey(parent, parentID, resource.pkey).then(function(lkey) {
                self._lookupKey(resource, recordID, resource.fkey).then(function(rkey) {

                    var data = {};
                    data[resource.lkey] = lkey;
                    data[resource.rkey] = rkey;

                    link.table.insert(data,
                        function(insertID) {
                            deferred.resolve(insertID);
                        },
                        function(error) {
                            deferred.reject(error);
                        });
                });
            });

            return deferred.promise;
        };

        // --------------------------------------------------------------------
        /**
         * Look up a key from a record
         *
         * @param {Resource} resource - the resource
         * @param {integer} recordID - the record ID
         * @param {string} key - the name of the key to look up
         *
         * @returns {promise} - a promise that resolves into the value
         *                      of the key in the target record
         */
        Subset.prototype._lookupKey = function(resource, recordID, key) {

            if (key == 'id') {
                // No look-up required, resolve immediately
                return $q.resolve(recordID);
            }

            var deferred = $q.defer(),
                table = resource.table;

            table.where(table.$('id').equals(recordID))
                 .select([key], {limitby: 1},
                function(rows) {
                    if (!rows.length) {
                        deferred.reject('record not found');
                    } else {
                        deferred.resolve(rows[0].$(key));
                    }
                },
                function(error) {
                    deferred.reject(error);
                });

            return deferred.promise;
        };

        // --------------------------------------------------------------------
        /**
         * Get a flat Set without joins for this Subset (DRY helper for
         * bulk update/delete)
         *
         * @returns {promise} - a promise that resolves into a Set, or
         *                      undefined if the Subset contains no records
         */
        Subset.prototype._flatSet = function() {

            var result,
                parent = this._parentQuery(),
                table = this.table,
                set = table;

            // Add parent joins+query
            if (parent.joins) {
                parent.joins.forEach(function(join) {
                    set = set.join(join);
                }, this);
            }
            if (parent.query) {
                set = set.where(parent.query);
            }

            // Add subset query
            if (this.query) {
                set = set.where(this.query);
            }

            if (set.isJoin()) {

                var deferred = $q.defer(),
                    pkey = table.$('id');

                set.select([pkey],
                    function(rows) {
                        if (rows.length) {
                            var query = pkey.in(rows.map(function(row) {
                                return row.$(pkey);
                            }));
                            deferred.resolve(table.where(query));
                        } else {
                            // Subset is empty
                            deferred.resolve();
                        }
                    },
                    function(error) {
                        deferred.reject(error);
                    });

                result = deferred.promise;

            } else {

                result = $q.resolve(set);
            }

            return result;
        };

        // --------------------------------------------------------------------
        /**
         * Update data in a Set (DRY helper for update())
         *
         * @param {Set} set - the set
         * @param {object} data - the data to write
         *
         * @returns {promise} - a promise that resolves into the number of
         *                      updated records (affectedRows)
         */
        Subset.prototype._update = function(set, data) {

            var deferred = $q.defer(),
                delta = this.resource.addDefaults(data, false, true);

            set.update(delta,
                function(affectedRows) {
                    deferred.resolve(affectedRows);
                },
                function(error) {
                    deferred.reject(error);
                });

            return deferred.promise;
        };

        // --------------------------------------------------------------------
        /**
         * Delete records in a Set (DRY helper for delete())
         *
         * @param {Set} set - the set
         *
         * @returns {promise} - a promise that resolves into the number of
         *                      deleted records (affectedRows)
         */
        Subset.prototype._delete = function(set) {

            var deferred = $q.defer();

            set.delete(
                function(affectedRows) {
                    deferred.resolve(affectedRows);
                },
                function(error) {
                    deferred.reject(error);
                });

            return deferred.promise;
        };

        // ====================================================================
        // Return prototype
        //
        return Subset;
    }
]);

// END ========================================================================
