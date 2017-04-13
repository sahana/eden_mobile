/**
 * Sahana Eden Mobile - S3JSON Codec
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

/**
 * @todo: docstring
 * @todo: add separators
 * @todo: include in index.html
 */
EdenMobile.factory('emS3JSON', [
    '$q', 'emDB', 'emUtils',
    function ($q, emDB, emUtils) {

        /**
         * @todo: docstring
         */
        function Record(table, jsonData) {

            this.data = {} // {fieldName: value}
            this.references = {} // {fieldName: [tableName, uuid]}
            this.files = {} // {fieldName: downloadURL}

            this.uuid = null;

            // @todo: implement as follows:

            // Go through the properties of the jsonData

            // if startswith $_ => component

                // this part can come later => leave a @todo:
                // skip for now

            // if startswith @ => S3XML attribute

                // get field name
                // relevant attributes: uuid, created_on, modified_on
                // => decode right here

            // if startswith $k_ => S3XML reference

                // get field name => then decode()

            // everything else => field

                // => decode()

            // if not has a uuid
            //    => generate one (emDB.uuid()), and add to data

        }

        // --------------------------------------------------------------------
        /**
         * Convert a field value to internal format, and update
         * this.data|references|files according to field type
         *
         * @param {Table} table - the emDB Table instance
         * @param {string} fieldName - the field name
         * @param {mixed} value - the S3JSON value for the field
         */
        Record.prototype.decode = function(table, fieldName, value) {

            if (value === null) {
                return;
            }

            // Get the field, and fieldType
            var field = table.fields[fieldName];
            if (field === undefined) {
                return;
            }

            var fieldType = field.type;

            // Handle upload fields
            if (fieldType == 'upload') {
                var downloadURL = value['@url'];
                if (downloadURL) {
                    this.files[fieldName] = downloadURL;
                }
                return;
            }

            // Handle references
            var reference = emUtils.getReference(fieldType);
            if (reference) {
                var lookupTable = reference[1],
                    uuid;
                if (lookupTable) {
                    uuid = value['@uuid'];
                    if (uuid) {
                        this.references[fieldName] = [lookupTable, uuid];
                    }
                }
                return;
            }

            // Decode @value|$ attributes if present
            if (value.hasOwnProperty('@value')) {
                value = value['@value'];
            } else if (value.hasOwnProperty('$')) {
                value = value['$'];
            }

            // Handle all other field types
            switch(fieldType) {
                case 'boolean':
                    // Investigate
                    if (typeof value == 'string') {
                        value = (value.toLowerCase() == 'true');
                    } else {
                        value = !!value;
                    }
                    this.data[fieldName] = value;
                    break;
                case 'integer':
                    value = parseInt(value);
                    if (!isNaN(value)) {
                        this.data[fieldName] = value;
                    }
                    break;
                case 'double':
                    value = parseFloat(value);
                    if (!isNaN(value)) {
                        this.data[fieldName] = value;
                    }
                    break;
                case 'date':
                case 'datetime':
                    // Investigate
                    this.data[fieldName] = new Date(value);
                    break;
                case 'string':
                case 'text':
                    this.data[fieldName] = value + '';
                default:
                    break;
            }
        };

        /**
         * @todo: docstring
         */
        var decode = function(tableName, data) {

            // @todo: implement as follows:

            // Receive a tableName and S3JSON data

                // Get all tables as {tableName: table} (from emDB)

                // => find the corresponding $_ attribute
                // for each element in the array:
                //      => generate a record, add to map
                //      for each reference in the record: collect in dependency list

                //  This part can come later: => leave a todo
                //      for each component in record:
                //          - if component is known:
                //              => generate a Record, add to map
                //              => add parent-link
                //              for each reference in the component record:
                //                   collect in dependency list

                // while dependencies:
                //      take first dependency:
                //         if record is in map:
                //             skip (we already import this record)
                //         if record in unknown:
                //             skip (we already know that the record isn't present)
                //         find the record in the S3JSON
                //            if present:
                //               => generate a Record, add to map
                //               for each reference in record:
                //                   => if not in map and not in unknown:
                //                       add dependency
                //            else:
                //               add to unknown

            // Return an object like:

//             {
//                 <tableName>: {
//
//                     <uuid>: <record>, ...
//
//                 }, ...
//             }

            // ...with all relevant records for that tableName (Record instances)

        };

        /**
         * @todo: docstring
         */
        var encode = function() {

            // this part can come later => @todo
        };

        /**
         * @todo: docstring
         */
        return {
            decode: decode,
            encode: encode
        };
    }
]);
