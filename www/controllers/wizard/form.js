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
    '$q', '$scope', '$state', '$stateParams', 'emDialogs', 'emFormWizard', 'emResources',
    function($q, $scope, $state, $stateParams, emDialogs, emFormWizard, emResources) {

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

            var formData = {},
                table = resource.table,
                fields = resource.fields;

            if (recordID) {

                // Extract the record, then populate formData from it
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
                            formData[fieldName] = value;
                        }
                    }
                    return formData;
                });

            } else {

                // Populate formData from defaults
                return $q.resolve(resource.addDefaults(formData, true, false));
            }
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
                    $state.go('surveys');
                });
        };

        // --------------------------------------------------------------------
        // Main process
        //
        emResources.open(resourceName).then(function(resource) {

            // Set top bar title
            $scope.title = resource.getLabel(true);

            // Get the form configuration
            var formConfig = emFormWizard.getSections(resource);

            // Store form configuration and status in scope
            $scope.formConfig = formConfig;
            $scope.formStatus = {
                activeSection: 0,
                prev: false,
                next: formConfig.length > 1
            };

            // TODO provide a scope method to interim-save the record

            // Provide a scope method to cancel the data entry
            $scope.cancel = cancelWizard;

            // TODO provide a scope method to submit the response

            // Populate the form data, then open the form
            retrieveRecord(resource, recordID).then(function(formData) {
                $scope.recordStatus = {
                    recordID: recordID,
                    incomplete: !recordID,
                };
                $scope.formData = formData;

                // Open the form
                $state.go('wizard.form', {section: 0});
            });
        });
    }
]);

// END ========================================================================
