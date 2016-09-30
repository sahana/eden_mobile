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

var emSchemaVersion = '1';

var emDefaultSchema = {

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
     * Default schema for person records (for testing)
     */
    'person': {
        'first_name': {
            type: 'string',
            label: 'First Name',
            notnull: true
        },
        'last_name': {
            type: 'string',
            label: 'Last Name'
        },
        'date_of_birth': {
            type: 'date',
            label: 'Date of Birth'
        },
        _form: ['first_name',
                'last_name',
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
