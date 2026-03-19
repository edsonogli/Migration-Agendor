/**
 * J2.1 - Transform Contacts
 * 
 * Lê os dados brutos da MigrationControl, transforma para o schema do ZafChat
 */

require('dotenv').config();
const MongoClientZafChat = require('../lib/mongo-client');
const { transformPerson, transformOrganization, normalizePhone } = require('../transformers/transform-contact');
const logger = require('../lib/logger');
const fs = require('fs');
const path = require('path');

async function run() {
  logger.info('Starting J2.1: Transform Contacts');
  
  let mongoClient = null;
  
  try {
    mongoClient = new MongoClientZafChat();
    await mongoClient.connect();
    
    // Load mappings
    const usersMapping = JSON.parse(
      fs.readFileSync(path.join(__dirname, '../../data/mappings/users.json'), 'utf8')
    );
    
    const config = {
      PROJECT_ID: parseInt(process.env.PROJECT_ID),
      DEFAULT_USER_ID: parseInt(process.env.DEFAULT_USER_ID || 45)
    };
    
    const collection = await mongoClient.getMigrationControlCollection();
    
    // Get all fetched contacts (people + orgs)
    const contacts = await collection.find({
      entityType: { $in: ['person', 'organization'] },
      status: 'fetched'
    }).toArray();
    
    logger.info(`Found ${contacts.length} contacts to transform`);
    
    let transformed = 0;
    let errors = 0;
    
    for (const record of contacts) {
      try {
        let transformedData;
        
        if (record.entityType === 'person') {
          transformedData = transformPerson(
            record.rawData,
            { users: usersMapping.users },
            config
          );
        } else {
          transformedData = transformOrganization(
            record.rawData,
            { users: usersMapping.users },
            config
          );
        }
        
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
        logger.error(`Error transforming person ${record.agendorId}: ${error.message}`);
        
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
    
    logger.info(`✅ J2.1 completed: ${transformed} transformed, ${errors} errors`);
    
    return { transformed, errors };
    
  } catch (error) {
    logger.error('❌ J2.1 failed:', error.message);
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
