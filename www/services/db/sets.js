/**
 * Sahana Eden Mobile - Sets
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

"use strict";

(function() {

    // ========================================================================
    /**
     * Data Sets
     */
    function Set(table) {

        this.table = table;

        this.join = [];
        this.left = [];
    }

    // ------------------------------------------------------------------------
    /**
     * Add a filter query to this Set
     *
     * @param {Expression} expr - a filter expression
     */
    Set.prototype.where = function(expr) {

        // Only assertions can be
        if (expr.exprType != 'assert' && expr.exprType != 'connective') {
            throw new Error('invalid expression type');
        }

        // @todo: if we already have a where, AND it with expr
        this.where = expr;

        // Make chainable
        return this;
    };

    // ------------------------------------------------------------------------
    /**
     * @todo: docstring
     */
    Set.prototype.join = function(expr) {

        // @todo: make sure expr is type 'join'

        this.join.push(expr);

        // Make chainable
        return this;
    };

    // ------------------------------------------------------------------------
    /**
     * @todo: docstring
     */
    Set.prototype.left = function(expr) {

        // @todo: make sure expr is type 'join'

        this.left.push(expr);

        // Make chainable
        return this;
    };

    // ------------------------------------------------------------------------
    /**
     * @todo: implement this
     * @todo: docstring
     */
    Set.prototype.select = function(fields, options, onSuccess, onError) {

        var sql = ['SELECT'];

        sql.push('*');

        sql.push('FROM');

        sql.push('' + this.table);

        if (this.where) {
            sql.push('WHERE');
            sql.push(this.where.toSQL());
        }

        console.log(sql.join(' '));
    };

    // ------------------------------------------------------------------------
    /**
     * @todo: implement this
     * @todo: docstring
     */
    Set.prototype.update = function(data, options, onSuccess, onError) {

    };

    // ------------------------------------------------------------------------
    /**
     * @todo: implement this
     * @todo: docstring
     */
    Set.prototype.delete = function(options, onSuccess, onError) {

    };

    // ------------------------------------------------------------------------
    // Make injectable
    //
    angular.module('EdenMobile').constant('Set', Set);

})();
