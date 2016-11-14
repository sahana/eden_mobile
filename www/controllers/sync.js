/**
 * Sahana Eden Mobile - Sync Controller
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
 * Controller for synchronisation page
 */
EdenMobile.controller('EMSync', [
    '$ionicModal', '$rootScope', '$scope', 'emResources', 'emServer', 'emSync',
    function($ionicModal, $rootScope, $scope, emResources, emServer, emSync) {

        $scope.formList = [];
        $scope.resourceList = [];

        var countSelected = function() {

            var formList = $scope.formList,
                resourceList = $scope.resourceList,
                available,
                selected;

            if (!formList.length) {
                $scope.selectedForms = 'select automatically';
            } else {
                available = 0;
                selected = 0;
                formList.forEach(function(form) {
                    available++;
                    if (form.download) {
                        selected++;
                    }
                });
                $scope.selectedForms = selected + '/' + available + ' selected';
            }

            if (!resourceList.length) {
                $scope.selectedResources = 'select automatically';
            } else {
                available = 0;
                selected = 0;
                resourceList.forEach(function(resource) {
                    available++;
                    if (resource.upload) {
                        selected++;
                    }
                });
                $scope.selectedResources = selected + '/' + available + ' selected';
            }
        };

        $scope.countSelected = countSelected;
        countSelected();

        /**
         * Modal to select forms for download
         */
        $scope.selectForms = function() {

            if ($scope.formListLoading) {
                return;
            }
            $scope.formListLoading = true;

            emServer.formList(
                function(data) {
                    $scope.formListLoading = false;
                    emResources.names().then(function(resourceNames) {
                        $scope.formList = emSync.updateFormList($scope.formList, resourceNames, data);
                        countSelected();
                        $ionicModal.fromTemplateUrl('views/sync/formlist.html', {
                            scope: $scope
                        }).then(function(modal) {
                            $scope.modal = modal;
                            modal.show();
                        });
                    });
                },
                function(response) {
                    $scope.formListLoading = false;
                    emServer.httpError(response);
                }
            );
        };

        /**
         * Modal to select resources for upload
         */
        $scope.selectResources = function() {

            if ($scope.resourceListLoading) {
                return;
            }
            $scope.resourceListLoading = true;

            emResources.resourceList(function(resourceList) {
                $scope.resourceListLoading = false;
                $scope.resourceList = emSync.updateResourceList($scope.resourceList, resourceList);
                countSelected();
                $ionicModal.fromTemplateUrl('views/sync/resourcelist.html', {
                    scope: $scope
                }).then(function(modal) {
                    $scope.modal = modal;
                    modal.show();
                });
            });
        };

        /**
         * Start synchronisation
         */
        $scope.synchronize = function() {

            if ($rootScope.syncInProgress) {
                return;
            } else {
                emSync.synchronize($scope.formList, $scope.resourceList);
            }
        };
    }

]);

// END ========================================================================
