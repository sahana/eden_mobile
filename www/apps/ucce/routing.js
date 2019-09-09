/**
 * UCCE Survey Tool - State Routing and Menu Directives
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

    EdenMobile.config(['$stateProvider', '$urlRouterProvider',
        function($stateProvider, $urlRouterProvider) {

            // Default states
            $stateProvider
                // Index page (currently unused in this app)
                .state('index', {
                    url: '/',
                    templateUrl: 'apps/ucce/views/home.html'
                })

                // Survey-specific states
                .state('surveys', {
                    url: '/surveys',
                    controller: 'EMSurveyList',
                    templateUrl: 'views/survey/survey_list.html'
                })
                .state('responses', {
                    url: '/{resourceName}/responses',
                    controller: 'EMResponseList',
                    templateUrl: 'views/survey/response_list.html'
                })

                // Form-Wizard
                .state('wizard', {
                    // Can use 0 as record ID to create a new record
                    cache: false,
                    url: '/{resourceName}/{recordID:int}/wizard',
                    params: {
                        language: ''
                    },
                    controller: 'EMFormWizardController',
                    template: '<ion-nav-view></ion-nav-view>'
                })
                .state('wizard.form', {
                    cache: false,
                    params: {
                        section: null
                    },
                    controller: 'EMFormSectionController',
                    templateUrl: 'views/wizard/form.html'
                });

            // Default to survey list (for now)
            $urlRouterProvider.otherwise("/surveys");
        }
    ]);

    // TODO these directives shouldn't be in a config file => move into directives-file
    // TODO these directives shouldn't use "eden" prefix, but "em"
    EdenMobile.directive('edenTopbar', function() {
        return {
            templateUrl: 'apps/ucce/views/topbar.html'
        };
    });

    EdenMobile.directive('edenFooter', function() {
        return {
            templateUrl: 'apps/ucce/views/footer.html'
        };
    });

})(EdenMobile);
