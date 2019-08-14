/**
 * Sahana Eden Mobile - Wizard Widget Directives
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

    // TODO implement more widgets

    "use strict";

    // ========================================================================
    /**
     * Copy directive attributes to a generated element, using the
     * attribute map of the directive to map camelCase notation to
     * dash notation, e.g. ngModel becomes ng-model.
     *
     * @param {object} ngAttr - the directive's DOM attributes
     * @param {DOMNode} element - the target element
     * @param {Array} validAttr - the attributes to copy in camelCase
     *                            notation
     */
    function copyAttr(ngAttr, element, validAttr) {

        var attrMap = ngAttr.$attr,
            attribute,
            name,
            value;

        for (var i=validAttr.length; i--;) {
            attribute = validAttr[i];

            name = attrMap[attribute];
            value = ngAttr[attribute];
            if (name && value !== undefined) {
                element.attr(name, value);
            }
        }
    }

    // ========================================================================
    /**
     * Generic Widget <em-wizard-generic-widget>
     */
    EdenMobile.directive('emWizardGenericWidget', [
        function() {
            return {
                template: ''
            };
        }
    ]);

    // ========================================================================
    /**
     * Boolean Widget <em-wizard-boolean-widget>
     */
    EdenMobile.directive('emWizardBooleanWidget', [
        '$compile',
        function($compile) {

            var renderWidget = function($scope, elem, attr) {

                // Create the widget
                var widget;
                if (attr.widget == 'checkbox') {
                    // Checkbox
                    widget = angular.element('<ion-checkbox>')
                                    .html(attr.label || '');
                } else {
                    // Default: Toggle
                    widget = angular.element('<ion-toggle toggle-class="toggle-positive">')
                                    .html(attr.label || '');
                }

                // Set the name
                var fieldName = attr.field;
                if (fieldName) {
                    widget.attr('name', fieldName);
                }

                // Widget attributes and directives
                copyAttr(attr, widget, [
                    'ngModel',
                    'disabled'
                ]);

                // Add widget to DOM and compile it against scope
                elem.replaceWith(widget);
                $compile(widget)($scope);
            };

            return {
                link: renderWidget
            };
        }
    ]);

    // ========================================================================
    /**
     * Date widget <em-wizard-date-widget>
     */
    EdenMobile.directive('emWizardDateWidget', [
        '$compile',
        function($compile) {

            var renderWidget = function($scope, elem, attr) {

                // Create the widget
                var widget = angular.element('<input type="date">');

                // Set the name
                var fieldName = attr.field;
                if (fieldName) {
                    widget.attr('name', fieldName);
                }

                // Widget attributes and directives
                // TODO apply validation directives
                copyAttr(attr, widget, [
                    'ngModel',
                    'disabled',
                    'ngRequired'
                ]);

                // Add widget to DOM and compile it against scope
                elem.replaceWith(widget);
                $compile(widget)($scope);
            };

            return {
                link: renderWidget
            };
        }
    ]);

    // ========================================================================
    /**
     * Number widget <em-wizard-number-widget>
     */
    EdenMobile.directive('emWizardNumberWidget', [
        '$compile',
        function($compile) {

            var renderWidget = function($scope, elem, attr) {

                // Create the widget
                var widget = angular.element('<input type="number">');

                // Set the name
                var fieldName = attr.field;
                if (fieldName) {
                    widget.attr('name', fieldName);
                }

                // Widget attributes and directives
                copyAttr(attr, widget, [
                    'ngModel',
                    'disabled',
                    'placeholder',
                    'ngRequired',
                    'ngPattern',
                    'min',
                    'max'
                ]);

                // Add widget to DOM and compile it against scope
                elem.replaceWith(widget);
                $compile(widget)($scope);
            };

            return {
                link: renderWidget
            };
        }
    ]);

    // ========================================================================
    /**
     * String widget <em-wizard-string-widget>
     */
    EdenMobile.directive('emWizardStringWidget', [
        '$compile',
        function($compile) {

            var renderWidget = function($scope, elem, attr) {

                // Create the widget
                var widget = angular.element('<input>')
                                    .attr('type', attr.type || 'text');

                // Set the name
                var fieldName = attr.field;
                if (fieldName) {
                    widget.attr('name', fieldName);
                }

                // Widget attributes and directives
                copyAttr(attr, widget, [
                    'ngModel',
                    'disabled',
                    'placeholder',
                    'ngRequired'
                ]);

                // Add widget to DOM and compile it against scope
                elem.replaceWith(widget);
                $compile(widget)($scope);
            };

            return {
                link: renderWidget
            };
        }
    ]);

    // ========================================================================
    /**
     * Text widget <em-wizard-text-widget>
     */
    EdenMobile.directive('emWizardTextWidget', [
        '$compile',
        function($compile) {

            var renderWidget = function($scope, elem, attr) {

                // Create the widget
                var widget = angular.element('<textarea rows="5" cols="60">');

                // Set the name
                var fieldName = attr.field;
                if (fieldName) {
                    widget.attr('name', fieldName);
                }

                // Widget attributes and directives
                copyAttr(attr, widget, [
                    'ngModel',
                    'disabled',
                    'placeholder',
                    'ngRequired'
                ]);

                // Add widget to DOM and compile it against scope
                elem.replaceWith(widget);
                $compile(widget)($scope);
            };

            return {
                link: renderWidget
            };
        }
    ]);

    // ========================================================================
    /**
     * Single-select options-widget <em-wizard-options-widget>
     */
    EdenMobile.directive('emWizardOptionsWidget', [
        '$compile',
        function($compile) {

            /**
             * No-options-available hint
             *
             * @returns {angular.element} - the element to use as widget
             */
            var noOptionsHint = function() {
                return angular.element('<span class="noopts">')
                              .text('No options available');
            };

            /**
             * List of radio items (ion-radio)
             *
             * @param {string} fieldName - the field name
             * @param {Array} options - the selectable options [[value, repr], ...]
             * @param {object} attr - the DOM attributes of the widget directive
             *
             * @returns {angular.element} - the element to use as widget
             */
            var radioItems = function(fieldName, options, attr) {

                var widget = angular.element('<ion-list class="radio-options">'),
                    valueRequired = attr.ngRequired;

                options.forEach(function(option) {
                    var value = option[0],
                        repr = option[1];
                    if (!value && value !== 0) {
                        // Empty-option
                        if (valueRequired) {
                            return;
                        } else if (!repr){
                            repr = '-';
                        }
                    } else if (!repr) {
                        repr = '' + option[0];
                    }

                    var item = angular.element('<ion-radio>')
                                      .attr('name', fieldName)
                                      .attr('value', value)
                                      .html(repr);
                    copyAttr(attr, item, [
                        'ngModel',
                        'disabled',
                        'ngRequired'
                    ]);
                    widget.append(item);
                });

                return widget;
            };

            /**
             * Standard platform-specific SELECT
             *
             * @param {string} fieldName - the field name
             * @param {Array} options - the selectable options [[value, repr], ...]
             * @param {object} attr - the DOM attributes of the widget directive
             *
             * @returns {angular.element} - the element to use as widget
             */
            var standardSelect = function(fieldName, options, attr) {

                var widget = angular.element('<select>'),
                    valueRequired = attr.ngRequired;

                options.forEach(function(option) {
                    var value = option[0],
                        repr = option[1];
                    if (!value && value !== 0) {
                        // Empty-option
                        if (valueRequired) {
                            return;
                        } else if (!repr){
                            repr = '-';
                        }
                    } else if (!repr) {
                        repr = '' + option[0];
                    }

                    var item = angular.element('<option>')
                                      .attr('value', value)
                                      .html(repr);
                    widget.append(item);
                });

                widget.attr('name', fieldName);

                copyAttr(attr, widget, [
                    'ngModel',
                    'disabled',
                    'ngRequired'
                ]);

                return widget;
            };

            /**
             * Link a DOM element to this directive
             */
            var link = function($scope, elem, attr) {

                var resource = $scope.resource,
                    fieldName = attr.field;

                resource.getOptions(fieldName).then(
                    function(options) {
                        // Construct the widget
                        var widget;
                        if (!options.length) {
                            widget = noOptionsHint();
                        } else if (options.length <= 20) {
                            widget = radioItems(fieldName, options, attr);
                        } else {
                            widget = standardSelect(fieldName, options, attr);
                        }

                        // Add widget to DOM and compile it against scope
                        elem.replaceWith(widget);
                        $compile(widget)($scope);
                    },
                    function() {
                        // This field has no options
                        var widget = noOptionsHint();

                        // Add widget to DOM and compile it against scope
                        elem.replaceWith(widget);
                        $compile(widget)($scope);
                    });
            };

            // Return the DDO
            return {
                link: link
            };
        }
    ]);

    // ========================================================================
    /**
     * Multi-select widget <em-wizard-multi-select>
     * - renders a regular <select> with multiple-attribute
     * - uses the em-multi-select-checkbox directive to convert it into
     *   a checkbox list
     */
    EdenMobile.directive('emWizardMultiSelect', [
        '$compile',
        function($compile) {

            // Hint that no options available
            var noOptionsHint = function() {
                return angular.element('<span class="noopts">')
                              .text('No options available');
            };

            // Construct a <select> from the field options
            var standardSelect = function(fieldName, options, attr) {

                var widget = angular.element('<select>'),
                    valueRequired = attr.ngRequired;

                options.forEach(function(option) {
                    var value = option[0],
                        repr = option[1];
                    if (!value && value !== 0) {
                        // Empty-option
                        if (valueRequired) {
                            return;
                        } else if (!repr){
                            repr = '-';
                        }
                    } else if (!repr) {
                        repr = '' + option[0];
                    }

                    var item = angular.element('<option>')
                                      .attr('value', value)
                                      .html(repr);
                    widget.append(item);
                });

                widget.attr('name', fieldName);

                copyAttr(attr, widget, [
                    'ngModel',
                    'disabled',
                    'ngRequired'
                ]);

                return widget;
            };

            // Link this directive to a DOM element
            var link = function($scope, elem, attr) {

                var resource = $scope.resource,
                    fieldName = attr.field;

                resource.getOptions(fieldName).then(
                    function(options) {
                        // Construct the widget
                        var widget;
                        if (!options.length) {
                            widget = noOptionsHint();
                        } else {
                            widget = standardSelect(fieldName, options, attr);
                            widget.attr('multiple', 'true');
                            widget.attr('em-multi-select-checkbox', '');
                        }

                        // Add widget to DOM and compile it against scope
                        elem.replaceWith(widget);
                        $compile(widget)($scope);
                    },
                    function() {
                        // This field has no options
                        var widget = noOptionsHint();

                        // Add widget to DOM and compile it against scope
                        elem.replaceWith(widget);
                        $compile(widget)($scope);
                    });
            };

            return {
                link: link
            };
        }
    ]);

    // ------------------------------------------------------------------------
    /**
     * Directive to render a multi-select as checkboxes list
     * - <select multiple='true' em-multi-select-checkbox>
     */
    EdenMobile.directive('emMultiSelectCheckbox', [
        '$compile',
        function($compile) {

            /**
             * Link this directive to a <select> element
             */
            var link = function($scope, elem, attr, ngModel) {

                // Inspect the options, build selectable items array
                var options = elem.find('option'),
                    items = [];
                angular.forEach(options, function(option) {
                    var $option = angular.element(option);
                    items.push({
                        value: $option.val(),
                        label: $option.text(),
                        checked: false
                    });
                });
                $scope.items = items;

                // Construct the checkbox list
                var checkboxList = angular.element('<div class="list multi-select">'),
                    checkboxes = angular.element('<ion-checkbox>')
                                        .attr('ng-repeat', 'item in items')
                                        .attr('ng-model', 'item.checked')
                                        .attr('ng-change', 'select()')
                                        .text('{{item.label}}')
                                        .val('{{item.value}}');
                checkboxList.append(checkboxes);
                copyAttr(attr, checkboxList, [
                    'name',
                    'ngModel',
                    'ngRequired'
                ]);


                // Function to update the model when a checkbox status has changed
                $scope.select = function() {
                    var selected = $scope.items.filter(function(item) {
                        return item.checked;
                    }).map(function(item) {
                        return item.value;
                    });
                    ngModel.$setViewValue(selected);
                    ngModel.$setDirty();
                    ngModel.$setTouched();
                    checkboxList[0].focus();
                };

                // Function to update the checkbox status when the model has changed
                var render = function(value) {
                    if (value && value.constructor === Array) {
                        $scope.items.forEach(function(item) {
                            if (value.indexOf(item.value) != -1) {
                                item.checked = true;
                            } else {
                                item.checked = false;
                            }
                        });
                    } else {
                        $scope.items.forEach(function(item) {
                            item.checked = false;
                        });
                    }
                };

                // Watch the model for changes
                // - $watch needed because $render is only called when the
                //   entire list replaced, but not when its elements change
                ngModel.$render = function() {
                    render(ngModel.$viewValue);
                };
                $scope.$watch(attr.ngModel, function(newValue) {
                    render(newValue);
                });

                // Add the checkboxList to the DOM, and compile it
                elem.replaceWith(checkboxList);
                $compile(checkboxList)($scope);

                // Set initial value
                render(elem.val());
            };

            return {
                restrict: 'A',
                scope: true,
                require: 'ngModel',
                link: link
            };
        }
    ]);

    // ========================================================================
    /**
     * Simple generic JSON input widget <em-wizard-json-widget>
     * - default widget for 'json' fields
     * - uses the isJson directive for parsing/formatting and validation
     */
    EdenMobile.directive('emWizardJsonWidget', [
        '$compile',
        function($compile) {

            var link = function($scope, elem, attr) {

                // Create the widget
                var widget = angular.element('<textarea class="json-input" rows="5" cols="60">');

                // Set the name
                var fieldName = attr.field;
                if (fieldName) {
                    widget.attr('name', fieldName);
                }

                // Widget attributes and directives
                copyAttr(attr, widget, [
                    'ngModel',
                    'disabled',
                    'ngRequired',
                    'isJson'    // copy applicable validators
                ]);

                // Add widget to DOM and compile it against scope
                elem.replaceWith(widget);
                $compile(widget)($scope);
            };

            return {
                link: link
            };
        }
    ]);

})(EdenMobile);

// END ========================================================================
