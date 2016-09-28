/**
 * Sahana Eden Mobile - Data Forms Controllers
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
 * List of forms
 */
EdenMobile.controller("EdenMobileFormList", [
    '$scope', '$stateParams', '$emdb',
    function($scope, $stateParams, $emdb) {

        // @todo: get form names from $emdb
        $emdb.tables().then(function(tableNames) {
            var forms = [], tableName;
            for (var i=0, len=tableNames.length; i<len; i++) {
                tableName = tableNames[i];
                // @todo: get number of records from database
                forms.push({formName: tableName, numRows: 0});
            }
            $scope.forms = forms;
        });
    }
]);

/**
 * Directive for cards in form list
 */
EdenMobile.directive("emFormCard", [
    '$compile', '$emdb',
    function($compile, $emdb) {

        var renderCard = function($scope, elem, attr) {

            var form = $scope.form,
                formName = form.formName,
                numRows = form.numRows;

            $emdb.table(formName).then(function(table) {

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
