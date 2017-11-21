/**
 * Sahana Eden Mobile - Standard Form Widgets
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

(function() {

    // ========================================================================
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

    // ========================================================================
    /**
     * Text input widget (directive)
     *
     * @class emTextWidget
     * @memberof EdenMobile
     *
     * @param {string} type - the input type ('text'|'password'), default 'text'
     *
     * @returns {string} - the text entered (or null if empty)
     *
     * @example <em-text-widget type='password'>
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

    // ========================================================================
    /**
     * Numeric input widget (directive)
     *
     * @class emNumberWidget
     * @memberof EdenMobile
     *
     * @returns {string} - the text entered (or null if empty)
     *
     * @example <em-number-widget>
     */
    EdenMobile.directive('emNumberWidget', [
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
                var input = angular.element('<input type="number">');

                // Input attributes
                copyAttr(attr, input, [
                    'ngChange',
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

    // ========================================================================
    /**
     * Date picker widget (directive)
     *
     * @class emDateWidget
     * @memberof EdenMobile
     *
     * @returns {Date} - the selected date
     *
     * @example <em-date-widget>
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

    // ========================================================================
    /**
     * Checkbox (=toggle) widget (directive)
     *
     * @class emBooleanWidget
     * @memberof EdenMobile
     *
     * @returns {boolean} - true|false
     *
     * @example <em-boolean-widget>
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

                // Build the widget
                if (attr.widget == 'checkbox') {
                    // Checkbox
                    var widget = angular.element('<ion-checkbox>')
                                        .addClass('item')
                                        .html(attr.label || '');
                } else {
                    // Default: Toggle
                    var widget = angular.element('<ion-toggle>')
                                        .addClass('item item-toggle')
                                        .attr('toggle-class', 'toggle-positive')
                                        .html(attr.label || '');
                }

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

    // ========================================================================
    /**
     * Single-SELECT options widget (directive)
     *
     * @class emOptionsWidget
     * @memberof EdenMobile
     *
     * @param resource - the resource name
     * @param field - the field name
     *
     * @returns {integer} - the selected option
     *
     * @example <em-options-widget resource="resourceName" field="fieldName">
     */
    EdenMobile.directive('emOptionsWidget', [
        '$compile', 'emResources',
        function($compile, emResources) {

            /**
             * Options look-up
             *
             * @param {string} resourceName - the resource name
             * @param {string} fieldName - the field name
             * @param {function} callback - callback function to receive the
             *                              options (as object), callback(options)
             */
            var options = function(resourceName, fieldName, callback) {

                emResources.open(resourceName).then(function(resource) {

                    if (resource) {
                        var field = resource.fields[fieldName];
                        if (field) {
                            field.getOptions().then(function(options) {
                                if (callback) {
                                    callback(options);
                                }
                            });
                            return;
                        }
                    }
                    if (callback) {
                        callback();
                    }
                });
            };

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

                // Build the base widget
                var widget = angular.element('<label>')
                                    .addClass('item item-input item-stacked-label')
                                    .append(label);

                // Look up the field options
                options(attr.resource, attr.field, function(opts) {

                    // Append the options to the widget
                    var input,
                        name = attr.resource + '-' + attr.field;

                    opts.forEach(function(opt) {

                        input = angular.element('<ion-radio>')
                                       .attr('name', name)
                                       .attr('value', opt[0])
                                       .html(opt[1] || '');

                        // Input attributes
                        copyAttr(attr, input, [
                            'ngModel',
                            'disabled'
                        ]);

                        widget.append(input);
                    });

                    // Compile the widget against the scope, then
                    // render it in place of the directive
                    var compiled = $compile(widget)($scope);
                    elem.replaceWith(compiled);
                });
            };

            return {
                link: renderWidget
            };
        }
    ]);

    // ========================================================================
    /**
     * Photo widget (directive)
     *
     * @class emPhotoWidget
     * @memberof EdenMobile
     *
     * @returns {string} - the path to the file
     *
     * @example <em-photo-widget>
     */
    EdenMobile.directive('emPhotoWidget', [
        '$compile', '$parse', 'emDialogs', 'emFiles',
        function($compile, $parse, emDialogs, emFiles) {

            // ----------------------------------------------------------------
            /**
             * Take a picture with the device's camera
             *
             * @param {scope} $scope - the scope of the form
             * @param {string} target - the target scope expression
             *
             * @todo: handle shutdown/resume
             */
            var getPicture = function($scope, target, resourceName, fieldName) {

                var cameraOptions = {
                    correctOrientation: true,
                    targetHeight: 1280,
                    targetWidth: 1280
                };

                navigator.camera.getPicture(
                    function(imageURI) {
                        emFiles.store(imageURI, function(newURI) {
                            // Old file is now orphaned
                            var oldURI = $scope.$eval(target);
                            if (oldURI) {
                                $scope.orphanedFiles.push(oldURI);
                            }
                            // New file is still pending until record gets saved
                            $scope.pendingFiles.push(newURI);
                            // Update scope
                            $scope.$apply(target + '="' + newURI + '"');
                        }, resourceName, fieldName);
                    },
                    function(error) {
                        alert(error);
                    },
                    cameraOptions
                );
            };

            // ----------------------------------------------------------------
            /**
             * View the full-resolution picture in a modal
             *
             * @param {scope} $scope - the scope of the form
             * @param {string} target - the target scope expression
             */
            var viewPicture = function($scope, target) {

                var fileURI = $scope.$eval(target);
                if (fileURI) {
                    emDialogs.viewPicture(fileURI);
                }
            };

            // ----------------------------------------------------------------
            /**
             * Remove the current picture
             *
             * @param {scope} $scope - the scope of the form
             * @param {string} target - the target scope expression
             */
            var removePicture = function($scope, target) {

                var fileURI = $scope.$eval(target);
                if (fileURI) {
                    emDialogs.confirmAction(
                        'Remove Picture',
                        'Are you sure you want to delete this picture?',
                        function() {
                            // Mark file as orphaned
                            $scope.orphanedFiles.push(fileURI);
                            // Update scope
                            $parse(target).assign($scope, null);
                        }
                    );
                }
            };

            // ----------------------------------------------------------------
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

                // Resource and field name
                var resourceName = attr.resource,
                    fieldName = attr.field;

                // The label
                var label = angular.element('<span class="input-label">')
                                   .html(attr.label || '');

                // Image preview and empty-message
                var source = attr.ngModel,
                    image = angular.element('<img class="photo-widget-preview">')
                                   .attr('ng-src', '{{' + source + '}}')
                                   .attr('alt', 'File not found')
                                   .attr('ng-show', '!!' + source)
                                   .attr('ng-click', 'viewPicture("' + source + '")'),
                    empty = angular.element('<span class="empty">')
                                   .attr('ng-show', '!' + source)
                                   .html('No Picture');

                // Buttons
                var cameraButton = angular.element('<button>')
                                          .addClass('button button-small button-positive icon-center ion-camera')
                                          .attr('ng-click', 'getPicture("' + source + '")'),
                    removeButton = angular.element('<button>')
                                          .addClass('button button-small button-assertive icon-center ion-close-circled')
                                          .attr('ng-click', 'removePicture("' + source + '")'),
                    buttons = angular.element('<div class="photo-widget-controls buttons">')
                                     .append(cameraButton)
                                     .append(removeButton);

                // All controls
                var controls = angular.element('<div class="item item-button-right photo-widget-preview">')
                                      .append(image)
                                      .append(empty)
                                      .append(buttons);

                // Build the widget
                var widget = angular.element('<div class="item-stacked-label item-input-inset photo-widget">')
                                    .append(label)
                                    .append(controls);

                // Install callbacks
                $scope.getPicture = function(model) {
                    getPicture($scope, model, resourceName, fieldName);
                };
                $scope.viewPicture = function(model) {
                    viewPicture($scope, model);
                };
                $scope.removePicture = function(model) {
                    removePicture($scope, model);
                };

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

    // ========================================================================
    /**
     * Config form section (directive)
     *
     * @class emConfigSection
     * @memberof EdenMobile
     *
     * @param {string} section-name - the section name
     *
     * @example <em-config-section section-name='server'>
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

    // ========================================================================
    /**
     * A widget for a configuration setting (directive). Boolean settings
     * have toggles to change them, while string-type settings provide
     * popup dialogs.
     *
     * @class emConfigWidget
     * @memberof EdenMobile
     *
     * @param {string} section-name - the section name
     * @param {string} setting-name - the setting name (key)
     *
     * @example <em-config-widget section-name='server' setting-name='url'>
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
                    onValidation = setting.onValidation,
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
                        widget = angular.element('<ion-toggle>')
                                        .addClass('item item-toggle')
                                        .attr('toggle-class', 'toggle-positive')
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
                            'inputPlaceholder': placeholder,
                            'onValidation': onValidation
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

// END ========================================================================
