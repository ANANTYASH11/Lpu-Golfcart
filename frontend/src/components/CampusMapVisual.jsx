import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { Layers, Navigation, MapPin, Maximize2, Sparkles, Box } from 'lucide-react';
import VehicleLayerMap from './VehicleLayerMap';

const LPU_CENTER = [31.2550, 75.7050];
const LPU_BOUNDS = [
  [31.2400, 75.6900], // South-West
  [31.2680, 75.7220]  // North-East
];

export default function CampusMapVisual({
  selectedStopId,
  onSelectStop,
  activeTrips = [],
  availableCarts = [],
  stops = [],
  pickupPin = null,
  onPickupPinChange = null,
  height = "h-[340px]"
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const tileLayerRef = useRef(null);
  const markersLayerRef = useRef(null);
  const vehicleLayerRef = useRef(null);
  const pickupMarkerRef = useRef(null);
  const [mapType, setMapType] = useState('street'); // 'street' or 'satellite'
  const [is3DMode, setIs3DMode] = useState(false);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: LPU_CENTER,
      zoom: 16,
      minZoom: 14,
      maxZoom: 19,
      maxBounds: LPU_BOUNDS,
      maxBoundsViscosity: 0.8,
      zoomControl: true
    });

    const streetLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19
    }).addTo(map);

    tileLayerRef.current = streetLayer;
    markersLayerRef.current = L.layerGroup().addTo(map);
    vehicleLayerRef.current = L.layerGroup().addTo(map);
    mapInstanceRef.current = map;

    setTimeout(() => {
      map.invalidateSize();
    }, 250);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Toggle Map Type (Street vs Satellite)
  const toggleMapType = () => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }

    if (mapType === 'street') {
      const satLayer = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        {
          attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
          maxZoom: 19
        }
      ).addTo(map);
      tileLayerRef.current = satLayer;
      setMapType('satellite');
    } else {
      const streetLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19
      }).addTo(map);
      tileLayerRef.current = streetLayer;
      setMapType('street');
    }
  };

  // Render Stop Markers
  useEffect(() => {
    const layer = markersLayerRef.current;
    if (!layer || !stops || stops.length === 0) return;

    layer.clearLayers();

    stops.forEach((stop) => {
      const isSelected = stop.id === selectedStopId;
      const markerHtml = `
        <div style="
          background: ${isSelected ? '#3B82F6' : '#0F172A'};
          color: white;
          border: 2px solid ${isSelected ? '#FFFFFF' : '#64748B'};
          border-radius: 9999px;
          padding: 3px 8px;
          font-size: 11px;
          font-weight: bold;
          white-space: nowrap;
          box-shadow: 0 4px 10px rgba(0,0,0,0.5);
          display: flex;
          align-items: center;
          gap: 4px;
          cursor: pointer;
          transform: translate(-50%, -50%);
        ">
          <span style="width: 6px; height: 6px; border-radius: 9999px; background: ${isSelected ? '#FFFFFF' : '#38BDF8'};"></span>
          <span>${stop.code || stop.name.split(' (')[0]}</span>
        </div>
      `;

      const customIcon = L.divIcon({
        className: 'custom-stop-marker',
        html: markerHtml,
        iconSize: [0, 0]
      });

      const marker = L.marker([stop.latitude, stop.longitude], { icon: customIcon });
      marker.on('click', () => {
        if (onSelectStop) onSelectStop(stop.id);
      });

      marker.bindPopup(`
        <div style="font-family: inherit; font-size: 12px; color: #0f172a;">
          <strong style="display: block; font-size: 13px;">${stop.name}</strong>
          <span style="color: #64748b; font-size: 11px;">Stop Code: ${stop.code}</span>
          <div style="margin-top: 4px; font-size: 10px; color: #475569;">GPS: ${stop.latitude.toFixed(5)}, ${stop.longitude.toFixed(5)}</div>
        </div>
      `);

      layer.addLayer(marker);
    });
  }, [stops, selectedStopId]);

  // Render Real Vehicle Markers (Shuttles and Golf Carts)
  useEffect(() => {
    const layer = vehicleLayerRef.current;
    if (!layer) return;

    layer.clearLayers();

    // Shuttles
    activeTrips.forEach((trip) => {
      let lat = trip.latitude;
      let lon = trip.longitude;

      // If live GPS not directly on trip object, lookup current stop coordinates
      if (!lat || !lon) {
        const s = stops.find((item) => item.id === trip.current_stop_id);
        if (s) {
          lat = s.latitude;
          lon = s.longitude;
        }
      }

      if (lat && lon) {
        const isFull = trip.current_crowd_level === 'FULL';
        const vHtml = `
          <div style="
            background: ${isFull ? '#E11D48' : '#2563EB'};
            color: white;
            border: 2px solid white;
            border-radius: 8px;
            padding: 3px 6px;
            font-size: 10px;
            font-weight: 800;
            box-shadow: 0 4px 12px rgba(0,0,0,0.6);
            display: flex;
            align-items: center;
            gap: 3px;
            transform: translate(-50%, -50%);
          ">
            <span>🚌</span>
            <span>${trip.shuttle?.vehicle_number || 'PB-101'}</span>
          </div>
        `;

        const vIcon = L.divIcon({
          className: 'custom-vehicle-marker',
          html: vHtml,
          iconSize: [0, 0]
        });

        const vMarker = L.marker([lat, lon], { icon: vIcon });
        vMarker.bindPopup(`
          <div style="font-size: 12px; color: #0f172a;">
            <strong>Shuttle: ${trip.shuttle?.vehicle_number || 'PB-101'}</strong><br/>
            Crowd: <strong>${trip.current_crowd_level}</strong> (${trip.current_passenger_count || 0} pax)<br/>
            Status: ${trip.status}
          </div>
        `);
        layer.addLayer(vMarker);
      }
    });

    // Golf Carts
    availableCarts.forEach((cart) => {
      let lat = cart.latitude;
      let lon = cart.longitude;
      if (!lat || !lon) {
        const s = stops.find((item) => item.id === cart.current_stop_id);
        if (s) {
          lat = s.latitude;
          lon = s.longitude;
        }
      }

      if (lat && lon) {
        const cHtml = `
          <div style="
            background: #4F46E5;
            color: white;
            border: 2px solid #A5B4FC;
            border-radius: 8px;
            padding: 2px 5px;
            font-size: 9px;
            font-weight: bold;
            box-shadow: 0 4px 10px rgba(0,0,0,0.5);
            display: flex;
            align-items: center;
            gap: 2px;
            transform: translate(-50%, -50%);
          ">
            <span>🛺</span>
            <span>${cart.cart_code}</span>
          </div>
        `;

        const cIcon = L.divIcon({
          className: 'custom-cart-marker',
          html: cHtml,
          iconSize: [0, 0]
        });

        const cMarker = L.marker([lat, lon], { icon: cIcon });
        cMarker.bindPopup(`
          <div style="font-size: 12px; color: #0f172a;">
            <strong>Golf Cart: ${cart.cart_code}</strong><br/>
            Capacity: ${cart.capacity} seats<br/>
            Status: ${cart.status}
          </div>
        `);
        layer.addLayer(cMarker);
      }
    });
  }, [activeTrips, availableCarts, stops]);

  return (
    <div className="glass-panel rounded-2xl p-3 border border-slate-800 space-y-2 relative overflow-hidden">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <Navigation className="w-4 h-4 text-blue-400" />
          <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
            Real Campus Map &bull; Lovely Professional University (LPU)
          </h3>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIs3DMode(!is3DMode)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-bold transition-all shadow ${
              is3DMode
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white border-blue-500 shadow-blue-500/25'
                : 'bg-slate-900 border-slate-700 hover:bg-slate-800 text-slate-300'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>{is3DMode ? '3D Active' : '3D Fleet'}</span>
          </button>
          {!is3DMode && (
            <button
              onClick={toggleMapType}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 hover:bg-slate-800 text-[11px] font-semibold text-slate-300 transition-colors shadow"
            >
              <Layers className="w-3.5 h-3.5 text-indigo-400" />
              <span>{mapType === 'street' ? 'Satellite' : 'Street'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Map Stage: 3D MapLibre or 2D Leaflet */}
      {is3DMode ? (
        <div className={`w-full ${height} rounded-xl overflow-hidden border border-slate-800 relative z-0`}>
          <VehicleLayerMap height="h-full" />
        </div>
      ) : (
        <div
          ref={mapContainerRef}
          className={`w-full ${height} rounded-xl border border-slate-800 shadow-inner z-0 relative`}
        />
      )}

      <div className="flex items-center justify-between text-[11px] text-slate-400 px-1 pt-1 font-mono">
        <span>Bounded to LPU Campus (31.255°N, 75.705°E)</span>
        <span className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-blue-500" /> Stop
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500" /> Vehicle
          </span>
          <span className="text-slate-500">Offline Cached</span>
        </span>
      </div>
    </div>
  );
}
