import React, { useState } from 'react';
import VehicleLayerMap from '../components/VehicleLayerMap.tsx';
import { Layers, Activity, Sparkles, Compass } from 'lucide-react';

export default function MapFleetView() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Header Bar */}
      <div className="bg-slate-900/80 border-b border-slate-800 backdrop-blur-md px-4 sm:px-8 py-3.5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/25 font-black text-xl">
            🗺️
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                LPU 3D MapLibre Fleet Telematics
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-500/20 text-blue-400 border border-blue-500/30">
                Unified VehicleLayer
              </span>
              <span className="hidden sm:inline-block px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                Shared WebGL Context &bull; 60 FPS Target
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Live MapLibre Custom Layer &bull; 24 Animated 3D Vehicles (Shuttles, Golf Carts, E-Rickshaws) with Level-Of-Detail
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-900 border border-slate-800">
            <Compass className="w-3.5 h-3.5 text-blue-400" />
            <span>LPU Main Campus &bull; 31.2550&deg; N, 75.7050&deg; E</span>
          </span>
        </div>
      </div>

      {/* Main Map Stage */}
      <div className="flex-1 p-3 sm:p-6 flex flex-col">
        <div className="w-full relative rounded-2xl overflow-hidden shadow-2xl border border-slate-800 min-h-[720px] h-[750px]">
          <VehicleLayerMap height="h-[750px]" />
        </div>
      </div>
    </div>
  );
}
