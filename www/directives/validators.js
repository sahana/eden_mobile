/**
 * Sahana Eden Mobile - Validator Directives
 *
 * Copyright (c) 2019-2019 Sahana Software Foundation
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

    /**
     * JSON parsing/formatting + validation
     */
    EdenMobile.directive('isJson', [
        function() {

            var link = function($scope, elem, attr, ngModel) {

                // Parser (view=>model)
                ngModel.$parsers.push(function(value) {
                    try {
                        return JSON.parse(value);
                    } catch(e) {
                        // returning undefined will lead to ng-invalid-parse,
                        // so this already verifies that the input is valid
                        // JSON
                    }
                });

                // Formatter (model=>view)
                ngModel.$formatters.push(function(value) {
                    if (value !== undefined) {
                        return JSON.stringify(value);
                    } else {
                        return '';
                    }
                });

                // Validation
                ngModel.$validators.json = function(modelValue, viewValue) {
                    if (ngModel.$isEmpty(modelValue)) {
                        // consider empty models to be valid
                        return true;
                    }

                    // This will only be called when the parser has succeeded,
                    // so we already know it's valid JSON; however, we could use
                    // this to ensure a certain type of JSON object (e.g. reject
                    // atoms)
                    var parsed;
                    if (viewValue) {
                        try {
                            parsed = JSON.parse(viewValue.trim());
                        } catch(e) {
                            return false;
                        }
                    }
                    return parsed !== undefined;
                };
            };

            return {
                require: 'ngModel',
                link: link
            };
        }
    ]);

})(EdenMobile);
