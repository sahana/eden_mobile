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

    // ========================================================================
    /**
     * JSON parsing/formatting + validation
     */
    EdenMobile.directive('isJson', [
        function() {

            var link = function($scope, elem, attr, ngModel) {

                // Parser (view=>model)
                ngModel.$parsers.push(function(value) {
                    if (!value) {
                        // Return null to bypass validation
                        return null;
                    }
                    try {
                        return JSON.parse(value);
                    } catch(e) {
                        // Return undefined to produce ng-invalid-parse
                    }
                });

                // Formatter (model=>view)
                ngModel.$formatters.push(function(value) {
                    if (value !== undefined && value !== null) {
                        return JSON.stringify(value);
                    } else {
                        return '';
                    }
                });

                // Validation
                ngModel.$validators.json = function(modelValue, viewValue) {
                    if (ngModel.$isEmpty(modelValue)) {
                        // Consider empty models to be valid
                        return true;
                    }

                    // Try parsing the view
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
                restrict: 'A',
                link: link
            };
        }
    ]);

    // ========================================================================
    /**
     * Minimum number of selected points in emWizardImageMap
     */
    EdenMobile.directive('minSelectedPoints', [
        function() {

            var link = function($scope, elem, attr, ngModel) {

                var minSelectedPoints = attr.minSelectedPoints - 0;
                if (!isNaN(minSelectedPoints) && minSelectedPoints > 0) {
                    ngModel.$validators.minSelectedPoints = function(modelValue, viewValue) {
                        var parsed;
                        if (viewValue) {
                            try {
                                parsed = JSON.parse(viewValue.trim());
                            } catch(e) {
                                return false;
                            }
                        }
                        if (parsed) {
                            var selectedPoints = parsed.selectedPoints;
                            return selectedPoints.constructor === Array && selectedPoints.length >= minSelectedPoints;
                        } else {
                            // No data yet => always invalid
                            return false;
                        }
                    };
                }
            };

            return {
                require: 'ngModel',
                restrict: 'A',
                link: link
            };
        }
    ]);

    // ========================================================================
    /**
     * Minimum number of selected options in emWizardMultiSelect
     */
    EdenMobile.directive('minSelected', [
        function() {

            var link = function($scope, elem, attr, ngModel) {

                var minSelected = attr.minSelected - 0;
                if (!isNaN(minSelected) && minSelected > 0) {
                    ngModel.$validators.minSelected = function(modelValue, viewValue) {
                        return !!viewValue && viewValue.length >= minSelected;
                    };
                }
            };

            return {
                require: 'ngModel',
                restrict: 'A',
                link: link
            };
        }
    ]);

    // ========================================================================

})(EdenMobile);
