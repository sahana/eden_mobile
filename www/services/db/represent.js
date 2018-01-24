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
                return $q.resolve(this.none);
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

            if (field.isForeignKey && field.name != 'em_object_id' && !field.isObjectKey) {

                // TODO support object keys properly

                // Determine which fields to lookup from the referenced table
                var lookup = this.getLookup(field),
                    lookupFields = lookup.fields,
                    self = this;

                // Look up the referenced row and render the key representation
                reprStr = this.lookupRows(lookup.table, [value], lookupFields).then(function(rows) {
                    if (rows.length) {
                        var row = rows[0];
                        if (lookup.fallback) {
                            return self.representRow(row);
                        } else {
                            return self.representRow(row, lookupFields);
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

                // Fall back to default representation
                reprStr = $q.resolve(field.reprDefault(value), this.none);
            }

            // Add to the set
            theSet[value] = reprStr;

            return reprStr;
        };

        // --------------------------------------------------------------------
        /**
         * Render string representations for an array of field values
         *
         * @param {Array} values - the values
         *
         * @returns {promise} - a promise that resolves into an object
         *                      with {value: reprStr}, not including
         *                      representations of null/undefined
         */
        Represent.prototype.bulk = function(values) {

            // remove null/undefined from values
            var repr = {},
                result;
            values.forEach(function(value) {
                if (value !== null && value !== undefined) {
                    repr[value] = null;
                }
            });

            var field = this.field,
                value,
                label,
                fieldOptions = field._description.options;

            if (field.isForeignKey && field.name != 'em_object_id' && !field.isObjectKey) {

                // TODO support object keys properly

                // Determine which fields to lookup from the referenced table
                var lookup = this.getLookup(field),
                    lookupFields = lookup.fields,
                    self = this;

                // Look up the referenced rows and render the key representations
                result = this.lookupRows(lookup.table, values, lookupFields).then(function(rows) {

                    var recordID;

                    rows.forEach(function(row) {
                        recordID = row.$('id');
                        if (lookup.fallback) {
                            repr[recordID] = self.representRow(row);
                        } else {
                            repr[recordID] = self.representRow(row, lookupFields);
                        }
                    });
                    for (recordID in repr) {
                        if (repr[recordID] === null) {
                            repr[recordID] = self.unknown;
                        }
                    }
                    return repr;
                });

            } else if (fieldOptions) {

                // Lookup labels from field options
                if (fieldOptions.constructor === Array) {
                    for (var i = fieldOptions.length, opt; i--;) {
                        opt = fieldOptions[i];
                        value = opt[0];
                        label = opt[1];
                        if (repr.hasOwnProperty(value)) {
                            repr[value] = label;
                        }
                    }
                } else {
                    for (value in fieldOptions) {
                        if (repr.hasOwnProperty(value)) {
                            repr[value] = fieldOptions[value];
                        }
                    }
                }
                for (value in repr) {
                    label = repr[value];
                    if (label === null || label === undefined) {
                        repr[value] = this.unknown;
                    }
                }
                result = $q.resolve(repr);

            } else {

                // Fall back to default representation
                for (value in repr) {
                    repr[value] = field.reprDefault(value, this.none);
                }
                result = $q.resolve(repr);
            }

            return result;
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
         * @returns {String} - the string representation
         *
         * TODO add support for string templates
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
        /**
         * Determine which fields to look up from which table for a
         * foreign key
         *
         * @param {Field} field - the foreign key field
         *
         * @returns {Resolution} - the resolution
         *
         * @typedef {object} Resolution
         * @property {Table} table - the look up table
         * @property {Array} fields - field names to lookup
         * @property {boolean} fallback - apply fallbacks (llrepr, name)
         */
        Represent.prototype.getLookup = function(field) {

            // Get the lookup table
            var db = this.table._db,
                fk = field.getForeignKey(),
                table = db.tables[fk.table],
                represent = field.represent,
                lookupFields,
                fallback = false;

            if (represent) {
                if (represent.constructor === Array) {
                    // Verify all fields present in referenced table
                    for (var i = represent.length; i--;) {
                        if (!table.fields.hasOwnProperty(represent[i])) {
                            fallback = true;
                            break;
                        }
                    }
                    if (!fallback) {
                        lookupFields = represent;
                    }
                } else {
                    // TODO add support for string templates
                    fallback = true;
                }
            } else {
                fallback = true;
            }

            if (fallback) {
                lookupFields = ['llrepr'];
                if (table.fields.hasOwnProperty('name')) {
                    lookupFields.push('name');
                }
            }

            return {
                table: table,
                fields: lookupFields,
                fallback: fallback
            };
        };

        // --------------------------------------------------------------------
        // TODO Represent.prototype.multiple

        // ====================================================================
        // Return prototype
        //
        return Represent;
    }
]);

// END ========================================================================
