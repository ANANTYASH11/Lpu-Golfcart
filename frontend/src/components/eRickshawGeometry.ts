import * as THREE from 'three';

export type RickshawColorScheme = 'classic' | 'lpu';

export interface ERickshawModelOptions {
  colorScheme?: RickshawColorScheme;
  seatsFree?: 0 | 1 | 2 | 3 | 4;
  fare?: number;
  lowPower?: boolean;
}

export interface ERickshawRig {
  root: THREE.Group;
  bodyGroup: THREE.Group;
  handlebarSteerGroup: THREE.Group;
  frontWheelGroup: THREE.Group;
  rearLeftWheelGroup: THREE.Group;
  rearRightWheelGroup: THREE.Group;
  roofGroup: THREE.Group;
  seatsGroup: THREE.Group;
  passengerGroup: THREE.Group;
  lightsGroup: THREE.Group;

  headlightMaterial: THREE.MeshStandardMaterial;
  brakeLightsMaterial: THREE.MeshStandardMaterial;
  indicatorsMaterial: THREE.MeshStandardMaterial;
  bodyPaintMaterial: THREE.MeshPhysicalMaterial | THREE.MeshStandardMaterial;
  accentMaterial: THREE.MeshStandardMaterial;

  statusRingMesh: THREE.Mesh;
  statusRingMaterial: THREE.MeshBasicMaterial;

  updateSeatsFree: (seatsFree: number) => void;
  updateFareTag?: (fare: number) => void;
  dispose: () => void;
}

// Generate canvas texture for Roof LED display sign
export function createRickshawRoofTexture(): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.fillStyle = '#05070a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 4;
  ctx.strokeRect(6, 6, canvas.width - 12, canvas.height - 12);

  ctx.fillStyle = '#fb923c';
  ctx.font = 'bold 32px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('LPU CAMPUS E-AUTO', canvas.width / 2, 45);

  ctx.fillStyle = '#fef08a';
  ctx.font = '900 48px sans-serif';
  ctx.fillText('ECO TRANSIT', canvas.width / 2, 100);

  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
}

// Generate Fare Placard texture hanging inside canopy
export function createFarePlacardTexture(fare: number = 15): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = '#0284c7';
  ctx.lineWidth = 4;
  ctx.strokeRect(4, 4, canvas.width - 8, canvas.height - 8);

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 20px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('FIXED CAMPUS FARE', canvas.width / 2, 35);

  ctx.fillStyle = '#16a34a';
  ctx.font = '900 46px sans-serif';
  ctx.fillText(`₹${fare}`, canvas.width / 2, 85);

  ctx.fillStyle = '#64748b';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText('PER PASSENGER', canvas.width / 2, 112);

  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
}

/**
 * Procedural Indian 3-Wheeler Electric Rickshaw (E-Rickshaw / Auto)
 * Real-world dimensions: 2.6m Long, 1.1m Wide, 1.75m Tall
 * Triangle budget: ~5.5k - 8k Triangles (< 12k budget limit)
 */
export function createERickshawModel(options: ERickshawModelOptions = {}): ERickshawRig {
  const { colorScheme = 'classic', seatsFree = 2, fare = 15, lowPower = false } = options;

  const root = new THREE.Group();
  root.name = 'ERickshawRoot';

  // Palette definitions:
  // Classic: Indian auto green lower body with bright yellow canopy/cowl
  // LPU: White body with vibrant university orange stripe & roof accent
  // Uber: Crisp white body with thin black stripe and black canopy
  const isUber = colorScheme === 'uber';
  const bodyColor = isUber ? 0xffffff : colorScheme === 'classic' ? 0x16a34a : 0xf8fafc;
  const accentColor = isUber ? 0x111111 : colorScheme === 'classic' ? 0xfacc15 : 0xea580c;

  // Materials Library
  const bodyPaintMaterial = lowPower
    ? new THREE.MeshStandardMaterial({
        color: bodyColor,
        roughness: 0.3,
        metalness: 0.1,
      })
    : new THREE.MeshPhysicalMaterial({
        color: bodyColor,
        roughness: 0.18,
        metalness: 0.08,
        clearcoat: 0.9,
        clearcoatRoughness: 0.12,
      });

  const accentMaterial = new THREE.MeshStandardMaterial({
    color: accentColor,
    roughness: 0.28,
    metalness: 0.15,
  });

  const darkChassisMaterial = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.7,
    metalness: 0.3,
  });

  const chromeMaterial = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    roughness: 0.15,
    metalness: 0.9,
  });

  const tyreMaterial = new THREE.MeshStandardMaterial({
    color: 0x18181b,
    roughness: 0.85,
    metalness: 0.05,
  });

  const rimMaterial = new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    roughness: 0.3,
    metalness: 0.8,
  });

  const glassMaterial = lowPower
    ? new THREE.MeshStandardMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.25,
        roughness: 0.08,
        depthWrite: false,
      })
    : new THREE.MeshPhysicalMaterial({
        color: 0xffffff, // Pure neutral clear glass (no cyan tint)
        transparent: true,
        opacity: 0.25,
        roughness: 0.04,
        transmission: 0.85,
        ior: 1.45,
        depthWrite: false,
      });

  const vinylSeatMaterial = new THREE.MeshStandardMaterial({
    color: 0x141416, // Black seats
    roughness: 0.65,
  });

  const passengerSilhouetteMat = new THREE.MeshStandardMaterial({
    color: 0x18181b,
    roughness: 0.6,
  });

  // Lights Materials
  const headlightMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xffffff,
    emissiveIntensity: 2.5,
    roughness: 0.1,
  });

  const brakeLightsMaterial = new THREE.MeshStandardMaterial({
    color: 0xef4444,
    emissive: 0xdc2626,
    emissiveIntensity: 0.8,
    roughness: 0.2,
  });

  const indicatorsMaterial = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    emissive: 0xd97706,
    emissiveIntensity: 0.3,
    roughness: 0.2,
  });

  // Status Ring on Ground (y = 0.004) - thin subtle ring with polygonOffset
  const statusRingMaterial = new THREE.MeshBasicMaterial({
    color: 0x05A357, // Uber success green status ring
    transparent: true,
    opacity: 0.10, // 10 percent opacity per spec
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
    side: THREE.DoubleSide,
  });

  const ringGeom = new THREE.RingGeometry(1.2, 1.26, 48);
  ringGeom.rotateX(-Math.PI / 2);
  const statusRingMesh = new THREE.Mesh(ringGeom, statusRingMaterial);
  statusRingMesh.position.set(0, 0.004, 0);
  statusRingMesh.renderOrder = 1;
  statusRingMesh.name = 'StatusRing';
  root.add(statusRingMesh);

  // Soft Ground Shadow (y = 0.002)
  const shadowGeom = new THREE.PlaneGeometry(1.4, 2.9);
  shadowGeom.rotateX(-Math.PI / 2);
  const shadowMesh = new THREE.Mesh(
    shadowGeom,
    new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
    })
  );
  shadowMesh.position.set(0, 0.002, 0);
  shadowMesh.renderOrder = 0;
  root.add(shadowMesh);

  // Hierarchy Groups
  const bodyGroup = new THREE.Group();
  bodyGroup.name = 'Body';
  root.add(bodyGroup);

  const roofGroup = new THREE.Group();
  roofGroup.name = 'Roof';
  bodyGroup.add(roofGroup);

  const seatsGroup = new THREE.Group();
  seatsGroup.name = 'Seats';
  bodyGroup.add(seatsGroup);

  const passengerGroup = new THREE.Group();
  passengerGroup.name = 'Passengers';
  bodyGroup.add(passengerGroup);

  const lightsGroup = new THREE.Group();
  lightsGroup.name = 'Lights';
  bodyGroup.add(lightsGroup);

  /* -------------------------------------------------------------
   * 1. CHASSIS FRAME & LOWER PLATFORM
   * ------------------------------------------------------------- */
  // Main Tubular Chassis Rails
  const chassisGeom = new THREE.BoxGeometry(0.85, 0.08, 2.3);
  const chassis = new THREE.Mesh(chassisGeom, darkChassisMaterial);
  chassis.position.set(0, 0.24, -0.1);
  chassis.castShadow = !lowPower;
  bodyGroup.add(chassis);

  // Diamond-plate passenger floor deck
  const floorGeom = new THREE.BoxGeometry(0.96, 0.04, 1.6);
  const floor = new THREE.Mesh(floorGeom, darkChassisMaterial);
  floor.position.set(0, 0.28, -0.45);
  bodyGroup.add(floor);

  // Driver floorboard / footrest
  const driverFloorGeom = new THREE.BoxGeometry(0.72, 0.04, 0.65);
  const driverFloor = new THREE.Mesh(driverFloorGeom, darkChassisMaterial);
  driverFloor.position.set(0, 0.28, 0.58);
  bodyGroup.add(driverFloor);

  // Front Subframe Backbone rising to Steering Head Tube
  const backboneGeom = new THREE.CylinderGeometry(0.04, 0.04, 0.72, 8);
  backboneGeom.rotateX(0.42);
  const backbone = new THREE.Mesh(backboneGeom, darkChassisMaterial);
  backbone.position.set(0, 0.52, 0.78);
  bodyGroup.add(backbone);

  // Steering Head Tube
  const headTubeGeom = new THREE.CylinderGeometry(0.045, 0.045, 0.32, 10);
  headTubeGeom.rotateX(0.32);
  const headTube = new THREE.Mesh(headTubeGeom, darkChassisMaterial);
  headTube.position.set(0, 0.75, 0.88);
  bodyGroup.add(headTube);

  /* -------------------------------------------------------------
   * 2. FRONT APRON, WINDSHIELD & CABIN COWL
   * ------------------------------------------------------------- */
  // Curved Lower Apron / Front Cowl
  const frontApronGeom = new THREE.CylinderGeometry(0.46, 0.46, 0.65, 16, 1, false, -Math.PI / 2, Math.PI);
  frontApronGeom.rotateY(-Math.PI / 2);
  const frontApron = new THREE.Mesh(frontApronGeom, bodyPaintMaterial);
  frontApron.position.set(0, 0.60, 0.92);
  frontApron.scale.set(1.0, 1.0, 0.65);
  frontApron.castShadow = !lowPower;
  bodyGroup.add(frontApron);

  // Front Apron Trim Accent Band
  const apronAccentGeom = new THREE.CylinderGeometry(0.47, 0.47, 0.12, 16, 1, false, -Math.PI / 2, Math.PI);
  apronAccentGeom.rotateY(-Math.PI / 2);
  const apronAccent = new THREE.Mesh(apronAccentGeom, accentMaterial);
  apronAccent.position.set(0, 0.65, 0.92);
  apronAccent.scale.set(1.0, 1.0, 0.65);
  bodyGroup.add(apronAccent);

  // Curved Safety Glass Windshield
  const windshieldGeom = new THREE.CylinderGeometry(0.46, 0.46, 0.55, 16, 1, false, -Math.PI / 2, Math.PI);
  windshieldGeom.rotateY(-Math.PI / 2);
  const windshield = new THREE.Mesh(windshieldGeom, glassMaterial);
  windshield.position.set(0, 1.15, 0.78);
  windshield.scale.set(1.0, 1.0, 0.65);
  windshield.renderOrder = 10;
  bodyGroup.add(windshield);

  // Windshield Frame Post Supports
  [-0.44, 0.44].forEach((px) => {
    const postGeom = new THREE.CylinderGeometry(0.016, 0.016, 0.65, 8);
    postGeom.rotateX(0.24);
    const post = new THREE.Mesh(postGeom, chromeMaterial);
    post.position.set(px, 1.15, 0.76);
    bodyGroup.add(post);

    // Rearview Mirrors
    const stalkGeom = new THREE.CylinderGeometry(0.008, 0.008, 0.16, 6);
    stalkGeom.rotateZ(px > 0 ? -0.5 : 0.5);
    const stalk = new THREE.Mesh(stalkGeom, darkChassisMaterial);
    stalk.position.set(px * 1.08, 1.12, 0.74);
    bodyGroup.add(stalk);

    const mirrorHead = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.02), darkChassisMaterial);
    mirrorHead.position.set(px * 1.15, 1.16, 0.74);
    bodyGroup.add(mirrorHead);
  });

  // Windshield Wiper Blade
  const wiperBaseGeom = new THREE.CylinderGeometry(0.012, 0.012, 0.06, 6);
  const wiperBase = new THREE.Mesh(wiperBaseGeom, darkChassisMaterial);
  wiperBase.position.set(0, 0.90, 0.98);
  wiperBase.rotation.x = 0.4;
  bodyGroup.add(wiperBase);

  const wiperArm = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.32, 0.01), darkChassisMaterial);
  wiperArm.position.set(0.08, 1.05, 0.92);
  wiperArm.rotation.z = -0.4;
  wiperArm.rotation.x = 0.25;
  bodyGroup.add(wiperArm);

  /* -------------------------------------------------------------
   * 3. HANDLEBAR & FRONT STEERING FORK ASSEMBLY (Animatable)
   * ------------------------------------------------------------- */
  // Handlebar Steer Group: rotates on Y axis according to steer prop
  const handlebarSteerGroup = new THREE.Group();
  handlebarSteerGroup.name = 'Handlebar';
  handlebarSteerGroup.position.set(0, 0.78, 0.88);
  bodyGroup.add(handlebarSteerGroup);

  // Steering Triple Tree Clamp
  const clampGeom = new THREE.BoxGeometry(0.28, 0.04, 0.08);
  const clamp = new THREE.Mesh(clampGeom, chromeMaterial);
  clamp.position.set(0, 0.08, 0);
  handlebarSteerGroup.add(clamp);

  // Chrome Handlebar
  const barCenter = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.68, 12), chromeMaterial);
  barCenter.rotation.z = Math.PI / 2;
  barCenter.position.set(0, 0.18, -0.06);
  handlebarSteerGroup.add(barCenter);

  // Rubber Handgrips & Brake Levers
  [-0.30, 0.30].forEach((gx) => {
    const gripGeom = new THREE.CylinderGeometry(0.018, 0.018, 0.11, 8);
    gripGeom.rotateZ(Math.PI / 2);
    const grip = new THREE.Mesh(gripGeom, darkChassisMaterial);
    grip.position.set(gx, 0.18, -0.06);
    handlebarSteerGroup.add(grip);

    const leverGeom = new THREE.BoxGeometry(0.10, 0.01, 0.02);
    const lever = new THREE.Mesh(leverGeom, chromeMaterial);
    lever.position.set(gx, 0.17, -0.09);
    handlebarSteerGroup.add(lever);
  });

  // Dashboard / Digital Battery Gauge
  const dashGeom = new THREE.BoxGeometry(0.18, 0.08, 0.12);
  const dash = new THREE.Mesh(dashGeom, darkChassisMaterial);
  dash.position.set(0, 0.14, -0.02);
  dash.rotation.x = -0.4;
  handlebarSteerGroup.add(dash);

  const meterScreenGeom = new THREE.PlaneGeometry(0.12, 0.05);
  const meterScreenMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
  const meterScreen = new THREE.Mesh(meterScreenGeom, meterScreenMat);
  meterScreen.position.set(0, 0.165, -0.02);
  meterScreen.rotation.x = -0.4;
  handlebarSteerGroup.add(meterScreen);

  // Dual Telescopic Front Suspension Forks
  const forkLegGeom = new THREE.CylinderGeometry(0.022, 0.022, 0.65, 10);
  [-0.10, 0.10].forEach((fx) => {
    const forkUpper = new THREE.Mesh(forkLegGeom, chromeMaterial);
    forkUpper.position.set(fx, -0.28, 0.04);
    forkUpper.rotation.x = -0.22;
    handlebarSteerGroup.add(forkUpper);
  });

  // Front Curved Mudguard
  const mudguardGeom = new THREE.CylinderGeometry(0.26, 0.26, 0.12, 16, 1, false, 0, Math.PI);
  mudguardGeom.rotateZ(Math.PI / 2);
  mudguardGeom.rotateY(-Math.PI / 2);
  const mudguard = new THREE.Mesh(mudguardGeom, bodyPaintMaterial);
  mudguard.position.set(0, -0.42, 0.08);
  mudguard.rotation.x = -0.22;
  handlebarSteerGroup.add(mudguard);

  // Front Wheel Group (child of handlebar group so it steers in sync!)
  const frontWheelGroup = new THREE.Group();
  frontWheelGroup.name = 'FrontWheel';
  frontWheelGroup.position.set(0, -0.56, 0.07);
  handlebarSteerGroup.add(frontWheelGroup);

  // Function to create realistic e-rickshaw wheel (12-inch rim + ribbed tyre)
  function createRickshawWheel(): THREE.Group {
    const wGroup = new THREE.Group();
    const tyreRadius = 0.22;
    const tyreWidth = 0.08;

    // Black Rubber Tyre
    const tGeom = new THREE.CylinderGeometry(tyreRadius, tyreRadius, tyreWidth, 18);
    tGeom.rotateZ(Math.PI / 2);
    const tyre = new THREE.Mesh(tGeom, tyreMaterial);
    tyre.castShadow = !lowPower;
    wGroup.add(tyre);

    // Silver Alloy / Spoke Rim
    const rGeom = new THREE.CylinderGeometry(0.14, 0.14, tyreWidth + 0.005, 16);
    rGeom.rotateZ(Math.PI / 2);
    const rim = new THREE.Mesh(rGeom, rimMaterial);
    wGroup.add(rim);

    // Center Hub & Axle Nut
    const hGeom = new THREE.CylinderGeometry(0.05, 0.05, tyreWidth + 0.02, 10);
    hGeom.rotateZ(Math.PI / 2);
    const hub = new THREE.Mesh(hGeom, darkChassisMaterial);
    wGroup.add(hub);

    // Drum Brake Hub
    const bGeom = new THREE.CylinderGeometry(0.10, 0.10, 0.03, 12);
    bGeom.rotateZ(Math.PI / 2);
    const drum = new THREE.Mesh(bGeom, darkChassisMaterial);
    drum.position.set(-0.025, 0, 0);
    wGroup.add(drum);

    return wGroup;
  }

  const frontWheelMesh = createRickshawWheel();
  frontWheelGroup.add(frontWheelMesh);

  /* -------------------------------------------------------------
   * 4. REAR AXLE & REAR WHEELS
   * ------------------------------------------------------------- */
  const rearAxleGeom = new THREE.CylinderGeometry(0.03, 0.03, 0.94, 8);
  rearAxleGeom.rotateZ(Math.PI / 2);
  const rearAxle = new THREE.Mesh(rearAxleGeom, darkChassisMaterial);
  rearAxle.position.set(0, 0.22, -0.75);
  bodyGroup.add(rearAxle);

  // Electric Motor Differential Gearbox (mid-axle)
  const motorGeom = new THREE.CylinderGeometry(0.08, 0.08, 0.24, 12);
  motorGeom.rotateX(Math.PI / 2);
  const motor = new THREE.Mesh(motorGeom, darkChassisMaterial);
  motor.position.set(0, 0.22, -0.75);
  bodyGroup.add(motor);

  // Rear Left Wheel Group
  const rearLeftWheelGroup = new THREE.Group();
  rearLeftWheelGroup.name = 'RearLeftWheel';
  rearLeftWheelGroup.position.set(-0.48, 0.22, -0.75);
  bodyGroup.add(rearLeftWheelGroup);
  const rearLeftWheelMesh = createRickshawWheel();
  rearLeftWheelGroup.add(rearLeftWheelMesh);

  // Rear Right Wheel Group
  const rearRightWheelGroup = new THREE.Group();
  rearRightWheelGroup.name = 'RearRightWheel';
  rearRightWheelGroup.position.set(0.48, 0.22, -0.75);
  bodyGroup.add(rearRightWheelGroup);
  const rearRightWheelMesh = createRickshawWheel();
  rearRightWheelGroup.add(rearRightWheelMesh);

  // Rear Wheel Mudguard Fenders
  [-0.48, 0.48].forEach((fx) => {
    const rearMudguardGeom = new THREE.CylinderGeometry(0.26, 0.26, 0.12, 16, 1, false, 0, Math.PI);
    rearMudguardGeom.rotateZ(Math.PI / 2);
    rearMudguardGeom.rotateY(-Math.PI / 2);
    const rMudguard = new THREE.Mesh(rearMudguardGeom, bodyPaintMaterial);
    rMudguard.position.set(fx, 0.26, -0.75);
    bodyGroup.add(rMudguard);
  });

  /* -------------------------------------------------------------
   * 5. DRIVER & PASSENGER SEATING (2 Facing Benches, 4 Seats)
   * ------------------------------------------------------------- */
  // Driver Seat Base & Cushion
  const driverSeatBase = new THREE.Mesh(new THREE.BoxGeometry(0.50, 0.32, 0.42), darkChassisMaterial);
  driverSeatBase.position.set(0, 0.46, 0.22);
  seatsGroup.add(driverSeatBase);

  const driverCushion = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.10, 0.40), vinylSeatMaterial);
  driverCushion.position.set(0, 0.66, 0.22);
  seatsGroup.add(driverCushion);

  const driverBackrest = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.32, 0.08), vinylSeatMaterial);
  driverBackrest.position.set(0, 0.88, 0.04);
  seatsGroup.add(driverBackrest);

  // Battery Box Compartment (under rear passenger bench)
  const batteryBox = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.26, 0.72), darkChassisMaterial);
  batteryBox.position.set(0, 0.42, -0.55);
  bodyGroup.add(batteryBox);

  // High Voltage Warning Emblem on Battery Box
  const hvBadgeGeom = new THREE.PlaneGeometry(0.14, 0.08);
  const hvBadgeMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
  const hvBadge = new THREE.Mesh(hvBadgeGeom, hvBadgeMat);
  hvBadge.position.set(0, 0.42, -0.92);
  hvBadge.rotation.y = Math.PI;
  bodyGroup.add(hvBadge);

  // Passenger Bench 1 (Rearward facing: z = -0.25, faces forward toward driver)
  const bench1Cushion = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.10, 0.38), vinylSeatMaterial);
  bench1Cushion.position.set(0, 0.60, -0.28);
  seatsGroup.add(bench1Cushion);

  const bench1Backrest = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.35, 0.08), vinylSeatMaterial);
  bench1Backrest.position.set(0, 0.84, -0.10);
  seatsGroup.add(bench1Backrest);

  // Passenger Bench 2 (Forward facing: z = -0.82, faces toward front)
  const bench2Cushion = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.10, 0.38), vinylSeatMaterial);
  bench2Cushion.position.set(0, 0.60, -0.80);
  seatsGroup.add(bench2Cushion);

  const bench2Backrest = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.35, 0.08), vinylSeatMaterial);
  bench2Backrest.position.set(0, 0.84, -0.98);
  seatsGroup.add(bench2Backrest);

  // Stainless Steel Safety Armrests & Side Grab Bars
  [-0.48, 0.48].forEach((sx) => {
    const armrestGeom = new THREE.CylinderGeometry(0.014, 0.014, 0.95, 8);
    armrestGeom.rotateX(Math.PI / 2);
    const armrest = new THREE.Mesh(armrestGeom, chromeMaterial);
    armrest.position.set(sx, 0.74, -0.55);
    seatsGroup.add(armrest);

    // Vertical support posts
    [-0.95, -0.55, -0.15].forEach((pz) => {
      const vPost = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.44, 8), chromeMaterial);
      vPost.position.set(sx, 0.52, pz);
      seatsGroup.add(vPost);
    });
  });

  // Rear Boarding Step (centered at rear, y = 0.22, z = -1.32)
  const stepGeom = new THREE.BoxGeometry(0.65, 0.04, 0.24);
  const stepMesh = new THREE.Mesh(stepGeom, darkChassisMaterial);
  stepMesh.position.set(0, 0.22, -1.30);
  bodyGroup.add(stepMesh);

  // Step Tread Grip Plate (Yellow safety warning border)
  const stepTreadGeom = new THREE.BoxGeometry(0.63, 0.01, 0.04);
  const stepTread = new THREE.Mesh(stepTreadGeom, accentMaterial);
  stepTread.position.set(0, 0.245, -1.41);
  bodyGroup.add(stepTread);

  // Helper to create a stylized passenger figure sitting on bench
  function createPassengerFigure(isForwardFacing: boolean): THREE.Group {
    const p = new THREE.Group();
    // Torso / Jacket
    const torsoGeom = new THREE.BoxGeometry(0.28, 0.38, 0.22);
    const torso = new THREE.Mesh(torsoGeom, passengerSilhouetteMat);
    torso.position.set(0, 0.85, 0);
    p.add(torso);

    // Head
    const headGeom = new THREE.SphereGeometry(0.09, 10, 10);
    const head = new THREE.Mesh(headGeom, passengerSilhouetteMat);
    head.position.set(0, 1.10, 0);
    p.add(head);

    // Legs bent sitting
    const legsGeom = new THREE.BoxGeometry(0.24, 0.12, 0.30);
    const legs = new THREE.Mesh(legsGeom, darkChassisMaterial);
    legs.position.set(0, 0.65, isForwardFacing ? 0.15 : -0.15);
    p.add(legs);

    return p;
  }

  // 4 Passenger seat slots:
  // Slot 0: Bench 2 (Forward-facing, Left): x = -0.24, z = -0.80
  // Slot 1: Bench 2 (Forward-facing, Right): x = +0.24, z = -0.80
  // Slot 2: Bench 1 (Rearward-facing, Left): x = -0.24, z = -0.28
  // Slot 3: Bench 1 (Rearward-facing, Right): x = +0.24, z = -0.28
  const passengerPositions = [
    { x: -0.24, z: -0.80, forward: true },
    { x: 0.24, z: -0.80, forward: true },
    { x: -0.24, z: -0.28, forward: false },
    { x: 0.24, z: -0.28, forward: false },
  ];

  const passengerMeshes: THREE.Group[] = [];
  passengerPositions.forEach((pos) => {
    const fig = createPassengerFigure(pos.forward);
    fig.position.set(pos.x, 0, pos.z);
    passengerGroup.add(fig);
    passengerMeshes.push(fig);
  });

  // Function to show/hide passenger figures based on seatsFree (0..4 free)
  // occupiedCount = 4 - seatsFree
  const updateSeatsFree = (freeCount: number) => {
    const occupiedCount = Math.max(0, Math.min(4, 4 - freeCount));
    passengerMeshes.forEach((mesh, index) => {
      mesh.visible = index < occupiedCount;
    });
  };

  updateSeatsFree(seatsFree);

  /* -------------------------------------------------------------
   * 6. ROOF CANOPY & ROOF DETAILS
   * ------------------------------------------------------------- */
  // 4 Slim Side Roof Pillars (A & C pillars)
  const pillarGeom = new THREE.CylinderGeometry(0.016, 0.016, 1.25, 8);
  [
    { x: -0.48, z: 0.35 },
    { x: 0.48, z: 0.35 },
    { x: -0.48, z: -1.22 },
    { x: 0.48, z: -1.22 },
  ].forEach((pos) => {
    const pillar = new THREE.Mesh(pillarGeom, chromeMaterial);
    pillar.position.set(pos.x, 1.15, pos.z);
    roofGroup.add(pillar);
  });

  // Curved Roof Canopy Shell
  const canopyGeom = new THREE.BoxGeometry(1.08, 0.08, 2.05);
  const canopy = new THREE.Mesh(canopyGeom, accentMaterial);
  canopy.position.set(0, 1.70, -0.32);
  canopy.castShadow = !lowPower;
  roofGroup.add(canopy);

  // Aerodynamic Domed Roof Top
  const domeGeom = new THREE.CylinderGeometry(0.52, 0.54, 1.95, 14, 1, false, 0, Math.PI);
  domeGeom.rotateZ(-Math.PI / 2);
  domeGeom.rotateY(-Math.PI / 2);
  const dome = new THREE.Mesh(domeGeom, accentMaterial);
  dome.position.set(0, 1.74, -0.32);
  dome.scale.set(1.0, 0.22, 1.0);
  roofGroup.add(dome);

  // Rear Fabric Roll-up Flap Curtain
  const curtainGeom = new THREE.BoxGeometry(0.96, 0.55, 0.03);
  const curtainMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.95,
  });
  const curtain = new THREE.Mesh(curtainGeom, curtainMat);
  curtain.position.set(0, 1.40, -1.24);
  roofGroup.add(curtain);

  // Roof-mounted Small LED Sign ("LPU CAMPUS E-AUTO")
  const signGeom = new THREE.BoxGeometry(0.68, 0.16, 0.12);
  const signBox = new THREE.Mesh(signGeom, darkChassisMaterial);
  signBox.position.set(0, 1.84, 0.45);
  roofGroup.add(signBox);

  const roofTex = createRickshawRoofTexture();
  const signScreenMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    emissive: 0xf59e0b,
    emissiveIntensity: 1.8,
    map: roofTex || undefined,
    emissiveMap: roofTex || undefined,
  });
  const signScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.64, 0.14), signScreenMat);
  signScreen.position.set(0, 1.84, 0.52);
  roofGroup.add(signScreen);

  // Interior Fare Card Placard (hanging inside canopy)
  const fareTex = createFarePlacardTexture(fare);
  const farePlacardMat = new THREE.MeshBasicMaterial({
    map: fareTex || undefined,
    side: THREE.DoubleSide,
  });
  const farePlacard = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.12), farePlacardMat);
  farePlacard.position.set(0, 1.58, 0.32);
  roofGroup.add(farePlacard);

  /* -------------------------------------------------------------
   * 7. LIGHTING & LICENSE PLATES
   * ------------------------------------------------------------- */
  // Front Single Round Projector Headlight
  const headlightHousingGeom = new THREE.CylinderGeometry(0.10, 0.10, 0.08, 16);
  headlightHousingGeom.rotateX(Math.PI / 2);
  const hHousing = new THREE.Mesh(headlightHousingGeom, chromeMaterial);
  hHousing.position.set(0, 0.72, 1.04);
  lightsGroup.add(hHousing);

  const hLens = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 12), headlightMaterial);
  hLens.position.set(0, 0.72, 1.08);
  lightsGroup.add(hLens);

  // Front Amber Turn Signal Indicators
  [-0.28, 0.28].forEach((ix) => {
    const fInd = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 8), indicatorsMaterial);
    fInd.position.set(ix, 0.72, 0.98);
    lightsGroup.add(fInd);
  });

  // Rear Tail / Brake Light Clusters
  [-0.42, 0.42].forEach((rx) => {
    const rBrake = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.10, 0.04), brakeLightsMaterial);
    rBrake.position.set(rx, 0.46, -1.26);
    lightsGroup.add(rBrake);

    const rInd = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 0.04), indicatorsMaterial);
    rInd.position.set(rx, 0.54, -1.26);
    lightsGroup.add(rInd);
  });

  // Rear Number Plate ("PB-10-ER-042")
  const plateGeom = new THREE.BoxGeometry(0.35, 0.10, 0.02);
  const plateMat = new THREE.MeshStandardMaterial({
    color: 0xfef08a,
    roughness: 0.4,
  });
  const plate = new THREE.Mesh(plateGeom, plateMat);
  plate.position.set(0, 0.38, -1.27);
  lightsGroup.add(plate);

  // Cleanup helper
  const dispose = () => {
    root.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        if (obj.geometry) obj.geometry.dispose();
        if (Array.isArray(obj.material)) {
          obj.material.forEach((m) => m.dispose());
        } else if (obj.material) {
          obj.material.dispose();
        }
      }
    });
    if (roofTex) roofTex.dispose();
    if (fareTex) fareTex.dispose();
  };

  return {
    root,
    bodyGroup,
    handlebarSteerGroup,
    frontWheelGroup,
    rearLeftWheelGroup,
    rearRightWheelGroup,
    roofGroup,
    seatsGroup,
    passengerGroup,
    lightsGroup,

    headlightMaterial,
    brakeLightsMaterial,
    indicatorsMaterial,
    bodyPaintMaterial,
    accentMaterial,

    statusRingMesh,
    statusRingMaterial,

    updateSeatsFree,
    dispose,
  };
}
