/**
 * Sahana Eden Mobile - Schema Download (SyncTask)
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

EdenMobile.factory('SchemaDownload', [
    'emResources', 'emServer', 'SchemaImport', 'SyncTask',
    function (emResources, emServer, SchemaImport, SyncTask) {

        "use strict";

        /**
         * Sync Task to:
         * - download a mobile form from the server
         * - generate an array of SchemaImport tasks for it
         */
        var SchemaDownload = SyncTask.define();

        // --------------------------------------------------------------------
        /**
         * Execute the form download
         */
        SchemaDownload.prototype.execute = function() {

            var job = this.job,
                self = this;

            var msince = null;
            emResources.open(job.resourceName).then(function(resource) {

                if (resource !== undefined) {
                    // Existing resource => apply schemaDate for msince
                    msince = resource.getSchemaDate();
                }
                self.download(msince);

            }).catch(function(e) {
                self.reject(e);
            });
        };

        // --------------------------------------------------------------------
        /**
         * Download the form; parses the form data and creates SchemaImport
         * tasks for both the main schema and any dependencies of the main
         * schema if available in the form data.
         */
        SchemaDownload.prototype.download = function(msince) {

            var job = this.job,
                ref = job.ref,
                self = this;

            // Apply msince
            if (msince) {
                if (!ref.v) {
                    ref.v = {};
                }
                ref.v.msince = msince.toISOString().split('.')[0];
            }

            console.log('Downloading ' + ref.c + '/' + ref.f);

            emServer.getForm(ref,
                function(data) {

                    var schemaImports = [],
                        main = data.main;

                    // Create a schema import task for the main schema
                    var tableName = main.tablename,
                        schemaImport = new SchemaImport(job, tableName, main),
                        provided = [tableName];

                    // Capture dependencies of the main schema
                    var requirements = schemaImport.requires.slice(0),
                        addRequirement = function(name) {
                        if (provided.indexOf(name) == -1) {
                            requirements.push(name);
                        }
                    };

                    // Create schema import tasks for component schemas
                    // and register components in the main schema
                    var components = data.components,
                        alias,
                        description,
                        componentTableName,
                        componentImport,
                        componentImports = [];

                    if (components) {
                        console.log(components);

                        for (alias in components) {
                            description = components[alias];
                            componentTableName = description.table;

                            // If we have no import task for the component schema
                            // yet, and we have a schema available:
                            if (provided.indexOf(componentTableName) == -1 && description.schema) {

                                // Create and schedule a schema import for the component
                                componentImport = new SchemaImport(job,
                                                                   componentTableName,
                                                                   description);
                                componentImports.push(componentImport);

                                // Capture dependencies of the component schema
                                componentImport.requires.forEach(addRequirement);

                                // Register component schema as provided
                                provided.push(componentTableName);
                            }

                            // If the component requires a link table,
                            // register the link table schema as dependency
                            var linkTableName = description.link;
                            if (linkTableName) {
                                addRequirement(linkTableName);
                            }

                            // Add the component definition to the main schema
                            schemaImport.addComponent(alias, description);
                        }
                    }

                    // Schedule import tasks for dependencies
                    var references = data.references,
                        requirement,
                        referenceImport;

                    if (references) {

                        while(requirements.length) {
                            requirement = requirements.shift();

                            // Have we already provided a SchemaImport for
                            // this requirement?
                            if (provided.indexOf(requirement) != -1) {
                                continue;
                            }

                            // Do we have a reference schema available?
                            if (references.hasOwnProperty(requirement)) {

                                // Create a SchemaImport for the referenced table
                                referenceImport = new SchemaImport(job,
                                                            requirement,
                                                            references[requirement],
                                                            true);
                                schemaImports.push(referenceImport);

                                // Note as provided
                                provided.push(requirement);

                                // Capture new requirements of the reference import
                                referenceImport.requires.forEach(addRequirement);
                            }
                        }
                    }

                    // Schedule the main schema and component schema imports
                    schemaImports.push(schemaImport);
                    schemaImports = schemaImports.concat(componentImports);

                    // Resolved
                    self.resolve(schemaImports);
                },
                function(response) {

                    // Download failed
                    self.reject(emServer.parseServerError(response));
                });
        };

        // ====================================================================
        // Return the constructor
        //
        return SchemaDownload;
    }
]);
