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
                [
                    [0, 'Very appropriate'],
                    [1, 'Somewhat appropriate'],
                    [2, 'Neither appropriate nor inappropriate'],
                    [3, 'Somewhat inappropriate'],
                    [4, 'Very inappropriate']
                ]
            )
            .scale(
                'confidence',
                [
                    [0, 'Extremely confident'],
                    [1, 'Very confident'],
                    [2, 'Moderately confident'],
                    [3, 'Slightly confident'],
                    [4, 'Not confident at all'],
                ]
            )
            .scale(
                'frequency',
                [
                    [0, 'Always'],
                    [1, 'Often'],
                    [2, 'Occasionally'],
                    [3, 'Rarely'],
                    [4, 'Never']
                ]
            )
            .scale(
                'safety',
                [
                    [0, 'Extremely safe'],
                    [1, 'Very safe'],
                    [2, 'Moderately safe'],
                    [3, 'Slightly safe'],
                    [4, 'Not safe at all']
                ]
            )
            .scale(
                'satisfaction',
                [
                    [0, 'Very satisfied'],
                    [1, 'Somewhat satisfied'],
                    [2, 'Neither satisfied nor dissatisfied'],
                    [3, 'Somewhat dissatisfied'],
                    [4, 'Very dissatisfied']
                ]
            )
            .scale(
                'smiley-5',
                [4, 3, 2, 1, 0],
                [
                    [0, 'ucce ucce-smiley-1'],
                    [1, 'ucce ucce-smiley-2'],
                    [2, 'ucce ucce-smiley-3'],
                    [3, 'ucce ucce-smiley-4'],
                    [4, 'ucce ucce-smiley-6']
                ],
                true // icon-only
            )
            .scale(
                'smiley-3',
                [2, 1, 0],
                [
                    [0, 'ucce ucce-smiley-3'],
                    [1, 'ucce ucce-smiley-4'],
                    [2, 'ucce ucce-smiley-5']
                ],
                true // icon-only
            );
    }
]);
