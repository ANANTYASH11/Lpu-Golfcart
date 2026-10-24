import http from 'http';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const artifactDir = 'C:\\Users\\Administrator\\.gemini\\antigravity-ide\\brain\\f1946bcf-f80c-4595-86c4-3b77f7283a64';
const publicDir = path.resolve(__dirname, '../public/screenshots');

if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}
if (!fs.existsSync(artifactDir)) {
  fs.mkdirSync(artifactDir, { recursive: true });
}

async function captureMapFleet() {
  const edgePath = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
  const userDataDir = `C:\\LPU Golfcart\\scratch_cdp_profile_map_fleet`;
  const port = 9310;

  const url = `http://127.0.0.1:5173/map-fleet`;
  console.log(`\nLaunching browser for MapLibre 3D Fleet (${url})...`);

  const edgeProcess = spawn(edgePath, [
    `--remote-debugging-port=${port}`,
    '--headless=new',
    '--enable-webgl',
    '--use-gl=angle',
    '--hide-scrollbars',
    '--mute-audio',
    `--user-data-dir=${userDataDir}`,
    '--window-size=1400,900',
    url
  ], { detached: false });

  // Wait 2.5s for Edge to start CDP port
  await new Promise(r => setTimeout(r, 2500));

  try {
    const targets = await new Promise((resolve, reject) => {
      http.get(`http://127.0.0.1:${port}/json`, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve(JSON.parse(data)));
      }).on('error', reject);
    });

    const pageTarget = targets.find(t => t.type === 'page' && t.url.includes('5173')) || targets[0];
    if (!pageTarget || !pageTarget.webSocketDebuggerUrl) {
      throw new Error("No page target found");
    }

    const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      ws.onopen = resolve;
      ws.onerror = reject;
    });

    let msgId = 1;
    function sendCommand(method, params = {}) {
      return new Promise((resolve) => {
        const id = msgId++;
        const handler = (evt) => {
          const resp = JSON.parse(evt.data);
          if (resp.id === id) {
            ws.removeEventListener('message', handler);
            resolve(resp.result);
          }
        };
        ws.addEventListener('message', handler);
        ws.send(JSON.stringify({ id, method, params }));
      });
    }

    // Wait 5 seconds for MapLibre tiles and Three.js 3D custom layer to render
    console.log(`Waiting for MapLibre 3D fleet layer to initialize...`);
    await new Promise(r => setTimeout(r, 5500));

    // 1. Capture Map Overview
    const result1 = await sendCommand('Page.captureScreenshot', { format: 'png' });
    if (result1 && result1.data) {
      const buffer = Buffer.from(result1.data, 'base64');
      fs.writeFileSync(path.join(publicDir, 'map_fleet_overview.png'), buffer);
      fs.writeFileSync(path.join(artifactDir, 'map_fleet_overview.png'), buffer);
      console.log(`Captured map_fleet_overview.png (${buffer.length} bytes)`);
    }

    // 2. Select vehicle PB-101 via exposed handle or click
    await sendCommand('Runtime.evaluate', {
      expression: `(() => {
        if (window.__selectVehicle && window.__campusFleet && window.__campusFleet.length > 0) {
          window.__selectVehicle(window.__campusFleet[0]);
        }
      })()`
    });

    await new Promise(r => setTimeout(r, 1200));

    // 3. Capture with Bottom Sheet
    const result2 = await sendCommand('Page.captureScreenshot', { format: 'png' });
    if (result2 && result2.data) {
      const buffer = Buffer.from(result2.data, 'base64');
      fs.writeFileSync(path.join(publicDir, 'map_fleet_bottom_sheet.png'), buffer);
      fs.writeFileSync(path.join(artifactDir, 'map_fleet_bottom_sheet.png'), buffer);
      console.log(`Captured map_fleet_bottom_sheet.png (${buffer.length} bytes)`);
    }

    // 4. Zoom in close to UniMall at zoom 18.2 with high pitch
    await sendCommand('Runtime.evaluate', {
      expression: `(() => {
        if (window.__campusMap) {
          window.__campusMap.jumpTo({
            center: [75.7058, 31.2548],
            zoom: 18.2,
            pitch: 58,
            bearing: -15
          });
        }
      })()`
    });

    await new Promise(r => setTimeout(r, 3000));

    const result3 = await sendCommand('Page.captureScreenshot', { format: 'png' });
    if (result3 && result3.data) {
      const buffer = Buffer.from(result3.data, 'base64');
      fs.writeFileSync(path.join(publicDir, 'map_fleet_vehicles_zoom.png'), buffer);
      fs.writeFileSync(path.join(artifactDir, 'map_fleet_vehicles_zoom.png'), buffer);
      console.log(`Captured map_fleet_vehicles_zoom.png (${buffer.length} bytes)`);
    }

    ws.close();
  } catch (err) {
    console.error(`Error capturing MapFleet:`, err);
  } finally {
    edgeProcess.kill();
  }
}

captureMapFleet();
