/**
 * Sahana Eden Mobile - Database Tables
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

EdenMobile.factory('Table', [
    '$q', 'emComponents', 'emDefaultSchema', 'emFiles', 'Expression', 'Field',  'Set',
    function ($q, emComponents, emDefaultSchema, emFiles, Expression, Field, Set) {

        "use strict";

        // ====================================================================
        /**
         * Table constructor
         *
         * @param {Database} db - the database
         * @param {string} name - the tablename
         * @param {object} fields - the fields {fieldName: Field, ...}
         * @param {object} settings - the table settings {key: value}
         */
        function Table(db, tableName, fields, settings) {

            this._db = db;
            this.name = tableName;

            if (!settings) {
                settings = {};
            }

            var field,
                fieldName,
                tableFields = {},
                lookupOnly = true;

            for (fieldName in fields) {
                field = fields[fieldName];
                if (field.table) {
                    field = field.clone();
                }
                field.table = this;
                if (!field.meta) {
                    lookupOnly = false;
                }
                tableFields[fieldName] = field;
            }

            this.fields = tableFields;
            this.lookupOnly = lookupOnly;
            this.settings = settings;

            this.objectTypes = settings.types || {};

            this.resources = {};
        }

        // --------------------------------------------------------------------
        /**
         * Access a Field in this table; maps valid object IDs to em_object_id
         *
         * @param {string} fieldName - the field name
         *
         * @returns {Field} - the Field, or undefined if no field with this
         *                    name is defined in the table
         */
        Table.prototype.$ = function(fieldName) {

            var field = this.fields[fieldName];

            if (!field && Object.values(this.objectTypes).indexOf(fieldName) != -1) {
                field = this.fields.em_object_id;
            }

            return field;
        };

        // --------------------------------------------------------------------
        /**
         * Construct a WHERE expression (assertion) from raw SQL
         *
         * @param {string} sqlStr - the SQL WHERE expression as string
         *
         * @returns {Expression} - an Expression with exprType 'assert'
         */
        Table.prototype.sqlAssert = function(sqlStr) {

            return new Expression('assert', sqlStr, 'sql');
        };

        // --------------------------------------------------------------------
        /**
         * Get a string representation for this table
         *
         * @returns {string} - a string representation for this table
         */
        Table.prototype.toString = function() {

            return this.name;
        };

        // --------------------------------------------------------------------
        /**
         * Get the SQL identifier of this table (for use in SQL statements)
         *
         * @returns {string} - the SQL identifier
         */
        Table.prototype.toSQL = function() {

            var original = this._original,
                sql;

            if (original) {
                sql = original.name + ' AS "' + this.name + '"';
            } else {
                sql = this.name;
            }
            return sql;
        };

        // --------------------------------------------------------------------
        /**
         * Get an aliased clone of the table
         *
         * @param {string} alias - the table alias
         *
         * @returns {Table} - the aliased clone of the table
         */
        Table.prototype.as = function(alias) {

            var aliased = new Table(this._db, alias, this.fields, this.settings);

            aliased._original = this;

            return aliased;
        };

        // --------------------------------------------------------------------
        /**
         * Create a join expression
         *
         * @param {Expression} expr - the assertion for the join
         *
         * @returns {Expression} - the join expression
         *
         * @example
         *  table.on(table.$('key').equals(otherTable.$('key')))
         */
        Table.prototype.on = function(expr) {

            if (expr.exprType != 'assert') {
                throw new Error('invalid join expression');
            }
            return new Expression('join', this, 'on', expr);
        };

        // --------------------------------------------------------------------
        /**
         * Create a Set from this table
         *
         * @param {Expression} expr - the filter query (WHERE) for the Set
         *
         * @returns {Set} - the Set
         *
         * @example
         *  table.where(query)
         *       .select([field1, field2], callback);
         */
        Table.prototype.where = function(expr) {

            return new Set(this).where(expr);
        };

        // --------------------------------------------------------------------
        /**
         * Create a Set with an inner join
         *
         * @param {Expression} expr - the join expression
         *
         * @returns {Set} - the Set
         *
         * @example
         *  table.join(otherTable.on(assertion))
         *       .where(query)
         *       .select([field1, field2], callback);
         */
        Table.prototype.join = function(expr) {

            return new Set(this).join(expr);
        };

        // --------------------------------------------------------------------
        /**
         * Create a Set with a left join
         *
         * @param {Expression} expr - the join expression
         *
         * @returns {Set} - the Set
         *
         * @example
         *  table.left(otherTable.on(assertion))
         *       .where(query)
         *       .select([field1, field2], callback);
         */
        Table.prototype.left = function(expr) {

            return new Set(this).left(expr);
        };

        // --------------------------------------------------------------------
        /**
         * Get the object type name for an object type key
         *
         * @param {string} key - the object type key
         *
         * @returns {string} - the object type name
         *
         * @example
         *  table.getObjectType('pe_id'); // returns 'pr_pentity'
         */
        Table.prototype.getObjectType = function(key) {

            var objectType,
                objectTypes = this.objectTypes;

            for (var name in objectTypes) {
                if (objectTypes[name] == key) {
                    objectType = name;
                    break;
                }
            }

            return objectType;
        };

        // --------------------------------------------------------------------
        /**
         * Find an object key that matches the objectID of another table,
         * e.g. to resolve objectID-based free joins in field selectors
         *
         * @param {Table} table - the other table
         * @param {string} typeKey - the object type key (e.g. 'pe_id')
         *
         * @returns {Field} - the object key, or undefined if not found
         *
         * @note: can be ambiguous if multiple object keys exist
         */
        Table.prototype.getObjectKey = function(table, typeKey) {

            var fields = this.fields,
                field,
                refType,
                objectTypes = table.objectTypes,
                objectKey;

            if (typeKey) {
                field = fields[typeKey];
                if (field) {
                    refType = field.isObjectKey && field.refType;
                    if (refType && objectTypes.hasOwnProperty(refType[0])) {
                        objectKey = field;
                    }
                }
            }

            if (!objectKey) {
                for (var fieldName in fields) {
                    field = fields[fieldName];
                    refType = field.isObjectKey && field.refType;
                    if (refType && objectTypes.hasOwnProperty(refType[0])) {
                        objectKey = field;
                        break;
                    }
                }
            }

            return objectKey;
        };

        // --------------------------------------------------------------------
        /**
         * Delete all object keys for this table
         *
         * @note: never run this while there are still records in the table!
         */
        Table.prototype._deleteObjectKeys = function() {

            var db = this._db,
                objectKeyTable = db.tables.em_object;

            objectKeyTable
                .where(objectKeyTable.$('tablename').is(this.name))
                .delete();
        };

        // --------------------------------------------------------------------
        /**
         * Get a Resource for this Table; e.g. to resolve component aliases
         *
         * @param {string} name - the resource name (optional), if omitted,
         *                        the default resource will be returned, or,
         *                        if no default resource exists, an arbitrary
         *                        resource
         *
         * @returns {Resource} - the resource (undefined if not found)
         */
        Table.prototype.getResource = function(name) {

            var resources = this.resources,
                resource;

            if (name) {
                resource = resources[name];
            } else {
                resource = resources[this.name];
                if (!resource) {
                    name = Object.keys(resources)[0];
                    if (name) {
                        resource = resources[name];
                    }
                }
            }

            return resource;
        };

        // --------------------------------------------------------------------
        /**
         * Check if a resource is the default or only resource of this table;
         * usually used to determine whether a configuration change should be
         * propagated to the table schema
         *
         * @param {string} resourceName - the resource name
         *
         * @returns {boolean} - true if default/only resource
         */
        Table.prototype.isDefaultResource = function(resourceName) {

            var resources = this.resources,
                isDefault = false;

            if (resourceName && resources.hasOwnProperty(resourceName)) {
                if (resourceName == this.name || Object.keys(resources).length == 1) {
                    isDefault = true;
                }
            }
            return isDefault;
        };

        // --------------------------------------------------------------------
        /**
         * Add the standard meta fields to this table (as defined in emDefaultSchema)
         */
        Table.prototype.addMetaFields = function() {

            var tableName = this.name,
                fields = this.fields;

            if (tableName != 'em_version' && !fields.hasOwnProperty('id')) {
                fields.id = new Field(this, 'id', {
                    type: 'id',
                    readable: false,
                    writable: false
                }, true);
            }

            var metaFields = emDefaultSchema.metaFields,
                field;
            if (metaFields && tableName.slice(0, 3) != 'em_') {
                for (var fieldName in metaFields) {
                    if (!fields.hasOwnProperty(fieldName)) {
                        field = new Field(this, fieldName, metaFields[fieldName], true);
                        fields[fieldName] = field;
                    }
                }
            }
        };

        // --------------------------------------------------------------------
        /**
         * Construct an SQL statement to create this table
         *
         * @returns {string} - the SQL statement
         */
        Table.prototype._create = function() {

            var sql = ['CREATE TABLE IF NOT EXISTS "' + this.name + '"'];

            var fields = this.fields,
                fieldName,
                fieldDesc,
                columns = [],
                column,
                constraints = [],
                constraint;

            for (fieldName in fields) {

                fieldDesc = fields[fieldName].sqlDescribe();
                column = fieldDesc.column;
                if (column) {
                    columns.push(column);
                    constraint = fieldDesc.constraint;
                    if (constraint) {
                        constraints.push(constraint);
                    }
                }
            }

            sql.push('(' + columns.concat(constraints).join(',') + ')');

            return sql.join(' ');
        };

        // --------------------------------------------------------------------
        /**
         * Construct an SQL statement to drop this table
         *
         * @returns {string} - the SQL statement
         */
        Table.prototype._drop = function() {

            return 'DROP TABLE IF EXISTS "' + this.name + '"';
        };

        // --------------------------------------------------------------------
        /**
         * Remove this table from the database, including any related files,
         * object keys and the schema
         *
         * @returns {promise} - a promise that is resolved when the process
         *                      was successful, or rejected otherwise
         */
        Table.prototype.drop = function() {

            // Cannot drop from clone
            if (this._original) {
                return $q.reject('trying to drop table from clone');
            }

            // Do not drop system tables
            if (this.name.slice(0, 3) == 'em_') {
                return $q.reject('cannot drop system tables');
            }

            // Do not drop tables with active resources
            var resources = this.resources;
            for (var resourceName in resources) {
                if (resourceName != this.name || resources[resourceName].main) {
                    return $q.reject('table has active resources');
                }
            }

            // Do not drop tables subject to foreign key constraints
            var db = this._db,
                tableName = this.name;
            for (var tn in db.tables) {
                if (tn == tableName) {
                    continue;
                }
                var table = db.tables[tn];
                for (var fn in table.fields) {
                    var field = table.fields[fn],
                        fk = field.getForeignKey();
                    if (fk && fk.table == tableName) {
                        return $q.reject('table is referenced by other table');
                    }
                }
            }

            // Do not drop tables that may still be required as components/linktables
            if (emComponents.hasParent(tableName)) {
                return $q.reject('table is still requires as component/link');
            }

            var self = this;
            return emComponents.removeHooks(this).then(function() {
                self.removeSchema().then(function() {
                    self.getFiles().then(function(orphanedFiles) {
                        var deferred = $q.defer();
                        db._adapter.executeSql(self._drop(), [],
                            function(/* result */) {
                                emFiles.removeAll(orphanedFiles);
                                self._deleteObjectKeys();
                                delete db.tables[tableName];
                                deferred.resolve();
                            },
                            function(error) {
                                db.sqlError(error);
                            });
                        return deferred.promise;
                    });
                });
            });
        };

        // --------------------------------------------------------------------
        /**
         * Create this table in the database
         *
         * @param {Array} records - Array of records to populate the table with
         * @param {function} callback - callback function: function(tableName)
         */
        Table.prototype.create = function(records, callback) {

            var db = this._db,
                adapter = db._adapter,
                sql = [this._drop(), this._create()],
                self = this;

            if (this._original) {
                // Trying to create from clone
                throw new Error('Table.create must be called for original table');
            }

            adapter.sqlBatch(sql, function() {

                var tableName = self.name;
                db.tables[tableName] = self;

                if (tableName == 'em_schema') {
                    // Save all existing schemas
                    for (tableName in db.tables) {
                        db.tables[tableName].saveSchema();
                    }
                } else {
                    // Save this schema
                    self.saveSchema();
                }

                // Populate with records
                self.populate(records, callback);

            }, db.sqlError);
        };

        // --------------------------------------------------------------------
        /**
         * Populate this table with records
         *
         * @param {Array} records - Array of records to populate the table with
         * @param {function} onSuccess - success callback: function(tableName)
         * @param {function} onError - error callback: function(error)
         */
        Table.prototype.populate = function(records, onSuccess, onError) {

            var tableName = this.name;

            if (this._original) {
                // Trying to populate clone
                throw new Error('Table.populate must be called for original table');
            }

            if (!records || !records.length) {
                if (onSuccess) {
                    onSuccess(tableName);
                    return;
                }
            }

            var self = this,
                insertRecord = function(tx, record) {
                    var sql = self._insert(record);
                    if (sql) {
                        tx.executeSql(sql[0], sql[1]);
                    }
                };

            var db = this._db,
                adapter = db._adapter,
                fields = this.fields,
                createObjects = !!(fields.uuid && fields.em_object_id);

            adapter.transaction(
                function(tx) {
                    records.forEach(function(data) {
                        var record = self.addDefaults(data, false, false);
                        if (createObjects) {
                            var sql = db.tables.em_object._insert({
                                tablename: self.name,
                                uuid: record.uuid
                            });
                            tx.executeSql(sql[0], sql[1], function(tx, result) {
                                record.em_object_id = result.insertId;
                                insertRecord(tx, record);
                            });
                        } else {
                            insertRecord(tx, record);
                        }
                    });
                },
                function(error) {
                    if (onError) {
                        onError(error);
                    } else {
                        db.sqlError(error);
                    }
                },
                function() {
                    if (onSuccess) {
                        onSuccess(tableName);
                    }
                });
        };

        // --------------------------------------------------------------------
        /**
         * Save the schema for this table in the schema table (em_schema)
         */
        Table.prototype.saveSchema = function() {

            var db = this._db;

            if (this._original) {
                // Trying to write schema of clone
                throw new Error('Table.saveSchema must be called for original table');
            }

            var schemaTable = db.tables.em_schema;
            if (schemaTable === undefined) {
                return;
            }

            var self = this;
            $q.when(this.schemaSaved).then(function() {

                var schemaSaved = $q.defer();
                self.schemaSaved = schemaSaved.promise;

                var fields = self.fields,
                    fieldName,
                    field,
                    fieldDef = {},
                    settings = self.settings;

                for (fieldName in fields) {
                    field = fields[fieldName];
                    if (!field.meta) {
                        fieldDef[fieldName] = field.description();
                    }
                }

                var schema = {
                    name: self.name,
                    fields: fieldDef,
                    settings: settings
                };

                var dbSet = schemaTable.where(schemaTable.$('name').equals(self.name));
                dbSet.select(['id'], {limit: 1}, function(rows) {
                    if (rows.length) {
                        dbSet.update(schema, function() {
                            schemaSaved.resolve();
                        });
                    } else {
                        schemaTable.insert(schema, function() {
                            schemaSaved.resolve();
                        });
                    }
                });
            });
        };

        // --------------------------------------------------------------------
        /**
         * Remove the schema for this table from the database
         *
         * @returns {promise} - a promise that is resolved when the schema
         *                      has been removed
         */
        Table.prototype.removeSchema = function() {

            var deferred = $q.defer(),
                db = this._db;

            if (this._original) {
                // Trying to remove schema of clone
                deferred.reject('Table.removeSchema must be called for original table');
            }

            var schemaTable = db.tables.em_schema;
            if (schemaTable === undefined) {
                deferred.reject('No schema table');
            }

            var widgetImages = this.getWidgetImages(),
                dbSet = schemaTable.where(schemaTable.$('name').equals(this.name));
            dbSet.delete(
                function() {
                    if (widgetImages && widgetImages.length) {
                        emFiles.removeAll(widgetImages);
                    }
                    deferred.resolve();
                },
                function(error) {
                    deferred.reject(error);
                });

            return deferred.promise;
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
        Table.prototype.addDefaults = function(data, visible, update) {

            var fields = this.fields,
                record = {},
                field,
                defaultValue;

            for (var fieldName in fields) {

                field = fields[fieldName];
                if (!data.hasOwnProperty(fieldName)) {
                    if (visible && !field.readable) {
                        continue;
                    }
                    if (update) {
                        defaultValue = field.updateValue;
                    } else {
                        defaultValue = field.defaultValue;
                    }
                    if (typeof defaultValue == 'function') {
                        defaultValue = defaultValue();
                    }
                    if (defaultValue !== undefined) {
                        record[fieldName] = defaultValue;
                    }
                }
            }
            return angular.extend(record, data);
        };

        // --------------------------------------------------------------------
        /**
         * Construct SQL to insert a record into the table
         *
         * @param {object} data - the data to insert, object with properties
         *                        {fieldName: value}
         *
         * @returns {string} - the SQL statement to insert the record
         */
        Table.prototype._insert = function(data) {

            var quoted = function(name) { return '"' + name + '"'; };

            var fields = this.fields,
                fieldName,
                field,
                sqlValue,
                cols = [],
                values = [];

            // Collect and encode data
            for (fieldName in data) {
                if (fieldName[0] == '_') {
                    // Processing instruction => skip
                    continue;
                }
                field = fields[fieldName];
                if (field) {
                    sqlValue = field.encode(data[fieldName]);
                    if (sqlValue !== undefined) {
                        cols.push(quoted(field.name));
                        values.push(sqlValue);
                    }
                }
            }

            var tableName = this.name;
            if (this._original) {
                // Always use the original table
                tableName = this._original.name;
            }

            // Construct SQL statement
            var placeholders = cols.map(function() { return '?'; }).join(','),
                sql = [
                    'INSERT INTO ' + quoted(tableName),
                    '(' + cols.join(',') + ')',
                    'VALUES (' + placeholders + ')'
                ];

            return [sql.join(' '), values];
        };

        // --------------------------------------------------------------------
        /**
         * Insert a new record into this table
         *
         * @param {object} data - the record data {fieldName: value}
         * @param {function} onSuccess - success callback, function(insertId)
         * @param {function} onError - error callback, function(error)
         */
        Table.prototype.insert = function(data, onSuccess, onError) {

            var record = this.addDefaults(data, false, false),
                db = this._db,
                adapter = db._adapter,
                fields = this.fields,
                self = this;

            var insertRecord = function(tx, record) {
                var sql = self._insert(record);
                if (!sql) {
                    tx.abort('no data');
                } else {
                    tx.executeSql(sql[0], sql[1], function(tx, result) {
                        if (onSuccess) {
                            onSuccess(result.insertId);
                        }
                    });
                }
            };

            adapter.transaction(
                function(tx) {
                    if (fields.uuid && fields.em_object_id) {
                        var sql = db.tables.em_object._insert({
                            tablename: self.name,
                            uuid: record.uuid
                        });
                        tx.executeSql(sql[0], sql[1], function(tx, result) {
                            record.em_object_id = result.insertId;
                            insertRecord(tx, record);
                        });
                    } else {
                        insertRecord(tx, record);
                    }
                },
                function(error) {
                    if (onError) {
                        onError(error);
                    } else {
                        db.sqlError(error);
                    }
                });
        };

        // --------------------------------------------------------------------
        /**
         * Update all records in this Table (see Set.update)
         *
         * @param {object} data - the data {fieldName: value, ...}
         * @param {object} options - the options {key: value, ...}
         * @property {bool} options.noDefaults - do not add update-defaults
         * @param {function} onSuccess - the success callback, receives
         *                               the number of updated rows as argument
         * @param {Function} onError - the error callback, receives the error
         *                             message as argument
         */
        Table.prototype.update = function(data, options, onSuccess, onError) {

            new Set(this).update(data, options, onSuccess, onError);
        };

        // --------------------------------------------------------------------
        /**
         * Select records from this table (see Set.select)
         *
         * @param {Array} columns - array of column expressions, can be
         *                          omitted (defaults to all fields in the
         *                          table)
         * @param {object} options - an object with query options (orderby,
         *                           limitby, etc), can be omitted
         * @param {function} onSuccess - success callback, required
         * @param {function} onError - error callback, optional
         */
        Table.prototype.select = function(fields, options, onSuccess, onError) {

           (new Set(this)).select(fields, options, onSuccess, onError);
        };

        // --------------------------------------------------------------------
        /**
         * Get all files linked to records in this table
         *
         * @param {Expression|string} query - the filter Expression
         *
         * @returns {promise} - a promise that resolves into an Array of
         *                      all file URIs linked to the selected records
         */
        Table.prototype.getFiles = function(query) {

            var deferred = $q.defer(),
                uploadFields = [],
                fields = Object.values(this.fields);

            fields.forEach(function(field) {
                if (field.type == 'upload') {
                    uploadFields.push(field);
                }
            });

            var files = [];

            if (uploadFields.length) {

                this.where(query).select(uploadFields, function(rows) {
                    rows.forEach(function(row) {
                        uploadFields.forEach(function(field) {
                            var fileURI = row.$(field);
                            if (fileURI) {
                                files.push(fileURI);
                            }
                        });
                    });

                    deferred.resolve(files);
                });
            } else {
                deferred.resolve(files);
            }

            return deferred.promise;
        };

        // --------------------------------------------------------------------
        /**
         * Get the file URIs of all widget images in this table
         *
         * @returns {Array} - an array of file URIs
         */
        Table.prototype.getWidgetImages = function() {

            var fields = this.fields,
                images = [];

            for (var fieldName in fields) {
                var field = fields[fieldName],
                    fieldDescription = field._description,
                    fieldSettings = fieldDescription.settings || {},
                    imageConfig = fieldSettings.image || fieldSettings.pipeImage;

                if (imageConfig) {
                    var imageURI = imageConfig.file;
                    if (imageURI) {
                        images.push(imageURI);
                    }
                }
            }

            return images;
        };

        // --------------------------------------------------------------------
        /**
         * Identify a record from a data fragment
         *
         * @param {object} fragment - the available record data as object
         *                            with {fieldName: value} properties
         *
         * @example
         *  table.identify(fragment).then(function(record){ });
         *
         * @returns {promise} - a promise that resolves into the record,
         *                      including record ID, synchronized_on and
         *                      modified_on timestamps as well as all
         *                      upload fields
         */
        Table.prototype.identify = function(fragment) {

            var deferred = $q.defer(),
                uuid = fragment.uuid,
                uuidField = this.$('uuid');

            if (uuid && uuidField) {

                // Try looking up the record from the UUID

                var allFields = this.fields,
                    fields = ['id', 'synchronized_on', 'modified_on'];
                for (var fieldName in allFields) {
                    if (allFields[fieldName].type == "upload") {
                        fields.push(fieldName);
                    }
                }

                // Find the record
                this.where(uuidField.equals(uuid))
                    .select(fields, {limit: 1}, function(records) {
                    if (records.length) {
                        deferred.resolve(records[0]._());
                    } else {
                        deferred.resolve();
                    }
                });

            } else {
                // No way to identify the record (yet)
                // @todo: try unique fields
                deferred.resolve();
            }

            return deferred.promise;
        };

        // --------------------------------------------------------------------
        /**
         * Count the records in this table (see Set.count)
         *
         * @param {object} options - an object with query options (orderby,
         *                           limitby, etc), can be omitted
         * @param {function} onSuccess - success callback, required
         * @param {function} onError - error callback, optional
         */
        Table.prototype.count = function(options, onSuccess, onError) {

            return new Set(this).count(options, onSuccess, onError);
        };

        // ====================================================================
        // Return prototype
        //
        return Table;
    }
]);

// END ========================================================================
