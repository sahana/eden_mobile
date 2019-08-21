/**
 * Sahana Eden Mobile - Form Section Controller
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
 * Form Section Controller
 *
 * @class EMFormSectionController
 * @memberof EdenMobile
 */
EdenMobile.controller("EMFormSectionController", [
    '$ionicSideMenuDelegate', '$scope', '$rootScope', '$stateParams',
    function($ionicSideMenuDelegate, $scope, $rootScope, $stateParams) {

        "use strict";

        // Determine the active section and update form status
        var activeSection = ($stateParams.section - 0) || 0,
            formConfig = $scope.formConfig,
            formStatus = $scope.formStatus;

        if (activeSection < 0) {
            activeSection = 0;
        }

        // Update form status
        formStatus.activeSection = activeSection;

        // Get the section config from (parent) scope
        $scope.sectionConfig = formConfig[activeSection] || [];

        // TODO catch navigateAway and allow to stay on form or discard
        //      incomplete record

        // Disable content dragging to reveal the side menu
        $scope.$on('$ionicView.enter', function() {
            $ionicSideMenuDelegate.canDragContent(false);
            var cleanup = $rootScope.$on('$stateChangeStart', function() {
                $ionicSideMenuDelegate.canDragContent(true);
                cleanup();
            });
        });
    }
]);

// END ========================================================================
