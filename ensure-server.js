#!/usr/bin/env node
/**
 * ensure-server.js - Automatically ensure dev server is running
 *
 * Usage: npm run ensure-server
 *
 * This script:
 * 1. Checks if server is already running
 * 2. If not, starts it automatically
 * 3. Waits for it to be responsive
 * 4. Returns silently on success, exits with error on failure
 *
 * The agent should call this automatically before any task requiring the server.
 */

const { spawn } = require('child_process');
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
      resolve(true);
    });

    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function waitForServer(maxWait = 30000) {
  const startTime = Date.now();

  while (Date.now() - startTime < maxWait) {
    const responsive = await pingServer();
    if (responsive) return true;
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  return false;
}

async function ensureServer() {
  try {
    // Check if already running
    const portOpen = await checkPort(6660);

    if (portOpen) {
      const responsive = await pingServer();
      if (responsive) {
        // Already running and responsive
        process.exit(0);
      }
    }

    // Port not open or not responsive - start the server
    console.log('Starting dev server on port 6660...');

    const server = spawn('npm', ['run', 'dev'], {
      stdio: 'pipe',
      detached: false
    });

    // Suppress output to keep things clean
    server.stdout.on('data', () => {});
    server.stderr.on('data', () => {});

    // Wait for server to be responsive
    const ready = await waitForServer();

    if (ready) {
      process.exit(0);
    } else {
      console.error('Server failed to start within timeout');
      server.kill();
      process.exit(1);
    }
  } catch (error) {
    console.error('Error ensuring server:', error.message);
    process.exit(1);
  }
}

ensureServer();
