/**
 * Build Script - Validates project structure and dependencies
 */

const fs = require('fs');
const path = require('path');

// Corrigir caminho - usar o diretório do projeto migration-agendor
const MIGRATION_DIR = path.resolve(__dirname, '..');

const REQUIRED_FILES = [
  'package.json',
  '.env',
  '.env.example',
  'src/lib/agendor-client.js',
  'src/lib/mongo-client.js',
  'src/lib/logger.js',
  'src/transformers/transform-deal.js',
  'src/transformers/transform-contact.js',
  'src/transformers/transform-task.js',
  'src/jobs/J0.1-validate-connection.js',
  'src/jobs/J0.2-create-indexes.js',
  'src/jobs/J1.5-fetch-tasks.js',
  'src/jobs/J2.3-transform-tasks.js',
  'src/jobs/J3.3-load-tasks.js',
  'data/mappings/users.json',
  'data/mappings/funnels-stages.json'
];

const REQUIRED_DIRS = [
  'src',
  'src/lib',
  'src/transformers',
  'src/jobs',
  'data',
  'data/mappings',
  'logs'
];

console.log('🔍 Validating migration project structure...');
console.log(`📁 Base directory: ${MIGRATION_DIR}\n`);

let errors = 0;
let warnings = 0;

// Check directories
console.log('📁 Checking directories...');
REQUIRED_DIRS.forEach(dir => {
  const fullPath = path.join(MIGRATION_DIR, dir);
  if (!fs.existsSync(fullPath)) {
    console.log(`  ❌ Missing: ${dir}/`);
    errors++;
  } else {
    console.log(`  ✅ Found: ${dir}/`);
  }
});

// Check files
console.log('\n📄 Checking files...');
REQUIRED_FILES.forEach(file => {
  const fullPath = path.join(MIGRATION_DIR, file);
  if (!fs.existsSync(fullPath)) {
    console.log(`  ❌ Missing: ${file}`);
    errors++;
  } else {
    console.log(`  ✅ Found: ${file}`);
  }
});

// Check mappings
console.log('\n🗺️ Validating mappings...');
try {
  const usersPath = path.join(MIGRATION_DIR, 'data/mappings/users.json');
  const funnelsPath = path.join(MIGRATION_DIR, 'data/mappings/funnels-stages.json');
  
  if (fs.existsSync(usersPath)) {
    const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
    console.log(`  ✅ Users mapped: ${Object.keys(users.users || {}).length}`);
  }
  
  if (fs.existsSync(funnelsPath)) {
    const funnels = JSON.parse(fs.readFileSync(funnelsPath, 'utf8'));
    console.log(`  ✅ Funnels mapped: ${Object.keys(funnels.funnels || {}).length}`);
  }
} catch (e) {
  console.log(`  ⚠️ Warning: Could not validate mappings - ${e.message}`);
  warnings++;
}

// Check .env
console.log('\n🔐 Checking .env configuration...');
const envPath = path.join(MIGRATION_DIR, '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  
  const checks = [
    { name: 'AGENDOR_API_KEY', pattern: /AGENDOR_API_KEY=(.+)/ },
    { name: 'MONGODB_URI', pattern: /MONGODB_URI=(.+)/ },
    { name: 'PROJECT_ID', pattern: /PROJECT_ID=(\d+)/ }
  ];
  
  checks.forEach(check => {
    const match = envContent.match(check.pattern);
    if (match && !match[1].includes('placeholder') && !match[1].includes('SEU_')) {
      console.log(`  ✅ ${check.name}: configured`);
    } else if (match) {
      console.log(`  ⚠️ ${check.name}: placeholder value`);
      warnings++;
    } else {
      console.log(`  ❌ ${check.name}: not found`);
      errors++;
    }
  });
} else {
  console.log('  ❌ .env file not found');
  errors++;
}

// Summary
console.log('\n' + '='.repeat(50));
console.log(`📊 Build Summary:`);
console.log(`   Errors: ${errors}`);
console.log(`   Warnings: ${warnings}`);
console.log('='.repeat(50));

if (errors > 0) {
  console.log('\n❌ Build FAILED - Fix errors before running migration');
  process.exit(1);
} else if (warnings > 0) {
  console.log('\n⚠️ Build PASSED with warnings - Update .env with real values');
  process.exit(0);
} else {
  console.log('\n✅ Build PASSED - Ready to run migration!');
  process.exit(0);
}
