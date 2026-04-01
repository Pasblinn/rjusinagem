-- =====================================================
-- BACKUP DOS DADOS - RJ USINAGEM
-- Execute cada SELECT e exporte como CSV
-- =====================================================

-- 1. USERS
SELECT * FROM public.users;

-- 2. CLIENTES
SELECT * FROM public.clientes;

-- 3. ORDENS DE PRODUÇÃO
SELECT * FROM public.ordens_producao;

-- 4. FINANCEIRO
SELECT * FROM public.financeiro;

-- 5. PRODUÇÃO DIÁRIA
SELECT * FROM public.producao_diaria;

-- 6. PEÇAS DEFEITUOSAS
SELECT * FROM public.pecas_defeituosas;

-- 7. ORÇAMENTOS
SELECT * FROM public.orcamentos;

-- 8. HISTÓRICO FINANCEIRO
SELECT * FROM public.historico_financeiro;

-- 9. FINANCEIRO MOVIMENTOS
SELECT * FROM public.financeiro_movimentos;

-- 10. FUNCIONÁRIOS PONTO
SELECT * FROM public.funcionarios_ponto;

-- 11. REGISTRO PONTO
SELECT * FROM public.registro_ponto;

-- 12. AUDIT LOG
SELECT * FROM public.audit_log;
