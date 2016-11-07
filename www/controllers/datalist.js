/**
 * Sahana Eden Mobile - Data List Controller
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
 * EMDataList - Data List Controller
 *
 * @class EMDataList
 * @memberof EdenMobile
 */
EdenMobile.controller("EMDataList", [
    '$scope', '$stateParams', 'emResources',
    function($scope, $stateParams, emResources) {

        var resourceName = $stateParams.resourceName;

        emResources.open(resourceName).then(function(resource) {

            // Pass resourceName to scope
            $scope.resourceName = resourceName;

            // Get strings
            var strings = resource.strings,
                listTitle = resourceName;
            if (strings) {
                listTitle = strings.namePlural || strings.name || listTitle;
            }
            $scope.listTitle = listTitle;

            // Read card config
            var cardConfig = resource.card,
                fields;
            if (cardConfig) {
                fields = cardConfig.fields;
            }

            // Apply fallbacks
            if (!fields) {
                // Get all fields
                fields = [];
                for (var fieldName in resource.fields) {
                    fields.push(fieldName);
                }
            }

            // Make sure 'id' field is loaded (required by directive)
            if (fields.indexOf('id') == -1) {
                fields.push('id');
            }

            // Select all existing records
            $scope.records = [];
            resource.select(fields, function(records, result) {
                $scope.records = records;
                $scope.$apply();
            });
        });
    }
]);

// END ========================================================================
