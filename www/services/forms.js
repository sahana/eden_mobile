/**
 * Sahana Eden Mobile - Form Builder
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

// ============================================================================
/**
 * emForms - Service to generate forms from schemas
 *
 * @class emForms
 * @memberof EdenMobile
 */
EdenMobile.factory('emForms', [
    function () {

        // ====================================================================
        /**
         * Build a form widget, applying em-*-widget directives
         *
         * @param {object} field - the field parameters (from schema)
         * @param {object} attr - attributes for the widget
         */
        var createWidget = function(field, attr) {

            var fieldType = field.type,
                writable = field.writable,
                widgetType;

            // @todo: ability to override the widget

            var options = field.getOptions();
            if (options) {
                widgetType = '<em-options-widget>';
            } else {
                switch(fieldType) {
                    case 'boolean':
                        widgetType = '<em-boolean-widget>';
                        break;
                    case 'date':
                        widgetType = '<em-date-widget>';
                        break;
                    case 'double':
                    case 'integer':
                        widgetType = '<em-number-widget>';
                        break;
                    case 'password':
                        widgetType = '<em-text-widget type="password">';
                        break;
                    default:
                        widgetType = '<em-text-widget>';
                        break;
                }
            }

            if (writable === false) {
                attr.disabled = 'disabled';
            }

            var widget = angular.element(widgetType);

            // Apply widget attributes
            if (attr) {
                for (var a in attr) {
                    widget.attr(a, attr[a]);
                }
            }
            return widget;
        };


        // ====================================================================
        /**
         * Form constructor - class to generate form HTML
         *
         * @param {Resource} resource - the resource the form is for
         * @param {Array} fieldNames - list of field names to render in
         *                             the form (in order of appearance)
         */
        function Form(resource, fieldNames) {

            this.resource = resource;

            if (fieldNames) {
                this.fieldNames = fieldNames;
            } else {
                this.fieldNames = resource.form;
            }
        }

        // --------------------------------------------------------------------
        /**
         * Render the form
         *
         * @param {string} scopeName - name of the scope object
         *                             holding the form data (default: 'form')
         * @returns {DOMNode} - the angular-enhanced DOM node for the form
         */
        Form.prototype.render = function(scopeName) {

            if (!scopeName) {
                scopeName = 'form';
            }

            var resource = this.resource,
                fieldNames = this.fieldNames,
                form = angular.element('<form>')
                              .attr('name', 'data')
                              .attr('novalidate', 'novalidate'),
                formRows = angular.element('<div class="list">');


            // Determine form fields
            var fieldName,
                field;
            if (!fieldNames) {
                fieldNames = [];
                for (fieldName in resource.fields) {
                    field = resource.fields[fieldName];
                    if (field.readable || field.writable) {
                        fieldNames.push(fieldName);
                    }
                }
            }

            var description,
                attributes,
                options,
                placeholder,
                widget;
            fieldNames.forEach(function(fieldName) {
                field = resource.fields[fieldName];
                if (field) {
                    description = field._description;

                    if (!field.readable) {
                        return;
                    }

                    // Label and model-link
                    attributes = {
                        'label': description.label || fieldName,
                        'ng-model': scopeName + '.' + fieldName
                    };

                    // Options (for options widget)
                    options = field.getOptions();
                    if (options) {
                        attributes.options = JSON.stringify(options);
                    }

                    // Placeholder (for text input)
                    placeholder = description.placeholder;
                    if (placeholder) {
                        attributes.placeholder = placeholder;
                    }

                    // Instantiate the widget and append it to form rows
                    widget = createWidget(field, attributes);
                    formRows.append(widget);
                }
            });

            return form.append(formRows);
        };

        // ====================================================================
        var api = {

            /**
             * Form API
             *
             * @param {object} schema - the table schema for the form
             * @param {Array} fields - list of field names to render in
             *                         the form (in order of appearance)
             * @returns {instance} - a Form instance
             */
            form: function(schema, fields) {
                return new Form(schema, fields);
            },

            /**
             * Create a widget for a field
             *
             * @param {object} field - the field definition
             * @param {object} attr - the widget attributes
             */
            widget: function(field, attr) {
                return createWidget(field, attr);
            }
        };
        return api;
    }
]);

// END ========================================================================
