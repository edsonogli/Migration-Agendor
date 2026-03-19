/**
 * J4.1 - Verify Migration
 * 
 * Verifica integridade dos dados migrados
 */

require('dotenv').config();
const MongoClientZafChat = require('../lib/mongo-client');
const logger = require('../lib/logger');

async function run() {
  logger.info('Starting J4.1: Verify Migration');
  
  let mongoClient = null;
  
  try {
    mongoClient = new MongoClientZafChat();
    await mongoClient.connect();
    
    const projectId = parseInt(process.env.PROJECT_ID);
    
    const migrationCollection = await mongoClient.getMigrationControlCollection();
    const contactsCollection = await mongoClient.getContactsCollection();
    const dealsCollection = await mongoClient.getDealsCollection();
    const tasksCollection = await mongoClient.getTasksCollection();
    
    const report = {
      contacts: { total: 0, valid: 0, withoutPhone: 0, errors: 0 },
      deals: { total: 0, open: 0, won: 0, lost: 0, errors: 0 },
      tasks: { total: 0, pending: 0, completed: 0, errors: 0 },
      migration: { completed: 0, errors: 0, pending: 0 }
    };
    
    // Count contacts
    report.contacts.total = await contactsCollection.countDocuments({
      projectId,
      _agendorId: { $exists: true }
    });
    
    report.contacts.valid = await contactsCollection.countDocuments({
      projectId,
      _agendorId: { $exists: true },
      _phoneValid: true
    });
    
    report.contacts.withoutPhone = await contactsCollection.countDocuments({
      projectId,
      _agendorId: { $exists: true },
      status: 'imported_without_phone'
    });
    
    // Count deals
    report.deals.total = await dealsCollection.countDocuments({
      projectId,
      _agendorId: { $exists: true }
    });
    
    report.deals.open = await dealsCollection.countDocuments({
      projectId,
      _agendorId: { $exists: true },
      status: 'open'
    });
    
    report.deals.won = await dealsCollection.countDocuments({
      projectId,
      _agendorId: { $exists: true },
      status: 'won'
    });
    
    report.deals.lost = await dealsCollection.countDocuments({
      projectId,
      _agendorId: { $exists: true },
      status: 'lost'
    });
    
    // Count tasks
    report.tasks.total = await tasksCollection.countDocuments({
      projectId,
      _migratedFrom: 'agendor'
    });
    
    report.tasks.pending = await tasksCollection.countDocuments({
      projectId,
      _migratedFrom: 'agendor',
      status: 'pending'
    });
    
    report.tasks.completed = await tasksCollection.countDocuments({
      projectId,
      _migratedFrom: 'agendor',
      status: 'completed'
    });
    
    // Migration status
    report.migration.completed = await migrationCollection.countDocuments({
      status: 'completed'
    });
    
    report.migration.errors = await migrationCollection.countDocuments({
      status: 'error'
    });
    
    report.migration.pending = await migrationCollection.countDocuments({
      status: { $in: ['fetched', 'transformed'] }
    });
    
    // Log report
    logger.info('\n' + '='.repeat(60));
    logger.info('📊 MIGRATION VERIFICATION REPORT');
    logger.info('='.repeat(60));
    
    logger.info('\n📱 CONTACTS:');
    logger.info(`   Total: ${report.contacts.total}`);
    logger.info(`   Valid phones: ${report.contacts.valid}`);
    logger.info(`   Without phone: ${report.contacts.withoutPhone}`);
    
    logger.info('\n💰 DEALS:');
    logger.info(`   Total: ${report.deals.total}`);
    logger.info(`   Open: ${report.deals.open}`);
    logger.info(`   Won: ${report.deals.won}`);
    logger.info(`   Lost: ${report.deals.lost}`);
    
    logger.info('\n📝 TASKS:');
    logger.info(`   Total: ${report.tasks.total}`);
    logger.info(`   Pending: ${report.tasks.pending}`);
    logger.info(`   Completed: ${report.tasks.completed}`);
    
    logger.info('\n📋 MIGRATION STATUS:');
    logger.info(`   Completed: ${report.migration.completed}`);
    logger.info(`   Errors: ${report.migration.errors}`);
    logger.info(`   Pending: ${report.migration.pending}`);
    
    // Check for orphan deals (no contact)
    const orphanDeals = await dealsCollection.countDocuments({
      projectId,
      _agendorId: { $exists: true },
      contactNumber: { $regex: /^AGENDOR-/ }
    });
    
    if (orphanDeals > 0) {
      logger.warn(`\n⚠️ Found ${orphanDeals} deals without valid contact phone`);
    }
    
    // Overall status
    const hasErrors = report.migration.errors > 0 || report.contacts.withoutPhone > 0;
    
    logger.info('\n' + '='.repeat(60));
    if (hasErrors) {
      logger.warn('⚠️ Migration completed with warnings');
    } else {
      logger.info('✅ Migration completed successfully');
    }
    logger.info('='.repeat(60));
    
    return report;
    
  } catch (error) {
    logger.error('❌ J4.1 failed:', error.message);
    throw error;
  } finally {
    if (mongoClient) {
      await mongoClient.disconnect();
    }
  }
}

if (require.main === module) {
  run().catch(() => process.exit(1));
}

module.exports = run;
