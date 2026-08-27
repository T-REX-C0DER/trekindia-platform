import { execSync, spawn } from 'child_process';
import fs from 'fs';
import net from 'net';

function isDockerRunning() {
  try {
    execSync('docker ps', { stdio: 'ignore', timeout: 5000 });
    return true;
  } catch (_) {
    return false;
  }
}

async function isPortOpen(port = 9092, host = '127.0.0.1', timeoutMs = 1000) {
  return new Promise((resolve) => {
    const s = new net.Socket();
    s.setTimeout(timeoutMs);
    s.once('connect', () => { s.destroy(); resolve(true); });
    s.once('timeout', () => { s.destroy(); resolve(false); });
    s.once('error', () => { s.destroy(); resolve(false); });
    try { s.connect(port, host); } catch (_) { resolve(false); }
  });
}

function launchDockerDesktop() {
  console.log('🐳 Docker daemon is not running. Attempting to start Docker Desktop...');
  const winPath = 'C:\\Program Files\\Docker\\Docker\\Docker Desktop.exe';
  if (process.platform === 'win32' && fs.existsSync(winPath)) {
    try {
      spawn(winPath, [], { detached: true, stdio: 'ignore' }).unref();
      console.log('   Docker Desktop launcher started.');
    } catch (e) {
      console.warn('   Could not auto-launch Docker Desktop:', e.message);
    }
  } else if (process.platform === 'darwin') {
    try {
      execSync('open -a Docker', { stdio: 'ignore' });
    } catch (_) {}
  }
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  console.log('====================================================');
  console.log('🚀 TrekIndia — Starting Kafka KRaft Infrastructure');
  console.log('====================================================');

  if (!isDockerRunning()) {
    launchDockerDesktop();
    console.log('⏳ Waiting for Docker Desktop engine to initialize (up to 90s)...');
    let ready = false;
    for (let i = 1; i <= 30; i++) {
      await sleep(3000);
      process.stdout.write(`   Waiting... ${i * 3}s elapsed\r`);
      if (isDockerRunning()) {
        ready = true;
        console.log(`\n✅ Docker daemon is ready! (${i * 3}s)`);
        break;
      }
    }

    if (!ready) {
      console.log('\n❌ Docker Desktop did not start within 90 seconds.');
      console.log('👉 Please open Docker Desktop manually from your Start Menu, then re-run: npm run kafka:start\n');
      console.log('💡 Note: You can still run the website without Kafka by running: npm start\n');
      process.exit(1);
    }
  } else {
    console.log('✅ Docker daemon is running.');
  }

  console.log('📦 Starting Kafka & Kafka UI containers via Docker Compose...');
  try {
    execSync('docker compose up -d kafka kafka-ui', { stdio: 'inherit' });
  } catch (err) {
    console.error('❌ Failed to start containers:', err.message);
    process.exit(1);
  }

  console.log('⏳ Waiting for Kafka KRaft broker to be ready on port 9092...');
  let brokerReady = false;
  for (let i = 1; i <= 20; i++) {
    await sleep(2000);
    if (await isPortOpen(9092)) {
      brokerReady = true;
      break;
    }
  }

  console.log('\n====================================================');
  if (brokerReady) {
    console.log('✅ Kafka KRaft Broker is ONLINE on localhost:9092');
  } else {
    console.log('⚠️ Kafka container started, initializing cluster...');
  }
  console.log('📊 Kafka UI Dashboard: http://localhost:8080');
  console.log('🚀 You can now start the server: npm start (or npm run dev)');
  console.log('====================================================\n');
}

main();
