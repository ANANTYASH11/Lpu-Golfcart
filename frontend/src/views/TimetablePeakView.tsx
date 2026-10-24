import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import {
  ArrowLeft,
  Clock,
  Calendar,
  AlertCircle,
  FileSpreadsheet,
  Download,
  Upload,
  CheckCircle2,
  MapPin,
  RefreshCw,
  Sun,
  Moon,
  ChevronRight,
  Sparkles,
} from 'lucide-react';

interface TimetablePeakViewProps {
  onBack: () => void;
  onBookRide?: () => void;
}

export default function TimetablePeakView({ onBack, onBookRide }: TimetablePeakViewProps) {
  const { mode, toggleTheme } = useTheme();
  const { currentUser } = useAuth();

  const [scheduleType, setScheduleType] = useState<'REGULAR' | 'EXAM_DAY' | 'HOLIDAY'>('REGULAR');
  const [timetableData, setTimetableData] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Next 5 departures per stop state
  const [stops, setStops] = useState<any[]>([]);
  const [selectedStopId, setSelectedStopId] = useState<number>(1);
  const [nextDepartures, setNextDepartures] = useState<any[]>([]);
  const [loadingDepartures, setLoadingDepartures] = useState<boolean>(false);

  // CSV Import Modal (Admin)
  const [importModalOpen, setImportModalOpen] = useState<boolean>(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [importing, setImporting] = useState<boolean>(false);

  const isAdmin = currentUser?.role === 'ADMIN';

  // 1. Fetch campus stops
  useEffect(() => {
    api.getStops().then((data) => {
      setStops(data || []);
    });
  }, []);

  // 2. Fetch timetable based on scheduleType
  const loadTimetable = (type: string) => {
    setLoading(true);
    api.getTimetable(type)
      .then((res) => {
        setTimetableData(res);
      })
      .catch((e) => console.error('Failed to load timetable:', e))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadTimetable(scheduleType);
  }, [scheduleType]);

  // 3. Fetch next departures when selectedStopId changes
  const loadNextDepartures = (stopId: number) => {
    setLoadingDepartures(true);
    api.getNextDepartures(stopId)
      .then((res) => {
        setNextDepartures(res?.departures || []);
      })
      .catch((e) => console.error('Failed to load next departures:', e))
      .finally(() => setLoadingDepartures(false));
  };

  useEffect(() => {
    if (selectedStopId) {
      loadNextDepartures(selectedStopId);
    }
  }, [selectedStopId]);

  // 4. Handle CSV Import
  const handleCsvImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!csvFile) return;

    setImporting(true);
    setImportStatus(null);
    try {
      const formData = new FormData();
      formData.append('file', csvFile);
      const res = await api.importTimetableCsv(formData);
      setImportStatus(`Success: ${res.message || 'Timetable imported successfully.'}`);
      loadTimetable(scheduleType);
      setTimeout(() => {
        setImportModalOpen(false);
        setImportStatus(null);
        setCsvFile(null);
      }, 2000);
    } catch (err: any) {
      setImportStatus(`Error: ${err.message || 'CSV Import failed'}`);
    } finally {
      setImporting(false);
    }
  };

  const selectedStop = stops.find((s) => s.id === selectedStopId);

  return (
    <div className="min-h-screen bg-white dark:bg-black text-black dark:text-white font-sans transition-colors duration-150 flex flex-col">
      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-white/90 dark:bg-black/90 backdrop-blur-md border-b border-[#E2E2E2] dark:border-[#333333] px-4 sm:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="w-10 h-10 rounded-full bg-[#F3F3F3] dark:bg-[#1C1C1C] flex items-center justify-center hover:bg-[#EAEAEA] dark:hover:bg-[#2A2A2A] transition-colors"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-extrabold text-lg sm:text-xl tracking-tight">Timetable & Peak Hours</h1>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-500">
                Official Campus Schedules
              </span>
            </div>
            <p className="text-xs text-[#5E5E5E] dark:text-[#A6A6A6] -mt-0.5 hidden sm:block">
              Daily university departures, class-change surges, and exam schedules
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* CSV Export Button */}
          <a
            href={api.exportTimetableCsvUrl()}
            download="unicart_timetable.csv"
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#E2E2E2] dark:border-[#333333] text-xs font-semibold hover:bg-[#F3F3F3] dark:hover:bg-[#2A2A2A] transition-colors"
            title="Download CSV"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </a>

          {/* Admin CSV Import Button */}
          {isAdmin && (
            <button
              onClick={() => setImportModalOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-black text-white dark:bg-white dark:text-black text-xs font-semibold flex items-center gap-1.5 hover:opacity-90 transition-opacity"
            >
              <Upload className="w-4 h-4" />
              <span>Import CSV</span>
            </button>
          )}

          <button
            onClick={toggleTheme}
            className="w-10 h-10 rounded-full bg-[#F3F3F3] dark:bg-[#1C1C1C] flex items-center justify-center hover:bg-[#EAEAEA] dark:hover:bg-[#2A2A2A] transition-colors"
          >
            {mode === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-8 py-6 space-y-6">
        {/* Class-Change Peak Hours Callout Card */}
        <div className="p-5 rounded-2xl bg-[#F3F3F3] dark:bg-[#1C1C1C] border border-[#E2E2E2] dark:border-[#333333] space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-amber-500/20 text-amber-500 flex items-center justify-center">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm sm:text-base">Class-Change Peak Hours</h3>
                <p className="text-xs text-[#5E5E5E] dark:text-[#A6A6A6]">
                  High passenger volumes; shuttles run at maximum 5-minute frequency
                </p>
              </div>
            </div>

            {/* Live Peak Indicator Badge */}
            <div
              className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 ${
                timetableData?.is_currently_peak
                  ? 'bg-amber-500 text-black animate-pulse'
                  : 'bg-black/5 dark:bg-white/10 text-[#5E5E5E] dark:text-[#A6A6A6]'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${timetableData?.is_currently_peak ? 'bg-black' : 'bg-slate-400'}`} />
              <span>{timetableData?.is_currently_peak ? 'Peak Rush Active' : 'Off-Peak Normal'}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
            {[
              { title: 'Morning Lecture Rush', time: '08:30 – 09:30', desc: 'Main Gate & Hostels to Academic Blocks' },
              { title: 'Midday Lunch Transition', time: '12:30 – 13:30', desc: 'Blocks 32/38 to Uni-Mall & Food Courts' },
              { title: 'Evening Departure', time: '16:30 – 17:30', desc: 'Academic Blocks to Hostels & Main Gate' },
            ].map((peak, idx) => (
              <div
                key={idx}
                className="p-3 rounded-xl bg-white dark:bg-[#252525] border border-[#E2E2E2] dark:border-[#333333] space-y-1"
              >
                <span className="font-bold text-xs text-black dark:text-white block">{peak.title}</span>
                <span className="font-mono font-bold text-sm text-blue-600 dark:text-blue-400 block">{peak.time}</span>
                <span className="text-[11px] text-[#5E5E5E] dark:text-[#A6A6A6] block leading-tight">{peak.desc}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Schedule Type Selector Pill Bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 p-1 bg-[#F3F3F3] dark:bg-[#1C1C1C] rounded-full border border-[#E2E2E2] dark:border-[#333333]">
            {[
              { id: 'REGULAR', label: 'Regular Weekday' },
              { id: 'EXAM_DAY', label: 'Exam Day Schedules' },
              { id: 'HOLIDAY', label: 'Holiday & Weekend' },
            ].map((t) => {
              const isSel = scheduleType === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setScheduleType(t.id as any)}
                  className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
                    isSel
                      ? 'bg-black text-white dark:bg-white dark:text-black shadow-sm'
                      : 'text-[#5E5E5E] dark:text-[#A6A6A6] hover:text-black dark:hover:text-white'
                  }`}
                >
                  {t.label}
                </button>
              );
            })}
          </div>

          <div className="text-xs text-[#5E5E5E] dark:text-[#A6A6A6]">
            Last updated: <strong>{timetableData?.last_updated_at || 'Today'}</strong>
          </div>
        </div>

        {/* Interactive "Next 5 Departures" Section */}
        <div className="p-5 rounded-2xl bg-white dark:bg-[#1C1C1C] border border-[#E2E2E2] dark:border-[#333333] space-y-4 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-extrabold text-base">Next 5 Departures by Stop</h3>
              <p className="text-xs text-[#5E5E5E] dark:text-[#A6A6A6]">
                Select a campus stop to see immediately upcoming departures
              </p>
            </div>

            {/* Stop dropdown */}
            <select
              value={selectedStopId}
              onChange={(e) => setSelectedStopId(Number(e.target.value))}
              className="text-xs font-semibold p-2.5 rounded-xl bg-[#F3F3F3] dark:bg-[#2A2A2A] border border-[#E2E2E2] dark:border-[#333333] text-black dark:text-white outline-none"
            >
              {stops.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.code})
                </option>
              ))}
            </select>
          </div>

          {/* Next 5 departures table */}
          {loadingDepartures ? (
            <div className="p-6 text-center text-xs text-[#5E5E5E] animate-pulse">Calculating departures...</div>
          ) : nextDepartures.length === 0 ? (
            <div className="p-4 text-center text-xs text-[#5E5E5E]">No departures found for this stop.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#E2E2E2] dark:border-[#333333] text-[11px] font-bold text-[#5E5E5E] dark:text-[#A6A6A6] uppercase tracking-wider">
                    <th className="pb-2.5">Route</th>
                    <th className="pb-2.5">Scheduled Time</th>
                    <th className="pb-2.5">Estimated Countdown</th>
                    <th className="pb-2.5">Frequency</th>
                    <th className="pb-2.5">Operating Type</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E2E2] dark:divide-[#333333]">
                  {nextDepartures.map((dep, idx) => (
                    <tr key={idx} className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                      <td className="py-2.5 font-bold flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: dep.route_color || '#2563EB' }}
                        />
                        <span>{dep.route_name}</span>
                        <span className="font-mono text-[10px] text-[#5E5E5E]">({dep.route_code})</span>
                      </td>
                      <td className="py-2.5 font-mono font-bold">{dep.departure_time}</td>
                      <td className="py-2.5 font-bold">
                        <span className="px-2 py-0.5 rounded-full bg-[#05A357]/15 text-[#05A357]">
                          In {dep.mins_until_departure} min
                        </span>
                      </td>
                      <td className="py-2.5 text-[#5E5E5E] dark:text-[#A6A6A6]">Every {dep.frequency_mins} mins</td>
                      <td className="py-2.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800">
                          {dep.schedule_type}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Full Route Schedules Grid */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-extrabold text-base">Full Daily Route Schedules</h3>
            <span className="text-xs text-[#5E5E5E] dark:text-[#A6A6A6]">
              {timetableData?.active_routes?.length || 0} active routes configured
            </span>
          </div>

          {loading ? (
            <div className="p-10 text-center text-sm font-semibold text-[#5E5E5E] animate-pulse">
              Loading timetables from database...
            </div>
          ) : (
            <div className="grid gap-4">
              {timetableData?.active_routes?.map((route: any) => (
                <div
                  key={route.route_id}
                  className="p-5 rounded-2xl bg-white dark:bg-[#1C1C1C] border border-[#E2E2E2] dark:border-[#333333] space-y-3 shadow-sm"
                >
                  <div className="flex items-center justify-between pb-2 border-b border-[#E2E2E2] dark:border-[#333333]">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: route.color_hex || '#2563EB' }}
                      />
                      <h4 className="font-extrabold text-base">{route.route_name}</h4>
                      <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-black/5 dark:bg-white/10">
                        {route.route_code}
                      </span>
                    </div>
                    <span className="text-xs text-[#5E5E5E] dark:text-[#A6A6A6]">
                      {route.schedules.length} departures
                    </span>
                  </div>

                  {/* Departure time badges */}
                  <div className="flex flex-wrap gap-2 pt-1">
                    {route.schedules.map((s: any) => (
                      <div
                        key={s.id}
                        className="px-3 py-1.5 rounded-xl bg-[#F3F3F3] dark:bg-[#2A2A2A] border border-[#E2E2E2] dark:border-[#333333] flex items-center gap-2 text-xs"
                      >
                        <Clock className="w-3.5 h-3.5 text-[#5E5E5E]" />
                        <span className="font-mono font-bold">{s.departure_time}</span>
                        <span className="text-[10px] text-[#5E5E5E] dark:text-[#A6A6A6]">({s.day_of_week})</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Admin CSV Import Modal */}
      {importModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="w-full max-w-md bg-white dark:bg-[#1C1C1C] rounded-2xl p-6 border border-[#E2E2E2] dark:border-[#333333] space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#E2E2E2] dark:border-[#333333]">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-blue-500" />
                <h3 className="font-extrabold text-base">Import Timetable CSV</h3>
              </div>
              <button onClick={() => setImportModalOpen(false)} className="text-sm">
                ✕
              </button>
            </div>

            <p className="text-xs text-[#5E5E5E] dark:text-[#A6A6A6]">
              Upload a CSV file containing route schedules with columns:
              <br />
              <code className="text-[10px] font-mono text-black dark:text-white">
                route_id, route_code, departure_time, day_of_week, schedule_type, frequency_mins
              </code>
            </p>

            <form onSubmit={handleCsvImport} className="space-y-4">
              <input
                type="file"
                accept=".csv"
                onChange={(e) => setCsvFile(e.target.files ? e.target.files[0] : null)}
                className="w-full text-xs p-3 rounded-xl bg-[#F3F3F3] dark:bg-[#2A2A2A] border border-[#E2E2E2] dark:border-[#333333]"
              />

              {importStatus && (
                <div
                  className={`p-3 rounded-xl text-xs font-semibold ${
                    importStatus.startsWith('Success')
                      ? 'bg-[#05A357]/15 text-[#05A357]'
                      : 'bg-red-500/15 text-red-500'
                  }`}
                >
                  {importStatus}
                </div>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setImportModalOpen(false)}
                  className="uber-btn-secondary flex-1 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!csvFile || importing}
                  className="uber-btn-primary flex-1 text-xs disabled:opacity-50"
                >
                  {importing ? 'Importing...' : 'Upload & Update'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
