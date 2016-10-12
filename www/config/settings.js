/**
 * Sahana Eden Mobile - Configuration Settings and Defaults
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

EdenMobile.value('emSettings', {

    'server': {

        _title: 'Sahana Server Settings',
        _help: 'Server information for data uploads',

        'url': {
            type: 'url',
            label: 'Sahana Server URL',
            help: 'The URL of the Sahana Server to upload data to',
            placeholder: 'http://sahana.example.com/eden'
        },
        'username': {
            type: 'string',
            label: 'Username for Sahana Server',
            help: 'The username to use for data uploads',
            placeholder: 'admin@example.com'
        },
        'password': {
            type: 'password',
            label: 'Password for Sahana Server',
            help: 'The password to use for data uploads'
        }
    }
});
