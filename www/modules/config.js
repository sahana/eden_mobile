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

EdenMobile.factory('$emConfig', ['$q', '$emdb', function ($q, $emdb) {

    var settings = angular.copy(emSettings),
        settingsStatus = $q.defer(),
        settingsLoaded = settingsStatus.promise;

    /**
     * @todo: docstring
     */
    var loadSettings = function(records, result) {

        if (records.length > 0) {

            var currentSettings = records[0].settings,
                defaultValues,
                currentValues,
                section;

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

        }
        settingsStatus.resolve(settings);
    };

    // @todo: comment
    $emdb.table('em_config').then(function(table) {
        table.select(['settings'], loadSettings);
    });

    var settingsChanged = false;

    /**
     * @todo: docstring
     * @todo: set() method
     * @todo: save() method
     * @todo: update() method
     */
    function Settings() {

        var self = this;

        /**
         * @todo: docstring
         */
        self.get = function(key) {

            var currentValue,
                keys = key.split('.');

            if (keys.length == 2) {

                var sectionKey = keys[0],
                    settingKey = keys[1],
                    section = settings[sectionKey],
                    setting;

                if (section) {
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
         * Get a list of all sections
         */
        self.sections = function() {

            var sections = [];
            for (var sectionName in settings) {
                sections.push(sectionName);
            }
            return sections;
        };

        self.section = function(sectionName) {

            return settings[sectionName];
        };
    }

    var api = {

        apply: function(callback) {

            settingsLoaded.then(function() {

                var settingsAPI = new Settings();
                if (callback) {
                    callback(settingsAPI);
                }
                // @todo: save settings if settingsChanged=True
            });
        }
    };

    return api;

}]);
