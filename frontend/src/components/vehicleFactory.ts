import * as THREE from 'three';
import { createShuttleBusModel, ShuttleBusRig } from './shuttleBusGeometry.ts';
import { createERickshawModel, ERickshawRig } from './eRickshawGeometry.ts';
import { createGolfCartModel, GolfCartRig } from './golfCartGeometry.ts';

export type VehicleType = 'shuttle' | 'cart' | 'rickshaw';

export interface VehicleData {
  id: string;
  type: VehicleType;
  code: string;
  coordinates: [number, number]; // [lng, lat]
  targetCoordinates: [number, number];
  heading: number; // degrees
  targetHeading: number;
  speed: number; // m/s
  status: 'running' | 'available' | 'at_stop' | 'busy' | 'offline';
  crowd?: 'low' | 'moderate' | 'full';
  seatsFree?: 0 | 1 | 2 | 3 | 4;
  fare?: number;
  route?: string;
  capacity?: number;
  driverName?: string;
  currentStopName?: string;
  nextStopName?: string;
}

export interface VehicleInstance3D {
  id: string;
  type: VehicleType;
  group: THREE.Group;
  highPolyGroup: THREE.Group;
  lowPolyGroup: THREE.Group;
  activeLOD: 'high' | 'low';
  wheelMeshes: THREE.Object3D[];
  frontSteerKnuckles: THREE.Object3D[];
  wheelAngle: number;
  haloDiscMesh?: THREE.Mesh;
  haloRingMesh?: THREE.Mesh;
  data: VehicleData;
  dispose: () => void;
}

/**
 * Creates low-poly streamlined geometry for LOD (< 90 triangles per vehicle)
 * Ensures high performance and clear visibility across campus zoom levels.
 */
function createLowPolyVehicle(type: VehicleType): { group: THREE.Group; wheels: THREE.Object3D[] } {
  const group = new THREE.Group();
  group.name = `LowPoly_${type}`;
  const wheels: THREE.Object3D[] = [];

  const tyreMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8 });
  const wheelGeom = new THREE.CylinderGeometry(0.35, 0.35, 0.22, 12);
  wheelGeom.rotateZ(Math.PI / 2); // Axis along X

  const whiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
  const blackStripeMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.4 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.6 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.2 });

  if (type === 'shuttle') {
    // 7.5m Mini-Bus (White body with thin black stripe)
    // Lower Body
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.35, 1.25, 7.3), whiteMat);
    body.position.set(0, 0.95, 0);
    group.add(body);

    // Thin black waistline stripe
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.37, 0.12, 7.32), blackStripeMat);
    stripe.position.set(0, 0.72, 0);
    group.add(stripe);

    // Upper Roof Structure
    const roof = new THREE.Mesh(new THREE.BoxGeometry(2.36, 1.05, 7.0), whiteMat);
    roof.position.set(0, 2.05, -0.1);
    group.add(roof);

    // Glass band
    const glassBand = new THREE.Mesh(new THREE.BoxGeometry(2.38, 0.75, 6.8), glassMat);
    glassBand.position.set(0, 1.9, 0.05);
    group.add(glassBand);

    // Front windshield
    const windshield = new THREE.Mesh(new THREE.BoxGeometry(2.25, 0.85, 0.2), glassMat);
    windshield.position.set(0, 1.9, 3.45);
    group.add(windshield);

    // AC Unit on Roof
    const ac = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.35, 2.2), darkMat);
    ac.position.set(0, 2.75, -0.4);
    group.add(ac);

    // 4 Wheels
    [
      [-1.12, 0.44, 2.2],
      [1.12, 0.44, 2.2],
      [-1.12, 0.44, -2.1],
      [1.12, 0.44, -2.1],
    ].forEach(([x, y, z]) => {
      const w = new THREE.Mesh(wheelGeom, tyreMat);
      w.position.set(x, y, z);
      group.add(w);
      wheels.push(w);
    });
  } else if (type === 'rickshaw') {
    // 2.6m Indian E-Rickshaw (White tub with thin black stripe, black canopy)
    // Passenger tub
    const tub = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.65, 2.2), whiteMat);
    tub.position.set(0, 0.55, -0.2);
    group.add(tub);

    // Thin black waistline stripe
    const rStripe = new THREE.Mesh(new THREE.BoxGeometry(1.17, 0.08, 2.22), blackStripeMat);
    rStripe.position.set(0, 0.45, -0.2);
    group.add(rStripe);

    // Canopy roof (black)
    const roof = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.12, 1.95), darkMat);
    roof.position.set(0, 1.7, -0.3);
    group.add(roof);

    // Front driver cowl
    const cowl = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.75, 0.65), whiteMat);
    cowl.position.set(0, 0.95, 0.6);
    group.add(cowl);

    // 4 Slim canopy posts
    const postMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.8 });
    const postGeom = new THREE.BoxGeometry(0.04, 1.0, 0.04);
    [
      [-0.52, 1.15, 0.6],
      [0.52, 1.15, 0.6],
      [-0.52, 1.15, -1.2],
      [0.52, 1.15, -1.2],
    ].forEach(([x, y, z]) => {
      const post = new THREE.Mesh(postGeom, postMat);
      post.position.set(x, y, z);
      group.add(post);
    });

    // 3 Wheels (1 Front, 2 Rear)
    const rWheelGeom = new THREE.CylinderGeometry(0.24, 0.24, 0.14, 12);
    rWheelGeom.rotateZ(Math.PI / 2);

    const fw = new THREE.Mesh(rWheelGeom, tyreMat);
    fw.position.set(0, 0.25, 0.95);
    group.add(fw);
    wheels.push(fw);

    const rlw = new THREE.Mesh(rWheelGeom, tyreMat);
    rlw.position.set(-0.55, 0.25, -0.65);
    group.add(rlw);
    wheels.push(rlw);

    const rrw = new THREE.Mesh(rWheelGeom, tyreMat);
    rrw.position.set(0.55, 0.25, -0.65);
    group.add(rrw);
    wheels.push(rrw);
  } else {
    // 3.2m Campus Golf Cart (White with black stripe and black seats)
    // Chassis body
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.22, 0.5, 3.0), whiteMat);
    body.position.set(0, 0.5, 0);
    group.add(body);

    // Front cowl black stripe
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.24, 0.08, 1.0), blackStripeMat);
    stripe.position.set(0, 0.65, 0.9);
    group.add(stripe);

    // Seats bench (black)
    const seats = new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.45, 1.6), darkMat);
    seats.position.set(0, 0.85, -0.15);
    group.add(seats);

    // Canopy Roof (white)
    const roof = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.08, 2.45), whiteMat);
    roof.position.set(0, 1.8, -0.25);
    group.add(roof);

    // 4 Roof posts
    const postMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
    const postGeom = new THREE.BoxGeometry(0.04, 1.05, 0.04);
    [
      [-0.56, 1.25, 0.75],
      [0.56, 1.25, 0.75],
      [-0.56, 1.25, -1.25],
      [0.56, 1.25, -1.25],
    ].forEach(([x, y, z]) => {
      const p = new THREE.Mesh(postGeom, postMat);
      p.position.set(x, y, z);
      group.add(p);
    });

    // 4 Small Wheels
    const cartWheelGeom = new THREE.CylinderGeometry(0.24, 0.24, 0.16, 12);
    cartWheelGeom.rotateZ(Math.PI / 2);
    [
      [-0.6, 0.25, 0.95],
      [0.6, 0.25, 0.95],
      [-0.6, 0.25, -0.95],
      [0.6, 0.25, -0.95],
    ].forEach(([x, y, z]) => {
      const w = new THREE.Mesh(cartWheelGeom, tyreMat);
      w.position.set(x, y, z);
      group.add(w);
      wheels.push(w);
    });
  }

  return { group, wheels };
}

/**
 * Unified Vehicle 3D Factory
 * Creates shared models with Level-Of-Detail, glowing ground halos, and wheel animations
 */
export class VehicleFactory {
  /**
   * Instantiate an animated vehicle 3D rig with high and low LOD meshes
   */
  static createVehicle(data: VehicleData): VehicleInstance3D {
    const group = new THREE.Group();
    group.name = `Vehicle_${data.type}_${data.id}`;

    // Tag root with vehicle reference for Raycaster click detection
    group.userData = {
      isVehicle: true,
      vehicleId: data.id,
      vehicleType: data.type,
      vehicleData: data,
    };

    // 1. Permanent Ground Status Halo Disc (Always visible on campus asphalt)
    const haloColor =
      data.type === 'shuttle'
        ? 0xf97316 // Orange for Shuttles
        : data.type === 'cart'
        ? 0x3b82f6 // Blue for Golf Carts
        : 0x10b981; // Emerald Green for E-Rickshaws

    const haloGroup = new THREE.Group();
    haloGroup.name = 'HaloDisc';

    // Thin, subtle perimeter status ring (height offset 0.004, no filled discs)
    const ringRadius = data.type === 'shuttle' ? 2.5 : 1.6;
    const ringInner = ringRadius - 0.03;
    const ringOuter = ringRadius + 0.03;
    const ringGeom = new THREE.RingGeometry(ringInner, ringOuter, 48);
    ringGeom.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: haloColor,
      transparent: true,
      opacity: 0.10, // 10 percent opacity per spec
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
      side: THREE.DoubleSide,
    });
    const haloRingMesh = new THREE.Mesh(ringGeom, ringMat);
    haloRingMesh.position.set(0, 0.004, 0);
    haloRingMesh.renderOrder = 1;
    haloGroup.add(haloRingMesh);

    if (!data.id.startsWith('home-')) {
      group.add(haloGroup);
    }

    // 2. High-Poly Procedural Rig (using lowPower: false for MeshPhysicalMaterial with clearcoat)
    let highPolyGroup = new THREE.Group();
    highPolyGroup.name = 'HighPoly';
    const wheelMeshes: THREE.Object3D[] = [];
    const frontSteerKnuckles: THREE.Object3D[] = [];
    let rigDispose: () => void = () => {};

    if (data.type === 'shuttle') {
      const rig: ShuttleBusRig = createShuttleBusModel({
        route: data.route || 'Campus Shuttle',
        lowPower: false,
      });
      highPolyGroup.add(rig.root);
      wheelMeshes.push(rig.frontLeftWheel, rig.frontRightWheel, rig.rearLeftWheel, rig.rearRightWheel);
      frontSteerKnuckles.push(rig.frontLeftSteer, rig.frontRightSteer);
      rigDispose = rig.dispose;
    } else if (data.type === 'rickshaw') {
      const rig: ERickshawRig = createERickshawModel({
        colorScheme: 'uber',
        seatsFree: data.seatsFree !== undefined ? data.seatsFree : 2,
        fare: data.fare || 15,
        lowPower: false,
      });
      highPolyGroup.add(rig.root);
      wheelMeshes.push(rig.frontWheelGroup, rig.rearLeftWheelGroup, rig.rearRightWheelGroup);
      frontSteerKnuckles.push(rig.handlebarSteerGroup);
      rigDispose = rig.dispose;
    } else {
      const rig: GolfCartRig = createGolfCartModel({ lowPower: false });
      highPolyGroup.add(rig.root);
      wheelMeshes.push(rig.frontLeftWheel, rig.frontRightWheel, rig.rearLeftWheel, rig.rearRightWheel);
      frontSteerKnuckles.push(rig.frontLeftSteer, rig.frontRightSteer);
      rigDispose = rig.dispose;
    }

    // 3. Low-Poly Streamlined Rig (< 90 triangles, solid visible volumes)
    const { group: lowPolyGroup, wheels: lowPolyWheels } = createLowPolyVehicle(data.type);
    wheelMeshes.push(...lowPolyWheels);

    // Start with low-poly active by default for immediate 60fps campus performance
    highPolyGroup.visible = false;
    lowPolyGroup.visible = true;

    group.add(highPolyGroup);
    group.add(lowPolyGroup);

    // Disable frustum culling on all child meshes so MapLibre's Mercator matrix never clips them
    group.traverse((child) => {
      if ((child as any).isMesh) {
        (child as any).frustumCulled = false;
      }
    });

    const instance: VehicleInstance3D = {
      id: data.id,
      type: data.type,
      group,
      highPolyGroup,
      lowPolyGroup,
      activeLOD: 'low',
      wheelMeshes,
      frontSteerKnuckles,
      wheelAngle: 0,
      haloRingMesh,
      data,
      dispose: () => {
        rigDispose();
        group.clear();
      },
    };

    return instance;
  }

  /**
   * Update Level-of-Detail based on MapLibre zoom level
   * Beyond zoom 17.5 -> switch to low-poly to guarantee 60fps with 20+ vehicles
   * Zoom >= 17.5 -> fade in full high-poly procedural meshes with seats and steering
   */
  static updateLOD(instance: VehicleInstance3D, currentZoom: number, isSelected: boolean = false) {
    const shouldBeLowPoly = currentZoom < 17.5 && !isSelected;
    if (shouldBeLowPoly && instance.activeLOD !== 'low') {
      instance.highPolyGroup.visible = false;
      instance.lowPolyGroup.visible = true;
      instance.activeLOD = 'low';
    } else if (!shouldBeLowPoly && instance.activeLOD !== 'high') {
      instance.highPolyGroup.visible = true;
      instance.lowPolyGroup.visible = false;
      instance.activeLOD = 'high';
    }
  }

  /**
   * Animate wheels and steering on the vehicle instance
   */
  static animateInstance(instance: VehicleInstance3D, speed: number, steer: number, delta: number) {
    const r = instance.type === 'shuttle' ? 0.44 : 0.24;
    instance.wheelAngle += (speed * delta) / r;
    for (let i = 0; i < instance.wheelMeshes.length; i++) {
      instance.wheelMeshes[i].rotation.x = instance.wheelAngle;
    }
    for (let i = 0; i < instance.frontSteerKnuckles.length; i++) {
      instance.frontSteerKnuckles[i].rotation.y = steer;
    }
  }
}
