/**
 * Rollback Script
 * Remove todos os dados migrados do ZafChat
 */

require('dotenv').config();
const MongoClientZafChat = require('../lib/mongo-client');
const logger = require('../lib/logger');

async function rollback() {
  logger.info('⚠️ ROLLBACK STARTED');
  logger.info('This will remove all migrated data from ZafChat!');
  
  let mongoClient = null;
  
  try {
    mongoClient = new MongoClientZafChat();
    await mongoClient.connect();
    
    const projectId = parseInt(process.env.PROJECT_ID);
    
    // Delete contacts
    const contactsCollection = await mongoClient.getContactsCollection();
    const contactsResult = await contactsCollection.deleteMany({
      projectId,
      _migratedFrom: 'agendor'
    });
    logger.info(`Deleted ${contactsResult.deletedCount} contacts`);
    
    // Delete deals
    const dealsCollection = await mongoClient.getDealsCollection();
    const dealsResult = await dealsCollection.deleteMany({
      projectId,
      _agendorId: { $exists: true }
    });
    logger.info(`Deleted ${dealsResult.deletedCount} deals`);
    
    // Delete tasks
    const tasksCollection = await mongoClient.getTasksCollection();
    const tasksResult = await tasksCollection.deleteMany({
      projectId,
      _migratedFrom: 'agendor'
    });
    logger.info(`Deleted ${tasksResult.deletedCount} tasks`);
    
    // Clear MigrationControl
    const migrationCollection = await mongoClient.getMigrationControlCollection();
    const migrationResult = await migrationCollection.deleteMany({});
    logger.info(`Deleted ${migrationResult.deletedCount} migration records`);
    
    logger.info('✅ ROLLBACK COMPLETED');
    
    return {
      contacts: contactsResult.deletedCount,
      deals: dealsResult.deletedCount,
      tasks: tasksResult.deletedCount,
      migrationRecords: migrationResult.deletedCount
    };
    
  } catch (error) {
    logger.error('❌ Rollback failed:', error.message);
    throw error;
  } finally {
    if (mongoClient) {
      await mongoClient.disconnect();
    }
  }
}

if (require.main === module) {
  rollback().catch(() => process.exit(1));
}

module.exports = rollback;
