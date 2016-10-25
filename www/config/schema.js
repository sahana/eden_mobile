/**
 * Sahana Eden Mobile - Default Database Schema
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

/**
 * The version number for the default schema
 */
var emSchemaVersion = '1';

/**
 * The default schema for the local database
 */
EdenMobile.factory('emDefaultSchema', ['$injector', function ($injector) {

    return {

        /**
        * Table to store the current schema version
        */
        'em_version': {
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
        * Table to store table schemas
        */
        'em_schema': {
            'name': {
                type: 'string',
                label: 'Name',
                notnull: true
            },
            'schema': {
                type: 'json',
                label: 'Schema',
                notnull: true
            }
        },

        /**
        * Table to store settings
        */
        'em_config': {
            'settings': {
                type: 'json',
                label: 'Settings'
            }
        },

        /**
        * Meta fields for user tables
        */
        '_meta_fields': {
            'uuid': {
                type: 'string',
                readable: false,
                writable: false,
                defaultValue: function() {
                    var emDB = $injector.get('emDB'),
                        uuid = emDB.uuid();
                    return uuid.urn();
                }
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
            }
        },

        /**
        * Default schema for person records (for testing)
        */
        'person': {
            'first_name': {
                type: 'string',
                label: 'First Name',
                placeholder: 'Jane',
                notnull: true
            },
            'last_name': {
                type: 'string',
                label: 'Last Name',
                placeholder: 'Doe'
            },
            'date_of_birth': {
                type: 'date',
                label: 'Date of Birth'
            },
            'missing': {
                type: 'boolean',
                label: 'Missing'
            },
            'gender': {
                type: 'integer',
                label: 'Gender',
                options: {//1: '',
                        2: 'female',
                        3: 'male'
                        //4: 'other',
                        },
                defaultValue: 2
            },
            _form: [
                'first_name',
                'last_name',
                'gender',
                'missing',
                'date_of_birth'
            ],
            _card: {
                fields: ['first_name', 'last_name'],
                title: '{{record.first_name}} {{record.last_name}}'
            },
            _strings: {
                name: 'Person',
                namePlural: 'Persons',
                icon: 'ion-person-stalker'
            }
        }
    };
}]);
