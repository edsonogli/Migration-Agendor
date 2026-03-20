require('dotenv').config();
const AgendorClient = require('../src/lib/agendor-client');
const fs = require('fs');

async function exportProducts() {
  const agendorClient = new AgendorClient();
  console.log('Buscando todos os produtos do Agendor...');
  
  try {
    const products = await agendorClient.getProducts();
    console.log(`Encontrados ${products.length} produtos.`);
    
    const mapping = { products: {} };
    for (const p of products) {
      mapping.products[p.id.toString()] = {
        zafchatId: "",
        name: p.name
      };
    }
    
    fs.writeFileSync('produtos-agendor-para-mapear.json', JSON.stringify(mapping, null, 2));
    console.log('Arquivo gerado: produtos-agendor-para-mapear.json');
    console.log('Basta preencher os zafchatId e copiar para data/mappings/products.json');
    
  } catch (error) {
    console.error('Erro:', error.message);
  }
}

exportProducts();