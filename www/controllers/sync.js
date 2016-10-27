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

/**
 * Controller for synchronisation page
 */
EdenMobile.controller('EMSync', [
    '$rootScope', '$scope', '$timeout', 'emServer',
    function($rootScope, $scope, $timeout, emServer) {

        var syncJobs = $rootScope.syncJobs;
        if (!syncJobs) {
            syncJobs = [];
            $rootScope.syncJobs = syncJobs;
        }

        var statusUpdate = false;
        var updateSyncStatus = function() {

            if (!statusUpdate) {
                statusUpdate = true;
                var openJobs = $rootScope.syncJobs.filter(function(job) {
                    return (job.status == 'pending' || job.status == 'active');
                });
                $rootScope.syncJobs = openJobs;
                if (openJobs.length > 0) {
                    $rootScope.syncInProgress = true;
                } else {
                    $rootScope.syncInProgress = false;
                }
                statusUpdate = false;
            }
        }

        $scope.synchronize = function() {

            $rootScope.syncInProgress = true;

            var syncJobs = $rootScope.syncJobs;
            if (!syncJobs.length) {

                // Get form list from server
                var url = emServer.URL({
                    c: 'mobile',
                    f: 'forms',
                    extension: 'json'
                });
                emServer.get(url,
                    function(data) {
                        // Success

                        // => populate form list
                        // => create sync jobs from form list
                        // => execute the sync jobs

                        // Placeholder (@todo: remove)
                        $rootScope.syncInProgress = false;
                        alert(JSON.stringify(data));
                    },
                    function(response) {
                        // Error
                        $rootScope.syncInProgress = false;
                        emServer.httpError(response);
                    });
            } else {
                // => execute the sync jobs

                // Placeholder (@todo: remove)
                $rootScope.syncInProgress = false;
            }
        };
    }

]);
