/**
 * Sahana Eden Mobile - Data List Controller
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
 * EMDataList - Data List Controller
 *
 * @class EMDataList
 * @memberof EdenMobile
 */
EdenMobile.controller("EMDataList", [
    '$scope', '$stateParams', 'emResources',
    function($scope, $stateParams, emResources) {

        /**
         * Refresh the scope with resource and record data
         *
         * @param {Resource} resource - the resource
         * @param {string} query - SQL where expression to select the
         *                         records, e.g. a subset linked to a
         *                         particular master record (components)
         */
        var updateDataList = function(resource, query) {

            $scope.resourceName = resource.name;

            // Get strings
            var strings = resource.strings,
                listTitle = resource.name;
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
            resource.select(fields, query, function(records, result) {
                $scope.records = records;
                $scope.$apply();
            });
        };

        // State parameters
        var resourceName = $stateParams.resourceName,
            componentName = $stateParams.componentName;

        /**
         * Open list of records
         */
        var openDataList = function() {

            // Open the master resource
            emResources.open(resourceName).then(function(resource) {

                if (!resource) {
                    // Undefined resource
                    $scope.records = [];
                } else {
                    // Component access?
                    if (!!componentName) {
                        var component = resource.components[componentName];
                        if (!component || !component.resource) {
                            // Undefined or invalid component
                            // => fall back to master
                            alert('Undefined component: ' + componentName);
                            updateDataList(resource);
                        } else {
                            // Open component
                            var query = component.joinby + '=' + $stateParams.recordID;
                            emResources.open(component.resource).then(function(resource) {
                                updateDataList(resource, query);
                            });
                        }
                    } else {
                        updateDataList(resource);
                    }
                }
            });
        };

        $scope.$on('$ionicView.enter', openDataList);
    }
]);

// END ========================================================================
