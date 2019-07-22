/**
 * Sahana Eden Mobile - Form Wizard Directives
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
     * Directive for em-form-section
     */
    EdenMobile.directive('emFormSection', [
        '$compile',
        function($compile) {

            var renderSection = function($scope, elem) {

                // $scope is a child scope of the controller's $scope
                var sectionConfig = $scope.sectionConfig;

                // Render the form
                var form = angular.element('<form>')
                                  .attr('name', 'data')
                                  .attr('novalidate', 'novalidate'),
                    formRows = angular.element('<div class="list">');

                sectionConfig.forEach(function(formElement, index) {
                    if (formElement.type == 'input') {
                        // Append a formRow directive
                        var formRow = angular.element('<em-form-row>')
                                             .attr('index', index);
                        formRows.append(formRow);
                    }
                });

                form.append(formRows);

                // Compile the form and replace the element with the node
                if (form) {
                    var compiled = $compile(form)($scope);
                    elem.replaceWith(compiled);
                }
            };

            return {
                link: renderSection
            };
        }
    ]);

    // ========================================================================
    /**
     * Directive for em-form-row
     *
     * TODO design+implement this
     */
    EdenMobile.directive('emFormRow', [
        '$compile',
        function($compile) {

            var renderFormRow = function($scope, elem, attr) {

                var sectionConfig = $scope.sectionConfig,
                    index = attr.index - 0,
                    formElement = sectionConfig[index];

                var fieldName = formElement.field;

                var label = angular.element('<span>')
                                   .html(fieldName),
                    // TODO no such directive yet
                    input = angular.element('<em-form-widget>')
                                   .attr('field', fieldName),
                    formRow = angular.element('<label>')
                                     .addClass('item')
                                     .append(label)
                                     .append(input);

                var compiled = $compile(formRow)($scope);
                elem.replaceWith(compiled);


                // This is supposed to render a form row
                // - we need to know each element of the form row:
                //   * label (=question)
                //   * comment (=description)
                //   * image
                //   * display logic
                //   * field name
                //   * widget type

            };

            return {
                link: renderFormRow
            };
        }
    ]);

})(EdenMobile);

// END ========================================================================
