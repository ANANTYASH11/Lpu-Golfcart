import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../theme/ThemeContext';
import { api } from '../api/client';
import { sseClient } from '../api/sse';
import {
  ArrowLeft,
  Search,
  MapPin,
  Bus,
  Clock,
  Bell,
  BellRing,
  AlertTriangle,
  CheckCircle2,
  Navigation,
  RefreshCw,
  Sun,
  Moon,
  ChevronRight,
  Info,
  Radio,
} from 'lucide-react';

interface LiveShuttlesViewProps {
  onBack: () => void;
  onOpenMap?: (stopId?: number) => void;
}

export default function LiveShuttlesView({ onBack, onOpenMap }: LiveShuttlesViewProps) {
  const { mode, toggleTheme } = useTheme();

  const [stops, setStops] = useState<any[]>([]);
  const [selectedStopId, setSelectedStopId] = useState<number>(1);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [arrivals, setArrivals] = useState<any[]>([]);
  const [loadingArrivals, setLoadingArrivals] = useState<boolean>(true);
  const [gpsLoading, setGpsLoading] = useState<boolean>(false);
  const [nearestStopBanner, setNearestStopBanner] = useState<string | null>(null);

  // Shuttle Route Progress inspection
  const [selectedShuttleId, setSelectedShuttleId] = useState<number | null>(null);
  const [shuttleProgress, setShuttleProgress] = useState<any | null>(null);
  const [loadingProgress, setLoadingProgress] = useState<boolean>(false);

  // Notifications (2 stops away)
  const [subscribedTripIds, setSubscribedTripIds] = useState<number[]>([]);
  const [notificationToast, setNotificationToast] = useState<string | null>(null);

  // 1. Fetch campus stops on mount
  useEffect(() => {
    api.getStops()
      .then((data) => {
        setStops(data || []);
      })
      .catch((err) => console.error('Failed to load stops:', err));
  }, []);

  // 2. Fetch live arrivals whenever selectedStopId changes
  const fetchArrivals = (stopId: number) => {
    setLoadingArrivals(true);
    api.getStopArrivals(stopId)
      .then((data) => {
        setArrivals(data || []);
      })
      .catch((err) => console.error('Failed to load arrivals:', err))
      .finally(() => setLoadingArrivals(false));
  };

  useEffect(() => {
    if (selectedStopId) {
      fetchArrivals(selectedStopId);
    }
  }, [selectedStopId]);

  // 3. Real-time SSE updates for arrivals
  useEffect(() => {
    const unsub = sseClient.subscribe((event) => {
      if (
        event.event_type === 'SHUTTLE_TELEMETRY' ||
        event.event_type === 'SHUTTLE_CROWD_UPDATED' ||
        event.event_type === 'SHUTTLE_DELAY_UPDATED'
      ) {
        if (selectedStopId) {
          fetchArrivals(selectedStopId);
        }
      }
    });
    return () => unsub();
  }, [selectedStopId]);

  // 4. Inspect shuttle route progress
  const inspectShuttle = (shuttleId: number) => {
    setSelectedShuttleId(shuttleId);
    setLoadingProgress(true);
    api.getShuttleProgress(shuttleId)
      .then((res) => {
        setShuttleProgress(res);
      })
      .catch((err) => {
        console.warn('Could not fetch shuttle progress:', err);
      })
      .finally(() => setLoadingProgress(false));
  };

  // 5. GPS "Stops Near Me"
  const handleFindNearMe = () => {
    setGpsLoading(true);
    const fallbackLat = 31.2550;
    const fallbackLon = 75.7020;

    const queryNearest = (lat: number, lon: number) => {
      api.getStopsNearMe(lat, lon, 3)
        .then((nearest) => {
          if (nearest && nearest.length > 0) {
            setSelectedStopId(nearest[0].id);
            setNearestStopBanner(
              `Nearest stop: ${nearest[0].name} (${nearest[0].distance_meters}m away · ~${nearest[0].walk_time_mins} min walk)`
            );
          }
        })
        .catch((e) => console.warn('Could not fetch nearest stops:', e))
        .finally(() => setGpsLoading(false));
    };

    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          queryNearest(pos.coords.latitude, pos.coords.longitude);
        },
        () => {
          // Fallback to campus center
          queryNearest(fallbackLat, fallbackLon);
        },
        { timeout: 5000 }
      );
    } else {
      queryNearest(fallbackLat, fallbackLon);
    }
  };

  // 6. "Notify me when 2 stops away"
  const toggleNotification = (tripId: number, vehicleNumber: string) => {
    if (subscribedTripIds.includes(tripId)) {
      setSubscribedTripIds((prev) => prev.filter((id) => id !== tripId));
      setNotificationToast(`Alert cancelled for ${vehicleNumber}`);
    } else {
      setSubscribedTripIds((prev) => [...prev, tripId]);
      if (typeof window !== 'undefined' && 'Notification' in window) {
        if (Notification.permission === 'default') {
          Notification.requestPermission();
        }
      }
      setNotificationToast(`🔔 We'll notify you when ${vehicleNumber} is 2 stops away!`);
    }
    setTimeout(() => setNotificationToast(null), 4000);
  };

  // Filtered stops for search bar
  const filteredStops = useMemo(() => {
    return stops.filter(
      (s) =>
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.code.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [stops, searchQuery]);

  const selectedStop = stops.find((s) => s.id === selectedStopId);

  return (
    <div className="min-h-screen bg-white dark:bg-black text-black dark:text-white font-sans transition-colors duration-150 flex flex-col">
      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-white/90 dark:bg-black/90 backdrop-blur-md border-b border-[#E2E2E2] dark:border-[#333333] px-4 sm:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="w-10 h-10 rounded-full bg-[#F3F3F3] dark:bg-[#1C1C1C] flex items-center justify-center hover:bg-[#EAEAEA] dark:hover:bg-[#2A2A2A] transition-colors"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-extrabold text-lg sm:text-xl tracking-tight">Live Shuttles & Arrivals</h1>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-[#05A357]/15 text-[#05A357] flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#05A357] animate-pulse" />
                Live Telematics
              </span>
            </div>
            <p className="text-xs text-[#5E5E5E] dark:text-[#A6A6A6] -mt-0.5 hidden sm:block">
              Real-time student transit arrivals & crowd monitor
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchArrivals(selectedStopId)}
            className="w-10 h-10 rounded-full bg-[#F3F3F3] dark:bg-[#1C1C1C] flex items-center justify-center hover:bg-[#EAEAEA] dark:hover:bg-[#2A2A2A] transition-colors"
            title="Refresh Arrivals"
          >
            <RefreshCw className={`w-4 h-4 ${loadingArrivals ? 'animate-spin text-blue-500' : ''}`} />
          </button>
          <button
            onClick={toggleTheme}
            className="w-10 h-10 rounded-full bg-[#F3F3F3] dark:bg-[#1C1C1C] flex items-center justify-center hover:bg-[#EAEAEA] dark:hover:bg-[#2A2A2A] transition-colors"
          >
            {mode === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Notification Toast Alert */}
      <AnimatePresence>
        {notificationToast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-full bg-black text-white dark:bg-white dark:text-black text-xs font-bold shadow-2xl flex items-center gap-2 border border-white/20"
          >
            <BellRing className="w-4 h-4 text-[#05A357]" />
            <span>{notificationToast}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-8 py-6 space-y-6">
        {/* Stop Search Bar & GPS Locate Action */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#5E5E5E] dark:text-[#A6A6A6] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search campus stop (e.g. Main Gate, Library, Block 32)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-xl bg-[#F3F3F3] dark:bg-[#1C1C1C] border border-[#E2E2E2] dark:border-[#333333] text-sm font-semibold outline-none focus:border-black dark:focus:border-white transition-colors"
            />
          </div>
          <button
            onClick={handleFindNearMe}
            disabled={gpsLoading}
            className="px-4 py-3 rounded-xl bg-black text-white dark:bg-white dark:text-black font-semibold text-xs flex items-center justify-center gap-2 hover:opacity-90 transition-opacity active:scale-98"
          >
            <Navigation className={`w-4 h-4 ${gpsLoading ? 'animate-spin' : ''}`} />
            <span>{gpsLoading ? 'Locating...' : 'Stops Near Me'}</span>
          </button>
        </div>

        {/* Nearest Stop GPS Banner */}
        {nearestStopBanner && (
          <div className="p-3 rounded-xl bg-[#05A357]/10 border border-[#05A357]/30 text-[#05A357] text-xs font-semibold flex items-center justify-between">
            <span className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{nearestStopBanner}</span>
            </span>
            <button onClick={() => setNearestStopBanner(null)} className="opacity-70 hover:opacity-100">
              ✕
            </button>
          </div>
        )}

        {/* Horizontal Stop Selector Chips */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          {filteredStops.map((stop) => {
            const isSelected = stop.id === selectedStopId;
            return (
              <button
                key={stop.id}
                onClick={() => setSelectedStopId(stop.id)}
                className={`px-3.5 py-2 rounded-full text-xs whitespace-nowrap font-semibold border transition-all ${
                  isSelected
                    ? 'bg-black text-white dark:bg-white dark:text-black border-black dark:border-white shadow-sm'
                    : 'bg-[#F3F3F3] text-[#5E5E5E] border-[#E2E2E2] dark:bg-[#1C1C1C] dark:text-[#A6A6A6] dark:border-[#333333] hover:border-slate-400'
                }`}
              >
                <span>{stop.name}</span>
                <span className="ml-1.5 opacity-60 text-[10px]">{stop.code}</span>
              </button>
            );
          })}
        </div>

        {/* Selected Stop Header */}
        <div className="flex items-center justify-between p-4 rounded-2xl bg-[#F3F3F3] dark:bg-[#1C1C1C] border border-[#E2E2E2] dark:border-[#333333]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-black text-white dark:bg-white dark:text-black flex items-center justify-center font-bold">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-extrabold text-base sm:text-lg">{selectedStop?.name || 'Selected Stop'}</h2>
              <span className="text-xs text-[#5E5E5E] dark:text-[#A6A6A6]">
                Stop Code: {selectedStop?.code} · {selectedStop?.has_shelter ? 'Sheltered' : 'Open'}
              </span>
            </div>
          </div>
        </div>

        {/* Arrivals Board */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-extrabold text-sm uppercase tracking-wider text-[#5E5E5E] dark:text-[#A6A6A6]">
              Incoming Shuttles & Live Departures
            </h3>
            <span className="text-xs font-semibold text-[#5E5E5E] dark:text-[#A6A6A6]">
              {arrivals.length} {arrivals.length === 1 ? 'vehicle' : 'vehicles'} scheduled
            </span>
          </div>

          {loadingArrivals ? (
            <div className="p-12 text-center text-sm font-semibold text-[#5E5E5E] animate-pulse">
              Fetching real-time telematics from campus shuttles...
            </div>
          ) : arrivals.length === 0 ? (
            <div className="p-8 text-center rounded-2xl bg-[#F3F3F3] dark:bg-[#1C1C1C] border border-[#E2E2E2] dark:border-[#333333] space-y-2">
              <Bus className="w-8 h-8 mx-auto text-[#5E5E5E]" />
              <p className="font-bold text-sm">No shuttles currently approaching this stop</p>
              <p className="text-xs text-[#5E5E5E]">Check the Timetable tab for full daily schedules.</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {arrivals.map((arrival) => {
                const isSubscribed = subscribedTripIds.includes(arrival.trip_id);
                const isFull = arrival.crowd_level === 'FULL';
                const isModerate = arrival.crowd_level === 'MODERATE';

                return (
                  <div
                    key={arrival.trip_id}
                    className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#1C1C1C] border border-[#E2E2E2] dark:border-[#333333] shadow-sm hover:border-black dark:hover:border-white transition-all space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold shrink-0"
                          style={{ backgroundColor: arrival.route_color || '#2563EB' }}
                        >
                          <Bus className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-base">{arrival.route_name}</span>
                            <span className="text-xs font-mono font-bold px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10">
                              {arrival.vehicle_number}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-[#5E5E5E] dark:text-[#A6A6A6] mt-0.5">
                            <span>Currently near: {arrival.current_stop_name || 'In transit'}</span>
                          </div>
                        </div>
                      </div>

                      {/* Live ETA or Scheduled Label */}
                      <div className="text-right">
                        {arrival.is_live && arrival.eta_minutes !== null ? (
                          <>
                            <div className="font-extrabold text-xl sm:text-2xl tracking-tight text-black dark:text-white">
                              {arrival.eta_minutes === 0 ? 'Due now' : `${arrival.eta_minutes} min`}
                            </div>
                            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#05A357]/15 text-[#05A357]">
                              Live ETA
                            </span>
                          </>
                        ) : (
                          <>
                            <div className="font-bold text-base text-[#5E5E5E] dark:text-[#A6A6A6]">
                              {arrival.scheduled_departure_time || 'Scheduled'}
                            </div>
                            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                              Scheduled only
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Telemetry Status Bar: Crowd Level, Delay, and Action Buttons */}
                    <div className="pt-2 border-t border-[#E2E2E2] dark:border-[#333333] flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2">
                        {/* Crowd Badge */}
                        <span
                          className={`font-bold px-2 py-0.5 rounded-full text-[11px] ${
                            isFull
                              ? 'bg-red-500/15 text-red-600 dark:text-red-400'
                              : isModerate
                              ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                              : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                          }`}
                        >
                          {isFull ? 'Full (Seats unavailable)' : isModerate ? 'Moderate crowd' : 'Low crowd · Seats open'}
                        </span>

                        {/* Delay Tag if > 0 */}
                        {arrival.current_delay_sec > 0 && (
                          <span className="font-bold px-2 py-0.5 rounded-full text-[11px] bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>+{Math.round(arrival.current_delay_sec / 60)} min delay</span>
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Inspect Progress on Map */}
                        <button
                          onClick={() => inspectShuttle(arrival.trip_id)}
                          className="px-3 py-1.5 rounded-lg border border-[#E2E2E2] dark:border-[#333333] hover:bg-[#F3F3F3] dark:hover:bg-[#2A2A2A] text-xs font-semibold flex items-center gap-1.5 transition-colors"
                        >
                          <span>Route Progress</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>

                        {/* Notify Me Toggle */}
                        <button
                          onClick={() => toggleNotification(arrival.trip_id, arrival.vehicle_number)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                            isSubscribed
                              ? 'bg-black text-white dark:bg-white dark:text-black font-bold'
                              : 'border border-[#E2E2E2] dark:border-[#333333] text-[#5E5E5E] dark:text-[#A6A6A6] hover:text-black dark:hover:text-white'
                          }`}
                        >
                          {isSubscribed ? <BellRing className="w-3.5 h-3.5 text-[#05A357]" /> : <Bell className="w-3.5 h-3.5" />}
                          <span>{isSubscribed ? 'Alert On' : 'Notify 2 Stops Away'}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Route Progress Visualizer Modal */}
        <AnimatePresence>
          {selectedShuttleId && shuttleProgress && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full max-w-lg bg-white dark:bg-[#1C1C1C] rounded-2xl p-6 shadow-2xl border border-[#E2E2E2] dark:border-[#333333] space-y-4 max-h-[85vh] overflow-y-auto"
              >
                <div className="flex items-center justify-between pb-3 border-b border-[#E2E2E2] dark:border-[#333333]">
                  <div>
                    <h3 className="font-extrabold text-lg text-black dark:text-white">
                      {shuttleProgress.route_name}
                    </h3>
                    <p className="text-xs text-[#5E5E5E] dark:text-[#A6A6A6]">
                      Vehicle: {shuttleProgress.vehicle_number} · Capacity: {shuttleProgress.capacity} seats
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedShuttleId(null);
                      setShuttleProgress(null);
                    }}
                    className="w-8 h-8 rounded-full bg-[#F3F3F3] dark:bg-[#2A2A2A] flex items-center justify-center text-black dark:text-white"
                  >
                    ✕
                  </button>
                </div>

                {/* Progress line */}
                <div className="space-y-3 py-2">
                  <div className="text-xs font-bold uppercase tracking-wider text-[#5E5E5E] dark:text-[#A6A6A6]">
                    Live Stop-by-Stop Route Progress
                  </div>
                  <div className="space-y-4 pl-2">
                    {shuttleProgress.stops.map((st: any, idx: number) => {
                      return (
                        <div key={st.stop_id} className="flex items-start gap-3 relative">
                          {/* Vertical connector line */}
                          {idx < shuttleProgress.stops.length - 1 && (
                            <div
                              className={`absolute left-2.5 top-5 bottom-0 w-0.5 ${
                                st.is_passed ? 'bg-[#05A357]' : 'bg-[#E2E2E2] dark:bg-[#333333]'
                              }`}
                            />
                          )}

                          {/* Node Icon */}
                          <div
                            className={`w-5 h-5 rounded-full flex items-center justify-center z-10 shrink-0 ${
                              st.is_current
                                ? 'bg-black text-white dark:bg-white dark:text-black font-bold ring-4 ring-blue-500/30'
                                : st.is_passed
                                ? 'bg-[#05A357] text-white'
                                : 'bg-[#E2E2E2] dark:bg-[#333333] text-[#5E5E5E]'
                            }`}
                          >
                            {st.is_passed ? (
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            ) : st.is_current ? (
                              <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping" />
                            ) : (
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                            )}
                          </div>

                          <div className="flex-1 flex items-center justify-between">
                            <div>
                              <span className={`text-sm font-bold ${st.is_current ? 'text-blue-500' : ''}`}>
                                {st.stop_name}
                              </span>
                              {st.is_current && (
                                <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-500">
                                  Current Stop
                                </span>
                              )}
                            </div>
                            <span className="text-xs font-mono font-semibold text-[#5E5E5E] dark:text-[#A6A6A6]">
                              {st.is_passed ? 'Departed' : st.eta_minutes !== null ? `${st.eta_minutes} min` : 'Scheduled'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <button
                  onClick={() => {
                    setSelectedShuttleId(null);
                    setShuttleProgress(null);
                  }}
                  className="uber-btn-primary w-full text-xs"
                >
                  Close Progress View
                </button>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
