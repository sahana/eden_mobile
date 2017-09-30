/**
 * Sahana Eden Mobile - Data Import (Sync Task)
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

EdenMobile.factory('DataImport', [
    '$q', 'emDB', 'SyncTask',
    function ($q, emDB, SyncTask) {

        "use strict";

        /**
         * SyncTask to
         * - import a record
         *
         * @param {string} tableName - the table name
         * @param {Record} record - the record data (prototype in s3json.js)
         */
        var DataImport = SyncTask.define(function(tableName, record) {

            this.tableName = tableName;
            this.record = record;
            this.resolved = false;

            var run = this.run;

            // Register as provider for the record
            run.provide(this, tableName, record.uuid);

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
            var resolveRecordDependency = function(dependency) {
                self.addForeignKey(record, dependency);
                if (!!self.dependencies && self.isResolved()) {
                    self.dependencies.resolve();
                }
            };
            for (fieldName in references) {
                reference = references[fieldName];
                dependency = run.require(reference[0], reference[1]);
                dependency.complete().then(resolveRecordDependency);
            }

            // Register file dependencies
            var resolveFileDependency = function(dependency) {
                self.addFileURI(record, dependency);
                if (!!self.dependencies && self.isResolved()) {
                    self.dependencies.resolve();
                }
            };
            for (fieldName in files) {
                downloadURL = files[fieldName];
                dependency = run.require(null, null, downloadURL);
                dependency.complete().then(resolveFileDependency);
            }
        });

        // --------------------------------------------------------------------
        /**
         * Execute the data import; creates the local record
         */
        DataImport.prototype.execute = function() {

            var self = this,
                tableName = this.tableName;

            this.actionable.then(function() {
                return emDB.table(tableName).then(function(table) {

                    if (!table) {
                        self.reject('table not found: ' + tableName);
                        return;
                    }

                    var record = self.record,
                        data = record.data;
                    return table.identify(data).then(function(original) {

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
                            table.where(table.$('id').equals(recordID)).update(data,
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

            }).catch(function(e) {
                self.reject(e);
            });
        };

        // --------------------------------------------------------------------
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

        // --------------------------------------------------------------------
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

        // --------------------------------------------------------------------
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

        // ====================================================================
        // Return the constructor
        //
        return DataImport;
    }
]);
