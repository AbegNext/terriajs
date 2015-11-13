'use strict';

/*global require*/
var defaultValue = require('terriajs-cesium/Source/Core/defaultValue');
var defined = require('terriajs-cesium/Source/Core/defined');
var DeveloperError = require('terriajs-cesium/Source/Core/DeveloperError');
var knockout = require('terriajs-cesium/Source/ThirdParty/knockout');

var inherit = require('../Core/inherit');
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


EmbeddedContentPopupViewModel.open = function(options) {
    var viewModel = new EmbeddedContentPopupViewModel(options);
    viewModel.show(options.container);
    return viewModel;
};

EmbeddedContentPopupViewModel.prototype.switchTab = function(newTab) {
    this.currentTab = newTab;
};


module.exports = EmbeddedContentPopupViewModel;
