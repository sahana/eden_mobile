/**
 * Sahana Eden Mobile - Field Value Presentation Service
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

EdenMobile.factory('Represent', [
    '$q',
    function ($q) {

        "use strict";

        // ====================================================================
        /**
         * Represent constructor
         *
         * @param {Table} table - the table (that contains the field)
         * @param {Field} field - the field
         */
        function Represent(table, field) {

            this.table = table;
            this.field = field;

            this.theSet = {};

            // Common representation of undefined|null
            this.none = '-';

            // Common representation of non-null unknown options
            this.unknown = '?';
        }

        // --------------------------------------------------------------------
        /**
         * Render a string representation for a single field value
         *
         * @param {*} value - the field value
         *
         * @returns {promise} - a promise that resolves into a string
         *                      representation of that field value
         */
        Represent.prototype.render = function(value) {

            // None-value?
            if (value === undefined || value === null) {
                return this.none;
            }

            // Already known?
            var theSet = this.theSet;
            if (theSet.hasOwnProperty(value)) {
                return theSet[value];
            }

            var field = this.field,
                fieldOptions = field._description.options,
                reprStr,
                i;
            if (field.isForeignKey) {

                // Get the lookup table
                var db = this.table._db,
                    fk = field.getForeignKey(),
                    table = db.tables[fk.table];

                // Determine which fields to lookup from the referenced table
                var represent = field.represent,
                    lookupFields,
                    isFieldList = false;
                if (represent) {
                    if (represent.constructor === Array) {
                        // Array of field names
                        isFieldList = true;
                        for (i = represent.length; i--;) {
                            if (!table.fields.hasOwnProperty(represent[i])) {
                                isFieldList = false;
                                break;
                            }
                        }
                        if (isFieldList) {
                            lookupFields = represent;
                        }
                    }
                }
                if (!lookupFields) {
                    lookupFields = ['llrepr'];
                    if (table.fields.hasOwnProperty('name')) {
                        lookupFields.push('name');
                    }
                }

                // Look up the referenced row and render the key representation
                var self = this;
                reprStr = this.lookupRows(table, [value], lookupFields).then(function(rows) {
                    if (rows.length) {
                        var row = rows[0];
                        if (isFieldList) {
                            return self.representRow(row, lookupFields);
                        } else {
                            return self.representRow(row);
                        }
                    } else {
                        return self.unknown;
                    }
                });

            } else if (fieldOptions) {

                // Look up representation from fixed set of options
                if (fieldOptions.constructor === Array) {
                    var opt;
                    for (i = fieldOptions.length; i--;) {
                        opt = fieldOptions[i];
                        if (opt[0] == value) {
                            reprStr = opt[1];
                            break;
                        }
                    }
                } else {
                    reprStr = fieldOptions[value];
                }
                if (reprStr === undefined) {
                    reprStr = this.unknown;
                }
                reprStr = $q.resolve(reprStr);

            } else {

                // Just convert into string
                reprStr = $q.resolve('' + value);
            }

            // Add to the set
            theSet[value] = reprStr;

            return reprStr;
        };

        // --------------------------------------------------------------------
        /**
         * Helper function to look up data from referenced rows
         *
         * @param {Table} table - the lookup table
         * @param {Array} recordIDs - the record IDs
         * @param {Array} fieldNames - the fields to extract
         *
         * @returns {promise} - a promise that resolves into an Array of
         *                      Rows matching the record IDs
         */
        Represent.prototype.lookupRows = function(table, recordIDs, fieldNames) {

            var deferred = $q.defer(),
                fields = ['id'].concat(fieldNames),
                set;
            if (recordIDs.length == 1) {
                set = table.where(table.$('id').is(recordIDs[0]));
            } else {
                set = table.where(table.$('id').in(recordIDs));
            }

            set.select(fields,
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
         * Helper function to render a string representation for a foreign key
         * from the referenced Row
         *
         * @param {Row} row - the referenced row
         * @param {Array} fields - array of field names to use to construct
         *                         the field representation
         *
         * @returns {ßtring} - the string representation
         */
        Represent.prototype.representRow = function(row, fields) {

            var value;

            if (fields && fields.length) {

                var values = [];
                fields.forEach(function(fieldName) {
                    value = row.$(fieldName);
                    if (value === null || value === undefined) {
                        value = this.none;
                    }
                    values.push('' + value);
                });
                return values.join(' ');

            } else {
                value = row.$('llrepr');
                if (value) {
                    return value;
                }
                value = row.$('name');
                if (value) {
                    return value;
                }
                return '' + row.$('id');
            }
        };

        // --------------------------------------------------------------------
        // TODO Represent.prototype.bulk

        // --------------------------------------------------------------------
        // TODO Represent.prototype.multiple

        // ====================================================================
        // Return prototype
        //
        return Represent;
    }
]);

// END ========================================================================
