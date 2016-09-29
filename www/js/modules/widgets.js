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

/**
 * Simple text input widget
 */
EdenMobile.directive("emTextWidget", [
    '$compile',
    function($compile) {

        var renderWidget = function($scope, elem, attr) {

            // Create the label
            var labelText = attr['label'] || '',
                label = angular.element('<span>')
                               .addClass('input-label')
                               .html(labelText);

            // Create the text input
            var textInput = angular.element('<input type="text">'),
                model = attr['ngModel'],
                placeholder = attr['placeholder'];
            if (placeholder) {
                textInput.attr('placeholder', placeholder);
            }
            if (model) {
                textInput.attr('ng-model', model);
            }

            // Build the widget
            var widget = angular.element('<label>')
                                .addClass('item item-input item-stacked-label')
                                .append(label)
                                .append(textInput);

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
 * Simple date input widget
 */
EdenMobile.directive("emDateWidget", [
    '$compile',
    function($compile) {

        var renderWidget = function($scope, elem, attr) {

            // Create the label
            var labelText = attr['label'] || '',
                label = angular.element('<span>')
                               .addClass('input-label')
                               .html(labelText);

            // Create the text input
            var textInput = angular.element('<input type="date">'),
                model = attr['ngModel'];
            if (model) {
                textInput.attr('ng-model', model);
            }

            // Build the widget
            var widget = angular.element('<label>')
                                .addClass('item item-input item-stacked-label')
                                .append(label)
                                .append(textInput);

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
