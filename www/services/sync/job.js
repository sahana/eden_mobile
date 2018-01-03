/**
 * Sahana Eden Mobile - Sync Job
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

EdenMobile.factory('SyncJob', [
    '$q', 'emSyncLog', 'DataDownload', 'SchemaDownload',
    function ($q, emSyncLog, DataDownload, SchemaDownload) {

        "use strict";

        /**
         * Class representing a Synchronization Job
         *
         * @param {SyncRun} run - the sync run this job belongs to
         * @param {string} type - Job type: 'form'|'data'
         * @param {string} mode - Synchronization mode: 'pull'|'push'|'both'
         * @param {string} tableName - the table name
         * @param {object} ref - reference details to construct the server URL
         *                       to access the form or data, object
         *                       {c:controller, f:function, v:vars}
         */
        function SyncJob(run, type, mode, resourceName, tableName, ref) {

            this.run = run;

            this.type = type;   // form || data
            this.mode = mode;   // pull || push

            this.resourceName = resourceName;
            this.tableName = tableName;
            this.ref = angular.copy(ref);

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
                    // Produce a SchemaDownload task and return it
                    task = new SchemaDownload(this);
                } else if (jobType == 'data') {
                    // Produce a DataDownload task and return it
                    task = new DataDownload(this);
                }
            }
            return task;
        };

        // @todo: add import
        // @todo: add export
        // @todo: add upload

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

                // Resolve (or reject) completed-promise
                if (result == 'success') {
                    this.action.resolve(result);
                } else {
                    this.action.reject(result);
                }
            }
        };

        // ====================================================================
        // Return the constructor
        //
        return SyncJob;
    }
]);
