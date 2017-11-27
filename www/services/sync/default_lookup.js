/**
 * Sahana Eden Mobile - Default Lookup (SyncTask)
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

EdenMobile.factory('DefaultLookup', [
    '$q', 'emDB', 'SyncTask',
    function ($q, emDB, SyncTask) {

        "use strict";

        /**
         * SyncTask to
         * - look up a foreign key default and update the schema
         */
        var DefaultLookup = SyncTask.define(function(tableName, fieldName, uuid) {

            // TODO receive resource name and set as this.resourceName

            this.tableName = tableName;
            this.fieldName = fieldName;
            this.uuid = uuid;
        });

        // --------------------------------------------------------------------
        /**
         * Execute this task
         */
        DefaultLookup.prototype.execute = function() {

            console.log('Look up default for ' + this.tableName + '.' + this.fieldName);

            var run = this.run,
                tableName = this.tableName,
                fieldName = this.fieldName,
                self = this;

            run.require(tableName).resolved().then(
                function() {
                    emDB.table(tableName).then(function(table) {
                        self.lookupDefault(table, fieldName).then(
                            function() {
                                self.resolve();
                            },
                            function(error) {
                                self.reject(error);
                            });
                    });

                },
                function(error) {
                    self.reject(error);
                });
        };

        // --------------------------------------------------------------------
        /**
         * Look up the default value for a foreign key
         *
         * @param {Table} table - the table
         * @param {string} fieldName - the field name of the foreign key
         */
        DefaultLookup.prototype.lookupDefault = function(table, fieldName) {

            var uuid = this.uuid,
                field = table.$(fieldName),
                fk = field.getForeignKey();

            if (fk) {
                var lookupTable = fk.table,
                    recordAvailable = this.run.require(lookupTable, uuid).resolved(),
                    key = fk.key,
                    self = this;

                return recordAvailable.then(function(dependency) {
                    return self.resolveKey(table, dependency, key);
                });

            } else {
                return $q.reject('not a foreign key: ' + field);
            }
        };

        // --------------------------------------------------------------------
        /**
         * Resolve the key for the referenced record and set the default value
         * for the foreign key accordingly
         *
         * @param {Table} table - the table containing the foreign key
         * @param {Dependency} dependency - the record dependency for the
         *                                  referenced record
         * @param {string} key - the referenced key in the lookup table
         *
         * @returns {promise} - a promise that is resolved when the
         *                      default value of the foreign key has been
         *                      set
         */
        DefaultLookup.prototype.resolveKey = function(table, dependency, key) {

            var value,
                self = this;

            if (key === 'id') {
                // Referencing primary record ID => no lookup required
                value = dependency.recordID;
            } else if (dependency.keys.hasOwnProperty(key)) {
                // Referenced key already looked up
                value = dependency.keys[key];
            } else {
                // Referenced key unknown => lookup required
                value = emDB.table(dependency.tableName).then(function(lookupTable) {
                    if (lookupTable) {
                        return self.lookupKey(lookupTable, dependency.recordID, key).then(
                            function(value) {
                                // Remember the key value for future lookups
                                dependency.keys[key] = value;
                                return value;
                            });
                    } else {
                        return $q.reject('table not found: ' + dependency.tableName);
                    }
                });
            }

            return $q.when(value).then(function(value) {

                var field = table.$(self.fieldName);

                // TODO: propagate to resources
                //
                // resourceName = this.resourceName || table.name
                // if single resource or resourceName == table.name:
                //      => update both table and resource
                // else:
                //      => update only resource

                field._description.defaultValue = value;
                field.defaultValue = value;

                table.saveSchema();
            });
        };

        // --------------------------------------------------------------------
        /**
         * Look up a key from a referenced record
         *
         * @param {Table} table - the referenced table
         * @param {integer} recordID - the referenced record ID
         * @param {string} key - the name of the key
         *
         * @returns {promise} - a promise that resolves into the key value
         */
        DefaultLookup.prototype.lookupKey = function(table, recordID, key) {

            var deferred = $q.defer();

            table.where(table.$('id').equals(recordID))
                 .select([key], {limitby: 1}, function(rows) {

                if (!rows.length) {
                    deferred.reject('record not found: ' + table + '#' + recordID);
                } else {
                    deferred.resolve(rows[0].$(key));
                }
            });

            return deferred.promise();
        };

        // ====================================================================
        // Return the constructor
        //
        return DefaultLookup;
    }
]);
