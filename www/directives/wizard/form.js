/**
 * Sahana Eden Mobile - Wizard Form Directives
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
     * Helper function to get the translations for a non-field form element
     *
     * @param {object} formElement - the form element
     * @param {object} labels - the untranslated labels {key: label}
     * @param {string} language - the language to translate to
     *
     * @returns {object} - the translated labels {key: label}
     */
    var getTranslation = function(formElement, labels, language) {

        if (!language) {
            return labels;
        }

        var l10n = formElement.l10n;
        if (!l10n) {
            return labels;
        }

        var labelsL10n = l10n[language];
        if (!labelsL10n) {
            return labels;
        }

        var translated = angular.extend({}, labels);
        for (var key in labels) {
            var translation = labelsL10n[key];
            if (!!translation) {
                translated[key] = '' + translation;
            }
        }

        return translated;
    };

    // ========================================================================
    /**
     * Directive for <em-form-section>:
     *   - a section of a form
     */
    EdenMobile.directive('emFormSection', [
        '$compile', 'emDisplayLogic',
        function($compile, emDisplayLogic) {

            var renderSection = function($scope, elem, attr) {

                // Get the section config
                var sectionConfig = $scope.sectionConfig;
                if (!sectionConfig) {
                    return;
                }

                // Create the form
                var formName = attr.formName || 'wizard',
                    form = angular.element('<form>')
                                  .attr('name', formName)
                                  .attr('novalidate', 'novalidate');

                // Required-answers hint
                var requiredHint = angular.element('<div class="required-hint">')
                                          .text('* = answer required')
                                          .attr('ng-if', 'formStatus.hasRequired');
                form.append(requiredHint);
                $scope.formStatus.hasRequired = false;

                // Generate the form rows for this section
                var formRows = angular.element('<div class="list">'),
                    displayLogic = {};
                sectionConfig.forEach(function(formElement, index) {

                    var formRow;
                    switch(formElement.type) {
                        case 'input':
                            formRow = angular.element('<em-form-row>')
                                             .attr('formname', formName)
                                             .attr('field', formElement.field);
                            break;
                        case 'instructions':
                            formRow = angular.element('<em-instructions>');

                            // Find and extract the labels
                            var labels = {
                                do: formElement.do,
                                say: formElement.say
                            };
                            labels = getTranslation(formElement, labels, $scope.currentLanguage);

                            // Add instructions
                            var instruction;
                            if (labels.do) {
                                instruction = angular.element('<do>').text(labels.do);
                                formRow.append(instruction);
                            }
                            if (labels.say) {
                                instruction = angular.element('<say>').text(labels.say);
                                formRow.append(instruction);
                            }
                            break;
                        default:
                            break;
                    }

                    if (!formRow) {
                        return;
                    }

                    // Add display logic for this formElement
                    var displayRule = formElement.displayLogic;
                    if (displayRule) {
                        var dlID = 'dl' + index;
                        displayLogic[dlID] = new emDisplayLogic($scope.form,
                                                                formElement.field,
                                                                displayRule);
                        formRow.attr('display-logic', dlID);
                    }

                    // Append form row to container
                    formRows.append(formRow);
                });
                form.append(formRows);

                // Add display logic to scope
                $scope.displayLogic = displayLogic;

                // Add form to DOM and compile it against scope
                elem.replaceWith(form);
                $compile(form)($scope);
            };

            return {
                link: renderSection
            };
        }
    ]);

    // ========================================================================
    /**
     * Directive for <em-form-row>:
     *   - a form row with label and input widget etc.
     */
    EdenMobile.directive('emFormRow', [
        '$compile', 'emFormStyle', 'emFormWizard', 'emValidate',
        function($compile, emFormStyle, emFormWizard, emValidate) {

            var renderFormRow = function($scope, elem, attr) {

                // Get the resource from (parent) scope
                var resource = $scope.resource;
                if (!resource) {
                    return;
                }

                // Get the field
                var fieldName = attr.field,
                    field = resource.fields[fieldName];
                if (!field) {
                    return;
                }

                // Generate the widget and bind it to form
                var formName = attr.formname || 'wizard',
                    prefix = attr.prefix || 'form',
                    widget = emFormWizard.getWidget(field, $scope.currentLanguage)
                                         .attr('ng-model', prefix + '.' + fieldName);

                // Add validator directives
                // - widgets must apply those to the actual inputs
                var validate = emValidate.getDirectives(field),
                    markRequired = false,
                    errors = [];
                if (validate) {
                    validate.forEach(function(validation) {

                        var directives = validation.directives,
                            directive;
                        for (directive in directives) {
                            widget.attr(directive, directives[directive]);
                            if (directive == 'ng-required') {
                                markRequired = true;
                            }
                        }

                        var showOn = validation.errors.map(function(cond) {
                            return formName + '.' + fieldName + '.$error.' + cond;
                        }).join(' || ');
                        errors.push({showOn: showOn, msg: validation.message});
                    });
                }

                // Use emFormStyle to render the form row
                var formRow = emFormStyle.formRow(formName,
                                                  field.getLabel($scope.currentLanguage),
                                                  emFormWizard.getImage(field),
                                                  widget,
                                                  errors,
                                                  markRequired);
                if (markRequired) {
                    $scope.formStatus.hasRequired = true;
                }

                // Display logic and required
                // - skip display logic if field is marked as required
                var fieldDescription = field._description;
                if (!fieldDescription.required) {
                    // Otherwise, apply display logic if defined
                    var dlID = attr.displayLogic;
                    if (dlID) {
                        var showIf = 'displayLogic["' + dlID + '"].show()';
                        formRow.attr('ng-show', showIf);
                        // If field has isNotEmpty
                        // => apply same logic for ngRequired as for ngShow
                        if (widget.attr('ng-required')) {
                            widget.attr('ng-required', showIf);
                        }
                    }
                }

                // Add form row to DOM and compile it
                elem.replaceWith(formRow);
                $compile(formRow)($scope);
            };

            return {
                link: renderFormRow
            };
        }
    ]);

    // ========================================================================
    /**
     * Directive for <em-instructions>
     *   - data collector instructions
     */
    EdenMobile.directive('emInstructions', [
        '$compile',
        function($compile) {

            var link = function($scope, elem, attr) {

                var card = angular.element('<div class="card padding data-collector-instructions">'),
                    header = angular.element('<h4>Instructions</h4>'),
                    instruction,
                    content;

                card.append(header);

                instruction = elem.find('do').text();
                if (instruction) {
                    content = angular.element('<p class="do">').text(instruction);
                    card.append(content);
                }

                instruction = elem.find('say').text();
                if (instruction) {
                    content = angular.element('<p class="say">').text('"' + instruction + '"');
                    card.append(content);
                }

                // Link to display logic if required
                var dlID = attr.displayLogic;
                if (dlID) {
                    card.attr('ng-show', 'displayLogic["' + dlID + '"].show()');
                }

                // Add card to DOM and compile it against scope
                elem.replaceWith(card);
                $compile(card)($scope);
            };

            return {
                link: link
            };
        }
    ]);

    // ========================================================================
    /**
     * Directive for <em-form-row-image>
     * - display an image for a survey question
     */
    EdenMobile.directive('emFormRowImage', [
        '$compile',
        function($compile) {

            var link = function($scope, elem, attr) {
                var fileURI = attr.image;
                if (fileURI) {
                    var image = angular.element('<img>')
                                       .attr('src', fileURI),
                        widget = angular.element('<div class="form-row-image">')
                                        .append(image);

                    // Add to DOM and compile against scope
                    elem.replaceWith(widget);
                    $compile(widget)($scope);
                }
            };

            return {
                link: link
            };
        }
    ]);

    // ========================================================================
    /**
     * Directive for <em-form-row-image-map>
     * - display an image from an image map widget incl one selected region
     */
    EdenMobile.directive('emFormRowImageMap', [
        '$compile', '$timeout',
        function($compile, $timeout) {

            // ----------------------------------------------------------------
            /**
             * Map styles for selected points and regions
             */
            var mapStyles = {
                selectedRegions: new ol.style.Style({
                    fill: new ol.style.Fill({
                        color: [0, 85, 127, 0.4]
                    }),
                    stroke: new ol.style.Stroke({
                        color: [0, 85, 127, 0.8],
                        width: 2
                    })
                }),
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
             */
            var link = function($scope, elem, attr) {

                // Create the map container, append it to the DOM
                // and compile it against the local scope
                var fieldName = attr.field,
                    mapContainer = angular.element('<div class="map image-map-preview">')
                                          .attr('id', fieldName + '-image-map-review');

                elem.append(mapContainer);
                $compile(mapContainer)($scope);

                // Get the image URI (=local file URI)
                var imageURI = attr.image;
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
                            style: mapStyles.selectedRegions
                        });

                        // Build the map and add the layers
                        var map = new ol.Map({
                            controls: [],
                            interactions: [],
                            target: fieldName + '-image-map-review',
                        });
                        //$scope.map = map;
                        map.addLayer(imageLayer);
                        map.addLayer(regionLayer);

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

                        // Watch the displayLogic of the formRow to update the
                        // map when formRow is revealed
                        var displayLogic = elem.parent().attr('ng-show');
                        if (displayLogic) {
                            $scope.$watch(displayLogic, function() {
                                $timeout(function() {
                                    map.updateSize();
                                }, 0, false);
                            });
                        }
                    };
                    img.src = imageURI;
                }
            };

            // ----------------------------------------------------------------
            // Return the DDO
            return {
                link: link,
                scope: true
            };
        }
    ]);

    // ========================================================================
    /**
     * Directive for <em-wizard-header>:
     *   - the top bar in the wizard view
     */
    EdenMobile.directive('emWizardHeader', function() {
        return {
            //link: renderHeader,
            templateUrl: 'views/wizard/header.html'
        };
    });

    // ========================================================================
    /**
     * Directive for <em-wizard-submit>:
     *   - the next/submit button row at the end of a form section
     */
    EdenMobile.directive('emWizardSubmit', function() {
        return {
            templateUrl: 'views/wizard/submit.html'
        };
    });

})(EdenMobile);

// END ========================================================================
