import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import {
  ArrowLeft,
  Wallet,
  CreditCard,
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  Clock,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  FileText,
  Download,
  X,
  Sparkles,
  RefreshCw,
  Sun,
  Moon
} from 'lucide-react';

interface WalletViewProps {
  onBack: () => void;
  onBookRide?: () => void;
}

export default function WalletView({ onBack, onBookRide }: WalletViewProps) {
  const { mode, toggleTheme } = useTheme();
  const { currentUser } = useAuth();

  const [balanceInr, setBalanceInr] = useState<number>(250.0);
  const [ledgerEntries, setLedgerEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [topupAmount, setTopupAmount] = useState<number>(100);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [topupModalOpen, setTopupModalOpen] = useState<boolean>(false);
  const [processingTopup, setProcessingTopup] = useState<boolean>(false);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);
  const [receiptModal, setReceiptModal] = useState<any | null>(null);

  const fetchWallet = async () => {
    try {
      setLoading(true);
      const [balRes, ledRes] = await Promise.allSettled([
        api.getWalletBalance(),
        api.getWalletLedger()
      ]);

      if (balRes.status === 'fulfilled' && balRes.value) {
        setBalanceInr(balRes.value.balance_inr || 0);
      }
      if (ledRes.status === 'fulfilled' && ledRes.value) {
        setLedgerEntries(ledRes.value.entries || []);
      }
    } catch (e) {
      console.error('Wallet fetch error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWallet();
  }, []);

  const handleTopup = async () => {
    const amount = customAmount ? parseFloat(customAmount) : topupAmount;
    if (isNaN(amount) || amount <= 0) return;

    setProcessingTopup(true);
    try {
      const res = await api.topupWallet(amount);
      setBalanceInr(res.balance_inr);
      setTopupModalOpen(false);
      setCustomAmount('');
      setSuccessBanner(`Successfully added ₹${amount.toFixed(2)} to Campus Wallet (Test Mode)`);
      setTimeout(() => setSuccessBanner(null), 4000);
      fetchWallet();
    } catch (e: any) {
      alert(`Top-up failed: ${e.message}`);
    } finally {
      setProcessingTopup(false);
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
              <h1 className="text-lg sm:text-xl font-extrabold tracking-tight">Campus Wallet</h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#E11D48]/15 text-[#E11D48] border border-[#E11D48]/30">
                TEST PAYMENTS
              </span>
            </div>
            <p className="text-xs text-[#5E5E5E] dark:text-[#A6A6A6]">
              Instant contactless transit fare payments &amp; ledger
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchWallet}
            className="w-9 h-9 rounded-full bg-[#F3F3F3] dark:bg-[#1C1C1C] flex items-center justify-center hover:bg-[#EAEAEA] dark:hover:bg-[#2A2A2A] transition-colors"
            title="Refresh balance"
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
        {/* ---------------- BALANCE HERO CARD ---------------- */}
        <div className="bg-gradient-to-br from-black to-neutral-900 text-white rounded-3xl p-6 sm:p-8 border border-white/10 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 relative z-10">
            <div>
              <div className="flex items-center gap-2 text-xs font-medium text-neutral-400 mb-2">
                <Wallet className="w-4 h-4 text-[#05A357]" />
                <span>Available Student Balance</span>
              </div>
              <div className="text-4xl sm:text-5xl font-black tracking-tight mb-2">
                ₹{balanceInr.toFixed(2)}
              </div>
              <p className="text-xs text-neutral-400">
                Linked to {currentUser?.username || 'Student Account'} &bull; Lovely Professional University
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => setTopupModalOpen(true)}
                className="px-6 py-3.5 rounded-full bg-white text-black font-extrabold text-sm hover:bg-neutral-200 transition-all shadow-lg flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>Top-up Wallet</span>
              </button>
              {onBookRide && (
                <button
                  onClick={onBookRide}
                  className="px-6 py-3.5 rounded-full bg-neutral-800 text-white font-bold text-sm hover:bg-neutral-700 transition-all border border-neutral-700 flex items-center justify-center gap-2"
                >
                  <span>Book Ride Now</span>
                </button>
              )}
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-white/10 flex flex-wrap items-center justify-between gap-4 text-xs text-neutral-400">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#05A357]" />
              <span>Double-spend atomic ledger verified</span>
            </div>
            <div>
              <span>Gateway: <strong>Razorpay Test Sandbox</strong></span>
            </div>
          </div>
        </div>

        {/* ---------------- QUICK STATS / INFORMATION ---------------- */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-2xl bg-[#F3F3F3] dark:bg-[#111111] border border-[#E2E2E2] dark:border-[#222222]">
            <div className="text-xs font-semibold text-[#5E5E5E] dark:text-[#A6A6A6] mb-1">Campus Shuttle Fare</div>
            <div className="text-lg font-extrabold text-[#05A357]">₹0 Free</div>
            <p className="text-[11px] text-[#5E5E5E] dark:text-[#A6A6A6]">Free for all LPU students &amp; staff</p>
          </div>
          <div className="p-4 rounded-2xl bg-[#F3F3F3] dark:bg-[#111111] border border-[#E2E2E2] dark:border-[#222222]">
            <div className="text-xs font-semibold text-[#5E5E5E] dark:text-[#A6A6A6] mb-1">Smart E-Rickshaw</div>
            <div className="text-lg font-extrabold">₹15 Flat</div>
            <p className="text-[11px] text-[#5E5E5E] dark:text-[#A6A6A6]">Zone-based fixed student tariff</p>
          </div>
          <div className="p-4 rounded-2xl bg-[#F3F3F3] dark:bg-[#111111] border border-[#E2E2E2] dark:border-[#222222]">
            <div className="text-xs font-semibold text-[#5E5E5E] dark:text-[#A6A6A6] mb-1">Electric Golf Cart</div>
            <div className="text-lg font-extrabold">₹10 + ₹5/km</div>
            <p className="text-[11px] text-[#5E5E5E] dark:text-[#A6A6A6]">100% discount on Priority Access pass</p>
          </div>
        </div>

        {/* ---------------- LEDGER / TRANSACTION HISTORY ---------------- */}
        <div className="bg-white dark:bg-[#111111] rounded-3xl border border-[#E2E2E2] dark:border-[#222222] p-5 sm:p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-extrabold tracking-tight">Wallet Ledger &amp; Ride Transactions</h2>
              <p className="text-xs text-[#5E5E5E] dark:text-[#A6A6A6]">Complete auditable history of credits and debits</p>
            </div>
            <span className="text-xs font-mono text-[#5E5E5E] dark:text-[#A6A6A6]">
              {ledgerEntries.length} Transactions
            </span>
          </div>

          {ledgerEntries.length > 0 ? (
            <div className="divide-y divide-[#E2E2E2] dark:divide-[#222222]">
              {ledgerEntries.map((entry) => (
                <div key={entry.id} className="py-3.5 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                      entry.entry_type === 'CREDIT'
                        ? 'bg-[#05A357]/15 text-[#05A357]'
                        : 'bg-black/5 dark:bg-white/10 text-black dark:text-white'
                    }`}>
                      {entry.entry_type === 'CREDIT' ? (
                        <ArrowDownLeft className="w-4 h-4" />
                      ) : (
                        <ArrowUpRight className="w-4 h-4" />
                      )}
                    </div>
                    <div>
                      <div className="text-xs font-bold">{entry.description}</div>
                      <div className="text-[11px] text-[#5E5E5E] dark:text-[#A6A6A6] flex items-center gap-1.5 mt-0.5">
                        <Clock className="w-3 h-3" />
                        <span>{entry.created_at}</span>
                        <span>&bull;</span>
                        <span className="font-mono">{entry.reference_type}</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className={`text-sm font-extrabold ${
                      entry.entry_type === 'CREDIT' ? 'text-[#05A357]' : 'text-black dark:text-white'
                    }`}>
                      {entry.entry_type === 'CREDIT' ? '+' : '-'}₹{entry.amount_inr.toFixed(2)}
                    </div>
                    <div className="text-[10px] text-[#5E5E5E] dark:text-[#A6A6A6]">
                      Bal: ₹{entry.balance_after_inr.toFixed(2)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-[#5E5E5E] dark:text-[#A6A6A6]">
              <Wallet className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-xs font-semibold">No transactions recorded yet</p>
              <p className="text-[11px] mt-1">Add funds or book a ride to see transactions here</p>
            </div>
          )}
        </div>
      </div>

      {/* ---------------- TOPUP MODAL ---------------- */}
      <AnimatePresence>
        {topupModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md bg-white dark:bg-[#161616] border border-[#E2E2E2] dark:border-[#333333] rounded-3xl p-6 shadow-2xl text-black dark:text-white"
            >
              <div className="flex items-center justify-between pb-4 border-b border-[#E2E2E2] dark:border-[#333333] mb-5">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-[#05A357]" />
                  <h3 className="font-extrabold text-base tracking-tight">Top-up Campus Wallet</h3>
                </div>
                <button
                  onClick={() => setTopupModalOpen(false)}
                  className="w-8 h-8 rounded-full bg-[#F3F3F3] dark:bg-[#2A2A2A] flex items-center justify-center text-[#5E5E5E] dark:text-[#A6A6A6] hover:text-black dark:hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Amount Pills */}
              <div className="grid grid-cols-4 gap-2 mb-4">
                {[50, 100, 200, 500].map((amt) => (
                  <button
                    key={amt}
                    onClick={() => {
                      setTopupAmount(amt);
                      setCustomAmount('');
                    }}
                    className={`py-2 rounded-xl text-xs font-extrabold border transition-all ${
                      topupAmount === amt && !customAmount
                        ? 'bg-black text-white dark:bg-white dark:text-black border-transparent'
                        : 'bg-[#F3F3F3] dark:bg-[#222222] border-transparent hover:border-black/20'
                    }`}
                  >
                    +₹{amt}
                  </button>
                ))}
              </div>

              {/* Custom Input */}
              <div className="mb-6">
                <label className="text-xs font-semibold text-[#5E5E5E] dark:text-[#A6A6A6] block mb-1.5">
                  Or enter custom amount (INR)
                </label>
                <div className="relative flex items-center">
                  <span className="absolute left-3.5 text-sm font-bold text-[#5E5E5E] dark:text-[#A6A6A6]">₹</span>
                  <input
                    type="number"
                    min="10"
                    max="5000"
                    placeholder="e.g. 250"
                    value={customAmount}
                    onChange={(e) => setCustomAmount(e.target.value)}
                    className="w-full pl-8 pr-4 py-2.5 rounded-xl text-sm font-bold bg-[#F3F3F3] dark:bg-[#222222] border border-[#E2E2E2] dark:border-[#333333] focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                  />
                </div>
              </div>

              {/* Test Badge Notice */}
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-600 dark:text-amber-400 mb-5 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  <strong>Sandbox Test Mode Active:</strong> Payment verification uses Razorpay HMAC-SHA256 test credentials without charging real bank cards.
                </span>
              </div>

              {/* Confirm Button */}
              <button
                onClick={handleTopup}
                disabled={processingTopup}
                className="uber-btn-primary w-full py-3.5 shadow-lg flex items-center justify-center gap-2"
              >
                {processingTopup ? (
                  <span>Processing Razorpay Verification...</span>
                ) : (
                  <span>Pay ₹{customAmount || topupAmount} via Razorpay (Test)</span>
                )}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
