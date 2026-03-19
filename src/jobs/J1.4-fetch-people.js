/**
 * J1.4 - Fetch Contacts (People & Organizations) from Agendor
 */

require('dotenv').config();
const AgendorClient = require('../lib/agendor-client');
const MongoClientZafChat = require('../lib/mongo-client');
const logger = require('../lib/logger');

async function run() {
  logger.info('Starting J1.4: Fetch Contacts from Agendor');
  
  let mongoClient = null;
  let agendorClient = null;
  
  try {
    mongoClient = new MongoClientZafChat();
    await mongoClient.connect();
    
    agendorClient = new AgendorClient();
    const collection = await mongoClient.getMigrationControlCollection();
    
    const stats = {
      people: 0,
      organizations: 0,
      total: 0
    };
    
    // 1. Fetch People
    logger.info('Fetching people from Agendor...');
    const people = await agendorClient.getPeople();
    logger.info(`Found ${people.length} people`);
    
    for (const person of people) {
      const existing = await collection.findOne({
        agendorId: person.id.toString(),
        entityType: 'person'
      });
      
      if (!existing) {
        await collection.insertOne({
          agendorId: person.id.toString(),
          entityType: 'person',
          status: 'fetched',
          rawData: person,
          createdAt: new Date(),
          updatedAt: new Date()
        });
        stats.people++;
        stats.total++;
      }
    }
    
    // 2. Fetch Organizations
    logger.info('Fetching organizations from Agendor...');
    const orgs = await agendorClient.getOrganizations();
    logger.info(`Found ${orgs.length} organizations`);
    
    for (const org of orgs) {
      const existing = await collection.findOne({
        agendorId: org.id.toString(),
        entityType: 'organization'
      });
      
      if (!existing) {
        await collection.insertOne({
          agendorId: org.id.toString(),
          entityType: 'organization',
          status: 'fetched',
          rawData: org,
          createdAt: new Date(),
          updatedAt: new Date()
        });
        stats.organizations++;
        stats.total++;
      }
    }
    
    logger.info(`✅ J1.4 completed: ${stats.total} total contacts saved (${stats.people} people, ${stats.organizations} orgs)`);
    return stats;
    
  } catch (error) {
    logger.error('❌ J1.4 failed:', error.message);
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
