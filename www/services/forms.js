/**
 * Sahana Eden Mobile - Form Builder
 *
 * Copyright (c) 2016-2017: Sahana Software Foundation
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
    '$compile',
    function ($compile) {

        // ====================================================================
        /**
         * Build a form widget, applying em-*-widget directives
         *
         * @param {object} field - the field parameters (from schema)
         * @param {object} attr - attributes for the widget
         */
        var createWidget = function(resource, field, attr) {

            var fieldType = field.type,
                writable = field.writable,
                widgetType;

            // @todo: ability to override the widget

            if (field.hasOptions()) {
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
                    case 'upload':
                        widgetType = '<em-photo-widget>';
                        break;
                    case 'password':
                        widgetType = '<em-text-widget type="password">';
                        break;
                    default:
                        widgetType = '<em-text-widget>';
                        break;
                }
            }

            var widget = angular.element(widgetType);

            // Pass resource and field name to widget
            widget.attr('resource', resource.name);
            widget.attr('field', field.name);

            // Set disabled when not writable
            if (writable === false) {
                widget.attr('disabled', 'disabled');
            }

            // Apply widget attributes from caller
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
         * @param {string} componentKey - the component key (if form is
         *                                for a component context, will
         *                                be hidden)
         * @param {Array} fieldNames - list of field names to render in
         *                             the form (in order of appearance),
         *                             defaults to all readable fields
         */
        function Form(resource, componentKey, fieldNames) {

            this.resource = resource;
            this.componentKey = componentKey;

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
                componentKey = this.componentKey,
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

            // SubHeadings (if-defined)
            var subheadings = resource.settings.subheadings || {};

            fieldNames.forEach(function(fieldName) {

                // Skip component key
                if (componentKey && fieldName == componentKey) {
                    return;
                }

                field = resource.fields[fieldName];
                if (field) {

                    // Field must be readable
                    if (!field.readable) {
                        return;
                    }

                    description = field._description;

                    // Label and model-link
                    var description = field._description,
                        attr = {
                            'label': description.label || fieldName,
                            'ng-model': scopeName + '.' + fieldName
                        };

                    // Placeholder (for text input)
                    var placeholder = description.placeholder;
                    if (placeholder) {
                        attr.placeholder = placeholder;
                    }

                    // Add Subheading(s) if-defined
                    var subheading = subheadings[fieldName];
                    if (subheading) {
                        if (typeof subheading == 'string' || subheading instanceof String) {
                            // 1 subheading
                            formRows.append(angular.element('<div class="subheading">').html(subheading));
                        } else {
                            // Multiple subheadings
                            var subheadingLength = subheading.length;
                            for (var i = 0; i < subheadingLength; i++) {
                                formRows.append(angular.element('<div class="subheading">').html(subheading[i]));
                            }
                        }
                    }

                    // Instantiate the widget and append it to the form rows
                    var widget = createWidget(resource, field, attr);
                    formRows.append(widget);
                }
            });

            // Add form rows to form
            return form.append(formRows);
        };

        // ====================================================================
        // The API
        //
        var api = {

            /**
             * Form API
             *
             * @param {Resource} resource - the resource
             * @param {string} componentKey - the component key (if form is
             *                                for a component context, will
             *                                be hidden)
             * @param {Array} fields - list of field names to render in
             *                         the form (in order of appearance)
             *
             * @returns {instance} - a Form instance
             */
            form: function(resource, componentKey, fields) {
                return new Form(resource, componentKey, fields);
            },

            /**
             * Create a widget for a field
             *
             * @param {object} field - the field definition
             * @param {object} attr - the widget attributes
             *
             * @returns {DOMNode} - angular-enhanced DOM node (=the widget)
             */
            widget: function(field, attr) {
                return createWidget(field, attr);
            }
        };

        return api;
    }
]);

// END ========================================================================
