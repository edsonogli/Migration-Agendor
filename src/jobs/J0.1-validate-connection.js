require('dotenv').config();
const AgendorClient = require('../lib/agendor-client');
const MongoClientZafChat = require('../lib/mongo-client');
const logger = require('../lib/logger');

async function run() {
  logger.info('Starting J0.1: Validate Connection');
  
  let mongoClient = null;
  let agendorClient = null;
  
  try {
    // 1. Validate Env Vars
    const requiredVars = ['AGENDOR_API_KEY', 'MONGODB_URI', 'MONGODB_DATABASE', 'PROJECT_ID'];
    const missing = requiredVars.filter(v => !process.env[v]);
    
    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
    
    // 2. Connect to MongoDB
    logger.info('Connecting to MongoDB...');
    mongoClient = new MongoClientZafChat();
    const db = await mongoClient.connect();
    
    // Test query
    const collections = await db.listCollections().toArray();
    logger.info(`✅ MongoDB connected successfully. Found ${collections.length} collections.`);
    
    // 3. Connect to Agendor
    logger.info('Connecting to Agendor API...');
    agendorClient = new AgendorClient();
    
    // Test request
    const me = await agendorClient.get('/users/me');
    logger.info(`✅ Agendor connected successfully. User: ${me[0]?.name}`);
    
    logger.info('🎉 J0.1 completed successfully. All connections validated.');
    
  } catch (error) {
    logger.error('❌ Connection validation failed:', error.message);
    if (error.response) {
      logger.error(`Agendor API Error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
    }
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
