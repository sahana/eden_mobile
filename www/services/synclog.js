/**
 * Sahana Eden Mobile - Synchronization Logging Facility
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
 * emSync - Service to log synchronization events/results
 *
 * @class emSync
 * @memberof EdenMobile.Services
 */
EdenMobile.factory('emSyncLog', [
    'emDB',
    function(emDB) {

        "use strict";

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

                    table.where(table.$('current').is(true)).select(fields,
                        function(rows) {
                            if (callback) {
                                callback(rows.map(function(row) {
                                    return row._();
                                }));
                            }
                        });
                });
            }
        };
        return api;
    }
]);

// END ========================================================================
