/**
 * Sahana Eden Mobile - Server Access
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

(function() {

    "use strict";

    // ========================================================================
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
     *
     * @example
     * var url = emServer.URL({c: 'mobile', f: 'forms', extension: 'json'});
     */
    function SahanaURL(options) {
        this.options = options;
    }

    // ------------------------------------------------------------------------
    /**
     * Extend base URL with URL parameters
     *
     * @param {string} baseURL - the baseURL
     *
     * @returns {string} - the extended baseURL
     */
    SahanaURL.prototype.extend = function(baseURL) {

        var url = '',
            options = this.options;

        if (baseURL) {
            // Parse the baseURL
            var pattern = /((\w+):\/\/)?([\w.:]+)(\/(\S*))?/,
                parsed = baseURL.match(pattern);
            if (parsed === null) {
                // Invalid baseURL
                return null;
            }
            // Reconstruct URL
            var protocol = parsed[2] || 'http',
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
        var extension = this.getFormat();
        if (extension != 'html') {
            url += '.' + extension;
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

    // ------------------------------------------------------------------------
    /**
     * Get the request format extension
     *
     * @returns {string} - the format extension
     */
    SahanaURL.prototype.getFormat = function() {

        var extension = this.options.extension;
        if (extension) {
            extension = extension.toLowerCase();
        } else {
            extension = 'html';
        }
        return extension;
    };

    // ========================================================================
    /**
     * RegExp to parse URLs
     */
    var urlPattern = /((\w+):\/\/)?([\w.:]+)(\/(\S*))?/;

    // ------------------------------------------------------------------------
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

    // ------------------------------------------------------------------------
    /**
     * Helper function to replace protocol and host part of a request URL
     * with those configured for the Sahana server (=enforce the configured
     * server), e.g. for misconfigured Sahana public URLs; ensures that
     * files are downloaded with the right credentials from the right host
     *
     * @param {string} srvURL - the configured server URL
     * @param {string} reqURL - the request URL
     */
    var sanitizeHost = function(srvURL, reqURL) {

        var srv = new URL(srvURL),
            req = new URL(reqURL);

        return srv.protocol + '//' + srv.host + req.pathname;
    };

    // ========================================================================
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
                            authHeader = requestHeaders.Authorization;
                        } else {
                            requestHeaders = {};
                        }

                        var login = function(username, password) {
                            authHeader = 'Basic ' + btoa(username + ':' + password);
                            requestHeaders.Authorization = authHeader;
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

    // ========================================================================
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

    // ========================================================================
    /**
     * emServer - Service providing access to the Sahana server
     *
     * @class emServer
     * @memberof EdenMobile
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
        '$http', '$q', 'emConfig', 'emFiles', 'emDialogs',
        function ($http, $q, emConfig, emFiles, emDialogs) {

            /**
             * Wrapper for $http that resolves a SahanaURL against the
             * current server.url setting before sending the request.
             *
             * @param {object} requestConfig - same as request config for $http,
             *                                 except that 'url' can be a SahanaURL
             *                                 instance
             * @returns {promise} - a promise that resolves into the $http
             *                      response (or rejection, respectively)
             */
            var http = function(requestConfig) {

                var requestURL = requestConfig.url;
                if (requestURL instanceof SahanaURL) {

                    // SahanaURL => resolve against configured server URL

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

            // ================================================================
            /**
             * Generic error dialog for Sahana server requests, shows
             * error message and explanation in a popup (modal)
             *
             * @param {object} response - the response object returned from http
             */
            var httpError = function(response) {

                var message,
                    explanation;

                if (typeof response == 'string') {
                    // Configuration error
                    message = 'Server not available';
                    explanation = response;

                } else {

                    var status = response.status;

                    if (status === 0 || status == -1) {
                        // This occurs when the network is down, or the server
                        // could not be found or does not respond
                        message = 'Server unreachable';
                        explanation = 'No network available or server not found';

                    } else {
                        // HTTP response from server (or gateway)
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
                }
                emDialogs.error(message, explanation);
            };

            // ================================================================
            /**
             * HTTP GET to the configured Sahana server
             *
             * @param {SahanaURL|string} - the URL to query
             * @param {string} format - the expected data format, 'text'|'json',
             *                          auto-detected from SahanaURL 'extension'
             *                          option if present
             * @param {function} successCallback - callback function to invoke
             *                                     when the request was successful,
             *                                     function(data)
             * @param {function} errorCallback - callback function to invoke when
             *                                   the request was unsuccessful,
             *                                   function(response), defaults to
             *                                   standard httpError handler
             */
            var get = function(url, format, successCallback, errorCallback) {

                // Shift arguments if format was omitted
                if (typeof format == 'function') {
                    errorCallback = successCallback;
                    successCallback = format;
                    format = null;
                }

                // The request config
                var config = {
                    method: 'GET',
                    url: url
                };

                // If no format was specified, try to look it up from SahanaURL
                if (!format && url instanceof SahanaURL) {
                    format = url.getFormat();
                }

                // Configure the response type according to the format extension
                if (format == 'json') {
                    config.responseType = 'json';
                } else {
                    // default
                    config.responseType = 'text';
                }

                // Default to generic httpError handler
                if (!errorCallback) {
                    errorCallback = httpError;
                }

                // Execute the request
                http(config).then(
                    function(response) {
                        if (successCallback) {
                            successCallback(response.data);
                        }
                    },
                    function(response) {
                        if (errorCallback) {
                            errorCallback(response);
                        }
                    }
                );
            };

            /**
             * Attach files to a request data object
             *
             * @param {object} data - the request data object
             * @param {Array} fileHooks - array of file hooks,
             *                            format: [[fileName, fileURI], ...]
             * @param {function} callback - callback function, receives the
             *                              data object as parameter
             */
            var attachFiles = function(data, fileHooks, callback) {

                var pending = {};
                fileHooks.forEach(function(hook) {
                    pending[hook[0]] = true;
                });

                var completed = function(fileName) {
                    var ready = true;
                    pending[fileName] = false;
                    for (var f in pending) {
                        if (pending[f]) {
                            ready = false;
                            break;
                        }
                    }
                    if (ready) {
                        // All files extracted => run callback
                        callback(data);
                    }
                };

                // Generate the blobs and add them to the data object
                fileHooks.forEach(function(hook) {

                    var fileName = hook[0];

                    emFiles.getBlob(hook[1],
                        function(fileName, blob) {
                            // Add blob to data, with file name as key
                            data[fileName] = blob;
                            completed(fileName);
                        },
                        function( /* error */ ) {
                            // File not found or not readable => skip
                            completed(fileName);
                        }
                    );
                });
            };

            // ================================================================
            /**
             * HTTP POST to the configured Sahana server
             *
             * @param {SahanaURL|string} - the URL to post the data to
             * @param {string} format - the expected data format, 'text'|'json',
             *                          auto-detected from SahanaURL 'extension'
             *                          option if present
             * @param {object|string} data - the data; string will be sent as-is
             *                               with contentType 'application/json',
             *                               object will be sent as 'multipart/formdata'
             * @param {function} successCallback - callback function to invoke
             *                                     when the request was successful,
             *                                     function(data)
             * @param {function} errorCallback - callback function to invoke when
             *                                   the request was unsuccessful,
             *                                   function(response), defaults to
             *                                   standard httpError handler
             */

            var post = function(url, format, data, successCallback, errorCallback) {

                // Format parameter omitted?
                if (typeof data == 'function') {
                    errorCallback = successCallback;
                    successCallback = data;
                    data = format;
                    format = null;
                }

                // If no format was specified, try to look it up from SahanaURL
                if (!format && url instanceof SahanaURL) {
                    format = url.getFormat();
                }

                // Configure the response type according to the format extension
                var responseType = 'text';
                if (format == 'json') {
                    responseType = 'json';
                }

                var executeRequest = function(config) {

                    // Default to generic httpError handler
                    if (!errorCallback) {
                        errorCallback = httpError;
                    }

                    // Execute the request
                    http(config).then(
                        function(response) {
                            if (successCallback) {
                                successCallback(response.data);
                            }
                        },
                        function(response) {
                            if (errorCallback) {
                                errorCallback(response);
                            }
                        }
                    );
                };

                // The request config
                var config = {
                    method: 'POST',
                    url: url,
                    responseType: responseType
                };
                if (typeof data == 'string') {

                    // Assume JSON
                    config.data = data;
                    config.headers = {
                        'Content-Type': 'application/json'
                    };
                    executeRequest(config);

                } else {

                    // Assume multipart
                    config.headers = {
                        'Content-Type': undefined
                    };

                    // transformRequest to build formData object
                    config.transformRequest = function(data /*, headersGetter */) {
                        var formData = new FormData();
                        angular.forEach(data, function(value, key) {
                            if (key !== '_files') {
                                if (value.constructor == Blob) {
                                    formData.append(key, value, key);
                                } else {
                                    formData.append(key, value);
                                }
                            }
                        });
                        return formData;
                    };

                    if (data.hasOwnProperty('_files')) {
                        // Attach the files, then execute the request
                        attachFiles(data, data._files, function(data) {
                            config.data = data;
                            executeRequest(config);
                        });
                    } else {
                        // Execute the request as-is
                        config.data = data;
                        executeRequest(config);
                    }
                }
            };

            // ----------------------------------------------------------------
            /**
             * Regex pattern for Content-Disposition "attachment" to extract
             * the original file name
             */
            var attPattern = /attachment;\sfilename=\"(.*)\".*/g;

            /**
             * File download
             *
             * @param {string} downloadURL - the download URL
             * @param {function} successCallback: success callback,
             *                                    function(data, fileName)
             * @param {function} errorCallback: error callback,
             *                                  function(response)
             */
            var getFile = function(downloadURL, onSuccess, onError) {

                emConfig.apply(function(settings) {

                    var serverURL = settings.get('server.url');
                    if (!serverURL) {
                        if (onError) {
                            onError('No Sahana server configured');
                        }
                        return;
                    }

                    var config = {
                        method: 'GET',
                        url: sanitizeHost(serverURL, downloadURL),
                        responseType: 'blob'
                    };

                    $http(config).then(
                        function(response) {

                            var cDisp = response.headers('content-disposition'),
                                parsed,
                                fileName;

                            if (cDisp) {
                                attPattern.lastIndex = 0;
                                parsed = attPattern.exec(cDisp);
                                if (parsed) {
                                    // Use original file name
                                    fileName = parsed[1];
                                }
                            }
                            if (!fileName) {
                                // Fallback to file name in URL
                                fileName = downloadURL.substring(
                                            downloadURL.lastIndexOf('/') + 1);
                            }
                            if (onSuccess) {
                                onSuccess(response.data, fileName);
                            }
                        },
                        function(response) {
                            if (onError) {
                                onError(response);
                            }
                        });
                });
            };

            // ================================================================
            /**
             * The emServer API
             */
            var api = {

                // URL construction
                URL: function(options) {
                    return new SahanaURL(options);
                },

                // Generic HTTP methods
                http: http,
                httpError: httpError,

                // HTTP commands
                get: get,
                post: post,

                // ------------------------------------------------------------
                /**
                 * Download a list of available mobile forms
                 *
                 * @param {function} successCallback: success callback, function(data)
                 * @param {function} errorCallback: error callback, function(response)
                 *
                 * TODO move function definition out of the dict
                 */
                formList: function(successCallback, errorCallback) {

                    var url = new SahanaURL({
                        c: 'mobile',
                        f: 'forms',
                        extension: 'json'
                    });
                    get(url, 'json', successCallback, errorCallback);
                },

                // ------------------------------------------------------------
                /**
                 * Download a mobile form
                 *
                 * @param {string} ref - reference details to construct the download URL,
                 *                       object {c:controller, f:function, vars:vars}
                 * @param {function} successCallback: success callback, function(data)
                 * @param {function} errorCallback: error callback, function(response)
                 *
                 * TODO move function definition out of the dict
                 */
                getForm: function(ref, successCallback, errorCallback) {

                    var url = new SahanaURL({
                        c: ref.c,
                        f: ref.f,
                        args: ['mform'],
                        vars: ref.v,
                        extension: 'json'
                    });
                    get(url, 'json', successCallback, errorCallback);
                },

                // ------------------------------------------------------------
                /**
                 * Download resource data
                 *
                 * @param {string} ref - reference details to construct the download URL,
                 *                       object {c:controller, f:function, vars:vars}
                 * @param {object|string} data - the data to upload
                 * @param {function} successCallback: success callback, function(data)
                 * @param {function} errorCallback: error callback, function(response)
                 *
                 * TODO move function definition out of the dict
                 */
                getData: function(ref, successCallback, errorCallback) {

                    var url = new SahanaURL({
                        c: ref.c,
                        f: ref.f,
                        //args: ['mdata'],
                        vars: ref.v,
                        extension: 's3json'
                    });
                    get(url, 'json', successCallback, errorCallback);
                },

                // ------------------------------------------------------------
                getFile: getFile,

                // ------------------------------------------------------------
                /**
                 * Upload resource data
                 *
                 * @param {string} ref - reference details to construct the download URL,
                 *                       object {c:controller, f:function, vars:vars}
                 * @param {object|string} data - the data to upload
                 * @param {function} successCallback: success callback, function(data)
                 * @param {function} errorCallback: error callback, function(response)
                 *
                 * TODO move function definition out of the dict
                 */
                postData: function(ref, data, successCallback, errorCallback) {

                    var url = new SahanaURL({
                        c: ref.c,
                        f: ref.f,
                        // args: ['mdata'],
                        vars: ref.v,
                        extension: 's3json'
                    });
                    post(url, 'json', data, successCallback, errorCallback);
                },

                // ------------------------------------------------------------
                /**
                 * Convert server error response into human-readable error message
                 *
                 * @param {object} response - the server response
                 *
                 * @returns {string} - the error message
                 *
                 * TODO move function definition out of the dict
                 */
                parseServerError: function(response) {

                    var message;

                    if (typeof response == 'string') {
                        message = response;
                    } else {
                        var status = response.status;
                        if (status) {
                            if (response.data) {
                                message = response.data.message;
                            }
                            if (!message) {
                                message = response.statusText;
                            }
                            if (!message) {
                                if (status == -1) {
                                    message = 'connection failed';
                                } else {
                                    message = 'unknown error ' + status;
                                }
                            } else {
                                message = status + ' ' + message;
                            }
                        }
                    }
                    return message;
                }

            };
            return api;
        }
    ]);
})();
