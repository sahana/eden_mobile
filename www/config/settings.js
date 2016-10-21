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

/**
 * emSettings - Definition of user-configurable settings
 *
 * @class emSettings
 * @memberof EdenMobile
 */
EdenMobile.value('emSettings', {

    'server': {

        _title: 'Sahana Server Settings',
        //_help: 'Server information for data uploads',

        'url': {
            type: 'url',
            //defaultValue: 'http://ims.example.com/eden',
            //writable: false,
            label: 'Sahana Server URL',
            help: 'e.g. http://sahana.example.com/eden',
            placeholder: 'Enter the server URL'
        },
        'username': {
            type: 'string',
            label: 'Username for Sahana Server',
            help: 'e.g. admin@example.com',
            placeholder: 'Enter your username'
        },
        'password': {
            type: 'password',
            label: 'Password for Sahana Server',
            empty: 'not specified',
            placeholder: 'Enter your password'
        }
    }
});
