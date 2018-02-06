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

// ============================================================================
/**
 * Create-Form Controller
 *
 * @class EMDataCreate
 * @memberof EdenMobile
 */
EdenMobile.controller('EMDataCreate', [
    '$q', '$scope', '$state', '$stateParams', 'emDialogs', 'emFiles', 'emResources',
    function($q, $scope, $state, $stateParams, emDialogs, emFiles, emResources) {

        "use strict";

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
                });
            };

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
         * @param {Subset} subset - the subset of the target resource where
         *                          to add the record
         */
        var configureForm = function(subset) {

            var resource = subset.resource;

            // Set form title
            $scope.formTitle = resource.getLabel();

            // Configure the submit-function
            $scope.submit = function(form) {

                // Broadcast form submission
                $scope.$broadcast('FormSubmission');

                // Proceed when all form data are ready for submission
                $q.all(form).then(function(formData) {
                    console.log(formData);
                    // Check if empty (@todo: form onvalidation)
                    var empty = true;
                    for (var fn in formData) {
                        if (formData[fn] !== undefined && formData[fn] !== null) {
                            empty = false;
                            break;
                        }
                    }
                    if (!empty) {
                        subset.insert(formData).then(
                            function() {
                                confirmCreate();
                            },
                            function(error) {
                                emDialogs.error('Could not create record', error, $scope.returnToParentView);
                            });
                    }
                });
            };

            // Populate scope with default values
            var master = $scope.master,
                form = $scope.form,
                data = resource.addDefaults({}, true, false),
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

            // Click-handler for back-button
            var onReturn = $q.defer();
            $scope.returnToParentView = function() {
                onReturn.promise.then(function(returnTo) {
                    $state.go(returnTo.state, returnTo.params, {
                        location: 'replace'
                    });
                });
            };

            // Access the resource, then populate the form
            emResources.open(resourceName).then(function(resource) {

                // Determine where to return to upon "Back"
                // - default: return to master record list
                var component,
                    returnState = 'data.list',
                    returnParams = {resourceName: resourceName};

                if (componentName) {
                    returnParams.recordID = recordID;
                    component = resource.component(componentName);
                    if (!component) {
                        // Undefined component:
                        // - show error message, then return to master immediately
                        returnState = 'data.update';
                        emDialogs.error('Undefined component', componentName,
                            function() {
                                $scope.returnToParentView();
                            });
                    } else if (component.multiple) {
                        // Return to component record list
                        returnState = 'data.component';
                        returnParams.componentName = componentName;
                    } else {
                        // Return to master record update-form
                        returnState = 'data.update';
                    }
                }
                onReturn.resolve({state: returnState, params: returnParams});

                if (componentName) {
                    // Open component form
                    configureForm(component.subSet(recordID));
                } else {
                    // Open master form
                    configureForm(resource.subSet());
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
