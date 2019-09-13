/**
 * Sahana Eden Mobile - Default Database Schema
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

/**
 * The version number for the default schema
 */
var emSchemaVersion = '6';

/**
 * The default schema for the local database
 */
EdenMobile.factory('emDefaultSchema', ['emUtils', function (emUtils) {

    var tables = [

        /**
         * Table to store the current schema version
         */
        {
            _name: 'em_version',
            'version': {
                type: 'string',
                label: 'Version',
                notnull: true
            },
            _records: [
                {'version': emSchemaVersion}
            ]
        },

        /**
         * Table to store entity definitions
         */
        {
            _name: 'em_schema',
            'name': {
                type: 'string',
                label: 'Name',
                notnull: true
            },
            'fields': {
                type: 'json',
                label: 'Fields',
                notnull: true
            },
            'settings': {
                type: 'json',
                label: 'Settings'
            }
        },

        /**
         * Table to store settings
         */
        {
            _name: 'em_config',
            'settings': {
                type: 'json',
                label: 'Settings'
            }
        },

        /**
         * Table to store current session data
         */
        {
            _name: 'em_session',
            'session_data': {
                type: 'text',
                label: 'Session Data'
            }
        },

        /**
         * Table to store object keys
         */
        {
            _name: 'em_object',
            'tablename': {
                type: 'string',
                label: 'Table Name',
                notnull: true
            },
            'uuid': {
                type: 'string',
                readable: false,
                writable: false
            }
        },

        /**
         * Table to store resource definitions
         */
        {
            _name: 'em_resource',
            'name': {
                type: 'string',
                label: 'Resource Name',
                notnull: true
            },
            'tablename': {
                type: 'string',
                label: 'Table Name',
                notnull: true
            },
            'controller': {
                type: 'string',
                label: 'Controller'
            },
            'function': {
                type: 'string',
                label: 'Function'
            },
            'fields': {
                type: 'json',
                label: 'Fields'
            },
            'settings': {
                type: 'json',
                label: 'Settings'
            },
            'schema_date': {
                type: 'datetime',
                label: 'Schema updated on'
            },
            'lastsync': {
                type: 'datetime',
                label: 'Last synchronized on'
            },
            'main': {
                type: 'boolean',
                defaultValue: false
            },
            'inactive': {
                type: 'boolean',
                defaultValue: false
            }
        },

        /**
         * Synchronization log
         */
        {
            _name: 'em_sync_log',
            'timestamp': {
                type: 'datetime',
                label: 'Date/Time'
            },
            'type': {
                type: 'string',
                label: 'Job Type'
            },
            'mode': {
                type: 'string',
                label: 'Transmission Mode'
            },
            'resource': {
                type: 'string',
                label: 'Resource Name'
            },
            'result': {
                type: 'string',
                label: 'Result'
            },
            'remote_error': {
                type: 'boolean',
                label: 'Remote Error',
                defaultValue: false
            },
            'message': {
                type: 'string',
                label: 'Message'
            },
            'current': {
                type: 'boolean',
                defaultValue: true
            }
        }
    ];

    /**
     * Meta fields for user tables
     */
    var metaFields = {

        'uuid': {
            type: 'string',
            readable: false,
            writable: false,
            defaultValue: function() {
                return emUtils.uuid().urn();
            }
        },
        'em_object_id': {
            type: 'reference em_object',
            readable: false,
            writable: false
        },
        'created_on': {
            type: 'datetime',
            readable: false,
            writable: false,
            defaultValue: function() {
                return new Date();
            }
        },
        'modified_on': {
            type: 'datetime',
            readable: false,
            writable: false,
            defaultValue: function() {
                return new Date();
            },
            updateValue: function() {
                return new Date();
            }
        },
        'em_incomplete': {
            // Flag to indicate that the record is incomplete,
            // and not ready for upload yet
            type: 'boolean',
            defaultValue: false,
            readable: false,
            writable: false
        },
        'synchronized_on': {
            type: 'datetime',
            readable: false,
            writable: false
        },
        'llrepr': {
            type: 'text',
            readable: false,
            writable: false
        }
    };

    // ========================================================================
    // Create associative array for fast access to a schema by table name
    //
    var schemas = {};
    tables.forEach(function(schema) {
        schemas[schema._name] = schema;
    });

    // ========================================================================
    // API
    //
    return {

        // The array of schema definitions
        tables: tables,

        // The meta-fields dict
        metaFields: metaFields,

        /**
         * Access a schema by table name
         *
         * @param {string} name - the table name
         *
         * @returns {object} - the schema for that table
         */
        schema: function(name) {
            return schemas[name];
        }
    };

}]);
