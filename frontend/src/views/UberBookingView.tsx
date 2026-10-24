import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import {
  ArrowLeft,
  MapPin,
  Search,
  Navigation,
  Clock,
  Users,
  Phone,
  X,
  Share2,
  CheckCircle2,
  AlertCircle,
  Shield,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Sun,
  Moon,
  Bus,
  Zap,
  Car,
  Info,
} from 'lucide-react';

import {
  getMapStyle,
  setupCampus3DBuildings,
  setHighlightedDestinationBuilding,
  filterCampusPOIs,
  CAMPUS_CONFIG,
  MapProvider,
  MAP_CONFIG,
} from '../config/map';

import {
  calculateRoute,
  snapToNearestRoad,
  haversineDistance,
  RouteResult,
} from '../utils/campusRouter';

// Verified LPU Campus Stops with Exact OSM Coordinates
export interface CampusStop {
  id: string;
  name: string;
  fullName: string;
  code: string;
  area: string;
  coords: [number, number]; // [lng, lat]
  buildingName?: string;
  buildingCategory?: 'academic' | 'hostel' | 'food' | 'medical' | 'library' | 'sports';
  servesShuttle?: boolean;
}

export const LPU_CAMPUS_STOPS: CampusStop[] = [
  {
    id: 'stop-main-gate',
    name: 'Main Gate',
    fullName: 'Main Gate (NH-44 Entry Complex)',
    code: 'MG-01',
    area: 'Northern Entry Corridor',
    coords: [75.706874, 31.26052],
    buildingCategory: 'academic',
    servesShuttle: true,
  },
  {
    id: 'stop-unimall',
    name: 'Uni-Mall',
    fullName: 'Uni-Mall Commercial Centre',
    code: 'UM-02',
    area: 'Central Commercial Quad',
    coords: [75.703312, 31.255268],
    buildingName: 'Uni-Mall Commercial Centre',
    buildingCategory: 'food',
    servesShuttle: true,
  },
  {
    id: 'stop-library',
    name: 'Central Library',
    fullName: 'Central Library & Unipolis',
    code: 'LIB',
    area: 'Academic Core',
    coords: [75.704998, 31.255716],
    buildingName: 'Central University Library & Unipolis',
    buildingCategory: 'library',
    servesShuttle: true,
  },
  {
    id: 'stop-block32',
    name: 'Block 32',
    fullName: 'Block 32 (Computer Science & Eng)',
    code: 'B32',
    area: 'Engineering Wing',
    coords: [75.706885, 31.257892],
    buildingName: 'Block 32 & 34 (Engineering Complex)',
    buildingCategory: 'academic',
    servesShuttle: true,
  },
  {
    id: 'stop-block34',
    name: 'Block 34',
    fullName: 'Block 34 (Engineering Labs Complex)',
    code: 'B34',
    area: 'Engineering Wing',
    coords: [75.705573, 31.256809],
    buildingName: 'Block 32 & 34 (Engineering Complex)',
    buildingCategory: 'academic',
    servesShuttle: false, // Pedestrian inner courtyard
  },
  {
    id: 'stop-block38',
    name: 'Block 38',
    fullName: 'Block 38 (Mittal School of Business)',
    code: 'B38',
    area: 'Northern Business Quad',
    coords: [75.70886, 31.258602],
    buildingName: 'Block 38 (Mittal School of Business)',
    buildingCategory: 'academic',
    servesShuttle: true,
  },
  {
    id: 'stop-girls-hostels',
    name: 'Girls Hostels',
    fullName: 'Girls Hostel Complex (GH 1-6)',
    code: 'GH',
    area: 'Western Residential Sector',
    coords: [75.70063, 31.253669],
    buildingName: 'Girls Hostel Complex (GH)',
    buildingCategory: 'hostel',
    servesShuttle: true,
  },
  {
    id: 'stop-boys-hostels',
    name: 'Boys Hostels',
    fullName: 'Boys Hostel Complex (BH 1-8)',
    code: 'BH',
    area: 'Southern Residential Sector',
    coords: [75.703854, 31.247999],
    buildingName: 'Boys Hostel Complex (BH)',
    buildingCategory: 'hostel',
    servesShuttle: true,
  },
  {
    id: 'stop-health',
    name: 'Health Centre',
    fullName: 'University Hospital & Health Centre',
    code: 'HOSP',
    area: 'Medical Sector',
    coords: [75.70355, 31.25545],
    buildingName: 'University Health Centre',
    buildingCategory: 'medical',
    servesShuttle: false, // Priority emergency & cart access
  },
  {
    id: 'stop-auditorium',
    name: 'Auditorium',
    fullName: 'Shanti Devi Mittal Auditorium',
    code: 'AUD',
    area: 'Central Civic Quad',
    coords: [75.706069, 31.256642],
    buildingName: 'Shanti Devi Mittal Auditorium',
    buildingCategory: 'academic',
    servesShuttle: true,
  },
];

interface LiveFleetVehicle {
  id: string;
  type: 'shuttle' | 'cart' | 'rickshaw';
  plate: string;
  driverName: string;
  phone: string;
  rating: string;
  trips: string;
  coords: [number, number];
  available: boolean;
  seats: number;
}

const INITIAL_FLEET: LiveFleetVehicle[] = [
  {
    id: 'shuttle-01',
    type: 'shuttle',
    plate: 'PB-08-BS-01',
    driverName: 'Harpreet Singh',
    phone: '+91 98765 11001',
    rating: '4.88',
    trips: '2,840 trips',
    coords: [75.7061, 31.2572],
    available: true,
    seats: 28,
  },
  {
    id: 'cart-04',
    type: 'cart',
    plate: 'PB-08-GC-04',
    driverName: 'Gurpreet Singh',
    phone: '+91 98765 43210',
    rating: '4.95',
    trips: '1,420 trips',
    coords: [75.7042, 31.2551],
    available: true,
    seats: 4,
  },
  {
    id: 'cart-07',
    type: 'cart',
    plate: 'PB-08-GC-07',
    driverName: 'Davinder Kumar',
    phone: '+91 98765 43217',
    rating: '4.89',
    trips: '930 trips',
    coords: [75.7039, 31.2488],
    available: true,
    seats: 4,
  },
  {
    id: 'rickshaw-12',
    type: 'rickshaw',
    plate: 'PB-08-ER-12',
    driverName: 'Surjit Ram',
    phone: '+91 98765 88212',
    rating: '4.82',
    trips: '3,110 trips',
    coords: [75.7065, 31.2598],
    available: true,
    seats: 3,
  },
];

interface UberBookingViewProps {
  onBack: () => void;
}

type FlowStep = 'search' | 'options' | 'finding' | 'assigned';
type RideType = 'shuttle' | 'cart' | 'rickshaw';
type SheetSnap = 'peek' | 'half' | 'full';

export default function UberBookingView({ onBack }: UberBookingViewProps) {
  const { mode, tokens, toggleTheme } = useTheme();
  const { currentUser } = useAuth();

  const [step, setStep] = useState<FlowStep>('options');
  const [pickupStop, setPickupStop] = useState<CampusStop>(LPU_CAMPUS_STOPS[0]);
  const [dropoffStop, setDropoffStop] = useState<CampusStop | null>(LPU_CAMPUS_STOPS[2]); // Central Library
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRide, setSelectedRide] = useState<RideType>('cart');
  const [sheetSnap, setSheetSnap] = useState<SheetSnap>('half');

  // Route State
  const [routeInfo, setRouteInfo] = useState<RouteResult | null>(null);
  const [isRouting, setIsRouting] = useState(false);

  // Live Fleet State
  const [fleet, setFleet] = useState<LiveFleetVehicle[]>(INITIAL_FLEET);

  // Driver Assignment State
  const [assignedVehicle, setAssignedVehicle] = useState<LiveFleetVehicle>(INITIAL_FLEET[1]);
  const [driverEtaMins, setDriverEtaMins] = useState(2);

  // Map Provider & Error State
  const [mapProvider, setMapProvider] = useState<MapProvider>(MAP_CONFIG.defaultProvider);
  const [mapError, setMapError] = useState(false);

  // Map References
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const pickupMarkerRef = useRef<maplibregl.Marker | null>(null);
  const dropoffMarkerRef = useRef<maplibregl.Marker | null>(null);
  const campusStopsMarkersRef = useRef<maplibregl.Marker[]>([]);
  const vehicleMarkersRef = useRef<Record<string, maplibregl.Marker>>({});
  const flowAnimationRef = useRef<number | null>(null);

  // Synchronized state refs for map event handlers
  const pickupStopRef = useRef(pickupStop);
  pickupStopRef.current = pickupStop;
  const dropoffStopRef = useRef(dropoffStop);
  dropoffStopRef.current = dropoffStop;
  const selectedRideRef = useRef(selectedRide);
  selectedRideRef.current = selectedRide;
  const modeRef = useRef(mode);
  modeRef.current = mode;

  // Rider priority & pass check
  const isPriorityRider = Boolean(currentUser?.is_priority);
  const hasStudentPass = Boolean((currentUser as any)?.has_pass);

  // Filtered stops for search
  const filteredStops = useMemo(() => {
    return LPU_CAMPUS_STOPS.filter(
      (s) =>
        s.id !== pickupStop.id &&
        (s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          s.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          s.area.toLowerCase().includes(searchQuery.toLowerCase()) ||
          s.code.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [pickupStop.id, searchQuery]);

  // Find nearest vehicle for currently selected ride type
  const nearestVehicle = useMemo(() => {
    const matching = fleet.filter((v) => v.type === selectedRide && v.available);
    if (matching.length === 0) return null;
    let closest = matching[0];
    let minDist = Infinity;
    matching.forEach((v) => {
      const d = haversineDistance(v.coords, pickupStop.coords);
      if (d < minDist) {
        minDist = d;
        closest = v;
      }
    });
    const eta = Math.max(1, Math.round(minDist / 250)); // ~15 km/h campus speed
    return { vehicle: closest, distanceMeters: Math.round(minDist), etaMins: eta };
  }, [fleet, selectedRide, pickupStop.coords]);

  // Shuttle availability check for this stop pair
  const isShuttleAvailable = useMemo(() => {
    if (!dropoffStop) return true;
    return Boolean(pickupStop.servesShuttle && dropoffStop.servesShuttle);
  }, [pickupStop, dropoffStop]);

  // Available carts check
  const hasFreeCarts = useMemo(() => {
    return fleet.some((v) => v.type === 'cart' && v.available);
  }, [fleet]);

  // Dynamic Camera Framing Function
  const fitCameraToRoute = useCallback(
    (coords: [number, number][], customPitch = 45) => {
      const map = mapRef.current;
      if (!map || coords.length === 0) return;

      const bounds = new maplibregl.LngLatBounds();
      coords.forEach((c) => bounds.extend(c));

      const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 900;
      const padding = isDesktop
        ? { left: 470, right: 80, top: 100, bottom: 100 }
        : {
            top: 90,
            bottom: sheetSnap === 'full' ? 520 : sheetSnap === 'half' ? 420 : 180,
            left: 40,
            right: 40,
          };

      map.fitBounds(bounds, {
        padding,
        pitch: customPitch,
        duration: 900,
        maxZoom: 18.2,
      });
    },
    [sheetSnap]
  );

  // Core Map Drawing: Snapped Road Route with White Casing & Direction Flow
  const renderRouteOnMap = useCallback(
    (map: maplibregl.Map, route: RouteResult, isDark: boolean) => {
      const routeGeoJSON: any = {
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: route.coordinates,
        },
      };

      const sourceId = 'active-route';
      const casingLayerId = 'active-route-casing';
      const coreLayerId = 'active-route-core';
      const flowLayerId = 'active-route-flow';

      // 1. Source
      if (map.getSource(sourceId)) {
        (map.getSource(sourceId) as maplibregl.GeoJSONSource).setData(routeGeoJSON);
      } else {
        map.addSource(sourceId, {
          type: 'geojson',
          data: routeGeoJSON,
        });
      }

      // 2. White casing (in light) / Black casing (in dark) - 8px wide
      if (!map.getLayer(casingLayerId)) {
        map.addLayer({
          id: casingLayerId,
          type: 'line',
          source: sourceId,
          layout: {
            'line-join': 'round',
            'line-cap': 'round',
          },
          paint: {
            'line-color': isDark ? '#000000' : '#FFFFFF',
            'line-width': 8,
            'line-opacity': route.isApproximate ? 0 : 0.95,
          },
        });
      } else {
        map.setPaintProperty(casingLayerId, 'line-color', isDark ? '#000000' : '#FFFFFF');
        map.setPaintProperty(casingLayerId, 'line-opacity', route.isApproximate ? 0 : 0.95);
      }

      // 3. Core route line - 5px wide, black (light) / white (dark) or dashed grey if approximate
      if (!map.getLayer(coreLayerId)) {
        map.addLayer({
          id: coreLayerId,
          type: 'line',
          source: sourceId,
          layout: {
            'line-join': 'round',
            'line-cap': 'round',
          },
          paint: {
            'line-color': route.isApproximate
              ? isDark
                ? '#A6A6A6'
                : '#757575'
              : isDark
              ? '#FFFFFF'
              : '#000000',
            'line-width': route.isApproximate ? 3.5 : 5,
            'line-dasharray': route.isApproximate ? [2, 2] : [1, 0],
          },
        });
      } else {
        map.setPaintProperty(
          coreLayerId,
          'line-color',
          route.isApproximate ? (isDark ? '#A6A6A6' : '#757575') : isDark ? '#FFFFFF' : '#000000'
        );
        map.setPaintProperty(coreLayerId, 'line-width', route.isApproximate ? 3.5 : 5);
        map.setPaintProperty(coreLayerId, 'line-dasharray', route.isApproximate ? [2, 2] : [1, 0]);
      }

      // 4. Direction Flow animation layer
      if (!map.getLayer(flowLayerId)) {
        map.addLayer({
          id: flowLayerId,
          type: 'line',
          source: sourceId,
          layout: {
            'line-join': 'round',
            'line-cap': 'round',
          },
          paint: {
            'line-color': isDark ? '#000000' : '#FFFFFF',
            'line-width': 2,
            'line-opacity': route.isApproximate ? 0 : 0.85,
            'line-dasharray': [0, 4, 3],
          },
        });
      } else {
        map.setPaintProperty(flowLayerId, 'line-color', isDark ? '#000000' : '#FFFFFF');
        map.setPaintProperty(flowLayerId, 'line-opacity', route.isApproximate ? 0 : 0.85);
      }

      // Start cyclical direction flow animation
      if (flowAnimationRef.current) cancelAnimationFrame(flowAnimationRef.current);
      let stepIndex = 0;
      const animateFlow = () => {
        if (!mapRef.current || !mapRef.current.getLayer(flowLayerId)) return;
        stepIndex = (stepIndex + 1) % 16;
        const phase = (stepIndex / 16) * 7;
        try {
          mapRef.current.setPaintProperty(flowLayerId, 'line-dasharray', [phase, 4, 3]);
        } catch {}
        flowAnimationRef.current = requestAnimationFrame(animateFlow);
      };

      if (!route.isApproximate) {
        flowAnimationRef.current = requestAnimationFrame(animateFlow);
      }
    },
    []
  );

  // Fetch road-snapped route & update map
  const updateRoute = useCallback(
    async (pickup: CampusStop, dropoff: CampusStop) => {
      setIsRouting(true);
      try {
        const route = await calculateRoute(pickup.coords, dropoff.coords);
        setRouteInfo(route);

        const map = mapRef.current;
        if (map) {
          renderRouteOnMap(map, route, modeRef.current === 'dark');
          fitCameraToRoute(route.coordinates);
          // Highlight destination building
          setHighlightedDestinationBuilding(map, dropoff.buildingName, modeRef.current);
        }
      } catch (err) {
        console.warn('Route calculation error:', err);
      } finally {
        setIsRouting(false);
      }
    },
    [fitCameraToRoute, renderRouteOnMap]
  );

  // Re-fit camera when ride option changes
  useEffect(() => {
    if (routeInfo && routeInfo.coordinates.length > 0 && mapRef.current) {
      fitCameraToRoute(routeInfo.coordinates);
    }
  }, [selectedRide, fitCameraToRoute, routeInfo]);

  // Update building highlight if dropoff or theme changes
  useEffect(() => {
    if (mapRef.current) {
      setHighlightedDestinationBuilding(mapRef.current, dropoffStop?.buildingName, mode);
    }
  }, [dropoffStop, mode]);

  // 1. Initialize MapLibre Map with OpenFreeMap & setup 3D Buildings
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapRef.current) return;

    const isDark = mode === 'dark';
    const styleDef = getMapStyle(mapProvider, mode);

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: styleDef,
      center: pickupStop.coords,
      zoom: CAMPUS_CONFIG.defaultZoom,
      pitch: CAMPUS_CONFIG.defaultPitch,
      bearing: CAMPUS_CONFIG.defaultBearing,
      maxBounds: CAMPUS_CONFIG.bounds,
      minZoom: CAMPUS_CONFIG.minZoom,
      maxZoom: CAMPUS_CONFIG.maxZoom,
      attributionControl: false,
      antialias: true,
    });

    mapRef.current = map;
    if (typeof window !== 'undefined') {
      (window as any).mapInstance = map;
      (window as any).LPU_CAMPUS_STOPS = LPU_CAMPUS_STOPS;
      (window as any).calculateRoute = calculateRoute;
    }

    // Attribution
    map.addControl(
      new maplibregl.AttributionControl({
        compact: true,
        customAttribution:
          MAP_CONFIG.providers[mapProvider]?.attribution ||
          MAP_CONFIG.providers.openfreemap.attribution,
      }),
      'bottom-right'
    );

    // Fallback error chain
    let fallbackTriggered = false;
    map.on('error', (e) => {
      const errStr = String(e?.error?.message || e?.message || '');
      if (
        !fallbackTriggered &&
        (errStr.includes('404') ||
          errStr.includes('Failed to fetch') ||
          errStr.includes('NetworkError') ||
          errStr.includes('Error loading style'))
      ) {
        if (mapProvider === 'openfreemap') {
          fallbackTriggered = true;
          setMapProvider('osm');
        } else if (mapProvider === 'osm') {
          fallbackTriggered = true;
          setMapProvider('pmtiles');
        } else {
          setMapError(true);
        }
      }
    });

    // Map Load: 3D Buildings, Filter Clutter, Campus Stop Markers, Draggable Pickup Pin
    map.on('load', async () => {
      setMapError(false);
      try {
        await setupCampus3DBuildings(map, mode, dropoffStopRef.current?.buildingName);
        filterCampusPOIs(map);
      } catch (err) {
        console.warn('Campus 3D setup error:', err);
      }

      // Add Campus Identity Stop Markers
      campusStopsMarkersRef.current.forEach((m) => m.remove());
      campusStopsMarkersRef.current = [];

      LPU_CAMPUS_STOPS.forEach((stop) => {
        const stopEl = document.createElement('div');
        stopEl.className = 'flex flex-col items-center group cursor-pointer';
        stopEl.innerHTML = `
          <div class="px-1.5 py-0.5 mb-0.5 rounded bg-white/95 dark:bg-black/95 text-black dark:text-white text-[10px] font-bold border border-[#E2E2E2] dark:border-[#333333] shadow-sm whitespace-nowrap opacity-85 group-hover:opacity-100 transition-opacity">
            ${stop.name}
          </div>
          <div class="w-3.5 h-3.5 rounded-full bg-white dark:bg-black border-2 border-black dark:border-white shadow-md flex items-center justify-center">
            <div class="w-1.5 h-1.5 rounded-full bg-black dark:bg-white"></div>
          </div>
        `;

        stopEl.addEventListener('click', (e) => {
          e.stopPropagation();
          handleSelectDropoff(stop);
        });

        const stopMarker = new maplibregl.Marker({ element: stopEl })
          .setLngLat(stop.coords)
          .addTo(map);

        campusStopsMarkersRef.current.push(stopMarker);
      });

      // Add Draggable Pickup Pin (White circle, black ring with label)
      const pickupEl = document.createElement('div');
      pickupEl.className = 'flex flex-col items-center cursor-grab active:cursor-grabbing';
      pickupEl.innerHTML = `
        <div class="px-2 py-0.5 mb-1 bg-black text-white dark:bg-white dark:text-black text-[11px] font-bold rounded shadow-md whitespace-nowrap border border-white/20">
          Pickup Pin
        </div>
        <div class="w-7 h-7 rounded-full bg-white border-[3px] border-black shadow-2xl flex items-center justify-center">
          <div class="w-2.5 h-2.5 rounded-full bg-black"></div>
        </div>
      `;

      const pMarker = new maplibregl.Marker({ element: pickupEl, draggable: true })
        .setLngLat(pickupStopRef.current.coords)
        .addTo(map);

      // On dragend: snap to nearest campus road or stop
      pMarker.on('dragend', async () => {
        const lngLat = pMarker.getLngLat();
        const snapped = await snapToNearestRoad([lngLat.lng, lngLat.lat]);
        pMarker.setLngLat(snapped);

        // Find nearest named stop
        let closest = LPU_CAMPUS_STOPS[0];
        let minDist = Infinity;
        LPU_CAMPUS_STOPS.forEach((s) => {
          const d = haversineDistance(snapped, s.coords);
          if (d < minDist) {
            minDist = d;
            closest = s;
          }
        });

        const updatedPickup: CampusStop = {
          ...closest,
          coords: snapped,
        };

        setPickupStop(updatedPickup);

        if (dropoffStopRef.current) {
          updateRoute(updatedPickup, dropoffStopRef.current);
        }
      });

      pickupMarkerRef.current = pMarker;

      // Add Dropoff Pin if already selected
      if (dropoffStopRef.current) {
        if (dropoffMarkerRef.current) dropoffMarkerRef.current.remove();
        const dropEl = document.createElement('div');
        dropEl.className = 'flex flex-col items-center pointer-events-none';
        dropEl.innerHTML = `
          <div class="px-2 py-0.5 mb-1 bg-black text-white dark:bg-white dark:text-black text-[11px] font-bold rounded shadow-md whitespace-nowrap border border-white/20">
            Dropoff: ${dropoffStopRef.current.name}
          </div>
          <div class="w-6 h-6 bg-black dark:bg-white text-white dark:text-black flex items-center justify-center shadow-2xl border-2 border-white dark:border-black">
            <div class="w-2 h-2 bg-white dark:bg-black"></div>
          </div>
        `;
        dropoffMarkerRef.current = new maplibregl.Marker({ element: dropEl })
          .setLngLat(dropoffStopRef.current.coords)
          .addTo(map);

        updateRoute(pickupStopRef.current, dropoffStopRef.current);
      }
    });

    return () => {
      if (flowAnimationRef.current) cancelAnimationFrame(flowAnimationRef.current);
      campusStopsMarkersRef.current.forEach((m) => m.remove());
      Object.values(vehicleMarkersRef.current).forEach((m) => m.remove());
      map.remove();
      mapRef.current = null;
    };
  }, [mode, mapProvider, updateRoute]);

  // 2. Render Live Fleet Vehicles on Map
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    fleet.forEach((v) => {
      const isSelectedType = v.type === selectedRide;
      const isNearest = nearestVehicle?.vehicle.id === v.id;

      if (!vehicleMarkersRef.current[v.id]) {
        const el = document.createElement('div');
        el.className = 'transition-transform duration-500 ease-out flex flex-col items-center';

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat(v.coords)
          .addTo(map);

        vehicleMarkersRef.current[v.id] = marker;
      }

      const marker = vehicleMarkersRef.current[v.id];
      marker.setLngLat(v.coords);

      const el = marker.getElement();
      el.innerHTML = `
        ${
          isNearest
            ? `<div class="px-1.5 py-0.5 mb-0.5 rounded-full bg-[#276EF1] text-white text-[10px] font-extrabold shadow-md whitespace-nowrap animate-bounce">
                ${nearestVehicle.etaMins}m away
               </div>`
            : ''
        }
        <div class="w-8 h-8 rounded-full ${
          isNearest
            ? 'bg-[#276EF1] text-white ring-2 ring-white dark:ring-black'
            : isSelectedType
            ? 'bg-black text-white dark:bg-white dark:text-black ring-1 ring-white/50'
            : 'bg-[#5E5E5E] text-white opacity-60'
        } shadow-lg flex items-center justify-center">
          ${
            v.type === 'shuttle'
              ? `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.5 2.8C2.1 10.9 2 11.2 2 11.5V16c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>`
              : v.type === 'cart'
              ? `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`
              : `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.5 2.8C2.1 10.9 2 11.2 2 11.5V16c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/></svg>`
          }
        </div>
      `;
    });
  }, [fleet, selectedRide, nearestVehicle]);

  // Periodic Micro-movement of Live Fleet
  useEffect(() => {
    const timer = setInterval(() => {
      setFleet((prev) =>
        prev.map((v) => {
          // Subtle movement loop
          const deltaLng = (Math.random() - 0.5) * 0.00015;
          const deltaLat = (Math.random() - 0.5) * 0.00015;
          return {
            ...v,
            coords: [v.coords[0] + deltaLng, v.coords[1] + deltaLat],
          };
        })
      );
    }, 3500);

    return () => clearInterval(timer);
  }, []);

  // 3. Handle Dropoff Selection
  const handleSelectDropoff = (stop: CampusStop) => {
    setDropoffStop(stop);
    setStep('options');

    const map = mapRef.current;
    if (!map) return;

    // Drop Pin (Black square with label)
    if (dropoffMarkerRef.current) dropoffMarkerRef.current.remove();

    const dropEl = document.createElement('div');
    dropEl.className = 'flex flex-col items-center pointer-events-none';
    dropEl.innerHTML = `
      <div class="px-2 py-0.5 mb-1 bg-black text-white dark:bg-white dark:text-black text-[11px] font-bold rounded shadow-md whitespace-nowrap border border-white/20">
        Dropoff: ${stop.name}
      </div>
      <div class="w-6 h-6 bg-black dark:bg-white text-white dark:text-black flex items-center justify-center shadow-2xl border-2 border-white dark:border-black">
        <div class="w-2 h-2 bg-white dark:bg-black"></div>
      </div>
    `;

    dropoffMarkerRef.current = new maplibregl.Marker({ element: dropEl })
      .setLngLat(stop.coords)
      .addTo(map);

    // Compute and draw road-snapped route
    updateRoute(pickupStop, stop);
  };

  // 4. Confirm Ride -> Finding -> Assigned
  const handleConfirmRide = () => {
    setStep('finding');

    // Simulate dispatch finding
    setTimeout(() => {
      const chosen = nearestVehicle?.vehicle || fleet.find((v) => v.type === selectedRide) || fleet[0];
      setAssignedVehicle(chosen);
      setDriverEtaMins(nearestVehicle?.etaMins || 2);
      setStep('assigned');
    }, 2000);
  };

  // Render Ride Options Panel Content
  const renderRideOptionsList = () => {
    // 1. Shuttle
    const shuttleEta = '4 min';
    const shuttleTrip = routeInfo ? routeInfo.formattedDuration : '6 min';

    // 2. Golf Cart (Priority vs Campus)
    const cartEta = nearestVehicle && selectedRide === 'cart' ? `${nearestVehicle.etaMins} min` : '2 min';
    const cartTrip = routeInfo ? routeInfo.formattedDuration : '5 min';

    // 3. E-Rickshaw
    const rickshawEta = '3 min';
    const rickshawTrip = routeInfo ? routeInfo.formattedDuration : '5 min';

    return (
      <div className="space-y-2.5">
        {/* 1. Shuttle Option */}
        <div
          onClick={() => isShuttleAvailable && setSelectedRide('shuttle')}
          className={`p-3.5 rounded-[12px] border transition-all ${
            !isShuttleAvailable
              ? 'opacity-40 border-[#E2E2E2] dark:border-[#333333] cursor-not-allowed bg-transparent'
              : selectedRide === 'shuttle'
              ? 'border-black dark:border-white bg-[#F3F3F3] dark:bg-[#2A2A2A] shadow-sm'
              : 'border-[#E2E2E2] dark:border-[#333333] hover:bg-[#F3F3F3] dark:hover:bg-[#2A2A2A] cursor-pointer'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-full bg-[#E2E2E2] dark:bg-[#333333] flex items-center justify-center text-black dark:text-white shrink-0">
                <Bus className="w-5 h-5 stroke-[2]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-black dark:text-white">Campus Shuttle</span>
                  {isShuttleAvailable ? (
                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-[#05A357]/15 text-[#05A357]">
                      Low crowd
                    </span>
                  ) : null}
                </div>
                <div className="text-xs text-[#5E5E5E] dark:text-[#A6A6A6]">
                  {isShuttleAvailable ? (
                    `${shuttleEta} away · ${shuttleTrip} trip · 28 seats`
                  ) : (
                    <span className="text-[#E11900] dark:text-[#FF6B6B]">
                      Shuttle does not serve this pair
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="text-right">
              <span className="font-bold text-sm text-black dark:text-white">Free</span>
              <span className="block text-[11px] text-[#5E5E5E] dark:text-[#A6A6A6]">
                {hasStudentPass ? 'Student Pass' : 'Campus Transit'}
              </span>
            </div>
          </div>
        </div>

        {/* 2. Golf Cart Option (Gated Priority vs Campus Golf Cart) */}
        <div
          onClick={() => hasFreeCarts && setSelectedRide('cart')}
          className={`p-3.5 rounded-[12px] border transition-all ${
            !hasFreeCarts
              ? 'opacity-40 border-[#E2E2E2] dark:border-[#333333] cursor-not-allowed'
              : selectedRide === 'cart'
              ? 'border-black dark:border-white bg-[#F3F3F3] dark:bg-[#2A2A2A] shadow-sm'
              : 'border-[#E2E2E2] dark:border-[#333333] hover:bg-[#F3F3F3] dark:hover:bg-[#2A2A2A] cursor-pointer'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-full bg-[#E2E2E2] dark:bg-[#333333] flex items-center justify-center text-black dark:text-white shrink-0">
                <Zap className="w-5 h-5 stroke-[2]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-black dark:text-white">
                    {isPriorityRider ? 'Priority Golf Cart' : 'Campus Golf Cart'}
                  </span>
                  {isPriorityRider && (
                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-black dark:bg-white text-white dark:text-black">
                      Priority Approved
                    </span>
                  )}
                </div>
                <div className="text-xs text-[#5E5E5E] dark:text-[#A6A6A6]">
                  {hasFreeCarts ? (
                    `${cartEta} away · ${cartTrip} trip · 4 seats`
                  ) : (
                    <span className="text-[#E11900] dark:text-[#FF6B6B]">
                      No carts currently available
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="text-right">
              <span className="font-bold text-sm text-black dark:text-white">
                {isPriorityRider ? 'Free' : '₹10'}
              </span>
              <span className="block text-[11px] text-[#5E5E5E] dark:text-[#A6A6A6]">
                {isPriorityRider
                  ? 'Medical Flag'
                  : hasStudentPass
                  ? 'Student Pass'
                  : 'Standard Fare'}
              </span>
            </div>
          </div>
        </div>

        {/* 3. E-Rickshaw Option */}
        <div
          onClick={() => setSelectedRide('rickshaw')}
          className={`p-3.5 rounded-[12px] border transition-all ${
            selectedRide === 'rickshaw'
              ? 'border-black dark:border-white bg-[#F3F3F3] dark:bg-[#2A2A2A] shadow-sm'
              : 'border-[#E2E2E2] dark:border-[#333333] hover:bg-[#F3F3F3] dark:hover:bg-[#2A2A2A] cursor-pointer'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-full bg-[#E2E2E2] dark:bg-[#333333] flex items-center justify-center text-black dark:text-white shrink-0">
                <Car className="w-5 h-5 stroke-[2]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-black dark:text-white">
                    Campus E-Rickshaw
                  </span>
                </div>
                <div className="text-xs text-[#5E5E5E] dark:text-[#A6A6A6]">
                  {`${rickshawEta} away · ${rickshawTrip} trip · 3 seats`}
                </div>
              </div>
            </div>
            <div className="text-right">
              <span className="font-bold text-sm text-black dark:text-white">₹15</span>
              <span className="block text-[11px] text-[#5E5E5E] dark:text-[#A6A6A6]">
                Flat Tariff
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="relative w-full h-screen overflow-hidden bg-white dark:bg-black font-sans flex flex-col lg:flex-row">
      {/* ============================================================== */}
      {/* DESKTOP SIDE PANEL (Fixed 420px width for screens >= 900px) */}
      {/* ============================================================== */}
      <aside className="hidden lg:flex lg:w-[420px] lg:h-full lg:flex-col lg:justify-between border-r border-[#E2E2E2] dark:border-[#333333] bg-white dark:bg-[#1C1C1C] z-30 shadow-2xl relative overflow-hidden">
        {/* Top Header */}
        <div className="p-5 border-b border-[#E2E2E2] dark:border-[#333333] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={step === 'search' ? onBack : () => setStep('search')}
              className="w-10 h-10 rounded-full bg-[#F3F3F3] dark:bg-[#2A2A2A] text-black dark:text-white flex items-center justify-center hover:bg-[#E2E2E2] dark:hover:bg-[#333333] transition-colors"
              aria-label="Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="font-black text-xl tracking-tight text-black dark:text-white">UniCart</h1>
              <span className="text-[11px] font-semibold text-[#5E5E5E] dark:text-[#A6A6A6] uppercase tracking-wider">
                LPU Transit System
              </span>
            </div>
          </div>

          <button
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className="w-10 h-10 rounded-full bg-[#F3F3F3] dark:bg-[#2A2A2A] text-black dark:text-white flex items-center justify-center hover:bg-[#E2E2E2] dark:hover:bg-[#333333] transition-colors"
          >
            {mode === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>

        {/* Panel Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Pickup and Destination Inputs */}
          <div className="space-y-2.5 bg-[#F3F3F3] dark:bg-[#2A2A2A] p-3.5 rounded-[12px]">
            {/* Pickup Location */}
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-black dark:bg-white shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-[#5E5E5E] dark:text-[#A6A6A6]">
                  Pickup &middot; Drag pin on map
                </span>
                <span className="font-semibold text-sm text-black dark:text-white truncate block">
                  {pickupStop.name}
                </span>
              </div>
              <Navigation className="w-4 h-4 text-[#276EF1] shrink-0" />
            </div>

            <div className="border-t border-[#E2E2E2] dark:border-[#333333] my-1" />

            {/* Destination Input */}
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 bg-black dark:bg-white shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-[#5E5E5E] dark:text-[#A6A6A6]">
                  Destination
                </span>
                <input
                  type="text"
                  placeholder="Where to on campus?"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-transparent text-sm font-semibold text-black dark:text-white placeholder-[#5E5E5E] dark:placeholder-[#A6A6A6] outline-none"
                />
              </div>
              {searchQuery ? (
                <button onClick={() => setSearchQuery('')}>
                  <X className="w-4 h-4 text-[#5E5E5E]" />
                </button>
              ) : (
                <Search className="w-4 h-4 text-[#5E5E5E] shrink-0" />
              )}
            </div>
          </div>

          {/* If step === 'search' or user is searching: Show Destinations */}
          {step === 'search' && (
            <div className="space-y-1.5 pt-2">
              <div className="text-[11px] font-bold text-[#5E5E5E] dark:text-[#A6A6A6] uppercase tracking-wider px-1">
                Campus Stops & Landmarks
              </div>
              <div className="divide-y divide-[#E2E2E2] dark:divide-[#333333] max-h-[380px] overflow-y-auto pr-1">
                {filteredStops.map((stop) => (
                  <button
                    key={stop.id}
                    onClick={() => handleSelectDropoff(stop)}
                    className="w-full py-2.5 px-2 flex items-center justify-between text-left hover:bg-[#F3F3F3] dark:hover:bg-[#2A2A2A] rounded-[8px] transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-[#E2E2E2] dark:bg-[#333333] flex items-center justify-center text-black dark:text-white shrink-0">
                        <MapPin className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-sm text-black dark:text-white truncate">
                          {stop.name}
                        </div>
                        <div className="text-xs text-[#5E5E5E] dark:text-[#A6A6A6] truncate">
                          {stop.area} &middot; {stop.code}
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-[#5E5E5E] shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* If step === 'options': Show Route Summary & Ride Pickers */}
          {step === 'options' && (
            <div className="space-y-4 pt-1">
              {/* Route distance and duration header */}
              <div className="flex items-center justify-between pb-2 border-b border-[#E2E2E2] dark:border-[#333333]">
                <div>
                  <h2 className="font-bold text-base text-black dark:text-white">Choose a ride</h2>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {isRouting ? (
                      <span className="text-xs text-[#5E5E5E] animate-pulse">Snapping route...</span>
                    ) : routeInfo ? (
                      <span className="text-xs font-semibold text-black dark:text-white">
                        {routeInfo.formattedDistance}, {routeInfo.formattedDuration}
                      </span>
                    ) : null}

                    {routeInfo?.isApproximate && (
                      <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center gap-1">
                        <Info className="w-3 h-3" />
                        Approximate route
                      </span>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => setStep('search')}
                  className="text-xs font-semibold text-[#276EF1] hover:underline"
                >
                  Change
                </button>
              </div>

              {/* Ride rows */}
              {renderRideOptionsList()}
            </div>
          )}

          {/* If step === 'finding': Animated Radar */}
          {step === 'finding' && (
            <div className="py-12 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-black dark:bg-white text-white dark:text-black mx-auto flex items-center justify-center animate-pulse shadow-xl">
                {selectedRide === 'shuttle' ? (
                  <Bus className="w-8 h-8" />
                ) : selectedRide === 'cart' ? (
                  <Zap className="w-8 h-8" />
                ) : (
                  <Car className="w-8 h-8" />
                )}
              </div>
              <h3 className="font-bold text-lg text-black dark:text-white">
                Finding your campus ride
              </h3>
              <p className="text-xs text-[#5E5E5E] dark:text-[#A6A6A6] max-w-xs mx-auto">
                Connecting with nearest active {selectedRide} near {pickupStop.name}...
              </p>
            </div>
          )}

          {/* If step === 'assigned': Vehicle Card */}
          {step === 'assigned' && (
            <div className="space-y-4 pt-1">
              <div className="p-4 rounded-[12px] bg-[#F3F3F3] dark:bg-[#2A2A2A] space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-extrabold text-lg text-black dark:text-white">
                      {driverEtaMins > 0 ? `Arriving in ${driverEtaMins} mins` : 'Vehicle has arrived!'}
                    </h3>
                    <p className="text-xs text-[#05A357] font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>En route to {pickupStop.name}</span>
                    </p>
                  </div>
                  <div className="w-11 h-11 rounded-full bg-black dark:bg-white text-white dark:text-black flex items-center justify-center font-bold">
                    {assignedVehicle.driverName[0]}
                  </div>
                </div>

                <div className="border-t border-[#E2E2E2] dark:border-[#333333] pt-3 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-sm text-black dark:text-white">
                      {assignedVehicle.driverName}
                    </div>
                    <div className="text-xs text-[#5E5E5E] dark:text-[#A6A6A6]">
                      {assignedVehicle.rating} ★ &middot; {assignedVehicle.trips}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono font-black text-sm text-black dark:text-white">
                      {assignedVehicle.plate}
                    </div>
                    <div className="text-[11px] text-[#5E5E5E] dark:text-[#A6A6A6] capitalize">
                      Campus {assignedVehicle.type}
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons: Call, Share, Cancel */}
              <div className="grid grid-cols-3 gap-2">
                <a
                  href={`tel:${assignedVehicle.phone}`}
                  className="uber-btn-secondary h-11 min-h-[44px] text-xs font-bold"
                >
                  <Phone className="w-4 h-4 mr-1 text-[#05A357]" />
                  <span>Call</span>
                </a>
                <button
                  onClick={() => alert('Live trip tracking link copied to clipboard!')}
                  className="uber-btn-secondary h-11 min-h-[44px] text-xs font-bold"
                >
                  <Share2 className="w-4 h-4 mr-1 text-[#276EF1]" />
                  <span>Share</span>
                </button>
                <button
                  onClick={() => {
                    if (confirm('Cancel this campus ride request?')) {
                      setStep('search');
                    }
                  }}
                  className="uber-btn-secondary h-11 min-h-[44px] text-xs font-bold text-[#E11900] hover:bg-red-50 dark:hover:bg-red-950/30"
                >
                  <X className="w-4 h-4 mr-1" />
                  <span>Cancel</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Sticky Confirm Button at Bottom of Desktop Panel */}
        {step === 'options' && (
          <div className="p-4 border-t border-[#E2E2E2] dark:border-[#333333] bg-white dark:bg-[#1C1C1C] sticky bottom-0">
            <button
              onClick={handleConfirmRide}
              disabled={selectedRide === 'shuttle' && !isShuttleAvailable}
              className="uber-btn-primary w-full disabled:opacity-50"
            >
              <span>
                Confirm {selectedRide === 'shuttle' ? 'Shuttle' : selectedRide === 'cart' ? 'Golf Cart' : 'E-Rickshaw'}
              </span>
            </button>
          </div>
        )}
      </aside>

      {/* ============================================================== */}
      {/* MAP CONTAINER (Fills rest of screen on desktop, full on mobile) */}
      {/* ============================================================== */}
      <main className="relative flex-1 h-full w-full bg-[#F3F3F3] dark:bg-[#141414]">
        {/* Real MapLibre Canvas */}
        <div ref={mapContainerRef} className="absolute inset-0 w-full h-full z-0" />

        {/* Mobile Floating Top Bar (Back button, Theme Toggle) */}
        <div className="lg:hidden absolute top-4 left-4 right-4 z-20 flex items-center justify-between pointer-events-none">
          <button
            onClick={step === 'search' ? onBack : () => setStep('search')}
            className="w-11 h-11 rounded-full bg-white dark:bg-black text-black dark:text-white flex items-center justify-center shadow-md border border-[#E2E2E2] dark:border-[#333333] pointer-events-auto active:scale-95"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5 stroke-[2.5]" />
          </button>

          <button
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className="w-10 h-10 rounded-full bg-white dark:bg-black text-black dark:text-white flex items-center justify-center shadow-md border border-[#E2E2E2] dark:border-[#333333] pointer-events-auto"
          >
            {mode === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>

        {/* Approximate Route Banner if Routing Failed */}
        {routeInfo?.isApproximate && (
          <div className="absolute top-18 lg:top-4 left-4 right-4 lg:left-6 lg:right-auto z-20 max-w-sm flex items-center gap-2 px-3.5 py-2 rounded-full bg-white/95 dark:bg-[#1C1C1C]/95 text-black dark:text-white border border-[#E2E2E2] dark:border-[#333333] shadow-lg text-xs font-semibold backdrop-blur-sm">
            <Info className="w-4 h-4 text-amber-500 shrink-0" />
            <span>Approximate route (campus roads snapping active)</span>
          </div>
        )}

        {/* Map Error Banner */}
        {mapError && (
          <div className="absolute top-20 left-4 right-4 max-w-md mx-auto z-30 flex items-center gap-2.5 px-4 py-2.5 bg-white dark:bg-[#1C1C1C] text-black dark:text-white rounded-full shadow-lg border border-[#E2E2E2] dark:border-[#333333] text-xs font-semibold">
            <AlertCircle className="w-4 h-4 text-[#E11900] shrink-0" />
            <span>Basemap offline &middot; Operating with local campus route graph</span>
          </div>
        )}

        {/* ============================================================== */}
        {/* MOBILE BOTTOM SHEET (Screens < 900px) */}
        {/* ============================================================== */}
        <div className="lg:hidden">
          {/* Step 1 Search Floating Card on Mobile */}
          <AnimatePresence>
            {step === 'search' && (
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 30 }}
                className="absolute bottom-0 left-0 right-0 z-30 bg-white dark:bg-[#1C1C1C] rounded-t-[16px] p-5 shadow-2xl border-t border-[#E2E2E2] dark:border-[#333333] max-h-[82vh] overflow-y-auto"
              >
                <div className="w-12 h-1.5 rounded-full bg-[#E2E2E2] dark:bg-[#333333] mx-auto mb-3" />

                <div className="space-y-3">
                  <div className="flex items-center gap-3 px-3.5 py-2.5 rounded-[8px] bg-[#F3F3F3] dark:bg-[#2A2A2A]">
                    <div className="w-2.5 h-2.5 rounded-full bg-black dark:bg-white" />
                    <div className="flex-1">
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-[#5E5E5E] dark:text-[#A6A6A6]">
                        Pickup Location
                      </span>
                      <span className="font-semibold text-sm text-black dark:text-white truncate block">
                        {pickupStop.name}
                      </span>
                    </div>
                    <Navigation className="w-4 h-4 text-[#276EF1]" />
                  </div>

                  <div className="flex items-center gap-3 px-3.5 py-2.5 rounded-[8px] bg-[#F3F3F3] dark:bg-[#2A2A2A] border-2 border-transparent focus-within:border-black dark:focus-within:border-white">
                    <div className="w-2.5 h-2.5 bg-black dark:bg-white" />
                    <input
                      type="text"
                      placeholder="Where to on campus?"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-transparent text-sm font-semibold text-black dark:text-white placeholder-[#5E5E5E] dark:placeholder-[#A6A6A6] outline-none"
                    />
                    {searchQuery ? (
                      <button onClick={() => setSearchQuery('')}>
                        <X className="w-4 h-4 text-[#5E5E5E]" />
                      </button>
                    ) : (
                      <Search className="w-4 h-4 text-[#5E5E5E]" />
                    )}
                  </div>

                  <div className="pt-2 divide-y divide-[#E2E2E2] dark:divide-[#333333] max-h-60 overflow-y-auto">
                    <div className="text-[11px] font-bold text-[#5E5E5E] dark:text-[#A6A6A6] uppercase tracking-wider pb-1.5 px-1">
                      Campus Destinations
                    </div>
                    {filteredStops.map((stop) => (
                      <button
                        key={stop.id}
                        onClick={() => handleSelectDropoff(stop)}
                        className="w-full py-2.5 px-1 flex items-center justify-between text-left hover:bg-[#F3F3F3] dark:hover:bg-[#2A2A2A] rounded-[8px] transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-[#F3F3F3] dark:bg-[#2A2A2A] flex items-center justify-center text-[#5E5E5E] dark:text-[#A6A6A6]">
                            <MapPin className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="font-semibold text-sm text-black dark:text-white">
                              {stop.name}
                            </div>
                            <div className="text-xs text-[#5E5E5E] dark:text-[#A6A6A6]">
                              {stop.area}
                            </div>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-[#5E5E5E]" />
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Step 2 Options Bottom Sheet with Snap Points on Mobile */}
          <AnimatePresence>
            {step === 'options' && (
              <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 26, stiffness: 220 }}
                className={`absolute bottom-0 left-0 right-0 z-30 bg-white dark:bg-[#1C1C1C] rounded-t-[16px] shadow-2xl border-t border-[#E2E2E2] dark:border-[#333333] flex flex-col ${
                  sheetSnap === 'full'
                    ? 'h-[85vh]'
                    : sheetSnap === 'half'
                    ? 'h-[430px]'
                    : 'h-[160px]'
                } transition-all duration-300`}
              >
                {/* Drag Handle & Snap Toggles */}
                <div
                  onClick={() =>
                    setSheetSnap(sheetSnap === 'half' ? 'full' : sheetSnap === 'full' ? 'half' : 'half')
                  }
                  className="pt-3 pb-2 cursor-pointer flex flex-col items-center"
                >
                  <div className="w-12 h-1.5 rounded-full bg-[#E2E2E2] dark:bg-[#333333]" />
                </div>

                {/* Sheet Header: Distance, Duration & Destination */}
                <div className="px-5 pb-3 border-b border-[#E2E2E2] dark:border-[#333333] flex items-start justify-between">
                  <div>
                    <h2 className="font-bold text-lg text-black dark:text-white">Choose a ride</h2>
                    <div className="flex items-center gap-2 text-xs text-[#5E5E5E] dark:text-[#A6A6A6] mt-0.5">
                      <span>To {dropoffStop?.name}</span>
                      <span>&middot;</span>
                      {routeInfo && (
                        <span className="font-bold text-black dark:text-white">
                          {routeInfo.formattedDistance}, {routeInfo.formattedDuration}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() =>
                        setSheetSnap(sheetSnap === 'half' ? 'full' : 'half')
                      }
                      className="p-1 rounded-full text-[#5E5E5E]"
                      aria-label="Expand sheet"
                    >
                      {sheetSnap === 'full' ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
                    </button>
                    <button
                      onClick={() => setStep('search')}
                      className="p-1 rounded-full text-[#5E5E5E]"
                      aria-label="Close options"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Scrollable List of Ride Options */}
                <div className="flex-1 overflow-y-auto px-5 py-3">
                  {renderRideOptionsList()}
                </div>

                {/* Sticky Confirm Button */}
                <div className="p-4 border-t border-[#E2E2E2] dark:border-[#333333] bg-white dark:bg-[#1C1C1C] sticky bottom-0">
                  <button
                    onClick={handleConfirmRide}
                    disabled={selectedRide === 'shuttle' && !isShuttleAvailable}
                    className="uber-btn-primary w-full disabled:opacity-50"
                  >
                    <span>
                      Confirm {selectedRide === 'shuttle' ? 'Shuttle' : selectedRide === 'cart' ? 'Golf Cart' : 'E-Rickshaw'}
                    </span>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Step 3 Finding Sheet on Mobile */}
          <AnimatePresence>
            {step === 'finding' && (
              <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                className="absolute bottom-0 left-0 right-0 z-30 bg-white dark:bg-[#1C1C1C] rounded-t-[16px] p-6 shadow-2xl border-t border-[#E2E2E2] dark:border-[#333333] text-center space-y-4"
              >
                <div className="w-12 h-1.5 rounded-full bg-[#E2E2E2] dark:bg-[#333333] mx-auto" />
                <div className="w-16 h-16 rounded-full bg-black dark:bg-white text-white dark:text-black mx-auto flex items-center justify-center animate-pulse shadow-xl">
                  {selectedRide === 'shuttle' ? (
                    <Bus className="w-8 h-8" />
                  ) : selectedRide === 'cart' ? (
                    <Zap className="w-8 h-8" />
                  ) : (
                    <Car className="w-8 h-8" />
                  )}
                </div>
                <h2 className="font-bold text-xl text-black dark:text-white">
                  Finding your campus ride
                </h2>
                <p className="text-xs text-[#5E5E5E] dark:text-[#A6A6A6]">
                  Matching with nearest active {selectedRide} near {pickupStop.name}...
                </p>
                <button
                  onClick={() => setStep('options')}
                  className="text-xs font-semibold text-[#E11900] py-1"
                >
                  Cancel request
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Step 4 Driver Assigned Sheet on Mobile */}
          <AnimatePresence>
            {step === 'assigned' && (
              <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                className="absolute bottom-0 left-0 right-0 z-30 bg-white dark:bg-[#1C1C1C] rounded-t-[16px] p-5 shadow-2xl border-t border-[#E2E2E2] dark:border-[#333333] space-y-4"
              >
                <div className="w-12 h-1.5 rounded-full bg-[#E2E2E2] dark:bg-[#333333] mx-auto mb-1" />

                <div className="flex items-center justify-between border-b border-[#E2E2E2] dark:border-[#333333] pb-3">
                  <div>
                    <h2 className="font-extrabold text-xl text-black dark:text-white">
                      {driverEtaMins > 0 ? `Arriving in ${driverEtaMins} mins` : 'Vehicle has arrived!'}
                    </h2>
                    <p className="text-xs text-[#05A357] font-semibold flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Ride confirmed &middot; En route to {pickupStop.name}</span>
                    </p>
                  </div>
                  <div className="w-11 h-11 rounded-full bg-black dark:bg-white text-white dark:text-black flex items-center justify-center font-bold">
                    {assignedVehicle.driverName[0]}
                  </div>
                </div>

                <div className="flex items-center justify-between p-3.5 rounded-[12px] bg-[#F3F3F3] dark:bg-[#2A2A2A]">
                  <div>
                    <div className="font-bold text-sm text-black dark:text-white">
                      {assignedVehicle.driverName}
                    </div>
                    <div className="text-xs text-[#5E5E5E] dark:text-[#A6A6A6]">
                      {assignedVehicle.rating} ★ &middot; {assignedVehicle.trips}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono font-black text-sm text-black dark:text-white">
                      {assignedVehicle.plate}
                    </div>
                    <div className="text-[11px] text-[#5E5E5E] dark:text-[#A6A6A6] capitalize">
                      Campus {assignedVehicle.type}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <a
                    href={`tel:${assignedVehicle.phone}`}
                    className="uber-btn-secondary h-11 min-h-[44px] text-xs font-bold"
                  >
                    <Phone className="w-4 h-4 mr-1 text-[#05A357]" />
                    <span>Call</span>
                  </a>
                  <button
                    onClick={() => alert('Live trip link copied to clipboard!')}
                    className="uber-btn-secondary h-11 min-h-[44px] text-xs font-bold"
                  >
                    <Share2 className="w-4 h-4 mr-1 text-[#276EF1]" />
                    <span>Share</span>
                  </button>
                  <button
                    onClick={() => {
                      if (confirm('Cancel this campus ride request?')) {
                        setStep('search');
                      }
                    }}
                    className="uber-btn-secondary h-11 min-h-[44px] text-xs font-bold text-[#E11900] hover:bg-red-50 dark:hover:bg-red-950/30"
                  >
                    <X className="w-4 h-4 mr-1" />
                    <span>Cancel</span>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
