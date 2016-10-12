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

EdenMobile.factory('emForms', [
    function () {

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

            if (writable || typeof writable == 'undefined') {
                switch(fieldType) {
                    case 'boolean':
                        widgetType = '<em-boolean-widget>';
                        break;
                    case 'date':
                        widgetType = '<em-date-widget>';
                        break;
                    case 'password':
                        widgetType = '<em-text-widget type="password">';
                        break;
                    default:
                        widgetType = '<em-text-widget>';
                        break;
                }
            } else {
                widgetType = '<em-text-widget>';
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


        /**
         * Form API
         *
         * @param {object} schema - the table schema for the form
         * @param {Array} fields - list of field names to render in
         *                         the form (in order of appearance)
         */
        function Form(schema, fields) {

            var self = this;
            self.schema = schema;

            if (fields) {
                // Use field list as specified
                self.fields = fields;
            } else {
                // Use _form attribute in schema
                self.fields = schema._form;
            }

            /**
             * Render the form
             *
             * @param {string} scopeName - name of the scope object
             *                             holding the form data (default: 'form')
             * @returns {DOMNode} - the angular-enhanced DOM node for the form
             */
            self.render = function(scopeName) {

                if (!scopeName) {
                    scopeName = 'form';
                }

                var form = angular.element('<form>')
                                .attr('name', 'data')
                                .attr('novalidate', 'novalidate'),
                    formRows = angular.element('<div class="list">'),
                    fields = self.fields,
                    schema = self.schema,
                    widget,
                    fieldName,
                    fieldParameters,
                    fieldAttr,
                    placeholder;


                // Determine form fields
                if (!fields) {

                    var field,
                        readable,
                        writable;

                    // Lookup readable/writable fields from schema
                    fields = [];
                    for (fieldName in schema) {
                        if (fieldName[0] != '_') {
                            field = schema[fieldName];
                            readable = field.readable;
                            writable = field.writable;
                            if (readable !== false || writable) {
                                fields.push(fieldName);
                            }
                        }
                    }
                }

                // Create widgets
                for (var i=0, len=fields.length; i<len; i++) {

                    fieldName = fields[i];
                    fieldParameters = schema[fieldName];

                    if (fieldParameters) {
                        placeholder = fieldParameters.placeholder;
                        fieldAttr = {
                            'label': fieldParameters.label,
                            'ng-model': scopeName + '.' + fieldName
                        };
                        if (placeholder) {
                            fieldAttr.placeholder = placeholder;
                        }
                        widget = createWidget(fieldParameters, fieldAttr);
                        formRows.append(widget);
                    }
                }
                return form.append(formRows);
            };

        }

        /**
         * Expose API
         */
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
             * @todo: docstring
             */
            widget: function(field, attr) {
                return createWidget(field, attr);
            }
        };
        return api;
    }
]);

