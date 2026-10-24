import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { sseClient } from '../api/sse';
import {
  Car, CheckCircle2, XCircle, MapPin, Navigation, Clock,
  AlertCircle, Users, HeartHandshake, RefreshCw
} from 'lucide-react';

export default function DriverCartView() {
  const [assignedBooking, setAssignedBooking] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadAssignedBooking();
  }, []);

  useEffect(() => {
    const unsub = sseClient.subscribe((event) => {
      if (['GolfCartAssigned', 'GolfCartStatusUpdated', 'GolfCartNoShow'].includes(event.event_type)) {
        loadAssignedBooking();
      }
    });
    return () => unsub();
  }, []);

  const loadAssignedBooking = async () => {
    try {
      const b = await api.getAssignedDriverBooking();
      setAssignedBooking(b && b.id ? b : null);
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateStatus = async (action) => {
    if (!assignedBooking) return;
    setLoading(true);
    try {
      const updated = await api.updateBookingStatus(assignedBooking.id, action);
      if (['COMPLETE', 'REJECT', 'CANCEL', 'NO_SHOW'].includes(action)) {
        setAssignedBooking(null);
      } else {
        setAssignedBooking(updated);
      }
      flashMessage(`Status updated: ${action}`);
    } catch (err) {
      flashMessage(`Error: ${err.message}`, true);
    } finally {
      setLoading(false);
    }
  };

  const flashMessage = (msg, isError = false) => {
    setMessage({ text: msg, isError });
    setTimeout(() => setMessage(''), 4000);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Console Header */}
      <div className="glass-panel rounded-2xl p-5 border border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center font-bold text-2xl border border-indigo-500/30">
            🛺
          </div>
          <div>
            <h2 className="text-xl font-black text-white tracking-tight">Golf Cart Driver Console</h2>
            <p className="text-xs text-slate-400">Assigned Vehicle: GC-01 (4 Seats) | Status: Operational</p>
          </div>
        </div>

        <button
          onClick={loadAssignedBooking}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-xs text-slate-200 border border-slate-700"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {message && (
        <div
          className={`p-4 rounded-xl border text-sm font-semibold flex items-center gap-2 animate-bounce-short ${
            message.isError
              ? 'bg-rose-950/80 border-rose-500/40 text-rose-300'
              : 'bg-emerald-950/80 border-emerald-500/40 text-emerald-300'
          }`}
        >
          {message.isError ? <AlertCircle className="w-5 h-5 shrink-0" /> : <CheckCircle2 className="w-5 h-5 shrink-0" />}
          <span>{message.text}</span>
        </div>
      )}

      {/* Incoming / Assigned Dispatch Card */}
      {assignedBooking ? (
        <div className="glass-panel rounded-2xl p-6 border border-indigo-500/50 bg-indigo-950/20 space-y-5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-emerald-400 animate-ping" />
              <h3 className="text-lg font-bold text-white">Ride Dispatch #{assignedBooking.id}</h3>
            </div>
            <div className="flex items-center gap-2">
              {assignedBooking.is_priority && (
                <span className="flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-rose-950 text-rose-300 border border-rose-500/50 animate-pulse">
                  <HeartHandshake className="w-4 h-4" /> Medical / Priority
                </span>
              )}
              <span className="text-xs font-mono font-bold uppercase px-3 py-1 rounded-full bg-indigo-600 text-white">
                {assignedBooking.status}
              </span>
            </div>
          </div>

          {/* Trip Stops & Student Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="glass-card p-4 rounded-xl border border-slate-800 space-y-2">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <MapPin className="w-4 h-4 text-emerald-400" />
                <span className="font-semibold uppercase tracking-wider">Pickup Location</span>
              </div>
              <p className="text-base font-bold text-white">
                {assignedBooking.pickup_stop?.name || `Stop #${assignedBooking.pickup_stop_id}`}
              </p>
            </div>

            <div className="glass-card p-4 rounded-xl border border-slate-800 space-y-2">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Navigation className="w-4 h-4 text-indigo-400" />
                <span className="font-semibold uppercase tracking-wider">Destination</span>
              </div>
              <p className="text-base font-bold text-white">
                {assignedBooking.drop_stop?.name || `Stop #${assignedBooking.drop_stop_id}`}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-300 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-slate-400" />
              <span>Passengers: <strong className="text-white">{assignedBooking.passenger_count} Seat(s)</strong></span>
            </div>
            {assignedBooking.priority_reason && (
              <span className="text-amber-300 font-medium">Note: {assignedBooking.priority_reason}</span>
            )}
          </div>

          {/* 5-Min No Show Window Alert if ARRIVING */}
          {assignedBooking.status === 'ARRIVING' && (
            <div className="p-3.5 rounded-xl bg-amber-950/80 border border-amber-500/50 text-amber-200 text-xs flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-400" />
                <span>5-Minute No-Show Countdown active. If passenger does not arrive, cancel with No-Show.</span>
              </div>
              <button
                onClick={() => handleUpdateStatus('NO_SHOW')}
                className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold rounded text-xs"
              >
                Mark No-Show
              </button>
            </div>
          )}

          {/* LARGE TOUCH ACTION BUTTONS */}
          <div className="space-y-3 pt-2">
            {assignedBooking.status === 'REQUESTED' || assignedBooking.status === 'ACCEPTED' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  onClick={() => handleUpdateStatus('ARRIVING')}
                  disabled={loading}
                  className="h-24 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-lg flex flex-col items-center justify-center gap-1 shadow-xl shadow-blue-500/20 active:scale-95 transition-all"
                >
                  <MapPin className="w-7 h-7" />
                  ARRIVED AT PICKUP POINT
                  <span className="text-xs font-normal opacity-80">(Starts 5-Min Timer)</span>
                </button>

                <button
                  onClick={() => handleUpdateStatus('REJECT')}
                  disabled={loading}
                  className="h-24 rounded-2xl bg-slate-800 hover:bg-slate-700 text-rose-400 font-bold text-base flex flex-col items-center justify-center gap-1 border border-rose-500/30 active:scale-95 transition-all"
                >
                  <XCircle className="w-6 h-6" />
                  REJECT DISPATCH
                  <span className="text-xs font-normal opacity-75 text-slate-400">(Re-queues for other carts)</span>
                </button>
              </div>
            ) : assignedBooking.status === 'ARRIVING' ? (
              <button
                onClick={() => handleUpdateStatus('PICKED_UP')}
                disabled={loading}
                className="w-full h-24 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xl flex flex-col items-center justify-center gap-1 shadow-xl shadow-emerald-500/20 active:scale-95 transition-all"
              >
                <Users className="w-8 h-8" />
                PASSENGER ONBOARD (START TRIP)
              </button>
            ) : assignedBooking.status === 'PICKED_UP' ? (
              <button
                onClick={() => handleUpdateStatus('COMPLETE')}
                disabled={loading}
                className="w-full h-24 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-black text-xl flex flex-col items-center justify-center gap-1 shadow-xl shadow-indigo-500/20 active:scale-95 transition-all"
              >
                <CheckCircle2 className="w-8 h-8" />
                TRIP FINISHED (DROP-OFF COMPLETE)
              </button>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="glass-panel rounded-2xl p-12 text-center border border-slate-800 space-y-3">
          <div className="w-16 h-16 rounded-full bg-slate-800/80 mx-auto flex items-center justify-center text-3xl">
            🛺
          </div>
          <h3 className="text-lg font-bold text-white">No Assigned Bookings</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Your golf cart (GC-01) is currently marked <span className="text-emerald-400 font-bold">IDLE</span> and ready for incoming student dispatches.
          </p>
        </div>
      )}
    </div>
  );
}
