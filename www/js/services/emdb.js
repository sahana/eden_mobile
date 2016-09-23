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

EdenMobile.factory('$emdb', [function () {

    // @status: work in progress

    /**
     * The table definitions
     */
    var tables = {};

    /**
     * Generic error callback for database transactions
     *
     * @param {object} error - the error object
     */
    var errorCallback = function(error) {
        alert("Error processing SQL: " + JSON.stringify(error));
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
            schema = {};

        // Serialize the schema (skip prepop records)
        for (var prop in tableSpec) {
            if (prop != '_records') {
                schema[prop] = tableSpec[prop];
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
        var table = emSQL.Table(tableName, schema);
        db.sqlBatch([
                table.drop(),
                table.create()
            ], function() {

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
                    db.sqlBatch(prepop, callback, errorCallback);
                } else if (callback) {
                    callback();
                }

            }, errorCallback
        );
    };

    /**
     * Populate the database on first run
     *
     * @param {object} db - the database handle
     */
    var firstRun = function(db) {

        // alert('First run!');

        defineTable(db, 'em_schema', emDefaultSchema.em_schema);
        defineTable(db, 'em_version', emDefaultSchema.em_version);
    };

    /**
     * Check whether database has already been populated
     *
     * @param {object} db - the database handle
     */
    var checkFirstRun = function(db) {

        // Check if em_version table exists
        db.executeSql('SELECT DISTINCT tbl_name FROM sqlite_master WHERE tbl_name = "em_version"', [],
            function(result) {
                if (!result.rows.length) {
                    firstRun(db);
                } else {
                    // alert('Database already populated!');
                    // @todo: check schema version and handle schema migrations
                    // @todo: read schemas from em_schema table
                }
            },
            errorCallback
        );
    };

    /**
     * Open the database
     *
     * @param {object} dbSpec - the database parameters
     */
    var openDatabase = function(dbSpec) {

        var db = null;

        window.sqlitePlugin.openDatabase(dbSpec,
            function(dbHandle) {
                db = dbHandle;
                // alert("Successfully opened database!");
                checkFirstRun(db);
            },
            function(error) {
                // Maybe platform not supported (e.g. browser)
                alert('Error opening database: ' + JSON.stringify(error));
            }
        );

        return db;

    };

    /**
     * Table API
     *
     * @todo: implement this
     *
     * @param {string} tableName: the table name
     */
    function Table(tableName) {

        var self = this;

        self.tableName = tableName;
        self.schema = tables[tableName];
    }

    // Open the database on init
    var dbSpec = {
        name: 'emdb.db',
        location: 'default'
    };
    var db = openDatabase(dbSpec);

    /**
     * The $emdb API
     */
    var api = {

        // @todo: Implement API methods
    };
    return api;

}]);
