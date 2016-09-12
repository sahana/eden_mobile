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
                templateUrl: 'templates/home.html',
                controller: "EdenMobileMain"
            })
            .state('tasks', {
                url: '/tasks',
                templateUrl: 'templates/tasks.html',
                controller: "EdenMobileMain"
            })
            .state('sync', {
                url: '/sync',
                templateUrl: 'templates/sync.html',
                controller: "EdenMobileMain"
            })
            .state('settings', {
                url: '/settings',
                views: {
                    '': {
                        templateUrl: 'templates/settings.html',
                        controller: "EdenMobileSettings"
                    },
                    'about@settings': {
                        templateUrl: 'templates/about.html',
                        controller: "EdenMobileAbout"
                    }
                },
            });

        // Default to index state
        $urlRouterProvider.otherwise("/");

    }
]);

EdenMobile.directive('edenTopbar', function() {
    return {
        templateUrl: 'templates/topbar.html'
    }
});

EdenMobile.directive('edenFooter', function() {
    return {
        templateUrl: 'templates/footer.html'
    }
});
