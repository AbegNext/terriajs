'use strict';

/*global require*/
var URI = require('URIjs');

var clone = require('terriajs-cesium/Source/Core/clone');
var combine = require('terriajs-cesium/Source/Core/combine');
var defined = require('terriajs-cesium/Source/Core/defined');
var defineProperties = require('terriajs-cesium/Source/Core/defineProperties');
var Ellipsoid = require('terriajs-cesium/Source/Core/Ellipsoid');
var freezeObject = require('terriajs-cesium/Source/Core/freezeObject');
var GeographicTilingScheme = require('terriajs-cesium/Source/Core/GeographicTilingScheme');
var GetFeatureInfoFormat = require('terriajs-cesium/Source/Scene/GetFeatureInfoFormat');
var JulianDate = require('terriajs-cesium/Source/Core/JulianDate');
var knockout = require('terriajs-cesium/Source/ThirdParty/knockout');
var loadXML = require('terriajs-cesium/Source/Core/loadXML');
var Rectangle = require('terriajs-cesium/Source/Core/Rectangle');
var TimeInterval = require('terriajs-cesium/Source/Core/TimeInterval');
var TimeIntervalCollection = require('terriajs-cesium/Source/Core/TimeIntervalCollection');
var WebMapServiceImageryProvider = require('terriajs-cesium/Source/Scene/WebMapServiceImageryProvider');
var WebMercatorTilingScheme = require('terriajs-cesium/Source/Core/WebMercatorTilingScheme');

var Metadata = require('./Metadata');
var MetadataItem = require('./MetadataItem');
var ImageryLayerCatalogItem = require('./ImageryLayerCatalogItem');
var inherit = require('../Core/inherit');
var overrideProperty = require('../Core/overrideProperty');
var xml2json = require('../ThirdParty/xml2json');

/**
 * A {@link ImageryLayerCatalogItem} representing a layer from a Web Map Service (WMS) server.
 *
 * @alias WebMapServiceCatalogItem
 * @constructor
 * @extends ImageryLayerCatalogItem
 *
 * @param {Terria} terria The Terria instance.
 */
var WebMapServiceCatalogItem = function(terria) {
    ImageryLayerCatalogItem.call(this, terria);

    this._metadata = undefined;
    this._dataUrl = undefined;
    this._dataUrlType = undefined;
    this._metadataUrl = undefined;
    this._legendUrl = undefined;
    this._rectangle = undefined;
    this._rectangleFromMetadata = undefined;
    this._intervalsFromMetadata = undefined;

    /**
     * Gets or sets the URL of the WMS server.  This property is observable.
     * @type {String}
     */
    this.url = '';

    /**
     * Gets or sets the WMS layers to include.  To specify multiple layers, separate them
     * with a commas.  This property is observable.
     * @type {String}
     */
    this.layers = '';

    /**
     * Gets or sets the additional parameters to pass to the WMS server when requesting images.
     * If this property is undefined, {@link WebMapServiceCatalogItem.defaultParameters} is used.
     * @type {Object}
     */
    this.parameters = undefined;

    /**
     * Gets or sets the tiling scheme to pass to the WMS server when requesting images.
     * If this property is undefiend, the default tiling scheme of the provider is used.
     * @type {Object}
     */
    this.tilingScheme = undefined;

    /**
     * Gets or sets the formats in which to try WMS GetFeatureInfo requests.  If this property is undefined, the `WebMapServiceImageryProvider` defaults
     * are used.  This property is observable.
     * @type {GetFeatureInfoFormat[]]}
     */
    this.getFeatureInfoFormats = undefined;

    /**
     * Gets or sets a value indicating whether a time dimension, if it exists in GetCapabilities, should be used to populate
     * the {@link ImageryLayerCatalogItem#intervals}.  If the {@link ImageryLayerCatalogItem#intervals} property is set explicitly
     * on this catalog item, the value of this property is ignored.
     * @type {Boolean}
     * @default true
     */
    this.populateIntervalsFromTimeDimension = true;

    /**
     * Gets or sets the denominator of the largest scale (smallest denominator) for which tiles should be requested.  For example, if this value is 1000, then tiles representing
     * a scale larger than 1:1000 (i.e. numerically smaller denominator, when zooming in closer) will not be requested.  Instead, tiles of the largest-available scale, as specified by this property,
     * will be used and will simply get blurier as the user zooms in closer.
     * @type {Number}
     */
    this.minScaleDenominator = undefined;

    /**
     * Gets or sets the denominator of the smallest scale (largest denominator) for which tiles should
     * be requested. There is nothing reasonable we can do to fill in the data at higher levels, so this
     * is detected in order to possibly provide a warning to the user.
     * @type {Number}
     */
    this.maxScaleDenominator = undefined;

    knockout.track(this, [
        '_dataUrl', '_dataUrlType', '_metadataUrl', '_legendUrl', '_rectangle', '_rectangleFromMetadata', '_intervalsFromMetadata', 'url',
        'layers', 'parameters', 'getFeatureInfoFormats',
        'tilingScheme', 'populateIntervalsFromTimeDimension', 'minScaleDenominator', 'maxScaleDenominator']);

    // dataUrl, metadataUrl, and legendUrl are derived from url if not explicitly specified.
    overrideProperty(this, 'dataUrl', {
        get : function() {
            var url = this._dataUrl;
            if (!defined(url)) {
                url = this.url;
            }

            if (this.dataUrlType === 'wfs') {
                url = cleanUrl(url) + '?service=WFS&version=1.1.0&request=GetFeature&typeName=' + this.layers + '&srsName=EPSG%3A4326&maxFeatures=1000';
            }

            return url;
        },
        set : function(value) {
            this._dataUrl = value;
        }
    });

    overrideProperty(this, 'dataUrlType', {
        get : function() {
            if (defined(this._dataUrlType)) {
                return this._dataUrlType;
            } else {
                return 'wfs';
            }
        },
        set : function(value) {
            this._dataUrlType = value;
        }
    });

    overrideProperty(this, 'metadataUrl', {
        get : function() {
            if (defined(this._metadataUrl)) {
                return this._metadataUrl;
            }

            return cleanUrl(this.url) + '?service=WMS&version=1.3.0&request=GetCapabilities';
        },
        set : function(value) {
            this._metadataUrl = value;
        }
    });

    overrideProperty(this, 'legendUrl', {
        get : function() {
            if (defined(this._legendUrl)) {
                return this._legendUrl;
            }
            var layer = this.layers.split(',')[0];
            return cleanUrl(this.url) + '?service=WMS&version=1.3.0&request=GetLegendGraphic&format=image/png&layer=' + layer;
        },
        set : function(value) {
            this._legendUrl = value;
        }
    });

    // rectangle comes from metadata if not explicitly specified.
    overrideProperty(this, 'rectangle', {
        get : function() {
            if (defined(this._rectangle)) {
                return this._rectangle;
            } else if (defined(this._rectangleFromMetadata)) {
                return this._rectangleFromMetadata;
            } else {
                return Rectangle.MAX_VALUE;
            }
        },
        set : function(value) {
            this._rectangle = value;
        }
    });

    // intervals come from metadata if populateIntervalsFromTimeDimension and not explicitly specified.
    overrideProperty(this, 'intervals', {
        get : function() {
            if (defined(this._intervals)) {
                return this._intervals;
            }
            return this._intervalsFromMetadata;
        },
        set : function(value) {
            this._intervals = value;
        }
    });
};

inherit(ImageryLayerCatalogItem, WebMapServiceCatalogItem);

defineProperties(WebMapServiceCatalogItem.prototype, {
    /**
     * Gets the type of data item represented by this instance.
     * @memberOf WebMapServiceCatalogItem.prototype
     * @type {String}
     */
    type : {
        get : function() {
            return 'wms';
        }
    },

    /**
     * Gets a human-readable name for this type of data source, 'Web Map Service (WMS)'.
     * @memberOf WebMapServiceCatalogItem.prototype
     * @type {String}
     */
    typeName : {
        get : function() {
            return 'Web Map Service (WMS)';
        }
    },

    /**
     * Gets a value indicating whether this {@link ImageryLayerCatalogItem} supports the {@link ImageryLayerCatalogItem#intervals}
     * property for configuring time-dynamic imagery.
     * @type {Boolean}
     */
    supportsIntervals : {
        get : function() {
            return true;
        }
    },

    /**
     * Gets the metadata associated with this data source and the server that provided it, if applicable.
     * @memberOf WebMapServiceCatalogItem.prototype
     * @type {Metadata}
     */
    metadata : {
        get : function() {
            if (!defined(this._metadata)) {
                this._metadata = requestMetadata(this);
            }
            return this._metadata;
        }
    },

    /**
     * Gets the set of functions used to update individual properties in {@link CatalogMember#updateFromJson}.
     * When a property name in the returned object literal matches the name of a property on this instance, the value
     * will be called as a function and passed a reference to this instance, a reference to the source JSON object
     * literal, and the name of the property.
     * @memberOf WebMapServiceCatalogItem.prototype
     * @type {Object}
     */
    updaters : {
        get : function() {
            return WebMapServiceCatalogItem.defaultUpdaters;
        }
    },

    /**
     * Gets the set of functions used to serialize individual properties in {@link CatalogMember#serializeToJson}.
     * When a property name on the model matches the name of a property in the serializers object lieral,
     * the value will be called as a function and passed a reference to the model, a reference to the destination
     * JSON object literal, and the name of the property.
     * @memberOf WebMapServiceCatalogItem.prototype
     * @type {Object}
     */
    serializers : {
        get : function() {
            return WebMapServiceCatalogItem.defaultSerializers;
        }
    }
});

WebMapServiceCatalogItem.defaultUpdaters = clone(ImageryLayerCatalogItem.defaultUpdaters);

WebMapServiceCatalogItem.defaultUpdaters.tilingScheme = function(wmsItem, json, propertyName, options) {
    if (json.tilingScheme === 'geographic') {
        wmsItem.tilingScheme = new GeographicTilingScheme();
    } else if (json.tilingScheme === 'web-mercator') {
        wmsItem.tilingScheme = new WebMercatorTilingScheme();
    } else {
        wmsItem.tilingScheme = json.tilingScheme;
    }
};

WebMapServiceCatalogItem.defaultUpdaters.getFeatureInfoFormats = function(wmsItem, json, propertyName, options) {
    var formats = [];

    for (var i = 0; i < json.getFeatureInfoFormats.length; ++i) {
        var format = json.getFeatureInfoFormats[i];
        formats.push(new GetFeatureInfoFormat(format.type, format.format));
    }

    wmsItem.getFeatureInfoFormats = formats;
};

freezeObject(WebMapServiceCatalogItem.defaultUpdaters);

WebMapServiceCatalogItem.defaultSerializers = clone(ImageryLayerCatalogItem.defaultSerializers);

// Serialize the underlying properties instead of the public views of them.
WebMapServiceCatalogItem.defaultSerializers.dataUrl = function(wmsItem, json, propertyName) {
    json.dataUrl = wmsItem._dataUrl;
};
WebMapServiceCatalogItem.defaultSerializers.dataUrlType = function(wmsItem, json, propertyName) {
    json.dataUrlType = wmsItem._dataUrlType;
};
WebMapServiceCatalogItem.defaultSerializers.metadataUrl = function(wmsItem, json, propertyName) {
    json.metadataUrl = wmsItem._metadataUrl;
};
WebMapServiceCatalogItem.defaultSerializers.legendUrl = function(wmsItem, json, propertyName) {
    json.legendUrl = wmsItem._legendUrl;
};
WebMapServiceCatalogItem.defaultSerializers.tilingScheme = function(wmsItem, json, propertyName) {
    if (wmsItem.tilingScheme instanceof GeographicTilingScheme) {
        json.tilingScheme = 'geographic';
    } else if (wmsItem.tilingScheme instanceof WebMercatorTilingScheme) {
        json.tilingScheme = 'web-mercator';
    } else {
        json.tilingScheme = wmsItem.tilingScheme;
    }
};
freezeObject(WebMapServiceCatalogItem.defaultSerializers);

WebMapServiceCatalogItem.prototype._load = function() {
    this._metadata = requestMetadata(this);
    return this._metadata.promise;
};

WebMapServiceCatalogItem.prototype._createImageryProvider = function(time) {
    var parameters = this.parameters;
    if (defined(time)) {
        parameters = combine({ time: time }, parameters);
    }

    parameters = combine(parameters, WebMapServiceCatalogItem.defaultParameters);

    var maximumLevel;

    if (defined(this.minScaleDenominator)) {
        var metersPerPixel = 0.00028; // from WMS 1.3.0 spec section 7.2.4.6.9
        var tileWidth = 256;

        var circumferenceAtEquator = 2 * Math.PI * Ellipsoid.WGS84.maximumRadius;
        var distancePerPixelAtLevel0 = circumferenceAtEquator / tileWidth;
        var level0ScaleDenominator = distancePerPixelAtLevel0 / metersPerPixel;

        // 1e-6 epsilon from WMS 1.3.0 spec, section 7.2.4.6.9.
        var ratio = level0ScaleDenominator / (this.minScaleDenominator - 1e-6);
        var levelAtMinScaleDenominator = Math.log(ratio) / Math.log(2);
        maximumLevel = levelAtMinScaleDenominator | 0;
    }

    if (defined(this.maxScaleDenominator) && this.maxScaleDenominator > 1e6) {
        console.log('ArcGIS minScale setting may hide data.');
//        this.terria.error.raiseEvent({title: 'Data Warning', message:'The data provider is filtering data \
//            in a way that may hide it when the view is zoomed out.  You may need to zoom the camera in to see this dataset.'});
    }

    return new WebMapServiceImageryProvider({
        url : cleanAndProxyUrl( this.terria, this.url),
        layers : this.layers,
        getFeatureInfoFormats : this.getFeatureInfoFormats,
        parameters : parameters,
        getFeatureInfoParameters : parameters,
        tilingScheme : defined(this.tilingScheme) ? this.tilingScheme : new WebMercatorTilingScheme(),
        maximumLevel: maximumLevel
    });
};

WebMapServiceCatalogItem.defaultParameters = {
    transparent: true,
    format: 'image/png',
    exceptions: 'application/vnd.ogc.se_xml',
    styles: '',
    tiled: true
};

function cleanAndProxyUrl(terria, url) {
    return proxyUrl(terria, cleanUrl(url));
}

function cleanUrl(url) {
    // Strip off the search portion of the URL
    var uri = new URI(url);
    uri.search('');
    return uri.toString();
}

function proxyUrl(terria, url) {
    if (defined(terria.corsProxy) && terria.corsProxy.shouldUseProxy(url)) {
        return terria.corsProxy.getURL(url);
    }

    return url;
}

WebMapServiceCatalogItem.getRectangleFromLayer = function(layer) {
    var egbb = layer.EX_GeographicBoundingBox; // required in WMS 1.3.0
    if (defined(egbb)) {
        return Rectangle.fromDegrees(egbb.westBoundLongitude, egbb.southBoundLatitude, egbb.eastBoundLongitude, egbb.northBoundLatitude);
    } else {
        var llbb = layer.LatLonBoundingBox; // required in WMS 1.0.0 through 1.1.1
        if (defined(llbb)) {
            return Rectangle.fromDegrees(llbb.minx, llbb.miny, llbb.maxx, llbb.maxy);
        }
    }
    return undefined;
};

WebMapServiceCatalogItem.getIntervalsFromLayer = function(layer) {
    var dimensions = layer.Dimension;

    if (!defined(dimensions)) {
        return undefined;
    }

    if (!(dimensions instanceof Array)) {
        dimensions = [dimensions];
    }

    var result = new TimeIntervalCollection();

    for (var i = 0; i < dimensions.length; ++i) {
        var dimension = dimensions[i];

        if (dimension.name !== 'time') {
            continue;
        }

        // WMS 1.3.0 GetCapabilities has the times embedded right in the Dimension element.
        // WMS 1.1.0 puts the time in an Extent element.
        var extent;
        if (dimension instanceof String || typeof dimension === 'string') {
            extent = dimension;
        } else {
            // Find the corresponding extent.
            var extentList = layer.Extent;
            if (!defined(extentList)) {
                return undefined;
            }

            for (var extentIndex = 0; extentIndex < extentList.length; ++extentIndex) {
                var candidate = extentList[extentIndex];
                if (candidate.name === 'time') {
                    extent = candidate;
                    break;
                }
            }
        }

        if (!defined(extent)) {
            return undefined;
        }

        var times = extent.split(',');

        for (var j = 0; j < times.length; ++j) {
            var start = JulianDate.fromIso8601(times[j]);
            var stop;
            if (j < times.length - 1) {
                stop = JulianDate.fromIso8601(times[j + 1]);
            } else if (result.length > 0) {
                var previousInterval = result.get(result.length - 1);
                var duration = JulianDate.secondsDifference(previousInterval.stop, previousInterval.start);
                stop = JulianDate.addSeconds(start, duration, new JulianDate());
            } else {
                // There's exactly one time, so treat this layer as if it is not time-varying.
                return undefined;
            }

            result.addInterval(new TimeInterval({
                start: start,
                stop: stop,
                data: times[j]
            }));
        }
    }

    return result;
};

function requestMetadata(wmsItem) {
    var result = new Metadata();

    result.isLoading = true;

    result.promise = loadXML(proxyUrl(wmsItem.terria, wmsItem.metadataUrl)).then(function(capabilities) {
        var json = xml2json(capabilities);

        if (json.Service) {
            populateMetadataGroup(result.serviceMetadata, json.Service);
        } else {
            result.serviceErrorMessage = 'Service information not found in GetCapabilities operation response.';
        }

        var layer;
        if (defined(json.Capability)) {
            layer = findLayer(json.Capability.Layer, wmsItem.layers);
        }
        if (layer) {
            populateMetadataGroup(result.dataSourceMetadata, layer);
            wmsItem._rectangleFromMetadata = WebMapServiceCatalogItem.getRectangleFromLayer(layer);

            if (wmsItem.populateIntervalsFromTimeDimension) {
                wmsItem._intervalsFromMetadata = WebMapServiceCatalogItem.getIntervalsFromLayer(layer);
            }
        } else {
            result.dataSourceErrorMessage = 'Layer information not found in GetCapabilities operation response.';
        }

        result.isLoading = false;
    }).otherwise(function() {
        result.dataSourceErrorMessage = 'An error occurred while invoking the GetCapabilities service.';
        result.serviceErrorMessage = 'An error occurred while invoking the GetCapabilities service.';
        result.isLoading = false;
    });

    return result;
}

function findLayer(startLayer, name) {
    if (startLayer.Name === name || startLayer.Title === name) {
        return startLayer;
    }

    var layers = startLayer.Layer;
    if (!defined(layers)) {
        return undefined;
    }

    var found = findLayer(layers, name);
    for (var i = 0; !found && i < layers.length; ++i) {
        var layer = layers[i];
        found = findLayer(layer, name);
    }

    return found;
}

function populateMetadataGroup(metadataGroup, sourceMetadata) {
    if (typeof sourceMetadata === 'string' || sourceMetadata instanceof String || sourceMetadata instanceof Array) {
        return;
    }

    for (var name in sourceMetadata) {
        if (sourceMetadata.hasOwnProperty(name)) {
            var value = sourceMetadata[name];

            var dest;
            if (name === 'BoundingBox' && value instanceof Array) {
                for (var i = 0; i < value.length; ++i) {
                    var subValue = value[i];

                    dest = new MetadataItem();
                    dest.name = name + ' (' + subValue.CRS + ')';
                    dest.value = subValue;

                    populateMetadataGroup(dest, subValue);

                    metadataGroup.items.push(dest);
                }
            } else {
                dest = new MetadataItem();
                dest.name = name;
                dest.value = value;

                populateMetadataGroup(dest, value);

                metadataGroup.items.push(dest);
            }
        }
    }
}

module.exports = WebMapServiceCatalogItem;
