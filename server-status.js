#!/usr/bin/env node
/**
 * server-status.js - Check dev server state
 *
 * Usage: npm run status
 *
 * Returns:
 * - RUNNING: Server is up and responsive on http://localhost:6660
 * - STOPPED: Port 6660 is not in use
 * - UNRESPONSIVE: Port is open but server isn't responding
 */

const http = require('http');
const net = require('net');

async function checkPort(port) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(1000);

    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });

    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });

    socket.on('error', () => {
      resolve(false);
    });

    socket.connect(port, 'localhost');
  });
}

async function pingServer() {
  return new Promise((resolve) => {
    const req = http.get('http://localhost:6660/', { timeout: 2000 }, (res) => {
      resolve(res.statusCode === 200 || res.statusCode === 404 || res.statusCode === 500);
    });

    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function checkServerStatus() {
  try {
    const portOpen = await checkPort(6660);

    if (!portOpen) {
      console.log('STATUS: STOPPED');
      console.log('Port 6660 is not in use.');
      console.log('\nTo start: npm run dev');
      return;
    }

    const responsive = await pingServer();

    if (responsive) {
      console.log('STATUS: RUNNING ✓');
      console.log('Dev server is up and responsive at http://localhost:6660');
    } else {
      console.log('STATUS: UNRESPONSIVE ⚠');
      console.log('Port 6660 is open but server is not responding.');
      console.log('Try: npm run dev');
    }
  } catch (error) {
    console.error('Error checking server status:', error.message);
    process.exit(1);
  }
}

checkServerStatus();
