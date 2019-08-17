/**
 * Sahana Eden Mobile - Synchronization
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

EdenMobile.factory('emSync', [
    '$q', '$rootScope', '$timeout', 'emDB', 'emResources', 'emS3JSON', 'emServer', 'emSyncLog', 'SyncRun',
    function ($q, $rootScope, $timeout, emDB, emResources, emS3JSON, emServer, emSyncLog, SyncRun) {

        "use strict";

        // ====================================================================
        // FormList Management
        // ====================================================================
        /**
         * Update the list of available/selected forms
         *
         * @param {Array} currentList - the current list of available/selected forms
         * @param {Array} resourceNames - names of currently installed resources
         * @param {Array} data - the list of available forms from the server
         */
        var updateFormList = function(currentList, resourceNames, data) {

            // Build dict from current form list
            var items = {};
            currentList.forEach(function(item) {
                items[item.resourceName] = item;
            });

            var formList = [];
            data.forEach(function(formData) {

                // Check if already installed
                var resourceName = formData.n,
                    installed = false;
                if (resourceNames.indexOf(resourceName) != -1) {
                    installed = true;
                }

                // Does the resource provide data for download?
                var hasData = false;
                if (formData.d) {
                    hasData = true;
                }

                // Shall the resource be downloaded?
                var item = items[resourceName],
                    download = false;
                if (item !== undefined) {
                    // Retain previous selection
                    download = item.download;
                } else if (!installed || hasData) {
                    // Automatically select for download
                    // @todo: have a setting to enable/disable this?
                    download = true;
                }

                // Create an entry and add it to the formList
                var entry = {
                    'label': formData.l,
                    'resourceName': resourceName,
                    'tableName': formData.t,
                    'ref': formData.r,
                    'installed': installed,
                    'download': download,
                    'hasData': hasData
                };
                formList.push(entry);
            });

            return formList;
        };

        // --------------------------------------------------------------------
        /**
         * Get a list of forms that are to be installed, fetch a fresh list
         * from server if no list is loaded and select automatically
         *
         * @param {Array} formList - the current list of available/selected forms
         * @param {object} options - processing options:
         *   @property {boolean} quiet - do not report HTTP errors to the user
         *   @property {string} masterKeyUUID - the master key UUID to filter
         *                                      the form list
         *
         * @returns {promise} - a promise that resolves into the form list
         */
        var getFormList = function(formList, options) {

            var deferred = $q.defer(),
                quiet,
                formListOptions;

            if (options) {
                quiet = options.quiet;
                if (options.masterKeyUUID) {
                    formListOptions = {
                        masterKeyUUID: options.masterKeyUUID
                    };
                }
            }

            if (formList && formList.length) {
                // Use this list
                deferred.resolve(formList);
            } else {
                // Fetch new form list from server and select automatically
                emServer.formList(
                    function(data) {
                        emResources.names().then(function(resourceNames) {
                            formList = updateFormList([], resourceNames, data);
                            deferred.resolve(formList);
                        });
                    },
                    function(response) {
                        //updateSyncStatus();
                        if (!quiet) {
                            emServer.httpError(response);
                        }
                        deferred.reject(response);
                    },
                    formListOptions);
            }
            return deferred.promise;
        };

        // ====================================================================
        // ResourceList Management
        // ====================================================================
        /**
         * Update the list of available/selected resources
         *
         * @param {array} currentList - the current resource list
         * @param {array} resources - the resource information from the server
         *
         * @returns {array} - the updated resource list
         */
        var updateResourceList = function(currentList, resources) {

            // Build dict from current form list
            var items = {};
            currentList.forEach(function(item) {
                items[item.resourceName] = item;
            });

            var resourceList = [],
                resource,
                upload,
                item,
                entry;

            resources.forEach(function(resourceData) {

                resource = resourceData.resource;

                item = items[resource.name];
                if (item !== undefined) {
                    upload = item.upload;
                } else {
                    // @todo: check autoUpload option for default
                    upload = true;
                }

                entry = {
                    'label': resource.getLabel(true),
                    'resourceName': resource.name,
                    'tableName': resource.tableName,
                    'ref': {
                        'c': resource.controller,
                        'f': resource.function
                    },
                    'updated': resourceData.numRows,
                    'upload': upload
                };
                resourceList.push(entry);
            });

            return resourceList;
        };

        // --------------------------------------------------------------------
        /**
         * Get an updated list of available resources
         *
         * @param {Array} currentList - the current list of available resources
         *
         * @returns {promise} - a promise that resolves into the updated
         *                      resource list
         */
        var getResourceList = function(currentList) {

            return emResources.resourceList().then(function(resourceList) {
                return updateResourceList(currentList, resourceList);
            });
        };

        // ====================================================================
        /**
         * Partial sync to fetch new forms from the server, without form
         * selection by user
         *
         * @param {boolean} quiet - do not report HTTP errors to the user
         *                          (but only to the caller)
         * @param {string} masterKeyUUID - a master key UUID to report to the
         *                                 server for filtering the form list
         *                                 * mandatory if server is configured
         *                                   to filter form list by master key
         *
         * @returns {promise} - a promise that is resolved when the download
         *                      is complete and new forms have been installed
         */
        var fetchNewForms = function(quiet, masterKeyUUID) {

            if ($rootScope.syncInProgress) {
                return $q.reject('Sync already in progress');
            }
            $rootScope.syncInProgress = true;

            emSyncLog.obsolete();

            return getFormList(false, {
                quiet: quiet,
                masterKeyUUID: masterKeyUUID
            }).then(function(formList) {

                // Check if there are any new items
                var newForms = formList.filter(function(entry) {
                    return entry.download;
                });
                if (!newForms.length) {
                    // No new forms => stop right here
                    return $q.resolve();
                }

                var sync = new SyncRun(formList, []);
                return sync.start().then(
                    function() {
                        // Success
                        //$rootScope.$broadcast('emNewFormsAvailable');
                    },
                    function( /* error */ ) {
                        // Failure
                    },
                    function(progress) {
                        if (progress) {
                            // Progress Notification
                            $rootScope.syncStage = progress.stage;
                            $rootScope.syncActivity = progress.activity;
                            $rootScope.syncProgress = [
                                progress.completed,
                                progress.total
                            ];
                        }
                    });

            }).finally(function() {

                $rootScope.syncStage = null;
                $rootScope.syncActivity = null;
                $rootScope.syncProgress = null;

                $rootScope.syncInProgress = false;
            });
        };

        // ====================================================================
        /**
         * Partial sync process to upload any pending data, without resource
         * selection by the user
         *
         * @returns {promise} - a promise that is resolved when the upload
         *                      is complete and was successful
         */
        var uploadAllData = function() {

            if ($rootScope.syncInProgress) {
                return $q.reject('Sync already in progress');
            }
            $rootScope.syncInProgress = true;

            emSyncLog.obsolete();

            return getResourceList([]).then(function(resourceList) {

                // Check if there are any new items
                var newData = resourceList.filter(function(entry) {
                    return !!entry.updated;
                });
                if (!newData.length) {
                    // No new data => stop right here
                    return $q.resolve();
                }

                var sync = new SyncRun([], resourceList);
                return sync.start().then(
                    function() {
                        // Success
                        //$rootScope.$broadcast('emDataUploaded');
                    },
                    function( /* error */ ) {
                        // Failure
                    },
                    function(progress) {
                        if (progress) {
                            // Progress Notification
                            $rootScope.syncStage = progress.stage;
                            $rootScope.syncActivity = progress.activity;
                            $rootScope.syncProgress = [
                                progress.completed,
                                progress.total
                            ];
                        }
                    });

            }).finally(function() {

                $rootScope.syncStage = null;
                $rootScope.syncActivity = null;
                $rootScope.syncProgress = null;

                $rootScope.syncInProgress = false;
            });
        };

        // ====================================================================
        // Synchronization
        // ====================================================================
        /**
         * Main synchronization function
         * - full sync process with form/data selection by user
         *
         * @param {object} forms - the selected forms list
         * @param {object} resources - the selected resources list
         */
        var synchronize = function(forms, resources) {

            if ($rootScope.syncInProgress) {
                return $q.reject('Sync already in progress');
            }
            $rootScope.syncInProgress = true;

            emSyncLog.obsolete();

            var lists = {
                formList: getFormList(forms),
                resourceList: getResourceList(resources)
            };
            return $q.all(lists).then(function(pending) {

                var sync = new SyncRun(pending.formList, pending.resourceList);

                return sync.start().then(
                    function() {
                        // Success
                    },
                    function( /* error */ ) {
                        // Failure
                    },
                    function(progress) {
                        if (progress) {
                            // Progress Notification
                            $rootScope.syncStage = progress.stage;
                            $rootScope.syncActivity = progress.activity;
                            $rootScope.syncProgress = [
                                progress.completed,
                                progress.total
                            ];
                        }
                    });

            }).finally(function() {

                $rootScope.syncStage = null;
                $rootScope.syncActivity = null;
                $rootScope.syncProgress = null;

                $rootScope.syncInProgress = false;
            });
        };

        // ====================================================================
        // API
        // ====================================================================
        var api = {

            updateFormList: updateFormList,
            updateResourceList: updateResourceList,

            synchronize: synchronize,
            fetchNewForms: fetchNewForms,
            uploadAllData: uploadAllData

        };
        return api;
    }
]);

// END ========================================================================
