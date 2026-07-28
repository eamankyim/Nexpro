#!/usr/bin/env node
/**
 * Print API URL for mobile device testing.
 * Use: npm run show-api-url
 * On a physical device, use the LAN IP (not localhost).
 *
 * Probes local Backend /health so the printed port matches what is actually
 * listening (Backend may auto-bump when PORT is busy, e.g. 5001 → 5002).
 */
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');

const nets = os.networkInterfaces();
const addresses = [];

for (const name of Object.keys(nets)) {
  for (const n of nets[name]) {
    if (n.family === 'IPv4' && !n.internal) {
      addresses.push(n.address);
    }
  }
}

function readBackendPortFromEnv() {
  try {
    const envPath = path.resolve(__dirname, '..', '..', 'Backend', '.env');
    const raw = fs.readFileSync(envPath, 'utf8');
    const match = raw.match(/^\s*PORT\s*=\s*(\d+)\s*$/m);
    if (match) return Number(match[1]);
  } catch {
    // ignore missing Backend/.env
  }
  return null;
}

function probeHealth(port, timeoutMs = 800) {
  return new Promise((resolve) => {
    const req = http.get(
      {
        hostname: '127.0.0.1',
        port,
        path: '/health',
        timeout: timeoutMs,
      },
      (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => {
          const ok =
            res.statusCode === 200 &&
            /Server is running|"success"\s*:\s*true/i.test(body);
          resolve(ok);
        });
      }
    );
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
    req.on('error', () => resolve(false));
  });
}

async function findAbsBackendPort(preferredPort) {
  const start = Number(preferredPort) || 5001;
  const candidates = [];
  for (let p = start; p <= start + 10; p += 1) candidates.push(p);
  for (const fallback of [5001, 5002, 5000]) {
    if (!candidates.includes(fallback)) candidates.push(fallback);
  }

  for (const port of candidates) {
    // eslint-disable-next-line no-await-in-loop
    if (await probeHealth(port)) return port;
  }
  return null;
}

async function main() {
  const configuredPort =
    Number(process.env.BACKEND_PORT || process.env.PORT) ||
    readBackendPortFromEnv() ||
    5001;
  const detectedPort = await findAbsBackendPort(configuredPort);
  const port = detectedPort || configuredPort;
  const uniq = [...new Set(addresses)].filter(Boolean);

  console.log('\nMobile API URL for device testing:\n');
  if (uniq.length) {
    uniq.forEach((ip) => {
      console.log(`  EXPO_PUBLIC_API_URL=http://${ip}:${port}`);
    });
  } else {
    console.log(`  EXPO_PUBLIC_API_URL=http://localhost:${port}`);
  }

  if (detectedPort) {
    console.log(`\nDetected ABS Backend on port ${detectedPort} (GET /health ok).`);
    if (detectedPort !== configuredPort) {
      console.log(
        `Note: configured PORT=${configuredPort} but Backend is listening on ${detectedPort} (port bump).`
      );
    }
  } else {
    console.log(
      `\nCould not reach ABS Backend /health on ports ${configuredPort}-${configuredPort + 10}.`
    );
    console.log('Start Backend first, then re-run this script and update mobile/.env.');
  }

  console.log('\nAdd the matching line to mobile/.env, then restart Expo (npx expo start --clear).\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
