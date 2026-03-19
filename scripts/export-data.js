/**
 * Export Migration Data
 * Exporta todos os dados da MigrationControl para auditoria/backup
 */

require('dotenv').config();
const MongoClientZafChat = require('../lib/mongo-client');
const fs = require('fs');
const path = require('path');
const logger = require('../lib/logger');

const EXPORT_DIR = path.join(__dirname, '../../exports');

async function exportMigration() {
  logger.info('📤 Exporting migration data...');
  
  let mongoClient = null;
  
  try {
    mongoClient = new MongoClientZafChat();
    await mongoClient.connect();
    
    const migrationCollection = await mongoClient.getMigrationControlCollection();
    
    // Ensure export directory
    if (!fs.existsSync(EXPORT_DIR)) {
      fs.mkdirSync(EXPORT_DIR, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const exportFile = path.join(EXPORT_DIR, `migration-export-${timestamp}.json`);
    
    // Get all records
    const records = await migrationCollection.find({}).toArray();
    
    // Group by entity type
    const grouped = {
      users: records.filter(r => r.entityType === 'user'),
      funnels: records.filter(r => r.entityType === 'funnel'),
      stages: records.filter(r => r.entityType === 'stage'),
      deals: records.filter(r => r.entityType === 'deal'),
      people: records.filter(r => r.entityType === 'person'),
      organizations: records.filter(r => r.entityType === 'organization'),
      tasks: records.filter(r => r.entityType === 'task')
    };
    
    const summary = {
      exportedAt: new Date().toISOString(),
      total: records.length,
      byEntity: {
        users: grouped.users.length,
        funnels: grouped.funnels.length,
        stages: grouped.stages.length,
        deals: grouped.deals.length,
        people: grouped.people.length,
        organizations: grouped.organizations.length,
        tasks: grouped.tasks.length
      },
      byStatus: {
        completed: records.filter(r => r.status === 'completed').length,
        transformed: records.filter(r => r.status === 'transformed').length,
        fetched: records.filter(r => r.status === 'fetched').length,
        error: records.filter(r => r.status === 'error').length,
        skipped: records.filter(r => r.status === 'skipped').length
      },
      data: grouped
    };
    
    fs.writeFileSync(exportFile, JSON.stringify(summary, null, 2));
    
    logger.info(`✅ Export complete: ${exportFile}`);
    logger.info(`   Total records: ${records.length}`);
    logger.info(`   Completed: ${summary.byStatus.completed}`);
    logger.info(`   Errors: ${summary.byStatus.error}`);
    
    return summary;
    
  } catch (error) {
    logger.error('❌ Export failed:', error.message);
    throw error;
  } finally {
    if (mongoClient) {
      await mongoClient.disconnect();
    }
  }
}

if (require.main === module) {
  exportMigration().catch(() => process.exit(1));
}

module.exports = exportMigration;
