# RJ Usinagem - Sistema de Gestão de Produção

Sistema desktop para gestão de Ordens de Produção e controle financeiro da RJ Usinagem.

## Características

- **Desktop App para Windows** - Aplicação nativa instalável
- **Banco de dados remoto compartilhado** - PostgreSQL via Supabase
- **Interface simples e visual** - Ideal para usuários sem experiência com computador
- **Controle de permissões** - 3 níveis: Financeiro, Chefe e Operador
- **Gestão completa de OPs** - Do orçamento ao pagamento
- **Controle financeiro robusto** - Orçamentos, custos e lucros

## Tecnologias

- **Electron** - Desktop app para Windows
- **React + TypeScript** - Interface moderna e tipada
- **Tailwind CSS** - Estilização limpa e responsiva
- **Supabase** - Backend completo (PostgreSQL + Auth + RLS)
- **Vite** - Build rápido
- **Electron Builder** - Empacotamento

## Pré-requisitos

- Node.js 18 ou superior
- npm ou yarn
- Conta no Supabase (gratuita)

## Configuração Inicial

### 1. Instalar Dependências

```bash
npm install
```

### 2. Configurar Supabase

1. Crie uma conta gratuita em [supabase.com](https://supabase.com)
2. Crie um novo projeto
3. No painel do Supabase, vá em **SQL Editor**
4. Execute o script `database/schema.sql` completo
5. Copie as credenciais:
   - URL do projeto (Project URL)
   - Chave anônima (anon/public key)

### 3. Configurar Variáveis de Ambiente

1. Copie o arquivo de exemplo:
```bash
cp .env.example .env
```

2. Edite o arquivo `.env` e adicione suas credenciais do Supabase:
```
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anonima-aqui
```

### 4. Criar Usuário Financeiro (Elizangela)

1. No painel do Supabase, vá em **Authentication > Users**
2. Clique em **Add user** e crie:
   - Email: elizangela@rjusinagem.com.br
   - Senha: escolha uma senha segura
3. Após criar, copie o **User UID**
4. No **SQL Editor**, execute:

```sql
INSERT INTO public.users (id, email, nome, role)
VALUES ('cole-o-user-uid-aqui', 'elizangela@rjusinagem.com.br', 'Elizangela', 'financeiro');
```

### 5. Criar Usuários Adicionais

Para cada novo usuário:

1. Crie no Supabase Authentication
2. Insira na tabela `users` com o role apropriado:
   - `'financeiro'` - Acesso total (apenas Elizangela)
   - `'chefe'` - Criar e gerenciar OPs
   - `'operador'` - Registrar produção

Exemplo:
```sql
INSERT INTO public.users (id, email, nome, role)
VALUES ('user-uid', 'email@example.com', 'Nome do Usuário', 'operador');
```

## Executar em Desenvolvimento

```bash
npm run dev
```

Isso iniciará:
- Servidor Vite em `http://localhost:5173`
- Aplicação Electron em modo desenvolvimento

## Build para Produção

### Gerar Build

```bash
npm run build:win
```

Isso criará:
- Pasta `dist-electron/` com o instalador
- Arquivo `.exe` instalável para Windows

### Configurar Inno Setup (Opcional)

Para criar um instalador mais personalizado:

1. Instale o [Inno Setup](https://jrsoftware.org/isdl.php)
2. O Electron Builder já cria um instalador NSIS por padrão
3. Para customizar, edite `package.json` na seção `build.nsis`

## Estrutura do Projeto

```
rjusinagem/
├── electron/              # Código do processo principal Electron
│   ├── main.js           # Entry point do Electron
│   └── preload.js        # Script de preload
├── src/                  # Código React
│   ├── components/       # Componentes reutilizáveis
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   ├── Card.tsx
│   │   ├── Layout.tsx
│   │   └── ...
│   ├── pages/            # Páginas principais
│   │   ├── Login.tsx
│   │   ├── Dashboard.tsx
│   │   ├── OrdemProducaoForm.tsx
│   │   ├── OrdemProducaoDetalhes.tsx
│   │   └── Financeiro.tsx
│   ├── contexts/         # Contextos React (Auth)
│   ├── services/         # APIs (Supabase, etc)
│   ├── types/            # TypeScript types
│   ├── App.tsx           # Rotas principais
│   ├── main.tsx          # Entry point React
│   └── index.css         # Estilos globais
├── database/             # Scripts SQL
│   └── schema.sql        # Schema completo do banco
├── package.json          # Dependências e scripts
├── vite.config.ts        # Configuração Vite
├── tailwind.config.js    # Configuração Tailwind
└── tsconfig.json         # Configuração TypeScript
```

## Funcionalidades Implementadas

### Controle de Usuários
- ✅ Sistema de login com Supabase Auth
- ✅ 3 níveis de permissão
- ✅ Row Level Security (RLS) no banco

### Ordens de Produção
- ✅ Criação de OP com código automático
- ✅ Tipo: Encomenda ou Estoque
- ✅ Preparação de máquina (obrigatório)
- ✅ Informações de material
- ✅ Dados do cliente e peça
- ✅ Aprovação por supervisor
- ✅ Edição bloqueada após aprovação

### Registro de Produção
- ✅ Registro diário (data, turno, quantidade)
- ✅ Acumulado automático
- ✅ Registro de peças defeituosas
- ✅ Histórico completo

### Financeiro (Apenas Elizangela)
- ✅ Criar orçamentos
- ✅ Controlar pagamentos (visual VERDE/VERMELHO)
- ✅ Custos extras e prejuízos
- ✅ Cálculo automático de lucro
- ✅ Link direto para emissão de NF

### Dashboard
- ✅ Total de OPs
- ✅ OPs em produção
- ✅ OPs finalizadas no mês
- ✅ Valor a receber
- ✅ Busca e filtros

## Regras de Negócio

### Permissões

**Financeiro (Elizangela)**
- Ver e editar TUDO
- Criar orçamentos
- Converter orçamento em OP
- Ver valores financeiros
- Editar status de pagamento
- Acessar emissão de NF

**Chefe / Encarregado**
- Criar OP
- Editar cliente, quantidade e valor
- Aprovar OP
- NÃO vê valores financeiros detalhados

**Operador**
- Registrar produção
- Registrar defeitos
- Registrar máquina
- NÃO vê valores
- NÃO altera cliente/valor

### Fluxo da OP

1. OP é criada no sistema
2. Produção ocorre (papel)
3. Após finalização, dados do papel são lançados no sistema
4. Sistema = Histórico + Base financeira + Relatórios

### Após Aprovação

- Dados financeiros e de cliente: **BLOQUEADOS**
- Produção ainda pode ser registrada

## Preparação para Futuro

O sistema está preparado para expansão futura:
- ✅ Estrutura de banco escalável
- ✅ Autenticação centralizada
- ✅ RLS configurado
- 🔜 Estoque
- 🔜 Emissão automática de NF
- 🔜 Relatórios avançados
- 🔜 Mobile

## Solução de Problemas

### Erro ao conectar com Supabase
- Verifique se o arquivo `.env` existe e tem as credenciais corretas
- Verifique se você executou o `schema.sql` completo
- Teste as credenciais acessando o painel do Supabase

### Erro de permissão no banco
- Verifique se as políticas RLS estão ativas
- Verifique se o usuário existe na tabela `users`
- Verifique se o role está correto

### Aplicação não inicia
- Verifique se todas as dependências foram instaladas: `npm install`
- Limpe o cache: `rm -rf node_modules package-lock.json` e reinstale
- Verifique se a porta 5173 está disponível

### Build falha
- Execute `npm run build` primeiro para verificar erros de TypeScript
- Verifique se todas as dependências de produção estão instaladas

## Suporte

Para dúvidas ou problemas:
1. Verifique este README
2. Verifique os logs do console
3. Verifique os logs do Supabase
4. Contate o desenvolvedor

## Licença

Propriedade da RJ Usinagem - Todos os direitos reservados
