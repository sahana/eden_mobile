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
    '$q', '$rootScope', '$timeout', 'emDB', 'emResources', 'emS3JSON', 'emServer', 'emSyncLog', 'emUtils',
    function ($q, $rootScope, $timeout, emDB, emResources, emS3JSON, emServer, emSyncLog, emUtils) {

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
        // Synchronization Tasks
        // ====================================================================
        /**
         * SyncTask to import a table schema
         *
         * @param {SyncJob} job - the SyncJob that generated this task
         * @param {string} tableName - the name of the table to install
         * @param {object} schemaData - the schema data from the Sahana
         *                              server for the table
         */
        function SchemaImport(job, tableName, schemaData) {

            SyncTask.apply(this, [job]);

            this.tableName = tableName;

            // The name of the table this task will import
            this.provides = tableName;
            // The names of the tables this task requires
            this.requires = [];

            // Decode the schemaData and collect Dependencies
            var schema = this.decode(schemaData),
                dependencies = [];
            if (schema) {
                this.requires.forEach(function(requirement) {
                    dependencies.push(require(requirement));
                });
            }
            this.schema = schema;
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
                            self.resolve(self.tableName);
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
            if (schemaData.strings) {
                schema._strings = schemaData.strings;
            }

            var ref = job.ref;
            if (this.provides == job.tableName) {
                // Main schema => store server-side resource
                schema._controller = schemaData.controller || ref.c;
                schema._function = schemaData.function || ref.f;
            } else {
                // Reference or component schema => name after table
                schema._name = this.provides;
            }

            return schema;
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
         * SyncTask to import a record
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

                    var record = self.record;
                    table.identify(record.data).then(function(recordID) {
                        if (recordID) {

                            // Update existing record
                            // @todo: implement NEWER policy
                            var query = 'id=' + recordID;
                            table.update(record.data, query,
                                function(numRowsAffected) {
                                    if (numRowsAffected) {
                                        self.resolve(recordID);
                                    } else {
                                        self.reject('error updating record');
                                    }
                                });

                        } else {

                            // Create new record
                            table.insert(self.record.data,
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
            }
            return this.resolved = true;
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
         * Execute the form download; parses the downloaded form and
         * creates SchemaImport tasks for both the main schema and any
         * dependencies of the main schema if available in the form data.
         */
        FormDownload.prototype.execute = function() {

            var job = this.job,
                self = this;

            console.log('Downloading ' + job.ref.c + '/' + job.ref.f);

            emServer.getForm(job.ref,
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
                                                            references[requirement]);
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
                self = this;

            console.log('Downloading ' + job.ref.c + '/' + job.ref.f);

            // @todo: msince, limit components (job has resource?)
            emServer.getData(job.ref,
                function(data) {
                    // Download successful
                    emDB.tables().then(function(tables) {

                        var dataImports = [],
                            filesRequired = [];

                        // Decode the S3JSON data
                        var map = emS3JSON.decode(tables, job.tableName, data);

                        for (var tableName in map) {

                            var records = map[tableName],
                                record,
                                files,
                                downloadURL,
                                fieldName,
                                dataImport;

                            for (var uuid in records) {

                                // Generate a DataImport task
                                record = records[uuid];
                                dataImport = new DataImport(job, tableName, record);
                                dataImports.push(dataImport);

                                // Collect the download URLs of the required files
                                files = record.files;
                                for (fieldName in files) {
                                    downloadURL = files[fieldName];
                                    filesRequired.push(downloadURL);
                                }
                            }
                        }

                        self.resolve([dataImports, filesRequired]);
                    });
                },
                function(response) {
                    // Download failed
                    self.reject(emServer.parseServerError(response));
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
                    currentJobs.push(dataJob)
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

            var deferred = $q.defer(),
                downloads = [];

            // Generate download-queue
            jobs.forEach(function(job) {
                if (!job.$result && job.type == 'form' && job.mode == 'pull') {

                    console.log('Creating download task for ' + job.resourceName + ' form');

                    var downloadTask = job.download();
                    if (downloadTask) {
                        downloads.push(downloadTask);
                    }
                }
            });

            currentStage('Downloading forms', downloads);

            // Process download-queue
            var imports = [];
            if (downloads.length) {

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
            } else {
                deferred.resolve(imports);
            }

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

            var deferred = $q.defer();

            currentStage('Importing Schemas', schemaImports);

            if (schemaImports.length) {
                schemaImports.forEach(function(schemaImport) {
                    if (!schemaImport.$result) {
                        schemaImport.done().then(
                            function() {
                                // Schema import succeeded
                                checkQueue(schemaImports, deferred);
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
            } else {
                deferred.resolve();
            }

            return deferred.promise;
        };

        // --------------------------------------------------------------------
        /**
         * Sub-process to download data
         *
         * @param {Array} jobs - the SyncJob queue
         */
        var downloadData = function(jobs) {

            var deferred = $q.defer(),
                downloads = [];

            // Generate download-queue
            jobs.forEach(function(job) {
                if (!job.$result && job.type == 'data' && job.mode == 'pull') {

                    console.log('Creating download task for ' + job.resourceName + ' data');

                    var downloadTask = job.download();
                    if (downloadTask) {
                        downloads.push(downloadTask);
                    }
                }
            });

            currentStage('Downloading data', downloads);

            var imports = [],
                filesRequired = [];
            if (downloads.length) {
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
            }

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

            currentStage('Resolving dependencies');

            var deferred = $q.defer(),
                recordDependencies = currentDependencies.records,
                tableNames = Object.keys(recordDependencies);

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

                        table.select(['uuid', 'id'], query, function(records) {

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
         * @todo: docstring
         */
        var importData = function(dataImports) {

            var deferred = $q.defer();

            resolveRecordDependencies().then(function(){

                currentStage("Importing data", dataImports);

                dataImports.forEach(function(dataImport) {
                    if (!dataImport.$result) {
                        dataImport.done().finally(function() {
                            checkQueue(dataImports, deferred);
                        });
                        dataImport.execute();
                    };
                });
            });

            return deferred.promise;
        };

        // --------------------------------------------------------------------
        /**
         * @todo: docstring
         */
        var push = function() {

            // @todo: concept
            // @todo: implement this
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
                // Nothing to do
                return $q.resolve();
            }

            var deferred = $q.defer();

            emDB.tableNames().then(function(tableNames) {

                downloadForms(jobs).then(function(schemaImports) {

                    var resolvable = resolveSchemaDependencies(
                                        schemaImports,
                                        tableNames);
                    if (resolvable) {

                        importSchemas(schemaImports).then(function() {
                            jobs.forEach(function(job) {
                                if (!job.$result) {
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
         * Process to synchronize data
         *
         * @returns {promise} - a promise that will be resolved when
         *                      all data have been synchronized
         */
        var synchronizeData = function() {

            // Get a list of form/pull jobs
            var jobs = currentJobs.filter(function(syncJob) {
                return (syncJob.mode == 'pull' && syncJob.type == 'data');
            });
            if (!jobs.length) {
                // Nothing to do
                return $q.resolve();
            }

            var deferred = $q.defer();

            downloadData(jobs).then(function(result) {

                var dataImports = result[0],
                    filesRequired = result[1];

                importData(dataImports).then(function() {

                    // @todo: upload data

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
         * @todo: docstring
         */
        var synchronize = function(forms, resources) {

            $rootScope.syncInProgress = true;

            if (currentJobs.length) {

                synchronizeForms()
                    .then(synchronizeData)
                    .then(cleanupJobs);

//                 synchronizeForms().then(function() {
//                     synchronizeData().then(function() {
//                         cleanupJobs();
//                     });
//                 });

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
