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
         * Find the rejected items in the error tree returned from server
         *
         * @param {object} rejected - known rejected items
         *                            {tableName: {uuid: error}}
         * @param {object} errorTree - the error tree from the server
         *                             (or a sub-section of it)
         * @param {boolean} all - assume all items in the error tree have
         *                        been rejected even if not marked with error
         */
        DataUpload.prototype.rejectedItems = function(rejected, errorTree, all) {

            if (undefined === rejected) {
                rejected = {};
            }

            if (errorTree) {

                var rejectedItems,
                    tableName,
                    uuid,
                    error,
                    self = this;

                var registerRejected = function(item) {

                    uuid = item['@uuid'];
                    error = item['@error'];

                    if (!error && all) {
                        // If the parent item has been rejected, assume
                        // the same for all its components
                        error = 'parent rejected';
                    }
                    if (uuid && error) {
                        rejectedItems[uuid] = error;
                    }
                    // Descend into components
                    self.rejectedItems(rejected, item, !!error);
                };

                for (var key in errorTree) {
                    if (key.slice(0, 2) == '$_') {
                        tableName = key.slice(2);
                        rejectedItems = rejected[tableName] || {};
                        rejected[tableName] = rejectedItems;
                        errorTree[key].forEach(registerRejected);
                    }
                }
            }

            return rejected;
        };

        // --------------------------------------------------------------------
        /**
         * Find the accepted items in the object tree sent to the server
         *
         * @param {object} accepted - known accepted items
         *                            {tableName: [uuid, ...]}
         * @param {object} rejected - known rejected items
         *                            {tableName: {uuid: error}}
         * @param {object} tree - the object tree sent to the server
         */
        DataUpload.prototype.acceptedItems = function(accepted, rejected, tree) {

            if (undefined === accepted) {
                accepted = {};
            }

            if (tree) {

                var acceptedItems,
                    rejectedItems,
                    tableName,
                    uuid,
                    self = this;

                var registerAccepted = function(item) {
                    uuid = item['@uuid'];
                    // If not registered as rejected, register as accepted
                    if (!rejectedItems.hasOwnProperty(uuid)) {
                        acceptedItems.push(uuid);
                        // Descend into components
                        self.acceptedItems(accepted, rejected, item);
                    }
                };

                for (var key in tree) {
                    if (key.slice(0, 2) == '$_') {
                        tableName = key.slice(2);
                        rejectedItems = rejected[tableName] || {};
                        acceptedItems = accepted[tableName] || [];
                        accepted[tableName] = acceptedItems;
                        tree[key].forEach(registerAccepted);
                    }
                }
            }

            return accepted;
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
                rejected = this.rejectedItems({}, errorTree),
                accepted = this.acceptedItems({}, rejected, this.data);

            // Set synchronized_on for accepted items
            var now = new Date();
            for (var tableName in accepted) {
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
