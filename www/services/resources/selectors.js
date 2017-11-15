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
         * @param {Array} path - an array of path names of joins
         * @param {string} fieldName - the field name
         */
        function FieldPath(path, fieldName) {

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
         *
         * @param {string} name - the selector expression
         */
        function Selector(name) {

            this.name = name;

            this._setProperties({
                exprType: 'selector'
            });
        }

        // --------------------------------------------------------------------
        /**
         * Inherit prototype methods from Expression
         */
        Selector.prototype = Object.create(Expression.prototype);
        Selector.prototype.constructor = Selector;

        // --------------------------------------------------------------------
        // @todo: docstring
        Selector.prototype.resolveSelectors = function( /* resource */ ) {

            // @todo: implement
//             call resource.resolveSelector(this.name) => return join, path list and field name
//             construct a field path

//             return {join: join, expression: fieldPath}
        };

        // --------------------------------------------------------------------
        /**
         * Resolve field paths in this expression
         */
        Selector.prototype.resolvePaths = function( /* join, tableMap */ ) {

            // Selectors do not contain field paths => return as-is
            return this;
        };

        Selector.prototype.parse = function() {

            var selector = this.name,
                fragments = selector.split('$'),
                head = fragments[0],
                tail = fragments[1],
                parsed = {
                    head: head,
                    tail: tail
                };

            fragments = head.split('.');
            var alias = fragments[0],
                path = fragments[1];

            if (!path) {
                parsed.name = alias;
            } else if (alias == '~') {
                parsed.name = path;
            } else {
                if (alias.indexOf(':') != -1) {
                    fragments = alias.split(':');
                    parsed.key = fragments[0];
                    parsed.link = fragments[1];
                } else {
                    parsed.alias = alias;
                }
                if (tail) {
                    path += '$' + tail;
                }
                parsed.path = path;
            }

            return parsed;
        };

        Selector.prototype.resolveForeignKey = function(resource, field, tail) {

            var error,
                join,
                path,
                fieldName,
                fk = field.getForeignKey();

            if (!fk) {
                error = 'not a foreign key: ' + field;
            } else {

                var selector = new Selector(tail),
                    fkResource = resource.getTable(fk.table).getResource();

                // Resolve the selector against the joined resource
                var joinedField = selector.resolve(fkResource);
                fieldName = joinedField.fieldName;
                if (fieldName) {

                    // Add keys to Join
                    var fkJoin = joinedField.join;
                    fkJoin.lKey = field.name;
                    if (fk.table == 'em_object') {
                        fkJoin.rKey = 'em_object_id';
                    } else {
                        fkJoin.rKey = fk.key;
                    }

                    // Get path and field name
                    path = [fkJoin.getPath()];

                } else {
                    error = joinedField.error;
                }
            }

            var result = {
                join: join,
                path: path
            };
            if (fieldName) {
                result.fieldName = fieldName;
            }
            if (error) {
                result.error = error;
            }
            return result;
        };

        Selector.prototype.resolveComponent = function(resource, alias, fragment) {

            // Field in a component
            var component = resource.component(alias),
                result;
            if (component) {
                var selector = new Selector(fragment);
                result = selector.resolve(component);
            } else {
                result = {error: 'undefined component: ' + alias};
            }
            return result;
        };

        Selector.prototype.resolveJoin = function(resource, tableName, key, fragment) {

            var joinedTable = resource.getTable(tableName),
                result;

            if (!joinedTable) {
                result = {error: 'undefined table: ' + tableName};
            } else {
                var field = joinedTable.$(key),
                    selector = new Selector(fragment),
                    joinedField = selector.resolve(joinedTable.getResource()),
                    fieldName = joinedField.fieldName;

                if (fieldName) {

                    // Add keys to Join
                    var join = joinedField.join,
                        fk = field.getForeignKey();
                    if (!fk || fk.table != resource.tableName) {
                        join.lKey = 'id';
                    } else {
                        join.lKey = fk.key;
                    }
                    join.rKey = key;

                    result = {
                        fieldName: fieldName,
                        join: join,
                        path: [join.getPath()].concat(joinedField.path)
                    };

                } else {
                    result = {error: joinedField.error};
                }
            }
        };

        Selector.prototype.resolve = function(resource) {

            // Output variables
            var fieldName,
                join = resource.getJoin(),
                path = join.getPath(),
                error;

            if (!path) {
                path = [];
            } else {
                path = [path];
            }

            // Selector analysis
            var parsed = this.parse(),
                name = parsed.name,
                tail = parsed.tail,
                joinedField;

            if (name) {
                var field = resource.fields[name];
                if (!field) {
                    error = 'field not found: ' + name;
                } else {
                    if (tail) {
                        // Field in a referenced table
                        joinedField = this.resolveForeignKey(resource, field, tail);
                        fieldName = joinedField.fieldName;
                        if (fieldName) {
                            join.append(joinedField.join);
                            path = path.concat(joinedField.path);
                        } else {
                            error = joinedField.error;
                        }
                    } else {
                        // Field in this resource
                        fieldName = name;
                    }
                }
            } else {
                var alias = parsed.alias;
                if (alias) {
                    // Field in a component
                    joinedField = this.resolveComponent(resource, alias, parsed.path);
                    fieldName = joinedField.fieldName;
                    if (fieldName) {
                        join.append(joinedField.join);
                        path = path.concat(joinedField.path);
                    } else {
                        error = joinedField.error;
                    }
                } else {
                    // Field in a joined table (free join)
                    joinedField = this.resolveJoin(resource,
                                                   parsed.link,
                                                   parsed.key,
                                                   parsed.path);
                    fieldName = joinedField.fieldName;
                    if (fieldName) {
                        join.append(joinedField.join);
                        path = path.concat(joinedField.path);
                    } else {
                        error = joinedField.error;
                    }
                }
            }

            var output = {join: join, path: path};
            if (fieldName) {
                output.fieldName = fieldName;
            }
            if (error) {
                output.error = error;
            }
            return output;
        };

        // ====================================================================
        // Return prototype
        //
        return Selector;
    }
]);

// END ========================================================================
