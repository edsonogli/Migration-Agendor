/**
 * Generate Migration Report
 * Outputs JSON + simple HTML dashboard
 */

require('dotenv').config();
const MongoClientZafChat = require('../src/lib/mongo-client');
const fs = require('fs');
const path = require('path');

const REPORTS_DIR = path.join(__dirname, '../../reports');

async function generateReport() {
  console.log('📊 Generating migration report...');
  
  let mongoClient = null;
  
  try {
    mongoClient = new MongoClientZafChat();
    await mongoClient.connect();
    
    const projectId = parseInt(process.env.PROJECT_ID);
    
    const migrationCollection = await mongoClient.getMigrationControlCollection();
    const contactsCollection = await mongoClient.getContactsCollection();
    const dealsCollection = await mongoClient.getDealsCollection();
    const tasksCollection = await mongoClient.getTasksCollection();
    
    // Gather stats
    const stats = {
      generatedAt: new Date().toISOString(),
      projectId,
      
      contacts: {
        total: await contactsCollection.countDocuments({ projectId, _agendorId: { $exists: true } }),
        valid: await contactsCollection.countDocuments({ projectId, _agendorId: { $exists: true }, _phoneValid: true }),
        withoutPhone: await contactsCollection.countDocuments({ projectId, _agendorId: { $exists: true }, status: 'imported_without_phone' })
      },
      
      deals: {
        total: await dealsCollection.countDocuments({ projectId, _agendorId: { $exists: true } }),
        byStatus: {
          open: await dealsCollection.countDocuments({ projectId, _agendorId: { $exists: true }, status: 'open' }),
          won: await dealsCollection.countDocuments({ projectId, _agendorId: { $exists: true }, status: 'won' }),
          lost: await dealsCollection.countDocuments({ projectId, _agendorId: { $exists: true }, status: 'lost' })
        }
      },
      
      tasks: {
        total: await tasksCollection.countDocuments({ projectId, _migratedFrom: 'agendor' }),
        pending: await tasksCollection.countDocuments({ projectId, _migratedFrom: 'agendor', status: 'pending' }),
        completed: await tasksCollection.countDocuments({ projectId, _migratedFrom: 'agendor', status: 'completed' })
      },
      
      migration: {
        completed: await migrationCollection.countDocuments({ status: 'completed' }),
        errors: await migrationCollection.countDocuments({ status: 'error' }),
        pending: await migrationCollection.countDocuments({ status: { $in: ['fetched', 'transformed'] } })
      }
    };
    
    // Get error samples
    const errors = await migrationCollection.find({ status: 'error' }).limit(10).toArray();
    stats.errorSamples = errors.map(e => ({
      type: e.entityType,
      agendorId: e.agendorId,
      error: e.errorMessage
    }));
    
    // Ensure reports directory
    if (!fs.existsSync(REPORTS_DIR)) {
      fs.mkdirSync(REPORTS_DIR, { recursive: true });
    }
    
    // Write JSON
    const jsonPath = path.join(REPORTS_DIR, 'migration-report.json');
    fs.writeFileSync(jsonPath, JSON.stringify(stats, null, 2));
    console.log(`✅ JSON report: ${jsonPath}`);
    
    // Write HTML
    const htmlPath = path.join(REPORTS_DIR, 'migration-report.html');
    const html = generateHtml(stats);
    fs.writeFileSync(htmlPath, html);
    console.log(`✅ HTML report: ${htmlPath}`);
    
    return stats;
    
  } catch (error) {
    console.error('❌ Failed to generate report:', error.message);
    throw error;
  } finally {
    if (mongoClient) {
      await mongoClient.disconnect();
    }
  }
}

function generateHtml(stats) {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Migration Report - Agendor → ZafChat</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; padding: 20px; }
    .container { max-width: 800px; margin: 0 auto; }
    h1 { color: #333; margin-bottom: 20px; }
    .card { background: white; border-radius: 8px; padding: 20px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .card h2 { color: #666; font-size: 14px; text-transform: uppercase; margin-bottom: 15px; }
    .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 15px; }
    .stat { text-align: center; padding: 15px; background: #f9f9f9; border-radius: 8px; }
    .stat-value { font-size: 32px; font-weight: bold; color: #333; }
    .stat-label { font-size: 12px; color: #666; margin-top: 5px; }
    .stat.success .stat-value { color: #22c55e; }
    .stat.warning .stat-value { color: #f59e0b; }
    .stat.error .stat-value { color: #ef4444; }
    .timestamp { color: #999; font-size: 12px; margin-top: 20px; }
    .errors { margin-top: 15px; }
    .error-item { background: #fef2f2; padding: 10px; border-radius: 4px; margin-bottom: 8px; font-size: 13px; }
    .error-item code { background: #fee2e2; padding: 2px 6px; border-radius: 3px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>📊 Migration Report</h1>
    
    <div class="card">
      <h2>📱 Contacts</h2>
      <div class="stats">
        <div class="stat">
          <div class="stat-value">${stats.contacts.total}</div>
          <div class="stat-label">Total</div>
        </div>
        <div class="stat success">
          <div class="stat-value">${stats.contacts.valid}</div>
          <div class="stat-label">Valid Phones</div>
        </div>
        <div class="stat warning">
          <div class="stat-value">${stats.contacts.withoutPhone}</div>
          <div class="stat-label">Without Phone</div>
        </div>
      </div>
    </div>
    
    <div class="card">
      <h2>💰 Deals</h2>
      <div class="stats">
        <div class="stat">
          <div class="stat-value">${stats.deals.total}</div>
          <div class="stat-label">Total</div>
        </div>
        <div class="stat">
          <div class="stat-value">${stats.deals.byStatus.open}</div>
          <div class="stat-label">Open</div>
        </div>
        <div class="stat success">
          <div class="stat-value">${stats.deals.byStatus.won}</div>
          <div class="stat-label">Won</div>
        </div>
        <div class="stat error">
          <div class="stat-value">${stats.deals.byStatus.lost}</div>
          <div class="stat-label">Lost</div>
        </div>
      </div>
    </div>
    
    <div class="card">
      <h2>📝 Tasks</h2>
      <div class="stats">
        <div class="stat">
          <div class="stat-value">${stats.tasks.total}</div>
          <div class="stat-label">Total</div>
        </div>
        <div class="stat warning">
          <div class="stat-value">${stats.tasks.pending}</div>
          <div class="stat-label">Pending</div>
        </div>
        <div class="stat success">
          <div class="stat-value">${stats.tasks.completed}</div>
          <div class="stat-label">Completed</div>
        </div>
      </div>
    </div>
    
    <div class="card">
      <h2>📋 Migration Status</h2>
      <div class="stats">
        <div class="stat success">
          <div class="stat-value">${stats.migration.completed}</div>
          <div class="stat-label">Completed</div>
        </div>
        <div class="stat error">
          <div class="stat-value">${stats.migration.errors}</div>
          <div class="stat-label">Errors</div>
        </div>
        <div class="stat warning">
          <div class="stat-value">${stats.migration.pending}</div>
          <div class="stat-label">Pending</div>
        </div>
      </div>
      ${stats.errorSamples.length > 0 ? `
      <div class="errors">
        <h3 style="font-size: 13px; margin-bottom: 10px; color: #666;">Sample Errors:</h3>
        ${stats.errorSamples.map(e => `
          <div class="error-item">
            <code>${e.type}:${e.agendorId}</code> - ${e.error}
          </div>
        `).join('')}
      </div>
      ` : ''}
    </div>
    
    <p class="timestamp">Generated: ${new Date(stats.generatedAt).toLocaleString('pt-BR')}</p>
  </div>
</body>
</html>`;
}

if (require.main === module) {
  generateReport().catch(() => process.exit(1));
}

module.exports = generateReport;
