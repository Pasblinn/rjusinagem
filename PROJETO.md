# RJ USINAGEM - Documentação Completa do Sistema

## Visão Geral

Sistema de Gestão de Ordens de Produção desenvolvido para a **RJ Usinagem**, uma empresa de usinagem industrial. O sistema gerencia todo o ciclo de vida das ordens de produção, desde a criação de orçamentos até o controle financeiro e emissão de notas fiscais.

---

## Tecnologias Utilizadas

### Frontend
| Tecnologia | Versão | Descrição |
|------------|--------|-----------|
| React | 18.2.0 | Biblioteca de interface de usuário |
| TypeScript | 5.3.3 | Superset tipado de JavaScript |
| Vite | 5.0.12 | Build tool e dev server |
| Tailwind CSS | 3.4.1 | Framework CSS utilitário |
| React Router DOM | 6.21.3 | Roteamento SPA |
| Zustand | 4.5.0 | Gerenciamento de estado |
| Lucide React | 0.316.0 | Biblioteca de ícones |
| date-fns | 3.3.1 | Manipulação de datas |

### Backend
| Tecnologia | Descrição |
|------------|-----------|
| Supabase | Backend-as-a-Service (PostgreSQL + Auth + RLS) |
| PostgreSQL | Banco de dados relacional |

### Desktop
| Tecnologia | Versão | Descrição |
|------------|--------|-----------|
| Electron | 28.2.0 | Framework para apps desktop |
| Electron Builder | 24.9.1 | Empacotamento e instaladores |

---

## Arquitetura do Projeto

```
rjusinagem/
├── database/
│   └── schema.sql          # Schema do banco de dados
├── electron/
│   ├── main.js             # Processo principal Electron
│   └── preload.js          # Script de preload
├── src/
│   ├── components/         # Componentes reutilizáveis
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── Input.tsx
│   │   ├── Layout.tsx
│   │   ├── Modal.tsx
│   │   ├── Select.tsx
│   │   ├── StatusBadge.tsx
│   │   ├── Textarea.tsx
│   │   └── Toast.tsx
│   ├── contexts/
│   │   └── AuthContext.tsx # Contexto de autenticação
│   ├── pages/
│   │   ├── Dashboard.tsx   # Tela principal
│   │   ├── Financeiro.tsx  # Módulo financeiro completo
│   │   ├── Login.tsx       # Tela de login
│   │   ├── OrdemProducaoDetalhes.tsx
│   │   └── OrdemProducaoForm.tsx
│   ├── services/
│   │   ├── api.ts          # Camada de serviços
│   │   └── supabase.ts     # Cliente Supabase
│   ├── types/
│   │   └── index.ts        # Tipos TypeScript
│   ├── App.tsx             # Componente raiz
│   ├── index.css           # Estilos globais + impressão
│   └── main.tsx            # Entry point
├── package.json
├── tailwind.config.js
├── tsconfig.json
└── vite.config.ts
```

---

## Sistema de Usuários e Permissões

### Tipos de Usuário (Roles)

| Role | Descrição | Permissões |
|------|-----------|------------|
| **financeiro** | Responsável financeiro (Elizangela) | Acesso total: criar/editar OPs, orçamentos, financeiro, relatórios |
| **chefe** | Supervisor de produção | Criar/editar OPs, aprovar OPs, ver produção |
| **operador** | Operador de máquina | Registrar produção diária, registrar defeitos |

### Hierarquia de Permissões

```
financeiro > chefe > operador

- financeiro: acesso a TUDO
- chefe: acesso a produção + criação de OPs
- operador: apenas registro de produção
```

### Usuários Cadastrados

| Nome | Email | Role | Acesso |
|------|-------|------|--------|
| Elizangela | elizangela@rjusinagem.com.br | financeiro | Acesso total |
| Thiago | thiagorianibelo@hotmail.com | financeiro | Acesso total |

### Autenticação

- **Método**: Email + Senha via Supabase Auth
- **Sessão**: Persistente com refresh token automático
- **Proteção de rotas**: Componente `PrivateRoute` no React Router

---

## Banco de Dados (PostgreSQL/Supabase)

### Tabelas Principais

#### 1. `users` - Usuários do Sistema
```sql
- id: UUID (PK, referência auth.users)
- email: TEXT UNIQUE NOT NULL
- nome: TEXT NOT NULL
- role: user_role ('financeiro', 'chefe', 'operador')
- created_at: TIMESTAMPTZ
```

#### 2. `ordens_producao` - Ordens de Produção
```sql
- id: UUID (PK)
- codigo: TEXT UNIQUE NOT NULL (ex: OP-2024-0001)
- tipo: op_type ('encomenda', 'estoque')
- status: op_status
- data_inicio: DATE NOT NULL
- data_termino: DATE

-- Informações da Peça
- cliente: TEXT NOT NULL
- nome_peca: TEXT NOT NULL
- quantidade_total: INTEGER NOT NULL
- preco_servico: NUMERIC(10,2) NOT NULL

-- Material
- material: TEXT
- codigo_descricao_material: TEXT
- quantidade_material: NUMERIC
- lote: TEXT
- fornecedor: TEXT
- observacoes_material: TEXT

-- Produção
- preparacao_maquina: TEXT NOT NULL
- maquina_utilizada: TEXT
- operador_responsavel: TEXT

-- Aprovação
- aprovada: BOOLEAN
- supervisor_nome: TEXT
- supervisor_data_aprovacao: TIMESTAMPTZ

-- Nota Fiscal
- nota_fiscal_emitida: BOOLEAN
- nota_fiscal_numero: TEXT
- nota_fiscal_data: DATE

-- Metadados
- created_by: UUID (FK users)
- created_at: TIMESTAMPTZ
- updated_at: TIMESTAMPTZ
```

#### 3. `producao_diaria` - Registros de Produção
```sql
- id: UUID (PK)
- op_id: UUID (FK ordens_producao)
- data: DATE NOT NULL
- turno: TEXT NOT NULL
- quantidade_produzida: INTEGER NOT NULL
- pecas_defeituosas: INTEGER NOT NULL
- observacoes: TEXT
- operador_id: UUID (FK users)
- created_at: TIMESTAMPTZ
```

#### 4. `pecas_defeituosas` - Controle de Defeitos
```sql
- id: UUID (PK)
- op_id: UUID (FK ordens_producao)
- data: DATE NOT NULL
- quantidade: INTEGER NOT NULL
- tipo_defeito: TEXT NOT NULL
- causa_provavel: TEXT NOT NULL
- acao_corretiva: TEXT NOT NULL
- created_at: TIMESTAMPTZ
```

#### 5. `financeiro` - Dados Financeiros
```sql
- id: UUID (PK)
- op_id: UUID UNIQUE (FK ordens_producao)
- valor_total: NUMERIC(10,2) NOT NULL
- valor_pago: NUMERIC(10,2)
- forma_pagamento: TEXT
- status_pagamento: PaymentStatus
- data_vencimento: DATE
- data_pagamento: DATE
- numero_parcelas: INTEGER
- parcela_atual: INTEGER
- custos_extras: NUMERIC(10,2)
- prejuizo_defeitos: NUMERIC(10,2)
- lucro_final: NUMERIC(10,2) (calculado automaticamente)
- observacoes: TEXT
- created_at: TIMESTAMPTZ
- updated_at: TIMESTAMPTZ
```

#### 6. `orcamentos` - Orçamentos
```sql
- id: UUID (PK)
- cliente: TEXT NOT NULL
- nome_peca: TEXT NOT NULL
- quantidade: INTEGER NOT NULL
- valor_estimado: NUMERIC(10,2) NOT NULL
- observacoes: TEXT
- status: OrcamentoStatus
- data_envio: TIMESTAMPTZ
- data_resposta: TIMESTAMPTZ
- versao: INTEGER
- convertido_op_id: UUID (FK ordens_producao)
- created_by: UUID (FK users)
- created_at: TIMESTAMPTZ
- updated_at: TIMESTAMPTZ
- updated_by: UUID
```

### Enums do Banco

| Enum | Valores |
|------|---------|
| `user_role` | financeiro, chefe, operador |
| `op_status` | criada, em_producao, finalizada, faturada, nota_emitida, paga |
| `op_type` | encomenda, estoque |
| `payment_status` | pendente, parcial, pago, atrasado, nao_pago |
| `orcamento_status` | rascunho, aberto, enviado, aprovado, reprovado, convertido, cancelado |

#### Enums V3 (Novos)

| Enum | Valores | Descrição |
|------|---------|-----------|
| `status_producao_enum` | criada, em_producao, pausada, finalizada, cancelada | Ciclo de produção |
| `status_financeiro_enum` | pendente, parcial, pago, atrasado, cancelado | Ciclo de pagamento |
| `movimento_tipo` | pagamento, pagamento_parcial, estorno, ajuste, desconto, juros, multa, custo_extra, prejuizo, cancelamento | Tipos de movimentação financeira |

### Row Level Security (RLS)

Todas as tabelas possuem RLS habilitado com políticas específicas:

| Tabela | SELECT | INSERT | UPDATE |
|--------|--------|--------|--------|
| users | Todos autenticados | - | - |
| ordens_producao | Todos autenticados | Financeiro + Chefe | Financeiro + Chefe |
| producao_diaria | Todos autenticados | Todos autenticados | - |
| pecas_defeituosas | Todos autenticados | Todos autenticados | - |
| financeiro | Apenas Financeiro | Apenas Financeiro | Apenas Financeiro |
| orcamentos | Apenas Financeiro | Apenas Financeiro | Apenas Financeiro |

### Funções do Banco

#### `gerar_codigo_op()`
Gera código sequencial automático para novas OPs no formato: `OP-{ANO}-{SEQUENCIAL}`
- Exemplo: OP-2024-0001, OP-2024-0002

#### `update_updated_at()`
Trigger que atualiza automaticamente o campo `updated_at` em modificações.

---

## Fluxo de Trabalho

### Fluxo de Orçamento → OP → Pagamento

```
1. ORÇAMENTO
   └─> Criar orçamento (rascunho)
       └─> Enviar ao cliente (enviado)
           └─> Cliente aprova (aprovado)
               └─> Converter em OP (convertido)
           └─> Cliente reprova (reprovado)

2. ORDEM DE PRODUÇÃO
   └─> OP criada (criada)
       └─> Iniciar produção (em_producao)
           └─> Registrar produção diária
           └─> Registrar defeitos (se houver)
       └─> Finalizar produção (finalizada)
           └─> Emitir nota fiscal (nota_emitida)
               └─> Registrar pagamento (paga)

3. FINANCEIRO (criado automaticamente com a OP)
   └─> Editar dados financeiros
       └─> Definir forma de pagamento
       └─> Definir vencimento
       └─> Registrar custos extras
       └─> Registrar prejuízo por defeitos
   └─> Registrar pagamentos parciais/totais
   └─> Acompanhar em relatórios
```

---

## Módulos do Sistema

### 1. Módulo de Login (`/login`)

**Funcionalidades:**
- Autenticação por email e senha
- Validação de credenciais via Supabase Auth
- Redirecionamento automático após login
- Mensagens de erro amigáveis

### 2. Dashboard Principal (`/`)

**Funcionalidades:**
- Lista de todas as OPs com filtros
- Cards de estatísticas:
  - Total de OPs
  - OPs em produção
  - OPs finalizadas no mês
  - Valor a receber (apenas financeiro)
- Busca por código ou cliente
- Filtro por status
- Navegação para detalhes da OP

### 3. Formulário de OP (`/op/nova` e `/op/:id/editar`)

**Campos do Formulário:**

| Seção | Campos |
|-------|--------|
| Informações Básicas | Tipo (encomenda/estoque), Data início, Data término |
| Cliente e Peça | Cliente, Nome da peça, Quantidade, Preço do serviço |
| Material | Material, Código/descrição, Quantidade, Lote, Fornecedor, Observações |
| Produção | Preparação da máquina (obrigatório), Máquina utilizada, Operador responsável |

**Funcionalidades:**
- Criação de nova OP (gera código automaticamente)
- Edição de OP existente
- Validação de campos obrigatórios
- **Criação automática de registro financeiro** ao salvar nova OP

### 4. Detalhes da OP (`/op/:id`)

**Funcionalidades:**
- Visualização completa dos dados da OP
- **Status V3:** Mostra badges separados de produção e financeiro
- **Controles de produção:**
  - Botão Iniciar (criada → em_producao)
  - Botão Pausar (em_producao → pausada)
  - Botão Retomar (pausada → em_producao)
  - Botão Finalizar (em_producao → finalizada)
  - Botão Cancelar (qualquer → cancelada)
- Aprovação da OP (requer nome do supervisor)
- Registro de produção diária:
  - Data, Turno
  - Quantidade produzida
  - Peças defeituosas
  - Observações
- Registro de defeitos:
  - Tipo de defeito
  - Causa provável
  - Ação corretiva
- Histórico de produção e defeitos
- Gráfico de progresso de produção

### 5. Módulo Financeiro (`/financeiro`)

O módulo mais completo do sistema, dividido em 6 abas:

#### 5.1 Aba Dashboard (Visão Geral)

**Cards de Resumo:**
| Card | Descrição |
|------|-----------|
| Faturado no Mês | Soma dos valores das OPs criadas no mês atual |
| Recebido no Mês | Soma dos pagamentos recebidos no mês atual |
| Total em Aberto | Soma dos valores pendentes de todas as OPs |

**Indicadores de Alerta:**
| Indicador | Descrição |
|-----------|-----------|
| Pagamentos Atrasados | OPs com vencimento passado e não pagas |
| Aguardando Pagamento | OPs com status pendente |
| OPs sem Nota Fiscal | OPs finalizadas sem NF emitida |

#### 5.2 Aba Orçamentos

**Funcionalidades:**
- Criar novo orçamento
- Editar orçamento existente
- Fluxo de status:
  - Rascunho → Aberto → Enviado → Aprovado/Reprovado
  - Aprovado → Convertido em OP
- Filtros por status
- Busca por cliente ou peça

**Campos do Orçamento:**
- Cliente
- Nome da peça
- Quantidade
- Valor estimado
- Observações

#### 5.3 Aba Contas a Receber

**Funcionalidades:**
- Lista de todas as contas organizadas por situação
- Resumo de totais (total, recebido, pendente)
- Filtros por situação financeira
- Busca por cliente, código ou peça
- Registro de pagamento parcial ou total

**Situações Financeiras:**
| Situação | Cor | Descrição |
|----------|-----|-----------|
| Atrasado | Vermelho | Vencimento passado, não pago |
| Pendente | Amarelo | Aguardando pagamento |
| Parcial | Azul | Pagamento parcial realizado |
| Pago | Verde | Totalmente pago |

#### 5.4 Aba OPs e Financeiro

**Funcionalidades:**
- Lista de OPs com dados financeiros vinculados
- **Botão "Histórico":** Abre modal com timeline de movimentações financeiras
- Edição de dados financeiros de cada OP:
  - Valor total
  - Forma de pagamento
  - Status de pagamento
  - Data de vencimento
  - Custos extras
  - Prejuízo por defeitos
  - Observações
- Cálculo automático do lucro final
- **V3:** Pagamentos criam entradas no ledger (`financeiro_movimentos`)

#### 5.5 Aba Faturamento (Previsão)

**Funcionalidades:**
- Lista de OPs finalizadas aguardando nota fiscal
- Total de previsão de faturamento
- Registro de nota fiscal:
  - Número da NF
  - Data de emissão
- Link direto para site da prefeitura (emissão de NF)

#### 5.6 Aba Relatórios

**6 Tipos de Relatórios com Impressão:**

| Relatório | Descrição | Filtros |
|-----------|-----------|---------|
| Ficha de OP | Documento completo para produção | Seleção de OP |
| Resumo Financeiro | Visão geral do mês | Nenhum |
| Contas a Receber | Lista de valores pendentes | Nenhum |
| Histórico do Cliente | Todas as OPs de um cliente | Seleção de cliente |
| Produção por Período | Produção em intervalo de datas | Data início/fim |
| OPs por Status | OPs filtradas por status | Seleção de status |

**Funcionalidades de Impressão:**
- Botão "Imprimir" em cada relatório
- Abre janela de impressão do Windows
- Layout otimizado para papel A4
- Cabeçalho com nome da empresa e data/hora
- Rodapé com identificação do sistema
- CSS específico para mídia de impressão

---

## API de Serviços (api.ts)

### Ordens de Produção

| Função | Descrição |
|--------|-----------|
| `gerarCodigoOP()` | Gera código sequencial |
| `getOrdemProducao(id)` | Busca OP por ID |
| `listOrdensProducao(filters)` | Lista OPs com filtros |
| `createOrdemProducao(op)` | Cria OP + financeiro automático |
| `updateOrdemProducao(id, updates)` | Atualiza OP |
| `aprovarOP(id, supervisorNome)` | Aprova OP |
| `emitirNotaFiscal(id, numeroNota)` | Registra NF |

### Produção

| Função | Descrição |
|--------|-----------|
| `getProducaoDiaria(opId)` | Lista produção de uma OP |
| `createProducaoDiaria(producao)` | Registra produção |
| `getPecasDefeituosas(opId)` | Lista defeitos de uma OP |
| `createPecaDefeituosa(defeito)` | Registra defeito |

### Financeiro

| Função | Descrição |
|--------|-----------|
| `getFinanceiro(opId)` | Busca financeiro por OP |
| `createFinanceiro(financeiro)` | Cria registro financeiro |
| `updateFinanceiro(id, updates)` | Atualiza financeiro |
| `registrarPagamento(id, valor, data, forma)` | Registra pagamento |

### Orçamentos

| Função | Descrição |
|--------|-----------|
| `listOrcamentos(status)` | Lista orçamentos |
| `getOrcamento(id)` | Busca orçamento por ID |
| `createOrcamento(orcamento)` | Cria orçamento |
| `updateOrcamento(id, updates)` | Atualiza orçamento |
| `enviarOrcamento(id)` | Marca como enviado |
| `aprovarOrcamento(id)` | Marca como aprovado |
| `reprovarOrcamento(id)` | Marca como reprovado |
| `converterOrcamentoEmOP(orcId, opId)` | Converte em OP |

### Dashboard e Relatórios

| Função | Descrição |
|--------|-----------|
| `getDashboardStats()` | Estatísticas gerais |
| `getDashboardFinanceiro()` | Estatísticas financeiras |
| `getContasReceber()` | Lista contas a receber |
| `getPrevisaoFaturamento()` | OPs aguardando NF |
| `getHistoricoFinanceiro(opId)` | Histórico de uma OP |
| `getHistoricoCliente(nome)` | Histórico de um cliente |
| `getClientes()` | Lista de clientes únicos |

---

## Componentes Reutilizáveis

### Button
```tsx
<Button
  variant="primary|secondary|success|danger|outline"
  size="sm|md|lg"
  fullWidth={boolean}
  disabled={boolean}
>
```

### Card
```tsx
<Card
  padding="none|sm|md|lg"
  className={string}
  onClick={function}
>
```

### Input
```tsx
<Input
  label={string}
  type="text|number|date|email|password"
  value={string}
  onChange={function}
  required={boolean}
  placeholder={string}
/>
```

### Select
```tsx
<Select
  label={string}
  options={[{ value: string, label: string }]}
  value={string}
  onChange={function}
/>
```

### Modal
```tsx
<Modal
  isOpen={boolean}
  onClose={function}
  title={string}
>
  {children}
</Modal>
```

### Toast
```tsx
<Toast
  message={string}
  type="success|error"
  onClose={function}
/>
```

### StatusBadge
```tsx
<StatusBadge
  status={OPStatus|PaymentStatus|StatusProducao|StatusFinanceiro}
  type="op|payment|producao|financeiro"
/>
```

**Tipos V3:**
- `type="producao"`: criada, em_producao, pausada, finalizada, cancelada
- `type="financeiro"`: pendente, parcial, pago, atrasado, cancelado

### Layout
```tsx
<Layout>
  {/* Conteúdo da página */}
</Layout>
```
- Navbar com nome do usuário e logout
- Menu lateral com navegação
- Área de conteúdo principal

---

## Estilos de Impressão

O sistema possui CSS dedicado para impressão (`@media print`):

```css
/* Elementos ocultos na impressão */
.no-print, nav, header, .sidebar, button:not(.print-button)

/* Classes de impressão */
.print-container    /* Container principal */
.print-header       /* Cabeçalho do relatório */
.print-table        /* Tabelas formatadas */
.print-section      /* Seções do relatório */
.print-summary-card /* Cards de resumo */
.print-op-ficha     /* Ficha de OP */
.print-footer       /* Rodapé */
.page-break         /* Quebra de página */
.print-status-*     /* Badges de status */
```

---

## Scripts de Build

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Inicia em modo desenvolvimento |
| `npm run build` | Compila para produção |
| `npm run build:win` | Gera instalador Windows (.exe) |
| `npm run preview` | Preview do build |

### Instalador Windows

- **Formato**: NSIS installer
- **Saída**: `dist-electron/RJ Usinagem Setup 1.0.0.exe`
- **Configurações**:
  - Permite escolher diretório de instalação
  - Cria atalho na área de trabalho
  - Cria atalho no menu iniciar
  - Requer privilégios de administrador

---

## Configuração do Supabase

### Variáveis de Ambiente

Arquivo `.env`:
```
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anon
```

### Políticas RLS Necessárias

```sql
-- Permitir criação automática de financeiro
CREATE POLICY "Usuários podem criar financeiro"
  ON public.financeiro FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
```

---

## Considerações de Segurança

1. **Autenticação**: Via Supabase Auth com tokens JWT
2. **Autorização**: Row Level Security no banco de dados
3. **Permissões**: Verificação client-side e server-side
4. **Senhas**: Hash automático pelo Supabase
5. **Sessões**: Tokens com expiração e refresh automático

---

## V3 - Melhorias Arquiteturais (Janeiro/2026)

A versão 3 trouxe melhorias significativas na arquitetura do banco de dados para evitar problemas futuros.

### 1. Separação de Status (Produção vs Financeiro)

**Problema resolvido:** O campo `status` antigo misturava conceitos operacionais e financeiros.

**Solução:** Dois campos separados:

| Campo | Tipo | Valores |
|-------|------|---------|
| `status_producao` | status_producao_enum | criada, em_producao, pausada, finalizada, cancelada |
| `status_financeiro` | status_financeiro_enum | pendente, parcial, pago, atrasado, cancelado |

**Benefícios:**
- OP pode estar "finalizada" mas "pendente" de pagamento
- Relatórios mais precisos
- Código mais limpo sem ifs complexos

---

### 2. Histórico Financeiro (Ledger)

**Nova tabela:** `financeiro_movimentos`

Registra **todas** as movimentações financeiras de forma imutável:

| Tipo | Descrição |
|------|-----------|
| pagamento | Pagamento recebido |
| pagamento_parcial | Pagamento parcial |
| estorno | Devolução/estorno |
| ajuste | Ajuste manual |
| desconto | Desconto concedido |
| juros | Juros por atraso |
| multa | Multa aplicada |
| custo_extra | Custo extra adicionado |
| prejuizo | Prejuízo por defeito |
| cancelamento | Cancelamento |

**Views disponíveis:**
- `extrato_financeiro` - Extrato completo com dados da OP

**Funções da API:**
```typescript
api.registrarMovimento(financeiroId, tipo, valor, opcoes)
api.getMovimentosFinanceiro(financeiroId)
api.getMovimentosOP(opId)
api.getExtratoFinanceiro(filtros)
```

---

### 3. Clientes Normalizados

**Nova tabela:** `clientes`

```sql
- id: UUID (PK)
- nome: TEXT NOT NULL
- nome_fantasia: TEXT
- documento: TEXT (CPF/CNPJ)
- tipo_documento: 'cpf' | 'cnpj'
- email, telefone, celular
- endereco, numero, complemento, bairro, cidade, estado, cep
- contato_nome: TEXT
- observacoes: TEXT
- ativo: BOOLEAN (soft delete)
```

**Benefícios:**
- Evita duplicação de nomes
- Histórico completo por cliente
- Dados de contato centralizados

**Referência:** `ordens_producao.cliente_id` → `clientes.id`

**View:** `cliente_estatisticas` - Total de OPs, faturado, pago, pendente por cliente

**Funções da API:**
```typescript
api.listClientes(filtros)
api.getCliente(id)
api.createCliente(cliente)
api.updateCliente(id, updates)
api.desativarCliente(id)
api.getClienteEstatisticas(clienteId)
api.buscarOuCriarCliente(nome, userId)
```

---

### 4. Auditoria e Soft Delete

**Novos campos em todas as tabelas principais:**

| Campo | Descrição |
|-------|-----------|
| `updated_by` | UUID do último usuário que alterou |
| `deleted_at` | Data do soft delete (NULL = ativo) |
| `deleted_by` | UUID do usuário que deletou |

**Nova tabela:** `audit_log`

Registra automaticamente todas as alterações:
- Tabela e registro alterado
- Ação (INSERT, UPDATE, DELETE, SOFT_DELETE)
- Dados anteriores e novos (JSONB)
- Campos alterados
- Usuário e timestamp

**View:** `audit_log_detalhado` - Log com nome do usuário

**Soft Delete:**
- Registros não são deletados fisicamente
- Campo `deleted_at` marca como inativo
- View `ordens_producao_ativas` filtra automaticamente

---

### 5. Regras de Negócio no Banco

**Constraints implementadas:**

| Regra | Descrição |
|-------|-----------|
| `chk_valor_pago_nao_excede` | Valor pago ≤ valor total |
| `chk_datas_consistentes` | Data término ≥ data início |
| `chk_quantidade_positiva` | Quantidades ≥ 0 |

**Triggers automáticos:**

1. **Sincronização de status:** Quando `financeiro` muda, `status_financeiro` da OP atualiza automaticamente
2. **Auditoria:** Toda alteração é logada em `audit_log`

---

### 6. Novas Funções da API (V3)

#### Status
```typescript
api.alterarStatusProducao(id, novoStatus)
api.alterarStatusFinanceiro(id, novoStatus)
api.iniciarProducao(id)
api.pausarProducao(id)
api.finalizarProducao(id)
api.cancelarOP(id)
```

#### Filtros expandidos
```typescript
api.listOrdensProducao({
  status?: string,          // legado
  statusProducao?: string,  // V3
  statusFinanceiro?: string, // V3
  search?: string
})
```

---

### Arquivos de Migração

```
database/
├── schema.sql                      # Schema original
├── migration_v3_etapa1_status.sql  # Separação de status
├── migration_v3_etapa2_ledger.sql  # Histórico financeiro
├── migration_v3_etapa3_clientes.sql # Clientes normalizados
├── migration_v3_etapa4_auditoria.sql # Auditoria e soft delete
└── migration_v3_etapa5_regras.sql  # Regras de negócio
```

---

### Compatibilidade

- Campo `status` antigo foi **mantido** para compatibilidade
- Campo `cliente` (TEXT) foi **mantido**, mas use `cliente_id`
- Todas as funções antigas continuam funcionando
- Migração de dados existentes é automática

---

### 7. Atualização Automática (Polling)

**Problema resolvido:** Usuários em computadores diferentes não viam atualizações em tempo real.

**Solução:** Polling automático a cada 30 segundos.

**Páginas com polling:**
- Dashboard (lista de OPs)
- Financeiro (todas as abas)

**Funcionalidades:**
- Atualização automática a cada 30 segundos
- Indicador visual mostrando horário da última atualização
- Botão para forçar atualização manual (ícone de refresh)
- Atualização silenciosa (sem loading na tela)

**Como funciona:**
```
Thiago cria OP → Salva no banco → Em até 30s aparece na tela da Elizangela
```

**Configuração:**
```typescript
const POLLING_INTERVAL = 30000 // 30 segundos
```

---

### 8. Frontend V3 Completo (v3.2.0)

**Atualizações de interface para usar a nova arquitetura V3:**

#### Dashboard (Dashboard.tsx)
- ✅ Filtros atualizados para usar `status_producao`
- ✅ StatusBadge mostra status de produção e financeiro separados
- ✅ API usa `statusProducao` para filtros

#### Formulário de OP (OrdemProducaoForm.tsx)
- ✅ Cria OPs com `status_producao: 'criada'` e `status_financeiro: 'pendente'`
- ✅ Seletor de clientes com autocomplete (usando tabela `clientes` normalizada)
- ✅ Suporte a clientes legados (migração transparente)

#### Detalhes da OP (OrdemProducaoDetalhes.tsx)
- ✅ Mostra dois StatusBadge separados (produção + financeiro)
- ✅ Botões de controle de produção:
  - **Iniciar** (criada → em_producao)
  - **Pausar** (em_producao → pausada)
  - **Retomar** (pausada → em_producao)
  - **Finalizar** (em_producao → finalizada)
  - **Cancelar** (qualquer → cancelada)

#### Módulo Financeiro (Financeiro.tsx)
- ✅ StatusBadge com `type="producao"` para status de produção
- ✅ Botão "Histórico" em cada OP para ver movimentos financeiros
- ✅ Modal de histórico com timeline de movimentações
- ✅ `registrarPagamento()` agora usa `api.registrarMovimento()` para criar entradas no ledger
- ✅ Tipos de movimento: pagamento, pagamento_parcial, estorno, etc.

#### Componente StatusBadge (StatusBadge.tsx)
- ✅ Props `type="producao"` e `type="financeiro"`
- ✅ Cores diferenciadas por tipo de status
- ✅ Novos status: `pausada`, `cancelada`, `cancelado`

---

## Melhorias Futuras Sugeridas

1. [ ] Dashboard com gráficos (Chart.js ou Recharts)
2. [ ] Notificações push para pagamentos atrasados
3. [ ] Exportação de relatórios para PDF/Excel
4. [ ] Backup automático do banco
5. [ ] Integração com sistemas de NF-e
6. [ ] App mobile para operadores
7. [ ] Controle de estoque de materiais
8. [ ] Gestão de ferramentas/máquinas
9. [ ] Calendário de produção
10. [ ] Indicadores de produtividade (OEE)
11. [ ] Interface para cadastro completo de clientes
12. [ ] Tela de visualização do audit_log
13. [ ] Relatório de extrato financeiro por cliente

---

## Suporte

- **Desenvolvido para**: RJ Usinagem
- **Usuários principais**: Elizangela e Thiago (Financeiro)
- **Versão**: 3.2.0

---

## Histórico de Versões

| Versão | Data | Descrição |
|--------|------|-----------|
| 1.0.0 | Jan/2026 | Versão inicial com OPs, Financeiro, Orçamentos |
| 2.0.0 | Jan/2026 | Melhorias no financeiro, parcelas, histórico |
| 3.0.0 | Jan/2026 | Separação de status, ledger, clientes normalizados, auditoria |
| 3.1.0 | Jan/2026 | Polling automático (atualização a cada 30s) |
| 3.2.0 | Jan/2026 | Frontend V3 completo (badges separados, controles de produção, histórico de movimentos) |

---

*Documentação atualizada em Janeiro/2026*
