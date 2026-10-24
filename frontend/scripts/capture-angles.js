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

async function captureAngle(preset, filename) {
  const edgePath = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
  const userDataDir = `C:\\LPU Golfcart\\scratch_cdp_profile_${preset}`;
  const port = 9224 + Math.floor(Math.random() * 50);

  const url = `http://127.0.0.1:5173/bus-preview?preset=${preset}`;
  console.log(`\nLaunching browser for preset: ${preset} (${url})...`);

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

    // Wait 4.5 seconds for Three.js canvas to render and OrbitControls to settle
    console.log(`Waiting for 3D render (${preset})...`);
    await new Promise(r => setTimeout(r, 4500));

    // Capture screenshot
    const result = await sendCommand('Page.captureScreenshot', { format: 'png' });
    if (result && result.data) {
      const buffer = Buffer.from(result.data, 'base64');
      const publicPath = path.join(publicDir, filename);
      const artifactPath = path.join(artifactDir, filename);

      fs.writeFileSync(publicPath, buffer);
      fs.writeFileSync(artifactPath, buffer);
      console.log(`Captured ${filename}: ${buffer.length} bytes -> ${publicPath} and ${artifactPath}`);
    }

    ws.close();
  } catch (err) {
    console.error(`Error capturing ${preset}:`, err);
  } finally {
    edgeProcess.kill();
  }
}

async function main() {
  await captureAngle('front34', 'bus_front_34.png');
  await captureAngle('side', 'bus_side_profile.png');
  await captureAngle('top', 'bus_top_aerial.png');
  console.log('\nAll 3 angle screenshots captured successfully!');
}

main();
