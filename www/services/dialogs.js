/**
 * Sahana Eden Mobile - Common Dialogs Service
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
 * emDialogs - Service providing common dialogs
 *
 * @class emDialogs
 * @memberof EdenMobile
 */
EdenMobile.factory('emDialogs', [
    '$ionicModal', '$ionicPopover', '$ionicPopup', '$rootScope', '$timeout',
    function ($ionicModal, $ionicPopover, $ionicPopup, $rootScope, $timeout) {

        "use strict";

        // ====================================================================
        /**
         * A simple, self-closing confirmation message popup
         *
         * @param {string} msg - the message to show
         * @param {function} callback - callback function to execute
         *                              after closing the popup
         */
        var confirmation = function(msg, callback) {

            var confirmationPopup = $ionicPopup.show({
                title: msg
            });

            // auto-hide after 800ms
            $timeout(function() {
                confirmationPopup.close();
                if (callback) {
                    callback();
                }
            }, 800);
        };

        // ====================================================================
        /**
         * An error popup requiring user confirmation
         *
         * @param {string} message - the error message to show
         * @param {string} explanation - an explanation to show
         * @param {function} callback - callback function to execute
         *                              after closing the popup
         */
        var error = function(message, explanation, callback) {

            $ionicPopup.show({
                title: message || 'Error',
                subTitle: explanation,
                buttons: [
                    {
                        text: '<b>Close</b>',
                        type: 'button-positive',
                        onTap: function() {
                            if (callback) {
                                callback();
                            }
                        }
                    }
                ]
            });
        };

        // ====================================================================
        /**
         * A popup asking for user confirmation of a system action
         *
         * @param {string} title - title describing the action to confirm
         * @param {string} question - the question to ask
         * @param {object} options - additional options (optional):
         *   @property {string} options.cancelText - the text for the cancel button
         *   @property {string} options.cancelType - the CSS class for the cancel button
         *   @property {string} options.okText - the text for the OK button
         *   @property {string} options.okType - the CSS class for the OK button
         * @param {function} actionCallback - callback function to execute
         *                                    if the user confirms the action
         * @param {function} cancelCallback - callback function to execute
         *                                    if the user cancels the action
         */
        var confirmAction = function(title, question, options, actionCallback, cancelCallback) {

            // Variable argument list (options can be omitted)
            if (typeof options == 'function') {
                cancelCallback = actionCallback;
                actionCallback = options;
                options = {};
            }

            var confirmOptions = angular.extend({}, {
                title: title,
                template: question
            }, options);

            $ionicPopup.confirm(confirmOptions).then(function(response) {
                if (response) {
                    // User confirmed action
                    if (actionCallback) {
                        actionCallback();
                    }
                } else {
                    // User cancelled action
                    if (cancelCallback) {
                        cancelCallback();
                    }
                }
            });
        };

        // ====================================================================
        /**
         * A popup prompting for a single string input
         *
         * @param {string} title - title describing the action to confirm
         * @param {string} question - the question to ask
         * @param {object} options - options for the input:
         *                           - inputType: 'text', 'password', ...
         *                           - inputPlaceholder: placeholder text
         *                           - defaultText: default value
         *                           - onValidation: callback function to validate
         *                                           the input, takes the value as
         *                                           parameter and returns
         *                                           valid=[true|false]
         * @param {function} actionCallback - callback function to execute
         *                                    if the user submits the input,
         *                                    function(inputValue)
         * @param {function} cancelCallback - callback function to execute
         *                                    if the user cancels the dialog,
         *                                    takes no parameters
         */
        var stringInput = function(title, question, options, actionCallback, cancelCallback) {

            // Use a separate scope for the dialog
            var scope = $rootScope.$new(),
                data = {'invalid': false};

            if (options === undefined) {
                options = {};
            }
            if (options.defaultText) {
                data.input = options.defaultText;
            }
            scope.data = data;

            // Input template
            var inputType = options.inputType || 'text',
                template = '<input type="' + inputType + '" placeholder="' + options.inputPlaceholder + '" ng-model="data.input"><div class="error" ng-show="data.invalid">Invalid!</div>';

            $ionicPopup.show({
                scope: scope,
                template: template,
                title: title,
                subTitle: question,
                buttons: [{
                    text: 'Cancel',
                    type: 'button-default',
                    onTap: function() {
                        if (cancelCallback) {
                            cancelCallback();
                        }
                    }
                  }, {
                    text: 'OK',
                    type: 'button-positive',
                    onTap: function(e) {
                        var inputValue = scope.data.input,
                            valid = true;
                        if (options.onValidation) {
                            valid = options.onValidation(inputValue);
                        }
                        if (valid) {
                            scope.data.invalid = false;
                            if (actionCallback) {
                                actionCallback(inputValue);
                            }
                        } else {
                            scope.data.invalid = true;
                            e.preventDefault();
                        }
                    }
                }]
            });
        };

        // ====================================================================
        /**
         * A popup to enter username and password
         *
         * @param {string} name - the server name or URL to indicate to the user
         * @param {string} msg - reason for the input request
         * @param {object} credentials - the previous credentials
         * @param {string} credentials.username - the previous username
         * @param {string} credentials.password - the previous password
         * @param {function} actionCallback - callback function to invoke when
         *                                    new credentials have been entered,
         *                                    function(username, password)
         * @param {function} cancelCallback - callback function to invoke when
         *                                    the user cancels the input
         */
        var authPrompt = function(name, msg, credentials, actionCallback, cancelCallback) {

            // Use a separate scope for the dialog
            var scope = $rootScope.$new();
            scope.login = credentials || {};

            var authPrompt = $ionicPopup.show({

                templateUrl: 'views/dialogs/authform.html',
                title: msg || 'Authentication required',
                subTitle: name,
                scope: scope,
                buttons: [
                    {
                        text: 'Cancel',
                        onTap: function() {
                            if (cancelCallback) {
                                cancelCallback();
                            }
                        }
                    },
                    {
                        text: '<b>Send</b>',
                        type: 'button-positive',
                        onTap: function(e) {
                            var login = scope.login;
                            if (!login.username || !login.password) {
                                e.preventDefault();
                            } else {
                                if (actionCallback) {
                                    actionCallback(login.username, login.password);
                                }
                            }
                        }
                    }
                ]
            });
            return authPrompt;
        };

        // ====================================================================
        /**
         * A modal to view a picture (used by emPhotoWidget)
         *
         * @param {string} fileURI - the file URI
         */
        var viewPicture = function(fileURI) {

            var scope = $rootScope.$new();

            scope.fileURI = fileURI;

            $ionicModal.fromTemplateUrl('views/dialogs/view_picture.html', {
                scope: scope,
                animation: 'slide-in-up'
            }).then(function(modal) {

                scope.modal = modal;

                scope.openModal = function() {
                    scope.modal.show();
                };
                scope.closeModal = function() {
                    scope.modal.hide();
                };
                scope.$on('$destroy', function() {
                    scope.modal.remove();
                });

                scope.openModal();
            });
        };

        // ====================================================================
        /**
         * A drop-down of components, for single-record views
         *
         * @param {scope} $scope: the scope of the record view
         * @param {event} $event: the event triggering the drop-down
         * @param {Resource} resource: the master resource
         *
         * @todo: calculate height of componentMenu (60px per item)
         */
        var componentMenu = function($scope, $event, resource) {

            // => Scope structures used (provided by controller):
            // $scope.resourceName....the name of the master resource
            // $scope.recordID........the master record ID
            // $scope.hasComponents...whether the resource has components
            //
            // => Scope structures provided (used by view):
            // $scope.components......array of component definitions
            // $scope.componentMenu...the component menu (ionicPopover)

            if (!$scope.hasComponents) {
                return;
            }

            if ($scope.componentMenu) {

                // Already rendered, just show it
                $scope.componentMenu.show($event);

            } else {

                // Add components to scope
                var components = [],
                    description,
                    title;

                for (var alias in resource.activeComponents) {
                    description = resource.activeComponents[alias];
                    if (description.multiple) {
                        title = description.plural || description.label || alias;
                    } else {
                        title = description.label || description.plural || alias;
                    }
                    components.push({
                        title: title,
                        name: alias
                    });
                }
                $scope.components = components;

                // Render component menu
                $ionicPopover.fromTemplateUrl('views/dialogs/component_menu.html', {
                    scope: $scope
                }).then(function(menu) {

                    // Bring into scope
                    $scope.componentMenu = menu;

                    // Remove component menu when scope gets destroyed
                    $scope.$on('$destroy', function() {
                        if ($scope.componentMenu) {
                            $scope.componentMenu.remove();
                            $scope.componentMenu = null;
                        }
                    });

                    // Show it now
                    menu.show($event);
                });
            }
        };

        // ====================================================================
        // The emDialogs API
        //
        var dialogs = {

            confirmation: confirmation,
            error: error,
            confirmAction: confirmAction,
            stringInput: stringInput,
            authPrompt: authPrompt,
            viewPicture: viewPicture,
            componentMenu: componentMenu
        };

        return dialogs;
    }
]);

// END ========================================================================
