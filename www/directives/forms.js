/**
 * Sahana Eden Mobile - Forms Directives
 *
 * Copyright (c) 2016-2017: Sahana Software Foundation
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

// ============================================================================
/**
 * emDataForm - directive for create/update forms
 *
 * @class emDataForm
 * @memberof EdenMobile
 */
EdenMobile.directive('emDataForm', [
    '$compile', 'emForms', 'emResources',
    function($compile, emForms, emResources) {

        "use strict";

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

            var resourceName = attr.resource,
                componentName = attr.component;

            emResources.open(resourceName).then(function(resource) {

                if (!resource) {
                    return;
                }

                // Render the form
                var form;
                if (componentName) {
                    var component = resource.component(componentName);
                    if (component) {
                        // Determine component key (to hide it in form)
                        var componentKey;
                        if (!component.link) {
                            componentKey = component.fkey;
                        }
                        // Render form for component resource
                        form = emForms.form(component, componentKey);
                    }
                } else {
                    // Render form for master resource
                    form = emForms.form(resource);
                }

                // Compile the form and replace the element with the node
                if (form) {
                    var compiled = $compile(form.render('form', $scope))($scope);
                    elem.replaceWith(compiled);
                }
            });
        };

        return {
            link: renderForm
        };
    }
]);

// ============================================================================
/**
 * emConfigForm - directive for form to edit config settings
 *
 * @class emConfigForm
 * @memberof EdenMobile
 */
EdenMobile.directive('emConfigForm', [
    '$compile', 'emSettings', 'emConfig',
    function($compile, emSettings, emConfig) {

        "use strict";

        /**
         * Form renderer
         *
         * @param {object} $scope - reference to the current scope
         * @param {DOMNode} elem - the angular-enhanced DOM node for
         *                         the element applying the directive
         * @param {object} attr - object containing the attributes of
         *                        the element (unused)
         */
        var renderForm = function($scope, elem /* , attr */ ) {

            emConfig.apply(function( /* settings */ ) {

                var form = angular.element('<div class="list">'),
                    section,
                    sectionName;

                for (sectionName in emSettings) {
                    if (sectionName[0] != '_') {
                        section = angular.element('<em-config-section>')
                                         .attr('section-name', sectionName);
                        form.append(section);
                    }
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

// END ========================================================================
