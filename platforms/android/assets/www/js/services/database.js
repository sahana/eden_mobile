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

EdenMobile.factory('EMDatabase', [function () {

    // @status: work in progress

    var dbSpec = {
        name: 'eden_mobile.db',
        location: 'default'
    };

    var errorCallback = function(error) {
        alert("Error processing SQL: " + error.code);
    };

    var prepareDB = function() {

        var db = window.sqlitePlugin.openDatabase(dbSpec,
            function() {
                alert("Successfully opened database!");
            },
            function(error) {
                alert('Error opening database: ' + JSON.stringify(error));
            }
        );

        db.executeSql('SELECT DISTINCT tbl_name FROM sqlite_master WHERE tbl_name = "em_schema_version"', [],
            function(result) {
                alert("Results: " + result.rows.length);
            },
            errorCallback
        );
        return db;

    };

    prepareDB();

    var EMDatabase = {

    };
    return EMDatabase;

}]);
