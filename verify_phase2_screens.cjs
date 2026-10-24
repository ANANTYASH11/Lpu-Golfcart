const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const edgePath = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const userDataDir = "C:\\LPU Golfcart\\scratch_cdp_profile_phase2";
const port = 9240;

async function captureUrl(url, outFilePath) {
  console.log(`Launching Edge to capture ${url}...`);
  const edgeProcess = spawn(edgePath, [
    `--remote-debugging-port=${port}`,
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    `--user-data-dir=${userDataDir}`,
    '--window-size=1440,900',
    url
  ], { detached: false });

  await new Promise(r => setTimeout(r, 3000));

  try {
    const targets = await new Promise((resolve, reject) => {
      http.get(`http://127.0.0.1:${port}/json`, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve(JSON.parse(data)));
      }).on('error', reject);
    });

    const pageTarget = targets.find(t => t.type === 'page' && t.url.includes('5173')) || targets.find(t => t.type === 'page');
    if (!pageTarget) throw new Error("No page target found");

    const WebSocket = global.WebSocket || require('ws');
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
          const res = JSON.parse(evt.data);
          if (res.id === id) {
            ws.removeEventListener('message', handler);
            resolve(res.result);
          }
        };
        ws.addEventListener('message', handler);
        ws.send(JSON.stringify({ id, method, params }));
      });
    }

    await sendCommand('Page.enable');
    await new Promise(r => setTimeout(r, 3500));

    const shot = await sendCommand('Page.captureScreenshot', { format: 'png' });
    fs.mkdirSync(path.dirname(outFilePath), { recursive: true });
    fs.writeFileSync(outFilePath, Buffer.from(shot.data, 'base64'));
    console.log(`Saved screenshot to: ${outFilePath}`);

    ws.close();
  } catch (err) {
    console.error(`Error capturing ${url}:`, err);
  } finally {
    edgeProcess.kill();
    await new Promise(r => setTimeout(r, 1000));
  }
}

async function run() {
  const shuttlesPath = path.resolve(__dirname, 'docs', 'screenshots', 'phase2_shuttles.png');
  const timetablePath = path.resolve(__dirname, 'docs', 'screenshots', 'phase2_timetable.png');

  await captureUrl('http://127.0.0.1:5173/shuttles', shuttlesPath);
  await captureUrl('http://127.0.0.1:5173/timetable', timetablePath);
  console.log('Phase 2 capture complete.');
}

run();
