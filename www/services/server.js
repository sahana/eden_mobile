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

    // @todo: interceptor to respond to 401 challenge

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
        '$http', '$q', 'emConfig',
        function ($http, $q, emConfig) {

            var api = {

                /**
                 * Wrapper for sahanaURL
                 */
                URL: function(options) {
                    return new sahanaURL(options);
                },

                /**
                 * Wrapper for $http that resolves a sahanaURL against the current
                 * server.url setting before sending the request
                 *
                 * @param {object} requestConfig - same as request config for $http,
                 *                                 except that 'url' can be a sahanaURL
                 *                                 instance
                 * @returns {promise} - a promise that resolves into the $http
                 *                      response (or rejection, respectively)
                 *
                 * @todo: add Auth header if credentials configured
                 */
                http: function(requestConfig) {

                    var requestURL = requestConfig.url;
                    if (requestURL instanceof sahanaURL) {

                        // sahanaURL => resolve against server.url config, then
                        //              pass on to $http
                        var deferred = $q.defer();
                        emConfig.apply(function(settings) {

                            var serverURL = settings.get('server.url'),
                                url = requestURL.extend(serverURL);

                            if (url === null) {
                                deferred.reject('Invalid Server URL');
                            } else {
                                var config = angular.extend(requestConfig, {url: url});
                                $http(config).then(
                                    function(response) {
                                        deferred.resolve(response);
                                    },
                                    function(response) {
                                        deferred.reject(response);
                                    }
                                );
                            }

                        });

                        return deferred.promise;

                    } else {
                        // String URL => forward directly to $http
                        return $http(requestConfig);
                    }

                }
            };
            return api;
        }
    ]);
})();
