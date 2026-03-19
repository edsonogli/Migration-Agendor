/**
 * Job J3.4: Transform and Import Deals
 * Transforms raw deals and imports to ZafChat
 */

require('dotenv').config();
const MongoClient = require('../lib/mongo-client');
const { transformDeal, createDealDocument } = require('../transformers/transform-deal');
const { transformContact, createContactDocument } = require('../transformers/transform-contact');
const logger = require('../lib/logger');

// Load mappings
const userMappings = require('../../data/mappings/users.json');
const funnelMappings = require('../../data/mappings/funnels-stages.json');

async function run(batchSize = 100, dryRun = false) {
  logger.info(`Transforming deals (batch: ${batchSize}, dryRun: ${dryRun})...`);
  
  const mongo = new MongoClient();
  
  try {
    await mongo.connect();
    
    const migrationCollection = await mongo.getMigrationControlCollection();
    const dealsCollection = await mongo.getDealsCollection();
    const contactsCollection = await mongo.getContactsCollection();
    
    // Get pending deals
    const pendingDeals = await migrationCollection.find({
      entityType: 'deal',
      status: 'pending'
    }).limit(batchSize).toArray();
    
    logger.info(`Found ${pendingDeals.length} pending deals to process`);
    
    if (pendingDeals.length === 0) {
      logger.info('No pending deals found');
      return { success: true, processed: 0 };
    }
    
    const config = {
      PROJECT_ID: parseInt(process.env.PROJECT_ID) || 396140,
      DEFAULT_USER_ID: parseInt(process.env.DEFAULT_USER_ID) || 45
    };
    
    const mappings = {
      users: userMappings.users,
      funnels: funnelMappings.funnels
    };
    
    const results = {
      processed: 0,
      succeeded: 0,
      failed: 0,
      contactsCreated: 0,
      dealsCreated: 0
    };
    
    for (const record of pendingDeals) {
      const deal = record.rawData;
      
      try {
        // Update status to processing
        await migrationCollection.updateOne(
          { _id: record._id },
          { $set: { status: 'processing', updatedAt: new Date() } }
        );
        
        // Transform contact
        const transformedContact = transformContact(deal, deal.id, mappings, config);
        
        // Create or find contact
        let contactNumber = transformedContact.number;
        
        if (!dryRun) {
          let existingContact = null;
          
          if (transformedContact.valid) {
            existingContact = await contactsCollection.findOne({
              projectId: config.PROJECT_ID,
              number: contactNumber
            });
          }
          
          if (!existingContact) {
            const contactDoc = createContactDocument(transformedContact);
            const contactResult = await contactsCollection.insertOne(contactDoc);
            
            results.contactsCreated++;
            logger.debug(`Created contact: ${contactNumber}`);
          } else {
            contactNumber = existingContact.number;
          }
        }
        
        // Transform deal
        const transformedDeal = transformDeal(deal, mappings, config);
        const dealDoc = createDealDocument(transformedDeal, contactNumber);
        
        if (!dryRun) {
          // Check if deal already exists
          const existingDeal = await dealsCollection.findOne({
            projectId: config.PROJECT_ID,
            'activities.metadata.agendorId': deal.id.toString()
          });
          
          if (!existingDeal) {
            const dealResult = await dealsCollection.insertOne(dealDoc);
            results.dealsCreated++;
            
            // Update migration record
            await migrationCollection.updateOne(
              { _id: record._id },
              { 
                $set: { 
                  status: 'completed', 
                  zafchatId: dealResult.insertedId,
                  migratedAt: new Date(),
                  updatedAt: new Date()
                }
              }
            );
            
            logger.debug(`Created deal: ${deal.title}`);
          } else {
            // Already exists - skip
            await migrationCollection.updateOne(
              { _id: record._id },
              { 
                $set: { 
                  status: 'skipped', 
                  zafchatId: existingDeal._id,
                  updatedAt: new Date()
                }
              }
            );
          }
        } else {
          logger.info(`[DRY RUN] Would create deal: ${deal.title}`);
        }
        
        results.succeeded++;
        
      } catch (error) {
        results.failed++;
        
        logger.error(`Failed to process deal ${deal.id}:`, error.message);
        
        if (!dryRun) {
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
        }
      }
      
      results.processed++;
    }
    
    logger.info('Batch processing complete');
    console.log('\n========== RESULTS ==========');
    console.log(JSON.stringify(results, null, 2));
    console.log('==============================\n');
    
    return { success: true, ...results };
    
  } catch (error) {
    logger.error('Job failed:', error);
    return { success: false, error: error.message };
  } finally {
    await mongo.disconnect();
  }
}

// Run if called directly
if (require.main === module) {
  const batchSize = parseInt(process.argv[2]) || 100;
  const dryRun = process.argv[3] === '--dry-run';
  
  run(batchSize, dryRun)
    .then(result => {
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      logger.error('Job failed:', error);
      process.exit(1);
    });
}

module.exports = { run };
