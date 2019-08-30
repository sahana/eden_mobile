/**
 * Sahana Eden Mobile - Likert Scale Provider
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
(function(EdenMobile) {

    "use strict";

    var scales = {
        //scaleType: {
        //    options: [[value, label], ...],
        //    icons: [[value, icon], ...],
        //    iconsOnly: true|false
        //}
    };

    var emLikertScale = [
        '$q',
        function($q) {

            /**
             * Get the field options for a scale type
             *
             * @param {string} scaleType - the scale type
             *
             * @returns {promise} - a promise that is resolved into an Array
             *                      of field options [[value, label], ...], or
             *                      rejected if the scale type is not found in
             *                      the configuration
             */
            var getOptions = function(scaleType) {

                var scale = scales['' + scaleType];
                if (!scale) {
                    return $q.reject('undefined likert scale');
                }

                var scaleOptions = scale.options,
                    widgetOptions = [];
                if (scaleOptions) {
                    scaleOptions.forEach(function(option) {
                        if (!option) {
                            return;
                        }
                        if (option.constructor !== Array) {
                            widgetOptions.push([option, option]);
                        } else {
                            widgetOptions.push(option);
                        }
                    });
                }
                return $q.resolve(widgetOptions);
            };

            /**
             * Get the icons for field options of this scale type
             *
             * @param {string} scaleType - the scale type
             *
             * @returns {Array} - an Array of icon CSS classes [[value, css-class], ...]
             */
            var getIcons = function(scaleType) {

                var scale = scales['' + scaleType];
                if (!scale) {
                    return [];
                }

                var icons = scale.icons;
                if (icons) {
                    // Return a copy to allow manipulation
                    icons = icons.slice(0);
                } else {
                    icons = [];
                }
                return icons;
            };

            /**
             * Tell whether a scale type shall be rendered with icons only
             *
             * @param {string} scaleType - the scale type
             *
             * @returns {boolean}
             */
            var iconsOnly = function(scaleType) {

                var scale = scales['' + scaleType];
                if (!scale) {
                    return false;
                }
                return scale.iconsOnly;
            };

            // ----------------------------------------------------------------
            // Service API
            //
            return {

                getOptions: getOptions,
                getIcons: getIcons,
                iconsOnly: iconsOnly
            };
        }
    ];

    // ========================================================================
    // Provider
    //
    EdenMobile.provider('emLikertScale', function() {

        /**
         * Add a likert scale to the configuration
         *
         * @param {string} scaleType - the scale type name
         * @param {Array} options - an array of field options [[value, label], ...],
         *                          alternatively [value, value, ...] if values are labels
         * @param {Array} icons - an array of icon CSS classes for options [[value, css-class], ...]
         * @param {boolean} iconsOnly - render the scale as icons only by default
         */
        this.scale = function(scaleType, options, icons, iconsOnly) {

            var scale = {};
            if (options && options.constructor === Array) {
                scale.options = options;
            }
            if (icons && icons.constructor === Array) {
                scale.icons = icons;
            }
            scale.iconsOnly = !!iconsOnly;

            scales['' + scaleType] = scale;

            return this; // make chainable
        };

        // Service Constructor
        this.$get = emLikertScale;
    });


})(EdenMobile);
