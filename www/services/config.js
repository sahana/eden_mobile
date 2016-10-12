/**
 * Sahana Eden Mobile - Configuration Settings Service
 *
 * Copyright (c) 2016: Sahana Software Foundation
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

// @todo: rename as emConfig
EdenMobile.factory('$emConfig', ['$q', '$emdb', function ($q, $emdb) {

    var settings = angular.copy(emSettings),
        settingsStatus = $q.defer(),
        settingsLoaded = settingsStatus.promise,
        settingsID = null;

    /**
     * Read the current values of configuration settings from
     * the database, automatically called during initialization
     * of this service
     *
     * @param {Array} records - the records in the em_config table
     *
     * (second parameter 'results' from table.select() unused)
     */
    var loadSettings = function(records) {

        if (records.length > 0) {

            var currentSettings = records[0].settings,
                defaultValues,
                currentValues,
                section,
                key;

            for (section in currentSettings) {
                if (!settings.hasOwnProperty(section)) {
                    continue;
                }
                defaultValues = settings[section];
                currentValues = currentSettings[section];
                for (key in currentValues) {
                    if (!defaultValues.hasOwnProperty(key)) {
                        continue;
                    }
                    defaultValues[key].currentValue = currentValues[key];
                }
            }

            // Store the record ID for later updates
            settingsID = records[0].id;
        }

        // Resolve the promise
        settingsStatus.resolve(settings);
    };

    // Initial loading of the current configuration
    // values from the database:
    $emdb.table('em_config').then(function(table) {
        table.select(['id', 'settings'], loadSettings);
    });

    var settingsChanged = false;

    /**
     * Settings API Prototype
     */
    function Settings() {}

    /**
     * Get a list of all sections in the settings
     *
     * @returns {Array} - an array of section names
     */
    Settings.prototype.sections = function() {

        var sections = [];
        for (var sectionName in settings) {
            sections.push(sectionName);
        }
        return sections;
    };

    /**
     * Getter for sections, used to build the config form
     *
     * @param {string} sectionName - the section name
     *
     * @returns {object} - the current section object (see emSettings for structure)
     */
    Settings.prototype.section = function(sectionName) {

        return settings[sectionName];
    };

    /**
     * Getter for individual settings
     *
     * @param {string} key - the key as 'sectionKey.settingKey'
     *
     * @returns {mixed} - the current value for the key, or undefined if
     *                    the key doesn't exist
     */
    Settings.prototype.get = function(key) {

        var currentValue,
            keys = key.split('.');

        if (keys.length == 2) {

            var sectionKey = keys[0],
                settingKey = keys[1],
                section = settings[sectionKey],
                setting;

            if (section !== undefined) {
                setting = section[settingKey];
                if (setting) {
                    currentValue = setting.currentValue;
                    if (currentValue === undefined) {
                        currentValue = setting.defaultValue;
                    }
                }
            }
        }
        return currentValue;
    };

    /**
     * Setter for individual settings
     *
     * @param {string} key - the key as 'sectionKey.settingKey'
     * @param {mixed} value - the new value (must be JSON-serializable)
     */
    Settings.prototype.set = function(key, value) {

        var keys = key.split('.');

        if (keys.length == 2) {

            var sectionKey = keys[0],
                settingKey = keys[1],
                section = settings[sectionKey];

            if (section) {
                var setting = section[settingKey];
                if (setting) {
                    setting.currentValue = value;
                }
            }
        }
    };

    /**
     * Save the current settings in the database
     *
     * @param {function} callback - callback function to invoke after successfully
     *                              storing the current settings in the database,
     *                              takes no parameters
     */
    Settings.prototype.save = function(callback, $scope) {

        var currentSettings = {},
            empty = true,
            currentSection,
            emptySection,
            sectionKey,
            section,
            key,
            value;

        // Collect current values
        for (sectionKey in settings) {
            section = settings[sectionKey];

            currentSection = {};
            emptySection = true;
            for (key in section) {
                value = section[key].currentValue;
                if (value !== undefined) {
                    emptySection = false;
                    currentSection[key] = value;
                }
            }
            if (!emptySection) {
                empty = false;
                currentSettings[sectionKey] = currentSection;
            }
        }

        settingsChanged = false;

        // Store in DB (need to know whether there are any DB settings)
        if (!empty) {
            $emdb.table('em_config').then(function(table) {

                var data = {settings: currentSettings};

                if (settingsID) {
                    table.update(data, 'id=' + settingsID, function() {
                        if (callback) {
                            callback();
                        }
                    });
                } else {
                    table.insert(data, function(insertID) {
                        settingsID = insertID;
                        if (callback) {
                            callback();
                        }
                    });
                }
            });
        }
    };

    var api = {

        /**
         * Wrapper for Settings
         *
         * @param {function} callback - callback function to apply the settings,
         *                              function(settings), where settings is an
         *                              instance of the Settings API
         *
         * @example $emConfig.apply(function(settings) { ... });
         *
         */
        apply: function(callback) {

            settingsLoaded.then(function() {

                var settingsAPI = new Settings();
                if (callback) {
                    callback(settingsAPI);
                }

                if (settingsChanged) {
                    SettingsAPI.save();
                }
            });
        }
    };

    return api;

}]);
