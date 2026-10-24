import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { sseClient } from '../api/sse';
import { Bus, User, Shield, Radio, ChevronDown, Check } from 'lucide-react';

export default function Navbar({ activeView, setActiveView }) {
  const { currentUser, switchPersona, demoProfiles } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [liveConnected, setLiveConnected] = useState(false);

  useEffect(() => {
    const unsub = sseClient.subscribe((event) => {
      if (event.event_type === 'SSE_CONNECTED') setLiveConnected(true);
      if (event.event_type === 'SSE_DISCONNECTED') setLiveConnected(false);
    });
    return () => unsub();
  }, []);

  return (
    <header className="sticky top-0 z-40 w-full glass-panel border-b border-slate-800 bg-slate-950/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveView('student')}>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20 text-white font-black text-xl">
            CR
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight text-white">CampusRide</h1>
              <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-orange-950/80 text-orange-400 border border-orange-600/30">
                LPU
              </span>
            </div>
            <p className="text-[11px] text-slate-400 -mt-0.5">Transport Management Prototype</p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="hidden md:flex items-center gap-1 bg-slate-900/60 p-1 rounded-xl border border-slate-800 text-xs font-medium">
          <button
            onClick={() => setActiveView('student')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeView === 'student'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            Student App
          </button>
          <button
            onClick={() => setActiveView('shuttle_driver')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeView === 'shuttle_driver'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            Shuttle Driver
          </button>
          <button
            onClick={() => setActiveView('cart_driver')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeView === 'cart_driver'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            Golf Cart Driver
          </button>
          <button
            onClick={() => setActiveView('admin')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeView === 'admin'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            Admin Dashboard
          </button>
          <button
            onClick={() => setActiveView('bus_preview')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
              activeView === 'bus_preview'
                ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-sm'
                : 'text-orange-400 hover:text-white hover:bg-orange-500/20'
            }`}
          >
            <span>🚌</span>
            <span className="font-bold">3D Bus</span>
          </button>
          <button
            onClick={() => setActiveView('rickshaw_preview')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
              activeView === 'rickshaw_preview'
                ? 'bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-sm'
                : 'text-emerald-400 hover:text-white hover:bg-emerald-500/20'
            }`}
          >
            <span>🛺</span>
            <span className="font-bold">3D E-Rickshaw</span>
          </button>
          <button
            onClick={() => setActiveView('map_fleet')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
              activeView === 'map_fleet'
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm'
                : 'text-blue-400 hover:text-white hover:bg-blue-600/20'
            }`}
          >
            <span>🗺️</span>
            <span className="font-bold">3D Fleet Map</span>
          </button>
        </nav>

        {/* Live SSE Indicator & Persona Quick Switcher */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono bg-slate-900/80 border border-slate-800 text-slate-300">
            <span className={`w-2 h-2 rounded-full ${liveConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
            <span>{liveConnected ? 'LIVE FEED' : 'CONNECTING'}</span>
          </div>

          <div className="relative">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-xl glass-card hover:bg-slate-800/80 border border-slate-700/60 transition-all text-xs"
            >
              <div className="w-6 h-6 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold">
                {currentUser?.role === 'ADMIN' ? <Shield className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
              </div>
              <div className="text-left hidden sm:block">
                <p className="font-semibold text-slate-200 line-clamp-1">{currentUser?.username || 'Guest'}</p>
                <p className="text-[10px] text-slate-400 -mt-0.5">{currentUser?.role}</p>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 mt-2 w-64 glass-panel rounded-2xl shadow-2xl border border-slate-700/80 py-2 z-50">
                <div className="px-3 py-1.5 border-b border-slate-800/80 text-[10px] uppercase font-bold tracking-wider text-slate-400">
                  Switch Persona (Demo Mode)
                </div>
                {demoProfiles.map((p) => {
                  const isSelected = currentUser?.username === p.username;
                  return (
                    <button
                      key={p.username}
                      onClick={() => {
                        switchPersona(p.username);
                        setDropdownOpen(false);
                        if (p.role === 'DRIVER') {
                          setActiveView(p.driver_type === 'GOLF_CART' ? 'cart_driver' : 'shuttle_driver');
                        } else if (p.role === 'ADMIN') {
                          setActiveView('admin');
                        } else {
                          setActiveView('student');
                        }
                      }}
                      className="w-full px-3 py-2 text-left flex items-center justify-between text-xs hover:bg-slate-800/60 transition-colors"
                    >
                      <div>
                        <p className={`font-medium ${isSelected ? 'text-indigo-400' : 'text-slate-200'}`}>{p.label}</p>
                        <p className="text-[10px] text-slate-400">{p.role}</p>
                      </div>
                      {isSelected && <Check className="w-4 h-4 text-indigo-400" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile view sub-bar */}
      <div className="md:hidden flex items-center justify-around border-t border-slate-800/60 py-2 text-xs bg-slate-900/60 font-medium">
        <button
          onClick={() => setActiveView('student')}
          className={`${activeView === 'student' ? 'text-blue-400 font-bold' : 'text-slate-400'}`}
        >
          Student
        </button>
        <button
          onClick={() => setActiveView('shuttle_driver')}
          className={`${activeView === 'shuttle_driver' ? 'text-blue-400 font-bold' : 'text-slate-400'}`}
        >
          Shuttle
        </button>
        <button
          onClick={() => setActiveView('cart_driver')}
          className={`${activeView === 'cart_driver' ? 'text-blue-400 font-bold' : 'text-slate-400'}`}
        >
          Golf Cart
        </button>
        <button
          onClick={() => setActiveView('admin')}
          className={`${activeView === 'admin' ? 'text-blue-400 font-bold' : 'text-slate-400'}`}
        >
          Admin
        </button>
        <button
          onClick={() => setActiveView('bus_preview')}
          className={`${activeView === 'bus_preview' ? 'text-orange-400 font-bold' : 'text-orange-400/70'}`}
        >
          🚌 Bus
        </button>
        <button
          onClick={() => setActiveView('map_fleet')}
          className={`${activeView === 'map_fleet' ? 'text-blue-400 font-bold' : 'text-blue-400/70'}`}
        >
          🗺️ Fleet
        </button>
      </div>
    </header>
  );
}
