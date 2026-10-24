import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import {
  ArrowLeft,
  ShieldCheck,
  FileText,
  Upload,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileCheck,
  HeartPulse,
  Accessibility,
  UserCheck,
  Bandage,
  ChevronRight,
  Download,
  X,
  Sparkles,
  Sun,
  Moon,
  RefreshCw
} from 'lucide-react';

interface PriorityAccessViewProps {
  onBack: () => void;
  onBookRide?: () => void;
}

const CATEGORIES = [
  {
    id: 'MEDICAL',
    label: 'Medical Need',
    icon: HeartPulse,
    desc: 'Post-surgery recovery, asthma, cardiac, or ongoing medical treatment.'
  },
  {
    id: 'DIFFERENTLY_ABLED',
    label: 'Differently-Abled',
    icon: Accessibility,
    desc: 'Permanent or long-term locomotor or mobility challenges.'
  },
  {
    id: 'TEMPORARY_INJURY',
    label: 'Temporary Injury',
    icon: Bandage,
    desc: 'Fractures, sprains, crutches, or plaster casts requiring mobility aid.'
  },
  {
    id: 'ELDERLY_VISITOR',
    label: 'Senior Citizen / Visitor',
    icon: UserCheck,
    desc: 'Elderly parents, grandparents, or visiting university dignitaries.'
  }
];

export default function PriorityAccessView({ onBack, onBookRide }: PriorityAccessViewProps) {
  const { mode, toggleTheme } = useTheme();
  const { currentUser } = useAuth();

  const [existingStatus, setExistingStatus] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [fullName, setFullName] = useState<string>('');
  const [regNumber, setRegNumber] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('MEDICAL');
  const [reasonDescription, setReasonDescription] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  const fetchStatus = async () => {
    try {
      setLoading(true);
      const res = await api.getPriorityStatus();
      setExistingStatus(res);
      if (res && res.full_name && !fullName) {
        setFullName(res.full_name);
      }
    } catch (e) {
      console.warn('Priority status fetch:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileError(null);
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];

    const validTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
    if (!validTypes.includes(file.type)) {
      setFileError('Invalid file format. Only PDF, PNG, and JPEG documents are permitted.');
      setSelectedFile(null);
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setFileError(`File too large (${(file.size / (1024 * 1024)).toFixed(1)} MB). Maximum allowed size is 5 MB.`);
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !reasonDescription.trim() || !selectedFile) {
      setFileError('Please fill in all required fields and attach a medical document.');
      return;
    }

    setSubmitting(true);
    setFileError(null);
    try {
      const formData = new FormData();
      formData.append('full_name', fullName);
      formData.append('reg_number', regNumber);
      formData.append('category', selectedCategory);
      formData.append('reason_description', reasonDescription);
      formData.append('document', selectedFile);

      const res = await api.applyPriority(formData);
      setExistingStatus(res);
      setSelectedFile(null);
      setReasonDescription('');
      setSuccessBanner('Application submitted successfully! Our campus health team will review it within 24 hours.');
      setTimeout(() => setSuccessBanner(null), 5000);
    } catch (err: any) {
      setFileError(err.message || 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-[#000000] text-black dark:text-white font-sans transition-colors duration-200">
      {/* ---------------- TOP HEADER ---------------- */}
      <header className="sticky top-0 z-40 bg-white/90 dark:bg-black/90 backdrop-blur-md border-b border-[#E2E2E2] dark:border-[#222222] px-4 sm:px-8 py-3.5 flex items-center justify-between">
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
              <h1 className="text-lg sm:text-xl font-extrabold tracking-tight">Priority Access Pass</h1>
              {existingStatus?.status === 'APPROVED' ? (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#05A357]/15 text-[#05A357] border border-[#05A357]/30 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  Pass Active
                </span>
              ) : existingStatus?.status === 'PENDING' ? (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Review Pending
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-black/5 dark:bg-white/10 text-[#5E5E5E] dark:text-[#A6A6A6]">
                  Standard Rider
                </span>
              )}
            </div>
            <p className="text-xs text-[#5E5E5E] dark:text-[#A6A6A6]">
              Dedicated accessibility &amp; medical mobility fast-track
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchStatus}
            className="w-9 h-9 rounded-full bg-[#F3F3F3] dark:bg-[#1C1C1C] flex items-center justify-center hover:bg-[#EAEAEA] dark:hover:bg-[#2A2A2A] transition-colors"
            title="Refresh status"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={toggleTheme}
            className="w-9 h-9 rounded-full bg-[#F3F3F3] dark:bg-[#1C1C1C] flex items-center justify-center hover:bg-[#EAEAEA] dark:hover:bg-[#2A2A2A] transition-colors"
            aria-label="Toggle Theme"
          >
            {mode === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Success Notification Banner */}
      <AnimatePresence>
        {successBanner && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-[#05A357] text-white px-4 py-2.5 text-center text-xs font-bold flex items-center justify-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{successBanner}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-4xl mx-auto p-4 sm:p-8 space-y-6">
        {/* ---------------- STATUS CARD (IF EXISTS) ---------------- */}
        {existingStatus && (
          <div className={`p-6 rounded-3xl border shadow-sm ${
            existingStatus.status === 'APPROVED'
              ? 'bg-[#05A357]/10 border-[#05A357]/30 text-black dark:text-white'
              : existingStatus.status === 'PENDING'
              ? 'bg-amber-500/10 border-amber-500/30 text-black dark:text-white'
              : 'bg-rose-500/10 border-rose-500/30 text-black dark:text-white'
          }`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                  existingStatus.status === 'APPROVED'
                    ? 'bg-[#05A357] text-white'
                    : existingStatus.status === 'PENDING'
                    ? 'bg-amber-500 text-white'
                    : 'bg-rose-500 text-white'
                }`}>
                  {existingStatus.status === 'APPROVED' ? (
                    <CheckCircle2 className="w-5 h-5" />
                  ) : existingStatus.status === 'PENDING' ? (
                    <Clock className="w-5 h-5" />
                  ) : (
                    <AlertCircle className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-base">
                      {existingStatus.status === 'APPROVED'
                        ? 'Priority Fast-Track Unlocked'
                        : existingStatus.status === 'PENDING'
                        ? 'Application Under Review'
                        : 'Application Rejected'}
                    </span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-black/10 dark:bg-white/10">
                      {existingStatus.category}
                    </span>
                  </div>
                  <p className="text-xs text-[#5E5E5E] dark:text-[#A6A6A6] mt-1">
                    Applied on {existingStatus.applied_at} &bull; Document: <strong>{existingStatus.document_filename}</strong>
                  </p>
                  {existingStatus.admin_notes && (
                    <div className="mt-2 p-2.5 rounded-xl bg-white/70 dark:bg-black/60 border border-black/10 dark:border-white/10 text-xs">
                      <strong>Committee Notes:</strong> {existingStatus.admin_notes}
                    </div>
                  )}
                  {existingStatus.expires_at && (
                    <p className="text-[11px] font-bold text-[#05A357] mt-1.5">
                      Valid through: {existingStatus.expires_at}
                    </p>
                  )}
                </div>
              </div>

              {existingStatus.status === 'APPROVED' && onBookRide && (
                <button
                  onClick={onBookRide}
                  className="uber-btn-primary px-6 py-3 shadow-md flex items-center justify-center gap-2 text-xs font-bold"
                >
                  <span>Book Priority Cart (₹0)</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* ---------------- PERKS / PRIVILEGES HERO BANNER ---------------- */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-5 rounded-2xl bg-[#F3F3F3] dark:bg-[#111111] border border-[#E2E2E2] dark:border-[#222222]">
            <div className="w-8 h-8 rounded-xl bg-[#05A357]/15 text-[#05A357] flex items-center justify-center mb-3">
              <Sparkles className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-extrabold mb-1">100% Fare Waiver</h3>
            <p className="text-xs text-[#5E5E5E] dark:text-[#A6A6A6]">
              Zero-fare rides on all point-to-point electric golf carts across campus.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-[#F3F3F3] dark:bg-[#111111] border border-[#E2E2E2] dark:border-[#222222]">
            <div className="w-8 h-8 rounded-xl bg-blue-500/15 text-blue-500 flex items-center justify-center mb-3">
              <Clock className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-extrabold mb-1">Dispatch Preemption</h3>
            <p className="text-xs text-[#5E5E5E] dark:text-[#A6A6A6]">
              Your ride requests bypass standard queues and are assigned the nearest active cart.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-[#F3F3F3] dark:bg-[#111111] border border-[#E2E2E2] dark:border-[#222222]">
            <div className="w-8 h-8 rounded-xl bg-purple-500/15 text-purple-500 flex items-center justify-center mb-3">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-extrabold mb-1">Health Centre Assistance</h3>
            <p className="text-xs text-[#5E5E5E] dark:text-[#A6A6A6]">
              Direct boarding at Uni-Hospital OPD, Block 32 ramps, and hostel disability gates.
            </p>
          </div>
        </div>

        {/* ---------------- APPLICATION FORM ---------------- */}
        <div className="bg-white dark:bg-[#111111] rounded-3xl border border-[#E2E2E2] dark:border-[#222222] p-6 sm:p-8 shadow-sm">
          <div className="mb-6">
            <h2 className="text-lg font-extrabold tracking-tight">
              {existingStatus?.status === 'APPROVED'
                ? 'Update or Renew Priority Pass'
                : 'Submit Priority Access Application'}
            </h2>
            <p className="text-xs text-[#5E5E5E] dark:text-[#A6A6A6]">
              Supporting medical documents are encrypted and reviewed strictly by university medical staff.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Applicant Name & Reg Number */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-[#5E5E5E] dark:text-[#A6A6A6] block mb-1.5">
                  Full Legal Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Rohit Verma"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl text-xs font-semibold bg-[#F3F3F3] dark:bg-[#1C1C1C] border border-[#E2E2E2] dark:border-[#333333] focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#5E5E5E] dark:text-[#A6A6A6] block mb-1.5">
                  Registration Number / Visitor ID
                </label>
                <input
                  type="text"
                  placeholder="e.g. 12009845 or VISITOR-2026"
                  value={regNumber}
                  onChange={(e) => setRegNumber(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl text-xs font-semibold bg-[#F3F3F3] dark:bg-[#1C1C1C] border border-[#E2E2E2] dark:border-[#333333] focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                />
              </div>
            </div>

            {/* Category Cards */}
            <div>
              <label className="text-xs font-bold text-[#5E5E5E] dark:text-[#A6A6A6] block mb-2">
                Eligibility Category *
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {CATEGORIES.map((cat) => {
                  const Icon = cat.icon;
                  const isSelected = selectedCategory === cat.id;
                  return (
                    <button
                      type="button"
                      key={cat.id}
                      onClick={() => setSelectedCategory(cat.id)}
                      className={`p-4 rounded-2xl border text-left transition-all ${
                        isSelected
                          ? 'border-black dark:border-white bg-[#F3F3F3] dark:bg-[#1C1C1C] shadow-sm'
                          : 'border-[#E2E2E2] dark:border-[#2A2A2A] hover:border-black/30'
                      }`}
                    >
                      <div className="flex items-center gap-3 mb-1.5">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                          isSelected ? 'bg-black text-white dark:bg-white dark:text-black' : 'bg-black/5 dark:bg-white/10'
                        }`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <span className="text-xs font-extrabold">{cat.label}</span>
                      </div>
                      <p className="text-[11px] text-[#5E5E5E] dark:text-[#A6A6A6]">{cat.desc}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Reason Description */}
            <div>
              <label className="text-xs font-bold text-[#5E5E5E] dark:text-[#A6A6A6] block mb-1.5">
                Brief Mobility Need &amp; Clinical Details *
              </label>
              <textarea
                required
                rows={3}
                placeholder="Describe your current medical condition, mobility requirements, or doctor's advisement..."
                value={reasonDescription}
                onChange={(e) => setReasonDescription(e.target.value)}
                className="w-full px-4 py-3 rounded-xl text-xs font-medium bg-[#F3F3F3] dark:bg-[#1C1C1C] border border-[#E2E2E2] dark:border-[#333333] focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white resize-none"
              />
            </div>

            {/* Document Upload Box */}
            <div>
              <label className="text-xs font-bold text-[#5E5E5E] dark:text-[#A6A6A6] block mb-1.5">
                Upload Supporting Medical / Disability Certificate (Max 5 MB) *
              </label>
              <div className="border-2 border-dashed border-[#E2E2E2] dark:border-[#333333] hover:border-black dark:hover:border-white rounded-2xl p-6 text-center transition-colors relative cursor-pointer">
                <input
                  type="file"
                  accept=".pdf,image/png,image/jpeg,image/jpg"
                  onChange={handleFileChange}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
                {selectedFile ? (
                  <div className="flex items-center justify-center gap-3">
                    <FileCheck className="w-8 h-8 text-[#05A357]" />
                    <div className="text-left">
                      <div className="text-xs font-bold">{selectedFile.name}</div>
                      <div className="text-[11px] text-[#5E5E5E] dark:text-[#A6A6A6]">
                        {(selectedFile.size / 1024).toFixed(0)} KB &bull; Ready for upload
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedFile(null);
                      }}
                      className="ml-3 p-1 rounded-full hover:bg-black/10 dark:hover:bg-white/10"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div>
                    <Upload className="w-8 h-8 mx-auto mb-2 text-[#5E5E5E] dark:text-[#A6A6A6]" />
                    <div className="text-xs font-bold">
                      Click or drag medical certificate here
                    </div>
                    <p className="text-[11px] text-[#5E5E5E] dark:text-[#A6A6A6] mt-1">
                      Supported formats: PDF, PNG, JPG (Size up to 5 MB)
                    </p>
                  </div>
                )}
              </div>
              {fileError && (
                <div className="mt-2 text-xs font-semibold text-rose-500 flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4" />
                  <span>{fileError}</span>
                </div>
              )}
            </div>

            {/* Submit Action */}
            <button
              type="submit"
              disabled={submitting}
              className="uber-btn-primary w-full py-4 shadow-lg flex items-center justify-center gap-2 text-xs font-extrabold"
            >
              {submitting ? (
                <span>Submitting &amp; Encrypting Document...</span>
              ) : (
                <>
                  <span>Submit Priority Application</span>
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
