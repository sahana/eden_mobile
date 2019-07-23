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
     * Directive for <em-form-section>:
     *   - a section of a form
     *
     * TODO rename into em-wizard-section
     * TODO use grid-style, not list
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
                    // TODO no container required, use grid rows
                    formRows = angular.element('<div class="list">');

                sectionConfig.forEach(function(formElement, index) {
                    if (formElement.type == 'input') {
                        // Append a formRow directive
                        // TODO pass field name (resource in scope)
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
     * Directive for <em-wizard-header>:
     *   - the top bar in the wizard view
     */
    EdenMobile.directive('emWizardHeader', function() {
        return {
            //link: renderHeader,
            templateUrl: 'views/wizard/header.html'
        };
    });

    // ========================================================================
    /**
     * Directive for <em-wizard-submit>:
     *   - the next/submit button row at the end of a form section
     */
    EdenMobile.directive('emWizardSubmit', function() {
        return {
            templateUrl: 'views/wizard/submit.html'
        };
    });

    // ========================================================================
    /**
     * Directive for <em-form-row>:
     *   - a form row with label and input widget etc.
     *
     * TODO rename into em-wizard-row
     */
    EdenMobile.directive('emFormRow', [
        '$compile', 'emFormStyle', 'emFormWizard',
        function($compile, emFormStyle, emFormWizard) {

            var renderFormRow = function($scope, elem, attr) {

                // TODO don't pass index, but fieldName
                var sectionConfig = $scope.sectionConfig,
                    index = attr.index - 0,
                    formElement = sectionConfig[index],
                    fieldName = formElement.field;

                // TODO catch undefined resource and nonexistent field
                var resource = $scope.resource,
                    field = resource.fields[fieldName],
                    label = field.getLabel();

                // Generate the widget and bind it to formData
                // TODO catch undefined formData and/or make scope prefix configurable
                var widget = emFormWizard.getWidget(field);
                widget.attr('ng-model', 'formData.' + fieldName);

                // Use emFormStyle to render the form row
                // TODO: - comment (=description)
                //       - image
                //       - display logic (probably better to handle in controller)
                var formRow = emFormStyle.formRow(label, widget);

                var compiled = $compile(formRow)($scope);
                elem.replaceWith(compiled);
            };

            return {
                link: renderFormRow
            };
        }
    ]);

})(EdenMobile);

// END ========================================================================
