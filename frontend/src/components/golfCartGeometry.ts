import * as THREE from 'three';

export interface GolfCartModelOptions {
  lowPower?: boolean;
}

export interface GolfCartRig {
  root: THREE.Group;
  bodyGroup: THREE.Group;
  steeringGroup: THREE.Group;
  frontLeftSteer: THREE.Group;
  frontRightSteer: THREE.Group;
  frontLeftWheel: THREE.Group;
  frontRightWheel: THREE.Group;
  rearLeftWheel: THREE.Group;
  rearRightWheel: THREE.Group;
  roofGroup: THREE.Group;
  seatsGroup: THREE.Group;
  lightsGroup: THREE.Group;

  headlightsMaterial: THREE.MeshStandardMaterial;
  brakeLightsMaterial: THREE.MeshStandardMaterial;
  bodyPaintMaterial: THREE.MeshPhysicalMaterial | THREE.MeshStandardMaterial;
  statusRingMaterial: THREE.MeshBasicMaterial;

  dispose: () => void;
}

/**
 * Creates procedural 3D Campus Golf Cart (Electric 4-6 Seater)
 * Real-world dimensions: 3.2m long, 1.25m wide, 1.85m tall
 * Triangle count: ~3.5k - 4.5k triangles
 */
export function createGolfCartModel(options: GolfCartModelOptions = {}): GolfCartRig {
  const { lowPower = false } = options;

  const root = new THREE.Group();
  root.name = 'GolfCartRoot';

  // Materials
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
      });

  const orangeStripeMaterial = new THREE.MeshStandardMaterial({
    color: 0x0a0a0a, // Thin black waistline stripe
    roughness: 0.35,
    metalness: 0.1,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });

  const darkTrimMaterial = new THREE.MeshStandardMaterial({
    color: 0x18181b,
    roughness: 0.65,
    metalness: 0.2,
  });

  const chromeMaterial = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    roughness: 0.15,
    metalness: 0.85,
  });

  const vinylSeatMaterial = new THREE.MeshStandardMaterial({
    color: 0x141416, // Black seats
    roughness: 0.65,
    metalness: 0.05,
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
        color: 0xffffff, // Pure neutral clear glass (no cyan/yellow tint)
        transparent: true,
        opacity: 0.25,
        roughness: 0.04,
        transmission: 0.85,
        ior: 1.45,
        depthWrite: false,
      });

  const tyreMaterial = new THREE.MeshStandardMaterial({
    color: 0x141416,
    roughness: 0.85,
    metalness: 0.05,
  });

  const headlightsMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xffffff,
    emissiveIntensity: 2.2,
    roughness: 0.1,
  });

  const brakeLightsMaterial = new THREE.MeshStandardMaterial({
    color: 0xef4444,
    emissive: 0xdc2626,
    emissiveIntensity: 0.8,
    roughness: 0.2,
  });

  const statusRingMaterial = new THREE.MeshBasicMaterial({
    color: 0x276EF1, // Uber accent blue status ring
    transparent: true,
    opacity: 0.10, // 10 percent opacity per spec
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
    side: THREE.DoubleSide,
  });

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

  const lightsGroup = new THREE.Group();
  lightsGroup.name = 'Lights';
  bodyGroup.add(lightsGroup);

  // Chassis & Floor
  const chassisGeom = new THREE.BoxGeometry(1.05, 0.08, 2.9);
  const chassis = new THREE.Mesh(chassisGeom, darkTrimMaterial);
  chassis.position.set(0, 0.28, 0);
  chassis.castShadow = !lowPower;
  bodyGroup.add(chassis);

  // Front Cowl / Hood with beveled edges
  const hoodShape = new THREE.Shape();
  hoodShape.moveTo(-0.54, -0.21);
  hoodShape.lineTo(0.54, -0.21);
  hoodShape.lineTo(0.52, 0.21);
  hoodShape.lineTo(-0.52, 0.21);
  hoodShape.closePath();

  const hoodGeom = new THREE.ExtrudeGeometry(hoodShape, {
    depth: 0.85,
    bevelEnabled: true,
    bevelSegments: 3,
    steps: 1,
    bevelSize: 0.03,
    bevelThickness: 0.03,
  });
  hoodGeom.center();
  const hood = new THREE.Mesh(hoodGeom, bodyPaintMaterial);
  hood.position.set(0, 0.58, 1.05);
  hood.castShadow = !lowPower;
  bodyGroup.add(hood);

  // Thin black waistline stripe on hood
  const hoodStripeGeom = new THREE.BoxGeometry(1.10, 0.05, 0.88);
  const hoodStripe = new THREE.Mesh(hoodStripeGeom, orangeStripeMaterial);
  hoodStripe.position.set(0, 0.52, 1.05);
  bodyGroup.add(hoodStripe);

  // Front Grille & Bumper
  const fGrilleGeom = new THREE.BoxGeometry(0.72, 0.18, 0.06);
  const fGrille = new THREE.Mesh(fGrilleGeom, darkTrimMaterial);
  fGrille.position.set(0, 0.52, 1.48);
  bodyGroup.add(fGrille);

  const fBumperGeom = new THREE.BoxGeometry(1.15, 0.16, 0.14);
  const fBumper = new THREE.Mesh(fBumperGeom, darkTrimMaterial);
  fBumper.position.set(0, 0.35, 1.48);
  bodyGroup.add(fBumper);

  // Split Fold-down Windshield (Neutral clear, depthWrite: false)
  const wsGeom = new THREE.PlaneGeometry(1.02, 0.65);
  const ws = new THREE.Mesh(wsGeom, glassMaterial);
  ws.position.set(0, 1.15, 0.62);
  ws.rotation.x = -0.15;
  ws.renderOrder = 10;
  bodyGroup.add(ws);

  // Rear Tub / Quarter Panels with beveled edges
  const rearTubShape = new THREE.Shape();
  rearTubShape.moveTo(-0.58, -0.22);
  rearTubShape.lineTo(0.58, -0.22);
  rearTubShape.lineTo(0.57, 0.22);
  rearTubShape.lineTo(-0.57, 0.22);
  rearTubShape.closePath();

  const rearTubGeom = new THREE.ExtrudeGeometry(rearTubShape, {
    depth: 1.3,
    bevelEnabled: true,
    bevelSegments: 3,
    steps: 1,
    bevelSize: 0.03,
    bevelThickness: 0.03,
  });
  rearTubGeom.center();
  const rearTub = new THREE.Mesh(rearTubGeom, bodyPaintMaterial);
  rearTub.position.set(0, 0.58, -0.65);
  rearTub.castShadow = !lowPower;
  bodyGroup.add(rearTub);

  const rearTubStripeGeom = new THREE.BoxGeometry(1.18, 0.05, 1.32);
  const rearTubStripe = new THREE.Mesh(rearTubStripeGeom, orangeStripeMaterial);
  rearTubStripe.position.set(0, 0.52, -0.65);
  bodyGroup.add(rearTubStripe);

  // Steering Column & Wheel
  const steeringGroup = new THREE.Group();
  steeringGroup.name = 'Steering';
  steeringGroup.position.set(0.32, 0.72, 0.55);
  bodyGroup.add(steeringGroup);

  const colGeom = new THREE.CylinderGeometry(0.02, 0.02, 0.45, 8);
  colGeom.rotateX(0.5);
  const col = new THREE.Mesh(colGeom, darkTrimMaterial);
  col.position.set(0, 0.15, -0.08);
  steeringGroup.add(col);

  const wheelTorus = new THREE.TorusGeometry(0.16, 0.018, 8, 16);
  wheelTorus.rotateX(0.5);
  const steerWheel = new THREE.Mesh(wheelTorus, darkTrimMaterial);
  steerWheel.position.set(0, 0.32, -0.16);
  steeringGroup.add(steerWheel);

  // Seating: Front Bench & Rear Bench
  const benchCushionGeom = new THREE.BoxGeometry(0.98, 0.12, 0.42);
  const benchBackGeom = new THREE.BoxGeometry(0.98, 0.32, 0.08);

  // Front Bench (Seats driver & 1 passenger)
  const fCushion = new THREE.Mesh(benchCushionGeom, vinylSeatMaterial);
  fCushion.position.set(0, 0.66, 0.05);
  seatsGroup.add(fCushion);

  const fBack = new THREE.Mesh(benchBackGeom, vinylSeatMaterial);
  fBack.position.set(0, 0.95, -0.14);
  seatsGroup.add(fBack);

  // Rear Bench (Seats 2 passengers, rearward-facing)
  const rCushion = new THREE.Mesh(benchCushionGeom, vinylSeatMaterial);
  rCushion.position.set(0, 0.66, -0.72);
  seatsGroup.add(rCushion);

  const rBack = new THREE.Mesh(benchBackGeom, vinylSeatMaterial);
  rBack.position.set(0, 0.95, -0.52);
  seatsGroup.add(rBack);

  // Rear Step / Footrest
  const rStepGeom = new THREE.BoxGeometry(0.85, 0.04, 0.32);
  const rStep = new THREE.Mesh(rStepGeom, darkTrimMaterial);
  rStep.position.set(0, 0.28, -1.45);
  bodyGroup.add(rStep);

  // Roof Struts (4 tubular black struts)
  [-0.52, 0.52].forEach((px) => {
    const fStrut = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 1.25, 8), darkTrimMaterial);
    fStrut.position.set(px, 1.22, 0.55);
    fStrut.rotation.x = -0.15;
    roofGroup.add(fStrut);

    const rStrut = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 1.22, 8), darkTrimMaterial);
    rStrut.position.set(px, 1.20, -1.15);
    roofGroup.add(rStrut);
  });

  // Smooth Curved Aerodynamic Roof Canopy with beveled edges
  const canopyShape = new THREE.Shape();
  canopyShape.moveTo(-0.62, 0);
  canopyShape.quadraticCurveTo(0, 0.06, 0.62, 0);
  canopyShape.lineTo(0.61, -0.04);
  canopyShape.quadraticCurveTo(0, 0.02, -0.61, -0.04);
  canopyShape.closePath();

  const canopyGeom = new THREE.ExtrudeGeometry(canopyShape, {
    depth: 2.5,
    bevelEnabled: true,
    bevelSegments: 4,
    steps: 1,
    bevelSize: 0.03,
    bevelThickness: 0.03,
  });
  canopyGeom.center();
  const canopy = new THREE.Mesh(canopyGeom, bodyPaintMaterial);
  canopy.position.set(0, 1.84, -0.28);
  canopy.castShadow = !lowPower;
  roofGroup.add(canopy);

  // Flush Modern LED Headlights & Tail Lights with bezels
  [-0.36, 0.36].forEach((lx) => {
    const bezel = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.10, 0.04), darkTrimMaterial);
    bezel.position.set(lx, 0.60, 1.47);
    lightsGroup.add(bezel);

    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.07, 0.05), headlightsMaterial);
    hl.position.set(lx, 0.60, 1.48);
    lightsGroup.add(hl);

    const tlBezel = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.04), darkTrimMaterial);
    tlBezel.position.set(lx, 0.52, -1.30);
    lightsGroup.add(tlBezel);

    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.05, 0.05), brakeLightsMaterial);
    tl.position.set(lx, 0.52, -1.31);
    lightsGroup.add(tl);
  });

  // Wheel Factory
  function createCartWheel(): THREE.Group {
    const wg = new THREE.Group();
    const tyre = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.16, 16), tyreMaterial);
    tyre.rotateZ(Math.PI / 2);
    wg.add(tyre);

    const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.165, 14), chromeMaterial);
    rim.rotateZ(Math.PI / 2);
    wg.add(rim);

    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.18, 8), darkTrimMaterial);
    hub.rotateZ(Math.PI / 2);
    wg.add(hub);

    return wg;
  }

  // Front Wheels with Steering Knuckles
  const frontLeftSteer = new THREE.Group();
  frontLeftSteer.position.set(-0.54, 0.24, 0.95);
  root.add(frontLeftSteer);
  const frontLeftWheel = createCartWheel();
  frontLeftSteer.add(frontLeftWheel);

  const frontRightSteer = new THREE.Group();
  frontRightSteer.position.set(0.54, 0.24, 0.95);
  root.add(frontRightSteer);
  const frontRightWheel = createCartWheel();
  frontRightSteer.add(frontRightWheel);

  // Rear Wheels
  const rearLeftWheel = createCartWheel();
  rearLeftWheel.position.set(-0.54, 0.24, -0.85);
  root.add(rearLeftWheel);

  const rearRightWheel = createCartWheel();
  rearRightWheel.position.set(0.54, 0.24, -0.85);
  root.add(rearRightWheel);

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
  };

  return {
    root,
    bodyGroup,
    steeringGroup,
    frontLeftSteer,
    frontRightSteer,
    frontLeftWheel,
    frontRightWheel,
    rearLeftWheel,
    rearRightWheel,
    roofGroup,
    seatsGroup,
    lightsGroup,

    headlightsMaterial,
    brakeLightsMaterial,
    bodyPaintMaterial,
    statusRingMaterial,

    dispose,
  };
}
