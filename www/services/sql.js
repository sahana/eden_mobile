/**
 * Sahana Eden Mobile - SQL Generator
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
     * SQLField constructor - helper class to generate SQL field expressions
     *
     * @param {Field} name - the field (emDB.Field instance)
     */
    function SQLField(field) {

        this.name = field.name;
        this.type = field.type;
        this.description = field._description;
    }

    // ------------------------------------------------------------------------
    /**
     * SQL expression to define a column in CREATE TABLE
     *
     * @returns {string} - the SQL expression
     */
    SQLField.prototype.define = function() {

        var description = this.description,
            sqlType = null;

        // Determine the SQL field type
        switch(this.type) {
            case 'id':
                sqlType = 'INTEGER PRIMARY KEY AUTOINCREMENT';
                break;
            case 'string':
                sqlType = 'TEXT';
                break;
            case 'text':
                sqlType = 'TEXT';
                break;
            case 'boolean':
                sqlType = 'INTEGER';
                break;
            case 'integer':
                sqlType = 'INTEGER';
                break;
            case 'double':
                sqlType = 'REAL';
                break;
            case 'date':
                sqlType = 'TEXT';
                break;
            case 'time':
                sqlType = 'TEXT';
                break;
            case 'datetime':
                sqlType = 'TEXT';
                break;
            case 'json':
                sqlType = 'TEXT';
                break;
            default:
                sqlType = 'TEXT';
                break;
        }

        // Check other field constraints
        var sqlContraints = [];
        if (description.notnull) {
            sqlContraints.push('NOT NULL');
        }

        // Construct field definition SQL
        var sqlDef = quoted(this.name) + ' ' + sqlType;
        if (sqlContraints.length) {
            sqlDef += ' ' + sqlContraints.join(' ');
        }

        return sqlDef;
    };

    // ------------------------------------------------------------------------
    /**
     * SQL identifier for the field
     *
     * @param {any} tableName - the table name to prefix the field name, no
     *                          prefix will be applied if omitted
     */
    SQLField.prototype.sqlName = function(tableName) {

        if (tableName) {
            return quoted(tableName + '.' + this.name);
        } else {
            return quoted(this.name);
        }
    };

    // ------------------------------------------------------------------------
    /**
     * Convert a field value from JS to SQL
     *
     * @param {mixed} jsValue - the JS value
     *
     * @returns {mixed} - the SQL value
     */
    SQLField.prototype.encode = function(jsValue) {

        if (jsValue === undefined) {
            return jsValue;
        }
        var sqlValue = jsValue;

        if (jsValue !== null) {
            switch(this.type) {
                case 'boolean':
                    if (!jsValue) {
                        sqlValue = 0;
                    } else {
                        sqlValue = 1;
                    }
                    break;
                case 'date':
                    var month = '' + (jsValue.getMonth() + 1),
                        day = '' + jsValue.getDate(),
                        year = jsValue.getFullYear();
                    if (month.length < 2) {
                        month = '0' + month;
                    }
                    if (day.length < 2) {
                        day = '0' + day;
                    }
                    sqlValue = [year, month, day].join('-');
                    break;
                case 'datetime':
                    if (jsValue) {
                        jsValue.setMilliseconds(0);
                        sqlValue = jsValue.toISOString();
                    }
                    break;
                case 'json':
                    sqlValue = JSON.stringify(jsValue);
                    break;
                default:
                    break;
            }
        }

        return sqlValue;
    };

    // ------------------------------------------------------------------------
    /**
     * Convert a field value from SQL to JS
     *
     * @param {mixed} sqlValue - the SQL value
     *
     * @returns {mixed} - the JS value
     */
    SQLField.prototype.decode = function(sqlValue) {

        var jsValue = sqlValue;

        if (jsValue !== undefined && jsValue !== null) {
            switch(this.type) {
                case 'boolean':
                    if (!sqlValue) {
                        jsValue = false;
                    } else {
                        jsValue = true;
                    }
                    break;
                case 'date':
                case 'datetime':
                    jsValue = new Date(sqlValue);
                    break;
                case 'json':
                    jsValue = JSON.parse(sqlValue);
                    break;
                default:
                    break;
            }
        }

        return jsValue;
    };

    // ========================================================================
    /**
     * SQLTable constructor - helper class to generate SQL table statements
     *
     * @param {string} table - the table (emDB.Table instance)
     */
    function SQLTable(table) {

        this.name = table.tableName;
        this.fields = table.fields;
    }

    // ------------------------------------------------------------------------
    /**
     * SQL statement to create the table
     *
     * @returns {string} - the SQL statement
     */
    SQLTable.prototype.create = function() {

        var fields = this.fields,
            sqlField,
            cols = [];

        // Column definitions
        for (var fieldName in fields) {
            sqlField = new SQLField(fields[fieldName]);
            cols.push(sqlField.define());
        }
        cols = cols.join(',');

        return 'CREATE TABLE IF NOT EXISTS ' + quoted(this.name) + ' (' + cols + ')';
    };

    // ------------------------------------------------------------------------
    /**
     * SQL statement to drop the table
     *
     * @returns {string} - the SQL statement
     */
    SQLTable.prototype.drop = function() {

        return 'DROP TABLE IF EXISTS ' + quoted(this.name);
    };

    // ------------------------------------------------------------------------
    /**
     * SQL statement to insert new records
     *
     * @param {object} data - the data to insert, as {fieldname: value}
     *
     * @returns {Array} - an array of [SQLStatement, SQLValues]
     */
    SQLTable.prototype.insert = function(data) {

        var fields = this.fields,
            fieldName,
            field,
            sqlField,
            sqlValue,
            cols = [],
            values = [];

        // Collect and encode data
        for (fieldName in data) {
            field = fields[fieldName];
            if (field) {
                sqlField = new SQLField(field);
                sqlValue = sqlField.encode(data[fieldName]);
                if (sqlValue !== undefined) {
                    cols.push(sqlField.sqlName());
                    values.push(sqlValue);
                }
            }
        }

        // Construct SQL statement
        var placeholders = cols.map(col => '?').join(','),
            sql = [
                'INSERT INTO ' + quoted(this.name),
                '(' + cols.join(',') + ')',
                'VALUES (' + placeholders + ')'
            ];

        return [sql.join(' '), values];
    };

    // ------------------------------------------------------------------------
    /**
     * SQL statement to update records
     *
     * @param {object} data - the data to update, as {fieldname: value}
     * @param {string} query - SQL WHERE expression
     *
     * @returns {Array} - and array of [SQLStatement, SQLValues]
     */
    SQLTable.prototype.update = function(data, query) {

        var fields = this.fields,
            fieldName,
            field,
            sqlField,
            sqlValue,
            cols = [],
            values = [];

        for (fieldName in data) {
            field = fields[fieldName];
            if (field) {
                sqlField = new SQLField(field);
                sqlValue = sqlField.encode(data[fieldName]);
                if (sqlValue !== undefined) {
                    cols.push(sqlField.sqlName());
                    values.push(sqlValue);
                }
            }
        }

        var placeholders = cols.map(col => col + '=?').join(','),
            sql = [
                'UPDATE ' + quoted(this.name),
                'SET ' + placeholders
            ];

        if (query) {
            sql.push('WHERE ' + query);
        }

        return [sql.join(' '), values];
    };

    // ------------------------------------------------------------------------
    /**
     * SQL statements to select records
     *
     * @param {Array} fieldNames - array of field names
     * @param {query} query - an SQL query expression (WHERE)
     *
     * @returns {string} - the SQL statement
     */
    SQLTable.prototype.select = function(fieldNames, query) {

        var where = query;
        if (typeof fieldNames === 'string') {
            where = fieldNames;
            fieldNames = query;
        }

        var tableName = this.name,
            cols = '*';
        if (fieldNames) {
            cols = fieldNames.map(col => tableName + '.' + col).join(',');
        }

        var sql = 'SELECT ' + cols + ' FROM ' + quoted(tableName);
        if (where) {
            sql += (' WHERE ' + where);
        }

        return sql;
    };

    // ------------------------------------------------------------------------
    /**
     * SQL statement to count records
     *
     * @param {string} query - SQL WHERE expression
     *
     * @returns {string} - the SQL statement
     */
    SQLTable.prototype.count = function(query) {

        var sql = 'SELECT COUNT(id) AS number FROM ' + quoted(this.name);
        if (query) {
            sql += (' WHERE ' + query);
        }

        return sql;
    };

    // ------------------------------------------------------------------------
    /**
     * SQL statements to delete records
     *
     * @param {string} query - SQL WHERE expression
     *
     * @returns {string} - the SQL statement
     */
    SQLTable.prototype.deleteRecords = function(query) {

        var sql = 'DELETE FROM ' + quoted(this.name);
        if (query) {
            sql += (' WHERE ' + query);
        }

        return sql;
    };

    // ------------------------------------------------------------------------
    /**
     * Convert a raw database record into a JS object
     *
     * @param {Array} fieldNames - list of field names
     * @param {object} item - the raw database record
     *
     * @return {object} - object with the converted record data
     */
    SQLTable.prototype.extract = function(fieldNames, item) {

        var fields = this.fields,
            fieldName;

        if (!fieldNames) {
            fieldNames = [];
            for (fieldName in fields) {
                fieldNames.push(fieldName);
            }
        }

        var jsData = {},
            field,
            sqlField,
            jsValue;

        fieldNames.forEach(function(fieldName) {

            var field = fields[fieldName];
            if (field) {
                if (item.hasOwnProperty(fieldName)) {
                    sqlField = new SQLField(field);
                    jsValue = sqlField.decode(item[fieldName]);
                } else {
                    jsValue = null;
                }
                jsData[fieldName] = jsValue;
            }
        });

        return jsData;
    };

    // ========================================================================
    /**
     * emSQL - Service to generate SQL statements and expressions
     *
     * @class emSQL
     * @memberof EdenMobile
     */
    EdenMobile.factory('emSQL', [
        function () {

            var api = {

                /**
                 * Get an SQLField wrapper
                 *
                 * @param {Field} field - the emDB Field
                 */
                Field: function(field) {
                    return new SQLField(field);
                },

                /**
                 * Get an SQLTable wrapper
                 *
                 * @param {Table} table - the emDB Table
                 */
                Table: function(table) {
                    return new SQLTable(table);
                }
            };
            return api;
        }
    ]);

})();

// END ========================================================================
