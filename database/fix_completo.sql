-- =====================================================
-- FIX COMPLETO - SUPABASE RJ USINAGEM
-- Execute este SQL no Supabase SQL Editor
-- =====================================================

-- =====================================================
-- 1. CORRIGIR VIEWS COM SECURITY DEFINER
-- =====================================================

-- Dropar view extrato_financeiro se existir com SECURITY DEFINER
DROP VIEW IF EXISTS public.extrato_financeiro;

-- Recriar sem SECURITY DEFINER (ou simplesmente não criar)
-- A view extrato_financeiro não é necessária se usarmos queries diretas

-- Dropar outras views problemáticas
DROP VIEW IF EXISTS public.resumo_ponto_funcionario;
DROP VIEW IF EXISTS public.ponto_detalhado;

-- =====================================================
-- 2. CORRIGIR POLÍTICAS RLS - TABELA ordens_producao
-- =====================================================

-- Remover políticas antigas
DROP POLICY IF EXISTS "Users can view all ordens" ON public.ordens_producao;
DROP POLICY IF EXISTS "Users can insert ordens" ON public.ordens_producao;
DROP POLICY IF EXISTS "Users can update ordens" ON public.ordens_producao;
DROP POLICY IF EXISTS "Users can delete ordens" ON public.ordens_producao;
DROP POLICY IF EXISTS "Todos podem ver OPs" ON public.ordens_producao;
DROP POLICY IF EXISTS "Chefe pode criar OPs" ON public.ordens_producao;
DROP POLICY IF EXISTS "Chefe pode atualizar OPs" ON public.ordens_producao;
DROP POLICY IF EXISTS "Chefe pode deletar OPs" ON public.ordens_producao;

-- Habilitar RLS
ALTER TABLE public.ordens_producao ENABLE ROW LEVEL SECURITY;

-- Criar políticas permissivas para usuários autenticados
CREATE POLICY "Authenticated users can view OPs"
    ON public.ordens_producao FOR SELECT
    USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert OPs"
    ON public.ordens_producao FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update OPs"
    ON public.ordens_producao FOR UPDATE
    USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete OPs"
    ON public.ordens_producao FOR DELETE
    USING (auth.uid() IS NOT NULL);

-- =====================================================
-- 3. CORRIGIR POLÍTICAS RLS - TABELA financeiro
-- =====================================================

DROP POLICY IF EXISTS "Financeiro pode ver todos os financeiros" ON public.financeiro;
DROP POLICY IF EXISTS "Financeiro pode criar financeiro" ON public.financeiro;
DROP POLICY IF EXISTS "Financeiro pode atualizar financeiro" ON public.financeiro;
DROP POLICY IF EXISTS "Financeiro pode deletar financeiro" ON public.financeiro;
DROP POLICY IF EXISTS "Apenas financeiro pode ver" ON public.financeiro;
DROP POLICY IF EXISTS "Apenas financeiro pode criar" ON public.financeiro;
DROP POLICY IF EXISTS "Apenas financeiro pode atualizar" ON public.financeiro;
DROP POLICY IF EXISTS "Financeiro e chefe podem ver" ON public.financeiro;
DROP POLICY IF EXISTS "Financeiro e chefe podem criar" ON public.financeiro;
DROP POLICY IF EXISTS "Financeiro e chefe podem atualizar" ON public.financeiro;
DROP POLICY IF EXISTS "Financeiro e chefe podem deletar" ON public.financeiro;

ALTER TABLE public.financeiro ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view financeiro"
    ON public.financeiro FOR SELECT
    USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert financeiro"
    ON public.financeiro FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update financeiro"
    ON public.financeiro FOR UPDATE
    USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete financeiro"
    ON public.financeiro FOR DELETE
    USING (auth.uid() IS NOT NULL);

-- =====================================================
-- 4. CORRIGIR POLÍTICAS RLS - TABELA producao_diaria
-- =====================================================

DROP POLICY IF EXISTS "Users can view producao_diaria" ON public.producao_diaria;
DROP POLICY IF EXISTS "Users can insert producao_diaria" ON public.producao_diaria;
DROP POLICY IF EXISTS "Users can update producao_diaria" ON public.producao_diaria;
DROP POLICY IF EXISTS "Users can delete producao_diaria" ON public.producao_diaria;

ALTER TABLE public.producao_diaria ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view producao_diaria"
    ON public.producao_diaria FOR SELECT
    USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert producao_diaria"
    ON public.producao_diaria FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update producao_diaria"
    ON public.producao_diaria FOR UPDATE
    USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete producao_diaria"
    ON public.producao_diaria FOR DELETE
    USING (auth.uid() IS NOT NULL);

-- =====================================================
-- 5. CORRIGIR POLÍTICAS RLS - TABELA pecas_defeituosas
-- =====================================================

DROP POLICY IF EXISTS "Users can view pecas_defeituosas" ON public.pecas_defeituosas;
DROP POLICY IF EXISTS "Users can insert pecas_defeituosas" ON public.pecas_defeituosas;
DROP POLICY IF EXISTS "Users can update pecas_defeituosas" ON public.pecas_defeituosas;
DROP POLICY IF EXISTS "Users can delete pecas_defeituosas" ON public.pecas_defeituosas;

ALTER TABLE public.pecas_defeituosas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view pecas_defeituosas"
    ON public.pecas_defeituosas FOR SELECT
    USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert pecas_defeituosas"
    ON public.pecas_defeituosas FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update pecas_defeituosas"
    ON public.pecas_defeituosas FOR UPDATE
    USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete pecas_defeituosas"
    ON public.pecas_defeituosas FOR DELETE
    USING (auth.uid() IS NOT NULL);

-- =====================================================
-- 6. CORRIGIR POLÍTICAS RLS - TABELA users
-- =====================================================

DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all users"
    ON public.users FOR SELECT
    USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update own profile"
    ON public.users FOR UPDATE
    USING (auth.uid() = id);

-- =====================================================
-- 7. GARANTIR QUE COLUNAS V3 EXISTEM
-- =====================================================

-- Adicionar colunas V3 se não existirem
DO $$
BEGIN
    -- status_producao
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'ordens_producao' AND column_name = 'status_producao') THEN
        ALTER TABLE public.ordens_producao ADD COLUMN status_producao TEXT;
    END IF;

    -- status_financeiro
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'ordens_producao' AND column_name = 'status_financeiro') THEN
        ALTER TABLE public.ordens_producao ADD COLUMN status_financeiro TEXT;
    END IF;

    -- cliente_id
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'ordens_producao' AND column_name = 'cliente_id') THEN
        ALTER TABLE public.ordens_producao ADD COLUMN cliente_id UUID;
    END IF;
END $$;

-- =====================================================
-- 8. SINCRONIZAR status_producao COM status LEGADO
-- =====================================================

-- Atualizar status_producao baseado no status legado onde está NULL
-- Cast para o enum status_producao_enum
UPDATE public.ordens_producao
SET status_producao = (
    CASE
        WHEN status::text = 'criada' THEN 'criada'
        WHEN status::text = 'em_andamento' THEN 'em_producao'
        WHEN status::text = 'em_producao' THEN 'em_producao'
        WHEN status::text = 'pausada' THEN 'pausada'
        WHEN status::text = 'finalizada' THEN 'finalizada'
        WHEN status::text = 'cancelada' THEN 'cancelada'
        WHEN status::text = 'faturada' THEN 'finalizada'
        ELSE 'criada'
    END
)::status_producao_enum
WHERE status_producao IS NULL AND status IS NOT NULL;

-- =====================================================
-- 9. DROPAR TABELA financeiro_movimentos SE CAUSAR PROBLEMAS
-- =====================================================

-- Se a tabela financeiro_movimentos está causando problemas, você pode dropá-la
-- (Descomente as linhas abaixo se necessário)
-- DROP TABLE IF EXISTS public.financeiro_movimentos;

-- =====================================================
-- 10. VERIFICAÇÃO FINAL
-- =====================================================

-- Mostrar políticas atuais (para verificação)
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
