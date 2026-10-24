import React, { useEffect, useRef, useState, useMemo, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Html, ContactShadows, Float } from '@react-three/drei';
import * as THREE from 'three';
import { createShuttleBusModel, ShuttleBusRig } from './shuttleBusGeometry.ts';

export type CrowdLevel = 'low' | 'moderate' | 'full';
export type ShuttleStatus = 'running' | 'at_stop' | 'offline';
export type CameraPreset = 'front34' | 'side' | 'top' | 'rear' | 'driver' | 'custom';

export interface ShuttleBus3DProps {
  speed?: number;                 // m/s
  steer?: number;                 // radians
  crowd?: CrowdLevel;
  status?: ShuttleStatus;
  doorsOpen?: boolean;
  route?: string;                 // e.g. "Route 1 - Loop"
  autoRotate?: boolean;
  lowPower?: boolean;             // fewer polygons, no shadows, lightweight materials
  
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

// Auto-detect weak/low-power devices (mobile or < 4 CPU cores)
function detectLowPowerDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const lowCores = typeof navigator.hardwareConcurrency === 'number' && navigator.hardwareConcurrency <= 4;
  return isMobile || lowCores;
}

// Camera controller helper to smoothly transition presets
function CameraRig({ preset = 'front34', autoRotate = false }: { preset?: CameraPreset; autoRotate?: boolean }) {
  const controlsRef = useRef<any>(null);

  useEffect(() => {
    if (!controlsRef.current) return;
    const controls = controlsRef.current;
    
    switch (preset) {
      case 'front34':
        controls.object.position.set(7.5, 3.5, 7.5);
        controls.target.set(0, 1.2, 0.2);
        break;
      case 'side':
        controls.object.position.set(-11.5, 2.0, 0);
        controls.target.set(0, 1.2, 0);
        break;
      case 'top':
        controls.object.position.set(0.01, 14.2, 0.1);
        controls.target.set(0, 0, 0);
        break;
      case 'rear':
        controls.object.position.set(-5.5, 3.0, -8.2);
        controls.target.set(0, 1.2, -0.5);
        break;
      case 'driver':
        controls.object.position.set(0.55, 1.45, 2.3);
        controls.target.set(0.55, 1.35, 3.8);
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
      minDistance={2.5}
      maxDistance={22}
      maxPolarAngle={Math.PI / 2 + 0.05} // don't go below floor
    />
  );
}

// Hotspot definitions
interface HotspotData {
  id: string;
  title: string;
  desc: string;
  position: [number, number, number];
}

const BUS_HOTSPOTS: HotspotData[] = [
  {
    id: 'crowd',
    title: 'Live Crowd Telematics',
    desc: 'Real-time infrared passenger count and smart crowd classification (Low, Mod, Full).',
    position: [0, 3.9, 0],
  },
  {
    id: 'destination',
    title: 'Route & Destination LED',
    desc: 'Ultra-bright sunlight-readable amber matrix display updated automatically over campus event bus.',
    position: [0, 2.7, 3.75],
  },
  {
    id: 'doors',
    title: 'Accessible Low-Floor Stepwell',
    desc: 'Dual electric plug-sliding passenger doors with illuminated non-slip yellow hazard entry step.',
    position: [-1.25, 0.65, 2.05],
  },
  {
    id: 'interior',
    title: '28-Seat Ergonomic Interior',
    desc: 'High-back cushioned seats, safety stanchions, and dedicated wheelchair securement bay.',
    position: [0, 1.8, -0.4],
  },
  {
    id: 'ac',
    title: 'Dual Rooftop HVAC',
    desc: 'High-capacity dual-fan air purification and climate control engineered for Punjab summers.',
    position: [0, 3.25, -0.5],
  },
  {
    id: 'wheels',
    title: 'Heavy-Duty Commercial Wheels',
    desc: 'Radial pneumatic tyres with ventilated disc brakes and real-time steering geometry.',
    position: [-1.15, 0.5, 2.25],
  },
];

// Inner 3D Bus Mesh + Animation Component
export function ShuttleBusMesh({
  speed = 0,
  steer = 0,
  crowd = 'low',
  status = 'running',
  doorsOpen = false,
  route = 'Route 1 - Loop',
  lowPower = false,
  showHotspots = false,
  onHotspotClick,
  heading = 0,
  mapMode = false,
  isNight = false,
}: ShuttleBus3DProps) {
  const containerRef = useRef<THREE.Group>(null);
  const rigRef = useRef<ShuttleBusRig | null>(null);

  // Animation state tracking
  const wheelAngle = useRef(0);
  const doorProgress = useRef(0);
  const lastSpeed = useRef(speed);
  const currentPitch = useRef(0);
  const currentBounce = useRef(0);
  const blinkTimer = useRef(0);
  const [selectedHotspot, setSelectedHotspot] = useState<string | null>(null);

  // Check prefers-reduced-motion
  const prefersReducedMotion = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  // Instantiate procedural 3D model once
  const rig = useMemo(() => {
    return createShuttleBusModel({ route, lowPower });
  }, [lowPower]);

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

  // Update destination sign whenever route prop changes
  useEffect(() => {
    if (rig.updateDestinationBoard) {
      rig.updateDestinationBoard(route);
    }
  }, [rig, route]);

  // Status ring and crowd colors
  const statusColors = {
    running: 0x10b981, // Emerald green
    at_stop: 0xf59e0b, // Amber
    offline: 0xef4444, // Red
  };

  const crowdColors = {
    low: { bg: 'bg-emerald-500/90', text: 'text-emerald-100', dot: 'bg-emerald-300', label: 'Low Crowd (Seats Available)' },
    moderate: { bg: 'bg-amber-500/90', text: 'text-amber-100', dot: 'bg-amber-300', label: 'Moderate Crowd (Standing Room)' },
    full: { bg: 'bg-rose-600/90', text: 'text-rose-100', dot: 'bg-white', label: 'Full Capacity (Wait Next)' },
  };

  // Animation Frame Loop
  useFrame((state, delta) => {
    if (!rigRef.current) return;
    const r = rigRef.current;
    const effectiveDelta = Math.min(delta, 0.1);

    // 1. Wheel spin & steering
    if (!prefersReducedMotion) {
      const wheelRadius = 0.44;
      wheelAngle.current += (speed * effectiveDelta) / wheelRadius;
      
      r.frontLeftWheel.rotation.x = wheelAngle.current;
      r.frontRightWheel.rotation.x = wheelAngle.current;
      r.rearLeftWheel.rotation.x = wheelAngle.current;
      r.rearRightWheel.rotation.x = wheelAngle.current;

      // Front steering angle
      r.frontLeftSteer.rotation.y = THREE.MathUtils.lerp(r.frontLeftSteer.rotation.y, steer, 0.18);
      r.frontRightSteer.rotation.y = THREE.MathUtils.lerp(r.frontRightSteer.rotation.y, steer, 0.18);
    }

    // 2. Suspension bounce & body pitch
    if (!prefersReducedMotion && !lowPower) {
      const acceleration = (speed - lastSpeed.current) / Math.max(effectiveDelta, 0.001);
      lastSpeed.current = speed;

      // Pitch nosing down on braking, rearing up slightly on hard acceleration
      const targetPitch = -THREE.MathUtils.clamp(acceleration * 0.035, -0.06, 0.06);
      currentPitch.current = THREE.MathUtils.lerp(currentPitch.current, targetPitch, 0.12);
      r.suspensionGroup.rotation.x = currentPitch.current;

      // Subtle vertical suspension vibration based on speed
      const targetBounce = Math.sin(state.clock.getElapsedTime() * 10) * Math.min(speed * 0.004, 0.022);
      currentBounce.current = THREE.MathUtils.lerp(currentBounce.current, targetBounce, 0.15);
      r.suspensionGroup.position.y = currentBounce.current;
    }

    // 3. Doors Open/Close animation (smooth lateral plug-sliding)
    const targetDoor = doorsOpen ? 1.0 : 0.0;
    doorProgress.current = THREE.MathUtils.lerp(doorProgress.current, targetDoor, 0.12);
    const slideOffset = doorProgress.current * 0.38;
    const outOffset = doorProgress.current * -0.055;

    r.frontDoorLeftLeaf.position.z = 2.30 + slideOffset;
    r.frontDoorLeftLeaf.position.x = -1.14 + outOffset;
    r.frontDoorRightLeaf.position.z = 1.80 - slideOffset;
    r.frontDoorRightLeaf.position.x = -1.14 + outOffset;

    r.rearDoorLeftLeaf.position.z = -0.50 + slideOffset;
    r.rearDoorLeftLeaf.position.x = -1.14 + outOffset;
    r.rearDoorRightLeaf.position.z = -1.00 - slideOffset;
    r.rearDoorRightLeaf.position.x = -1.14 + outOffset;

    // 4. Lights logic
    // Brake lights: bright red when stopping, decelerating, or at stop
    const isBraking = speed < 0.15 || status === 'at_stop' || (speed - lastSpeed.current) < -0.1;
    r.brakeLightsMaterial.emissiveIntensity = isBraking ? 3.2 : 0.8;

    // Headlights
    r.headlightsMaterial.emissiveIntensity = isNight ? 3.0 : 1.8;

    // Indicators: blink at stop or when doors are open
    blinkTimer.current += effectiveDelta * 4;
    const blinkOn = Math.sin(blinkTimer.current) > 0;
    const shouldBlink = status === 'at_stop' || doorsOpen;
    r.indicatorsMaterial.emissiveIntensity = shouldBlink ? (blinkOn ? 3.2 : 0.1) : 0.2;

    // 5. Status Ground Ring Pulse
    r.statusRingMaterial.color.setHex(statusColors[status] || 0x10b981);
    const ringPulse = 1.0 + Math.sin(state.clock.getElapsedTime() * 3.5) * 0.04;
    r.statusRingMesh.scale.set(ringPulse, 1, ringPulse);
    r.statusRingMaterial.opacity = 0.55 + Math.sin(state.clock.getElapsedTime() * 3.5) * 0.25;

    // 6. Map vehicle heading
    if (mapMode && containerRef.current) {
      containerRef.current.rotation.y = THREE.MathUtils.degToRad(heading);
    }
  });

  return (
    <group ref={containerRef}>
      {/* Crowd Badge Floating above the bus */}
      {!mapMode && (
        <Float speed={2} rotationIntensity={0.1} floatIntensity={0.25}>
          <Html
            position={[0, 3.85, 0]}
            center
            distanceFactor={14}
            className="pointer-events-none select-none transition-all duration-300"
          >
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/20 shadow-2xl backdrop-blur-md ${crowdColors[crowd].bg} ${crowdColors[crowd].text}`}
            >
              <span className={`w-2.5 h-2.5 rounded-full ${crowdColors[crowd].dot} animate-ping`} />
              <div className="flex flex-col text-left">
                <span className="text-[10px] font-bold tracking-wider uppercase opacity-90 leading-none">
                  {route}
                </span>
                <span className="text-xs font-black tracking-tight leading-tight">
                  {crowd.toUpperCase()} CROWD &bull; {status.replace('_', ' ').toUpperCase()}
                </span>
              </div>
            </div>
          </Html>
        </Float>
      )}

      {/* Interactive Feature Hotspots */}
      {showHotspots && !mapMode && (
        <group name="HotspotsGroup">
          {BUS_HOTSPOTS.map((spot) => (
            <Html
              key={spot.id}
              position={spot.position}
              center
              distanceFactor={12}
            >
              <div className="relative group">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedHotspot(selectedHotspot === spot.id ? null : spot.id);
                    if (onHotspotClick) onHotspotClick(spot.id);
                  }}
                  className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shadow-xl transition-transform hover:scale-125 focus:outline-none ${
                    selectedHotspot === spot.id
                      ? 'bg-amber-400 text-slate-950 ring-4 ring-amber-300/50'
                      : 'bg-indigo-600/90 text-white hover:bg-indigo-500 ring-2 ring-white/70'
                  }`}
                  title={spot.title}
                >
                  +
                </button>

                {/* Hotspot Popover Card */}
                {selectedHotspot === spot.id && (
                  <div className="absolute bottom-9 left-1/2 -translate-x-1/2 w-64 p-3 bg-slate-900/95 border border-slate-700/80 rounded-xl shadow-2xl backdrop-blur-md text-white text-left z-50 animate-in fade-in zoom-in-95 duration-200">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 mb-1.5">
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

// Static Fallback Component when WebGL is unavailable or fails
export function ShuttleBusStaticFallback({
  route = 'Route 1 - Loop',
  crowd = 'low',
  status = 'running',
  speed = 0,
}: ShuttleBus3DProps) {
  return (
    <div className="w-full h-full min-h-[380px] flex flex-col items-center justify-center bg-gradient-to-b from-slate-900 via-slate-950 to-black text-white p-6 rounded-2xl border border-slate-800">
      <div className="max-w-md w-full bg-slate-900/80 border border-slate-700/70 rounded-2xl p-6 shadow-2xl backdrop-blur-md text-center">
        <div className="w-16 h-16 mx-auto mb-4 bg-orange-500/20 border border-orange-500/40 rounded-2xl flex items-center justify-center text-3xl shadow-inner">
          🚌
        </div>
        <span className="inline-block px-3 py-1 rounded-full text-[11px] font-bold tracking-wider uppercase bg-orange-500/20 text-orange-400 border border-orange-500/30 mb-2">
          WebGL Accelerated Mode Unavailable
        </span>
        <h3 className="text-lg font-bold text-white mb-1">LPU Campus Shuttle Bus (PB-10)</h3>
        <p className="text-xs text-slate-400 mb-4">{route}</p>

        <div className="grid grid-cols-3 gap-2 bg-slate-950/70 p-3 rounded-xl border border-slate-800 text-left mb-4">
          <div>
            <div className="text-[10px] text-slate-500 uppercase font-bold">Speed</div>
            <div className="text-sm font-black text-cyan-400">{(speed * 3.6).toFixed(1)} km/h</div>
          </div>
          <div>
            <div className="text-[10px] text-slate-500 uppercase font-bold">Status</div>
            <div className="text-sm font-bold text-emerald-400 capitalize">{status.replace('_', ' ')}</div>
          </div>
          <div>
            <div className="text-[10px] text-slate-500 uppercase font-bold">Crowd</div>
            <div className="text-sm font-bold text-amber-400 capitalize">{crowd}</div>
          </div>
        </div>

        <p className="text-[11px] text-slate-500">
          Showing 2D telemetry card. Enable WebGL / Hardware Acceleration in your browser to view the interactive 3D model.
        </p>
      </div>
    </div>
  );
}

// Loading Skeleton
export function ShuttleBusLoader() {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-slate-950/80 text-slate-400">
      <div className="w-12 h-12 border-4 border-orange-500/30 border-t-orange-500 rounded-full animate-spin mb-3" />
      <span className="text-xs font-mono uppercase tracking-widest text-slate-400">
        Loading 3D Campus Shuttle...
      </span>
    </div>
  );
}

/**
 * ShuttleBus3D Component
 * 
 * Main export: Interactive procedural 3D campus shuttle bus built with Three.js,
 * @react-three/fiber and @react-three/drei in TypeScript.
 */
export default function ShuttleBus3D(props: ShuttleBus3DProps) {
  const {
    speed = 0,
    steer = 0,
    crowd = 'low',
    status = 'running',
    doorsOpen = false,
    route = 'Route 1 - Uni-Mall Loop',
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

  // WebGL support detection
  const [hasWebGL, setHasWebGL] = useState(true);
  useEffect(() => {
    setHasWebGL(isWebGLAvailable());
  }, []);

  // Low power auto-switch
  const lowPower = useMemo(() => {
    if (typeof lowPowerProp === 'boolean') return lowPowerProp;
    return detectLowPowerDevice();
  }, [lowPowerProp]);

  if (!hasWebGL) {
    return <ShuttleBusStaticFallback {...props} />;
  }

  return (
    <div className={`relative overflow-hidden ${className}`}>
      <Suspense fallback={<ShuttleBusLoader />}>
        <Canvas
          shadows={!lowPower && !mapMode}
          gl={{
            antialias: !lowPower,
            powerPreference: lowPower ? 'low-power' : 'high-performance',
            alpha: true,
          }}
          camera={{
            position: [6.8, 3.8, 7.2],
            fov: 42,
            near: 0.1,
            far: 100,
          }}
          dpr={lowPower ? [1, 1] : [1, 2]}
        >
          {/* Lighting Rig */}
          <ambientLight intensity={isNight ? 0.35 : 0.85} />
          
          {/* Main Key Sunlight / Studio Spot */}
          <directionalLight
            position={[8, 14, 10]}
            intensity={isNight ? 0.4 : 1.8}
            castShadow={!lowPower && !mapMode}
            shadow-mapSize={[1024, 1024]}
            shadow-camera-near={1}
            shadow-camera-far={30}
            shadow-camera-left={-8}
            shadow-camera-right={8}
            shadow-camera-top={8}
            shadow-camera-bottom={-8}
            shadow-bias={-0.0005}
          />

          {/* Fill Light */}
          <directionalLight
            position={[-10, 6, -8]}
            intensity={isNight ? 0.2 : 0.65}
            color="#93c5fd"
          />

          {/* Ground Rim / Underglow Light */}
          <pointLight
            position={[0, 0.4, 0]}
            intensity={status === 'running' ? 1.4 : 0.5}
            color={status === 'running' ? '#10b981' : status === 'at_stop' ? '#f59e0b' : '#ef4444'}
            distance={5}
          />

          {/* Front Headlight Beams */}
          <spotLight
            position={[0, 0.9, 3.8]}
            target-position={[0, 0, 10]}
            angle={0.6}
            penumbra={0.5}
            intensity={isNight ? 2.8 : 0.8}
            color="#ffffff"
            distance={14}
          />

          {/* Bus 3D Hierarchy Mesh */}
          <ShuttleBusMesh
            speed={speed}
            steer={steer}
            crowd={crowd}
            status={status}
            doorsOpen={doorsOpen}
            route={route}
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
              scale={12}
              blur={1.8}
              far={4}
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
export const LazyShuttleBus3D = React.lazy(() => Promise.resolve({ default: ShuttleBus3D }));
