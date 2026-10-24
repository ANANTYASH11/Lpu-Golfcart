import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './theme/ThemeContext';
import UberHomeView from './views/UberHomeView';
import UberBookingView from './views/UberBookingView';
import UberFeaturesView from './views/UberFeaturesView';
import UberDriverView from './views/UberDriverView';
import UberAdminView from './views/UberAdminView';
import LiveShuttlesView from './views/LiveShuttlesView';
import TimetablePeakView from './views/TimetablePeakView';
import CampusMapView from './views/CampusMapView';
import WalletView from './views/WalletView';
import PriorityAccessView from './views/PriorityAccessView';
import { CampusSafetySosView } from './views/CampusSafetySosView';
import { FareCalculatorView } from './views/FareCalculatorView';
import BusPreviewView from './views/BusPreviewView';
import RickshawPreviewView from './views/RickshawPreviewView';
import MapFleetView from './views/MapFleetView';
import NotificationToast from './components/NotificationToast';

function AppContent() {
  const [activeView, setActiveView] = useState(() => {
    if (typeof window !== 'undefined') {
      const p = window.location.pathname;
      if (p === '/book' || p === '/booking') return 'book';
      if (p === '/shuttles' || p === '/arrivals') return 'shuttles';
      if (p === '/timetable' || p === '/schedule') return 'timetable';
      if (p === '/fare-calc' || p === '/fares' || p === '/calculator') return 'fare_calc';
      if (p === '/map') return 'map';
      if (p === '/wallet') return 'wallet';
      if (p === '/priority') return 'priority';
      if (p === '/safety' || p === '/sos') return 'safety';
      if (p === '/app' || p === '/features' || p === '/services') return 'features';
      if (p === '/driver') return 'driver';
      if (p === '/admin') return 'admin';
      if (p === '/bus-preview') return 'bus_preview';
      if (p === '/rickshaw-preview') return 'rickshaw_preview';
      if (p === '/map-fleet') return 'map_fleet';
    }
    return 'home';
  });

  useEffect(() => {
    const handlePopState = () => {
      const p = window.location.pathname;
      if (p === '/book' || p === '/booking') {
        setActiveView('book');
      } else if (p === '/shuttles' || p === '/arrivals') {
        setActiveView('shuttles');
      } else if (p === '/timetable' || p === '/schedule') {
        setActiveView('timetable');
      } else if (p === '/fare-calc' || p === '/fares' || p === '/calculator') {
        setActiveView('fare_calc');
      } else if (p === '/map') {
        setActiveView('map');
      } else if (p === '/wallet') {
        setActiveView('wallet');
      } else if (p === '/priority') {
        setActiveView('priority');
      } else if (p === '/safety' || p === '/sos') {
        setActiveView('safety');
      } else if (p === '/app' || p === '/features' || p === '/services') {
        setActiveView('features');
      } else if (p === '/driver') {
        setActiveView('driver');
      } else if (p === '/admin') {
        setActiveView('admin');
      } else if (p === '/bus-preview') {
        setActiveView('bus_preview');
      } else if (p === '/rickshaw-preview') {
        setActiveView('rickshaw_preview');
      } else if (p === '/map-fleet') {
        setActiveView('map_fleet');
      } else {
        setActiveView('home');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleViewChange = (view) => {
    setActiveView(view);
    let targetPath = '/';
    if (view === 'book') targetPath = '/book';
    else if (view === 'shuttles') targetPath = '/shuttles';
    else if (view === 'timetable') targetPath = '/timetable';
    else if (view === 'fare_calc') targetPath = '/fare-calc';
    else if (view === 'map') targetPath = '/map';
    else if (view === 'wallet') targetPath = '/wallet';
    else if (view === 'priority') targetPath = '/priority';
    else if (view === 'safety') targetPath = '/safety';
    else if (view === 'features') targetPath = '/app';
    else if (view === 'driver') targetPath = '/driver';
    else if (view === 'admin') targetPath = '/admin';
    else if (view === 'bus_preview') targetPath = '/bus-preview';
    else if (view === 'rickshaw_preview') targetPath = '/rickshaw-preview';
    else if (view === 'map_fleet') targetPath = '/map-fleet';

    if (window.location.pathname !== targetPath) {
      window.history.pushState({}, '', targetPath);
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-black text-black dark:text-white font-sans transition-colors duration-200">
      {activeView === 'home' && (
        <UberHomeView
          onBookRide={() => handleViewChange('book')}
          onExploreFeatures={() => handleViewChange('features')}
          onOpenProfile={() => handleViewChange('features')}
          onNavigate={(view) => handleViewChange(view)}
        />
      )}

      {activeView === 'book' && (
        <UberBookingView onBack={() => handleViewChange('home')} />
      )}

      {activeView === 'shuttles' && (
        <LiveShuttlesView
          onBack={() => handleViewChange('home')}
          onOpenMap={() => handleViewChange('map')}
        />
      )}

      {activeView === 'timetable' && (
        <TimetablePeakView
          onBack={() => handleViewChange('home')}
          onBookRide={() => handleViewChange('book')}
        />
      )}

      {activeView === 'fare_calc' && (
        <FareCalculatorView
          onBack={() => handleViewChange('home')}
          onBookRide={() => handleViewChange('book')}
        />
      )}


      {activeView === 'map' && (
        <CampusMapView
          onBack={() => handleViewChange('home')}
          onBookRide={() => handleViewChange('book')}
        />
      )}

      {activeView === 'wallet' && (
        <WalletView
          onBack={() => handleViewChange('home')}
          onBookRide={() => handleViewChange('book')}
        />
      )}

      {activeView === 'priority' && (
        <PriorityAccessView
          onBack={() => handleViewChange('home')}
          onBookRide={() => handleViewChange('book')}
        />
      )}

      {activeView === 'safety' && (
        <CampusSafetySosView
          onBack={() => handleViewChange('home')}
        />
      )}


      {activeView === 'features' && (
        <UberFeaturesView
          onBackToHome={() => handleViewChange('home')}
          onBookRide={() => handleViewChange('book')}
          onOpenLiveMap={() => handleViewChange('book')}
          onNavigateTo={(path) => {
            if (path === '/driver') handleViewChange('driver');
            else if (path === '/admin') handleViewChange('admin');
            else if (path === '/shuttles') handleViewChange('shuttles');
            else if (path === '/timetable') handleViewChange('timetable');
            else if (path === '/fare-calc' || path === '/fares') handleViewChange('fare_calc');
            else if (path === '/map') handleViewChange('map');
            else if (path === '/wallet') handleViewChange('wallet');
            else if (path === '/priority') handleViewChange('priority');
            else if (path === '/safety' || path === '/sos') handleViewChange('safety');
            else handleViewChange('home');
          }}
        />
      )}

      {activeView === 'driver' && (
        <UberDriverView onBack={() => handleViewChange('features')} />
      )}

      {activeView === 'admin' && (
        <UberAdminView onBack={() => handleViewChange('features')} />
      )}

      {/* Legacy 3D previews if visited directly */}
      {activeView === 'bus_preview' && <BusPreviewView />}
      {activeView === 'rickshaw_preview' && <RickshawPreviewView />}
      {activeView === 'map_fleet' && <MapFleetView />}

      {/* Global Realtime Notification Toasts */}
      <NotificationToast />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
}
