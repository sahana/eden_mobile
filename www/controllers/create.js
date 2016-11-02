/**
 * Sahana Eden Mobile - Create-Form Controller
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
 * Create-Form Controller
 */
EdenMobile.controller('EMDataCreate', [
    '$scope', '$state', '$stateParams', 'emDB', 'emDialogs',
    function($scope, $state, $stateParams, emDB, emDialogs) {

        var formName = $stateParams.formName;

        $scope.formName = formName;

        // Start with empty master (populated asynchronously)
        $scope.master = {};

        // Read default values from schema
        emDB.table(formName).then(function(table) {

            var schema = table.schema,
                master = $scope.master,
                form = $scope.form;

            // Set the form title
            var strings = schema._strings,
                formTitle = formName;
            if (strings) {
                formTitle = strings.name || listTitle;
            }
            $scope.formTitle = formTitle;

            // Set default values in form
            var data = table.addDefaults({}, true, false),
                fieldName,
                value;
            for (fieldName in data) {
                value = data[fieldName];
                if (value !== undefined) {
                    if (master[fieldName] === undefined) {
                        master[fieldName] = value;
                    }
                    if (form[fieldName] === undefined) {
                        form[fieldName] = value;
                    }
                }
            }
        });

        // Confirmation message for successful create
        var confirmCreate = function(recordID) {
            // Show confirmation popup and go back to list
            emDialogs.confirmation('Record created', function() {
                $state.go('data.list',
                    {formName: $scope.formName},
                    {location: 'replace'}
                );
            });
        };

        // Submit-function
        $scope.submit = function(form) {

            emDB.table(formName).then(function(table) {

                // @todo: validate
                var empty = true;
                for (var field in form) {
                    if (form[field] !== undefined && form[field] !== null) {
                        empty = false;
                        break;
                    }
                }
                if (!empty) {
                    // Copy to master (only useful if not changing state)
                    //$scope.master = angular.copy(form);

                    // Commit to database and confirm
                    table.insert(form, confirmCreate);
                }
            });
        };

        // @todo: expose reset in UI
        $scope.reset = function() {
            $scope.form = angular.copy($scope.master);
        };

        // Initial reset
        $scope.reset();
    }
]);
