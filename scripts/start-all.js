import { spawn, execSync } from 'child_process';
import net from 'net';

function isDockerRunning() {
  try {
    execSync('docker ps', { stdio: 'ignore', timeout: 3000 });
    return true;
  } catch (_) {
    return false;
  }
}

async function isPortOpen(port = 9092, host = '127.0.0.1', timeoutMs = 800) {
  return new Promise((resolve) => {
    const s = new net.Socket();
    s.setTimeout(timeoutMs);
    s.once('connect', () => { s.destroy(); resolve(true); });
    s.once('timeout', () => { s.destroy(); resolve(false); });
    s.once('error', () => { s.destroy(); resolve(false); });
    try { s.connect(port, host); } catch (_) { resolve(false); }
  });
}

async function main() {
  console.log('====================================================');
  console.log('🚀 TrekIndia — Starting Full Platform (Kafka + App)');
  console.log('====================================================');

  if (isDockerRunning()) {
    console.log('📦 Starting Kafka KRaft containers...');
    try {
      execSync('docker compose up -d kafka kafka-ui', { stdio: 'inherit' });
    } catch (_) {}
  } else {
    console.log('ℹ️  Docker Desktop is not currently running.');
    console.log('💡 App will start immediately with Direct WebSocket fallback.');
    console.log('💡 To enable Kafka later, start Docker Desktop & run "npm run kafka:start".\n');
  }

  // Start Node.js server
  console.log('🌐 Starting TrekIndia Application Server...\n');
  const server = spawn('node', ['backend/src/server.js'], { stdio: 'inherit' });

  server.on('close', (code) => {
    process.exit(code || 0);
  });
}

main();
