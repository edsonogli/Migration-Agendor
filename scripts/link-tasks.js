/**
 * Link Tasks to Deals
 * Script auxiliar para vincular tarefas aos deals após migração
 */

require('dotenv').config();
const MongoClientZafChat = require('../lib/mongo-client');
const { ObjectId } = require('mongodb');
const logger = require('../lib/logger');

async function linkTasksToDeals() {
  logger.info('🔗 Starting Task-Deal linking...');
  
  let mongoClient = null;
  
  try {
    mongoClient = new MongoClientZafChat();
    await mongoClient.connect();
    
    const migrationCollection = await mongoClient.getMigrationControlCollection();
    const tasksCollection = await mongoClient.getTasksCollection();
    
    // Build deal mapping
    const deals = await migrationCollection.find({
      entityType: 'deal',
      status: 'completed'
    }).toArray();
    
    const dealMap = {};
    deals.forEach(d => {
      if (d.zafchatId) {
        dealMap[d.agendorId] = d.zafchatId;
      }
    });
    
    logger.info(`Found ${Object.keys(dealMap).length} migrated deals`);
    
    // Find tasks with unlinked deals
    const tasks = await tasksCollection.find({
      _agendorDealId: { $exists: true },
      dealId: null
    }).toArray();
    
    logger.info(`Found ${tasks.length} tasks with unlinked deals`);
    
    let linked = 0;
    let notFound = 0;
    
    for (const task of tasks) {
      const dealZafchatId = dealMap[task._agendorDealId];
      
      if (dealZafchatId) {
        await tasksCollection.updateOne(
          { _id: task._id },
          { $set: { dealId: new ObjectId(dealZafchatId), updatedAt: new Date() } }
        );
        linked++;
      } else {
        notFound++;
        logger.warn(`Deal not found for task ${task._agendorId}: deal ${task._agendorDealId}`);
      }
    }
    
    logger.info(`✅ Linking complete: ${linked} linked, ${notFound} not found`);
    
    return { linked, notFound };
    
  } catch (error) {
    logger.error('❌ Linking failed:', error.message);
    throw error;
  } finally {
    if (mongoClient) {
      await mongoClient.disconnect();
    }
  }
}

if (require.main === module) {
  linkTasksToDeals().catch(() => process.exit(1));
}

module.exports = linkTasksToDeals;
