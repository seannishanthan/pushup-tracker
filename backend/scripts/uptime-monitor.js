#!/usr/bin/env node

/**
 * Uptime Monitor Script
 * Pings the backend every 5 minutes to prevent cold starts
 * Run this script on a separate always-on service (like a VPS or paid hosting)
 */

const https = require('https');
const http = require('http');

// Configuration
const BACKEND_URL = process.env.BACKEND_URL || 'https://your-backend.onrender.com';
const PING_INTERVAL = 5 * 60 * 1000; // 5 minutes
const TIMEOUT = 10000; // 10 seconds

console.log(`🔄 Starting uptime monitor for: ${BACKEND_URL}`);
console.log(`⏰ Ping interval: ${PING_INTERVAL / 1000} seconds`);

function pingServer() {
    const startTime = Date.now();

    // Use https for production URLs, http for localhost
    const client = BACKEND_URL.startsWith('https') ? https : http;

    const req = client.get(`${BACKEND_URL}/api/ping`, {
        timeout: TIMEOUT,
        headers: {
            'User-Agent': 'Uptime-Monitor/1.0'
        }
    }, (res) => {
        const endTime = Date.now();
        const responseTime = endTime - startTime;

        if (res.statusCode === 200) {
            console.log(`✅ Ping successful - ${responseTime}ms - ${new Date().toISOString()}`);
        } else {
            console.log(`⚠️ Ping failed - Status: ${res.statusCode} - ${new Date().toISOString()}`);
        }

        res.on('data', () => { }); // Consume response body
        res.on('end', () => { });
    });

    req.on('error', (error) => {
        const endTime = Date.now();
        const responseTime = endTime - startTime;
        console.log(`❌ Ping error - ${error.message} - ${responseTime}ms - ${new Date().toISOString()}`);
    });

    req.on('timeout', () => {
        req.destroy();
        console.log(`⏰ Ping timeout - ${TIMEOUT}ms - ${new Date().toISOString()}`);
    });
}

// Initial ping
pingServer();

// Set up interval
setInterval(pingServer, PING_INTERVAL);

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Uptime monitor stopped');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Uptime monitor stopped');
    process.exit(0);
});

console.log('🚀 Uptime monitor started. Press Ctrl+C to stop.');
