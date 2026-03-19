require('dotenv').config();
const MongoClientZafChat = require('../lib/mongo-client');
const logger = require('../lib/logger');

async function run() {
  logger.info('Starting J0.2: Create Indexes');
  
  let mongoClient = null;
  
  try {
    logger.info('Connecting to MongoDB...');
    mongoClient = new MongoClientZafChat();
    await mongoClient.connect();
    
    // Create indexes for MigrationControl
    logger.info('Creating indexes for MigrationControl...');
    await mongoClient.createMigrationIndexes();
    
    // Future: add indexes for contactNumber if not exists
    logger.info('Checking contactCrm indexes...');
    const contactsColl = await mongoClient.getContactsCollection();
    await contactsColl.createIndex({ number: 1, projectId: 1 });
    
    logger.info('🎉 J0.2 completed successfully. All indexes created.');
    
  } catch (error) {
    logger.error('❌ Index creation failed:', error.message);
    process.exit(1);
  } finally {
    if (mongoClient) {
      await mongoClient.disconnect();
      logger.info('MongoDB disconnected.');
    }
  }
}

// Run if called directly
if (require.main === module) {
  run();
}

module.exports = run;
