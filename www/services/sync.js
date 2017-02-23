/**
 * Sahana Eden Mobile - Synchronization
 *
 * Copyright (c) 2016-2017: Sahana Software Foundation
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
 * emSync - Service to log synchronization events/results
 *
 * @class emSync
 * @memberof EdenMobile.Services
 */
EdenMobile.factory('emSyncLog', [
    'emDB',
    function(emDB) {

        var api = {

            /**
             * Create an entry in the synchronization log
             *
             * @param {SyncJob} job - the sync job the entry is related to
             * @param {string} result - the result of the action: success|error|cancelled
             * @param {string} message - the error message
             */
            log: function(job, result, message) {

                var entry = {
                    timestamp: new Date(),
                    result: result,
                    message: message
                };

                if (job) {
                    entry.type = job.type;
                    entry.mode = job.mode;
                    entry.resource = job.resourceName;
                }

                emDB.table('em_sync_log').then(function(table) {
                    table.insert(entry);
                });
            },

            /**
             * Mark all existing log entries as obsolete (current=false)
             */
            obsolete: function() {

                emDB.table('em_sync_log').then(function(table) {
                    table.update({current: false});
                });
            },

            /**
             * Get all current log entries
             *
             * @param {function} callback - callback function: function(records, result)
             */
            entries: function(callback) {

                emDB.table('em_sync_log').then(function(table) {

                    var fields = [
                            'timestamp',
                            'type',
                            'mode',
                            'resource',
                            'result',
                            'message'
                        ];

                    table.select(fields, 'current=1', callback);
                });
            }
        };
        return api;
    }
]);

// ============================================================================
/**
 * emSync - Service for synchronization of data and forms
 *
 * @class emSync
 * @memberof EdenMobile.Services
 */
EdenMobile.factory('emSync', [
    '$q', '$rootScope', '$timeout', 'emResources', 'emServer', 'emSyncLog',
    function ($q, $rootScope, $timeout, emResources, emServer, emSyncLog) {

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

            if (self.type == 'form') {
                self.downloadForm();
            } else {
                if (self.mode == 'push') {
                    self.uploadData();
                }
            }
        };

        // --------------------------------------------------------------------
        /**
         * Set the job result, log it and update the job queue
         *
         * @param {string} status: the final status success|error|cancelled
         * @param {string} message: the error message (if any)
         */
        SyncJob.prototype.result = function(status, message) {

            this.status = status;
            this.error = message || null;

            var result = null;
            switch(status) {
                case 'success':
                case 'error':
                case 'cancelled':
                    result = status;
                    break;
                default:
                    break;
            }

            emSyncLog.log(this, result, this.error);
            updateSyncStatus();
        };

        // --------------------------------------------------------------------
        /**
         * Download form definition from server
         */
        SyncJob.prototype.downloadForm = function() {

            var self = this,
                tableName = self.tableName;

            emServer.getForm(self.ref,
                function(data) {

                    // Process form definition
                    var schemaData = data[tableName];
                    if (schemaData === undefined) {
                        self.result('error', 'No schema definition received for ' + tableName);
                        return;
                    }
                    schemaData._name = self.resourceName;

                    // Install resource
                    emResources.install(tableName, schemaData).then(
                        function(resource) {
                            // Success
                            self.result('success');
                        },
                        function(error) {
                            // Error
                            self.result('error', error);
                        }
                    );
                },
                function(response) {
                    // Error
                    var message;
                    if (typeof response == 'string') {
                        message = response;
                    } else if (response.status) {
                        if (response.data) {
                            message = response.data.message;
                        }
                        if (!message) {
                            message = response.statusText;
                        }
                        message = response.status + ' ' + message;
                    }
                    self.result('error', message);
                }
            );
        };

        // --------------------------------------------------------------------
        /**
         * @todo: docstring
         */
        SyncJob.prototype.updateSyncDate = function(synchronized_on, created, updated) {

            var deferred = $q.defer();

            var uuids = [],
                add = function(uuid) {
                    uuids.push("'" + uuid + "'");
                };
            if (created) {
                created.forEach(add);
            }
            if (updated) {
                updated.forEach(add);
            }

            if (uuids.length) {
                emResources.open(this.resourceName).then(function(resource) {
                    var query = 'uuid IN (' + uuids.join(',') + ')',
                        data = {
                            'synchronized_on': synchronized_on,
                            // don't change modified_on:
                            'modified_on': undefined
                        };
                    resource.update(data, query, function() {
                        deferred.resolve();
                    });
                });
            } else {
                deferred.resolve();
            }

            return deferred.promise;
        };

        // --------------------------------------------------------------------
        /**
         * Upload resource data to the server
         */
        SyncJob.prototype.uploadData = function() {

            var self = this,
                resourceName = self.resourceName;

            emResources.open(resourceName).then(function(resource) {

                var query = 'synchronized_on IS NULL OR synchronized_on<modified_on';

                resource.exportJSON(query, function(output) {

                    if (!output) {
                        // Skip if empty
                        self.result(null, 'not modified');
                        return;
                    }

                    var synchronized_on = new Date();

                    emServer.postData(self.ref, output,
                        function(data) {
                            // Success
                            if (data) {
                                self.updateSyncDate(
                                    synchronized_on,
                                    data.created,
                                    data.updated
                                ).then(function() {
                                    self.result('success');
                                });
                            } else {
                                self.result('success');
                            }
                        },
                        function(response) {
                            // Error
                            var message;
                            if (typeof response == 'string') {
                                message = response;
                            } else if (response.status) {
                                if (response.data) {
                                    message = response.data.message;
                                }
                                if (!message) {
                                    message = response.statusText;
                                }
                                message = response.status + ' ' + message;
                            }
                            self.result('error', message);
                        }
                    );
                });
            });
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
                download = !installed; // true;

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
         * @param {Array} resourceList - array of resource descriptions
         *
         * @returns {integer} - number of jobs scheduled
         */
        var generateSyncJobs = function(formList, resourceList) {

            var jobsScheduled = 0,
                job;

            formList.forEach(function(form) {
                if (form.download) {
                    job = new SyncJob(
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

            resourceList.forEach(function(resource) {
                if (resource.upload) {
                    var ref = resource.ref;
                    if (ref.c && ref.f) {
                        job = new SyncJob(
                            'data',
                            'push',
                            resource.resourceName,
                            resource.tableName,
                            resource.ref
                        );
                        syncJobs.push(job);
                        jobsScheduled++;
                    }
                }
            });

            return jobsScheduled;
        };

        // ====================================================================
        /**
         * Run synchronization jobs
         *
         * @param {Array} forms - the current list of available/selected forms for
         *                        synchronization
         * @param {Array} resource - the current list of available/selected resources
         *                           for synchronization
         */
        var synchronize = function(forms, resources) {

            $rootScope.syncInProgress = true;

            if (syncJobs.length) {

                // Run all pending jobs
                syncJobs.forEach(function(job) {
                    if (job.status == 'pending') {
                        job.run();
                    }
                });

            } else {

                emSyncLog.obsolete();

                var lists = {
                    formList: getFormList(forms),
                    resourceList: getResourceList(resources)
                };

                $q.all(lists).then(function(pending) {
                    var jobsScheduled = generateSyncJobs(
                        pending.formList,
                        pending.resourceList
                    );
                    if (jobsScheduled) {
                        synchronize(
                            pending.formlist,
                            pending.resourceList
                        );
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
