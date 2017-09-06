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

(function() {

    "use strict";

    // ========================================================================
    /**
     * Container for a row in a query result
     *
     * @param {Table} table - the primary table of the Set
     * @param {object} data - the decoded data (from Set.extract)
     */
    function Row(table, data) {

        this._db = table._db;
        this.tableName = table.name;
        this.data = data;
    }

    // ------------------------------------------------------------------------
    /**
     * Get the value for an expression
     *
     * @param {Expression|string} expr - the expression, or the column alias
     *                                   of the expression
     *
     * @example
     *  value = row.$(table.$('name'));
     * @example
     *  value = row.$('name');
     * @example
     *  value = row.$('my_table.name');
     *
     * @returns {*} - the value for the expression, or undefined if
     *                there is no column for the expression
     */
    Row.prototype.$ = function(expr) {

        var value;

        if (expr) {

            var data = this.data;

            if (typeof expr == 'string') {
                if (data.hasOwnProperty(expr)) {
                    value = data[expr];
                } else if (expr.startsWith(this.tableName + '.')) {
                    var fieldName = expr.substring(expr.indexOf('.') + 1);
                    value = data[fieldName];
                }
            } else {
                var columnAlias = expr.columnAlias(this.tableName);
                if (columnAlias) {
                    value = this.data[columnAlias];
                }
            }
        }

        return value;
    };

    // ------------------------------------------------------------------------
    /**
     * Convert the Row into an object with {fieldName: value} properties
     *
     * @param {string|Table} - the table name (or table) for which to
     *                         extract the field values, optional
     *                         (default = primary table)
     *
     * @returns {object} - an object with {fieldName: value} properties
     */
    Row.prototype._ = function(tableName) {

        if (tableName === undefined) {
            tableName = this.tableName;
        }

        var table;
        if (typeof tableName != 'string') {
            table = tableName;
            tableName = table.name;
        } else {
            table = this._db.tables[tableName];
        }

        var data = this.data,
            result = {};

        if (tableName && table) {

            var fields = table.fields,
                colName,
                fieldName;

            for (colName in data) {
                if (colName.startsWith(tableName + '.')) {
                    fieldName = substring(colName.indexOf('.') + 1);
                } else {
                    fieldName = colName;
                }
                if (fields.hasOwnProperty(fieldName)) {
                    result[fieldName] = data[colName];
                }
            }
        }

        return result;
    };

    // ========================================================================
    /**
     * Helper function to quote SQL identifiers
     *
     * @param {string} identifier - the identifier
     *
     * @returns {string} - the quoted identifier
     */
    var quoted = function(identifier) {

        return '"' + identifier + '"';
    };

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

        // Treat strings as raw SQL
        if (typeof expr == 'string') {
            expr = this.table.sqlAssert(expr);
        }

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
            table = this.table,
            tableName = table.name;

        columns.forEach(function(expr) {

            if (typeof expr == 'string') {
                var fieldName = expr;
                expr = table.$(fieldName);
                if (expr === undefined) {
                    throw new Error('undefined field: ' + tableName + '.' + fieldName);
                }
            }

            switch (expr.exprType) {
                case 'field':
                case 'transform':
                case 'aggregate':
                    var alias = expr.columnAlias(tableName),
                        sqlExpr = expr.toSQL();
                    if (alias !== expr.name) {
                        sqlExpr += ' AS "' + alias + '"';
                    }
                    sql.push(sqlExpr);
                    break;
                default:
                    throw new Error('invalid column expression');
            }
        });
        return sql.join(',');
    };

    // ------------------------------------------------------------------------
    /**
     * Extract column data from a query result
     *
     * @param {Array} columns - Array of column expressions
     * @param {} rows - the rows returned from SELECT
     *
     * @returns {Array} - Array of Rows
     */
    Set.prototype.extract = function(columns, rows) {

        var expressions = {},
            table = this.table,
            tableName = table.name,
            fieldName;

        if (!columns) {
            columns = Object.values(table.fields);
        }
        columns.forEach(function(expr) {
            if (typeof expr == 'string') {
                fieldName = expr;
                expr = table.$(fieldName);
                if (!expr) {
                    throw new Error('undefined field: ' + tableName + '.' + fieldName);
                }
            }
            expressions[expr.columnAlias(tableName)] = expr;
        });

        var records = [],
            item,
            data,
            expr,
            alias,
            value;

        for (var i = 0, len = rows.length; i < len; i++) {

            item = rows.item(i);
            data = {};

            for (alias in expressions) {

                expr = expressions[alias];
                value = item[alias];

                if (value !== undefined && expr.decode) {
                    value = expr.decode(value);
                }

                data[alias] = value;
            }
            records.push(new Row(table, data));
        }

        return records;
    };

    // ------------------------------------------------------------------------
    /**
     * Get the SQL for limitby-option
     *
     * @param {Array|number} limitby - the limitby option
     *
     * @returns {string} - the SQL fragment for limitby
     */
    Set.prototype.limitbySQL = function(limitby) {

        var sql = [];

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

        if (sql.length) {
            sql = sql.join(' ');
        } else {
            sql = undefined;
        }
        return sql;
    };

    // ------------------------------------------------------------------------
    /**
     * Get the SQL for orderby-option
     *
     * @param {Array|number} orderby - the orderby option
     *
     * @example
     *  orderby: [table.$('date').desc()]
     * @example
     *  orderby: [table.$('value').max()]
     *
     * @note
     *  Orderby-columns which are not fields must be in the result
     * @todo:
     *  ...enforce this
     *
     * @returns {string} - the SQL fragment for orderby
     */
    Set.prototype.orderbySQL = function(orderby) {

        var sql = [],
            tableName = this.table.name;

        if (orderby) {

            if (orderby.constructor !== Array) {
                orderby = [orderby];
            }
            orderby.forEach(function(expr) {
                if (typeof expr == 'string') {
                    sql.push(expr);
                } else {
                    switch (expr.exprType) {
                        case 'field':
                        case 'aggregate':
                        case 'transform':
                            sql.push(expr.asc().toSQL(tableName));
                            break;
                        case 'orderby':
                            sql.push(expr.toSQL(tableName));
                            break;
                        default:
                            break;
                    }
                }
            });
        }

        if (sql.length) {
            sql = 'ORDER BY ' + sql.join(', ');
        } else {
            sql = undefined;
        }
        return sql;
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

        // Query options
        if (options) {
            var orderby = this.orderbySQL(options.orderby);
            if (orderby) {
               sql.push(orderby);
            }
            var limitby = this.limitbySQL(options.limitby);
            if (limitby) {
                sql.push(limitby);
            }
        }

        // Complete SQL statement
        sql = sql.join(' ');

        // Execute SQL query
        if (sql) {

            var db = this._db,
                table = this.table,
                self = this;

            db._adapter.executeSql(sql, [],
                function(result) {
                    // Success
                    var rows = result.rows,
                        records = self.extract(columns, rows);
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
     * Update the records in this Set
     *
     * @param {object} data - the data {fieldName: value, ...}
     * @param {object} options - the options {key: value, ...}
     * @property {bool} options.noDefaults - do not add update-defaults
     * @param {function} onSuccess - the success callback, receives
     *                               the number of updated rows as argument
     * @param {Function} onError - the error callback, receives the error
     *                             message as argument
     */
    Set.prototype.update = function(data, options, onSuccess, onError) {

        if (this._join.length || this._left.length) {
            throw new Error('Can not update a join');
        }

        // Flexible argument list (options and callbacks can be omitted)
        if (typeof options == 'function') {
            onError = onSuccess;
            onSuccess = options;
            options = undefined;
        }

        // Add defaults
        var table = this.table,
            record;
        if (options && options.noDefaults) {
            record = data;
        } else {
            record = table.addDefaults(data, false, true);
        }

        // Collect columns and values
        var fields = table.fields,
            fieldName,
            field,
            sqlValue,
            cols = [],
            values = [];

        for (fieldName in record) {
            field = fields[fieldName];
            if (field) {
                sqlValue = field.encode(record[fieldName]);
                if (sqlValue !== undefined) {
                    cols.push(quoted(fieldName) + '=?');
                    values.push(sqlValue);
                }
            }
        }

        if (cols.length) {

            // Build the SQL
            var sql = [
                'UPDATE ' + quoted(table.toSQL()),
                'SET ' + cols.join(',')
            ];
            if (this.query) {
                sql.push('WHERE');
                sql.push(this.query.toSQL());
            }

            // Execute the SQL
            var db = this._db;
            db._adapter.executeSql(sql.join(' '), values,
                function(result) {
                    // Success
                    if (typeof onSuccess == 'function') {
                        onSuccess(result.rowsAffected);
                    }
                },
                function(error) {
                    // Error
                    if (typeof onError == 'function') {
                        onError(error);
                    } else {
                        db.sqlError(error);
                    }
                });
        } else {
            // No data to write => invoke success callback immediately
            if (onSuccess) {
                onSuccess(0);
            }
        }
    };

    // ------------------------------------------------------------------------
    /**
     * Delete records in this Set
     *
     * @param {object} options - options {key: value}, can be omitted
     * @param {function} onSuccess - success callback, receives the number
     *                               of deleted rows as argument
     * @param {function} onError - error callback, receives the error
     *                             message as argument
     */
    Set.prototype.delete = function(options, onSuccess, onError) {

        if (this._join.length || this._left.length) {
            throw new Error('Can not delete from a join');
        }

        // Flexible arguments list
        if (typeof options == 'function') {
            onError = onSuccess;
            onSuccess = options;
            options = undefined;
        }

        // Construct the SQL
        var table = this.table,
            sql = ['DELETE FROM', quoted(table.toSQL())],
            query;

        if (this.query) {
            query = this.query.toSQL();
            sql.push('WHERE');
            sql.push(query);
        }

        var db = this._db;

        // Remember the URIs of files linked to this set,
        // to remove them after successful deletion of records
        //
        // @todo: pass this.query instead of SQLified query
        //        (once getFiles is updated to use Set.select)
        table.getFiles(query, function(orphanedFiles) {

            db._adapter.executeSql(sql.join(' '), [],
                function(result) {
                    // Delete now-orphaned files
                    orphanedFiles.remove();
                    // Execute callback
                    if (onSuccess) {
                        onSuccess(result.rowsAffected);
                    }
                },
                function(error) {
                    // Error
                    if (typeof onError == 'function') {
                        onError(error);
                    } else {
                        db.sqlError(error);
                    }
                });
        });
    };

    // ------------------------------------------------------------------------
    // Make injectable
    //
    angular.module('EdenMobile').constant('Set', Set);

})();

// END ========================================================================
