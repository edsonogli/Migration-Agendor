/**
 * J1.1 - Fetch Users from Agendor
 * 
 * Busca todos os usuários do Agendor e salva na collection MigrationControl
 */

require('dotenv').config();
const AgendorClient = require('../lib/agendor-client');
const MongoClientZafChat = require('../lib/mongo-client');
const logger = require('../lib/logger');

async function run() {
  logger.info('Starting J1.1: Fetch Users from Agendor');
  
  let mongoClient = null;
  let agendorClient = null;
  
  try {
    // Initialize clients
    mongoClient = new MongoClientZafChat();
    await mongoClient.connect();
    
    agendorClient = new AgendorClient();
    
    // Fetch all users from Agendor
    logger.info('Fetching users from Agendor...');
    const users = await agendorClient.getUsers();
    
    logger.info(`Found ${users.length} users in Agendor`);
    
    // Save to MigrationControl
    const collection = await mongoClient.getMigrationControlCollection();
    
    let saved = 0;
    let skipped = 0;
    
    for (const user of users) {
      const existing = await collection.findOne({
        agendorId: user.id.toString(),
        entityType: 'user'
      });
      
      if (existing) {
        skipped++;
        continue;
      }
      
      await collection.insertOne({
        agendorId: user.id.toString(),
        entityType: 'user',
        status: 'fetched',
        rawData: user,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      saved++;
    }
    
    logger.info(`✅ J1.1 completed: ${saved} users saved, ${skipped} skipped`);
    
    return { saved, skipped, total: users.length };
    
  } catch (error) {
    logger.error('❌ J1.1 failed:', error.message);
    throw error;
  } finally {
    if (mongoClient) {
      await mongoClient.disconnect();
    }
  }
}

// Run if called directly
if (require.main === module) {
  run().catch(() => process.exit(1));
}

module.exports = run;
