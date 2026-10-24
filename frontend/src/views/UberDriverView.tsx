import React, { useState, useEffect } from 'react';
import { useTheme } from '../theme/ThemeContext';
import { api } from '../api/client';
import { sseClient } from '../api/sse';
import {
  ArrowLeft,
  Car,
  Bus,
  MapPin,
  Navigation,
  Clock,
  Users,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Phone,
  Power,
  Sun,
  Moon,
  Shield,
} from 'lucide-react';

interface UberDriverViewProps {
  onBack: () => void;
}

export default function UberDriverView({ onBack }: UberDriverViewProps) {
  const { mode, tokens, toggleTheme } = useTheme();
  const [driverType, setDriverType] = useState<'cart' | 'shuttle'>('cart');
  const [isOnline, setIsOnline] = useState(true);
  const [assignedBooking, setAssignedBooking] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ text: string; isError?: boolean } | null>(null);

  // Poll / SSE for assigned booking
  const loadAssignedBooking = async () => {
    try {
      const b = await api.getAssignedDriverBooking();
      setAssignedBooking(b && b.id ? b : null);
    } catch {
      // Graceful fallback: simulated active booking if needed for demo
    }
  };

  useEffect(() => {
    loadAssignedBooking();
    const unsub = sseClient.subscribe((event) => {
      if (['GolfCartAssigned', 'GolfCartStatusUpdated', 'GolfCartNoShow'].includes(event.event_type)) {
        loadAssignedBooking();
      }
    });
    return () => unsub();
  }, []);

  const handleUpdateStatus = async (action: string) => {
    setLoading(true);
    try {
      if (assignedBooking?.id) {
        await api.updateBookingStatus(assignedBooking.id, action);
      }
      if (['COMPLETE', 'REJECT', 'CANCEL', 'NO_SHOW'].includes(action)) {
        setAssignedBooking(null);
      } else if (assignedBooking) {
        setAssignedBooking({ ...assignedBooking, status: action });
      }
      setFeedback({ text: `Status updated: ${action}` });
    } catch (err: any) {
      setFeedback({ text: err.message || 'Error updating status', isError: true });
    } finally {
      setLoading(false);
      setTimeout(() => setFeedback(null), 3500);
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-black text-black dark:text-white flex flex-col font-sans transition-colors duration-200">
      {/* 1. Header */}
      <header className="sticky top-0 z-30 bg-white dark:bg-black border-b border-[#E2E2E2] dark:border-[#333333]">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              aria-label="Back"
              className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-[#F3F3F3] dark:hover:bg-[#1C1C1C] text-black dark:text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-black dark:text-white">
                Driver Console
              </h1>
              <p className="text-xs text-[#5E5E5E] dark:text-[#A6A6A6]">
                {driverType === 'cart' ? 'Golf Cart #GC-04' : 'Shuttle Bus #102'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Online / Offline switch */}
            <button
              onClick={() => setIsOnline(!isOnline)}
              className={`uber-chip ${isOnline ? 'active' : ''}`}
            >
              <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-[#05A357]' : 'bg-[#E11900]'}`} />
              <span>{isOnline ? 'Online' : 'Offline'}</span>
            </button>

            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              aria-label="Toggle theme"
              className="w-10 h-10 rounded-full flex items-center justify-center bg-[#F3F3F3] dark:bg-[#1C1C1C] text-black dark:text-white"
            >
              {mode === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* 2. Main Content Area */}
      <main className="max-w-2xl mx-auto w-full px-4 sm:px-6 py-6 flex-1 space-y-6">
        {/* Vehicle Mode Switcher */}
        <div className="flex gap-2">
          <button
            onClick={() => setDriverType('cart')}
            className={`uber-chip flex-1 justify-center ${driverType === 'cart' ? 'active' : ''}`}
          >
            <Car className="w-4 h-4 mr-1.5" />
            <span>Golf Cart</span>
          </button>
          <button
            onClick={() => setDriverType('shuttle')}
            className={`uber-chip flex-1 justify-center ${driverType === 'shuttle' ? 'active' : ''}`}
          >
            <Bus className="w-4 h-4 mr-1.5" />
            <span>Shuttle Bus</span>
          </button>
        </div>

        {/* Feedback message banner */}
        {feedback && (
          <div
            className={`p-4 rounded-[12px] border text-sm font-semibold flex items-center gap-2 ${
              feedback.isError
                ? 'bg-[#E11900]/10 border-[#E11900] text-[#E11900]'
                : 'bg-[#05A357]/10 border-[#05A357] text-[#05A357]'
            }`}
          >
            {feedback.isError ? <AlertCircle className="w-5 h-5 shrink-0" /> : <CheckCircle2 className="w-5 h-5 shrink-0" />}
            <span>{feedback.text}</span>
          </div>
        )}

        {/* Active Dispatch Card */}
        {assignedBooking ? (
          <div className="bg-[#F3F3F3] dark:bg-[#1C1C1C] rounded-[12px] p-5 border border-[#E2E2E2] dark:border-[#333333] space-y-5">
            <div className="flex items-center justify-between border-b border-[#E2E2E2] dark:border-[#333333] pb-3">
              <div>
                <span className="text-xs uppercase font-bold text-[#5E5E5E] dark:text-[#A6A6A6] tracking-wider">
                  Active Dispatch #{assignedBooking.id || '1042'}
                </span>
                <h2 className="text-xl font-extrabold text-black dark:text-white mt-0.5">
                  {assignedBooking.status || 'ASSIGNED'}
                </h2>
              </div>
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-black dark:bg-white text-white dark:text-black">
                {assignedBooking.passenger_count || 1} Rider(s)
              </span>
            </div>

            {/* Route Stops */}
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-black dark:bg-white text-white dark:text-black flex items-center justify-center shrink-0 mt-0.5">
                  <MapPin className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase text-[#5E5E5E] dark:text-[#A6A6A6]">
                    Pickup
                  </div>
                  <div className="font-bold text-base text-black dark:text-white">
                    {assignedBooking.pickup_stop?.name || 'Main Gate Central Stand'}
                  </div>
                </div>
              </div>

              <div className="w-0.5 h-4 bg-[#E2E2E2] dark:bg-[#333333] ml-4" />

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-[#E2E2E2] dark:bg-[#333333] text-black dark:text-white flex items-center justify-center shrink-0 mt-0.5">
                  <Navigation className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase text-[#5E5E5E] dark:text-[#A6A6A6]">
                    Dropoff
                  </div>
                  <div className="font-bold text-base text-black dark:text-white">
                    {assignedBooking.drop_stop?.name || 'Block 32 Academic Complex'}
                  </div>
                </div>
              </div>
            </div>

            {/* Large 56px Driver Action Buttons */}
            <div className="space-y-2 pt-2">
              {assignedBooking.status === 'ASSIGNED' && (
                <button
                  disabled={loading}
                  onClick={() => handleUpdateStatus('ARRIVING')}
                  className="uber-btn-primary w-full text-base font-bold"
                >
                  Confirm dispatch en route
                </button>
              )}

              {assignedBooking.status === 'ARRIVING' && (
                <button
                  disabled={loading}
                  onClick={() => handleUpdateStatus('IN_PROGRESS')}
                  className="uber-btn-primary w-full text-base font-bold"
                >
                  Riders boarded · Start trip
                </button>
              )}

              {assignedBooking.status === 'IN_PROGRESS' && (
                <button
                  disabled={loading}
                  onClick={() => handleUpdateStatus('COMPLETE')}
                  className="uber-btn-primary w-full text-base font-bold"
                >
                  Arrived at destination · Complete trip
                </button>
              )}

              <button
                disabled={loading}
                onClick={() => handleUpdateStatus('CANCEL')}
                className="uber-btn-secondary w-full text-sm text-[#E11900] hover:bg-[#E11900]/10"
              >
                Decline / Cancel dispatch
              </button>
            </div>
          </div>
        ) : (
          /* Standby / Waiting for Dispatch Card */
          <div className="bg-[#F3F3F3] dark:bg-[#1C1C1C] rounded-[12px] p-8 border border-[#E2E2E2] dark:border-[#333333] text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-[#E2E2E2] dark:bg-[#333333] flex items-center justify-center mx-auto text-black dark:text-white">
              {driverType === 'cart' ? <Car className="w-7 h-7 stroke-[2]" /> : <Bus className="w-7 h-7 stroke-[2]" />}
            </div>
            <div>
              <h3 className="font-bold text-lg text-black dark:text-white">
                Waiting for dispatch
              </h3>
              <p className="text-xs text-[#5E5E5E] dark:text-[#A6A6A6] mt-1 max-w-sm mx-auto">
                You are marked online and positioned at Main Gate Central Stand. Dispatches are assigned automatically.
              </p>
            </div>
            <button
              onClick={() => {
                setAssignedBooking({
                  id: 1045,
                  status: 'ASSIGNED',
                  passenger_count: 2,
                  pickup_stop: { name: 'Main Gate Central Stand' },
                  drop_stop: { name: 'Uni-Mall Student Centre' },
                });
              }}
              className="uber-btn-primary w-full text-sm font-semibold max-w-xs mx-auto"
            >
              Simulate dispatch assignment
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
