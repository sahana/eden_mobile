/**
 * UCCE Survey Tool - App Config
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

EdenMobile.config([
    'emFormStyleProvider', 'emAuthProvider', 'emLikertScaleProvider',
    function(emFormStyleProvider, emAuthProvider, emLikertScaleProvider) {

        "use strict";

        // Form Style
        emFormStyleProvider.formStyle('wizard');

        // Use MasterKey Auth
        emAuthProvider.masterKeyAuth(true);

        // Session times out after 30 minutes of inaktivity
        emAuthProvider.sessionTimeout(30);

        // Likert-scales used with this app
        emLikertScaleProvider
            .scale(
                'appropriateness',
                ['Very appropriate', 'Somewhat appropriate', 'Neither appropriate nor inappropriate', 'Somewhat inappropriate', 'Very inappropriate']
            )
            .scale(
                'confidence',
                ['Extremely confident', 'Very confident', 'Moderately confident', 'Slightly confident', 'Not confident at all']
            )
            .scale(
                'frequency',
                ['Always', 'Often', 'Occasionally', 'Rarely', 'Never']
            )
            .scale(
                'safety',
                ['Extremely safe', 'Very safe', 'Moderately safe', 'Slightly safe', 'Not safe at all']
            )
            .scale(
                'satisfaction',
                ['Very satisfied', 'Somewhat satisfied', 'Neither satisfied nor dissatisfied', 'Somewhat dissatisfied', 'Very dissatisfied']
            )
            .scale(
                'smiley-5',
                ['very sad', 'sad', 'neutral', 'happy', 'very happy'],
                [
                    ['very sad', 'ucce ucce-smiley-5'],
                    ['sad', 'ucce ucce-smiley-4'],
                    ['neutral', 'ucce ucce-smiley-3'],
                    ['happy', 'ucce ucce-smiley-2'],
                    ['very happy', 'ucce ucce-smiley-1']
                ],
                true // icon-only
            )
            .scale(
                'smiley-3',
                ['sad', 'neutral', 'happy'],
                [
                    ['sad', 'ucce ucce-smiley-4'],
                    ['neutral', 'ucce ucce-smiley-3'],
                    ['happy', 'ucce ucce-smiley-2']
                ],
                true // icon-only
            );
    }
]);
