/**
 * Sahana Eden Mobile - Display Logic
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

EdenMobile.factory('emDisplayLogic', [
    function() {

        /**
         * Type-check helpers
         */
        var isObject = function(value) {
            return value && typeof value === 'object' && value.constructor === Object;
        };
        var isArray = function(value) {
            return value && typeof value === 'object' && value.constructor === Array;
        };

        /**
         * Display Logic Rule Processor; for use with ngShow
         * - ngShow = DisplayLogic(form, fieldName, rule).show()
         *
         * @param {object} form - the form data object (scope model)
         * @param {string} fieldName - name of the field the rule is for
         * @param {*} - the display logic rule
         *
         * Rule format:
         *
         *      {"field": otherFieldName, op: value} - field will show when condition about
         *                                             the other field becomes true;
         *                                             op=eq|ne|gt|ge|lt|le; multiple
         *                                             op-value-pairs can be specified
         *                                             (all must apply = AND)
         *
         *      otherFieldName                       - the field will show when the other
         *                                             field is not empty
         *
         *      [rule, rule, ...]                    - multiple rules, AND
         *
         *      ["allOf", rule, rule, ...]           - multiple rules, AND
         *
         *      ["anyOf", rule, rule, ...]           - multiple rules, OR
         *
         *      any other value                      - field will show if value is truthy
         *
         */
        function DisplayLogic(form, fieldName, rule) {

            this.form = form;
            this.fieldName = fieldName;

            var conditions;

            if (!rule) {
                // No rule => show never
                this.show = this.never;

            } else if (isArray(rule)) {

                // Array of rules

                if (rule.length === 0) {
                    // No rules => show always
                    this.show = this.always;
                }

                // Detect operator
                var op = rule[0],
                    rules;
                if (op !== 'allOf' && op !== 'anyOf') {
                    op = 'allOf';
                    rules = rule;
                } else {
                    rules = rule.slice(1);
                }

                // Create child instances
                conditions = [];
                rules.forEach(function(c) {
                    conditions.push(new DisplayLogic(form, fieldName, c).show);
                });

                // Construct this.how
                if (conditions.length) {
                    if (op == 'anyOf') {
                        this.show = this.anyOf(conditions);
                    } else {
                        this.show = this.allOf(conditions);
                    }
                } else {
                    this.show = this.always;
                }

            } else if (isObject(rule)) {

                // Single rule

                // Get field name
                var other = rule.field;
                if (!other || other == fieldName) {
                    // No field name => show always
                    this.show = this.always;
                }

                // Process conditions
                conditions = [];
                for (var operator in rule) {
                    var value = rule[operator];
                    if (value === undefined) {
                        continue;
                    }
                    switch(operator) {
                        case 'eq':
                            conditions.push(this.eq(other, value));
                            break;
                        case 'ne':
                            conditions.push(this.ne(other, value));
                            break;
                        case 'lt':
                            conditions.push(this.lt(other, value));
                            break;
                        case 'le':
                            conditions.push(this.le(other, value));
                            break;
                        case 'gt':
                            conditions.push(this.gt(other, value));
                            break;
                        case 'ge':
                            conditions.push(this.ge(other, value));
                            break;
                        case 'selectedRegion':
                            conditions.push(this.selectedRegion(other, value));
                            break;
                        default:
                            break;
                    }
                }

                if (!conditions.length) {
                    // Without conditions => show if field is not empty
                    conditions.push(this.ifNotEmpty(other));
                }

                // Show if all conditions apply
                this.show = this.allOf(conditions);

            } else {

                // Rule is a value => show if truthy
                this.show = function() {
                    return !!rule;
                };
            }
        }

        // --------------------------------------------------------------------
        /**
         * Show field if other field equals value
         *
         * @returns {function} - show-function
         */
        DisplayLogic.prototype.eq = function(other, value) {
            var form = this.form;
            return function() {
                var fieldValue = form[other];
                if (isArray(fieldValue)) {
                    // Treat as containment-operator with Array
                    return fieldValue.indexOf(value) != -1;
                } else {
                    return fieldValue == value;
                }
            };
        };

        /**
         * Show field if other field is not equal value
         *
         * @returns {function} - show-function
         */
        DisplayLogic.prototype.ne = function(other, value) {
            var form = this.form;
            return function() {
                return form[other] != value;
            };
        };

        /**
         * Show field if other field is less than value
         *
         * @returns {function} - show-function
         */
        DisplayLogic.prototype.lt = function(other, value) {
            var form = this.form;
            return function() {
                return form[other] < value;
            };
        };

        /**
         * Show field if other field is less or equal value
         *
         * @returns {function} - show-function
         */
        DisplayLogic.prototype.le = function(other, value) {
            var form = this.form;
            return function() {
                return form[other] <= value;
            };
        };

        /**
         * Show field if other field is greater than value
         *
         * @returns {function} - show-function
         */
        DisplayLogic.prototype.gt = function(other, value) {
            var form = this.form;
            return function() {
                return form[other] > value;
            };
        };

        /**
         * Show field if other field is greater or equal value
         *
         * @returns {function} - show-function
         */
        DisplayLogic.prototype.ge = function(other, value) {
            var form = this.form;
            return function() {
                return form[other] >= value;
            };
        };

        /**
         * Show field if value of other field has a 'selectedRegions'
         * property which contains value (=a certain regionID); for ImageMap
         *
         * @returns {function} - show-function
         */
        DisplayLogic.prototype.selectedRegion = function(other, value) {
            var form = this.form,
                showIf;

            value = value - 0;
            if (isNaN(value)) {
                // Only numbers can succeed
                showIf = this.never;
            } else {
                showIf = function() {
                    var fieldValue = form[other];
                    if (isObject(fieldValue)) {
                        var selectedRegions = fieldValue.selectedRegions;
                        if (isArray(selectedRegions)) {
                            return selectedRegions.indexOf(value) != -1;
                        }
                    }
                    return false;
                };
            }
        };

        // --------------------------------------------------------------------
        /**
         * Show the field always
         *
         * @returns {function} - show-function
         */
        DisplayLogic.prototype.always = function() {
            return true;
        };

        // --------------------------------------------------------------------
        /**
         * Show the field never
         *
         * @returns {function} - show-function
         */
        DisplayLogic.prototype.never = function() {
            return false;
        };

        // --------------------------------------------------------------------
        /**
         * Show field if all of the conditions apply
         *
         * @param {Array} conditions - array of show-functions for
         *                             conditions
         *
         * @returns {function} - show-function
         */
        DisplayLogic.prototype.allOf = function(conditions) {
            return function() {
                for (var i=conditions.length; i--;) {
                    if (!conditions[i]()) {
                        return false;
                    }
                }
                return true;
            };
        };

        // --------------------------------------------------------------------
        /**
         * Show field if any of the conditions apply
         *
         * @param {Array} conditions - array of show-functions for
         *                             conditions
         *
         * @returns {function} - show-function
         */
        DisplayLogic.prototype.anyOf = function(conditions) {
            return function() {
                for (var i=conditions.length; i--;) {
                    if (conditions[i]()) {
                        return true;
                    }
                }
                return false;
            };
        };

        // --------------------------------------------------------------------
        /**
         * Show field if other field is not empty
         *
         * @param {string} other - name of the other field
         *
         * @returns {function} - show-function
         */
        DisplayLogic.prototype.ifNotEmpty = function(other) {
            var form = this.form;
            return function() {
                return !!form[other];
            };
        };

        // ====================================================================
        // Return the constructor
        //
        return DisplayLogic;
    }
]);

// END ========================================================================
