/**
 * Sahana Eden Mobile - Wizard Widget Directives
 *
 * Copyright (c) 2019-2019 Sahana Software Foundation
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

(function(EdenMobile) {

    "use strict";

    // ========================================================================
    /**
     * Copy directive attributes to a generated element, using the
     * attribute map of the directive to map camelCase notation to
     * dash notation, e.g. ngModel becomes ng-model.
     *
     * @param {object} ngAttr - the directive's DOM attributes
     * @param {DOMNode} element - the target element
     * @param {Array} validAttr - the attributes to copy in camelCase
     *                            notation
     */
    function copyAttr(ngAttr, element, validAttr) {

        var attrMap = ngAttr.$attr,
            attribute,
            name,
            value;

        for (var i=validAttr.length; i--;) {
            attribute = validAttr[i];

            name = attrMap[attribute];
            value = ngAttr[attribute];
            if (name && value !== undefined) {
                element.attr(name, value);
            }
        }
    }

    // ========================================================================
    /**
     * Generic Widget <em-wizard-generic-widget>
     */
    EdenMobile.directive('emWizardGenericWidget', [
        function() {
            return {
                template: ''
            };
        }
    ]);

    // ========================================================================
    /**
     * Boolean Widget <em-wizard-boolean-widget>
     */
    EdenMobile.directive('emWizardBooleanWidget', [
        '$compile',
        function($compile) {

            var renderWidget = function($scope, elem, attr) {

                // Create the widget
                var widget;
                if (attr.widget == 'checkbox') {
                    // Checkbox
                    widget = angular.element('<ion-checkbox>')
                                    .html(attr.label || '');
                } else {
                    // Default: Toggle
                    widget = angular.element('<ion-toggle toggle-class="toggle-positive">')
                                    .html(attr.label || '');
                }

                // Set the name
                var fieldName = attr.field;
                if (fieldName) {
                    widget.attr('name', fieldName);
                }

                // Widget attributes and directives
                copyAttr(attr, widget, [
                    'ngModel',
                    'disabled'
                ]);

                // Add widget to DOM and compile it against scope
                elem.replaceWith(widget);
                $compile(widget)($scope);
            };

            return {
                link: renderWidget
            };
        }
    ]);

    // ========================================================================
    /**
     * Date widget <em-wizard-date-widget>
     */
    EdenMobile.directive('emWizardDateWidget', [
        '$compile',
        function($compile) {

            var renderWidget = function($scope, elem, attr) {

                // Create the widget
                var widget = angular.element('<input type="date">');

                // Set the name
                var fieldName = attr.field;
                if (fieldName) {
                    widget.attr('name', fieldName);
                }

                // Widget attributes and directives
                // TODO apply validation directives
                copyAttr(attr, widget, [
                    'ngModel',
                    'disabled',
                    'ngRequired'
                ]);

                // Add widget to DOM and compile it against scope
                elem.replaceWith(widget);
                $compile(widget)($scope);
            };

            return {
                link: renderWidget
            };
        }
    ]);

    // ========================================================================
    /**
     * Number widget <em-wizard-number-widget>
     */
    EdenMobile.directive('emWizardNumberWidget', [
        '$compile',
        function($compile) {

            var renderWidget = function($scope, elem, attr) {

                // Create the widget
                var widget = angular.element('<input type="number">');

                // Set the name
                var fieldName = attr.field;
                if (fieldName) {
                    widget.attr('name', fieldName);
                }

                // Widget attributes and directives
                copyAttr(attr, widget, [
                    'ngModel',
                    'disabled',
                    'placeholder',
                    'ngRequired',
                    'ngPattern',
                    'min',
                    'max'
                ]);

                // Add widget to DOM and compile it against scope
                elem.replaceWith(widget);
                $compile(widget)($scope);
            };

            return {
                link: renderWidget
            };
        }
    ]);

    // ========================================================================
    /**
     * String widget <em-wizard-string-widget>
     */
    EdenMobile.directive('emWizardStringWidget', [
        '$compile',
        function($compile) {

            var renderWidget = function($scope, elem, attr) {

                // Create the widget
                var widget = angular.element('<input>')
                                    .attr('type', attr.type || 'text');

                // Set the name
                var fieldName = attr.field;
                if (fieldName) {
                    widget.attr('name', fieldName);
                }

                // Widget attributes and directives
                copyAttr(attr, widget, [
                    'ngModel',
                    'disabled',
                    'placeholder',
                    'ngRequired'
                ]);

                // Add widget to DOM and compile it against scope
                elem.replaceWith(widget);
                $compile(widget)($scope);
            };

            return {
                link: renderWidget
            };
        }
    ]);

    // ========================================================================
    /**
     * Text widget <em-wizard-text-widget>
     */
    EdenMobile.directive('emWizardTextWidget', [
        '$compile',
        function($compile) {

            var renderWidget = function($scope, elem, attr) {

                // Create the widget
                var widget = angular.element('<textarea rows="5" cols="60">');

                // Set the name
                var fieldName = attr.field;
                if (fieldName) {
                    widget.attr('name', fieldName);
                }

                // Widget attributes and directives
                copyAttr(attr, widget, [
                    'ngModel',
                    'disabled',
                    'placeholder',
                    'ngRequired'
                ]);

                // Add widget to DOM and compile it against scope
                elem.replaceWith(widget);
                $compile(widget)($scope);
            };

            return {
                link: renderWidget
            };
        }
    ]);

    // ========================================================================
    /**
     * Single-select options-widget <em-wizard-options-widget>
     */
    EdenMobile.directive('emWizardOptionsWidget', [
        '$compile',
        function($compile) {

            /**
             * No-options-available hint
             *
             * @returns {angular.element} - the element to use as widget
             */
            var noOptionsHint = function() {
                return angular.element('<span class="noopts">')
                              .text('No options available');
            };

            /**
             * List of radio items (ion-radio)
             *
             * @param {string} fieldName - the field name
             * @param {Array} options - the selectable options [[value, repr], ...]
             * @param {object} attr - the DOM attributes of the widget directive
             *
             * @returns {angular.element} - the element to use as widget
             */
            var radioItems = function(fieldName, options, attr) {

                var widget = angular.element('<ion-list class="radio-options">'),
                    valueRequired = attr.ngRequired;

                options.forEach(function(option) {
                    var value = option[0],
                        repr = option[1];
                    if (!value && value !== 0) {
                        // Empty-option
                        if (valueRequired) {
                            return;
                        } else if (!repr){
                            repr = '-';
                        }
                    } else if (!repr) {
                        repr = '' + option[0];
                    }

                    var item = angular.element('<ion-radio>')
                                      .attr('name', fieldName)
                                      .attr('value', value)
                                      .html(repr);
                    copyAttr(attr, item, [
                        'ngModel',
                        'disabled',
                        'ngRequired'
                    ]);
                    widget.append(item);
                });

                return widget;
            };

            /**
             * Standard platform-specific SELECT
             *
             * @param {string} fieldName - the field name
             * @param {Array} options - the selectable options [[value, repr], ...]
             * @param {object} attr - the DOM attributes of the widget directive
             *
             * @returns {angular.element} - the element to use as widget
             */
            var standardSelect = function(fieldName, options, attr) {

                var widget = angular.element('<select>'),
                    valueRequired = attr.ngRequired;

                options.forEach(function(option) {
                    var value = option[0],
                        repr = option[1];
                    if (!value && value !== 0) {
                        // Empty-option
                        if (valueRequired) {
                            return;
                        } else if (!repr){
                            repr = '-';
                        }
                    } else if (!repr) {
                        repr = '' + option[0];
                    }

                    var item = angular.element('<option>')
                                      .attr('value', value)
                                      .html(repr);
                    widget.append(item);
                });

                widget.attr('name', fieldName);

                copyAttr(attr, widget, [
                    'ngModel',
                    'disabled',
                    'ngRequired'
                ]);

                return widget;
            };

            /**
             * Link a DOM element to this directive
             */
            var link = function($scope, elem, attr) {

                var resource = $scope.resource,
                    fieldName = attr.field;

                resource.getOptions(fieldName).then(
                    function(options) {
                        // Construct the widget
                        var widget;
                        if (!options.length) {
                            widget = noOptionsHint();
                        } else if (options.length <= 20) {
                            widget = radioItems(fieldName, options, attr);
                        } else {
                            widget = standardSelect(fieldName, options, attr);
                        }

                        // Add widget to DOM and compile it against scope
                        elem.replaceWith(widget);
                        $compile(widget)($scope);
                    },
                    function() {
                        // This field has no options
                        var widget = noOptionsHint();

                        // Add widget to DOM and compile it against scope
                        elem.replaceWith(widget);
                        $compile(widget)($scope);
                    });
            };

            // Return the DDO
            return {
                link: link
            };
        }
    ]);

    // ========================================================================
    /**
     * Multi-select widget <em-wizard-multi-select>
     * - renders a regular <select> with multiple-attribute
     * - uses the em-multi-select-checkbox directive to convert it into
     *   a checkbox list
     */
    EdenMobile.directive('emWizardMultiSelect', [
        '$compile',
        function($compile) {

            // Hint that no options available
            var noOptionsHint = function() {
                return angular.element('<span class="noopts">')
                              .text('No options available');
            };

            // Construct a <select> from the field options
            var standardSelect = function(fieldName, options, attr) {

                var widget = angular.element('<select>'),
                    valueRequired = attr.ngRequired;

                options.forEach(function(option) {
                    var value = option[0],
                        repr = option[1];
                    if (!value && value !== 0) {
                        // Empty-option
                        if (valueRequired) {
                            return;
                        } else if (!repr){
                            repr = '-';
                        }
                    } else if (!repr) {
                        repr = '' + option[0];
                    }

                    var item = angular.element('<option>')
                                      .attr('value', value)
                                      .html(repr);
                    widget.append(item);
                });

                widget.attr('name', fieldName);

                copyAttr(attr, widget, [
                    'ngModel',
                    'disabled',
                    'ngRequired'
                ]);

                return widget;
            };

            // Link this directive to a DOM element
            var link = function($scope, elem, attr) {

                var resource = $scope.resource,
                    fieldName = attr.field;

                resource.getOptions(fieldName).then(
                    function(options) {
                        // Construct the widget
                        var widget;
                        if (!options.length) {
                            widget = noOptionsHint();
                        } else {
                            widget = standardSelect(fieldName, options, attr);
                            widget.attr('multiple', 'true');
                            widget.attr('em-multi-select-checkbox', '');
                        }

                        // Add widget to DOM and compile it against scope
                        elem.replaceWith(widget);
                        $compile(widget)($scope);
                    },
                    function() {
                        // This field has no options
                        var widget = noOptionsHint();

                        // Add widget to DOM and compile it against scope
                        elem.replaceWith(widget);
                        $compile(widget)($scope);
                    });
            };

            return {
                link: link
            };
        }
    ]);

    // ------------------------------------------------------------------------
    /**
     * Directive to render a multi-select as checkboxes list
     * - <select multiple='true' em-multi-select-checkbox>
     */
    EdenMobile.directive('emMultiSelectCheckbox', [
        '$compile',
        function($compile) {

            /**
             * Link this directive to a <select> element
             */
            var link = function($scope, elem, attr, ngModel) {

                // Inspect the options, build selectable items array
                var options = elem.find('option'),
                    items = [];
                angular.forEach(options, function(option) {
                    var $option = angular.element(option);
                    items.push({
                        value: $option.val(),
                        label: $option.text(),
                        checked: false
                    });
                });
                $scope.items = items;

                // Construct the checkbox list
                var checkboxList = angular.element('<div class="list multi-select">'),
                    checkboxes = angular.element('<ion-checkbox>')
                                        .attr('ng-repeat', 'item in items')
                                        .attr('ng-model', 'item.checked')
                                        .attr('ng-change', 'select()')
                                        .text('{{item.label}}')
                                        .val('{{item.value}}');
                checkboxList.append(checkboxes);
                copyAttr(attr, checkboxList, [
                    'name',
                    'ngModel',
                    'ngRequired'
                ]);


                // Function to update the model when a checkbox status has changed
                $scope.select = function() {
                    var selected = $scope.items.filter(function(item) {
                        return item.checked;
                    }).map(function(item) {
                        return item.value;
                    });
                    ngModel.$setViewValue(selected);
                    ngModel.$setDirty();
                    ngModel.$setTouched();
                    checkboxList[0].focus();
                };

                // Function to update the checkbox status when the model has changed
                var render = function(value) {
                    if (value && value.constructor === Array) {
                        $scope.items.forEach(function(item) {
                            if (value.indexOf(item.value) != -1) {
                                item.checked = true;
                            } else {
                                item.checked = false;
                            }
                        });
                    } else {
                        $scope.items.forEach(function(item) {
                            item.checked = false;
                        });
                    }
                };

                // Watch the model for changes
                // - $watch needed because $render is only called when the
                //   entire list replaced, but not when its elements change
                ngModel.$render = function() {
                    render(ngModel.$viewValue);
                };
                $scope.$watch(attr.ngModel, function(newValue) {
                    render(newValue);
                });

                // Add the checkboxList to the DOM, and compile it
                elem.replaceWith(checkboxList);
                $compile(checkboxList)($scope);

                // Set initial value
                render(elem.val());
            };

            return {
                restrict: 'A',
                scope: true,
                require: 'ngModel',
                link: link
            };
        }
    ]);

    // ========================================================================
    /**
     * Simple generic JSON input widget <em-wizard-json-widget>
     * - default widget for 'json' fields
     * - uses the isJson directive for parsing/formatting and validation
     */
    EdenMobile.directive('emWizardJsonWidget', [
        '$compile',
        function($compile) {

            var link = function($scope, elem, attr) {

                // Create the widget
                var widget = angular.element('<textarea class="json-input" rows="5" cols="60">');

                // Set the name
                var fieldName = attr.field;
                if (fieldName) {
                    widget.attr('name', fieldName);
                }

                // Widget attributes and directives
                copyAttr(attr, widget, [
                    'ngModel',
                    'disabled',
                    'ngRequired',
                    'isJson'    // copy applicable validators
                ]);

                // Add widget to DOM and compile it against scope
                elem.replaceWith(widget);
                $compile(widget)($scope);
            };

            return {
                link: link
            };
        }
    ]);

    // ========================================================================
    /**
     * Image Map widget <em-wizard-image-map>
     * - mark points of relevance on an image
     * - marked points select pre-defined regions (polygons) in the image
     * - produces JSON output, format:
     *      {"selectedPoints": [[lon, lat], ...],
     *       "selectedRegions": [regionID, ...],
     *       }
     */
    EdenMobile.directive('emWizardImageMap', [
        '$compile', '$q', 'emDialogs',
        function($compile, $q, emDialogs) {

            // ----------------------------------------------------------------
            /**
             * Map styles for selected points and regions
             */
            var mapStyles = {
                selectedPoints: new ol.style.Style({
                    image: new ol.style.Circle({
                        radius: 7,
                        fill: new ol.style.Fill({
                            color: [255, 0, 0, 0.8]
                        }),
                        stroke: new ol.style.Stroke({
                            color: [255, 0, 0, 1.0],
                            width: 2
                        })
                    })
                }),
                selectedRegions: new ol.style.Style({
                    fill: new ol.style.Fill({
                        color: [0, 85, 127, 0.4]
                    }),
                    stroke: new ol.style.Stroke({
                        color: [0, 85, 127, 0.8],
                        width: 2
                    })
                }),
                deselectedRegions: new ol.style.Style({
                    fill: new ol.style.Fill({
                        color: [0, 0, 0, 0]
                    }),
                    stroke: new ol.style.Stroke({
                        color: [0, 0, 0, 0],
                        width: 2
                    })
                })
            };

            // ----------------------------------------------------------------
            /**
             * Add a selected point
             * - updates $scope.selection.selectedPoints, detects duplicates,
             *   moves re-selected points to the end of the array
             * - adds a point feature to the point source, which renders
             *   a circle marker on the point's position
             *
             * @param {object} $scope - the local scope of the widget
             * @param {ol.source.Vector} pointSource - the point source
             * @param {Array} coordinate - the point's coordinate [lon, lat]
             *
             * @returns {boolean} - whether a new points was indeed added
             */
            var addSelectedPoint = function($scope, pointSource, coordinate) {

                var selection = $scope.selection,
                    newSelection = [],
                    add = true;

                var maxSelectedPoints = $scope.maxSelectedPoints;
                if (maxSelectedPoints == 1) {
                    // Single-select => new selection replaces previous selection
                    pointSource.clear();
                } else {
                    var selectedPoints = selection.selectedPoints;

                    // Enforce maxSelectedPoints
                    if (selectedPoints.length == maxSelectedPoints) {
                        emDialogs.error('Only ' + maxSelectedPoints + ' clicks allowed');
                        return false;
                    }

                    selectedPoints.forEach(function(point) {
                        if (point[0] != coordinate[0] || point[1] != coordinate[1]) {
                            newSelection.push(point);
                        } else {
                            // This point was already selected
                            add = false;
                        }
                    });
                }

                newSelection.push(coordinate);
                if (add) {
                    var feature = new ol.Feature({
                        geometry: new ol.geom.Point(coordinate)
                    });
                    pointSource.addFeature(feature);
                }
                selection.selectedPoints = newSelection;

                return add;
            };

            // ----------------------------------------------------------------
            /**
             * Update selected regions
             * - match $scope.selection.selectedPoints to pre-defined regions
             * - make matching regions visible on the map
             * - update $scope.selection.selectedRegions
             *
             * @param {object} $scope - the local scope of the widget
             * @param {ol.source.Vector} regionSource - the regions source
             *
             * @returns {Array} - the IDs of the selected regions
             */
            var updateSelectedRegions = function($scope, regionSource) {

                var selection = $scope.selection,
                    selectedPoints = selection.selectedPoints;

                var selectedRegionIDs = [],
                    selected = {};
                selectedPoints.forEach(function(coordinate) {
                    // Get all regions matching this point
                    var regions = regionSource.getFeaturesAtCoordinate(coordinate);

                    regions.forEach(function(region) {
                        var regionID = region.getProperties().region;
                        if (!selected[regionID]) {
                            selected[regionID] = true;
                            selectedRegionIDs.push(regionID);
                        }
                    });
                });

                var allRegions = regionSource.getFeatures();
                allRegions.forEach(function(region) {
                    var regionID = region.getProperties().region;
                    if (selected[regionID]) {
                        region.setStyle(mapStyles.selectedRegions);
                    } else {
                        region.setStyle(mapStyles.deselectedRegions);
                    }
                });

                selection.selectedRegions = selectedRegionIDs;

                return selectedRegionIDs;
            };

            // ----------------------------------------------------------------
            /**
             * Adjust aspect ratio of the map to match that of the image
             * - so that the image always fills the map canvas
             * - must be called initially and whenever the map width changes
             *
             * @param {ol.Map} map - the map instance
             * @param {DOMNode} img - the image element
             */
            var adjustAspectRatio = function(map, img) {

                var mapSize = map.getSize();
                if (mapSize === undefined) {
                    // Map disposal triggers change:size too
                    return;
                }

                var extent = [0, 0, img.width, img.height],
                    view = map.getView(),
                    res = view.getResolutionForExtent(extent, [mapSize[0], img.height]);

                map.setSize([mapSize[0], img.height / res]);
                view.setResolution(res);
            };

            // ----------------------------------------------------------------
            /**
             * Link a DOM element to this directive
             *
             * @param {object} $scope - the local scope of the DOM element
             * @param {DOMNode} elem - the element
             * @param {object} attr - the element's HTML attributes
             * @param {ngModelController} ngModel - the model controller
             */
            var link = function($scope, elem, attr, ngModel) {

                // Initialize local scope
                $scope.selection = {
                    selectedPoints: [],
                    selectedRegions: []
                };

                // Get maxSelectedPoints from attr
                var maxSelectedPoints = attr.maxSelectedPoints;
                if (maxSelectedPoints) {
                    maxSelectedPoints -= 0;
                    if (!isNaN(maxSelectedPoints)) {
                        $scope.maxSelectedPoints = maxSelectedPoints;
                    }
                }

                // Create the map container, append it to the DOM
                // and compile it against the local scope
                var fieldName = attr.field,
                    mapContainer = angular.element('<div class="map">')
                                          .attr('id', fieldName + 'image-map');

                elem.append(mapContainer);
                $compile(mapContainer)($scope);

                // Get the image URI (=local file URI)
                var imageURI = attr.image,
                    mapLoaded = $q.defer();
                if (imageURI) {

                    // Load the image to determine width and height
                    var img = document.createElement('img');
                    img.onload = function () {

                        // Compute extent and projection
                        var extent = [0, 0, img.width, img.height],
                            projection = new ol.proj.Projection({
                                code: 'preview-image',
                                units: 'pixels',
                                extent: extent
                            });

                        // Create the image layer
                        var imageLayer = new ol.layer.Image({
                            source: new ol.source.ImageStatic({
                                url: imageURI,
                                projection: projection,
                                imageExtent: extent
                            })
                        });

                        // Create a regions source
                        var regionSource = new ol.source.Vector({
                            wrapX: false
                        });

                        // Parse the regions and add them to the regionSource
                        var format = new ol.format.GeoJSON({featureProjection: projection}),
                            regions = elem.find('region');
                        if (regions.length) {
                            angular.forEach(regions, function(region) {
                                var geojson = JSON.parse(angular.element(region).attr('geojson'));
                                var feature = format.readFeatureFromObject(geojson);
                                regionSource.addFeature(feature);
                            });
                        }

                        // Create the regions layer
                        var regionLayer = new ol.layer.Vector({
                            source: regionSource,
                            // Default style: deselected
                            style: mapStyles.deselectedRegions
                        });

                        // Create the selected-points source and layer
                        var pointSource = new ol.source.Vector({
                                wrapX: false
                            }),
                            pointLayer = new ol.layer.Vector({
                                source: pointSource,
                                style: mapStyles.selectedPoints
                            });

                        // Build the map and add the layers
                        var map = new ol.Map({
                            controls: [],
                            interactions: [],
                            target: fieldName + 'image-map',
                        });
                        //$scope.map = map;
                        map.addLayer(imageLayer);
                        map.addLayer(regionLayer);
                        map.addLayer(pointLayer);
                        mapLoaded.resolve([pointSource, regionSource]);

                        // Add the map view and adjust the aspect ratio
                        map.setView(new ol.View({
                            projection: projection,
                            center: ol.extent.getCenter(extent),
                        }));
                        adjustAspectRatio(map, img);

                        // Adjust aspect ratio whenever the map size changes
                        // (e.g. device orientation changing)
                        var adjusting = false;
                        map.on('change:size', function() {
                            if (adjusting) {
                                return;
                            }
                            adjusting = true; // prevent self-triggering
                            adjustAspectRatio(map, img);
                            adjusting = false;
                        });

                        // Handle click on the map
                        map.on('singleclick', function(e) {

                            // Ignore if click is outside of the image
                            var coordinate = e.coordinate;
                            if (coordinate[0] < 0 || coordinate[0] > img.width ||
                                coordinate[1] < 0 || coordinate[1] > img.height) {
                                return false;
                            }

                            // Round to full pixels
                            coordinate = [
                                Math.round(coordinate[0]),
                                Math.round(coordinate[1])
                            ];

                            if (addSelectedPoint($scope, pointSource, coordinate)) {
                                updateSelectedRegions($scope, regionSource);
                            }
                            ngModel.$setViewValue(JSON.stringify($scope.selection));
                            ngModel.$setTouched();
                        });
                    };
                    img.src = imageURI;
                } else {
                    mapLoaded.reject('no image URI');
                }

                // Render current field value (e.g. update or returning to section)
                ngModel.$render = function() {

                    // Wait for map and sources to become ready...
                    mapLoaded.promise.then(function(sources) {
                        var pointSource = sources[0],
                            regionSource = sources[1],
                            currentValue = ngModel.$modelValue;

                        if (currentValue) {
                            var selectedPoints = currentValue.selectedPoints;
                            if (selectedPoints) {
                                selectedPoints.forEach(function(coordinate) {
                                    addSelectedPoint($scope, pointSource, coordinate);
                                });
                                updateSelectedRegions($scope, regionSource);
                            }
                        }
                    });
                };
            };

            // ----------------------------------------------------------------
            // Return the DDO
            return {
                link: link,
                require: 'ngModel',
                scope: true
            };
        }
    ]);

})(EdenMobile);

// END ========================================================================
