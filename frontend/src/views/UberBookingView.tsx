import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import { sseClient } from '../api/sse';
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
  CreditCard,
  Wallet,
  Banknote,
  Star,
  Check,
  Calendar,
  AlertTriangle,
  RotateCcw,
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

// Verified LPU Campus Stops with Exact OSM Coordinates and Database IDs
export interface CampusStop {
  id: string;
  backendId: number;
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
    backendId: 1,
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
    backendId: 2,
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
    backendId: 6,
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
    backendId: 3,
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
    backendId: 4,
    name: 'Block 34',
    fullName: 'Block 34 (Engineering Labs Complex)',
    code: 'B34',
    area: 'Engineering Wing',
    coords: [75.705573, 31.256809],
    buildingName: 'Block 32 & 34 (Engineering Complex)',
    buildingCategory: 'academic',
    servesShuttle: false,
  },
  {
    id: 'stop-block38',
    backendId: 5,
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
    backendId: 7,
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
    backendId: 8,
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
    backendId: 10,
    name: 'Health Centre',
    fullName: 'University Hospital & Health Centre',
    code: 'HOSP',
    area: 'Medical Sector',
    coords: [75.70355, 31.25545],
    buildingName: 'University Health Centre',
    buildingCategory: 'medical',
    servesShuttle: false,
  },
  {
    id: 'stop-auditorium',
    backendId: 9,
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

interface UberBookingViewProps {
  onBack: () => void;
}

type FlowStep = 'search' | 'options' | 'finding' | 'assigned' | 'completed';
type RideType = 'shuttle' | 'cart' | 'rickshaw';
type SheetSnap = 'peek' | 'half' | 'full';
type PaymentMethodType = 'CASH' | 'WALLET' | 'RAZORPAY';

export default function UberBookingView({ onBack }: UberBookingViewProps) {
  const { mode, tokens, toggleTheme } = useTheme();
  const { currentUser } = useAuth();

  const [step, setStep] = useState<FlowStep>('options');
  const [pickupStop, setPickupStop] = useState<CampusStop>(LPU_CAMPUS_STOPS[0]);
  const [dropoffStop, setDropoffStop] = useState<CampusStop | null>(LPU_CAMPUS_STOPS[2]); // Central Library
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRide, setSelectedRide] = useState<RideType>('cart');
  const [sheetSnap, setSheetSnap] = useState<SheetSnap>('half');

  // Now vs Schedule state
  const [scheduleType, setScheduleType] = useState<'now' | 'schedule'>('now');
  const [scheduledTime, setScheduledTime] = useState<string>('');
  const [passengerCount, setPassengerCount] = useState<number>(1);

  // Payment method selection
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType>('CASH');

  // Route State
  const [routeInfo, setRouteInfo] = useState<RouteResult | null>(null);
  const [isRouting, setIsRouting] = useState(false);

  // Server-Side Real Fare Engine Quotes
  const [fareQuotes, setFareQuotes] = useState<Record<string, any>>({});
  const [loadingFares, setLoadingFares] = useState(false);

  // Active Booking from Database State Machine
  const [activeBooking, setActiveBooking] = useState<any>(null);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);

  // Rating & Completion Feedback State
  const [ratingVal, setRatingVal] = useState<number>(5);
  const [feedbackText, setFeedbackText] = useState<string>('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [ratingSubmitted, setRatingSubmitted] = useState<boolean>(false);

  // Cancellation Modal State
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('Changed plans');

  // No-Show Watchdog Timer (Seconds remaining)
  const [noShowSecondsLeft, setNoShowSecondsLeft] = useState<number | null>(null);

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

  const pickupStopRef = useRef(pickupStop);
  pickupStopRef.current = pickupStop;
  const dropoffStopRef = useRef(dropoffStop);
  dropoffStopRef.current = dropoffStop;

  const isPriorityRider = Boolean(currentUser?.is_priority);

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

  // Check for active student booking on mount
  useEffect(() => {
    let isMounted = true;
    async function checkActiveRide() {
      try {
        const active = await api.getActiveStudentBooking();
        if (isMounted && active && active.id) {
          setActiveBooking(active);
          if (active.status === 'REQUESTED') {
            setStep('finding');
          } else if (['ACCEPTED', 'ARRIVING', 'PICKED_UP'].includes(active.status)) {
            setStep('assigned');
          } else if (active.status === 'COMPLETED') {
            setStep('completed');
          }
        }
      } catch (err) {
        console.warn('No active booking found or error checking:', err);
      }
    }
    checkActiveRide();
    return () => {
      isMounted = false;
    };
  }, []);

  // Subscribe to real-time SSE updates for booking FSM changes
  useEffect(() => {
    const unsub = sseClient.subscribe((event) => {
      if (
        event.event_type === 'GOLF_CART_STATUS_UPDATED' ||
        event.event_type === 'GOLF_CART_ASSIGNED' ||
        event.event_type === 'BOOKING_STATUS_CHANGED'
      ) {
        const payload = event.payload;
        if (activeBooking && payload.booking_id === activeBooking.id) {
          // Re-fetch booking from server to get accurate relations
          api.getBooking(activeBooking.id)
            .then((freshBooking) => {
              setActiveBooking(freshBooking);
              if (freshBooking.status === 'ACCEPTED' || freshBooking.status === 'ARRIVING' || freshBooking.status === 'PICKED_UP') {
                setStep('assigned');
              } else if (freshBooking.status === 'COMPLETED') {
                setStep('completed');
              } else if (freshBooking.status === 'CANCELLED' || freshBooking.status === 'NO_SHOW') {
                setActiveBooking(null);
                setStep('options');
                alert(`Ride update: Status is now ${freshBooking.status}.`);
              }
            })
            .catch((e) => console.warn('Error refreshing booking:', e));
        }
      }
    });
    return () => unsub();
  }, [activeBooking]);

  // No-Show Countdown timer when vehicle is ARRIVING
  useEffect(() => {
    if (!activeBooking || activeBooking.status !== 'ARRIVING' || !activeBooking.no_show_deadline) {
      setNoShowSecondsLeft(null);
      return;
    }

    const interval = setInterval(() => {
      const deadline = new Date(activeBooking.no_show_deadline).getTime();
      const now = new Date().getTime();
      const diffSec = Math.max(0, Math.floor((deadline - now) / 1000));
      setNoShowSecondsLeft(diffSec);
      if (diffSec <= 0) {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [activeBooking]);

  // Fetch real server-side fare quotes whenever pickup or dropoff changes
  useEffect(() => {
    if (!dropoffStop) return;
    let cancelled = false;

    async function loadFares() {
      setLoadingFares(true);
      try {
        const res = await api.calculateFare(pickupStop.backendId, dropoffStop.backendId, null, isPriorityRider);
        if (!cancelled && res?.options) {
          const mapped: Record<string, any> = {};
          res.options.forEach((opt: any) => {
            mapped[opt.vehicle_type] = opt;
          });
          setFareQuotes(mapped);
        }
      } catch (err) {
        console.warn('Fare calculation failed:', err);
      } finally {
        if (!cancelled) setLoadingFares(false);
      }
    }

    loadFares();
    return () => {
      cancelled = true;
    };
  }, [pickupStop, dropoffStop, isPriorityRider]);

  // Fit map camera
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

  // Core Map Drawing: Snapped Road Route with White Casing
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

      if (map.getSource(sourceId)) {
        (map.getSource(sourceId) as maplibregl.GeoJSONSource).setData(routeGeoJSON);
      } else {
        map.addSource(sourceId, {
          type: 'geojson',
          data: routeGeoJSON,
        });
      }

      if (!map.getLayer(casingLayerId)) {
        map.addLayer({
          id: casingLayerId,
          type: 'line',
          source: sourceId,
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color': isDark ? '#000000' : '#FFFFFF',
            'line-width': 8,
            'line-opacity': 0.95,
          },
        });
      }

      if (!map.getLayer(coreLayerId)) {
        map.addLayer({
          id: coreLayerId,
          type: 'line',
          source: sourceId,
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color': isDark ? '#FFFFFF' : '#000000',
            'line-width': 5,
          },
        });
      }
    },
    []
  );

  const updateRoute = useCallback(
    async (from: CampusStop, to: CampusStop | null) => {
      if (!to) return;
      setIsRouting(true);
      try {
        const snappedStart = snapToNearestRoad(from.coords);
        const snappedEnd = snapToNearestRoad(to.coords);
        const route = calculateRoute(snappedStart, snappedEnd);
        setRouteInfo(route);

        const map = mapRef.current;
        if (map && map.isStyleLoaded()) {
          renderRouteOnMap(map, route, modeRef.current === 'dark');
          fitCameraToRoute(route.coordinates);
        }
      } catch (err) {
        console.warn('Route calculation error:', err);
      } finally {
        setIsRouting(false);
      }
    },
    [fitCameraToRoute, renderRouteOnMap]
  );

  // Update building highlight if dropoff or theme changes
  useEffect(() => {
    if (mapRef.current) {
      setHighlightedDestinationBuilding(mapRef.current, dropoffStop?.buildingName, mode);
    }
  }, [dropoffStop, mode]);

  const modeRef = useRef(mode);
  modeRef.current = mode;

  // Initialize MapLibre Map with OpenFreeMap & setup 3D Buildings
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

    map.addControl(
      new maplibregl.AttributionControl({
        compact: true,
        customAttribution:
          MAP_CONFIG.providers[mapProvider]?.attribution ||
          MAP_CONFIG.providers.openfreemap.attribution,
      }),
      'bottom-right'
    );

    map.on('load', async () => {
      setMapError(false);
      try {
        await setupCampus3DBuildings(map, mode, dropoffStopRef.current?.buildingName);
        filterCampusPOIs(map);
      } catch (err) {
        console.warn('Campus 3D setup error:', err);
      }

      // Add Campus Stop Markers
      campusStopsMarkersRef.current.forEach((m) => m.remove());
      campusStopsMarkersRef.current = [];

      LPU_CAMPUS_STOPS.forEach((stop) => {
        const el = document.createElement('div');
        el.className = 'group cursor-pointer flex flex-col items-center';
        el.innerHTML = `
          <div class="px-2 py-0.5 mb-1 bg-black text-white dark:bg-white dark:text-black text-[10px] font-bold rounded shadow-md whitespace-nowrap opacity-90 transition-opacity">
            ${stop.name}
          </div>
          <div class="w-3 h-3 rounded-full bg-black dark:bg-white border-2 border-white dark:border-black shadow-md"></div>
        `;
        el.onclick = () => {
          handleSelectDropoff(stop);
        };
        const marker = new maplibregl.Marker({ element: el }).setLngLat(stop.coords).addTo(map);
        campusStopsMarkersRef.current.push(marker);
      });

      // Draggable Pickup Marker
      if (pickupMarkerRef.current) pickupMarkerRef.current.remove();
      const pickupEl = document.createElement('div');
      pickupEl.className = 'flex flex-col items-center cursor-grab active:cursor-grabbing';
      pickupEl.innerHTML = `
        <div class="px-2 py-0.5 mb-1 bg-black text-white dark:bg-white dark:text-black text-[11px] font-bold rounded shadow-md whitespace-nowrap border border-white/20">
          Pickup: ${pickupStopRef.current.name}
        </div>
        <div class="w-6 h-6 rounded-full bg-black dark:bg-white text-white dark:text-black flex items-center justify-center shadow-2xl border-2 border-white dark:border-black">
          <div class="w-2 h-2 rounded-full bg-white dark:bg-black"></div>
        </div>
      `;

      pickupMarkerRef.current = new maplibregl.Marker({ element: pickupEl, draggable: true })
        .setLngLat(pickupStopRef.current.coords)
        .addTo(map);

      if (dropoffStopRef.current) {
        updateRoute(pickupStopRef.current, dropoffStopRef.current);
      }
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Handle Dropoff Selection
  const handleSelectDropoff = (stop: CampusStop) => {
    setDropoffStop(stop);
    setStep('options');

    const map = mapRef.current;
    if (!map) return;

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

    updateRoute(pickupStop, stop);
  };

  // Real Booking Action: calls backend /lastmile/bookings
  const handleConfirmRide = async () => {
    if (!dropoffStop) return;
    setBookingLoading(true);
    setBookingError(null);
    setStep('finding');

    const vehicleTypeKey =
      selectedRide === 'shuttle' ? 'SHUTTLE' : selectedRide === 'cart' ? 'GOLF_CART' : 'ERICKSHAW';

    try {
      const payload: any = {
        pickup_stop_id: pickupStop.backendId,
        drop_stop_id: dropoffStop.backendId,
        passenger_count: passengerCount,
        vehicle_type: vehicleTypeKey,
        payment_method: paymentMethod,
        is_priority: isPriorityRider,
        scheduled_for: scheduleType === 'schedule' && scheduledTime ? new Date(scheduledTime).toISOString() : null,
      };

      const result = await api.createBooking(payload);
      setActiveBooking(result);

      if (result.status === 'ACCEPTED' || result.status === 'ARRIVING') {
        setStep('assigned');
      } else {
        // REQUESTED state: stay on 'finding' until driver acceptance event
        setStep('finding');
      }
    } catch (err: any) {
      console.error('Booking failed:', err);
      setBookingError(err.message || 'Failed to place booking request');
      setStep('options');
    } finally {
      setBookingLoading(false);
    }
  };

  // Cancel Booking
  const handleCancelBooking = async () => {
    if (!activeBooking) return;
    try {
      const res = await api.cancelBooking(activeBooking.id, cancelReason);
      setActiveBooking(null);
      setCancelModalOpen(false);
      setStep('options');
    } catch (err: any) {
      alert(`Could not cancel: ${err.message}`);
    }
  };

  // Rate Booking
  const handleRateBooking = async () => {
    if (!activeBooking) return;
    try {
      const allFeedback = selectedTags.length > 0 ? `${selectedTags.join(', ')}. ${feedbackText}` : feedbackText;
      await api.rateBooking(activeBooking.id, ratingVal, allFeedback);
      setRatingSubmitted(true);
    } catch (err: any) {
      alert(`Rating failed: ${err.message}`);
    }
  };

  const shuttleQuote = fareQuotes['SHUTTLE'];
  const cartQuote = fareQuotes['GOLF_CART'];
  const rickshawQuote = fareQuotes['ERICKSHAW'];

  // Render Ride Options List
  const renderRideOptionsList = () => {
    const isShuttleValid = pickupStop.servesShuttle && dropoffStop?.servesShuttle;

    return (
      <div className="space-y-3">
        {/* 1. Shuttle Bus */}
        <div
          onClick={() => isShuttleValid && setSelectedRide('shuttle')}
          className={`p-3.5 rounded-[12px] border transition-all ${
            !isShuttleValid
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
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#05A357]/15 text-[#05A357]">
                    Free Transit
                  </span>
                </div>
                <div className="text-xs text-[#5E5E5E] dark:text-[#A6A6A6] mt-0.5">
                  {isShuttleValid ? (
                    'Fixed loop schedule · High capacity'
                  ) : (
                    <span className="text-[#E11900] dark:text-[#FF6B6B]">Does not serve this pair</span>
                  )}
                </div>
              </div>
            </div>
            <div className="text-right">
              <span className="font-bold text-sm text-black dark:text-white">₹0</span>
              <span className="block text-[10px] text-[#5E5E5E] dark:text-[#A6A6A6]">Free</span>
            </div>
          </div>
        </div>

        {/* 2. Electric Golf Cart (Metered Point-to-Point) */}
        <div
          onClick={() => setSelectedRide('cart')}
          className={`p-3.5 rounded-[12px] border transition-all ${
            selectedRide === 'cart'
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
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-black dark:bg-white text-white dark:text-black">
                      Priority Pass
                    </span>
                  )}
                  {cartQuote?.is_peak && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-600 dark:text-amber-400">
                      Rush Hour +25%
                    </span>
                  )}
                </div>
                <div className="text-xs text-[#5E5E5E] dark:text-[#A6A6A6] mt-0.5">
                  Point-to-point express · Up to 6 seats
                </div>
              </div>
            </div>
            <div className="text-right">
              <span className="font-bold text-sm text-black dark:text-white">
                {cartQuote ? `₹${cartQuote.final_fare_inr}` : isPriorityRider ? '₹0' : '₹10-15'}
              </span>
              <span className="block text-[10px] text-[#5E5E5E] dark:text-[#A6A6A6]">
                {isPriorityRider ? '100% Subsidized' : 'Server quote'}
              </span>
            </div>
          </div>

          {/* Fare breakdown pill if selected */}
          {selectedRide === 'cart' && cartQuote?.breakdown && (
            <div className="mt-2.5 pt-2.5 border-t border-[#E2E2E2] dark:border-[#333333] text-[11px] text-[#5E5E5E] dark:text-[#A6A6A6] space-y-1">
              {cartQuote.breakdown.map((item: string, idx: number) => (
                <div key={idx} className="flex items-center justify-between">
                  <span>{item}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 3. Authorized E-Rickshaw */}
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
                  <span className="font-bold text-sm text-black dark:text-white">Smart E-Rickshaw</span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-500">
                    Stand Tariff
                  </span>
                </div>
                <div className="text-xs text-[#5E5E5E] dark:text-[#A6A6A6] mt-0.5">
                  Authorized campus operator stand-to-stand
                </div>
              </div>
            </div>
            <div className="text-right">
              <span className="font-bold text-sm text-black dark:text-white">
                {rickshawQuote ? `₹${rickshawQuote.final_fare_inr}` : '₹15'}
              </span>
              <span className="block text-[10px] text-[#5E5E5E] dark:text-[#A6A6A6]">Fixed flat</span>
            </div>
          </div>
        </div>

        {/* Schedule & Payment Config Controls */}
        <div className="pt-2 border-t border-[#E2E2E2] dark:border-[#333333] space-y-3">
          {/* Now vs Schedule Picker */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-black dark:text-white">Departure</span>
            <div className="flex items-center gap-1 p-0.5 bg-[#F3F3F3] dark:bg-[#2A2A2A] rounded-full text-xs font-semibold">
              <button
                onClick={() => setScheduleType('now')}
                className={`px-3 py-1 rounded-full transition-colors ${
                  scheduleType === 'now'
                    ? 'bg-black text-white dark:bg-white dark:text-black shadow-sm'
                    : 'text-[#5E5E5E] dark:text-[#A6A6A6]'
                }`}
              >
                Now
              </button>
              <button
                onClick={() => setScheduleType('schedule')}
                className={`px-3 py-1 rounded-full transition-colors ${
                  scheduleType === 'schedule'
                    ? 'bg-black text-white dark:bg-white dark:text-black shadow-sm'
                    : 'text-[#5E5E5E] dark:text-[#A6A6A6]'
                }`}
              >
                Schedule
              </button>
            </div>
          </div>

          {scheduleType === 'schedule' && (
            <input
              type="datetime-local"
              value={scheduledTime}
              onChange={(e) => setScheduledTime(e.target.value)}
              className="w-full text-xs p-2 rounded-lg bg-[#F3F3F3] dark:bg-[#2A2A2A] border border-[#E2E2E2] dark:border-[#333333] text-black dark:text-white outline-none"
            />
          )}

          {/* Payment Method Selector */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-black dark:text-white">Payment Method</span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400">
                TEST PAYMENTS
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'CASH', label: 'Cash', icon: Banknote },
                { id: 'WALLET', label: 'Wallet', icon: Wallet },
                { id: 'RAZORPAY', label: 'UPI/Card', icon: CreditCard },
              ].map((m) => {
                const Icon = m.icon;
                const isSel = paymentMethod === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => setPaymentMethod(m.id as any)}
                    className={`py-2 px-2.5 rounded-xl border flex flex-col items-center gap-1 text-center transition-all ${
                      isSel
                        ? 'border-black dark:border-white bg-[#F3F3F3] dark:bg-[#2A2A2A] font-bold'
                        : 'border-[#E2E2E2] dark:border-[#333333] text-[#5E5E5E] dark:text-[#A6A6A6]'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-[11px]">{m.label}</span>
                  </button>
                );
              })}
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
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-black dark:bg-white shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-[#5E5E5E] dark:text-[#A6A6A6]">
                  Pickup Point
                </span>
                <span className="font-semibold text-sm text-black dark:text-white truncate block">
                  {pickupStop.name}
                </span>
              </div>
              <Navigation className="w-4 h-4 text-[#276EF1] shrink-0" />
            </div>

            <div className="border-t border-[#E2E2E2] dark:border-[#333333] my-1" />

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

          {bookingError && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{bookingError}</span>
            </div>
          )}

          {/* If step === 'search': List stops */}
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

          {/* If step === 'options': Show Route Summary & Real Fare Pickers */}
          {step === 'options' && (
            <div className="space-y-4 pt-1">
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
                  </div>
                </div>

                <button
                  onClick={() => setStep('search')}
                  className="text-xs font-semibold text-[#276EF1] hover:underline"
                >
                  Change
                </button>
              </div>

              {renderRideOptionsList()}
            </div>
          )}

          {/* If step === 'finding': Animated Radar Matching HUD */}
          {step === 'finding' && (
            <div className="py-10 text-center space-y-4">
              <div className="relative w-20 h-20 mx-auto flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border-2 border-black dark:border-white animate-ping opacity-25" />
                <div className="w-16 h-16 rounded-full bg-black dark:bg-white text-white dark:text-black flex items-center justify-center shadow-xl">
                  {selectedRide === 'shuttle' ? (
                    <Bus className="w-8 h-8" />
                  ) : selectedRide === 'cart' ? (
                    <Zap className="w-8 h-8" />
                  ) : (
                    <Car className="w-8 h-8" />
                  )}
                </div>
              </div>
              <div>
                <h3 className="font-bold text-lg text-black dark:text-white">
                  Finding your campus ride
                </h3>
                <p className="text-xs text-[#5E5E5E] dark:text-[#A6A6A6] mt-1 max-w-xs mx-auto">
                  {activeBooking?.queue_position > 0
                    ? `In priority queue (Position #${activeBooking.queue_position}) · Est wait: ${activeBooking.estimated_wait_mins} min`
                    : `Contacting nearest active ${selectedRide} near ${pickupStop.name}...`}
                </p>
              </div>
              <button
                onClick={handleCancelBooking}
                className="text-xs font-bold text-[#E11900] py-2 hover:underline"
              >
                Cancel request
              </button>
            </div>
          )}

          {/* If step === 'assigned': Live Vehicle & Driver Card */}
          {step === 'assigned' && activeBooking && (
            <div className="space-y-4 pt-1">
              <div className="p-4 rounded-[12px] bg-[#F3F3F3] dark:bg-[#2A2A2A] space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-extrabold text-lg text-black dark:text-white">
                      {activeBooking.status === 'ARRIVING'
                        ? 'Vehicle Arrived at Pickup!'
                        : activeBooking.status === 'PICKED_UP'
                        ? 'Trip in Progress'
                        : 'Driver on the way'}
                    </h3>
                    <p className="text-xs text-[#05A357] font-semibold flex items-center gap-1 mt-0.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>
                        {activeBooking.status === 'PICKED_UP'
                          ? `Heading to ${activeBooking.drop_stop?.name || dropoffStop?.name}`
                          : `En route to ${activeBooking.pickup_stop?.name || pickupStop.name}`}
                      </span>
                    </p>
                  </div>
                  <div className="w-11 h-11 rounded-full bg-black dark:bg-white text-white dark:text-black flex items-center justify-center font-bold text-sm">
                    {activeBooking.assigned_driver?.name ? activeBooking.assigned_driver.name[0] : 'G'}
                  </div>
                </div>

                {/* 5-Min No-Show Countdown Warning when ARRIVING */}
                {activeBooking.status === 'ARRIVING' && noShowSecondsLeft !== null && (
                  <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs flex items-center justify-between">
                    <span className="flex items-center gap-1.5 font-bold">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Boarding Window:
                    </span>
                    <span className="font-mono font-bold">
                      {Math.floor(noShowSecondsLeft / 60)}:
                      {String(noShowSecondsLeft % 60).padStart(2, '0')} min
                    </span>
                  </div>
                )}

                <div className="border-t border-[#E2E2E2] dark:border-[#333333] pt-3 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-sm text-black dark:text-white">
                      {activeBooking.assigned_driver?.name || 'Gurpreet Singh'}
                    </div>
                    <div className="text-xs text-[#5E5E5E] dark:text-[#A6A6A6]">
                      4.95 ★ &middot; {activeBooking.assigned_driver?.license_number || 'PB-08-2021-00452'}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono font-black text-sm text-black dark:text-white">
                      {activeBooking.assigned_cart?.cart_code || 'GC-01'}
                    </div>
                    <div className="text-[11px] text-[#5E5E5E] dark:text-[#A6A6A6] capitalize">
                      {activeBooking.vehicle_type} · {activeBooking.passenger_count} Seat(s)
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons: Call, Share, Cancel */}
              <div className="grid grid-cols-3 gap-2">
                <a
                  href={`tel:${activeBooking.assigned_driver?.phone_number || '+91-98765-22002'}`}
                  className="uber-btn-secondary h-11 min-h-[44px] text-xs font-bold"
                >
                  <Phone className="w-4 h-4 mr-1 text-[#05A357]" />
                  <span>Call</span>
                </a>
                <button
                  onClick={() => {
                    if (typeof navigator !== 'undefined' && navigator.clipboard) {
                      navigator.clipboard.writeText(
                        `${window.location.origin}/book?trip_id=${activeBooking.id}`
                      );
                      alert('Trip tracking link copied to clipboard!');
                    }
                  }}
                  className="uber-btn-secondary h-11 min-h-[44px] text-xs font-bold"
                >
                  <Share2 className="w-4 h-4 mr-1 text-[#276EF1]" />
                  <span>Share</span>
                </button>
                <button
                  onClick={() => setCancelModalOpen(true)}
                  className="uber-btn-secondary h-11 min-h-[44px] text-xs font-bold text-[#E11900] hover:bg-red-50 dark:hover:bg-red-950/30"
                >
                  <X className="w-4 h-4 mr-1" />
                  <span>Cancel</span>
                </button>
              </div>
            </div>
          )}

          {/* If step === 'completed': Rating & Receipt View */}
          {step === 'completed' && activeBooking && (
            <div className="p-4 rounded-[12px] bg-[#F3F3F3] dark:bg-[#2A2A2A] space-y-4 text-center">
              <div className="w-12 h-12 rounded-full bg-[#05A357]/15 text-[#05A357] flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-extrabold text-lg text-black dark:text-white">Trip Completed</h3>
                <p className="text-xs text-[#5E5E5E] dark:text-[#A6A6A6]">
                  Arrived safely at {activeBooking.drop_stop?.name || dropoffStop?.name}
                </p>
              </div>

              {/* Receipt Summary */}
              <div className="p-3 rounded-lg bg-white dark:bg-[#1C1C1C] border border-[#E2E2E2] dark:border-[#333333] text-left text-xs space-y-1.5">
                <div className="flex justify-between font-bold">
                  <span>Fare Paid</span>
                  <span>₹{activeBooking.fare_amount_inr || activeBooking.fare_amount_paise / 100}</span>
                </div>
                <div className="flex justify-between text-[#5E5E5E] dark:text-[#A6A6A6] text-[11px]">
                  <span>Method</span>
                  <span>{activeBooking.payment_method}</span>
                </div>
              </div>

              {/* 5-Star Rating */}
              {!ratingSubmitted ? (
                <div className="space-y-3 pt-2">
                  <span className="text-xs font-bold">Rate your driver</span>
                  <div className="flex justify-center gap-1.5">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <button
                        key={s}
                        onClick={() => setRatingVal(s)}
                        className={`p-1.5 transition-transform active:scale-125 ${
                          s <= ratingVal ? 'text-amber-400' : 'text-slate-300 dark:text-slate-700'
                        }`}
                      >
                        <Star className="w-6 h-6 fill-current" />
                      </button>
                    ))}
                  </div>

                  {/* Quick feedback tags */}
                  <div className="flex flex-wrap gap-1.5 justify-center pt-1">
                    {['On time', 'Smooth ride', 'Polite driver', 'Clean cart'].map((tag) => {
                      const isSel = selectedTags.includes(tag);
                      return (
                        <button
                          key={tag}
                          onClick={() =>
                            setSelectedTags((prev) =>
                              prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
                            )
                          }
                          className={`text-[10px] font-semibold px-2 py-1 rounded-full border transition-colors ${
                            isSel
                              ? 'bg-black text-white dark:bg-white dark:text-black border-transparent'
                              : 'bg-transparent border-[#E2E2E2] dark:border-[#333333] text-[#5E5E5E]'
                          }`}
                        >
                          {tag}
                        </button>
                      );
                    })}
                  </div>

                  <button onClick={handleRateBooking} className="uber-btn-primary w-full text-xs">
                    Submit Rating
                  </button>
                </div>
              ) : (
                <div className="p-3 rounded-lg bg-[#05A357]/10 text-[#05A357] text-xs font-bold">
                  Thank you for your rating!
                </div>
              )}

              <button
                onClick={() => {
                  setActiveBooking(null);
                  setStep('options');
                  setRatingSubmitted(false);
                }}
                className="uber-btn-secondary w-full text-xs font-bold"
              >
                Book Another Ride
              </button>
            </div>
          )}
        </div>

        {/* Sticky Confirm Button at Bottom of Desktop Panel */}
        {step === 'options' && (
          <div className="p-4 border-t border-[#E2E2E2] dark:border-[#333333] bg-white dark:bg-[#1C1C1C] sticky bottom-0">
            <button
              onClick={handleConfirmRide}
              disabled={bookingLoading}
              className="uber-btn-primary w-full disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {bookingLoading ? (
                <span>Requesting Dispatch...</span>
              ) : (
                <span>
                  Confirm {selectedRide === 'shuttle' ? 'Shuttle' : selectedRide === 'cart' ? 'Golf Cart' : 'E-Rickshaw'}
                </span>
              )}
            </button>
          </div>
        )}
      </aside>

      {/* ============================================================== */}
      {/* MAP CONTAINER (Fills rest of screen on desktop, full on mobile) */}
      {/* ============================================================== */}
      <main className="relative flex-1 h-full w-full bg-[#F3F3F3] dark:bg-[#141414]">
        <div ref={mapContainerRef} className="absolute inset-0 w-full h-full z-0" />

        {/* Mobile Floating Top Bar */}
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

        {/* Mobile Bottom Sheets */}
        <div className="lg:hidden">
          {/* Options Bottom Sheet on Mobile */}
          <AnimatePresence>
            {step === 'options' && (
              <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                className={`absolute bottom-0 left-0 right-0 z-30 bg-white dark:bg-[#1C1C1C] rounded-t-[16px] shadow-2xl border-t border-[#E2E2E2] dark:border-[#333333] flex flex-col ${
                  sheetSnap === 'full' ? 'h-[85vh]' : 'h-[460px]'
                } transition-all duration-300`}
              >
                <div
                  onClick={() => setSheetSnap(sheetSnap === 'half' ? 'full' : 'half')}
                  className="pt-3 pb-2 cursor-pointer flex flex-col items-center"
                >
                  <div className="w-12 h-1.5 rounded-full bg-[#E2E2E2] dark:bg-[#333333]" />
                </div>

                <div className="px-5 pb-3 border-b border-[#E2E2E2] dark:border-[#333333] flex items-start justify-between">
                  <div>
                    <h2 className="font-bold text-lg text-black dark:text-white">Choose a ride</h2>
                    <div className="text-xs text-[#5E5E5E] dark:text-[#A6A6A6]">
                      To {dropoffStop?.name} &middot; {routeInfo?.formattedDistance}
                    </div>
                  </div>
                  <button onClick={() => setStep('search')} className="p-1 rounded-full text-[#5E5E5E]">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto px-5 py-3">
                  {renderRideOptionsList()}
                </div>

                <div className="p-4 border-t border-[#E2E2E2] dark:border-[#333333] bg-white dark:bg-[#1C1C1C]">
                  <button
                    onClick={handleConfirmRide}
                    disabled={bookingLoading}
                    className="uber-btn-primary w-full disabled:opacity-50"
                  >
                    <span>Confirm Ride</span>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Finding Sheet on Mobile */}
          <AnimatePresence>
            {step === 'finding' && (
              <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                className="absolute bottom-0 left-0 right-0 z-30 bg-white dark:bg-[#1C1C1C] rounded-t-[16px] p-6 shadow-2xl border-t border-[#E2E2E2] dark:border-[#333333] text-center space-y-4"
              >
                <div className="w-12 h-1.5 rounded-full bg-[#E2E2E2] dark:bg-[#333333] mx-auto" />
                <div className="w-16 h-16 rounded-full bg-black dark:bg-white text-white dark:text-black mx-auto flex items-center justify-center animate-pulse">
                  <Zap className="w-8 h-8" />
                </div>
                <h2 className="font-bold text-xl text-black dark:text-white">Finding your ride</h2>
                <button onClick={handleCancelBooking} className="text-xs font-semibold text-[#E11900] py-1">
                  Cancel request
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Driver Assigned Sheet on Mobile */}
          <AnimatePresence>
            {step === 'assigned' && activeBooking && (
              <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                className="absolute bottom-0 left-0 right-0 z-30 bg-white dark:bg-[#1C1C1C] rounded-t-[16px] p-5 shadow-2xl border-t border-[#E2E2E2] dark:border-[#333333] space-y-4"
              >
                <div className="w-12 h-1.5 rounded-full bg-[#E2E2E2] dark:bg-[#333333] mx-auto mb-1" />
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-extrabold text-xl text-black dark:text-white">
                      {activeBooking.status === 'ARRIVING'
                        ? 'Vehicle Arrived!'
                        : activeBooking.status === 'PICKED_UP'
                        ? 'On Trip'
                        : 'Driver Assigned'}
                    </h2>
                    <p className="text-xs text-[#05A357] font-semibold">
                      En route &middot; {activeBooking.pickup_stop?.name || pickupStop.name}
                    </p>
                  </div>
                  <div className="w-11 h-11 rounded-full bg-black dark:bg-white text-white dark:text-black flex items-center justify-center font-bold">
                    {activeBooking.assigned_driver?.name ? activeBooking.assigned_driver.name[0] : 'G'}
                  </div>
                </div>

                <div className="flex items-center justify-between p-3.5 rounded-[12px] bg-[#F3F3F3] dark:bg-[#2A2A2A]">
                  <div>
                    <div className="font-bold text-sm text-black dark:text-white">
                      {activeBooking.assigned_driver?.name || 'Gurpreet Singh'}
                    </div>
                    <div className="text-xs text-[#5E5E5E] dark:text-[#A6A6A6]">
                      4.95 ★ &middot; {activeBooking.assigned_driver?.license_number || 'PB-08-2021-00452'}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono font-black text-sm text-black dark:text-white">
                      {activeBooking.assigned_cart?.cart_code || 'GC-01'}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <a
                    href={`tel:${activeBooking.assigned_driver?.phone_number || '+91-98765-22002'}`}
                    className="uber-btn-secondary h-11 min-h-[44px] text-xs font-bold"
                  >
                    <Phone className="w-4 h-4 mr-1 text-[#05A357]" />
                    <span>Call</span>
                  </a>
                  <button
                    onClick={() => {
                      if (typeof navigator !== 'undefined' && navigator.clipboard) {
                        navigator.clipboard.writeText(
                          `${window.location.origin}/book?trip_id=${activeBooking.id}`
                        );
                        alert('Trip link copied!');
                      }
                    }}
                    className="uber-btn-secondary h-11 min-h-[44px] text-xs font-bold"
                  >
                    <Share2 className="w-4 h-4 mr-1 text-[#276EF1]" />
                    <span>Share</span>
                  </button>
                  <button
                    onClick={() => setCancelModalOpen(true)}
                    className="uber-btn-secondary h-11 min-h-[44px] text-xs font-bold text-[#E11900]"
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

      {/* Cancellation Modal */}
      {cancelModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="w-full max-w-sm bg-white dark:bg-[#1C1C1C] rounded-2xl p-5 border border-[#E2E2E2] dark:border-[#333333] space-y-4">
            <h3 className="font-extrabold text-lg text-black dark:text-white">Cancel Ride?</h3>
            <p className="text-xs text-[#5E5E5E] dark:text-[#A6A6A6]">
              Please tell us why you are cancelling this booking:
            </p>
            <select
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              className="w-full text-xs p-2.5 rounded-lg bg-[#F3F3F3] dark:bg-[#2A2A2A] border border-[#E2E2E2] dark:border-[#333333] text-black dark:text-white outline-none"
            >
              <option value="Changed plans">Changed plans</option>
              <option value="Wait time too long">Wait time too long</option>
              <option value="Decided to walk">Decided to walk</option>
              <option value="Found alternative transport">Found alternative transport</option>
            </select>
            <div className="flex gap-2">
              <button
                onClick={() => setCancelModalOpen(false)}
                className="uber-btn-secondary flex-1 text-xs"
              >
                Keep Ride
              </button>
              <button
                onClick={handleCancelBooking}
                className="uber-btn-primary flex-1 text-xs bg-[#E11900] text-white hover:bg-red-700"
              >
                Confirm Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
