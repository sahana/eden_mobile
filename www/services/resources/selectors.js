/**
 * Sahana Eden Mobile - Field Selectors
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

EdenMobile.factory('Selector', [
    'Expression',
    function (Expression) {

        "use strict";

        // ====================================================================
        /**
         * FieldPath
         *
         * @param {string} masterTable - the name of the master table
         * @param {Array} path - an array of path names of joins
         * @param {string} fieldName - the field name
         */
        function FieldPath(masterTable, path, fieldName) {

            this.masterTable = masterTable; // is this really needed?
            this.path = path;
            this.fieldName = fieldName;

            this._setProperties({
                exprType: 'fieldpath'
            });
        }

        // --------------------------------------------------------------------
        /**
         * Inherit prototype methods from Expression
         */
        FieldPath.prototype = Object.create(Expression.prototype);
        FieldPath.prototype.constructor = FieldPath;

        // --------------------------------------------------------------------
        /**
         * Resolve selectors in this expression (into field paths)
         *
         * @returns {object} - object with the resolved Expression and the
         *                     necessary Joins
         */
        FieldPath.prototype.resolveSelectors = function( /* resource */ ) {

            return {
                expr: this
            };
        };

        // --------------------------------------------------------------------
        /**
         * Resolve field paths in this expression (into fields)
         *
         * @param {Join} join - the join tree to resolve the paths
         * @param {object} tableMap - an object {alias: Table} to resolve
         *                            table aliases
         *
         * @returns {Expression} - the resolved expression
         */
        FieldPath.prototype.resolvePaths = function(join, tableMap) {

            var field,
                subJoin = join.resolvePath(this.path);

            if (subJoin) {
                var alias = subJoin.getAlias() || subJoin.tableName,
                    table = tableMap[alias];
                if (table) {
                    field = table.$(this.fieldName);
                }
            }

            if (!field) {
                throw new Error('unresolvable field path');
            }

            return field;
        };

        // ====================================================================
        /**
         * Selector
         */
        function Selector() {

        }

        // --------------------------------------------------------------------
        /**
         * Inherit prototype methods from Expression
         */
        Selector.prototype = Object.create(Expression.prototype);
        Selector.prototype.constructor = Selector;

        // --------------------------------------------------------------------
        // @todo: docstring
        Selector.prototype.resolveSelectors = function(resource) {

            // @todo: implement
//             call resource.resolveSelector(this.name) => return join, path list and field name
//             construct a field path

//             return {join: join, expression: fieldPath}
        };

        // --------------------------------------------------------------------
        // @todo: docstring
        Selector.prototype.resolvePaths = function(join, tableMap) {

            // @todo: implement
//             return this;
        };

        // ====================================================================
        // Return prototype
        //
        return Selector;
    }
]);

// END ========================================================================
