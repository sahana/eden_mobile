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
     * The EdenMobile database schema version
     */
    var emdbVersion = '1';

    /**
     * Generic error callback for database transactions
     *
     * @param {object} error: the error object
     */
    var errorCallback = function(error) {
        alert("Error processing SQL: " + JSON.stringify(error));
    };

    /**
     * Populate the database on first run
     *
     * @param {object} db - the database handle
     */
    var firstRun = function(db) {

        alert('First run!');
        db.sqlBatch([
                'DROP TABLE IF EXISTS em_version',
                'CREATE TABLE em_version (version CHAR(8) NOT NULL)',
                ['INSERT INTO em_version (version) VALUES (?)', [emdbVersion]],
            ], function() {
                alert('Database populated!');
            }, errorCallback
        );
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
                    alert('Database already populated!');
                    // @todo: check schema version and handle schema migrations
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
                alert("Successfully opened database!");
                checkFirstRun(db);
            },
            function(error) {
                alert('Error opening database: ' + JSON.stringify(error));
            }
        );

        return db;

    };

    // Open the database on init
    var dbSpec = {
        name: 'emdb.db',
        location: 'default'
    };
    var db = openDatabase(dbSpec);

    // Define service methods
    var emdb = {

        // Implement service methods

    };
    return emdb;

}]);
