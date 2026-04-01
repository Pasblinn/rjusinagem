# Configuração do Banco de Dados

## Passo a Passo

### 1. Criar Projeto no Supabase

1. Acesse [supabase.com](https://supabase.com)
2. Crie uma conta ou faça login
3. Clique em "New Project"
4. Preencha:
   - Nome: `rj-usinagem`
   - Database Password: escolha uma senha forte
   - Region: escolha a mais próxima (ex: São Paulo)
5. Aguarde a criação (1-2 minutos)

### 2. Executar Schema SQL

1. No painel do Supabase, clique em **SQL Editor** no menu lateral
2. Clique em **New Query**
3. Copie TODO o conteúdo do arquivo `schema.sql`
4. Cole no editor e clique em **Run**
5. Aguarde a execução (pode levar alguns segundos)

### 3. Verificar Criação

Execute esta query para verificar:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

Deve retornar:
- `financeiro`
- `orcamentos`
- `ordens_producao`
- `pecas_defeituosas`
- `producao_diaria`
- `users`

### 4. Criar Usuário Financeiro

1. Vá em **Authentication > Users**
2. Clique em **Add user**
3. Preencha:
   - Email: `elizangela@rjusinagem.com.br`
   - Password: escolha uma senha segura
   - Auto Confirm User: ✅ (marque)
4. Clique em **Create user**
5. Copie o **User UID** que aparece

6. Volte ao **SQL Editor** e execute:

```sql
INSERT INTO public.users (id, email, nome, role)
VALUES ('COLE-O-UID-AQUI', 'elizangela@rjusinagem.com.br', 'Elizangela', 'financeiro');
```

### 5. Obter Credenciais para a Aplicação

1. Vá em **Settings > API** no painel do Supabase
2. Copie:
   - **Project URL** (ex: `https://abcd1234.supabase.co`)
   - **anon/public key** (chave longa começando com `eyJ...`)

3. Cole no arquivo `.env` do projeto:

```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-aqui
```

## Criar Usuários Adicionais

Para cada novo funcionário:

### Via Painel (Recomendado)

1. **Authentication > Users > Add user**
2. Preencha email e senha
3. Copie o User UID
4. No SQL Editor, execute:

```sql
INSERT INTO public.users (id, email, nome, role)
VALUES (
  'USER-UID-AQUI',
  'email@example.com',
  'Nome do Funcionário',
  'operador' -- ou 'chefe' ou 'financeiro'
);
```

### Via SQL (Avançado)

```sql
-- Isso NÃO cria no Authentication, apenas na tabela
-- Use apenas se já criou o usuário no Authentication
INSERT INTO public.users (id, email, nome, role)
VALUES (
  'user-uid-do-supabase-auth',
  'operador@rjusinagem.com',
  'João Silva',
  'operador'
);
```

## Níveis de Acesso (Roles)

- **`financeiro`** - Acesso total (apenas Elizangela)
- **`chefe`** - Criar e gerenciar OPs, aprovar, SEM acesso financeiro
- **`operador`** - Apenas registrar produção e defeitos

## Verificar Row Level Security (RLS)

Execute para verificar se as políticas RLS estão ativas:

```sql
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public';
```

Todas as tabelas devem ter `rowsecurity = true`.

## Função de Geração de Código

A função `gerar_codigo_op()` gera códigos automáticos no formato:
- `OP-2025-0001`
- `OP-2025-0002`
- ...

Ela é chamada automaticamente ao criar uma nova OP.

## View de Dashboard

A view `dashboard_stats` calcula estatísticas em tempo real:
- Total de OPs
- OPs em produção
- OPs finalizadas no mês atual
- Valor total a receber

## Backup do Banco

Para fazer backup:

1. No Supabase, vá em **Database > Backups**
2. Backups automáticos diários (plano gratuito)
3. Ou exporte via SQL:

```sql
-- No seu computador, com psql instalado
pg_dump -h db.seu-projeto.supabase.co -U postgres -d postgres > backup.sql
```

## Restaurar Banco

Se precisar restaurar:

1. Crie um novo projeto no Supabase
2. Execute o `schema.sql` completo
3. Importe os dados salvos

## Limites do Plano Gratuito

Supabase Free Tier:
- ✅ 500 MB de espaço
- ✅ 2 GB de transferência/mês
- ✅ 50 MB de armazenamento de arquivos
- ✅ Unlimited API requests
- ✅ Backup automático diário (7 dias)

Para RJ Usinagem, o plano gratuito deve ser suficiente por bastante tempo.

## Monitoramento

Para ver uso do banco:

1. **Database > Usage** no painel
2. Monitore:
   - Database size
   - Egress (transferência)
   - Connections

## Troubleshooting

### Erro: "relation does not exist"
- Execute o `schema.sql` completo novamente

### Erro: "permission denied"
- Verifique se as políticas RLS estão corretas
- Verifique se o usuário existe na tabela `users`

### Erro: "JWT expired"
- Faça logout e login novamente na aplicação

### Não consigo ver dados
- Verifique se você está logado com o usuário correto
- Verifique o role do usuário na tabela `users`
