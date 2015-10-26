'use strict';

/*global require,describe,it,expect,beforeEach,afterEach*/
var FeatureInfoPanelViewModel = require('../../lib/ViewModels/FeatureInfoPanelViewModel');
var PickedFeatures = require('../../lib/Map/PickedFeatures');
var runLater = require('../../lib/Core/runLater');
var Terria = require('../../lib/Models/Terria');
var Entity = require('terriajs-cesium/Source/DataSources/Entity');
var when = require('terriajs-cesium/Source/ThirdParty/when');


describe('FeatureInfoPanelViewModel', function() {
    var terria;
    var panel;

    beforeEach(function() {
        terria = new Terria({
            baseUrl: './'
        });
        panel = new FeatureInfoPanelViewModel({
            terria: terria
        });
    });

    afterEach(function() {
        panel.destroy();
        panel = undefined;
    });

    it('is initially not visible', function() {
        expect(panel.isVisible).toBe(false);
    });

    it('is shown when terria.pickedFeatures is defined', function() {
        terria.pickedFeatures = new PickedFeatures();
        expect(panel.isVisible).toBe(true);
    });

    it('is hidden when terria.pickedFeatures is set back to undefined', function() {
        terria.pickedFeatures = new PickedFeatures();
        expect(panel.isVisible).toBe(true);
        terria.pickedFeatures = undefined;
        expect(panel.isVisible).toBe(false);
    });

    it('sanitizes HTML', function() {
        panel.html = '<script type="text/javascript">\nalert("foo");\n</script>';
        panel.isVisible = true;

        expect(domContainsText(panel, 'alert("foo")')).toBe(false);
    });

    it('uses a white background for complete HTML documents', function() {
        panel.html = '<html><body>hi!</body></html>';
        expect(panel.useWhiteBackground).toBe(true);

        panel.html = '<div>hi!</div>';
        expect(panel.useWhiteBackground).toBe(false);

        panel.html = '<html attr="yes">\n<body>hi!</body>\n</html>';
        expect(panel.useWhiteBackground).toBe(true);
    });

    it('displays a message while asychronously obtaining feature information', function() {
        var pickedFeatures = new PickedFeatures();
        pickedFeatures.allFeaturesAvailablePromise = runLater(function() {});
        terria.pickedFeatures = pickedFeatures;
        expect(domContainsText(panel, 'Loading')).toBe(true);
    });

    it('creates a temporary selected feature at the pick location while picking is in progress', function() {
        var pickedFeatures = new PickedFeatures();
        pickedFeatures.allFeaturesAvailablePromise = runLater(function() {});
        terria.pickedFeatures = pickedFeatures;

        expect(terria.selectedFeature).toBeDefined();
        expect(terria.selectedFeature.id).toBe('Pick Location');
    });

    it('should use featureInfoTemplate', function(done) {
        var feature = new Entity({
                name: 'Bar',
                properties: {
                    name: 'Foo',
                    value: 'bar'
                },
                featureInfoTemplate : "<div>test test</div>"
            });
        var pickedFeatures = new PickedFeatures();
        pickedFeatures.features.push(feature);
        pickedFeatures.allFeaturesAvailablePromise = runLater(function() {});
        var promise = runLater(function() {
            terria.pickedFeatures = pickedFeatures;
        });

        when(promise, function(){
            expect(terria.selectedFeature).toBeDefined();
            expect(terria.selectedFeature.name).toBe('Bar');
            expect(terria.selectedFeature.properties.name).toBe('Foo');
            expect(terria.selectedFeature.featureInfoTemplate).toBe('<div>test test</div>');
        }).otherwise(done.fail).then(done);
    });

    it('uses and completes featureInfoTemplate', function(done) {
        var properties = {
            name: 'Foo',
            value: '<h1>bar</h1>'
        };
        properties.getValue = function() {
            var x = {};
            x[properties.name] = properties.value;
            return x;
        };
        var feature = new Entity({
                name: 'Bar',
                properties: properties,
                imageryLayer: {featureInfoTemplate : "<div>test test {{Foo}}</div>"}
            });
        var pickedFeatures = new PickedFeatures();
        pickedFeatures.features.push(feature);
        pickedFeatures.allFeaturesAvailablePromise = runLater(function() {});

        panel.showFeatures(pickedFeatures).then(function() {
            expect(panel.html).toBe('<div>test test <h1>bar</h1></div>');
        }).otherwise(done.fail).then(done);
    });

    function domContainsText(panel, s) {
        for (var i = 0; i < panel._domNodes.length; ++i) {
            if (panel._domNodes[i].innerHTML && panel._domNodes[i].innerHTML.indexOf(s) >= 0) {
                return true;
            }
        }

        return false;
    }
});
