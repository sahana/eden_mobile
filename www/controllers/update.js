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
    '$scope', '$state', '$stateParams', 'emDialogs', 'emFiles', 'emResources',
    function($scope, $state, $stateParams, emDialogs, emFiles, emResources) {

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
         * @param {Resource} targetResource: the target resource
         * @param {string} query: the component query (in component view)
         * @param {integer} targetID: the target record ID
         */
        var configureForm = function(targetResource, query, targetID) {

            var targetName = targetResource.name,
                tableName = targetResource.tableName;

            // Enable component menu when updating a master record
            if (targetName == resourceName) {
                if (Object.keys(targetResource.components).length) {
                    $scope.hasComponents = true;
                    $scope.openComponents = function($event) {
                        emDialogs.componentMenu($scope, $event, targetResource);
                    };
                }
            }

            // Configure the form title
            var strings = targetResource.strings,
                formTitle = targetName;
            if (strings) {
                formTitle = strings.name || formTitle;
            }
            $scope.formTitle = formTitle;

            // Configure submit-function
            $scope.submit = function(form) {
                // Check if empty (@todo: form onvalidation)
                var empty = true;
                for (var fieldName in form) {
                    if (form[fieldName] !== undefined && form[fieldName] !== null) {
                        empty = false;
                        break;
                    }
                }
                if (!empty) {
                    // Commit to database, then redirect
                    var table = targetResource.table;
                    table.where(table.$('id').equals(targetID)).update(form,
                        function() {
                            onUpdate();
                        });
                }
            };

            // Configure delete-action
            $scope.deleteRecord = function() {
                emDialogs.confirmAction(
                    'Delete Record',
                    'Are you sure you want to delete this record?',
                    function() {
                        var table = targetResource.table;
                        table.where(table.$('id').equals(targetID)).delete(
                            function() {
                                onDelete();
                            });
                    });
            };

            // Construct the query
            var recordQuery = tableName + '.id=' + targetID;
            if (!!query) {
                query = query + ' AND ' + recordQuery;
            } else {
                query = recordQuery;
            }

            // Extract current record and populate form and master
            var fields = targetResource.fields,
                fieldNames = Object.keys(fields),
                master = $scope.master,
                form = $scope.form;
            targetResource.select(fieldNames, query, function(records, result) {
                if (records.length == 1) {

                    // Prepopulare the scope with current record data
                    var row = records[0],
                        field,
                        fieldName,
                        value;
                    for (fieldName in fields) {
                        field = fields[fieldName];
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

            // Initialize Components Menu
            if ($scope.componentMenu) {
                $scope.componentMenu.remove();
                $scope.componentMenu = null;
            }
            $scope.hasComponents = false;
            $scope.openComponents = null;

            // Access the resource, then populate the form
            emResources.open(resourceName).then(function(resource) {

                if (!!componentName) {
                    resource.openComponent(recordID, componentName,
                        function(component, query) {
                            // Configure for component record
                            configureForm(component, query, componentID);
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
                    // Configure for master record
                    configureForm(resource, null, recordID);
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
