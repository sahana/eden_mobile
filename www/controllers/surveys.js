/**
 * Sahana Eden Mobile - Survey List Controller
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
 * EMSurveyList - Survey List Controller
 *
 * @class EMSurveyList
 * @memberof EdenMobile
 */
EdenMobile.controller("EMSurveyList", [
    '$scope', '$q', 'emResources',
    function($scope, $q, emResources) {

        "use strict";

        console.log('EMSurveyList init controller');

        // Initialize scope objects
        $scope.resources = {};
        $scope.surveys = [];

        // TODO Use title of currently linked project
        $scope.title = 'Project Title';

        /**
         * Get survey data for a resource
         *
         * @param {object} item - the item from the resource list:
         *  @property {Resource} item.resource - the Resource
         *  @property {integer}  item.numRows - the number of unsynced rows in this resource
         *
         * @returns {promise} - a promise that resolves into the survey data
         *                      for this resource
         */
        var addSurveyData = function(item) {

            var deferred = $q.defer(),
                resource = item.resource,
                incomplete = resource.table.$('em_incomplete');

            resource.where(incomplete.is(false)).count().then(function(numRows) {

                // Deliver survey data to caller (deferred)
                deferred.resolve({
                    resource: resource,
                    completeResponses: numRows,
                    unsyncedResponses: item.numRows
                });
            });

            return deferred.promise;
        };

        /**
         * Update the survey list
         */
        var updateSurveyList = function() {

            console.log('EMSurveyList.updateSurveyList');

            var resources = {},
                surveys = [];

            emResources.resourceList().then(function(resourceList) {

                // Get survey data
                var deferred = [];
                resourceList.forEach(function(item) {
                    if (item.resource.main) {
                        deferred.push(addSurveyData(item));
                    }
                });

                if (deferred.length) {
                    // Refresh scope when all survey data are available
                    $q.all(deferred).then(function(surveyInfos) {
                        surveyInfos.forEach(function(survey) {
                            surveys.push(survey);
                            resources[survey.resource.name] = survey;
                        });
                        $scope.resources = resources;
                        $scope.surveys = surveys;
                    });
                } else {
                    // Refresh scope right away
                    $scope.resources = {};
                    $scope.surveys = [];
                }
            });
        };

        // Update the resource list every time when entering the view
        $scope.$on('$ionicView.enter', updateSurveyList);
    }
]);

// END ========================================================================