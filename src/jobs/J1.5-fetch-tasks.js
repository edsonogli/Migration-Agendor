/**
 * J1.5 - Fetch Tasks from Agendor
 * 
 * Busca TODAS as tarefas do Agendor e salva na MigrationControl
 */

require('dotenv').config();
const AgendorClient = require('../lib/agendor-client');
const MongoClientZafChat = require('../lib/mongo-client');
const logger = require('../lib/logger');

async function run() {
  logger.info('Starting J1.5: Fetch Tasks from Agendor');
  
  let mongoClient = null;
  let agendorClient = null;
  
  try {
    mongoClient = new MongoClientZafChat();
    await mongoClient.connect();
    
    agendorClient = new AgendorClient();
    
    const collection = await mongoClient.getMigrationControlCollection();
    
    const stats = {
      pending: 0,
      completed: 0,
      total: 0
    };
    
    // Fetch pending tasks
    logger.info('Fetching pending tasks...');
    const pendingTasks = await agendorClient.getTasks({ finishedEq: false });
    logger.info(`Found ${pendingTasks.length} pending tasks`);
    
    for (const task of pendingTasks) {
      const existing = await collection.findOne({
        agendorId: task.id.toString(),
        entityType: 'task'
      });
      
      if (existing) continue;
      
      await collection.insertOne({
        agendorId: task.id.toString(),
        entityType: 'task',
        status: 'fetched',
        rawData: task,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      stats.pending++;
      stats.total++;
    }
    
    // Fetch completed tasks
    logger.info('Fetching completed tasks...');
    const completedTasks = await agendorClient.getTasks({ finishedEq: true });
    logger.info(`Found ${completedTasks.length} completed tasks`);
    
    for (const task of completedTasks) {
      const existing = await collection.findOne({
        agendorId: task.id.toString(),
        entityType: 'task'
      });
      
      if (existing) continue;
      
      await collection.insertOne({
        agendorId: task.id.toString(),
        entityType: 'task',
        status: 'fetched',
        rawData: task,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      stats.completed++;
      stats.total++;
    }
    
    logger.info(`✅ J1.5 completed: ${stats.total} tasks saved`);
    logger.info(`   Pending: ${stats.pending}, Completed: ${stats.completed}`);
    
    return stats;
    
  } catch (error) {
    logger.error('❌ J1.5 failed:', error.message);
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
