import { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import axios from 'axios';
import { Maximize, Minimize } from 'lucide-react';

export default function GeospatialMap() {
  const [mapData, setMapData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const mapContainerRef = useRef(null);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      mapContainerRef.current?.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  useEffect(() => {
    const fetchMapData = async () => {
      try {
        const url = window.location.hostname === 'localhost' 
          ? '/api/chat' 
          : 'https://crimeiq-60074288350.development.catalystserverless.in/server/chat-function/execute';
        const res = await axios.get(url, { params: { q: 'ACTION_GET_MAP_DATA' } });
        const raw = res.data?.output || res.data;
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (parsed.data?.MapFIRs) {
          setMapData(parsed.data.MapFIRs);
        }
      } catch (err) {
        console.error("Map fetch error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchMapData();
  }, []);

  if (loading) {
    return <div className="h-full flex items-center justify-center text-slate-400">Loading Geospatial Data...</div>;
  }

  // Calculate density to create prediction hotspots
  const grids = {};
  mapData.forEach(fir => {
    const gridKey = `${Math.round(fir.latitude * 100) / 100},${Math.round(fir.longitude * 100) / 100}`;
    grids[gridKey] = (grids[gridKey] || 0) + 1;
  });

  return (
    <div ref={mapContainerRef} className="h-full w-full rounded-xl overflow-hidden border border-slate-200 shadow-sm relative z-0 bg-white">
      <button 
        onClick={toggleFullscreen} 
        className="absolute top-4 right-4 z-[1000] bg-white p-2 rounded shadow-md hover:bg-slate-50 border border-slate-200"
        title="Toggle Fullscreen"
      >
        {isFullscreen ? <Minimize size={20} className="text-slate-700"/> : <Maximize size={20} className="text-slate-700"/>}
      </button>
      <MapContainer center={[14.5, 76.0]} zoom={6} scrollWheelZoom={true} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {mapData.map((fir, i) => {
          const gridKey = `${Math.round(fir.latitude * 100) / 100},${Math.round(fir.longitude * 100) / 100}`;
          const density = grids[gridKey];
          // Heatmap scoring: Red = High risk (>3 cases in grid), Orange = Medium, Blue = Low
          const isHotspot = density > 3;
          const isMedium = density > 1;
          const color = isHotspot ? '#ef4444' : (isMedium ? '#f97316' : '#3b82f6');
          const radius = isHotspot ? 14 : (isMedium ? 10 : 6);

          return (
            <CircleMarker
              key={i}
              center={[fir.latitude, fir.longitude]}
              pathOptions={{ color: color, fillColor: color, fillOpacity: 0.6, weight: 1 }}
              radius={radius}
            >
              <Popup>
                <div className="text-xs">
                  <div className="font-bold text-slate-800 mb-1">{fir.fir_number}</div>
                  <div className="text-slate-600">Type: <span className="font-medium text-slate-800">{fir.crime_type}</span></div>
                  <div className="text-slate-600">Station: {fir.station}</div>
                  <div className="text-slate-600">Date: {fir.date_of_incident}</div>
                  <div className="text-slate-600">Status: {fir.status}</div>
                  {isHotspot && (
                    <div className="mt-2 text-[10px] font-bold text-red-600 uppercase bg-red-50 px-2 py-1 rounded">
                      ⚠️ High Risk Prediction Zone
                    </div>
                  )}
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>
    </div>
  );
}
