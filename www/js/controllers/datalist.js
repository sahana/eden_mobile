/**
 * Sahana Eden Mobile - Data List Controller and Directives
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
 * Data List Controller
 */
EdenMobile.controller("EdenMobileDataList", [
    '$scope', '$stateParams', '$emdb',
    function($scope, $stateParams, $emdb) {

        var formName = $stateParams.formName,
            table = $emdb.table(formName);

        // @todo: check that we have a schema for table,
        // otherwise raise error and return to form list

        // Pass formName to view (@todo: should have name_nice_plural from form config)
        $scope.formName = formName;

        // Get fields for table
        var fields = [];
        for (var fieldName in table.schema) {
            if (fieldName[0] != '_') {
                fields.push(fieldName);
            }
        }
        $scope.records = [];

        // Select all existing records
        table.select(fields, function(result) {
            var rows = result.rows,
                records = [];
            for (var i=0, len=rows.length; i<len; i++) {
                records.push(rows.item(i));
            }
            $scope.records = records;
            $scope.$apply();
        });
    }
]);

/**
 * Directive for cards in data list
 */
EdenMobile.directive("emDataCard", [
    '$compile', '$emdb',
    function($compile, $emdb) {
        return {
            link: function($scope, elem, attr) {

                // @todo: get the fields from the form definition
                // @todo: render the fields into the card template
                var formName = $scope.formName,
                    cardTemplate = "Person {{record.id}}";

                // Get form name nice from $emdb
                var card = '<a class="item item-text-wrap" href="#/data/{{formName}}/{{record.id}}">' + cardTemplate + '</a>';

                // Compile the data card against the scope
                var compiled = $compile(card)($scope);

                // Render the data card in place of the directive
                elem.replaceWith(compiled);
            }
        };
    }
]);
