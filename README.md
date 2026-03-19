# Migração Agendor → ZafChat

Sistema de migração de dados do CRM Agendor para o ZafChat (MongoDB multi-tenant).

## 📁 Estrutura

```
migration-agendor/
├── .env                    # Configurações (preencher antes de rodar)
├── package.json
├── src/
│   ├── lib/
│   │   ├── agendor-client.js   # Cliente API Agendor com rate limit
│   │   ├── mongo-client.js     # Cliente MongoDB
│   │   └── logger.js           # Sistema de logs
│   ├── transformers/
│   │   ├── transform-deal.js   # Transforma Deal → crmDeals
│   │   ├── transform-contact.js # Transforma Person/Org → contactCrm
│   │   └── transform-task.js   # Transforma Task → crmTasks
│   └── jobs/
│       ├── J0.1-validate-connection.js
│       ├── J0.2-create-indexes.js
│       ├── J1.1-fetch-users.js
│       ├── J1.2-fetch-funnels.js
│       ├── J1.3-fetch-deals.js
│       ├── J1.4-fetch-people.js
│       ├── J1.5-fetch-tasks.js
│       ├── J2.1-transform-contacts.js
│       ├── J2.2-transform-deals.js
│       ├── J2.3-transform-tasks.js
│       ├── J3.1-load-contacts.js
│       ├── J3.2-load-deals.js
│       ├── J3.3-load-tasks.js
│       ├── J4.1-verify.js
│       ├── run-all.js          # Orquestrador
│       └── rollback.js         # Desfaz migração
├── scripts/
│   ├── build.js               # Valida estrutura
│   ├── status.js              # Status da migração
│   ├── heartbeat-check.js     # Monitoramento
│   ├── generate-report.js     # Gera relatório HTML
│   ├── preview.js             # Preview de contagem
│   ├── link-tasks.js          # Vincula tarefas aos deals
│   └── export-data.js         # Exporta dados para auditoria
├── data/
│   └── mappings/
│       ├── users.json         # Mapeamento usuários
│       └── funnels-stages.json # Mapeamento funis
├── logs/
├── reports/
└── exports/
```

## 🚀 Quick Start

### 1. Configurar `.env`

```bash
# Agendor API
AGENDOR_API_KEY=seu_token_aqui
AGENDOR_API_BASE_URL=https://api.agendor.com.br/v3

# MongoDB ZafChat
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/zafchat
MONGODB_DATABASE=zafchat

# Settings
PROJECT_ID=396140
DEFAULT_USER_ID=45
```

### 2. Validar estrutura

```bash
node scripts/build.js
```

### 3. Preview (quantos registros serão migrados)

```bash
node scripts/preview.js
```

### 4. Executar migração completa

```bash
node src/jobs/run-all.js
```

### 5. Verificar resultado

```bash
node src/jobs/J4.1-verify.js
node scripts/generate-report.js
```

## 📋 Jobs

| Job | Descrição |
|-----|-----------|
| J0.1 | Valida conexão Agendor + MongoDB |
| J0.2 | Cria índices no MongoDB |
| J1.1 | Busca usuários do Agendor |
| J1.2 | Busca funis e stages |
| J1.3 | Busca deals (por status: open/won/lost) |
| J1.4 | Busca contatos (people + organizations) |
| J1.5 | Busca tarefas (pending + completed) |
| J2.1 | Transforma contatos |
| J2.2 | Transforma deals |
| J2.3 | Transforma tarefas |
| J3.1 | Insere contatos no ZafChat |
| J3.2 | Insere deals no ZafChat |
| J3.3 | Insere tarefas no ZafChat |
| J4.1 | Verifica integridade |

## 🔄 Retomar de ponto específico

```bash
node src/jobs/run-all.js --from=J1.3
```

## ⚠️ Rollback

```bash
node src/jobs/rollback.js
```

Remove todos os dados migrados do ZafChat (contacts, deals, tasks).

## 🛠️ Scripts Úteis

### Preview
Mostra quantos registros existem no Agendor antes de migrar:
```bash
node scripts/preview.js
```

### Link Tasks
Vincula tarefas aos deals após migração:
```bash
node scripts/link-tasks.js
```

### Export
Exporta dados de migração para auditoria:
```bash
node scripts/export-data.js
```

### Report
Gera relatório HTML com métricas:
```bash
node scripts/generate-report.js
# Abra reports/migration-report.html
```

## 📊 Mapeamentos

### Usuários (users.json)
```json
{
  "users": {
    "858738": 45,  // Agendor ID → ZafChat MySQL ID
    "863644": 68
  }
}
```

### Funis (funnels-stages.json)
```json
{
  "funnels": {
    "770626": {
      "agendorName": "Funil Comercial Geral",
      "zafchatId": "699bdcc4f3580905ba2cc132",
      "stages": {
        "3174269": "699bdcd6f3580905ba2cc133"
      }
    }
  }
}
```

## 🛡️ Rate Limits

- Agendor API: 4 req/segundo
- Paginação: 100 registros/página
- Retry automático com backoff exponencial

## 📝 Logs

Logs salvos em `logs/migration-YYYYMMDD.log`

## 🧠 Checkpoint

Todos os dados brutos são salvos na collection `MigrationControl` antes da transformação, permitindo:
- Retomar de qualquer ponto
- Auditoria completa
- Debug de erros
- Export para backup

## 🔧 Troubleshooting

### Erro: "Missing required environment variables"
- Verifique se o `.env` tem `AGENDOR_API_KEY` e `MONGODB_URI` preenchidos

### Erro: "Rate limited"
- O cliente faz retry automático (3x)
- Se persistir, aguarde alguns minutos

### Erro: "Task has no linked deal"
- Tarefas sem deal são ignoradas e logadas com status `skipped`
- Verifique o log ou export para ver quais foram ignoradas

### Erro de conexão MongoDB
- Verifique se a connection string está correta
- Verifique se o IP está na whitelist do Atlas

### Validação de telefone
- Contatos sem telefone válido recebem `number: AGENDOR-{id}`
- Status: `imported_without_phone`
- Verifique o relatório para ver quantos casos existem

## 📱 Rotas Agendor Utilizadas

| Rota | Job | Descrição |
|------|-----|-----------|
| `/users` | J1.1 | Usuários |
| `/funnels` | J1.2 | Funis + stages |
| `/deals?dealStatus=1` | J1.3 | Deals em aberto |
| `/deals?dealStatus=2` | J1.3 | Deals ganhos |
| `/deals?dealStatus=3` | J1.3 | Deals perdidos |
| `/people` | J1.4 | Pessoas |
| `/organizations` | J1.4 | Empresas |
| `/tasks?finishedEq=false` | J1.5 | Tarefas pendentes |
| `/tasks?finishedEq=true` | J1.5 | Tarefas concluídas |
