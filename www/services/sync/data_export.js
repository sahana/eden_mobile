/**
 * Sahana Eden Mobile - Data Export (Sync Task)
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

EdenMobile.factory('DataExport', [
    '$q', 'emS3JSON', 'DataUpload', 'LoadMap', 'SyncTask',
    function ($q, emS3JSON, DataUpload, LoadMap, SyncTask) {

        "use strict";

        /**
         * SyncTask to
         * - export data from a database table
         */
        var DataExport = SyncTask.define(function() {

            // All LoadMaps for this task
            this.lookups = {
                // tableName: LoadMap
            };

            this.files = {
                // fileName: fileURI
            };
        });

        // --------------------------------------------------------------------
        /**
         * Get the LoadMap for a table name
         *
         * @param {string} tableName - the table name
         *
         * @returns {LoadMap} - the LoadMap
         */
        DataExport.prototype.getLoadMap = function(tableName) {

            var lookups = this.lookups,
                loadMap = lookups[tableName];

            if (!loadMap) {
                loadMap = new LoadMap(this, tableName);
                lookups[tableName] = loadMap;
            }
            return loadMap;
        };

        // --------------------------------------------------------------------
        /**
         * Execute this data export; produces a DataUpload task
         */
        DataExport.prototype.execute = function() {

            // Create a LoadMap for the target table
            var self = this,
                tableName = this.job.tableName,
                loadMap = this.getLoadMap(tableName);

            // Load all (new|modified) records in the target table,
            // then resolve all foreign keys (and export referenced
            // records as necessary)
            loadMap.load(true, true).then(function() {
                return self.export().then(function() {

                    var jsonData = {},
                        lookups = self.lookups,
                        tableName,
                        items,
                        recordID,
                        item,
                        data;

                    // Collect all records into one S3JSON object
                    for (tableName in lookups) {

                        if (tableName.slice(0, 3) === 'em_') {
                            // System table not exported
                            continue;
                        }

                        items = lookups[tableName].items;
                        data = [];

                        for (recordID in items) {
                            item = items[recordID];
                            if (!item.parent) {
                                data.push(item.data);
                            }
                        }
                        if (data.length) {
                            angular.extend(jsonData, emS3JSON.encode(tableName, data));
                        }
                    }

                    // Generate the data upload task, then resolve
                    var dataUpload = new DataUpload(self.job, jsonData, self.files);
                    self.resolve(dataUpload);
                });
            }).catch(function(e) {
                self.reject(e);
            });
        };

        // --------------------------------------------------------------------
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
                lookups = this.lookups,
                loadMap;
            for (var tableName in lookups) {
                loadMap = lookups[tableName];
                if (loadMap.hasPendingItems) {
                    pending.push(loadMap);
                }
            }

            if (!pending.length) {
                deferred.resolve();
            } else {
                var loaded = [],
                    self = this;
                pending.forEach(function(loadMap) {
                    loaded.push(loadMap.load());
                });
                $q.all(loaded).then(function() {
                    self.export(deferred);
                });
            }

            return deferred.promise;
        };

        // --------------------------------------------------------------------
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

            // Get the LoadMap for the table
            var loadMap = this.getLoadMap(tableName);

            // Look up the UUID from the loadMap
            return loadMap.getUID(recordID);
        };

        // --------------------------------------------------------------------
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

        // ====================================================================
        // Return the constructor
        //
        return DataExport;
    }
]);

