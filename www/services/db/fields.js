/**
 * Sahana Eden Mobile - Database Fields
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

EdenMobile.factory('Field', [
    '$injector', '$q', 'emUtils', 'Expression',
    function ($injector, $q, emUtils, Expression) {

        "use strict";

        // ====================================================================
        /**
         * Field constructor
         *
         * @param {string} name - the field name
         * @param {object} description - the field description
         * @param {boolean} meta - meta field flag
         */
        function Field(table, name, description, meta) {

            // Link to table
            this.table = table;

            // Field name and type
            this.name = name;

            // Evaluate the field type
            var type = description.type || 'string';
            if (type == 'objectkey') {
                type = 'reference em_object';
            }
            var reference = emUtils.getReference(type),
                isObjectKey = false;
            if (reference) {
                var lookupTable = reference[1],
                    key = reference[2] || 'id';
                if (lookupTable == 'em_object' && key == 'id') {
                    // All em_object references are object lookup keys,
                    // except the objectID (which is a self-reference)
                    isObjectKey = name != 'em_object_id';
                }
            }

            // Set read-only properties
            this._setProperties({
                type: type,
                exprType: 'field',
                isForeignKey: !!reference,
                isObjectKey: isObjectKey,
                refType: description.reftype,
                meta: !!meta
            });

            // Field description
            this._description = description || {};

            // Readable/writable options
            this.readable = true;
            this.writable = true;
            if (description.readable === false) {
                this.readable = false;
            }
            if (description.writable === false) {
                this.writable = false;
            }

            // Defaults
            this.defaultValue = description.defaultValue;
            this.updateValue = description.updateValue;
        }

        // --------------------------------------------------------------------
        /**
         * Inherit prototype methods from Expression
         */
        Field.prototype = Object.create(Expression.prototype);
        Field.prototype.constructor = Field;

        // --------------------------------------------------------------------
        /**
         * Override the Expression.toString method:
         * - provide a string representation of this field
         *
         * @returns {string} - a string representation of this field
         */
        Field.prototype.toString = function() {

            // Use column alias with mandatory tablename prefix
            return this.columnAlias(true);
        };

        // --------------------------------------------------------------------
        /**
         * Override the Expression.toSQL method:
         * - returns a prefixed SQL identifier for this field
         *
         * @returns {string} - the SQL identifier: 'tableName.fieldName'
         */
        Field.prototype.toSQL = function() {

            var table = this.getTable(),
                prefix;

            if (table) {
                prefix = '' + table;
                if (table._original) {
                    // Always quote table aliases
                    prefix = '"' + prefix + '"';
                }
            } else {
                // There can be no valid SQL for table-less Fields,
                // so this is for debugging purposes only
                prefix = '<no table>';
            }

            return prefix + '.' + this.name;
        };

        // --------------------------------------------------------------------
        /**
         * Override Expression.prototype.columnAlias:
         * - provide a column alias for this field
         * - use simple field name for fields in the primary table of a set
         * - use prefixed field name for all other cases
         *
         * @param {string} tableName - the name of the primary table name
         *
         * @returns {string} - an SQL alias for the Field
         */
        Field.prototype.columnAlias = function(tableName) {

            var alias = this.name,
                table = this.getTable();

            if (table) {
                if (tableName && table.name !== tableName) {
                    alias = table.name + '.' + alias;
                }
            } else {
                // There can be no valid SQL for table-less Fields,
                // so this is for debugging purposes only
                alias = '<no table>.' + alias;
            }
            return alias;
        };

        // --------------------------------------------------------------------
        /**
         * Get an SQL description of the field (for table creation)
         *
         * @returns {object} - an object with SQL phrases describing the
         *                     field, properties:
         *                      - column: the column definition
         *                      - constraint: foreign key constraint
         */
        Field.prototype.sqlDescribe = function() {

            var quotedName = '"' + this.name + '"',
                description = this._description,
                fieldType = this.type,
                reference = emUtils.getReference(fieldType),
                constraints = [];

            if (reference) {
                var lookupTable = reference[1],
                    key = reference[2] || 'id',
                    ondelete = description.ondelete || 'RESTRICT';
                constraints.push('FOREIGN KEY (' + quotedName + ') ' +
                                 'REFERENCES ' + lookupTable + '("' + key + '") ' +
                                 'ON DELETE ' + ondelete);
                fieldType = 'reference';
            }

            // SQL field type
            var sqlType;
            switch(fieldType) {
                case 'id':
                    sqlType = 'INTEGER PRIMARY KEY AUTOINCREMENT';
                    break;
                case 'reference':
                case 'boolean':
                case 'integer':
                    sqlType = 'INTEGER';
                    break;
                case 'double':
                    sqlType = 'REAL';
                    break;
                case 'string':
                case 'text':
                case 'date':
                case 'time':
                case 'datetime':
                case 'json':
                case 'upload':
                    sqlType = 'TEXT';
                    break;
                default:
                    sqlType = 'TEXT';
                    break;
            }

            var column = [quotedName, sqlType];
            if (description.notnull) {
                column.push('NOT NULL');
            }

            return {
                column: column.join(' '),
                constraint: constraints.join(',')
            };
        };

        // --------------------------------------------------------------------
        /**
         * Convert a value into an SQL expression that is suitable to query
         * this type of field (falls back to quoted string)
         *
         * @param {mixed} value - the value to convert
         *
         * @returns {string} - the SQL expression as string
         */
        Field.prototype.sqlEncode = function(value) {

            if (value === 'undefined' || value === null) {
                return 'NULL';
            }

            var quoted = function(arg) {
                return "'" + ('' + arg).replace(/'/g, "''") + "'";
            };

            var sqlEncoded;
            switch (this.type) {

                case 'id':
                case 'reference':
                    // Try to convert into positive integer
                    var numeric = value - 0;
                    if (!isNaN(numeric)) {
                        sqlEncoded = '' + Math.abs(numeric);
                    }
                    break;

                case 'boolean':
                    // Convert to 0|1
                    if (!value) {
                        sqlEncoded = '0';
                    } else {
                        sqlEncoded = '1';
                    }
                    break;

                case 'date':
                    // Try to convert into ISO date string
                    if (value.constructor === Date) {
                        var month = '' + (value.getMonth() + 1),
                            day = '' + value.getDate(),
                            year = value.getFullYear();
                        if (month.length < 2) {
                            month = '0' + month;
                        }
                        if (day.length < 2) {
                            day = '0' + day;
                        }
                        sqlEncoded = quoted([year, month, day].join('-'));
                    }
                    break;

                case 'datetime':
                    // Try to convert into ISO date/time string
                    if (value.constructor === Date) {
                        value.setMilliseconds(0);
                        sqlEncoded = quoted(value.toISOString());
                    }
                    break;

                case 'integer':
                case 'double':
                    // Try to convert into number
                    numeric = value - 0;
                    if (!isNaN(numeric)) {
                        sqlEncoded = '' + numeric;
                    }
                    break;

                case 'json':
                    // JSON-encode everything that isn't a string
                    if (value.constructor !== String) {
                        value = JSON.stringify(value);
                    }
                    break;

                default:
                    // Just use the fallback
                    break;
            }

            // Universal fallback
            if (sqlEncoded === undefined) {
                sqlEncoded = quoted(value);
            }

            return sqlEncoded;
        };

        // --------------------------------------------------------------------
        /**
         * Convert a field value from JS to SQL
         *
         * @param {mixed} jsValue - the JS value
         *
         * @returns {mixed} - the SQL value
         */
        Field.prototype.encode = function(jsValue) {

            if (jsValue === undefined) {
                return jsValue;
            }
            var sqlValue = jsValue;

            if (jsValue !== null) {
                switch(this.type) {
                    case 'boolean':
                        if (!jsValue) {
                            sqlValue = 0;
                        } else {
                            sqlValue = 1;
                        }
                        break;
                    case 'date':
                        var month = '' + (jsValue.getMonth() + 1),
                            day = '' + jsValue.getDate(),
                            year = jsValue.getFullYear();
                        if (month.length < 2) {
                            month = '0' + month;
                        }
                        if (day.length < 2) {
                            day = '0' + day;
                        }
                        sqlValue = [year, month, day].join('-');
                        break;
                    case 'datetime':
                        if (jsValue) {
                            jsValue.setMilliseconds(0);
                            sqlValue = jsValue.toISOString();
                        }
                        break;
                    case 'json':
                        sqlValue = JSON.stringify(jsValue);
                        break;
                    default:
                        break;
                }
            }

            return sqlValue;
        };

        // --------------------------------------------------------------------
        /**
         * Convert an SQL result value to JS
         *
         * @param {mixed} sqlValue - the SQL result value
         *                           (as returned by executeSql)
         *
         * @returns {mixed} - the corresponding JS value
         */
        Field.prototype.decode = function(sqlValue) {

            var jsValue = sqlValue;

            if (jsValue !== undefined && jsValue !== null) {
                switch(this.type) {
                    case 'boolean':
                        if (!sqlValue) {
                            jsValue = false;
                        } else {
                            jsValue = true;
                        }
                        break;
                    case 'date':
                    case 'datetime':
                        jsValue = new Date(sqlValue);
                        break;
                    case 'json':
                        jsValue = JSON.parse(sqlValue);
                        break;
                    default:
                        break;
                }
            }

            return jsValue;
        };

        // --------------------------------------------------------------------
        /**
         * Get the Table this fields belongs to
         *
         * @returns {Table} - the table
         */
        Field.prototype.getTable = function() {

            var table = this.table;
            if (!table) {
                var resource = this.resource;
                if (resource) {
                    table = resource.table;
                }
            }
            return table;
        };

        // --------------------------------------------------------------------
        /**
         * Resolve a reference into table name and key name
         *
         * @returns {object} - an object holding the table name ('table')
         *                     and the key name ('key') referenced by this
         *                     field
         */
        Field.prototype.getForeignKey = function() {

            var fieldTypeOpts = this.type.split(' '),
                fieldType = fieldTypeOpts[0],
                foreignKey;

            if (fieldType == 'reference') {
                if (fieldTypeOpts.length > 1) {

                    foreignKey = {};
                    var lookup = fieldTypeOpts[1].split('.');
                    if (lookup.length == 1) {
                        foreignKey = {
                            table: lookup[0],
                            key: 'id'
                        };
                    } else {
                        foreignKey = {
                            table: lookup[0],
                            key: lookup[1]
                        };
                    }
                }
            }
            return foreignKey;
        };

        // --------------------------------------------------------------------
        /**
         * Check if this field has selectable options
         *
         * @returns {boolean} - whether the field has selectable options
         */
        Field.prototype.hasOptions = function() {

            if (this.type.split(' ')[0] == 'reference') {
                return true;
            } else {
                return !!this._description.options;
            }
        };

        // --------------------------------------------------------------------
        /**
         * Get the description for this field
         *
         * @returns {object} - the field description
         */
        Field.prototype.description = function() {

            var description = angular.extend({}, this._description);

            description.type = this.type;

            if (typeof description.defaultValue == 'function') {
                delete description.defaultValue;
            }
            if (typeof description.updateValue == 'function') {
                delete description.updateValue;
            }

            return description;
        };

        // --------------------------------------------------------------------
        /**
         * Inherit options and attributes from another field
         *
         * @param {Field} field - the field to inherit from
         */
        Field.prototype.inherit = function(field) {

            // Attributes with mandatory inheritance
            this.name = field.name;
            this._setProperties({
                type: field.type,
                meta: field.meta,
                isForeignKey: field.isForeignKey,
                isObjectKey: field.isObjectKey,
                refType: field.refType
            });

            var description = this._description;

            // Optional overrides
            this.readable = field.readable;
            this.writable = field.writable;
            if (description.readable !== undefined) {
                this.readable = !!description.readable;
            }
            if (description.writable !== undefined) {
                this.writable = !!description.writable;
            }

            // Inherit defaults
            description = angular.extend({}, field.description, description);
            this._description = description;

            if (this.defaultValue === undefined) {
                this.defaultValue = field.defaultValue;
            }
            if (this.updateValue === undefined) {
                this.updateValue = field.updateValue;
            }
        };

        // --------------------------------------------------------------------
        /**
         * Clone this field
         *
         * @returns {Field} - the Field clone
         */
        Field.prototype.clone = function() {

            var description = angular.extend({}, this._description),
                field = new Field(null, this.name, description, this.meta);

            field._setProperties({
                type: this.type,
                isForeignKey: this.isForeignKey,
                isObjectKey: this.isObjectKey,
                refType: this.refType
            });
            field.readable = this.readable;
            field.writable = this.writable;

            return field;
        };

        // --------------------------------------------------------------------
        /**
         * Format a field value for JSON export to Sahana server
         *
         * @param {mixed} value - the JS field value
         *
         * @returns {mixed} - the formatted field value
         */
        Field.prototype.format = function(jsValue) {

            var formatted = jsValue;

            if (jsValue !== null) {
                switch(this.type) {
                    case 'date':
                        var month = '' + (jsValue.getMonth() + 1),
                            day = '' + jsValue.getDate(),
                            year = jsValue.getFullYear();
                        if (month.length < 2) {
                            month = '0' + month;
                        }
                        if (day.length < 2) {
                            day = '0' + day;
                        }
                        formatted = [year, month, day].join('-');
                        break;
                    case 'datetime':
                        if (jsValue) {
                            jsValue.setMilliseconds(0);
                            formatted = jsValue.toISOString();
                        }
                        break;
                    case 'json':
                        formatted = JSON.stringify(jsValue);
                        break;
                    default:
                        break;
                }
            }

            return formatted;
        };

        // --------------------------------------------------------------------
        /**
         * Get a type-specific default representation of a field value,
         * as fallback for representation functions
         *
         * @param {*} value - the field value
         * @param {string} none - the representation to return
         *                        for null/undefined values
         *
         * @returns {string} - a string representing the value
         */
        Field.prototype.reprDefault = function(value, none) {

            if (value === null || value === undefined) {
                return none;
            }

            var reprStr;

            // Type-specific default representations
            switch(this.type) {
                case 'date':
                    reprStr = value.toLocaleDateString();
                    break;
                case 'datetime':
                    reprStr = value.toLocaleString();
                    break;
                case 'boolean':
                    // TODO: i18n
                    if (value) {
                        reprStr = 'yes';
                    } else {
                        reprStr = 'no';
                    }
                    break;
                default:
                    reprStr = '' + value;
                    break;
            }

            return reprStr;
        };

        // --------------------------------------------------------------------
        /**
         * Convert a JSON value from Sahana server to internal format
         *
         * @param {mixed} value - the raw value from import JSON
         *
         * @returns {mixed} - the JS field value
         */

        Field.prototype.parse = function(value) {

            var parsed = value;

            if (value !== null) {
                switch(this.type) {
                    case 'date':
                    case 'datetime':
                        // Comes in as ISO string => convert to date
                        parsed = new Date(value);
                        break;
                    default:
                        break;
                }
            }
            return parsed;
        };

        // ====================================================================
        // Return prototype
        //
        return Field;
    }
]);

// END ========================================================================
