/**
 * Tests for Contact Transformer
 */

const { normalizePhone, transformContact, createContactDocument } = require('../src/transformers/transform-contact');

describe('Contact Transformer', () => {
  
  describe('normalizePhone', () => {
    
    test('should normalize Brazilian mobile number', () => {
      const result = normalizePhone('(41) 99968-7096');
      expect(result.normalized).toBe('5541999687096');
      expect(result.valid).toBe(true);
    });
    
    test('should normalize number without mask', () => {
      const result = normalizePhone('41999687096');
      expect(result.normalized).toBe('5541999687096');
      expect(result.valid).toBe(true);
    });
    
    test('should handle already normalized number with DDI', () => {
      const result = normalizePhone('5541999687096');
      expect(result.normalized).toBe('5541999687096');
      expect(result.valid).toBe(true);
    });
    
    test('should return null for invalid phone', () => {
      const result = normalizePhone('123');
      expect(result.normalized).toBe(null);
      expect(result.valid).toBe(false);
    });
    
    test('should return null for empty phone', () => {
      const result = normalizePhone('');
      expect(result).toBe(null);
    });
    
    test('should return null for null phone', () => {
      const result = normalizePhone(null);
      expect(result).toBe(null);
    });
    
  });
  
  describe('transformContact', () => {
    
    const mappings = {
      users: { '12345': 45 }
    };
    
    const config = {
      PROJECT_ID: 396140,
      DEFAULT_USER_ID: 45
    };
    
    test('should transform person with whatsapp', () => {
      const agendorData = {
        person: {
          id: 100,
          name: 'João Silva',
          contact: {
            whatsapp: '+5541999687096',
            email: 'joao@teste.com'
          },
          ownerUser: { id: 12345 }
        }
      };
      
      const result = transformContact(agendorData, 'deal-1', mappings, config);
      
      expect(result.number).toBe('5541999687096');
      expect(result.name).toBe('João Silva');
      expect(result.email).toBe('joao@teste.com');
      expect(result.status).toBe('active');
      expect(result.valid).toBe(true);
    });
    
    test('should create placeholder for missing contact', () => {
      const agendorData = {};
      
      const result = transformContact(agendorData, 'deal-123', mappings, config);
      
      expect(result.number).toBe('AGENDOR-deal-123');
      expect(result.status).toBe('imported_without_phone');
      expect(result.valid).toBe(false);
    });
    
  });
  
  describe('createContactDocument', () => {
    
    test('should create valid MongoDB document', () => {
      const transformed = {
        number: '5541999687096',
        name: 'João Silva',
        email: 'joao@teste.com',
        status: 'active',
        valid: true,
        ownerId: 45,
        projectId: 396140,
        agendorId: 100,
        agendorType: 'person',
        originalPhone: '+5541999687096'
      };
      
      const doc = createContactDocument(transformed);
      
      expect(doc.number).toBe('5541999687096');
      expect(doc.name).toBe('João Silva');
      expect(doc.status).toBe('open');
      expect(doc.active).toBe(true);
      expect(doc.projectId).toBe(396140);
      expect(doc.responsibleUserId).toBe(45);
      expect(doc.origin).toBe('agendor_migration');
      expect(doc._migrationMeta.agendorId).toBe(100);
    });
    
  });
  
});
