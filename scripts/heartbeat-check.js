/**
 * Heartbeat Check for Migration Status
 * Called by HEARTBEAT.md to monitor migration progress
 */

const fs = require('fs');
const path = require('path');

const MIGRATION_DIR = path.join(__dirname, '..');
const STATUS_FILE = path.join(MIGRATION_DIR, '.migration-status.json');
const ENV_FILE = path.join(MIGRATION_DIR, '.env');

function isPlaceholder(value) {
  if (!value) return true;
  const lower = value.toLowerCase();
  return (
    lower.includes('placeholder') ||
    lower.includes('seu_') ||
    lower.includes('your_') ||
    lower.includes('xxx') ||
    lower.includes('user:password') ||
    lower.includes('cluster.mongodb') ||
    value.length < 20
  );
}

function checkStatus() {
  // 1. Check if .env has real credentials
  const envContent = fs.readFileSync(ENV_FILE, 'utf8');
  
  const tokenMatch = envContent.match(/AGENDOR_API_KEY=(.+)/);
  const mongoMatch = envContent.match(/MONGODB_URI=(.+)/);
  
  const token = tokenMatch ? tokenMatch[1].trim() : '';
  const mongoUri = mongoMatch ? mongoMatch[1].trim() : '';
  
  const hasRealToken = !isPlaceholder(token);
  const hasRealMongoUri = !isPlaceholder(mongoUri);

  if (!hasRealToken || !hasRealMongoUri) {
    return {
      status: 'WAITING_CREDENTIALS',
      message: 'Aguardando credenciais reais no .env',
      missing: {
        token: !hasRealToken,
        mongoUri: !hasRealMongoUri
      },
      hint: 'Edite .env com AGENDOR_API_KEY e MONGODB_URI reais'
    };
  }

  // 2. Check migration status file
  if (!fs.existsSync(STATUS_FILE)) {
    return {
      status: 'READY_TO_START',
      message: 'Credenciais configuradas. Pronto para iniciar J0.1',
      nextAction: 'node src/jobs/J0.1-validate-connection.js'
    };
  }

  const status = JSON.parse(fs.readFileSync(STATUS_FILE, 'utf8'));
  return status;
}

// Run
const result = checkStatus();
console.log(JSON.stringify(result));
