# Backup sazonal RJ Usinagem — Operação e Restore

Projeto Supabase: `kkevepwlvvhqweocywvq`

## Como funciona

- **Frequência**: toda segunda-feira 06:00 UTC (03:00 BRT)
- **Disparador**: job `rjusinagem-backup-semanal` no `pg_cron` chama `public.trigger_backup_semanal()`, que faz `POST` via `pg_net` para a Edge Function `backup-semanal`
- **Conteúdo**: todas as 16 tabelas `public.*` exportadas como JSON único
- **Destino**: bucket privado `backups/` (Storage), arquivo `backup_YYYY-MM-DD_HHMMZ.json`
- **Retenção**: 12 semanas (arquivos mais antigos são removidos automaticamente após cada execução)
- **Autenticação**: duas camadas — JWT (`anon` key) + header `x-backup-secret`

## Setup

Já está pronto. A Edge Function valida o header `x-backup-secret` via RPC `public.verify_backup_token`, que compara contra o Vault — não há env var manual a configurar. **Primeira execução manual validada** (HTTP 200, 422 linhas em 16 tabelas, arquivo `backup_2026-05-19_0102Z.json`).

Para disparar manualmente:

```sql
SELECT public.trigger_backup_semanal();
-- aguarde 1-2s e verifique:
SELECT status_code, content::jsonb FROM net._http_response ORDER BY id DESC LIMIT 1;
-- esperado: status_code 200, body com {ok:true, file:..., total_rows:..., tables:{...}}
```

E confirme o arquivo no Storage:

```sql
SELECT name, created_at, metadata->>'size' AS bytes
FROM storage.objects
WHERE bucket_id = 'backups'
ORDER BY created_at DESC;
```

## Restore

### Listar e baixar um snapshot

Pelo Dashboard: Storage → bucket `backups` → clique no arquivo desejado → **Download**.

Ou via CLI (requer service_role key):

```bash
curl -H "Authorization: Bearer <SERVICE_ROLE_KEY>" \
  https://kkevepwlvvhqweocywvq.supabase.co/storage/v1/object/backups/backup_2026-05-25_0600Z.json \
  -o backup.json
```

### Estrutura do arquivo

```json
{
  "generated_at": "2026-05-25T06:00:12.345Z",
  "database": "rjusinagem",
  "version": "1.0",
  "tables": {
    "ordens_producao": { "row_count": 24, "rows": [ ... ] },
    "financeiro":      { "row_count": 17, "rows": [ ... ] },
    ...
  }
}
```

### Restaurar uma tabela específica

Use o SQL Editor do Supabase para `INSERT ... ON CONFLICT DO UPDATE`. Exemplo para `ordens_producao`:

```sql
-- 1. carregue o JSON em uma temp table
CREATE TEMP TABLE _restore AS
SELECT * FROM jsonb_to_recordset($json$
  [ ...cole o array tables.ordens_producao.rows aqui... ]
$json$) AS x(id uuid, codigo text, ..., updated_at timestamptz);

-- 2. faça upsert
INSERT INTO public.ordens_producao
SELECT * FROM _restore
ON CONFLICT (id) DO UPDATE SET
  codigo = EXCLUDED.codigo,
  ...
  updated_at = EXCLUDED.updated_at;
```

### Restaurar TUDO (cenário de desastre)

1. Crie um novo projeto Supabase (ou faça reset do atual)
2. Aplique o schema base (rode os SQLs de `database/` em ordem cronológica, ou idealmente consolide um `schema.sql` atualizado — **TODO listado abaixo**)
3. Use `jsonb_to_recordset` para popular cada tabela na ordem de FK (users → clientes → ordens_producao → financeiro → parcelas → resto)
4. Verifique contagens contra o `row_count` do backup
5. Atualize a `BACKUP_SECRET` e o `anon_jwt` no Vault para o novo projeto, reagende o cron

## Operação contínua

### Pausar o backup temporariamente

```sql
UPDATE cron.job SET active = false WHERE jobname = 'rjusinagem-backup-semanal';
-- para retomar:
UPDATE cron.job SET active = true WHERE jobname = 'rjusinagem-backup-semanal';
```

### Mudar a frequência

```sql
SELECT cron.alter_job(
  (SELECT jobid FROM cron.job WHERE jobname = 'rjusinagem-backup-semanal'),
  schedule := '0 6 * * *'  -- diário às 06:00 UTC
);
```

### Trocar o BACKUP_SECRET

```sql
-- 1. atualize no Vault
UPDATE vault.secrets
SET secret = '<novo-uuid>'
WHERE name = 'backup_semanal_secret';

-- 2. atualize a env var no Dashboard de Edge Functions com o mesmo valor
```

### Ver últimas execuções

```sql
SELECT id, status_code, content::jsonb AS body, created
FROM net._http_response
ORDER BY id DESC LIMIT 10;
```

## Limitações conhecidas

- **Não inclui** o schema SQL/DDL — só dados. Para reproduzir o banco do zero hoje é preciso rodar os ~20 SQLs em `database/` na ordem certa. Recomendado consolidar num `schema_v1.6.sql` único.
- **Não inclui** imagens do bucket `op-imagens` (decisão de escopo)
- **Não inclui** `auth.users` (decisão de escopo — recriar usuários é manual)
- O JSON é gerado em memória na Edge Function; o limite prático é ~50 MB. Hoje o banco tem 14 MB → folga grande.
