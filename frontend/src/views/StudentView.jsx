import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { sseClient } from '../api/sse';
import { useAuth } from '../context/AuthContext';
import CrowdBadge from '../components/CrowdBadge';
import CampusMapVisual from '../components/CampusMapVisual';
import {
  Bus, Car, Clock, Navigation, Search, AlertCircle, CheckCircle,
  MapPin, Users, HeartHandshake, ArrowRight, ShieldCheck, RefreshCw, XCircle
} from 'lucide-react';

export default function StudentView() {
  const { currentUser } = useAuth();
  const [stops, setStops] = useState([]);
  const [selectedStopId, setSelectedStopId] = useState(1);
  const [arrivals, setArrivals] = useState([]);
  const [activeTrips, setActiveTrips] = useState([]);
  const [loadingArrivals, setLoadingArrivals] = useState(false);

  // Journey Planner state
  const [journeyFromId, setJourneyFromId] = useState(1);
  const [journeyToId, setJourneyToId] = useState(3);
  const [journeyPlan, setJourneyPlan] = useState(null);
  const [journeyLoading, setJourneyLoading] = useState(false);

  // Golf Cart Booking state
  const [bookingPickupId, setBookingPickupId] = useState(1);
  const [bookingDropId, setBookingDropId] = useState(3);
  const [passengerCount, setPassengerCount] = useState(1);
  const [isPriority, setIsPriority] = useState(currentUser?.is_priority || false);
  const [priorityReason, setPriorityReason] = useState(currentUser?.priority_reason || '');
  const [activeBooking, setActiveBooking] = useState(null);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingError, setBookingError] = useState('');
  const [bookingSuccess, setBookingSuccess] = useState('');

  // Update priority flag when user persona switches
  useEffect(() => {
    if (currentUser) {
      setIsPriority(currentUser.is_priority || false);
      setPriorityReason(currentUser.priority_reason || '');
    }
  }, [currentUser]);

  // Initial load
  useEffect(() => {
    loadStops();
    loadActiveBooking();
  }, [currentUser]);

  // Load arrivals when selected stop changes
  useEffect(() => {
    if (selectedStopId) {
      loadArrivals(selectedStopId);
    }
  }, [selectedStopId]);

  // Subscribe to live SSE updates
  useEffect(() => {
    const unsub = sseClient.subscribe((event) => {
      const type = event.event_type;
      if (['TripStarted', 'TripProgressUpdated', 'CrowdUpdated', 'TripCancelled', 'TripCompleted'].includes(type)) {
        if (selectedStopId) loadArrivals(selectedStopId);
        loadActiveTrips();
      }
      if (['GolfCartAssigned', 'GolfCartStatusUpdated', 'GolfCartNoShow'].includes(type)) {
        loadActiveBooking();
      }
    });
    return () => unsub();
  }, [selectedStopId]);

  const loadStops = async () => {
    try {
      const data = await api.getStops();
      setStops(data);
    } catch (err) {
      console.error('Error loading stops:', err);
    }
  };

  const loadActiveTrips = async () => {
    try {
      const data = await api.getActiveTrips();
      setActiveTrips(data);
    } catch (err) {
      console.error('Error loading trips:', err);
    }
  };

  const loadArrivals = async (stopId) => {
    setLoadingArrivals(true);
    try {
      const data = await api.getStopArrivals(stopId);
      setArrivals(data);
    } catch (err) {
      console.error('Error loading arrivals:', err);
    } finally {
      setLoadingArrivals(false);
    }
  };

  const loadActiveBooking = async () => {
    try {
      const b = await api.getActiveStudentBooking();
      setActiveBooking(b && b.id ? b : null);
    } catch (err) {
      console.error('Error loading active booking:', err);
    }
  };

  const handlePlanJourney = async () => {
    setJourneyLoading(true);
    try {
      const plan = await api.getJourney(journeyFromId, journeyToId);
      setJourneyPlan(plan);
    } catch (err) {
      console.error('Error planning journey:', err);
    } finally {
      setJourneyLoading(false);
    }
  };

  const handleCreateBooking = async (e) => {
    e.preventDefault();
    setBookingLoading(true);
    setBookingError('');
    setBookingSuccess('');
    try {
      const booking = await api.createBooking(
        bookingPickupId,
        bookingDropId,
        passengerCount,
        isPriority,
        priorityReason
      );
      setActiveBooking(booking);
      setBookingSuccess(`Booking #${booking.id} created successfully! State: ${booking.status}`);
    } catch (err) {
      setBookingError(err.message || 'Failed to request golf cart');
    } finally {
      setBookingLoading(false);
    }
  };

  const handleCancelBooking = async () => {
    if (!activeBooking) return;
    try {
      await api.updateBookingStatus(activeBooking.id, 'CANCEL', 'Student cancelled');
      setActiveBooking(null);
      setBookingSuccess('Booking successfully cancelled.');
    } catch (err) {
      setBookingError(err.message || 'Failed to cancel booking');
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 py-6">
      {/* Top Banner / Welcome */}
      <div className="glass-panel rounded-2xl p-5 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-white">Student Transport Hub</h2>
            {currentUser?.is_priority && (
              <span className="flex items-center gap-1 text-[11px] font-semibold bg-emerald-950 text-emerald-400 border border-emerald-500/40 px-2 py-0.5 rounded-full">
                <HeartHandshake className="w-3.5 h-3.5" /> Priority Access
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Real-time shuttle arrivals, crowding levels, multimodal journey planner, and instant golf cart booking.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (selectedStopId) loadArrivals(selectedStopId);
              loadActiveBooking();
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-xs text-slate-200 transition-all border border-slate-700/60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingArrivals ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      {/* Interactive Map Visualizer */}
      <CampusMapVisual
        selectedStopId={selectedStopId}
        onSelectStop={(id) => {
          setSelectedStopId(id);
          setJourneyFromId(id);
          setBookingPickupId(id);
        }}
        activeTrips={activeTrips}
        stops={stops}
      />

      {/* Main Grid: Arrivals Board & Journey Planner / Golf Cart */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (Arrivals Board - 7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="glass-panel rounded-2xl p-5 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bus className="w-5 h-5 text-blue-400" />
                <h3 className="text-base font-bold text-white">Live Arrivals Board</h3>
              </div>
              <span className="text-xs font-mono text-slate-400">
                {arrivals.length} upcoming shuttles
              </span>
            </div>

            {/* Stop Selector Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none">
              {stops.map((stop) => (
                <button
                  key={stop.id}
                  onClick={() => setSelectedStopId(stop.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all border ${
                    selectedStopId === stop.id
                      ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/20'
                      : 'glass-card border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                  }`}
                >
                  {stop.name}
                </button>
              ))}
            </div>

            {/* Arrivals List */}
            {loadingArrivals ? (
              <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
                <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
                <span className="text-xs">Calculating live ETAs & segment dwell times...</span>
              </div>
            ) : arrivals.length === 0 ? (
              <div className="py-10 text-center text-slate-500 text-xs">
                No active shuttles currently routed to this stop.
              </div>
            ) : (
              <div className="space-y-3">
                {arrivals.map((arr) => {
                  const isFull = arr.crowd_level === 'FULL';
                  return (
                    <div
                      key={arr.trip_id}
                      className={`p-4 rounded-xl border transition-all glass-card ${
                        isFull
                          ? 'border-rose-500/40 bg-rose-950/20'
                          : 'border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-xs shadow"
                            style={{ backgroundColor: arr.route_color || '#3B82F6' }}
                          >
                            {arr.route_code}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-bold text-white">{arr.route_name}</h4>
                              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                                {arr.vehicle_number}
                              </span>
                            </div>
                            <p className="text-xs text-slate-400 mt-0.5">
                              {arr.current_stop_name ? `Currently near ${arr.current_stop_name}` : 'Departing soon'}
                            </p>
                          </div>
                        </div>

                        {/* Crowd Badge */}
                        <CrowdBadge
                          level={arr.crowd_level}
                          passengerCount={arr.current_passenger_count}
                          capacity={35}
                        />
                      </div>

                      {/* Status / ETA footer */}
                      <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5">
                          {arr.is_live ? (
                            <>
                              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                              <span className="font-semibold text-emerald-400">
                                {arr.status_label}
                              </span>
                            </>
                          ) : (
                            <>
                              <span className="w-2 h-2 rounded-full bg-amber-400" />
                              <span className="text-amber-400 font-medium">
                                {arr.status_label}
                              </span>
                            </>
                          )}
                        </div>

                        {arr.current_delay_sec > 60 && (
                          <span className="text-amber-400 font-medium">
                            +{Math.round(arr.current_delay_sec / 60)} min delay
                          </span>
                        )}
                      </div>

                      {/* Full Warning Callout */}
                      {isFull && (
                        <div className="mt-2.5 p-2 rounded-lg bg-rose-950/60 border border-rose-800/40 text-[11px] text-rose-300 flex items-center justify-between">
                          <span>⚠️ Shuttle is full. Recommend booking Golf Cart or E-Rickshaw.</span>
                          <button
                            onClick={() => {
                              setJourneyFromId(selectedStopId);
                              handlePlanJourney();
                            }}
                            className="text-white underline font-semibold ml-2 hover:text-rose-200"
                          >
                            Find Alternative
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Multimodal Journey Planner & Golf Cart Booking (5 Cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Active Booking Live Tracking Card */}
          {activeBooking && (
            <div className="glass-panel rounded-2xl p-5 border border-indigo-500/40 bg-indigo-950/30 space-y-3 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Car className="w-5 h-5 text-indigo-400 animate-bounce-short" />
                  <h3 className="text-sm font-bold text-white">Active Golf Cart Ride</h3>
                </div>
                <span className="text-xs font-bold uppercase px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                  {activeBooking.status}
                </span>
              </div>

              {/* Progress Steps */}
              <div className="grid grid-cols-4 gap-1 text-center text-[10px] py-1 font-semibold">
                <div className={`p-1.5 rounded ${['REQUESTED', 'ACCEPTED', 'ARRIVING', 'PICKED_UP', 'COMPLETED'].includes(activeBooking.status) ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-500'}`}>
                  Requested
                </div>
                <div className={`p-1.5 rounded ${['ACCEPTED', 'ARRIVING', 'PICKED_UP', 'COMPLETED'].includes(activeBooking.status) ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-500'}`}>
                  Accepted
                </div>
                <div className={`p-1.5 rounded ${['ARRIVING', 'PICKED_UP', 'COMPLETED'].includes(activeBooking.status) ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-500'}`}>
                  Arriving
                </div>
                <div className={`p-1.5 rounded ${['PICKED_UP', 'COMPLETED'].includes(activeBooking.status) ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-500'}`}>
                  Onboard
                </div>
              </div>

              <div className="text-xs space-y-1.5 text-slate-300 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
                <div className="flex justify-between">
                  <span className="text-slate-400">Pickup:</span>
                  <span className="font-semibold text-white">{activeBooking.pickup_stop?.name || `Stop #${activeBooking.pickup_stop_id}`}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Destination:</span>
                  <span className="font-semibold text-white">{activeBooking.drop_stop?.name || `Stop #${activeBooking.drop_stop_id}`}</span>
                </div>
                {activeBooking.assigned_cart && (
                  <div className="flex justify-between text-indigo-300">
                    <span>Assigned Vehicle:</span>
                    <span className="font-mono font-bold">{activeBooking.assigned_cart.cart_code} ({activeBooking.assigned_cart.capacity} seats)</span>
                  </div>
                )}
                {activeBooking.status === 'REQUESTED' && activeBooking.queue_position > 0 && (
                  <div className="flex justify-between text-amber-300 font-semibold">
                    <span>Queue Position:</span>
                    <span>#{activeBooking.queue_position} (~{activeBooking.estimated_wait_mins} min wait)</span>
                  </div>
                )}
                {activeBooking.status === 'ARRIVING' && (
                  <div className="p-2 rounded bg-amber-950/80 border border-amber-600/40 text-[11px] text-amber-300">
                    ⏱️ Cart arrived! 5-minute boarding window active before auto no-show cancellation.
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-1">
                <button
                  onClick={handleCancelBooking}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-400 hover:bg-rose-950/60 border border-rose-800/40 transition-colors"
                >
                  Cancel Ride
                </button>
              </div>
            </div>
          )}

          {/* Multimodal Journey Planner */}
          <div className="glass-panel rounded-2xl p-5 border border-slate-800 space-y-4">
            <div className="flex items-center gap-2">
              <Navigation className="w-5 h-5 text-indigo-400" />
              <h3 className="text-base font-bold text-white">Multimodal Journey Planner</h3>
            </div>
            <p className="text-xs text-slate-400">
              Combines live shuttles with last-mile golf carts or e-rickshaws, automatically rerouting if shuttles are full.
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                  From (Origin)
                </label>
                <select
                  value={journeyFromId}
                  onChange={(e) => setJourneyFromId(parseInt(e.target.value, 10))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                >
                  {stops.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                  To (Destination)
                </label>
                <select
                  value={journeyToId}
                  onChange={(e) => setJourneyToId(parseInt(e.target.value, 10))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                >
                  {stops.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <button
              onClick={handlePlanJourney}
              disabled={journeyLoading || journeyFromId === journeyToId}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-xs shadow-lg shadow-indigo-500/20 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
            >
              {journeyLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Navigation className="w-4 h-4" />}
              Find Optimal Journey
            </button>

            {/* Journey Result Directive */}
            {journeyPlan && (
              <div className="p-4 rounded-xl border border-indigo-500/30 bg-slate-900/90 space-y-3 mt-3">
                <div className="flex items-start gap-2.5">
                  <div className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-400 shrink-0">
                    <Navigation className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                      Journey Directive
                    </h4>
                    <p className="text-xs text-slate-200 mt-1 leading-relaxed">
                      {journeyPlan.recommendation_summary}
                    </p>
                  </div>
                </div>

                {/* Shuttle Leg */}
                {journeyPlan.shuttle_leg && (
                  <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800 text-xs flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-white">{journeyPlan.shuttle_leg.route_name}</span>
                      <p className="text-[11px] text-slate-400">ETA ~{journeyPlan.shuttle_leg.live_eta_minutes} min</p>
                    </div>
                    <CrowdBadge level={journeyPlan.shuttle_leg.crowd_level} />
                  </div>
                )}

                {/* Last Mile Options */}
                {journeyPlan.last_mile_option && (
                  <div className="p-3 rounded-lg bg-indigo-950/40 border border-indigo-800/40 text-xs flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-indigo-200">{journeyPlan.last_mile_option.description}</span>
                      <p className="text-[11px] text-indigo-300/80">Wait: ~{journeyPlan.last_mile_option.estimated_wait_minutes} min</p>
                    </div>
                    {journeyPlan.last_mile_option.bookable && !activeBooking && (
                      <button
                        onClick={() => {
                          setBookingPickupId(journeyFromId);
                          setBookingDropId(journeyToId);
                        }}
                        className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold transition-all"
                      >
                        Book Cart
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Book a Golf Cart Form */}
          {!activeBooking && (
            <form onSubmit={handleCreateBooking} className="glass-panel rounded-2xl p-5 border border-slate-800 space-y-4">
              <div className="flex items-center gap-2">
                <Car className="w-5 h-5 text-indigo-400" />
                <h3 className="text-base font-bold text-white">Book Campus Golf Cart</h3>
              </div>

              {bookingError && (
                <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{bookingError}</span>
                </div>
              )}

              {bookingSuccess && (
                <div className="p-3 rounded-xl bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 shrink-0" />
                  <span>{bookingSuccess}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                    Pickup Stop
                  </label>
                  <select
                    value={bookingPickupId}
                    onChange={(e) => setBookingPickupId(parseInt(e.target.value, 10))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  >
                    {stops.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                    Drop Stop
                  </label>
                  <select
                    value={bookingDropId}
                    onChange={(e) => setBookingDropId(parseInt(e.target.value, 10))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  >
                    {stops.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Passengers & Priority */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                    Passengers
                  </label>
                  <select
                    value={passengerCount}
                    onChange={(e) => setPassengerCount(parseInt(e.target.value, 10))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                  >
                    <option value={1}>1 Seat</option>
                    <option value={2}>2 Seats</option>
                    <option value={3}>3 Seats</option>
                    <option value={4}>4 Seats</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                    Priority Queue
                  </label>
                  <div className="flex items-center gap-2 mt-2">
                    <input
                      type="checkbox"
                      id="priorityCheck"
                      checked={isPriority}
                      onChange={(e) => setIsPriority(e.target.checked)}
                      className="w-4 h-4 rounded text-indigo-600 bg-slate-900 border-slate-700"
                    />
                    <label htmlFor="priorityCheck" className="text-xs text-slate-300">
                      Medical / Disabled
                    </label>
                  </div>
                </div>
              </div>

              {isPriority && (
                <div>
                  <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                    Priority Reason / Verification Note
                  </label>
                  <input
                    type="text"
                    value={priorityReason}
                    onChange={(e) => setPriorityReason(e.target.value)}
                    placeholder="e.g. Medical Need - Hospital to Academic Block"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={bookingLoading || bookingPickupId === bookingDropId}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold text-xs shadow-lg shadow-indigo-500/20 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
              >
                {bookingLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Car className="w-4 h-4" />}
                Request Golf Cart Dispatch
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
