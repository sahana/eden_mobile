/**
 * Sahana Eden Mobile - Configuration Settings Service
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

EdenMobile.factory('emConfig', [
    '$q', 'emDB', 'emSettings',
    function ($q, emDB, emSettings) {

        "use strict";

        // The current settings
        var currentSettings = {};

        // Status handling
        var settingsStatus = $q.defer(),
            settingsLoaded = settingsStatus.promise,
            settingsChanged = false,
            settingsID = null;

        // --------------------------------------------------------------------
        /**
         * Load the structure and default values for all settings,
         * called during app initialization
         */
        var loadDefaults = function() {

            var name,
                section,
                values,
                empty,
                key;

            for (name in emSettings) {
                if (name[0] != '_') {
                    section = emSettings[name];
                    values = {};
                    empty = true;
                    for (key in section) {
                        if (key[0] != '_') {
                            values[key] = section[key].defaultValue;
                            empty = false;
                        }
                    }
                    if (!empty) {
                        currentSettings[name] = values;
                    }
                }
            }
        };

        // Load the structure and defaults
        loadDefaults();

        // --------------------------------------------------------------------
        /**
         * Load local defaults from config/local.json, called during
         * app initialization
         *
         * @returns {promise} - a promise that will resolve into an object
         *                      with local defaults for settings
         */
        var loadLocalDefaults = function() {

            var localSettingsURL = 'config/local.json',
                request = new XMLHttpRequest(),
                localDefaults = {},
                deferred = $q.defer();

            request.open('GET', localSettingsURL);
            request.onreadystatechange = function() {
                if (request.readyState == 4) {
                    if (request.status == 200) {
                        try {
                            localDefaults = JSON.parse(request.responseText);
                        } catch(e) {
                            console.log(e);
                            localDefaults = {};
                        }
                    }
                    deferred.resolve(localDefaults);
                }
            };
            request.send(null);

            return deferred.promise;
        };

        // --------------------------------------------------------------------
        /**
         * Read the current values of configuration settings from
         * the database, called during initialization
         *
         * @param {Array} records - the records in the em_config table
         *
         * (second parameter 'results' from table.select() unused)
         */
        var loadSettings = function(records) {

            if (records.length) {

                var record = records[0],
                    settings = record.$('settings'),
                    name,
                    section,
                    values,
                    empty,
                    key,
                    sectionDefaults;

                for (name in emSettings) {

                    if (name[0] == '_' || !settings.hasOwnProperty(name)) {
                        continue;
                    }
                    section = settings[name];
                    sectionDefaults = emSettings[name];

                    values = currentSettings[name] || {};
                    empty = true;

                    for (key in section) {
                        if (!sectionDefaults.hasOwnProperty(key)) {
                            continue;
                        }
                        values[key] = section[key];
                        empty = false;
                    }
                    if (!empty) {
                        currentSettings[name] = values;
                    }
                }
                // Store the record ID for later updates
                settingsID = record.$('id');
            }
            // Resolve the promise
            settingsStatus.resolve(currentSettings);
        };

        // Load local defaults, then read the current settings from the database
        loadLocalDefaults().then(function(localDefaults) {

            console.log(localDefaults);
            for (var sectionName in localDefaults) {
                var section = currentSettings[sectionName];
                if (section) {
                    var localSettings = localDefaults[sectionName];
                    for (var key in localSettings) {
                        if (section.hasOwnProperty(key)) {
                            section[key] = localSettings[key];
                        }
                    }
                }
            }

            emDB.table('em_config').then(function(table) {
                table.select(['id', 'settings'], {limitby: 1}, loadSettings);
            });
        });

        // ====================================================================
        /**
         * Settings API Prototype
         */
        function Settings() {}

        /**
         * Get a copy of the currentSettings object (e.g. to use in scope)
         *
         * @returns {object} - an object with a deep copy of currentSettings
         */
        Settings.prototype.copy = function() {

            return angular.copy(currentSettings);
        };

        // --------------------------------------------------------------------
        /**
         * Getter for individual settings
         *
         * @param {string} key - the key as 'sectionKey.settingKey'
         *
         * @returns {mixed} - the current value for the key, or undefined if
         *                    the key doesn't exist
         *
         * @example
         *  serverURL = settings.get('server.url');
         */
        Settings.prototype.get = function(key) {

            var currentValue,
                keys = key.split('.');

            if (keys.length == 2) {

                var sectionKey = keys[0],
                    settingKey = keys[1],
                    section = currentSettings[sectionKey];

                if (section !== undefined) {
                    currentValue = section[settingKey];
                }
            }
            return currentValue;
        };

        // --------------------------------------------------------------------
        /**
         * Setter for individual settings
         *
         * @param {string} key - the key as 'sectionKey.settingKey'
         * @param {mixed} value - the new value (must be JSON-serializable)
         *
         * @example
         *  settings.set('server.url', 'http://eden.example.com');
         */
        Settings.prototype.set = function(key, value) {

            var keys = key.split('.');

            if (keys.length == 2) {

                var sectionKey = keys[0],
                    settingKey = keys[1],
                    section = currentSettings[sectionKey];

                if (section) {
                    section[settingKey] = value;
                    settingsChanged = true;
                }
            }
        };

        // --------------------------------------------------------------------
        /**
         * Update the current settings (multiple)
         *
         * @param {object} updates - object with updated settings
         *
         * @example
         *  settings.update({server: {url: 'http://eden.example.com'}});
         */
        Settings.prototype.update = function(updates) {

            var sectionName,
                currentValues,
                newValues,
                currentValue,
                newValue,
                key;

            for (sectionName in updates) {

                currentValues = currentSettings[sectionName];
                if (currentValues !== undefined) {

                    newValues = updates[sectionName];
                    for (key in newValues) {
                        if (!currentValues.hasOwnProperty(key)) {
                            continue;
                        }
                        currentValue = currentValues[key];
                        newValue = newValues[key];
                        if (currentValue !== newValue) {
                            currentValues[key] = newValue;
                            settingsChanged = true;
                        }
                    }
                }
            }
        };

        // --------------------------------------------------------------------
        /**
         * Save the current settings in the database
         *
         * @param {function} callback - callback function to invoke after successfully
         *                              storing the current settings in the database,
         *                              takes no parameters
         */
        Settings.prototype.save = function(callback) {

            var data = {},
                sectionName,
                section,
                values,
                key,
                value,
                empty = true,
                emptySection;

            for (sectionName in currentSettings) {

                section = currentSettings[sectionName];
                values = {};
                emptySection = true;

                for (key in section) {
                    value = section[key];
                    if (value !== undefined) {
                        values[key] = value;
                        emptySection = false;
                    }
                }
                if (!emptySection) {
                    data[sectionName] = values;
                    empty = false;
                }
            }

            settingsChanged = false;
            if (!empty) {
                emDB.table('em_config').then(function(table) {
                    if (settingsID) {
                        table.where(table.$('id').equals(settingsID))
                             .update({settings: data}, function() {
                            if (callback) {
                                callback();
                            }
                        });
                    } else {
                        table.insert({settings: data}, function(insertID) {
                            settingsID = insertID;
                            if (callback) {
                                callback();
                            }
                        });
                    }
                });
            }
        };

        // ====================================================================
        // Expose API
        //
        var api = {

            /**
             * Wrapper for Settings
             *
             * @param {function} callback - callback function to apply the settings,
             *                              function(settings), where settings is an
             *                              instance of the Settings API
             *
             * @example
             *  emConfig.apply(function(settings) { ... });
             *
             */
            apply: function(callback) {

                settingsLoaded.then(function() {

                    var settingsAPI = new Settings();
                    if (callback) {
                        callback(settingsAPI);
                    }

                    if (settingsChanged) {
                        settingsAPI.save();
                    }
                });
            }

        };
        return api;
    }
]);

// END ========================================================================
