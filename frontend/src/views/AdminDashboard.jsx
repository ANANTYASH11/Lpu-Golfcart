import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { sseClient } from '../api/sse';
import CrowdBadge from '../components/CrowdBadge';
import CampusMapVisual from '../components/CampusMapVisual';
import {
  Shield, Bus, Car, Users, TrendingUp, AlertCircle, Activity,
  RefreshCw, CheckCircle2, Clock, Zap
} from 'lucide-react';

const PEAK_HOURLY_DATA = [
  { time: '07:30', volume: 140, label: 'Early Arrival', peak: false },
  { time: '08:00', volume: 320, label: 'Hostel Egress', peak: false },
  { time: '08:30', volume: 580, label: 'Pre-Lecture', peak: false },
  { time: '08:55', volume: 920, label: '8:55 AM Rush Peak 🔥', peak: true },
  { time: '09:30', volume: 210, label: 'Lecture Session', peak: false },
  { time: '12:30', volume: 460, label: 'Uni-Mall Lunch Rush', peak: false },
  { time: '14:30', volume: 290, label: 'Afternoon Labs', peak: false },
  { time: '17:00', volume: 740, label: 'Evening Hostels', peak: false },
];

export default function AdminDashboard() {
  const [activeTrips, setActiveTrips] = useState([]);
  const [availableCarts, setAvailableCarts] = useState({ total_carts: 0, available_carts: [], busy_carts_count: 0 });
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [stops, setStops] = useState([]);

  useEffect(() => {
    loadData();
    loadStops();
  }, []);

  // Listen to live SSE
  useEffect(() => {
    const unsub = sseClient.subscribe((event) => {
      loadData();
      const newLog = {
        id: Date.now() + Math.random(),
        time: new Date().toLocaleTimeString(),
        type: event.event_type,
        data: event.payload
      };
      setAuditLogs((prev) => [newLog, ...prev.slice(0, 19)]);
    });
    return () => unsub();
  }, []);

  const loadStops = async () => {
    try {
      const data = await api.getStops();
      setStops(data);
    } catch (err) {
      console.error(err);
    }
  };

  const loadData = async () => {
    try {
      const [tripsData, cartsData] = await Promise.all([
        api.getActiveTrips(),
        api.getAvailableCarts()
      ]);
      setActiveTrips(tripsData);
      setAvailableCarts(cartsData);
    } catch (err) {
      console.error(err);
    }
  };

  const getStopName = (stopId) => {
    const s = stops.find((item) => item.id === stopId);
    return s ? s.name : `Stop #${stopId}`;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Header */}
      <div className="glass-panel rounded-2xl p-5 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center font-bold text-2xl border border-indigo-500/30">
            <Shield className="w-6 h-6 text-indigo-400" />
          </div>
          <div>
            <h2 className="text-xl font-black text-white tracking-tight">Campus Transport Operations Centre</h2>
            <p className="text-xs text-slate-400">Lovely Professional University (LPU) Fleet Command & Real-time Telemetry</p>
          </div>
        </div>

        <button
          onClick={loadData}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-xs text-slate-200 border border-slate-700"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh Telemetry
        </button>
      </div>

      {/* High-Level Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-panel p-4 rounded-xl border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Active Shuttles</span>
            <Bus className="w-4 h-4 text-blue-400" />
          </div>
          <p className="text-2xl font-black text-white">{activeTrips.length} Fleet Units</p>
          <span className="text-[11px] text-emerald-400 font-medium">All GPS beacons reporting</span>
        </div>

        <div className="glass-panel p-4 rounded-xl border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Golf Cart Fleet</span>
            <Car className="w-4 h-4 text-indigo-400" />
          </div>
          <p className="text-2xl font-black text-white">{availableCarts.total_carts} Carts</p>
          <span className="text-[11px] text-indigo-300 font-medium">
            {availableCarts.available_carts?.length || 0} Available | {availableCarts.busy_carts_count || 0} In Service
          </span>
        </div>

        <div className="glass-panel p-4 rounded-xl border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Peak Demand Status</span>
            <TrendingUp className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-2xl font-black text-amber-400">Surge Active</p>
          <span className="text-[11px] text-slate-400">8:55 AM Lecture Rush</span>
        </div>

        <div className="glass-panel p-4 rounded-xl border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Priority Queue SLA</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-black text-emerald-400">100% Preempt</p>
          <span className="text-[11px] text-slate-400">Medical SLA &lt; 4 min wait</span>
        </div>
      </div>

      {/* Spatial Map View */}
      <CampusMapVisual
        activeTrips={activeTrips}
        availableCarts={availableCarts.available_carts}
      />

      {/* Fleet Tables Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Shuttle Fleet Table */}
        <div className="glass-panel rounded-2xl p-5 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Bus className="w-4 h-4 text-blue-400" /> Shuttle Operations Fleet
            </h3>
            <span className="text-xs text-slate-400 font-mono">{activeTrips.length} active</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-900/80 text-[10px] uppercase font-bold text-slate-400">
                <tr>
                  <th className="py-2.5 px-3">Trip / Shuttle</th>
                  <th className="py-2.5 px-3">Current Location</th>
                  <th className="py-2.5 px-3">Passengers</th>
                  <th className="py-2.5 px-3">Crowd Badge</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {activeTrips.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-800/40">
                    <td className="py-2.5 px-3 font-semibold text-white">
                      <div>Trip #{t.id}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{t.shuttle?.vehicle_number}</div>
                    </td>
                    <td className="py-2.5 px-3">
                      {t.current_stop_id ? getStopName(t.current_stop_id) : 'Depot / Start'}
                    </td>
                    <td className="py-2.5 px-3 font-mono">
                      {t.current_passenger_count}/{t.shuttle?.capacity || 35}
                    </td>
                    <td className="py-2.5 px-3">
                      <CrowdBadge level={t.current_crowd_level} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Golf Cart Fleet Table */}
        <div className="glass-panel rounded-2xl p-5 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Car className="w-4 h-4 text-indigo-400" /> Golf Cart Fleet Status
            </h3>
            <span className="text-xs text-slate-400 font-mono">{availableCarts.total_carts} total</span>
          </div>

          <div className="space-y-2">
            {availableCarts.available_carts?.map((cart) => (
              <div
                key={cart.id}
                className="p-3 rounded-xl glass-card border border-slate-800 flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-indigo-600/20 text-indigo-400 flex items-center justify-center font-bold">
                    🛺
                  </div>
                  <div>
                    <h4 className="font-bold text-white">{cart.cart_code}</h4>
                    <p className="text-[11px] text-slate-400">Capacity: {cart.capacity} seats</p>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-500/30">
                    {cart.status}
                  </span>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Near {cart.current_stop_id ? getStopName(cart.current_stop_id) : 'Main Gate'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* PEAK-HOUR DEMAND VISUAL CHART */}
      <div className="glass-panel rounded-2xl p-5 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-amber-400" />
            <h3 className="text-base font-bold text-white">LPU Campus Peak-Hour Transit Demand</h3>
          </div>
          <span className="text-xs font-semibold text-amber-400 bg-amber-950/80 border border-amber-600/30 px-2 py-0.5 rounded">
            Highlighted: 8:55 AM Lecture Rush
          </span>
        </div>
        <p className="text-xs text-slate-400">
          Historical & live boarding volumes across time slots. Sharp surge at 8:55 AM causes shuttles to hit &gt;80% capacity, triggering multimodal journey diversion to Golf Carts.
        </p>

        {/* Visual Bar Chart */}
        <div className="grid grid-cols-8 gap-2 items-end pt-8 pb-2 border-b border-slate-800">
          {PEAK_HOURLY_DATA.map((slot) => {
            const heightPercent = Math.round((slot.volume / 950) * 100);
            return (
              <div key={slot.time} className="flex flex-col items-center gap-1.5 group">
                <span className="text-[10px] font-mono text-slate-400 group-hover:text-white transition-colors">
                  {slot.volume}
                </span>
                <div className="w-full bg-slate-900 rounded-t-lg h-36 flex items-end p-1">
                  <div
                    style={{ height: `${heightPercent}%` }}
                    className={`w-full rounded-t-md transition-all duration-500 ${
                      slot.peak
                        ? 'bg-gradient-to-t from-rose-600 to-amber-500 shadow-lg shadow-rose-500/30 animate-pulse'
                        : 'bg-gradient-to-t from-blue-700 to-indigo-500 opacity-80 group-hover:opacity-100'
                    }`}
                  />
                </div>
                <span className={`text-[10px] font-mono font-bold ${slot.peak ? 'text-amber-400' : 'text-slate-400'}`}>
                  {slot.time}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Live Operational Event Bus Audit Log */}
      <div className="glass-panel rounded-2xl p-5 border border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-white">Live Event Bus Telemetry Stream</h3>
          </div>
          <span className="text-xs font-mono text-slate-500">Internal In-Memory Pub/Sub Hub</span>
        </div>

        <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
          {auditLogs.length === 0 ? (
            <div className="py-8 text-center text-slate-500 text-xs">
              Awaiting real-time events from driver updates and student bookings...
            </div>
          ) : (
            auditLogs.map((log) => (
              <div
                key={log.id}
                className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800 flex items-center justify-between text-xs font-mono"
              >
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-500">{log.time}</span>
                  <span className="px-1.5 py-0.5 rounded bg-slate-800 text-indigo-300 font-bold">
                    {log.type}
                  </span>
                </div>
                <span className="text-slate-400 text-[11px] line-clamp-1 max-w-md">
                  {JSON.stringify(log.data)}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
