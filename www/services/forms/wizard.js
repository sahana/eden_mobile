/**
 * Sahana Eden Mobile - Form Wizard
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

// ========================================================================
/**
 * emFormWizard - Service providing wizard form configurations for resources
 *
 * @class emFormWizard
 * @memberof EdenMobile.Services
 */
EdenMobile.factory('emFormWizard', [

    function () {

        "use strict";

        // --------------------------------------------------------------------
        /**
         * Process a resource form configuration, split it into wizard
         * form sections
         *
         * @param {Resource} resource - the resource
         * @returns {Array} - an array of form sections:
         *                    [{empty: true|false, final: true|false, fields: []}, ...]
         *                    where fields is an Array of objects like:
         *                    {type: 'input', field: fieldName}
         */
        var getSections = function(resource) {

            // Use resource.form, fall back to all readable fields
            var form = resource.form,
                fields = resource.fields;
            if (!form) {
                form = Object.keys(fields).filter(function(fieldName) {
                    return fields[fieldName].readable;
                });
            } else {
                form = form.slice(0);
            }

            var sections = [],
                section;

            form.forEach(function(formElement) {

                if (!formElement) {
                    return;
                } else {
                    if (!section) {
                        section = {empty: true, final: false, fields: []};
                    }

                    if (formElement.constructor === Object) {
                        // Non-input form element
                        switch(formElement.type) {
                            case 'input':
                            case 'instructions':
                                section.fields.push(formElement);
                                break;
                            case 'section-break':
                                if (!section.empty) {
                                    sections.push(section);
                                }
                                section = null;
                                break;
                            default:
                                // Ignore
                                break;
                        }
                    } else {
                        // Input widget
                        if (fields.hasOwnProperty(formElement)) {
                            section.fields.push({
                                type: 'input',
                                field: formElement
                            });
                            section.empty = false;
                        }
                    }
                }
            });

            // Append the last section
            if (section) {
                sections.push(section);
            }

            // Set final-flag for last section
            var numSections = sections.length;
            if (numSections) {
                sections[numSections - 1].final = true;
            }

            return sections;
        };

        // --------------------------------------------------------------------
        /**
         * Get a form widget for a Field
         *
         * @param {Field} field - the Field
         *
         * @returns {angular.element} - the widget
         */
        var getWidget = function(field) {

            var fieldDescription = field._description,
                fieldSettings = fieldDescription.settings,
                widgetConfig = fieldDescription.widget || fieldSettings && fieldSettings.widget;

            var fieldType = field.type,
                widgetType;
            if (widgetConfig) {
                widgetType = widgetConfig.type;
            } else {
                if (field.hasOptions()) {
                    widgetType = 'options';
                } else {
                    widgetType = fieldType;
                }
            }

            var element,
                acceptedArgs; // acceptedArgs = ['argName', ...], set per widget
            switch(widgetType) {
                case 'boolean':
                    element = '<em-wizard-boolean-widget>';
                    break;
                case 'date':
                    element = '<em-wizard-date-widget>';
                    break;
                case 'double':
                case 'integer':
                    element = '<em-wizard-number-widget>';
                    acceptedArgs = ['placeholder'];
                    break;
                case 'string':
                    element = '<em-wizard-string-widget>';
                    acceptedArgs = ['placeholder'];
                    break;
                case 'text':
                    element = '<em-wizard-text-widget>';
                    acceptedArgs = ['placeholder'];
                    break;
//                 case 'password':
//                     element = '<em-wizard-password-widget>';
//                     break;
//                 case 'upload':
//                     element = '<em-photo-widget>';
//                     break;
                case 'options':
                    element = '<em-wizard-options-widget>';
                    break;
//                 case 'likert':
//                     element = '<em-wizard-likert-widget>';
//                     break;
//                 case 'image-map':
//                     element = '<em-wizard-image-map>';
//                     break;
                case 'json':
                    element = '<em-wizard-json-widget>';
                    break;
                default:
                    element = '<em-wizard-generic-widget type="' + field.type + '">';
                    break;
            }

            var widget = angular.element(element);

            widget.attr('field', field.name);

            // Set accepted arguments from widgetConfig
            if (widgetConfig && acceptedArgs) {
                acceptedArgs.forEach(function(argName) {
                    var value = widgetConfig[argName];
                    if (value !== undefined && value !== null) {
                        widget.attr(argName, '' + value);
                    }
                });
            }

            return widget;
        };

        // --------------------------------------------------------------------
        // API
        //
        return {
            getSections: getSections,
            getWidget: getWidget
        };
    }
]);
