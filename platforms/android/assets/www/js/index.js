/**
 * Sahana Eden Mobile - Application and Module Globals
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

/**
 * EdenMobile Module
 */
var EdenMobile = angular.module('EdenMobile', ['ionic', 'pascalprecht.translate']);

/**
 * Cordova App
 */
var CordovaApp = {

    /**
     * Application Constructor
     */
    initialize: function() {
        this.bindEvents();
    },

    /**
     * Bind Event Listeners
     *
     * Bind any events that are required on startup. Common events are:
     * 'load', 'deviceready', 'offline', and 'online'.
     */
    bindEvents: function() {
        document.addEventListener('deviceready', this.onDeviceReady, false);
    },

    /**
     * deviceready Event Handler
     *
     * The scope of 'this' is the event. In order to call the 'receivedEvent'
     * function, we must explicitly call 'app.receivedEvent(...);'
     */
    onDeviceReady: function() {
        CordovaApp.receivedEvent('deviceready');
    },

    /**
     * Update DOM on a Received Event
     */
    receivedEvent: function(id) {

        // Log the event (@todo: remove?)
        console.log('Received Event: ' + id);

        // Bootstrap EdenMobile
        // (must wait for deviceready to be able to use Cordova Plugins from Angular app)
        if (id == "deviceready") {
            angular.bootstrap(document.body, ['EdenMobile']);
        }
    }
};

CordovaApp.initialize();
