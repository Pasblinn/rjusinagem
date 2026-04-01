-- =====================================================
-- FIX: Políticas RLS para tabela FINANCEIRO
-- Execute este SQL no Supabase se estiver com erro ao registrar pagamento
-- =====================================================

-- 1. Verificar políticas existentes (apenas para visualizar)
-- SELECT * FROM pg_policies WHERE tablename = 'financeiro';

-- 2. Remover políticas antigas que podem estar restritivas
DROP POLICY IF EXISTS "Financeiro pode ver todos os financeiros" ON public.financeiro;
DROP POLICY IF EXISTS "Financeiro pode criar financeiro" ON public.financeiro;
DROP POLICY IF EXISTS "Financeiro pode atualizar financeiro" ON public.financeiro;
DROP POLICY IF EXISTS "Apenas financeiro pode ver" ON public.financeiro;
DROP POLICY IF EXISTS "Apenas financeiro pode criar" ON public.financeiro;
DROP POLICY IF EXISTS "Apenas financeiro pode atualizar" ON public.financeiro;
DROP POLICY IF EXISTS "financeiro_select_policy" ON public.financeiro;
DROP POLICY IF EXISTS "financeiro_insert_policy" ON public.financeiro;
DROP POLICY IF EXISTS "financeiro_update_policy" ON public.financeiro;

-- 3. Habilitar RLS (caso não esteja)
ALTER TABLE public.financeiro ENABLE ROW LEVEL SECURITY;

-- 4. Criar políticas que permitem financeiro E chefe
CREATE POLICY "Financeiro e chefe podem ver"
    ON public.financeiro FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid()
            AND role IN ('financeiro', 'chefe')
        )
    );

CREATE POLICY "Financeiro e chefe podem criar"
    ON public.financeiro FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid()
            AND role IN ('financeiro', 'chefe')
        )
    );

CREATE POLICY "Financeiro e chefe podem atualizar"
    ON public.financeiro FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid()
            AND role IN ('financeiro', 'chefe')
        )
    );

CREATE POLICY "Financeiro e chefe podem deletar"
    ON public.financeiro FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid()
            AND role IN ('financeiro', 'chefe')
        )
    );

-- =====================================================
-- ALTERNATIVA: Desabilitar RLS temporariamente para testar
-- (Use apenas para teste, não em produção)
-- =====================================================
-- ALTER TABLE public.financeiro DISABLE ROW LEVEL SECURITY;

-- =====================================================
-- Verificar se funcionou
-- =====================================================
-- SELECT * FROM pg_policies WHERE tablename = 'financeiro';
