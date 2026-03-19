/**
 * J3.1 - Load Contacts to ZafChat
 * 
 * Insere os contatos transformados na collection contactCrm
 */

require('dotenv').config();
const MongoClientZafChat = require('../lib/mongo-client');
const logger = require('../lib/logger');

async function run() {
  logger.info('Starting J3.1: Load Contacts');
  
  let mongoClient = null;
  
  try {
    mongoClient = new MongoClientZafChat();
    await mongoClient.connect();
    
    const migrationCollection = await mongoClient.getMigrationControlCollection();
    const contactsCollection = await mongoClient.getContactsCollection();
    
    // Get transformed contacts
    const contacts = await migrationCollection.find({
      entityType: { $in: ['person', 'organization'] },
      status: 'transformed'
    }).toArray();
    
    logger.info(`Found ${contacts.length} contacts to load`);
    
    let loaded = 0;
    let skipped = 0;
    let errors = 0;
    
    for (const record of contacts) {
      try {
        const data = record.transformedData;
        
        // Check if contact already exists
        const existing = await contactsCollection.findOne({
          number: data.number,
          projectId: data.projectId
        });
        
        if (existing) {
          // Update migration record with existing ID
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
        
        // Insert new contact
        const result = await contactsCollection.insertOne(data);
        
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
        logger.error(`Error loading contact ${record.agendorId}: ${error.message}`);
        
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
    
    logger.info(`✅ J3.1 completed: ${loaded} loaded, ${skipped} skipped, ${errors} errors`);
    
    return { loaded, skipped, errors };
    
  } catch (error) {
    logger.error('❌ J3.1 failed:', error.message);
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
