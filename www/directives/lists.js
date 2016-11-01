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

/**
 * Directive for cards in data list
 */
EdenMobile.directive("emDataCard", [
    '$compile', 'emDB',
    function($compile, emDB) {

        var renderCard = function($scope, elem, attr) {

            var formName = $scope.formName;

            emDB.table(formName).then(function(table) {
                var cardConfig = table.schema._card,
                    titleTemplate,
                    cardTemplate,
                    target = 'data.update({formName:&quot;{{formName}}&quot;,recordID:{{record.id}}})';

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

/**
 * Directive for cards in form list
 */
EdenMobile.directive("emFormCard", [
    '$compile', 'emDB',
    function($compile, emDB) {

        var renderCard = function($scope, elem, attr) {

            var form = $scope.form,
                formName = form.formName,
                numRows = form.numRows;

            emDB.table(formName).then(function(table) {

                var strings = table.schema._strings,
                    cardLabel = formName,
                    cardIcon = 'ion-folder';
                if (strings) {
                    cardLabel = strings.namePlural || strings.name || cardLabel;
                    cardIcon = strings.icon || cardIcon;
                }

                // Construct the data card template
                // @todo: add an add-button into the card?
                var cardTemplate = '<a class="item item-icon-left" href="#/data/' + formName + '">' +
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

/**
 * Directive for cards in sync form selection
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
                        "'ion-android-checkbox-outline-blank': !form.installed && !form.download, "+
                        "'icon': true}"

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
