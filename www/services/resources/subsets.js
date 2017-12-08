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
    //'$q',
    function () {

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

        // ====================================================================
        // Return prototype
        //
        return Subset;
    }
]);

// END ========================================================================
