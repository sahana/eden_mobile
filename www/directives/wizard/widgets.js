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
        '$compile',
        function($compile) {

            var renderWidget = function($scope, elem, attr) {

                // TODO this should not render any input element (for now)

                // Create the widget
                var widget = angular.element('<input>')
                                    .attr('type', attr.type || 'text');

                // Input attributes
                copyAttr(attr, widget, [
                    'ngModel',
                    'disabled',
                    'placeholder'
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
     * Boolean Widget <em-wizard-boolean-widget>
     */
    EdenMobile.directive('emWizardBooleanWidget', [
        '$compile',
        function($compile) {

            var renderWidget = function($scope, elem, attr) {

                // Build the widget
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

                // Widget attributes
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

                // Input attributes
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
     * Number widget <em-wizard-number-widget>
     */
    EdenMobile.directive('emWizardNumberWidget', [
        '$compile',
        function($compile) {

            var renderWidget = function($scope, elem, attr) {

                // Create the widget
                var widget = angular.element('<input type="number">');

                // Input attributes
                copyAttr(attr, widget, [
                    'ngModel',
                    'disabled',
                    'placeholder'
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

                // Input attributes
                copyAttr(attr, widget, [
                    'ngModel',
                    'disabled',
                    'placeholder'
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

                // Input attributes
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

                // Copy attributes
                copyAttr(attr, widget, [
                    'ngModel',
                    'disabled',
                    'isJson'      // copy applicable validators
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
