/**
 * Sahana Eden Mobile - Resources
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

"use strict";

// ========================================================================
/**
 * emResources - Service providing abstract data resources
 *
 * @class emResources
 * @memberof EdenMobile.Services
 */
EdenMobile.factory('emResources', [
    '$q', 'emDB',
    function ($q, emDB) {

        var resources = {},
            status = $q.defer(),
            resourcesLoaded = status.promise;

        // ====================================================================
        /**
         * ImportItem Constructor
         *
         * @param {object} data - the record data to import
         */
        function ImportItem(resource, data) {

            this.resource = resource;

            this.data = data;
            this.recordID = null;

            this.status = null;
        }

        // --------------------------------------------------------------------
        /**
         * Commit this import item
         *
         * @param {Date} syncDate - the synchronization date/time
         * @returns {promise} - a promise that is resolved with this
         *                      item when its processing is complete
         *                      (for queue handling)
         */
        ImportItem.prototype.commit = function(syncDate) {

            var resource = this.resource,
                record = resource.deserialize(this.data),
                self = this,
                committed = $q.defer();

            if (syncDate === undefined) {
                syncDate = new Date();
            }

            resource.identify(record).then(function(recordID) {

                record.synchronized_on = syncDate;
                record.modified_on = syncDate;

                if (!!recordID) {
                    // Update existing record
                    var query = 'id=' + recordID;

                    self.recordID = recordID;

                    resource.update(record, query, function(numRowsAffected) {
                        if (!!numRowsAffected) {
                            self.status = 'updated';
                        } else {
                            self.status = 'failed';
                        }
                        committed.resolve(self);
                    });

                } else {
                    // Create new record
                    record.created_on = syncDate;

                    resource.insert(record, function(insertID) {
                        if (!!insertID) {
                            self.recordID = insertID;
                            self.status = 'created';
                        } else {
                            self.status = 'failed';
                        }
                        committed.resolve(self);
                    });
                }
            });

            return committed.promise;
        };

        // ====================================================================
        /**
         * Resource constructor
         *
         * @param {Table} table - the database table for this resource
         * @param {object} options - the options (@todo: rename as description)
         */
        function Resource(table, options) {

            this.table = table;
            this.tableName = table.tableName;
            this.query = null;

            if (options === undefined) {
                options = {};
            }

            var name = options.name,
                c = options.controller,
                f = options.function;

            // Resource name
            if (name === undefined) {
                if (c && f) {
                    name = c + '_' + f;
                } else {
                    name = table.tableName;
                }
            }
            this.name = name;

            // Link to table
            table.resources[name] = this;

            // Server-side controller/function
            this.controller = c;
            this.function = f;

            // Fields
            var fieldOptions = options.fields || {},
                fields = {},
                field;
            for (var fieldName in table.fields) {
                field = fieldOptions[fieldName];
                if (field) {
                    field.inherit(table.fields[fieldName]);
                } else {
                    field = table.fields[fieldName].clone();
                }
                fields[fieldName] = (field);
            }
            this.fields = fields;

            // Settings
            var settings = angular.extend({}, table.settings, (options.settings || {}));
            this.settings = settings;


            // Components
            this.components = settings.components || {};

            // UI Configuration
            this.strings = settings.strings || {};
            this.form = settings.form;
            this.card = settings.card;
        }

        // --------------------------------------------------------------------
        /**
         * Save the schema for this resource in the em_resource table
         */
        Resource.prototype.saveSchema = function() {

            var name = this.name,
                fields = this.fields,
                fieldName,
                field,
                fieldDef = {};

            for (fieldName in fields) {
                field = fields[fieldName];
                if (!field.meta) {
                    fieldDef[fieldName] = field.description();
                }
            }

            var schema = {
                'name': name,
                'tablename': this.tableName,
                'controller': this.controller,
                'function': this.function,
                'fields': fieldDef,
                'settings': this.settings
            };

            // Check if this is an update

            var name = this.name;
            emDB.table('em_resource').then(function(table) {

                var query = 'em_resource.name="' + name + '"';

                table.select(['id'], query, function(records) {
                    if (records.length === 0) {
                        table.insert(schema);
                    } else {
                        table.update(schema, query);
                    }
                })
            });
        };

        // --------------------------------------------------------------------
        /**
         * Extend a query with the resource query
         *
         * @param {string} query - the query (SQL WHERE expression)
         *
         * @returns {string} - the extended query
         */
        Resource.prototype.extendQuery = function(query) {

            var q = this.query;

            if (query) {
                if (q) {
                    q += ' AND (' + query + ')';
                } else {
                    q = query;
                }
            }
            return q;
        };

        // --------------------------------------------------------------------
        /**
         * Add field defaults to a record before write
         *
         * @param {object} data - the data that are to be written
         * @param {boolean} visible - only add visible defaults (for forms)
         * @param {boolean} update - apply update-defaults rather than
         *                           create-defaults
         *
         * @returns {object} - a new data object including default values
         */
        Resource.prototype.addDefaults = function(data, visible, update) {

            // @todo: add resource name to data

            return this.table._addDefaults(this.fields, data, visible, update);
        };

        // --------------------------------------------------------------------
        /**
         * Get a label for the resource
         *
         * @param {boolean} plural - get the plural label if available
         */
        Resource.prototype.getLabel = function(plural) {

            var label = null,
                strings = this.strings;

            if (strings) {
                if (plural) {
                    label = strings.namePlural;
                }
                if (!label) {
                    label = strings.name;
                }
            }
            if (!label) {
                label = this.name;
            }

            return label;
        };

        // --------------------------------------------------------------------
        /**
         * Add a new record to this resource
         *
         * @param {object} data - the data for the record
         * @param {function} callback - callback function: function(insertID)
         */
        Resource.prototype.insert = function(data, callback) {

            var record = this.addDefaults(data, false, false);

            this.table.insert(record, callback);
        };

        // --------------------------------------------------------------------
        /**
         * Update records in this resource
         *
         * @param {object} data - the data to update {fieldName: value}
         * @param {string} query - SQL WHERE expression
         * @param {function} callback - callback function: function(numRowsAffected)
         */
        Resource.prototype.update = function(data, query, callback) {

            var record = this.addDefaults(data, false, true);

            if (arguments.length == 2) {
                callback = query;
                query = null;
            }

            this.table.update(data, this.extendQuery(query), callback);
        };

        // --------------------------------------------------------------------
        /**
         * Select records from this resource
         *
         * @param {Array} fields - array of field names
         * @param {string} query - SQL WHERE expression
         * @param {function} callback - callback function:
         *                              function(records, result)
         */
        Resource.prototype.select = function(fields, query, callback) {

            switch(arguments.length) {
                case 1:
                    callback = fields;
                    fields = null;
                    query = null;
                    break;
                case 2:
                    callback = query;
                    if (typeof fields == 'string') {
                        query = fields;
                        fields = null;
                    } else {
                        query = null;
                    }
                    break;
                default:
                    break;
            }
            var query = this.extendQuery(query);

            this.table.select(fields, query, callback);
        };

        // --------------------------------------------------------------------
        /**
         * Count records in this resource
         *
         * @param {string} query - SQL WHERE expression
         * @param {function} callback - callback function:
         *                              function(resourceName, numRows)
         */
        Resource.prototype.count = function(query, callback) {

            if (arguments.length == 1) {
                callback = query;
                query = null;
            }

            var resourceName = this.name;
            this.table.count(this.extendQuery(query),
                function(tableName, numRows) {
                    if (callback) {
                        callback(resourceName, numRows);
                    }
                }
            );
        };

        // --------------------------------------------------------------------
        /**
         * Delete records in this resource
         *
         * @param {string} query - SQL WHERE expression
         * @param {function} callback - callback function: function(numRowsDeleted)
         */
        Resource.prototype.deleteRecords = function(query, callback) {

            if (arguments.length == 1) {
                callback = query;
                query = null;
            }

            this.table.deleteRecords(this.extendQuery(query), callback);
        };

        // --------------------------------------------------------------------
        /**
         * Identify a record, use like:
         *      - resource.identify(record).then(function(recordID){});
         *
         * @param {object} record - the record
         *
         * @returns {promise} - a promise that resolves into the record ID
         */
        Resource.prototype.identify = function(record) {

            var deferred = $q.defer(),
                recordID = record.id;

            if (!!recordID) {
                // We already have a record ID
                deferred.resolve(recordID);
            } else {
                // Try looking it up from the UUID
                var uuid = record.uuid;
                if (!!uuid) {
                    // Look it up
                    var query = 'uuid="' + uuid + '"';
                    this.select(['id'], query, function(records) {
                        if (records.length) {
                            recordID = records[0].id;
                        }
                        deferred.resolve(recordID);
                    });
                } else {
                    // No way to identify the record (yet)
                    // @todo: try unique fields
                    deferred.resolve(recordID);
                }
            }

            // Return the promise
            return deferred.promise;
        };

        // --------------------------------------------------------------------
        /**
         * Access a component of this resource
         *
         * @param {integer} recordID - the master record ID
         * @param {string} componentName - the component name
         * @param {function} onSuccess - callback function, receives the
         *                               component resource and query as
         *                               parameters
         * @param {function} onError - error callback, receives the error
         *                             message as parameter
         */
        Resource.prototype.openComponent = function(recordID, componentName, onSuccess, onError) {

            var hook = this.components[componentName];

            if (!hook || !hook.resource) {
                var error = 'Undefined component: ' + componentName;
                if (onError) {
                    onError(error);
                } else {
                    alert(error);
                }
            } else {
                resourcesLoaded.then(function() {
                    var component = resources[hook.resource],
                        query = null;
                    if (recordID) {
                        query = hook.joinby + '=' + recordID;
                    };
                    if (onSuccess) {
                        onSuccess(component, query);
                    }
                });
            }
        };

        // --------------------------------------------------------------------
        /**
         * Serialize a record for JSON export to Sahana server
         *
         * @param {object} record - the record
         *
         * @returns {object} - the record data, object attributes:
         *                      .data: the record data,
         *                             as JSON,
         *                      .files: files attached to this record,
         *                              as array of [fileName, fileURI]
         */
        Resource.prototype.serialize = function(record) {

            var data = {},
                fields = this.fields,
                fieldName,
                field,
                files = [],
                fileName,
                value;

            for (fieldName in fields) {

                field = fields[fieldName];
                value = record[fieldName];

                if (value !== undefined) {

                    if (field.type == 'upload') {
                        fileName = value.split('/').pop().split('#')[0].split('?')[0];
                        data[fieldName] = fileName;
                        files.push([fileName, value]);
                    } else {
                        data[fieldName] = field.format(value);
                    }
                }
            }

            return {
                data: data,
                files: files
            };
        };

        // --------------------------------------------------------------------
        /**
         * Deserialize a record from JSON import from Sahana server
         *
         * @param {Array} row - the record data as array of
         *                      tuples in the format [fieldName, value]
         *
         * @returns {object} - the record as object
         */
        Resource.prototype.deserialize = function(row) {

            var record = {},
                fields = this.fields;

            row.forEach(function(column) {

                var name = column[0],
                    value = column[1],
                    field = fields[name];

                if (!!field && value !== undefined) {
                    record[name] = field.parse(value);
                }
            });

            return record;
        };

        // --------------------------------------------------------------------
        /**
         * Export records from this resource for upload to Sahana server
         *
         * @param {Array} fields - array of field names (optional)
         * @param {string} query - SQL WHERE expression to select the records
         * @param {function} callback - callback function: function(data, files)
         */
        Resource.prototype.exportJSON = function(fields, query, callback) {

            var self = this;

            switch(arguments.length) {
                case 1:
                    callback = fields;
                    fields = null;
                    query = null;
                    break;
                case 2:
                    callback = query;
                    query = fields;
                    fields = null;
                    break;
                default:
                    break;
            }

            if (!fields) {
                fields = Object.keys(self.fields);
            }

            var requiredFields = ['uuid', 'created_on', 'modified_on'];
            requiredFields.forEach(function(fieldName) {
                if (fields.indexOf(fieldName) == -1) {
                    fields.push(fieldName);
                }
            });

            self.select(fields, query, function(records) {

                var output = {},
                    rows = [],
                    files = [],
                    record;

                if (!records.length) {
                    // No data
                    if (callback) {
                        callback();
                    }
                } else {
                    // Collect rows and files
                    for (var i=0, len=records.length; i<len; i++) {
                        record = self.serialize(records[i]);
                        rows.push(record.data);
                        files = files.concat(record.files);
                    }

                    // Execute callback
                    output[self.tableName] = rows;
                    if (callback) {
                        callback(JSON.stringify(output), files);
                    }
                }
            });
        };

        // --------------------------------------------------------------------
        /**
         * Import data from the Sahana server (WIP)
         *
         * @param {object} data - the JSON data from the server
         * @param {function} callback - callback function that is invoked
         *                              when the import has completed,
         *                              receives a result counter object as
         *                              parameter:
         *                                  {created: number,
         *                                   updated: number,
         *                                   failed: number
         *                                   }
         */
        Resource.prototype.importJSON = function(data, callback) {

            var rows = data[this.tableName],
                result = {
                    updated: 0,
                    created: 0,
                    failed: 0
                };

            if (rows) {

                var importQueue = [];

                // Queue handler
                var checkQueue = function(item) {

                    // Update counters
                    switch(item.status) {
                        case 'updated':
                            result.updated++;
                            break;
                        case 'created':
                            result.created++;
                            break;
                        default:
                            result.failed++
                            break;
                    };

                    // Check queue status
                    var ready = true;
                    for (var i=importQueue.length; --i;) {
                        if (!importQueue[i].status) {
                            ready = false;
                            break;
                        }
                    }

                    // Run callback when done
                    if (ready && !!callback) {
                        callback(result);
                    }
                };

                // Schedule all rows
                var self = this;
                rows.forEach(function(row) {
                    importQueue.push(new ImportItem(self, row));
                });

                // Run the queue
                var now = new Date();
                importQueue.forEach(function(item) {
                    item.commit(now).then(checkQueue);
                });

            } else {

                // Nothing to import => run callback immediately
                if (!!callback) {
                    callback(result);
                }
            }
        };

        // ====================================================================
        /**
         * Set up the default resource for a table
         *
         * @param {string} tableName - the table name
         * @param {function} callback - callback function: function(tableName)
         */
        var setupDefaultResource = function(tableName, callback) {

            emDB.table(tableName).then(function(table) {
                if (table !== undefined &&
                    Object.keys(table.resources).length === 0) {
                    var resource = new Resource(table)
                    resources[resource.name] = resource;
                }
                if (callback) {
                    callback(tableName);
                }
            });
        };

        // --------------------------------------------------------------------
        /**
         * Set up default resources for pre-installed tables (emDefaultSchema)
         */
        var setupDefaultResources = function() {

            var deferred = $q.defer(),
                pending = {};

            var resolve = function(tableName) {
                if (pending.hasOwnProperty(tableName)) {
                    delete pending[tableName];
                }
                if (Object.keys(pending).length === 0) {
                    deferred.resolve();
                }
            };

            emDB.tableNames().then(function(tableNames) {
                tableNames.forEach(function(tableName) {
                    pending[tableName] = true;
                    setupDefaultResource(tableName, resolve);
                });
            });

            return deferred.promise;
        };

        // --------------------------------------------------------------------
        /**
         * Set up a resource from a em_resource record
         *
         * @param {object} record - the em_resource record
         * @param {function} callback - callback function: function(resourceName)
         */
        var setupResource = function(record, callback) {

            var tableName = record.tablename;
            emDB.table(tableName).then(function(table) {
                if (table !== undefined) {
                    var resourceName = record.name,
                        fieldOpts = record.fields,
                        options = {
                            'name': resourceName,
                            'controller': record.controller,
                            'function': record.function,
                            'settings': record.settings
                        },
                        schema;
                    if (fieldOpts) {
                        options.fields = emDB.parseSchema(fieldOpts).fields;
                    }
                    resources[resourceName] = new Resource(table, options);
                }
                if (callback) {
                    callback(record.name);
                }
            });
        };

        // --------------------------------------------------------------------
        /**
         * Load all resources and attach them to the tables
         *
         * - resolves the resourcesLoaded promise
         */
        var loadResources = function() {

            var pending = {};

            var wrapUp = function() {
                setupDefaultResources().then(function() {
                    status.resolve();
                });
            };

            var resolve = function(resourceName) {

                if (pending.hasOwnProperty(resourceName)) {
                    delete pending[resourceName];
                }
                if (Object.keys(pending).length === 0) {
                    wrapUp();
                }
            };

            // Load all resources from database
            emDB.table('em_resource').then(function(table) {

                var fields = [
                    'name',
                    'tablename',
                    'controller',
                    'function',
                    'fields',
                    'settings'
                ];

                table.select(fields, function(records, result) {
                    if (records.length) {
                        records.forEach(function(record) {
                            pending[record.name] = true;
                            setupResource(record, resolve);
                        });
                    } else {
                        wrapUp();
                    }
                });
            });
        };

        // Load all resources on init
        loadResources();

        // ====================================================================
        var api = {

            /**
             * Get the names of all currently defined resources
             *
             * @returns {promise} - a promise that resolves into an Array
             *                      of resource names
             *
             * @example
             * emResource.names().then(function(names) {...});
             */
            names: function() {
                return resourcesLoaded.then(function() {
                    return Object.keys(resources);
                });
            },

            /**
             * Open a resource
             *
             * @param {string} resourceName - the resource name
             *
             * @returns {promise} - a promise that resolves into a
             *                      Resource instance, or undefined
             *                      if no resource with that name exists
             *
             * @example
             * emResources.open('my_resource').then(function(resource) {...});
             */
            open: function(resourceName) {

                return resourcesLoaded.then(function() {
                    return resources[resourceName];
                });
            },

            /**
             * Install a new resource
             *
             * @param {string} tableName - the table name
             * @param {object} schemaData - the schema data from the server
             */
            install: function(tableName, schemaData) {

                var resourceInstalled = $q.defer(),
                    schema = emDB.parseSchema(schemaData),
                    options = angular.extend({}, schema.settings, {fields: schema.fields});

                var installResource = function(table) {
                    var resource = new Resource(table, options);
                    resources[resource.name] = resource;
                    resource.saveSchema();
                    resourceInstalled.resolve(resource);
                };

                emDB.table(tableName).then(function(table) {
                    if (!table) {
                        emDB.defineTable(
                            tableName,
                            schema.fields,
                            schema.settings,
                            schema.records
                        ).then(installResource);
                    } else {
                        installResource(table);
                    }
                });
                return resourceInstalled.promise;
            },

            /**
             * @todo: implement this
             */
            remove: function(resourceName) {

                // Remove a resource
            },

            /**
             * Get a list of available resources with the numbers of
             * records updated since the last synchronization with the
             * server.
             *
             * @param {function} callback: callback, function(resourceList)
             *                             with resourceList being a list of
             *                             {resource:Resource, numRows:integer}
             */
            resourceList: function(callback) {

                var names = {},
                    resourceList = [],
                    resourceName;

                for (resourceName in resources) {
                    names[resourceName] = null;
                }

                var addResourceInfo = function(resourceName, numRows) {
                    resourceList.push({
                        resource: resources[resourceName],
                        numRows: numRows
                    });
                    delete names[resourceName];
                    if (Object.keys(names).length === 0 && callback) {
                        callback(resourceList);
                    }
                };

                var resource,
                    tableName,
                    query;
                for (resourceName in names) {
                    resource = resources[resourceName];
                    tableName = resource.tableName;
                    query = 'synchronized_on IS NULL OR synchronized_on<modified_on';
                    resource.count(query, addResourceInfo);
                }
            }
        };

        return api;
    }
]);

// END ========================================================================
