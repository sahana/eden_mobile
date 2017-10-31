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

        // --------------------------------------------------------------------
        // Read state params
        //
        var resourceName = $stateParams.resourceName,
            recordID = $stateParams.recordID,
            componentName = $stateParams.componentName;

        $scope.resourceName = resourceName;
        $scope.recordID = recordID;
        $scope.componentName = componentName;

        // --------------------------------------------------------------------
        /**
         * Redirection after successful create
         */
        var confirmCreate = function() {

            // Mark as saved
            $scope.saved = true;

            var normalEnd = function() {
                // Show confirmation popup and go back to list
                emDialogs.confirmation('Record created', function() {

                    var returnTo,
                        returnParams = {resourceName: resourceName};

                    if (!!componentName) {
                        // Go back to the component record list
                        returnTo = 'data.component';
                        returnParams.recordID = recordID;
                        returnParams.componentName = componentName;
                    } else {
                        // Go back to the master record list
                        returnTo = 'data.list';
                    }
                    $state.go(returnTo, returnParams, {location: 'replace'});
                });
            }

            emResources.open(resourceName).then(function(resource) {

                if (resource.settings.autoUpload) {
                    emDialogs.confirmAction('Sync', 'Are you ready to send this record?', function() {
                        // @ToDo:Sync this record back immediately
                        //$scope.formList = []; // Currently if forms is empty then it fetches a full list from server, so avoid that
                        // Build list of resources and ensure this list doesn't have the full list added
                        //$scope.resourceList = [];
                        //$scope.synchronize();
                        // Will be:
                        //resource.sync()

                        // Do normal end no matter the branch
                        normalEnd();
                    }, normalEnd);
                } else {
                    normalEnd();
                }
            });
        };

        // --------------------------------------------------------------------
        /**
         * Configure the form for the target resource
         *
         * @param {Resource} targetResource - the target resource
         */
        var configureForm = function(targetResource, componentKey) {

            var targetName = targetResource.name,
                tableName = targetResource.tableName;

            // Configure the form title
            var strings = targetResource.strings,
                formTitle = targetName;
            if (strings) {
                formTitle = strings.name || formTitle;
            }
            $scope.formTitle = formTitle;

            // Configure the submit-function
            $scope.submit = function(form) {
                // Check if empty (@todo: form onvalidation)
                var empty = true;
                for (var field in form) {
                    if (form[field] !== undefined && form[field] !== null) {
                        empty = false;
                        break;
                    }
                }
                if (!empty) {
                    // Add component parent link
                    if (!!componentKey) {
                        form[componentKey] = recordID;
                    }
                    // Commit to database and redirect to list
                    targetResource.insert(form, confirmCreate);
                }
            };

            // Populate scope with default values
            var master = $scope.master,
                form = $scope.form,
                data = targetResource.addDefaults({}, true, false),
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
        };

        // --------------------------------------------------------------------
        /**
         * Initialize scope
         */
        var initForm = function() {

            // Start with empty master (populated asynchronously)
            $scope.master = {};
            $scope.saved = false;

            // Reset the form (@todo: expose reset in UI?)
            $scope.reset = function() {
                $scope.form = angular.copy($scope.master);
                $scope.pendingFiles = [];
                $scope.orphanedFiles = [];
            };
            $scope.reset();

            // Click-handler for return-to-list button
            $scope.returnToList = function() {

                var returnTo,
                    returnParams = {resourceName: resourceName};

                if (componentName) {
                    // Go back to the component record list
                    returnTo = 'data.component';
                    returnParams.recordID = recordID;
                    returnParams.componentName = componentName;
                } else {
                    // Go back to the master record list
                    returnTo = 'data.list';
                }
                $state.go(returnTo, returnParams, {location: 'replace'});
            };

            // Access the resource, then populate the form
            emResources.open(resourceName).then(function(resource) {
                if (!!componentName) {
                    var hook = resource.components[componentName],
                        componentKey = hook.joinby;
                    resource.openComponent(recordID, componentName,
                        function(component) {
                            // Configure for component-create
                            configureForm(component, componentKey);
                        },
                        function(error) {
                            // Undefined component
                            emDialogs.error(error, null, function() {
                                // Go back to master record
                                $state.go('data.update',
                                    {resourceName: resourceName, recordID: recordID},
                                    {location: 'replace', reload: true});
                            });
                        });
                } else {
                    // Configure for master-create
                    configureForm(resource);
                }
            });
        };

        // --------------------------------------------------------------------
        // Init on enter
        $scope.$on('$ionicView.enter', initForm);

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
    }
]);

// END ========================================================================
