# Arquitetura da Migração (Agendor -> ZafChat)

Este documento foi gerado automaticamente para manter o contexto técnico sobre a estrutura de scripts de migração desenvolvida no projeto. Ele garante que qualquer agente ou dev entenda o estado atual da base de código.

## 1. Contexto Geral
A migração pega os dados do **Agendor** via API, salva numa área de "staging" no MongoDB (`migrationControl`), faz as transformações (`mapped`) e depois insere nas coleções oficiais do **ZafChat**.

## 2. Jobs de Migração (Scripts criados)
Todos os scripts rodam na pasta `src/jobs/` em ordem, e já consideram falhas, paginação e logs.

- **`J0` - Setup Base**: Validação de banco e conexões.
- **`J1` - Fetching (Agendor -> Staging)**: Scripts independentes que trazem Users, Funnels, People e Deals originais.
- **`J2` - Transforming**:
  - `J2.1-transform-contacts.js`: Pega "Person/Organization" e cria a estrutura de contatos do ZafChat (inclui lógica de número de whatsapp, salvando um placeholder `AGENDOR-ID` em quem não tem, mas mantendo rastreio original). Adiciona também `source: 'agendor'` e `origin` baseado no lead.
  - `J2.2-transform-deals.js`: Vincula Funis, Estágios e Usuários. **Novidade**: Já lê a base de contatos extraídos no `J1.4` para cruzar o WhatsApp do contato principal diretamente com o Deal no ZafChat (matando o placeholder na raiz). Transforma array de produtos lendo de `agendorDeal.products`.
- **`J3` - Loading (Staging -> ZafChat)**:
  - `J3.1` e `J3.2` carregam na base final os contatos e os Deals. Verifica duplicidades (via agendorId e telefones) para não duplicar se rodar duas vezes.

## 3. Arquivos de De-Para (Mappings)
Localizados em `data/mappings/`. Eles são cruciais e lidos nos jobs do `J2`:
- `funnels-stages.json`: Mapeia de qual funil do Agendor vai para qual Pipeline e Coluna no ZafChat.
- `products.json`: Cruzamento de todos os 18 Produtos do Agendor para seus respectivos ObjectIds do banco do ZafChat.
- `users.json`: Mapeamento de donos de negócio.

## 4. Estado Atual e Segurança
- O Token do GitHub está configurado de forma permanente no SO via Windows Credential Manager.
- Todos os arquivos até o momento estão validados, incluindo leitura de acentuação (UTF-8).