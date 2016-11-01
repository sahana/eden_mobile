/**
 * Sahana Eden Mobile - Synchronization
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
 * emSync - Service for synchronization of data and forms
 *
 * @class emSync
 * @memberof EdenMobile.Services
 */
EdenMobile.factory('emSync', [
    '$q', '$rootScope', '$timeout', 'emDB', 'emServer',
    function ($q, $rootScope, $timeout, emDB, emServer) {

        // Current job queue and flags
        var syncJobs = [],
            statusUpdate = false;

        /**
         * Check the job queue and update the global status
         */
        var updateSyncStatus = function() {

            if (statusUpdate) {
                $timeout(updateSyncStatus, 100);
            } else {
                statusUpdate = true;
                var openJobs = syncJobs.filter(function(job) {
                    return (job.status == 'pending' || job.status == 'active');
                });
                syncJobs = openJobs;
                if (openJobs.length > 0) {
                    $rootScope.syncInProgress = true;
                } else {
                    $rootScope.syncInProgress = false;
                }
                statusUpdate = false;
            }
        };

        /**
         * Synchronization job prototype
         *
         * @param {string} type - Job type: 'form'|'data'
         * @param {string} mode - Synchronization mode: 'pull'|'push'|'both'
         * @param {string} tableName - the table name
         * @param {SahanaURL} url - the URL to access the form or data on the server
         *
         */
        function SyncJob(type, mode, tableName, url) {

            this.type = type;
            this.mode = mode;

            this.tableName = tableName;
            this.url = url;

            this.status = 'pending';
        }

        /**
         * Run synchronization job
         */
        SyncJob.prototype.run = function() {

            var self = this;

            if (self.status != 'pending') {
                // Do not re-run
                return;
            }
            self.status = 'active';

            // Dummy, @todo
            $timeout(function() {
                self.status = 'success';
                updateSyncStatus();
            }, 3000);
        };

        /**
         * Update the list of available/selected forms
         *
         * @todo: complete docstring
         */
        var updateFormList = function(currentList, tables, data) {

            // Build dict from current form list
            var items = {};
            currentList.forEach(function(item) {
                items[item.tableName] = item;
            });

            var formList = [],
                tableName,
                installed,
                download,
                item,
                entry;

            data.forEach(function(formData) {

                // Check if already installed
                tableName = formData.t;
                if (tables.indexOf(tableName) == -1) {
                    installed = false;
                } else {
                    installed = true;
                }

                // @todo: check autoInstall/autoUpdate option for default
                download = false;

                // Retain previous download status
                item = items[tableName];
                if (item !== undefined) {
                    download = item.download;
                }

                var entry = {
                    'name': formData.n,
                    'tableName': tableName,
                    'url': formData.r,
                    'installed': installed,
                    'download': download
                };
                formList.push(entry);
            });
            return formList;
        };

        /**
         * @todo: docstring
         */
        var getFormList = function(formList) {

            var deferred = $q.defer();

            if (formList.length) {
                deferred.resolve(formList);
            } else {
                // Reload form list from server
                emServer.formList(
                    function(data) {
                        emDB.tables().then(function(tableNames) {
                            formList = updateFormList([], tableNames, data);
                            deferred.resolve(formList);
                        });
                    },
                    function(response) {
                        updateSyncStatus();
                        emServer.httpError(response);
                        deferred.reject(response);
                    }
                );
            }
            return deferred.promise;
        };

        /**
         * Generate synchronization jobs
         *
         * @param {Array} formList - array of form descriptions
         *
         * @returns {integer} - number of jobs scheduled
         */
        var generateSyncJobs = function(formList) {

            var jobsScheduled = 0;
            formList.forEach(function(form) {
                if (form.download) {
                    var url = emServer.URL(form.url),
                        job = new SyncJob('form', 'pull', form.tableName, url);
                    syncJobs.push(job);
                    jobsScheduled++;
                }
            });
            return jobsScheduled;
        };

        /**
         * Run all pending synchronization jobs
         *
         * @todo: complete docstring
         */
        var synchronize = function(forms) {

            $rootScope.syncInProgress = true;

            if (syncJobs.length) {

                syncJobs.forEach(function(job) {
                    if (job.status == 'pending') {
                        job.run();
                    }
                });

            } else {

                getFormList(forms).then(function(formList) {
                    var jobsScheduled = generateSyncJobs(formList);
                    if (jobsScheduled) {
                        synchronize(formList);
                    } else {
                        updateSyncStatus();
                    }
                });
            }
        }

        // API
        var api = {

            updateFormList: updateFormList,
            synchronize: synchronize

        };
        return api;
    }
]);
