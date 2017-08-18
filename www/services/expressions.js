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

"use strict";

(function() {

    function Expression(exprType, left, op, right) {

        if (!left) {
            throw new Error('left operand required');
        }
        if (!op) {
            throw new Error('operator required')
        }

        switch (exprType) {
            case 'assert':
            case 'connective':
            case 'transform':
            case 'aggregate':
            case 'join':

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
                break;
        }
    }

    /**
     * Connectives
     */
    Expression.prototype._connective = function(op, other) {

        if (!other) {
            return this;
        } else if (other.exprType != 'assert') {
            throw new Error('invalid type for connective');
        }
        switch (this.exprType) {
            case 'assert':
                return new Expression('connective', this, op, other);
                break;
            default:
                throw new Error('invalid type for connective');
                break;
        }
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

    /**
     * Assertions
     */
    Expression.prototype._assert = function(op, other) {

        if (other === undefined) {
            throw new Error('missing operand');
        }
        switch (this.exprType) {

            case 'field':
            case 'transform':
            case 'aggregate':
                return new Expression('assert', this, op, other);
                break;
            default:
                throw new Error('invalid type for assertion');
                break;
        }
    };
    Expression.prototype.equals = function(other) {
        return this._assert("=", other);
    };
    Expression.prototype.notEqual = function(other) {
        return this._assert("!=", other);
    };
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

    /**
     * Transformation functions
     */
    Expression.prototype._transform = function(op) {

        switch (this.exprType) {

            case 'field':
            case 'transform':
                return new Expression('transform', this, op);
                break;
            default:
                throw new Error('invalid type for transformation');
                break;
        }
    };
    Expression.prototype.upper = function() {
        return this._transform('upper');
    };
    Expression.prototype.lower = function() {
        return this._transform('lower');
    };

    /**
     * Aggregation functions
     */
    Expression.prototype._aggregate = function(op) {

        switch (this.exprType) {

            case 'field':
                return new Expression('aggregate', this, op)
                break;
            default:
                throw new Error('invalid type for aggregation');
                break;
        }
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

    /**
     * SQL construction
     */
    Expression.prototype.toSQL = function() {

        var sqlStr,
            op = this.op,
            left = this.left,
            right = this.right,
            lSql = left.toSQL(),
            rSql;

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
                if (typeof right.toSQL == 'function') {
                    rSql = right.toSQL();
                } else {
                    if (typeof left.sqlEncode == 'function') {
                        rSql = left.sqlEncode(right);
                    } else {
                        rSql = "'" + ('' + right).replace(/'/g, "''") + "'";
                    }
                }
                sqlStr = [lSql, op, rSql].join(' ');
                break;
            case 'upper':
            case 'lower':
            case 'min':
            case 'max':
            case 'avg':
            case 'count':
                sqlStr = op.toUpperCase() + '(' + leftSql + ')';
                break;
            case 'on':
                sqlStr = '' + left + ' ON ' + right.toSQL();
                break;
            default:
                throw new Error('unknown operator "' + this.op + '"');
        }

        return sqlStr;

    }

    Expression.prototype.toString = function() {
        return this.toSQL();
    };

    // Make injectable
    angular.module('EdenMobile').constant('Expression', Expression);

})();

// ============================================================================
// Helper functions for query constructions
//

/**
 * @todo: docstring
 */
var not = function(expr) {
    return expr.not()
};

// ----------------------------------------------------------------------------
/**
 * @todo: docstring
 */
var allOf = function() {

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
 * @todo: docstring
 */
var anyOf = function() {

    if (!arguments.length) {
        throw new Error('anyOf: missing arguments');
    }

    var args = [].slice.call(arguments);

    return args.reduce(function(left, right) {
        return left.or(right);
    });
};

// END ========================================================================
