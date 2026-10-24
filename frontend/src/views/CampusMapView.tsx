import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../theme/ThemeContext';
import VehicleLayerMap from '../components/VehicleLayerMap';
import {
  ArrowLeft,
  Search,
  MapPin,
  Bus,
  Zap,
  Navigation,
  Compass,
  CheckCircle2,
  PhoneCall,
  Sun,
  Moon,
  ChevronRight,
  Sparkles,
  Layers,
  X
} from 'lucide-react';

interface CampusMapViewProps {
  onBack: () => void;
  onBookRide: (defaults?: { pickup?: string; drop?: string }) => void;
}

const CAMPUS_POIS = [
  { id: 1, name: 'Main Gate (Gate 1)', code: 'MG-01', type: 'Hub', desc: 'Entry point, Auto stand, Shuttle Hub' },
  { id: 2, name: 'Uni-Mall Commercial Centre', code: 'UM-02', type: 'Commercial', desc: 'Food court, retail stores, banks' },
  { id: 3, name: 'Block 32 (Computer Science)', code: 'B32', type: 'Academic', desc: 'CSE & IT Engineering Complex' },
  { id: 4, name: 'Block 34 (Engineering Labs)', code: 'B34', type: 'Academic', desc: 'Robotics, Electronics & Mechanical Labs' },
  { id: 5, name: 'Block 38 (Mittal Business School)', code: 'B38', type: 'Academic', desc: 'Management & Economics Auditorium' },
  { id: 6, name: 'Central Library', code: 'LIB', type: 'Resource', desc: '4-Storey university research library' },
  { id: 7, name: 'Girls Hostel Complex (GH-1 to GH-6)', code: 'GH', type: 'Residential', desc: 'Residential block, gym, dining hall' },
  { id: 8, name: 'Boys Hostel Complex (BH-1 to BH-8)', code: 'BH', type: 'Residential', desc: 'Residential block, sports courts' },
  { id: 9, name: 'Shanti Devi Mittal Auditorium', code: 'AUD', type: 'Events', desc: 'Convocation & cultural auditorium' },
  { id: 10, name: 'University Health Centre Hospital', code: 'HC', type: 'Medical', desc: '24x7 Emergency, OPD & Pharmacy' },
];

export default function CampusMapView({ onBack, onBookRide }: CampusMapViewProps) {
  const { mode, toggleTheme } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPoi, setSelectedPoi] = useState<typeof CAMPUS_POIS[0] | null>(null);
  const [selectedVehicle, setSelectedVehicle] = useState<any | null>(null);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [locateStatus, setLocateStatus] = useState<string | null>(null);

  const filteredPois = CAMPUS_POIS.filter(poi =>
    poi.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    poi.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    poi.type.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      setLocateStatus('GPS not supported in this browser');
      setTimeout(() => setLocateStatus(null), 3000);
      return;
    }
    setLocateStatus('Acquiring campus GPS...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocateStatus(`GPS Locked: ${pos.coords.latitude.toFixed(4)}°N, ${pos.coords.longitude.toFixed(4)}°E`);
        setTimeout(() => setLocateStatus(null), 4000);
      },
      () => {
        // Fallback demo campus position
        setLocateStatus('Located near Uni-Mall (Demo GPS)');
        setTimeout(() => setLocateStatus(null), 4000);
      },
      { timeout: 5000 }
    );
  };

  return (
    <div className="relative w-full h-screen overflow-hidden bg-white dark:bg-[#000000] text-black dark:text-white flex flex-col font-sans">
      {/* ---------------- TOP FLOATING GLASS HEADER ---------------- */}
      <div className="absolute top-4 left-4 right-4 z-30 pointer-events-auto flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Left: Back & Title Bar */}
        <div className="flex items-center gap-3 bg-white/90 dark:bg-black/90 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-black/10 dark:border-white/10 shadow-xl">
          <button
            onClick={onBack}
            className="w-9 h-9 rounded-full bg-[#F3F3F3] dark:bg-[#1C1C1C] flex items-center justify-center hover:bg-[#EAEAEA] dark:hover:bg-[#2A2A2A] transition-colors"
            aria-label="Back"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-base tracking-tight">LPU Campus Map</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#05A357]/15 text-[#05A357] border border-[#05A357]/30 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#05A357] animate-pulse" />
                24 Active Fleet
              </span>
            </div>
            <p className="text-[11px] text-[#5E5E5E] dark:text-[#A6A6A6]">
              3D Vector Buildings &bull; Live GPS Shuttles &amp; Carts
            </p>
          </div>
        </div>

        {/* Center: Interactive POI Search */}
        <div className="relative flex-1 max-w-md">
          <div className="relative flex items-center">
            <Search className="w-4 h-4 absolute left-3.5 text-[#5E5E5E] dark:text-[#A6A6A6]" />
            <input
              type="text"
              placeholder="Search building, block or stop (e.g. Block 32)..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowSearchDropdown(true);
              }}
              onFocus={() => setShowSearchDropdown(true)}
              className="w-full pl-10 pr-9 py-2.5 rounded-2xl text-xs font-semibold bg-white/95 dark:bg-black/90 backdrop-blur-md border border-black/10 dark:border-white/10 shadow-xl focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all placeholder:text-[#888888]"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setShowSearchDropdown(false);
                }}
                className="absolute right-3 text-[#888888] hover:text-black dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Autocomplete Dropdown */}
          <AnimatePresence>
            {showSearchDropdown && searchQuery.trim().length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-[#111111] border border-black/10 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden max-h-72 overflow-y-auto z-50 divide-y divide-[#E2E2E2] dark:divide-[#222222]"
              >
                {filteredPois.length > 0 ? (
                  filteredPois.map((poi) => (
                    <button
                      key={poi.id}
                      onClick={() => {
                        setSelectedPoi(poi);
                        setSelectedVehicle(null);
                        setShowSearchDropdown(false);
                        setSearchQuery(poi.name);
                      }}
                      className="w-full p-3 text-left hover:bg-[#F3F3F3] dark:hover:bg-[#1C1C1C] transition-colors flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-lg bg-black/5 dark:bg-white/10 flex items-center justify-center text-xs font-bold">
                          <MapPin className="w-3.5 h-3.5 text-black dark:text-white" />
                        </div>
                        <div>
                          <div className="text-xs font-bold">{poi.name}</div>
                          <div className="text-[10px] text-[#5E5E5E] dark:text-[#A6A6A6]">{poi.desc}</div>
                        </div>
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-black/5 dark:bg-white/10 text-[#5E5E5E] dark:text-[#A6A6A6]">
                        {poi.code}
                      </span>
                    </button>
                  ))
                ) : (
                  <div className="p-4 text-center text-xs text-[#888888]">
                    No campus stops matching "{searchQuery}"
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right: GPS Locate & Theme */}
        <div className="flex items-center gap-2 self-end sm:self-auto bg-white/90 dark:bg-black/90 backdrop-blur-md px-3 py-2 rounded-2xl border border-black/10 dark:border-white/10 shadow-xl">
          <button
            onClick={handleLocateMe}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F3F3F3] dark:bg-[#1C1C1C] text-xs font-semibold hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-all"
            title="Locate my position on campus"
          >
            <Navigation className="w-3.5 h-3.5" />
            <span>My Location</span>
          </button>
          <button
            onClick={toggleTheme}
            className="w-8 h-8 rounded-xl bg-[#F3F3F3] dark:bg-[#1C1C1C] flex items-center justify-center text-black dark:text-white hover:bg-[#EAEAEA] dark:hover:bg-[#2A2A2A] transition-colors"
            aria-label="Toggle Theme"
          >
            {mode === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Locate Notification Banner */}
      <AnimatePresence>
        {locateStatus && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-20 left-1/2 -translate-x-1/2 z-40 bg-black text-white px-4 py-2 rounded-full text-xs font-semibold shadow-2xl flex items-center gap-2 border border-white/20"
          >
            <span className="w-2 h-2 rounded-full bg-[#05A357] animate-ping" />
            <span>{locateStatus}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ---------------- MAIN FULLSCREEN 3D MAP CANVAS ---------------- */}
      <div className="flex-1 w-full h-full relative">
        <VehicleLayerMap
          height="h-full"
          className="w-full h-full"
          onSelectVehicle={(veh) => {
            setSelectedVehicle(veh);
            setSelectedPoi(null);
          }}
        />
      </div>

      {/* ---------------- BOTTOM CARD FOR SELECTED POI OR VEHICLE ---------------- */}
      <AnimatePresence>
        {(selectedPoi || selectedVehicle) && (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            className="absolute bottom-6 left-4 right-4 max-w-xl mx-auto z-30 bg-white/95 dark:bg-black/95 backdrop-blur-xl border border-black/10 dark:border-white/15 p-5 rounded-3xl shadow-2xl text-black dark:text-white"
          >
            {/* Close Button */}
            <button
              onClick={() => {
                setSelectedPoi(null);
                setSelectedVehicle(null);
              }}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-[#F3F3F3] dark:bg-[#1C1C1C] flex items-center justify-center text-[#5E5E5E] dark:text-[#A6A6A6] hover:text-black dark:hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>

            {selectedPoi && (
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-black/5 dark:bg-white/10 uppercase tracking-wider text-[#5E5E5E] dark:text-[#A6A6A6]">
                    Campus Stop &bull; {selectedPoi.code}
                  </span>
                  <span className="text-xs font-medium text-[#05A357] flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Shuttle &amp; Cart Access
                  </span>
                </div>

                <h3 className="text-lg font-black tracking-tight mb-1">{selectedPoi.name}</h3>
                <p className="text-xs text-[#5E5E5E] dark:text-[#A6A6A6] mb-4">{selectedPoi.desc}</p>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onBookRide({ drop: selectedPoi.name })}
                    className="uber-btn-primary flex-1 shadow-lg flex items-center justify-center gap-2 text-xs font-bold py-3"
                  >
                    <span>Ride Here</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onBookRide({ pickup: selectedPoi.name })}
                    className="flex-1 py-3 px-4 rounded-full border border-black/10 dark:border-white/20 text-xs font-bold hover:bg-[#F3F3F3] dark:hover:bg-[#1C1C1C] transition-colors flex items-center justify-center gap-1.5"
                  >
                    <span>Pickup From Here</span>
                  </button>
                </div>
              </div>
            )}

            {selectedVehicle && (
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-black/5 dark:bg-white/10 uppercase tracking-wider">
                    {selectedVehicle.type === 'shuttle' ? 'Shuttle Bus' : selectedVehicle.type === 'cart' ? 'Golf Cart' : 'Smart E-Rickshaw'} &bull; {selectedVehicle.code}
                  </span>
                  <span className="text-xs font-medium text-[#05A357]">
                    {selectedVehicle.status === 'running' ? 'In Transit' : selectedVehicle.status === 'at_stop' ? 'At Stop' : 'Available'}
                  </span>
                </div>

                <h3 className="text-lg font-black tracking-tight mb-1">
                  {selectedVehicle.route || selectedVehicle.driverName || 'Campus Transit Fleet'}
                </h3>
                <p className="text-xs text-[#5E5E5E] dark:text-[#A6A6A6] mb-4">
                  Driver: {selectedVehicle.driverName || 'University Driver'} &bull; Speed: {selectedVehicle.speed?.toFixed(1) || '12'} km/h &bull; Capacity: {selectedVehicle.capacity || 4} seats
                </p>

                <button
                  onClick={() => onBookRide({ pickup: selectedVehicle.currentStopName || 'Main Gate (Gate 1)' })}
                  className="uber-btn-primary w-full shadow-lg flex items-center justify-center gap-2 text-xs font-bold py-3"
                >
                  <span>Request Ride on this Route</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
