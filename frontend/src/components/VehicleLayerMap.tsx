import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import * as THREE from 'three';
import {
  VehicleFactory,
  VehicleData,
  VehicleInstance3D,
  VehicleType,
} from './vehicleFactory.ts';
import { api } from '../api/client.js';
import {
  Bus,
  Zap,
  Users,
  Navigation,
  Clock,
  Gauge,
  X,
  Layers,
  Sparkles,
  DollarSign,
  Activity
} from 'lucide-react';

// Real-world LPU Campus Coordinates
const LPU_CENTER: [number, number] = [75.7050, 31.2550]; // [lng, lat]
const LPU_BOUNDS: [[number, number], [number, number]] = [
  [75.6880, 31.2380], // South-West
  [75.7220, 31.2720], // North-East
];

// Campus Waypoints for realistic route paths
const CAMPUS_WAYPOINTS = {
  mainGate: [75.7032, 31.2512] as [number, number],
  uniMall: [75.7058, 31.2548] as [number, number],
  block32: [75.7075, 31.2575] as [number, number],
  block34: [75.7090, 31.2592] as [number, number],
  girlsHostels: [75.7020, 31.2565] as [number, number],
  boysHostels: [75.7088, 31.2530] as [number, number],
  lawBlock: [75.7042, 31.2615] as [number, number],
  sportsComplex: [75.7065, 31.2518] as [number, number],
};

// Generate 24 realistic active campus fleet vehicles streaming across LPU
function generateInitialFleet(): VehicleData[] {
  const fleet: VehicleData[] = [];

  // 1. Eight Campus Shuttles (PB-101 to PB-108)
  const shuttleRoutes = [
    { code: 'PB-101', route: 'Route 1 - Uni-Mall Loop', stops: [CAMPUS_WAYPOINTS.mainGate, CAMPUS_WAYPOINTS.uniMall, CAMPUS_WAYPOINTS.block32] },
    { code: 'PB-102', route: 'Route 1 - Uni-Mall Loop', stops: [CAMPUS_WAYPOINTS.block32, CAMPUS_WAYPOINTS.uniMall, CAMPUS_WAYPOINTS.mainGate] },
    { code: 'PB-103', route: 'Route 2 - Girls Hostel Express', stops: [CAMPUS_WAYPOINTS.girlsHostels, CAMPUS_WAYPOINTS.uniMall, CAMPUS_WAYPOINTS.block34] },
    { code: 'PB-104', route: 'Route 2 - Girls Hostel Express', stops: [CAMPUS_WAYPOINTS.block34, CAMPUS_WAYPOINTS.uniMall, CAMPUS_WAYPOINTS.girlsHostels] },
    { code: 'PB-105', route: 'Route 3 - Boys Hostel ⇄ BH32', stops: [CAMPUS_WAYPOINTS.boysHostels, CAMPUS_WAYPOINTS.uniMall, CAMPUS_WAYPOINTS.block32] },
    { code: 'PB-106', route: 'Route 3 - Boys Hostel ⇄ BH32', stops: [CAMPUS_WAYPOINTS.block32, CAMPUS_WAYPOINTS.boysHostels, CAMPUS_WAYPOINTS.sportsComplex] },
    { code: 'PB-107', route: 'Route 4 - Law & Agri Gate', stops: [CAMPUS_WAYPOINTS.mainGate, CAMPUS_WAYPOINTS.lawBlock, CAMPUS_WAYPOINTS.sportsComplex] },
    { code: 'PB-108', route: 'Route 4 - Law & Agri Gate', stops: [CAMPUS_WAYPOINTS.sportsComplex, CAMPUS_WAYPOINTS.lawBlock, CAMPUS_WAYPOINTS.mainGate] },
  ];

  shuttleRoutes.forEach((sr, i) => {
    const startCoord = sr.stops[0];
    const nextCoord = sr.stops[1];
    fleet.push({
      id: `shuttle-${i + 1}`,
      type: 'shuttle',
      code: sr.code,
      coordinates: [startCoord[0] + (Math.random() - 0.5) * 0.001, startCoord[1] + (Math.random() - 0.5) * 0.001],
      targetCoordinates: [nextCoord[0], nextCoord[1]],
      heading: 45 + i * 40,
      targetHeading: 45 + i * 40,
      speed: 5.5 + (i % 3) * 1.5,
      status: i === 2 ? 'at_stop' : 'running',
      crowd: i === 0 ? 'full' : i % 2 === 0 ? 'moderate' : 'low',
      route: sr.route,
      capacity: 28,
      driverName: ['Harpreet Singh', 'Gurvinder Singh', 'Kuldeep Kumar', 'Jaspreet Singh'][i % 4],
      currentStopName: 'Uni-Mall Central Station',
      nextStopName: 'Block 32 Academic Complex',
    });
  });

  // 2. Seven Priority Golf Carts (GC-01 to GC-07)
  for (let i = 1; i <= 7; i++) {
    const origin = [CAMPUS_WAYPOINTS.mainGate, CAMPUS_WAYPOINTS.girlsHostels, CAMPUS_WAYPOINTS.block32, CAMPUS_WAYPOINTS.sportsComplex][i % 4];
    const dest = [CAMPUS_WAYPOINTS.uniMall, CAMPUS_WAYPOINTS.block34, CAMPUS_WAYPOINTS.boysHostels][i % 3];
    fleet.push({
      id: `cart-${i}`,
      type: 'cart',
      code: `GC-0${i}`,
      coordinates: [origin[0] + (Math.random() - 0.5) * 0.0015, origin[1] + (Math.random() - 0.5) * 0.0015],
      targetCoordinates: [dest[0], dest[1]],
      heading: i * 50,
      targetHeading: i * 50,
      speed: 3.5 + (i % 2) * 1.0,
      status: i === 1 ? 'busy' : 'available',
      capacity: 4,
      driverName: ['Gurpreet Singh', 'Baljit Singh', 'Manish Sharma'][i % 3],
      currentStopName: 'Main Gate Stand',
      nextStopName: 'University Health Centre',
    });
  }

  // 3. Nine Campus E-Rickshaws (ER-01 to ER-09)
  for (let i = 1; i <= 9; i++) {
    const origin = [CAMPUS_WAYPOINTS.uniMall, CAMPUS_WAYPOINTS.boysHostels, CAMPUS_WAYPOINTS.lawBlock, CAMPUS_WAYPOINTS.mainGate][i % 4];
    const dest = [CAMPUS_WAYPOINTS.block32, CAMPUS_WAYPOINTS.girlsHostels, CAMPUS_WAYPOINTS.sportsComplex][i % 3];
    fleet.push({
      id: `rickshaw-${i}`,
      type: 'rickshaw',
      code: `ER-0${i}`,
      coordinates: [origin[0] + (Math.random() - 0.5) * 0.0015, origin[1] + (Math.random() - 0.5) * 0.0015],
      targetCoordinates: [dest[0], dest[1]],
      heading: i * 40,
      targetHeading: i * 40,
      speed: 4.2 + (i % 3) * 0.8,
      status: i % 3 === 0 ? 'busy' : 'available',
      seatsFree: (i % 4) as any,
      fare: i % 2 === 0 ? 15 : 20,
      capacity: 4,
      driverName: ['Raju Kumar', 'Sunil Yadav', 'Deepak Verma'][i % 3],
      currentStopName: 'Uni-Mall Feeder Stand',
      nextStopName: 'Boys Hostel 6 Gate',
    });
  }

  return fleet;
}

export interface VehicleLayerMapProps {
  onSelectVehicle?: (vehicle: VehicleData | null) => void;
  height?: string;
  className?: string;
}

export default function VehicleLayerMap({
  onSelectVehicle,
  height = 'h-[620px]',
  className = '',
}: VehicleLayerMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const vehiclesMapRef = useRef<Map<string, VehicleInstance3D>>(new Map());
  const fleetDataRef = useRef<VehicleData[]>(generateInitialFleet());

  // Filter state
  const [filterType, setFilterType] = useState<'all' | 'shuttle' | 'cart' | 'rickshaw'>('all');
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleData | null>(null);
  const selectedVehicleRef = useRef<VehicleData | null>(null);
  const [measuredFPS, setMeasuredFPS] = useState<number>(60);
  // Map style toggle: 'street' | 'satellite' | 'dark'
  const [mapStyleType, setMapStyleType] = useState<'street' | 'satellite' | 'dark'>('street');

  // FPS calculation references
  const fpsFrameCount = useRef(0);
  const fpsLastTime = useRef(performance.now());

  // Handle vehicle selection
  const handleSelect = (v: VehicleData | null) => {
    selectedVehicleRef.current = v;
    setSelectedVehicle(v);
    if (onSelectVehicle) onSelectVehicle(v);
  };

  // Load real active trips and carts from backend API if available
  useEffect(() => {
    const fetchLiveFleet = async () => {
      try {
        const [activeTrips, availableCarts] = await Promise.allSettled([
          api.getActiveTrips(),
          api.getAvailableCarts(),
        ]);

        if (activeTrips.status === 'fulfilled' && Array.isArray(activeTrips.value) && activeTrips.value.length > 0) {
          activeTrips.value.forEach((trip: any, idx: number) => {
            const existing = fleetDataRef.current.find(v => v.code === trip.shuttle?.vehicle_number);
            if (existing && trip.latitude && trip.longitude) {
              existing.targetCoordinates = [trip.longitude, trip.latitude];
              existing.status = trip.status === 'IN_PROGRESS' ? 'running' : 'at_stop';
              existing.crowd = trip.current_crowd_level === 'FULL' ? 'full' : trip.current_crowd_level === 'MODERATE' ? 'moderate' : 'low';
            }
          });
        }

        if (availableCarts.status === 'fulfilled' && availableCarts.value?.carts) {
          availableCarts.value.carts.forEach((cart: any) => {
            const existing = fleetDataRef.current.find(v => v.code === cart.cart_code);
            if (existing && cart.latitude && cart.longitude) {
              existing.targetCoordinates = [cart.longitude, cart.latitude];
              existing.status = cart.status === 'AVAILABLE' ? 'available' : 'busy';
            }
          });
        }
      } catch (e) {
        // Fallback to simulated waypoints
      }
    };

    fetchLiveFleet();
    const interval = setInterval(fetchLiveFleet, 4000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapRef.current) return;

    // OpenStreetMap Raster MapLibre Style (100% reliable, free, full campus layout)
    const streetStyle: maplibregl.StyleSpecification = {
      version: 8,
      sources: {
        osm: {
          type: 'raster',
          tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
          tileSize: 256,
          maxzoom: 19,
          attribution: '&copy; OpenStreetMap contributors',
        },
      },
      layers: [
        {
          id: 'osm-tiles',
          type: 'raster',
          source: 'osm',
          minzoom: 0,
          maxzoom: 22,
        },
      ],
    };

    // Satellite Imagery Style (Esri ArcGIS World Imagery)
    const satelliteStyle: maplibregl.StyleSpecification = {
      version: 8,
      sources: {
        satellite: {
          type: 'raster',
          tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
          tileSize: 256,
          maxzoom: 19,
          attribution: '&copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye',
        },
      },
      layers: [
        {
          id: 'satellite-tiles',
          type: 'raster',
          source: 'satellite',
          minzoom: 0,
          maxzoom: 22,
        },
      ],
    };

    const activeStyle = mapStyleType === 'satellite' ? satelliteStyle : streetStyle;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: activeStyle,
      center: LPU_CENTER,
      zoom: 16.8, // Optimal campus wide overview
      pitch: 52,  // 3D perspective pitch
      bearing: -20,
      minZoom: 14,
      maxZoom: 19.5,
      antialias: true,
    });

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
    mapRef.current = map;

    // Trigger resize once mounted
    setTimeout(() => {
      map.resize();
    }, 150);

    // Shared Three.js Scene, Camera, and Renderer Custom Layer
    const custom3DVehicleLayer = {
      id: '3d-vehicles-layer',
      type: 'custom' as const,
      renderingMode: '3d' as const,
      camera: new THREE.Camera(),
      scene: new THREE.Scene(),
      renderer: null as THREE.WebGLRenderer | null,
      raycaster: new THREE.Raycaster(),
      mouse: new THREE.Vector2(),

      onAdd(mapInstance: maplibregl.Map, gl: WebGLRenderingContext) {
        // Expose global handles for testing and telematics inspection
        (window as any).__campusMap = mapInstance;
        (window as any).__campusFleet = fleetDataRef.current;
        (window as any).__selectVehicle = handleSelect;
        (window as any).__THREE = THREE;
        (window as any).__maplibregl = maplibregl;

        // Shared WebGL Renderer
        this.renderer = new THREE.WebGLRenderer({
          canvas: mapInstance.getCanvas(),
          context: gl,
          antialias: true,
        });
        this.renderer.autoClear = false;

        // Shared Lighting Rig for 3D Vehicles (normalized directions)
        const ambientLight = new THREE.AmbientLight(0xffffff, 1.3);
        this.scene.add(ambientLight);

        const dirLight = new THREE.DirectionalLight(0xffffff, 1.8);
        dirLight.position.set(0, -70, 100).normalize();
        this.scene.add(dirLight);

        const dirLightFill = new THREE.DirectionalLight(0x93c5fd, 0.8);
        dirLightFill.position.set(0, 70, -100).normalize();
        this.scene.add(dirLightFill);

        // Instantiate initial 24 vehicles using unified VehicleFactory
        fleetDataRef.current.forEach((vData) => {
          const instance = VehicleFactory.createVehicle(vData);
          this.scene.add(instance.group);
          vehiclesMapRef.current.set(vData.id, instance);
        });

        // Click / Tap handler with dual-check: Proximity projection & Raycasting
        mapInstance.on('click', (e) => {
          // 1. Check screen pixel proximity to each vehicle (fastest & most touch-friendly)
          let closestVehicle: VehicleData | null = null;
          let minPixelDist = 28; // 28px click/tap tolerance radius

          fleetDataRef.current.forEach((vData) => {
            const inst = vehiclesMapRef.current.get(vData.id);
            if (!inst || !inst.group.visible) return;

            const screenPos = mapInstance.project([vData.coordinates[0], vData.coordinates[1]]);
            const dist = Math.hypot(screenPos.x - e.point.x, screenPos.y - e.point.y);
            if (dist < minPixelDist) {
              minPixelDist = dist;
              closestVehicle = vData;
            }
          });

          if (closestVehicle) {
            handleSelect(closestVehicle);
            return;
          }

          // 2. 3D Raycaster check
          const rect = mapInstance.getCanvas().getBoundingClientRect();
          this.mouse.x = (e.point.x / rect.width) * 2 - 1;
          this.mouse.y = -(e.point.y / rect.height) * 2 + 1;

          this.raycaster.setFromCamera(this.mouse, this.camera);
          const intersects = this.raycaster.intersectObjects(this.scene.children, true);

          if (intersects.length > 0) {
            let curr: THREE.Object3D | null = intersects[0].object;
            while (curr && !curr.userData?.isVehicle) {
              curr = curr.parent;
            }
            if (curr && curr.userData?.vehicleData) {
              handleSelect(curr.userData.vehicleData);
            }
          }
        });
      },

      render(gl: WebGLRenderingContext, matrixOrOptions: any) {
        if (!this.renderer || !mapRef.current) return;
        const canvas = mapRef.current.getCanvas();
        if (!canvas || canvas.width === 0 || canvas.height === 0) return;

        const currentZoom = mapRef.current.getZoom();
        const now = performance.now();
        const delta = Math.min((now - fpsLastTime.current) / 1000, 0.05);

        // Calculate Measured FPS (rolling average)
        fpsFrameCount.current++;
        if (now - fpsLastTime.current >= 500) {
          const currentFPS = Math.round((fpsFrameCount.current * 1000) / (now - fpsLastTime.current));
          setMeasuredFPS(currentFPS);
          fpsFrameCount.current = 0;
          fpsLastTime.current = now;
        }

        // MapLibre v6 passes an options object containing defaultProjectionData.mainMatrix or modelViewProjectionMatrix
        const matrixArray =
          Array.isArray(matrixOrOptions) ||
          matrixOrOptions instanceof Float64Array ||
          matrixOrOptions instanceof Float32Array
            ? matrixOrOptions
            : matrixOrOptions?.defaultProjectionData?.mainMatrix ||
              matrixOrOptions?.modelViewProjectionMatrix;

        if (!matrixArray) return;

        // Camera Matrix Sync from MapLibre
        this.camera.projectionMatrix = new THREE.Matrix4().fromArray(matrixArray);
        this.camera.projectionMatrixInverse.copy(this.camera.projectionMatrix).invert();

        // Update each vehicle: GPS interpolation, wheel animations, and Level-Of-Detail
        vehiclesMapRef.current.forEach((instance) => {
          const data = instance.data;

          // GPS Position Interpolation (smooth gliding between coordinates)
          const lerpRate = Math.min(1.0, delta * 2.5);
          data.coordinates[0] += (data.targetCoordinates[0] - data.coordinates[0]) * lerpRate;
          data.coordinates[1] += (data.targetCoordinates[1] - data.coordinates[1]) * lerpRate;

          // If reached target, assign next campus waypoint
          const distToTarget = Math.hypot(
            data.targetCoordinates[0] - data.coordinates[0],
            data.targetCoordinates[1] - data.coordinates[1]
          );
          if (distToTarget < 0.0003) {
            const nextWaypoint = Object.values(CAMPUS_WAYPOINTS)[
              Math.floor(Math.random() * Object.values(CAMPUS_WAYPOINTS).length)
            ];
            data.targetCoordinates = [nextWaypoint[0], nextWaypoint[1]];
            const angleDeg =
              (Math.atan2(
                data.targetCoordinates[1] - data.coordinates[1],
                data.targetCoordinates[0] - data.coordinates[0]
              ) *
                180) /
              Math.PI;
            data.targetHeading = (90 - angleDeg + 360) % 360;
          }

          // Heading interpolation
          data.heading += (data.targetHeading - data.heading) * Math.min(1.0, delta * 3.5);

          // Convert GPS [lng, lat] to MapLibre Mercator 3D World space
          const merc = maplibregl.MercatorCoordinate.fromLngLat(
            [data.coordinates[0], data.coordinates[1]],
            0
          );
          const meterScale = merc.meterInMercatorCoordinateUnits();

          // Adaptive visual scale so vehicles are clearly legible at campus zoom levels (15 - 19)
          const visualFactor = Math.max(2.5, Math.min(4.5, (18.5 - currentZoom) * 0.9 + 2.5));
          const finalScale = meterScale * visualFactor;
          const elevation = meterScale * 0.25;

          instance.group.position.set(merc.x, merc.y, merc.z + elevation);
          instance.group.scale.set(finalScale, finalScale, finalScale);
          // Rotate X by 90deg to align local Y (up) to MapLibre Z (up), and Z (front) to North (-Y)
          instance.group.rotation.set(Math.PI / 2, 0, -THREE.MathUtils.degToRad(data.heading));

          // Update Level-of-Detail (switch to low-poly beyond zoom 17.5, high-poly if selected or close)
          VehicleFactory.updateLOD(instance, currentZoom, selectedVehicleRef.current?.id === instance.id);

          // Animate wheels
          VehicleFactory.animateInstance(instance, data.speed, 0, delta);
        });

        this.renderer.resetState();
        this.renderer.render(this.scene, this.camera);
        mapRef.current.triggerRepaint();
      },
    };

    map.on('style.load', () => {
      if (!map.getLayer('3d-vehicles-layer')) {
        map.addLayer(custom3DVehicleLayer);
      }
    });

    return () => {
      vehiclesMapRef.current.forEach((inst) => inst.dispose());
      vehiclesMapRef.current.clear();
      map.remove();
      mapRef.current = null;
    };
  }, [mapStyleType]);

  // Update vehicle visibility based on filter chip selection
  useEffect(() => {
    vehiclesMapRef.current.forEach((inst) => {
      if (filterType === 'all') {
        inst.group.visible = true;
      } else {
        inst.group.visible = inst.type === filterType;
      }
    });
  }, [filterType]);

  const vehicleCounts = useMemo(() => {
    const list = fleetDataRef.current;
    return {
      all: list.length,
      shuttle: list.filter((v) => v.type === 'shuttle').length,
      cart: list.filter((v) => v.type === 'cart').length,
      rickshaw: list.filter((v) => v.type === 'rickshaw').length,
    };
  }, []);

  return (
    <div
      className={`relative w-full overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 ${height} ${className}`}
      style={{ minHeight: '620px' }}
    >
      {/* MapLibre Canvas Container */}
      <div
        ref={mapContainerRef}
        className="w-full h-full"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
      />

      {/* Top Floating Bar: Filter Chips & Real-time FPS Telemetry */}
      <div className="absolute top-3 left-3 right-3 z-20 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        {/* Filter Chip Row */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-900/90 border border-slate-800/90 backdrop-blur-md shadow-2xl pointer-events-auto">
          {[
            { id: 'all', label: 'All Fleet', count: vehicleCounts.all, icon: '🚍' },
            { id: 'shuttle', label: 'Shuttles', count: vehicleCounts.shuttle, icon: '🚌' },
            { id: 'cart', label: 'Golf Carts', count: vehicleCounts.cart, icon: '⚡' },
            { id: 'rickshaw', label: 'E-Rickshaws', count: vehicleCounts.rickshaw, icon: '🛺' },
          ].map((chip) => (
            <button
              key={chip.id}
              onClick={() => setFilterType(chip.id as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                filterType === chip.id
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/70'
              }`}
            >
              <span>{chip.icon}</span>
              <span>{chip.label}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${filterType === chip.id ? 'bg-blue-700 text-white' : 'bg-slate-800 text-slate-400'}`}>
                {chip.count}
              </span>
            </button>
          ))}
        </div>

        {/* FPS & Performance Telemetry Badge */}
        <div className="flex items-center gap-2 p-1.5 rounded-xl bg-slate-900/90 border border-slate-800/90 backdrop-blur-md shadow-2xl pointer-events-auto text-xs">
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-slate-950/80 border border-slate-800 font-mono">
            <span className={`w-2 h-2 rounded-full ${measuredFPS >= 55 ? 'bg-emerald-400 animate-pulse' : measuredFPS >= 30 ? 'bg-amber-400' : 'bg-rose-400'}`} />
            <span className="font-black text-white">{measuredFPS} FPS</span>
          </div>
          <span className="text-[11px] font-mono text-slate-400 hidden sm:inline">
            24 3D Vehicles &bull; LOD Active
          </span>
          <button
            onClick={() => setMapStyleType(mapStyleType === 'street' ? 'satellite' : 'street')}
            className="px-2 py-1 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors flex items-center gap-1 text-[11px] font-medium"
            title="Toggle Map Imagery"
          >
            <Layers className="w-3.5 h-3.5 text-blue-400" />
            <span className="capitalize">{mapStyleType === 'street' ? 'Satellite' : 'Street'}</span>
          </button>
        </div>
      </div>

      {/* Bottom Left: Interactive Map Legend */}
      <div className="absolute bottom-4 left-4 z-20 hidden md:block pointer-events-none">
        <div className="p-3 bg-slate-900/90 border border-slate-800/90 rounded-2xl shadow-2xl backdrop-blur-md text-[11px] space-y-1.5 pointer-events-auto max-w-xs">
          <div className="font-bold text-white flex items-center justify-between pb-1 mb-1 border-b border-slate-800">
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>LPU 3D Fleet Legend</span>
            </span>
            <span className="text-[10px] font-mono text-emerald-400">WebGL Shared</span>
          </div>

          <div className="flex items-center gap-2 text-slate-300">
            <span className="text-base">🚌</span>
            <div>
              <strong className="text-white">Mini-Bus (7.5m):</strong> 28 Seats, Timetable routes
            </div>
          </div>
          <div className="flex items-center gap-2 text-slate-300">
            <span className="text-base">⚡</span>
            <div>
              <strong className="text-white">Golf Cart (3.2m):</strong> 4-6 Seats, Priority dispatch
            </div>
          </div>
          <div className="flex items-center gap-2 text-slate-300">
            <span className="text-base">🛺</span>
            <div>
              <strong className="text-white">E-Rickshaw (2.6m):</strong> 4 Seats, ₹10-₹20 Flat tariff
            </div>
          </div>
          <div className="pt-1 border-t border-slate-800 text-[10px] text-slate-400 flex items-center gap-3">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400" /> Available/Low
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-400" /> Moderate/At Stop
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-rose-500" /> Full/Busy
            </span>
          </div>
        </div>
      </div>

      {/* Interactive Bottom Sheet (Opens on Click/Tap of any 3D Vehicle) */}
      {selectedVehicle && (
        <div className="absolute bottom-3 left-3 right-3 md:left-auto md:right-4 md:w-96 z-30 animate-in slide-in-from-bottom-5 duration-300">
          <div className="bg-slate-900/95 border border-slate-700/80 rounded-2xl p-4 shadow-2xl backdrop-blur-xl text-white space-y-3">
            {/* Header */}
            <div className="flex items-start justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl shadow-lg ${
                  selectedVehicle.type === 'shuttle'
                    ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                    : selectedVehicle.type === 'cart'
                    ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                    : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                }`}>
                  {selectedVehicle.type === 'shuttle' ? '🚌' : selectedVehicle.type === 'cart' ? '⚡' : '🛺'}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm text-white">{selectedVehicle.code}</h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-800 text-slate-300">
                      {selectedVehicle.type}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">{selectedVehicle.route || 'Campus Stand Transit'}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedVehicle(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Telematics Grid */}
            <div className="grid grid-cols-3 gap-2 bg-slate-950/70 p-2.5 rounded-xl border border-slate-800 text-xs">
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-semibold block">Live Speed</span>
                <span className="font-black text-cyan-400 font-mono">
                  {(selectedVehicle.speed * 3.6).toFixed(1)} km/h
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-semibold block">Status</span>
                <span className={`font-bold capitalize ${
                  selectedVehicle.status === 'running' || selectedVehicle.status === 'available'
                    ? 'text-emerald-400'
                    : selectedVehicle.status === 'at_stop' || selectedVehicle.status === 'busy'
                    ? 'text-amber-400'
                    : 'text-rose-400'
                }`}>
                  {selectedVehicle.status.replace('_', ' ')}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-semibold block">
                  {selectedVehicle.type === 'rickshaw' ? 'Tariff' : 'Capacity'}
                </span>
                <span className="font-bold text-white font-mono">
                  {selectedVehicle.type === 'rickshaw'
                    ? `₹${selectedVehicle.fare}`
                    : `${selectedVehicle.capacity} Pax`}
                </span>
              </div>
            </div>

            {/* Journey & Stop Info */}
            <div className="space-y-1.5 text-xs text-slate-300 bg-slate-950/40 p-2.5 rounded-xl border border-slate-800/80">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Current Station:</span>
                <span className="font-semibold text-white">{selectedVehicle.currentStopName || 'Uni-Mall'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Next Destination:</span>
                <span className="font-semibold text-white">{selectedVehicle.nextStopName || 'Block 32'}</span>
              </div>
              {selectedVehicle.driverName && (
                <div className="flex items-center justify-between pt-1 border-t border-slate-800/60">
                  <span className="text-slate-500">Assigned Driver:</span>
                  <span className="text-slate-300 font-medium">{selectedVehicle.driverName}</span>
                </div>
              )}
            </div>

            {/* Action Button */}
            <button
              onClick={() => {
                alert(`Tracking ${selectedVehicle.code} (${selectedVehicle.type.toUpperCase()}). GPS coordinate feed active.`);
              }}
              className={`w-full py-2.5 rounded-xl font-bold text-xs shadow-lg transition-all flex items-center justify-center gap-2 ${
                selectedVehicle.type === 'shuttle'
                  ? 'bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white'
                  : selectedVehicle.type === 'cart'
                  ? 'bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white'
                  : 'bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white'
              }`}
            >
              <Navigation className="w-4 h-4" />
              <span>
                {selectedVehicle.type === 'shuttle'
                  ? 'Track Shuttle & Boarding Pass'
                  : selectedVehicle.type === 'cart'
                  ? 'Book Golf Cart Ride'
                  : 'Hail E-Rickshaw at Stand'}
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
