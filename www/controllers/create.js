/**
 * Sahana Eden Mobile - Create-Form Controller
 *
 * Copyright (c) 2016-2017: Sahana Software Foundation
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
 * Create-Form Controller
 *
 * @class EMDataCreate
 * @memberof EdenMobile
 */
EdenMobile.controller('EMDataCreate', [
    '$scope', '$state', '$stateParams', 'emDialogs', 'emFiles', 'emResources',
    function($scope, $state, $stateParams, emDialogs, emFiles, emResources) {

        var resourceName = $stateParams.resourceName;

        $scope.resourceName = resourceName;

        var showCreateForm = function() {

            // Start with empty master (populated asynchronously)
            $scope.master = {};
            $scope.saved = false;

            // Clean up on exit
            $scope.$on('$destroy', function() {
                if ($scope.saved) {
                    // Record saved => remove orphaned files
                    emFiles.removeAll($scope.orphanedFiles);
                } else {
                    // Record not saved => remove pending files
                    emFiles.removeAll($scope.pendingFiles);
                }
            });

            // Read default values from schema
            emResources.open(resourceName).then(function(resource) {

                var master = $scope.master,
                    form = $scope.form;

                // Set the form title
                var strings = resource.strings,
                    formTitle = resourceName;
                if (strings) {
                    formTitle = strings.name || formTitle;
                }
                $scope.formTitle = formTitle;

                // Set default values in form
                var data = resource.addDefaults({}, true, false),
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

                // Mark as saved
                $scope.saved = true;

                // Show confirmation popup and go back to list
                emDialogs.confirmation('Record created', function() {
                    $state.go('data.list',
                        {resourceName: $scope.resourceName},
                        {location: 'replace', reload: true}
                    );
                });
            };

            // Submit-function
            $scope.submit = function(form) {

                emResources.open(resourceName).then(function(resource) {

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
                        resource.insert(form, confirmCreate);
                    }
                });
            };

            // @todo: expose reset in UI
            $scope.reset = function() {
                $scope.form = angular.copy($scope.master);
                $scope.pendingFiles = [];
                $scope.orphanedFiles = [];
            };

            // Initial reset
            $scope.reset();
        };

        $scope.$on('$ionicView.enter', showCreateForm);
    }
]);

// END ========================================================================
