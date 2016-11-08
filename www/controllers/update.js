/**
 * Sahana Eden Mobile - Update-Form Controller
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
 * Update-Form Controller
 *
 * @class EMDataUpdate
 * @memberof EdenMobile
 */
EdenMobile.controller("EMDataUpdate", [
    '$scope', '$state', '$stateParams', 'emDialogs', 'emResources',
    function($scope, $state, $stateParams, emDialogs, emResources) {

        var resourceName = $stateParams.resourceName,
            recordID = $stateParams.recordID;

        $scope.resourceName = resourceName;
        $scope.recordID = recordID;

        var showUpdateForm = function() {

            // Start with empty master (populated asynchronously)
            $scope.master = {};

            // Read current values from database
            emResources.open(resourceName).then(function(resource) {

                var tableName = resource.tableName,
                    query = tableName + '.id=' + recordID;

                var master = $scope.master,
                    form = $scope.form;

                // Set the form title
                var strings = resource.strings,
                    formTitle = resourceName;
                if (strings) {
                    formTitle = strings.name || listTitle;
                }
                $scope.formTitle = formTitle;

                // Extract current record

                var fields = resource.fields,
                    fieldNames = Object.keys(fields);

                resource.select(fieldNames, query, function(records, result) {
                    if (records.length == 1) {
                        // Write current data into both master and form
                        var row = records[0],
                            field,
                            fieldName,
                            value;
                        for (fieldName in fields) {
                            field = fields[fieldName]
                            if (!field.readable) {
                                continue;
                            }
                            value = row[fieldName];
                            if (value !== undefined) {
                                master[fieldName] = value;
                                form[fieldName] = value;
                            }
                        }
                        // Update scope
                        $scope.$apply();
                    } else {
                        // Show error popup, then go back to list
                        emDialogs.error('Record not found', null, function() {
                            $state.go('data.list',
                                {resourceName: $scope.resourceName},
                                {location: 'replace'}
                            );
                        });
                    }
                });
            });

            // Confirmation message for successful update
            var confirmUpdate = function(recordID) {
                // Show confirmation popup and go back to list
                emDialogs.confirmation('Record updated', function() {
                    $state.go('data.list',
                        {resourceName: $scope.resourceName},
                        {location: 'replace'}
                    );
                });
            };

            // Submit function
            $scope.submit = function(form) {

                emResources.open(resourceName).then(function(resource) {

                    var query = resource.tableName + '.id=' + recordID;

                    // @todo: validate
                    var empty = true;
                    for (var fieldName in form) {
                        if (form[fieldName] !== undefined && form[fieldName] !== null) {
                            empty = false;
                            break;
                        }
                    }
                    if (!empty) {
                        // Copy to master (only useful if not changing state)
                        //$scope.master = angular.copy(form);

                        // Commit to database and confirm
                        resource.update(form, query, confirmUpdate);
                    }
                });
            };

            // Confirmation message for successful delete
            var confirmDelete = function(rowsAffected) {
                // Show confirmation popup and go back to list
                // @todo: should this actually check that rowsAffected is 1?
                emDialogs.confirmation('Record deleted', function() {
                    $state.go('data.list',
                        {resourceName: $scope.resourceName},
                        {location: 'replace'}
                    );
                });
            };

            // Delete-action
            $scope.deleteRecord = function() {

                emDialogs.confirmAction(
                    'Delete Record',
                    'Are you sure you want to delete this record?',
                    function() {
                        emResource.open(resourceName).then(function(resource) {
                            resource.deleteRecords(query, confirmDelete);
                        });
                    }
                );
            };

            // @todo: expose reset in UI
            $scope.reset = function() {
                $scope.form = angular.copy($scope.master);
            };

            // Initial reset
            $scope.reset();
        };

        $scope.$on('$ionicView.enter', showUpdateForm);
    }
]);

// END ========================================================================
