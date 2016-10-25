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

/**
 * emDB - Service providing access to the local database
 *
 * @class emDB
 * @memberof EdenMobile.Services
 */
EdenMobile.factory('emDB', [
    '$q', 'emDefaultSchema', 'emSQL',
    function ($q, emDefaultSchema, emSQL) {

        /**
         * The table definitions
         */
        var tables = {},
            pendingTables = {};

        /**
         * DB Status Promise
         */
        var dbStatus = $q.defer(),
            dbReady = dbStatus.promise;

        /**
         * Default meta fields
         */
        var metaFields = emDefaultSchema._meta_fields;
        if (metaFields) {
            for (var fieldName in metaFields) {
                // Set _meta flag to prevent meta field descriptions
                // from being written to the em_schema table
                metaFields[fieldName]._meta = true;
            }
        }

        /**
         * Generic error callback for database transactions
         *
         * @param {object} error - the error object
         */
        var errorCallback = function(error) {
            alert("Error processing SQL: " + JSON.stringify(error));
        };

        /**
         * Generic error callback for deferred API methods
         *
         * @param {string} error - the error message
         */
        var apiNotReady = function(error) {
            alert('Database Error: ' + error);
        };

        /**
         * Save the current schema for a table in the database
         *
         * @param {object} db - the database handle
         * @param {string} tableName - the table name
         */
        var saveSchema = function(db, tableName) {

            var table = emSQL.Table('em_schema', tables.em_schema),
                tableSpec = tables[tableName],
                schema = {},
                description;

            // Serialize the schema (skip prepop records and meta fields)
            for (var key in tableSpec) {
                if (key != '_records') {
                    description = tableSpec[key];
                    if (!description._meta) {
                        schema[key] = description;
                    }
                }
            }

            // @todo: check whether this is an update?

            // Save the schema
            var sql = table.insert({
                'name': tableName,
                'schema': schema
            });
            db.executeSql(sql[0], sql[1], null, errorCallback);
        };

        /**
         * Function to define a new table
         *
         * @param {object} db - the database handle
         * @param {string} tableName - the table name
         * @param {object} schema - the table schema
         * @param {function} callback - function to call upon success
         */
        var defineTable = function(db, tableName, schema, callback) {

            // Prevent re-definition of tables
            if (tables.hasOwnProperty(tableName)) {
                alert('Error: redefinition of ' + tableName + ' table');
                return;
            }

            // Automatically add ID field to schema
            if (tableName != 'em_version' && !schema.hasOwnProperty('id')) {
                schema.id = {type: 'id'};
            }

            // Create the table
            var table = emSQL.Table(tableName, schema),
                sql = [table.drop(), table.create()];
            db.sqlBatch(sql, function() {
                // Add table definition to registry
                tables[tableName] = schema;
                if (tableName == 'em_schema') {
                    // Save all existing schemas
                    for (tableName in tables) {
                        saveSchema(db, tableName);
                    }
                } else if (tables.hasOwnProperty('em_schema')) {
                    // Save this schema
                    saveSchema(db, tableName);
                }
                // Generate prepop SQL
                var prepop = [];
                if (schema.hasOwnProperty('_records')) {
                    var records = schema._records,
                        record;

                    for (var i=0, len=records.length; i<len; i++) {
                        record = records[i];
                        var sql = table.insert(record);
                        if (sql) {
                            prepop.push(sql);
                        }
                    }
                }
                // Prepop + callback
                if (prepop.length) {
                    db.sqlBatch(prepop, function() {
                        callback(tableName);
                    }, errorCallback);
                } else if (callback) {
                    callback(tableName);
                }
            }, errorCallback);
        };

        /**
         * Add 'id' field and default meta fields to a table schema
         *
         * @param {string} tableName - the table name
         * @param {object} schema - the schema
         */
        var addMetaFields = function(tableName, schema) {

            // Add 'id' field to all tables except em_version
            if (tableName != 'em_version' && !schema.hasOwnProperty('id')) {
                schema.id = {
                    type: 'id',
                    _meta: true
                };
            }

            // Add default meta fields to all non-em* tables
            if (metaFields && tableName.slice(0, 3) != 'em_') {
                for (var fieldName in metaFields) {
                    if (!schema.hasOwnProperty(fieldName)) {
                        schema[fieldName] = metaFields[fieldName];
                    }
                }
            }
        };

        /**
         * Create and populate all tables from default schema
         *
         * @param {object} db - the database handle
         *
         * @returns {promise} a promise that is resolved when all tables
         *                    are created and pre-populated
         */
        var firstRun = function(db) {

            var tablesDefined = $q.defer(),
                tableName;

            // Schedule tables to define
            pendingTables = {};
            for (tableName in emDefaultSchema) {
                if (tableName[0] != '_') {
                    pendingTables[tableName] = null;
                }
            }

            // Callback for defineTable to report progress
            var whenTableDefined = function(tableName) {

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
                    tablesDefined.resolve(true);
                }
            };

            // Add schemas to tables-object
            var defaultSchema;
            for (tableName in pendingTables) {
                defaultSchema = emDefaultSchema[tableName];
                addMetaFields(tableName, defaultSchema);
                defineTable(db, tableName, defaultSchema, whenTableDefined);
            }

            return tablesDefined.promise;
        };

        /**
         * Load all current schemas from em_schema table
         *
         * @param {object} db - the database handle
         *
         * @returns {promise} a promise that is resolved when all
         *                    table schemas are loaded
         *
         * @todo: check schema version and handle schema migrations
         */
        var loadSchema = function(db) {

            var schemaLoaded = $q.defer(),
                table = emSQL.Table('em_schema', emDefaultSchema.em_schema),
                sql = table.select(['name', 'schema']);

            db.executeSql(sql, [], function(result) {
                var rows = result.rows,
                    row,
                    tableName,
                    schema;
                for (var i=0, len=rows.length; i<len; i++) {
                    row = rows.item(i);
                    tableName = row.name;
                    try {
                        schema = JSON.parse(row.schema);
                    } catch(e) {
                        alert('Error parsing schema for table ' + tableName);
                        continue;
                    }
                    addMetaFields(tableName, schema);
                    tables[tableName] = schema;
                }
                schemaLoaded.resolve(true);
            }, errorCallback);

            return schemaLoaded.promise;
        };

        /**
         * Populate the database if first run, otherwise just load
         * the schema. Resolves the dbReady promise when complete.
         *
         * @param {object} db - the database handle
         */
        var checkFirstRun = function(db) {

            // Check if em_version table exists
            var sql = 'SELECT DISTINCT tbl_name FROM sqlite_master WHERE tbl_name = "em_version"';
            db.executeSql(sql, [], function(result) {
                if (!result.rows.length) {
                    firstRun(db).then(function() {
                        dbStatus.resolve(true);
                    });
                } else {
                    loadSchema(db).then(function() {
                        dbStatus.resolve(true);
                    });
                }
            }, errorCallback);
        };

        /**
         * Open the database
         *
         * @param {object} dbSpec - the database parameters
         */
        var openDatabase = function(dbSpec) {

            return window.sqlitePlugin.openDatabase(dbSpec,
                function(dbHandle) {
                    checkFirstRun(dbHandle);
                },
                function(error) {
                    // Maybe platform not supported (e.g. browser)
                    // @todo: more useful error message
                    alert('Error opening database: ' + JSON.stringify(error));
                    tables = emDefaultSchema;
                    // @todo: Better to reject? (=> would block browser platform
                    //        hence couldn't use it for basic debugging, therefore
                    //        currently resolving it, albeit into false)
                    dbStatus.resolve(false);
                }
            );
        };

        // Open the database on init
        var dbSpec = {name: 'emdb.db', location: 'default'},
            db = openDatabase(dbSpec);

        /**
         * Table API
         *
         * @param {string} tableName: the table name
         */
        function Table(tableName) {

            var self = this,
                schema = tables[tableName];

            var fields = Object.keys(schema).filter(function(fn) {
                return (fn[0] != '_');
            });

            self.tableName = tableName;
            self.schema = schema;
            self.fields = fields;

            /**
             * Add field defaults to a record
             *
             * @param {object} data - the record data
             * @param {boolean} visible - include only visible defaults
             *                            (i.e. fields with readable=true)
             * @param {boolean} update - use updateValue rather than defaultValue
             *
             * @returns {object} - a new object combining current record data
             *                     and default values
             */
            self.addDefaults = function(data, visible, update) {

                var fields = self.fields,
                    schema = self.schema,
                    attr = 'defaultValue',
                    record = {},
                    fieldName,
                    description,
                    defaultValue;

                if (update) {
                    attr = 'updateValue';
                }
                for (var i=0, len=fields.length; i < len; i++) {

                    fieldName = fields[i];
                    if (!data.hasOwnProperty(fieldName)) {
                        description = schema[fieldName];
                        defaultValue = description[attr];
                        if (visible && description.readable === false) {
                            continue;
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

            /**
             * Insert new records into this table
             *
             * @param {object} data - an object with the data to insert:
             *                        {fieldName: value}
             * @param {function} callback - callback function to process
             *                              the result: function(recordID)
             */
            self.insert = function(data, callback) {

                var record = self.addDefaults(data, false, false),
                    table = emSQL.Table(self.tableName, self.schema),
                    sql = table.insert(record);

                db.executeSql(sql[0], sql[1], function(result) {
                    if (callback) {
                        callback(result.insertId);
                    }
                }, errorCallback);
            };

            /**
             * Update records in this table
             *
             * @param {object} data - an object with the data to insert:
             *                        {fieldName: value}
             * @param {query} query - SQL WHERE expression
             * @param {function} callback - callback function to process
             *                              the result: function(rowsAffected)
             */
            self.update = function(data, query, callback) {

                var record = self.addDefaults(data, false, true),
                    table = emSQL.Table(self.tableName, self.schema),
                    sql = null;

                switch(arguments.length) {
                    case 2:
                        callback = query;
                        sql = table.update(record);
                        break;
                    default:
                        sql = table.update(record, query);
                        break;
                }

                db.executeSql(sql[0], sql[1], function(result) {
                    if (callback) {
                        callback(result.rowsAffected);
                    }
                }, errorCallback);
            };

            /**
             * Select records from this table
             *
             * @param {Array} fields - list of field names to extract
             * @param {string} query - SQL WHERE expression
             * @param {function} callback - callback function to process
             *                              the result: function(records, result),
             *                              where records is an Array with the
             *                              database items converted into form
             *                              data format
             */
            self.select = function(fields, query, callback) {

                var table = emSQL.Table(self.tableName, self.schema),
                    sql = null;

                // Flexible argument list (only callback is required)
                switch(arguments.length) {
                    case 1:
                        callback = fields;
                        fields = null;
                        sql = table.select();
                        break;
                    case 2:
                        callback = query;
                        sql = table.select(fields);
                        break;
                    default:
                        sql = table.select(fields, query);
                        break;
                }

                if (sql && callback) {
                    db.executeSql(sql, [], function(result) {
                        var records = [];
                        for (var i=0, len=result.rows.length; i<len; i++) {
                            var record = table.formData(fields, result.rows.item(i));
                            records.push(record);
                        }
                        callback(records, result);

                    }, errorCallback);
                }
            };

            /**
             * Delete records
             *
             * @param {string} query - SQL WHERE expression
             * @param {function} callback - callback function to process
             *                              the result: function(number)
             */
            self.deleteRecords = function(query, callback) {

                var table = emSQL.Table(self.tableName, self.schema),
                    sql = null;

                if (arguments.length == 1) {
                    callback = query;
                    sql = table.deleteRecords();
                } else {
                    sql = table.deleteRecords(query);
                }

                db.executeSql(sql, [], function(result) {
                    var number = result.rowsAffected;
                    if (callback) {
                        callback(number);
                    }
                }, errorCallback);
            };

            /**
             * Count records
             *
             * @param {string} query - SQL WHERE expression
             * @param {function} callback - callback function to process
             *                              the result: function(number)
             */
            self.count = function(query, callback) {

                var table = emSQL.Table(self.tableName, self.schema),
                    sql = null;

                if (arguments.length == 1) {
                    callback = query;
                    sql = table.count();
                } else {
                    sql = table.count(query);
                }

                db.executeSql(sql, [], function(result) {
                    var number = result.rows.item(0).number;
                    if (callback) {
                        callback(number);
                    }
                }, errorCallback);
            };
        }

        /**
         * UUID class representing an RFC 4122 v4 compliant unique identifier
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

        /**
         * String representation of a UUID
         */
        UUID.prototype.toString = function() {
            return this.uuid;
        };

        /**
         * URN representation of a UUID
         */
        UUID.prototype.urn = function() {
            return 'urn:uuid:' + this.uuid;
        };

        /**
         * The emDB API
         */
        var api = {

            /**
             * List of all table names in the current schema
             *
             * @returns {promise} a promise that resolves into an Array
             *                    of table names
             */
            tables: function() {
                return dbReady.then(function() {
                    var tableNames = [];
                    for (var tn in tables) {
                        if (tn[0] != '_' && tn.substring(0, 3) != 'em_') {
                            tableNames.push(tn);
                        }
                    }
                    return tableNames;
                }, apiNotReady);
            },

            /**
             * Table API
             *
             * @param {string} tableName - the tablename
             *
             * @returns {promise} a promise that resolves into an instance
             *                    of the table API for the requested table
             */
            table: function(tableName) {
                return dbReady.then(function() {
                    return new Table(tableName);
                }, apiNotReady);
            },

            /**
             * Generate a UUID
             *
             * @returns {UUID} a UUID instance
             */
            uuid: function() {
                return new UUID();
            }
        };
        return api;
    }
]);
