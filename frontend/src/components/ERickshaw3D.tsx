import React, { useEffect, useRef, useState, useMemo, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Html, ContactShadows, Float } from '@react-three/drei';
import * as THREE from 'three';
import { createERickshawModel, ERickshawRig, RickshawColorScheme } from './eRickshawGeometry.ts';

export type RickshawStatus = 'available' | 'busy' | 'offline';
export type CameraPreset = 'front34' | 'side' | 'top' | 'rear' | 'driver' | 'custom';

export interface ERickshaw3DProps {
  speed?: number;                 // m/s
  steer?: number;                 // radians
  status?: RickshawStatus;
  seatsFree?: 0 | 1 | 2 | 3 | 4;
  fare?: number;                  // INR (e.g. 15)
  colorScheme?: RickshawColorScheme; // 'classic' | 'lpu'
  autoRotate?: boolean;
  lowPower?: boolean;             // fewer polygons, no shadows
  
  // Showcase & Map vehicle extras
  showHotspots?: boolean;
  onHotspotClick?: (id: string) => void;
  cameraPreset?: CameraPreset;
  interactive?: boolean;
  mapMode?: boolean;              // lightweight mode for map layer
  heading?: number;               // degrees (for map vehicle)
  isNight?: boolean;
  className?: string;
}

// Check WebGL availability safely
function isWebGLAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
    );
  } catch {
    return false;
  }
}

// Auto-detect weak/low-power devices
function detectLowPowerDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const lowCores = typeof navigator.hardwareConcurrency === 'number' && navigator.hardwareConcurrency <= 4;
  return isMobile || lowCores;
}

// Camera controller helper
function CameraRig({ preset = 'front34', autoRotate = false }: { preset?: CameraPreset; autoRotate?: boolean }) {
  const controlsRef = useRef<any>(null);

  useEffect(() => {
    if (!controlsRef.current) return;
    const controls = controlsRef.current;

    switch (preset) {
      case 'front34':
        controls.object.position.set(3.4, 1.8, 3.4);
        controls.target.set(0, 0.85, 0.1);
        break;
      case 'side':
        controls.object.position.set(-4.6, 1.3, 0);
        controls.target.set(0, 0.85, 0);
        break;
      case 'top':
        controls.object.position.set(0.01, 5.8, 0.05);
        controls.target.set(0, 0, 0);
        break;
      case 'rear':
        controls.object.position.set(-2.2, 1.5, -3.6);
        controls.target.set(0, 0.85, -0.2);
        break;
      case 'driver':
        controls.object.position.set(0, 1.15, 0.35);
        controls.target.set(0, 0.95, 1.5);
        break;
      default:
        break;
    }
    controls.update();
  }, [preset]);

  return (
    <OrbitControls
      ref={controlsRef}
      enablePan={true}
      enableZoom={true}
      enableRotate={true}
      autoRotate={autoRotate}
      autoRotateSpeed={0.8}
      minDistance={1.2}
      maxDistance={12}
      maxPolarAngle={Math.PI / 2 + 0.05}
    />
  );
}

// Hotspot definitions for E-Rickshaw
interface HotspotData {
  id: string;
  title: string;
  desc: string;
  position: [number, number, number];
}

const RICKSHAW_HOTSPOTS: HotspotData[] = [
  {
    id: 'fare',
    title: 'Fixed Campus Fare',
    desc: 'Regulated university tariff (₹10 - ₹20 flat rate across LPU campus gates & hostel stands).',
    position: [0, 1.75, 0.35],
  },
  {
    id: 'seats',
    title: '4-Seat Passenger Cabin',
    desc: 'Face-to-face dual cushioned benches with side safety grab rails and low-floor rear boarding step.',
    position: [0, 0.95, -0.55],
  },
  {
    id: 'electric',
    title: 'Zero-Emission Powertrain',
    desc: 'High-torque BLDC motor powered by an under-seat 48V/60V high-capacity battery bank.',
    position: [0, 0.45, -0.65],
  },
  {
    id: 'steer',
    title: 'Motorcycle-Style Handlebar',
    desc: 'Direct ergonomic handlebar with twist throttle, drum brakes, and digital battery telemetry.',
    position: [0, 1.05, 0.85],
  },
];

// Inner 3D E-Rickshaw Mesh + Animation component
export function ERickshawMesh({
  speed = 0,
  steer = 0,
  status = 'available',
  seatsFree = 2,
  fare = 15,
  colorScheme = 'classic',
  lowPower = false,
  showHotspots = false,
  onHotspotClick,
  heading = 0,
  mapMode = false,
  isNight = false,
}: ERickshaw3DProps) {
  const containerRef = useRef<THREE.Group>(null);
  const rigRef = useRef<ERickshawRig | null>(null);

  const wheelAngle = useRef(0);
  const lastSpeed = useRef(speed);
  const currentRoll = useRef(0);
  const currentPitch = useRef(0);
  const [selectedHotspot, setSelectedHotspot] = useState<string | null>(null);

  const prefersReducedMotion = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  // Instantiate procedural 3D model
  const rig = useMemo(() => {
    return createERickshawModel({ colorScheme, seatsFree, fare, lowPower });
  }, [colorScheme, lowPower]);

  useEffect(() => {
    rigRef.current = rig;
    if (containerRef.current) {
      containerRef.current.clear();
      containerRef.current.add(rig.root);
    }
    return () => {
      rig.dispose();
    };
  }, [rig]);

  // Update seat occupancy when seatsFree changes
  useEffect(() => {
    if (rig.updateSeatsFree) {
      rig.updateSeatsFree(seatsFree);
    }
  }, [rig, seatsFree]);

  const statusColors = {
    available: 0x10b981, // Emerald green
    busy: 0xf59e0b,      // Amber
    offline: 0xef4444,   // Red
  };

  // Animation Frame Loop
  useFrame((state, delta) => {
    if (!rigRef.current) return;
    const r = rigRef.current;
    const effectiveDelta = Math.min(delta, 0.1);

    // 1. Wheel spin & Handlebar steering
    if (!prefersReducedMotion) {
      const wheelRadius = 0.22;
      wheelAngle.current += (speed * effectiveDelta) / wheelRadius;

      r.frontWheelGroup.rotation.x = wheelAngle.current;
      r.rearLeftWheelGroup.rotation.x = wheelAngle.current;
      r.rearRightWheelGroup.rotation.x = wheelAngle.current;

      // Handlebar and front wheel turn in sync on Y axis
      r.handlebarSteerGroup.rotation.y = THREE.MathUtils.lerp(
        r.handlebarSteerGroup.rotation.y,
        steer,
        0.20
      );
    }

    // 2. Body dynamics: Gentle body sway / roll on turns & idle vibration when stopped
    if (!prefersReducedMotion && !lowPower) {
      if (speed < 0.1) {
        // Idle electric vibration when stopped
        const idleVib = Math.sin(state.clock.getElapsedTime() * 26) * 0.002;
        r.bodyGroup.position.y = idleVib;
        r.bodyGroup.rotation.z = THREE.MathUtils.lerp(r.bodyGroup.rotation.z, 0, 0.1);
        r.bodyGroup.rotation.x = Math.sin(state.clock.getElapsedTime() * 16) * 0.001;
      } else {
        // Dynamic roll/lean into turns
        const targetRoll = -steer * 0.10 * Math.min(speed / 3.0, 1.0);
        currentRoll.current = THREE.MathUtils.lerp(currentRoll.current, targetRoll, 0.15);
        r.bodyGroup.rotation.z = currentRoll.current;

        // Dynamic pitch on braking/acceleration
        const acceleration = (speed - lastSpeed.current) / Math.max(effectiveDelta, 0.001);
        const targetPitch = -THREE.MathUtils.clamp(acceleration * 0.025, -0.05, 0.05);
        currentPitch.current = THREE.MathUtils.lerp(currentPitch.current, targetPitch, 0.15);
        r.bodyGroup.rotation.x = currentPitch.current;

        r.bodyGroup.position.y = 0;
      }
      lastSpeed.current = speed;
    }

    // 3. Lighting logic
    const isBraking = speed < 0.2 || status === 'busy';
    r.brakeLightsMaterial.emissiveIntensity = isBraking ? 3.5 : 0.8;
    r.headlightMaterial.emissiveIntensity = isNight ? 3.0 : 1.8;

    // 4. Ground status ring pulse
    r.statusRingMaterial.color.setHex(statusColors[status] || 0x10b981);
    const ringPulse = 1.0 + Math.sin(state.clock.getElapsedTime() * 4.0) * 0.035;
    r.statusRingMesh.scale.set(ringPulse, 1, ringPulse);
    r.statusRingMaterial.opacity = 0.55 + Math.sin(state.clock.getElapsedTime() * 4.0) * 0.25;

    // 5. Map mode heading
    if (mapMode && containerRef.current) {
      containerRef.current.rotation.y = THREE.MathUtils.degToRad(heading);
    }
  });

  return (
    <group ref={containerRef}>
      {/* Floating Fare Tag above the E-Rickshaw */}
      {!mapMode && (
        <Float speed={2.5} rotationIntensity={0.08} floatIntensity={0.2}>
          <Html
            position={[0, 2.35, 0]}
            center
            distanceFactor={9}
            className="pointer-events-none select-none transition-all duration-300"
          >
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/20 shadow-2xl backdrop-blur-md bg-slate-900/90 text-white">
              <span className={`w-2.5 h-2.5 rounded-full ${status === 'available' ? 'bg-emerald-400 animate-ping' : status === 'busy' ? 'bg-amber-400' : 'bg-rose-400'}`} />
              <div className="flex flex-col text-left">
                <span className="text-[10px] font-bold text-amber-400 tracking-wider uppercase leading-none">
                  ₹{fare} FLAT CAMPUS FARE
                </span>
                <span className="text-xs font-black tracking-tight leading-tight text-slate-100">
                  {seatsFree > 0 ? `${seatsFree} SEATS FREE` : 'FULL (0 SEATS)'} &bull; {status.toUpperCase()}
                </span>
              </div>
            </div>
          </Html>
        </Float>
      )}

      {/* Feature Hotspots */}
      {showHotspots && !mapMode && (
        <group name="RickshawHotspots">
          {RICKSHAW_HOTSPOTS.map((spot) => (
            <Html
              key={spot.id}
              position={spot.position}
              center
              distanceFactor={8}
            >
              <div className="relative group">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedHotspot(selectedHotspot === spot.id ? null : spot.id);
                    if (onHotspotClick) onHotspotClick(spot.id);
                  }}
                  className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[11px] shadow-xl transition-transform hover:scale-125 focus:outline-none ${
                    selectedHotspot === spot.id
                      ? 'bg-amber-400 text-slate-950 ring-4 ring-amber-300/50'
                      : 'bg-emerald-600 text-white hover:bg-emerald-500 ring-2 ring-white/70'
                  }`}
                  title={spot.title}
                >
                  +
                </button>

                {selectedHotspot === spot.id && (
                  <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-60 p-2.5 bg-slate-900/95 border border-slate-700/80 rounded-xl shadow-2xl backdrop-blur-md text-white text-left z-50">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-1 mb-1">
                      <h4 className="text-xs font-bold text-amber-400">{spot.title}</h4>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedHotspot(null);
                        }}
                        className="text-[10px] text-slate-400 hover:text-white"
                      >
                        ✕
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-relaxed">{spot.desc}</p>
                  </div>
                )}
              </div>
            </Html>
          ))}
        </group>
      )}
    </group>
  );
}

// Fallback component when WebGL is unavailable
export function ERickshawStaticFallback({
  status = 'available',
  seatsFree = 2,
  fare = 15,
  speed = 0,
}: ERickshaw3DProps) {
  return (
    <div className="w-full h-full min-h-[380px] flex flex-col items-center justify-center bg-gradient-to-b from-slate-900 via-slate-950 to-black text-white p-6 rounded-2xl border border-slate-800">
      <div className="max-w-md w-full bg-slate-900/80 border border-slate-700/70 rounded-2xl p-6 shadow-2xl backdrop-blur-md text-center">
        <div className="w-16 h-16 mx-auto mb-4 bg-emerald-500/20 border border-emerald-500/40 rounded-2xl flex items-center justify-center text-3xl shadow-inner">
          🛺
        </div>
        <span className="inline-block px-3 py-1 rounded-full text-[11px] font-bold tracking-wider uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 mb-2">
          Campus Electric Auto (3-Wheeler)
        </span>
        <h3 className="text-lg font-bold text-white mb-1">LPU E-Rickshaw Telematics</h3>
        <p className="text-xs text-slate-400 mb-4">Fixed Campus Stand Service &bull; Flat Tariff ₹{fare}</p>

        <div className="grid grid-cols-3 gap-2 bg-slate-950/70 p-3 rounded-xl border border-slate-800 text-left mb-4">
          <div>
            <div className="text-[10px] text-slate-500 uppercase font-bold">Speed</div>
            <div className="text-sm font-black text-cyan-400">{(speed * 3.6).toFixed(1)} km/h</div>
          </div>
          <div>
            <div className="text-[10px] text-slate-500 uppercase font-bold">Status</div>
            <div className="text-sm font-bold text-emerald-400 capitalize">{status}</div>
          </div>
          <div>
            <div className="text-[10px] text-slate-500 uppercase font-bold">Seats Free</div>
            <div className="text-sm font-bold text-amber-400">{seatsFree} / 4</div>
          </div>
        </div>

        <p className="text-[11px] text-slate-500">
          Showing 2D telemetry card. Enable WebGL in your browser to view the interactive 3D model.
        </p>
      </div>
    </div>
  );
}

// Loading Spinner
export function ERickshawLoader() {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-slate-950/80 text-slate-400">
      <div className="w-12 h-12 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mb-3" />
      <span className="text-xs font-mono uppercase tracking-widest text-slate-400">
        Loading 3D E-Rickshaw...
      </span>
    </div>
  );
}

/**
 * ERickshaw3D Component
 * 
 * Main export: Interactive procedural 3D electric rickshaw built with Three.js,
 * @react-three/fiber and @react-three/drei in TypeScript.
 */
export default function ERickshaw3D(props: ERickshaw3DProps) {
  const {
    speed = 0,
    steer = 0,
    status = 'available',
    seatsFree = 2,
    fare = 15,
    colorScheme = 'classic',
    autoRotate = false,
    lowPower: lowPowerProp,
    showHotspots = false,
    onHotspotClick,
    cameraPreset = 'front34',
    interactive = true,
    mapMode = false,
    heading = 0,
    isNight = false,
    className = 'w-full h-full min-h-[420px]',
  } = props;

  const [hasWebGL, setHasWebGL] = useState(true);
  useEffect(() => {
    setHasWebGL(isWebGLAvailable());
  }, []);

  const lowPower = useMemo(() => {
    if (typeof lowPowerProp === 'boolean') return lowPowerProp;
    return detectLowPowerDevice();
  }, [lowPowerProp]);

  if (!hasWebGL) {
    return <ERickshawStaticFallback {...props} />;
  }

  return (
    <div className={`relative overflow-hidden ${className}`}>
      <Suspense fallback={<ERickshawLoader />}>
        <Canvas
          shadows={!lowPower && !mapMode}
          gl={{
            antialias: !lowPower,
            powerPreference: lowPower ? 'low-power' : 'high-performance',
            alpha: true,
          }}
          camera={{
            position: [3.4, 1.8, 3.4],
            fov: 42,
            near: 0.1,
            far: 50,
          }}
          dpr={lowPower ? [1, 1] : [1, 2]}
        >
          {/* Lighting Rig */}
          <ambientLight intensity={isNight ? 0.35 : 0.85} />

          {/* Key Sun / Studio Directional Light */}
          <directionalLight
            position={[5, 10, 6]}
            intensity={isNight ? 0.4 : 1.7}
            castShadow={!lowPower && !mapMode}
            shadow-mapSize={[1024, 1024]}
            shadow-camera-near={1}
            shadow-camera-far={20}
            shadow-camera-left={-4}
            shadow-camera-right={4}
            shadow-camera-top={4}
            shadow-camera-bottom={-4}
            shadow-bias={-0.0005}
          />

          {/* Fill Light */}
          <directionalLight
            position={[-6, 4, -5]}
            intensity={isNight ? 0.2 : 0.6}
            color="#93c5fd"
          />

          {/* Ground Underglow Light */}
          <pointLight
            position={[0, 0.3, 0]}
            intensity={status === 'available' ? 1.2 : 0.5}
            color={status === 'available' ? '#10b981' : status === 'busy' ? '#f59e0b' : '#ef4444'}
            distance={3.5}
          />

          {/* Front Headlight Spotlight */}
          <spotLight
            position={[0, 0.72, 1.1]}
            target-position={[0, 0, 6]}
            angle={0.5}
            penumbra={0.4}
            intensity={isNight ? 3.0 : 0.8}
            color="#ffffff"
            distance={8}
          />

          {/* Rickshaw 3D Hierarchy Mesh */}
          <ERickshawMesh
            speed={speed}
            steer={steer}
            status={status}
            seatsFree={seatsFree}
            fare={fare}
            colorScheme={colorScheme}
            lowPower={lowPower}
            showHotspots={showHotspots}
            onHotspotClick={onHotspotClick}
            heading={heading}
            mapMode={mapMode}
            isNight={isNight}
          />

          {/* Soft Ground Contact Shadow */}
          {!lowPower && !mapMode && (
            <ContactShadows
              position={[0, 0, 0]}
              opacity={0.65}
              scale={6}
              blur={1.8}
              far={3}
              resolution={512}
              color="#020617"
            />
          )}

          {/* Interactive Orbit Controls with smooth camera presets */}
          {interactive && !mapMode && (
            <CameraRig preset={cameraPreset} autoRotate={autoRotate} />
          )}
        </Canvas>
      </Suspense>
    </div>
  );
}

// Lazy loaded export helper
export const LazyERickshaw3D = React.lazy(() => Promise.resolve({ default: ERickshaw3D }));
