import React, { useState } from 'react';
import { useTheme } from '../theme/ThemeContext';
import {
  Car,
  MapPin,
  Bus,
  Compass,
  CreditCard,
  Clock,
  Bell,
  CalendarDays,
  ShieldCheck,
  HelpCircle,
  ArrowLeft,
  ChevronRight,
  Sun,
  Moon,
  User,
  Home,
  Grid,
  Activity as ActivityIcon,
  Phone,
  CheckCircle2,
  AlertTriangle,
  Info,
  X,
  ExternalLink,
  Shield,
  Zap,
} from 'lucide-react';

interface UberFeaturesViewProps {
  onBackToHome: () => void;
  onBookRide: () => void;
  onOpenLiveMap?: () => void;
  onNavigateTo?: (path: string) => void;
}

type ActiveModal =
  | null
  | 'arrivals'
  | 'planner'
  | 'fares'
  | 'bookings'
  | 'alerts'
  | 'timetable'
  | 'priority'
  | 'help'
  | 'account'
  | 'activity';

export default function UberFeaturesView({
  onBackToHome,
  onBookRide,
  onOpenLiveMap,
  onNavigateTo,
}: UberFeaturesViewProps) {
  const { mode, tokens, toggleTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<'home' | 'services' | 'activity' | 'account'>('services');
  const [activeModal, setActiveModal] = useState<ActiveModal>(null);

  // Tiles definition
  const tiles = [
    {
      id: 'book',
      label: 'Book a Ride',
      icon: Car,
      onClick: onBookRide,
    },
    {
      id: 'map',
      label: 'Live Map',
      icon: MapPin,
      onClick: onOpenLiveMap || onBookRide,
    },
    {
      id: 'arrivals',
      label: 'Shuttle Arrivals',
      icon: Bus,
      onClick: () => setActiveModal('arrivals'),
    },
    {
      id: 'planner',
      label: 'Journey Planner',
      icon: Compass,
      onClick: () => setActiveModal('planner'),
    },
    {
      id: 'fares',
      label: 'Fares',
      icon: CreditCard,
      onClick: () => setActiveModal('fares'),
    },
    {
      id: 'bookings',
      label: 'My Bookings',
      icon: Clock,
      onClick: () => setActiveModal('bookings'),
    },
    {
      id: 'alerts',
      label: 'Alerts',
      icon: Bell,
      onClick: () => setActiveModal('alerts'),
    },
    {
      id: 'timetable',
      label: 'Timetable',
      icon: CalendarDays,
      onClick: () => setActiveModal('timetable'),
    },
    {
      id: 'priority',
      label: 'Priority Access',
      icon: ShieldCheck,
      onClick: () => setActiveModal('priority'),
    },
    {
      id: 'help',
      label: 'Help',
      icon: HelpCircle,
      onClick: () => setActiveModal('help'),
    },
  ];

  return (
    <div className="min-h-screen bg-white dark:bg-black text-black dark:text-white flex flex-col font-sans transition-colors duration-200 pb-20 md:pb-8">
      {/* 1. Header */}
      <header className="sticky top-0 z-30 bg-white dark:bg-black border-b border-[#E2E2E2] dark:border-[#333333]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onBackToHome}
              aria-label="Back to home"
              className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-[#F3F3F3] dark:hover:bg-[#1C1C1C] text-black dark:text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-xl font-bold tracking-tight text-black dark:text-white">
              Services
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              aria-label="Toggle theme mode"
              className="w-10 h-10 rounded-full flex items-center justify-center bg-[#F3F3F3] dark:bg-[#1C1C1C] hover:bg-[#EAEAEA] dark:hover:bg-[#2A2A2A] text-black dark:text-white transition-colors"
            >
              {mode === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>

            <button
              onClick={() => setActiveModal('account')}
              aria-label="Account details"
              className="w-10 h-10 rounded-full bg-[#000000] dark:bg-[#FFFFFF] text-white dark:text-black flex items-center justify-center font-bold text-sm tracking-tight"
            >
              <User className="w-5 h-5 text-white dark:text-black" />
            </button>
          </div>
        </div>
      </header>

      {/* 2. Main Content Container */}
      <main className="max-w-4xl mx-auto w-full px-4 sm:px-6 py-6 flex-1 space-y-8">
        {/* Services Heading */}
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-black dark:text-white mb-1">
            Campus mobility
          </h2>
          <p className="text-sm text-[#5E5E5E] dark:text-[#A6A6A6]">
            Select a service to navigate Lovely Professional University.
          </p>
        </div>

        {/* 3. Grid of Rounded Grey Tiles */}
        <section aria-label="Services Grid">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {tiles.map((tile) => {
              const IconComp = tile.icon;
              return (
                <button
                  key={tile.id}
                  onClick={tile.onClick}
                  className="bg-[#F3F3F3] dark:bg-[#1C1C1C] hover:bg-[#EAEAEA] dark:hover:bg-[#2A2A2A] rounded-[12px] p-4 flex flex-col items-center justify-center text-center gap-2.5 transition-colors border border-transparent focus:outline-none focus:ring-2 focus:ring-[#000000] dark:focus:ring-[#FFFFFF] aspect-square"
                >
                  <div className="w-11 h-11 rounded-full flex items-center justify-center text-black dark:text-white">
                    <IconComp className="w-6 h-6 stroke-[2]" />
                  </div>
                  <span className="text-[13px] sm:text-[14px] font-semibold text-black dark:text-white leading-tight">
                    {tile.label}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* 4. Live Departures Section */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold tracking-tight text-black dark:text-white">
              Live Shuttle Departures
            </h3>
            <span className="text-xs font-semibold uppercase tracking-wider text-[#05A357] flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#05A357] animate-pulse" />
              Real-time
            </span>
          </div>

          <div className="divide-y divide-[#E2E2E2] dark:divide-[#333333] border-y border-[#E2E2E2] dark:border-[#333333]">
            {/* Row 1 */}
            <div
              onClick={() => setActiveModal('arrivals')}
              className="py-4 flex items-center justify-between cursor-pointer hover:bg-[#F3F3F3] dark:hover:bg-[#1C1C1C] -mx-2 px-2 rounded-lg transition-colors"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-full bg-[#F3F3F3] dark:bg-[#1C1C1C] flex items-center justify-center text-black dark:text-white">
                  <Bus className="w-5 h-5 stroke-[2]" />
                </div>
                <div>
                  <div className="font-semibold text-base text-black dark:text-white">
                    Main Gate to Uni-Mall
                  </div>
                  <div className="text-xs text-[#5E5E5E] dark:text-[#A6A6A6]">
                    Shuttle Bus #102 &middot; Circular North Route
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold text-[#05A357]">4 min</div>
                <div className="text-xs text-[#5E5E5E] dark:text-[#A6A6A6]">Low crowd</div>
              </div>
            </div>

            {/* Row 2 */}
            <div
              onClick={() => setActiveModal('arrivals')}
              className="py-4 flex items-center justify-between cursor-pointer hover:bg-[#F3F3F3] dark:hover:bg-[#1C1C1C] -mx-2 px-2 rounded-lg transition-colors"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-full bg-[#F3F3F3] dark:bg-[#1C1C1C] flex items-center justify-center text-black dark:text-white">
                  <Bus className="w-5 h-5 stroke-[2]" />
                </div>
                <div>
                  <div className="font-semibold text-base text-black dark:text-white">
                    Central Library to Block 32
                  </div>
                  <div className="text-xs text-[#5E5E5E] dark:text-[#A6A6A6]">
                    Shuttle Bus #105 &middot; Academic Express
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold text-black dark:text-white">9 min</div>
                <div className="text-xs text-[#5E5E5E] dark:text-[#A6A6A6]">Moderate</div>
              </div>
            </div>

            {/* Row 3 */}
            <div
              onClick={() => setActiveModal('arrivals')}
              className="py-4 flex items-center justify-between cursor-pointer hover:bg-[#F3F3F3] dark:hover:bg-[#1C1C1C] -mx-2 px-2 rounded-lg transition-colors"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-full bg-[#F3F3F3] dark:bg-[#1C1C1C] flex items-center justify-center text-black dark:text-white">
                  <Bus className="w-5 h-5 stroke-[2]" />
                </div>
                <div>
                  <div className="font-semibold text-base text-black dark:text-white">
                    Boys Hostel Complex to Central Library
                  </div>
                  <div className="text-xs text-[#5E5E5E] dark:text-[#A6A6A6]">
                    Shuttle Bus #101 &middot; Hostels Connector
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold text-black dark:text-white">14 min</div>
                <div className="text-xs text-[#5E5E5E] dark:text-[#A6A6A6]">Seats available</div>
              </div>
            </div>
          </div>
        </section>

        {/* 5. Campus Fleet Information Section */}
        <section className="space-y-3">
          <h3 className="text-lg font-bold tracking-tight text-black dark:text-white">
            Campus Fleet
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Card 1 */}
            <div className="bg-[#F3F3F3] dark:bg-[#1C1C1C] rounded-[12px] p-4 border border-[#E2E2E2] dark:border-[#333333] space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm text-black dark:text-white">
                  Golf Cart Priority Service
                </span>
                <span className="text-[11px] font-bold uppercase px-2 py-0.5 rounded bg-black dark:bg-white text-white dark:text-black">
                  Free
                </span>
              </div>
              <p className="text-xs text-[#5E5E5E] dark:text-[#A6A6A6]">
                Priority electric carts reserved for students with injuries, mobility needs, faculty, and urgent cross-campus transit.
              </p>
              <div className="pt-2 text-xs font-semibold text-[#276EF1]">
                2 carts currently standing by &rarr;
              </div>
            </div>

            {/* Card 2 */}
            <div className="bg-[#F3F3F3] dark:bg-[#1C1C1C] rounded-[12px] p-4 border border-[#E2E2E2] dark:border-[#333333] space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm text-black dark:text-white">
                  Electric Rickshaw Express
                </span>
                <span className="text-[11px] font-bold uppercase px-2 py-0.5 rounded bg-[#E2E2E2] dark:bg-[#333333] text-black dark:text-white">
                  &#8377;10 Flat
                </span>
              </div>
              <p className="text-xs text-[#5E5E5E] dark:text-[#A6A6A6]">
                Fixed-rate campus hop between Main Gate, Boys Hostels, and Girls Hostels. Maximum 4 riders per cart.
              </p>
              <div className="pt-2 text-xs font-semibold text-[#276EF1]">
                Available at main stand &rarr;
              </div>
            </div>
          </div>
        </section>

        {/* 6. Driver and Admin Access Section */}
        <section className="space-y-3 pt-2">
          <h3 className="text-lg font-bold tracking-tight text-black dark:text-white">
            Staff & Administration
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              onClick={() => onNavigateTo && onNavigateTo('/driver')}
              className="uber-btn-secondary w-full justify-between px-5 text-left"
            >
              <div className="flex items-center gap-3">
                <Car className="w-5 h-5 stroke-[2]" />
                <span>Driver Console</span>
              </div>
              <ChevronRight className="w-5 h-5 text-[#5E5E5E] dark:text-[#A6A6A6]" />
            </button>

            <button
              onClick={() => onNavigateTo && onNavigateTo('/admin')}
              className="uber-btn-secondary w-full justify-between px-5 text-left"
            >
              <div className="flex items-center gap-3">
                <Shield className="w-5 h-5 stroke-[2]" />
                <span>Fleet Dispatch Admin</span>
              </div>
              <ChevronRight className="w-5 h-5 text-[#5E5E5E] dark:text-[#A6A6A6]" />
            </button>
          </div>
        </section>
      </main>

      {/* 7. Mobile Bottom Tab Bar (Home, Services, Activity, Account) */}
      <nav
        aria-label="Mobile Navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-black border-t border-[#E2E2E2] dark:border-[#333333] h-16 flex items-center justify-around px-2"
      >
        <button
          onClick={onBackToHome}
          className="flex flex-col items-center justify-center flex-1 py-1 text-[#5E5E5E] dark:text-[#A6A6A6] hover:text-black dark:hover:text-white"
        >
          <Home className="w-5 h-5 stroke-[2]" />
          <span className="text-[11px] font-medium mt-1">Home</span>
        </button>

        <button
          onClick={() => setActiveTab('services')}
          className="flex flex-col items-center justify-center flex-1 py-1 text-black dark:text-white font-bold"
        >
          <Grid className="w-5 h-5 stroke-[2]" />
          <span className="text-[11px] font-bold mt-1">Services</span>
        </button>

        <button
          onClick={() => setActiveModal('activity')}
          className="flex flex-col items-center justify-center flex-1 py-1 text-[#5E5E5E] dark:text-[#A6A6A6] hover:text-black dark:hover:text-white"
        >
          <ActivityIcon className="w-5 h-5 stroke-[2]" />
          <span className="text-[11px] font-medium mt-1">Activity</span>
        </button>

        <button
          onClick={() => setActiveModal('account')}
          className="flex flex-col items-center justify-center flex-1 py-1 text-[#5E5E5E] dark:text-[#A6A6A6] hover:text-black dark:hover:text-white"
        >
          <User className="w-5 h-5 stroke-[2]" />
          <span className="text-[11px] font-medium mt-1">Account</span>
        </button>
      </nav>

      {/* 8. Interactive Modals for Inner Features */}
      {activeModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4"
        >
          <div className="bg-white dark:bg-[#1C1C1C] text-black dark:text-white w-full sm:max-w-lg rounded-t-[20px] sm:rounded-[12px] border border-[#E2E2E2] dark:border-[#333333] max-h-[85vh] flex flex-col overflow-hidden uber-sheet-shadow">
            {/* Modal Header with Back Arrow */}
            <div className="px-5 py-4 border-b border-[#E2E2E2] dark:border-[#333333] flex items-center justify-between">
              <button
                onClick={() => setActiveModal(null)}
                aria-label="Back to Services"
                className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-[#F3F3F3] dark:hover:bg-[#2A2A2A] transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>

              <h2 className="text-base font-bold tracking-tight capitalize">
                {activeModal === 'arrivals' && 'Shuttle Arrivals'}
                {activeModal === 'planner' && 'Campus Journey Planner'}
                {activeModal === 'fares' && 'Transparent Campus Fares'}
                {activeModal === 'bookings' && 'My Campus Bookings'}
                {activeModal === 'alerts' && 'Transport Alerts'}
                {activeModal === 'timetable' && 'Campus Timetable'}
                {activeModal === 'priority' && 'Priority Transit Pass'}
                {activeModal === 'help' && 'Campus Transport Help'}
                {activeModal === 'account' && 'Account & Roles'}
                {activeModal === 'activity' && 'Recent Trips'}
              </h2>

              <button
                onClick={() => setActiveModal(null)}
                aria-label="Close"
                className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-[#F3F3F3] dark:hover:bg-[#2A2A2A] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-4 text-sm leading-relaxed">
              {/* Arrivals */}
              {activeModal === 'arrivals' && (
                <div className="space-y-3">
                  <p className="text-xs text-[#5E5E5E] dark:text-[#A6A6A6]">
                    Upcoming departures tracked across all major Lovely Professional University stops.
                  </p>
                  <div className="divide-y divide-[#E2E2E2] dark:divide-[#333333]">
                    {[
                      { stop: 'Main Gate Central Stand', bus: 'Shuttle #102', eta: '4 min', status: 'On schedule' },
                      { stop: 'Uni-Mall Student Centre', bus: 'Shuttle #104', eta: '7 min', status: 'On schedule' },
                      { stop: 'Central University Library', bus: 'Shuttle #105', eta: '9 min', status: 'On schedule' },
                      { stop: 'Block 32 Academic Complex', bus: 'Shuttle #108', eta: '12 min', status: 'On schedule' },
                      { stop: 'Girls Hostel Complex', bus: 'Shuttle #103', eta: '15 min', status: 'On schedule' },
                      { stop: 'Boys Hostel Boulevard', bus: 'Shuttle #101', eta: '18 min', status: 'On schedule' },
                    ].map((item, i) => (
                      <div key={i} className="py-3 flex items-center justify-between">
                        <div>
                          <div className="font-semibold text-black dark:text-white">{item.stop}</div>
                          <div className="text-xs text-[#5E5E5E] dark:text-[#A6A6A6]">{item.bus}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-[#05A357]">{item.eta}</div>
                          <div className="text-[11px] text-[#5E5E5E] dark:text-[#A6A6A6]">{item.status}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Fares */}
              {activeModal === 'fares' && (
                <div className="space-y-4">
                  <div className="bg-[#F3F3F3] dark:bg-[#2A2A2A] p-4 rounded-[12px] space-y-1">
                    <div className="flex items-center justify-between font-bold">
                      <span>Campus Shuttle Bus</span>
                      <span className="text-[#05A357]">FREE</span>
                    </div>
                    <p className="text-xs text-[#5E5E5E] dark:text-[#A6A6A6]">
                      Complimentary campus transit funded by Lovely Professional University student welfare services.
                    </p>
                  </div>

                  <div className="bg-[#F3F3F3] dark:bg-[#2A2A2A] p-4 rounded-[12px] space-y-1">
                    <div className="flex items-center justify-between font-bold">
                      <span>Electric Golf Cart</span>
                      <span className="text-[#05A357]">FREE</span>
                    </div>
                    <p className="text-xs text-[#5E5E5E] dark:text-[#A6A6A6]">
                      Prioritized for medical need, mobility assistance, elderly visitors, and campus staff.
                    </p>
                  </div>

                  <div className="bg-[#F3F3F3] dark:bg-[#2A2A2A] p-4 rounded-[12px] space-y-1">
                    <div className="flex items-center justify-between font-bold">
                      <span>Electric Rickshaw Hop</span>
                      <span>&#8377;10 Fixed</span>
                    </div>
                    <p className="text-xs text-[#5E5E5E] dark:text-[#A6A6A6]">
                      Fixed flat fare for point-to-point transit anywhere on campus. Pay via UPI or cash to driver.
                    </p>
                  </div>
                </div>
              )}

              {/* Timetable */}
              {activeModal === 'timetable' && (
                <div className="space-y-3">
                  <p className="text-xs text-[#5E5E5E] dark:text-[#A6A6A6]">
                    Standard schedule during academic term. Headway averages 6-8 minutes during peak hours.
                  </p>
                  <div className="space-y-2">
                    <div className="p-3 bg-[#F3F3F3] dark:bg-[#2A2A2A] rounded-lg flex justify-between">
                      <span className="font-semibold">Morning Rush (07:30 - 10:00)</span>
                      <span className="text-[#5E5E5E] dark:text-[#A6A6A6]">Every 5 mins</span>
                    </div>
                    <div className="p-3 bg-[#F3F3F3] dark:bg-[#2A2A2A] rounded-lg flex justify-between">
                      <span className="font-semibold">Regular Hours (10:00 - 17:00)</span>
                      <span className="text-[#5E5E5E] dark:text-[#A6A6A6]">Every 8 mins</span>
                    </div>
                    <div className="p-3 bg-[#F3F3F3] dark:bg-[#2A2A2A] rounded-lg flex justify-between">
                      <span className="font-semibold">Evening Rush (17:00 - 20:30)</span>
                      <span className="text-[#5E5E5E] dark:text-[#A6A6A6]">Every 6 mins</span>
                    </div>
                    <div className="p-3 bg-[#F3F3F3] dark:bg-[#2A2A2A] rounded-lg flex justify-between">
                      <span className="font-semibold">Night Service (20:30 - 22:30)</span>
                      <span className="text-[#5E5E5E] dark:text-[#A6A6A6]">Every 15 mins</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Priority Access */}
              {activeModal === 'priority' && (
                <div className="space-y-4">
                  <div className="p-4 bg-[#F3F3F3] dark:bg-[#2A2A2A] rounded-[12px] flex items-start gap-3">
                    <ShieldCheck className="w-6 h-6 text-[#05A357] shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-bold text-sm">Medical &amp; Faculty Priority</h4>
                      <p className="text-xs text-[#5E5E5E] dark:text-[#A6A6A6] mt-1">
                        Students with medical passes or temporary injuries receive first-priority dispatch on electric golf carts.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setActiveModal(null);
                      onBookRide();
                    }}
                    className="uber-btn-primary w-full"
                  >
                    Request Priority Ride
                  </button>
                </div>
              )}

              {/* Help */}
              {activeModal === 'help' && (
                <div className="space-y-4">
                  <div className="p-4 bg-[#F3F3F3] dark:bg-[#2A2A2A] rounded-[12px] space-y-2">
                    <div className="font-bold">Campus Security &amp; Transport Control</div>
                    <div className="text-xs text-[#5E5E5E] dark:text-[#A6A6A6]">
                      Helpline: +91 1824 404404 &middot; Ext. 4444 (Emergency)
                    </div>
                    <div className="text-xs text-[#5E5E5E] dark:text-[#A6A6A6]">
                      Email: transport@lpu.co.in &middot; Uni-Mall Help Desk #2
                    </div>
                  </div>
                  <div className="p-4 bg-[#F3F3F3] dark:bg-[#2A2A2A] rounded-[12px] space-y-1">
                    <div className="font-bold">Lost &amp; Found</div>
                    <div className="text-xs text-[#5E5E5E] dark:text-[#A6A6A6]">
                      Items left on campus shuttles are handed over to Main Gate Security Station within 2 hours.
                    </div>
                  </div>
                </div>
              )}

              {/* My Bookings / Activity */}
              {(activeModal === 'bookings' || activeModal === 'activity') && (
                <div className="space-y-3">
                  <div className="p-4 bg-[#F3F3F3] dark:bg-[#2A2A2A] rounded-[12px] space-y-2">
                    <div className="flex items-center justify-between text-xs font-semibold text-[#05A357]">
                      <span>Completed Trip</span>
                      <span>Today, 14:15</span>
                    </div>
                    <div className="font-bold text-base">Main Gate &rarr; Block 32</div>
                    <div className="text-xs text-[#5E5E5E] dark:text-[#A6A6A6]">
                      Golf Cart GC-04 &middot; Driver Gurpreet Singh
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setActiveModal(null);
                      onBookRide();
                    }}
                    className="uber-btn-primary w-full"
                  >
                    Book new ride
                  </button>
                </div>
              )}

              {/* Alerts */}
              {activeModal === 'alerts' && (
                <div className="space-y-3">
                  <div className="p-4 bg-[#F3F3F3] dark:bg-[#2A2A2A] rounded-[12px] space-y-1 border-l-4 border-[#05A357]">
                    <div className="font-bold text-sm">All Campus Routes Normal</div>
                    <div className="text-xs text-[#5E5E5E] dark:text-[#A6A6A6]">
                      Weather clear. 6 shuttles operating on 6-minute headway across main campus.
                    </div>
                  </div>
                  <div className="p-4 bg-[#F3F3F3] dark:bg-[#2A2A2A] rounded-[12px] space-y-1 border-l-4 border-[#FFC043]">
                    <div className="font-bold text-sm">Pedestrian Zone Notice</div>
                    <div className="text-xs text-[#5E5E5E] dark:text-[#A6A6A6]">
                      Central Mall Avenue restricted to pedestrian traffic from 12:00 to 14:00 today.
                    </div>
                  </div>
                </div>
              )}

              {/* Planner */}
              {activeModal === 'planner' && (
                <div className="space-y-3">
                  <p className="text-xs text-[#5E5E5E] dark:text-[#A6A6A6]">
                    Plan fastest connection between campus academic blocks and hostels.
                  </p>
                  <button
                    onClick={() => {
                      setActiveModal(null);
                      onBookRide();
                    }}
                    className="uber-btn-primary w-full"
                  >
                    Open Campus Map Navigator
                  </button>
                </div>
              )}

              {/* Account */}
              {activeModal === 'account' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-4 bg-[#F3F3F3] dark:bg-[#2A2A2A] rounded-[12px]">
                    <div className="w-12 h-12 rounded-full bg-black dark:bg-white text-white dark:text-black flex items-center justify-center font-bold text-lg">
                      CR
                    </div>
                    <div>
                      <div className="font-bold text-base">Campus Student Profile</div>
                      <div className="text-xs text-[#5E5E5E] dark:text-[#A6A6A6]">Reg ID: 12204981 &middot; LPU Student</div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <button
                      onClick={() => {
                        setActiveModal(null);
                        if (onNavigateTo) onNavigateTo('/driver');
                      }}
                      className="uber-btn-secondary w-full justify-between px-4"
                    >
                      <span>Driver Mode</span>
                      <ChevronRight className="w-4 h-4 text-[#5E5E5E] dark:text-[#A6A6A6]" />
                    </button>
                    <button
                      onClick={() => {
                        setActiveModal(null);
                        if (onNavigateTo) onNavigateTo('/admin');
                      }}
                      className="uber-btn-secondary w-full justify-between px-4"
                    >
                      <span>Fleet Administrator</span>
                      <ChevronRight className="w-4 h-4 text-[#5E5E5E] dark:text-[#A6A6A6]" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Bottom Confirm Button */}
            <div className="p-4 border-t border-[#E2E2E2] dark:border-[#333333]">
              <button
                onClick={() => setActiveModal(null)}
                className="uber-btn-secondary w-full"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
