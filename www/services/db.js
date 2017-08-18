/**
 * Sahana Eden Mobile - Database Service
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

"use strict";

// ============================================================================
/**
 * emDB - Service to manage the database and provide a high-level table API
 *
 * @class emSQL
 * @memberof EdenMobile
 */
EdenMobile.factory('emDB', [
    '$injector', '$q', 'Expression', 'emDefaultSchema', 'emFiles', 'emSQL',
    function ($injector, $q, Expression, emDefaultSchema, emFiles, emSQL) {

        // ====================================================================

        /**
         * UUID constructor
         * - representing an RFC 4122 v4 compliant unique identifier
         *
         * Inspired by Briguy37's proposal in:
         * http://stackoverflow.com/questions/105034/create-guid-uuid-in-javascript
         */
        function UUID() {

            var template = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx',
                time = new Date().getTime();

            if (window.performance && typeof window.performance.now === "function") {
                time += performance.now();
            }
            this.uuid = template.replace(/[xy]/g, function(c) {
                var result = (time + Math.random() * 16) % 16 | 0;
                time = Math.floor(time / 16);
                if (c != 'x') {
                    result = result & 0x3 | 0x8;
                }
                return result.toString(16);
            });
        }

        // --------------------------------------------------------------------
        /**
         * String representation of the UUID
         */
        UUID.prototype.toString = function() {
            return this.uuid;
        };

        // --------------------------------------------------------------------
        /**
         * URN representation of the UUID
         */
        UUID.prototype.urn = function() {
            return 'urn:uuid:' + this.uuid;
        };

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
            this.type = description.type || 'string';

            // Expression type
            Object.defineProperty(this, 'exprType', {
                value: 'field',
                writable: false
            });

            // Field description
            this._description = description || {};

            // Meta-field?
            this.meta = !!meta;

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
         * Override the Expression.toString method
         *
         * @returns {string} - an SQL identifier for the field,
         *                     format: 'tableName.fieldName'
         */
        Field.prototype.toString = function() {

            return (this.table || '<no table>') + '.' + this.name;
        };

        // --------------------------------------------------------------------
        /**
         * Override the Expression.toSQL method
         *
         * @returns {string} - an SQL identifier for the field,
         *                     format: 'tableName.fieldName'
         */
        Field.prototype.toSQL = function() {

            return this.toString();
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
                    var numeric = value + 0;
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
                    numeric = value + 0;
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
         * Get the selectable options for this field
         *
         * @returns {promise} - promise that resolves into the options
         *                      object, or undefined if no options are
         *                      available
         */
        Field.prototype.getOptions = function() {

            var optionsLoaded = $q.defer();

            if (this.type.split(' ')[0] == 'reference') {

                // Determine look-up table
                var foreignKey = this.getForeignKey();
                if (!foreignKey) {
                    optionsLoaded.resolve();
                }

                // Instantiate resource
                var self = this,
                    emResources = $injector.get('emResources');
                emResources.open(foreignKey.table).then(function(resource) {

                    if (!resource) {
                        // Look-up table doesn't exist
                        optionsLoaded.resolve();
                        return;
                    }

                    // Fields to extract
                    // => assumes description.represent is an Array of field names
                    //    @todo: support string templates
                    var key = foreignKey.key,
                        represent = angular.copy(self._description.represent) || [];
                    if (!represent.length) {
                        if (resource.fields.hasOwnProperty('name')) {
                            represent.push('name');
                        } else {
                            represent.push(foreignKey.key);
                        }
                    }

                    // Make sure the key is loaded
                    var fields = angular.copy(represent);
                    if (fields.indexOf(key) == -1) {
                        fields.push(key);
                    }

                    // Select records
                    resource.select(fields, function(records, result) {

                        // Build options object
                        var options = {},
                            values = [],
                            value;

                        records.forEach(function(record) {

                            values = [];

                            represent.forEach(function(fieldName) {
                                value = record[fieldName];
                                if (value) {
                                    values.push(value);
                                }
                            });
                            if (!values) {
                                values = [record[key]];
                            }
                            options[record[key]] = values.join(' ');
                        });

                        // Resolve promise
                        optionsLoaded.resolve(options);
                    });
                });

            } else {

                var options = angular.copy(this._description.options);
                optionsLoaded.resolve(options);
            }

            return optionsLoaded.promise;
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
            this.type = field.type;
            this.meta = field.meta;

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

            field.type = this.type;

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

        /**
         * Helper function to parse a table schema
         *
         * @param {object} schema - the table schema
         *
         * @returns {object} - the parsed schema as object:
         *                     {fields: array of field instances,
         *                      settings: object with settings,
         *                      records: array of records
         *                      }
         */
        var parseSchema = function(schema) {

            var fields = {},
                settings = {},
                records,
                key,
                value;

            for (key in schema) {
                value = schema[key];
                if (key == '_records') {
                    records = value;
                } else if (key.slice(0, 1) == '_') {
                    settings[key.slice(1)] = value;
                } else {
                    fields[key] = new Field(null, key, value);
                }
            }

            return {
                fields: fields,
                settings: settings,
                records: records
            };
        };

        // ====================================================================

        /**
         * Table constructor
         *
         * @param {Database} db - the database
         * @param {string} name - the tablename
         * @param {object} fields - the fields {fieldName: Field, ...}
         * @param {object} settings - the table settings {key: value}
         */
        function Table(db, tableName, fields, settings) {

            this._db = db;
            this.name = tableName;

            var field,
                fieldName,
                tableFields = {};

            for (fieldName in fields) {
                field = fields[fieldName];
                if (field.table) {
                    field = field.clone();
                }
                field.table = this;
                tableFields[fieldName] = field;
            }

            this.fields = tableFields;
            this.settings = settings;

            this.resources = {};
        }

        // --------------------------------------------------------------------
        /**
         * Shortcut for Table.fields[fieldName]
         *
         * @param {string} fieldName - the field name
         *
         * @returns {Field} - the Field, or undefined if no field with this
         *                    name is defined in the table
         */
        Table.prototype.$ = function(fieldName) {

            return this.fields[fieldName];
        };

        // --------------------------------------------------------------------
        /**
         * @todo: docstring
         */
        Table.prototype.toString = function() {
            return this.name;
        };

        // --------------------------------------------------------------------
        /**
         * @todo: docstring
         */
        Table.prototype.toSQL = function() {
            return this.toString();
        };

        // --------------------------------------------------------------------
        /**
         * Add the standard meta fields to this table (as defined in emDefaultSchema)
         */
        Table.prototype.addMetaFields = function() {

            var tableName = this.name,
                fields = this.fields;

            if (tableName != 'em_version' && !fields.hasOwnProperty('id')) {
                fields.id = new Field(this, 'id', {
                    type: 'id',
                    readable: false,
                    writable: false
                }, true);
            }

            var metaFields = emDefaultSchema.metaFields,
                field;
            if (metaFields && tableName.slice(0, 3) != 'em_') {
                for (var fieldName in metaFields) {
                    if (!fields.hasOwnProperty(fieldName)) {
                        field = new Field(this, fieldName, metaFields[fieldName], true);
                        fields[fieldName] = field;
                    }
                }
            }
        };

        // --------------------------------------------------------------------
        /**
         * Create this table in the database
         *
         * @param {Array} records - Array of records to populate the table with
         * @param {function} callback - callback function: function(tableName)
         */
        Table.prototype.create = function(records, callback) {

            var self = this;

            var sqlTable = emSQL.Table(self),
                sql = [sqlTable.drop(), sqlTable.create()];

            var db = self._db,
                adapter = db._adapter;

            adapter.sqlBatch(sql, function() {

                var tableName = self.name;

                db.tables[tableName] = self;

                if (tableName == 'em_schema') {
                    // Save all existing schemas
                    for (tableName in db.tables) {
                        db.tables[tableName].saveSchema();
                    }
                } else {
                    // Save this schema
                    self.saveSchema();
                }

                // Populate with records
                self.populate(records, callback);

            }, db.sqlError);
        };

        // --------------------------------------------------------------------
        /**
         * Populate this table with records
         *
         * @param {Array} records - Array of records to populate the table with
         * @param {function} callback - callback function: function(tableName)
         */
        Table.prototype.populate = function(records, callback) {

            var sqlTable = emSQL.Table(this),
                sql = [];

            if (records) {
                for (var i = 0, len = records.length; i < len; i++) {
                    var insertSQL = sqlTable.insert(records[i]);
                    if (insertSQL) {
                        sql.push(insertSQL);
                    }
                }
            }

            var tableName = this.name,
                db = this._db,
                adapter = db._adapter;

            if (sql.length) {
                adapter.sqlBatch(sql, function() {
                    if (callback) {
                        callback(tableName);
                    }
                }, db.sqlError);
            } else if (callback) {
                callback(tableName);
            }
        };

        // --------------------------------------------------------------------
        /**
         * Save the schema for this table in the schema table (em_schema)
         */
        Table.prototype.saveSchema = function() {

            var db = this._db;

            var schemaTable = db.tables['em_schema'];
            if (schemaTable === undefined) {
                return;
            }

            var fields = this.fields,
                fieldName,
                field,
                fieldDef = {},
                settings = this.settings;

            for (fieldName in fields) {
                field = fields[fieldName];
                if (!field.meta) {
                    fieldDef[fieldName] = field.description();
                }
            }

            schemaTable.insert({
                name: this.name,
                fields: fieldDef,
                settings: settings
            });
        };

        // --------------------------------------------------------------------
        /**
         * Add field defaults to a record before write
         *
         * @param {object} fields - the Fields
         * @param {object} data - the data that are to be written
         * @param {boolean} visible - only add visible defaults (for forms)
         * @param {boolean} update - apply update-defaults rather than
         *                           create-defaults
         *
         * @returns {object} - a new data object including default values
         */
        Table.prototype._addDefaults = function(fields, data, visible, update) {

            var record = {},
                field,
                fieldName,
                defaultValue;

            for (fieldName in fields) {
                field = fields[fieldName];
                if (!data.hasOwnProperty(fieldName)) {
                    if (visible && !field.readable) {
                        continue;
                    }
                    if (update) {
                        defaultValue = field.updateValue;
                    } else {
                        defaultValue = field.defaultValue;
                    }
                    if (typeof defaultValue == 'function') {
                        defaultValue = defaultValue();
                    }
                    if (defaultValue !== undefined) {
                        record[fieldName] = defaultValue;
                    }
                }
            }
            return angular.extend(record, data);
        };

        // --------------------------------------------------------------------
        /**
         * Add field defaults to a record before write
         *
         * @param {object} data - the data that are to be written
         * @param {boolean} visible - only add visible defaults (for forms)
         * @param {boolean} update - apply update-defaults rather than
         *                           create-defaults
         *
         * @returns {object} - a new data object including default values
         */
        Table.prototype.addDefaults = function(data, visible, update) {

            return this._addDefaults(this.fields, data, visible, update);
        };

        // --------------------------------------------------------------------
        /**
         * Insert a new record into this table
         *
         * @param {object} data - the record data {fieldName: value}
         * @param {function} callback - callback function: function(insertId)
         */
        Table.prototype.insert = function(data, callback) {

            var record = this.addDefaults(data, false, false),
                sql = emSQL.Table(this).insert(record);

            var db = this._db,
                adapter = db._adapter;

            adapter.executeSql(sql[0], sql[1], function(result) {
                if (callback) {
                    callback(result.insertId);
                }
            }, db.sqlError);
        };

        // --------------------------------------------------------------------
        /**
         * Update records in this table
         *
         * @param {object} data - the data to update {fieldName: value}
         * @param {string} query - SQL WHERE expression
         * @param {function} callback - callback function: function(numRowsAffected)
         */
        Table.prototype.update = function(data, query, callback) {

            var record;
            if (data.hasOwnProperty('_noDefaults') && !!data._noDefaults) {
                record = data;
            } else {
                record = this.addDefaults(data, false, true);
            }

            var sqlTable = emSQL.Table(this),
                sql;

            switch(arguments.length) {
                case 2:
                    callback = query;
                    sql = sqlTable.update(record);
                    break;
                default:
                    sql = sqlTable.update(record, query);
                    break;
            }

            var db = this._db,
                adapter = db._adapter;

            adapter.executeSql(sql[0], sql[1], function(result) {
                if (callback) {
                    callback(result.rowsAffected);
                }
            }, db.sqlError);
        };

        // --------------------------------------------------------------------
        /**
         * Select records from this table
         *
         * @param {Array} fields - Array of field names
         * @param {string} query - SQL WHERE expression
         * @param {function} callback - callback function: function(records, result)
         */
        Table.prototype.select = function(fields, query, callback) {

            var sqlTable = emSQL.Table(this),
                sql = null;

            // Flexible argument list (only callback is required)
            switch(arguments.length) {
                case 1:
                    callback = fields;
                    fields = null;
                    sql = sqlTable.select();
                    break;
                case 2:
                    callback = query;
                    sql = sqlTable.select(fields);
                    break;
                default:
                    sql = sqlTable.select(fields, query);
                    break;
            }

            var db = this._db,
                adapter = db._adapter;
            if (sql && callback) {
                adapter.executeSql(sql, [], function(result) {
                    var rows = result.rows,
                        records = [],
                        record;
                    for (var i = 0, len = rows.length; i < len; i++) {
                        record = sqlTable.extract(fields, rows.item(i));
                        records.push(record);
                    }
                    callback(records, result);
                }, db.sqlError);
            }
        };

        // --------------------------------------------------------------------
        /**
         * Get all files linked to records in this table
         *
         * @param {string} query - SQL WHERE expression
         * @param {function} callback - callback function, receives an array
         *                              of file URIs
         */
        Table.prototype.getFiles = function(query, callback) {

            var uploadFields = [],
                fields = this.fields,
                fieldName,
                field;

            // Get all upload-type fields
            for (fieldName in fields) {
                field = fields[fieldName];
                if (field.type == 'upload') {
                    uploadFields.push(fieldName);
                }
            }

            var files = [];

            if (uploadFields.length) {

                // Get all file URIs in upload-fields
                this.select(uploadFields, query, function(records) {
                    records.forEach(function(record) {
                        uploadFields.forEach(function(fieldName) {
                            var fileURI = record[fieldName];
                            if (fileURI) {
                                files.push(fileURI);
                            }
                        });
                    });
                    if (callback) {
                        callback(files);
                    }
                });

            } else {

                if (callback) {
                    callback(files);
                }
            }
        };

        // --------------------------------------------------------------------
        /**
         * Delete records in this table
         *
         * @param {string} query - SQL WHERE expression
         * @param {function} callback - callback function: function(numRowsDeleted)
         */
        Table.prototype.deleteRecords = function(query, callback) {

            var sqlTable = emSQL.Table(this),
                sql = null;

            if (arguments.length == 1) {
                callback = query;
                sql = sqlTable.deleteRecords();
            } else {
                sql = sqlTable.deleteRecords(query);
            }

            var db = this._db,
                adapter = db._adapter;

            this.getFiles(query, function(orphanedFiles) {

                adapter.executeSql(sql, [], function(result) {

                    // Delete now-orphaned files
                    emFiles.removeAll(orphanedFiles);

                    // Execute callback
                    if (callback) {
                        callback(result.rowsAffected);
                    }

                }, db.sqlError);
            });
        };

        // --------------------------------------------------------------------
        /**
         * Identify a record, use like:
         *      - table.identify(record).then(function(recordID){});
         *
         * @param {object} record - the record
         *
         * @returns {promise} - a promise that resolves into the record ID
         */
        Table.prototype.identify = function(record) {

            var deferred = $q.defer();

            var uuid = record.uuid;
            if (uuid) {

                // Try looking it up from the UUID
                var query = 'uuid="' + uuid + '"',
                    fields = ['id', 'synchronized_on', 'modified_on'];

                // Include upload-fields
                var allFields = this.fields;
                for (var fieldName in allFields) {
                    if (allFields[fieldName].type == "upload") {
                        fields.push(fieldName);
                    }
                }

                // Find the record
                this.select(fields, query, function(records) {
                    if (records.length) {
                        deferred.resolve(records[0]);
                    } else {
                        deferred.resolve();
                    }
                });

            } else {
                // No way to identify the record (yet)
                // @todo: try unique fields
                deferred.resolve();
            }

            // Return the promise
            return deferred.promise;
        };

        // --------------------------------------------------------------------
        /**
         * Count records in this table
         *
         * @param {string} query - SQL WHERE expression
         * @param {function} callback - callback function: function(numOfRecords)
         */
        Table.prototype.count = function(query, callback) {

            var self = this,
                sqlTable = emSQL.Table(self),
                sql = null;

            if (arguments.length == 1) {
                callback = query;
                sql = sqlTable.count();
            } else {
                sql = sqlTable.count(query);
            }

            var db = self._db,
                adapter = db._adapter;
            adapter.executeSql(sql, [], function(result) {
                var number = result.rows.item(0).number;
                if (callback) {
                    callback(self.name, number);
                }
            }, db.sqlError);
        };

        // ====================================================================

        /**
         * Database constructor
         *
         * @param {object} options - the database options
         */
        function Database(options) {

            this.options = options;

            this.tables = {};

            var status = $q.defer();

            this._adapter = null;
            this._status = status;

            this.ready = status.promise;
        }

        // --------------------------------------------------------------------
        /**
         * Default handler for SQL errors
         *
         * @param {object} error - the error returned from the database plugin
         */
        Database.prototype.sqlError = function(error) {

            var message;
            if (error) {
                message = error.message;
                if (!message) {
                    message = JSON.stringify(error);
                }
            } else {
                message = 'unknown error';
            }
            alert("Error processing SQL: " + message);
        };

        // --------------------------------------------------------------------
        /**
         * Open and set up the database
         */
        Database.prototype.open = function() {

            var self = this,
                status = self._status;

            if (self._adapter !== null) {
                return;
            }
            self._adapter = window.sqlitePlugin.openDatabase(self.options,
                function(adapter) {
                    self._setup(adapter);
                },
                function(error) {
                    var msg = 'Error opening database: ' + JSON.stringify(error);
                    alert(msg);
                    status.reject(msg);
                }
            );
        };

        // --------------------------------------------------------------------
        /**
         * Set up the database, resolves the db.ready promise
         */
        Database.prototype._setup = function() {

            var self = this,
                adapter = self._adapter,
                status = self._status;

            // Enable foreign key support
            var sql = 'PRAGMA foreign_keys = ON;';
            adapter.executeSql(sql, [], function(result) {

                sql = 'SELECT DISTINCT tbl_name FROM sqlite_master WHERE tbl_name = "em_version"';
                adapter.executeSql(sql, [], function(result) {

                    if (result.rows.length) {
                        // em_version table exists => load tables
                        self._loadTables().then(function() {
                            status.resolve();
                        });

                    } else {
                        // em_version table does not exist => first run
                        self._firstRun().then(function() {
                            status.resolve();
                        });
                    }
                }, self.sqlError);
            }, self.sqlError);
        };

        // --------------------------------------------------------------------
        /**
         * Bootstrap a new database (create standard tables, store schemas),
         * called from _setup if the database is empty
         */
        Database.prototype._firstRun = function() {

            var firstRunComplete = $q.defer(),
                pendingTables = {},
                queue = [];

            // Schedule tables
            emDefaultSchema.tables.forEach(function(schema) {

                var tableName = schema._name;
                if (tableName[0] != '_') {
                    queue.push(schema);
                    pendingTables[tableName] = null;
                }
            });

            // Callback to check progress
            var whenTableCreated = function(tableName) {

                pendingTables[tableName] = true;

                // Check for pending table definitions
                var ready = true;
                for (var t in pendingTables) {
                    if (pendingTables[t] === null) {
                        ready = false;
                        break;
                    }
                }

                // Resolve promise when all tables are defined
                if (ready) {
                    firstRunComplete.resolve();
                }
            };

            // Run the queue
            var self = this,
                table;
            queue.forEach(function(schema) {

                // Parse the schema
                var tableName = schema._name,
                    parsed = parseSchema(schema);

                // Create the table (asynchronously)
                table = new Table(self, tableName, parsed.fields, parsed.settings);
                table.addMetaFields();
                table.create(parsed.records, whenTableCreated);
            });

            return firstRunComplete.promise;
        };

        // --------------------------------------------------------------------
        /**
         * Load all table schemas and instantiate the Tables,
         * called from _setup if database has already been bootstrapped
         */
        Database.prototype._loadTables = function() {

            var self = this,
                tablesLoaded = $q.defer();

            var tables = self.tables,
                schema = parseSchema(emDefaultSchema.schema('em_schema')),
                schemaTable = new Table(self, 'em_schema', schema.fields);

            schemaTable.select(['name', 'fields', 'settings'], function(rows) {
                rows.forEach(function(row) {
                    schema = parseSchema(row.fields);
                    var tableName = row.name,
                        table = new Table(self, tableName, schema.fields, row.settings);
                    table.addMetaFields();
                    tables[tableName] = table;
                });
                tablesLoaded.resolve();
            });

            return tablesLoaded.promise;
        };

        // ====================================================================
        // Open the default database
        //
        var db = new Database({
            name: 'emdb.db',
            location: 'default'
        });
        db.open();

        // ====================================================================
        /**
         * Default error handly if db.ready gets rejected
         *
         * @param {string} error - the error message
         */
        var apiNotReady = function(error) {
            alert('Database Error: ' + error);
        };

        var api = {

            /**
             * Get a UUID instance
             */
            uuid: function() {
                return new UUID();
            },

            /**
             * Helper function to parse schema definitions
             */
            parseSchema: parseSchema,

            /**
             * Get an array of known tables (names only)
             *
             * @returns {promise} - a promise that resolves into an Array of
             *                      table names
             */
            tableNames: function() {
                return db.ready.then(function() {
                    var tableNames = [];
                    for (var tableName in db.tables) {
                        if (tableName.slice(0, 3) != 'em_') {
                            tableNames.push(tableName);
                        }
                    }
                    return tableNames;
                }, apiNotReady);
            },

            /**
             * Get an array of known tables
             *
             * @returns {promise} - a promise that resolves into an object
             *                      with the format {tableName: Table}
             */
            tables: function() {

                return db.ready.then(function() {
                    var tables = {};
                    for (var tableName in db.tables) {
                        if (tableName.slice(0, 3) != 'em_') {
                            tables[tableName] = db.tables[tableName];
                        }
                    }
                    return tables;
                }, apiNotReady);
            },

            /**
             * Get a Table
             *
             * @param {string} tableName - the table name
             *
             * @returns {promise} - a promise that resolves into the Table instance
             */
            table: function(tableName) {
                return db.ready.then(function() {
                    return db.tables[tableName];
                }, apiNotReady);
            },

            /**
             * @todo: docstring
             */
            defineTable: function(tableName, fields, settings, records) {

                var tableDefined = $q.defer();

                db.ready.then(function() {

                    var table = db.tables[tableName];
                    if (table) {
                        // Table exists or is currently being created
                        $q.when(table).then(function(table) {
                            // @todo: migrate schema
                            tableDefined.resolve(table);
                        });
                    } else {
                        // Indicate that we're in the process to create
                        // the table => prevent redefinition by parallel
                        // calls
                        db.tables[tableName] = tableDefined.promise;

                        // Instantiate the Table
                        table = new Table(db, tableName, fields, settings);
                        table.addMetaFields();

                        // Create the table in the database
                        table.create(records, function() {
                            tableDefined.resolve(table);
                        });
                    }
                });

                return tableDefined.promise;
            }
        };

        return api;
    }
]);

// END ========================================================================
