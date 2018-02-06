/**
 * Sahana Eden Mobile - Update-Form Controller
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
 * Update-Form Controller
 *
 * @class EMDataUpdate
 * @memberof EdenMobile
 */
EdenMobile.controller("EMDataUpdate", [
    '$q', '$scope', '$state', '$stateParams', 'emDB', 'emDialogs', 'emFiles', 'emResources',
    function($q, $scope, $state, $stateParams, emDB, emDialogs, emFiles, emResources) {

        "use strict";

        // --------------------------------------------------------------------
        /**
         * Redirection upon successful update/delete action
         *
         * @param {string} resourceName: the master resource name
         * @param {integer} recordID: the master record ID (in component view)
         * @param {string} componentName: the component name (in component view)
         */
        var confirmAction = function(message, resourceName, recordID, componentName) {

            // Mark as saved
            $scope.saved = true;

            // Show confirmation popup and go back to list
            emDialogs.confirmation(message, function() {

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
        };

        // --------------------------------------------------------------------
        /**
         * Callback after successful update
         */
        var onUpdate = function() {
            confirmAction('Record updated',
                resourceName,
                recordID,
                componentName);
        };

        // --------------------------------------------------------------------
        /**
         * Callback after successful delete
         */
        var onDelete = function() {
            confirmAction('Record deleted',
                resourceName,
                recordID,
                componentName);
        };

        // --------------------------------------------------------------------
        // Read state params
        var resourceName = $stateParams.resourceName,
            recordID = $stateParams.recordID,
            componentName = $stateParams.componentName,
            componentID = $stateParams.componentID;

        $scope.resourceName = resourceName;
        $scope.recordID = recordID;
        $scope.componentName = componentName;

        // --------------------------------------------------------------------
        /**
         * Configure and populate the scope with the target record
         *
         * @param {Subset} subset: the subset containing the target record
         * @param {integer} targetID: the target record ID
         */
        var configureForm = function(subset, targetID) {

            var resource = subset.resource;

            // Enable component menu when updating a master record
            if (!resource.parent) {
                if (Object.keys(resource.activeComponents).length) {
                    $scope.hasComponents = true;
                    $scope.openComponents = function($event) {
                        emDialogs.componentMenu($scope, $event, resource);
                    };
                }
            }

            // Set form title
            $scope.formTitle = resource.getLabel();

            // Configure submit-function
            $scope.submit = function(form) {

                // Broadcast form submission
                $scope.$broadcast('FormSubmission');

                // Proceed when all form data are ready for submission
                $q.all(form).then(function(formData) {
                    console.log(formData);
                    var empty = true;
                    for (var fn in formData) {
                        if (formData[fn] !== undefined && formData[fn] !== null) {
                            empty = false;
                            break;
                        }
                    }
                    if (!empty) {
                        // Commit to database, then redirect
                        table.where(table.$('id').equals(targetID)).update(formData,
                            function() {
                                onUpdate();
                            });
                    }
                });
            };

            // Configure delete-action
            $scope.deleteRecord = function() {
                emDialogs.confirmAction(
                    'Delete Record',
                    'Are you sure you want to delete this record?',
                    function() {
                        var table = resource.table;
                        table.where(table.$('id').equals(targetID)).delete(
                            function() {
                                onDelete();
                            });
                    });
            };

            // Extract current record and populate form and master
            var table = subset.table,
                fields = resource.fields,
                fieldNames = Object.keys(fields),
                master = $scope.master,
                form = $scope.form;

            subset.where(table.$('id').equals(targetID))
                  .select(fieldNames, {limitby: 1}).then(function(rows) {

                if (rows.length == 1) {
                    // Prepopulate the scope with current record data
                    var record = rows[0]._(),
                        field,
                        fieldName,
                        value;
                    for (fieldName in fields) {
                        field = fields[fieldName];
                        if (!field.readable && fieldName != 'llrepr') {
                            continue;
                        }
                        value = record[fieldName];
                        if (value !== undefined) {
                            master[fieldName] = value;
                            form[fieldName] = value;
                        }
                    }
                } else {
                    // Show error popup, then go back to list
                    emDialogs.error('Record not found', null, function() {

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
                }
            });
        };

        // --------------------------------------------------------------------
        /**
         * Initialize the scope
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

            // Initialize Components Menu
            if ($scope.componentMenu) {
                $scope.componentMenu.remove();
                $scope.componentMenu = null;
            }
            $scope.hasComponents = false;
            $scope.openComponents = null;

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
                    // Open component record
                    configureForm(component.subSet(recordID), componentID);
                } else {
                    // Open master record
                    configureForm(resource.subSet(), recordID);
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
