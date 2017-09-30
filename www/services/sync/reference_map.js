/**
 * Sahana Eden Mobile - Reference Map
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

EdenMobile.factory('ReferenceMap', [
    '$q', 'emDB', 'emS3JSON',
    function ($q, emDB, emS3JSON) {

        "use strict";

        // ====================================================================
        // Export Item
        // ====================================================================
        /**
         * Helper class to represent a single record export
         *
         * @param {DataExport} task - the data export task
         * @param {Table} table - the Table
         * @param {object} record - the record data
         */
        function ExportItem(task, table, record) {

            this.task = task;

            // Encode record as S3JSON object
            var jsonData = emS3JSON.encodeRecord(table, record),
                fieldName;

            this.data = jsonData.data; // S3JSON record data

            // Collect the UUIDs for all references
            var references = jsonData.references;
            for (fieldName in references) {
                this.addReference(fieldName, references[fieldName]);
            }

            // Collect the file names for all upload-fields
            var files = jsonData.files;
            for (fieldName in files) {
                this.addFile(fieldName, files[fieldName]);
            }
        }

        // --------------------------------------------------------------------
        /**
         * Add the UUID of a referenced record to the S3JSON data
         *
         * @param {string} fieldName - the field name
         * @param {Array} reference - the reference as tuple,
         *                            format: [tableName, recordID]
         */
        ExportItem.prototype.addReference = function(fieldName, reference) {

            var task = this.task,
                data = this.data,
                lookupTable = reference[0],
                recordID = reference[1];

            $q.when(task.getUID(lookupTable, recordID)).then(function(uuid) {
                emS3JSON.addReference(data, fieldName, lookupTable, uuid);
            });
        };

        // --------------------------------------------------------------------
        /**
         * Add the file name of a referenced file to the S3JSON data
         *
         * @param {string} fieldName - the field name
         * @param {string} fileURI - the file URI
         */
        ExportItem.prototype.addFile = function(fieldName, fileURI) {

            var task = this.task,
                data = this.data;

            $q.when(task.getFile(fileURI)).then(function(fileName) {
                emS3JSON.addFile(data, fieldName, fileName);
            });
        };

        // ====================================================================
        // Reference Map
        // ====================================================================
        /**
         * Structure to manage UUID-lookups for (and implicit exports of)
         * referenced records in a table
         *
         * @param {DataExport} task - the data export task
         * @param {string} tableName - the tableName
         */
        function ReferenceMap(task, tableName) {

            this.task = task;
            this.tableName = tableName;

            // Items to export; {recordID: ExportItem}
            this.items = {};

            // UUIDs for references; {recordID: uuid|promise}
            this.uuids = {};

            // Deferred lookups; {recordID: deferred}
            this.pending = {};
            this.hasPendingItems = false;
        }

        // --------------------------------------------------------------------
        /**
         * Get the UUID of a record
         *
         * @param {integer} recordID - the record ID
         * @returns {string|promise} - the UUID of the record, or a promise
         *                             that will be resolved with the UUID
         */
        ReferenceMap.prototype.getUID = function(recordID) {

            var uuids = this.uuids;
            if (uuids.hasOwnProperty(recordID)) {

                // We either have the UUID, or have already promised it
                // => just return it
                return uuids[recordID];

            } else {

                // Create a deferred lookup, store+return promise
                var deferred = $q.defer(),
                    uuid = deferred.promise;

                this.pending[recordID] = deferred;
                this.hasPendingItems = true;

                uuids[recordID] = deferred.promise;
                return uuid;
            }
        };

        // --------------------------------------------------------------------
        /**
         * Perform all deferred lookups; create export items for all
         * referenced records that are new or have been modified after
         * last synchronization
         *
         * @param {boolean} all - export all (new|modified) records in the table
         */
        ReferenceMap.prototype.load = function(all) {

            var deferred = $q.defer(),
                task = this.task,
                lookups = this.pending,
                uuids = this.uuids,
                self = this;

            // Reset pending
            this.pending = {};
            this.hasPendingItems = false;

            emDB.table(this.tableName).then(function(table) {

                var synchronizedOn = table.$('synchronized_on'),
                    modifiedOn = table.$('modified_on'),
                    query = synchronizedOn.is(null).or(
                            synchronizedOn.lessThan(modifiedOn)),
                    subSet;

                // Which records to export (query)
                if (!all) {
                    subSet = table.$('id').in(Object.keys(lookups));
                    query = subSet.and(query);
                }

                // Which fields to export (query)
                var fields = [],
                    field,
                    mandatoryFields = ['id', 'uuid', 'modified_on', 'created_on'];
                for (var fieldName in table.fields) {
                    field = table.fields[fieldName];
                    if (mandatoryFields.indexOf(fieldName) != -1 || !field.meta) {
                        fields.push(fieldName);
                    }
                }

                table.where(query).select(fields, function(rows) {

                    var record,
                        recordID,
                        uuid;

                    rows.forEach(function(row) {

                        record = row._();
                        recordID = record.id;
                        uuid = record.uuid;

                        // Resolve the UUID-promise
                        uuids[recordID] = uuid;
                        if (lookups.hasOwnProperty(recordID)) {
                            lookups[recordID].resolve(uuid);
                        }

                        // Create an export item
                        self.items[recordID] = new ExportItem(task, table, record);

                        // Remove from lookups
                        if (!all) {
                            delete lookups[recordID];
                        }
                    });

                    if (all) {

                        deferred.resolve();

                    } else {

                        // For the remaining lookups, just look up the UUID
                        table.where(subSet).select(['id', 'uuid'], function(rows) {

                            rows.forEach(function(row) {

                                // Resolve the UUID-promise
                                recordID = row.$('id');
                                uuid = row.$('uuid');
                                uuids[recordID] = uuid;
                                if (lookups.hasOwnProperty(recordID)) {
                                    lookups[recordID].resolve(uuid);
                                }
                            });

                            for (recordID in lookups) {
                                // Debug-breakpoint - we should never get here!
                                // ...but if we however do, then rejecting is
                                // the right thing to do:
                                lookups[recordID].reject();
                            }
                            deferred.resolve();
                        });
                    }
                });
            });

            return deferred.promise;
        };

        // ====================================================================
        // Return the constructor
        //
        return ReferenceMap;
    }
]);
