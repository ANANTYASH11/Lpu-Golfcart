const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const edgePath = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const userDataDir = "C:\\LPU Golfcart\\scratch_cdp_profile_active_sos";
const port = 9245;
const screenshotPath = path.resolve(__dirname, 'docs', 'screenshots', 'phase6_safety_active.png');

async function triggerViaApi() {
  // Login as student to get token and trigger SOS
  const loginRes = await fetch('http://127.0.0.1:8000/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'rohit_student', password: 'student123' })
  });
  const { access_token } = await loginRes.json();
  const triggerRes = await fetch('http://127.0.0.1:8000/api/v1/safety/sos/trigger', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${access_token}`
    },
    body: JSON.stringify({
      latitude: 31.2530,
      longitude: 75.7050,
      accuracy_meters: 4.1,
      battery_level: 82,
      is_test: true,
      trigger_type: 'MANUAL_HOLD',
      notes: 'Campus Safety Drill / Active Simulation'
    })
  });
  const sos = await triggerRes.json();
  console.log('Triggered SOS Beacon:', sos.id);
  return { token: access_token, sosId: sos.id };
}

async function run() {
  const { token, sosId } = await triggerViaApi();

  console.log('Capturing Active SOS Beacon HUD...');
  const edgeProcess = spawn(edgePath, [
    `--remote-debugging-port=${port}`,
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    `--user-data-dir=${userDataDir}`,
    '--window-size=1440,900',
    'http://127.0.0.1:5173/safety'
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

    // Inject student token into localStorage so page picks up active beacon
    await sendCommand('Runtime.evaluate', {
      expression: `
        localStorage.setItem('unicart_token', '${token}');
        localStorage.setItem('token', '${token}');
        localStorage.setItem('auth_token', '${token}');
        window.location.reload();
      `
    });

    await new Promise(r => setTimeout(r, 4000));

    const shot = await sendCommand('Page.captureScreenshot', { format: 'png' });
    fs.mkdirSync(path.dirname(screenshotPath), { recursive: true });
    fs.writeFileSync(screenshotPath, Buffer.from(shot.data, 'base64'));
    console.log(`Saved active SOS screenshot to: ${screenshotPath}`);

    // Resolve SOS so test state is clean
    await fetch(`http://127.0.0.1:8000/api/v1/safety/sos/${sosId}/resolve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ resolution_notes: 'Drill verified by automated screenshot check' })
    });
    console.log('Resolved test SOS beacon:', sosId);

    ws.close();
  } catch (err) {
    console.error('Error:', err);
  } finally {
    edgeProcess.kill();
  }
}

run();
