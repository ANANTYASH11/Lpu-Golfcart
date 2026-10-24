import React, { useState, useEffect } from 'react';
import {
  Calculator,
  ArrowRight,
  ArrowUpDown,
  Bus,
  Zap,
  Clock,
  Sparkles,
  Info,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  ArrowLeft
} from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

interface FareCalculatorViewProps {
  onBack: () => void;
  onBookRide: (pickupId?: number, dropId?: number) => void;
}

interface StopItem {
  id: number;
  name: string;
  code: string;
  latitude: number;
  longitude: number;
}

interface FareOption {
  vehicle_type: string;
  display_name: string;
  base_fare_inr: number;
  distance_km: number;
  distance_fare_inr: number;
  peak_surcharge_inr: number;
  discount_inr: number;
  final_fare_inr: number;
  final_fare_paise: number;
  is_peak: boolean;
  is_priority_applied: boolean;
  eta_minutes: number;
}

interface FareRules {
  currency: string;
  shuttle: { fare_model: string; base_fare: number; description: string };
  golf_cart: {
    fare_model: string;
    base_fare: number;
    per_km_rate: number;
    peak_surcharge_percent: number;
    priority_discount_percent: number;
    description: string;
  };
  erickshaw: { fare_model: string; standard_zone_fare: number; description: string };
  peak_hours: Array<{ name: string; start: string; end: string }>;
  is_currently_peak: boolean;
}

export const FareCalculatorView: React.FC<FareCalculatorViewProps> = ({ onBack, onBookRide }) => {
  const { user } = useAuth();

  const [stops, setStops] = useState<StopItem[]>([]);
  const [pickupStopId, setPickupStopId] = useState<number>(1);
  const [dropStopId, setDropStopId] = useState<number>(5);
  const [loading, setLoading] = useState<boolean>(true);
  const [calculating, setCalculating] = useState<boolean>(false);
  const [fareOptions, setFareOptions] = useState<FareOption[]>([]);
  const [selectedVehicleType, setSelectedVehicleType] = useState<string>('GOLF_CART');
  const [fareRules, setFareRules] = useState<FareRules | null>(null);
  const [priorityOverride, setPriorityOverride] = useState<boolean>(user?.is_priority || false);
  const [distanceKm, setDistanceKm] = useState<number>(1.6);

  // 1. Fetch stops and fare rules
  useEffect(() => {
    const initData = async () => {
      setLoading(true);
      try {
        const [stopsData, rulesData] = await Promise.all([
          api.getStops(),
          api.getFareRules()
        ]);
        setStops(stopsData || []);
        setFareRules(rulesData);
        if (stopsData && stopsData.length >= 2) {
          setPickupStopId(stopsData[0].id);
          setDropStopId(stopsData[Math.min(4, stopsData.length - 1)].id);
        }
      } catch (err) {
        console.warn('Error loading stops or rules:', err);
      } finally {
        setLoading(false);
      }
    };
    initData();
  }, []);

  // 2. Calculate fare whenever pickup, drop, or priorityOverride changes
  useEffect(() => {
    if (!pickupStopId || !dropStopId || pickupStopId === dropStopId) return;

    const computeFare = async () => {
      setCalculating(true);
      try {
        const data = await api.calculateFare(pickupStopId, dropStopId, null, priorityOverride);
        if (data && data.options) {
          setFareOptions(data.options);
          if (data.options.length > 0) {
            setDistanceKm(data.options[0].distance_km);
          }
        }
      } catch (err) {
        console.warn('Fare calculation failed:', err);
      } finally {
        setCalculating(false);
      }
    };

    computeFare();
  }, [pickupStopId, dropStopId, priorityOverride]);

  const handleSwapStops = () => {
    const temp = pickupStopId;
    setPickupStopId(dropStopId);
    setDropStopId(temp);
  };

  const selectedOption = fareOptions.find(o => o.vehicle_type === selectedVehicleType) || fareOptions[0];

  return (
    <div className="min-h-screen bg-[#07090e] text-white flex flex-col font-sans selection:bg-emerald-500/30">
      {/* Top Header */}
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
              <Calculator className="w-5 h-5 text-emerald-400" />
              <h1 className="text-lg font-bold tracking-tight text-white">Campus Fare Calculator</h1>
            </div>
            <p className="text-xs text-gray-400">Official Lovely Professional University Transit Tariffs</p>
          </div>
        </div>

        {/* Peak Rush Status Indicator */}
        <div className={`flex items-center space-x-2 px-3 py-1.5 rounded-full border text-xs font-semibold ${
          fareRules?.is_currently_peak
            ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
            : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
        }`}>
          <span className={`w-2 h-2 rounded-full ${fareRules?.is_currently_peak ? 'bg-amber-400 animate-ping' : 'bg-emerald-400'}`}></span>
          <span>{fareRules?.is_currently_peak ? 'Peak Rush Window (+25%)' : 'Standard Campus Tariff'}</span>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 space-y-6">

        {/* Route Selector Card */}
        <div className="bg-gradient-to-b from-gray-900 to-[#0e1422] border border-gray-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
          <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">Select Journey Stops</div>

          <div className="grid grid-cols-1 md:grid-cols-[1fr,auto,1fr] gap-3 items-center">
            {/* Pickup Stop */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-gray-400 flex items-center space-x-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                <span>Pickup Stop</span>
              </label>
              <select
                value={pickupStopId}
                onChange={(e) => setPickupStopId(Number(e.target.value))}
                className="w-full bg-gray-800/90 border border-gray-700 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500"
              >
                {stops.map((s) => (
                  <option key={s.id} value={s.id} disabled={s.id === dropStopId}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </select>
            </div>

            {/* Swap Button */}
            <button
              onClick={handleSwapStops}
              className="w-10 h-10 mx-auto rounded-full bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 hover:text-white flex items-center justify-center transition shadow active:scale-95 mt-4 md:mt-0"
              title="Swap From and To"
            >
              <ArrowUpDown className="w-4 h-4" />
            </button>

            {/* Drop Stop */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-gray-400 flex items-center space-x-1">
                <span className="w-2 h-2 rounded-full bg-red-400"></span>
                <span>Destination Stop</span>
              </label>
              <select
                value={dropStopId}
                onChange={(e) => setDropStopId(Number(e.target.value))}
                className="w-full bg-gray-800/90 border border-gray-700 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500"
              >
                {stops.map((s) => (
                  <option key={s.id} value={s.id} disabled={s.id === pickupStopId}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Journey Metrics Bar & Priority Toggle */}
          <div className="pt-3 border-t border-gray-800/60 flex flex-wrap items-center justify-between gap-4 text-xs">
            <div className="flex items-center space-x-4 text-gray-300">
              <div className="flex items-center space-x-1.5">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <span>Calculated Distance: <strong className="text-white">{distanceKm.toFixed(2)} km</strong></span>
              </div>
              <div className="flex items-center space-x-1.5">
                <Clock className="w-4 h-4 text-amber-400" />
                <span>Est. Transit: <strong className="text-white">~{Math.max(3, Math.round(distanceKm * 3.5))} mins</strong></span>
              </div>
            </div>

            {/* Priority Access Test Toggle */}
            <label className="flex items-center space-x-2 cursor-pointer bg-gray-800/60 hover:bg-gray-800 px-3 py-1.5 rounded-xl border border-gray-700/60 select-none">
              <input
                type="checkbox"
                checked={priorityOverride}
                onChange={(e) => setPriorityOverride(e.target.checked)}
                className="w-3.5 h-3.5 rounded text-emerald-500 focus:ring-0 bg-gray-900 border-gray-700"
              />
              <span className="text-[11px] text-gray-300">Simulate Priority Pass (100% Free)</span>
            </label>
          </div>
        </div>

        {/* Vehicle Comparison Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {fareOptions.map((opt) => {
            const isSelected = opt.vehicle_type === selectedVehicleType;
            const isShuttle = opt.vehicle_type === 'SHUTTLE';
            const isCart = opt.vehicle_type === 'GOLF_CART';

            return (
              <div
                key={opt.vehicle_type}
                onClick={() => setSelectedVehicleType(opt.vehicle_type)}
                className={`p-5 rounded-3xl border transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between ${
                  isSelected
                    ? 'bg-gradient-to-b from-gray-800/90 to-gray-900 border-emerald-500 shadow-xl shadow-emerald-950/20 ring-2 ring-emerald-500/30'
                    : 'bg-gray-900/60 hover:bg-gray-900 border-gray-800/80 hover:border-gray-700'
                }`}
              >
                {/* Header Icon + Type */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
                      isShuttle ? 'bg-blue-600/20 text-blue-400' :
                      isCart ? 'bg-emerald-600/20 text-emerald-400' : 'bg-amber-600/20 text-amber-400'
                    }`}>
                      {isShuttle ? <Bus className="w-5 h-5" /> : isCart ? <Zap className="w-5 h-5" /> : <Zap className="w-5 h-5" />}
                    </div>

                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider bg-black/40 border border-gray-700 text-gray-300">
                      {isShuttle ? 'Scheduled' : isCart ? 'On-Demand' : 'Zone Regulated'}
                    </span>
                  </div>

                  <h3 className="font-bold text-sm text-white">{opt.display_name}</h3>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    {isShuttle ? 'Subsidized campus route' : isCart ? 'Point-to-point golf cart' : 'Central academic corridor'}
                  </p>
                </div>

                {/* Price Display */}
                <div className="mt-5 pt-4 border-t border-gray-800/60 flex items-baseline justify-between">
                  <div>
                    <span className="text-2xl font-black text-white">
                      {opt.final_fare_inr === 0 ? 'FREE' : `₹${opt.final_fare_inr}`}
                    </span>
                    {opt.final_fare_inr === 0 && (
                      <span className="text-[10px] text-emerald-400 block font-semibold">₹0.00 Final</span>
                    )}
                  </div>
                  <span className="text-[11px] text-gray-400 font-mono">~{opt.eta_minutes} min ETA</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Detailed Tariff Breakdown Card for Selected Vehicle */}
        {selectedOption && (
          <div className="bg-gray-900/80 border border-gray-800 rounded-3xl p-6 shadow-xl space-y-5">
            <div className="flex items-center justify-between pb-4 border-b border-gray-800">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                  ₹
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                    Tariff Breakdown: {selectedOption.display_name}
                  </h2>
                  <p className="text-xs text-gray-400">Server verified tariff breakdown based on campus distance</p>
                </div>
              </div>

              <div className="text-right">
                <div className="text-xl font-black text-white">
                  {selectedOption.final_fare_inr === 0 ? '₹0 (Free)' : `₹${selectedOption.final_fare_inr}.00`}
                </div>
                <div className="text-[10px] text-gray-400">Total Payable Fare</div>
              </div>
            </div>

            {/* Line-item Table */}
            <div className="space-y-2.5 text-xs text-gray-300">
              <div className="flex justify-between py-1 border-b border-gray-800/40">
                <span className="text-gray-400">Base Boarding Charge</span>
                <span className="font-mono text-white">₹{selectedOption.base_fare_inr}.00</span>
              </div>

              <div className="flex justify-between py-1 border-b border-gray-800/40">
                <span className="text-gray-400">
                  Distance Charge ({selectedOption.distance_km.toFixed(2)} km @ ₹5/km)
                </span>
                <span className="font-mono text-white">₹{selectedOption.distance_fare_inr}.00</span>
              </div>

              {selectedOption.peak_surcharge_inr > 0 && (
                <div className="flex justify-between py-1 border-b border-gray-800/40 text-amber-400">
                  <span className="flex items-center space-x-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>Peak Rush Surcharge (+25%)</span>
                  </span>
                  <span className="font-mono">+₹{selectedOption.peak_surcharge_inr}.00</span>
                </div>
              )}

              {selectedOption.discount_inr > 0 && (
                <div className="flex justify-between py-1 border-b border-gray-800/40 text-emerald-400 font-semibold">
                  <span className="flex items-center space-x-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Priority Mobility Concession (100% Off)</span>
                  </span>
                  <span className="font-mono">-₹{selectedOption.discount_inr}.00</span>
                </div>
              )}

              <div className="flex justify-between pt-2 text-sm font-bold text-white">
                <span>Final Fare</span>
                <span className="font-mono text-emerald-400">
                  {selectedOption.final_fare_inr === 0 ? '₹0.00' : `₹${selectedOption.final_fare_inr}.00`}
                </span>
              </div>
            </div>

            {/* Book Now Button */}
            <div className="pt-2">
              <button
                onClick={() => onBookRide(pickupStopId, dropStopId)}
                className="w-full py-3.5 px-6 rounded-2xl bg-white hover:bg-gray-100 text-black font-extrabold text-sm transition-all shadow-xl flex items-center justify-center space-x-2 active:scale-95"
              >
                <span>Book This Ride ({selectedOption.display_name})</span>
                <ArrowRight className="w-4 h-4 text-black" />
              </button>
            </div>
          </div>
        )}

        {/* LPU Fare Policy & Peak Hours Reference Accordion */}
        {fareRules && (
          <section className="bg-gray-900/60 border border-gray-800 rounded-3xl p-5 sm:p-6 space-y-4">
            <div className="flex items-center space-x-2 text-white">
              <Info className="w-4 h-4 text-blue-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider">Campus Transit Fare Policies & Peak Hours</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-gray-400">
              <div className="p-3 bg-gray-800/30 rounded-2xl border border-gray-800 space-y-1">
                <span className="font-bold text-white block">Campus Shuttles (₹0 Free)</span>
                <p className="text-[11px] leading-relaxed">
                  100% subsidized by LPU Student Welfare. Valid student ID card required upon boarding.
                </p>
              </div>

              <div className="p-3 bg-gray-800/30 rounded-2xl border border-gray-800 space-y-1">
                <span className="font-bold text-white block">On-Demand Golf Carts</span>
                <p className="text-[11px] leading-relaxed">
                  Base ₹10 + ₹5/km. Free for students with verified medical or accessibility priority.
                </p>
              </div>

              <div className="p-3 bg-gray-800/30 rounded-2xl border border-gray-800 space-y-1">
                <span className="font-bold text-white block">Smart E-Rickshaws (₹15 Flat)</span>
                <p className="text-[11px] leading-relaxed">
                  Fixed university tariff across all designated central ring stands. No bargaining needed.
                </p>
              </div>
            </div>

            {/* Peak Hours Windows */}
            <div className="pt-2 border-t border-gray-800/60 flex flex-wrap items-center gap-3 text-xs text-gray-300">
              <span className="font-bold text-white">Designated Peak Windows:</span>
              {fareRules.peak_hours.map((p, i) => (
                <span key={i} className="px-2.5 py-1 rounded-full bg-gray-800 border border-gray-700 font-mono text-[11px]">
                  {p.name} ({p.start} - {p.end})
                </span>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
};
