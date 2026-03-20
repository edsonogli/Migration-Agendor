/**
 * J2.2 - Transform Deals
 * 
 * Lê os deals da MigrationControl e transforma para o schema do ZafChat
 */

require('dotenv').config();
const MongoClientZafChat = require('../lib/mongo-client');
const { transformDeal } = require('../transformers/transform-deal');
const logger = require('../lib/logger');
const fs = require('fs');
const path = require('path');

async function run() {
  logger.info('Starting J2.2: Transform Deals');
  
  let mongoClient = null;
  
  try {
    mongoClient = new MongoClientZafChat();
    await mongoClient.connect();
    
    // Load mappings
    const usersMapping = JSON.parse(
      fs.readFileSync(path.join(__dirname, '../../data/mappings/users.json'), 'utf8')
    );
    
    const funnelsMapping = JSON.parse(
      fs.readFileSync(path.join(__dirname, '../../data/mappings/funnels-stages.json'), 'utf8')
    );
    
    let productsMapping = { products: {} };
    try {
      productsMapping = JSON.parse(
        fs.readFileSync(path.join(__dirname, '../../data/mappings/products.json'), 'utf8')
      );
    } catch (e) {
      logger.warn('Mapeamento de produtos não encontrado ou inválido.');
    }
    
    const config = {
      PROJECT_ID: parseInt(process.env.PROJECT_ID),
      DEFAULT_USER_ID: parseInt(process.env.DEFAULT_USER_ID || 45)
    };
    
    const collection = await mongoClient.getMigrationControlCollection();
    
    // Get all fetched deals
    const deals = await collection.find({
      entityType: 'deal',
      status: 'fetched'
    }).toArray();
    
    // Build phones map from fetched people
    const people = await collection.find({
      entityType: 'person',
      status: 'fetched'
    }).toArray();
    
    const phonesMapping = {};
    for (const p of people) {
      const raw = p.rawData;
      const contact = raw.contact;
      if (contact) {
        let phone = contact.whatsapp || contact.mobile || contact.work;
        if (phone) {
          // normalize
          let normalized = phone.replace(/\D/g, '').replace(/^0+/, '');
          if (normalized.length === 10 || normalized.length === 11) {
            normalized = '55' + normalized;
          }
          if (normalized.length >= 12 && normalized.length <= 15) {
            phonesMapping[p.agendorId.toString()] = normalized;
          }
        }
      }
    }
    
    logger.info(`Found ${deals.length} deals to transform, mapped ${Object.keys(phonesMapping).length} phone numbers`);
    
    let transformed = 0;
    let errors = 0;
    
    for (const record of deals) {
      try {
        const transformedData = transformDeal(
          record.rawData,
          { 
            users: usersMapping.users,
            funnels: funnelsMapping.funnels,
            products: productsMapping.products,
            phones: phonesMapping
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
        logger.error(`Error transforming deal ${record.agendorId}: ${error.message}`);
        
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
    
    logger.info(`✅ J2.2 completed: ${transformed} transformed, ${errors} errors`);
    
    return { transformed, errors };
    
  } catch (error) {
    logger.error('❌ J2.2 failed:', error.message);
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
