/**
 * Sahana Eden Mobile - Schema Import (SyncTask)
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

EdenMobile.factory('SchemaImport', [
    '$q', 'emResources', 'emUtils', 'SyncTask',
    function ($q, emResources, emUtils, SyncTask) {

        "use strict";

        /**
         * SyncTask to
         * - import a table schema
         *
         * @param {string} tableName - the name of the table to install
         * @param {object} schemaData - the schema data from the Sahana
         *                              server for the table
         * @param {boolean} lookup - whether this is an implicit import
         *                           of a look-up table schema
         */
        var SchemaImport = SyncTask.define(function(tableName, schemaData, lookup) {

            this.tableName = tableName;
            this.lookup = !!lookup;

            // The name of the table this task will import
            this.provides = tableName;

            // The names of the tables this task requires
            this.requires = [];

            // Decode the schemaData
            var importData = this.decode(schemaData),
                dependencies = [];

            this.schema = importData.schema;
            this.data = importData.data;

            this.dataImports = null;
            this.filesRequired = null;

            // Collect dependencies
            if (importData.schema) {
                var run = this.run;
                this.requires.forEach(function(requirement) {
                    dependencies.push(run.require(requirement));
                });
            }
            this.dependencies = dependencies;
        });

        // --------------------------------------------------------------------
        /**
         * Execute this schema import (async); installs or updates
         * the Resource, also installing or updating the database
         * table as necessary
         */
        SchemaImport.prototype.execute = function() {

            console.log('Execute SchemaImport for ' + this.tableName);

            // Collect the promises for all acquired dependencies
            var dependencies = this.dependencies,
                resolved = [];

            dependencies.forEach(function(dependency) {
                resolved.push(dependency.resolved());
            });

            var self = this,
                run = this.run;
            $q.all(resolved).then(
                function() {
                    // all dependencies resolved => go ahead
                    console.log('Importing schema for ' + self.tableName);
                    emResources.install(self.tableName, self.schema).then(
                        function() {
                            // Schema installation successful

                            if (self.lookup && self.data) {

                                // Create data import tasks for look-up data
                                run.createDataImports(self.job, self.tableName, self.data).then(
                                    function(result) {
                                        self.dataImports = result[0];
                                        self.filesRequired = result[1];
                                        self.resolve(self.tableName);
                                    });

                            } else {

                                self.resolve(self.tableName);
                            }
                        },
                        function(error) {
                            // Schema installation failed
                            self.reject(error);
                        });
                },
                function(error) {
                    // A dependency failed
                    self.reject(error);
                });
        };

        // --------------------------------------------------------------------
        /**
         * Convert Sahana schema data to internal format
         *
         * @param {object} schemaData - the schema data received from
         *                              the Sahana server
         *
         * @returns {object} - the schema specification in
         *                     internal format
         */
        SchemaImport.prototype.decode = function(schemaData) {

            var job = this.job,
                requires = this.requires;

            var schema = {},
                data = null,
                fieldName,
                fieldSpec,
                fieldType,
                reference,
                lookupTable;

            // Field specs
            var fieldDescriptions = schemaData.schema;
            for (fieldName in fieldDescriptions) {

                // Decode field description and add spec to schema
                fieldSpec = this.decodeField(fieldDescriptions[fieldName]);
                if (!!fieldSpec) {
                    schema[fieldName] = fieldSpec;
                }

                // Add look-up table to requires if foreign key
                fieldType = fieldSpec.type;
                reference = emUtils.getReference(fieldType);
                if (reference) {
                    lookupTable = reference[1];
                    if (lookupTable && requires.indexOf(lookupTable) == -1) {
                        requires.push(lookupTable);
                    }
                }
            }

            // Settings
            var jsonOpts = schemaData.settings,
                key,
                value;
            if (jsonOpts) {
                for (key in jsonOpts) {
                    value = jsonOpts[key];
                    if (value) {
                        schema['_' + key] = value;
                    }
                }
            }

            // Other schema options
            // @todo: component declarations, data card format...
            var schemaOptions = [
                "form",
                "subheadings",
                "strings",
                "types"
            ];

            schemaOptions.forEach(function(key) {
                value = schemaData[key];
                if (value) {
                    schema['_' + key] = value;
                }
            });

            if (this.provides == job.tableName) {

                // Main schema
                schema._main = true;
                schema._name = job.resourceName;

                // Store link to server resource
                var ref = job.ref;
                schema._controller = schemaData.controller || ref.c;
                schema._function = schemaData.function || ref.f;

            } else {

                // Reference or component schema => name after table
                schema._name = this.provides;

                // Do we have any look-up records to import?
                if (this.lookup && schemaData.hasOwnProperty('data')) {
                    data = schemaData.data;
                }
            }

            return {
                schema: schema,
                data: data
            };
        };

        // --------------------------------------------------------------------
        /**
         * Convert a Sahana field description to internal format
         *
         * @param {object} FieldDescription - the field description from
         *                                    the Sahana server
         *
         * @returns {object} - the field specification in internal format
         */
        SchemaImport.prototype.decodeField = function(fieldDescription) {

            var spec = {
                type: fieldDescription.type || 'string',
            };

            for (var keyword in fieldDescription) {

                // Translate server-side keywords into keys used internally
                var key = keyword;
                switch(keyword) {
                    case 'default':
                        key = 'defaultValue';
                        break;
                    default:
                        break;
                }

                // Add to field spec
                spec[key] = fieldDescription[keyword];
            }

            return spec;
        };

        // ====================================================================
        // Return the constructor
        //
        return SchemaImport;
    }
]);
