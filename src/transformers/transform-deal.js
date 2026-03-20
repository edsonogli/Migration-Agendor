/**
 * Transform Deal from Agendor to ZafChat
 * 
 * Agendor: deals
 * ZafChat: crmDeals
 */

const { Decimal128 } = require('mongodb');
const { ObjectId } = require('mongodb');
const logger = require('../lib/logger');

/**
 * Status mapping (Agendor -> ZafChat)
 */
const STATUS_MAP = {
  1: 'open',
  2: 'won',
  3: 'lost'
};

/**
 * Transform Agendor Deal to ZafChat Deal
 */
function transformDeal(agendorDeal, mappings, config) {
  // 1. Map Funnel and Stage
  const funnelMapping = mappings.funnels[agendorDeal.dealStage?.funnel?.id];
  const mappedFunnelId = funnelMapping?.zafchatId;
  const mappedStageId = funnelMapping?.stages[agendorDeal.dealStage?.id];

  if (!mappedFunnelId || !mappedStageId) {
    logger.warn(`Deal ${agendorDeal.id}: Missing funnel/stage mapping`, {
      agendorFunnelId: agendorDeal.dealStage?.funnel?.id,
      agendorStageId: agendorDeal.dealStage?.id
    });
  }

  // 2. Map Responsible User (MySQL ID)
  const responsibleUserId = mappings.users[agendorDeal.owner?.id] || config.DEFAULT_USER_ID;

  // 3. Status
  const status = STATUS_MAP[agendorDeal.dealStatus?.id] || 'open';

  // 4. Close dates
  let wonAt = null;
  let lostAt = null;
  
  if (status === 'won') {
    wonAt = agendorDeal.wonAt || agendorDeal.endTime || null;
  }
  if (status === 'lost') {
    lostAt = agendorDeal.lostAt || agendorDeal.endTime || null;
  }

  // 5. Value
  const value = Decimal128.fromString((agendorDeal.value || 0).toString());

  // 6. Contact number (will be filled during contact migration)
  const contactNumber = extractContactNumber(agendorDeal);

  // 7. Products mapping
  const mappedProducts = [];
  const productsMapping = mappings.products || {};
  
  if (agendorDeal.products_entities && Array.isArray(agendorDeal.products_entities)) {
    for (const prod of agendorDeal.products_entities) {
      const mapping = productsMapping[prod.id];
      if (mapping && mapping.zafchatId) {
        mappedProducts.push({
          productId: new ObjectId(mapping.zafchatId),
          name: mapping.name || 'Produto Migrado',
          quantity: Decimal128.fromString((prod.quantity || 1).toString()),
          unitPrice: Decimal128.fromString((prod.unitValue || 0).toString()),
          total: Decimal128.fromString((prod.totalValue || 0).toString())
        });
      } else {
        logger.warn(`Deal ${agendorDeal.id}: Produto ${prod.id} no encontrado no mapeamento`);
      }
    }
  }

  return {
    // Core
    title: agendorDeal.title || 'Negócio sem título',
    value: value,
    currency: 'BRL',
    
    // Contact
    contactNumber: contactNumber,
    
    // Pipeline
    funnelId: mappedFunnelId ? new ObjectId(mappedFunnelId) : null,
    stageId: mappedStageId ? new ObjectId(mappedStageId) : null,
    
    // Responsibility
    responsibleUserId: responsibleUserId,
    sdrResponsibleUserId: responsibleUserId,
    closerResponsibleUserId: null,
    
    // Dates
    expectedCloseDate: agendorDeal.startTime ? new Date(agendorDeal.startTime) : null,
    wonAt: wonAt ? new Date(wonAt) : null,
    lostAt: lostAt ? new Date(lostAt) : null,
    
    // Status
    status: status,
    probability: 0,
    
    // Content
    qualificationSummary: null,
    notes: agendorDeal.description || '',
    tags: [],
    products: mappedProducts,
    source: 'agendor',
    
    // Loss info
    lostReason: agendorDeal.lossReason?.name || null,
    
    // Project
    projectId: config.PROJECT_ID,
    
    // Audit
    createdByUserId: responsibleUserId,
    
    // Activity
    activities: [{
      type: 'created',
      description: 'Migrado do Agendor',
      userId: responsibleUserId,
      timestamp: new Date(),
      metadata: { 
        agendorId: agendorDeal.id,
        agendorTitle: agendorDeal.title,
        migratedAt: new Date().toISOString()
      }
    }],
    
    // Flags
    active: true,
    
    // Timestamps
    createdAt: agendorDeal.createdAt ? new Date(agendorDeal.createdAt) : new Date(),
    updatedAt: agendorDeal.updatedAt ? new Date(agendorDeal.updatedAt) : new Date(),
    
    // Migration metadata (for rollback/debugging)
    _agendorId: agendorDeal.id,
    _agendorStatus: agendorDeal.dealStatus?.id,
    _agendorOwnerId: agendorDeal.owner?.id
  };
}

/**
 * Extract contact number from deal
 */
function extractContactNumber(agendorDeal) {
  // Try person first
  if (agendorDeal.person?.contact) {
    const contact = agendorDeal.person.contact;
    const phone = contact.whatsapp || contact.mobile || contact.work;
    if (phone) {
      return normalizePhoneNumber(phone);
    }
  }
  
  // Try organization
  if (agendorDeal.organization?.contact) {
    const contact = agendorDeal.organization.contact;
    const phone = contact.whatsapp || contact.mobile || contact.work;
    if (phone) {
      return normalizePhoneNumber(phone);
    }
  }
  
  // Return placeholder if no phone found
  return `AGENDOR-${agendorDeal.id}`;
}

/**
 * Normalize phone number
 */
function normalizePhoneNumber(phone) {
  if (!phone) return null;
  
  let normalized = phone
    .replace(/\D/g, '')
    .replace(/^0+/, '');
  
  if (normalized.length === 10 || normalized.length === 11) {
    normalized = '55' + normalized;
  }
  
  const isValid = normalized.length >= 12 && normalized.length <= 15;
  return isValid ? normalized : null;
}

module.exports = {
  transformDeal,
  STATUS_MAP,
  extractContactNumber,
  normalizePhoneNumber
};
