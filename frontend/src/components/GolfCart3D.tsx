import React, { useEffect, useRef, useState, useMemo, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Html, ContactShadows, Float } from '@react-three/drei';
import * as THREE from 'three';
import { createGolfCartModel, GolfCartRig } from './golfCartGeometry.ts';

export interface GolfCart3DProps {
  speed?: number;                 // m/s
  steer?: number;                 // radians
  status?: 'available' | 'busy' | 'offline';
  code?: string;                  // e.g. "GC-01"
  autoRotate?: boolean;
  lowPower?: boolean;
  cameraPreset?: 'front34' | 'side' | 'top' | 'rear';
  interactive?: boolean;
  mapMode?: boolean;
  heading?: number;
  className?: string;
}

export function GolfCartMesh({
  speed = 0,
  steer = 0,
  status = 'available',
  code = 'GC-01',
  lowPower = false,
  mapMode = false,
  heading = 0,
}: GolfCart3DProps) {
  const containerRef = useRef<THREE.Group>(null);
  const rigRef = useRef<GolfCartRig | null>(null);
  const wheelAngle = useRef(0);

  const rig = useMemo(() => createGolfCartModel({ lowPower }), [lowPower]);

  useEffect(() => {
    rigRef.current = rig;
    if (containerRef.current) {
      containerRef.current.clear();
      containerRef.current.add(rig.root);
    }
    return () => rig.dispose();
  }, [rig]);

  useFrame((_, delta) => {
    if (!rigRef.current) return;
    const r = rigRef.current;
    const effectiveDelta = Math.min(delta, 0.1);

    const wheelRadius = 0.24;
    wheelAngle.current += (speed * effectiveDelta) / wheelRadius;
    r.frontLeftWheel.rotation.x = wheelAngle.current;
    r.frontRightWheel.rotation.x = wheelAngle.current;
    r.rearLeftWheel.rotation.x = wheelAngle.current;
    r.rearRightWheel.rotation.x = wheelAngle.current;

    r.frontLeftSteer.rotation.y = THREE.MathUtils.lerp(r.frontLeftSteer.rotation.y, steer, 0.2);
    r.frontRightSteer.rotation.y = THREE.MathUtils.lerp(r.frontRightSteer.rotation.y, steer, 0.2);

    if (mapMode && containerRef.current) {
      containerRef.current.rotation.y = THREE.MathUtils.degToRad(heading);
    }
  });

  return (
    <group ref={containerRef}>
      {!mapMode && (
        <Float speed={2} rotationIntensity={0.05} floatIntensity={0.2}>
          <Html position={[0, 2.4, 0]} center distanceFactor={10} className="pointer-events-none select-none">
            <div className="px-2.5 py-1 rounded-full border border-indigo-500/30 bg-slate-900/90 text-indigo-300 text-xs font-bold shadow-xl backdrop-blur-md">
              ⚡ GOLF CART &bull; {code}
            </div>
          </Html>
        </Float>
      )}
    </group>
  );
}

export default function GolfCart3D(props: GolfCart3DProps) {
  const {
    speed = 0,
    steer = 0,
    status = 'available',
    code = 'GC-01',
    autoRotate = false,
    lowPower = false,
    cameraPreset = 'front34',
    interactive = true,
    mapMode = false,
    heading = 0,
    className = 'w-full h-full min-h-[400px]',
  } = props;

  return (
    <div className={`relative overflow-hidden ${className}`}>
      <Suspense fallback={<div className="text-white text-xs p-4">Loading Golf Cart...</div>}>
        <Canvas
          shadows={!lowPower && !mapMode}
          camera={{ position: [4.2, 2.4, 4.2], fov: 42 }}
        >
          <ambientLight intensity={0.8} />
          <directionalLight position={[6, 10, 8]} intensity={1.6} castShadow={!lowPower} />
          <GolfCartMesh
            speed={speed}
            steer={steer}
            status={status}
            code={code}
            lowPower={lowPower}
            mapMode={mapMode}
            heading={heading}
          />
          {!lowPower && !mapMode && (
            <ContactShadows position={[0, 0, 0]} opacity={0.6} scale={6} blur={1.5} far={3} />
          )}
          {interactive && !mapMode && <OrbitControls autoRotate={autoRotate} />}
        </Canvas>
      </Suspense>
    </div>
  );
}

export const LazyGolfCart3D = React.lazy(() => Promise.resolve({ default: GolfCart3D }));
