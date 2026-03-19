/**
 * J1.2 - Fetch Funnels from Agendor
 * 
 * Busca todos os funis e stages do Agendor e salva na MigrationControl
 */

require('dotenv').config();
const AgendorClient = require('../lib/agendor-client');
const MongoClientZafChat = require('../lib/mongo-client');
const logger = require('../lib/logger');

async function run() {
  logger.info('Starting J1.2: Fetch Funnels from Agendor');
  
  let mongoClient = null;
  let agendorClient = null;
  
  try {
    mongoClient = new MongoClientZafChat();
    await mongoClient.connect();
    
    agendorClient = new AgendorClient();
    
    // Fetch funnels
    logger.info('Fetching funnels from Agendor...');
    const funnels = await agendorClient.getFunnels();
    
    logger.info(`Found ${funnels.length} funnels`);
    
    const collection = await mongoClient.getMigrationControlCollection();
    
    let funnelsSaved = 0;
    let stagesSaved = 0;
    
    for (const funnel of funnels) {
      // Save funnel
      const existingFunnel = await collection.findOne({
        agendorId: funnel.id.toString(),
        entityType: 'funnel'
      });
      
      if (!existingFunnel) {
        await collection.insertOne({
          agendorId: funnel.id.toString(),
          entityType: 'funnel',
          status: 'fetched',
          rawData: funnel,
          createdAt: new Date(),
          updatedAt: new Date()
        });
        funnelsSaved++;
      }
      
      // Save stages
      if (funnel.dealStages) {
        for (const stage of funnel.dealStages) {
          const existingStage = await collection.findOne({
            agendorId: stage.id.toString(),
            entityType: 'stage'
          });
          
          if (!existingStage) {
            await collection.insertOne({
              agendorId: stage.id.toString(),
              entityType: 'stage',
              status: 'fetched',
              rawData: {
                ...stage,
                funnelId: funnel.id,
                funnelName: funnel.name
              },
              createdAt: new Date(),
              updatedAt: new Date()
            });
            stagesSaved++;
          }
        }
      }
    }
    
    logger.info(`✅ J1.2 completed: ${funnelsSaved} funnels, ${stagesSaved} stages saved`);
    
    return { funnelsSaved, stagesSaved };
    
  } catch (error) {
    logger.error('❌ J1.2 failed:', error.message);
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
