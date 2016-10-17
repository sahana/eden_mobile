/**
 * Sahana Eden Mobile - Server Access
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
     * Constructor representing a Sahana URL
     *
     * @param {object} options - the URL options
     * @param {string} options.a - the application name
     * @param {string} options.c - the controller name
     * @param {string} options.f - the function name
     * @param {Array} options.args - array of URL arguments
     * @param {object} options.vars - object with GET vars {key: value}
     * @param {string} options.extension - file format extension (if not 'html')
     */
    function sahanaURL(options) {
        this.options = options;
    }

    /**
     * Extend base URL with URL parameters
     *
     * @param {string} baseURL - the baseURL
     *
     * @returns {string} - the extended baseURL
     */
    sahanaURL.prototype.extend = function(baseURL) {

        var url = '';

        if (baseURL) {
            // Parse the baseURL
            var pattern = /((\w+):\/\/)?([\w.:]+)(\/(\S*))?/,
                parsed = baseURL.match(pattern);
            if (parsed === null) {
                // Invalid baseURL
                return null;
            }
            // Reconstruct URL
            var options = this.options,
                protocol = parsed[2] || 'http',
                host = parsed[3],
                path = options.a || parsed[5] || 'eden';
            url = protocol + '://' + host + '/' + path;
        }

        // Append controller and function
        url += '/' + (options.c || 'default') + '/' + (options.f || 'index');

        // Append args
        var args = options.args;
        if (args) {
            if (typeof args == 'string') {
                url += '/' + args;
            } else {
                for (var i=0, len=args.length; i<len; i++) {
                    url += '/' + args[i];
                }
            }
        }

        // Append file extension
        var extension = options.extension;
        if (extension) {
            extension = extension.toLowerCase();
            if (extension != 'html') {
                url += '.' + extension;
            }
        }

        // Append vars
        var vars = options.vars;
        if (vars !== undefined) {
            var queries = [];
            for (var key in vars) {
                queries.push(key + '=' + vars[key]);
            }
            if (queries.length) {
                url += '?' + queries.join('&');
            }
        }
        return url;
    };

    /**
     * RegExp to parse URLs
     */
    var urlPattern = /((\w+):\/\/)?([\w.:]+)(\/(\S*))?/;

    /**
     * Helper function to check whether two URLs address the same host
     */
    var sameHost = function(reqURL, srvURL) {

        if (reqURL && srvURL) {

            var parsedReqURL = reqURL.match(urlPattern),
                parsedSrvURL = srvURL.match(urlPattern);
            if (parsedReqURL === null || parsedSrvURL === null) {
                return false;
            }

            var reqHost = parsedReqURL[3],
                srvHost = parsedSrvURL[3];
            if (reqHost && srvHost && reqHost == srvHost) {
                return true;
            } else {
                return false;
            }
        } else {
            return false;
        }
    };

    /**
     * HTTP 401 Recovery Service
     *
     * Strategy:
     *   1 if no previous authentication attempt has been made (no Auth header
     *     in the response config) and Sahana server credentials are configured,
     *     we add an Auth header to the request config
     *   2 if a previous authentication attempt has failed (=second round 401),
     *     then we prompt the user to re-enter the server credentials
     *   3 if no server credentials are available, and the user cancels
     *     the prompt, then recovery fails
     *
     * @returns {promise} - a promise that resolves into the updated config,
     *                      or is rejected with an error message
     */
    EdenMobile.factory('emServer401Recoverer', [
        '$q', '$injector', 'emConfig',
        function($q, $injector, emConfig) {

            var recovery = function(config) {

                var deferred = $q.defer();

                emConfig.apply(function(settings) {

                    var requestURL = config.url,
                        serverURL = settings.get('server.url');
                    if (!serverURL) {
                        deferred.reject('No Sahana server configured');
                        return;
                    }

                    if (sameHost(requestURL, serverURL)) {

                        // Add auth header and resend the request
                        var authHeader,
                            requestHeaders = config.headers;
                        if (requestHeaders) {
                            authHeader = requestHeaders['Authorization'];
                        } else {
                            requestHeaders = {};
                        }

                        var login = function(username, password) {
                            authHeader = 'Basic ' + btoa(username + ":" + password);
                            requestHeaders['Authorization'] = authHeader;
                            config.headers = requestHeaders;
                            deferred.resolve(config);
                        };

                        var username = settings.get('server.username'),
                            password = settings.get('server.password'),
                            credentials = {
                                username: username,
                                password: password
                            },
                            emDialogs = $injector.get('emDialogs');
                        if (!authHeader) {
                            if (username && password) {
                                login(username, password);
                            } else {
                                emDialogs.authPrompt(
                                    serverURL,
                                    'Authentication Required',
                                    credentials,
                                    login,
                                    function() {
                                        deferred.reject('Request cancelled');
                                    }
                                );
                                return;
                            }
                        } else {
                            // @todo: using config values here again is slightly confusing,
                            //        better retrieve the previously entered credentials
                            //        from existing authHeader
                            emDialogs.authPrompt(
                                serverURL,
                                'Invalid username/password',
                                credentials,
                                login,
                                function() {
                                    deferred.reject('Invalid username/password');
                                }
                            );
                        }
                    } else {
                        // Nothing we can do
                        deferred.reject('Request to different server');
                        return;
                    }


                });
                return deferred.promise;
            };
            return recovery;
        }
    ]);

    /**
     * Interceptor to handle 401 challenge
     */
    EdenMobile.factory('emServer401Interceptor', [
        '$q', '$injector', 'emServer401Recoverer',
        function($q, $injector, emServer401Recoverer) {

            var handler = {

                responseError: function(response) {

                    if (response.status == 401) {

                        var $http = $injector.get('$http'),
                            deferred = $q.defer();

                        // Try recovery
                        emServer401Recoverer(response.config).then(
                            deferred.resolve,
                            deferred.reject
                        );

                        // Chain promises to re-send the request immediately
                        // when recovery attempt succeeds
                        return deferred.promise.then(function() {
                            return $http(response.config);
                        });
                    }
                    // otherwise reject as it was
                    return $q.reject(response);
                }
            };
            return handler;
        }
    ]);

    // Add the 401 interceptor to the $http provider config
    EdenMobile.config(['$httpProvider',
        function($httpProvider) {
            $httpProvider.interceptors.push('emServer401Interceptor');
        }
    ]);

    /**
     * emServer - provides an API to access the Sahana server
     *
     * @example
     * var url = emServer.URL({
     *     c: 'org',
     *     f: 'facility',
     *     args: ['options'],
     *     vars: {
     *         components: 'None'
     *     },
     *     extension: 's3json'
     * });
     *
     * emServer.http({url: url, method: 'GET'}).then(
     *     function(response) {
     *         // success
     *     },
     *     function(reason) {
     *         // failure
     *     }
     * );
     */
    EdenMobile.factory('emServer', [
        '$http', '$q', 'emConfig', 'emDialogs',
        function ($http, $q, emConfig, emDialogs) {

            /**
             * Wrapper for $http that resolves a sahanaURL against the
             * current server.url setting before sending the request.
             *
             * @param {object} requestConfig - same as request config for $http,
             *                                 except that 'url' can be a sahanaURL
             *                                 instance
             * @returns {promise} - a promise that resolves into the $http
             *                      response (or rejection, respectively)
             */
            var http = function(requestConfig) {

                var requestURL = requestConfig.url;
                if (requestURL instanceof sahanaURL) {

                    // sahanaURL => resolve against configured server URL

                    var deferred = $q.defer();
                    emConfig.apply(function(settings) {

                        var serverURL = settings.get('server.url');
                        if (!serverURL) {
                            deferred.reject('No Sahana server configured');
                            return;
                        }

                        var url = requestURL.extend(serverURL);
                        if (url === null) {
                            deferred.reject('Invalid Server URL');
                            return;
                        }

                        // Send the request via $http
                        var config = {
                            // Accept and send the session cookie:
                            withCredentials: true,
                            url: url
                        };
                        config = angular.extend(requestConfig, config);
                        $http(config).then(
                            deferred.resolve,
                            deferred.reject
                        );
                    });
                    return deferred.promise;

                } else {

                    // String URL => send via $http
                    return $http(requestConfig);
                }
            };

            /**
             * Generic error dialog for Sahana server requests, shows
             * error message and explanation in a popup (modal)
             *
             * @param {object} response - the response object returned from http
             */
            var httpError = function(response) {

                var status = response.status,
                    message,
                    explanation;

                if (status === 0 || status == -1) {
                    // This occurs when the network is down, or the server
                    // could not be found or does not respond
                    message = 'Server unreachable';
                    explanation = 'No network available or server not found';
                } else {
                    var statusText = response.statusText,
                        web2pyError = response.headers('web2py_error'),
                        contentType = response.headers('Content-Type'),
                        data = response.data;

                    if (contentType == 'application/json' && data.hasOwnProperty('message')) {
                        // Is a JSON message
                        explanation = data.message;
                    }
                    if (!explanation) {
                        // Fall back to response headers
                        explanation = web2pyError || statusText || 'Unknown error';
                    }
                    switch(status) {
                        case 502:
                        case 504:
                            // Gateway error (e.g. HTTP proxy)- gives a status
                            // code even when the actual server is unreachable,
                            // typically a 504 GATEWAY TIMEOUT
                            message = 'Server unreachable';
                            break;
                        case 403:
                            // Authorization succeeded, but the user does not have
                            // permission for the requested resource/operation
                            message = 'Server request not permitted';
                            break;
                        default:
                            // Other reason for failure
                            message = 'Server request failed';
                            break;
                    }
                }
                emDialogs.error(message, explanation);
            };

            /**
             * The emServer API
             */
            var api = {

                // Wrapper for sahanaURL
                URL: function(options) {
                    return new sahanaURL(options);
                },

                // Generic HTTP methods
                http: http,
                httpError: httpError
            };
            return api;
        }
    ]);
})();
