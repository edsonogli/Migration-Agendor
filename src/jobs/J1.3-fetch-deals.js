/**
 * J1.3 - Fetch Deals from Agendor
 * 
 * Busca TODOS os deals do Agendor (por status) e salva na MigrationControl
 * Rate limit: 4 req/segundo
 */

require('dotenv').config();
const AgendorClient = require('../lib/agendor-client');
const MongoClientZafChat = require('../lib/mongo-client');
const logger = require('../lib/logger');

// Status IDs do Agendor
const STATUS_IDS = {
  open: 1,    // Em andamento
  won: 2,     // Ganho
  lost: 3     // Perdido
};

async function run() {
  logger.info('Starting J1.3: Fetch Deals from Agendor');
  
  let mongoClient = null;
  let agendorClient = null;
  
  try {
    mongoClient = new MongoClientZafChat();
    await mongoClient.connect();
    
    agendorClient = new AgendorClient();
    
    const collection = await mongoClient.getMigrationControlCollection();
    
    const stats = {
      open: 0,
      won: 0,
      lost: 0,
      total: 0
    };
    
    // Fetch deals by status
    for (const [statusName, statusId] of Object.entries(STATUS_IDS)) {
      logger.info(`Fetching ${statusName} deals (status ${statusId})...`);
      
      const deals = await agendorClient.getDealsByStatus(statusId);
      
      logger.info(`Found ${deals.length} ${statusName} deals`);
      
      for (const deal of deals) {
        const existing = await collection.findOne({
          agendorId: deal.id.toString(),
          entityType: 'deal'
        });
        
        if (existing) continue;
        
        await collection.insertOne({
          agendorId: deal.id.toString(),
          entityType: 'deal',
          status: 'fetched',
          rawData: deal,
          createdAt: new Date(),
          updatedAt: new Date()
        });
        
        stats[statusName]++;
        stats.total++;
      }
    }
    
    logger.info(`✅ J1.3 completed: ${stats.total} deals saved`);
    logger.info(`   Open: ${stats.open}, Won: ${stats.won}, Lost: ${stats.lost}`);
    
    return stats;
    
  } catch (error) {
    logger.error('❌ J1.3 failed:', error.message);
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
