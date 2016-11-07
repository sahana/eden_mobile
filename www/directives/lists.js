/**
 * Sahana Eden Mobile - List and Card Directives
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

// ============================================================================
/**
 * emDataCard - directive for cards in data list
 *
 * @class emDataCard
 * @memberof EdenMobile
 */
EdenMobile.directive("emDataCard", [
    '$compile', 'emResources',
    function($compile, emResources) {

        var renderCard = function($scope, elem, attr) {

            // @todo: attr.resource?
            var resourceName = $scope.resourceName;

            emResources.open(resourceName).then(function(resource) {
                var cardConfig = resource.card,
                    titleTemplate,
                    cardTemplate,
                    target = 'data.update({resourceName:&quot;{{resourceName}}&quot;,recordID:{{record.id}}})';

                // Read the card config
                if (cardConfig) {
                    titleTemplate = cardConfig.title;
                }
                // Apply fallback
                if (!titleTemplate) {
                    titleTemplate = 'Record #{{record.id}}';
                }

                // Construct the data card template
                cardTemplate = '<a class="item item-text-wrap" ' +
                               'ui-sref="' + target + '">' +
                               titleTemplate + '</a>';

                // Compile the data card template against the scope,
                // then render it in place of the directive
                var compiled = $compile(cardTemplate)($scope);
                elem.replaceWith(compiled);
            });
        };

        return {
            link: renderCard
        };
    }
]);

// ============================================================================
/**
 * emResource - directive for cards in resource list
 *
 * @class emResource
 * @memberof EdenMobile
 */
EdenMobile.directive('emResource', [
    '$compile', 'emResources',
    function($compile, emResources) {

        var renderCard = function($scope, elem, attr) {

            var resourceData = $scope.resource,
                resourceName = resourceData.name,
                numRows = resourceData.numRows;

            emResources.open(resourceName).then(function(resource) {

                var strings = resource.strings,
                    cardLabel = resource.name,
                    cardIcon = 'ion-folder';

                if (strings) {
                    cardLabel = strings.namePlural || strings.name || cardLabel;
                    cardIcon = strings.icon || cardIcon;
                }

                // Construct the data card template
                var cardTemplate = '<a class="item item-icon-left" href="#/data/' + resourceName + '">' +
                                   '<i class="icon ' + cardIcon + '"></i>' +
                                   cardLabel +
                                   '<span class="badge badge-assertive">' + numRows + '</span>' +
                                   '</a>';

                // Compile the data card template against the scope,
                // then render it in place of the directive
                var compiled = $compile(cardTemplate)($scope);
                elem.replaceWith(compiled);
            });
        };

        return {
            link: renderCard
        };
    }
]);

// ============================================================================
/**
 * emSyncFormCard - directive for cards in sync form selection
 *
 * @class emSyncFormCard
 * @memberof EdenMobile
 */
EdenMobile.directive("emSyncFormCard", [
    '$compile',
    function($compile) {

        var renderCard = function($scope, elem, attr) {

            var form = $scope.form,
                name = form.name;

            // @todo: clean this up (readability)
            var ngClass="{'dark': !form.download," +
                        "'balanced': form.download," +
                        "'ion-android-checkbox-outline': form.installed && !form.download || !form.installed && form.download," +
                        "'ion-android-sync': form.installed && form.download," +
                        "'ion-android-checkbox-outline-blank': !form.installed && !form.download, " +
                        "'icon': true}";

            var cardTemplate = '<a class="item item-icon-right" ng-click="form.download=!form.download; countSelected();">' +
                               '<i ng-class="' + ngClass + '"></i>' +
                               name +
                               '</a>';

            var compiled = $compile(cardTemplate)($scope);
            elem.replaceWith(compiled);
        };

        return {
            link: renderCard
        };
    }
]);

// END ========================================================================
