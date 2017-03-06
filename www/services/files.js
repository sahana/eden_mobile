/**
 * Sahana Eden Mobile - Files Service
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

(function() {

    // ========================================================================
    /**
     * Decorator returning an error handler function for file
     * plugin errors
     *
     * @param {string} message - the error message
     *
     * @returns {function} - the error handler
     */
    var fsError = function(message) {
        return function(error) {
            alert('Error ' + error.code + ': ' + (message || 'unknown error'));
        };
    };

    // ------------------------------------------------------------------------
    /**
     * Get upload directory
     *
     * @param {function} onSuccess - the success callback, receives the
     *                               upload directory entry as parameter
     */
    var getUploadDirectory = function(onSuccess) {

        var dataDirectory = cordova.file.dataDirectory,
            uploadDirectory = 'uploads';

        window.resolveLocalFileSystemURL(dataDirectory, function(dataDir) {
            dataDir.getDirectory(uploadDirectory,
                {
                    create: true
                },
                onSuccess,
                fsError('unable to access upload directory')
            );
        });
    };

    // ------------------------------------------------------------------------
    /**
     * Helper function to move a file to a persistent location
     *
     * @param {object} fileEntry - the file entry
     * @param {function} callback - the callback function, receives
     *                              the new file URI as parameter
     */
    var moveFile = function(fileEntry, onSuccess) {

        var fileName = fileEntry.name;

        // Resolve targetDir, then move the file
        getUploadDirectory(function(uploadDir) {
            fileEntry.moveTo(uploadDir, fileName, function(newFileEntry) {
                if (onSuccess) {
                    onSuccess(newFileEntry.nativeURL);
                }
            }, fsError('failed to move file'));
        });
    };

    // ------------------------------------------------------------------------
    /**
     * API function to store a file for an upload-field
     *
     * @param {string} fileURI - the file URI
     * @param {function} callback - the callback function, receives
     *                              the new file URI as parameter
     */
    var store = function(fileURI, callback) {

        window.resolveLocalFileSystemURL(fileURI, function(fileEntry) {
            moveFile(fileEntry, callback);
        }, fsError('file not found'));
    };

    // ========================================================================
    /**
     * emFiles - Service to handle files for upload-fields
     *
     * @class emFiles
     * @memberof EdenMobile
     */
    EdenMobile.factory('emFiles', [
        function () {

            var api = {

                store: store

            };
            return api;
        }
    ]);

})();

// END ========================================================================
