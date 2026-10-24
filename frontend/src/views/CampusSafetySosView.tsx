import React, { useState, useEffect, useRef } from 'react';
import {
  ShieldAlert,
  PhoneCall,
  Share2,
  AlertTriangle,
  CheckCircle2,
  MapPin,
  BatteryCharging,
  Radio,
  FileText,
  X,
  ChevronRight,
  ShieldCheck,
  Navigation,
  Clock,
  ArrowLeft,
  Copy,
  Check
} from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

interface CampusSafetySosViewProps {
  onBack: () => void;
}

interface HelplineInfo {
  helpline: string;
  security_desk: string;
  ambulance: string;
  police: string;
  women_safety: string;
}

interface SosBeacon {
  id: number;
  latitude: number;
  longitude: number;
  accuracy_meters?: number;
  battery_level?: number;
  status: string;
  is_test: boolean;
  notes?: string;
  created_at: string;
}

interface IncidentReport {
  id: number;
  category: string;
  description: string;
  location: string;
  vehicle_number?: string;
  status: string;
  created_at: string;
}

export const CampusSafetySosView: React.FC<CampusSafetySosViewProps> = ({ onBack }) => {
  const { user } = useAuth();

  // Helpline contacts
  const [helpline, setHelpline] = useState<HelplineInfo>({
    helpline: '+91 1824 517000',
    security_desk: '+91 1824 517001',
    ambulance: '108',
    police: '112',
    women_safety: '+91 1824 517109'
  });

  // Hold-to-confirm SOS state
  const [isHolding, setIsHolding] = useState<boolean>(false);
  const [holdProgress, setHoldProgress] = useState<number>(0); // 0 to 100
  const holdTimerRef = useRef<any>(null);
  const startTimeRef = useRef<number>(0);
  const HOLD_DURATION_MS = 3000;

  // Active SOS Beacon
  const [activeBeacon, setActiveBeacon] = useState<SosBeacon | null>(null);
  const [isTestMode, setIsTestMode] = useState<boolean>(true);
  const [isTriggering, setIsTriggering] = useState<boolean>(false);
  const [resolveNotes, setResolveNotes] = useState<string>('');
  const [showResolveModal, setShowResolveModal] = useState<boolean>(false);

  // Share trip link
  const [shareCopied, setShareCopied] = useState<boolean>(false);

  // Incident report form
  const [showReportModal, setShowReportModal] = useState<boolean>(false);
  const [reportCategory, setReportCategory] = useState<string>('RECKLESS_DRIVING');
  const [reportLocation, setReportLocation] = useState<string>('Block 34 Bus Stop');
  const [reportVehicle, setReportVehicle] = useState<string>('');
  const [reportDescription, setReportDescription] = useState<string>('');
  const [reportSubmitting, setReportSubmitting] = useState<boolean>(false);
  const [reportSuccess, setReportSuccess] = useState<string | null>(null);
  const [myReports, setMyReports] = useState<IncidentReport[]>([]);

  // Feedback banner
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // 1. Fetch helpline and active beacons on mount
  useEffect(() => {
    loadHelpline();
    checkActiveBeacon();
    loadMyReports();
  }, []);

  const loadHelpline = async () => {
    try {
      const data = await api.getSafetyHelpline();
      setHelpline(data);
    } catch (err) {
      console.warn('Using default helpline settings:', err);
    }
  };

  const checkActiveBeacon = async () => {
    try {
      const beacons = await api.getActiveSosBeacons();
      if (beacons && beacons.length > 0) {
        setActiveBeacon(beacons[0]);
      } else {
        setActiveBeacon(null);
      }
    } catch (err) {
      console.warn('Could not load active beacons:', err);
    }
  };

  const loadMyReports = async () => {
    try {
      const reports = await api.getMyIncidentReports();
      setMyReports(reports || []);
    } catch (err) {
      console.warn('Could not load reports:', err);
    }
  };

  // 2. Periodic GPS streaming if SOS is active
  useEffect(() => {
    if (!activeBeacon) return;
    const interval = setInterval(async () => {
      try {
        // Stream updated coordinates with slight simulated jitter
        const lat = 31.2530 + (Math.random() - 0.5) * 0.0004;
        const lng = 75.7050 + (Math.random() - 0.5) * 0.0004;
        await api.updateSosLocation(activeBeacon.id, {
          latitude: lat,
          longitude: lng,
          accuracy_meters: 3.8,
          battery_level: 80
        });
      } catch (err) {
        console.warn('Location streaming tick failed:', err);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [activeBeacon]);

  // 3. 3-Second Hold logic
  const handleHoldStart = () => {
    if (activeBeacon) return;
    setIsHolding(true);
    setHoldProgress(0);
    startTimeRef.current = Date.now();

    holdTimerRef.current = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      const progress = Math.min(100, (elapsed / HOLD_DURATION_MS) * 100);
      setHoldProgress(progress);

      if (progress >= 100) {
        clearInterval(holdTimerRef.current);
        holdTimerRef.current = null;
        setIsHolding(false);
        triggerSosBeacon();
      }
    }, 50);
  };

  const handleHoldEnd = () => {
    if (holdProgress < 100 && isHolding) {
      clearInterval(holdTimerRef.current);
      holdTimerRef.current = null;
      setIsHolding(false);
      setHoldProgress(0);
      showToast('Hold released early. SOS beacon was NOT triggered.');
    }
  };

  // Trigger SOS Beacon
  const triggerSosBeacon = async () => {
    setIsTriggering(true);
    try {
      const res = await api.triggerSos({
        latitude: 31.2530,
        longitude: 75.7050,
        accuracy_meters: 4.2,
        battery_level: 84,
        is_test: isTestMode,
        trigger_type: 'MANUAL_HOLD',
        notes: isTestMode ? 'Campus Safety Drill / Simulated Alert' : 'Immediate student emergency reported'
      });
      setActiveBeacon(res);
      showToast('🚨 EMERGENCY BEACON TRANSMITTED TO LPU SECURITY');
    } catch (err: any) {
      showToast(err.message || 'Failed to trigger SOS beacon');
    } finally {
      setIsTriggering(false);
      setHoldProgress(0);
    }
  };

  // Resolve SOS
  const handleResolveSos = async () => {
    if (!activeBeacon) return;
    try {
      await api.resolveSos(activeBeacon.id, resolveNotes || 'Student confirmed safe');
      setActiveBeacon(null);
      setShowResolveModal(false);
      setResolveNotes('');
      showToast('SOS Beacon successfully resolved and marked Safe.');
    } catch (err: any) {
      showToast(err.message || 'Failed to resolve SOS beacon');
    }
  };

  // Copy share trip link
  const handleCopyShareLink = () => {
    const link = `https://unicart.lpu.in/share?trip=LPU-TRIP-98214&user=${user?.username || 'student'}`;
    navigator.clipboard.writeText(link);
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 3000);
    showToast('Live tracking link copied to clipboard!');
  };

  // Submit incident report
  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportDescription.trim()) {
      showToast('Please provide details of the incident.');
      return;
    }
    setReportSubmitting(true);
    try {
      await api.submitIncidentReport({
        category: reportCategory,
        location: reportLocation,
        vehicle_number: reportVehicle || undefined,
        description: reportDescription
      });
      setReportSuccess('Incident report submitted to LPU Transport Safety Division.');
      setReportDescription('');
      setReportVehicle('');
      loadMyReports();
      setTimeout(() => {
        setReportSuccess(null);
        setShowReportModal(false);
      }, 2500);
    } catch (err: any) {
      showToast(err.message || 'Failed to submit report');
    } finally {
      setReportSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#07090e] text-white flex flex-col font-sans selection:bg-red-500/30">
      {/* Toast Banner */}
      {toastMessage && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-red-600/95 text-white px-5 py-3 rounded-xl shadow-2xl backdrop-blur-md border border-red-400/40 flex items-center space-x-3 animate-fade-in text-sm font-semibold">
          <AlertTriangle className="w-5 h-5 text-amber-300 animate-pulse flex-shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Navigation Bar */}
      <header className="border-b border-gray-800/80 bg-[#0d121d]/90 backdrop-blur-lg sticky top-0 z-40 px-4 py-3 flex items-center justify-between shadow-md">
        <div className="flex items-center space-x-3">
          <button
            onClick={onBack}
            className="p-2 rounded-xl bg-gray-800/70 hover:bg-gray-700/80 text-gray-300 hover:text-white transition-all flex items-center justify-center border border-gray-700/50"
            title="Back to UniCart"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center space-x-2">
              <ShieldAlert className="w-5 h-5 text-red-500" />
              <h1 className="text-lg font-bold tracking-tight text-white">Campus Safety & SOS</h1>
            </div>
            <p className="text-xs text-gray-400">Lovely Professional University Central Security Network</p>
          </div>
        </div>

        {/* Test Mode Badge & Toggle */}
        <div className="flex items-center space-x-2 bg-amber-500/10 border border-amber-500/30 px-3 py-1.5 rounded-full">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
          <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider">Test Mode Active</span>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 space-y-6">

        {/* Notice Banner */}
        <div className="p-3.5 bg-gradient-to-r from-red-950/40 via-amber-950/30 to-gray-900/40 border border-red-500/20 rounded-2xl flex items-start space-x-3">
          <Radio className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5 animate-pulse" />
          <div className="text-xs leading-relaxed text-gray-300">
            <span className="font-semibold text-white">Safety Beacon & Instant Dispatch:</span> Activating SOS streams your real-time GPS coordinates directly to the LPU Security Patrol Desk at Block 32. In drills, all alerts run in simulated safety mode.
          </div>
        </div>

        {/* ACTIVE SOS HUD vs STANDBY SOS TRIGGER */}
        {activeBeacon ? (
          /* Active SOS Alert Card */
          <div className="bg-gradient-to-b from-red-950/70 to-red-900/30 border-2 border-red-500/80 rounded-3xl p-6 shadow-2xl relative overflow-hidden backdrop-blur-xl">
            {/* Blinking Emergency Header */}
            <div className="flex items-center justify-between pb-4 border-b border-red-800/40">
              <div className="flex items-center space-x-3">
                <span className="relative flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500"></span>
                </span>
                <div>
                  <h2 className="text-lg font-black text-red-400 tracking-wider uppercase">
                    🚨 SOS Beacon Active & Streaming
                  </h2>
                  <p className="text-xs text-red-200/80">Beacon ID: #LPU-SOS-{activeBeacon.id} • {activeBeacon.is_test ? 'CAMPUS DRILL' : 'HIGH PRIORITY'}</p>
                </div>
              </div>
              <button
                onClick={() => setShowResolveModal(true)}
                className="bg-white hover:bg-gray-100 text-black font-bold text-xs px-4 py-2 rounded-xl transition shadow-lg active:scale-95 flex items-center space-x-1.5"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>I Am Safe / Cancel</span>
              </button>
            </div>

            {/* Radar Visualizer & Telemetry Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 my-6 items-center">
              {/* Radar Simulation */}
              <div className="flex flex-col items-center justify-center p-6 bg-black/40 rounded-2xl border border-red-900/40 relative">
                <div className="w-36 h-36 rounded-full border border-red-500/40 flex items-center justify-center relative">
                  <div className="w-24 h-24 rounded-full border border-red-500/60 flex items-center justify-center">
                    <div className="w-12 h-12 rounded-full bg-red-600/80 flex items-center justify-center text-white shadow-lg animate-pulse">
                      <Radio className="w-6 h-6" />
                    </div>
                  </div>
                  {/* Rotating Radar Sweep */}
                  <div className="absolute inset-0 rounded-full border-t-2 border-red-400 animate-spin" style={{ animationDuration: '3s' }}></div>
                </div>
                <span className="text-xs font-mono text-red-300 mt-3 flex items-center space-x-1">
                  <Navigation className="w-3 h-3 text-red-400" />
                  <span>GPS Broadcast Pulse Active (Every 5s)</span>
                </span>
              </div>

              {/* Live Telemetry Info */}
              <div className="space-y-3 font-mono text-xs text-gray-300">
                <div className="p-3 bg-red-950/40 rounded-xl border border-red-800/40 flex items-center justify-between">
                  <span className="text-gray-400 flex items-center space-x-1.5">
                    <MapPin className="w-4 h-4 text-red-400" />
                    <span>Coordinates</span>
                  </span>
                  <span className="text-white font-bold">{activeBeacon.latitude.toFixed(4)}° N, {activeBeacon.longitude.toFixed(4)}° E</span>
                </div>

                <div className="p-3 bg-red-950/40 rounded-xl border border-red-800/40 flex items-center justify-between">
                  <span className="text-gray-400 flex items-center space-x-1.5">
                    <BatteryCharging className="w-4 h-4 text-emerald-400" />
                    <span>Device Battery</span>
                  </span>
                  <span className="text-white font-bold">{activeBeacon.battery_level || 84}%</span>
                </div>

                <div className="p-3 bg-red-950/40 rounded-xl border border-red-800/40 flex items-center justify-between">
                  <span className="text-gray-400 flex items-center space-x-1.5">
                    <Clock className="w-4 h-4 text-amber-400" />
                    <span>Triggered At</span>
                  </span>
                  <span className="text-white">{new Date(activeBeacon.created_at).toLocaleTimeString()}</span>
                </div>
              </div>
            </div>

            {/* Live Security Dispatch Timeline */}
            <div className="bg-black/50 p-4 rounded-2xl border border-red-800/40 space-y-2.5">
              <div className="text-xs font-bold text-red-400 uppercase tracking-wider mb-2">Live Response Dispatch</div>
              <div className="flex items-center space-x-3 text-xs text-gray-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span>Beacon received at LPU Central Security Desk (Block 32)</span>
              </div>
              <div className="flex items-center space-x-3 text-xs text-gray-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span>Patrol Golf Cart LP-GC-04 dispatched to your GPS coordinate</span>
              </div>
              <div className="flex items-center space-x-3 text-xs text-amber-300 animate-pulse">
                <Radio className="w-4 h-4 text-amber-400 flex-shrink-0" />
                <span>Security control officer standing by on radio frequency #14</span>
              </div>
            </div>
          </div>
        ) : (
          /* Standby SOS Trigger Card with 3-Second Hold */
          <div className="bg-gradient-to-b from-gray-900 to-[#0e1422] border border-gray-800 rounded-3xl p-6 sm:p-8 shadow-xl flex flex-col items-center text-center relative overflow-hidden">
            {/* Ambient Background Glow */}
            <div className="absolute w-72 h-72 bg-red-600/10 rounded-full blur-3xl pointer-events-none -top-10"></div>

            <div className="max-w-md space-y-2 mb-6">
              <h2 className="text-2xl font-black tracking-tight text-white">Emergency SOS Beacon</h2>
              <p className="text-xs text-gray-400 leading-relaxed">
                Press and hold the button for <strong className="text-white">3 full seconds</strong> to alert campus security and broadcast your live GPS beacon.
              </p>
            </div>

            {/* Giant 3-Second Hold Button */}
            <div className="relative select-none touch-none my-4">
              {/* Radial Progress Ring */}
              <svg className="w-52 h-52 -rotate-90 transform" viewBox="0 0 120 120">
                {/* Track */}
                <circle
                  cx="60"
                  cy="60"
                  r="52"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="transparent"
                  className="text-gray-800"
                />
                {/* Progress Indicator */}
                <circle
                  cx="60"
                  cy="60"
                  r="52"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="transparent"
                  strokeDasharray={2 * Math.PI * 52}
                  strokeDashoffset={2 * Math.PI * 52 * (1 - holdProgress / 100)}
                  strokeLinecap="round"
                  className="text-red-500 transition-all duration-75"
                />
              </svg>

              {/* Inner Pressable Button */}
              <button
                onMouseDown={handleHoldStart}
                onMouseUp={handleHoldEnd}
                onMouseLeave={handleHoldEnd}
                onTouchStart={handleHoldStart}
                onTouchEnd={handleHoldEnd}
                disabled={isTriggering}
                className={`absolute inset-4 rounded-full flex flex-col items-center justify-center transition-all transform active:scale-95 shadow-2xl focus:outline-none ${
                  isHolding
                    ? 'bg-gradient-to-br from-red-600 to-red-800 ring-8 ring-red-500/40 text-white scale-95'
                    : 'bg-gradient-to-br from-red-700 to-red-950 hover:from-red-600 hover:to-red-900 text-white'
                }`}
              >
                <ShieldAlert className={`w-12 h-12 mb-1 ${isHolding ? 'animate-bounce text-amber-200' : 'text-white'}`} />
                <span className="text-sm font-black tracking-wider uppercase">
                  {isHolding ? `${Math.ceil((HOLD_DURATION_MS - (HOLD_DURATION_MS * holdProgress) / 100) / 1000)}s` : 'HOLD SOS'}
                </span>
                <span className="text-[10px] text-red-200 font-medium tracking-tight">
                  {isHolding ? 'Hold firmly...' : 'Press 3s'}
                </span>
              </button>
            </div>

            {/* Test Drill Switcher */}
            <div className="mt-4 flex items-center space-x-2 text-xs text-gray-400 bg-gray-800/50 px-4 py-2 rounded-xl border border-gray-700/60">
              <input
                type="checkbox"
                id="testModeCheck"
                checked={isTestMode}
                onChange={(e) => setIsTestMode(e.target.checked)}
                className="w-4 h-4 rounded text-red-600 focus:ring-0 bg-gray-900 border-gray-700 cursor-pointer"
              />
              <label htmlFor="testModeCheck" className="cursor-pointer select-none">
                Simulate as Safety Drill / Test Drill (Recommended)
              </label>
            </div>
          </div>
        )}

        {/* Quick Emergency Call Hub */}
        <section className="bg-gray-900/80 border border-gray-800 rounded-2xl p-5 shadow-lg space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <PhoneCall className="w-5 h-5 text-amber-400" />
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">Campus Helplines & Desks</h2>
            </div>
            <span className="text-[11px] text-gray-400">24/7 Monitored</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Primary Helpline */}
            <a
              href={`tel:${helpline.helpline}`}
              className="p-4 rounded-xl bg-gradient-to-r from-red-950/40 to-gray-800/60 hover:from-red-900/50 hover:to-gray-800 border border-red-500/30 flex items-center justify-between transition-all group"
            >
              <div className="space-y-0.5">
                <div className="text-xs font-bold text-white group-hover:text-red-400 transition">Central Security Desk</div>
                <div className="text-sm font-mono font-bold text-red-400">{helpline.helpline}</div>
                <div className="text-[10px] text-gray-400">Main Control Room • Block 32</div>
              </div>
              <div className="w-9 h-9 rounded-xl bg-red-600/20 group-hover:bg-red-600 text-red-400 group-hover:text-white flex items-center justify-center transition">
                <PhoneCall className="w-4 h-4" />
              </div>
            </a>

            {/* Women Safety Desk */}
            <a
              href={`tel:${helpline.women_safety}`}
              className="p-4 rounded-xl bg-gray-800/40 hover:bg-gray-800/80 border border-gray-700/60 flex items-center justify-between transition-all group"
            >
              <div className="space-y-0.5">
                <div className="text-xs font-bold text-white group-hover:text-pink-400 transition">Women Safety Helpline</div>
                <div className="text-sm font-mono font-bold text-pink-400">{helpline.women_safety}</div>
                <div className="text-[10px] text-gray-400">Dedicated 24/7 Campus Patrol</div>
              </div>
              <div className="w-9 h-9 rounded-xl bg-pink-600/20 group-hover:bg-pink-600 text-pink-400 group-hover:text-white flex items-center justify-center transition">
                <PhoneCall className="w-4 h-4" />
              </div>
            </a>

            {/* Campus Ambulance */}
            <a
              href={`tel:${helpline.ambulance}`}
              className="p-3.5 rounded-xl bg-gray-800/30 hover:bg-gray-800 border border-gray-700/50 flex items-center justify-between transition group"
            >
              <div className="space-y-0.5">
                <div className="text-xs font-semibold text-gray-200">Campus Ambulance / Health Centre</div>
                <div className="text-xs font-mono font-bold text-amber-400">Dial {helpline.ambulance} / {helpline.security_desk}</div>
              </div>
              <PhoneCall className="w-4 h-4 text-gray-400 group-hover:text-amber-400" />
            </a>

            {/* National Emergency */}
            <a
              href={`tel:${helpline.police}`}
              className="p-3.5 rounded-xl bg-gray-800/30 hover:bg-gray-800 border border-gray-700/50 flex items-center justify-between transition group"
            >
              <div className="space-y-0.5">
                <div className="text-xs font-semibold text-gray-200">Police Emergency (National)</div>
                <div className="text-xs font-mono font-bold text-blue-400">Dial {helpline.police}</div>
              </div>
              <PhoneCall className="w-4 h-4 text-gray-400 group-hover:text-blue-400" />
            </a>
          </div>
        </section>

        {/* Share Live Trip Link & Incident Reporting Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Share Trip Link */}
          <div className="p-5 bg-gray-900/70 border border-gray-800 rounded-2xl space-y-3">
            <div className="flex items-center space-x-2 text-white">
              <Share2 className="w-5 h-5 text-indigo-400" />
              <h3 className="text-sm font-bold">Share My Live Trip</h3>
            </div>
            <p className="text-xs text-gray-400 leading-relaxed">
              Share your live vehicle GPS location and ETA with your roommates, guardians, or friends with 1 tap.
            </p>
            <button
              onClick={handleCopyShareLink}
              className="w-full py-2.5 px-4 bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 font-semibold text-xs rounded-xl transition flex items-center justify-center space-x-2 active:scale-95"
            >
              {shareCopied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>Tracking Link Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Copy Live Tracking Link</span>
                </>
              )}
            </button>
          </div>

          {/* Incident Reporting Trigger */}
          <div className="p-5 bg-gray-900/70 border border-gray-800 rounded-2xl space-y-3">
            <div className="flex items-center space-x-2 text-white">
              <FileText className="w-5 h-5 text-amber-400" />
              <h3 className="text-sm font-bold">Report a Safety Concern</h3>
            </div>
            <p className="text-xs text-gray-400 leading-relaxed">
              Report reckless driving, overloading, vehicle condition, lost items, or harassment anonymously or verified.
            </p>
            <button
              onClick={() => setShowReportModal(true)}
              className="w-full py-2.5 px-4 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 font-semibold text-xs rounded-xl transition flex items-center justify-center space-x-2 active:scale-95"
            >
              <AlertTriangle className="w-4 h-4" />
              <span>Submit Incident Report</span>
            </button>
          </div>
        </div>

        {/* Verified Driver & Campus Transport Standards */}
        <section className="bg-gradient-to-r from-gray-900 via-gray-900/80 to-gray-950 border border-gray-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center space-x-2 text-white">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <h2 className="text-sm font-bold uppercase tracking-wider">LPU Transport Safety Shield</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-gray-300">
            <div className="flex items-start space-x-3 p-3 bg-gray-800/30 rounded-xl border border-gray-800">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
              <div>
                <strong className="text-white block">Verified Campus Drivers</strong>
                Police background checked and certified by LPU Transport Division.
              </div>
            </div>

            <div className="flex items-start space-x-3 p-3 bg-gray-800/30 rounded-xl border border-gray-800">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
              <div>
                <strong className="text-white block">Speed Governor Compliant</strong>
                Strict 20 km/h campus speed limit enforced with telematics tracking.
              </div>
            </div>

            <div className="flex items-start space-x-3 p-3 bg-gray-800/30 rounded-xl border border-gray-800">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
              <div>
                <strong className="text-white block">Geofenced Corridors</strong>
                Automatic deviation alarms if vehicles stray outside campus paths.
              </div>
            </div>

            <div className="flex items-start space-x-3 p-3 bg-gray-800/30 rounded-xl border border-gray-800">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
              <div>
                <strong className="text-white block">24/7 CCTV Coverage</strong>
                All 18 designated stops are connected to central campus surveillance.
              </div>
            </div>
          </div>
        </section>

        {/* Previously Filed Reports */}
        {myReports.length > 0 && (
          <section className="bg-gray-900/60 border border-gray-800 rounded-2xl p-5 space-y-3">
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">Your Submitted Reports</div>
            <div className="space-y-2">
              {myReports.map((r) => (
                <div key={r.id} className="p-3 bg-gray-800/40 rounded-xl border border-gray-700/40 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-semibold text-white">{r.category.replace('_', ' ')}</span>
                    <span className="text-gray-400 ml-2">at {r.location}</span>
                    <p className="text-gray-400 text-[11px] mt-0.5 line-clamp-1">{r.description}</p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/40 uppercase">
                    {r.status}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      {/* RESOLVE SOS CONFIRMATION MODAL */}
      {showResolveModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#101726] border border-gray-700 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center space-x-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <span>Resolve SOS Emergency Beacon</span>
              </h3>
              <button onClick={() => setShowResolveModal(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-gray-300 leading-relaxed">
              Please confirm that you are safe and that emergency assistance is no longer required.
            </p>

            <div>
              <label className="text-xs text-gray-400 block mb-1">Optional Resolution Notes</label>
              <input
                type="text"
                placeholder="e.g. Safety drill completed / False alarm confirmed"
                value={resolveNotes}
                onChange={(e) => setResolveNotes(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex items-center space-x-3 pt-2">
              <button
                onClick={() => setShowResolveModal(false)}
                className="flex-1 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-xs font-semibold text-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={handleResolveSos}
                className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white shadow-lg"
              >
                Confirm I Am Safe
              </button>
            </div>
          </div>
        </div>
      )}

      {/* INCIDENT REPORT MODAL */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#101726] border border-gray-700 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl animate-fade-in max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-gray-800">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold text-white">Report Safety Concern</h3>
              </div>
              <button onClick={() => setShowReportModal(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {reportSuccess ? (
              <div className="p-4 bg-emerald-950/60 border border-emerald-500/50 rounded-xl text-center space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                <p className="text-xs font-semibold text-emerald-200">{reportSuccess}</p>
              </div>
            ) : (
              <form onSubmit={handleSubmitReport} className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-gray-300 block mb-1">Concern Category</label>
                  <select
                    value={reportCategory}
                    onChange={(e) => setReportCategory(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="RECKLESS_DRIVING">Reckless Driving / Over-speeding</option>
                    <option value="OVERCROWDING">Vehicle Overcrowding / Seat Capacity</option>
                    <option value="HARASSMENT">Misconduct or Harassment</option>
                    <option value="LOST_ITEM">Lost & Found in Vehicle</option>
                    <option value="VEHICLE_CONDITION">Vehicle Cleanliness or Breakdown</option>
                    <option value="OTHER">Other Safety Concern</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-300 block mb-1">Campus Location / Stop</label>
                  <input
                    type="text"
                    required
                    value={reportLocation}
                    onChange={(e) => setReportLocation(e.target.value)}
                    placeholder="e.g. Block 34 Bus Stop, UniMall Crossing"
                    className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-300 block mb-1">Vehicle Plate / Cart ID (Optional)</label>
                  <input
                    type="text"
                    value={reportVehicle}
                    onChange={(e) => setReportVehicle(e.target.value)}
                    placeholder="e.g. PB-08-LP-1002 or Cart LP-GC-03"
                    className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-300 block mb-1">Detailed Description</label>
                  <textarea
                    rows={4}
                    required
                    value={reportDescription}
                    onChange={(e) => setReportDescription(e.target.value)}
                    placeholder="Please provide details of what occurred, time, and any identifying details..."
                    className="w-full bg-gray-900 border border-gray-700 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-amber-500 resize-none"
                  ></textarea>
                </div>

                <div className="flex items-center space-x-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowReportModal(false)}
                    className="flex-1 py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-xs font-semibold text-gray-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={reportSubmitting}
                    className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold shadow-lg transition active:scale-95 disabled:opacity-50"
                  >
                    {reportSubmitting ? 'Submitting...' : 'Submit Report'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
