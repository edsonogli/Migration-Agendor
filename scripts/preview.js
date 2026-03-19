/**
 * Preview Migration
 * Mostra quantos registros serão migrados (requer token Agendor)
 */

require('dotenv').config();
const AgendorClient = require('../lib/agendor-client');
const logger = require('../lib/logger');

async function preview() {
  logger.info('📊 MIGRATION PREVIEW');
  logger.info('==================\n');
  
  const agendorClient = new AgendorClient();
  
  try {
    // Count each entity type
    const counts = {
      users: 0,
      funnels: 0,
      stages: 0,
      deals: { total: 0, open: 0, won: 0, lost: 0 },
      people: 0,
      organizations: 0,
      tasks: { total: 0, pending: 0, completed: 0 }
    };
    
    // Users
    logger.info('🔄 Counting users...');
    const users = await agendorClient.getUsers();
    counts.users = users.length;
    
    // Funnels & Stages
    logger.info('🔄 Counting funnels...');
    const funnels = await agendorClient.getFunnels();
    counts.funnels = funnels.length;
    counts.stages = funnels.reduce((sum, f) => sum + (f.dealStages?.length || 0), 0);
    
    // Deals by status
    logger.info('🔄 Counting deals...');
    const openDeals = await agendorClient.getDealsByStatus(1);
    const wonDeals = await agendorClient.getDealsByStatus(2);
    const lostDeals = await agendorClient.getDealsByStatus(3);
    
    counts.deals.open = openDeals.length;
    counts.deals.won = wonDeals.length;
    counts.deals.lost = lostDeals.length;
    counts.deals.total = counts.deals.open + counts.deals.won + counts.deals.lost;
    
    // People
    logger.info('🔄 Counting people...');
    const people = await agendorClient.getPeople();
    counts.people = people.length;
    
    // Organizations
    logger.info('🔄 Counting organizations...');
    const orgs = await agendorClient.getOrganizations();
    counts.organizations = orgs.length;
    
    // Tasks
    logger.info('🔄 Counting tasks...');
    const pendingTasks = await agendorClient.getTasks({ finishedEq: false });
    const completedTasks = await agendorClient.getTasks({ finishedEq: true });
    
    counts.tasks.pending = pendingTasks.length;
    counts.tasks.completed = completedTasks.length;
    counts.tasks.total = counts.tasks.pending + counts.tasks.completed;
    
    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 MIGRATION PREVIEW SUMMARY');
    console.log('='.repeat(60));
    
    console.log('\n👥 USERS:');
    console.log(`   Total: ${counts.users}`);
    
    console.log('\n📊 FUNNELS & STAGES:');
    console.log(`   Funnels: ${counts.funnels}`);
    console.log(`   Stages: ${counts.stages}`);
    
    console.log('\n💰 DEALS:');
    console.log(`   Total: ${counts.deals.total}`);
    console.log(`   Open: ${counts.deals.open}`);
    console.log(`   Won: ${counts.deals.won}`);
    console.log(`   Lost: ${counts.deals.lost}`);
    
    console.log('\n📱 CONTACTS:');
    console.log(`   People: ${counts.people}`);
    console.log(`   Organizations: ${counts.organizations}`);
    console.log(`   Total: ${counts.people + counts.organizations}`);
    
    console.log('\n📝 TASKS:');
    console.log(`   Total: ${counts.tasks.total}`);
    console.log(`   Pending: ${counts.tasks.pending}`);
    console.log(`   Completed: ${counts.tasks.completed}`);
    
    console.log('\n' + '='.repeat(60));
    
    // Estimate migration time (based on rate limits)
    const totalRecords = counts.deals.total + counts.people + counts.organizations + counts.tasks.total;
    const estimatedSeconds = Math.ceil(totalRecords / 4); // 4 req/s
    const estimatedMinutes = Math.floor(estimatedSeconds / 60);
    const remainingSeconds = estimatedSeconds % 60;
    
    console.log(`⏱️ ESTIMATED TIME:`);
    console.log(`   Records to migrate: ~${totalRecords}`);
    console.log(`   At 4 req/s: ~${estimatedMinutes}m ${remainingSeconds}s`);
    console.log('='.repeat(60));
    
    return counts;
    
  } catch (error) {
    logger.error('❌ Preview failed:', error.message);
    throw error;
  }
}

if (require.main === module) {
  preview().catch(() => process.exit(1));
}

module.exports = preview;
