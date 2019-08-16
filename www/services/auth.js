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
        '$injector', '$q', 'emDB',
        function($injector, $q, emDB ) {

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
                        sessionData = CryptoJS.AES.encrypt(sessionData, masterKey).toString();
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

                        if (masterKeyAuth || encryptSession) {
                            if (key === undefined) {
                                deferred.reject('key required');
                            }
                            var encrypted = records[0].$('session_data'),
                                decrypted = CryptoJS.AES.decrypt(encrypted, key);
                            if (!decrypted.toString()) {
                                deferred.reject('invalid master key');
                            } else {
                                decrypted = CryptoJS.enc.Utf8.stringify(decrypted);
                                currentSession = JSON.parse(decrypted);
                                masterKey = key;
                            }
                        } else {
                            currentSession = JSON.parse(records[0].$('session_data'));
                            if (key !== undefined) {
                                masterKey = key;
                            }
                        }
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
                return storeSession();
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
                        emServer.httpError(error);
                        deferred.reject('invalid master key');
                    });

                return deferred.promise;
            };

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
                deleteSession: deleteSession
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
