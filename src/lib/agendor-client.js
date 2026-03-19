/**
 * Agendor API Client
 * Handles authentication, rate limiting, and pagination
 */

const axios = require('axios');

class AgendorClient {
  constructor(config = {}) {
    this.baseURL = config.baseURL || process.env.AGENDOR_API_BASE_URL || 'https://api.agendor.com.br/v3';
    this.apiKey = config.apiKey || process.env.AGENDOR_API_KEY;
    this.rateLimitRPS = config.rateLimitRPS || parseInt(process.env.AGENDOR_RATE_LIMIT_RPS) || 4;
    
    this.lastRequestTime = 0;
    this.minIntervalMs = 1000 / this.rateLimitRPS;
    
    this.client = axios.create({
      baseURL: this.baseURL,
      headers: {
        'Authorization': `Token ${this.apiKey}`,
        'Content-Type': 'application/json'
      }
    });
  }

  /**
   * Enforce rate limiting
   */
  async enforceRateLimit() {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    
    if (elapsed < this.minIntervalMs) {
      await new Promise(resolve => setTimeout(resolve, this.minIntervalMs - elapsed));
    }
    
    this.lastRequestTime = Date.now();
  }

  /**
   * Make a GET request with rate limiting and retry
   */
  async get(endpoint, params = {}, retries = 3) {
    await this.enforceRateLimit();
    
    try {
      const response = await this.client.get(endpoint, { params });
      return response.data;
    } catch (error) {
      if (error.response?.status === 429 && retries > 0) {
        // Rate limited - exponential backoff
        const delay = Math.pow(2, 4 - retries) * 1000;
        console.warn(`Rate limited. Retrying in ${delay}ms... (${retries} retries left)`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.get(endpoint, params, retries - 1);
      }
      throw error;
    }
  }

  /**
   * Fetch all pages of a resource
   */
  async fetchAll(endpoint, params = {}, pageSize = 100) {
    const allData = [];
    let page = 1;
    let totalCount = 0;
    
    do {
      const response = await this.get(endpoint, { 
        ...params, 
        page, 
        per_page: pageSize 
      });
      
      if (response.data) {
        allData.push(...response.data);
        totalCount = response.meta?.totalCount || response.data.length;
      }
      
      console.log(`Fetched page ${page} of ${endpoint} (${allData.length}/${totalCount})`);
      page++;
      
    } while (allData.length < totalCount);
    
    return allData;
  }

  // ========== RESOURCE METHODS ==========

  async getUsers() {
    return this.fetchAll('/users');
  }

  async getFunnels() {
    return this.fetchAll('/funnels');
  }

  async getDeals(filters = {}) {
    return this.fetchAll('/deals', filters);
  }

  async getDealsByStatus(statusId) {
    return this.fetchAll('/deals', { dealStatus: statusId });
  }

  async getTasks(filters = {}) {
    return this.fetchAll('/tasks', filters);
  }

  async getPeople(filters = {}) {
    return this.fetchAll('/people', filters);
  }

  async getOrganizations(filters = {}) {
    return this.fetchAll('/organizations', filters);
  }
}

module.exports = AgendorClient;
