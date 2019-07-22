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
                })
                // Standard CRUD states
                .state('data', {
                    'abstract': true,
                    url: '/data',
                    template: '<ion-nav-view name="data"></ion-nav-view>'
                })
                .state('data.resources', {
                    url: '/resources',
                    views: {
                        'data': {
                            templateUrl: 'views/data/resources.html',
                            controller: "EMResourceList"
                        }
                    }
                })
                .state('data.list', {
                    url: '/{resourceName}',
                    views: {
                        'data': {
                            templateUrl: 'views/data/datalist.html',
                            controller: "EMDataList"
                        }
                    }
                })
                .state('data.create', {
                    url: '/{resourceName}/create',
                    views: {
                        'data': {
                            templateUrl: 'views/data/create.html',
                            controller: "EMDataCreate"
                        }
                    }
                })
                .state('data.update', {
                    url: '/{resourceName}/{recordID:int}',
                    views: {
                        'data': {
                            templateUrl: 'views/data/update.html',
                            controller: "EMDataUpdate"
                        }
                    }
                })
                .state('data.component', {
                    url: '/{resourceName}/{recordID:int}/{componentName}',
                    views: {
                        'data': {
                            templateUrl: 'views/data/datalist.html',
                            controller: "EMDataList"
                        }
                    }
                })
                .state('data.componentCreate', {
                    url: '/{resourceName}/{recordID:int}/{componentName}/create',
                    views: {
                        'data': {
                            templateUrl: 'views/data/create.html',
                            controller: "EMDataCreate"
                        }
                    }
                })
                .state('data.componentUpdate', {
                    url: '/{resourceName}/{recordID:int}/{componentName}/{componentID:int}',
                    views: {
                        'data': {
                            templateUrl: 'views/data/update.html',
                            controller: "EMDataUpdate"
                        }
                    }
                })

                // Sync
                .state('sync', {
                    url: '/sync',
                    templateUrl: 'views/sync/index.html',
                    controller: "EMSync"
                })

                // Settings
                .state('settings', {
                    url: '/settings',
                    views: {
                        '': {
                            templateUrl: 'views/settings/index.html',
                            controller: "EMSettings"
                        },
                        'about': {
                            templateUrl: 'views/settings/about.html',
                            controller: "EMAbout"
                        }
                    }
                });

            // Default to survey list (for now)
            $urlRouterProvider.otherwise("/surveys");

        }
    ]);

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
