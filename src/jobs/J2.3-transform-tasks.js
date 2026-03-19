/**
 * J2.3 - Transform Tasks
 * 
 * Lê as tasks da MigrationControl e transforma para o schema do ZafChat
 */

require('dotenv').config();
const MongoClientZafChat = require('../lib/mongo-client');
const { transformTask } = require('../transformers/transform-task');
const logger = require('../lib/logger');
const fs = require('fs');
const path = require('path');

async function run() {
  logger.info('Starting J2.3: Transform Tasks');
  
  let mongoClient = null;
  
  try {
    mongoClient = new MongoClientZafChat();
    await mongoClient.connect();
    
    // Load user mappings
    const usersMapping = JSON.parse(
      fs.readFileSync(path.join(__dirname, '../../data/mappings/users.json'), 'utf8')
    );
    
    const config = {
      PROJECT_ID: parseInt(process.env.PROJECT_ID),
      DEFAULT_USER_ID: parseInt(process.env.DEFAULT_USER_ID || 45)
    };
    
    const collection = await mongoClient.getMigrationControlCollection();
    
    // Build deals mapping from migrated deals
    const migratedDeals = await collection.find({
      entityType: 'deal',
      status: { $in: ['transformed', 'completed'] }
    }).toArray();
    
    const dealsMapping = {};
    for (const deal of migratedDeals) {
      const zafId = deal.zafchatId || deal.transformedData?._id;
      const contactNumber = deal.transformedData?.contactNumber;
      if (zafId) {
        dealsMapping[deal.agendorId] = { zafchatId: zafId, contactNumber };
      }
    }
    
    logger.info(`Built deals mapping with ${Object.keys(dealsMapping).length} entries`);
    
    // Get all fetched tasks
    const tasks = await collection.find({
      entityType: 'task',
      status: 'fetched'
    }).toArray();
    
    logger.info(`Found ${tasks.length} tasks to transform`);
    
    let transformed = 0;
    let errors = 0;
    let skippedNoDeal = 0;
    
    for (const record of tasks) {
      try {
        const transformedData = transformTask(
          record.rawData,
          { 
            users: usersMapping.users,
            deals: dealsMapping
          },
          config
        );
        
        await collection.updateOne(
          { _id: record._id },
          {
            $set: {
              transformedData,
              status: 'transformed',
              updatedAt: new Date()
            }
          }
        );
        
        transformed++;
        
      } catch (error) {
        if (error.message.includes('no linked deal')) {
          skippedNoDeal++;
          
          await collection.updateOne(
            { _id: record._id },
            {
              $set: {
                status: 'skipped',
                skipReason: 'no_deal',
                errorMessage: error.message,
                updatedAt: new Date()
              }
            }
          );
        } else {
          logger.error(`Error transforming task ${record.agendorId}: ${error.message}`);
          
          await collection.updateOne(
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
    }
    
    logger.info(`✅ J2.3 completed: ${transformed} transformed, ${skippedNoDeal} skipped (no deal), ${errors} errors`);
    
    return { transformed, skippedNoDeal, errors };
    
  } catch (error) {
    logger.error('❌ J2.3 failed:', error.message);
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
