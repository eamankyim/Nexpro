#!/usr/bin/env node
/**
 * Print API URL for mobile device testing.
 * Use: npm run show-api-url
 * On a physical device, use the LAN IP (not localhost).
 */
const os = require('os');

const nets = os.networkInterfaces();
const addresses = [];

for (const name of Object.keys(nets)) {
  for (const n of nets[name]) {
    if (n.family === 'IPv4' && !n.internal) {
      addresses.push(n.address);
    }
  }
}

const port = process.env.BACKEND_PORT || process.env.PORT || '5001';
const uniq = [...new Set(addresses)].filter(Boolean);

console.log('\nMobile API URL for device testing:\n');
if (uniq.length) {
  uniq.forEach((ip) => {
    console.log(`  EXPO_PUBLIC_API_URL=http://${ip}:${port}`);
  });
  console.log('\nAdd to mobile/.env when testing on a physical device.\n');
} else {
  console.log('  No LAN IP found. Use EXPO_PUBLIC_API_URL=http://localhost:' + port + ' for simulator.\n');
}
