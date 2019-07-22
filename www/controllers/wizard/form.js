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
 * @class EMFormWizard
 * @memberof EdenMobile
 */
EdenMobile.controller("EMFormWizard", [
    '$scope', '$state', '$stateParams', 'emResources',
    function($scope, $state, $stateParams, emResources) {

        "use strict";

        var resourceName = $stateParams.resourceName,
            recordID = $stateParams.recordID;

        emResources.open(resourceName).then(function(resource) {

            // Set top bar title
            $scope.title = resource.getLabel(true);

            // Mockup form info
            // TODO retrieve the resource information
            // TODO implement service to deliver the form config
            $scope.formConfig = [
                [
                    {type: 'input', field: 'field1'},
                    {type: 'input', field: 'field2'},
                    {type: 'input', field: 'field3'},
                ],
                [
                    {type: 'input', field: 'field4'},
                    {type: 'input', field: 'field5'},
                ],
                [
                    {type: 'input', field: 'field6'},
                ],
            ];

            // Populate the form data
            // TODO retrieve the actual record
            $scope.recordStatus = {
                recordID: recordID,
                incomplete: !recordID,
            }
            $scope.formData = {
                field1: 'value1',
                field2: 'value2',
                field3: 'value3',
                field4: 'value4',
                field5: 'value5',
                field6: 'value6'
            };

            // TODO document what this is for
            $scope.formStatus = {
                activeSection: 0,
                final: false
            };

            // TODO provide a scope method to interim-save the record

            // Open the form
            // TODO pass section as parameter
            // TODO $state.go only when resource/record info ready
            $state.go('wizard.form', {reload: true});

        });
    }
]);

// END ========================================================================
