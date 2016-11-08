/**
 * Sahana Eden Mobile - Database Service
 *
 * Copyright (c) 2016: Sahana Software Foundation
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
    '$q', 'emDefaultSchema', 'emSQL',
    function ($q, emDefaultSchema, emSQL) {

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
        function Field(name, description, meta) {

            this._description = description || {};

            // Field name and type
            this.name = name;
            this.type = description.type || 'string';

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
         * @returns {Field} - the clone Field
         */
        Field.prototype.clone = function() {

            var description = angular.extend({}, this._description),
                field = new Field(this.name, description, this.meta);

            field.type = this.type;

            field.readable = this.readable;
            field.writable = this.writable;

            return field;
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
                    fields[key] = new Field(key, value);
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
            this.tableName = tableName;

            this.fields = fields;
            this.settings = settings;

            this.resources = {};
        }

        // --------------------------------------------------------------------
        /**
         * Add the standard meta fields to this table (as defined in emDefaultSchema)
         */
        Table.prototype.addMetaFields = function() {

            var tableName = this.tableName,
                fields = this.fields;

            if (tableName != 'em_version' && !fields.hasOwnProperty('id')) {
                fields.id = new Field('id', {type: 'id'}, true);
            }

            var metaFields = emDefaultSchema._meta_fields,
                field;
            if (metaFields && tableName.slice(0, 3) != 'em_') {
                for (var fieldName in metaFields) {
                    if (!fields.hasOwnProperty(fieldName)) {
                        field = new Field(fieldName, metaFields[fieldName], true);
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

                var tableName = self.tableName;

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

            var tableName = this.tableName,
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
                name: this.tableName,
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

            var record = this.addDefaults(data, false, true),
                sqlTable = emSQL.Table(this),
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
            adapter.executeSql(sql, [], function(result) {
                if (callback) {
                    callback(result.rowsAffected);
                }
            }, db.sqlError);
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
                    callback(self.tableName, number);
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

            alert("Error processing SQL: " + JSON.stringify(error));
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

            var sql = 'SELECT DISTINCT tbl_name FROM sqlite_master WHERE tbl_name = "em_version"';
            adapter.executeSql(sql, [], function(result) {
                if (result.rows.length) {
                    self._loadTables().then(function() {
                        status.resolve();
                    });
                } else {
                    self._firstRun().then(function() {
                        status.resolve();
                    });
                }
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
                tableName;

            // Schedule tables
            for (tableName in emDefaultSchema) {
                if (tableName[0] != '_') {
                    pendingTables[tableName] = null;
                }
            }

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

            // Create tables
            var schema,
                table;
            for (tableName in pendingTables) {
                schema = parseSchema(emDefaultSchema[tableName]);
                table = new Table(this, tableName, schema.fields, schema.settings);
                table.addMetaFields();
                table.create(schema.records, whenTableCreated);
            }

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
                schema = parseSchema(emDefaultSchema.em_schema),
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
             * Get a list of all user tables
             *
             * @returns {promise} - a promise that resolves into an Array of table names
             */
            tables: function() {
                return db.ready.then(function() {
                    var tableNames = [];
                    for (var tn in db.tables) {
                        if (tn.slice(0, 3) != 'em_') {
                            tableNames.push(tn);
                        }
                    }
                    return tableNames;
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
                        // @todo: migrate schema
                        tableDefined.resolve(table);
                    } else {
                        table = new Table(db, tableName, fields, settings);
                        table.addMetaFields();
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
