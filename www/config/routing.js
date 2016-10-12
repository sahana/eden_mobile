/**
 * Sahana Eden Mobile - State Routing and Menu Directives
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

EdenMobile.config(['$stateProvider', '$urlRouterProvider',
    function($stateProvider, $urlRouterProvider) {

        // Default states
        $stateProvider
            .state('index', {
                url: '/',
                templateUrl: 'views/home.html'
            })
            .state('data', {
                'abstract': true,
                url: '/data',
                template: '<ui-view/>'
            })
            .state('data.forms', {
                url: '/forms',
                templateUrl: 'views/data/formlist.html',
                controller: "EMFormList"
            })
            .state('data.list', {
                url: '/{formName}',
                templateUrl: 'views/data/datalist.html',
                controller: "EMDataList"
            })
            .state('data.create', {
                url: '/{formName}/create',
                templateUrl: 'views/data/create.html',
                controller: "EMDataCreate"
            })
            .state('data.update', {
                url: '/{formName}/{recordID:int}',
                templateUrl: 'views/data/update.html',
                controller: "EMDataUpdate"
            })
            .state('sync', {
                url: '/sync',
                templateUrl: 'views/sync/index.html',
                controller: "EMDefault"
            })
            .state('settings', {
                url: '/settings',
                views: {
                    '': {
                        templateUrl: 'views/settings/index.html',
                        controller: "EMSettings"
                    },
                    'about@settings': {
                        templateUrl: 'views/settings/about.html',
                        controller: "EMAbout"
                    }
                }
            });

        // Default to index state
        $urlRouterProvider.otherwise("/");

    }
]);

EdenMobile.directive('edenTopbar', function() {
    return {
        templateUrl: 'views/topbar.html'
    };
});

EdenMobile.directive('edenFooter', function() {
    return {
        templateUrl: 'views/footer.html'
    };
});
