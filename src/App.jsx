import {useState, useEffect, useRef} from 'react';
import Map from 'ol/Map.js';
import View from 'ol/View.js';
import TileLayer from 'ol/layer/Tile.js';
import OSM from 'ol/source/OSM.js';
import "ol/ol.css";

const App = () => {
  const mapRef = useRef();

  useEffect(() => {
    if (!mapRef.current) return;

    const map = new Map({
      target: mapRef.current,
      layers: [
        new TileLayer({
          source: new OSM(),
        }),
      ],
      view: new View({
        center: [0, 0],
        zoom: 2,
      }),
      controls: []
    });

    return () => map.setTarget(null);
  }, []);


  return (
    <>
      <div style={{ width: '100%', height: '100vh' }} ref={mapRef}>

      </div>
    </>
  );
};

export default App;