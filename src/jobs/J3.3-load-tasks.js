/**
 * J3.3 - Load Tasks to ZafChat
 * 
 * Insere as tasks transformadas na collection crmTasks
 */

require('dotenv').config();
const MongoClientZafChat = require('../lib/mongo-client');
const logger = require('../lib/logger');

async function run() {
  logger.info('Starting J3.3: Load Tasks');
  
  let mongoClient = null;
  
  try {
    mongoClient = new MongoClientZafChat();
    await mongoClient.connect();
    
    const migrationCollection = await mongoClient.getMigrationControlCollection();
    const tasksCollection = await mongoClient.getTasksCollection();
    
    // Get transformed tasks
    const tasks = await migrationCollection.find({
      entityType: 'task',
      status: 'transformed'
    }).toArray();
    
    logger.info(`Found ${tasks.length} tasks to load`);
    
    let loaded = 0;
    let skipped = 0;
    let errors = 0;
    
    for (const record of tasks) {
      try {
        const data = record.transformedData;
        
        // Check if task already exists
        const existing = await tasksCollection.findOne({
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
        
        // Insert new task
        const result = await tasksCollection.insertOne(data);
        
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
        logger.error(`Error loading task ${record.agendorId}: ${error.message}`);
        
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
    
    logger.info(`✅ J3.3 completed: ${loaded} loaded, ${skipped} skipped, ${errors} errors`);
    
    return { loaded, skipped, errors };
    
  } catch (error) {
    logger.error('❌ J3.3 failed:', error.message);
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
