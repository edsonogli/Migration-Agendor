/**
 * Job J3.1, J3.2, J3.3: Fetch Deals
 * Fetches deals from Agendor and saves raw data to MigrationControl
 */

require('dotenv').config();
const AgendorClient = require('../lib/agendor-client');
const MongoClient = require('../lib/mongo-client');
const logger = require('../lib/logger');

/**
 * @param {number} statusId - Agendor status ID (1=active, 2=won, 3=lost)
 * @param {string} statusName - Status name for logging
 */
async function run(statusId = 1, statusName = 'active') {
  logger.info(`Fetching deals with status ${statusId} (${statusName})...`);
  
  const agendor = new AgendorClient();
  const mongo = new MongoClient();
  
  try {
    await mongo.connect();
    
    // Fetch all deals with this status
    const deals = await agendor.getDealsByStatus(statusId);
    
    logger.info(`Fetched ${deals.length} deals with status ${statusName}`);
    
    // Save raw data to MigrationControl
    const migrationCollection = await mongo.getMigrationControlCollection();
    
    let saved = 0;
    let skipped = 0;
    
    for (const deal of deals) {
      const existing = await migrationCollection.findOne({
        agendorId: deal.id.toString(),
        entityType: 'deal'
      });
      
      if (existing) {
        skipped++;
        continue;
      }
      
      await migrationCollection.insertOne({
        agendorId: deal.id.toString(),
        entityType: 'deal',
        status: 'pending',
        rawData: deal,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      saved++;
    }
    
    logger.info(`Saved ${saved} deals, skipped ${skipped} (already existed)`);
    
    return {
      success: true,
      total: deals.length,
      saved,
      skipped
    };
    
  } catch (error) {
    logger.error('Failed to fetch deals:', error);
    return { success: false, error: error.message };
  } finally {
    await mongo.disconnect();
  }
}

// Run if called directly
if (require.main === module) {
  const statusId = parseInt(process.argv[2]) || 1;
  const statusNames = { 1: 'active', 2: 'won', 3: 'lost' };
  
  run(statusId, statusNames[statusId] || 'unknown')
    .then(result => {
      console.log(JSON.stringify(result, null, 2));
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      logger.error('Job failed:', error);
      process.exit(1);
    });
}

module.exports = { run };
