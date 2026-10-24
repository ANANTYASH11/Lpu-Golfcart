import React, { useState, useEffect } from 'react';
import { useTheme } from '../theme/ThemeContext';
import { api } from '../api/client';
import {
  ArrowLeft,
  Shield,
  Bus,
  Car,
  Users,
  AlertTriangle,
  RefreshCw,
  Sun,
  Moon,
  CheckCircle2,
  Activity,
  BatteryCharging,
} from 'lucide-react';

interface UberAdminViewProps {
  onBack: () => void;
}

export default function UberAdminView({ onBack }: UberAdminViewProps) {
  const { mode, tokens, toggleTheme } = useTheme();
  const [fleetStatus, setFleetStatus] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcastSent, setBroadcastSent] = useState(false);

  useEffect(() => {
    // Initial simulated fleet data
    setFleetStatus([
      { id: 'SH-101', type: 'Shuttle Bus', driver: 'Sukhwinder S.', route: 'Circular North', status: 'In Transit', battery: '88%' },
      { id: 'SH-102', type: 'Shuttle Bus', driver: 'Rajesh K.', route: 'Academic Express', status: 'In Transit', battery: '76%' },
      { id: 'SH-103', type: 'Shuttle Bus', driver: 'Harpreet V.', route: 'Hostels Link', status: 'At Stop', battery: '92%' },
      { id: 'GC-01', type: 'Golf Cart', driver: 'Gurpreet Singh', route: 'Medical Priority', status: 'Dispatched', battery: '82%' },
      { id: 'GC-02', type: 'Golf Cart', driver: 'Maninder P.', route: 'Faculty Transit', status: 'Available', battery: '95%' },
      { id: 'ER-01', type: 'E-Rickshaw', driver: 'Daljit S.', route: 'Main Stand Hop', status: 'Available', battery: '64%' },
      { id: 'ER-02', type: 'E-Rickshaw', driver: 'Amritpal G.', route: 'Main Stand Hop', status: 'In Transit', battery: '58%' },
    ]);
  }, []);

  const handleBroadcast = (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastMessage.trim()) return;
    setBroadcastSent(true);
    setTimeout(() => {
      setBroadcastSent(false);
      setBroadcastMessage('');
    }, 3000);
  };

  return (
    <div className="min-h-screen bg-white dark:bg-black text-black dark:text-white flex flex-col font-sans transition-colors duration-200">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white dark:bg-black border-b border-[#E2E2E2] dark:border-[#333333]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
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
                Dispatch Admin
              </h1>
              <p className="text-xs text-[#5E5E5E] dark:text-[#A6A6A6]">
                Fleet Control &middot; Lovely Professional University
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
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

      {/* Main Content */}
      <main className="max-w-4xl mx-auto w-full px-4 sm:px-6 py-6 flex-1 space-y-6">
        {/* KPI Summary Tiles */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-[#F3F3F3] dark:bg-[#1C1C1C] rounded-[12px] p-4 border border-[#E2E2E2] dark:border-[#333333]">
            <div className="text-xs font-semibold text-[#5E5E5E] dark:text-[#A6A6A6]">Active Shuttles</div>
            <div className="text-2xl font-extrabold text-black dark:text-white mt-1">3</div>
            <div className="text-[11px] text-[#05A357] font-medium mt-0.5">100% on route</div>
          </div>
          <div className="bg-[#F3F3F3] dark:bg-[#1C1C1C] rounded-[12px] p-4 border border-[#E2E2E2] dark:border-[#333333]">
            <div className="text-xs font-semibold text-[#5E5E5E] dark:text-[#A6A6A6]">Available Carts</div>
            <div className="text-2xl font-extrabold text-black dark:text-white mt-1">2</div>
            <div className="text-[11px] text-[#276EF1] font-medium mt-0.5">Ready for priority</div>
          </div>
          <div className="bg-[#F3F3F3] dark:bg-[#1C1C1C] rounded-[12px] p-4 border border-[#E2E2E2] dark:border-[#333333]">
            <div className="text-xs font-semibold text-[#5E5E5E] dark:text-[#A6A6A6]">E-Rickshaws</div>
            <div className="text-2xl font-extrabold text-black dark:text-white mt-1">2</div>
            <div className="text-[11px] text-[#5E5E5E] dark:text-[#A6A6A6] font-medium mt-0.5">Flat ₹10 rate</div>
          </div>
          <div className="bg-[#F3F3F3] dark:bg-[#1C1C1C] rounded-[12px] p-4 border border-[#E2E2E2] dark:border-[#333333]">
            <div className="text-xs font-semibold text-[#5E5E5E] dark:text-[#A6A6A6]">Daily Ridership</div>
            <div className="text-2xl font-extrabold text-black dark:text-white mt-1">1,842</div>
            <div className="text-[11px] text-[#05A357] font-medium mt-0.5">+14% vs yesterday</div>
          </div>
        </div>

        {/* Live Fleet Table */}
        <section className="bg-[#F3F3F3] dark:bg-[#1C1C1C] rounded-[12px] border border-[#E2E2E2] dark:border-[#333333] overflow-hidden">
          <div className="p-4 border-b border-[#E2E2E2] dark:border-[#333333] flex items-center justify-between">
            <h3 className="font-bold text-base text-black dark:text-white">
              Fleet Vehicle Status
            </h3>
            <span className="text-xs text-[#5E5E5E] dark:text-[#A6A6A6]">{fleetStatus.length} units registered</span>
          </div>

          <div className="divide-y divide-[#E2E2E2] dark:divide-[#333333] overflow-x-auto">
            {fleetStatus.map((v) => (
              <div key={v.id} className="p-4 flex items-center justify-between text-sm hover:bg-[#EAEAEA] dark:hover:bg-[#2A2A2A] transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-[#E2E2E2] dark:bg-[#333333] flex items-center justify-center font-bold text-xs text-black dark:text-white">
                    {v.type === 'Shuttle Bus' ? <Bus className="w-4 h-4 stroke-[2]" /> : <Car className="w-4 h-4 stroke-[2]" />}
                  </div>
                  <div>
                    <div className="font-bold text-black dark:text-white">
                      {v.id} &middot; {v.driver}
                    </div>
                    <div className="text-xs text-[#5E5E5E] dark:text-[#A6A6A6]">
                      {v.type} &middot; {v.route}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-right">
                  <div className="hidden sm:block text-xs font-medium text-[#5E5E5E] dark:text-[#A6A6A6]">
                    Battery: {v.battery}
                  </div>
                  <span
                    className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                      v.status === 'Available'
                        ? 'bg-[#05A357]/15 text-[#05A357]'
                        : v.status === 'Dispatched'
                        ? 'bg-[#FFC043]/15 text-[#FFC043]'
                        : 'bg-[#276EF1]/15 text-[#276EF1]'
                    }`}
                  >
                    {v.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Broadcast Campus Service Notice */}
        <section className="bg-[#F3F3F3] dark:bg-[#1C1C1C] rounded-[12px] p-5 border border-[#E2E2E2] dark:border-[#333333] space-y-4">
          <div className="flex items-center gap-2 font-bold text-base text-black dark:text-white">
            <AlertTriangle className="w-5 h-5 text-[#FFC043]" />
            <span>Broadcast Transport Alert</span>
          </div>
          <p className="text-xs text-[#5E5E5E] dark:text-[#A6A6A6]">
            Sends a real-time banner notice to all student and driver apps regarding route disruptions or road maintenance.
          </p>

          <form onSubmit={handleBroadcast} className="space-y-3">
            <input
              type="text"
              value={broadcastMessage}
              onChange={(e) => setBroadcastMessage(e.target.value)}
              placeholder="e.g. Block 32 ring road closed for convocation from 14:00"
              className="w-full h-12 px-4 rounded-[8px] bg-white dark:bg-black border border-[#E2E2E2] dark:border-[#333333] text-sm focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
            />
            <button type="submit" className="uber-btn-primary w-full text-base font-bold">
              Dispatch Campus Alert
            </button>
            {broadcastSent && (
              <div className="text-xs text-[#05A357] font-semibold flex items-center gap-1.5 pt-1">
                <CheckCircle2 className="w-4 h-4" />
                <span>Alert broadcast successfully across all active screens.</span>
              </div>
            )}
          </form>
        </section>
      </main>
    </div>
  );
}
