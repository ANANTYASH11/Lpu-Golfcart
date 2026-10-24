import * as THREE from 'three';

export interface ShuttleBusModelOptions {
  route?: string;
  lowPower?: boolean;
}

export interface ShuttleBusRig {
  root: THREE.Group;
  suspensionGroup: THREE.Group;
  bodyGroup: THREE.Group;
  doorsGroup: THREE.Group;
  interiorGroup: THREE.Group;
  roofGroup: THREE.Group;
  lightsGroup: THREE.Group;
  wheelsGroup: THREE.Group;
  
  // Specific animatable parts
  frontLeftSteer: THREE.Group;
  frontRightSteer: THREE.Group;
  frontLeftWheel: THREE.Group;
  frontRightWheel: THREE.Group;
  rearLeftWheel: THREE.Group;
  rearRightWheel: THREE.Group;
  
  frontDoorLeftLeaf: THREE.Group;
  frontDoorRightLeaf: THREE.Group;
  rearDoorLeftLeaf: THREE.Group;
  rearDoorRightLeaf: THREE.Group;
  
  headlightsMaterial: THREE.MeshStandardMaterial;
  brakeLightsMaterial: THREE.MeshStandardMaterial;
  indicatorsMaterial: THREE.MeshStandardMaterial;
  interiorLightsMaterial: THREE.MeshStandardMaterial;
  destinationDisplayMaterial: THREE.MeshStandardMaterial;
  bodyPaintMaterial: THREE.MeshPhysicalMaterial | THREE.MeshStandardMaterial;
  
  statusRingMesh: THREE.Mesh;
  statusRingMaterial: THREE.MeshBasicMaterial;
  
  updateDestinationBoard?: (routeText: string) => void;
  dispose: () => void;
}

// Generate sharp high-res procedural canvas texture for Destination Display Board
export function createDestinationTexture(routeText: string = 'Route 1 - Loop'): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // Background
  ctx.fillStyle = '#05070a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Border frame
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 6;
  ctx.strokeRect(8, 8, canvas.width - 16, canvas.height - 16);

  // Top header: LPU CAMPUS SHUTTLE
  ctx.fillStyle = '#fb923c';
  ctx.font = 'bold 44px sans-serif';
  ctx.textAlign = 'center';
  ctx.letterSpacing = '4px';
  ctx.fillText('LPU CAMPUS SHUTTLE', canvas.width / 2, 70);

  // Center route text
  ctx.fillStyle = '#fef08a';
  ctx.shadowColor = '#f59e0b';
  ctx.shadowBlur = 12;
  ctx.font = '900 82px sans-serif';
  ctx.fillText(routeText.toUpperCase(), canvas.width / 2, 175);

  // LED Grid Matrix overlay effect
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  for (let y = 0; y < canvas.height; y += 4) {
    ctx.fillRect(0, y, canvas.width, 1.5);
  }
  for (let x = 0; x < canvas.width; x += 4) {
    ctx.fillRect(x, 0, 1.5, canvas.height);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}

// Generate dynamic LPU Side Decal texture
export function createLpuSideDecalTexture(): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // University Crest & Brand
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 50px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('LOVELY PROFESSIONAL UNIVERSITY', 40, 75);

  ctx.fillStyle = '#fdba74';
  ctx.font = 'bold 28px sans-serif';
  ctx.fillText('CAMPUS TRANSIT SERVICE  •  ECO HYBRID FLEET', 42, 110);

  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}

/**
 * Creates the complete procedural 3D Campus Shuttle Bus.
 * Real world proportions: 7.5m long, 2.25m wide, 2.95m tall.
 * Triangle budget: ~15k-18k triangles (well under 25k limit).
 */
export function createShuttleBusModel(options: ShuttleBusModelOptions = {}): ShuttleBusRig {
  const { route = 'Route 1 - Loop', lowPower = false } = options;

  const root = new THREE.Group();
  root.name = 'ShuttleBusRoot';

  // Materials Library
  // Body Paint: Crisp White with clearcoat
  const bodyPaintMaterial = lowPower
    ? new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.22,
        metalness: 0.04,
      })
    : new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        roughness: 0.14,
        metalness: 0.04,
        clearcoat: 1.0,
        clearcoatRoughness: 0.08,
        reflectivity: 0.55,
      });

  // Black signature waistline stripe
  const orangeStripeMaterial = new THREE.MeshStandardMaterial({
    color: 0x111111,
    roughness: 0.35,
    metalness: 0.15,
  });

  // Dark Grey Bumpers, Skirts and Window Trim
  const darkTrimMaterial = new THREE.MeshStandardMaterial({
    color: 0x18181b,
    roughness: 0.65,
    metalness: 0.2,
  });

  // Chrome / Brushed Metallic accents
  const chromeMaterial = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    roughness: 0.15,
    metalness: 0.85,
  });

  // Tinted Glass (Side, Windshield, Doors, Rear) - neutral clear, depthWrite: false
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
        reflectivity: 0.6,
        depthWrite: false,
      });

  // Rubber Tyres
  const tyreMaterial = new THREE.MeshStandardMaterial({
    color: 0x18181b,
    roughness: 0.85,
    metalness: 0.05,
  });

  // Alloy Wheels
  const wheelAlloyMaterial = new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    roughness: 0.3,
    metalness: 0.8,
  });

  // Brake Discs
  const brakeDiscMaterial = new THREE.MeshStandardMaterial({
    color: 0x475569,
    roughness: 0.4,
    metalness: 0.9,
  });

  // Headlights
  const headlightsMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xffffff,
    emissiveIntensity: 2.2,
    roughness: 0.1,
  });

  // Brake Lights (Intense red)
  const brakeLightsMaterial = new THREE.MeshStandardMaterial({
    color: 0xef4444,
    emissive: 0xdc2626,
    emissiveIntensity: 1.0,
    roughness: 0.2,
  });

  // Turn Indicators (Amber)
  const indicatorsMaterial = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    emissive: 0xd97706,
    emissiveIntensity: 0.3,
    roughness: 0.2,
  });

  // Interior Ambient Lighting
  const interiorLightsMaterial = new THREE.MeshStandardMaterial({
    color: 0xffedd5,
    emissive: 0xffedd5,
    emissiveIntensity: 0.4,
  });

  // Destination Display Board
  const destTexture = createDestinationTexture(route);
  const destinationDisplayMaterial = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    emissive: 0xfbbf24,
    emissiveIntensity: 1.8,
    map: destTexture || undefined,
    emissiveMap: destTexture || undefined,
    roughness: 0.3,
  });

  // Ground Status Ring Material - thin subtle ring with depthWrite: false and polygonOffset
  const statusRingMaterial = new THREE.MeshBasicMaterial({
    color: 0x10b981,
    transparent: true,
    opacity: 0.10, // 10 percent opacity per spec
    side: THREE.DoubleSide,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });

  // Ground Status Ring Mesh (y = 0.004)
  const ringGeom = new THREE.RingGeometry(2.35, 2.42, 64);
  ringGeom.rotateX(-Math.PI / 2);
  const statusRingMesh = new THREE.Mesh(ringGeom, statusRingMaterial);
  statusRingMesh.position.set(0, 0.004, 0);
  statusRingMesh.renderOrder = 1;
  statusRingMesh.name = 'StatusRing';
  root.add(statusRingMesh);

  // Soft Ground Shadow disc (y = 0.002)
  const shadowGeom = new THREE.PlaneGeometry(3.0, 8.2);
  shadowGeom.rotateX(-Math.PI / 2);
  const shadowMat = new THREE.MeshBasicMaterial({
    color: 0x000000,
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
  });
  const shadowMesh = new THREE.Mesh(shadowGeom, shadowMat);
  shadowMesh.position.set(0, 0.002, 0);
  shadowMesh.renderOrder = 0;
  shadowMesh.name = 'GroundShadow';
  root.add(shadowMesh);

  // Suspension Group: allows pitch (acceleration/braking) and vertical bounce
  const suspensionGroup = new THREE.Group();
  suspensionGroup.name = 'SuspensionGroup';
  root.add(suspensionGroup);

  // Body Group
  const bodyGroup = new THREE.Group();
  bodyGroup.name = 'Body';
  suspensionGroup.add(bodyGroup);

  // Doors Group
  const doorsGroup = new THREE.Group();
  doorsGroup.name = 'Doors';
  suspensionGroup.add(doorsGroup);

  // Interior Group
  const interiorGroup = new THREE.Group();
  interiorGroup.name = 'Interior';
  suspensionGroup.add(interiorGroup);

  // Roof Group
  const roofGroup = new THREE.Group();
  roofGroup.name = 'Roof';
  suspensionGroup.add(roofGroup);

  // Lights Group
  const lightsGroup = new THREE.Group();
  lightsGroup.name = 'Lights';
  suspensionGroup.add(lightsGroup);

  // Wheels Group
  const wheelsGroup = new THREE.Group();
  wheelsGroup.name = 'Wheels';
  root.add(wheelsGroup);

  /* -------------------------------------------------------------
   * 1. BODY CHASSIS & LOWER PANELS
   * ------------------------------------------------------------- */
  // Lower chassis structural beam
  const chassisGeom = new THREE.BoxGeometry(2.0, 0.22, 6.8);
  const chassisMesh = new THREE.Mesh(chassisGeom, darkTrimMaterial);
  chassisMesh.position.set(0, 0.42, 0);
  chassisMesh.castShadow = !lowPower;
  bodyGroup.add(chassisMesh);

  // Lower side skirts (dark graphite protection skirt)
  // Right side continuous skirt
  const skirtRight = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.38, 7.1), darkTrimMaterial);
  skirtRight.position.set(1.12, 0.58, 0);
  bodyGroup.add(skirtRight);

  // Left side segmented skirts (leaving clear cutouts for front door z: 1.55..2.55 and rear door z: -1.25..-0.25)
  // Front skirt (z: 2.55 to 3.55, length 1.0)
  const skirtLeftFront = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.38, 1.0), darkTrimMaterial);
  skirtLeftFront.position.set(-1.12, 0.58, 3.05);
  bodyGroup.add(skirtLeftFront);

  // Middle skirt (z: -0.25 to 1.55, length 1.8)
  const skirtLeftMid = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.38, 1.8), darkTrimMaterial);
  skirtLeftMid.position.set(-1.12, 0.58, 0.65);
  bodyGroup.add(skirtLeftMid);

  // Rear skirt (z: -3.55 to -1.25, length 2.3)
  const skirtLeftRear = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.38, 2.3), darkTrimMaterial);
  skirtLeftRear.position.set(-1.12, 0.58, -2.40);
  bodyGroup.add(skirtLeftRear);

  // Right side continuous white lower body (below windows, y: 0.77 to 1.30)
  const lowerBodyRight = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.54, 7.2), bodyPaintMaterial);
  lowerBodyRight.position.set(1.12, 1.04, 0);
  lowerBodyRight.castShadow = !lowPower;
  bodyGroup.add(lowerBodyRight);

  // Left side segmented white lower body (door openings for front & rear)
  const lowerBodyLeftFront = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.54, 1.0), bodyPaintMaterial);
  lowerBodyLeftFront.position.set(-1.12, 1.04, 3.05);
  lowerBodyLeftFront.castShadow = !lowPower;
  bodyGroup.add(lowerBodyLeftFront);

  const lowerBodyLeftMid = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.54, 1.8), bodyPaintMaterial);
  lowerBodyLeftMid.position.set(-1.12, 1.04, 0.65);
  lowerBodyLeftMid.castShadow = !lowPower;
  bodyGroup.add(lowerBodyLeftMid);

  const lowerBodyLeftRear = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.54, 2.3), bodyPaintMaterial);
  lowerBodyLeftRear.position.set(-1.12, 1.04, -2.40);
  lowerBodyLeftRear.castShadow = !lowPower;
  bodyGroup.add(lowerBodyLeftRear);

  // Vibrant Orange LPU Signature Beltline Stripe
  // Right side continuous stripe
  const stripeRight = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.16, 7.22), orangeStripeMaterial);
  stripeRight.position.set(1.125, 1.12, 0);
  bodyGroup.add(stripeRight);

  // Left side segmented stripes (matching door gaps)
  const stripeLeftFront = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.16, 1.0), orangeStripeMaterial);
  stripeLeftFront.position.set(-1.125, 1.12, 3.05);
  bodyGroup.add(stripeLeftFront);

  const stripeLeftMid = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.16, 1.8), orangeStripeMaterial);
  stripeLeftMid.position.set(-1.125, 1.12, 0.65);
  bodyGroup.add(stripeLeftMid);

  const stripeLeftRear = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.16, 2.3), orangeStripeMaterial);
  stripeLeftRear.position.set(-1.125, 1.12, -2.40);
  bodyGroup.add(stripeLeftRear);

  // Front Cowl Orange Accent
  const frontStripeGeom = new THREE.BoxGeometry(2.26, 0.14, 0.12);
  const frontStripe = new THREE.Mesh(frontStripeGeom, orangeStripeMaterial);
  frontStripe.position.set(0, 1.12, 3.65);
  bodyGroup.add(frontStripe);

  // Rear Cowl Orange Accent
  const rearStripeGeom = new THREE.BoxGeometry(2.26, 0.14, 0.12);
  const rearStripe = new THREE.Mesh(rearStripeGeom, orangeStripeMaterial);
  rearStripe.position.set(0, 1.12, -3.65);
  bodyGroup.add(rearStripe);

  // Side Branding Decals ("LOVELY PROFESSIONAL UNIVERSITY")
  const decalTexture = createLpuSideDecalTexture();
  if (decalTexture) {
    const decalGeom = new THREE.PlaneGeometry(4.2, 0.52);
    const decalMat = new THREE.MeshBasicMaterial({
      map: decalTexture,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });

    const decalLeft = new THREE.Mesh(decalGeom, decalMat);
    decalLeft.rotation.y = -Math.PI / 2;
    decalLeft.position.set(-1.19, 0.98, 0.2);
    bodyGroup.add(decalLeft);

    const decalRight = new THREE.Mesh(decalGeom, decalMat);
    decalRight.rotation.y = Math.PI / 2;
    decalRight.position.set(1.19, 0.98, 0.2);
    bodyGroup.add(decalRight);
  }

  // Wheel arches / contoured fender flares
  const wheelWellGeom = new THREE.CylinderGeometry(0.55, 0.55, 0.18, 18, 1, false, 0, Math.PI);
  wheelWellGeom.rotateZ(Math.PI / 2);

  const wheelPositions = [
    { x: -1.13, z: 2.25 },
    { x: 1.13, z: 2.25 },
    { x: -1.13, z: -2.05 },
    { x: 1.13, z: -2.05 },
  ];

  wheelPositions.forEach((pos) => {
    const arch = new THREE.Mesh(wheelWellGeom, darkTrimMaterial);
    arch.position.set(pos.x, 0.54, pos.z);
    if (pos.x > 0) arch.rotation.y = Math.PI;
    bodyGroup.add(arch);
  });

  // Front Aerodynamic Nose / Cowl (tapered front with chamfer)
  const frontNoseGeom = new THREE.BoxGeometry(2.22, 0.72, 0.65);
  const frontNose = new THREE.Mesh(frontNoseGeom, bodyPaintMaterial);
  frontNose.position.set(0, 0.98, 3.42);
  frontNose.castShadow = !lowPower;
  bodyGroup.add(frontNose);

  // Front Grille & Radiator Air Intake
  const grilleGeom = new THREE.BoxGeometry(1.6, 0.32, 0.08);
  const grille = new THREE.Mesh(grilleGeom, darkTrimMaterial);
  grille.position.set(0, 0.88, 3.76);
  bodyGroup.add(grille);

  // Chrome Grille Trim Slats
  for (let i = -1; i <= 1; i++) {
    const slatGeom = new THREE.BoxGeometry(1.5, 0.025, 0.09);
    const slat = new THREE.Mesh(slatGeom, chromeMaterial);
    slat.position.set(0, 0.88 + i * 0.09, 3.76);
    bodyGroup.add(slat);
  }

  // LPU Front Emblem (Gold / Chrome badge)
  const emblemGeom = new THREE.CylinderGeometry(0.09, 0.09, 0.04, 16);
  emblemGeom.rotateX(Math.PI / 2);
  const emblemMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    metalness: 0.9,
    roughness: 0.2,
  });
  const emblem = new THREE.Mesh(emblemGeom, emblemMat);
  emblem.position.set(0, 0.96, 3.81);
  bodyGroup.add(emblem);

  // Front Heavy-duty Wrap-around Bumper
  const frontBumperGeom = new THREE.BoxGeometry(2.32, 0.35, 0.42);
  const frontBumper = new THREE.Mesh(frontBumperGeom, darkTrimMaterial);
  frontBumper.position.set(0, 0.46, 3.66);
  frontBumper.castShadow = !lowPower;
  bodyGroup.add(frontBumper);

  // Front License Plate ("PB-10-LPU-2026")
  const plateGeom = new THREE.BoxGeometry(0.55, 0.14, 0.03);
  const plateMat = new THREE.MeshStandardMaterial({
    color: 0xfef08a,
    roughness: 0.4,
  });
  const frontPlate = new THREE.Mesh(plateGeom, plateMat);
  frontPlate.position.set(0, 0.45, 3.88);
  bodyGroup.add(frontPlate);

  // Rear Heavy-duty Bumper
  const rearBumperGeom = new THREE.BoxGeometry(2.32, 0.35, 0.35);
  const rearBumper = new THREE.Mesh(rearBumperGeom, darkTrimMaterial);
  rearBumper.position.set(0, 0.46, -3.72);
  rearBumper.castShadow = !lowPower;
  bodyGroup.add(rearBumper);

  // Rear License Plate
  const rearPlate = new THREE.Mesh(plateGeom, plateMat);
  rearPlate.position.set(0, 0.48, -3.90);
  bodyGroup.add(rearPlate);

  // Rear Lower Reflectors
  const reflectorGeom = new THREE.BoxGeometry(0.24, 0.06, 0.03);
  const reflectorMat = new THREE.MeshStandardMaterial({
    color: 0xef4444,
    emissive: 0xb91c1c,
    emissiveIntensity: 0.6,
  });
  const refLeft = new THREE.Mesh(reflectorGeom, reflectorMat);
  refLeft.position.set(-0.85, 0.46, -3.90);
  bodyGroup.add(refLeft);
  const refRight = new THREE.Mesh(reflectorGeom, reflectorMat);
  refRight.position.set(0.85, 0.46, -3.90);
  bodyGroup.add(refRight);

  /* -------------------------------------------------------------
   * 2. WINDOWS & GLASS CABIN (Slender frames, blue tint)
   * ------------------------------------------------------------- */
  // Front Windshield (Panoramic curved & raked)
  const windshieldGeom = new THREE.PlaneGeometry(2.1, 1.15, 8, 4);
  const windshield = new THREE.Mesh(windshieldGeom, glassMaterial);
  windshield.position.set(0, 1.88, 3.32);
  windshield.rotation.x = -0.32; // Raked aerodynamic angle
  windshield.renderOrder = 10;
  bodyGroup.add(windshield);

  // Windshield Rubber Gasket Frame
  const windshieldFrameGeom = new THREE.BoxGeometry(2.16, 0.05, 0.06);
  const wsFrameTop = new THREE.Mesh(windshieldFrameGeom, darkTrimMaterial);
  wsFrameTop.position.set(0, 2.38, 3.14);
  bodyGroup.add(wsFrameTop);

  const wsFrameBottom = new THREE.Mesh(windshieldFrameGeom, darkTrimMaterial);
  wsFrameBottom.position.set(0, 1.38, 3.50);
  bodyGroup.add(wsFrameBottom);

  // Center Windshield Wiper Base and Blades
  const wiperBaseGeom = new THREE.CylinderGeometry(0.02, 0.02, 0.12, 8);
  const wiperBladeGeom = new THREE.BoxGeometry(0.68, 0.02, 0.015);
  [-0.45, 0.35].forEach((wx) => {
    const wBase = new THREE.Mesh(wiperBaseGeom, darkTrimMaterial);
    wBase.position.set(wx, 1.40, 3.54);
    wBase.rotation.x = 0.3;
    bodyGroup.add(wBase);

    const wBlade = new THREE.Mesh(wiperBladeGeom, darkTrimMaterial);
    wBlade.position.set(wx + 0.22, 1.54, 3.48);
    wBlade.rotation.z = -0.35;
    wBlade.rotation.x = -0.32;
    bodyGroup.add(wBlade);
  });

  // Large Side Windows (Right side continuous bays)
  const sideWindowRightGeom = new THREE.BoxGeometry(0.06, 1.02, 6.7);
  const sideWindowRight = new THREE.Mesh(sideWindowRightGeom, glassMaterial);
  sideWindowRight.position.set(1.13, 1.88, -0.05);
  sideWindowRight.renderOrder = 10;
  bodyGroup.add(sideWindowRight);

  // Side Window Mullions / Vertical Pillar Dividers (Right side)
  [-2.4, -1.1, 0.2, 1.5].forEach((pz) => {
    const pillarGeom = new THREE.BoxGeometry(0.09, 1.05, 0.08);
    const pillar = new THREE.Mesh(pillarGeom, darkTrimMaterial);
    pillar.position.set(1.135, 1.88, pz);
    bodyGroup.add(pillar);
  });

  // Left Side Windows (with gaps for front and rear doors)
  // Window section between front door and rear door
  const sideMidWindowGeom = new THREE.BoxGeometry(0.06, 1.02, 1.6);
  const sideMidWindow = new THREE.Mesh(sideMidWindowGeom, glassMaterial);
  sideMidWindow.position.set(-1.13, 1.88, 0.6);
  sideMidWindow.renderOrder = 10;
  bodyGroup.add(sideMidWindow);

  // Window section behind rear door
  const sideRearWindowGeom = new THREE.BoxGeometry(0.06, 1.02, 2.1);
  const sideRearWindow = new THREE.Mesh(sideRearWindowGeom, glassMaterial);
  sideRearWindow.position.set(-1.13, 1.88, -2.4);
  sideRearWindow.renderOrder = 10;
  bodyGroup.add(sideRearWindow);

  // Rear Window (Emergency exit glass)
  const rearWindowGeom = new THREE.PlaneGeometry(1.9, 0.95);
  const rearWindow = new THREE.Mesh(rearWindowGeom, glassMaterial);
  rearWindow.position.set(0, 1.88, -3.66);
  rearWindow.rotation.y = Math.PI;
  rearWindow.renderOrder = 10;
  bodyGroup.add(rearWindow);

  // Rear Window Frame
  const rearFrameGeom = new THREE.BoxGeometry(1.96, 1.02, 0.06);
  const rearFrame = new THREE.Mesh(rearFrameGeom, darkTrimMaterial);
  rearFrame.position.set(0, 1.88, -3.64);
  bodyGroup.add(rearFrame);

  // Side Mirrors (Left & Right aero commercial mirror stalks with twin mirrors)
  [-1.28, 1.28].forEach((mx) => {
    const stalkGeom = new THREE.CylinderGeometry(0.02, 0.02, 0.42, 8);
    stalkGeom.rotateZ(mx > 0 ? -0.4 : 0.4);
    const stalk = new THREE.Mesh(stalkGeom, darkTrimMaterial);
    stalk.position.set(mx, 1.95, 3.25);
    bodyGroup.add(stalk);

    // Mirror housing
    const housingGeom = new THREE.BoxGeometry(0.12, 0.42, 0.16);
    const housing = new THREE.Mesh(housingGeom, darkTrimMaterial);
    housing.position.set(mx * 1.06, 1.98, 3.32);
    bodyGroup.add(housing);

    // Mirror reflective surface
    const glassSurfaceGeom = new THREE.PlaneGeometry(0.1, 0.38);
    const glassSurface = new THREE.Mesh(glassSurfaceGeom, chromeMaterial);
    glassSurface.position.set(mx * 1.06, 1.98, 3.23);
    glassSurface.rotation.y = Math.PI;
    bodyGroup.add(glassSurface);
  });

  /* -------------------------------------------------------------
   * 3. PASSENGER DOORS (Front & Rear, animatable open/close)
   * ------------------------------------------------------------- */
  // Left side door openings:
  // Front door: z = 2.05, height y = 0.55 to 2.38
  // Rear door: z = -0.75, height y = 0.55 to 2.38

  // Recessed Door Steps with Yellow Hazard Grip
  const stepGeom = new THREE.BoxGeometry(0.35, 0.12, 0.95);
  const stepMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.9,
  });
  const stepWarningMat = new THREE.MeshStandardMaterial({
    color: 0xeab308,
    roughness: 0.6,
  });

  [-0.75, 2.05].forEach((dz) => {
    const step = new THREE.Mesh(stepGeom, stepMat);
    step.position.set(-1.02, 0.42, dz);
    doorsGroup.add(step);

    const stepNoseGeom = new THREE.BoxGeometry(0.04, 0.05, 0.95);
    const stepNose = new THREE.Mesh(stepNoseGeom, stepWarningMat);
    stepNose.position.set(-1.18, 0.46, dz);
    doorsGroup.add(stepNose);
  });

  // Helper to build a dual-leaf door group
  function createDoorLeaf(width: number, height: number): THREE.Group {
    const group = new THREE.Group();

    // Dark Door Outer Frame
    const leafFrameGeom = new THREE.BoxGeometry(0.04, height, width);
    const leafFrame = new THREE.Mesh(leafFrameGeom, darkTrimMaterial);
    group.add(leafFrame);

    // Lower Dark Skirt (y: -0.80 to -0.68)
    const doorSkirt = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.22, width * 0.94), darkTrimMaterial);
    doorSkirt.position.set(-0.005, -height / 2 + 0.11, 0);
    group.add(doorSkirt);

    // Lower White Body panel (y: -0.68 to -0.36)
    const doorWhitePanel = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.34, width * 0.94), bodyPaintMaterial);
    doorWhitePanel.position.set(-0.005, -height / 2 + 0.39, 0);
    group.add(doorWhitePanel);

    // Orange Stripe section across door (y: -0.36 to -0.20)
    const doorOrangeStripe = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.16, width * 0.95), orangeStripeMaterial);
    doorOrangeStripe.position.set(-0.008, -height / 2 + 0.64, 0);
    group.add(doorOrangeStripe);

    // Glazed window insert (upper section)
    const glassH = height - 0.82;
    const leafGlassGeom = new THREE.BoxGeometry(0.02, glassH, width * 0.82);
    const leafGlass = new THREE.Mesh(leafGlassGeom, glassMaterial);
    leafGlass.position.set(0, height / 2 - glassH / 2 - 0.04, 0);
    group.add(leafGlass);

    // Vertical metal grab handle
    const handleGeom = new THREE.CylinderGeometry(0.012, 0.012, 0.55, 8);
    const handle = new THREE.Mesh(handleGeom, chromeMaterial);
    handle.position.set(-0.035, -0.05, width * 0.32);
    group.add(handle);

    // Weather seal rubber edge
    const rubberGeom = new THREE.BoxGeometry(0.045, height, 0.02);
    const rubber = new THREE.Mesh(rubberGeom, darkTrimMaterial);
    rubber.position.set(0, 0, width / 2);
    group.add(rubber);

    return group;
  }

  // Front Entrance Door (split leaves)
  const frontDoorLeftLeaf = createDoorLeaf(0.48, 1.82);
  frontDoorLeftLeaf.position.set(-1.14, 1.48, 2.30);
  frontDoorLeftLeaf.name = 'FrontDoorLeftLeaf';
  doorsGroup.add(frontDoorLeftLeaf);

  const frontDoorRightLeaf = createDoorLeaf(0.48, 1.82);
  frontDoorRightLeaf.position.set(-1.14, 1.48, 1.80);
  frontDoorRightLeaf.name = 'FrontDoorRightLeaf';
  doorsGroup.add(frontDoorRightLeaf);

  // Rear Exit Door (split leaves)
  const rearDoorLeftLeaf = createDoorLeaf(0.48, 1.82);
  rearDoorLeftLeaf.position.set(-1.14, 1.48, -0.50);
  rearDoorLeftLeaf.name = 'RearDoorLeftLeaf';
  doorsGroup.add(rearDoorLeftLeaf);

  const rearDoorRightLeaf = createDoorLeaf(0.48, 1.82);
  rearDoorRightLeaf.position.set(-1.14, 1.48, -1.00);
  rearDoorRightLeaf.name = 'RearDoorRightLeaf';
  doorsGroup.add(rearDoorRightLeaf);

  /* -------------------------------------------------------------
   * 4. INTERIOR (25-30 Seats, Handrails, Dashboard, Wheelchair Space)
   * ------------------------------------------------------------- */
  // Interior Floor (Anti-slip grey floor mat)
  const floorGeom = new THREE.BoxGeometry(2.1, 0.08, 7.0);
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.95,
  });
  const floorMesh = new THREE.Mesh(floorGeom, floorMat);
  floorMesh.position.set(0, 0.58, 0);
  interiorGroup.add(floorMesh);

  // Ceiling with ambient recessed LED light panels
  const ceilingGeom = new THREE.BoxGeometry(2.0, 0.06, 6.8);
  const ceilingMesh = new THREE.Mesh(ceilingGeom, darkTrimMaterial);
  ceilingMesh.position.set(0, 2.44, 0);
  interiorGroup.add(ceilingMesh);

  const ledStripGeom = new THREE.BoxGeometry(0.18, 0.02, 6.4);
  const ceilingLed = new THREE.Mesh(ledStripGeom, interiorLightsMaterial);
  ceilingLed.position.set(0, 2.41, 0);
  interiorGroup.add(ceilingLed);

  // Stanchions (Yellow grab poles)
  const poleGeom = new THREE.CylinderGeometry(0.02, 0.02, 1.86, 8);
  const poleMat = new THREE.MeshStandardMaterial({
    color: 0xeab308,
    roughness: 0.35,
    metalness: 0.6,
  });

  // Longitudinal overhead handrails with hand straps
  const railGeom = new THREE.CylinderGeometry(0.018, 0.018, 6.2, 8);
  railGeom.rotateX(Math.PI / 2);
  [-0.35, 0.35].forEach((rx) => {
    const rail = new THREE.Mesh(railGeom, poleMat);
    rail.position.set(rx, 2.22, 0);
    interiorGroup.add(rail);

    // Hanging straps along rails
    for (let sz = -2.4; sz <= 2.4; sz += 0.8) {
      const strapGeom = new THREE.BoxGeometry(0.03, 0.16, 0.02);
      const strap = new THREE.Mesh(strapGeom, orangeStripeMaterial);
      strap.position.set(rx, 2.12, sz);
      interiorGroup.add(strap);
    }
  });

  // Vertical support stanchions
  [-2.2, -1.2, 0.2, 1.6].forEach((pz) => {
    [-0.35, 0.35].forEach((px) => {
      const pole = new THREE.Mesh(poleGeom, poleMat);
      pole.position.set(px, 1.51, pz);
      interiorGroup.add(pole);
    });
  });

  // Driver Cockpit (Right side for India RHD)
  const dashGeom = new THREE.BoxGeometry(0.85, 0.55, 0.65);
  const dash = new THREE.Mesh(dashGeom, darkTrimMaterial);
  dash.position.set(0.55, 0.95, 3.1);
  interiorGroup.add(dash);

  // Steering Column & Steering Wheel
  const steerColumnGeom = new THREE.CylinderGeometry(0.03, 0.03, 0.45, 8);
  steerColumnGeom.rotateX(0.5);
  const steerColumn = new THREE.Mesh(steerColumnGeom, darkTrimMaterial);
  steerColumn.position.set(0.55, 1.05, 2.92);
  interiorGroup.add(steerColumn);

  const wheelTorusGeom = new THREE.TorusGeometry(0.18, 0.022, 8, 18);
  wheelTorusGeom.rotateX(0.5);
  const steerWheel = new THREE.Mesh(wheelTorusGeom, darkTrimMaterial);
  steerWheel.position.set(0.55, 1.22, 2.80);
  interiorGroup.add(steerWheel);

  // Driver Seat
  const seatMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.8,
  });
  const driverSeatBase = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.35, 0.48), seatMat);
  driverSeatBase.position.set(0.55, 0.78, 2.45);
  interiorGroup.add(driverSeatBase);
  const driverSeatBack = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.65, 0.12), seatMat);
  driverSeatBack.position.set(0.55, 1.25, 2.22);
  interiorGroup.add(driverSeatBack);

  // Passenger Seats (2+2 and 2+1 rows: 26 passenger seats total)
  // Seat cushion & backrest reusable geometry
  const seatCushionGeom = new THREE.BoxGeometry(0.44, 0.12, 0.42);
  const seatBackGeom = new THREE.BoxGeometry(0.44, 0.52, 0.08);
  const headrestGeom = new THREE.BoxGeometry(0.24, 0.12, 0.09);

  const seatCushionMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.85,
  });
  const seatAccentMat = new THREE.MeshStandardMaterial({
    color: 0xea580c,
    roughness: 0.6,
  });

  const seatLegGeom = new THREE.CylinderGeometry(0.02, 0.02, 0.35, 8);

  const rowZPositions = [1.8, 1.1, 0.4, -0.3, -1.0, -1.7, -2.4, -3.1];

  rowZPositions.forEach((rz) => {
    // Right side double seats
    const rightSeatsX = [0.42, 0.88];
    rightSeatsX.forEach((sx) => {
      const leg = new THREE.Mesh(seatLegGeom, chromeMaterial);
      leg.position.set(sx, 0.78, rz);
      interiorGroup.add(leg);

      const cushion = new THREE.Mesh(seatCushionGeom, seatCushionMat);
      cushion.position.set(sx, 0.96, rz);
      interiorGroup.add(cushion);

      const back = new THREE.Mesh(seatBackGeom, seatCushionMat);
      back.position.set(sx, 1.26, rz - 0.18);
      interiorGroup.add(back);

      const headrest = new THREE.Mesh(headrestGeom, seatAccentMat);
      headrest.position.set(sx, 1.54, rz - 0.18);
      interiorGroup.add(headrest);
    });

    // Left side seats (skipping door zones at z = 2.05 and z = -0.75)
    if (rz !== 1.8 && rz !== -1.0) {
      const sx = -0.75;
      const leg = new THREE.Mesh(seatLegGeom, chromeMaterial);
      leg.position.set(sx, 0.78, rz);
      interiorGroup.add(leg);

      const cushion = new THREE.Mesh(seatCushionGeom, seatCushionMat);
      cushion.position.set(sx, 0.96, rz);
      interiorGroup.add(cushion);

      const back = new THREE.Mesh(seatBackGeom, seatCushionMat);
      back.position.set(sx, 1.26, rz - 0.18);
      interiorGroup.add(back);

      const headrest = new THREE.Mesh(headrestGeom, seatAccentMat);
      headrest.position.set(sx, 1.54, rz - 0.18);
      interiorGroup.add(headrest);
    }
  });

  // Dedicated Wheelchair Zone Icon (near rear door)
  const wcPadGeom = new THREE.BoxGeometry(0.75, 0.01, 0.75);
  const wcPadMat = new THREE.MeshStandardMaterial({
    color: 0x0284c7,
    roughness: 0.6,
  });
  const wcPad = new THREE.Mesh(wcPadGeom, wcPadMat);
  wcPad.position.set(-0.68, 0.63, 0.35);
  interiorGroup.add(wcPad);

  /* -------------------------------------------------------------
   * 5. ROOF & ROOFTOP DETAILS (AC unit, Destination Board, Hatches)
   * ------------------------------------------------------------- */
  // Main Roof Shell (Chamfered and aerodynamic)
  const roofShellGeom = new THREE.BoxGeometry(2.26, 0.28, 7.2);
  const roofShell = new THREE.Mesh(roofShellGeom, bodyPaintMaterial);
  roofShell.position.set(0, 2.54, -0.05);
  roofShell.castShadow = !lowPower;
  roofGroup.add(roofShell);

  // Curved Aerodynamic Roof Cap
  const roofCapGeom = new THREE.CylinderGeometry(1.12, 1.14, 6.9, 16, 1, false, 0, Math.PI);
  roofCapGeom.rotateZ(-Math.PI / 2);
  roofCapGeom.rotateY(-Math.PI / 2);
  const roofCap = new THREE.Mesh(roofCapGeom, bodyPaintMaterial);
  roofCap.position.set(0, 2.68, -0.05);
  roofCap.scale.set(1.0, 0.28, 1.0);
  roofGroup.add(roofCap);

  // Front Destination Display Box
  const destBoxGeom = new THREE.BoxGeometry(1.85, 0.38, 0.45);
  const destBox = new THREE.Mesh(destBoxGeom, darkTrimMaterial);
  destBox.position.set(0, 2.58, 3.42);
  roofGroup.add(destBox);

  // Glowing LED Matrix Screen for Destination Display
  const destScreenGeom = new THREE.PlaneGeometry(1.68, 0.32);
  const destScreen = new THREE.Mesh(destScreenGeom, destinationDisplayMaterial);
  destScreen.position.set(0, 2.58, 3.65);
  destScreen.rotation.x = -0.08;
  roofGroup.add(destScreen);

  // Rooftop Dual-Fan HVAC / AC Unit
  const acBoxGeom = new THREE.BoxGeometry(1.5, 0.28, 2.3);
  const acBox = new THREE.Mesh(acBoxGeom, bodyPaintMaterial);
  acBox.position.set(0, 2.88, -0.5);
  acBox.castShadow = !lowPower;
  roofGroup.add(acBox);

  // AC Exhaust Fan Grilles
  const fanRimGeom = new THREE.TorusGeometry(0.32, 0.03, 8, 16);
  fanRimGeom.rotateX(Math.PI / 2);
  [-0.6, 0.6].forEach((fz) => {
    const fanRim = new THREE.Mesh(fanRimGeom, darkTrimMaterial);
    fanRim.position.set(0, 3.03, -0.5 + fz);
    roofGroup.add(fanRim);

    const fanGrilleGeom = new THREE.CylinderGeometry(0.3, 0.3, 0.02, 16);
    const fanGrille = new THREE.Mesh(fanGrilleGeom, darkTrimMaterial);
    fanGrille.position.set(0, 3.02, -0.5 + fz);
    roofGroup.add(fanGrille);
  });

  // AC Side Louvers / Vents
  [-0.76, 0.76].forEach((lx) => {
    const louverGeom = new THREE.BoxGeometry(0.04, 0.16, 1.8);
    const louver = new THREE.Mesh(louverGeom, darkTrimMaterial);
    louver.position.set(lx, 2.88, -0.5);
    roofGroup.add(louver);
  });

  // Roof Emergency Escape Hatches
  const hatchGeom = new THREE.BoxGeometry(0.85, 0.06, 0.85);
  [-2.2, 1.4].forEach((hz) => {
    const hatch = new THREE.Mesh(hatchGeom, darkTrimMaterial);
    hatch.position.set(0, 2.76, hz);
    roofGroup.add(hatch);
  });

  // GPS / Telematics Sharkfin Antenna
  const antennaGeom = new THREE.ConeGeometry(0.06, 0.18, 6);
  antennaGeom.rotateX(-0.3);
  const antenna = new THREE.Mesh(antennaGeom, darkTrimMaterial);
  antenna.position.set(0, 2.86, 2.4);
  roofGroup.add(antenna);

  /* -------------------------------------------------------------
   * 6. LIGHTS & OPTICS (Headlights, DRLs, Indicators, Tail/Brake)
   * ------------------------------------------------------------- */
  // Dual Projector LED Headlights (Left & Right)
  [-0.78, 0.78].forEach((lx) => {
    // Outer headlight glass lens
    const lensGeom = new THREE.CylinderGeometry(0.13, 0.13, 0.06, 16);
    lensGeom.rotateX(Math.PI / 2);
    const lens = new THREE.Mesh(lensGeom, headlightsMaterial);
    lens.position.set(lx, 0.88, 3.76);
    lightsGroup.add(lens);

    // Inner Projector Eyeball
    const projGeom = new THREE.SphereGeometry(0.07, 12, 12);
    const proj = new THREE.Mesh(projGeom, headlightsMaterial);
    proj.position.set(lx + (lx > 0 ? -0.07 : 0.07), 0.88, 3.78);
    lightsGroup.add(proj);

    // DRL (Daytime Running Light eyebrow strip)
    const drlGeom = new THREE.BoxGeometry(0.28, 0.03, 0.04);
    const drl = new THREE.Mesh(drlGeom, headlightsMaterial);
    drl.position.set(lx, 1.02, 3.76);
    lightsGroup.add(drl);
  });

  // Front Turn Indicators (Amber corner lamps)
  [-1.02, 1.02].forEach((ix) => {
    const indGeom = new THREE.BoxGeometry(0.14, 0.08, 0.06);
    const ind = new THREE.Mesh(indGeom, indicatorsMaterial);
    ind.position.set(ix, 0.88, 3.72);
    lightsGroup.add(ind);
  });

  // Rear Vertical Multi-chamber Tail Light Clusters
  [-1.02, 1.02].forEach((rx) => {
    // Tail Light Housing
    const tHousingGeom = new THREE.BoxGeometry(0.12, 0.72, 0.05);
    const tHousing = new THREE.Mesh(tHousingGeom, darkTrimMaterial);
    tHousing.position.set(rx, 1.35, -3.74);
    lightsGroup.add(tHousing);

    // Top: Amber Rear Turn Indicator
    const rIndGeom = new THREE.BoxGeometry(0.10, 0.18, 0.06);
    const rInd = new THREE.Mesh(rIndGeom, indicatorsMaterial);
    rInd.position.set(rx, 1.60, -3.75);
    lightsGroup.add(rInd);

    // Middle: Red Brake / Tail Light
    const rBrakeGeom = new THREE.BoxGeometry(0.10, 0.28, 0.06);
    const rBrake = new THREE.Mesh(rBrakeGeom, brakeLightsMaterial);
    rBrake.position.set(rx, 1.34, -3.75);
    lightsGroup.add(rBrake);

    // Bottom: White Reverse Light
    const rRevGeom = new THREE.BoxGeometry(0.10, 0.14, 0.06);
    const rRev = new THREE.Mesh(rRevGeom, headlightsMaterial);
    rRev.position.set(rx, 1.10, -3.75);
    lightsGroup.add(rRev);
  });

  // High-mounted Central Rear Brake Light (above rear window)
  const highBrakeGeom = new THREE.BoxGeometry(0.48, 0.05, 0.04);
  const highBrake = new THREE.Mesh(highBrakeGeom, brakeLightsMaterial);
  highBrake.position.set(0, 2.42, -3.67);
  lightsGroup.add(highBrake);

  // Roofline Amber Clearance Marker Lights
  [-0.95, 0.95].forEach((mx) => {
    // Front top clearance
    const fMarker = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 0.04), indicatorsMaterial);
    fMarker.position.set(mx, 2.72, 3.45);
    lightsGroup.add(fMarker);

    // Rear top clearance (Red)
    const rMarker = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 0.04), brakeLightsMaterial);
    rMarker.position.set(mx, 2.72, -3.65);
    lightsGroup.add(rMarker);
  });

  /* -------------------------------------------------------------
   * 7. WHEELS & STEERING ASSEMBLY
   * ------------------------------------------------------------- */
  // Function to create realistic commercial wheel assembly
  function createWheelAssembly(isDualRear: boolean = false): THREE.Group {
    const wheelAssembly = new THREE.Group();

    const tyreRadius = 0.44;
    const tyreWidth = isDualRear ? 0.38 : 0.26;

    // Tyre rubber with tread grooves
    const tyreGeom = new THREE.CylinderGeometry(tyreRadius, tyreRadius, tyreWidth, 24);
    tyreGeom.rotateZ(Math.PI / 2);
    const tyreMesh = new THREE.Mesh(tyreGeom, tyreMaterial);
    tyreMesh.castShadow = !lowPower;
    wheelAssembly.add(tyreMesh);

    // Rounded Tyre Shoulder
    const shoulderGeom = new THREE.TorusGeometry(tyreRadius - 0.04, 0.05, 10, 24);
    const shoulderOuter = new THREE.Mesh(shoulderGeom, tyreMaterial);
    shoulderOuter.position.set(tyreWidth / 2, 0, 0);
    shoulderOuter.rotation.y = Math.PI / 2;
    wheelAssembly.add(shoulderOuter);

    // Alloy Rim
    const rimGeom = new THREE.CylinderGeometry(0.28, 0.28, tyreWidth + 0.01, 18);
    rimGeom.rotateZ(Math.PI / 2);
    const rimMesh = new THREE.Mesh(rimGeom, wheelAlloyMaterial);
    wheelAssembly.add(rimMesh);

    // Hubcap with lug bolts
    const hubGeom = new THREE.CylinderGeometry(0.12, 0.12, tyreWidth + 0.03, 16);
    hubGeom.rotateZ(Math.PI / 2);
    const hubMesh = new THREE.Mesh(hubGeom, darkTrimMaterial);
    wheelAssembly.add(hubMesh);

    // 10 Lug Bolts circle
    const boltGeom = new THREE.CylinderGeometry(0.015, 0.015, tyreWidth + 0.04, 6);
    boltGeom.rotateZ(Math.PI / 2);
    for (let b = 0; b < 8; b++) {
      const angle = (b / 8) * Math.PI * 2;
      const bx = (tyreWidth + 0.04) / 2;
      const by = Math.cos(angle) * 0.18;
      const bz = Math.sin(angle) * 0.18;
      const bolt = new THREE.Mesh(boltGeom, chromeMaterial);
      bolt.position.set(0, by, bz);
      wheelAssembly.add(bolt);
    }

    // Inner Ventilated Brake Disc & Caliper
    const discGeom = new THREE.CylinderGeometry(0.22, 0.22, 0.02, 16);
    discGeom.rotateZ(Math.PI / 2);
    const discMesh = new THREE.Mesh(discGeom, brakeDiscMaterial);
    wheelAssembly.add(discMesh);

    const caliperGeom = new THREE.BoxGeometry(0.06, 0.12, 0.12);
    const caliperMat = new THREE.MeshStandardMaterial({
      color: 0xef4444, // Red sport brake caliper
      roughness: 0.4,
    });
    const caliper = new THREE.Mesh(caliperGeom, caliperMat);
    caliper.position.set(0, 0.14, 0.12);
    wheelAssembly.add(caliper);

    return wheelAssembly;
  }

  // Front Left Steering knuckle and wheel
  const frontLeftSteer = new THREE.Group();
  frontLeftSteer.name = 'FrontLeftSteer';
  frontLeftSteer.position.set(-0.96, 0.44, 2.25);
  wheelsGroup.add(frontLeftSteer);

  const frontLeftWheel = createWheelAssembly(false);
  frontLeftWheel.name = 'FrontLeftWheel';
  frontLeftSteer.add(frontLeftWheel);

  // Front Right Steering knuckle and wheel
  const frontRightSteer = new THREE.Group();
  frontRightSteer.name = 'FrontRightSteer';
  frontRightSteer.position.set(0.96, 0.44, 2.25);
  wheelsGroup.add(frontRightSteer);

  const frontRightWheel = createWheelAssembly(false);
  frontRightWheel.name = 'FrontRightWheel';
  frontRightSteer.add(frontRightWheel);

  // Rear Left Dual Commercial Wheel
  const rearLeftWheel = createWheelAssembly(true);
  rearLeftWheel.name = 'RearLeftWheel';
  rearLeftWheel.position.set(-0.96, 0.44, -2.05);
  wheelsGroup.add(rearLeftWheel);

  // Rear Right Dual Commercial Wheel
  const rearRightWheel = createWheelAssembly(true);
  rearRightWheel.name = 'RearRightWheel';
  rearRightWheel.position.set(0.96, 0.44, -2.05);
  wheelsGroup.add(rearRightWheel);

  // Function to update destination board dynamically when route prop changes
  const updateDestinationBoard = (newRoute: string) => {
    const newTex = createDestinationTexture(newRoute);
    if (newTex) {
      if (destinationDisplayMaterial.map) destinationDisplayMaterial.map.dispose();
      destinationDisplayMaterial.map = newTex;
      destinationDisplayMaterial.emissiveMap = newTex;
      destinationDisplayMaterial.needsUpdate = true;
    }
  };

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
    if (destTexture) destTexture.dispose();
    if (decalTexture) decalTexture.dispose();
  };

  return {
    root,
    suspensionGroup,
    bodyGroup,
    doorsGroup,
    interiorGroup,
    roofGroup,
    lightsGroup,
    wheelsGroup,

    frontLeftSteer,
    frontRightSteer,
    frontLeftWheel,
    frontRightWheel,
    rearLeftWheel,
    rearRightWheel,

    frontDoorLeftLeaf,
    frontDoorRightLeaf,
    rearDoorLeftLeaf,
    rearDoorRightLeaf,

    headlightsMaterial,
    brakeLightsMaterial,
    indicatorsMaterial,
    interiorLightsMaterial,
    destinationDisplayMaterial,
    bodyPaintMaterial,

    statusRingMesh,
    statusRingMaterial,

    updateDestinationBoard,
    dispose,
  };
}
