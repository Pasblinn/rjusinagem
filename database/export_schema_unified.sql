-- =====================================================
-- EXPORT UNIFICADO DA ESTRUTURA DO BANCO
-- Execute no Supabase SQL Editor e exporte como CSV
-- =====================================================

-- 1. TABELAS
SELECT 'TABLES' as tipo, table_name as nome, '' as detalhes
FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'

UNION ALL

-- 2. COLUNAS
SELECT 'COLUMNS' as tipo,
       table_name || '.' || column_name as nome,
       data_type || ' | ' || COALESCE(udt_name, '') || ' | nullable:' || is_nullable || ' | default:' || COALESCE(LEFT(column_default::text, 100), 'null') as detalhes
FROM information_schema.columns
WHERE table_schema = 'public'

UNION ALL

-- 3. ENUMS
SELECT 'ENUMS' as tipo,
       t.typname as nome,
       string_agg(e.enumlabel, ', ' ORDER BY e.enumsortorder) as detalhes
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
JOIN pg_namespace n ON t.typnamespace = n.oid
WHERE n.nspname = 'public'
GROUP BY t.typname

UNION ALL

-- 4. FUNÇÕES
SELECT 'FUNCTIONS' as tipo,
       p.proname as nome,
       LEFT(pg_get_function_arguments(p.oid), 100) || ' -> ' || pg_get_function_result(p.oid) as detalhes
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'

UNION ALL

-- 5. TRIGGERS
SELECT 'TRIGGERS' as tipo,
       trigger_name as nome,
       event_object_table || ' | ' || event_manipulation as detalhes
FROM information_schema.triggers
WHERE trigger_schema = 'public'

UNION ALL

-- 6. VIEWS
SELECT 'VIEWS' as tipo, table_name as nome, '' as detalhes
FROM information_schema.views
WHERE table_schema = 'public'

UNION ALL

-- 7. ÍNDICES
SELECT 'INDEXES' as tipo,
       indexname as nome,
       tablename as detalhes
FROM pg_indexes
WHERE schemaname = 'public'

UNION ALL

-- 8. POLÍTICAS RLS
SELECT 'RLS' as tipo,
       tablename || '.' || policyname as nome,
       cmd || ' | ' || roles::text as detalhes
FROM pg_policies
WHERE schemaname = 'public'

UNION ALL

-- 9. FOREIGN KEYS
SELECT 'FK' as tipo,
       tc.constraint_name as nome,
       tc.table_name || '(' || kcu.column_name || ') -> ' || ccu.table_name || '(' || ccu.column_name || ')' as detalhes
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'

ORDER BY tipo, nome;
