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

// ========================================================================
/**
 * emResources - Service providing abstract data resources
 *
 * @class emResources
 * @memberof EdenMobile.Services
 */
EdenMobile.factory('emResources', [
    '$q', 'emComponents', 'emDB', 'emUtils', 'Join', 'Represent', 'Subset',
    function ($q, emComponents, emDB, emUtils, Join, Represent, Subset) {

        "use strict";

        var resources = {},
            status = $q.defer(),
            resourcesLoaded = status.promise;

        // ====================================================================
        /**
         * Resource constructor
         *
         * @param {Table} table - the database table for this resource
         * @param {object} options - the options
         * @param {Resource} parent - the parent resource (for components/links)
         */
        function Resource(table, schema, parent) {

            var settings = schema.settings || {};

            // Table and Database
            this.table = table;
            this._db = table._db;

            // Resource name
            var name = this.getName(table, settings);
            this.name = name;

            // Table Name
            this.tableName = table.name;
            table.resources[name] = this;

            // Sync Dates
            this.schemaDate = null;
            this.lastSync = null;

            // Is this a main resource (or a component/lookup table)?
            this.main = !!settings.main;

            // Server-side controller/function
            this.controller = settings.controller;
            this.function = settings.function;

            // Fields
            var fieldOptions = schema.fields || {},
                fields = {},
                field;
            for (var fieldName in table.fields) {
                field = fieldOptions[fieldName];
                if (field) {
                    field.inherit(table.fields[fieldName]);
                } else {
                    field = table.fields[fieldName].clone();
                }
                field.resource = this;
                fields[fieldName] = field;
            }
            this.fields = fields;

            // The parent resource
            this.parent = parent;

            // Attached Components
            this._components = {};
            this._links = {};

            // Active Components ("tabs")
            this.activeComponents = {};

            // Settings
            settings = angular.extend({}, table.settings, settings);
            this.settings = settings;

            // Register Components
            if (!parent) {
                this.registerComponents();
            }

            // UI Configuration
            this.strings = settings.strings || {};
            this.form = settings.form;
            this.card = settings.card;
        }

        // --------------------------------------------------------------------
        /**
         * Establish the resource name
         *
         * @param {Table} table - the Table
         * @param {object} options - the resource options
         *
         * @returns {string} - the resource name
         */
        Resource.prototype.getName = function(table, options) {

            var name = options.name;
            if (!name) {
                var c = options.controller,
                    f = options.function;
                if (c && f) {
                    name = c + '_' + f.replace('/', '_');
                } else {
                    name = table.name;
                }
            }
            return name;
        };

        // --------------------------------------------------------------------
        /**
         * Register components for this resource
         */
        Resource.prototype.registerComponents = function() {

            var descriptions = this.settings.components;
            if (!descriptions) {
                return;
            }

            var description,
                table = this.table,
                activeComponents = this.activeComponents,
                activeComponent;

            for (var alias in descriptions) {
                description = descriptions[alias];
                emComponents.addComponent(table, alias, description);
                activeComponent = {
                    label: description.label || emUtils.capitalize(alias),
                    plural: description.plural || emUtils.capitalize(alias),
                    multiple: description.multiple
                };
                activeComponents[alias] = activeComponent;
            }
        };

        // --------------------------------------------------------------------
        /**
         * Instantiate a component resource from the hooks
         *
         * @param {string} alias - the component alias
         *
         * @returns {Resource} - the component resource
         */
        Resource.prototype.attachComponent = function(alias) {

            var component = this._components[alias];

            if (component) {

                // Already attached
                return component;

            } else {

                var hook = emComponents.getComponent(this.table, alias);
                if (!hook) {
                    return component;
                }

                var tables = this._db.tables,
                    table = tables[hook.tableName];

                if (table) {

                    var linkName = hook.link,
                        linkTable;

                    if (linkName) {
                        linkTable = tables[linkName];
                    }

                    if (!linkName || linkTable) {

                        var name = this.name + '.' + alias,
                            pkey = hook.pkey,
                            fkey = hook.fkey;

                        component = new Resource(table, {name: name}, this);
                        component.alias = alias;
                        component.pkey = pkey;
                        component.fkey = fkey;

                        if (linkTable) {

                            var linkAlias = alias + '__link';

                            var link = new Resource(linkTable, {name: name + '__link'}, this);
                            link.alias = linkAlias;
                            link.linked = component;

                            component.link = link;

                            var lkey = hook.lkey;

                            link.pkey = pkey;
                            link.fkey = lkey;
                            component.lkey = lkey;
                            component.rkey = hook.rkey;

                            this._links[linkAlias] = link;
                        }

                        this._components[alias] = component;
                    }
                }
            }

            return component;
        };

        // --------------------------------------------------------------------
        /**
         * Access a component or link resource
         *
         * @param {string} alias - the component alias
         *
         * @returns {Resource} - the component resource, or undefined if
         *                       the alias can not be resolved
         */
        Resource.prototype.component = function(alias) {

            var components = this._components,
                component = components[alias] || this.attachComponent(alias);

            if (component) {
                return component;
            }

            // Attached link table?
            component = this._links[alias];
            if (component) {
                return component;
            }

            var componentAlias,
                hooks = emComponents.getHooks(this.table);

            // Unattached link table?
            if (alias.slice(-6) == '__link') {
                componentAlias = alias.slice(0, -6);
                var hook = hooks[componentAlias];
                if (hook && hook.link) {
                    component = this.attachComponent(componentAlias);
                    return component && component.link;
                } else {
                    return component; // undefined
                }
            }

            // Link table name suffix?
            var suffix = function(n) { return n && n.slice(n.indexOf('_') + 1); };
            for (componentAlias in components) {
                var link = components[componentAlias].link;
                if (link && suffix(link.tableName) == alias) {
                    return link;
                }
            }
            for (componentAlias in hooks) {
                if (suffix(hooks[componentAlias].link) == alias) {
                    component = this.attachComponent(componentAlias);
                    return component && component.link;
                }
            }

            return component; // undefined
        };

        // --------------------------------------------------------------------
        /**
         * Create a Join for this resource
         *
         * @returns {Join} - the join
         */
        Resource.prototype.getJoin = function() {

            var tableName = this.tableName,
                link = this.link,
                join;

            if (!this.parent) {
                join = new Join(tableName);
            } else if (link) {
                join = link.getJoin();
                join.append(new Join(tableName, this.rkey, this.fkey));
            } else {
                join = new Join(tableName, this.pkey, this.fkey);
            }

            return join;
        };

        // --------------------------------------------------------------------
        /**
         * Synchronous method to access a Table
         *
         * @param {string} name - the table name (optional),
         *                        returns the table of this resource if omitted
         *
         * @returns {Table} - the table (undefined if not found)
         */
        Resource.prototype.getTable = function(name) {

            var table;

            if (name) {
                table = this._db.tables[name];
            } else {
                table = this.table;
            }

            return table;
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

            return this.table.addDefaults.apply(this, [data, visible, update]);
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
                var name = this.name;
                label = emUtils.capitalize(name.slice(name.indexOf('_') + 1));
            }

            return label;
        };

        // --------------------------------------------------------------------
        /**
         * Get field options
         *
         * @param {string} fieldName - the field name
         *
         * @returns {Array} - an array of tuples [[key, label], ...] of the
         *                    available field options
         */
        Resource.prototype.getOptions = function(fieldName) {

            var field = this.table.$(fieldName),
                options,
                promise;

            if (!field) {
                return $q.reject('field not found: ' + fieldName);
            } else {
                // Use the resource-specific clone
                field = this.fields[field.name];
            }

            if (field.isForeignKey) {

                var deferred = $q.defer();

                // Look up all recordIDs in the referenced table
                var fk = field.getForeignKey(),
                    lookupTable = this.getTable(fk.table),
                    key = fk.key,
                    self = this;

                lookupTable.select([key], function(rows) {

                    var keys = rows.map(function(row) {
                        return row.$(key);
                    });

                    var represent = new Represent(self.table, field);

                    represent.bulk(keys).then(function(labels) {
                        options = keys.map(function(k) {
                            return [k, labels[k] || k];
                        });
                        deferred.resolve(options);
                    });
                });

                promise = deferred.promise;

            } else {

                options = field._description.options || [];

                if (options.constructor == Array) {
                    // Copy original array (=> allow the caller to modify)
                    options = angular.copy(options);
                } else {
                    // Convert into array of tuples
                    options = Object.keys(options).map(function(k) {
                        return [k, options[k]];
                    });
                }
                promise = $q.resolve(options);
            }
            return promise;
        };

        // --------------------------------------------------------------------
        /**
         * Get a string representation for a field value
         *
         * @param {string} fieldName - the field name
         * @param {*} value - the field value
         *
         * @returns {promise} - a promise that resolves into a string
         *                      representation of the field value
         *
         * @throws - if the field does not exist in this resource
         *
         * TODO support field selectors
         */
        Resource.prototype.represent = function(fieldName, value) {

            var field = this.fields[fieldName];
            if (!field) {
                throw new Error('field not found: ' + fieldName);
            }
            var represent = new Represent(this.table, field);
            return represent.render(value);
        };

        // --------------------------------------------------------------------
        /**
         * Wrap a set of records in their representations
         *
         * @param {Array} records - a set of records (as objects)
         * @returns {promise} - a promise that resolves into an array
         *                      with each record wrapped in an object
         *                      with represented field values, including
         *                      a '_row' property holding the original record
         *
         * TODO: support field selectors (and hence native Rows)
         */
        Resource.prototype.representRecords = function(records) {

            var renderers = {},
                table = this.table,
                fields = this.fields,
                attr,
                renderer,
                rawValues = {},
                values,
                field,
                value;

            // Collect fields+values, instantiate renderers
            records.forEach(function(record) {

                for (attr in record) {
                    renderer = renderers[attr];
                    if (!renderer) {
                        field = fields[attr];
                        if (field) {
                            renderer = new Represent(table, field);
                            renderers[attr] = renderer;
                        } else {
                            continue;
                        }
                    }
                    value = record[attr];
                    values = rawValues[attr] || [];
                    if (value && values.indexOf(value) == -1) {
                        values.push(value);
                    }
                    rawValues[attr] = values;
                }
             });

            // Bulk-lookup representations
            var lookups = [],
                repr = {},
                reprAdd = function(attr) {
                    return function(result) {
                        repr[attr] = result;
                    };
                };
            for (attr in rawValues) {
                renderer = renderers[attr];
                if (renderer) {
                    values = rawValues[attr];
                    if (values && values.length) {
                        lookups.push(renderer.bulk(values).then(reprAdd(attr)));
                    } else {
                        repr[attr] = {};
                    }
                }
            }

            // Construct represented records + resolve
            var deferred = $q.defer();

            $q.all(lookups).finally(function() {

                var output = [];
                records.forEach(function(record) {

                    var reprRecord = {'_row': record},
                        reprValues,
                        reprStr;

                    for (attr in record) {
                        value = record[attr];
                        reprStr = '' + value;
                        if (value === null) {
                            if (attr == 'llrepr') {
                                // Leave empty (fallback trigger)
                                reprStr = '';
                            } else {
                                reprStr = '-';
                            }
                        } else {
                            reprValues = repr[attr];
                            if (reprValues) {
                                reprStr = reprValues[value] || reprStr;
                            }
                        }
                        reprRecord[attr] = reprStr;
                    }
                    output.push(reprRecord);
                });
                deferred.resolve(output);
            });

            return deferred.promise;
        };

        // --------------------------------------------------------------------
        /**
         * Define a Subset of this Resource
         *
         * @param {Expression} query - the filter query for the subset
         *
         * @returns {Subset} - the Subset
         */
        Resource.prototype.where = function(query) {

            return new Subset(this, query);
        };

        // --------------------------------------------------------------------
        /**
         * Define a Subset of this Resource with a parent record ID
         *
         * @param {integer} parentID - the parent record ID (optional)
         * @param {Expression} query - the filter query for the subset
         *
         * @returns {Subset} - the Subset
         */
        Resource.prototype.subSet = function(parentID, query) {

            return new Subset(this, parentID, query);
        };

        // --------------------------------------------------------------------
        /**
         * Add a new record to this resource
         *
         * @param {object} data - the data for the record
         *
         * @returns {promise} - a promise that resolves into the new record ID
         */
        Resource.prototype.insert = function(data) {

            return this.subSet().insert(data);
        };

        // --------------------------------------------------------------------
        /**
         * Select records from this resource
         *
         * @param {Array} fields - Array of Fields or field names to extract
         * @param {object} options - select options (orderby, limitby etc.)
         *
         * @returns {promise} - a promise that resolves into the extracted
         *                      records (Rows)
         */
        Resource.prototype.select = function(fields, options) {

            return new Subset(this).select(fields, options);
        };

        // --------------------------------------------------------------------
        /**
         * Bulk-update all records in this resource
         *
         * @param {object} data - the data to write
         *
         * @returns {promise} - a promise that resolves into the number of
         *                      updated records (affectedRows)
         */
        Resource.prototype.update = function(data) {

            return this.subSet().update(data);
        };

        // --------------------------------------------------------------------
        /**
         * Count the records in this resource
         *
         * @returns {promise} - a promise that resolves into the number of
         *                      records in this resource (numRows)
         */
        Resource.prototype.count = function() {

            return this.subSet().count();
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
                    this.where(this.fields.uuid.is(uuid))
                        .select(['id'], {limitby: 1}).then(
                        function(rows) {
                            if (rows.length) {
                                recordID = rows[0].$('id');
                            }
                            deferred.resolve(recordID);
                        },
                        function(error) {
                            deferred.reject(error);
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
         * Save the schema for this resource in the em_resource table
         */
        Resource.prototype.saveSchema = function() {

            var name = this.name,
                fields = this.fields,
                fieldName,
                field,
                fieldDef = {};

            // Encode the schema
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
                'settings': this.settings,
                'main': this.main
            };

            // Save the schema
            emDB.table('em_resource').then(function(table) {
                var dbSet = table.where(table.$('name').equals(name));
                dbSet.select(['id'], {limit: 1}, function(rows) {
                    if (rows.length) {
                        dbSet.update(schema);
                    } else {
                        table.insert(schema);
                    }
                });
            });
        };

        // --------------------------------------------------------------------
        /**
         * Setter for schema date
         *
         * @param {Date} timeStamp - the new schema date
         */
        Resource.prototype.setSchemaDate = function(timeStamp) {

            var self = this,
                name = this.name;

            emDB.table('em_resource').then(function(table) {

                table.where(table.$('name').equals(name)).update(
                    {
                        schema_date: timeStamp
                    },
                    function() {
                        self.schemaDate = timeStamp;
                    });
            });
        };

        // --------------------------------------------------------------------
        /**
         * Getter for schema date
         *
         * @returns {Date} - the schema date
         */
        Resource.prototype.getSchemaDate = function() {

            return this.schemaDate;
        };

        // --------------------------------------------------------------------
        /**
         * Setter for lastSync date
         *
         * @param {Date} timeStamp - the new lastSync date
         */
        Resource.prototype.setLastSync = function(timeStamp) {

            var self = this,
                name = this.name;

            emDB.table('em_resource').then(function(table) {

                table.where(table.$('name').equals(name)).update(
                    {
                        lastsync: timeStamp
                    },
                    function() {
                        self.lastSync = timeStamp;
                    });
            });
        };

        // --------------------------------------------------------------------
        /**
         * Getter for lastSync date
         *
         * @returns {Date} - the lastSync date
         */
        Resource.prototype.getLastSync = function() {

            return this.lastSync;
        };

        // ====================================================================
        /**
         * Set up the default resource for a table; default resources are
         * only set up if there are no loaded resources for the table.
         *
         * @param {string} tableName - the table name
         *
         * @returns {promise} - a promise that is resolved when the default
         *                      resource for this table has been set up
         */
        var setupDefaultResource = function(tableName) {

            return emDB.table(tableName).then(function(table) {
                if (table !== undefined &&
                    Object.keys(table.resources).length === 0) {
                    var resource = new Resource(table);
                    resources[resource.name] = resource;
                }
            });
        };

        // --------------------------------------------------------------------
        /**
         * Set up default resources for resource-less tables
         *
         * @returns {promise} - a promise chain that is resolved when all
         *                      default resources have been set up
         */
        var setupDefaultResources = function() {

            return emDB.tableNames().then(function(tableNames) {
                var pending = [];
                tableNames.forEach(function(tableName) {
                    pending.push(setupDefaultResource(tableName));
                });
                return $q.all(pending);
            });
        };

        // --------------------------------------------------------------------
        /**
         * Set up a resource from a em_resource record
         *
         * @param {object} record - the em_resource record
         *
         * @returns {promise} - a promise that is resolved when the resource
         *                      has been set up
         */
        var setupResource = function(record) {

            var tableName = record.tablename;

            return emDB.table(tableName).then(function(table) {

                var resource;

                if (table !== undefined) {

                    var schema = {};

                    schema.settings = angular.extend({}, record.settings, {
                        'name': record.name,
                        'controller': record.controller,
                        'function': record.function,
                        'main': record.main
                    });

                    var fieldOpts = record.fields;
                    if (fieldOpts) {
                        schema.fields = emDB.parseSchema(fieldOpts).fields;
                    }

                    // Instantiate the Resource
                    resource = new Resource(table, schema);
                    resources[resource.name] = resource;

                    // Set date of schema synchronization
                    var schemaDate = record.schema_date;
                    if (schemaDate) {
                        resource.schemaDate = schemaDate;
                    }

                    // Set date of data synchronization
                    var syncDate = record.lastsync;
                    if (syncDate) {
                        resource.lastSync = syncDate;
                    }
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

            // Load all resources from database
            emDB.table('em_resource').then(function(table) {

                var fields = [
                    'name',
                    'tablename',
                    'controller',
                    'function',
                    'fields',
                    'settings',
                    'schema_date',
                    'lastsync',
                    'main'
                ];

                table.select(fields, function(rows) {

                    var pending = [];

                    if (rows.length) {
                        rows.forEach(function(row) {
                            pending.push(setupResource(row._()));
                        });
                    }
                    $q.all(pending).then(function() {
                        // Add default resources for all tables
                        setupDefaultResources().then(function() {
                            status.resolve();
                        });
                    });
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
                    settings = schema.settings || {};

                var installResource = function(table) {

                    // Find the resource
                    var name = Resource.prototype.getName(table, settings),
                        resource = table.resources[name];

                    if (!resource) {
                        // New resource
                        resource = new Resource(table, schema);
                    } else {
                        // Update resource
                        if (settings.main) {
                            resource.main = true;
                        }

                        // Update settings
                        if (table.isDefaultResource(resource.name)) {
                            table.settings = angular.extend({}, table.settings, settings);
                            table.saveSchema();
                            resource.settings = table.settings;
                        } else {
                            resource.settings = angular.extend({}, table.settings, settings);
                        }

                        // @todo: migrate schema
                    }

                    // Register and save schema
                    resources[resource.name] = resource;
                    resource.saveSchema();

                    resourceInstalled.resolve(resource);
                };

                emDB.table(tableName).then(function(table) {
                    if (!table) {
                        emDB.defineTable(
                            tableName,
                            schema.fields,
                            settings,
                            schema.records
                        ).then(installResource);
                    } else {
                        installResource(table);
                    }
                });
                return resourceInstalled.promise;
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
            resourceList: function() {

                var names = {},
                    resource,
                    resourceList = [],
                    resourceName;

                for (resourceName in resources) {
                    resource = resources[resourceName];
                    if (!resource.parent) {
                        names[resourceName] = null;
                    }
                }

                if (!Object.keys(names).length) {
                    return $q.resolve(resourceList);
                }

                var addResourceInfo = function(resourceName, deferred) {
                    return function(numRows) {
                        resourceList.push({
                            resource: resources[resourceName],
                            numRows: numRows
                        });
                        deferred.resolve();
                    };
                };

                var resourceLookups = [],
                    table,
                    synchronizedOn,
                    modifiedOn,
                    query,
                    addInfo,
                    deferred;

                for (resourceName in names) {

                    resource = resources[resourceName];
                    table = resource.table;

                    synchronizedOn = table.$('synchronized_on');
                    modifiedOn = table.$('modified_on');
                    query = synchronizedOn.is(null).or(
                            synchronizedOn.lessThan(modifiedOn));

                    deferred = $q.defer();
                    resourceLookups.push(deferred.promise);

                    addInfo = addResourceInfo(resourceName, deferred);
                    table.where(query).count(addInfo);
                }

                return $q.all(resourceLookups).then(function() {
                    return resourceList;
                });
            }
        };

        return api;
    }
]);

// END ========================================================================
