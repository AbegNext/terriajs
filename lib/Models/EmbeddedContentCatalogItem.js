'use strict';

/*global require*/

var clone = require('terriajs-cesium/Source/Core/clone');
var defineProperties = require('terriajs-cesium/Source/Core/defineProperties');
var freezeObject = require('terriajs-cesium/Source/Core/freezeObject');
var knockout = require('terriajs-cesium/Source/ThirdParty/knockout');

var CatalogItem = require('./CatalogItem');
var CatalogItemEmbeddedContentControl = require('../ViewModels/CatalogItemEmbeddedContentControl');
var inherit = require('../Core/inherit');


/**
 * A {@link CatalogItem} representing a layer from the Bing Maps server.
 *
 * @alias EmbeddedContentCatalogItem
 * @constructor
 * @extends CatalogItem
 *
 * @param {Terria} terria The Terria instance.
 */
var EmbeddedContentCatalogItem = function(terria) {
    CatalogItem.call(this, terria);

    /**
     * Gets or sets the url of the embedded content.
     * @type {String}
     */
    this._url = undefined;

    this._contentControl = new CatalogItemEmbeddedContentControl(this, this._url);

    /**
     * Gets or sets a value indicating whether this data source is mappable and should therefore show a checkbox.
     * This property is observable.
     * @type {Boolean}
     */
    this.isMappable = false;

    /**
     * Gets or sets the list of controls to be displayed on the right side of this item. This property is observable.
     * @type {Array}
     */
    this.rightSideControls = [
        this._contentControl
    ];

    knockout.track(this, ['_url']);
};

inherit(CatalogItem, EmbeddedContentCatalogItem);

defineProperties(EmbeddedContentCatalogItem.prototype, {
    /**
     * Gets the type of data item represented by this instance.
     * @memberOf EmbeddedContentCatalogItem.prototype
     * @type {String}
     */
    type : {
        get : function() {
            return 'embed';
        }
    },

    /**
     * Gets a human-readable name for this type of data source, 'Bing Maps'.
     * @memberOf EmbeddedContentCatalogItem.prototype
     * @type {String}
     */
    typeName : {
        get : function() {
            return 'Embedded Content Item';
        }
    },

    /**
     * Gets and sets the URL of the embedded content.
     * @memberOf EmbeddedContentCatalogItem.prototype
     * @type {String}
     */
    url : {
        get : function() {
            return this._url;
        },
        set : function(url) {
            this._url = url;
            this._contentControl.url = url;
        }
    },

    /**
     * Gets the set of names of the properties to be serialized for this object when {@link CatalogMember#serializeToJson} is called
     * and the `serializeForSharing` flag is set in the options.
     * @memberOf EmbeddedContentCatalogItem.prototype
     * @type {String[]}
     */
    propertiesForSharing : {
        get : function() {
            return EmbeddedContentCatalogItem.defaultPropertiesForSharing;
        }
    }
});

/**
 * Gets or sets the default set of properties that are serialized when serializing a {@link CatalogItem}-derived object with the
 * `serializeForSharing` flag set in the options.
 * @type {String[]}
 */
EmbeddedContentCatalogItem.defaultPropertiesForSharing = clone(CatalogItem.defaultPropertiesForSharing);
EmbeddedContentCatalogItem.defaultPropertiesForSharing.push('_url');
freezeObject(EmbeddedContentCatalogItem.defaultPropertiesForSharing);

module.exports = EmbeddedContentCatalogItem;