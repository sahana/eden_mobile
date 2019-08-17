/**
 * Sahana Eden Mobile - Auth Service
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

(function(EdenMobile) {

    "use strict";

    // ========================================================================
    // Config
    //
    var masterKeyAuth = false,
        encryptSession = false;

    // ========================================================================
    // Status
    //
    var masterKey,
        currentSession;

    // ========================================================================
    // Service Constructor
    //
    var emAuth = [
        '$injector', '$q', '$rootScope', 'emDB', 'emReset',
        function($injector, $q, $rootScope, emDB, emReset) {

            var hexlify = CryptoJS.enc.Hex.stringify,
                unhexlify = CryptoJS.enc.Hex.parse;

            // ----------------------------------------------------------------
            /**
             * Store the current session data in the database
             *
             * @returns {promise} - a promise that is resolved when the
             *                      session data are stored
             */
            var storeSession = function() {

                if (!currentSession) {
                    return $q.reject('no current session');
                }

                // Encode the session data, encrypt if required
                var sessionData = JSON.stringify(currentSession);
                if (encryptSession || masterKeyAuth) {
                    if (!masterKey) {
                        return $q.reject('no master key to encrypt session');
                    } else {
                        var cipher = CryptoJS.AES.encrypt(sessionData, masterKey).toString(),
                            hex = hexlify(CryptoJS.enc.Base64.parse(cipher)),
                            hmac = hexlify(CryptoJS.HmacSHA512(hex, masterKey));
                        sessionData = hex + '$' + hmac;
                    }
                }

                // Write session data to the DB
                var deferred = $q.defer(),
                    onSuccess = function() {
                        deferred.resolve();
                    },
                    onError = function(error) {
                        deferred.reject(error);
                    };

                emDB.table('em_session').then(function(table) {
                    table.select(['id'], {limitby: 1}, function(records) {
                        if (records.length) {
                            table.where(table.$('id').is(records[0].$('id')))
                                 .update({session_data: sessionData}, onSuccess, onError);
                        } else {
                            table.insert({session_data: sessionData}, onSuccess, onError);
                        }
                    });
                });

                return deferred.promise;
            };

            // ----------------------------------------------------------------
            /**
             * Restore a session from the database
             *
             * @param {string} key - the master key if the session is
             *                       encrypted; will be established as
             *                       current masterKey when successful
             *
             * @returns {promise} - a promise that resolves into the current
             *                      session data when the session is restored
             */
            var restoreSession = function(key) {

                var deferred = $q.defer();

                emDB.table('em_session').then(function(table) {
                    table.select(['id', 'session_data'], {limitby: 1}, function(records) {

                        if (!records.length) {
                            deferred.reject('no stored session');
                            return;
                        }

                        var sessionData;

                        if (masterKeyAuth || encryptSession) {

                            // Validate encrypted session data
                            var encrypted = records[0].$('session_data');
                            if (!encrypted) {
                                deferred.reject('invalid session data');
                                return;
                            }
                            encrypted = encrypted.split('$');
                            if (encrypted.length != 2) {
                                deferred.reject('invalid session data');
                                return;
                            }

                            // Validate key
                            if (key === undefined) {
                                deferred.reject('key required');
                            }
                            var hmac = hexlify(CryptoJS.HmacSHA512(encrypted[0], key));
                            if (encrypted[1] != hmac) {
                                deferred.reject('invalid master key');
                                return;
                            }

                            // Decrypt session data
                            var hex = encrypted[0],
                                cipher = CryptoJS.enc.Base64.stringify(unhexlify(hex)),
                                decrypted = CryptoJS.AES.decrypt(cipher, key);

                            sessionData = CryptoJS.enc.Utf8.stringify(decrypted);
                            if (sessionData) {
                                currentSession = JSON.parse(sessionData);
                            } else {
                                currentSession = {};
                            }

                            // Set masterKey
                            masterKey = key;

                        } else {

                            // Parse the stored session data
                            sessionData = records[0].$('session_data');
                            if (sessionData) {
                                currentSession = JSON.parse(sessionData);
                            } else {
                                currentSession = {};
                            }

                            // Set masterKey
                            if (key !== undefined) {
                                masterKey = key;
                            }
                        }

                        // Inform all controllers about the restored session
                        $rootScope.$broadcast('emSessionConnected');

                        deferred.resolve(currentSession);
                    });
                });

                return deferred.promise;
            };

            // ----------------------------------------------------------------
            /**
             * Establish a new session
             *
             * @param {object} sessionData - the session data
             * @param {string} key - the session master key
             *
             * @returns {promise} - a promise that is resolved when the
             *                      session is established
             */
            var createSession = function(sessionData, key) {

                masterKey = key;
                currentSession = sessionData;

                return storeSession().then(function(session) {

                    // Inform all controllers about the new session
                    $rootScope.$broadcast('emSessionConnected');

                    return session;
                });
            };

            // ----------------------------------------------------------------
            /**
             * Suspend the current session:
             * - removes the session context and master key from memory
             */
            var suspendSession = function() {

                currentSession = null;
                if (masterKeyAuth || encryptSession) {
                    masterKey = null;
                }
            };

            // ----------------------------------------------------------------
            /**
             * Delete the current session:
             * - remove the session context and master key from memory
             * - delete any stored session from the database
             *
             * @returns {promise} - a promise that is resolved when the
             *                      deletion was successful
             */
            var deleteSession = function() {

                var deferred = $q.defer();

                suspendSession();
                emDB.table('em_session').then(function(table) {
                    table.where().delete(
                        function() {
                            deferred.resolve();
                        },
                        function(error) {
                            deferred.reject(error);
                        });
                });

                return deferred.promise;
            };

            // ----------------------------------------------------------------
            /**
             * Validate a master key and return its context data
             *
             * @param {string} key - the master key; if omitted, the current
             *                       session's master key will be used if
             *                       there is an active session
             *
             * @returns {promise} - a promise that resolves into the context
             *                      data the server returned for the key
             */
            var validateMasterKey = function(key) {

                if (!key) {
                    key = masterKey;
                }

                var emServer = $injector.get('emServer'),
                    deferred = $q.defer(),
                    currentMasterKey = masterKey;

                masterKey = key;
                emServer.get(
                    emServer.URL({c: 'default', f: 'masterkey', extension: 'json'}),
                    'json',
                    function(data) {
                        if (data.masterkey_uuid) {
                            masterKey = currentMasterKey;
                            deferred.resolve(data);
                        } else {
                            masterKey = currentMasterKey;
                            deferred.reject('invalid master key context');
                        }
                    },
                    function(error) {
                        masterKey = currentMasterKey;
                        if (typeof error == 'string') {
                            deferred.reject(error);
                        } else {
                            emServer.httpError(error);
                            deferred.reject();
                        }
                    });

                return deferred.promise;
            };

            // ----------------------------------------------------------------
            /**
             * Exit the current session (suspended or not); deletes the session
             * both from memory and DB, deletes all user data and resets the app
             *
             * @returns {promise} - a promise that will be resolved when the
             *                      process is complete; then-able for e.g.
             *                      cleaning up any open dialogs that triggered
             *                      this function
             */
            var exitSession = function() {

                var deferred = $q.defer(),
                    emDialogs = $injector.get('emDialogs');

                emDialogs.confirmAction(
                    "Unlink",
                    "There are surveys waiting to be uploaded. Data will be deleted.",
                    {
                        okType: 'button-light',
                        okText: 'Unlink',
                        cancelType: 'button-assertive'
                    },
                    function() {
                        var $ionicLoading = $injector.get('$ionicLoading');
                        $ionicLoading.show({
                            template: 'Unlinking...'
                        }).then(function() {
                            deleteSession().then(function() {
                                emReset.reset().then(function() {
                                    var $state = $injector.get('$state');
                                    $ionicLoading.hide();
                                    deferred.resolve();
                                    $state.go('surveys', {}, {reload: true});
                                });
                            });
                        });
                    },
                    function() {
                        // Canceled
                        deferred.reject();
                    });

                return deferred.promise;
            };

            // ----------------------------------------------------------------
            /**
             * Prompt the user to input a master key to reconnect to a
             * suspended session, or to start a new one
             *
             * @returns {promise} - a promise that is resolved with the session
             *                      data once the prompt was successful
             *
             * NB this is a modal dialog preventing any interaction with the
             *    app until it has either successfully established a session,
             *    or exited the current (suspended) session
             */
            var sessionPrompt = function() {

                var deferred = $q.defer(),
                    scope = $rootScope.$new();

                scope.formData = {};
                scope.submitInProgress = false;
                scope.showUnlink = false;

                var suspendedSession = $q.defer();
                emDB.table('em_session').then(function(table) {
                    table.count(function(numRecords) {
                        suspendedSession.resolve(!!numRecords);
                        scope.showUnlink = !!numRecords;
                    });
                });
                scope.suspendedSession = suspendedSession.promise;

                scope.submit = function() {
                    if (scope.submitInProgress) {
                        return;
                    }
                    scope.submitInProgress = true;

                    var emDialogs = $injector.get('emDialogs');

                    var masterKey = scope.formData.masterKey;
                    scope.suspendedSession.then(function(isSuspended) {
                        if (isSuspended) {
                            // Try to restore suspended session
                            restoreSession(masterKey).then(
                                function(sessionData) {
                                    // Success
                                    scope.modal.remove();
                                    scope.submitInProgress = false;
                                    deferred.resolve(sessionData);
                                },
                                function(error) {
                                    // Error restoring session
                                    scope.submitInProgress = false;
                                    if (error) {
                                        emDialogs.error('Unauthorized', error);
                                    }
                                });
                        } else {
                            // Validate master key with server + create new session
                            validateMasterKey(masterKey).then(
                                function(sessionData) {
                                    createSession(sessionData, masterKey).then(
                                        function() {
                                            // Success
                                            scope.modal.remove();
                                            scope.submitInProgress = false;
                                            deferred.resolve(sessionData);
                                        },
                                        function(error) {
                                            // Error creating session
                                            emDialogs.error('Error', error);
                                            scope.submitInProgress = false;
                                        });
                                },
                                function(error) {
                                    // Error validating master key
                                    if (error) {
                                        emDialogs.error('Unauthorized', error);
                                    }
                                    scope.submitInProgress = false;
                                });
                        }
                    });

                };

                var $ionicModal = $injector.get('$ionicModal');
                $ionicModal.fromTemplateUrl('views/auth/session_prompt.html', {
                    scope: scope,
                    animation: 'none',
                    backdropClickToClose: false,
                    hardwareBackButtonClose: false
                }).then(function(modal) {
                    scope.modal = modal;
                    modal.show();
                    scope.unlink = function() {
                        exitSession().then(function() {
                            scope.modal.remove();
                        });
                    };
                });

                return deferred.promise;
            };

            // ----------------------------------------------------------------
            /**
             * Get the current session
             *
             * @param {boolean} noPrompt - do not prompt for master key input
             *                             if there is no current session, but
             *                             simply reject
             *
             * @returns {promise} - a promise that is resolved into the current
             *                      session data
             */
            var getSession = function(noPrompt) {

                // TODO allow auto-create session if not using master key
                if (currentSession) {
                    return $q.resolve(currentSession);
                } else if (!noPrompt) {
                    return sessionPrompt();
                } else {
                    return $q.reject();
                }
            };

            // ----------------------------------------------------------------
            // TODO docstring
            // TODO notification optional
            var onOnline = function() {

                var emDialogs = $injector.get('emDialogs');
                emDialogs.confirmation('Device is now online');

                $rootScope.$broadcast('emDeviceOnline');
            };

            document.addEventListener("online", onOnline, false);

            // ----------------------------------------------------------------
            // Service API
            //
            return {

                useMasterKey: function() {
                    return masterKeyAuth;
                },

                getMasterKey: function() {
                    return masterKey;
                },

                validateMasterKey: validateMasterKey,

                createSession: createSession,
                suspendSession: suspendSession,
                deleteSession: deleteSession,
                getSession: getSession,

                exitSession: exitSession
            };
        }
    ];

    // ========================================================================
    // Provider
    //
    EdenMobile.provider('emAuth', function() {

        // Config setters
        this.masterKeyAuth = function(setting) {
            masterKeyAuth = !!setting;
        };

        this.encryptSession = function(setting) {
            encryptSession = !!setting;
        };

        // Service Constructor
        this.$get = emAuth;
    });

})(EdenMobile);
