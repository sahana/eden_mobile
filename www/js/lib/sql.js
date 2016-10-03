/**
 * Sahana Eden Mobile - Primitive SQL Generator
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

var emSQL = (function() {

    /**
     * Helper function to quote identifiers
     *
     * @param {string} identifier - the identifier
     */
    var quoted = function(identifier) {
        return '"' + identifier + '"';
    };

    /**
     * SQL helper for field expressions
     *
     * @param {string} name - the field name
     * @param {object} params - the field parameters
     */
    function Field(name, params) {

        var self = this;

        self.name = name;
        self.params = params;

        /**
         * SQL to define a column in CREATE TABLE
         */
        self.define = function() {

            var params = self.params,
                sqlDef = null;

            // Determine the field type
            var fieldType = params.type || 'string',
                sqlType = null;
            switch(fieldType) {
                case 'id':
                    sqlType = 'INTEGER PRIMARY KEY AUTOINCREMENT';
                    break;
                case 'string':
                    sqlType = 'TEXT';
                    break;
                case 'text':
                    sqlType = 'TEXT';
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
            sqlDef = quoted(self.name) + ' ' + sqlType;

            // Check other field constraints
            var sqlContraints = [];
            if (params.notnull) {
                sqlContraints.push('NOT NULL');
            }
            if (sqlContraints.length) {
                sqlDef += ' ' + sqlContraints.join(' ');
            }

            return sqlDef;
        };

        /**
         * SQL Name of the field
         */
        self.sqlName = function(tableName) {

            if (tableName) {
                return quoted(tableName + '.' + self.name);
            } else {
                return quoted(self.name);
            }
        };

        /**
         * SQL Value for the field
         */
        self.sqlValue = function(value) {

            var params = self.params,
                sqlValue = null;

            switch(params.type) {
                // @todo: elaborate (e.g. date, time, datetime)
                case 'json':
                    sqlValue = JSON.stringify(value);
                    break;
                default:
                    sqlValue = value;
                    break;
            }
            return sqlValue;
        };
    }

    /**
     * SQL helper for table operations
     *
     * @param {string} tableName - the table name
     * @param {object} schema - the table schema
     */
    function Table(tableName, schema) {

        var self = this;

        self.tableName = tableName;
        self.schema = schema || {};

        /**
         * SQL to create the table
         */
        self.create = function() {

            var fields = [],
                field,
                schema = self.schema;

            for (var fieldName in schema) {
                if (fieldName[0] != '_') {
                    field = new Field(fieldName, schema[fieldName]);
                    fields.push(field.define());
                }
            }
            fields = fields.join(',');

            return 'CREATE TABLE IF NOT EXISTS "' + self.tableName + '" (' + fields + ')';
        };

        /**
         * SQL to insert new records
         *
         * @param {object} data - the data to insert, as {fieldname: value}
         */
        self.insert = function(data) {

            var fields = [],
                values = [],
                schema = self.schema,
                field,
                fieldName,
                fieldParams,
                sqlName,
                sqlValue;

            for (fieldName in data) {
                fieldParams = schema[fieldName];
                if (fieldParams) {
                    field = new Field(fieldName, fieldParams);
                    sqlName = field.sqlName();
                    sqlValue = field.sqlValue(data[fieldName]);
                    if (sqlName && sqlValue) {
                        fields.push(sqlName);
                        values.push(sqlValue);
                    }
                }
            }

            var placeholders = values.map(() => '?').join(','),
                sql = [
                    'INSERT INTO ' + quoted(self.tableName),
                    '(' + fields.join(',') + ')',
                    'VALUES (' + placeholders + ')'
                ];

            return [sql.join(' '), values];
        };

        /**
         * SQL to update records
         *
         * @param {object} data - the data to update, as {fieldname: value}
         * @param {string} query - SQL WHERE expression
         */
        self.update = function(data, query) {

            var fields = [],
                values = [],
                schema = self.schema,
                field,
                fieldName,
                fieldParams,
                sqlName,
                sqlValue;

            for (fieldName in data) {
                fieldParams = schema[fieldName];
                if (fieldParams) {
                    field = new Field(fieldName, fieldParams);
                    sqlName = field.sqlName();
                    sqlValue = field.sqlValue(data[fieldName]);
                    if (sqlName && sqlValue) {
                        fields.push(sqlName);
                        values.push(sqlValue);
                    }
                }
            }

            var placeholders = fields.map((fieldName) => fieldName + '=?').join(','),
                sql = [
                    'UPDATE ' + quoted(self.tableName),
                    'SET ' + placeholders
                ];

            if (query) {
                sql.push('WHERE ' + query);
            }

            return [sql.join(' '), values];
        };

        /**
         * SQL to select records
         *
         * @param {Array} fieldNames - array of field names
         * @param {query} query - an SQL query expression (WHERE)
         */
        self.select = function(fieldNames, query) {

            var where = query;
            if (typeof fieldNames === 'string') {
                where = fieldNames;
                fieldNames = query;
            }

            var tableName = self.tableName,
                fields = '*';

            if (fieldNames) {
                fields = [];
                for (var i=fieldNames.length; i--;) {
                    fields.push(tableName + '.' + fieldNames[i]);
                }
                fields = fields.join(',');
            }
            var sql = 'SELECT ' + fields + ' FROM ' + quoted(tableName);
            if (where) {
                sql += (' WHERE ' + where);
            }
            return sql;
        };

        /**
         * SQL to count records
         *
         * @param {string} query - SQL WHERE expression
         */
        self.count = function(query) {

            var sql = 'SELECT COUNT(id) AS number FROM ' + quoted(tableName);
            if (query) {
                sql += (' WHERE ' + query);
            }
            return sql;
        };

        /**
         * SQL to drop the table
         */
        self.drop = function() {
            return 'DROP TABLE IF EXISTS ' + quoted(self.tableName);
        };
    }

    /**
     * The API
     */
    var api = {

        /**
         * Expose the Table API
         */
        Table: function(tableName, schema) {
            return new Table(tableName, schema);
        }

    };
    return api;

}());
