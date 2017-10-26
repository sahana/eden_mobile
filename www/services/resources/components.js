/**
 * Sahana Eden Mobile - Component Registry
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

EdenMobile.factory('emComponents', [
    function () {

        "use strict";

        var hooks = {};

        // --------------------------------------------------------------------
        /**
         * Parse and register a component description
         *
         * @param {Table} table - the master table
         * @param {string} alias - the component alias
         * @param {object} description - the component description
         *                               (as received from S3Mobile)
         */
        var addComponent = function(table, alias, description) {

            var master = table.name,
                pkey = description.pkey || 'id';

            if (!table.fields.hasOwnProperty(pkey)) {
                master = table.getObjectType(pkey);
            }

            if (master) {

                var tableHooks = hooks[master] || {};

                if (!tableHooks.hasOwnProperty(alias)) {

                    var link = description.link,
                        hook = {
                            tableName: description.resource,
                            pkey: pkey,
                            multiple: !!description.multiple
                        };

                    if (link) {
                        hook.link = link;
                        hook.lkey = description.joinby;
                        hook.rkey = description.key;
                        hook.fkey = description.fkey || 'id';
                    } else {
                        hook.fkey = description.joinby;
                    }
                    tableHooks[alias] = hook;
                }
                hooks[master] = tableHooks;
            }
        };

        // --------------------------------------------------------------------
        /**
         * Look up a component description ("hook")
         *
         * @param {Table} table - the master table
         * @param {string} alias - the component alias
         *
         * @returns {object} - the component description
         */
        var getComponent = function(table, alias) {

            var hook,
                tableHooks = hooks[table.name];

            if (tableHooks) {
                hook = tableHooks[alias];
            }

            if (!hook) {
                var objectType,
                    objectHooks;
                for (objectType in table.objectTypes) {
                    objectHooks = hooks[objectType];
                    if (objectHooks) {
                        hook = objectHooks[alias];
                        if (hook) {
                            break;
                        }
                    }
                }
            }

            return hook;
        };

        // ====================================================================
        var api = {

            addComponent: addComponent,
            getComponent: getComponent
        };

        return api;
    }
]);

// END ========================================================================
