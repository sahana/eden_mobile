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
    '$ionicLoading', '$scope', '$q', 'emAuth', 'emDialogs', 'emResources', 'emSync',
    function($ionicLoading, $scope, $q, emAuth, emDialogs, emResources, emSync) {

        "use strict";

        console.log('EMSurveyList init controller');

        // Initialize scope objects
        $scope.resources = {};
        $scope.surveys = [];
        $scope.l10n = {
            surveyLanguages: [],
            currentLanguage: ''
        };

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
        var updateSurveyList = function(session) {

            console.log('EMSurveyList.updateSurveyList');

            $scope.title = session.projectTitle || 'Current Surveys';

            $scope.l10n.surveyLanguages = session.surveyLanguages || [];
            $scope.l10n.currentLanguage = session.currentLanguage || '';

            $scope.pendingUploads = false;

            var resources = {},
                surveys = [];

            return emResources.resourceList().then(function(resourceList) {

                // Get survey data
                var deferred = [];
                resourceList.forEach(function(item) {
                    if (item.resource.main) {
                        if (item.numRows && !item.resource.inactive) {
                            $scope.pendingUploads = true;
                        }
                        deferred.push(addSurveyData(item));
                    }
                });

                if (deferred.length) {
                    // Refresh scope when all survey data are available
                    return $q.all(deferred).then(function(surveyInfos) {
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
                    return $q.resolve();
                }
            });
        };

        /**
         * Refresh the survey list from server
         *
         * @param {boolean} quiet - fail silently when server unavailable
         */
        var refreshSurveyList = function(quiet) {
           emAuth.getSession(true).then(function(session) {
               emAuth.refreshSession(true).then(function(session) {
                   $scope.title = session.projectTitle || 'Current Surveys';
                   $scope.l10n.surveyLanguages = session.surveyLanguages || [];
               });
               emSync.fetchNewForms(quiet, session.masterkey_uuid).then(function() {
                   updateSurveyList(session);
               });
           });
        };

        // Upload-function
        $scope.upload = function() {

            emAuth.getSession().then(function(session) {
                emSync.uploadAllData().then(function(result) {
                    var failures = result.failed;
                    if (failures) {
                        var msg;
                        if (!result.success) {
                            msg = 'Data could not be uploaded';
                        } else {
                            msg = failures + ' survey(s) could not be uploaded';
                        }
                        emDialogs.error(msg, result.error);
                    } else {
                        emDialogs.confirmation('Data uploaded');
                    }
                    updateSurveyList(session);
                });
            });
        };

        // Delete-survey-function (called from emSurveyCard)
        $scope.delete = function(resourceName) {

            var survey = $scope.resources[resourceName];

            emDialogs.confirmAction(
                'Delete Survey',
                'The survey and all responses for it will be removed from the app. Are you sure?',
                function() {
                    emAuth.getSession().then(function(session) {
                        $ionicLoading.show({
                            template: 'Deleting survey...'
                        }).then(function() {
                            survey.resource.drop().then(function() {
                                updateSurveyList(session).then(function() {
                                    $ionicLoading.hide();
                                });
                            });
                        });
                    });
                });
        };

        // Manual trigger to refresh the survey list
        $scope.update = refreshSurveyList;

        // Unlink-function
        $scope.unlink = emAuth.exitSession;

        // Automatically refresh survey list when session gets connected
        $scope.$on('emSessionConnected', function() {
            refreshSurveyList(true);
        });

        // Automatically refresh survey list when device comes back online
        $scope.$on('emDeviceOnline', function() {
            refreshSurveyList(true);
        });

        // Handle language selection
        $scope.$watch('l10n.currentLanguage', function() {
            emAuth.updateSession({currentLanguage: $scope.l10n.currentLanguage}).then(
                function(session) {
                    updateSurveyList(session);
                });
        });

        // Update the survey list every time when entering the view
        $scope.$on('$ionicView.enter', function() {
           emAuth.getSession().then(function(session) {
               updateSurveyList(session);
           });
        });
    }
]);

// END ========================================================================
