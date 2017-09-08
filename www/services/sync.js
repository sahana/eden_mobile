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

// ============================================================================
/**
 * emSync - Service for synchronization of data and forms
 *
 * @class emSync
 * @memberof EdenMobile.Services
 */
EdenMobile.factory('emSync', [
    '$q', '$rootScope', '$timeout', 'emDB', 'emResources', 'emS3JSON', 'emServer', 'emSyncLog', 'emUtils',
    function ($q, $rootScope, $timeout, emDB, emResources, emS3JSON, emServer, emSyncLog, emUtils) {

        "use strict";

        $rootScope.syncStage = null;
        $rootScope.syncProgress = null;

        // ====================================================================
        // Synchronization task base class
        // ====================================================================
        /**
         * Generic class to represent a synchronization task; provides common
         * attributes and methods
         */
        function SyncTask(job) {

            this.job = job;

            this.$result = null;
            this.$promise = null;
        }

        // --------------------------------------------------------------------
        /**
         * Method for clients (dependants) to acquire a promise for the
         * completion of the task; for dependency management
         *
         * @returns {promise} - a promise that is resolved when the task
         *                      is done, or rejected when it has failed
         */
        SyncTask.prototype.done = function() {

            if (!this.$promise) {
                this.$promise = $q.defer();
            }
            return this.$promise.promise;
        };

        // --------------------------------------------------------------------
        /**
         * Method subclasses can use to notify clients about progress
         *
         * @param {mixed} value - status to send to the clients
         */
        SyncTask.prototype.notify = function(value) {

            if (!!this.$promise) {
                this.$promise.notify(value);
            }
        };

        // --------------------------------------------------------------------
        /**
         * Method subclasses must call upon successful completion of the task
         *
         * @param {mixed} value - the task output to report to clients
         */
        SyncTask.prototype.resolve = function(value) {

            this.$result = 'success';
            if (!!this.$promise) {
                this.$promise.resolve(value);
            }
        };

        // --------------------------------------------------------------------
        /**
         * Method subclasses must call upon failure
         *
         * @param {string} reason - the reason for the failure (=error message)
         */
        SyncTask.prototype.reject = function(reason) {

            this.$result = 'error';
            if (!!this.$promise) {
                this.$promise.reject(reason);
            }
        };

        // --------------------------------------------------------------------
        /**
         * Helper function to check the status of a SyncTask queue
         *
         * @param {Array} queue - the task queue
         * @param {deferred} deferred - a deferred object that shall be
         *                              resolved when all tasks in the
         *                              queue have reached a result status
         *                              (optional)
         * @param {mixed} value - value to resolve the deferred object with
         *
         * @returns {boolean} - true if all tasks in the queue have
         *                      reached a result status, otherwise false
         */
        var checkQueue = function(queue, deferred, value) {

            var completed = true;
            if (queue.length) {
                for (var i = queue.length; i--;) {
                    if (queue[i].$result === null) {
                        completed = false;
                    }
                }
            }
            if (completed && !!deferred) {
                deferred.resolve(value);
            }
            return completed;
        };

        // ====================================================================
        // Progress Reporting
        // ====================================================================

        var currentQueue = null;

        // --------------------------------------------------------------------
        /**
         * Check progress with the current task queue, and report
         * it to the rootScope for visualization in the UI
         */
        var checkProgress = function() {

            if (currentQueue === null || currentQueue === undefined) {
                $rootScope.syncProgress = null;
            } else {
                var total = currentQueue.length;
                if (total) {
                    var completed = currentQueue.filter(function(task) {
                        return !!task.$result;
                    });
                    $rootScope.syncProgress = [completed.length, total];
                } else {
                    $rootScope.syncProgress = [0, 0];
                }
            }
            if ($rootScope.syncStage) {
                // Check again after an interval
                $timeout(checkProgress, 250);
            }
        };

        // --------------------------------------------------------------------
        /**
         * Set the current stage and task queue
         *
         * @param {string} title: the title of the current stage in
         *                        the sync process
         * @param {Array} taskQueue: the array of task objects for this
         *                           stage (to report progress)
         *
         * Task objects in the queue must implement a 'result' property
         * that is null while the task is running, a true-ish when done
         */
        var currentStage = function(title, taskQueue) {

            // if this is the initial stage => start checkProgress
            var initial = false;
            if ($rootScope.syncStage === null) {
                initial = true;
            }

            // Update stage
            if ($rootScope.syncStage != title) {
                $rootScope.syncProgress = null;
            }
            $rootScope.syncStage = title;

            // Set new task queue and start reporting progress
            currentQueue = taskQueue;
            if (initial) {
                checkProgress();
            }
        };

        // ====================================================================
        // Dependency Management
        // ====================================================================
        /**
         * An import dependency
         *
         * Import tasks can depend on:
         * - a certain table to be installed (tableName)
         * - a certain record to be installed (tableName + uuid)
         * - a certain file to be downloaded (url)
         *
         * @param {string} tableName: the table name
         * @param {string} uuid: the record UUID
         * @param {string} url: the download URL of a file
         */
        function Dependency(tableName, uuid, url) {

            // Requirement specification
            this.tableName = tableName;
            this.uuid = uuid;
            this.url = url;

            // Available object references
            this.tableCreated = null;
            this.recordID = null;
            this.fileURI = null;

            // Provider array
            // - providers are import tasks that create the required object
            this.providers = [];

            // Deferred objects
            this.completion = null;
            this.resolution = null;

            // Flags
            this.isResolved = false;
            this.isComplete = false;
        }

        // --------------------------------------------------------------------
        /**
         * Register a provider for the dependency
         *
         * A provider object must implement:
         * - a '$result' property that holds the result status: null while
         *   pending, otherwise "success"|"error"
         * - a done() method that returns a promise which will be resolved
         *   when the provider succeeds and rejected when the provider fails
         */
        Dependency.prototype.registerProvider = function(provider) {

            if (this.isCompleted && !this.isResolved) {
                alert('Error: dependency failed due to unregistered provider');
                return;
            }

            console.log('Register provider for ' + this);

            this.providers.push(provider);

            var self = this;
            provider.done().then(
                function(value) {
                    // Provider has succeeded
                    if (!!value) {
                        // Provider has returned a value
                        self.resolve(value);
                        self.checkComplete();
                    } else {
                        // Provider has not produced a result
                        self.checkResolvable();
                    }
                },
                function() {
                    // Provider has failed
                    self.checkResolvable();
                }
            );
        };

        // --------------------------------------------------------------------
        /**
         * Resolution promise
         *
         * @returns {promise} - a promise that is resolved when the required
         *                      table|record|file is available; or rejected
         *                      when all providers have failed
         */
        Dependency.prototype.resolved = function() {

            if (this.isResolved) {
                return $q.resolve(this);
            } else if (this.isComplete) {
                return $q.reject('all providers failed for ' + this);
            }

            if (!this.resolution) {
                this.resolution = $q.defer();
            }
            return this.resolution.promise;
        };

        // --------------------------------------------------------------------
        /**
         * Completion promise
         *
         * @returns {promise} - a promise that is resolved when all providers
         *                      of the requested table|record|file have
         *                      completed (regardless whether they have
         *                      succeeded or failed)
         */
        Dependency.prototype.complete = function() {

            if (this.isComplete) {
                return $q.resolve(this);
            }

            if (!this.completion) {
                this.completion = $q.defer();
            }
            return this.completion.promise;
        };

        // --------------------------------------------------------------------
        /**
         * Check completion; resolves the completion promise when all
         * registered providers have a result-status
         */
        Dependency.prototype.checkComplete = function() {

            if (this.isComplete) {
                return;
            }

            var completed = true,
                providers = this.providers;

            if (providers.length) {
                for (var i = providers.length; i--;) {
                    if (providers[i].$result === null) {
                        // Provider task still pending
                        completed = false;
                        break;
                    }
                }
            }

            if (completed) {
                this.isComplete = true;
                if (this.completion) {
                    this.completion.resolve(this);
                }
            }
        };

        // --------------------------------------------------------------------
        /**
         * String-conversion of this dependency
         *
         * @returns {string} - a string representation of this dependency
         */
        Dependency.prototype.toString = function() {

            var represent;
            if (this.uuid) {
                represent = this.tableName + '[' + this.uuid + ']';
            } else if (this.tableName) {
                represent = this.tableName;
            } else if (this.url) {
                represent = this.url;
            } else {
                represent = 'unknown';
            }
            return represent;
        };

        // --------------------------------------------------------------------
        /**
         * Check whether there is at least one more provider available
         * to resolve this dependency; otherwise reject the resolution
         * promise
         */
        Dependency.prototype.checkResolvable = function() {

            if (this.isResolved) {
                return;
            }

            var resolvable = false,
                providers = this.providers;
            if (providers.length) {
                for (var i = providers.length; i--;) {
                    if (providers[i].$result === null) {
                        // Provider task still pending
                        resolvable = true;
                        break;
                    }
                }
            }

            if (!resolvable) {
                this.isComplete = true;
                if (this.completion) {
                    this.completion.resolve(this);
                }
                if (this.resolution) {
                    this.resolution.reject('all providers failed for ' + this);
                }
            }
        };

        // --------------------------------------------------------------------
        /**
         * Resolve this dependency; resolves the resolution promise
         *
         * @param {mixed} ref - the reference to expected result (i.e. the
         *                      table name, or record ID, or file URI)
         */
        Dependency.prototype.resolve = function(ref) {

            // Store the result reference
            if (this.uuid) {
                this.tableCreated = true;
                this.recordID = ref;
            } else if (self.tableName) {
                this.tableCreated = true;
            } else if (self.url) {
                this.fileURI = ref;
            }

            // Resolve the resolution promise
            this.isResolved = true;
            if (this.resolution) {
                this.resolution.resolve(this);
            }
        };

        // --------------------------------------------------------------------
        /**
         * Reject this dependency (e.g. when the table doesn't exist)
         *
         * @param {string} reason - reason for the rejection to report
         *                          to any client tasks
         */
        Dependency.prototype.reject = function(reason) {

            this.isComplete = true;
            if (this.completion) {
                this.completion.resolve(this);
            }
            if (this.resolution) {
                this.resolution.reject(this + ': ' + reason);
            }
        };

        // --------------------------------------------------------------------
        /**
         * All current dependencies
         */
        var currentDependencies;

        var resetDependencies = function() {

            // @todo: reject all unresolved dependencies when called?

            currentDependencies = {
                schemas: {
                    // tableName: dependency
                },
                records: {
                    // tableName: {
                    //    uuid: dependency
                    // }
                },
                files: {
                    // downloadURL: dependency
                }
            };
        };

        // Initial call
        resetDependencies();

        // --------------------------------------------------------------------
        /**
         * Get a dependency for a table, record or file
         *
         * @param {string} tableName - the table name
         * @param {string} uuid - the record UUID
         * @param {string} url - the URL to download the file
         *
         * @returns {Dependency} - a Dependency instance
         */
        var require = function(tableName, uuid, url) {

            var dependency;

            if (tableName) {

                if (uuid) {
                    // Record dependency
                    var recordDependencies = currentDependencies.records,
                        records;

                    // Find or create the record dependencies for this table
                    if (recordDependencies.hasOwnProperty(tableName)) {
                        records = recordDependencies[tableName];
                    } else {
                        records = {};
                        recordDependencies[tableName] = records;
                    }

                    // Find or create the dependency for this record
                    if (records.hasOwnProperty(uuid)) {
                        dependency = records[uuid];
                    } else {
                        dependency = new Dependency(tableName, uuid);
                        records[uuid] = dependency;
                    }

                } else {
                    // Schema dependency
                    var schemas = currentDependencies.schemas;
                    if (schemas.hasOwnProperty(tableName)) {
                        dependency = schemas[tableName];
                    } else {
                        dependency = new Dependency(tableName);
                        schemas[tableName] = dependency;
                    }
                }

            } else if (url) {
                // File dependency
                files = currentDependencies.files;
                if (files.hasOwnProperty(url)) {
                    dependency = files[url];
                } else {
                    dependency = new Dependency(null, null, url);
                    files[url] = dependency;
                }
            }

            return dependency;
        };

        // --------------------------------------------------------------------
        /**
         * Register a provider for a dependency; shorthand for
         * require().registerProvider()
         *
         * @param {SyncTask} provider - the SyncTask providing the required
         *                              resource
         * @param {string} tableName - the table name
         * @param {string} uuid - the record UUID
         * @param {string} url - the URL to download the file
         */
        var provide = function(provider, tableName, recordID, resourceURI) {

            // Get or create the dependency
            var dependency = require(tableName, recordID, resourceURI);

            // Register the provider
            if (!!dependency) {
                dependency.registerProvider(provider);
            }
        };

        // ====================================================================
        // Export Item
        // ====================================================================
        /**
         * Constructor to represent a single record export
         *
         * @param {DataExport} task - the data export task
         * @param {Table} table - the Table
         * @param {object} record - the record data
         */
        function ExportItem(task, table, record) {

            this.task = task;

            // Encode record as S3JSON object
            var jsonData = emS3JSON.encodeRecord(table, record),
                fieldName;

            this.data = jsonData.data; // S3JSON record data

            // Collect the UUIDs for all references
            var references = jsonData.references;
            for (fieldName in references) {
                this.addReference(fieldName, references[fieldName]);
            }

            // Collect the file names for all upload-fields
            var files = jsonData.files;
            for (fieldName in files) {
                this.addFile(fieldName, files[fieldName]);
            }
        }

        /**
         * Add the UUID of a referenced record to the S3JSON data
         *
         * @param {string} fieldName - the field name
         * @param {Array} reference - the reference as tuple,
         *                            format: [tableName, recordID]
         */
        ExportItem.prototype.addReference = function(fieldName, reference) {

            var task = this.task,
                data = this.data,
                lookupTable = reference[0],
                recordID = reference[1];

            $q.when(task.getUID(lookupTable, recordID)).then(function(uuid) {
                emS3JSON.addReference(data, fieldName, lookupTable, uuid);
            });
        };

        /**
         * Add the file name of a referenced file to the S3JSON data
         *
         * @param {string} fieldName - the field name
         * @param {string} fileURI - the file URI
         */
        ExportItem.prototype.addFile = function(fieldName, fileURI) {

            var task = this.task,
                data = this.data;

            $q.when(task.getFile(fileURI)).then(function(fileName) {
                emS3JSON.addFile(data, fieldName, fileName);
            });
        };

        // ====================================================================
        // Reference Map
        // ====================================================================
        /**
         * Structure to manage UUID-lookups for (and implicit exports of)
         * referenced records in a table
         *
         * @param {DataExport} task - the data export task
         * @param {string} tableName - the tableName
         */
        function ReferenceMap(task, tableName) {

            this.task = task;
            this.tableName = tableName;

            // Items to export; {recordID: ExportItem}
            this.items = {};

            // UUIDs for references; {recordID: uuid|promise}
            this.uuids = {};

            // Deferred lookups; {recordID: deferred}
            this.pending = {};
            this.hasPendingItems = false;
        }

        // --------------------------------------------------------------------
        /**
         * Get the UUID of a record
         *
         * @param {integer} recordID - the record ID
         * @returns {string|promise} - the UUID of the record, or a promise
         *                             that will be resolved with the UUID
         */
        ReferenceMap.prototype.getUID = function(recordID) {

            var uuids = this.uuids;
            if (uuids.hasOwnProperty(recordID)) {

                // We either have the UUID, or have already promised it
                // => just return it
                return uuids[recordID];

            } else {

                // Create a deferred lookup, store+return promise
                var deferred = $q.defer(),
                    uuid = deferred.promise;

                this.pending[recordID] = deferred;
                this.hasPendingItems = true;

                uuids[recordID] = deferred.promise;
                return uuid;
            }
        };

        // --------------------------------------------------------------------
        /**
         * Perform all deferred lookups; create export items for all
         * referenced records that are new or have been modified after
         * last synchronization
         *
         * @param {boolean} all - export all (new|modified) records in the table
         */
        ReferenceMap.prototype.load = function(all) {

            var deferred = $q.defer(),
                task = this.task,
                lookups = this.pending,
                uuids = this.uuids,
                self = this;

            // Reset pending
            this.pending = {};
            this.hasPendingItems = false;

            emDB.table(this.tableName).then(function(table) {

                var synchronizedOn = table.$('synchronized_on'),
                    modifiedOn = table.$('modified_on'),
                    query = synchronizedOn.is(null).or(
                            synchronizedOn.lessThan(modifiedOn)),
                    subSet;

                // Which records to export (query)
                if (!all) {
                    subSet = table.$('id').in(Object.keys(lookups));
                    query = subSet.and(query);
                }

                // Which fields to export (query)
                var fields = [],
                    field,
                    mandatoryFields = ['id', 'uuid', 'modified_on', 'created_on'];
                for (var fieldName in table.fields) {
                    field = table.fields[fieldName];
                    if (mandatoryFields.indexOf(fieldName) != -1 || !field.meta) {
                        fields.push(fieldName);
                    }
                }

                table.where(query).select(fields, function(rows) {

                    var record,
                        recordID,
                        uuid;

                    rows.forEach(function(row) {

                        record = row._();
                        recordID = record.id;
                        uuid = record.uuid;

                        // Resolve the UUID-promise
                        uuids[recordID] = uuid;
                        if (lookups.hasOwnProperty(recordID)) {
                            lookups[recordID].resolve(uuid);
                        }

                        // Create an export item
                        self.items[recordID] = new ExportItem(task, table, record);

                        // Remove from lookups
                        if (!all) {
                            delete lookups[recordID];
                        }
                    });

                    if (all) {

                        deferred.resolve();

                    } else {

                        // For the remaining lookups, just look up the UUID
                        table.where(subSet).select(['id', 'uuid'], function(rows) {

                            rows.forEach(function(row) {

                                // Resolve the UUID-promise
                                recordID = row.$('id');
                                uuid = row.$('uuid');
                                uuids[recordID] = uuid;
                                if (lookups.hasOwnProperty(recordID)) {
                                    lookups[recordID].resolve(uuid);
                                }
                            });

                            for (recordID in lookups) {
                                // Debug-breakpoint - we should never get here!
                                // ...but if we however do, then rejecting is
                                // the right thing to do:
                                lookups[recordID].reject();
                            }
                            deferred.resolve();
                        });
                    }
                });
            });

            return deferred.promise;
        };

        // ====================================================================
        // Synchronization Tasks
        // ====================================================================
        /**
         * SyncTask to export data from a database table
         *
         * @param {SyncJob} job - the SyncJob this task belongs to
         */
        function DataExport(job) {

            SyncTask.apply(this, [job]);

            // All reference maps for this task
            this.references = {
                // tableName: ReferenceMap
            };

            this.files = {
                // fileName: fileURI
            };
        }
        DataExport.prototype = Object.create(SyncTask.prototype);
        DataExport.prototype.constructor = DataExport;

        /**
         * Execute this data export; produces a DataUpload task
         */
        DataExport.prototype.execute = function() {

            // Create a ReferenceMap for the target table
            var self = this,
                tableName = this.job.tableName,
                refMap = new ReferenceMap(this, tableName);

            this.references[tableName] = refMap;

            // Load all (new|modified) records in the target table,
            // then resolve all foreign keys (and export referenced
            // records as necessary)
            refMap.load(true).then(function() {
                self.export().then(function() {

                    var jsonData = {},
                        references = self.references,
                        tableName,
                        refMap,
                        items,
                        data;

                    // Collect all records into one S3JSON object
                    for (tableName in references) {

                        items = references[tableName].items;
                        data = [];

                        for (var recordID in items) {
                            data.push(items[recordID].data);
                        }

                        angular.extend(jsonData, emS3JSON.encode(tableName, data));
                    }

                    // Generate the data upload task, then resolve
                    var dataUpload = new DataUpload(self.job, jsonData, self.files);
                    self.resolve(dataUpload);
                });
            });
        };

        /**
         * Recursively resolves all foreign keys into UUIDs, exports
         * referenced records if they have been added|modified since
         * last synchronization
         *
         * @param {deferred} deferred - the deferred object to resolve
         *                              during recursion
         *
         * @returns {promise} - a promise that will be resolved when
         *                      all keys have been resolved
         */
        DataExport.prototype.export = function(deferred) {

            if (deferred === undefined) {
                deferred = $q.defer();
            }

            var pending = [],
                references = this.references,
                refMap;
            for (var tableName in references) {
                refMap = references[tableName];
                if (refMap.hasPendingItems) {
                    pending.push(refMap);
                }
            }

            if (!pending.length) {
                deferred.resolve();
            } else {
                var loaded = [],
                    self = this;
                pending.forEach(function(refMap) {
                    loaded.push(refMap.load());
                });
                $q.all(loaded).then(function() {
                    self.export(deferred);
                });
            }

            return deferred.promise;
        };

        /**
         * Look up the UUID of a referenced record
         *
         * @param {string} tableName - the table name
         * @param {integer} recordID - the record ID
         *
         * @returns {string|promise} - the UUID of the record, or a promise
         *                             that will be resolved with the UUID
         */
        DataExport.prototype.getUID = function(tableName, recordID) {

            // Get the reference map for the table
            var referenceMap = this.references[tableName];

            // If it doesn't yet exist => create it
            if (referenceMap === undefined) {
                referenceMap = new ReferenceMap(this, tableName);
                this.references[tableName] = referenceMap;
            }

            // Look up the UUID from the referenceMap
            return referenceMap.getUID(recordID);
        };

        /**
         * Schedule a referenced file for upload (attachment)
         *
         * @param {string} fileURI - the local file URI
         *
         * @returns {string} - the file name to reference the attachment
         */
        DataExport.prototype.getFile = function(fileURI) {

            var fileName = fileURI.split('/').pop().split('#')[0].split('?')[0];

            this.files[fileName] = fileURI;

            return fileName;
        };

        // --------------------------------------------------------------------
        /**
         * SyncTask to upload data to the server
         *
         * @param {object} data - the S3JSON data to send
         * @param {array} files - array of file URIs to attach
         */
        function DataUpload(job, data, files) {

            SyncTask.apply(this, [job]);

            this.data = data;
            this.files = files;
        }
        DataUpload.prototype = Object.create(SyncTask.prototype);
        DataUpload.prototype.constructor = DataUpload;

        /**
         * Execute the data upload
         *
         * @returns {promise} - a promise that is resolved when the
         *                      upload is complete
         */
        DataUpload.prototype.execute = function() {

            var deferred = $q.defer(),
                self = this;

            // Collect the attachments
            var files = this.files,
                fileHooks = [];
            for (var fileName in files) {
                fileHooks.push([fileName, files[fileName]]);
            }

            // Prepare data for upload
            var uploadData = JSON.stringify(this.data);
            if (fileHooks.length) {
                uploadData = {
                    'data.s3json': uploadData,
                    '_files': fileHooks
                };
            }

            // Use ignore_errors=True
            var ref = this.job.ref;
            if (!ref.v) {
                ref.v = {};
            }
            ref.v.ignore_errors = 'True';

            // Upload
            emServer.postData(ref, uploadData,
                function(response) {
                    self.updateSyncDate(response);
                    self.resolve();
                },
                function(error) {
                    self.reject(emServer.parseServerError(response));
                });

            return deferred.promise;
        };

        /**
         * Identify accepted objects and update their synchronized_on
         *
         * @param {object} response - the response object from the server
         *
         * @todo: extend for component support
         */
        DataUpload.prototype.updateSyncDate = function(response) {

            var errorTree = response.tree,
                rejected = {},
                rejectedItems,
                key,
                tableName,
                uuid,
                error;

            // Collect UUIDs of rejected items
            if (errorTree) {

                for (key in errorTree) {
                    if (key.slice(0, 2) == '$_') {

                        tableName = key.slice(2);
                        if (!rejected.hasOwnProperty(tableName)) {
                            rejected[tableName] = {};
                        }
                        rejectedItems = rejected[tableName];

                        errorTree[key].forEach(function(item) {
                            uuid = item['@uuid'];
                            error = item['@error'];
                            if (uuid && error) {
                                rejectedItems[uuid] = error;
                            }
                        });
                    }
                }
            }

            var uploaded = this.data,
                accepted = {},
                acceptedItems;

            // Collect UUIDs of accepted items
            for (key in uploaded) {

                if (key.slice(0, 2) == '$_') {

                    tableName = key.slice(2);
                    if (!accepted.hasOwnProperty(tableName)) {
                        accepted[tableName] = [];
                    }

                    acceptedItems = accepted[tableName];
                    rejectedItems = rejected[tableName] || {};

                    uploaded[key].forEach(function(item) {
                        uuid = item['@uuid'];
                        if (!rejectedItems.hasOwnProperty(uuid)) {
                            acceptedItems.push(uuid);
                        }
                    });
                }
            }

            // Set synchronized_on for accepted items
            var now = new Date();
            for (tableName in accepted) {
                this.setSyncDate(tableName, accepted[tableName], now);
            }
        };

        /**
         * Set synchronized_on for records
         *
         * @param {string} tableName - the table name
         * @param {Array} uuids - array of uuids for which to set
         *                        synchronized_on
         * @param {Date} syncDate - the value for synchronized_on
         */
        DataUpload.prototype.setSyncDate = function(tableName, uuids, syncDate) {

            if (uuids.length) {
                var quoted = uuids.map(function(uuid) {
                        return '"' + uuid + '"';
                    }),
                    query = 'uuid IN (' + quoted.join(',') + ')';

                emDB.table(tableName).then(function(table) {
                    table.update({
                        synchronized_on: syncDate,
                        _noDefaults: true
                    }, query, null);
                });
            }
        };

        // --------------------------------------------------------------------
        /**
         * SyncTask to import a record
         *
         * @param {SyncJob} job - the SyncJob this task belongs to
         * @param {string} tableName - the table name
         * @param {Record} record - the record data (prototype in s3json.js)
         */
        function DataImport(job, tableName, record) {

            SyncTask.apply(this, [job]);

            this.tableName = tableName;
            this.record = record;
            this.resolved = false;

            // Register as provider for the record
            provide(this, tableName, record.uuid);

            // Check for dependencies
            var dependencies;
            if (this.isResolved()) {
                dependencies = null;
                this.actionable = $q.resolve();
            } else {
                dependencies = $q.defer();
                this.actionable = dependencies.promise;
            }
            this.dependencies = dependencies;

            var fieldName,
                dependency,
                references = record.references,
                reference,
                files = record.files,
                downloadURL,
                self = this;

            // Register record dependencies
            for (fieldName in references) {
                reference = references[fieldName];
                dependency = require(reference[0], reference[1]);
                dependency.complete().then(function(dependency) {
                    self.addForeignKey(record, dependency);
                    if (!!self.dependencies && self.isResolved()) {
                        self.dependencies.resolve();
                    }
                });
            }

            // Register file dependencies
            for (fieldName in files) {
                downloadURL = files[fieldName];
                dependency = require(null, null, downloadURL);
                dependency.complete().then(function(dependency) {
                    self.addFileURI(record, dependency);
                    if (!!self.dependencies && self.isResolved()) {
                        self.dependencies.resolve();
                    }
                });
            }
        }
        DataImport.prototype = Object.create(SyncTask.prototype);
        DataImport.prototype.constructor = DataImport;

        /**
         * Execute the data import; creates the local record
         */
        DataImport.prototype.execute = function() {

            var self = this,
                tableName = this.tableName;

            this.actionable.then(function() {
                emDB.table(tableName).then(function(table) {

                    if (!table) {
                        self.reject('table not found: ' + tableName);
                        return;
                    }

                    var record = self.record,
                        data = record.data;
                    table.identify(data).then(function(original) {

                        if (original) {
                            // Update existing record

                            var recordID = original.id,
                                modifiedOn = original.modified_on,
                                synchronizedOn = original.synchronized_on;

                            // Get time stamp for remote record
                            var timeStamp = data.modified_on;
                            if (!timeStamp) {
                                // Fall back to created_on
                                timeStamp = data.created_on;
                            }

                            // Simplified NEWER-policy:
                            // If...
                            // - the remote record age is unknown (=no timeStamp), or
                            // - the record has never been synchronized before and
                            //   the remote record is older, or
                            // - the remote record has not been modified since last
                            //   sync, then
                            // => skip the import (=resolve without updating)
                            if (!timeStamp ||
                                !synchronizedOn && timeStamp < modifiedOn ||
                                timeStamp <= synchronizedOn) {
                                self.resolve(recordID);
                                return;
                            }

                            // Set synchronized_on to now
                            data.synchronized_on = new Date();

                            var query = 'id=' + recordID;
                            table.update(data, query,
                                function(numRowsAffected) {
                                    if (numRowsAffected) {
                                        self.resolve(recordID);
                                    } else {
                                        self.reject('error updating record');
                                    }
                                });

                        } else {
                            // Create new record

                            // Set synchronized_on to now
                            data.synchronized_on = new Date();

                            table.insert(data,
                                function(insertID) {
                                    if (insertID) {
                                        self.resolve(insertID);
                                    } else {
                                        self.reject('error creating record');
                                    }
                                });
                        }
                    });
                });
            });
        };

        /**
         * Add a pending foreign key
         *
         * @param {Record} record - the target Record
         * @param {Dependency} dependency - the dependency
         */
        DataImport.prototype.addForeignKey = function(record, dependency) {

            var references = record.references,
                reference,
                fieldName;

            // Resolve all pending references that match the dependency
            for (fieldName in references) {
                reference = references[fieldName];
                if (reference[0] == dependency.tableName && reference[1] == dependency.uuid) {
                    if (dependency.isResolved) {
                        record.data[fieldName] = dependency.recordID;
                    }
                    delete record.references[fieldName];
                }
            }
        };

        /**
         * Add a pending fileURI (upload fields)
         *
         * @param {Record} record - the target Record
         * @param {Dependency} dependency - the dependency
         */
        DataImport.prototype.addFileURI = function(record, dependency) {

            var references = record.references,
                reference,
                fieldName;

            // Resolve all pending uploads that match the dependency
            for (fieldName in references) {
                reference = references[fieldName];
                if (reference == dependency.url) {
                    if (dependency.isResolved) {
                        record.data[fieldName] = dependency.fileURI;
                    }
                    delete record.references[fieldName];
                }
            }
        };

        /**
         * Check whether all record dependencies have been processed
         *
         * @returns {boolean} - true if dependency processing is complete
         */
        DataImport.prototype.isResolved = function() {

            if (!this.resolved) {
                if (Object.keys(this.record.references).length) {
                    return false;
                }
                if (Object.keys(this.record.files).length) {
                    return false;
                }
                this.resolved = true;
            }
            return true;
        };

        /**
         * Helper function to generate data import tasks from S3JSON
         *
         * @param {SyncJob} job - the sync job
         * @param {string} tableName - the target table name
         * @param {object} data - the S3JSON data
         *
         * @returns {promise} - a promise that resolves into a tuple
         *                      [dataImports, filesRequired], where:
         *                      dataImports => array of DataImport tasks
         *                      filesRequired => array of download URLs
         */
        var createDataImports = function(job, tableName, data) {

            var deferred = $q.defer();

            emDB.tables().then(function(tables) {

                var dataImports = [],
                    filesRequired = [];

                // Decode the S3JSON data
                var map = emS3JSON.decode(tables, tableName, data);

                for (var tn in map) {

                    var records = map[tn],
                        record,
                        files,
                        downloadURL,
                        fieldName,
                        dataImport;

                    for (var uuid in records) {

                        // Generate a DataImport task
                        record = records[uuid];
                        dataImport = new DataImport(job, tn, record);
                        dataImports.push(dataImport);

                        // Collect the download URLs of the required files
                        files = record.files;
                        for (fieldName in files) {
                            downloadURL = files[fieldName];
                            filesRequired.push(downloadURL);
                        }
                    }
                }

                deferred.resolve([dataImports, filesRequired]);
            });

            return deferred.promise;
        };

        // --------------------------------------------------------------------
        /**
         * SyncTask to import a table schema
         *
         * @param {SyncJob} job - the SyncJob that generated this task
         * @param {string} tableName - the name of the table to install
         * @param {object} schemaData - the schema data from the Sahana
         *                              server for the table
         * @param {boolean} lookup - whether this is an implicit import
         *                           of a look-up table schema
         */
        function SchemaImport(job, tableName, schemaData, lookup) {

            SyncTask.apply(this, [job]);

            this.tableName = tableName;
            this.lookup = !!lookup;

            // The name of the table this task will import
            this.provides = tableName;

            // The names of the tables this task requires
            this.requires = [];

            // Decode the schemaData
            var importData = this.decode(schemaData),
                dependencies = [];

            this.schema = importData.schema;
            this.data = importData.data;

            this.dataImports = null;
            this.filesRequired = null;

            // Collect dependencies
            if (importData.schema) {
                this.requires.forEach(function(requirement) {
                    dependencies.push(require(requirement));
                });
            }
            this.dependencies = dependencies;
        }
        SchemaImport.prototype = Object.create(SyncTask.prototype);
        SchemaImport.prototype.constructor = SchemaImport;

        /**
         * Execute this schema import (async); installs or updates
         * the Resource, also installing or updating the database
         * table as necessary
         */
        SchemaImport.prototype.execute = function() {

            console.log('Execute SchemaImport for ' + this.tableName);

            // Collect the promises for all acquired dependencies
            var dependencies = this.dependencies,
                resolved = [];

            dependencies.forEach(function(dependency) {
                resolved.push(dependency.resolved());
            });

            var self = this;
            $q.all(resolved).then(
                function() {
                    // all dependencies resolved => go ahead
                    console.log('Importing schema for ' + self.tableName);
                    emResources.install(self.tableName, self.schema).then(
                        function() {
                            // Schema installation successful

                            if (self.lookup && self.data) {

                                // Create data import tasks for look-up data
                                createDataImports(self.job, self.tableName, self.data).then(
                                    function(result) {
                                        self.dataImports = result[0];
                                        self.filesRequired = result[1];
                                        self.resolve(self.tableName);
                                    });

                            } else {

                                self.resolve(self.tableName);
                            }
                        },
                        function(error) {
                            // Schema installation failed
                            self.reject(error);
                        });
                },
                function(error) {
                    // A dependency failed
                    self.reject(error);
                });
        };

        /**
         * Convert Sahana schema data to internal format
         *
         * @param {object} schemaData - the schema data received from
         *                              the Sahana server
         *
         * @returns {object} - the schema specification in
         *                     internal format
         */
        SchemaImport.prototype.decode = function(schemaData) {

            var job = this.job,
                requires = this.requires;

            var schema = {},
                data = null,
                fieldName,
                fieldSpec,
                fieldType,
                reference,
                lookupTable;

            // Field specs
            var fieldDescriptions = schemaData.schema;
            for (fieldName in fieldDescriptions) {

                // Decode field description and add spec to schema
                fieldSpec = this.decodeField(fieldDescriptions[fieldName]);
                if (!!fieldSpec) {
                    schema[fieldName] = fieldSpec;
                }

                // Add look-up table to requires if foreign key
                fieldType = fieldSpec.type;
                reference = emUtils.getReference(fieldType);
                if (reference) {
                    lookupTable = reference[1];
                    if (lookupTable && requires.indexOf(lookupTable) == -1) {
                        requires.push(lookupTable);
                    }
                }
            }

            // Table settings
            // @todo: component declarations, data card format...
            if (schemaData.form) {
                schema._form = schemaData.form;
            }
            if (schemaData.subheadings) {
                schema._subheadings = schemaData.subheadings;
            }
            if (schemaData.strings) {
                schema._strings = schemaData.strings;
            }

            if (this.provides == job.tableName) {

                // Main schema
                schema._main = true;
                schema._name = job.resourceName;

                // Store link to server resource
                var ref = job.ref;
                schema._controller = schemaData.controller || ref.c;
                schema._function = schemaData.function || ref.f;

            } else {

                // Reference or component schema => name after table
                schema._name = this.provides;

                // Do we have any look-up records to import?
                if (this.lookup && schemaData.hasOwnProperty('data')) {
                    data = schemaData.data;
                }
            }

            return {
                schema: schema,
                data: data
            };
        };

        /**
         * Convert a Sahana field description to internal format
         *
         * @param {object} FieldDescription - the field description from
         *                                    the Sahana server
         *
         * @returns {object} - the field specification in internal format
         */
        SchemaImport.prototype.decodeField = function(fieldDescription) {

            var spec = {
                type: fieldDescription.type || 'string',
            };

            if (!!fieldDescription.label) {
                spec.label = fieldDescription.label;
            }
            if (!!fieldDescription.options) {
                spec.options = fieldDescription.options;
            }
            if (fieldDescription.hasOwnProperty('default')) {
                spec.defaultValue = fieldDescription.default;
            }

            var settings = fieldDescription.settings;
            for (var keyword in fieldDescription.settings) {
                if (!spec.hasOwnProperty(keyword)) {
                    spec[keyword] = settings[keyword];
                }
            }

            return spec;
        };

        // --------------------------------------------------------------------
        /**
         * Sync Task to:
         * - download a mobile form from the server
         * - generate an array of SchemaImport tasks for it
         */
        function FormDownload(job) {

            SyncTask.apply(this, [job]);
        }
        FormDownload.prototype = Object.create(SyncTask.prototype);
        FormDownload.prototype.constructor = FormDownload;

        /**
         * Execute the form download
         */
        FormDownload.prototype.execute = function() {

            var job = this.job,
                self = this;

            var msince = null;
            emResources.open(job.resourceName).then(function(resource) {

                if (resource !== undefined) {
                    // Existing resource => apply schemaDate for msince
                    msince = resource.getSchemaDate();
                }
                self.download(msince);
            });
        };

        /**
         * Download the form; parses the form data and creates SchemaImport
         * tasks for both the main schema and any dependencies of the main
         * schema if available in the form data.
         */
        FormDownload.prototype.download = function(msince) {

            var job = this.job,
                ref = job.ref,
                self = this;

            // Apply msince
            if (msince) {
                if (!ref.v) {
                    ref.v = {};
                }
                ref.v.msince = msince.toISOString().split('.')[0];
            }

            console.log('Downloading ' + ref.c + '/' + ref.f);

            emServer.getForm(ref,
                function(data) {

                    var schemaImports = [],
                        main = data.main,
                        references = data.references,
                        tableName = main.tablename,
                        schemaImport = new SchemaImport(job, tableName, main),
                        referenceImport,
                        requirements = schemaImport.requires.slice(0),
                        requirement,
                        provided = [tableName];

                    if (!!references) {
                        while(requirements.length) {

                            requirement = requirements.shift();

                            // Have we already provided a SchemaImport for
                            // this requirement?
                            if (provided.indexOf(requirement) != -1) {
                                continue;
                            }

                            // Do we have a reference schema in the download
                            // data?
                            if (references.hasOwnProperty(requirement)) {

                                // Create a SchemaImport for the referenced table
                                referenceImport = new SchemaImport(job,
                                                            requirement,
                                                            references[requirement],
                                                            true);
                                schemaImports.push(referenceImport);

                                // Note as provided
                                provided.push(requirement);

                                // Capture new requirements of the reference import
                                referenceImport.requires.forEach(function(name) {
                                    if (provided.indexOf(name) == -1) {
                                        requirements.push(name);
                                    }
                                });

                            }
                        }
                    }

                    // Append the main schema import
                    schemaImports.push(schemaImport);

                    // Resolved
                    self.resolve(schemaImports);
                },
                function(response) {

                    // Download failed
                    self.reject(emServer.parseServerError(response));
                });
        };

        // --------------------------------------------------------------------
        /**
         * SyncTask to:
         * - download resource data from the server (S3JSON)
         * - decode the S3JSON data and generate DataImport jobs
         * - collect the download URLs for all required files
         */
        function DataDownload(job) {

            SyncTask.apply(this, [job]);
        }
        DataDownload.prototype = Object.create(SyncTask.prototype);
        DataDownload.prototype.constructor = DataDownload;

        /**
         * Execute the data download; decodes the S3JSON data received
         * and creates DataImport tasks for all relevant items
         */
        DataDownload.prototype.execute = function() {

            var job = this.job,
                ref = job.ref,
                self = this;

            console.log('Downloading data from ' + ref.c + '/' + ref.f);

            emResources.open(job.resourceName).then(function(resource) {

                if (!resource) {
                    self.reject('undefined resource');
                    return;
                }

                // Set msince
                var lastSync = resource.getLastSync();
                if (lastSync) {
                    var msince = lastSync.toISOString().split('.')[0];
                    if (!ref.v) {
                        ref.v = {};
                    }
                    ref.v.msince = msince;
                }

                // Start download
                emServer.getData(job.ref,
                    function(data) {

                        createDataImports(job, job.tableName, data).then(
                            function(result) {
                                self.resolve(result);
                            });

                        // Update lastSync date
                        resource.setLastSync(new Date());
                    },
                    function(response) {
                        // Download failed
                        self.reject(emServer.parseServerError(response));
                    });
            });
        };

        // ====================================================================
        // Synchronization Jobs
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

            // @todo: cleanup
            this.type = type;   // form || data
            this.mode = mode;   // pull || push

            this.resourceName = resourceName;
            this.tableName = tableName;
            this.ref = ref;

            this.parent = null;

            this.status = 'pending';
            this.error = null;

            this.$result = null;    // result flag, required by downloadForms

            // Deferred action and completed-promise
            this.action = $q.defer();
            this.completed = this.action.promise; // @todo: deprecate together with run
        }

        // --------------------------------------------------------------------
        /**
         * Generate a download task for this job
         *
         * @returns {SyncTask} - the download task
         */
        SyncJob.prototype.download = function() {

            var task;
            if (this.mode == 'pull') {
                var jobType = this.type;
                if (jobType == 'form') {
                    // Produce a FormDownload task and return it
                    task = new FormDownload(this);
                } else if (jobType == 'data') {
                    // Produce a DataDownload task and return it
                    task = new DataDownload(this);
                }
            }
            return task;
        };

        // --------------------------------------------------------------------
        /**
         * Set the job result, log it and update the job queue
         *
         * @param {string} status: the final status success|error|cancelled
         * @param {string} message: the error message (if any)
         *
         * @todo: rewrite (e.g. completed-promise no longer relevant)
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

            if (result) {

                this.$result = result;
                this.complete = true; // @todo: deprecate in favor of $result

                // Update global sync status
                updateSyncStatus();

                // Resolve (or reject) completed-promise
                if (result == 'success') {
                    this.action.resolve(result);
                } else {
                    this.action.reject(result);
                }
            }
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
            if (created.length) {
                created.forEach(add);
            }
            if (updated.length) {
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
        // SyncJob Queue
        // ====================================================================

        // Current job queue and flags
        var currentJobs = [];

        // --------------------------------------------------------------------
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
                    currentJobs.push(formJob);
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
                    currentJobs.push(dataJob);
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
                        currentJobs.push(job);
                        jobsScheduled++;
                    }
                }
            });

            return jobsScheduled;
        };

        // --------------------------------------------------------------------
        /**
         * Clean up job queue:
         * - fail all remaining jobs
         * - reset dependencies
         *
         * @todo: review concept
         */
        var cleanupJobs = function() {

            if (currentJobs.length) {
                currentJobs.forEach(function(job) {
                    if (!job.$result) {
                        job.result('error', 'not implemented');
                    }
                });
            }
            currentJobs = [];
            resetDependencies();
        };

        // --------------------------------------------------------------------
        /**
         * Update the global sync status ($rootScope.syncInProgress)
         *
         * @todo: review concept
         */
        var statusUpdate = false;
        var updateSyncStatus = function() {

            if (statusUpdate) {
                $timeout(updateSyncStatus, 100);
            } else {
                statusUpdate = true;
                var openJobs = currentJobs.filter(function(job) {
                    return (!job.$result);
                });
                if (openJobs.length) {
                    $rootScope.syncInProgress = true;
                } else {
                    currentJobs = [];
                    currentStage(null);
                    $rootScope.syncInProgress = false;
                }
                statusUpdate = false;
            }
        };

        // ====================================================================
        // FormList Management
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

        // --------------------------------------------------------------------
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
        // ResourceList Management
        // ====================================================================
        /**
         * Update the list of available/selected resources
         *
         * @param {array} currentList - the current resource list
         * @param {array} resources - the resource information from the server
         *
         * @returns {array} - the updated resource list
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

        // --------------------------------------------------------------------
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
        // Synchronization Process
        // ====================================================================
        /**
         * Sub-process to download forms
         *
         * @param {Array} jobs - the SyncJob queue
         *
         * @returns {promise} - a promise that is resolved with an Array of
         *                      import tasks when the sub-process has
         *                      completed
         */
        var downloadForms = function(jobs) {

            // Generate download-queue
            var downloads = [];
            jobs.forEach(function(job) {
                if (!job.$result && job.type == 'form' && job.mode == 'pull') {

                    console.log('Creating download task for ' + job.resourceName + ' form');

                    var downloadTask = job.download();
                    if (downloadTask) {
                        downloads.push(downloadTask);
                    }
                }
            });

            if (!downloads.length) {
                return $q.resolve([]);
            }

            currentStage('Downloading forms', downloads);

            // Process download-queue
            var deferred = $q.defer(),
                imports = [];
            downloads.forEach(function(download) {
                download.done().then(
                    function(importTasks) {
                        // Download was successful
                        if (importTasks.length) {
                            imports = imports.concat(importTasks);
                        }
                        checkQueue(downloads, deferred, imports);
                    },
                    function(reason) {
                        // Download failed => fail the corresponding job
                        download.job.result('error', reason);
                        checkQueue(downloads, deferred, imports);
                    });
                download.execute();
            });

            return deferred.promise;
        };

        // --------------------------------------------------------------------
        /**
         * Sub-process to resolve dependencies of SchemaImports
         * (synchronously); registers all resolvable SchemaImports as
         * providers for their respective tables
         *
         * @param {Array} schemaImports - array of SchemaImports
         * @param {Array} tableNames - array of all known tables
         *
         * @returns {boolean} - true if dependencies can be resolved,
         *                      otherwise false
         */
        var resolveSchemaDependencies = function(schemaImports, tableNames) {

            if (!schemaImports.length) {
                // No pending schema imports => no dependencies
                return true;
            }

            currentStage('Resolving dependencies');

            var unresolved = [],
                knownTables = tableNames.slice(0),
                unknownTables = [];

            // Create an array of pending, unresolved schemaImports,
            // and generate array of unknown tables from their requires
            schemaImports.forEach(function(schemaImport) {
                if (!schemaImport.$result) {
                    unresolved.push(schemaImport);
                    schemaImport.requires.forEach(function(tableName) {
                        if (knownTables.indexOf(tableName) == -1) {
                            if (unknownTables.indexOf(tableName) == -1) {
                                unknownTables.push(tableName);
                            }
                        }
                    });
                }
            });

            var check,
                resolved,
                index;

            while(unknownTables.length) {

                resolved = 0;

                check = unresolved;
                unresolved = [];

                // Check which schemaImports can be resolved with the
                // currently known tables
                check.forEach(function(schemaImport) {

                    var resolvable = true,
                        requires = schemaImport.requires,
                        provides = schemaImport.provides;

                    if (requires.length) {
                        for (var i=requires.length; i--;) {
                            if (knownTables.indexOf(requires[i]) == -1) {
                                resolvable = false;
                                break;
                            }
                        }
                    }

                    if (resolvable) {
                        // Register as provider
                        provide(schemaImport, provides);

                        // Add provides to knownTables
                        knownTables.push(provides);

                        // Remove provides from unknownTables
                        index = unknownTables.indexOf(provides);
                        if (index !== -1) {
                            resolved++;
                            unknownTables.splice(index, 1);
                        }
                    } else {
                        // Retain for next iteration
                        unresolved.push(schemaImport);
                    }
                });

                if (!resolved && unknownTables.length) {
                    // ERROR: unresolvable dependencies
                    // => fail all related jobs
                    unresolved.forEach(function(schemaImport) {
                        // @todo: modify to report which dependencies
                        //        were unresolvable for each job
                        var job = schemaImport.job;
                        if (!job.$result) {
                            job.result('error', 'Unresolvable schema dependency');
                        }
                    });
                    return false;
                }
            }

            // SUCCESS:
            // => register remaining unresolved schemaImports
            //    as providers for their respective tables
            unresolved.forEach(function(schemaImport) {
                provide(schemaImport, schemaImport.provides);
            });

            return true;
        };

        // --------------------------------------------------------------------
        /**
         * Sub-process to import schemas
         *
         * @param {Array} schemaImports - array of pending schema imports
         */
        var importSchemas = function(schemaImports) {

            if (!schemaImports.length) {
                // No schemas to import => resolve early
                return $q.resolve();
            }

            currentStage('Importing Schemas', schemaImports);

            var deferred = $q.defer(),
                dataImports = [],
                filesRequired = [];

            schemaImports.forEach(function(schemaImport) {
                if (!schemaImport.$result) {
                    schemaImport.done().then(
                        function() {
                            // Schema import succeeded
                            if (schemaImport.dataImports) {
                                dataImports = dataImports.concat(
                                    schemaImport.dataImports);
                            }
                            if (schemaImport.filesRequired) {
                                filesRequired = filesRequired.concat(
                                    schemaImport.filesRequired);
                            }
                            checkQueue(schemaImports, deferred, [dataImports, filesRequired]);
                        },
                        function(error) {
                            // Schema import failed; if this was the
                            // job's main schema, then fail the job
                            var job = schemaImport.job;
                            if (schemaImport.provides == job.tableName) {
                                job.result('error', error);
                            }
                            // Check queue
                            checkQueue(schemaImports, deferred);
                        });
                    schemaImport.execute();
                }
            });

            return deferred.promise;
        };

        // --------------------------------------------------------------------
        /**
         * Sub-process to download data
         *
         * @param {Array} jobs - the SyncJob queue
         */
        var downloadData = function(jobs) {

            // Generate download-queue
            var downloads = [];
            jobs.forEach(function(job) {
                if (!job.$result && job.type == 'data' && job.mode == 'pull') {

                    console.log('Creating download task for ' + job.resourceName + ' data');

                    var downloadTask = job.download();
                    if (downloadTask) {
                        downloads.push(downloadTask);
                    }
                }
            });

            if (!downloads.length) {
                // No data to download => resolve early
                return $q.resolve([[], []]);
            }

            currentStage('Downloading data', downloads);

            var deferred = $q.defer(),
                imports = [],
                filesRequired = [];
            downloads.forEach(function(download) {
                download.done().then(
                    function(result) {
                        var importTasks = result[0],
                            filesRequired = result[1];
                        // Download was successful
                        if (importTasks.length) {
                            imports = imports.concat(importTasks);
                        }
                        if (filesRequired && filesRequired.length) {
                            filesRequired = filesRequired.concat(filesRequired);
                        }
                        checkQueue(downloads, deferred, [imports, filesRequired]);
                    },
                    function(reason) {
                        // Download failed => fail the corresponding job
                        download.job.result('error', reason);
                        checkQueue(downloads, deferred, [imports, filesRequired]);
                    });
                download.execute();
            });

            return deferred.promise;
        };

        // --------------------------------------------------------------------
        /**
         * Sub-process to resolve record dependencies before import
         *
         * @returns {promise} - a promise that is resolved when all
         *                      dependencies have been checked
         */
        var resolveRecordDependencies = function() {

            var recordDependencies = currentDependencies.records,
                tableNames = Object.keys(recordDependencies);

            if (!tableNames.length) {
                // No record dependencies => resolve early
                return $q.resolve();
            }

            currentStage('Resolving dependencies');

            var deferred = $q.defer();

            tableNames.forEach(function(tableName) {

                // Get all UUIDs required for this table

                emDB.table(tableName).then(function(table) {

                    var deps = recordDependencies[tableName],
                        dependency,
                        uuid;

                    if (!table) {

                        // Reject all dependencies for this tableName
                        for (uuid in deps) {
                            deps[uuid].reject('table not found');
                        }

                        // Check for completion
                        tableNames.splice(tableNames.indexOf(tableName), 1);
                        if (!tableNames.length) {
                            deferred.resolve();
                        }

                    } else {

                        var uuids = Object.keys(deps),
                            query = 'uuid IN (' + uuids.map(function(uuid) {
                            return "'" + uuid + "'";
                        }).join(',') + ')';

                        table.sqlSelect(['uuid', 'id'], query, function(records) {

                            // Resolve the dependency for each record found
                            if (records.length) {
                                records.forEach(function(record) {
                                    deps[record.uuid].resolve(record.id);
                                });
                            }

                            // Check that all dependencies for this table
                            // are now resolved, or have a provider
                            for (uuid in deps) {
                                deps[uuid].checkResolvable();
                            }

                            // @todo: resolve circular dependencies?
                            //        (shouldn't occur with S3JSON)

                            // Check for completion
                            tableNames.splice(tableNames.indexOf(tableName), 1);
                            if (!tableNames.length) {
                                deferred.resolve();
                            }
                        });
                    }
                });
            });

            return deferred.promise;
        };

        // --------------------------------------------------------------------
        /**
         * Sub-process to import data
         *
         * @param {array} dataImports - array of DataImport tasks
         *
         * @returns {promise} - a promise that will be resolved when
         *                      all DataImport tasks have completed
         */
        var importData = function(dataImports) {

            if (!dataImports.length) {
                // No data to import => resolve early
                return $q.resolve();
            }

            var deferred = $q.defer();

            resolveRecordDependencies().then(function(){

                currentStage("Importing data", dataImports);

                dataImports.forEach(function(dataImport) {
                    if (!dataImport.$result) {
                        dataImport.done().finally(function() {
                            checkQueue(dataImports, deferred);
                        });
                        dataImport.execute();
                    }
                });
            });

            return deferred.promise;
        };

        // --------------------------------------------------------------------
        /**
         * Export data for upload to the server
         *
         * @param {Array} jobs - the data upload jobs
         *
         * @returns {promise} - a promise that will be resolved with an
         *                      array of DataUpload tasks
         */
        var exportData = function(jobs) {

            var dataExports = [],
                dataUploads = [];

            jobs.forEach(function(job) {
                if (!job.$result) {
                    dataExports.push(new DataExport(job));
                }
            });

            if (!dataExports.length) {
                // No data to export => resolve early
                return $q.resolve([]);
            }

            currentStage('Exporting data', dataExports);

            var deferred = $q.defer();

            dataExports.forEach(function(dataExport) {
                dataExport.done().then(function(dataUpload) {
                    if (!!dataUpload) {
                        dataUploads.push(dataUpload);
                    }
                    checkQueue(dataExports, deferred, dataUploads);
                });
                dataExport.execute();
            });

            return deferred.promise;
        };

        // --------------------------------------------------------------------
        /**
         * Upload data to the server
         *
         * @param {Array} dataUploads - array of DataUpload tasks
         *
         * @returns {promise} - a promise that will be resolved upon
         *                      completion of all uploads
         */
        var uploadData = function(dataUploads) {

            if (!dataUploads.length) {
                // No data to upload => resolve early
                return $q.resolve();
            }

            currentStage('Uploading data', dataUploads);

            var deferred = $q.defer();

            dataUploads.forEach(function(dataUpload) {
                dataUpload.done().then(
                    function() {
                        dataUpload.job.result('success');
                        checkQueue(dataUploads, deferred);
                    },
                    function(error) {
                        dataUpload.job.result('error', error);
                        checkQueue(dataUploads, deferred);
                    });
                dataUpload.execute();
            });

            return deferred.promise;
        };

        // --------------------------------------------------------------------
        /**
         * @todo: docstring
         */
        var downloadFiles = function() {

            // @todo: concept
            // @todo: implement this
        };

        // --------------------------------------------------------------------
        /**
         * Sub-process to synchronize forms
         *
         * @returns {promise} - a promise that will be resolved when
         *                      all forms have been synchronized
         */
        var synchronizeForms = function() {

            // Get a list of form/pull jobs
            var jobs = currentJobs.filter(function(syncJob) {
                return (syncJob.mode == 'pull' && syncJob.type == 'form');
            });

            if (!jobs.length) {
                // Nothing to do => resolve early
                return $q.resolve();
            }

            var deferred = $q.defer();

            emDB.tableNames().then(function(tableNames) {

                downloadForms(jobs).then(function(schemaImports) {

                    var resolvable = resolveSchemaDependencies(
                                        schemaImports,
                                        tableNames);
                    if (resolvable) {

                        importSchemas(schemaImports).then(function(result) {

                            var dataImports = result[0],
                                filesRequired = result[1];

                            // @todo: execute dataImports + download filesRequired

                            jobs.forEach(function(job) {
                                if (!job.$result) {

                                    // Update schemaDate
                                    emResources.open(job.resourceName).then(function(resource) {
                                        resource.setSchemaDate(new Date());
                                    });

                                    job.result('success');
                                }
                            });
                            deferred.resolve();
                        });
                    } else {

                        // Form synchronization failed due to unresolvable
                        // dependencies => resolve anyway to let any
                        // resolvable data imports go ahead
                        deferred.resolve();
                    }
                });
            });

            return deferred.promise;
        };

        // --------------------------------------------------------------------
        /**
         * Sub-process to download (and import) data from the server
         *
         * @returns {promise} - a promise that will be resolved when
         *                      all data have been downloaded and imported
         */
        var pull = function() {

            // Get a list of form/pull jobs
            var jobs = currentJobs.filter(function(syncJob) {
                return (syncJob.mode == 'pull' && syncJob.type == 'data');
            });

            if (!jobs.length) {
                // Nothing to do => resolve early
                return $q.resolve();
            }

            var deferred = $q.defer();

            downloadData(jobs).then(function(result) {

                var dataImports = result[0],
                    filesRequired = result[1];

                importData(dataImports).then(function() {

                    jobs.forEach(function(job) {
                        if (!job.$result) {
                            job.result('success');
                        }
                    });
                    deferred.resolve();
                });
                // @todo: download files
                //downloadFiles(filesRequired);
            });

            return deferred.promise;
        };

        // --------------------------------------------------------------------
        /**
         * Sub-process to (export an) upload data to the server
         *
         * @returns {promise} - a promise that will be resolved when
         *                      all data have been uploaded
         */
        var push = function() {

            // Get a list of form/pull jobs
            var jobs = currentJobs.filter(function(syncJob) {
                return (syncJob.mode == 'push' && syncJob.type == 'data');
            });

            if (!jobs.length) {
                // Nothing to do => resolve early
                return $q.resolve();
            }

            return exportData(jobs).then(uploadData);
        };

        // --------------------------------------------------------------------
        /**
         * Main synchronization process
         *
         * @param {object} forms - the selected forms list
         * @param {object} resources - the selected resources list
         */
        var synchronize = function(forms, resources) {

            $rootScope.syncInProgress = true;

            if (currentJobs.length) {

                synchronizeForms()
                    .then(pull)
                    .then(push)
                    .then(cleanupJobs);

            } else {

                currentStage('Preparing');

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
