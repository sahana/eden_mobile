/**
 * Sahana Eden Mobile - Synchronization Tasks (Base Class)
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
EdenMobile.factory('SyncTask', [
    '$q',
    function ($q) {

        "use strict";

        // ====================================================================
        // Synchronization task base class
        // ====================================================================
        /**
         * Generic class to represent a synchronization task; provides common
         * attributes and methods
         *
         * @param {SyncJob} job - the sync job this tasks belongs to
         */
        function SyncTask(job) {

            this.job = job;
            this.run = job.run;

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

            var deferred = this.$promise;

            if (!deferred) {
                if (!this.$result) {

                    deferred = $q.defer();
                    this.$promise = deferred;

                    try {
                        this.execute();
                    } catch(e) {
                        deferred.reject(e);
                    }

                } else {
                    return $q.resolve();
                }
            }
            return deferred.promise;
        };

        // --------------------------------------------------------------------
        /**
         * Method subclasses can use to notify clients about progress
         *
         * @param {mixed} value - status to send to the clients
         */
        SyncTask.prototype.notify = function(value) {

            if (this.$promise) {
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
            if (this.$promise) {
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
            if (this.$promise) {
                this.$promise.reject(reason);
            }
        };

        // ====================================================================
        /**
         * Function to define SyncTasks ("subclassing")
         *
         * @param {function} init - the init function for the task
         */
        var defineSyncTask = function(init) {

            var task;
            if (typeof init == 'function') {
                task = function() {
                    SyncTask.apply(this, [arguments[0]]);
                    init.apply(this, Array.prototype.slice.call(arguments, 1));
                };
            } else {
                task = function() {
                    SyncTask.apply(this, [arguments[0]]);
                };
            }

            task.prototype = Object.create(SyncTask.prototype);
            task.prototype.constructor = task;
            return task;
        };

        // ====================================================================
        // API
        //
        return {
            /**
             * Define a sync task type
             *
             * @example
             *  // Define a sync task type
             *  var Download = SyncTask.define(function(arg1, arg2, ...) {
             *      ...
             *  });
             *
             * @example
             *  // Define a method of the new task type
             *  Download.prototype.someMethod = function() { ... };
             *
             * @example
             *  // Instantiate the new type
             *  var download = new Download(job, arg1, arg2, ...);
             */
            define: defineSyncTask
        };
    }
]);
