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
        /**
         * Resolve this selector against a resource, and return
         * Join and FieldPath that can be used to construct a Field
         *
         * @param {Resource} resource - the Resource
         *
         * @returns {object} - an object {join: Join, expr: FieldPath}
         *
         * @throws {Error} - when unresolvable
         */
        Selector.prototype.resolveSelectors = function(resource) {

            var resolved = this.resolve(resource),
                fieldName = resolved.fieldName;

            if (!fieldName) {
                throw new Error('"' + this.name + '": ' + resolved.error);
            }

            return {
                join: resolved.join,
                expr: new FieldPath(resolved.path, fieldName)
            };
        };

        // --------------------------------------------------------------------
        /**
         * Resolve field paths in this expression
         */
        Selector.prototype.resolvePaths = function( /* join, tableMap */ ) {

            // Selectors do not contain field paths => return as-is
            return this;
        };

        // --------------------------------------------------------------------
        /**
         * Return types for field selector parsing/resolution:
         *
         * @typedef {object} Parsed
         * @property {string} head - the head part of the selector
         * @property {string} tail - the tail part of the selector
         * @property {string} name - the field name (=head in master)
         * @property {string} path - the field path (=head not in master)
         * @property {string} alias - the alias (=field in component|link)
         * @property {string} joined - the joined table name (=free join)
         * @property {string} joinby - the foreign key name (=free join)
         *
         * @typedef {object} Resolved
         * @property {Join} join: the Join tree containing the field
         * @property {Array} path: the path to the field in the join tree
         * @property {string} fieldName: the field name, undefined if the
         *                               field could not be identified
         * @property {string} error: reason why the field could not be
         *                           identified
         */

        // --------------------------------------------------------------------
        /**
         * Parse the selector according to the following grammar:
         *
         *   selector = head$tail
         *   head = join.name | ~.name | name
         *   join = alias | joinby:joined
         *   path = name[$tail]
         *
         * @returns {Parsed} - the selector properties
         */
        Selector.prototype.parse = function() {

            var selector = this.name;
            if (!selector) {
                return undefined;
            }

            var fragments = selector.split('$'),
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
                    parsed.joinby = fragments[0];
                    parsed.joined = fragments[1];
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

        // --------------------------------------------------------------------
        /**
         * Resolve the tail part of the selector against a foreign key
         *
         * @param {Resource} resource: the master resource
         * @param {Field} field: the foreign key
         * @param {string} tail: the tail part of the selector
         *
         * @returns {Resolved} - the field description
         */
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

            var resolved = {
                join: join,
                path: path
            };
            if (fieldName) {
                resolved.fieldName = fieldName;
            }
            if (error) {
                resolved.error = error;
            }
            return resolved;
        };

        // --------------------------------------------------------------------
        /**
         * Resolve a selector fragment (parsed.path) against a component
         *
         * @param {Resource} resource - the master resource
         * @param {string} alias - the component|link alias
         * @param {string} fragment - the selector fragment
         *
         * @returns {Resolved} - the field description
         */
        Selector.prototype.resolveComponent = function(resource, alias, fragment) {

            // Field in a component
            var component = resource.component(alias),
                resolved;
            if (component) {
                var selector = new Selector(fragment);
                resolved = selector.resolve(component);
            } else {
                resolved = {error: 'undefined component: ' + alias};
            }

            return resolved;
        };

        // --------------------------------------------------------------------
        /**
         * Resolve a selector fragment (parsed.path) against a free join
         *
         * @param {Resource} resource - the master resource
         * @param {string} joined - the joined table name
         * @param {string} joinby - the joined table foreign key
         * @param {string} fragment - the selector fragment
         *
         * @returns {Resolved} - the field description
         */
        Selector.prototype.resolveJoin = function(resource, joined, joinby, fragment) {

            var joinedTable = resource.getTable(joined),
                resolved;

            if (!joinedTable) {
                resolved = {error: 'undefined table: ' + joined};
            } else {
                var joinedResource = joinedTable.getResource(),
                    selector = new Selector(fragment),
                    joinedField = selector.resolve(joinedResource),
                    fieldName = joinedField.fieldName;

                if (fieldName) {

                    // Add keys to Join
                    var join = joinedField.join,
                        joinbyField = joinedTable.$(joinby),
                        fk = joinbyField.getForeignKey(),
                        lKey = 'id';
                    if (fk) {
                        if (fk.table == 'em_object') {
                            if (joinbyField.name == 'em_object_id') {
                                // This is the objectID => find the objectKey
                                var objectKey = resource.table.getObjectKey(joinedTable,
                                                                            joinby);
                                if (objectKey) {
                                    lKey = objectKey.name;
                                } else {
                                    lKey = undefined;
                                }
                            } else {
                                // This is the objectKey => use em_object_id
                                lKey = 'em_object_id';
                            }
                        } else if (fk.table == resource.tableName) {
                            lKey = fk.key;
                        }
                    }

                    if (!lKey) {
                        resolved = {error: 'no join for: ' + joinbyField};
                    } else {
                        join.lKey = lKey;
                        join.rKey = joinby;

                        var path = [join.getPath()];
                        if (joinedResource.parent) {
                            // Drop the component join from the path
                            path = path.concat(joinedField.path.slice(1));
                        } else {
                            path = path.concat(joinedField.path);
                        }

                        resolved = {
                            fieldName: fieldName,
                            join: join,
                            path: path
                        };
                    }
                } else {
                    resolved = {error: joinedField.error};
                }
            }

            return resolved;
        };

        // --------------------------------------------------------------------
        /**
         * Resolve this selector against a resource
         *
         * @param {Resource} resource - the Resource
         *
         * @returns {Resolved} - the field description
         */
        Selector.prototype.resolve = function(resource) {

            // Output variables
            var fieldName,
                join = resource.getJoin(),
                path = join.getPath();

            if (!path) {
                path = [];
            } else {
                path = [path];
            }

            // Selector analysis
            var parsed = this.parse();
            if (!parsed) {
                return {error: 'invalid selector: ' + this.name};
            }

            var name = parsed.name,
                tail = parsed.tail,
                error,
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
                                                   parsed.joined,
                                                   parsed.joinby,
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

            var resolved = {join: join, path: path};
            if (fieldName) {
                resolved.fieldName = fieldName;
            }
            if (error) {
                resolved.error = error;
            }
            return resolved;
        };

        // ====================================================================
        // Return prototype
        //
        return Selector;
    }
]);

// END ========================================================================
