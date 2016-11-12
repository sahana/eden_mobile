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

// ============================================================================
/**
 * emSync - Service for synchronization of data and forms
 *
 * @class emSync
 * @memberof EdenMobile.Services
 */
EdenMobile.factory('emSync', [
    '$q', '$rootScope', '$timeout', 'emResources', 'emServer',
    function ($q, $rootScope, $timeout, emResources, emServer) {

        // Current job queue and flags
        var syncJobs = [],
            statusUpdate = false;

        // ====================================================================
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

        // ====================================================================
        /**
         * Synchronization job prototype
         *
         * @param {string} type - Job type: 'form'|'data'
         * @param {string} mode - Synchronization mode: 'pull'|'push'|'both'
         * @param {string} tableName - the table name
         * @param {object} ref - reference details to construct the server URL
         *                       to access the form or data, object
         *                       {c:controller, f:function, vars:vars}
         */
        function SyncJob(type, mode, resourceName, tableName, ref) {

            this.type = type;
            this.mode = mode;

            this.resourceName = resourceName;
            this.tableName = tableName;
            this.ref = ref;

            this.status = 'pending';
            this.error = null;
        }

        // --------------------------------------------------------------------
        /**
         * Run synchronization job
         */
        SyncJob.prototype.run = function() {

            var self = this,
                tableName = self.tableName;

            if (self.status != 'pending') {
                // Do not re-run
                return;
            }
            self.status = 'active';

            emServer.getForm(self.ref,
                function(data) {
                    // Successfully downloaded form description

                    var schemaData = data[tableName];
                    if (schemaData === undefined) {
                        self.status = 'error';
                        self.error = 'No schema definition received for ' + tableName;
                        updateSyncStatus();
                        return;
                    }

                    schemaData._name = self.resourceName;

                    emResources.install(tableName, schemaData).then(
                        function(resource) {
                            // Success
                            self.status = 'success';
                            updateSyncStatus();
                        },
                        function(error) {
                            // Error
                            self.status = 'error';
                            self.error = error;
                            updateSyncStatus();
                        }
                    );
                },
                function(response) {
                    // Error
                    // @todo: store error in log, make log accessible in Sync controller
                    self.status = 'error';
                    updateSyncStatus();
                }
            );
        };

        // ====================================================================
        /**
         * Update the list of available/selected forms
         *
         * @param {Array} currentList - the current list of available/selected forms
         * @param {Array} resourceNames - names of currently installed resources
         * @param {Array} data - the list of available forms from the server
         */
        var updateFormList = function(currentList, resourceNames, data) {

            // Build dict from current form list
            var items = {};
            currentList.forEach(function(item) {
                items[item.resourceName] = item;
            });

            var formList = [],
                name,
                installed,
                download,
                item,
                entry;

            data.forEach(function(formData) {

                // Check if already installed
                name = formData.n;
                if (resourceNames.indexOf(name) == -1) {
                    installed = false;
                } else {
                    installed = true;
                }

                // @todo: check autoInstall/autoUpdate option for default
                download = true;

                // Retain previous download status
                item = items[name];
                if (item !== undefined) {
                    download = item.download;
                }

                entry = {
                    'label': formData.l,
                    'resourceName': name,
                    'tableName': formData.t,
                    'ref': formData.r,
                    'installed': installed,
                    'download': download
                };
                formList.push(entry);
            });
            return formList;
        };

        // ====================================================================
        /**
         * Get a list of forms that are to be installed, fetch a fresh list
         * from server if no list is loaded and select automatically
         *
         * @param {Array} formList - the current list of available/selected forms
         *
         * @returns {promise} - a promise that resolves into the form list
         */
        var getFormList = function(formList) {

            var deferred = $q.defer();

            if (formList && formList.length) {
                // Use this list
                deferred.resolve(formList);
            } else {
                // Fetch new form list from server and select automatically
                emServer.formList(
                    function(data) {
                        emResources.names().then(function(resourceNames) {
                            formList = updateFormList([], resourceNames, data);
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

        // ====================================================================
        /**
         * Update the list of available/selected resources
         */
        var updateResourceList = function(currentList, resources) {

            // Build dict from current form list
            var items = {};
            currentList.forEach(function(item) {
                items[item.resourceName] = item;
            });

            var resourceList = [],
                resource,
                numRows,
                upload,
                item,
                entry;

            resources.forEach(function(resourceData) {

                resource = resourceData.resource;
                numRows = resourceData.numRows;

                // @todo: check autoUpload option for default
                upload = true;

                item = items[resource.name];
                if (item !== undefined) {
                    upload = item.upload;
                }

                entry = {
                    'label': resource.getLabel(true),
                    'resourceName': resource.name,
                    'tableName': resource.tableName,
                    'ref': {
                        'c': resource.controller,
                        'f': resource.function
                    },
                    'updated': numRows,
                    'upload': upload
                };
                resourceList.push(entry);
            });

            return resourceList;
        };

        // ====================================================================
        /**
         * Get an updated list of available resources
         *
         * @param {Array} currentList - the current list of available resources
         *
         * @returns {promise} - a promise that resolves into the updated
         *                      resource list
         */
        var getResourceList = function(currentList) {

            var deferred = $q.defer();

            emResources.resourceList(function(resourceList) {
                resourceList = updateResourceList(currentList, resourceList);
                deferred.resolve(resourceList);
            });

            return deferred.promise;
        };

        // ====================================================================
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
                    var job = new SyncJob(
                        'form',
                        'pull',
                        form.resourceName,
                        form.tableName,
                        form.ref
                    );
                    syncJobs.push(job);
                    jobsScheduled++;
                }
            });
            return jobsScheduled;
        };

        // ====================================================================
        /**
         * Run synchronization jobs
         *
         * @param {Array} forms - the current list of available/selected forms for
         *                        synchronization (to create sync jobs as needed)
         */
        var synchronize = function(forms) {

            $rootScope.syncInProgress = true;

            if (syncJobs.length) {
                // Run all pending jobs
                syncJobs.forEach(function(job) {
                    if (job.status == 'pending') {
                        job.run();
                    }
                });
            } else {
                // Generate jobs for forms
                getFormList(forms).then(function(formList) {
                    var jobsScheduled = generateSyncJobs(formList);
                    if (jobsScheduled) {
                        synchronize(formList);
                    } else {
                        updateSyncStatus();
                    }
                });
            }
        };

        // ====================================================================
        // API
        var api = {

            updateFormList: updateFormList,
            updateResourceList: updateResourceList,

            synchronize: synchronize

        };
        return api;
    }
]);

// END ========================================================================
