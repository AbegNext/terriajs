'use strict';

/*global require*/
var defaultValue = require('terriajs-cesium/Source/Core/defaultValue');
var defined = require('terriajs-cesium/Source/Core/defined');
var DeveloperError = require('terriajs-cesium/Source/Core/DeveloperError');
var getElement = require('terriajs-cesium/Source/Widgets/getElement');
var knockout = require('terriajs-cesium/Source/ThirdParty/knockout');

var inherit = require('../Core/inherit');
var loadView = require('../Core/loadView');
var PopupViewModel = require('./PopupViewModel');

var EmbeddedContentPopupViewModel = function(options) {
    if (!defined(options) || !defined(options.contentUrls)) {
        throw new DeveloperError('options.contentUrls is required.');
    }

    if (!options.contentUrls.length) {
        throw new DeveloperError('options.contentUrls cannot be empty.');
    }

    this.contentUrls = defaultValue(options.contentUrls, []);
    this.title = defaultValue(options.title, 'Embedded Content');

    this.currentTab = this.contentUrls[0];

    this.view = require('fs').readFileSync(__dirname +
        '/../Views/EmbeddedContentPopup.html', 'utf8');

    knockout.track(this, ['contentUrls', 'currentTab']);
};

inherit(PopupViewModel, EmbeddedContentPopupViewModel);

EmbeddedContentPopupViewModel.prototype.show = function(container) {
    container = getElement(container);
    this._domNodes = loadView(this.view, container, this);

    var that = this;

    that.updateContentDimensions();

    window.addEventListener('resize', function() {
        that.updateContentDimensions();
    }, false);

};

EmbeddedContentPopupViewModel.prototype.switchTab = function(newTab) {
    this.currentTab = newTab;
};

EmbeddedContentPopupViewModel.open = function(options) {
    var viewModel = new EmbeddedContentPopupViewModel(options);
    viewModel.show(options.container);
    return viewModel;
};

EmbeddedContentPopupViewModel.prototype.updateContentDimensions = function(newTab) {
    var popupContent = this._domNodes[0].getElementsByClassName(
        'embedded-content-popup-content')[0];
    var height = popupContent.offsetHeight ;

    if (this.contentUrls.length > 1) {
        var tabs = this._domNodes[0].getElementsByClassName(
            'embedded-content-popup-tab-container')[0];
        height -= (tabs.offsetHeight + 5);
    }

    this._domNodes[0].getElementsByClassName('embedded-content')[0].setAttribute(
        "style", "height: " + height + "px;");
};


module.exports = EmbeddedContentPopupViewModel;
