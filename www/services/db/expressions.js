/**
 * Sahana Eden Mobile - SQL Expressions
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

(function() {

    "use strict";

    // ========================================================================
    /**
     * Helper function to enclose a value in single quotes
     * (for SQL construction, escaping inner single quotes)
     *
     * @param {*} obj - the object to encode
     *
     * @returns {string} - the quoted value of the object
     */
    var quoted = function(obj) {
        return "'" + ('' + obj).replace(/'/g, "''") + "'";
    };

    // ========================================================================
    /**
     * SQL Expressions - Constructor
     *
     * @param {string} exprType - the expression type
     * @param {Expression} left - the left operand
     * @param {string} op - the operator
     * @param {Expression} right - the right operand
     */
    function Expression(exprType, left, op, right) {

        if (!left) {
            throw new Error('left operand required');
        }
        if (!op) {
            throw new Error('operator required');
        }

        switch (exprType) {
            case 'aggregate':
            case 'assert':
            case 'join':
            case 'orderby':
            case 'transform':

                this.op = op;
                this.left = left;
                this.right = right;

                Object.defineProperty(this, 'exprType', {
                    value: exprType,
                    writable: false
                });
                break;

            default:
                throw new Error('unsupported expression type: ' + exprType);
        }
    }

    // ------------------------------------------------------------------------
    /**
     * Connectives (logical operators)
     *
     * @example
     *  expression.and(otherExpression)
     */
    Expression.prototype._connective = function(op, other) {

        var expr;

        if (!other) {
            expr = this;
        } else if (other.exprType != 'assert') {
            throw new Error('invalid expression type for "' + op + '"');
        } else {
            switch (this.exprType) {
                case 'assert':
                    expr = new Expression('assert', this, op, other);
                    break;
                default:
                    throw new Error('invalid expression type for "' + op + '"');
            }
        }
        return expr;
    };

    Expression.prototype.and = function(other) {
        return this._connective('and', other);
    };
    Expression.prototype.or = function(other) {
        return this._connective('or', other);
    };
    Expression.prototype.not = function() {
        return this._connective('not', this);
    };

    // ------------------------------------------------------------------------
    /**
     * Assertions
     *
     * @example
     *  field.equals(value)
     */
    Expression.prototype._assert = function(op, other) {

        var expr;

        if (other === undefined) {
            throw new Error('missing operand');
        } else {
            switch (this.exprType) {
                case 'field':
                case 'transform':
                case 'aggregate':
                    expr = new Expression('assert', this, op, other);
                    break;
                default:
                    throw new Error('invalid operand type for "' + op + '" assertion');
            }
        }
        return expr;
    };

    Expression.prototype.equals = function(other) {
        return this._assert("=", other);
    };
    // Alias
    Expression.prototype.is = Expression.prototype.equals;

    Expression.prototype.notEqual = function(other) {
        return this._assert("!=", other);
    };
    // Alias
    Expression.prototype.isNot = Expression.prototype.notEqual;

    Expression.prototype.lessThan = function(other) {
        return this._assert("<", other);
    };
    Expression.prototype.lessOrEqual = function(other) {
        return this._assert("<=", other);
    };
    Expression.prototype.greaterOrEqual = function(other) {
        return this._assert(">=", other);
    };
    Expression.prototype.greaterThan = function(other) {
        return this._assert(">", other);
    };
    Expression.prototype.like = function(other) {
        return this._assert("like", other);
    };
    Expression.prototype.in = function(other) {
        return this._assert("in", other);
    };

    // ------------------------------------------------------------------------
    /**
     * Transformation functions
     *
     * @example
     *  field.upper()
     */
    Expression.prototype._transform = function(op) {

        var expr;

        switch (this.exprType) {
            case 'field':
            case 'transform':
                expr = new Expression('transform', this, op);
                expr.decode = this.decode;
                break;
            default:
                throw new Error('invalid type for "' + op + '" transformation');
        }
        return expr;
    };

    Expression.prototype.upper = function() {
        return this._transform('upper');
    };
    Expression.prototype.lower = function() {
        return this._transform('lower');
    };

    // ------------------------------------------------------------------------
    /**
     * Aggregation functions
     *
     * @example
     *  field.count()
     */
    Expression.prototype._aggregate = function(op) {

        var expr;

        switch (this.exprType) {
            case 'field':
                expr = new Expression('aggregate', this, op);
                expr.decode = this.decode;
                break;
            default:
                throw new Error('invalid type for "' + op + '" aggregation');
        }
        return expr;
    };

    Expression.prototype.min = function() {
        return this._aggregate('min');
    };
    Expression.prototype.max = function() {
        return this._aggregate('max');
    };
    Expression.prototype.count = function() {
        return this._aggregate('count');
    };
    Expression.prototype.avg = function() {
        return this._aggregate('avg');
    };
    Expression.prototype.sum = function() {
        return this._aggregate('sum');
    };

    // ------------------------------------------------------------------------
    /**
     * Order-by expressions
     */
    Expression.prototype._orderby = function(op) {

        var expr;

        switch (this.exprType) {
            case 'field':
            case 'aggregate':
            case 'transform':
                expr = new Expression('orderby', this, op);
                break;
            default:
                throw new Error('invalid type for "' + op + '" sorting');
        }
        return expr;
    };

    Expression.prototype.asc = function() {
        return this._orderby('asc');
    };
    Expression.prototype.desc = function() {
        return this._orderby('desc');
    };

    // ------------------------------------------------------------------------
    /**
     * Provide a string representation of this expression
     *
     * @returns {string} - a string representation of this expression
     */
    Expression.prototype.toString = function() {
        return this.toSQL();
    };

    // ------------------------------------------------------------------------
    /**
     * SQL construction
     *
     * @param {string} tableName - the name of the primary table in the
     *                             query; optional: only required for
     *                             orderby with aggregates/transformations
     *
     * @returns {string} - this expression as SQL string
     */
    Expression.prototype.toSQL = function(tableName) {

        var op = this.op,
            left = this.left;

        if (op == 'sql') {
            // Raw SQL => return left operand as-is
            return left;
        }

        var lSql = left.toSQL(),
            right = this.right,
            rSql,
            sqlStr;

        switch (op) {
            case 'and':
            case 'or':
                rSql = right.toSQL();
                sqlStr = '(' + lSql + ') ' + op.toUpperCase() + ' (' + rSql + ')';
                break;
            case '=':
            case '!=':
            case '<':
            case '<=':
            case '>=':
            case '>':
            case 'like':
                if (right !== null && right !== undefined && typeof right.toSQL == 'function') {
                    rSql = right.toSQL();
                } else {
                    if (typeof left.sqlEncode == 'function') {
                        rSql = left.sqlEncode(right);
                    } else {
                        rSql = quoted(right);
                    }
                }
                if (rSql == 'NULL') {
                    switch (op) {
                        case '=':
                            op = 'IS';
                            break;
                        case '!=':
                            op = 'IS NOT';
                            break;
                        default:
                            break;
                    }
                }
                sqlStr = [lSql, op.toUpperCase(), rSql].join(' ');
                break;
            case 'in':
                // Get the value set
                var values = right;
                if (values.constructor !== Array) {
                    // Consistency with JavaScript "in" operator
                    values = Object.keys(values);
                }

                // Convert the value set to SQL
                var items = [],
                    hasNull = false,
                    sqlEncode = false;

                if (typeof left.sqlEncode == 'function') {
                    sqlEncode = true;
                }
                values.forEach(function(value) {
                    if (value === null || value === undefined) {
                        hasNull = true;
                    } else {
                        if (sqlEncode) {
                            items.push(left.sqlEncode(value));
                        } else {
                            items.push(quoted(value));
                        }
                    }
                });

                // Construct the SQL expression
                var sql = [];
                if (items.length) {
                    sql.push(lSql + ' IN (' + items.join(',') + ')');
                }
                if (hasNull) {
                    sql.push(lSql + ' = NULL');
                }
                if (sql.length) {
                    sqlStr = sql.join(' OR ');
                } else {
                    // Empty set contains nothing => inevitably false
                    sqlStr = '0';
                }
                break;
            case 'upper':
            case 'lower':
            case 'min':
            case 'max':
            case 'avg':
            case 'sum':
            case 'count':
                sqlStr = op.toUpperCase() + '(' + lSql + ')';
                break;
            case 'on':
                sqlStr = '' + left + ' ON ' + right.toSQL();
                break;
            case 'asc':
            case 'desc':
                if (left.exprType != 'field') {
                    lSql = '"' + left.columnAlias(tableName) + '"';
                }
                sqlStr = lSql;
                // ASC is default, other directions must be explicit
                if (op != 'asc') {
                    sqlStr += ' ' + op.toUpperCase();
                }
                break;
            default:
                throw new Error('unknown operator "' + this.op + '"');
        }

        return sqlStr;
    };

    // ------------------------------------------------------------------------
    /**
     * Get the table name for a field expression
     *
     * @returns {string} - the table name
     */
    Expression.prototype.tableName = function() {

        var tableName;

        switch (this.exprType) {
            case 'transform':
            case 'aggregate':
                tableName = this.left.tableName();
                break;
            case 'field':
                if (this.table) {
                    tableName = this.table.name;
                } else {
                    tableName = '<no table>';
                }
                break;
            default:
                // Not a field expression
                break;
        }
        return tableName;
    };

    // ------------------------------------------------------------------------
    /**
     * Get a column alias for this expression
     *
     * @param {string} tableName - the name of the primary table name
     *
     * @returns {string} - the column alias
     */
    Expression.prototype.columnAlias = function(tableName) {

        var alias;

        switch (this.exprType) {
            case 'transform':
            case 'aggregate':
                var leftAlias = this.left.columnAlias(tableName);
                if (leftAlias) {
                    alias = this.op.toUpperCase() + '(' + leftAlias + ')';
                }
                break;
            default:
                throw new Error('invalid expression type');
        }
        return alias;
    };

    // ------------------------------------------------------------------------
    /**
     * Extract a value for this expression from a query result row
     *
     * @param {string} tableName - the name of the primary table name
     * @param {object} row - the result row (an item returned by executeSql)
     *
     * @returns {mixed} - the value for this expression from the row
     */
    Expression.prototype.extract = function(tableName, row) {

        var alias = this.columnAlias(tableName),
            value;

        if (row.hasOwnProperty(alias)) {
            value = row[alias];
        }
        if (value !== undefined && this.decode) {
            value = this.decode(value);
        }
        return value;
    };

    // ------------------------------------------------------------------------
    // Make injectable
    angular.module('EdenMobile').constant('Expression', Expression);

})();

// ============================================================================
// Global helper functions for query constructions
//
/**
 * NOT - negate an expression
 *
 * @returns {Expression} - the negated expression
 */
var not = function(expr) {

    return expr.not();
};

// ----------------------------------------------------------------------------
/**
 * AND - conjunction of expressions
 *
 * @returns {Expression} - a conjunction expression
 */
var allOf = function() {

    // @todo: accept+resolve arrays of expressions

    if (!arguments.length) {
        throw new Error('allOf: missing arguments');
    }

    var args = [].slice.call(arguments);

    return args.reduce(function(left, right) {

        return left.and(right);
    });
};

// ----------------------------------------------------------------------------
/**
 * OR - disjunction of expressions
 *
 * @returns {Expression} - a disjunction expression
 */
var anyOf = function() {

    // @todo: accept+resolve arrays of expressions

    if (!arguments.length) {
        throw new Error('anyOf: missing arguments');
    }

    var args = [].slice.call(arguments);

    return args.reduce(function(left, right) {
        return left.or(right);
    });
};

// END ========================================================================
