#!/usr/bin/env node
/**
 * Print this machine's LAN IP(s) for phone testing.
 * Use: npm run show-ip
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

const uniq = [...new Set(addresses)].filter(Boolean);
if (uniq.length) {
  console.log('LAN IP(s) for phone testing (use with port 3000):');
  uniq.forEach((ip) => console.log(`  http://${ip}:3000`));
} else {
  console.log('No LAN IP found. Check Wi‑Fi is connected and run: ifconfig | grep "inet "');
}
