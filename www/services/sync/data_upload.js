/**
 * Sahana Eden Mobile - Data Upload (Sync Task)
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

EdenMobile.factory('DataUpload', [
    '$q', 'emDB', 'emServer', 'SyncTask',
    function ($q, emDB, emServer, SyncTask) {

        "use strict";

        /**
         * SyncTask to
         * - upload data to the server
         *
         * @param {object} data - the S3JSON data to send
         * @param {array} files - array of file URIs to attach
         */
        var DataUpload = SyncTask.define(function(data, files) {

            this.data = data;
            this.files = files;
        });

        // --------------------------------------------------------------------
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
                    self.reject(emServer.parseServerError(error));
                });

            return deferred.promise;
        };

        // --------------------------------------------------------------------
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

                var registerRejected = function(item) {
                    uuid = item['@uuid'];
                    error = item['@error'];
                    if (uuid && error) {
                        rejectedItems[uuid] = error;
                    }
                };

                for (key in errorTree) {
                    if (key.slice(0, 2) == '$_') {

                        tableName = key.slice(2);
                        if (!rejected.hasOwnProperty(tableName)) {
                            rejected[tableName] = {};
                        }
                        rejectedItems = rejected[tableName];
                        errorTree[key].forEach(registerRejected);
                    }
                }
            }

            var uploaded = this.data,
                accepted = {},
                acceptedItems;

            // Collect UUIDs of accepted items

            var registerAccepted = function(item) {
                uuid = item['@uuid'];
                if (!rejectedItems.hasOwnProperty(uuid)) {
                    acceptedItems.push(uuid);
                }
            };

            for (key in uploaded) {
                if (key.slice(0, 2) == '$_') {

                    tableName = key.slice(2);
                    if (!accepted.hasOwnProperty(tableName)) {
                        accepted[tableName] = [];
                    }
                    acceptedItems = accepted[tableName];
                    rejectedItems = rejected[tableName] || {};
                    uploaded[key].forEach(registerAccepted);
                }
            }

            // Set synchronized_on for accepted items
            var now = new Date();
            for (tableName in accepted) {
                this.setSyncDate(tableName, accepted[tableName], now);
            }
        };

        // --------------------------------------------------------------------
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
                emDB.table(tableName).then(function(table) {
                    table.where(table.$('uuid').in(uuids))
                         .update(
                             {synchronized_on: syncDate},
                             {noDefaults: true});
                });
            }
        };

        // ====================================================================
        // Return the constructor
        //
        return DataUpload;
    }
]);
