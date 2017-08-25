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
     * Set constructor
     *
     * @param {Table} table - the primary table of the Set
     */
    function Set(table) {

        this.table = table;
        this._db = table._db;

        this._join = [];
        this._left = [];
    }

    // ------------------------------------------------------------------------
    /**
     * Add a filter query (WHERE) to this Set
     *
     * @param {Expression} expr - the filter expression
     *
     * @returns {Set} - the Set
     */
    Set.prototype.where = function(expr) {

        // Only assertions can be filter expressions
        if (expr.exprType != 'assert') {
            throw new Error('invalid expression type');
        }

        var query = this.query;
        if (query === undefined) {
            this.query = expr;
        } else {
            this.query = query.and(expr);
        }

        // Make chainable
        return this;
    };

    // ------------------------------------------------------------------------
    /**
     * Add an inner join to this Set
     *
     * @param {Expression} expr - the join expression
     *
     * @returns {Set} - the Set
     */
    Set.prototype.join = function(expr) {

        // Must be a join expression
        if (expr.exprType != 'join') {
            throw new Error('invalid expression type');
        }

        this._join.push(expr);

        // Make chainable
        return this;
    };

    // ------------------------------------------------------------------------
    /**
     * Add a left join to this Set
     *
     * @param {Expression} expr - the join expression
     *
     * @returns {Set} - the Set
     */
    Set.prototype.left = function(expr) {

        // Must be a join expression
        if (expr.exprType != 'join') {
            throw new Error('invalid expression type');
        }

        this._left.push(expr);

        // Make chainable
        return this;
    };

    // ------------------------------------------------------------------------
    /**
     * Convert an array of result column expressions to SQL
     *
     * @param {Array} columns: array of result column expressions
     *
     * @returns {string}: string with result column expressions
     */
    Set.prototype.expand = function(columns) {

        var sql = [],
            set = this;

        columns.forEach(function(expr) {
            switch (expr.exprType) {
                case 'field':
                case 'transform':
                case 'aggregate':
                    var alias = expr.columnAlias(set),
                        sqlExpr = expr.toSQL();
                    if (alias !== expr.name) {
                        sqlExpr += ' AS "' + alias + '"';
                    }
                    sql.push(sqlExpr);
                    break;
                default:
                    throw new Error('invalid expression');
                    break;
            }
        });
        return sql.join(',');
    };

    // ------------------------------------------------------------------------
    /**
     * Select data from this Set
     *
     * @param {Array} columns - array of column expressions, can be
     *                          omitted (defaults to all columns)
     * @param {object} options - an object with options, can be omitted
     * @param {function} onSuccess - success callback, required
     * @param {function} onError - error callback, optional
     */
    Set.prototype.select = function(columns, options, onSuccess, onError) {

        // Flexible argument list
        if (arguments.length < 4) {
            if (columns !== null && columns !== undefined && columns.constructor !== Array) {
                onError = onSuccess;
                onSuccess = options;
                options = columns;
                columns = undefined;
            }
            if (typeof options == 'function') {
                onError = onSuccess;
                onSuccess = options;
                options = undefined;
            }
        }

        // Success callback is required
        if (typeof onSuccess != 'function') {
            throw new Error('callback required');
        }

        // Expand the columns
        var sql = ['SELECT'];
        if (!columns) {
            sql.push('*');
        } else {
            sql.push(this.expand(columns));
        }

        // Expand the set
        sql.push('FROM');
        sql.push(this.table.toSQL());

        this._join.forEach(function(expr) {
            sql.push('JOIN ' + expr.toSQL());
        });
        this._left.forEach(function(expr) {
            sql.push('LEFT JOIN ' + expr.toSQL());
        });

        // Expand the query
        if (this.query) {
            sql.push('WHERE');
            sql.push(this.query.toSQL());
        }

        // Limitby
        var limitby = options.limitby;
        if (limitby) {
            if (limitby.constructor == Array) {
                limitby = [0].concat(limitby).reverse();
            } else {
                limitby = [0, limitby].reverse();
            }
            var limit = limitby[0] - 0;
            if (limit && !isNaN(limit)) {
                sql.push('LIMIT ' + limit);
            }
            var offset = limitby[1] - 0;
            if (offset && !isNaN(offset)) {
                sql.push('OFFSET ' + offset);
            }
        }

        // Complete SQL statement
        sql = sql.join(' ');

        // Execute SQL query
        if (sql) {

            var db = this._db,
                set = this;

            db._adapter.executeSql(sql, [],
                function(result) {
                    // Success
                    var rows = result.rows,
                        records = [],
                        record;

                    // @todo: implement proper extraction method
                    for (var i = 0, len = rows.length; i < len; i++) {
                        record = {};
                        columns.forEach(function(column) {
                            if (column.extract) {
                                var value = column.extract(set, rows.item(i));
                            }
                            record[column.columnAlias(set)] = value;
                        });
                        records.push(record);
                    }

                    onSuccess(records, result);
                },
                function(error) {
                    // Error
                    if (typeof onError == 'function') {
                        onError(error);
                    } else {
                        db.sqlError(error);
                    }
                });
        }
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
    Set.prototype.deleteRecords = function(options, onSuccess, onError) {

    };

    // ------------------------------------------------------------------------
    // Make injectable
    //
    angular.module('EdenMobile').constant('Set', Set);

})();

// END ========================================================================
