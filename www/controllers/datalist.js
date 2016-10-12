/**
 * Sahana Eden Mobile - Data List Controller and Directives
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
 * Data List Controller
 */
EdenMobile.controller("EdenMobileDataList", [
    '$scope', '$stateParams', '$emdb',
    function($scope, $stateParams, $emdb) {

        var formName = $stateParams.formName;

        $emdb.table(formName).then(function(table) {

            // @todo: check that we have a schema for table,
            // otherwise raise error and return to form list

            // Pass formName to scope
            $scope.formName = formName;

            // Get strings
            var strings = table.schema._strings,
                listTitle = formName;
            if (strings) {
                listTitle = strings.namePlural || strings.name || listTitle;
            }
            $scope.listTitle = listTitle;

            // Read card config
            var cardConfig = table.schema._card,
                fields;
            if (cardConfig) {
                fields = cardConfig.fields;
            }

            // Apply fallbacks
            if (!fields) {
                // Get all fields
                fields = [];
                for (var fieldName in table.schema) {
                    if (fieldName[0] != '_') {
                        fields.push(fieldName);
                    }
                }
            }

            // Make sure 'id' field is loaded (required by directive)
            if (fields.indexOf('id') == -1) {
                fields.push('id');
            }

            // Select all existing records
            $scope.records = [];
            table.select(fields, function(records, result) {
                $scope.records = records;
                $scope.$apply();
            });
        });
    }
]);

