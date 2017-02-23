/**
 * Sahana Eden Mobile - Standard Popup Dialogs Service
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
 * emDialogs - Service providing popup dialogs
 *
 * @class emDialogs
 * @memberof EdenMobile
 */
EdenMobile.factory('emDialogs', [
    '$ionicPopup', '$rootScope', '$timeout',
    function ($ionicPopup, $rootScope, $timeout) {

        var dialogs = {

            // ================================================================
            /**
             * Show a confirmation popup
             *
             * @param {string} msg - the message to show
             * @param {function} callback - callback function to execute
             *                              after closing the popup
             */
            confirmation: function(msg, callback) {

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
            },

            // ================================================================
            /**
             * Show an error popup with user confirmation
             *
             * @param {string} message - the error message to show
             * @param {string} explanation - an explanation to show
             * @param {function} callback - callback function to execute
             *                              after closing the popup
             */
            error: function(message, explanation, callback) {

                var errorPopup = $ionicPopup.show({
                    title: message,
                    subTitle: explanation,
                    buttons: [
                        {
                            text: '<b>Close</b>',
                            type: 'button-positive',
                            onTap: function(e) {
                                if (callback) {
                                    callback();
                                }
                            }
                        }
                    ]
                });
            },

            // ================================================================
            /**
             * Show a popup asking for user confirmation
             *
             * @param {string} title - title describing the action to confirm
             * @param {string} question - the question to ask
             * @param {function} actionCallback - callback function to execute
             *                                    if the user confirms the action
             * @param {function} cancelCallback - callback function to execute
             *                                    if the user cancels the action
             */
            confirmAction: function(title, question, actionCallback, cancelCallback) {

                var confirmPopup = $ionicPopup.confirm({
                    title: title,
                    template: question
                });

                confirmPopup.then(function(response) {
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
            },

            // ================================================================
            /**
             * Show a popup prompting for a single string input
             *
             * @param {string} title - title describing the action to confirm
             * @param {string} question - the question to ask
             * @param {object} options - options for the input:
             *                           - inputType: 'text', 'password', ...
             *                           - inputPlaceholder: placeholder text
             *                           - defaultText: default value
             * @param {function} actionCallback - callback function to execute
             *                                    if the user submits the input,
             *                                    function(inputValue)
             * @param {function} cancelCallback - callback function to execute
             *                                    if the user cancels the dialog,
             *                                    takes no parameters
             */
            stringInput: function(title, question, options, actionCallback, cancelCallback) {

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

                var stringInput = $ionicPopup.show({
                    scope: scope,
                    template: template,
                    title: title,
                    subTitle: question,
                    buttons: [{
                        text: 'Cancel',
                        type: 'button-default',
                        onTap: function(e) {
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
                                return inputValue;
                            } else {
                                scope.data.invalid = true;
                                e.preventDefault();
                            }
                        }
                    }]
                });
            },

            // ================================================================
            /**
             * Show a popup to enter username and password
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
            authPrompt: function(name, msg, credentials, actionCallback, cancelCallback) {

                // Use a separate scope for the dialog
                var scope = $rootScope.$new();
                scope.login = credentials || {};

                var authPrompt = $ionicPopup.show({

                    templateUrl: 'views/authform.html',
                    title: msg || 'Authentication required',
                    subTitle: name,
                    scope: scope,
                    buttons: [
                        {
                            text: 'Cancel',
                            onTap: function(e) {
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
            }
        };
        return dialogs;
    }
]);

// END ========================================================================
