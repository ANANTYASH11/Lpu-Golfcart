const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const edgePath = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const userDataDir = "C:\\LPU Golfcart\\scratch_cdp_profile_phase7";
const port = 9246;

const fareShotPath = path.resolve(__dirname, 'docs', 'screenshots', 'phase7_fare_calculator.png');
const menuShotPath = path.resolve(__dirname, 'docs', 'screenshots', 'phase7_menu_overlay.png');

async function run() {
  console.log('Capturing Phase 7 Fare Calculator and Menu Overlay...');
  const edgeProcess = spawn(edgePath, [
    `--remote-debugging-port=${port}`,
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    `--user-data-dir=${userDataDir}`,
    '--window-size=1440,900',
    'http://127.0.0.1:5173/fare-calc'
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

    // 1. Capture Fare Calculator View
    const fareShot = await sendCommand('Page.captureScreenshot', { format: 'png' });
    fs.mkdirSync(path.dirname(fareShotPath), { recursive: true });
    fs.writeFileSync(fareShotPath, Buffer.from(fareShot.data, 'base64'));
    console.log(`Saved Fare Calculator screenshot to: ${fareShotPath}`);

    // 2. Navigate to Home and open the Menu Overlay
    await sendCommand('Page.navigate', { url: 'http://127.0.0.1:5173/' });
    await new Promise(r => setTimeout(r, 3000));

    // Click the Menu hamburger button on Home page
    await sendCommand('Runtime.evaluate', {
      expression: `
        const menuBtn = document.querySelector('button[aria-label="Open Menu"]') || 
                        Array.from(document.querySelectorAll('button')).find(b => b.querySelector('svg.lucide-menu'));
        if (menuBtn) {
          menuBtn.click();
        } else {
          console.warn("Could not find menu button");
        }
      `
    });

    await new Promise(r => setTimeout(r, 1500));

    // Capture Menu Overlay
    const menuShot = await sendCommand('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(menuShotPath, Buffer.from(menuShot.data, 'base64'));
    console.log(`Saved Menu Overlay screenshot to: ${menuShotPath}`);

    ws.close();
  } catch (err) {
    console.error('Error during Phase 7 capture:', err);
  } finally {
    edgeProcess.kill();
  }
}

run();
