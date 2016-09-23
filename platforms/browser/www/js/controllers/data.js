/**
 * Sahana Eden Mobile - Data Forms Controllers
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

/**
 * List of forms
 */
EdenMobile.controller("EdenMobileDataForms", [
    '$scope', '$stateParams', '$emdb',
    function($scope, $stateParams, $emdb) {
        // pass
    }
]);

/**
 * List of records
 */
EdenMobile.controller("EdenMobileDataList", [
    '$scope', '$stateParams', '$emdb',
    function($scope, $stateParams) {
        $scope.formName = $stateParams.formName;
    }
]);

/**
 * Create-form
 */
EdenMobile.controller("EdenMobileDataCreate", [
    '$scope', '$state', '$stateParams', '$emdb', 'EMDialogs',
    function($scope, $state, $stateParams, $emdb, EMDialogs) {

        $scope.formName = $stateParams.formName;

        // @todo: use actual defaults from table schema
        $scope.master = {
            first_name: "John",
            last_name: "Doe",
        };
        $scope.submit = function(form) {
            // @todo: validate
            $scope.master = angular.copy(form);
            $emdb.table('person').insert(form, function(recordID) {
                // Show confirmation popup and go back to list
                EMDialogs.confirmation('Record created', function() {
                    $state.go('data.list',
                        {formName: $scope.formName},
                        {location: 'replace'}
                    );
                });
            });
        };
        $scope.reset = function() {
            $scope.form = angular.copy($scope.master);
        };
        // @todo: expose reset in UI
        $scope.reset();
    }
]);

/**
 * Update-form
 */
EdenMobile.controller("EdenMobileDataUpdate", [
    '$scope', '$stateParams', '$emdb',
    function($scope, $stateParams, $emdb) {
        $scope.formName = $stateParams.formName;
        $scope.recordID = $stateParams.recordID;
    }
]);
