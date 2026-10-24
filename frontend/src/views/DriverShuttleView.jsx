import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { sseClient } from '../api/sse';
import CrowdBadge from '../components/CrowdBadge';
import {
  Bus, RotateCcw, AlertTriangle, CheckCircle2, Play, ArrowRight,
  Users, RefreshCw, XCircle, Gauge
} from 'lucide-react';

export default function DriverShuttleView() {
  const [activeTrips, setActiveTrips] = useState([]);
  const [selectedTripId, setSelectedTripId] = useState(null);
  const [trip, setTrip] = useState(null);
  const [stops, setStops] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState('');

  useEffect(() => {
    loadTrips();
    loadStops();
  }, []);

  useEffect(() => {
    if (selectedTripId) {
      loadTripDetails(selectedTripId);
    }
  }, [selectedTripId]);

  // Subscribe to live SSE updates
  useEffect(() => {
    const unsub = sseClient.subscribe((event) => {
      if (['TripStarted', 'TripProgressUpdated', 'CrowdUpdated', 'TripCancelled', 'TripCompleted'].includes(event.event_type)) {
        if (selectedTripId) loadTripDetails(selectedTripId);
      }
    });
    return () => unsub();
  }, [selectedTripId]);

  const loadStops = async () => {
    try {
      const data = await api.getStops();
      setStops(data);
    } catch (err) {
      console.error(err);
    }
  };

  const loadTrips = async () => {
    try {
      const trips = await api.getActiveTrips();
      setActiveTrips(trips);
      if (trips.length > 0 && !selectedTripId) {
        setSelectedTripId(trips[0].id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const loadTripDetails = async (id) => {
    try {
      const data = await api.getTrip(id);
      setTrip(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleStartTrip = async () => {
    if (!trip) return;
    setLoading(true);
    try {
      const updated = await api.startTrip(trip.id, 1);
      setTrip(updated);
      flashMessage('Trip Started Successfully! Live telemetry streaming.');
    } catch (err) {
      flashMessage(`Error starting trip: ${err.message}`, true);
    } finally {
      setLoading(false);
    }
  };

  const handleProgressNextStop = async () => {
    if (!trip) return;
    const nextStopId = trip.next_stop_id || 1;
    setLoading(true);
    try {
      const updated = await api.progressTrip(trip.id, nextStopId, trip.current_passenger_count, 0);
      setTrip(updated);
      flashMessage(`Advanced to Stop #${nextStopId}. Status: AT_STOP`);
    } catch (err) {
      flashMessage(`Error advancing stop: ${err.message}`, true);
    } finally {
      setLoading(false);
    }
  };

  const handleSetCrowd = async (paxCount) => {
    if (!trip) return;
    setLoading(true);
    try {
      const updated = await api.updateCrowd(trip.id, paxCount);
      setTrip(updated);
      flashMessage(`Crowd updated: ${paxCount} passengers (${updated.current_crowd_level})`);
    } catch (err) {
      flashMessage(`Error updating crowd: ${err.message}`, true);
    } finally {
      setLoading(false);
    }
  };

  const handleUndo = async () => {
    if (!trip) return;
    setLoading(true);
    try {
      const updated = await api.undoTrip(trip.id);
      setTrip(updated);
      flashMessage('Mis-tap reverted! Restored previous state & passenger count.');
    } catch (err) {
      flashMessage(`Undo error: ${err.message}`, true);
    } finally {
      setLoading(false);
    }
  };

  const handleEndTrip = async () => {
    if (!trip) return;
    setLoading(true);
    try {
      const updated = await api.endTrip(trip.id);
      setTrip(updated);
      flashMessage('Trip completed! Shuttle is now available for next scheduled route.');
    } catch (err) {
      flashMessage(`Error ending trip: ${err.message}`, true);
    } finally {
      setLoading(false);
    }
  };

  const flashMessage = (msg, isError = false) => {
    setActionMessage({ text: msg, isError });
    setTimeout(() => setActionMessage(''), 5000);
  };

  const getStopName = (stopId) => {
    const s = stops.find((item) => item.id === stopId);
    return s ? s.name : `Stop #${stopId}`;
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Driver Console Header */}
      <div className="glass-panel rounded-2xl p-5 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-blue-600/20 text-blue-400 flex items-center justify-center font-bold text-2xl border border-blue-500/30">
            🚌
          </div>
          <div>
            <h2 className="text-xl font-black text-white tracking-tight">Shuttle Driver Console</h2>
            <p className="text-xs text-slate-400">High-touch operational interface with mis-tap undo protection</p>
          </div>
        </div>

        {/* Vehicle / Trip Selector */}
        <div className="flex items-center gap-2">
          <select
            value={selectedTripId || ''}
            onChange={(e) => setSelectedTripId(parseInt(e.target.value, 10))}
            className="bg-slate-900 border border-slate-700 text-xs text-white rounded-xl px-3 py-2 font-mono"
          >
            {activeTrips.map((t) => (
              <option key={t.id} value={t.id}>
                Trip #{t.id} ({t.shuttle?.vehicle_number || 'Shuttle'}) - {t.status}
              </option>
            ))}
          </select>
        </div>
      </div>

      {actionMessage && (
        <div
          className={`p-4 rounded-xl border text-sm font-semibold flex items-center gap-2 animate-bounce-short ${
            actionMessage.isError
              ? 'bg-rose-950/80 border-rose-500/40 text-rose-300'
              : 'bg-emerald-950/80 border-emerald-500/40 text-emerald-300'
          }`}
        >
          {actionMessage.isError ? <AlertTriangle className="w-5 h-5 shrink-0" /> : <CheckCircle2 className="w-5 h-5 shrink-0" />}
          <span>{actionMessage.text}</span>
        </div>
      )}

      {trip ? (
        <div className="space-y-6">
          {/* Real-time Status Card */}
          <div className="glass-panel rounded-2xl p-6 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-mono text-blue-400 uppercase tracking-widest font-bold">
                  Vehicle: {trip.shuttle?.vehicle_number || 'PB-08-LP-101'}
                </span>
                <h3 className="text-2xl font-black text-white mt-1">
                  {trip.current_stop_id ? getStopName(trip.current_stop_id) : 'At Depot / Start'}
                </h3>
                <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                  <span>Next Target:</span>
                  <span className="text-indigo-300 font-semibold">{trip.next_stop_id ? getStopName(trip.next_stop_id) : 'End of Loop'}</span>
                </p>
              </div>

              <div className="text-right">
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                  Status: {trip.status}
                </span>
                <div className="mt-2">
                  <CrowdBadge
                    level={trip.current_crowd_level}
                    passengerCount={trip.current_passenger_count}
                    capacity={trip.shuttle?.capacity || 35}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* LARGE TOUCH-BUTTON ACTIONS */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Start Trip / Progress Stop Button */}
            {['SCHEDULED', 'COMPLETED', 'CANCELLED'].includes(trip.status) ? (
              <button
                onClick={handleStartTrip}
                disabled={loading}
                className="h-28 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xl shadow-xl shadow-emerald-600/20 flex flex-col items-center justify-center gap-2 active:scale-95 transition-all"
              >
                <Play className="w-8 h-8 fill-white" />
                START SHUTTLE ROUTE
              </button>
            ) : (
              <button
                onClick={handleProgressNextStop}
                disabled={loading || !trip.next_stop_id}
                className="h-28 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-lg shadow-xl shadow-blue-600/20 flex flex-col items-center justify-center gap-1 active:scale-95 transition-all"
              >
                <ArrowRight className="w-8 h-8" />
                <span>NEXT STOP: {trip.next_stop_id ? getStopName(trip.next_stop_id) : 'LOOP END'}</span>
                <span className="text-xs opacity-75 font-normal">Advance route & update ETA</span>
              </button>
            )}

            {/* End Trip Button */}
            <button
              onClick={handleEndTrip}
              disabled={loading || ['COMPLETED', 'SCHEDULED'].includes(trip.status)}
              className="h-28 rounded-2xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 font-bold text-lg border border-slate-700 flex flex-col items-center justify-center gap-2 active:scale-95 transition-all"
            >
              <CheckCircle2 className="w-7 h-7 text-emerald-400" />
              COMPLETE TRIP LOOP
            </button>
          </div>

          {/* QUICK CROWD OCCUPANCY BUTTONS */}
          <div className="glass-panel rounded-2xl p-5 border border-slate-800 space-y-3">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Users className="w-4 h-4 text-indigo-400" /> Quick Crowd Assessment
            </h4>
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => handleSetCrowd(10)}
                className={`py-4 rounded-xl border text-sm font-bold flex flex-col items-center justify-center gap-1 active:scale-95 transition-all ${
                  trip.current_crowd_level === 'LOW'
                    ? 'bg-emerald-950 border-emerald-500 text-emerald-300 ring-2 ring-emerald-500/50'
                    : 'glass-card border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <span className="text-lg">🟢</span>
                <span>Low Crowd</span>
                <span className="text-[10px] font-mono opacity-75">~10 Pax (&lt;40%)</span>
              </button>

              <button
                onClick={() => handleSetCrowd(20)}
                className={`py-4 rounded-xl border text-sm font-bold flex flex-col items-center justify-center gap-1 active:scale-95 transition-all ${
                  trip.current_crowd_level === 'MODERATE'
                    ? 'bg-amber-950 border-amber-500 text-amber-300 ring-2 ring-amber-500/50'
                    : 'glass-card border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <span className="text-lg">🟡</span>
                <span>Moderate</span>
                <span className="text-[10px] font-mono opacity-75">~20 Pax (40-80%)</span>
              </button>

              <button
                onClick={() => handleSetCrowd(31)}
                className={`py-4 rounded-xl border text-sm font-bold flex flex-col items-center justify-center gap-1 active:scale-95 transition-all ${
                  trip.current_crowd_level === 'FULL'
                    ? 'bg-rose-950 border-rose-500 text-rose-300 ring-2 ring-rose-500/50'
                    : 'glass-card border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <span className="text-lg">🔴</span>
                <span>Full / Rush</span>
                <span className="text-[10px] font-mono opacity-75">~31 Pax (&gt;80%)</span>
              </button>
            </div>
          </div>

          {/* MIS-TAP UNDO FEATURE */}
          <div className="glass-panel rounded-2xl p-5 border border-amber-500/30 bg-amber-950/10 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h4 className="text-sm font-bold text-amber-300 flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-amber-400" /> Driver Mis-Tap Protection
              </h4>
              <p className="text-xs text-slate-400 mt-0.5">
                Accidentally tapped Next Stop or Crowd? Instantly roll back to previous stop and state.
              </p>
            </div>
            <button
              onClick={handleUndo}
              disabled={loading}
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-amber-600/20 active:scale-95 transition-all shrink-0"
            >
              <RotateCcw className="w-4 h-4" /> UNDO LAST ACTION
            </button>
          </div>
        </div>
      ) : (
        <div className="py-20 text-center text-slate-500 text-sm">
          No shuttle trips selected or available.
        </div>
      )}
    </div>
  );
}
