/**
 * Sahana Eden Mobile - LoadMap
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

EdenMobile.factory('LoadMap', [
    '$q', 'emComponents', 'emDB', 'emS3JSON',
    function ($q, emComponents, emDB, emS3JSON) {

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
         * @param {Array} fields - array of names of fields to include in
         *                         the export (optional)
         */
        function ExportItem(task, table, record, fields) {

            this.task = task;

            // Encode record as S3JSON object
            var jsonData = emS3JSON.encodeRecord(table, record, fields),
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
                if (uuid.constructor === Array) {
                    // Object reference => resolves into [tableName, uuid]
                    emS3JSON.addReference(data, fieldName, uuid[0], uuid[1]);
                } else {
                    // Normal foreign key
                    emS3JSON.addReference(data, fieldName, lookupTable, uuid);
                }
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
        // LoadMap
        // ====================================================================
        /**
         * Structure to manage UUID-lookups for (and implicit exports of)
         * referenced records in a table
         *
         * @param {DataExport} task - the data export task
         * @param {string} tableName - the tableName
         */
        function LoadMap(task, tableName) {

            this.task = task;
            this.tableName = tableName;

            // Items to export; {recordID: ExportItem}
            this.items = {};

            // UUIDs for references; {recordID: uuid|promise}
            this.uuids = {};

            // Deferred lookups; {recordID: deferred}
            this.pending = {};

            // TODO explain
            this.requiredItems = {};

            // TODO explain
            this.hasPendingItems = false;

            // TODO explain
            this.pendingComponents = [];
        }

        // --------------------------------------------------------------------
        /**
         * Get an ExportItem
         *
         * @param {string} key - the name of the key field
         * @param {*} value - the value sought
         *
         * @returns {promise} - a promise that resolves into the ExportItem
         *                      when the record has been loaded
         */
        LoadMap.prototype.getItem = function(key, value) {

            // TODO: throw error if value is undefined or null

            var lookups = this.requiredItems[key] || [],
                lookup,
                deferred;

            for (var i = lookups.length; i--;) {
                lookup = lookups[i];
                if (lookup[0] === value) {
                    deferred = lookup[1];
                    break;
                }
            }

            if (!deferred) {
                deferred = $q.defer();
                lookups.push([value, deferred]);
                this.hasPendingItems = true;
            }

            this.requiredItems[key] = lookups;

            return deferred.promise;
        };

        // --------------------------------------------------------------------
        /**
         * Add an exported item to the map, resolving any UUID/item promises
         *
         * @param {Table} table - the database table the record belongs to
         * @param {object} record - the record
         * @param {Array} fields - array of names of fields to include in the
         *                         export (optional)
         *
         * @returns {ExportItem} - the ExportItem
         */
        LoadMap.prototype.addItem = function(table, record, fields) {

            var recordID = record.id;
            if (!recordID) {
                return;
            }

            var items = this.items,
                item = items[recordID];
            if (!item) {
                // Resolve the UUID promise
                this.addUID(record);

                // Create an export item for the record
                item = new ExportItem(this.task, table, record, fields);
                items[recordID] = item;
            }

            var requiredItems = this.requiredItems,
                lookups,
                lookup,
                key,
                value,
                i;

            for (key in requiredItems) {
                if (record.hasOwnProperty(key)) {

                    value = record[key];
                    lookups = requiredItems[key];

                    for (i = lookups.length; i--;) {
                        lookup = lookups[i];
                        if (lookup[0] === value && !lookup[2]) {
                            // Add the record ID so the loader knows that
                            // the record has already been loaded
                            lookup[2] = recordID;
                            // Resolve the item promise
                            lookup[1].resolve(item);
                        }
                    }
                }
            }

            return item;
        };

        // --------------------------------------------------------------------
        /**
         * Get the UUID of a record
         *
         * @param {integer} recordID - the record ID
         *
         * @returns {string|promise} - the UUID of the record, or a promise
         *                             that will be resolved with the UUID
         */
        LoadMap.prototype.getUID = function(recordID) {

            var uuids = this.uuids;
            if (uuids.hasOwnProperty(recordID)) {

                // We either have the UUID, or have already promised it
                // => just return it
                return uuids[recordID];

            } else {

                if (this.tableName == 'em_object') {

                    // Object IDs need instance type lookup
                    return this.getObjectUID(recordID);

                } else {

                    // Create a deferred lookup, store+return promise
                    var deferred = $q.defer(),
                        uuid = deferred.promise;

                    this.pending[recordID] = deferred;
                    this.hasPendingItems = true;

                    uuids[recordID] = deferred.promise;
                    return uuid;
                }
            }
        };

        // --------------------------------------------------------------------
        /**
         * Get the UUID for an object key, and request the instance record
         * to be exported if not synchronized
         *
         * @param {integer} objectID - the object ID
         *
         * @returns {promise} - a promise that resolves into a tuple
         *                      [tableName, uuid] for the instance record
         */
        LoadMap.prototype.getObjectUID = function(objectID) {

            var deferred = $q.defer(),
                self = this,
                uuids = this.uuids;

            emDB.table('em_object').then(function(table) {

                table.where(table.$('id').equals(objectID))
                     .select(['tablename', 'uuid'], {limitby: 1}, function(rows) {
                    if (rows.length) {

                        var row = rows[0],
                            tableName = row.$('tablename'),
                            uuid = row.$('uuid');

                        self.proxyLoad(tableName, uuid);

                        // Resolve as [tableName, uuid], so that
                        // addReference can link to the instance record
                        var reference = [tableName, uuid];
                        uuids[objectID] = reference;
                        deferred.resolve(reference);

                    } else {
                        deferred.reject('object not found');
                    }
                });
            });

            return deferred.promise;
        };

        // --------------------------------------------------------------------
        /**
         * Forward an object UUID request to the load map of the instance
         * table (so the instance record gets exported if not synchronized)
         *
         * @param {string} tableName - the instance table name
         * @param {string} uuid - the object UUID
         */
        LoadMap.prototype.proxyLoad = function(tableName, uuid) {

            var task = this.task;

            emDB.table(tableName).then(function(table) {
                table.where(table.$('uuid').equals(uuid))
                     .select(['id'], {limitby: 1}, function(rows) {
                    if (rows.length) {
                        task.getLoadMap(tableName).getUID(rows[0].$('id'));
                    }
                });
            });
        };

        // --------------------------------------------------------------------
        /**
         * Add the UUID of a record to the map, resolving the UUID promise
         *
         * @param {object} record - the record
         */
        LoadMap.prototype.addUID = function(record) {

            var recordID = record.id,
                uuid = record.uuid;

            if (uuid) {

                // Add the UUID to the map
                this.uuids[recordID] = uuid;

                // Resolve the UUID promise if pending
                var pending = this.pending,
                    deferred = pending[recordID];
                if (deferred) {
                    deferred.resolve(uuid);
                    delete pending[recordID];
                }
            }
        };

        // --------------------------------------------------------------------
        /**
         * Decorator function to add component items to the loadMap of the
         * component table (resolving the respective promises there), and
         * embed them into their respective parent items
         *
         * @param {string} alias - the component alias
         * @param {Table} table - the component/link table
         * @param {LoadMap} loadMap - the load map for the component/link table
         * @param {object} hook - the component hook
         * @param {string} pkey - the referenced key field in the parent table
         *
         * @returns {function} - a function to add a component record
         */
        LoadMap.prototype.addComponentItem = function(alias, table, loadMap, hook, pkey) {

            var self = this,
                tableName = table.name,
                defaultAlias = tableName.split('_')[1] || tableName,
                parentKey = hook.fkey;

            // TODO: determine export fields of the component table

            if (hook.link) {
                parentKey = hook.lkey;
                // TODO: include hook.rkey in the export fields
            }

            return function(row) {

                // Add the item to its load map and request the parent
                var item = loadMap.addItem(table, row._()),
                    parent = self.getItem(pkey, row.$(parentKey));

                // Mark this item as inline by setting 'parent' property
                item.parent = parent;

                // Add this item inside the parent item when the parent
                // becomes available (returns a promise that resolves
                // when the component item has actually been embedded)
                return parent.then(function(parentItem) {

                    var data = parentItem.data,
                        tableKey = '$_' + tableName,
                        section = data[tableKey] || [];

                    // Add alias-attribute if not default
                    if (alias !== defaultAlias) {
                        item.data['@alias'] = alias;
                    }

                    section.push(item.data);
                    data[tableKey] = section;

                    return item;
                });
            };
        };

        // --------------------------------------------------------------------
        /**
         * Load any unsynchronized records in a component table
         *
         * @param {DataExport} task - the data export task
         * @param {object} tables - all known database tables
         * @param {string} alias - the component alias
         * @param {object} hook - the component hook
         * @param {Array} masterIDs - limit to component entries for these
         *                            master record IDs
         *
         * @returns {promise} - a promise that is resolved when all component
         *                      records have been extracted and added to the
         *                      export
         */
        LoadMap.prototype.loadComponent = function(task, tables, alias, hook, masterIDs) {

            var deferred = $q.defer(),
                component = tables[hook.tableName],
                fkey = component.$(hook.fkey),
                synchronizedOn = component.$('synchronized_on'),
                modifiedOn = component.$('modified_on'),
                self = this,
                fields,
                loadMap,
                addComponentItem,
                hasParent;

            var table = tables[this.tableName],
                pkey = table.$(hook.pkey).name;

            if (hook.link) {

                var link = tables[hook.link],
                    lkey = link.$(hook.lkey),
                    rkey = link.$(hook.rkey),
                    linkSynchronizedOn = link.$('synchronized_on'),
                    linkModifiedOn = link.$('modified_on');

                if (undefined === masterIDs) {
                    hasParent = lkey.isNot(null);
                } else {
                    hasParent = lkey.in(masterIDs);
                }

                fields = this.exportFields(link);
                // TODO make sure we have rkey in fields
                // TODO make sure we have all required keys from loadMap in fields

                loadMap = task.getLoadMap(link.name);
                addComponentItem = this.addComponentItem(alias, link, loadMap, hook, pkey);

                link.join(component.on(fkey.equals(rkey))).where(
                    allOf(
                        not(link.$('id').in(Object.keys(loadMap.items))),
                        hasParent,
                        anyOf(
                            linkSynchronizedOn.is(null),
                            linkSynchronizedOn.lessThan(linkModifiedOn),
                            synchronizedOn.is(null),
                            synchronizedOn.lessThan(modifiedOn)
                        )
                    )
                ).select(fields, function(rows) {
                    rows.forEach(function(row) {
                        self.pendingComponents.push(addComponentItem(row));
                    });
                    deferred.resolve();
                });

            } else {

                fields = this.exportFields(component);
                loadMap = task.getLoadMap(component.name);
                addComponentItem = this.addComponentItem(alias, component, loadMap, hook, pkey);

                if (undefined === masterIDs) {
                    hasParent = fkey.isNot(null);
                } else {
                    hasParent = fkey.in(masterIDs);
                }

                component.where(
                    allOf(
                        not(component.$('id').in(Object.keys(loadMap.items))),
                        hasParent,
                        anyOf(
                            synchronizedOn.is(null),
                            synchronizedOn.lessThan(modifiedOn)
                        )
                    )
                ).select(fields, function(rows) {
                    rows.forEach(function(row) {
                        self.pendingComponents.push(addComponentItem(row));
                    });
                    deferred.resolve();
                });
            }

            return deferred.promise;
        };

        // --------------------------------------------------------------------
        /**
         * Determine the currently required exports
         *
         * @returns {object} - an associative array {key: [value, value...]}
         *                     for query construction
         */
        LoadMap.prototype.requiredExports = function() {

            var requiredItems = this.requiredItems,
                required = {},
                lookups,
                lookup,
                key,
                values,
                i;

            for (key in requiredItems) {

                lookups = requiredItems[key];
                values = [];

                for (i = lookups.length; i--;) {
                    lookup = lookups[i];
                    if (undefined === lookup[2]) {
                        values.push(lookup[0]);
                    }
                }
                if (values.length) {
                    required[key] = values;
                }
            }

            return required;
        };

        // --------------------------------------------------------------------
        /**
         * Generate a query expression for required exports
         *
         * @param {Table} table - the database table
         *
         * @returns {Expression} - a query expression to extract the required
         *                         records
         */
        LoadMap.prototype.requiredQuery = function(table) {

            var requiredExports = this.requiredExports(),
                query,
                subQuery,
                values;

            for (var key in requiredExports) {

                values = requiredExports[key];

                if (!values.length) {
                    continue;
                } else if (values.length == 1) {
                    subQuery = table.$(key).is(values[0]);
                } else {
                    subQuery = table.$(key).in(values);
                }

                if (query) {
                    query = query.and(subQuery);
                } else {
                    query = subQuery;
                }
            }

            return query;
        };

        // --------------------------------------------------------------------
        /**
         * Determine the export fields for a table
         *
         * @param {Table} table - the table
         *
         * @returns {Array} - an array of field names
         */
        LoadMap.prototype.exportFields = function(table) {

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

            return fields;
        };

        // --------------------------------------------------------------------
        /**
         * Perform all deferred lookups; create export items for all
         * referenced records that are new or have been modified after
         * last synchronization
         *
         * @param {boolean} all - export all (new|modified) records in the table
         * @param {boolean} exportComponents - export components
         */
        LoadMap.prototype.load = function(all, exportComponents) {

            this.hasPendingItems = false;

            if (this.tableName == 'em_object') {
                // Object table has no direct lookups or exports
                return $q.resolve();
            }

            var deferred = $q.defer(),
                task = this.task,
                self = this;

            emDB.tables().then(function(tables) {

                var table = tables[self.tableName],
                    componentsLoaded = false;

                if (exportComponents) {

                    // Get all component hooks of the table
                    var hooks = emComponents.getHooks(table),
                        alias,
                        components = [];

                    // Load any component data
                    for (alias in hooks) {
                        // TODO: limit to self.pending keys if not 'all' (masterIDs)
                        components.push(self.loadComponent(task, tables, alias, hooks[alias]));
                    }
                    if (components.length) {
                        componentsLoaded = $q.all(components);
                    } else {
                        componentsLoaded = true;
                    }
                }

                $q.when(componentsLoaded).then(function() {

                    // Which fields to extract?
                    var fields = Object.keys(self.requiredItems),
                        exportFields = self.exportFields(table);
                    exportFields.forEach(function(fieldName) {
                        if (fields.indexOf(fieldName) == -1) {
                            fields.push(fieldName);
                        }
                    });

                    // Which records to load?
                    var query,
                        required = self.requiredQuery(table),
                        requiredUIDs = Object.keys(self.pending),
                        synchronizedOn = table.$('synchronized_on'),
                        modifiedOn = table.$('modified_on'),
                        unsynchronized = synchronizedOn.is(null).or(
                                         synchronizedOn.lessThan(modifiedOn));

                    if (all) {
                        // Initial load of primary table:
                        // => load all records which have updates or
                        //    are required to export component updates
                        if (required) {
                            query = unsynchronized.or(required);
                        } else {
                            query = unsynchronized;
                        }
                    } else {
                        // Implicit load of referenced table:
                        // => load all referenced records which have updates,
                        //    or are required to export component updates
                        if (requiredUIDs.length) {
                            query = table.$('id').in(requiredUIDs).and(unsynchronized);
                        }
                        if (required) {
                            if (query) {
                                query = query.or(required);
                            } else {
                                query = required;
                            }
                        }
                    }

                    if (query) {
                        table.where(query).select(fields, function(rows) {

                            rows.forEach(function(row) {
                                var record = row._(),
                                    recordID = record.id;

                                // Add en export item
                                self.addItem(table, record, exportFields);

                                // Remove recordID from requiredUIDs
                                // (since already resolved by addItem)
                                var idx = requiredUIDs.indexOf(recordID);
                                if (idx != -1) {
                                    requiredUIDs = requiredUIDs.splice(idx, 1);
                                }
                            });

                            // Any UUID lookups left?
                            // => just resolve the UUIDs, no export
                            if (requiredUIDs.length) {
                                table.where(table.$('id').in(requiredUIDs))
                                     .select(['id', 'uuid'], function(rows) {

                                    // Resolve the UID-promise for each row
                                    rows.forEach(function(row) {
                                        self.addUID(row._());
                                    });

                                    self.finalize(deferred);
                                });
                            } else {
                                self.finalize(deferred);
                            }
                        });
                    } else {
                        self.finalize(deferred);
                    }
                });

            });

            return deferred.promise;
        };

        // --------------------------------------------------------------------
        /**
         * Finalize the loading cycle (DRY helper for load())
         *
         * @param {deferred} deferred - the deferred object to resolve
         *                              when the loading cycle is complete
         */
        LoadMap.prototype.finalize = function(deferred) {

            if (!this.hasPendingItems) {
                // All pending UUID/item requests have been included
                // in the extraction queries at least once, so any
                // unresolved items left are unresolvable => reject them

                // Reject all unresolved UUID requests
                var pending = this.pending;
                for (var recordID in pending) {
                    pending[recordID].reject('record not found');
                }

                // Reject all unresolved item requests
                var requiredItems = this.requiredItems;
                for (var key in requiredItems) {
                    requiredItems[key].forEach(function(lookup) {
                        if (undefined === lookup[2]) {
                            lookup[2] = null;
                            lookup[1].reject('record not found');
                        }
                    });
                }
            }

            var pendingComponents = this.pendingComponents,
                self = this;
            if (pendingComponents.length) {
                // Wait for component items to be embedded
                $q.all(pendingComponents).finally(function() {
                    self.pendingComponents = [];
                    deferred.resolve();
                });
            } else {
                deferred.resolve();
            }
        };

        // ====================================================================
        // Return the constructor
        //
        return LoadMap;
    }
]);
