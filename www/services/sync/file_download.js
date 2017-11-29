/**
 * Sahana Eden Mobile - File Download (SyncTask)
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

EdenMobile.factory('FileDownload', [
    'emServer', 'emFiles', 'SyncTask',
    function (emServer, emFiles, SyncTask) {

        "use strict";

        /**
         * SyncTask to
         * - download a file attachment of a record
         *
         * @param {string} downloadURL - the URL to download the file from
         */
        var FileDownload = SyncTask.define(function(downloadURL) {

            this.downloadURL = downloadURL;

            this.run.provide(this, null, null, downloadURL);
        });

        // --------------------------------------------------------------------
        /**
         * Execute this task
         */
        FileDownload.prototype.execute = function() {

            var url = this.downloadURL,
                self = this;

            //console.log('Downloading ' + url);

            emServer.getFile(url,
                function(data, fileName) {
                    // Download succeeded
                    if (data) {
                        //console.log('File received: ' + fileName);

                        var dataType = data.type || 'application/octet-stream',
                            blob = new Blob([data], {type: dataType});
                        emFiles.createTempFile(fileName, blob, function(tempFileURI) {
                            self.resolve(tempFileURI);
                        });

                    } else {
                        self.reject('no data received from ' + url);
                    }
                },
                function(response) {
                    // Download failed
                    self.reject(emServer.parseServerError(response));
                });
        };

        // ====================================================================
        // Return the constructor
        //
        return FileDownload;
    }
]);
