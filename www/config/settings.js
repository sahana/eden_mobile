/**
 * Sahana Eden Mobile - Configuration Settings and Defaults
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
            // Server URL including path to the application (e.g. /eden)
            // - to set a default URL, configure a value in local.json
            // - to hard-code a server URL, configure a value in local.json
            //   and set writable:false here
            // - for local debugging using Port Forwarding in Chrome's
            //   Developer Tools, set the url in local.json to 'http://localhost:8000/eden'
            label: 'Sahana Server URL',
            help: 'e.g. https://sahana.example.com/eden',
            placeholder: 'Enter the server URL',
            onValidation: function(value) {
                // https://gist.github.com/dperini/729294
                // => modified to allow private/local networks
                return /^(?:(?:https?|ftp):\/\/)(?:\S+(?::\S*)?@)?(?:(?:[1-9]\d?|1\d\d|2[01]\d|22[0-3])(?:\.(?:1?\d{1,2}|2[0-4]\d|25[0-5])){2}(?:\.(?:[1-9]\d?|1\d\d|2[0-4]\d|25[0-4]))|(?:(?:[a-z\u00a1-\uffff0-9]-*)*[a-z\u00a1-\uffff0-9]+)(?:\.(?:[a-z\u00a1-\uffff0-9]-*)*[a-z\u00a1-\uffff0-9]+)*(?:\.(?:[a-z\u00a1-\uffff]{2,}))\.?)(?::\d{2,5})?(?:[\/?#]\S*)?$/i.test(value);
            }
        },
        'username': {
            type: 'string',
            //defaultValue: 'user@example.com',
            label: 'Username for Sahana Server',
            help: 'e.g. admin@example.com',
            placeholder: 'Enter your username'
        },
        'password': {
            type: 'password',
            //defaultValue: 'mypassword',
            label: 'Password for Sahana Server',
            empty: 'not specified',
            placeholder: 'Enter your password'
        },

        // Hidden setting for MasterKeyAuth app key
        // - to be configured in local.json with the same value as
        //   server-side settings.auth.masterkey_app_key
        'appKey': {
            type: 'password',
            label: 'Application Key',
            readable: false,
            writable: false
        }
    }
});
