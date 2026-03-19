/**
 * J3.2 - Load Deals to ZafChat
 * 
 * Insere os deals transformados na collection crmDeals
 */

require('dotenv').config();
const MongoClientZafChat = require('../lib/mongo-client');
const logger = require('../lib/logger');

async function run() {
  logger.info('Starting J3.2: Load Deals');
  
  let mongoClient = null;
  
  try {
    mongoClient = new MongoClientZafChat();
    await mongoClient.connect();
    
    const migrationCollection = await mongoClient.getMigrationControlCollection();
    const dealsCollection = await mongoClient.getDealsCollection();
    
    // Get transformed deals
    const deals = await migrationCollection.find({
      entityType: 'deal',
      status: 'transformed'
    }).toArray();
    
    logger.info(`Found ${deals.length} deals to load`);
    
    let loaded = 0;
    let skipped = 0;
    let errors = 0;
    
    for (const record of deals) {
      try {
        const data = record.transformedData;
        
        // Check if deal already exists
        const existing = await dealsCollection.findOne({
          _agendorId: data._agendorId,
          projectId: data.projectId
        });
        
        if (existing) {
          await migrationCollection.updateOne(
            { _id: record._id },
            {
              $set: {
                status: 'completed',
                zafchatId: existing._id.toString(),
                updatedAt: new Date(),
                migratedAt: new Date()
              }
            }
          );
          
          skipped++;
          continue;
        }
        
        // Insert new deal
        const result = await dealsCollection.insertOne(data);
        
        // Update migration record
        await migrationCollection.updateOne(
          { _id: record._id },
          {
            $set: {
              status: 'completed',
              zafchatId: result.insertedId.toString(),
              updatedAt: new Date(),
              migratedAt: new Date()
            }
          }
        );
        
        loaded++;
        
      } catch (error) {
        logger.error(`Error loading deal ${record.agendorId}: ${error.message}`);
        
        await migrationCollection.updateOne(
          { _id: record._id },
          {
            $set: {
              status: 'error',
              errorMessage: error.message,
              updatedAt: new Date()
            }
          }
        );
        
        errors++;
      }
    }
    
    logger.info(`✅ J3.2 completed: ${loaded} loaded, ${skipped} skipped, ${errors} errors`);
    
    return { loaded, skipped, errors };
    
  } catch (error) {
    logger.error('❌ J3.2 failed:', error.message);
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
