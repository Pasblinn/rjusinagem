-- =====================================================
-- FIX: CORRIGIR COLUNAS AMBÍGUAS
-- =====================================================
-- Este script corrige erros de "column reference is ambiguous"
-- Execute no Supabase SQL Editor
-- =====================================================

-- 1. CORRIGIR FUNÇÃO gerar_codigo_op
-- =====================================================
-- Problema: variável "codigo" conflita com coluna "codigo"
-- Solução: renomear variável para "v_codigo"

CREATE OR REPLACE FUNCTION gerar_codigo_op()
RETURNS TEXT AS $$
DECLARE
    v_ano TEXT;
    v_contador INTEGER;
    v_codigo TEXT;
BEGIN
    v_ano := TO_CHAR(NOW(), 'YYYY');

    SELECT COUNT(*) + 1 INTO v_contador
    FROM public.ordens_producao
    WHERE ordens_producao.codigo LIKE 'OP-' || v_ano || '-%';

    v_codigo := 'OP-' || v_ano || '-' || LPAD(v_contador::TEXT, 4, '0');

    RETURN v_codigo;
END;
$$ LANGUAGE plpgsql;

-- 2. CORRIGIR VIEW cliente_estatisticas
-- =====================================================
-- Problema: colunas podem ser ambíguas entre clientes e ordens_producao
-- Solução: qualificar todas as colunas explicitamente

DROP VIEW IF EXISTS public.cliente_estatisticas;

CREATE OR REPLACE VIEW public.cliente_estatisticas AS
SELECT
    c.id AS id,
    c.nome AS nome,
    c.documento AS documento,
    c.email AS email,
    c.telefone AS telefone,
    c.ativo AS ativo,
    COUNT(DISTINCT op.id) AS total_ops,
    COALESCE(SUM(op.preco_servico), 0) AS total_faturado,
    COALESCE(SUM(f.valor_pago), 0) AS total_pago,
    COALESCE(SUM(op.preco_servico), 0) - COALESCE(SUM(f.valor_pago), 0) AS total_pendente,
    MAX(op.created_at) AS ultima_op_data,
    COUNT(DISTINCT CASE WHEN op.status_financeiro = 'atrasado' THEN op.id END) AS ops_atrasadas
FROM public.clientes c
LEFT JOIN public.ordens_producao op ON op.cliente_id = c.id OR op.cliente = c.nome
LEFT JOIN public.financeiro f ON f.op_id = op.id
WHERE c.ativo = TRUE
GROUP BY c.id, c.nome, c.documento, c.email, c.telefone, c.ativo;

-- 3. CORRIGIR VIEW dashboard_stats (se existir ambiguidade)
-- =====================================================

DROP VIEW IF EXISTS public.dashboard_stats;

CREATE OR REPLACE VIEW public.dashboard_stats AS
SELECT
    (SELECT COUNT(*) FROM public.ordens_producao) AS total_ops,
    (SELECT COUNT(*) FROM public.ordens_producao WHERE ordens_producao.status = 'em_producao') AS ops_em_producao,
    (SELECT COUNT(*) FROM public.ordens_producao
     WHERE ordens_producao.status = 'finalizada'
     AND EXTRACT(MONTH FROM ordens_producao.data_termino) = EXTRACT(MONTH FROM NOW())
     AND EXTRACT(YEAR FROM ordens_producao.data_termino) = EXTRACT(YEAR FROM NOW())
    ) AS ops_finalizadas_mes,
    COALESCE((
        SELECT SUM(f.valor_total)
        FROM public.financeiro f
        WHERE f.status_pagamento = 'nao_pago'
    ), 0) AS valor_a_receber;

-- 4. CORRIGIR VIEW extrato_financeiro (se existir)
-- =====================================================

DROP VIEW IF EXISTS public.extrato_financeiro;

CREATE OR REPLACE VIEW public.extrato_financeiro AS
SELECT
    fm.id AS movimento_id,
    fm.financeiro_id,
    fm.op_id,
    fm.tipo,
    fm.valor,
    fm.saldo_anterior,
    fm.saldo_atual,
    fm.forma_pagamento,
    fm.observacao,
    fm.created_by,
    fm.created_at,
    op.codigo AS op_codigo,
    op.cliente AS cliente_nome,
    op.nome_peca,
    f.valor_total AS financeiro_valor_total,
    f.valor_pago AS financeiro_valor_pago,
    u.nome AS usuario_nome
FROM public.financeiro_movimentos fm
LEFT JOIN public.ordens_producao op ON op.id = fm.op_id
LEFT JOIN public.financeiro f ON f.id = fm.financeiro_id
LEFT JOIN public.users u ON u.id = fm.created_by
ORDER BY fm.created_at DESC;

-- 5. VERIFICAR SE financeiro_movimentos EXISTE
-- =====================================================
-- Se não existir, criar (pode ter falhado na migration anterior)

CREATE TABLE IF NOT EXISTS public.financeiro_movimentos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    financeiro_id UUID REFERENCES public.financeiro(id) ON DELETE CASCADE,
    op_id UUID REFERENCES public.ordens_producao(id) ON DELETE CASCADE,
    tipo TEXT NOT NULL CHECK (tipo IN (
        'pagamento', 'pagamento_parcial', 'estorno',
        'ajuste', 'desconto', 'juros', 'multa',
        'custo_extra', 'prejuizo', 'cancelamento'
    )),
    valor DECIMAL(12, 2) NOT NULL,
    saldo_anterior DECIMAL(12, 2) DEFAULT 0,
    saldo_atual DECIMAL(12, 2) DEFAULT 0,
    forma_pagamento TEXT,
    observacao TEXT,
    created_by UUID REFERENCES public.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_fm_financeiro_id ON public.financeiro_movimentos(financeiro_id);
CREATE INDEX IF NOT EXISTS idx_fm_op_id ON public.financeiro_movimentos(op_id);
CREATE INDEX IF NOT EXISTS idx_fm_created_at ON public.financeiro_movimentos(created_at DESC);

-- RLS
ALTER TABLE public.financeiro_movimentos ENABLE ROW LEVEL SECURITY;

-- Policy para ver movimentos (financeiro apenas)
DROP POLICY IF EXISTS "Financeiro pode ver movimentos" ON public.financeiro_movimentos;
CREATE POLICY "Financeiro pode ver movimentos"
    ON public.financeiro_movimentos FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid()
            AND users.role = 'financeiro'
        )
    );

-- Policy para inserir movimentos (financeiro apenas)
DROP POLICY IF EXISTS "Financeiro pode criar movimentos" ON public.financeiro_movimentos;
CREATE POLICY "Financeiro pode criar movimentos"
    ON public.financeiro_movimentos FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid()
            AND users.role = 'financeiro'
        )
    );

-- 6. VERIFICAR SE clientes EXISTE
-- =====================================================

CREATE TABLE IF NOT EXISTS public.clientes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome TEXT NOT NULL,
    nome_fantasia TEXT,
    documento TEXT,
    tipo_documento TEXT CHECK (tipo_documento IN ('cpf', 'cnpj')),
    email TEXT,
    telefone TEXT,
    celular TEXT,
    contato_nome TEXT,
    endereco TEXT,
    numero TEXT,
    complemento TEXT,
    bairro TEXT,
    cidade TEXT,
    estado TEXT,
    cep TEXT,
    observacoes TEXT,
    ativo BOOLEAN DEFAULT TRUE,
    created_by UUID REFERENCES public.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID REFERENCES public.users(id)
);

-- RLS para clientes
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Todos podem ver clientes" ON public.clientes;
CREATE POLICY "Todos podem ver clientes"
    ON public.clientes FOR SELECT
    USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Financeiro e Chefe podem criar clientes" ON public.clientes;
CREATE POLICY "Financeiro e Chefe podem criar clientes"
    ON public.clientes FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid()
            AND users.role IN ('financeiro', 'chefe')
        )
    );

DROP POLICY IF EXISTS "Financeiro e Chefe podem editar clientes" ON public.clientes;
CREATE POLICY "Financeiro e Chefe podem editar clientes"
    ON public.clientes FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid()
            AND users.role IN ('financeiro', 'chefe')
        )
    );

-- 7. ADICIONAR COLUNAS V3 SE NÃO EXISTIREM
-- =====================================================

-- Status separados na ordens_producao
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'ordens_producao' AND column_name = 'status_producao') THEN
        ALTER TABLE public.ordens_producao ADD COLUMN status_producao TEXT DEFAULT 'criada';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'ordens_producao' AND column_name = 'status_financeiro') THEN
        ALTER TABLE public.ordens_producao ADD COLUMN status_financeiro TEXT DEFAULT 'pendente';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'ordens_producao' AND column_name = 'cliente_id') THEN
        ALTER TABLE public.ordens_producao ADD COLUMN cliente_id UUID REFERENCES public.clientes(id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'ordens_producao' AND column_name = 'nota_fiscal_emitida') THEN
        ALTER TABLE public.ordens_producao ADD COLUMN nota_fiscal_emitida BOOLEAN DEFAULT FALSE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'ordens_producao' AND column_name = 'nota_fiscal_numero') THEN
        ALTER TABLE public.ordens_producao ADD COLUMN nota_fiscal_numero TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'ordens_producao' AND column_name = 'nota_fiscal_data') THEN
        ALTER TABLE public.ordens_producao ADD COLUMN nota_fiscal_data DATE;
    END IF;
END $$;

-- Campos extras no financeiro
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'financeiro' AND column_name = 'valor_pago') THEN
        ALTER TABLE public.financeiro ADD COLUMN valor_pago DECIMAL(10, 2) DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'financeiro' AND column_name = 'data_vencimento') THEN
        ALTER TABLE public.financeiro ADD COLUMN data_vencimento DATE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'financeiro' AND column_name = 'data_pagamento') THEN
        ALTER TABLE public.financeiro ADD COLUMN data_pagamento DATE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'financeiro' AND column_name = 'numero_parcelas') THEN
        ALTER TABLE public.financeiro ADD COLUMN numero_parcelas INTEGER DEFAULT 1;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'financeiro' AND column_name = 'parcela_atual') THEN
        ALTER TABLE public.financeiro ADD COLUMN parcela_atual INTEGER DEFAULT 1;
    END IF;
END $$;

-- =====================================================
-- INSTRUÇÕES:
-- =====================================================
-- 1. Execute este script no Supabase SQL Editor
-- 2. Teste a criação de OP novamente
-- 3. Se ainda houver erros, me avise com a mensagem completa
-- =====================================================

SELECT 'Script executado com sucesso!' AS resultado;
