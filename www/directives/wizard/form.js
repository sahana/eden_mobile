/**
 * Sahana Eden Mobile - Wizard Form Directives
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
     */
    EdenMobile.directive('emFormSection', [
        '$compile', 'emDisplayLogic',
        function($compile, emDisplayLogic) {

            var renderSection = function($scope, elem, attr) {

                // Get the section config
                var sectionConfig = $scope.sectionConfig;
                if (!sectionConfig) {
                    return;
                }

                // Create the form
                var formName = attr.formName || 'wizard',
                    form = angular.element('<form>')
                                  .attr('name', formName)
                                  .attr('novalidate', 'novalidate');

                // Required-answers hint
                var requiredHint = angular.element('<div class="required-hint">')
                                          .text('* = answer required')
                                          .attr('ng-if', 'formStatus.hasRequired');
                form.append(requiredHint);
                $scope.formStatus.hasRequired = false;

                // Generate the form rows for this section
                var formRows = angular.element('<div class="list">'),
                    displayLogic = {};
                sectionConfig.forEach(function(formElement, index) {

                    var formRow;
                    switch(formElement.type) {
                        case 'input':
                            formRow = angular.element('<em-form-row>')
                                             .attr('formname', formName)
                                             .attr('field', formElement.field);
                            break;
                        case 'instructions':
                            formRow = angular.element('<em-instructions>');
                            var instruction;
                            if (formElement.do) {
                                instruction = angular.element('<do>').text(formElement.do);
                                formRow.append(instruction);
                            }
                            if (formElement.say) {
                                instruction = angular.element('<say>').text(formElement.say);
                                formRow.append(instruction);
                            }
                            break;
                        default:
                            break;
                    }

                    if (!formRow) {
                        return;
                    }

                    // Add display logic for this formElement
                    var displayRule = formElement.displayLogic;
                    if (displayRule) {
                        var dlID = 'dl' + index;
                        displayLogic[dlID] = new emDisplayLogic($scope.form,
                                                                formElement.field,
                                                                displayRule);
                        formRow.attr('display-logic', dlID);
                    }

                    // Append form row to container
                    formRows.append(formRow);
                });
                form.append(formRows);

                // Add display logic to scope
                $scope.displayLogic = displayLogic;

                // Add form to DOM and compile it against scope
                elem.replaceWith(form);
                $compile(form)($scope);
            };

            return {
                link: renderSection
            };
        }
    ]);

    // ========================================================================
    /**
     * Directive for <em-form-row>:
     *   - a form row with label and input widget etc.
     */
    EdenMobile.directive('emFormRow', [
        '$compile', 'emFormStyle', 'emFormWizard', 'emValidate',
        function($compile, emFormStyle, emFormWizard, emValidate) {

            var renderFormRow = function($scope, elem, attr) {

                // Get the resource from (parent) scope
                var resource = $scope.resource;
                if (!resource) {
                    return;
                }

                // Get the field
                var fieldName = attr.field,
                    field = resource.fields[fieldName];
                if (!field) {
                    return;
                }

                // Generate the widget and bind it to form
                var formName = attr.formname || 'wizard',
                    prefix = attr.prefix || 'form',
                    widget = emFormWizard.getWidget(field)
                                         .attr('ng-model', prefix + '.' + fieldName);

                // Add validator directives
                // - widgets must apply those to the actual inputs
                var validate = emValidate.getDirectives(field),
                    markRequired = false,
                    errors = [];
                if (validate) {
                    validate.forEach(function(validation) {

                        var directives = validation.directives,
                            directive;
                        for (directive in directives) {
                            widget.attr(directive, directives[directive]);
                            if (directive == 'ng-required') {
                                markRequired = true;
                            }
                        }

                        var showOn = validation.errors.map(function(cond) {
                            return formName + '.' + fieldName + '.$error.' + cond;
                        }).join(' || ');
                        errors.push({showOn: showOn, msg: validation.message});
                    });
                }

                // Use emFormStyle to render the form row
                var formRow = emFormStyle.formRow(formName,
                                                  field.getLabel(),
                                                  emFormWizard.getImage(field),
                                                  widget,
                                                  errors,
                                                  markRequired);
                if (markRequired) {
                    $scope.formStatus.hasRequired = true;
                }

                // Display logic and required
                // - skip display logic if field is marked as required
                var fieldDescription = field._description;
                if (!fieldDescription.required) {
                    // Otherwise, apply display logic if defined
                    var dlID = attr.displayLogic;
                    if (dlID) {
                        var showIf = 'displayLogic["' + dlID + '"].show()';
                        formRow.attr('ng-show', showIf);
                        // If field has isNotEmpty
                        // => apply same logic for ngRequired as for ngShow
                        if (widget.attr('ng-required')) {
                            widget.attr('ng-required', showIf);
                        }
                    }
                }

                // Add form row to DOM and compile it
                elem.replaceWith(formRow);
                $compile(formRow)($scope);
            };

            return {
                link: renderFormRow
            };
        }
    ]);

    // ========================================================================
    /**
     * Directive for <em-instructions>
     *   - data collector instructions
     */
    EdenMobile.directive('emInstructions', [
        '$compile',
        function($compile) {

            var link = function($scope, elem, attr) {

                var card = angular.element('<div class="card padding data-collector-instructions">'),
                    header = angular.element('<h4>Instructions</h4>'),
                    instruction,
                    content;

                card.append(header);

                instruction = elem.find('do').text();
                if (instruction) {
                    content = angular.element('<p class="do">').text(instruction);
                    card.append(content);
                }

                instruction = elem.find('say').text();
                if (instruction) {
                    content = angular.element('<p class="say">').text('"' + instruction + '"');
                    card.append(content);
                }

                // Link to display logic if required
                var dlID = attr.displayLogic;
                if (dlID) {
                    card.attr('ng-show', 'displayLogic["' + dlID + '"].show()');
                }

                // Add card to DOM and compile it against scope
                elem.replaceWith(card);
                $compile(card)($scope);
            };

            return {
                link: link
            };
        }
    ]);

    // ========================================================================
    /**
     * Directive for <em-form-row-image>
     * - display an image for a survey question
     */
    EdenMobile.directive('emFormRowImage', [
        '$compile',
        function($compile) {

            var link = function($scope, elem, attr) {
                var fileURI = attr.image;
                if (fileURI) {
                    var image = angular.element('<img>')
                                       .attr('src', fileURI),
                        widget = angular.element('<div class="form-row-image">')
                                        .append(image);

                    // Add to DOM and compile against scope
                    elem.replaceWith(widget);
                    $compile(widget)($scope);
                }
            };

            return {
                link: link
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

})(EdenMobile);

// END ========================================================================
