import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { createShuttleBusModel } from '../src/components/shuttleBusGeometry.ts';

// Polyfill FileReader for Node.js
class PolyfillFileReader {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then(buf => {
      this.result = buf;
      if (this.onloadend) this.onloadend();
      if (this.onload) this.onload();
    });
  }
}
globalThis.FileReader = PolyfillFileReader;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const outputDir = path.resolve(__dirname, '../public/models');
const outputPath = path.join(outputDir, 'shuttle-bus.glb');

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

console.log('Generating procedural 3D Campus Shuttle Bus model...');
const rig = createShuttleBusModel({
  route: 'Route 1 - Uni-Mall Loop',
  lowPower: false
});

// Calculate triangle and vertex counts
let totalTriangles = 0;
let totalVertices = 0;
let totalMeshes = 0;

rig.root.traverse((obj) => {
  if (obj instanceof THREE.Mesh && obj.geometry) {
    totalMeshes++;
    const geom = obj.geometry;
    if (geom.index) {
      totalTriangles += geom.index.count / 3;
    } else if (geom.attributes.position) {
      totalTriangles += geom.attributes.position.count / 3;
    }
    if (geom.attributes.position) {
      totalVertices += geom.attributes.position.count;
    }
  }
});

console.log('--- Model Statistics ---');
console.log(`Total Meshes: ${totalMeshes}`);
console.log(`Total Triangles: ${Math.round(totalTriangles)} (Target: < 25,000)`);
console.log(`Total Vertices: ${totalVertices}`);

const exporter = new GLTFExporter();
exporter.parse(
  rig.root,
  (gltf) => {
    fs.writeFileSync(outputPath, Buffer.from(gltf));
    const fileSizeKb = (fs.statSync(outputPath).size / 1024).toFixed(2);
    console.log(`Successfully exported binary GLB model: ${outputPath} (${fileSizeKb} KB)`);
    process.exit(0);
  },
  (error) => {
    console.error('Failed to export GLTF/GLB:', error);
    process.exit(1);
  },
  { binary: true }
);
