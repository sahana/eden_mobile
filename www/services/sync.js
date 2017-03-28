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

            this.parent = null;

            this.status = 'pending';
            this.error = null;

            // Deferred action and completed-promise
            this.action = $q.defer();
            this.completed = this.action.promise;
        }

        // --------------------------------------------------------------------
        /**
         * Run synchronization job
         */
        SyncJob.prototype.run = function() {

            if (this.status != 'pending') {
                // Do not re-run
                return;
            }

            var self = this,
                run = function() {

                // Update status
                var status = 'active';
                self.status = status;
                self.action.notify(status);

                // Execute
                if (self.type == 'form') {
                    self.downloadForm();
                } else {
                    switch(self.mode) {
                        case 'push':
                            self.uploadData();
                            break;
                        case 'pull':
                            self.downloadData();
                            break;
                        default:
                            self.result('error', 'invalid mode');
                            break;
                    }
                }
            };

            if (!!this.parent) {
                // Wait for parent job to complete
                this.parent.completed.then(run, function(result) {
                    // Parent job failed => fail this job too
                    self.result(result, this.parent.error);
                });
            } else {
                run();
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

            // Update status
            this.status = status;
            this.action.notify(status);

            this.error = message || null;

            // Log the result
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

            // Update global sync status
            updateSyncStatus();

            // Resolve (or reject) completed-promise
            if (result == 'success') {
                this.action.resolve(result);
            } else {
                this.action.reject(result);
            }
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
         * Download resource data from the server
         */
        SyncJob.prototype.downloadData = function() {

            var self = this;

            emServer.getData(this.ref,
                function(data) {

                    // @todo: implement import of downloaded data
                    self.result('success');

                },
                function(response) {
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
         * Upload resource data to the server
         */
        SyncJob.prototype.uploadData = function() {

            var self = this,
                resourceName = self.resourceName;

            emResources.open(resourceName).then(function(resource) {

                var query = 'synchronized_on IS NULL OR synchronized_on<modified_on';

                resource.exportJSON(query, function(dataJSON, files) {

                    if (!dataJSON) {
                        // Skip if empty
                        self.result(null, 'not modified');
                        return;
                    }

                    // Data to send
                    var data;
                    if (files.length) {
                        // Use object to send as multipart
                        data = {
                            data: dataJSON,
                            _files: files
                        };
                    } else {
                        // Send as JSON body
                        data = dataJSON;
                    }

                    var synchronized_on = new Date();
                    emServer.postData(self.ref, data,

                        // Success callback
                        function(response) {
                            if (response) {
                                self.updateSyncDate(
                                    synchronized_on,
                                    response.created,
                                    response.updated
                                ).then(function() {
                                    self.result('success');
                                });
                            } else {
                                self.result('success');
                            }
                        },

                        // Error callback
                        function(response) {
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

        // --------------------------------------------------------------------
        /**
         * Update synchronized_on for all imported records
         *
         * @param {Date} synchronized_on - the synchronization date/time
         * @param {Array} created - list of UUIDs of newly created records
         * @param {Array} updated - list of UUIDs of updated records
         *
         * @returns {promise} - a promise that gets resolved when all
         *                      records have been updated
         */
        SyncJob.prototype.updateSyncDate = function(synchronized_on, created, updated) {

            var deferred = $q.defer(),
                uuids = [];

            // Helper function to create an Array of quoted UUIDs
            var add = function(uuid) {
                uuids.push("'" + uuid + "'");
            };

            // Collect the UUIDs
            if (created) {
                created.forEach(add);
            }
            if (updated) {
                updated.forEach(add);
            }

            // Update synchronized_on for all matching records
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

            var formList = [];
            data.forEach(function(formData) {

                // Check if already installed
                var resourceName = formData.n,
                    installed = false;
                if (resourceNames.indexOf(resourceName) != -1) {
                    installed = true;
                }

                // Does the resource provide data for download?
                var hasData = false;
                if (formData.d) {
                    hasData = true;
                }

                // Shall the resource be downloaded?
                var item = items[resourceName],
                    download = false;
                if (item !== undefined) {
                    // Retain previous selection
                    download = item.download;
                } else if (!installed || hasData) {
                    // Automatically select for download
                    // @todo: have a setting to enable/disable this?
                    download = true;
                }

                // Create an entry and add it to the formList
                var entry = {
                    'label': formData.l,
                    'resourceName': resourceName,
                    'tableName': formData.t,
                    'ref': formData.r,
                    'installed': installed,
                    'download': download,
                    'hasData': hasData
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

            var jobsScheduled = 0;

            formList.forEach(function(form) {

                var formJob = null,
                    dataJob = null;

                if (form.download) {
                    formJob = new SyncJob(
                        'form',
                        'pull',
                        form.resourceName,
                        form.tableName,
                        form.ref
                    );
                    syncJobs.push(formJob);
                    jobsScheduled++;
                }
                if (form.hasData) {
                    dataJob = new SyncJob(
                        'data',
                        'pull',
                        form.resourceName,
                        form.tableName,
                        form.ref
                    );
                    if (formJob) {
                        // Wait for form download before downloading data
                        dataJob.parent = formJob;
                    }
                    syncJobs.push(dataJob)
                    jobsScheduled++;
                }
            });

            resourceList.forEach(function(resource) {

                var job = null;

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
                            pending.formList,
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
