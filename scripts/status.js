/**
 * Status Script - Shows migration progress
 */

const fs = require('fs');
const path = require('path');

const MIGRATION_DIR = path.join(__dirname, '..');
const STATUS_FILE = path.join(MIGRATION_DIR, '.migration-status.json');

const PHASES = [
  { id: 0, name: 'Setup', jobs: ['J0.1-validate-connection', 'J0.2-create-indexes'] },
  { id: 1, name: 'Fetch Data', jobs: ['J1.1-fetch-users', 'J1.2-fetch-funnels', 'J1.3-fetch-deals', 'J1.4-fetch-people'] },
  { id: 2, name: 'Transform', jobs: ['J2.1-transform-contacts', 'J2.2-transform-deals'] },
  { id: 3, name: 'Load', jobs: ['J3.1-load-contacts', 'J3.2-load-deals', 'J3.3-link-relationships'] },
  { id: 4, name: 'Verify', jobs: ['J4.1-verify-counts', 'J4.2-verify-relationships', 'J4.3-final-report'] }
];

function getStatus() {
  if (!fs.existsSync(STATUS_FILE)) {
    return {
      currentPhase: 0,
      currentJob: null,
      startedAt: null,
      stats: {
        totalDeals: 0,
        migratedDeals: 0,
        totalContacts: 0,
        migratedContacts: 0,
        errors: []
      }
    };
  }
  return JSON.parse(fs.readFileSync(STATUS_FILE, 'utf8'));
}

function displayStatus() {
  console.log('\n' + '='.repeat(60));
  console.log('📊 MIGRAÇÃO AGENDOR → ZAFCHAT');
  console.log('='.repeat(60));
  
  const status = getStatus();
  
  // Phase progress
  console.log('\n📍 Fases:');
  PHASES.forEach(phase => {
    const isCurrent = phase.id === status.currentPhase;
    const isComplete = phase.id < status.currentPhase;
    const icon = isComplete ? '✅' : isCurrent ? '🔄' : '⏳';
    console.log(`   ${icon} Fase ${phase.id}: ${phase.name}`);
    
    if (isCurrent && status.currentJob) {
      console.log(`      └─ Job atual: ${status.currentJob}`);
    }
  });
  
  // Stats
  console.log('\n📈 Estatísticas:');
  console.log(`   Deals migrados: ${status.stats.migratedDeals}/${status.stats.totalDeals}`);
  console.log(`   Contatos migrados: ${status.stats.migratedContacts}/${status.stats.totalContacts}`);
  
  if (status.stats.errors?.length > 0) {
    console.log(`   ⚠️ Erros: ${status.stats.errors.length}`);
  }
  
  // Timestamps
  if (status.startedAt) {
    console.log(`\n⏱️ Iniciado em: ${status.startedAt}`);
  }
  
  console.log('\n' + '='.repeat(60) + '\n');
}

displayStatus();
