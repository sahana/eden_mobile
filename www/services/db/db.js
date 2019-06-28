/**
 * Sahana Eden Mobile - Database Service
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

EdenMobile.factory('emDB', [
    '$q', 'emDefaultSchema', 'Field', 'Table',
    function ($q, emDefaultSchema, Field, Table) {

        "use strict";

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
            adapter.executeSql(sql, [], function() {

                sql = 'SELECT DISTINCT tbl_name FROM sqlite_master WHERE tbl_name = "em_version"';
                adapter.executeSql(sql, [], function(result) {

                    if (result.rows.length) {
                        // em_version table exists => load tables
                        self._loadTables().then(
                            function() {
                                status.resolve();
                            },
                            function(error) {
                                status.reject(error);
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
                tableData,
                tableName,
                table,
                schema = parseSchema(emDefaultSchema.schema('em_schema')),
                schemaTable = new Table(self, 'em_schema', schema.fields);

            schemaTable.select(['name', 'fields', 'settings'],
                function(rows) {
                    if (!rows.length) {
                        tablesLoaded.reject('no table schemas found');
                        return;
                    }
                    rows.forEach(function(row) {

                        tableData = row._(schemaTable);
                        tableName = tableData.name;

                        schema = parseSchema(tableData.fields);

                        table = new Table(self, tableName, schema.fields, tableData.settings);
                        table.addMetaFields();

                        tables[tableName] = table;
                    });
                    tablesLoaded.resolve();
                },
                function(error) {
                    tablesLoaded.reject(error);
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

            throw new Error(error);
        };

        var api = {

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
