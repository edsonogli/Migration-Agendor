/**
 * MongoDB Client for ZafChat
 */

const { MongoClient, Decimal128, ObjectId } = require('mongodb');

class MongoClientZafChat {
  constructor(config = {}) {
    this.uri = config.uri || process.env.MONGODB_URI;
    this.database = config.database || process.env.MONGODB_DATABASE || 'zafchat';
    this.client = null;
    this.db = null;
  }

  async connect() {
    if (this.client) return this.db;
    
    this.client = new MongoClient(this.uri);
    await this.client.connect();
    this.db = this.client.db(this.database);
    
    console.log(`Connected to MongoDB: ${this.database}`);
    return this.db;
  }

  async disconnect() {
    if (this.client) {
      await this.client.close();
      this.client = null;
      this.db = null;
    }
  }

  getCollection(name) {
    if (!this.db) throw new Error('Not connected to MongoDB');
    return this.db.collection(name);
  }

  // ========== HELPER METHODS ==========

  static toObjectId(id) {
    if (typeof id === 'string') {
      return new ObjectId(id);
    }
    return id;
  }

  static toDecimal(value) {
    return Decimal128.fromString((value || 0).toString());
  }

  static toDate(value) {
    if (!value) return null;
    if (value instanceof Date) return value;
    return new Date(value);
  }

  // ========== COLLECTION HELPERS ==========

  async getDealsCollection() {
    return this.getCollection('crmDeals');
  }

  async getContactsCollection() {
    return this.getCollection('contactCrm');
  }

  async getTasksCollection() {
    return this.getCollection('crmTasks');
  }

  async getFunnelsCollection() {
    return this.getCollection('crmFunnels');
  }

  async getStagesCollection() {
    return this.getCollection('crmStages');
  }

  async getUsersCollection() {
    return this.getCollection('userCrm');
  }

  async getMigrationControlCollection() {
    return this.getCollection('MigrationControl');
  }

  // ========== MIGRATION CONTROL ==========

  async createMigrationIndexes() {
    const collection = await this.getMigrationControlCollection();
    
    await collection.createIndex({ entityType: 1, status: 1 });
    await collection.createIndex({ agendorId: 1, entityType: 1 }, { unique: true });
    
    console.log('Migration control indexes created');
  }

  async saveMigrationRecord(record) {
    const collection = await this.getMigrationControlCollection();
    
    const existing = await collection.findOne({
      agendorId: record.agendorId.toString(),
      entityType: record.entityType
    });

    if (existing) {
      return collection.updateOne(
        { _id: existing._id },
        { 
          $set: {
            ...record,
            updatedAt: new Date()
          }
        }
      );
    }

    return collection.insertOne({
      ...record,
      createdAt: new Date(),
      updatedAt: new Date()
    });
  }

  async getMigrationStatus(entityType) {
    const collection = await this.getMigrationControlCollection();
    
    return collection.aggregate([
      { $match: { entityType } },
      { $group: {
        _id: '$status',
        count: { $sum: 1 }
      }}
    ]).toArray();
  }

  async getLastMigrated(entityType) {
    const collection = await this.getMigrationControlCollection();
    
    return collection.findOne(
      { entityType, status: 'completed' },
      { sort: { migratedAt: -1 } }
    );
  }
}

module.exports = MongoClientZafChat;
