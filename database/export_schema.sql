-- =====================================================
-- EXPORT COMPLETO DA ESTRUTURA DO BANCO
-- Execute no Supabase SQL Editor e exporte como CSV
-- =====================================================

-- 1. TODAS AS TABELAS
SELECT 'TABLES' as tipo, table_name as nome, '' as detalhes
FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- 2. TODAS AS COLUNAS DE CADA TABELA
SELECT 'COLUMNS' as tipo,
       table_name || '.' || column_name as nome,
       data_type || ' | ' || COALESCE(udt_name, '') || ' | nullable:' || is_nullable || ' | default:' || COALESCE(column_default::text, 'null') as detalhes
FROM information_schema.columns
WHERE table_schema = 'public'
ORDER BY table_name, ordinal_position;

-- 3. TODOS OS ENUMS E SEUS VALORES
SELECT 'ENUMS' as tipo,
       t.typname as nome,
       string_agg(e.enumlabel, ', ' ORDER BY e.enumsortorder) as detalhes
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
JOIN pg_namespace n ON t.typnamespace = n.oid
WHERE n.nspname = 'public'
GROUP BY t.typname
ORDER BY t.typname;

-- 4. TODAS AS FUNÇÕES
SELECT 'FUNCTIONS' as tipo,
       p.proname as nome,
       pg_get_function_arguments(p.oid) || ' -> ' || pg_get_function_result(p.oid) as detalhes
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
ORDER BY p.proname;

-- 5. TODOS OS TRIGGERS
SELECT 'TRIGGERS' as tipo,
       trigger_name as nome,
       event_object_table || ' | ' || event_manipulation || ' | ' || action_statement as detalhes
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;

-- 6. TODAS AS VIEWS
SELECT 'VIEWS' as tipo,
       table_name as nome,
       '' as detalhes
FROM information_schema.views
WHERE table_schema = 'public'
ORDER BY table_name;

-- 7. TODOS OS ÍNDICES
SELECT 'INDEXES' as tipo,
       indexname as nome,
       tablename || ' | ' || indexdef as detalhes
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- 8. TODAS AS POLÍTICAS RLS
SELECT 'RLS_POLICIES' as tipo,
       tablename || '.' || policyname as nome,
       cmd || ' | roles:' || roles::text || ' | ' || COALESCE(qual::text, '') as detalhes
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- 9. FOREIGN KEYS
SELECT 'FOREIGN_KEYS' as tipo,
       tc.constraint_name as nome,
       tc.table_name || '(' || kcu.column_name || ') -> ' || ccu.table_name || '(' || ccu.column_name || ')' as detalhes
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
ORDER BY tc.table_name;

-- 10. PRIMARY KEYS
SELECT 'PRIMARY_KEYS' as tipo,
       tc.table_name || '.' || kcu.column_name as nome,
       tc.constraint_name as detalhes
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_schema = 'public'
ORDER BY tc.table_name;
