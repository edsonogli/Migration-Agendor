/**
 * Orquestrador da Migração
 * Executa todos os jobs em sequência com checkpoint
 */

require('dotenv').config();
const logger = require('../lib/logger');

const JOBS = [
  { id: 'J0.1', name: 'Validate Connection', module: './J0.1-validate-connection' },
  { id: 'J0.2', name: 'Create Indexes', module: './J0.2-create-indexes' },
  { id: 'J1.1', name: 'Fetch Users', module: './J1.1-fetch-users' },
  { id: 'J1.2', name: 'Fetch Funnels', module: './J1.2-fetch-funnels' },
  { id: 'J1.3', name: 'Fetch Deals', module: './J1.3-fetch-deals' },
  { id: 'J1.4', name: 'Fetch Contacts', module: './J1.4-fetch-people' },
  { id: 'J1.5', name: 'Fetch Tasks', module: './J1.5-fetch-tasks' },
  { id: 'J2.1', name: 'Transform Contacts', module: './J2.1-transform-contacts' },
  { id: 'J2.2', name: 'Transform Deals', module: './J2.2-transform-deals' },
  { id: 'J2.3', name: 'Transform Tasks', module: './J2.3-transform-tasks' },
  { id: 'J3.1', name: 'Load Contacts', module: './J3.1-load-contacts' },
  { id: 'J3.2', name: 'Load Deals', module: './J3.2-load-deals' },
  { id: 'J3.3', name: 'Load Tasks', module: './J3.3-load-tasks' },
  { id: 'J4.1', name: 'Verify Migration', module: './J4.1-verify' }
];

async function runJob(job) {
  logger.info(`\n${'='.repeat(60)}`);
  logger.info(`🚀 Starting ${job.id}: ${job.name}`);
  logger.info('='.repeat(60));
  
  const startTime = Date.now();
  
  try {
    const jobModule = require(job.module);
    const result = await jobModule();
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    logger.info(`✅ ${job.id} completed in ${duration}s`);
    
    return { success: true, job: job.id, result, duration };
  } catch (error) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    logger.error(`❌ ${job.id} failed after ${duration}s: ${error.message}`);
    
    return { success: false, job: job.id, error: error.message, duration };
  }
}

async function runAll(fromJob = null) {
  logger.info('🏁 MIGRATION ORCHESTRATOR STARTED');
  logger.info(`Time: ${new Date().toISOString()}`);
  
  const results = [];
  let startIndex = 0;
  
  // Find starting job if specified
  if (fromJob) {
    const idx = JOBS.findIndex(j => j.id === fromJob);
    if (idx >= 0) {
      startIndex = idx;
      logger.info(`📍 Resuming from ${fromJob}`);
    }
  }
  
  // Run jobs sequentially
  for (let i = startIndex; i < JOBS.length; i++) {
    const job = JOBS[i];
    const result = await runJob(job);
    results.push(result);
    
    if (!result.success) {
      logger.error(`\n⛔ Migration stopped at ${job.id} due to error`);
      logger.error('Fix the issue and re-run with: node run-all.js --from=' + job.id);
      break;
    }
  }
  
  // Summary
  logger.info('\n' + '='.repeat(60));
  logger.info('📊 MIGRATION SUMMARY');
  logger.info('='.repeat(60));
  
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  logger.info(`✅ Successful: ${successful.length}`);
  logger.info(`❌ Failed: ${failed.length}`);
  
  if (failed.length > 0) {
    logger.info('\nFailed jobs:');
    failed.forEach(r => logger.info(`  - ${r.job}: ${r.error}`));
  }
  
  const totalDuration = results.reduce((sum, r) => sum + parseFloat(r.duration || 0), 0);
  logger.info(`\n⏱️ Total time: ${totalDuration.toFixed(2)}s`);
  
  return results;
}

// CLI
const args = process.argv.slice(2);
const fromArg = args.find(a => a.startsWith('--from='));
const fromJob = fromArg ? fromArg.split('=')[1] : null;

if (require.main === module) {
  runAll(fromJob).catch(() => process.exit(1));
}

module.exports = { runAll, runJob };
