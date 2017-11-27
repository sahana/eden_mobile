/**
 * Sahana Eden Mobile - Sync Run
 *
 * Copyright (c) 2016-2017 Sahana Software Foundation
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

EdenMobile.factory('SyncRun', [
    '$q', "$rootScope", "$timeout", 'emDB', 'emResources', 'emS3JSON', "DataImport", "DataExport", "Dependency", "SyncJob",
    function ($q, $rootScope, $timeout, emDB, emResources, emS3JSON, DataImport, DataExport, Dependency, SyncJob) {

        "use strict";

        /**
         * Class representing a synchronization cycle
         *
         * @param {Array} downloads - array download requirements (forms)
         * @param {Array} uploads - array of upload requirements (resources)
         */
        function SyncRun(downloads, uploads) {

            this.isFinalized = false;

            // The job queue
            this.jobs = [];
            this.generateSyncJobs(downloads, uploads);

            this.dependencies = {
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

        }

        // --------------------------------------------------------------------
        /**
         * Start the SyncRun
         *
         * @returns {promise} - a promise that is resolved when the sync run
         *                      has completed
         */
        SyncRun.prototype.start = function() {

            if (this.isFinalized) {
                throw new Error('SyncRun already finalized');
            }
            if (this.completion !== undefined) {
                // already running
                return this.completion;
            }

            var deferred = $q.defer();
            this.completion = deferred;

            this.stage = null;
            this.currentActivity = null;
            this.currentQueue = null;

            if (this.jobs.length) {

                var self = this;
                this.synchronizeSchemas()
                    .then(function() { return self.pull(); })
                    .then(function() { return self.push(); })
                    .finally(function() { self.finalize(); });

            } else {

                this.finalize();
            }

            return deferred.promise;
        };

        // --------------------------------------------------------------------
        /**
         * Finalize this run
         */
        SyncRun.prototype.finalize = function() {

            // Mark as finalized
            this.isFinalized = true;

            // Reset
            this.stage = null;
            this.currentActivity = null;
            this.currentQueue = null;

            // Close all open jobs
            var jobs = this.jobs;
            if (jobs && jobs.length) {
                jobs.forEach(function(job) {
                    if (!job.$result) {
                        job.result('error', 'not implemented');
                    }
                });
            }

            var completion = this.completion;

            // Resolve completion promise
            completion.resolve();
        };

        // --------------------------------------------------------------------
        /**
         * Generate synchronization jobs
         *
         * @param {Array} formList - array of form descriptions
         * @param {Array} resourceList - array of resource descriptions
         */
        SyncRun.prototype.generateSyncJobs = function(formList, resourceList) {

            // Download jobs
            formList.forEach(function(form) {

                var formJob = null,
                    dataJob = null;

                if (form.download) {
                    formJob = new SyncJob(
                        this,
                        'form',
                        'pull',
                        form.resourceName,
                        form.tableName,
                        form.ref
                    );
                    this.jobs.push(formJob);
                }
                if (form.hasData) {
                    dataJob = new SyncJob(
                        this,
                        'data',
                        'pull',
                        form.resourceName,
                        form.tableName,
                        form.ref
                    );
                    this.jobs.push(dataJob);
                }
            }, this);

            // Upload jobs
            resourceList.forEach(function(resource) {

                var job = null;

                if (resource.upload) {
                    var ref = resource.ref;
                    if (ref.c && ref.f) {
                        job = new SyncJob(
                            this,
                            'data',
                            'push',
                            resource.resourceName,
                            resource.tableName,
                            resource.ref
                        );
                        this.jobs.push(job);
                    }
                }
            }, this);
        };

        // ====================================================================
        // Dependency Management
        // ====================================================================
        /**
         * Get a dependency for a table, record or file
         *
         * @param {string} tableName - the table name
         * @param {string} uuid - the record UUID
         * @param {string} url - the URL to download the file
         *
         * @returns {Dependency} - a Dependency instance
         */
        SyncRun.prototype.require = function(tableName, uuid, url) {

            var currentDependencies = this.dependencies,
                dependency;

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
                var files = currentDependencies.files;
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
         * Register a provider for a dependency
         *
         * @param {SyncTask} provider - the SyncTask providing the required
         *                              resource
         * @param {string} tableName - the table name
         * @param {string} uuid - the record UUID
         * @param {string} url - the URL to download the file
         */
        SyncRun.prototype.provide = function(provider, tableName, uuid, url) {

            // Get or create the dependency
            var dependency = this.require(tableName, uuid, url);

            // Register the provider
            if (dependency) {
                dependency.registerProvider(provider);
            }

            // Record providers also (implicitly) provide the corresponding
            // em_object entry, so register for that too:
            if (uuid && tableName.slice(0, 3) != 'em_') {
                dependency = this.require('em_object', uuid);
                if (dependency) {
                    dependency.registerProvider(provider);
                }
            }
        };

        // ====================================================================
        // Progress Reporting
        // ====================================================================
        /**
         * Update the current stage, activity and task queue
         *
         * @param {string} stage - the current stage
         * @param {string} activity - the current activity
         * @param {Array} taskQueue - the current task queue
         */
        SyncRun.prototype.currentStage = function(stage, activity, taskQueue) {

            this.stage = stage;
            this.currentActivity = activity;
            this.currentQueue = taskQueue;

            this.checkProgress();
        };

        // --------------------------------------------------------------------
        /**
         * Check and notify progress
         *
         * @returns {bool} - whether all tasks in current queue are
         *                   completed
         */
        SyncRun.prototype.checkProgress = function() {

            var currentQueue = this.currentQueue;

            var total,
                completed,
                done = true;
            if (currentQueue) {
                total = currentQueue.length;
                if (total) {
                    completed = currentQueue.filter(function(task) {
                        return !!task.$result;
                    }).length;
                    if (completed < total) {
                        done = false;
                    }
                } else {
                    total = undefined;
                }
            }

            this.completion.notify({
                stage: this.stage,
                activity: this.currentActivity,
                total: total,
                completed: completed
            });

            return done;
        };

        // ====================================================================
        // Main Synchronization Functions
        // ====================================================================
        /**
         * Sub-process to synchronize schemas
         *
         * @returns {promise} - a promise that will be resolved when
         *                      all schemas have been synchronized
         */
        SyncRun.prototype.synchronizeSchemas = function() {

            // Get a list of form/pull jobs
            var jobs = this.jobs.filter(function(syncJob) {
                return (syncJob.mode == 'pull' && syncJob.type == 'form');
            });

            if (!jobs.length) {
                // Nothing to do => resolve early
                return $q.resolve();
            }

            var deferred = $q.defer(),
                self = this;

            emDB.tableNames().then(function(tableNames) {

                self.downloadSchemas(jobs).then(function(schemaImports) {

                    var resolvable = self.resolveSchemaDependencies(
                                        schemaImports,
                                        tableNames);
                    if (resolvable) {

                        self.importSchemas(schemaImports).then(function() {

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
         * Pull data from the server
         *
         * @returns {promise} - a promise that will be resolved when
         *                      data downloads are complete
         */
        SyncRun.prototype.pull = function() {

            // Get a list of form/pull jobs
            var jobs = this.jobs.filter(function(syncJob) {
                return (syncJob.mode == 'pull' && syncJob.type == 'data');
            });

            if (!jobs.length) {
                // Nothing to do => resolve early
                return $q.resolve();
            }

            var self = this;

            return this.downloadData(jobs).then(function(result) {

                var dataImports = result[0],
                    filesRequired = result[1];

                if (filesRequired.length) {
                    // Verify pending file dependencies have providers,
                    // otherwise reject them
                    // TODO: currently all files will be rejected because
                    //       there are no providers => implement them!
                    filesRequired.forEach(function(fileURI) {
                        self.require(null, null, fileURI).checkResolvable();
                    });
                }

                return self.importData(dataImports).then(function() {

                    jobs.forEach(function(job) {
                        if (!job.$result) {
                            job.result('success');
                        }
                    });
                });
            });
        };

        // --------------------------------------------------------------------
        /**
         * Push data to the server
         *
         * @returns {promise} - a promise that will be resolved when
         *                      data uploads are complete
         */
        SyncRun.prototype.push = function() {

            // Get a list of form/pull jobs
            var jobs = this.jobs.filter(function(syncJob) {
                return (syncJob.mode == 'push' && syncJob.type == 'data');
            });

            if (!jobs.length) {
                // Nothing to do => resolve early
                return $q.resolve();
            }

            var self = this;
            return this.exportData(jobs).then(function(uploads) {
               return self.uploadData(uploads);
            });
        };

        // ====================================================================
        // Sub-processes
        // ====================================================================
        /**
         * Sub-process to download schemas
         *
         * @param {Array} jobs - the current job queue
         *
         * @returns {promise} - a promise that is resolved with an Array of
         *                      schema import tasks when schema downloads are
         *                      complete
         *
         * @todo: look up jobs from this.jobs instead of passing
         */
        SyncRun.prototype.downloadSchemas = function(jobs) {

            var stage = "Schema Download";

            this.currentStage(stage, 'preparing');

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

            this.currentStage(stage, null, downloads);

            // Process download-queue
            var deferred = $q.defer(),
                self = this,
                imports = [];
            downloads.forEach(function(download) {
                download.done().then(
                    function(importTasks) {
                        // Download was successful
                        if (importTasks.length) {
                            imports = imports.concat(importTasks);
                        }
                    },
                    function(reason) {
                        // Download failed => fail the corresponding job
                        download.job.result('error', reason);
                    }).finally(function() {
                        if (self.checkProgress()) {
                            deferred.resolve(imports);
                        }
                    });
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
        SyncRun.prototype.resolveSchemaDependencies = function(schemaImports, tableNames) {

            if (!schemaImports.length) {
                // No pending schema imports => no dependencies
                return true;
            }

            this.currentStage('Schema Import', 'resolving dependencies');

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
                resolved;

            // Check whether a schemaImport is resolvable, and if so,
            // register it as a provider for that schema
            var checkResolvable = function(schemaImport) {

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
                    this.provide(schemaImport, provides);

                    // Add provides to knownTables
                    knownTables.push(provides);

                    // Remove provides from unknownTables
                    var index = unknownTables.indexOf(provides);
                    if (index !== -1) {
                        resolved++;
                        unknownTables.splice(index, 1);
                    }
                } else {
                    // Retain for next iteration
                    unresolved.push(schemaImport);
                }
            };

            while(unknownTables.length) {

                resolved = 0;

                check = unresolved;
                unresolved = [];

                // Check which schemaImports can be resolved with the
                // currently known tables
                check.forEach(checkResolvable, this);

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
            var self = this;
            unresolved.forEach(function(schemaImport) {
                self.provide(schemaImport, schemaImport.provides);
            });

            return true;
        };

        // --------------------------------------------------------------------
        /**
         * Sub-process to import schemas
         *
         * @param {Array} schemaImports - array of pending schema imports
         */
        SyncRun.prototype.importSchemas = function(schemaImports) {

            if (!schemaImports.length) {
                // No schemas to import => resolve early
                return $q.resolve();
            }

            this.currentStage('Schema Import', null, schemaImports);

            var deferred = $q.defer(),
                self = this,
                dataImports = [],
                filesRequired = [],
                pendingDefaults = [];

            schemaImports.forEach(function(schemaImport) {
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
                        pendingDefaults = pendingDefaults.concat(
                            schemaImport.pendingDefaults);
                    },
                    function(error) {
                        // Schema import failed; if this was the
                        // job's main schema, then fail the job
                        var job = schemaImport.job;
                        if (schemaImport.provides == job.tableName) {
                            job.result('error', error);
                        }
                    }).finally(function() {
                        if (self.checkProgress()) {

                            if (filesRequired.length) {
                                // Verify pending file dependencies have providers,
                                // otherwise reject them
                                // TODO: currently all files will be rejected because
                                //       there are no providers => implement them!
                                filesRequired.forEach(function(fileURI) {
                                    self.require(null, null, fileURI).checkResolvable();
                                });
                            }

                            // Import default data, then resolve pending defaults
                            self.importData(dataImports).then(function() {
                                self.resolveDefaults(pendingDefaults).then(function() {

                                    // Remove any failed record dependencies of this
                                    // stage, so that subsequent data imports will
                                    // try again
                                    var dependencies = self.dependencies.records,
                                        tableName,
                                        deps,
                                        uuid,
                                        dependency;

                                    for (tableName in dependencies) {
                                        deps = dependencies[tableName];
                                        for (uuid in deps) {
                                            dependency = deps[uuid];
                                            if (!dependency.isResolved) {
                                                delete deps[uuid];
                                            }
                                        }
                                    }

                                    deferred.resolve();
                                });
                            });
                        }
                    });
            });

            return deferred.promise;
        };

        // --------------------------------------------------------------------
        /**
         * Sub-process to resolve default values in schemas
         *
         * @param {Array} defaultLookups - array of DefaultLookup tasks
         *
         * @returns {promise} - a promise that is resolved when all
         *                      DefaultLookup tasks have completed
         */
        SyncRun.prototype.resolveDefaults = function(defaultLookups) {

            if (!defaultLookups.length) {
                // No defaults to resolve => resolve early
                return $q.resolve();
            }

            var deferred = $q.defer(),
                self = this;

            this.currentStage('Resolve Defaults', null, defaultLookups);

            defaultLookups.forEach(function(defaultLookup) {
                defaultLookup.done().finally(function() {
                    if (self.checkProgress()) {

                        deferred.resolve();
                    }
                });
            });

            return deferred.promise;
        };

        // --------------------------------------------------------------------
        /**
         * Sub-process to download data
         *
         * @param {Array} jobs - the SyncJob queue
         *
         * @todo: look up jobs from this.jobs instead of passing
         */
        SyncRun.prototype.downloadData = function(jobs) {

            var stage = 'Data Download';

            this.currentStage(stage, 'preparing');

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

            this.currentStage(stage, null, downloads);

            var deferred = $q.defer(),
                self = this,
                imports = [],
                files = [];
            downloads.forEach(function(download) {
                download.done().then(
                    function(result) {
                        // Download was successful
                        var importTasks = result[0],
                            filesRequired = result[1];
                        if (importTasks.length) {
                            imports = imports.concat(importTasks);
                        }
                        if (filesRequired && filesRequired.length) {
                            files = files.concat(filesRequired);
                        }
                    },
                    function(reason) {
                        // Download failed => fail the corresponding job
                        download.job.result('error', reason);
                    }).finally(function() {
                        if (self.checkProgress()) {
                            deferred.resolve([imports, files]);
                        }
                    });
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
        SyncRun.prototype.resolveRecordDependencies = function() {

            var recordDependencies = this.dependencies.records,
                tableNames = Object.keys(recordDependencies);

            if (!tableNames.length) {
                // No record dependencies => resolve early
                return $q.resolve();
            }

            this.currentStage('Data Import', 'resolving dependencies');

            var deferred = $q.defer();

            tableNames.forEach(function(tableName) {

                emDB.table(tableName).then(function(table) {

                    var deps = recordDependencies[tableName],
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

                        // Resolve all known UUIDs
                        table.where(table.$('uuid').in(Object.keys(deps)))
                             .select(['uuid', 'id'], function(rows) {

                            // Resolve the dependency for each record found
                            if (rows.length) {
                                rows.forEach(function(row) {
                                    deps[row.$('uuid')].resolve(row.$('id'), false);
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
        SyncRun.prototype.importData = function(dataImports) {

            if (!dataImports.length) {
                // No data to import => resolve early
                return $q.resolve();
            }

            var deferred = $q.defer(),
                self = this;

            this.resolveRecordDependencies().then(function(){

                self.currentStage('Data Import', null, dataImports);

                dataImports.forEach(function(dataImport) {
                    dataImport.done().finally(function() {
                        if (self.checkProgress()) {
                            deferred.resolve();
                        }
                    });
                });
            });

            return deferred.promise;
        };

        // --------------------------------------------------------------------
        /**
         * Sub-process to export data for upload to the server
         *
         * @param {Array} jobs - the data upload jobs
         *
         * @returns {promise} - a promise that will be resolved with an
         *                      array of DataUpload tasks
         *
         * @todo: look up jobs from this.jobs instead of passing
         */
        SyncRun.prototype.exportData = function(jobs) {

            this.currentStage('Data Export', 'preparing');

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

            this.currentStage('Data Export', null, dataExports);

            var deferred = $q.defer(),
                self = this;

            dataExports.forEach(function(dataExport) {
                dataExport.done().then(function(dataUpload) {
                    if (!!dataUpload) {
                        dataUploads.push(dataUpload);
                    }
                }).finally(function() {
                    if (self.checkProgress()) {
                        deferred.resolve(dataUploads);
                    }
                });
            });

            return deferred.promise;
        };

        // --------------------------------------------------------------------
        /**
         * Sub-process to upload data to the server
         *
         * @param {Array} dataUploads - array of DataUpload tasks
         *
         * @returns {promise} - a promise that will be resolved upon
         *                      completion of all uploads
         */
        SyncRun.prototype.uploadData = function(dataUploads) {

            if (!dataUploads.length) {
                // No data to upload => resolve early
                return $q.resolve();
            }

            this.currentStage('Data Upload', null, dataUploads);

            var deferred = $q.defer(),
                self = this;

            dataUploads.forEach(function(dataUpload) {
                dataUpload.done().then(
                    function() {
                        dataUpload.job.result('success');
                    },
                    function(error) {
                        dataUpload.job.result('error', error);
                    }).finally(function() {
                        if (self.checkProgress()) {
                            deferred.resolve();
                        }
                    });
            });

            return deferred.promise;
        };

        // --------------------------------------------------------------------
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
        SyncRun.prototype.createDataImports = function(job, tableName, data) {

            return emDB.tables().then(function(tables) {

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

                return [dataImports, filesRequired];
            });
        };

        // ====================================================================
        // Return the constructor
        //
        return SyncRun;
    }
]);
