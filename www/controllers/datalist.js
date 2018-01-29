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

// ============================================================================
/**
 * EMDataList - Data List Controller
 *
 * @class EMDataList
 * @memberof EdenMobile
 */
EdenMobile.controller("EMDataList", [
    '$scope', '$state', '$stateParams', 'emDialogs', 'emResources',
    function($scope, $state, $stateParams, emDialogs, emResources) {

        "use strict";

        // State parameters
        var resourceName = $stateParams.resourceName,
            recordID = $stateParams.recordID,
            componentName = $stateParams.componentName;

        $scope.resourceName = resourceName;
        $scope.recordID = recordID;
        $scope.componentName = componentName;

        /**
         * Refresh the scope with resource and record data
         *
         * @param {Resource} resource - the resource
         * @param {string} query - SQL where expression to select the
         *                         records, e.g. a subset linked to a
         *                         particular master record (components)
         */
        var updateDataList = function(subset) {

            var resource = subset.resource;

            // List title
            $scope.listTitle = resource.getLabel(true);

            // Get card config, determine fields to extract
            var cardConfig = resource.card,
                fields;
            if (cardConfig) {
                fields = cardConfig.fields;
            }
            $scope.cardConfig = cardConfig;

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
            subset.select(fields, function(rows) {

                // TODO change representRecords to accept rows
                var records = [];
                rows.forEach(function(row) {
                    records.push(row._());
                });
                resource.representRecords(records).then(function(result) {
                    $scope.records = result;
                });
            });
        };

        /**
         * Open list of records
         */
        var openDataList = function() {

            // Open the master resource
            emResources.open(resourceName).then(function(resource) {

                if (!resource) {
                    // Undefined resource
                    emDialogs.error('Error', 'Undefined Resource',
                        function() {
                            $state.go('data.resources',
                                {location: 'replace', reload: true});
                        });
                    $scope.records = [];
                } else {

                    // Link parameters for CRUD actions
                    var linkParams = {
                            resourceName: resourceName,
                            recordID: recordID
                        };

                    $scope.insertable = false;
                    $scope.createView = "#";

                    if (componentName) {

                        linkParams.componentName = componentName;

                        var component = resource.component(componentName);
                        if (!component) {
                            // Undefined component
                            emDialogs.error('Error', 'Undefined Component',
                                function() {
                                    $state.go('data.update', linkParams, {
                                        location: 'replace',
                                        reload: true
                                    });
                                });
                            $scope.records = [];
                        } else {
                            var subset = component.subSet(recordID);
                            if (component.multiple) {
                                // Open component list
                                $scope.parentView = $state.href('data.update', linkParams);
                                // Component action links
                                if (component.settings.insertable !== false) {
                                    $scope.insertable = true;
                                    $scope.createView = $state.href('data.componentCreate', linkParams);
                                }
                                updateDataList(subset);
                            } else {
                                // Open the Update form directly
                                subset.select(['id'], function(rows) {
                                    rows.forEach(function(row) {
                                        linkParams.componentID = row.data.id;
                                        $state.go('data.componentUpdate', linkParams, {
                                            location: 'replace',
                                            reload: true
                                        });
                                    });
                                });
                            }
                        }
                    } else {
                        // Master action links
                        $scope.parentView = $state.href('data.resources');
                        if (resource.settings.insertable !== false) {
                            $scope.insertable = true;
                            $scope.createView = $state.href('data.create', linkParams);
                        }
                        // Open master
                        updateDataList(resource.subSet());
                    }
                }
            });
        };

        $scope.$on('$ionicView.enter', openDataList);
    }
]);

// END ========================================================================
