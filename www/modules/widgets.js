/**
 * Sahana Eden Mobile - Standard Form Widgets
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

(function() {

    /**
     * @todo: docstring
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

    /**
     * @todo: docstring
     */
    EdenMobile.directive('emTextWidget', [
        '$compile',
        function($compile) {

            /**
            * Widget renderer
            *
            * @param {object} $scope - reference to the current scope
            * @param {DOMNode} elem - the angular-enhanced DOM node for
            *                         the element applying the directive
            * @param {object} attr - object containing the attributes of
            *                        the element
            */
            var renderWidget = function($scope, elem, attr) {

                // Create the label
                var label = angular.element('<span>')
                                   .addClass('input-label')
                                   .html(attr.label || '');

                // Create the input
                var input = angular.element('<input>')
                                   .attr('type', attr.type || 'text');

                // Input attributes
                copyAttr(attr, input, [
                    'ngModel',
                    'disabled',
                    'placeholder'
                ]);

                // Build the widget
                var widget = angular.element('<label>')
                                    .addClass('item item-input item-stacked-label')
                                    .append(label)
                                    .append(input);

                // Compile the widget against the scope, then
                // render it in place of the directive
                var compiled = $compile(widget)($scope);
                elem.replaceWith(compiled);
            };

            return {
                link: renderWidget
            };
        }
    ]);

    /**
     * @todo: docstring
     */
    EdenMobile.directive('emDateWidget', [
        '$compile',
        function($compile) {

            /**
            * Widget renderer
            *
            * @param {object} $scope - reference to the current scope
            * @param {DOMNode} elem - the angular-enhanced DOM node for
            *                         the element applying the directive
            * @param {object} attr - object containing the attributes of
            *                        the element
            */
            var renderWidget = function($scope, elem, attr) {

                // Create the label
                var label = angular.element('<span>')
                                   .addClass('input-label')
                                   .html(attr.label || '');

                // Create the input
                var input = angular.element('<input>')
                                   .attr('type', 'date');

                // Input attributes
                copyAttr(attr, input, [
                    'ngModel',
                    'disabled',
                ]);

                // Build the widget
                var widget = angular.element('<label>')
                                    .addClass('item item-input item-stacked-label')
                                    .append(label)
                                    .append(input);

                // Compile the widget against the scope, then
                // render it in place of the directive
                var compiled = $compile(widget)($scope);
                elem.replaceWith(compiled);
            };

            return {
                link: renderWidget
            };
        }
    ]);

}());
