import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './theme/ThemeContext';
import UberHomeView from './views/UberHomeView';
import UberBookingView from './views/UberBookingView';
import UberFeaturesView from './views/UberFeaturesView';
import UberDriverView from './views/UberDriverView';
import UberAdminView from './views/UberAdminView';
import BusPreviewView from './views/BusPreviewView';
import RickshawPreviewView from './views/RickshawPreviewView';
import MapFleetView from './views/MapFleetView';
import NotificationToast from './components/NotificationToast';

function AppContent() {
  const [activeView, setActiveView] = useState(() => {
    if (typeof window !== 'undefined') {
      const p = window.location.pathname;
      if (p === '/book' || p === '/booking') return 'book';
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
        />
      )}

      {activeView === 'book' && (
        <UberBookingView onBack={() => handleViewChange('home')} />
      )}

      {activeView === 'features' && (
        <UberFeaturesView
          onBackToHome={() => handleViewChange('home')}
          onBookRide={() => handleViewChange('book')}
          onOpenLiveMap={() => handleViewChange('book')}
          onNavigateTo={(path) => {
            if (path === '/driver') handleViewChange('driver');
            else if (path === '/admin') handleViewChange('admin');
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
