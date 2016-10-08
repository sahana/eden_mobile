/**
 * Sahana Eden Mobile - Settings Controllers
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

EdenMobile
.controller("EdenMobileSettings", [
    '$scope', '$emConfig', function($scope, $emConfig) {
//         $scope.appname = "Settings";

        $emConfig.apply(function(settings) {

        });
    }
])
.controller("EdenMobileAbout", [
    '$scope', function($scope, $cordovaAppVersion) {
        $scope.version = window.cordova.plugins.version.getAppVersion();
    }
]);

/**
 * Directive for config form
 */
EdenMobile.directive('emConfigForm', [
    '$compile', '$emConfig', '$emForm',
    function($compile, $emConfig, $emForm) {

        /**
         * Form renderer
         *
         * @param {object} $scope - reference to the current scope
         * @param {DOMNode} elem - the angular-enhanced DOM node for
         *                         the element applying the directive
         * @param {object} attr - object containing the attributes of
         *                        the element
         */
        var renderForm = function($scope, elem, attr) {

            $emConfig.apply(function(settings) {

                var sections = settings.sections(),
                    sectionName,
                    form = angular.element('<div class="list">'),
                    section;

                for (var i=0, len=sections.length; i<len; i++) {
                    section = angular.element('<em-config-section>')
                                     .attr('section-name', sections[i]);
                    form.append(section);
                }

                form.append(elem.contents());

                // Compile the form HTML against the scope,
                // then render it in place of the directive
                var compiled = $compile(form)($scope);
                elem.replaceWith(compiled);

            });
        };

        return {
            link: renderForm
        };
    }
]);

/**
 * Directive for config form section
 */
EdenMobile.directive('emConfigSection', [
    '$compile', '$emConfig', '$emForm',
    function($compile, $emConfig, $emForm) {

        /**
         * Form renderer
         *
         * @param {object} $scope - reference to the current scope
         * @param {DOMNode} elem - the angular-enhanced DOM node for
         *                         the element applying the directive
         * @param {object} attr - object containing the attributes of
         *                        the element
         */
        var renderForm = function($scope, elem, attr) {

            $emConfig.apply(function(settings) {

                var sectionName = attr.sectionName,
                    section = settings.section(sectionName);
                if (!section) {
                    return;
                }

                var sectionTitle = section._title;
                if (!sectionTitle) {
                    sectionTitle = sectionName;
                }

                var title = angular.element('<h3 class="item item-divider">')
                                   .html(sectionTitle);
                var form = angular.element('<section>')
                                  .append(title);

                // Render a widget for each setting in this section
                var settingName,
                    setting,
                    widget;
                for (settingName in section) {
                    if (settingName[0] == '_') {
                        continue;
                    }
                    setting = section[settingName];
                    widget = $emForm.widget(setting, {
                        label: setting.label,
                    });
                    form.append(widget);
                }

                // Compile the form HTML against the scope,
                // then render it in place of the directive
                var compiled = $compile(form)($scope);
                elem.replaceWith(compiled);
            });
        };

        return {
            link: renderForm
        };
    }
]);
