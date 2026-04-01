-- =====================================================
-- OTIMIZAÇÃO DO BANCO - RJ USINAGEM
-- Execute APÓS fazer backup dos dados
-- =====================================================

-- =====================================================
-- 1. REMOVER ÍNDICES DUPLICADOS
-- =====================================================

-- financeiro_movimentos: remover duplicados (manter os idx_fin_mov_*)
DROP INDEX IF EXISTS idx_fm_financeiro_id;
DROP INDEX IF EXISTS idx_fm_op_id;
DROP INDEX IF EXISTS idx_fm_created_at;

-- =====================================================
-- 2. LIMPAR POLÍTICAS RLS DUPLICADAS - FINANCEIRO
-- =====================================================

-- Remover políticas antigas/duplicadas
DROP POLICY IF EXISTS "Apenas financeiro pode criar dados financeiros" ON public.financeiro;
DROP POLICY IF EXISTS "Apenas financeiro pode editar dados financeiros" ON public.financeiro;
DROP POLICY IF EXISTS "Apenas financeiro pode ver dados financeiros" ON public.financeiro;
DROP POLICY IF EXISTS "Financeiro pode atualizar" ON public.financeiro;
DROP POLICY IF EXISTS "Usuários podem criar financeiro" ON public.financeiro;
DROP POLICY IF EXISTS "Usuários podem ver financeiro" ON public.financeiro;

-- Manter apenas as "Authenticated users can..." que são mais permissivas

-- =====================================================
-- 3. LIMPAR POLÍTICAS RLS DUPLICADAS - ORDENS_PRODUCAO
-- =====================================================

DROP POLICY IF EXISTS "Financeiro e Chefe podem criar OPs" ON public.ordens_producao;
DROP POLICY IF EXISTS "Financeiro e Chefe podem editar OPs não aprova" ON public.ordens_producao;

-- =====================================================
-- 4. LIMPAR POLÍTICAS RLS DUPLICADAS - PECAS_DEFEITUOSAS
-- =====================================================

DROP POLICY IF EXISTS "Operadores podem registrar defeitos" ON public.pecas_defeituosas;
DROP POLICY IF EXISTS "Todos podem ver defeitos" ON public.pecas_defeituosas;

-- =====================================================
-- 5. LIMPAR POLÍTICAS RLS DUPLICADAS - PRODUCAO_DIARIA
-- =====================================================

DROP POLICY IF EXISTS "Operadores podem registrar produção" ON public.producao_diaria;
DROP POLICY IF EXISTS "Todos podem ver produção" ON public.producao_diaria;

-- =====================================================
-- 6. LIMPAR POLÍTICAS RLS DUPLICADAS - USERS
-- =====================================================

DROP POLICY IF EXISTS "Usuários podem ver todos os usuários" ON public.users;

-- =====================================================
-- 7. LIMPAR POLÍTICAS RLS DUPLICADAS - FINANCEIRO_MOVIMENTOS
-- =====================================================

DROP POLICY IF EXISTS "Apenas financeiro pode criar movimentos" ON public.financeiro_movimentos;
DROP POLICY IF EXISTS "Apenas financeiro pode ver movimentos" ON public.financeiro_movimentos;

-- =====================================================
-- 8. OTIMIZAR POLÍTICAS RLS PARA PERFORMANCE
-- (Usar (select auth.uid()) ao invés de auth.uid())
-- =====================================================

-- FINANCEIRO - Recriar com otimização
DROP POLICY IF EXISTS "Authenticated users can view financeiro" ON public.financeiro;
DROP POLICY IF EXISTS "Authenticated users can insert financeiro" ON public.financeiro;
DROP POLICY IF EXISTS "Authenticated users can update financeiro" ON public.financeiro;
DROP POLICY IF EXISTS "Authenticated users can delete financeiro" ON public.financeiro;

CREATE POLICY "Authenticated users can view financeiro"
    ON public.financeiro FOR SELECT
    USING ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Authenticated users can insert financeiro"
    ON public.financeiro FOR INSERT
    WITH CHECK ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Authenticated users can update financeiro"
    ON public.financeiro FOR UPDATE
    USING ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Authenticated users can delete financeiro"
    ON public.financeiro FOR DELETE
    USING ((select auth.uid()) IS NOT NULL);

-- ORDENS_PRODUCAO - Recriar com otimização
DROP POLICY IF EXISTS "Authenticated users can view OPs" ON public.ordens_producao;
DROP POLICY IF EXISTS "Authenticated users can insert OPs" ON public.ordens_producao;
DROP POLICY IF EXISTS "Authenticated users can update OPs" ON public.ordens_producao;
DROP POLICY IF EXISTS "Authenticated users can delete OPs" ON public.ordens_producao;

CREATE POLICY "Authenticated users can view OPs"
    ON public.ordens_producao FOR SELECT
    USING ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Authenticated users can insert OPs"
    ON public.ordens_producao FOR INSERT
    WITH CHECK ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Authenticated users can update OPs"
    ON public.ordens_producao FOR UPDATE
    USING ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Authenticated users can delete OPs"
    ON public.ordens_producao FOR DELETE
    USING ((select auth.uid()) IS NOT NULL);

-- PECAS_DEFEITUOSAS - Recriar com otimização
DROP POLICY IF EXISTS "Authenticated users can view pecas_defeituosa" ON public.pecas_defeituosas;
DROP POLICY IF EXISTS "Authenticated users can insert pecas_defeituo" ON public.pecas_defeituosas;
DROP POLICY IF EXISTS "Authenticated users can update pecas_defeituo" ON public.pecas_defeituosas;
DROP POLICY IF EXISTS "Authenticated users can delete pecas_defeituo" ON public.pecas_defeituosas;

CREATE POLICY "Authenticated users can view pecas"
    ON public.pecas_defeituosas FOR SELECT
    USING ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Authenticated users can insert pecas"
    ON public.pecas_defeituosas FOR INSERT
    WITH CHECK ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Authenticated users can update pecas"
    ON public.pecas_defeituosas FOR UPDATE
    USING ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Authenticated users can delete pecas"
    ON public.pecas_defeituosas FOR DELETE
    USING ((select auth.uid()) IS NOT NULL);

-- PRODUCAO_DIARIA - Recriar com otimização
DROP POLICY IF EXISTS "Authenticated users can view producao_diaria" ON public.producao_diaria;
DROP POLICY IF EXISTS "Authenticated users can insert producao_diaria" ON public.producao_diaria;
DROP POLICY IF EXISTS "Authenticated users can update producao_diaria" ON public.producao_diaria;
DROP POLICY IF EXISTS "Authenticated users can delete producao_diaria" ON public.producao_diaria;

CREATE POLICY "Authenticated users can view producao"
    ON public.producao_diaria FOR SELECT
    USING ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Authenticated users can insert producao"
    ON public.producao_diaria FOR INSERT
    WITH CHECK ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Authenticated users can update producao"
    ON public.producao_diaria FOR UPDATE
    USING ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Authenticated users can delete producao"
    ON public.producao_diaria FOR DELETE
    USING ((select auth.uid()) IS NOT NULL);

-- USERS - Recriar com otimização
DROP POLICY IF EXISTS "Users can view all users" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;

CREATE POLICY "Users can view all users"
    ON public.users FOR SELECT
    USING ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Users can update own profile"
    ON public.users FOR UPDATE
    USING ((select auth.uid()) = id);

-- =====================================================
-- 9. VERIFICAÇÃO FINAL
-- =====================================================

-- Verificar políticas restantes
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- Verificar índices
SELECT tablename, indexname
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;
