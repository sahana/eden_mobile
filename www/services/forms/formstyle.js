/**
 * Sahana Eden Mobile - Form Style Service
 *
 * Copyright (c) 2016-2019 Sahana Software Foundation
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

    var currentFormStyle = "default";

    // ------------------------------------------------------------------------
    // Default Form Style
    //
    function DefaultFormStyle() {}

    DefaultFormStyle.prototype.formRow = function(label, widget) {

        var labelContainer = angular.element('<span>').html(label),
            widgetContainer = widget,
            formRow = angular.element('<label>')
                             .addClass('item')
                             .append(labelContainer)
                             .append(widgetContainer);

        return formRow;
    };

    // ------------------------------------------------------------------------
    // Survey Wizard Form Style
    // TODO - use grid-style, not list
    //
    function WizardFormStyle() {}

    WizardFormStyle.prototype.formRow = function(label, widget) {

        var labelContainer = angular.element('<span>').html(label),
            widgetContainer = widget,
            formRow = angular.element('<label class="card item-input item-stacked-label">')
                             .append(labelContainer)
                             .append(widgetContainer);

        return formRow;
    };

    // ------------------------------------------------------------------------
    // Form Style Provider
    //
    // - set the form style in the bootstrap phase like:
    //
    //      EdenMobile.config(['emFormStyleProvider',
    //          function(emFormStyleProvider) {
    //              emFormStyleProvider.formStyle('wizard');
    //          }
    //      ]);
    //
    // - use the form style service to render form rows:
    //
    //      var formRow = emFormStyle.formRow(label, widget);
    //
    // TODO: we may need multiple form style providers for different types
    //       of forms or views (alternatively provide multiple formRow functions)
    // TODO: extend with more form row elements (comments, image, tooltip etc.)
    //
    EdenMobile.provider('emFormStyle', function() {

        /**
         * Setter for the form style
         *
         * @param {string} formStyleName - the name of the form style
         */
        this.formStyle = function(formStyleName) {

            currentFormStyle = formStyleName;
        };

        /**
         * Getter for the form style service
         */
        this.$get = function() {

            var formStyle;

            switch(currentFormStyle) {
                case 'wizard':
                    formStyle = new WizardFormStyle();
                    break;
                default:
                    formStyle = new DefaultFormStyle();
                    break;
            }

            return formStyle;
        };

    });

})(EdenMobile);

// END ========================================================================
