import React, { useEffect, useState } from 'react';
import { sseClient } from '../api/sse';
import { Bell, CheckCircle2, AlertCircle, X } from 'lucide-react';

export default function NotificationToast() {
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    const unsubscribe = sseClient.subscribe((event) => {
      let toast = null;
      const type = event.event_type;
      const p = event.payload || {};

      if (type === 'TripProgressUpdated' && p.delay_sec > 60) {
        toast = {
          id: Date.now(),
          title: 'Shuttle Delay Reported',
          message: `Shuttle delayed by ~${Math.round(p.delay_sec / 60)} min near stop.`,
          type: 'warning'
        };
      } else if (type === 'CrowdUpdated' && p.crowd_level === 'FULL') {
        toast = {
          id: Date.now(),
          title: 'Shuttle At Full Capacity',
          message: `Trip #${p.trip_id} is FULL (${p.passenger_count}/${p.capacity}). Diversion to Golf Carts recommended.`,
          type: 'danger'
        };
      } else if (type === 'GolfCartAssigned') {
        toast = {
          id: Date.now(),
          title: 'Golf Cart Assigned!',
          message: `Cart ${p.cart_code} assigned to Booking #${p.booking_id}. ETA ~${p.estimated_wait_mins} min.`,
          type: 'success'
        };
      } else if (type === 'GolfCartStatusUpdated' && p.action === 'ARRIVING') {
        toast = {
          id: Date.now(),
          title: 'Golf Cart Has Arrived',
          message: `Your golf cart has arrived at pickup. Please board within 5 minutes.`,
          type: 'success'
        };
      } else if (type === 'GolfCartNoShow') {
        toast = {
          id: Date.now(),
          title: 'Booking Expired (No-Show)',
          message: `Booking #${p.booking_id} cancelled as student did not board within 5 minutes.`,
          type: 'danger'
        };
      }

      if (toast) {
        setNotifications((prev) => [toast, ...prev.slice(0, 3)]);
        setTimeout(() => {
          setNotifications((current) => current.filter((n) => n.id !== toast.id));
        }, 6000);
      }
    });

    return () => unsubscribe();
  }, []);

  if (notifications.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full px-4 sm:px-0">
      {notifications.map((n) => (
        <div
          key={n.id}
          className={`p-3.5 rounded-xl border shadow-xl flex items-start gap-3 transition-all transform animate-bounce-short ${
            n.type === 'success'
              ? 'bg-emerald-950/90 border-emerald-500/40 text-emerald-200'
              : n.type === 'warning'
              ? 'bg-amber-950/90 border-amber-500/40 text-amber-200'
              : n.type === 'danger'
              ? 'bg-rose-950/90 border-rose-500/40 text-rose-200'
              : 'bg-slate-900/90 border-slate-700 text-slate-200'
          }`}
        >
          {n.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />}
          {n.type === 'warning' && <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />}
          {n.type === 'danger' && <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />}
          <div className="flex-1">
            <h4 className="text-xs font-semibold tracking-wide uppercase">{n.title}</h4>
            <p className="text-xs opacity-90 mt-0.5 leading-snug">{n.message}</p>
          </div>
          <button
            onClick={() => setNotifications((curr) => curr.filter((item) => item.id !== n.id))}
            className="text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
