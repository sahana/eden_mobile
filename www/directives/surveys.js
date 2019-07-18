/**
 * Sahana Eden Mobile - Directives for Surveys
 *
 * Copyright (c) 2016-2019 Sahana Software Foundation
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

(function(EdenMobile) {

    "use strict";

    /**
     * Directive <em-survey-list>
     *
     * @param {integer} columns - the number of cards per row (=grid columns), optional
     */
    EdenMobile.directive('emSurveyList', [
        '$compile',
        function($compile) {

            /**
             * Rebuild the survey list
             *
             * @param {Array} surveys - the survey data list
             * @param {integer} numCols - the number of cards per row
             *
             * @returns {angular.element} - the survey list
             */
            var surveyList = function(surveys, numCols) {

                var surveyList = angular.element('<section class="surveyList">');

                for (var i = 0; i < surveys.length; i += numCols) {

                    // Build the grid row
                    var row = angular.element('<div class="row">'),
                        cols = [angular.element('<div class="col">'),
                                angular.element('<div class="col">'),
                                ];

                    cols.forEach(function(col) {
                        row.append(col);
                    });

                    // Add survey cards
                    surveys.slice(i, i + numCols).forEach(function(survey, index) {

                        var card = angular.element('<em-survey-card>')
                                          .attr('resource', survey.resource.name);
                        cols[index].append(card);
                    });

                    surveyList.append(row);
                }

                return surveyList;
            };

            /**
             * Rebuild the survey list and add it to the DOM
             *
             * @param {Scope} $scope - the scope of the directive
             * @param {object} elem - the DOM node of the directive
             * @param {Array} surveys - the survey data list
             */
            var renderList = function($scope, elem, surveys) {

                // Remove the existing survey list
                elem.empty();

                // Build new survey list
                var update = surveyList(surveys, $scope.numCols);

                // Compile the new list with $scope and add it to the DOM
                elem.append($compile(update)($scope));
            };

            // ----------------------------------------------------------------
            // Return the DDO
            //
            return {
                link: function($scope, elem, attr) {
                    console.log('emSurveyList.renderList');

                    $scope.numCols = (attr.columns - 0) || 2;

                    // Render initial list
                    renderList($scope, elem, $scope.surveys);

                    // Watch for updates
                    $scope.$watchCollection('surveys', function(surveys) {
                        renderList($scope, elem, surveys);
                    });
                }
            };
        }
    ]);

    /**
     * Directive <em-survey-card>
     *
     * @param {string} resource - the resource name
     */
    EdenMobile.directive('emSurveyCard', [
        function() {

            return {
                templateUrl: 'views/data/survey_card.html',
                link: function($scope, elem, attr) {

                    // Retrieve the survey data for the resource from scope
                    var resourceName = attr.resource,
                        survey = $scope.resources[resourceName];

                    $scope.surveyTitle = survey.resource.getLabel(true);
                    $scope.completeResponses = survey.completeResponses;
                    $scope.unsyncedResponses = survey.unsyncedResponses;
                }
            };
        }
    ]);

})(EdenMobile);

// END ========================================================================
