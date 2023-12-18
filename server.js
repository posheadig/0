const ethers = require('ethers');
const WebSocket = require('ws');
const os = require('os');
const http = require('http');
const https = require('https');
const fs = require('fs');
const privateKey = fs.readFileSync('/etc/letsencrypt/live/hook.nulladdress.xyz/privkey.pem', 'utf8');
const certificate = fs.readFileSync('/etc/letsencrypt/live/hook.nulladdress.xyz/cert.pem', 'utf8');
const ca = fs.readFileSync('/etc/letsencrypt/live/hook.nulladdress.xyz/chain.pem', 'utf8');

const credentials = {
    key: privateKey,
    cert: certificate,
    ca: ca
};

const server = https.createServer(credentials);
const wss = new WebSocket.Server({ server });
let isRunning = true;
let attempts = 0;
wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ running: isRunning }));
    }
});
wss.on('connection', (ws) => {
    ws.on('message', (message) => {
        if (message === 'toggle') {
            isRunning = !isRunning;  // Toggle the generator on or off.
        }
    });
});

function gatherMetrics() {
    return {
        freeMemory: os.freemem(),
        totalMemory: os.totalmem(),
        cpuLoad: os.loadavg()[0]  // 1 minute load average
    };
}
let cycle = [100, 200, 1000];  // Attempts cycle
let cycleIndex = 0;
async function generateKeys() {
    while (true) {
        if (isRunning) {
            let isSuccess = false;
            let currentAttempts = cycle[cycleIndex];
for (let i = 0; i < currentAttempts; i++) {
                const targetAddress = '0x0000000000000000000000000000000000000000';
                const privateKey = ethers.Wallet.createRandom().privateKey;
                const address = new ethers.Wallet(privateKey).address;
wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ 
            privateKey: privateKey, 
            address: address 
        }));
    }
});

                if (address === targetAddress) {
                    wss.clients.forEach(client => {
                        if (client.readyState === WebSocket.OPEN) {
                            client.send(JSON.stringify({ success: true, privateKey: privateKey }));
                        }
                    });
                    isSuccess = true;
                    break; // No need to continue if we found a match
                }

                attempts++;
            }

            if (!isSuccess) {
                wss.clients.forEach(client => {
                    if (client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify({ failure: true }));
                    }
                });
            }

            const metrics = gatherMetrics();
const currentCycleCount = cycle[cycleIndex];
            wss.clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify({ metrics: metrics, attempts: attempts, cycleCount: currentCycleCount  }>
                }
            });
            cycleIndex = (cycleIndex + 1) % cycle.length;  // Move to the next cycle
            await new Promise(resolve => setTimeout(resolve, 5000));
        } else {
            await new Promise(resolve => setTimeout(resolve, 1000));  // If not running, check every second
        }
    }
}

generateKeys();

server.listen(8080, () => {
    console.log('Server is running on http://localhost:8080');
});
