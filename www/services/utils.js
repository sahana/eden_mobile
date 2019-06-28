/**
 * Sahana Eden Mobile - Utilities
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

/**
 * @todo: docstring
 * @todo: add separators
 * @todo: include in index.html
 */
EdenMobile.factory('emUtils', [
    function () {

        "use strict";

        // ====================================================================
        /**
         * UUID constructor
         * - representing an RFC 4122 v4 compliant unique identifier
         *
         * Inspired by Briguy37's proposal in:
         * http://stackoverflow.com/questions/105034/create-guid-uuid-in-javascript
         */
        function UUID() {

            var template = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx',
                time = new Date().getTime();

            if (window.performance && typeof window.performance.now == 'function') {
                time += window.performance.now();
            }
            this.uuid = template.replace(/[xy]/g, function(c) {
                var result = (time + Math.random() * 16) % 16 | 0;
                time = Math.floor(time / 16);
                if (c != 'x') {
                    result = result & 0x3 | 0x8;
                }
                return result.toString(16);
            });
        }

        // --------------------------------------------------------------------
        /**
         * String representation of the UUID
         */
        UUID.prototype.toString = function() {

            return this.uuid;
        };

        // --------------------------------------------------------------------
        /**
         * URN representation of the UUID
         */
        UUID.prototype.urn = function() {

            return 'urn:uuid:' + this.uuid;
        };

        // ====================================================================
        /**
         * Transform an underscore-separated name phrase into a
         * human-readable label
         *
         * @param {string} phrase - the name phrase
         *
         * @example
         *  capitalize("human_resource"); // returns "Human Resource"
         *
         * @returns {string} - the capitalized phrase
         */
        var capitalize = function(phrase) {

            return phrase.split('_').map(function(word) {
                return word[0].toUpperCase() + word.slice(1);
            }).join(' ');
        };

        // ====================================================================
        // Regex to decode reference field types
        //
        var refPattern = /reference\s+([a-z]{1}[a-z0-9_]*)(?:\.([a-z]{1}[a-z0-9_]*)){0,1}/gi;

        // ====================================================================
        // Expose methods
        //
        var utils = {

            uuid: function() {
                return new UUID();
            },

            getReference: function(fieldType) {
                refPattern.lastIndex = 0;
                return refPattern.exec(fieldType);
            },

            capitalize: capitalize
        };

        return utils;
    }
]);
