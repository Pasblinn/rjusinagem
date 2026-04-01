-- =====================================================
-- MIGRATION V3 - ETAPA 2: HISTÓRICO FINANCEIRO (LEDGER)
-- =====================================================
-- Problema: Não há histórico de movimentações financeiras
-- Solução: Criar tabela de movimentos para rastrear tudo
-- =====================================================

-- 1. CRIAR ENUM PARA TIPO DE MOVIMENTO
-- =====================================================

DO $$ BEGIN
    CREATE TYPE movimento_tipo AS ENUM (
        'pagamento',     -- Pagamento recebido
        'pagamento_parcial', -- Pagamento parcial
        'estorno',       -- Devolução/estorno
        'ajuste',        -- Ajuste manual de valor
        'desconto',      -- Desconto concedido
        'juros',         -- Juros por atraso
        'multa',         -- Multa aplicada
        'custo_extra',   -- Custo extra adicionado
        'prejuizo',      -- Prejuízo por defeito
        'cancelamento'   -- Cancelamento da cobrança
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. CRIAR TABELA DE MOVIMENTOS FINANCEIROS
-- =====================================================

CREATE TABLE IF NOT EXISTS public.financeiro_movimentos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Referências
    financeiro_id UUID NOT NULL REFERENCES public.financeiro(id) ON DELETE CASCADE,
    op_id UUID NOT NULL REFERENCES public.ordens_producao(id) ON DELETE CASCADE,

    -- Dados do movimento
    tipo movimento_tipo NOT NULL,
    valor NUMERIC(10, 2) NOT NULL,

    -- Saldos (snapshot no momento do movimento)
    saldo_anterior NUMERIC(10, 2) NOT NULL DEFAULT 0,
    saldo_atual NUMERIC(10, 2) NOT NULL DEFAULT 0,

    -- Detalhes
    forma_pagamento TEXT,
    data_movimento DATE NOT NULL DEFAULT CURRENT_DATE,
    data_competencia DATE, -- Mês/ano de referência
    observacao TEXT,

    -- Auditoria
    created_by UUID REFERENCES public.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. ÍNDICES PARA PERFORMANCE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_fin_mov_financeiro_id
ON public.financeiro_movimentos(financeiro_id);

CREATE INDEX IF NOT EXISTS idx_fin_mov_op_id
ON public.financeiro_movimentos(op_id);

CREATE INDEX IF NOT EXISTS idx_fin_mov_tipo
ON public.financeiro_movimentos(tipo);

CREATE INDEX IF NOT EXISTS idx_fin_mov_data
ON public.financeiro_movimentos(data_movimento);

CREATE INDEX IF NOT EXISTS idx_fin_mov_created_by
ON public.financeiro_movimentos(created_by);

-- 4. RLS (Row Level Security)
-- =====================================================

ALTER TABLE public.financeiro_movimentos ENABLE ROW LEVEL SECURITY;

-- Apenas financeiro pode ver movimentos
CREATE POLICY "Apenas financeiro pode ver movimentos"
    ON public.financeiro_movimentos FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid()
            AND role = 'financeiro'
        )
    );

-- Apenas financeiro pode criar movimentos
CREATE POLICY "Apenas financeiro pode criar movimentos"
    ON public.financeiro_movimentos FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid()
            AND role = 'financeiro'
        )
    );

-- Ninguém pode editar ou deletar movimentos (imutável)
-- Não criamos policies de UPDATE ou DELETE

-- 5. FUNÇÃO PARA REGISTRAR MOVIMENTO
-- =====================================================

CREATE OR REPLACE FUNCTION registrar_movimento_financeiro(
    p_financeiro_id UUID,
    p_tipo movimento_tipo,
    p_valor NUMERIC,
    p_forma_pagamento TEXT DEFAULT NULL,
    p_observacao TEXT DEFAULT NULL,
    p_user_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_op_id UUID;
    v_saldo_anterior NUMERIC;
    v_saldo_atual NUMERIC;
    v_movimento_id UUID;
BEGIN
    -- Buscar dados atuais do financeiro
    SELECT op_id, COALESCE(valor_pago, 0)
    INTO v_op_id, v_saldo_anterior
    FROM public.financeiro
    WHERE id = p_financeiro_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Financeiro não encontrado: %', p_financeiro_id;
    END IF;

    -- Calcular novo saldo
    IF p_tipo IN ('pagamento', 'pagamento_parcial', 'juros', 'multa') THEN
        v_saldo_atual := v_saldo_anterior + p_valor;
    ELSIF p_tipo IN ('estorno', 'desconto', 'cancelamento') THEN
        v_saldo_atual := v_saldo_anterior - p_valor;
    ELSE
        v_saldo_atual := v_saldo_anterior; -- ajuste, custo_extra, prejuizo não afetam saldo pago
    END IF;

    -- Inserir movimento
    INSERT INTO public.financeiro_movimentos (
        financeiro_id,
        op_id,
        tipo,
        valor,
        saldo_anterior,
        saldo_atual,
        forma_pagamento,
        observacao,
        created_by
    ) VALUES (
        p_financeiro_id,
        v_op_id,
        p_tipo,
        p_valor,
        v_saldo_anterior,
        v_saldo_atual,
        p_forma_pagamento,
        p_observacao,
        p_user_id
    )
    RETURNING id INTO v_movimento_id;

    -- Atualizar saldo no financeiro
    UPDATE public.financeiro
    SET valor_pago = v_saldo_atual
    WHERE id = p_financeiro_id;

    RETURN v_movimento_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. VIEW PARA EXTRATO FINANCEIRO
-- =====================================================

CREATE OR REPLACE VIEW public.extrato_financeiro AS
SELECT
    fm.id,
    fm.financeiro_id,
    fm.op_id,
    op.codigo as op_codigo,
    op.cliente,
    op.nome_peca,
    fm.tipo,
    fm.valor,
    fm.saldo_anterior,
    fm.saldo_atual,
    fm.forma_pagamento,
    fm.data_movimento,
    fm.observacao,
    u.nome as registrado_por,
    fm.created_at
FROM public.financeiro_movimentos fm
JOIN public.ordens_producao op ON op.id = fm.op_id
LEFT JOIN public.users u ON u.id = fm.created_by
ORDER BY fm.created_at DESC;

-- 7. VIEW PARA RESUMO DE MOVIMENTOS POR MÊS
-- =====================================================

CREATE OR REPLACE VIEW public.resumo_movimentos_mensal AS
SELECT
    DATE_TRUNC('month', data_movimento) as mes,
    tipo,
    COUNT(*) as quantidade,
    SUM(valor) as total
FROM public.financeiro_movimentos
GROUP BY DATE_TRUNC('month', data_movimento), tipo
ORDER BY mes DESC, tipo;

-- 8. COMENTÁRIOS PARA DOCUMENTAÇÃO
-- =====================================================

COMMENT ON TABLE public.financeiro_movimentos IS
'Registro imutável de todas as movimentações financeiras (ledger)';

COMMENT ON COLUMN public.financeiro_movimentos.tipo IS
'Tipo do movimento: pagamento, estorno, ajuste, desconto, juros, multa, custo_extra, prejuizo, cancelamento';

COMMENT ON COLUMN public.financeiro_movimentos.saldo_anterior IS
'Saldo do valor_pago no momento anterior ao movimento';

COMMENT ON COLUMN public.financeiro_movimentos.saldo_atual IS
'Saldo do valor_pago após o movimento';

-- =====================================================
-- INSTRUÇÕES:
-- =====================================================
-- 1. Execute este script no Supabase SQL Editor
-- 2. A tabela financeiro_movimentos é IMUTÁVEL (append-only)
-- 3. Use a função registrar_movimento_financeiro() para novos registros
-- 4. Use a view extrato_financeiro para consultas
-- =====================================================
