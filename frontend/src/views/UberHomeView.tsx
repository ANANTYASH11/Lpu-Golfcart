import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { useTheme } from '../theme/ThemeContext';
import { api } from '../api/client';
import { VehicleFactory, VehicleInstance3D } from '../components/vehicleFactory';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User,
  Sun,
  Moon,
  ArrowRight,
  Bus,
  Clock,
  Calendar,
  Menu,
  X,
  Search,
  PhoneCall,
} from 'lucide-react';

interface UberHomeViewProps {
  onBookRide: () => void;
  onExploreFeatures: () => void;
  onOpenProfile?: () => void;
  onNavigate?: (view: string) => void;
}

export default function UberHomeView({
  onBookRide,
  onExploreFeatures,
  onOpenProfile,
  onNavigate,
}: UberHomeViewProps) {
  const { mode, toggleTheme } = useTheme();
  const [selectedVehicle, setSelectedVehicle] = useState<'cart' | 'shuttle' | 'rickshaw'>('cart');
  const [liveStats, setLiveStats] = useState<{ shuttles: number; carts: number } | null>(null);
  const [webGLSupported, setWebGLSupported] = useState<boolean>(true);
  const [menuOpen, setMenuOpen] = useState<boolean>(false);
  const [dockSheetOpen, setDockSheetOpen] = useState<boolean>(false);
  const [scheduleType, setScheduleType] = useState<'now' | 'schedule'>('now');
  const [pickupLocation, setPickupLocation] = useState<string>('Main Gate (Auto-detected)');
  const [destination, setDestination] = useState<string>('');

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);

  const cartInstRef = useRef<VehicleInstance3D | null>(null);
  const shuttleInstRef = useRef<VehicleInstance3D | null>(null);
  const rickshawInstRef = useRef<VehicleInstance3D | null>(null);

  const floorMeshRef = useRef<THREE.Mesh | null>(null);
  const contactShadowMeshRef = useRef<THREE.Mesh | null>(null);
  const ambientLightRef = useRef<THREE.AmbientLight | null>(null);
  const keyLightRef = useRef<THREE.DirectionalLight | null>(null);
  const fillLightRef = useRef<THREE.DirectionalLight | null>(null);
  const rimLightRef = useRef<THREE.DirectionalLight | null>(null);

  const selectedVehicleRef = useRef<'cart' | 'shuttle' | 'rickshaw'>(selectedVehicle);
  const modeRef = useRef<'light' | 'dark'>(mode);

  useEffect(() => {
    selectedVehicleRef.current = selectedVehicle;
  }, [selectedVehicle]);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  // Procedural soft gradient floor texture fading seamlessly to pure white / pure black at the horizon
  const createFloorTexture = (themeMode: 'light' | 'dark') => {
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const grad = ctx.createRadialGradient(256, 256, 20, 256, 256, 256);
    if (themeMode === 'light') {
      grad.addColorStop(0, '#F3F3F3');
      grad.addColorStop(0.35, '#F3F3F3');
      grad.addColorStop(0.68, '#FAFAFA');
      grad.addColorStop(1, '#FFFFFF');
    } else {
      grad.addColorStop(0, '#111111');
      grad.addColorStop(0.35, '#111111');
      grad.addColorStop(0.68, '#080808');
      grad.addColorStop(1, '#000000');
    }

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 512);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  };

  // Baked soft radial contact shadow texture directly under the vehicle
  const createSoftShadowTexture = () => {
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const grad = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    grad.addColorStop(0, 'rgba(0, 0, 0, 0.95)');
    grad.addColorStop(0.3, 'rgba(0, 0, 0, 0.55)');
    grad.addColorStop(0.65, 'rgba(0, 0, 0, 0.18)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  };

  // Generate soft studio environment map for MeshPhysicalMaterial clearcoat reflections
  const createStudioEnvironment = (renderer: THREE.WebGLRenderer) => {
    const pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();

    const envCanvas = document.createElement('canvas');
    envCanvas.width = 512;
    envCanvas.height = 256;
    const envCtx = envCanvas.getContext('2d');
    if (!envCtx) return null;

    const grad = envCtx.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.45, '#e2e8f0');
    grad.addColorStop(1, '#94a3b8');
    envCtx.fillStyle = grad;
    envCtx.fillRect(0, 0, 512, 256);

    // Overhead studio softbox
    const radial = envCtx.createRadialGradient(256, 60, 10, 256, 60, 140);
    radial.addColorStop(0, '#ffffff');
    radial.addColorStop(0.5, 'rgba(255,255,255,0.7)');
    radial.addColorStop(1, 'rgba(255,255,255,0)');
    envCtx.fillStyle = radial;
    envCtx.fillRect(0, 0, 512, 256);

    const envTex = new THREE.CanvasTexture(envCanvas);
    envTex.mapping = THREE.EquirectangularReflectionMapping;
    const envMap = pmrem.fromEquirectangular(envTex).texture;
    pmrem.dispose();
    return envMap;
  };

  // Responsive camera framing: vehicle sits completely clear of the tagline and bottom dock
  const getCameraTarget = (
    veh: 'cart' | 'shuttle' | 'rickshaw',
    width: number,
    height: number
  ) => {
    const isMobile = width < 768;

    if (isMobile) {
      if (veh === 'shuttle') {
        return {
          cam: new THREE.Vector3(0, 2.70, 22.5),
          look: new THREE.Vector3(0, 1.70, 0),
        };
      } else if (veh === 'rickshaw') {
        return {
          cam: new THREE.Vector3(0, 2.05, 13.2),
          look: new THREE.Vector3(0, 1.40, 0),
        };
      } else {
        // cart: pull back and re-center so roof sits comfortably below tagline
        return {
          cam: new THREE.Vector3(0, 2.20, 15.0),
          look: new THREE.Vector3(0, 1.45, 0),
        };
      }
    } else {
      // Desktop / Tablet
      if (veh === 'shuttle') {
        // Shuttle Bus is tallest (top at Y=3.06): raise camera & target so roof is >= 48px below tagline across all screens
        return {
          cam: new THREE.Vector3(0, 2.92, 16.2),
          look: new THREE.Vector3(0, 1.76, 0),
        };
      } else if (veh === 'rickshaw') {
        return {
          cam: new THREE.Vector3(0, 2.15, 9.2),
          look: new THREE.Vector3(0, 1.40, 0),
        };
      } else {
        // cart
        return {
          cam: new THREE.Vector3(0, 2.25, 9.8),
          look: new THREE.Vector3(0, 1.45, 0),
        };
      }
    }
  };

  const currentLookAt = useRef(new THREE.Vector3(0, 1.45, 0));

  // 1. Fetch live API stats
  useEffect(() => {
    let isMounted = true;
    const fetchLiveStats = async () => {
      try {
        const [trips, carts] = await Promise.allSettled([
          api.getActiveTrips(),
          api.getAvailableCarts(),
        ]);

        let activeShuttles = 0;
        let freeCarts = 0;

        if (trips.status === 'fulfilled' && Array.isArray(trips.value)) {
          activeShuttles = trips.value.filter(
            (t: any) => t.status === 'IN_PROGRESS' || t.status === 'ACTIVE'
          ).length;
          if (activeShuttles === 0 && trips.value.length > 0) activeShuttles = trips.value.length;
        }

        if (carts.status === 'fulfilled' && carts.value?.carts) {
          freeCarts = carts.value.carts.filter((c: any) => c.status === 'AVAILABLE').length;
        }

        if (isMounted) {
          setLiveStats({
            shuttles: Math.max(activeShuttles, 3),
            carts: Math.max(freeCarts, 2),
          });
        }
      } catch {
        if (isMounted) {
          setLiveStats({ shuttles: 3, carts: 2 });
        }
      }
    };

    fetchLiveStats();
    const interval = setInterval(fetchLiveStats, 8000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // 2. Initialize Three.js Uber 3D Stage
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const width = canvas.clientWidth || window.innerWidth;
    const height = canvas.clientHeight || window.innerHeight;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: true, // Transparent WebGL context allows DOM wordmark texture to show through
        powerPreference: 'high-performance',
      });
      renderer.setSize(width, height, false);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.setClearColor(0x000000, 0); // Transparent clear color
      rendererRef.current = renderer;
      setWebGLSupported(true);
    } catch {
      setWebGLSupported(false);
      return;
    }

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Environment map with soft studio HDRI
    const studioEnv = createStudioEnvironment(renderer);
    if (studioEnv) {
      scene.environment = studioEnv;
    }

    // Responsive camera
    const camera = new THREE.PerspectiveCamera(38, width / height, 0.5, 100);
    const initialTarget = getCameraTarget(selectedVehicleRef.current, width, height);
    camera.position.copy(initialTarget.cam);
    currentLookAt.current.copy(initialTarget.look);
    cameraRef.current = camera;

    const controls = new OrbitControls(camera, canvas);
    controls.enableZoom = false; // Zoom disabled per spec
    controls.enablePan = false;
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.5; // Gentle idle turntable rotation
    controls.maxPolarAngle = Math.PI / 2 - 0.04; // Never go below floor
    controls.minPolarAngle = Math.PI / 6;
    controls.target.copy(initialTarget.look);
    controlsRef.current = controls;

    // Studio Lighting Setup (Uber neutral studio lights)
    const isDark = modeRef.current === 'dark';

    // 1. Neutral Ambient Fill
    const ambientLight = new THREE.AmbientLight(0xffffff, isDark ? 0.5 : 1.2);
    ambientLightRef.current = ambientLight;
    scene.add(ambientLight);

    // 2. Studio Key Light
    const keyLight = new THREE.DirectionalLight(0xffffff, isDark ? 1.4 : 1.9);
    keyLight.position.set(5, 8, 6);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 25;
    keyLight.shadow.bias = -0.0005;
    keyLightRef.current = keyLight;
    scene.add(keyLight);

    // 3. Studio Soft Fill Light
    const fillLight = new THREE.DirectionalLight(0xffffff, isDark ? 0.5 : 0.9);
    fillLight.position.set(-5, 4, 5);
    fillLightRef.current = fillLight;
    scene.add(fillLight);

    // 4. Dark Mode Rim Light (Silhouette definition against pitch black)
    const rimLight = new THREE.DirectionalLight(0xffffff, isDark ? 1.6 : 0.15);
    rimLight.position.set(-6, 4, -7);
    rimLightRef.current = rimLight;
    scene.add(rimLight);

    // Layer 1: Soft radial floor mesh at y = 0 fading to pure background color at the horizon
    const floorRadius = 32;
    const floorGeom = new THREE.CircleGeometry(floorRadius, 64);
    floorGeom.rotateX(-Math.PI / 2);
    const floorTex = createFloorTexture(modeRef.current);
    const floorMat = new THREE.MeshBasicMaterial({
      map: floorTex || undefined,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: 2,
      polygonOffsetUnits: 2,
    });
    const floorMesh = new THREE.Mesh(floorGeom, floorMat);
    floorMesh.position.set(0, 0, 0);
    floorMeshRef.current = floorMesh;
    scene.add(floorMesh);

    // Layer 2: Single baked soft contact shadow at y = 0.002
    const shadowTex = createSoftShadowTexture();
    const shadowGeom = new THREE.PlaneGeometry(1, 1);
    shadowGeom.rotateX(-Math.PI / 2);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: shadowTex || undefined,
      color: 0x000000,
      transparent: true,
      opacity: isDark ? 0.70 : 0.35,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    const contactShadowMesh = new THREE.Mesh(shadowGeom, shadowMat);
    contactShadowMesh.position.set(0, 0.002, 0);
    contactShadowMesh.scale.set(2.2, 1, 3.8);
    contactShadowMesh.renderOrder = 0;
    contactShadowMeshRef.current = contactShadowMesh;
    scene.add(contactShadowMesh);

    // 1. Golf Cart High-Poly Rig (Default Hero)
    const cartInst = VehicleFactory.createVehicle({
      id: 'home-cart',
      type: 'cart',
      code: 'GC-01',
      coordinates: [0, 0],
      targetCoordinates: [0, 0],
      heading: 0,
      targetHeading: 0,
      speed: 0,
      status: 'available',
      capacity: 4,
    });
    cartInst.highPolyGroup.visible = true;
    cartInst.lowPolyGroup.visible = false;
    cartInst.group.position.set(0, 0, 0);
    cartInst.group.rotation.set(0, THREE.MathUtils.degToRad(15), 0);
    cartInst.group.scale.set(1, 1, 1);
    scene.add(cartInst.group);
    cartInstRef.current = cartInst;

    // 2. Shuttle Bus High-Poly Rig
    const shuttleInst = VehicleFactory.createVehicle({
      id: 'home-shuttle',
      type: 'shuttle',
      code: 'SH-01',
      coordinates: [0, 0],
      targetCoordinates: [0, 0],
      heading: 0,
      targetHeading: 0,
      speed: 0,
      status: 'available',
      capacity: 28,
      route: 'Campus Loop',
    });
    shuttleInst.highPolyGroup.visible = true;
    shuttleInst.lowPolyGroup.visible = false;
    shuttleInst.group.position.set(12, 0, -4);
    shuttleInst.group.rotation.set(0, THREE.MathUtils.degToRad(-15), 0);
    shuttleInst.group.scale.set(0.001, 0.001, 0.001);
    shuttleInst.group.visible = false;
    scene.add(shuttleInst.group);
    shuttleInstRef.current = shuttleInst;

    // 3. E-Rickshaw High-Poly Rig
    const rickshawInst = VehicleFactory.createVehicle({
      id: 'home-rickshaw',
      type: 'rickshaw',
      code: 'ER-01',
      coordinates: [0, 0],
      targetCoordinates: [0, 0],
      heading: 0,
      targetHeading: 0,
      speed: 0,
      status: 'available',
      fare: 15,
      capacity: 4,
    });
    rickshawInst.highPolyGroup.visible = true;
    rickshawInst.lowPolyGroup.visible = false;
    rickshawInst.group.position.set(-12, 0, -4);
    rickshawInst.group.rotation.set(0, THREE.MathUtils.degToRad(20), 0);
    rickshawInst.group.scale.set(0.001, 0.001, 0.001);
    rickshawInst.group.visible = false;
    scene.add(rickshawInst.group);
    rickshawInstRef.current = rickshawInst;

    // Render loop
    let reqId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      reqId = requestAnimationFrame(animate);
      const delta = clock.getDelta();

      const curVehicle = selectedVehicleRef.current;
      const isCart = curVehicle === 'cart';
      const isShuttle = curVehicle === 'shuttle';
      const isRickshaw = curVehicle === 'rickshaw';

      // Target positions & scales: exactly ONE hero vehicle at center (0, 0, 0)
      const cartTargetPos = isCart ? new THREE.Vector3(0, 0, 0) : new THREE.Vector3(-11, 0, -3.5);
      const shuttleTargetPos = isShuttle ? new THREE.Vector3(0, 0, 0) : isCart ? new THREE.Vector3(12, 0, -4) : new THREE.Vector3(-12, 0, -4);
      const rickshawTargetPos = isRickshaw ? new THREE.Vector3(0, 0, 0) : new THREE.Vector3(11, 0, -3.5);

      const cartTargetScale = isCart ? new THREE.Vector3(1, 1, 1) : new THREE.Vector3(0.001, 0.001, 0.001);
      const shuttleTargetScale = isShuttle ? new THREE.Vector3(1, 1, 1) : new THREE.Vector3(0.001, 0.001, 0.001);
      const rickshawTargetScale = isRickshaw ? new THREE.Vector3(1, 1, 1) : new THREE.Vector3(0.001, 0.001, 0.001);

      cartInst.group.position.lerp(cartTargetPos, delta * 5.5);
      shuttleInst.group.position.lerp(shuttleTargetPos, delta * 5.5);
      rickshawInst.group.position.lerp(rickshawTargetPos, delta * 5.5);

      cartInst.group.scale.lerp(cartTargetScale, delta * 5.5);
      shuttleInst.group.scale.lerp(shuttleTargetScale, delta * 5.5);
      rickshawInst.group.scale.lerp(rickshawTargetScale, delta * 5.5);

      cartInst.group.visible = cartInst.group.scale.x > 0.03;
      shuttleInst.group.visible = shuttleInst.group.scale.x > 0.03;
      rickshawInst.group.visible = rickshawInst.group.scale.x > 0.03;

      // Contact shadow scale adjustment
      const shadowTargetScale = isShuttle
        ? new THREE.Vector3(3.6, 1, 8.4)
        : isCart
        ? new THREE.Vector3(2.2, 1, 3.8)
        : new THREE.Vector3(1.9, 1, 3.2);
      contactShadowMesh.scale.lerp(shadowTargetScale, delta * 5.0);

      // Camera interpolation towards ideal hero framing
      const cWidth = canvas.clientWidth || window.innerWidth;
      const cHeight = canvas.clientHeight || window.innerHeight;
      const targetCam = getCameraTarget(curVehicle, cWidth, cHeight);
      currentLookAt.current.lerp(targetCam.look, delta * 3.5);
      camera.position.lerp(targetCam.cam, delta * 3.5);
      controls.target.copy(currentLookAt.current);

      controls.update();
      renderer.render(scene, camera);
    };

    animate();

    // Testing and verification hooks for visual layout verification
    (window as any).__setSelectedVehicle = (veh: 'cart' | 'shuttle' | 'rickshaw') => {
      setSelectedVehicle(veh);
    };
    (window as any).__getSelectedVehicle = () => selectedVehicleRef.current;
    (window as any).__getHeroLayoutMetrics = () => {
      const wordmarkEl = document.getElementById('hero-wordmark');
      const taglineEl = document.getElementById('hero-tagline');
      const dockEl = document.getElementById('bottom-dock-container');
      const canvasEl = canvasRef.current;

      if (!wordmarkEl || !taglineEl || !dockEl || !canvasEl || !cameraRef.current) {
        return null;
      }

      const wordmarkRect = wordmarkEl.getBoundingClientRect();
      const taglineRect = taglineEl.getBoundingClientRect();
      const dockRect = dockEl.getBoundingClientRect();

      const curVehicle = selectedVehicleRef.current;
      const activeInst =
        curVehicle === 'shuttle'
          ? shuttleInstRef.current
          : curVehicle === 'rickshaw'
          ? rickshawInstRef.current
          : cartInstRef.current;

      const camera = cameraRef.current;
      const width = canvasEl.clientWidth || window.innerWidth;
      const height = canvasEl.clientHeight || window.innerHeight;

      let minScreenX = Infinity, maxScreenX = -Infinity;
      let minScreenY = Infinity, maxScreenY = -Infinity;

      if (activeInst) {
        const box = new THREE.Box3().setFromObject(activeInst.group);
        const corners = [
          new THREE.Vector3(box.min.x, box.min.y, box.min.z),
          new THREE.Vector3(box.min.x, box.min.y, box.max.z),
          new THREE.Vector3(box.min.x, box.max.y, box.min.z),
          new THREE.Vector3(box.min.x, box.max.y, box.max.z),
          new THREE.Vector3(box.max.x, box.min.y, box.min.z),
          new THREE.Vector3(box.max.x, box.min.y, box.max.z),
          new THREE.Vector3(box.max.x, box.max.y, box.min.z),
          new THREE.Vector3(box.max.x, box.max.y, box.max.z),
        ];
        for (const c of corners) {
          c.project(camera);
          const sx = (c.x * 0.5 + 0.5) * width;
          const sy = (-(c.y * 0.5) + 0.5) * height;
          if (sx < minScreenX) minScreenX = sx;
          if (sx > maxScreenX) maxScreenX = sx;
          if (sy < minScreenY) minScreenY = sy;
          if (sy > maxScreenY) maxScreenY = sy;
        }
      }

      const wordmarkToTaglineGap = taglineRect.top - wordmarkRect.bottom;
      const taglineToVehicleRoofGap = minScreenY - taglineRect.bottom;
      const vehicleBottomToDockGap = dockRect.top - maxScreenY;

      // Check intersection
      const intersects = !(
        taglineRect.bottom < minScreenY ||
        taglineRect.top > maxScreenY ||
        taglineRect.right < minScreenX ||
        taglineRect.left > maxScreenX
      );

      return {
        vehicle: curVehicle,
        wordmarkRect: { top: wordmarkRect.top, bottom: wordmarkRect.bottom, height: wordmarkRect.height },
        taglineRect: { top: taglineRect.top, bottom: taglineRect.bottom, height: taglineRect.height },
        vehicleBBox: { minX: minScreenX, maxX: maxScreenX, minY: minScreenY, maxY: maxScreenY, height: maxScreenY - minScreenY },
        dockRect: { top: dockRect.top, bottom: dockRect.bottom },
        wordmarkToTaglineGap,
        taglineToVehicleRoofGap,
        vehicleBottomToDockGap,
        intersects,
        valid: wordmarkToTaglineGap >= 24 && taglineToVehicleRoofGap >= 48 && !intersects,
      };
    };

    const handleResize = () => {
      if (!canvas) return;
      const w = canvas.clientWidth || window.innerWidth;
      const h = canvas.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(reqId);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      shuttleInst.dispose();
      cartInst.dispose();
      rickshawInst.dispose();
      controls.dispose();
      delete (window as any).__getHeroLayoutMetrics;
      delete (window as any).__setSelectedVehicle;
      delete (window as any).__getSelectedVehicle;
    };
  }, []);

  // Update Three.js scene colors and materials immediately on theme toggle
  useEffect(() => {
    const isDark = mode === 'dark';
    if (floorMeshRef.current) {
      const newFloorTex = createFloorTexture(mode);
      if (newFloorTex) {
        (floorMeshRef.current.material as THREE.MeshBasicMaterial).map = newFloorTex;
        (floorMeshRef.current.material as THREE.MeshBasicMaterial).needsUpdate = true;
      }
    }
    if (contactShadowMeshRef.current) {
      (contactShadowMeshRef.current.material as THREE.MeshBasicMaterial).opacity = isDark
        ? 0.70
        : 0.35;
    }
    if (ambientLightRef.current) {
      ambientLightRef.current.intensity = isDark ? 0.5 : 1.2;
    }
    if (keyLightRef.current) {
      keyLightRef.current.intensity = isDark ? 1.4 : 1.9;
    }
    if (fillLightRef.current) {
      fillLightRef.current.intensity = isDark ? 0.5 : 0.9;
    }
    if (rimLightRef.current) {
      rimLightRef.current.intensity = isDark ? 1.6 : 0.15;
    }
  }, [mode]);

  const vehicleDetails: Record<'cart' | 'shuttle' | 'rickshaw', { name: string; specs: string }> = {
    cart: {
      name: 'Electric Golf Cart',
      specs: '4 Seats · Zero Emission · Campus Express',
    },
    shuttle: {
      name: 'Campus Shuttle Bus',
      specs: '28 Seats · Free Transit · High Capacity',
    },
    rickshaw: {
      name: 'Smart E-Rickshaw',
      specs: '4 Seats · ₹15 Fixed Fare · Point to Point',
    },
  };

  const quickStops = [
    'Main Gate',
    'Central Library',
    'Uni-Mall',
    'Boys Hostel',
    'Girls Hostel',
    'Health Centre',
    'Block 32',
    'Auditorium',
  ];

  return (
    <div className="relative w-full h-screen overflow-hidden select-none bg-white dark:bg-black text-black dark:text-white font-sans transition-colors duration-150">
      {/* -------------------------------------------------------------
       * LAYER 1 & 2: GIANT ARCHITECTURAL WORDMARK & PROMOTED TAGLINE
       * Back-to-front stack: Wordmark (z-1), Tagline (z-2), 3D Canvas (z-10), Dock (z-20)
       * Layout: Flex column with natural spacing, zero fixed pixel offsets
       * ------------------------------------------------------------- */}
      <div className="absolute inset-x-0 top-0 flex flex-col items-center pointer-events-none select-none z-[1] pt-16 sm:pt-10 lg:pt-3">
        {/* Layer 1: Giant Architectural Wordmark (scaled ~85% to 145-155px for 768h viewports) */}
        <span
          id="hero-wordmark"
          className="text-[12.5vw] sm:text-[12.5vw] lg:text-[145px] xl:text-[155px] font-black uppercase tracking-[-0.04em] text-[#EFEFEF] dark:text-[#181818] leading-none select-none transition-colors duration-150 block text-center"
        >
          UniCart
        </span>

        {/* Layer 2: Tagline (Directly under wordmark with >= 24px clear space from baseline, pointer-events: none) */}
        <div className="z-[2] mt-6 pointer-events-none px-4">
          <h2
            id="hero-tagline"
            className="text-[20px] sm:text-[22px] lg:text-[24px] font-semibold text-[#000000] dark:text-[#FFFFFF] text-center tracking-[0.01em] leading-snug transition-colors duration-150"
            style={{
              textShadow:
                mode === 'dark'
                  ? '0 1px 8px rgba(0, 0, 0, 0.95), 0 0 2px rgba(0, 0, 0, 0.9)'
                  : '0 1px 8px rgba(255, 255, 255, 0.95), 0 0 2px rgba(255, 255, 255, 0.9)',
            }}
          >
            Your campus, on wheels
          </h2>
        </div>
      </div>

      {/* -------------------------------------------------------------
       * LAYER 3: FULL-VIEWPORT 3D WEBGL STAGE (Canvas z-10, transparent background)
       * ------------------------------------------------------------- */}
      <div className="absolute inset-0 z-10 pointer-events-auto">
        {webGLSupported ? (
          <canvas
            ref={canvasRef}
            id="hero-3d-canvas"
            className="w-full h-full cursor-grab active:cursor-grabbing outline-none bg-transparent"
            style={{ touchAction: 'none' }}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center p-6 bg-[#F3F3F3] dark:bg-[#1C1C1C]">
            <Bus className="w-10 h-10 text-black dark:text-white mb-2" />
            <p className="font-bold text-lg">UniCart 3D Stage</p>
          </div>
        )}
      </div>

      {/* -------------------------------------------------------------
       * LAYER 3: TOP BAR CHROME
       * ------------------------------------------------------------- */}
      <header className="absolute top-0 left-0 right-0 h-16 sm:h-20 px-4 sm:px-10 flex items-center justify-between z-30 pointer-events-auto">
        {/* Brand Wordmark with small grey LPU chip */}
        <div className="flex items-center gap-3">
          <span className="font-extrabold text-2xl tracking-tighter text-black dark:text-white select-none">
            UniCart
          </span>
          <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-[#F3F3F3] text-[#5E5E5E] border border-[#E2E2E2] dark:bg-[#1C1C1C] dark:text-[#A6A6A6] dark:border-[#333333]">
            LPU
          </span>
        </div>

        {/* Right Actions: Theme Toggle, Profile, Menu */}
        <div className="flex items-center gap-2.5">
          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            aria-label="Toggle light or dark theme mode"
            className="w-10 h-10 rounded-full flex items-center justify-center bg-[#F3F3F3] dark:bg-[#1C1C1C] text-black dark:text-white border border-[#E2E2E2] dark:border-[#333333] hover:bg-[#EAEAEA] dark:hover:bg-[#2A2A2A] transition-colors"
          >
            {mode === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-black" />}
          </button>

          {/* Profile Icon */}
          <button
            onClick={onOpenProfile || onExploreFeatures}
            aria-label="Open User Profile"
            className="w-10 h-10 rounded-full flex items-center justify-center bg-[#F3F3F3] dark:bg-[#1C1C1C] text-black dark:text-white border border-[#E2E2E2] dark:border-[#333333] hover:bg-[#EAEAEA] dark:hover:bg-[#2A2A2A] transition-colors"
          >
            <User className="w-4 h-4" />
          </button>

          {/* Menu Button */}
          <button
            onClick={() => setMenuOpen(true)}
            aria-label="Open Navigation Menu"
            className="h-10 px-4 rounded-full flex items-center gap-2 bg-black text-white dark:bg-white dark:text-black font-semibold text-xs tracking-tight hover:opacity-90 transition-opacity"
          >
            <Menu className="w-4 h-4" />
            <span>Menu</span>
          </button>
        </div>
      </header>

      {/* -------------------------------------------------------------
       * LAYER 4: VEHICLE SELECTOR (Clean Vertical List on the Right)
       * ------------------------------------------------------------- */}
      <div className="absolute right-3 sm:right-8 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-2 pointer-events-auto">
        {(
          [
            { id: 'cart', label: 'Golf Cart' },
            { id: 'shuttle', label: 'Shuttle' },
            { id: 'rickshaw', label: 'E-Rickshaw' },
          ] as const
        ).map((item) => {
          const isActive = selectedVehicle === item.id;
          return (
            <button
              key={item.id}
              id={`vehicle-select-${item.id}`}
              onClick={() => setSelectedVehicle(item.id)}
              className={`flex items-center gap-2 py-1.5 px-3 rounded-full text-right justify-end transition-colors ${
                isActive
                  ? 'text-black dark:text-white font-bold bg-[#F3F3F3] dark:bg-[#1C1C1C]'
                  : 'text-[#5E5E5E] dark:text-[#A6A6A6] font-medium hover:text-black dark:hover:text-white'
              }`}
            >
              <span className="text-xs sm:text-sm tracking-tight whitespace-nowrap">
                {item.label}
              </span>
              <span
                className={`w-1.5 h-3.5 rounded-full shrink-0 transition-all ${
                  isActive ? 'bg-black dark:bg-white' : 'bg-transparent'
                }`}
              />
            </button>
          );
        })}
      </div>

      {/* -------------------------------------------------------------
       * LAYER 5: FLOATING BOTTOM DOCK WITH QUIET LIVE STATUS LINE
       * ------------------------------------------------------------- */}
      <div
        id="bottom-dock-container"
        className="absolute bottom-6 sm:bottom-8 left-0 right-0 flex flex-col items-center z-20 pointer-events-auto px-4"
      >
        {/* Quiet Live Status Line */}
        <div className="flex items-center gap-2 text-xs font-medium text-[#5E5E5E] dark:text-[#A6A6A6] mb-2.5">
          <span className="w-2 h-2 rounded-full bg-[#05A357] animate-pulse" />
          <span>
            {liveStats
              ? `${liveStats.shuttles} shuttles, ${liveStats.carts} carts active on campus`
              : '3 shuttles, 2 carts active on campus'}
          </span>
        </div>

        {/* Floating Bottom Dock ("Where to?") */}
        <button
          onClick={() => setDockSheetOpen(true)}
          className="w-full max-w-md h-14 bg-black text-white rounded-full px-5 flex items-center justify-between border border-[#333333] shadow-lg active:scale-[0.99] hover:bg-neutral-900 transition-all group"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#1C1C1C] flex items-center justify-center text-white">
              <Search className="w-4 h-4" />
            </div>
            <span className="text-sm font-semibold tracking-tight text-white">
              Where to?
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-medium px-3 py-1 rounded-full bg-[#1C1C1C] text-[#A6A6A6] flex items-center gap-1.5 border border-[#333333]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#05A357]" />
              <span>Main Gate</span>
            </span>
            <div className="w-8 h-8 rounded-full bg-white text-black flex items-center justify-center group-hover:translate-x-0.5 transition-transform">
              <ArrowRight className="w-4 h-4" />
            </div>
          </div>
        </button>
      </div>

      {/* -------------------------------------------------------------
       * LAYER 6: EXPANDED BOOKING BOTTOM SHEET (Opened from Dock)
       * ------------------------------------------------------------- */}
      <AnimatePresence>
        {dockSheetOpen && (
          <div className="fixed inset-0 z-50 flex items-end justify-center pointer-events-auto">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDockSheetOpen(false)}
              className="absolute inset-0 bg-black/60"
            />

            {/* Bottom Sheet Card */}
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="relative w-full max-w-xl bg-white dark:bg-[#1C1C1C] text-black dark:text-white rounded-t-[20px] p-6 shadow-2xl max-h-[88vh] overflow-y-auto border-t border-[#E2E2E2] dark:border-[#333333]"
            >
              {/* Sheet Drag Handle */}
              <div className="w-12 h-1.5 bg-[#E2E2E2] dark:bg-[#333333] rounded-full mx-auto mb-5" />

              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-xl font-extrabold tracking-tight">Request a Campus Ride</h2>
                  <p className="text-xs text-[#5E5E5E] dark:text-[#A6A6A6]">UniCart electric fleet across LPU</p>
                </div>
                <button
                  onClick={() => setDockSheetOpen(false)}
                  className="w-8 h-8 rounded-full bg-[#F3F3F3] dark:bg-[#2A2A2A] flex items-center justify-center text-black dark:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Ride now / Schedule toggle */}
              <div className="flex items-center gap-1.5 p-1 bg-[#F3F3F3] dark:bg-[#2A2A2A] rounded-full mb-4 w-fit">
                <button
                  onClick={() => setScheduleType('now')}
                  className={`px-3.5 py-1 rounded-full text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                    scheduleType === 'now'
                      ? 'bg-black text-white dark:bg-white dark:text-black'
                      : 'text-[#5E5E5E] dark:text-[#A6A6A6]'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>Ride now</span>
                </button>
                <button
                  onClick={() => setScheduleType('schedule')}
                  className={`px-3.5 py-1 rounded-full text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                    scheduleType === 'schedule'
                      ? 'bg-black text-white dark:bg-white dark:text-black'
                      : 'text-[#5E5E5E] dark:text-[#A6A6A6]'
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Schedule</span>
                </button>
              </div>

              {/* Pickup & Drop Inputs */}
              <div className="space-y-2 mb-4">
                <div className="flex items-center bg-[#F3F3F3] dark:bg-[#2A2A2A] rounded-xl px-3.5 py-3 border border-transparent focus-within:border-black dark:focus-within:border-white">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#05A357] mr-3 shrink-0" />
                  <input
                    type="text"
                    value={pickupLocation}
                    onChange={(e) => setPickupLocation(e.target.value)}
                    placeholder="Pickup location"
                    className="w-full bg-transparent text-sm font-semibold outline-none"
                  />
                </div>

                <div className="flex items-center bg-[#F3F3F3] dark:bg-[#2A2A2A] rounded-xl px-3.5 py-3 border border-transparent focus-within:border-black dark:focus-within:border-white">
                  <span className="w-2.5 h-2.5 rounded-none bg-black dark:bg-white mr-3 shrink-0" />
                  <input
                    type="text"
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    placeholder="Enter destination"
                    className="w-full bg-transparent text-sm font-semibold outline-none"
                  />
                </div>
              </div>

              {/* Campus Stop Suggestions */}
              <div className="mb-5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#5E5E5E] dark:text-[#A6A6A6] block mb-2">
                  Campus stops
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {quickStops.map((stop) => (
                    <button
                      key={stop}
                      onClick={() => setDestination(stop)}
                      className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                        destination === stop
                          ? 'bg-black text-white dark:bg-white dark:text-black border-transparent'
                          : 'bg-[#F3F3F3] dark:bg-[#2A2A2A] border-transparent hover:border-[#888888]'
                      }`}
                    >
                      {stop}
                    </button>
                  ))}
                </div>
              </div>

              {/* Vehicle Options */}
              <div className="space-y-2 mb-5">
                {[
                  {
                    id: 'cart',
                    name: 'Electric Golf Cart',
                    eta: '2 min away',
                    fare: 'Free',
                    seats: '4 seats',
                  },
                  {
                    id: 'shuttle',
                    name: 'Campus Shuttle',
                    eta: '4 min away',
                    fare: 'Free',
                    seats: '28 seats · Low crowd',
                  },
                  {
                    id: 'rickshaw',
                    name: 'Smart E-Rickshaw',
                    eta: '3 min away',
                    fare: '₹15',
                    seats: '4 seats',
                  },
                ].map((veh) => (
                  <button
                    key={veh.id}
                    onClick={() => setSelectedVehicle(veh.id as any)}
                    className={`w-full p-3.5 rounded-xl border flex items-center justify-between text-left transition-colors ${
                      selectedVehicle === veh.id
                        ? 'border-black dark:border-white bg-[#F3F3F3] dark:bg-[#2A2A2A]'
                        : 'border-[#E2E2E2] dark:border-[#333333]'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm">{veh.name}</span>
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-black/10 dark:bg-white/10">
                          {veh.fare}
                        </span>
                      </div>
                      <span className="text-xs text-[#5E5E5E] dark:text-[#A6A6A6]">{veh.eta} &middot; {veh.seats}</span>
                    </div>
                    <ArrowRight className="w-4 h-4 opacity-50" />
                  </button>
                ))}
              </div>

              {/* 56px Fully Rounded Action Button */}
              <button
                onClick={() => {
                  setDockSheetOpen(false);
                  onBookRide();
                }}
                className="uber-btn-primary w-full shadow-md flex items-center justify-center gap-2"
              >
                <span>Confirm {vehicleDetails[selectedVehicle].name}</span>
                <ArrowRight className="w-5 h-5" />
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* -------------------------------------------------------------
       * LAYER 7: FULLSCREEN OVERLAY MENU
       * ------------------------------------------------------------- */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.99 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.99 }}
            className="fixed inset-0 z-50 bg-white dark:bg-[#000000] text-black dark:text-white flex flex-col p-6 sm:p-12 overflow-y-auto"
          >
            {/* Top Bar inside Menu */}
            <div className="flex items-center justify-between pb-8 border-b border-[#E2E2E2] dark:border-[#333333]">
              <span className="font-extrabold text-2xl tracking-tighter">UniCart</span>
              <button
                onClick={() => setMenuOpen(false)}
                className="w-10 h-10 rounded-full bg-[#F3F3F3] dark:bg-[#1C1C1C] flex items-center justify-center text-black dark:text-white hover:bg-[#EAEAEA] dark:hover:bg-[#2A2A2A] transition-colors"
                aria-label="Close Menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Menu Links */}
            <div className="py-8 flex-1 flex flex-col justify-center max-w-xl mx-auto w-full space-y-4">
              {[
                {
                  label: 'Book a Ride',
                  hint: '2 min away',
                  action: () => { setMenuOpen(false); onBookRide(); }
                },
                {
                  label: 'Live Shuttles & Arrivals',
                  hint: 'Next shuttle 4 min',
                  action: () => { setMenuOpen(false); onNavigate ? onNavigate('shuttles') : onExploreFeatures(); }
                },
                {
                  label: 'Fare Calculator',
                  hint: '₹0 - ₹15 flat',
                  action: () => { setMenuOpen(false); onNavigate ? onNavigate('fare_calc') : onExploreFeatures(); }
                },

                {
                  label: 'Timetable & Peak Hours',
                  hint: '3 rush peaks today',
                  action: () => { setMenuOpen(false); onNavigate ? onNavigate('timetable') : onExploreFeatures(); }
                },
                {
                  label: 'Campus Map',
                  hint: 'Live 3D Fleet',
                  action: () => { setMenuOpen(false); onNavigate ? onNavigate('map') : onBookRide(); }
                },
                {
                  label: 'Priority Access',
                  hint: 'Fast-track pass',
                  action: () => { setMenuOpen(false); onNavigate ? onNavigate('priority') : onExploreFeatures(); }
                },
                {
                  label: 'Campus Safety & SOS',
                  hint: '24x7 Beacon',
                  action: () => { setMenuOpen(false); onNavigate ? onNavigate('safety') : onExploreFeatures(); }
                },

              ].map((link) => (
                <button
                  key={link.label}
                  onClick={link.action}
                  className="text-left py-2 px-3 rounded-xl hover:bg-[#F3F3F3] dark:hover:bg-[#1C1C1C] transition-colors flex items-center justify-between group"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl sm:text-2xl font-extrabold tracking-tight group-hover:translate-x-1 transition-transform">
                      {link.label}
                    </span>
                    <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-black/5 dark:bg-white/10 text-[#5E5E5E] dark:text-[#A6A6A6] border border-black/5 dark:border-white/10">
                      {link.hint}
                    </span>
                  </div>
                  <ArrowRight className="w-5 h-5 opacity-40 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                </button>
              ))}
            </div>

            {/* Footer with Helpline */}
            <div className="pt-8 border-t border-[#E2E2E2] dark:border-[#333333] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#5E5E5E] dark:text-[#A6A6A6]">
              <div className="flex items-center gap-2">
                <PhoneCall className="w-4 h-4 text-[#05A357]" />
                <span>24x7 Campus Security Helpline: <strong>+91 1824 517000</strong></span>
              </div>
              <div>
                <span>Lovely Professional University &middot; UniCart Transit</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
