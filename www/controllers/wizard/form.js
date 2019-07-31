/**
 * Sahana Eden Mobile - Form Wizard Controller
 *
 * Copyright (c) 2019-2019 Sahana Software Foundation
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
 * Form Wizard Controller
 *
 * @class EMFormWizardController
 * @memberof EdenMobile
 */
EdenMobile.controller("EMFormWizardController", [
    '$q', '$scope', '$state', '$stateParams', 'emDialogs', 'emFiles', 'emFormWizard', 'emResources',
    function($q, $scope, $state, $stateParams, emDialogs, emFiles, emFormWizard, emResources) {

        "use strict";

        var resourceName = $stateParams.resourceName,
            recordID = $stateParams.recordID;

        // --------------------------------------------------------------------
        /**
         * Retrieve the record (or defaults) to populate the form
         *
         * @param {Resource} resource - the Resource
         * @param {integer} recordID - the record ID
         *
         * @returns {promise} - a promise that resolves into the form data
         */
        var retrieveRecord = function(resource, recordID) {

            var data = {},
                table = resource.table,
                fields = resource.fields;

            if (recordID) {

                // Extract the record, populate the data from it
                return resource.where(table.$('id').is(recordID))
                               .select(Object.keys(fields), {limitby: 1})
                               .then(function(rows) {

                    var record = rows[0]._(),
                        fieldName,
                        field,
                        value;

                    for (fieldName in fields) {
                        field = fields[fieldName];
                        if (!field.readable && fieldName != 'llrepr') {
                            continue;
                        }
                        value = record[fieldName];
                        if (value !== undefined) {
                            data[fieldName] = value;
                        }
                    }
                    return data;
                });

            } else {

                // Populate data from defaults
                return $q.resolve(resource.addDefaults(data, true, false));
            }
        };

        // --------------------------------------------------------------------
        /**
         * Show a confirmation message after submit and return to caller
         */
        var confirmSubmit = function() {

            // Where to go
            // TODO make configurable
            var returnTo = 'surveys',
                returnParams = {};

            // The confirmation message
            var message;
            if (recordID == 0) {
                message = 'Response submitted';
            } else {
                message = 'Response updated';
            }

            // Mark as saved
            $scope.saved = true;

            // Show confirmation dialog, then return to survey list
            emDialogs.confirmation(message, function() {
                $state.go(returnTo, returnParams, {location: 'replace'});
            });
        };

        // --------------------------------------------------------------------
        // TODO implement this
        var interimSave = function(form) {

        };

        // --------------------------------------------------------------------
        /**
         * Submit the current form
         *
         * @param {Resource} resource - the Resource
         * @param {object} form - the form data (from $scope)
         */
        var submitForm = function(resource, form) {

            // Broadcast form submission
            // - this will prompt widgets to finalize their input values
            $scope.$broadcast('FormSubmission');

            // Proceed when all form values are ready for submission
            // - some form.* could be promises
            $q.all(form).then(function(values) {

                console.log(values);

                // Check if empty (@todo: form onvalidation)
                var empty = true;
                for (var fn in values) { // we should use fieldName instead of fn
                    if (values[fn] !== undefined && values[fn] !== null) {
                        empty = false;
                        break;
                    }
                }

                // Save and return to caller (if form is empty, do nothing)
                if (!empty) {
                    resource.subSet().insert(values).then(
                        function() {
                            confirmSubmit();
                        },
                        function(error) {
                            emDialogs.error('Could not create record', error, function() {
                                // TODO make configurable
                                $state.go('surveys');
                            });
                        });
                }
            });
        };

        // --------------------------------------------------------------------
        /**
         * Cancel the data entry, and return to the survey list
         */
        var cancelWizard = function() {

            emDialogs.confirmAction(
                'End Survey',
                'All data in this response will be lost once you exit, are you sure you want to continue?',
                {okText: 'End Survey', okType: 'button-energized'},
                function() { // Confirmed

                    // TODO Discard record if it has an ID and is marked incomplete

                    // Go back to survey list
                    // TODO make configurable
                    $state.go('surveys');
                });
        };

        // --------------------------------------------------------------------
        // Initialize the wizard
        //
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

            emResources.open(resourceName).then(function(resource) {

                // Set top bar title
                $scope.title = resource.getLabel(true);
                $scope.resource = resource;

                // Get the form configuration
                var formConfig = emFormWizard.getSections(resource);

                // Store form configuration and status in scope
                $scope.formConfig = formConfig;
                $scope.formStatus = {
                    activeSection: 0,
                    prev: false,
                    next: formConfig.length > 1
                };

                // Provide scope methods for submit, interimSave and cancel
                $scope.submit = function(form) {
                    submitForm(resource, form);
                };
                $scope.interimSave = interimSave;
                $scope.cancel = cancelWizard;

                // Populate, then open the form
                retrieveRecord(resource, recordID).then(function(data) {
                    $scope.recordStatus = {
                        recordID: recordID,
                        incomplete: !recordID,
                    };
                    $scope.master = data;
                    $scope.form = angular.copy($scope.master);

                    // Open the form
                    $state.go('wizard.form', {section: 0});
                });
            });
        };

        // --------------------------------------------------------------------
        // Main Process
        //

        // Init on view-enter
        $scope.$on('$ionicView.enter', function(event, data) {
            if (data.stateName == 'wizard') {
                initForm();
            }
        });

        // Clean up on destroy
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
