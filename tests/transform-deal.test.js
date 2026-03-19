/**
 * Tests for Deal Transformer
 */

const { transformDeal, STATUS_MAP } = require('../src/transformers/transform-deal');

describe('Deal Transformer', () => {
  
  describe('STATUS_MAP', () => {
    
    test('should have correct status mappings', () => {
      expect(STATUS_MAP[1]).toBe('open');
      expect(STATUS_MAP[2]).toBe('won');
      expect(STATUS_MAP[3]).toBe('lost');
    });
    
  });
  
  describe('transformDeal', () => {
    
    const mappings = {
      users: { '858738': 45 },
      funnels: {
        '770626': {
          zafchatId: '699bdcc4f3580905ba2cc132',
          stages: {
            '3174269': '699bdcd6f3580905ba2cc133',
            '3174271': '699c3ff2273efc232f456c84'
          }
        }
      }
    };
    
    const config = {
      PROJECT_ID: 396140,
      DEFAULT_USER_ID: 45
    };
    
    test('should transform active deal correctly', () => {
      const agendorDeal = {
        id: 12345,
        title: 'Negócio Teste',
        value: 1000,
        description: 'Descrição do negócio',
        dealStage: {
          id: '3174269',
          funnel: { id: '770626' }
        },
        dealStatus: { id: 1 },
        owner: { id: '858738' },
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-02T00:00:00.000Z'
      };
      
      const result = transformDeal(agendorDeal, mappings, config);
      
      expect(result.agendorId).toBe(12345);
      expect(result.title).toBe('Negócio Teste');
      expect(result.status).toBe('open');
      expect(result.funnelId).toBe('699bdcc4f3580905ba2cc132');
      expect(result.stageId).toBe('699bdcd6f3580905ba2cc133');
      expect(result.responsibleUserId).toBe(45);
      expect(result.projectId).toBe(396140);
      expect(result.wonAt).toBe(null);
      expect(result.lostAt).toBe(null);
    });
    
    test('should transform won deal with dates', () => {
      const agendorDeal = {
        id: 12346,
        title: 'Negócio Ganho',
        value: 5000,
        dealStage: {
          id: '3174271',
          funnel: { id: '770626' }
        },
        dealStatus: { id: 2 },
        owner: { id: '858738' },
        wonAt: '2026-02-15T00:00:00.000Z',
        createdAt: '2026-01-01T00:00:00.000Z'
      };
      
      const result = transformDeal(agendorDeal, mappings, config);
      
      expect(result.status).toBe('won');
      expect(result.wonAt).toBeInstanceOf(Date);
      expect(result.lostAt).toBe(null);
    });
    
    test('should transform lost deal with reason', () => {
      const agendorDeal = {
        id: 12347,
        title: 'Negócio Perdido',
        value: 2000,
        dealStage: {
          id: '3174269',
          funnel: { id: '770626' }
        },
        dealStatus: { id: 3 },
        owner: { id: '858738' },
        lostAt: '2026-02-20T00:00:00.000Z',
        lossReason: { name: 'Cliente desistiu' },
        createdAt: '2026-01-01T00:00:00.000Z'
      };
      
      const result = transformDeal(agendorDeal, mappings, config);
      
      expect(result.status).toBe('lost');
      expect(result.lostAt).toBeInstanceOf(Date);
      expect(result.lostReason).toBe('Cliente desistiu');
      expect(result.wonAt).toBe(null);
    });
    
    test('should use default user for unknown owner', () => {
      const agendorDeal = {
        id: 12348,
        title: 'Negócio sem dono',
        value: 0,
        dealStage: {
          id: '3174269',
          funnel: { id: '770626' }
        },
        dealStatus: { id: 1 },
        owner: { id: 'unknown' },
        createdAt: '2026-01-01T00:00:00.000Z'
      };
      
      const result = transformDeal(agendorDeal, mappings, config);
      
      expect(result.responsibleUserId).toBe(45); // DEFAULT_USER_ID
    });
    
    test('should throw error for missing funnel/stage mapping', () => {
      const agendorDeal = {
        id: 12349,
        title: 'Negócio com funil desconhecido',
        dealStage: {
          id: 'unknown-stage',
          funnel: { id: 'unknown-funnel' }
        },
        dealStatus: { id: 1 }
      };
      
      expect(() => {
        transformDeal(agendorDeal, mappings, config);
      }).toThrow('No mapping found');
    });
    
    test('should handle zero value', () => {
      const agendorDeal = {
        id: 12350,
        title: 'Negócio sem valor',
        value: 0,
        dealStage: {
          id: '3174269',
          funnel: { id: '770626' }
        },
        dealStatus: { id: 1 },
        owner: { id: '858738' }
      };
      
      const result = transformDeal(agendorDeal, mappings, config);
      
      expect(result.value.toString()).toBe('0');
    });
    
  });
  
});
