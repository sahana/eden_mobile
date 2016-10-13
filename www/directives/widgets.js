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
     * Copy directive attributes to a generated element, using the
     * attribute map of the directive to map camelCase notation to
     * dash notation, e.g. ngModel becomes ng-model.
     *
     * @param {object} ngAttr - the directive's DOM attributes
     * @param {DOMNode} element - the target element
     * @param {Array} validAttr - the attributes to copy in camelCase
     *                            notation
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
     * Directive em-text-widget: a text input widget
     *
     * @param {string} type - the input type ('text'|'password'), default 'text'
     *
     * @example <em-text-widget type='password'>
     *
     * @returns {string} - the text entered (or null if empty)
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
     * Directive em-date-widget: a widget with date picker (calendar)
     *
     * @example <em-date-widget>
     *
     * @returns {Date} - the selected date
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
                    'disabled'
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
     * Directive em-boolean-widget: a checkbox widget
     *
     * @example <em-boolean-widget>
     *
     * @returns {boolean} - true|false
     */
    EdenMobile.directive('emBooleanWidget', [
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

                // Create the input
                var widget = angular.element('<ion-checkbox>')
                                    .addClass('item item-checkbox-right')
                                    .html(attr.label || '');

                // Input attributes
                copyAttr(attr, widget, [
                    'ngModel',
                    'disabled'
                ]);

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
    * Directive for config form section
    */
    EdenMobile.directive('emConfigSection', [
        '$compile', 'emSettings',
        function($compile, emSettings) {

            /**
            * Form renderer
            *
            * @param {object} $scope - reference to the current scope
            * @param {DOMNode} elem - the angular-enhanced DOM node for
            *                         the element applying the directive
            * @param {object} attr - object containing the attributes of
            *                        the element
            */
            var renderForm = function($scope, elem, attr) {

                var sectionName = attr.sectionName,
                    section = emSettings[sectionName],
                    empty = true;

                if (section === undefined) {
                    return;
                }

                // Generate the section header
                var sectionHeader = angular.element('<h3 class="item item-divider">'),
                    sectionTitle = section._title;
                if (!sectionTitle) {
                    // Fall back to section name
                    sectionTitle = sectionName;
                }
                sectionHeader.html(sectionTitle);

                // Generate the section subform
                var form = angular.element('<section>')
                                  .append(sectionHeader);

                // Generate a config widget for each entry in the section
                for (var key in section) {
                    if (key[0] == '_') {
                        continue;
                    }
                    var setting = section[key];
                    var widget = angular.element('<em-config-widget>')
                                        .attr('section-name', sectionName)
                                        .attr('setting-name', key);
                    form.append(widget);
                }

                // Compile the subform HTML against the scope,
                // then render it in place of the directive
                var compiled = $compile(form)($scope);
                elem.replaceWith(compiled);

            };

            return {
                link: renderForm
            };
        }
    ]);

    /**
     * Filter to represent a scope value in config widgets
     *
     * @example {{scopeName | emConfigRepresent}}
     *
     * @returns the represented value, or '' if empty
     */
    EdenMobile.filter('emConfigRepresent', function() {
        return function(value) {
            if (value === undefined || value === null || value === '') {
                return ' ';
            } else {
                return value;
            }
        };
    });

    /**
     * Directive em-config-widget: a read-only representation of a configuration
     * setting with a popup-dialog to change the setting
     *
     * @example <em-config-widget>
     *
     * @returns nothing (read-only)
     */
    EdenMobile.directive('emConfigWidget', [
        '$compile', 'emDialogs', 'emSettings',
        function($compile, emDialogs, emSettings) {

            var renderWidget = function(scope, elem, attr) {

                var sectionName = attr.sectionName,
                    settingName = attr.settingName;
                if (!sectionName || !settingName) {
                    return;
                }

                // Get the spec for the setting
                var section = emSettings[sectionName];
                if (!section.hasOwnProperty(settingName)) {
                    return;
                }

                var setting = section[settingName],
                    writable = true;
                if (setting === undefined || setting.readable === false) {
                    return;
                }
                if (setting.writable === false) {
                    writable = false;
                }

                var scopeName = 'settings.' + sectionName + '.' + settingName,
                    labelText = setting.label || settingName,
                    label = angular.element('<h3>')
                                   .attr('translate', labelText),
                    placeholder = setting.placeholder,
                    empty = setting.empty || 'not configured',
                    inputType = 'text',
                    widget = null,
                    listItem,
                    popup = false;

                // Construct label and input
                var dataType = setting.type || 'text';
                switch(dataType) {
                    case 'text':
                    case 'url':
                    case 'string':
                    case 'password':
                        if (dataType == 'password') {
                            inputType = 'password';
                        }
                        widget = angular.element('<input>')
                                        .attr('type', inputType)
                                        .attr('disabled', 'disabled')
                                        .attr('ng-model', scopeName);
                        if (empty) {
                            widget.attr('placeholder', empty);
                        }
                        if (!writable) {
                            widget.addClass('readonly');
                        }
                        listItem = angular.element('<div class="item">')
                                          .append(label)
                                          .append(widget);
                        popup = true;
                        break;
                    case 'boolean':
                        widget = angular.element('<ion-checkbox>')
                                        .addClass('item item-checkbox-right')
                                        .append(label)
                                        .attr('ng-model', scopeName);
                        if (!writable) {
                            widget.attr('ng-disabled', 'true');
                        }
                        if (scope.update !== undefined) {
                            widget.attr('ng-change', 'update()');
                        }
                        listItem = widget;
                        break;
                    default:
                        break;
                }


                // Attach popup
                if (popup && writable) {
                    listItem.on('click', function(event) {

                        var sectionData = scope.settings[sectionName],
                            value;
                        if (sectionData) {
                            value = sectionData[settingName];
                        }

                        var dialogOptions = {
                            'inputType': inputType,
                            'defaultText': value,
                            'inputPlaceholder': placeholder
                        };
                        emDialogs.stringInput(
                            labelText,
                            setting.help,
                            dialogOptions,
                            function(inputValue) {
                                sectionData[settingName] = inputValue;
                                var update = scope.update;
                                if (update !== undefined) {
                                    update();
                                }
                            }
                        );
                    });
                }

                // Compile the widget against the scope, then
                // render it in place of the directive
                var compiled = $compile(listItem)(scope);
                elem.replaceWith(compiled);
            };

            return {
                link: renderWidget
            };
        }
    ]);
}());
