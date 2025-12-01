import './App.css';
import {useState, useEffect, useRef} from 'react';
import Map from 'ol/Map.js';
import View from 'ol/View.js';
import TileLayer from 'ol/layer/Tile.js';
import OSM from 'ol/source/OSM.js';
import "ol/ol.css";
import Draw from 'ol/interaction/Draw.js';
import Feature from 'ol/Feature.js';
import Point from 'ol/geom/Point.js';
import LineString from 'ol/geom/LineString.js';
import VectorSource from 'ol/source/Vector.js';
import VectorLayer from 'ol/layer/Vector.js';
import Polygon from 'ol/geom/Polygon.js';
import {fromLonLat} from 'ol/proj.js';
import Snap from 'ol/interaction/Snap.js';
import Modify from 'ol/interaction/Modify.js';
import Style from 'ol/style/Style.js';
import Fill from 'ol/style/Fill';
import Stroke from 'ol/style/Stroke';
import GeoJSON from 'ol/format/GeoJSON.js';
import {getArea, getLength} from 'ol/sphere.js';
import Overlay from 'ol/Overlay.js';
import {unByKey} from 'ol/Observable.js';
import CircleStyle from 'ol/style/Circle.js';

import drawIco from './assets/draw.png';
import saveIco from './assets/save.png';
import editIco from './assets/edit.png';
import deleteIco from './assets/delete.png';
import rulerIco from './assets/ruler.png';
import squareIco from './assets/square.png';

const App = () => {
  const mapRef = useRef();
  const mapInstanceRef = useRef(null);
  const rasterLayerRef = useRef(null);
  const vectorLayerRef = useRef(null);
  const vectorSourceRef = useRef(null);
  const drawInteractionRef = useRef(null);
  const modifyInteractionRef = useRef(null);
  const snapInteractionRef = useRef(null);
  const selectedFeatureRef = useRef(null);

  const measureSourceRef = useRef(null);
  const measureLayerRef = useRef(null);
  const measureDrawRef = useRef(null);
  const measureTooltipRef = useRef(null);
  const measureTooltipElementRef = useRef(null);
  const measureListenerRef = useRef(null);

  const areaDrawRef = useRef(null);
  const areaTooltipRef = useRef(null);
  const areaTooltipElementRef = useRef(null);
  const areaListenerRef = useRef(null);

  const[isDrawing, setIsDrawing] = useState(false);
  const[isEditing, setIsEditing] = useState(false);
  const isEditingRef = useRef(isEditing);
  const[category, setCategory] = useState('Buildings');
  const categoryRef = useRef(category);
  const[isRulerActive, setIsRulerActive] = useState(false);
  const [isAreaActive, setIsAreaActive] = useState(false);

  // reference to vector layer source
  useEffect(() => {
    isEditingRef.current = isEditing;
  }, [isEditing]);

  // useeffect for map initialization
  useEffect(() => {
    if (!mapRef.current) return;

    rasterLayerRef.current = new TileLayer({ // create raster layer
      source: new OSM(),
    });

    vectorSourceRef.current = new VectorSource(); // create vector source

    vectorLayerRef.current = new VectorLayer({ // create vector layer
      source: vectorSourceRef.current,
      opacity: 0.5,
      style: (feature) => {
        return new Style({
          fill: new Fill({
            color: 'red',
          }),
          stroke: new Stroke({
            color: feature.get('selected') === true ? 'yellow' : 'darkred',
            width: 2,
          }),
        });
      }
    });

    
    measureSourceRef.current = new VectorSource({ wrapX: false });
    measureLayerRef.current = new VectorLayer({ // measure init
      source: measureSourceRef.current,
      style: new Style({
        fill: new Fill({
          color: 'rgba(255, 255, 255, 0.2)',
        }),
        stroke: new Stroke({
          color: 'rgba(0, 0, 0, 0.5)',
          lineDash: [10, 10],
          width: 2,
        }),
        image: new CircleStyle({
          radius: 5,
          stroke: new Stroke({
            color: 'rgba(0, 0, 0, 0.7)',
          }),
          fill: new Fill({
            color: 'rgba(255, 255, 255, 0.2)',
          }),
        }),
      }),
    });

    mapInstanceRef.current = new Map({
      target: mapRef.current,
      layers: [
        rasterLayerRef.current,
        vectorLayerRef.current,
        measureLayerRef.current
      ],
      view: new View({
        center: [0, 0],
        zoom: 2,
      }),
      controls: [],
    });
    
    mapInstanceRef.current.on('singleclick', (evt) => { // click event for selecting feature
      if (!isEditingRef.current || !vectorSourceRef.current) return;

      let clickedFeature = null;

      mapInstanceRef.current.forEachFeatureAtPixel(evt.pixel, (feature, layer) => {
        // Ignore the measurement layer when selecting (if necessary)
        if (layer === measureLayerRef.current) return;
        clickedFeature = feature;
        return true;
      });


      // if there was a selection, remove it
      if (selectedFeatureRef.current) {
        selectedFeatureRef.current.set('selected', false);
      }

      // Click on a new feature to highlight it
      if (clickedFeature) {
        clickedFeature.set('selected', true);
        selectedFeatureRef.current = clickedFeature;
      } else {
        selectedFeatureRef.current = null;
      }

      // redraw layer
      vectorSourceRef.current.changed();
    });

    
    /*----------------- Adding Interactions -----------------*/
    drawInteractionRef.current = new Draw({ // create draw interaction
      source: vectorLayerRef.current.getSource(),
      type: 'Polygon',
    });

    drawInteractionRef.current.on('drawend', (evt) => { // on draw end event
      const feature = evt.feature;
      feature.set('layer_type', categoryRef.current);
      feature.set('color', 'darkred');
    });

    snapInteractionRef.current = new Snap({ // create snap interaction
      source: vectorLayerRef.current.getSource(),
    });

    modifyInteractionRef.current = new Modify({ // create modify interaction
      source: vectorLayerRef.current.getSource(),
    });

    /*----------------- Adding Initial Features -----------------*/
    const featuresRes = async () => { // fetch initial features from server
      try {
        const res = await fetch('http://10.11.1.73:8090/api/gis/get');
        const data = await res.json();

        const geojsonFormat = new GeoJSON();
        const features = geojsonFormat.readFeatures(data, { // read features from geojson
          featureProjection: 'EPSG:3857', // converting to web mercator
          dataProjection: 'EPSG:4326', // from lon/lat
        });
        vectorLayerRef.current.getSource().addFeatures(features); // add features to vector layer source
      } catch (err) {
        console.error(err);
      }
    }
    featuresRes();
    
    /* const pointFeature = new Feature({ // create point feature
      geometry: new Point(fromLonLat([0, 0])), // coordinates in lon/lat
    });

    const lineFeature = new Feature({ // create line feature
      geometry: new LineString([ // coordinates in lon/lat
        fromLonLat([-10, 0]),
        fromLonLat([0, 10]),
        fromLonLat([10, 0]),
      ])
    });

    const polygonFeature = new Feature({ // create polygon feature
      geometry: new Polygon([ // coordinates in lon/lat
        [
          fromLonLat([-5, -5]),
          fromLonLat([-5, 5]),
          fromLonLat([5, 5]),
          fromLonLat([5, -5]),
          fromLonLat([-5, -5]),
        ]
      ])
    }); */

    // vectorLayerRef.current.getSource().addFeatures([pointFeature, lineFeature, polygonFeature]); // add features to vector layer source

    return () => { // cleanup on unmount
      mapInstanceRef.current.setTarget(null);
      mapInstanceRef.current = null;

      drawInteractionRef.current = null;
      modifyInteractionRef.current = null;
      snapInteractionRef.current = null;

      vectorSourceRef.current = null;
      vectorLayerRef.current = null;
      rasterLayerRef.current = null;

      if (measureDrawRef.current) {
        mapInstanceRef.current.removeInteraction(measureDrawRef.current);
        measureDrawRef.current = null;
      }
      if (areaDrawRef.current) {
        mapInstanceRef.current.removeInteraction(areaDrawRef.current);
        areaDrawRef.current = null;
      }
      if (measureTooltipRef.current) {
        mapInstanceRef.current.removeOverlay(measureTooltipRef.current);
        measureTooltipRef.current = null;
        measureTooltipElementRef.current = null;
      }
      if (areaTooltipRef.current) {
        mapInstanceRef.current.removeOverlay(areaTooltipRef.current);
        areaTooltipRef.current = null;
        areaTooltipElementRef.current = null;
      }
      if (measureListenerRef.current) {
        unByKey(measureListenerRef.current);
        measureListenerRef.current = null;
      }
      if (areaListenerRef.current) {
        unByKey(areaListenerRef.current);
        areaListenerRef.current = null;
      }
    }
  }, []);

  // useffect for drawing interaction - point snapping
  useEffect(() => {
    if (!mapInstanceRef.current || !drawInteractionRef.current || !snapInteractionRef.current) return; // check all iteractions and map are initialized

    if (isDrawing) { // add draw, snap interaction to map (if isDrawing is true)
      mapInstanceRef.current.addInteraction(drawInteractionRef.current);
      mapInstanceRef.current.addInteraction(snapInteractionRef.current);
    } 
    else {
      mapInstanceRef.current.removeInteraction(drawInteractionRef.current);
      mapInstanceRef.current.removeInteraction(snapInteractionRef.current);
    }

  }, [isDrawing]);

  // useffect for measuare interactions - point snapping
  useEffect(() => {
    if (!mapInstanceRef.current || !snapInteractionRef.current) return; // check all iteractions and map are initialized

    if (isRulerActive || isAreaActive) { // add snap interaction to map (if isRulerActive, isAreaActive is true)
      mapInstanceRef.current.addInteraction(snapInteractionRef.current);
    } 
    else {
      mapInstanceRef.current.removeInteraction(snapInteractionRef.current);
    }
  }, [isRulerActive, isAreaActive]);

  const drawingToggle = () => { // toggle drawing interaction
    if (!mapInstanceRef.current || !drawInteractionRef.current || !snapInteractionRef.current) return;

    // When you turn on drawing, turn off editing.
    if (isEditing) {
      setIsEditing(false);
      if (modifyInteractionRef.current) {
        mapInstanceRef.current.removeInteraction(modifyInteractionRef.current);
      }
    }

    setIsRulerActive(false);
    setIsAreaActive(false);
    
    setIsDrawing(prev => {
      const next = !prev;

      if (next) {
        mapInstanceRef.current.addInteraction(drawInteractionRef.current);
        mapInstanceRef.current.addInteraction(snapInteractionRef.current);
      } else {
        mapInstanceRef.current.removeInteraction(drawInteractionRef.current);
        mapInstanceRef.current.removeInteraction(snapInteractionRef.current);
      }

      return next;
    });
  };

  const categoryChange = (e) => { // handle category change
    setCategory(e.target.value);
    categoryRef.current = e.target.value;
  }

  const save = async () => { // save only NEW features
    if (!vectorSourceRef.current) return;

    const features = vectorSourceRef.current.getFeatures();

    if (!features.length) {
      alert('There are no NEW features for saving');
      return;
    }

    const geojsonFormat = new GeoJSON();

    const geojson = geojsonFormat.writeFeaturesObject(features, {
      featureProjection: 'EPSG:3857',
      dataProjection: 'EPSG:4326',
    });

    try {
      const res = await fetch('http://10.11.1.73:8090/api/gis/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          layer: category,
          features: geojson.features,
          color: 'darkred',
        }),
      });

      alert('Saved successfully');
      
      window.location.reload(); // reload the page to fetch new features with IDs
    } catch (err) {
      console.error(err);
    }
  };

  const editToggle = () => { // toggle modify interaction
    if (!mapInstanceRef.current || !modifyInteractionRef.current) return;

    // When turning editing on/off, always turn off drawing
    setIsDrawing(false);
    setIsRulerActive(false);
    setIsAreaActive(false);

    setIsEditing(prev => {
      const next = !prev;

      if (next) {
        // turn on modify
        mapInstanceRef.current.addInteraction(modifyInteractionRef.current);
      } else {
        // turn off modify
        mapInstanceRef.current.removeInteraction(modifyInteractionRef.current);

        // deselect if necessary
        if (selectedFeatureRef.current && vectorSourceRef.current) {
          selectedFeatureRef.current.set('selected', false);
          selectedFeatureRef.current = null;
          vectorSourceRef.current.changed();
        }
      }

      return next;
    });
  };


  const deleteSelected = async () => { // delete selected feature
    const feature = selectedFeatureRef.current;

    if (!feature || !vectorSourceRef.current) return;

    feature.set('selected', false);
    vectorSourceRef.current.removeFeature(feature);
    selectedFeatureRef.current = null;

    await fetch('http://10.11.1.73:8090/api/gis/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: feature.getId() ?? null,
      }),
    });
  };

  const rulerSelected = () => { // ruler measure functionality
    if (!mapInstanceRef.current || !measureSourceRef.current) return;
    const map = mapInstanceRef.current;

    // turn off the remaining modes
    setIsDrawing(false);
    if (isEditing && modifyInteractionRef.current) {
      map.removeInteraction(modifyInteractionRef.current);
      setIsEditing(false);
    }
    setIsAreaActive(false);

    // if it’s already active, turn it off and clean everything
    if (isRulerActive) {
      if (measureDrawRef.current) {
        map.removeInteraction(measureDrawRef.current);
        measureDrawRef.current = null;
      }
      if (measureTooltipRef.current) {
        map.removeOverlay(measureTooltipRef.current);
        measureTooltipRef.current = null;
        measureTooltipElementRef.current = null;
      }
      if (measureListenerRef.current) {
        unByKey(measureListenerRef.current);
        measureListenerRef.current = null;
      }
      if (snapInteractionRef.current) { // remove snap
        map.removeInteraction(snapInteractionRef.current);
      }
      measureSourceRef.current.clear();
      setIsRulerActive(false);
      return;
    }

    // turn on the ruler mode
    setIsRulerActive(true);
    measureSourceRef.current.clear();
    
    if (snapInteractionRef.current) { // Including snap to existing features.
      map.addInteraction(snapInteractionRef.current);
    }

    // создаём tooltip
    const tooltipEl = document.createElement('div');
    tooltipEl.className = 'ol-tooltip ol-tooltip-measure';
    const tooltipOverlay = new Overlay({
      element: tooltipEl,
      offset: [0, -15],
      positioning: 'bottom-center',
    });
    map.addOverlay(tooltipOverlay);
    measureTooltipRef.current = tooltipOverlay;
    measureTooltipElementRef.current = tooltipEl;

    const draw = new Draw({
      source: measureSourceRef.current,
      type: 'LineString',
    });
    measureDrawRef.current = draw;

    draw.on('drawstart', (evt) => {
      const geom = evt.feature.getGeometry();
      const listener = geom.on('change', (e) => {
        const line = e.target;
        const length = getLength(line);
        const output =
          length > 1000
            ? (length / 1000).toFixed(2) + ' km'
            : length.toFixed(0) + ' m';

        const coord = line.getLastCoordinate();
        if (measureTooltipElementRef.current) {
          measureTooltipElementRef.current.innerHTML = output;
          measureTooltipRef.current.setPosition(coord);
        }
      });
      measureListenerRef.current = listener;
    });

    draw.on('drawend', () => {
      if (measureTooltipElementRef.current) {
        measureTooltipElementRef.current.className = 'ol-tooltip ol-tooltip-static';
        measureTooltipRef.current.setOffset([0, -7]);
      }

      if (measureListenerRef.current) {
        unByKey(measureListenerRef.current);
        measureListenerRef.current = null;
      }

      measureTooltipElementRef.current = null;

      // one dimension - exit the mode, but the geometry/label remains
      map.removeInteraction(draw);
      measureDrawRef.current = null;

      // remove snap
      if (snapInteractionRef.current) {
        map.removeInteraction(snapInteractionRef.current);
      }

      setIsRulerActive(false);
    });

    map.addInteraction(draw);
  };

  const areaSelected = () => { // area measure functionality
    if (!mapInstanceRef.current || !measureSourceRef.current) return;
    const map = mapInstanceRef.current;

    // turn off the remaining modes
    setIsDrawing(false);
    if (isEditing && modifyInteractionRef.current) {
      map.removeInteraction(modifyInteractionRef.current);
      setIsEditing(false);
    }
    setIsRulerActive(false);

    // If it is already active, turn it off and clean it.
    if (isAreaActive) {
      if (areaDrawRef.current) {
        map.removeInteraction(areaDrawRef.current);
        areaDrawRef.current = null;
      }
      if (areaTooltipRef.current) {
        map.removeOverlay(areaTooltipRef.current);
        areaTooltipRef.current = null;
        areaTooltipElementRef.current = null;
      }
      if (areaListenerRef.current) {
        unByKey(areaListenerRef.current);
        areaListenerRef.current = null;
      }
      // remove snapshot
      if (snapInteractionRef.current) {
        map.removeInteraction(snapInteractionRef.current);
      }
      measureSourceRef.current.clear();
      setIsAreaActive(false);
      return;
    }

    // turn on the area mode
    setIsAreaActive(true);
    measureSourceRef.current.clear();

    // 🟢 turn on snap
    if (snapInteractionRef.current) {
      map.addInteraction(snapInteractionRef.current);
    }

    const tooltipEl = document.createElement('div');
    tooltipEl.className = 'ol-tooltip ol-tooltip-measure';
    const tooltipOverlay = new Overlay({
      element: tooltipEl,
      offset: [0, -15],
      positioning: 'bottom-center',
    });
    map.addOverlay(tooltipOverlay);
    areaTooltipRef.current = tooltipOverlay;
    areaTooltipElementRef.current = tooltipEl;

    const draw = new Draw({
      source: measureSourceRef.current,
      type: 'Polygon',
    });
    areaDrawRef.current = draw;

    draw.on('drawstart', (evt) => {
      const geom = evt.feature.getGeometry();
      const listener = geom.on('change', (e) => {
        const poly = e.target;
        const area = getArea(poly);
        let output;
        if (area > 1_000_000) {
          output = (area / 1_000_000).toFixed(2) + ' km²';
        } else if (area > 10_000) {
          output = (area / 10_000).toFixed(2) + ' ha';
        } else {
          output = area.toFixed(0) + ' m²';
        }

        const coord = poly.getInteriorPoint().getCoordinates();
        if (areaTooltipElementRef.current) {
          areaTooltipElementRef.current.innerHTML = output;
          areaTooltipRef.current.setPosition(coord);
        }
      });
      areaListenerRef.current = listener;
    });

    draw.on('drawend', () => {
      if (areaTooltipElementRef.current) {
        areaTooltipElementRef.current.className = 'ol-tooltip ol-tooltip-static';
        areaTooltipRef.current.setOffset([0, -7]);
      }

      if (areaListenerRef.current) {
        unByKey(areaListenerRef.current);
        areaListenerRef.current = null;
      }

      areaTooltipElementRef.current = null;

      // one dimension - exit the mode
      map.removeInteraction(draw);
      areaDrawRef.current = null;

      // remove snap
      if (snapInteractionRef.current) {
        map.removeInteraction(snapInteractionRef.current);
      }

      setIsAreaActive(false);
    });

    map.addInteraction(draw);
  };


  return (
    <>
      <header>
        <div className="left-wrap">
          <button style={{background: isDrawing && '#ff8d8d'}} onClick={drawingToggle}><img src={drawIco} alt="draw" /></button>
          <button style={{background: isEditing && '#ff8d8d'}} onClick={editToggle}><img src={editIco} alt="edit" /></button>
          <button onClick={deleteSelected} className='deleteBtn'><img src={deleteIco} alt="delete" /></button>
          <button style={{background: isRulerActive && '#ff8d8d'}} onClick={rulerSelected} className='rulerBtn'><img src={rulerIco} alt="ruler" /></button>
          <button style={{background: isAreaActive && '#ff8d8d'}} onClick={areaSelected} className='aquareBtn'><img src={squareIco} alt="aquare" /></button>

          <button className='save-btn' onClick={save}><img src={saveIco} alt="save" /></button>
        </div>
        <div className="right-wrap">
          <select onChange={categoryChange}>
            <option value="Buildings">Buildings</option>
            <option value="Parcels">Parcels</option>
          </select>
        </div>
      </header>
      <div style={{ width: '100%', height: '100vh' }} ref={mapRef}></div>
    </>
  );
};

export default App;