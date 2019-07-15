/**
 * Sahana Eden Mobile - S3JSON Codec
 *
 * Copyright (c) 2016-2019 Sahana Software Foundation
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

/**
 * Service to convert S3JSON <=> Internal Data Format
 *
 * @class emS3JSON
 * @memberof EdenMobile.Services
 */
EdenMobile.factory('emS3JSON', [
    '$q', 'emComponents', 'emDB', 'emUtils',
    function ($q, emComponents, emDB, emUtils) {

        "use strict";

        // ====================================================================
        /**
         * Parse a datetime string: prevent inconsistent interpretations of
         * ISO format strings without explicit time zone indicator (some JS
         * implementations treat those as UTC, others as local time)
         *
         * @param {string} dtStr - the datetime string
         */
        var parseUTCDateTime = function(dtStr) {

            if (dtStr.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/g)) {
                // ISO DateTime string without time zone indicator
                // => append a trailing Z to indicate UTC
                dtStr += 'Z';
            }
            return new Date(dtStr);
        };

        // ====================================================================
        /**
         * Helper class to locate import items in an S3JSON object tree
         *
         * @param {object} jsonData - the S3JSON recevied from the server
         */
        function SourceMap(jsonData) {

            this.records = {};

            this.map(jsonData);
        }

        // --------------------------------------------------------------------
        /**
         * Produce a map of {tableName: {uuid: item}} from an S3JSON object
         * tree, which can then be used to locate particular import items;
         * stores the map as this.records
         *
         * @param {object} tree - the S3JSON object tree
         */
        SourceMap.prototype.map = function(tree) {

            var records = this.records,
                key,
                tableName,
                recordMap,
                self = this;

            // Helper to add an item to the map
            var addItem = function(item) {
                var uuid = item['@uuid'];
                if (uuid) {
                    this[uuid] = item; // this = recordMap
                    self.map(item);
                }
            };

            for (key in tree) {

                if (key.slice(0, 2) == '$_') {

                    tableName = key.slice(2);
                    recordMap = records[tableName] || {};

                    tree[key].forEach(addItem, recordMap);

                    records[tableName] = recordMap;
                }
            }
        };

        // --------------------------------------------------------------------
        /**
         * Look up an item in the source tree
         *
         * @param {string} tableName - the table name of the item sought
         *                             (can be omitted for type-less uuid search)
         * @param {string} uuid - the UUID of the item sought
         */
        SourceMap.prototype.get = function(tableName, uuid) {

            var records = this.records,
                item;

            if (arguments.length < 2) {
                // Type-less search
                uuid = tableName;
                for (var name in records) {
                    item = records[name][uuid];
                    if (item) {
                        break;
                    }
                }
            } else {
                // Type-bound look-up
                var recordMap = records[tableName];
                if (recordMap) {
                    item = recordMap[uuid];
                }
            }

            return item;
        };

        // ====================================================================
        /**
         * Helper class to decode S3JSON record representations
         *
         * @param {Table} table - the emDB Table
         * @param {object} jsonData - the S3JSON representation of the record
         */
        function Record(table, jsonData) {

            this.data = {};         // {fieldName: value}
            this.references = {};   // {fieldName: [tableName, uuid]}
            this.components = [];   // [[tableName, item, joinby, pkey]]
            this.files = {};        // {fieldName: downloadURL}

            this.tableName = table.name;
            this.uuid = null;

            var key,
                value,
                hooks;

            for (key in jsonData) {

                value = jsonData[key];

                if (key.slice(0, 2) == '$_') {

                    if (hooks === undefined) {
                        hooks = emComponents.getHooks(table);
                    }
                    this.addComponent(table, hooks, key.slice(2), value);

                } else if (key.slice(0, 3) == '$k_') {

                    // Foreign key
                    this.decode(table, key.slice(3), value);

                } else if (key[0] == '@') {

                    // Meta-field
                    var fieldName = key.slice(1);
                    switch(fieldName) {
                        case 'uuid':
                            this.data.uuid = this.uuid = value;
                            break;
                        case 'created_on':
                        case 'modified_on':
                            this.data[fieldName] = parseUTCDateTime(value);
                            break;
                        case 'llrepr':
                            this.data.llrepr = value;
                            break;
                        default:
                            break;
                    }

                } else {

                    // Other field
                    this.decode(table, key, value);
                }
            }

            // If no UUID in the source => generate one now
            if (!this.uuid) {
                this.uuid = emUtils.uuid();
                this.data.uuid = this.uuid;
            }
        }

        // --------------------------------------------------------------------
        /**
         * Convert a field value to internal format, and update
         * this.data|references|files according to field type
         *
         * @param {Table} table - the emDB Table instance
         * @param {string} fieldName - the field name
         * @param {mixed} value - the S3JSON value for the field
         */
        Record.prototype.decode = function(table, fieldName, value) {

            if (value === null) {
                return;
            }

            // Get the field, and fieldType
            var field = table.fields[fieldName];
            if (field === undefined) {
                return;
            }

            var fieldType = field.type;

            // Handle upload fields
            if (fieldType == 'upload') {
                var downloadURL = value['@url'];
                if (downloadURL) {
                    this.files[fieldName] = downloadURL;
                }
                return;
            }

            // Handle references
            var reference = emUtils.getReference(fieldType);
            if (reference) {
                var lookupTable = reference[1],
                    key = reference[2] || 'id',
                    uuid;
                if (lookupTable) {
                    uuid = value['@uuid'];
                    if (uuid) {
                        this.references[fieldName] = [lookupTable, uuid, key];
                    }
                }
                return;
            }

            // Decode @value|$ attributes if present
            if (value.constructor === Object) {
                if (value.hasOwnProperty('@value')) {
                    value = value['@value'];
                } else if (value.hasOwnProperty('$')) {
                    value = value.$;
                } else {
                    // Empty
                    return;
                }
            }

            // Handle all other field types
            switch(fieldType) {
                case 'boolean':
                    if (typeof value == 'string') {
                        value = (value.toLowerCase() == 'true');
                    } else {
                        value = !!value;
                    }
                    this.data[fieldName] = value;
                    break;
                case 'integer':
                    value = parseInt(value);
                    if (!isNaN(value)) {
                        this.data[fieldName] = value;
                    }
                    break;
                case 'double':
                    value = parseFloat(value);
                    if (!isNaN(value)) {
                        this.data[fieldName] = value;
                    }
                    break;
                case 'date':
                    // S3JSON format: YYYY-MM-DD
                    // => date-only in ISO format is assumed to be UTC
                    this.data[fieldName] = new Date(value);
                    break;
                case 'datetime':
                    // S3JSON format: YYYY-MM-DDThh:mm:ss
                    // => must convert to UTC explicitly
                    this.data[fieldName] = parseUTCDateTime(value);
                    break;
                case 'string':
                case 'text':
                    this.data[fieldName] = value + '';
                    break;
                case 'json':
                    // Already parsed (via @value attribute)
                    this.data[fieldName] = value;
                    break;
                case 'list:integer':
                case 'list:string':
                    // Value should be a list
                    if (value.constructor === Array) {
                        this.data[fieldName] = value.map(function(v) {
                            if (v == null || v == undefined) {
                                v = '';
                            }
                            if (fieldType == 'list:integer') {
                                return (v - 0) || null;
                            } else {
                                return '' + v;
                            }
                        });
                    } else {
                        this.data[fieldName] = null;
                    }
                    break;
                default:
                    break;
            }
        };

        // --------------------------------------------------------------------
        /**
         * Register component items for an import item (Record)
         *
         * @param {Table} table - the master table
         * @param {object} hooks - the component hooks of the master table
         *                         (from emComponents.getHooks)
         * @param {string} name - the component table name
         * @param {Array} items - the component items
         */
        Record.prototype.addComponent = function(table, hooks, name, items) {

            // Component or link table
            var defaultAlias = name.slice(name.indexOf('_') + 1) || name,
                unknown = {},
                links = {};

            items.forEach(function(item) {

                var alias = item['@alias'] || defaultAlias;
                if (unknown[alias]) {
                    return;
                }

                var hook = hooks[alias],
                    link,
                    joinby,
                    pkey;

                if (hook) {
                    // Component hook via alias
                    pkey = hook.pkey;
                    if (hook.tableName == name) {
                        joinby = hook.fkey;
                    } else {
                        link = hook.link;
                        if (link && link == name) {
                            joinby = hook.lkey;
                        }
                    }
                } else {
                    // Link table?
                    hook = links[alias];
                    if (hook) {
                        pkey = hook.pkey;
                        joinby = hook.lkey;
                    } else {
                        // Search through all hooks
                        for (var componentAlias in hooks) {
                            hook = hooks[componentAlias];
                            link = hook.link;
                            if (link && link == name) {
                                pkey = hook.pkey;
                                joinby = hook.lkey;
                                break;
                            }
                        }
                        if (joinby) {
                            links[alias] = hook;
                        }
                    }
                }

                if (joinby) {
                    this.components.push([name, item, joinby, pkey]);
                } else {
                    // Items with this alias can not be resolved
                    unknown[alias] = true;
                }
            }, this);
        };

        // --------------------------------------------------------------------
        /**
         * Decorator to produce a function to set the value for a pending
         * reference
         *
         * @param {string} fieldName - the field name of the foreign key
         *
         * @returns {function} - a function to set the value of the
         *                       foreign key and remove the pending
         *                       reference
         */
        Record.prototype.resolveReference = function(fieldName) {

            var self = this;

            return function(value) {
                self.data[fieldName] = value;
                delete self.references[fieldName];
            };
        };

        // ====================================================================
        /**
         * Track references of an import item (Record)
         *
         * @param {object} importMap - the import item map
         * @param {array} dependencies - array of known dependencies,
         *                               format: [[tableName, uuid], ...]
         * @param {Record} record - the Record
         */
        var trackReferences = function(importMap, dependencies, record) {

            var references = record.references,
                dependency,
                tableName,
                uuid;

            for (var fieldName in references) {

                dependency = references[fieldName];

                tableName = dependency[0];
                uuid = dependency[1];

                if (importMap.hasOwnProperty(tableName)) {
                    if (importMap[tableName].hasOwnProperty(uuid)) {
                        continue;
                    }
                }
                dependencies.push(dependency);
            }
        };

        // --------------------------------------------------------------------
        /**
         * Add component items to the import map
         *
         * @param {object} tables - array of known tables
         * @param {object} importMap - the import item map
         * @param {Array} dependencies - array of known dependencies
         * @param {Record} record - the master Record
         */
        var mapComponents = function(tables, importMap, dependencies, record) {

            var components = record.components;

            components.forEach(function(item) {

                // item = [tablename, item, joinby, pkey]

                // Get the component table
                var tableName = item[0],
                    table = tables[tableName];
                if (!table) {
                    return;
                }

                // Create a Record for the item and add it to the map
                var componentRecord = new Record(table, item[1]);
                if (!importMap.hasOwnProperty(tableName)) {
                    importMap[tableName] = {};
                }
                importMap[tableName][componentRecord.uuid] = componentRecord;

                // Map the component record's dependencies
                trackReferences(importMap, dependencies, componentRecord);

                // mapComponents for the component record?
                // (Server doesn't currently export components of components)

                var masterTableName = record.tableName,
                    pkey = item[3];

                // Super-component? => use em_object as parent entity
                if (pkey != 'id') {
                    var masterTable = tables[masterTableName],
                        field = masterTable.$(pkey);
                    if (field.name == 'em_object_id') {
                        masterTableName = 'em_object';
                        pkey = 'id';
                    }
                }

                // Add parent reference
                componentRecord.references[item[2]] = [
                    masterTableName,
                    record.uuid,
                    pkey
                ];
            });
        };

        // --------------------------------------------------------------------
        /**
         * Map an in-source dependency: if a referenced item is present in the
         * object tree, then add it to the import map
         *
         * @param {object} tables - array of known tables, format:
         *                          {tableName: Table}
         * @param {SourceMap} sourceMap - accessor for the object tree
         * @param {object} importMap - the import item map, format:
         *                             {tableName: {uuid: Record}}
         * @param {array} dependencies - array of known dependencies,
         *                               format: [[tableName, uuid], ...]
         * @param {array} dependency - the dependency to resolve, format:
         *                             [tableName, uuid]
         */
        var mapDependency = function(tables, sourceMap, importMap, dependencies, dependency) {

            var tableName = dependency[0],
                uuid = dependency[1],
                tableImportMap = importMap[tableName];

            if (tableImportMap && tableImportMap.hasOwnProperty(uuid)) {
                // Already scheduled for import
                return;
            }

            var item = sourceMap.get(tableName, uuid);
            if (item) {
                // Generate a Record
                var table = tables[tableName],
                    record = new Record(table, item);

                // Add it to the map
                if (!tableImportMap) {
                    tableImportMap = {};
                }
                tableImportMap[record.uuid] = record;
                importMap[tableName] = tableImportMap;

                // Track references of the record
                trackReferences(importMap, dependencies, record);
            }
        };

        // --------------------------------------------------------------------
        /**
         * Decode an S3JSON object tree and produce a map of import items
         *
         * @param {object} tables - array of known tables, format:
         *                          {tableName: Table}
         * @param {string} tableName - the name of the target table
         * @param {object} data - the S3JSON object tree
         *
         * @returns {object} - a map of import items (Records), format:
         *                     {tableName: {uuid: Record, ...}, ...}
         */
        var decode = function(tables, tableName, data) {

            var importMap = {},
                dependencies = [];

            var key = '$_' + tableName,
                items = data[key],
                table = tables[tableName];

            if (items) {

                importMap[tableName] = {};

                items.forEach(function(item) {

                    var record = new Record(table, item);
                    importMap[tableName][record.uuid] = record;

                    trackReferences(importMap, dependencies, record);

                    mapComponents(tables, importMap, dependencies, record);
                });
            }

            var sourceMap = new SourceMap(data);
            while(dependencies.length) {
                mapDependency(tables,
                              sourceMap,
                              importMap,
                              dependencies,
                              dependencies.shift());
            }

            return importMap;
        };

        // ====================================================================
        /**
         * Encode a record as S3JSON object
         *
         * @param {Table} table - the Table
         * @param {object} record - the record data
         * @param {Array} fields - names of the fields to include in the
         *                         export (optional, default: all available
         *                         properties of the record)
         *
         * @returns {object} - the S3JSON data and its references, format:
         *                          {data: {key: value},
         *                           references: {fieldName: [tableName, recordID]},
         *                           files: {fieldName: fileURI}
         *                           }
         */
        var encodeRecord = function(table, record, fields) {

            var data = {},
                references = {},
                files = {},
                field,
                fieldType,
                value;

            if (!fields) {
                fields = Object.keys(record);
            }

            fields.forEach(function(fieldName) {

                field = table.fields[fieldName];
                if (!field) {
                    return;
                }

                // Handle null-values
                value = record[fieldName];
                if (value === undefined || value === null) {
                    return;
                }

                // Handle meta-fields
                if (field.meta) {
                    switch(fieldName) {
                        case 'uuid':
                            data['@uuid'] = value;
                            break;
                        case 'created_on':
                        case 'modified_on':
                            data['@' + fieldName] = field.format(value);
                            break;
                        default:
                            // Skip all other meta-fields
                            break;
                    }
                    return;
                }

                fieldType = field.type;

                // Handle upload-fields
                if (fieldType == 'upload') {
                    files[fieldName] = value;
                    return;
                }

                // Handle references
                var reference = emUtils.getReference(fieldType);
                if (reference) {
                    var lookupTable = reference[1];
                    references[fieldName] = [lookupTable, value];
                    return;
                }

                // Handle all other field types
                switch(fieldType) {
                    case 'boolean':
                        if (!!value) {
                            data[fieldName] = {'@value': 'true'};
                        } else {
                            data[fieldName] = {'@value': 'false'};
                        }
                        break;
                    case 'integer':
                    case 'double':
                        data[fieldName] = {'@value': value + ''};
                        break;
                    case 'date':
                    case 'datetime':
                        data[fieldName] = field.format(value);
                        break;
                    case 'string':
                    case 'text':
                        data[fieldName] = value;
                        break;
                    case 'json':
                        data[fieldName] = JSON.stringify(value);
                        break;
                    case 'list:integer':
                    case 'list:string':
                        data[fieldName] = {'@value': value};
                        break;
                    default:
                        // Ignore
                        break;
                }
            });

            return {
                data: data,
                references: references,
                files: files
            };
        };

        // ====================================================================
        /**
         * Add a reference to an S3JSON object
         *
         * @param {object} data - the S3JSON object
         * @param {string} fieldName - the field name
         * @param {string} tableName - the look-up table name
         * @param {string} uuid - the uuid of the referenced record
         */
        var addReference = function(data, fieldName, tableName, uuid) {

            if (uuid) {
                data['$k_' + fieldName] = {
                    '@resource': tableName,
                    '@uuid': uuid
                };
            }
        };

        // ====================================================================
        /**
         * Add a file reference to an S3JSON object
         *
         * @param {object} data - the S3JSON object
         * @param {string} fieldName - the field name
         * @param {string} fileName - the file name
         */
        var addFile = function(data, fieldName, fileName) {

            if (fileName) {
                data[fieldName] = {
                    '@filename': fileName
                };
            }
        };

        // ====================================================================
        /**
         * Encode resource data as S3JSON
         *
         * @param {string} tableName - the table name
         * @param {object} data - the S3JSON records for this table
         */
        var encode = function(tableName, data) {

            var jsonData = {};

            jsonData['$_' + tableName] = data;

            return jsonData;
        };

        // ====================================================================
        /**
         * Service API
         */
        return {

            // S3JSON decoder
            decode: decode,

            // S3JSON encoder
            encode: encode,
            encodeRecord: encodeRecord,
            addReference: addReference,
            addFile: addFile
        };
    }
]);
