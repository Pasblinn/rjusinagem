-- =====================================================
-- MIGRATION V3 - ETAPA 1: SEPARAÇÃO DE STATUS
-- =====================================================
-- Problema: op_status mistura conceitos operacionais e financeiros
-- Solução: Separar em status_producao e status_financeiro
-- =====================================================

-- 1. CRIAR NOVOS ENUMS
-- =====================================================

-- Status de Produção (ciclo operacional)
DO $$ BEGIN
    CREATE TYPE status_producao_enum AS ENUM (
        'criada',        -- OP criada, aguardando início
        'em_producao',   -- Em produção ativa
        'pausada',       -- Produção pausada (novo!)
        'finalizada',    -- Produção concluída
        'cancelada'      -- OP cancelada (novo!)
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Status Financeiro (ciclo de pagamento)
DO $$ BEGIN
    CREATE TYPE status_financeiro_enum AS ENUM (
        'pendente',      -- Aguardando pagamento
        'parcial',       -- Pagamento parcial recebido
        'pago',          -- Totalmente pago
        'atrasado',      -- Vencido e não pago
        'cancelado'      -- Cancelado (sem cobrança)
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. ADICIONAR NOVOS CAMPOS NA TABELA ordens_producao
-- =====================================================

-- Adicionar campo status_producao
ALTER TABLE public.ordens_producao
ADD COLUMN IF NOT EXISTS status_producao status_producao_enum;

-- Adicionar campo status_financeiro
ALTER TABLE public.ordens_producao
ADD COLUMN IF NOT EXISTS status_financeiro status_financeiro_enum;

-- Nota fiscal como atributos (já existem, mas garantindo)
ALTER TABLE public.ordens_producao
ADD COLUMN IF NOT EXISTS nota_fiscal_emitida BOOLEAN DEFAULT FALSE;

ALTER TABLE public.ordens_producao
ADD COLUMN IF NOT EXISTS nota_fiscal_numero TEXT;

ALTER TABLE public.ordens_producao
ADD COLUMN IF NOT EXISTS nota_fiscal_data DATE;

-- 3. MIGRAR DADOS EXISTENTES
-- =====================================================

-- Migrar status antigo para novos campos
UPDATE public.ordens_producao
SET
    status_producao = CASE
        WHEN status IN ('criada') THEN 'criada'::status_producao_enum
        WHEN status IN ('em_producao') THEN 'em_producao'::status_producao_enum
        WHEN status IN ('finalizada', 'faturada', 'nota_emitida', 'paga') THEN 'finalizada'::status_producao_enum
        ELSE 'criada'::status_producao_enum
    END,
    status_financeiro = CASE
        WHEN status IN ('paga') THEN 'pago'::status_financeiro_enum
        WHEN status IN ('nota_emitida', 'faturada') THEN 'pendente'::status_financeiro_enum
        ELSE 'pendente'::status_financeiro_enum
    END
WHERE status_producao IS NULL OR status_financeiro IS NULL;

-- Sincronizar com tabela financeiro (se houver dados mais precisos)
UPDATE public.ordens_producao op
SET status_financeiro = CASE
    WHEN f.status_pagamento = 'pago' THEN 'pago'::status_financeiro_enum
    WHEN f.status_pagamento = 'parcial' THEN 'parcial'::status_financeiro_enum
    WHEN f.status_pagamento = 'atrasado' THEN 'atrasado'::status_financeiro_enum
    WHEN f.status_pagamento IN ('pendente', 'nao_pago') THEN 'pendente'::status_financeiro_enum
    ELSE op.status_financeiro
END
FROM public.financeiro f
WHERE f.op_id = op.id;

-- 4. DEFINIR VALORES PADRÃO
-- =====================================================

ALTER TABLE public.ordens_producao
ALTER COLUMN status_producao SET DEFAULT 'criada'::status_producao_enum;

ALTER TABLE public.ordens_producao
ALTER COLUMN status_financeiro SET DEFAULT 'pendente'::status_financeiro_enum;

-- 5. CRIAR ÍNDICES PARA PERFORMANCE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_op_status_producao
ON public.ordens_producao(status_producao);

CREATE INDEX IF NOT EXISTS idx_op_status_financeiro
ON public.ordens_producao(status_financeiro);

-- 6. VIEW PARA COMPATIBILIDADE (opcional)
-- =====================================================
-- Cria uma view que simula o status antigo para código legado

CREATE OR REPLACE VIEW public.ordens_producao_compat AS
SELECT
    *,
    -- Gera status legado baseado nos novos campos
    CASE
        WHEN status_financeiro = 'pago' THEN 'paga'::op_status
        WHEN nota_fiscal_emitida = true THEN 'nota_emitida'::op_status
        WHEN status_producao = 'finalizada' THEN 'finalizada'::op_status
        WHEN status_producao = 'em_producao' THEN 'em_producao'::op_status
        ELSE 'criada'::op_status
    END as status_legado
FROM public.ordens_producao;

-- 7. FUNÇÃO PARA CALCULAR STATUS FINANCEIRO AUTOMATICAMENTE
-- =====================================================

CREATE OR REPLACE FUNCTION calcular_status_financeiro(p_op_id UUID)
RETURNS status_financeiro_enum AS $$
DECLARE
    v_valor_total NUMERIC;
    v_valor_pago NUMERIC;
    v_data_vencimento DATE;
    v_status status_financeiro_enum;
BEGIN
    -- Buscar dados do financeiro
    SELECT
        COALESCE(f.valor_total, op.preco_servico),
        COALESCE(f.valor_pago, 0),
        f.data_vencimento
    INTO v_valor_total, v_valor_pago, v_data_vencimento
    FROM public.ordens_producao op
    LEFT JOIN public.financeiro f ON f.op_id = op.id
    WHERE op.id = p_op_id;

    -- Calcular status
    IF v_valor_pago >= v_valor_total THEN
        v_status := 'pago';
    ELSIF v_valor_pago > 0 THEN
        v_status := 'parcial';
    ELSIF v_data_vencimento IS NOT NULL AND v_data_vencimento < CURRENT_DATE THEN
        v_status := 'atrasado';
    ELSE
        v_status := 'pendente';
    END IF;

    RETURN v_status;
END;
$$ LANGUAGE plpgsql;

-- 8. TRIGGER PARA ATUALIZAR STATUS FINANCEIRO AUTOMATICAMENTE
-- =====================================================

CREATE OR REPLACE FUNCTION atualizar_status_financeiro_op()
RETURNS TRIGGER AS $$
BEGIN
    -- Atualiza o status_financeiro na OP quando financeiro muda
    UPDATE public.ordens_producao
    SET status_financeiro = calcular_status_financeiro(NEW.op_id)
    WHERE id = NEW.op_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_atualizar_status_financeiro ON public.financeiro;

CREATE TRIGGER trigger_atualizar_status_financeiro
    AFTER INSERT OR UPDATE ON public.financeiro
    FOR EACH ROW
    EXECUTE FUNCTION atualizar_status_financeiro_op();

-- 9. COMENTÁRIOS PARA DOCUMENTAÇÃO
-- =====================================================

COMMENT ON COLUMN public.ordens_producao.status_producao IS
'Status do ciclo de produção: criada, em_producao, pausada, finalizada, cancelada';

COMMENT ON COLUMN public.ordens_producao.status_financeiro IS
'Status do ciclo financeiro: pendente, parcial, pago, atrasado, cancelado';

COMMENT ON COLUMN public.ordens_producao.status IS
'[DEPRECADO] Usar status_producao e status_financeiro. Mantido para compatibilidade.';

-- =====================================================
-- INSTRUÇÕES PÓS-MIGRAÇÃO:
-- =====================================================
-- 1. Execute este script no Supabase SQL Editor
-- 2. O campo "status" antigo foi mantido para compatibilidade
-- 3. O código deve ser atualizado para usar os novos campos
-- 4. Após atualizar todo o código, o campo "status" pode ser removido
-- =====================================================
