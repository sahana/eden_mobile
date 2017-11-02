/**
 * Sahana Eden Mobile - Import Dependencies
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

EdenMobile.factory('Dependency', [
    '$q', 'emDB',
    function ($q, emDB) {

        "use strict";

        /**
         * Class to represent an import task dependency
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
                // too late (bug!)
                throw new Error('dependency failed due to unregistered provider!');
            }

            console.log('Register provider for ' + this);

            this.providers.push(provider);

            var self = this;
            provider.done().then(
                function(value) {
                    if (self.isResolved) {
                        // Another provider has succeeded first, or the
                        // object was known before the current SyncRun
                        // => just check if complete
                        self.checkComplete();
                    } else {
                        // Provider has succeeded
                        if (value) {
                            // Provider has returned a value
                            // => resolve dependency, then check if complete
                            self.resolve(value, true).then(
                                function() {
                                    self.checkComplete();
                                },
                                function(reason) {
                                    // Provider result is not valid (bug!)
                                    throw new Error('invalid provider result (' + reason + ')!');
                                });
                        } else {
                            // Provider has not produced a result
                            self.checkResolvable();
                        }
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
         * Resolve this dependency; resolves the resolution promise if pending
         *
         * @param {mixed} ref - the reference to expected result (i.e. the
         *                      table name, or record ID, or file URI)
         * @param {boolean} lookupObjectID - whether to look up objectIDs
         */
        Dependency.prototype.resolve = function(ref, lookupObjectID) {

            var deferred,
                uuid = this.uuid,
                self = this;

            // Store the result reference
            if (uuid) {

                this.tableCreated = true;

                var tableName = this.tableName;
                if (lookupObjectID && tableName == 'em_object') {

                    // Look up the object ID for this uuid
                    deferred = $q.defer();

                    emDB.table(tableName).then(function(table) {
                        table.where(table.$('uuid').equals(uuid))
                             .select(['id'], {limitby: 1}, function(records) {
                            if (!records.length) {
                                deferred.reject('object not found');
                            } else {
                                self.recordID = records[0].$('id');
                                deferred.resolve();
                            }
                        });
                    });
                } else {

                    // Ref is the record ID, no look-up required
                    this.recordID = ref;
                }
            } else if (this.tableName) {
                this.tableCreated = true;
            } else if (this.url) {
                this.fileURI = ref;
            }

            // Helper to resolve the dependency
            var resolve = function(dependency) {
                dependency.isResolved = true;
                if (dependency.resolution) {
                    dependency.resolution.resolve(dependency);
                }
            };

            if (!deferred) {
                // Immediate resolution
                resolve(this);
                return $q.resolve();
            } else {
                // Deferred resolution
                deferred.promise.then(function() {
                    resolve(self);
                });
                return deferred.promise;
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

        // ====================================================================
        // Return the constructor
        //
        return Dependency;
    }
]);
