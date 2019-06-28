/**
 * Sahana Eden Mobile - Form Builder
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

// ============================================================================
/**
 * emForms - Service to generate forms from schemas
 *
 * @class emForms
 * @memberof EdenMobile
 */
EdenMobile.factory('emForms', [
    function () {

        "use strict";

        // ====================================================================
        /**
         * Build a form widget, applying em-*-widget directives
         *
         * @param {Resource} resource - the resource the form is for
         * @param {object} field - the field parameters (from schema)
         * @param {object} attr - attributes for the widget
         */
        var createWidget = function(resource, field, attr) {

            var fieldType = field.type,
                writable = field.writable,
                widgetType,
                fieldDescription = field._description,
                custom_widget = fieldDescription.widget || (fieldDescription.settings && fieldDescription.settings.widget);

            if (field.hasOptions()) {
                if ((custom_widget === Object(custom_widget)) && custom_widget.type == "location") {
                    widgetType = '<em-location-widget>';
                } else {
                    widgetType = '<em-options-widget>';
                }
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
            widget.attr('widget', custom_widget); // Doesn't work for Objects

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

            if (!fieldNames) {

                fieldNames = [];

                var formFields = resource.form;
                if (!formFields) {
                    // Fall back to all readable fields
                    formFields = [];
                    for (var fieldName in resource.fields) {
                        if (resource.fields[fieldName].readable) {
                            formFields.push(fieldName);
                        }
                    }
                    // If no user fields exist, render llrepr (read-only)
                    // @todo: set a label
                    if (!formFields.length) {
                        formFields.push('llrepr');
                    }
                }

                for (var i = 0, len = formFields.length; i < len; i++) {
                    var field = formFields[i];
                    if (field === Object(field)) {
                        // Not just a simple field
                        if (field.type === 'dummy') {
                            // S3SQLDummyField
                            field = field.name;
                            if (field in resource.fields) {
                                // Skip
                               // @ToDo: Log error somewhere
                                continue;
                            }
                        } else {
                            // Currently Unsupported
                            continue;
                        }
                    }
                    fieldNames.push(field);
                }

            }
            this.fieldNames = fieldNames;
        }

        // --------------------------------------------------------------------
        /**
         * Render the form
         *
         * @param {string} scopeName - name of the scope object
         *                             holding the form data (default: 'form')
         * @returns {DOMNode} - the angular-enhanced DOM node for the form
         */
        Form.prototype.render = function(scopeName, $scope) {

            if (!scopeName) {
                scopeName = 'form';
            }

            var resource = this.resource,
                settings = resource.settings,
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

            var i,
                j,
                attr,
                autototals = settings.autototals || {},
                description,
                grids = settings.grids || {},
                gridChildren = [], // Fields which we skip from the normal processing
                placeholder,
                showHidden = settings.show_hidden || {},
                hides = {},
                hiddenBy,
                subheadings = settings.subheadings || {},
                widget;

            // Grids (if-defined)
            if (Object.keys(grids).length) {
                var grid,
                    table,
                    wrapper,
                    cell,
                    row,
                    row1,
                    rows,
                    rowsLength,
                    cols,
                    colsLength;
                for (grid in grids) {
                    cols = grids[grid].f;
                    colsLength = cols.length;
                    for (i = 0; i < colsLength; i++) {
                        rows = cols[i];
                        rowsLength = rows.length;
                        for (j = 0; j < rowsLength; j++) {
                            gridChildren.push(rows[j]);
                        }
                    }
                }
            }

            // showHidden (if-defined)
            if (Object.keys(showHidden).length) {
                // Invert the structure
                var h,
                    hide,
                    arrayLength;
                for (hide in showHidden) {
                    h = showHidden[hide];
                    if (h.constructor === Array) {
                        // Multiple fields
                        arrayLength = h.length;
                        for (i = 0; i < arrayLength; i++) {
                            hides[h[i]] = hide;
                        }
                    } else {
                        // Single field
                        hides[h] = hide;
                    }
                }
            }

            fieldNames.forEach(function(fieldName) {

                // Skip component key
                if (componentKey && fieldName == componentKey) {
                    return;
                }

                // Skip grid children
                if (gridChildren.indexOf(fieldName) > -1) {
                    return;
                }

                // Hidden?
                if (hides.hasOwnProperty(fieldName)) {
                    hiddenBy = scopeName + '.' + hides[fieldName];
                } else {
                    hiddenBy = false;
                }

                // Add Subheading(s) if-defined
                // TODO: use directives for subheadings
                var subheading = subheadings[fieldName];
                if (subheading) {
                    if (typeof subheading == 'string' || subheading instanceof String) {
                        // 1 subheading
                        if (hiddenBy) {
                            formRows.append(angular.element('<div class="subheading" ng-show="' + hiddenBy + '">')
                                    .html(subheading));
                        } else {
                            formRows.append(angular.element('<div class="subheading">')
                                    .html(subheading));
                        }
                    } else {
                        // Multiple subheadings
                        var subheadingLength = subheading.length;
                        if (hiddenBy) {
                            for (i = 0; i < subheadingLength; i++) {
                                formRows.append(angular.element('<div class="subheading" ng-show="' + hiddenBy + '">')
                                        .html(subheading[i]));
                            }
                        } else {
                            for (i = 0; i < subheadingLength; i++) {
                                formRows.append(angular.element('<div class="subheading">')
                                        .html(subheading[i]));
                            }
                        }
                    }
                }

                var addField = function(fieldName, withLabel) {
                    field = resource.fields[fieldName];
                    if (field) {

                        // Field must be readable
                        if (!field.readable && fieldName != 'llrepr') {
                            return;
                        }

                        // Model-link
                        attr = {
                            'ng-model': scopeName + '.' + fieldName
                        };

                        // Label
                        // TODO: make a Resource method
                        description = field._description;
                        if (withLabel) {
                            var label;
                            if (fieldName == 'llrepr') {
                                var strings = resource.strings;
                                if (strings) {
                                    label = strings.name;
                                }
                                if (!label) {
                                    label = resource.name;
                                }
                            } else {
                                label = description.label || fieldName;
                            }
                            attr.label = label;
                        }

                        // Placeholder (for text input)
                        placeholder = description.placeholder;
                        if (placeholder) {
                            attr.placeholder = placeholder;
                        }

                        // Hidden?
                        if (hiddenBy) {
                            attr['ng-show'] = hiddenBy;
                        }

                        // Auto-Totals
                        if (autototals.hasOwnProperty(fieldName)) {
                            var sumField = fieldName,
                                sources = autototals[sumField],
                                sourceFields = sources.map(function(fieldName) {
                                    return scopeName + '.' + fieldName;
                                });
                            $scope.$watchGroup(sourceFields, function(oldValues, newValues, scope) {
                                var form = scope[scopeName],
                                    total = 0,
                                    empty = true;
                                if (form) {
                                    sources.forEach(function(fieldName) {
                                        var value = form[fieldName];
                                        if (!isNaN(value - 0)) {
                                            empty = false;
                                            total += value;
                                        }
                                    });
                                    // Update sumField only if any source values
                                    // present, otherwise leave the existing total
                                    // intact
                                    if (!empty) {
                                        form[sumField] = total;
                                    }
                                }
                            });
                        }

                        // Instantiate the widget and append it to the form rows
                        widget = createWidget(resource, field, attr);
                        return widget;
                    }
                    return false;
                };

                // TODO use directives for Grid construction
                if (grids.hasOwnProperty(fieldName)) {
                    // Grid
                    // Proper TABLE is the only way to make column labels match up with cells
                    //table = angular.element('<div class="grid">');
                    if (hiddenBy) {
                        table = angular.element('<table ng-show="' + hiddenBy + '">');
                    } else {
                        table = angular.element('<table>');
                    }
                    grid = grids[fieldName];
                    colsLength = grid.c.length;
                    rowsLength = grid.r.length;
                    cols = grid.f;
                    for (i = 0; i < rowsLength; i++) {
                        if (i == 0) {
                            // Start Column Labels row with empty cell at top-left
                            //row1 = angular.element('<div class="row">');
                            row1 = angular.element('<tr>');
                            //row1.append(angular.element('<div class="col">'));
                            row1.append(angular.element('<td>'));
                            for (j = 0; j < colsLength; j++) {
                                // ...continue Column Labels row
                                //row1.append(angular.element('<div class="col th">')
                                row1.append(angular.element('<th>')
                                                   .html(grid.c[j]));
                            }
                            table.append(row1);
                        }
                        // Start Row with Row Label
                        //row = angular.element('<div class="row">');
                        row = angular.element('<tr>');
                        //row.append(angular.element('<div class="col th">')
                        row.append(angular.element('<th>')
                                          .html(grid.r[i]));
                        for (j = 0; j < colsLength; j++) {
                            // ...continue with field cells
                            fieldName = grid.f[j][i];
                            if (fieldName) {
                                if (i > 4) {
                                    // Column Labels not Visible
                                    // Use as placeholder
                                    //description = resource.fields[fieldName]._description;
                                    //description.placeholder = description.label;
                                    widget = addField(fieldName, true);
                                } else {
                                    widget = addField(fieldName, false);
                                }
                            } else {
                                widget = null;
                            }
                            //cell = angular.element('<div class="col">');
                            cell = angular.element('<td>');
                            if (widget) {
                                cell.append(widget);
                            }
                            row.append(cell);
                        }
                        table.append(row);
                    }
                    wrapper = angular.element('<div class="grid">');
                    wrapper.append(table);
                    formRows.append(wrapper);
                } else {
                    // Normal field
                    widget = addField(fieldName, true);
                    if (widget) {
                        formRows.append(widget);
                    }
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
