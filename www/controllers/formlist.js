/**
 * Sahana Eden Mobile - Data Forms Controllers
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
 * List of forms
 */
EdenMobile.controller("EMFormList", [
    '$scope', '$stateParams', 'emDB',
    function($scope, $stateParams, emDB) {

        emDB.tables().then(function(tableNames) {

            var forms = [],
                tableName;

            for (var i=0, len=tableNames.length; i<len; i++) {

                tableName = tableNames[i];
                emDB.table(tableName).then(function(table) {
                    // Count records in table, then update scope
                    table.count(function(number) {
                        forms.push({
                            formName: tableName,
                            numRows: number
                        });
                        $scope.$apply();
                    });
                });
            }
            $scope.forms = forms;
        });
    }
]);

