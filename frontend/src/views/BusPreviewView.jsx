import React, { useState, useEffect } from 'react';
import ShuttleBus3D from '../components/ShuttleBus3D.tsx';
import {
  Bus,
  Gauge,
  Compass,
  Users,
  DoorOpen,
  DoorClosed,
  RotateCw,
  Sun,
  Moon,
  Zap,
  Info,
  Download,
  Eye,
  Sparkles,
  Sliders
} from 'lucide-react';

export default function BusPreviewView() {
  // Model state variables
  const [speed, setSpeed] = useState(6.5); // m/s (~23.4 km/h)
  const [steerAngleDeg, setSteerAngleDeg] = useState(0); // degrees
  const [crowd, setCrowd] = useState('moderate');
  const [status, setStatus] = useState('running');
  const [doorsOpen, setDoorsOpen] = useState(false);
  const [route, setRoute] = useState('Route 1 - Uni-Mall Loop');
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
  const [activeTab, setActiveTab] = useState('controls'); // 'controls' | 'specs'

  // Convert steer angle to radians
  const steerRad = (steerAngleDeg * Math.PI) / 180;

  // Auto-close doors if moving at speed > 0.5
  useEffect(() => {
    if (speed > 0.5 && doorsOpen) {
      setDoorsOpen(false);
    }
  }, [speed, doorsOpen]);

  // If status is changed to at_stop, gently stop vehicle
  const handleStatusChange = (newStatus) => {
    setStatus(newStatus);
    if (newStatus === 'at_stop') {
      setSpeed(0);
      setDoorsOpen(true);
    } else if (newStatus === 'running') {
      setDoorsOpen(false);
      if (speed === 0) setSpeed(5.0);
    }
  };

  const routePresets = [
    'Route 1 - Uni-Mall Loop',
    'Route 2 - Girls Hostel Express',
    'Route 3 - Law & Agri Gate',
    'Route 4 - Boys Hostel ⇄ Block 34',
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Header Bar */}
      <div className="bg-slate-900/80 border-b border-slate-800 backdrop-blur-md px-4 sm:px-8 py-3.5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-orange-500 to-amber-500 flex items-center justify-center text-white shadow-lg shadow-orange-500/25">
            <Bus className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                LPU Campus Shuttle Bus 3D
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-orange-500/20 text-orange-400 border border-orange-500/30">
                Procedural Three.js
              </span>
              <span className="hidden sm:inline-block px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                9,322 Triangles &bull; &lt;25k Budget
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Interactive 28-Seat University Mini-Bus &bull; Real Scale (7.5m &times; 2.25m &times; 2.95m)
            </p>
          </div>
        </div>

        {/* Quick Camera Angle Presets */}
        <div className="flex items-center gap-1.5 bg-slate-950/80 p-1 rounded-xl border border-slate-800">
          <span className="text-[11px] font-mono text-slate-400 px-2 hidden md:inline">Camera:</span>
          {[
            { id: 'front34', label: 'Front 3/4' },
            { id: 'side', label: 'Side Profile' },
            { id: 'top', label: 'Top Aerial' },
            { id: 'driver', label: 'Driver Cockpit' },
            { id: 'rear', label: 'Rear' },
          ].map((preset) => (
            <button
              key={preset.id}
              onClick={() => {
                setCameraPreset(preset.id);
                setAutoRotate(false);
              }}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                cameraPreset === preset.id
                  ? 'bg-orange-500 text-white shadow-sm'
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
          {/* 3D Component */}
          <ShuttleBus3D
            speed={speed}
            steer={steerRad}
            crowd={crowd}
            status={status}
            doorsOpen={doorsOpen}
            route={route}
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
                <span className="font-mono text-slate-400 uppercase tracking-wider">Telemetry HUD</span>
                <span className={`w-2 h-2 rounded-full ${status === 'running' ? 'bg-emerald-400 animate-pulse' : status === 'at_stop' ? 'bg-amber-400' : 'bg-rose-400'}`} />
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
                <span>Doors:</span>
                <span className={`font-bold ${doorsOpen ? 'text-amber-400' : 'text-slate-400'}`}>
                  {doorsOpen ? 'OPEN (BOARDING)' : 'CLOSED (IN TRANSIT)'}
                </span>
              </div>
            </div>
          </div>

          {/* Bottom Left: Orbit Hint & Lighting Mode */}
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
                  ? 'bg-orange-500 text-white border-orange-400'
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
              href="/models/shuttle-bus.glb"
              download="lpu-campus-shuttle-bus.glb"
              className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white text-xs font-bold shadow-xl shadow-orange-500/25 flex items-center gap-2 transition-all"
            >
              <Download className="w-4 h-4" />
              <span>Download 3D GLB Model (422 KB)</span>
            </a>
          </div>
        </div>

        {/* Right Sidebar: Comprehensive Interactive Control Panel */}
        <div className="w-full lg:w-96 bg-slate-900/90 border-t lg:border-t-0 lg:border-l border-slate-800 p-5 overflow-y-auto flex flex-col gap-5 backdrop-blur-md shadow-2xl">
          {/* Navigation tab inside sidebar */}
          <div className="flex border-b border-slate-800 pb-3">
            <button
              onClick={() => setActiveTab('controls')}
              className={`flex-1 pb-1.5 text-xs font-bold transition-all border-b-2 flex items-center justify-center gap-1.5 ${
                activeTab === 'controls'
                  ? 'border-orange-500 text-orange-400'
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
                  ? 'border-orange-500 text-orange-400'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              <Info className="w-3.5 h-3.5" />
              <span>Model Specs</span>
            </button>
          </div>

          {activeTab === 'controls' ? (
            <div className="space-y-5">
              {/* Route Picker */}
              <div>
                <label className="text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <Compass className="w-3.5 h-3.5 text-orange-400" />
                  <span>Assigned Campus Route</span>
                </label>
                <select
                  value={route}
                  onChange={(e) => setRoute(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 text-white text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  {routePresets.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  Updates 3D front LED destination matrix and roof telematics in real-time.
                </p>
              </div>

              {/* Status Selector */}
              <div>
                <label className="text-xs font-bold text-slate-300 mb-1.5 block">
                  Trip Operational Status
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'running', label: 'Running', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' },
                    { id: 'at_stop', label: 'At Stop', color: 'bg-amber-500/20 text-amber-400 border-amber-500/40' },
                    { id: 'offline', label: 'Offline', color: 'bg-rose-500/20 text-rose-400 border-rose-500/40' },
                  ].map((s) => (
                    <button
                      key={s.id}
                      onClick={() => handleStatusChange(s.id)}
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

              {/* Crowd Selector */}
              <div>
                <label className="text-xs font-bold text-slate-300 mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-blue-400" />
                    <span>Crowd Level Telematics</span>
                  </span>
                  <span className="font-mono text-[11px] text-slate-400 uppercase">{crowd}</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'low', label: 'Low (<40%)', activeClass: 'bg-emerald-600 text-white' },
                    { id: 'moderate', label: 'Mod (40-80%)', activeClass: 'bg-amber-600 text-white' },
                    { id: 'full', label: 'Full (>80%)', activeClass: 'bg-rose-600 text-white' },
                  ].map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setCrowd(c.id)}
                      className={`py-2 px-1 text-center rounded-xl text-xs font-bold transition-all border ${
                        crowd === c.id
                          ? `${c.activeClass} border-transparent shadow-md`
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                      }`}
                    >
                      {c.label}
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
                  max="15"
                  step="0.5"
                  value={speed}
                  onChange={(e) => setSpeed(parseFloat(e.target.value))}
                  className="w-full accent-cyan-400 h-2 bg-slate-800 rounded-lg cursor-pointer"
                />
                <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono mt-1">
                  <span>0 (Stopped)</span>
                  <span>7.5 m/s (~27 km/h)</span>
                  <span>15 m/s (~54 km/h)</span>
                </div>
              </div>

              {/* Steering Wheel Slider */}
              <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <Compass className="w-3.5 h-3.5 text-amber-400" />
                    <span>Front Wheel Steering</span>
                  </span>
                  <span className="font-mono text-xs font-black text-amber-400">
                    {steerAngleDeg}&deg;
                  </span>
                </div>
                <input
                  type="range"
                  min="-32"
                  max="32"
                  step="2"
                  value={steerAngleDeg}
                  onChange={(e) => setSteerAngleDeg(parseInt(e.target.value, 10))}
                  className="w-full accent-amber-400 h-2 bg-slate-800 rounded-lg cursor-pointer"
                />
                <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono mt-1">
                  <span>-32&deg; (Left)</span>
                  <button
                    type="button"
                    onClick={() => setSteerAngleDeg(0)}
                    className="text-slate-400 hover:text-white underline"
                  >
                    Center (0&deg;)
                  </button>
                  <span>+32&deg; (Right)</span>
                </div>
              </div>

              {/* Doors Toggle */}
              <div>
                <button
                  type="button"
                  onClick={() => setDoorsOpen(!doorsOpen)}
                  className={`w-full py-3 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 border transition-all ${
                    doorsOpen
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-lg shadow-amber-500/10'
                      : 'bg-slate-950 text-slate-300 border-slate-800 hover:bg-slate-800'
                  }`}
                >
                  {doorsOpen ? <DoorOpen className="w-4 h-4" /> : <DoorClosed className="w-4 h-4" />}
                  <span>{doorsOpen ? 'Doors: OPEN (Stepwell Active)' : 'Doors: CLOSED (Sealed for Transit)'}</span>
                </button>
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
                <p className="text-[11px] text-slate-500 mt-1">
                  Disables contact shadows and clearcoat reflections for guaranteed 60fps on weak devices.
                </p>
              </div>
            </div>
          ) : (
            /* Model Specs & Architecture Info */
            <div className="space-y-4 text-xs text-slate-300">
              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2">
                <h4 className="font-bold text-white text-sm flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-orange-400" />
                  <span>Procedural Specifications</span>
                </h4>
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/80 font-mono text-[11px]">
                  <div>
                    <span className="text-slate-500 block">Length:</span>
                    <span className="text-white font-bold">7.50 m</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Width:</span>
                    <span className="text-white font-bold">2.25 m</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Height:</span>
                    <span className="text-white font-bold">2.95 m</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Capacity:</span>
                    <span className="text-white font-bold">28 Seats + Wheelchair</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Triangles:</span>
                    <span className="text-emerald-400 font-bold">9,322</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Budget Limit:</span>
                    <span className="text-slate-400 font-bold">&lt; 25,000</span>
                  </div>
                </div>
              </div>

              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2.5">
                <h4 className="font-bold text-white text-sm">Component Hierarchy</h4>
                <ul className="space-y-1.5 text-[11px] font-mono text-slate-400">
                  <li className="flex items-center gap-1.5">
                    <span className="text-orange-400">&bull;</span>
                    <strong className="text-slate-200">Body:</strong> Extruded white cowl, orange stripe, dark skirts, bumper.
                  </li>
                  <li className="flex items-center gap-1.5">
                    <span className="text-orange-400">&bull;</span>
                    <strong className="text-slate-200">Doors:</strong> Dual pneumatic plug-sliding leaves &amp; stepwell.
                  </li>
                  <li className="flex items-center gap-1.5">
                    <span className="text-orange-400">&bull;</span>
                    <strong className="text-slate-200">Wheels:</strong> Front steer knuckles, spin rotation, brake calipers.
                  </li>
                  <li className="flex items-center gap-1.5">
                    <span className="text-orange-400">&bull;</span>
                    <strong className="text-slate-200">Roof:</strong> Dual AC units, destination LED, antenna, escape hatches.
                  </li>
                  <li className="flex items-center gap-1.5">
                    <span className="text-orange-400">&bull;</span>
                    <strong className="text-slate-200">Interior:</strong> 26 passenger seats, grab poles, driver cockpit.
                  </li>
                  <li className="flex items-center gap-1.5">
                    <span className="text-orange-400">&bull;</span>
                    <strong className="text-slate-200">Lights:</strong> Projector headlights, brake glow, blinkers.
                  </li>
                </ul>
              </div>

              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                <h4 className="font-bold text-white text-sm mb-1.5">Two Deployment Modes</h4>
                <p className="text-[11px] text-slate-400 leading-relaxed mb-2">
                  <strong>1. Showcase:</strong> Full canvas studio with soft contact shadows, clearcoat shaders, and orbit controls.
                </p>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  <strong>2. Map Vehicle:</strong> Real-world scaled mesh for MapLibre/Leaflet layers, aligned to GPS compass heading.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
