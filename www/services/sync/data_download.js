/**
 * Sahana Eden Mobile - Data Download (Sync Task)
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

EdenMobile.factory('DataDownload', [
    '$q', 'emResources', 'emServer', 'SyncTask',
    function ($q, emResources, emServer, SyncTask) {

        "use strict";

        /**
         * SyncTask to:
         * - download resource data from the server (S3JSON)
         * - decode the S3JSON data and generate DataImport jobs
         * - collect the download URLs for all required files
         */
        var DataDownload = SyncTask.define();

        // --------------------------------------------------------------------
        /**
         * Execute the data download; decodes the S3JSON data received
         * and creates DataImport tasks for all relevant items
         */
        DataDownload.prototype.execute = function() {

            var job = this.job,
                run = this.run,
                ref = job.ref,
                self = this;

            console.log('Downloading data from ' + ref.c + '/' + ref.f);

            emResources.open(job.resourceName).then(function(resource) {

                if (!resource) {
                    self.reject('undefined resource');
                    return;
                }

                if (!ref.v) {
                    ref.v = {};
                }
                ref.v.mdata = '1';

                // Set msince
                var lastSync = resource.getLastSync();
                if (lastSync) {
                    var msince = lastSync.toISOString().split('.')[0];
                    ref.v.msince = msince;
                }

                // Start download
                emServer.getData(job.ref,
                    function(data) {

                        run.createDataImports(job, job.tableName, data).then(
                            function(result) {
                                self.resolve(result);
                            });

                        // Update lastSync date
                        resource.setLastSync(new Date());
                    },
                    function(response) {
                        // Download failed
                        self.reject(emServer.parseServerError(response));
                    });

            }).catch(function(e) {
                self.reject(e);
            });
        };

        // ====================================================================
        // Return the constructor
        //
        return DataDownload;
    }
]);
