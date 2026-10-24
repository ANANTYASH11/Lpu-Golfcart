import React, { useState, useEffect } from 'react';
import ERickshaw3D from '../components/ERickshaw3D.tsx';
import {
  Compass,
  Gauge,
  Users,
  Zap,
  RotateCw,
  Sun,
  Moon,
  Info,
  Download,
  Eye,
  Sliders,
  DollarSign,
  Palette
} from 'lucide-react';

export default function RickshawPreviewView() {
  // Model state variables
  const [speed, setSpeed] = useState(4.5); // m/s (~16.2 km/h)
  const [steerAngleDeg, setSteerAngleDeg] = useState(0); // degrees
  const [status, setStatus] = useState('available');
  const [seatsFree, setSeatsFree] = useState(2); // 2 free, 2 occupied
  const [fare, setFare] = useState(15); // ₹15 flat campus fare
  const [colorScheme, setColorScheme] = useState('classic'); // 'classic' | 'lpu'
  const [autoRotate, setAutoRotate] = useState(false);
  const [lowPower, setLowPower] = useState(false);
  const [isNight, setIsNight] = useState(false);
  const [showHotspots, setShowHotspots] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('hotspots') === '1';
    }
    return false;
  });
  const [cameraPreset, setCameraPreset] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const p = params.get('preset');
      if (p && ['front34', 'side', 'top', 'rear', 'driver'].includes(p)) {
        return p;
      }
    }
    return 'front34';
  });
  const [activeTab, setActiveTab] = useState('controls');

  const steerRad = (steerAngleDeg * Math.PI) / 180;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Header Bar */}
      <div className="bg-slate-900/80 border-b border-slate-800 backdrop-blur-md px-4 sm:px-8 py-3.5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-green-600 flex items-center justify-center text-white shadow-lg shadow-emerald-500/25 text-xl font-bold">
            🛺
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                LPU Campus Electric Rickshaw 3D
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                Procedural 3-Wheeler
              </span>
              <span className="hidden sm:inline-block px-2 py-0.5 rounded-full text-[10px] font-mono bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                3,762 Triangles &bull; &lt;12k Budget
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Indian Passenger E-Rickshaw &bull; Real Scale (2.6m &times; 1.1m &times; 1.75m) &bull; Handlebar Steering
            </p>
          </div>
        </div>

        {/* Camera Angle Presets */}
        <div className="flex items-center gap-1.5 bg-slate-950/80 p-1 rounded-xl border border-slate-800">
          <span className="text-[11px] font-mono text-slate-400 px-2 hidden md:inline">Camera:</span>
          {[
            { id: 'front34', label: 'Front 3/4' },
            { id: 'side', label: 'Side Profile' },
            { id: 'top', label: 'Top Aerial' },
            { id: 'driver', label: 'Handlebar View' },
            { id: 'rear', label: 'Rear Step' },
          ].map((preset) => (
            <button
              key={preset.id}
              onClick={() => {
                setCameraPreset(preset.id);
                setAutoRotate(false);
              }}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                cameraPreset === preset.id
                  ? 'bg-emerald-500 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Showcase Layout */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
        {/* 3D Canvas Stage */}
        <div className="flex-1 relative min-h-[480px] lg:min-h-[640px] bg-gradient-to-b from-slate-950 via-slate-900 to-black">
          <ERickshaw3D
            speed={speed}
            steer={steerRad}
            status={status}
            seatsFree={seatsFree}
            fare={fare}
            colorScheme={colorScheme}
            autoRotate={autoRotate}
            lowPower={lowPower}
            showHotspots={showHotspots}
            cameraPreset={cameraPreset}
            isNight={isNight}
            className="w-full h-full"
          />

          {/* Floating Canvas Overlays */}
          {/* Top Left: Live Telemetry Overlay */}
          <div className="absolute top-4 left-4 z-10 flex flex-col gap-2 pointer-events-none select-none">
            <div className="glass-panel bg-slate-900/85 border border-slate-800/90 rounded-2xl p-3 shadow-2xl backdrop-blur-md min-w-[210px]">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800 text-xs">
                <span className="font-mono text-slate-400 uppercase tracking-wider">Rickshaw Telemetry</span>
                <span className={`w-2 h-2 rounded-full ${status === 'available' ? 'bg-emerald-400 animate-pulse' : status === 'busy' ? 'bg-amber-400' : 'bg-rose-400'}`} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-[10px] text-slate-400 uppercase font-semibold">Speed</div>
                  <div className="text-xl font-black text-cyan-400 font-mono">
                    {(speed * 3.6).toFixed(1)} <span className="text-xs text-slate-400">km/h</span>
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono">{speed.toFixed(1)} m/s</div>
                </div>

                <div>
                  <div className="text-[10px] text-slate-400 uppercase font-semibold">Steering</div>
                  <div className="text-xl font-black text-amber-400 font-mono">
                    {steerAngleDeg > 0 ? `+${steerAngleDeg}` : steerAngleDeg}&deg;
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono">
                    {steerAngleDeg === 0 ? 'Straight' : steerAngleDeg > 0 ? 'Right Turn' : 'Left Turn'}
                  </div>
                </div>
              </div>

              <div className="mt-2.5 pt-2 border-t border-slate-800 text-[11px] flex items-center justify-between text-slate-300">
                <span>Seats Available:</span>
                <span className="font-bold text-amber-400">
                  {seatsFree} / 4 Free ({4 - seatsFree} Onboard)
                </span>
              </div>
            </div>
          </div>

          {/* Bottom Left: Orbit & Lighting Controls */}
          <div className="absolute bottom-4 left-4 z-10 flex items-center gap-2">
            <button
              onClick={() => setIsNight(!isNight)}
              className="px-3 py-1.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-xs font-semibold text-slate-300 border border-slate-800 backdrop-blur-md flex items-center gap-2 shadow-lg transition-all"
            >
              {isNight ? <Moon className="w-3.5 h-3.5 text-indigo-400" /> : <Sun className="w-3.5 h-3.5 text-amber-400" />}
              <span>{isNight ? 'Night Campus' : 'Studio Daylight'}</span>
            </button>

            <button
              onClick={() => setAutoRotate(!autoRotate)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border backdrop-blur-md flex items-center gap-2 shadow-lg transition-all ${
                autoRotate
                  ? 'bg-emerald-500 text-white border-emerald-400'
                  : 'bg-slate-900/80 hover:bg-slate-800 text-slate-300 border-slate-800'
              }`}
            >
              <RotateCw className={`w-3.5 h-3.5 ${autoRotate ? 'animate-spin' : ''}`} />
              <span>Turntable 360&deg;</span>
            </button>

            <button
              onClick={() => setShowHotspots(!showHotspots)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border backdrop-blur-md flex items-center gap-2 shadow-lg transition-all ${
                showHotspots
                  ? 'bg-blue-600 text-white border-blue-500'
                  : 'bg-slate-900/80 hover:bg-slate-800 text-slate-300 border-slate-800'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Feature Hotspots</span>
            </button>
          </div>

          {/* Bottom Right: Quick Download GLB button */}
          <div className="absolute bottom-4 right-4 z-10">
            <a
              href="/models/e-rickshaw.glb"
              download="lpu-campus-e-rickshaw.glb"
              className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white text-xs font-bold shadow-xl shadow-emerald-500/25 flex items-center gap-2 transition-all"
            >
              <Download className="w-4 h-4" />
              <span>Download 3D GLB Model (244 KB)</span>
            </a>
          </div>
        </div>

        {/* Right Sidebar: Comprehensive Interactive Control Panel */}
        <div className="w-full lg:w-96 bg-slate-900/90 border-t lg:border-t-0 lg:border-l border-slate-800 p-5 overflow-y-auto flex flex-col gap-5 backdrop-blur-md shadow-2xl">
          <div className="flex border-b border-slate-800 pb-3">
            <button
              onClick={() => setActiveTab('controls')}
              className={`flex-1 pb-1.5 text-xs font-bold transition-all border-b-2 flex items-center justify-center gap-1.5 ${
                activeTab === 'controls'
                  ? 'border-emerald-500 text-emerald-400'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Live Controls</span>
            </button>
            <button
              onClick={() => setActiveTab('specs')}
              className={`flex-1 pb-1.5 text-xs font-bold transition-all border-b-2 flex items-center justify-center gap-1.5 ${
                activeTab === 'specs'
                  ? 'border-emerald-500 text-emerald-400'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              <Info className="w-3.5 h-3.5" />
              <span>Model Specs</span>
            </button>
          </div>

          {activeTab === 'controls' ? (
            <div className="space-y-5">
              {/* Color Scheme Picker */}
              <div>
                <label className="text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <Palette className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Color Scheme (colorScheme prop)</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setColorScheme('classic')}
                    className={`p-2.5 rounded-xl border text-left text-xs font-bold flex items-center gap-2.5 transition-all ${
                      colorScheme === 'classic'
                        ? 'bg-emerald-950/60 text-emerald-300 border-emerald-500 shadow-md ring-2 ring-emerald-500/20'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                    }`}
                  >
                    <div className="w-4 h-4 rounded-full bg-gradient-to-tr from-green-600 to-yellow-400 border border-white/20 shrink-0" />
                    <div>
                      <div>Classic Auto</div>
                      <div className="text-[10px] text-slate-400 font-normal">Green &amp; Yellow</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setColorScheme('lpu')}
                    className={`p-2.5 rounded-xl border text-left text-xs font-bold flex items-center gap-2.5 transition-all ${
                      colorScheme === 'lpu'
                        ? 'bg-orange-950/60 text-orange-300 border-orange-500 shadow-md ring-2 ring-orange-500/20'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                    }`}
                  >
                    <div className="w-4 h-4 rounded-full bg-gradient-to-tr from-white to-orange-500 border border-white/20 shrink-0" />
                    <div>
                      <div>LPU Fleet</div>
                      <div className="text-[10px] text-slate-400 font-normal">White &amp; Orange</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Status Selector */}
              <div>
                <label className="text-xs font-bold text-slate-300 mb-1.5 block">
                  Service Availability Status
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'available', label: 'Available', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' },
                    { id: 'busy', label: 'Busy (Hired)', color: 'bg-amber-500/20 text-amber-400 border-amber-500/40' },
                    { id: 'offline', label: 'Offline', color: 'bg-rose-500/20 text-rose-400 border-rose-500/40' },
                  ].map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setStatus(s.id)}
                      className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all ${
                        status === s.id
                          ? `${s.color} ring-2 ring-white/20 shadow-md`
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Seats Free Selector */}
              <div>
                <label className="text-xs font-bold text-slate-300 mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-blue-400" />
                    <span>Free Passenger Seats (seatsFree prop)</span>
                  </span>
                  <span className="font-mono text-[11px] text-amber-400 font-bold">{seatsFree} Free</span>
                </label>
                <div className="grid grid-cols-5 gap-1.5">
                  {[4, 3, 2, 1, 0].map((num) => (
                    <button
                      key={num}
                      onClick={() => setSeatsFree(num)}
                      className={`py-2 rounded-xl text-xs font-bold transition-all border ${
                        seatsFree === num
                          ? 'bg-emerald-600 text-white border-transparent shadow-md'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                      }`}
                    >
                      {num === 0 ? 'Full' : `${num} Free`}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Dynamically shows/hides stylized passenger figures sitting in the face-to-face benches.
                </p>
              </div>

              {/* Fare Selector */}
              <div>
                <label className="text-xs font-bold text-slate-300 mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Fixed Tariff (fare prop)</span>
                  </span>
                  <span className="font-mono text-xs font-black text-emerald-400">₹{fare}</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[10, 15, 20].map((f) => (
                    <button
                      key={f}
                      onClick={() => setFare(f)}
                      className={`py-2 rounded-xl text-xs font-bold transition-all border ${
                        fare === f
                          ? 'bg-gradient-to-r from-emerald-600 to-green-600 text-white border-transparent shadow-md'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                      }`}
                    >
                      ₹{f} Flat
                    </button>
                  ))}
                </div>
              </div>

              {/* Speed Slider */}
              <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <Gauge className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Speed Control</span>
                  </span>
                  <span className="font-mono text-xs font-black text-cyan-400">
                    {(speed * 3.6).toFixed(1)} km/h
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="8"
                  step="0.5"
                  value={speed}
                  onChange={(e) => setSpeed(parseFloat(e.target.value))}
                  className="w-full accent-cyan-400 h-2 bg-slate-800 rounded-lg cursor-pointer"
                />
                <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono mt-1">
                  <span>0 (Stopped)</span>
                  <span>4 m/s (~14.4 km/h)</span>
                  <span>8 m/s (~28.8 km/h)</span>
                </div>
              </div>

              {/* Steering Handlebar Slider */}
              <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <Compass className="w-3.5 h-3.5 text-amber-400" />
                    <span>Handlebar Steering</span>
                  </span>
                  <span className="font-mono text-xs font-black text-amber-400">
                    {steerAngleDeg}&deg;
                  </span>
                </div>
                <input
                  type="range"
                  min="-30"
                  max="30"
                  step="2"
                  value={steerAngleDeg}
                  onChange={(e) => setSteerAngleDeg(parseInt(e.target.value, 10))}
                  className="w-full accent-amber-400 h-2 bg-slate-800 rounded-lg cursor-pointer"
                />
                <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono mt-1">
                  <span>-30&deg; (Left)</span>
                  <button
                    type="button"
                    onClick={() => setSteerAngleDeg(0)}
                    className="text-slate-400 hover:text-white underline"
                  >
                    Center (0&deg;)
                  </button>
                  <span>+30&deg; (Right)</span>
                </div>
              </div>

              {/* Low Power Toggle */}
              <div className="pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setLowPower(!lowPower)}
                  className={`w-full py-2.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-between border transition-all ${
                    lowPower
                      ? 'bg-emerald-950/40 text-emerald-300 border-emerald-500/40'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-emerald-400" />
                    <span>Low-Power / Mobile Mode</span>
                  </span>
                  <span className="font-mono text-[10px] font-bold">
                    {lowPower ? 'ENABLED' : 'DISABLED'}
                  </span>
                </button>
              </div>
            </div>
          ) : (
            /* Model Specs */
            <div className="space-y-4 text-xs text-slate-300">
              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2">
                <h4 className="font-bold text-white text-sm">3D E-Rickshaw Specs</h4>
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/80 font-mono text-[11px]">
                  <div>
                    <span className="text-slate-500 block">Length:</span>
                    <span className="text-white font-bold">2.60 m</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Width:</span>
                    <span className="text-white font-bold">1.10 m</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Height:</span>
                    <span className="text-white font-bold">1.75 m</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Capacity:</span>
                    <span className="text-white font-bold">1 Driver + 4 Pax</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Triangles:</span>
                    <span className="text-emerald-400 font-bold">3,762</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Budget Limit:</span>
                    <span className="text-slate-400 font-bold">&lt; 12,000</span>
                  </div>
                </div>
              </div>

              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2.5">
                <h4 className="font-bold text-white text-sm">Named Hierarchy</h4>
                <ul className="space-y-1.5 text-[11px] font-mono text-slate-400">
                  <li>&bull; <strong className="text-slate-200">Body:</strong> Tubular steel ladder chassis, curved apron, windshield.</li>
                  <li>&bull; <strong className="text-slate-200">Handlebar:</strong> Steering column, grips, brake levers, battery SOC meter.</li>
                  <li>&bull; <strong className="text-slate-200">Wheels:</strong> 1 front wheel (steers with fork) + 2 rear differential wheels.</li>
                  <li>&bull; <strong className="text-slate-200">Seats:</strong> Driver bucket seat + 2 face-to-face 2-seater benches.</li>
                  <li>&bull; <strong className="text-slate-200">Roof:</strong> Domed canopy on 4 slim posts, rear curtain, LED sign.</li>
                  <li>&bull; <strong className="text-slate-200">Lights:</strong> Round LED headlight, rear brake lights, indicators.</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
