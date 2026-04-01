-- RJ Usinagem - Migration v2
-- Melhorias no sistema financeiro

-- =====================================================
-- 1. MELHORAR ORÇAMENTOS
-- =====================================================

-- Adicionar novos status de orçamento
ALTER TYPE orcamento_status ADD VALUE IF NOT EXISTS 'rascunho';
ALTER TYPE orcamento_status ADD VALUE IF NOT EXISTS 'enviado';
ALTER TYPE orcamento_status ADD VALUE IF NOT EXISTS 'aprovado';
ALTER TYPE orcamento_status ADD VALUE IF NOT EXISTS 'reprovado';

-- Adicionar campos ao orçamento
ALTER TABLE public.orcamentos
ADD COLUMN IF NOT EXISTS data_envio TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS data_resposta TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS versao INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES public.users(id);

-- =====================================================
-- 2. MELHORAR CONTROLE DE PAGAMENTOS
-- =====================================================

-- Novo tipo de status de pagamento mais detalhado
DO $$ BEGIN
    CREATE TYPE payment_status_v2 AS ENUM ('pendente', 'pago', 'atrasado', 'parcial');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Atualizar tabela financeiro com novos campos
ALTER TABLE public.financeiro
ADD COLUMN IF NOT EXISTS valor_pago NUMERIC(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS data_vencimento DATE,
ADD COLUMN IF NOT EXISTS data_pagamento DATE,
ADD COLUMN IF NOT EXISTS numero_parcelas INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS parcela_atual INTEGER DEFAULT 1;

-- =====================================================
-- 3. ADICIONAR CAMPOS DE NOTA FISCAL NA OP
-- =====================================================

ALTER TABLE public.ordens_producao
ADD COLUMN IF NOT EXISTS nota_fiscal_numero TEXT,
ADD COLUMN IF NOT EXISTS nota_fiscal_data DATE,
ADD COLUMN IF NOT EXISTS nota_fiscal_emitida BOOLEAN DEFAULT FALSE;

-- =====================================================
-- 4. HISTÓRICO DE ALTERAÇÕES FINANCEIRAS
-- =====================================================

CREATE TABLE IF NOT EXISTS public.historico_financeiro (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  op_id UUID NOT NULL REFERENCES public.ordens_producao(id) ON DELETE CASCADE,
  usuario_id UUID NOT NULL REFERENCES public.users(id),
  acao TEXT NOT NULL,
  valor_anterior NUMERIC(10, 2),
  valor_novo NUMERIC(10, 2),
  status_anterior TEXT,
  status_novo TEXT,
  observacao TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índice para histórico
CREATE INDEX IF NOT EXISTS idx_historico_op ON public.historico_financeiro(op_id);
CREATE INDEX IF NOT EXISTS idx_historico_data ON public.historico_financeiro(created_at);

-- RLS para histórico
ALTER TABLE public.historico_financeiro ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Apenas financeiro pode ver histórico"
  ON public.historico_financeiro FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND role = 'financeiro'
    )
  );

CREATE POLICY "Apenas financeiro pode criar histórico"
  ON public.historico_financeiro FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND role = 'financeiro'
    )
  );

-- =====================================================
-- 5. VIEW PARA DASHBOARD FINANCEIRO
-- =====================================================

CREATE OR REPLACE VIEW dashboard_financeiro AS
SELECT
  -- Faturamento do mês
  COALESCE((
    SELECT SUM(f.valor_total)
    FROM public.financeiro f
    JOIN public.ordens_producao op ON f.op_id = op.id
    WHERE EXTRACT(MONTH FROM op.created_at) = EXTRACT(MONTH FROM NOW())
    AND EXTRACT(YEAR FROM op.created_at) = EXTRACT(YEAR FROM NOW())
  ), 0) as faturado_mes,

  -- Recebido no mês
  COALESCE((
    SELECT SUM(f.valor_pago)
    FROM public.financeiro f
    WHERE EXTRACT(MONTH FROM f.data_pagamento) = EXTRACT(MONTH FROM NOW())
    AND EXTRACT(YEAR FROM f.data_pagamento) = EXTRACT(YEAR FROM NOW())
  ), 0) as recebido_mes,

  -- Total em aberto
  COALESCE((
    SELECT SUM(f.valor_total - COALESCE(f.valor_pago, 0))
    FROM public.financeiro f
    WHERE f.status_pagamento != 'pago'
  ), 0) as total_em_aberto,

  -- OPs aguardando pagamento
  (
    SELECT COUNT(*)
    FROM public.financeiro f
    WHERE f.status_pagamento = 'nao_pago' OR f.status_pagamento = 'pendente'
  ) as ops_aguardando_pagamento,

  -- OPs atrasadas
  (
    SELECT COUNT(*)
    FROM public.financeiro f
    WHERE f.data_vencimento < CURRENT_DATE
    AND f.status_pagamento != 'pago'
  ) as ops_atrasadas,

  -- OPs sem nota emitida (finalizadas)
  (
    SELECT COUNT(*)
    FROM public.ordens_producao op
    WHERE op.status IN ('finalizada', 'faturada')
    AND (op.nota_fiscal_emitida = FALSE OR op.nota_fiscal_emitida IS NULL)
  ) as ops_sem_nota;

-- =====================================================
-- 6. VIEW PARA CONTAS A RECEBER
-- =====================================================

CREATE OR REPLACE VIEW contas_a_receber AS
SELECT
  op.id,
  op.codigo,
  op.cliente,
  op.nome_peca,
  op.status as status_op,
  f.valor_total,
  COALESCE(f.valor_pago, 0) as valor_pago,
  (f.valor_total - COALESCE(f.valor_pago, 0)) as valor_pendente,
  f.data_vencimento,
  f.status_pagamento,
  f.forma_pagamento,
  op.nota_fiscal_emitida,
  op.nota_fiscal_numero,
  CASE
    WHEN f.status_pagamento = 'pago' THEN 'pago'
    WHEN f.data_vencimento < CURRENT_DATE AND f.status_pagamento != 'pago' THEN 'atrasado'
    WHEN f.valor_pago > 0 AND f.valor_pago < f.valor_total THEN 'parcial'
    ELSE 'pendente'
  END as situacao_financeira
FROM public.ordens_producao op
LEFT JOIN public.financeiro f ON op.id = f.op_id
WHERE op.status != 'criada'
ORDER BY
  CASE
    WHEN f.data_vencimento < CURRENT_DATE AND f.status_pagamento != 'pago' THEN 0
    WHEN f.status_pagamento = 'nao_pago' THEN 1
    ELSE 2
  END,
  f.data_vencimento ASC NULLS LAST;

-- =====================================================
-- 7. VIEW PARA PREVISÃO DE FATURAMENTO
-- =====================================================

CREATE OR REPLACE VIEW previsao_faturamento AS
SELECT
  op.id,
  op.codigo,
  op.cliente,
  op.nome_peca,
  op.status,
  op.preco_servico,
  op.nota_fiscal_emitida,
  op.nota_fiscal_numero,
  op.nota_fiscal_data,
  f.status_pagamento,
  f.data_vencimento
FROM public.ordens_producao op
LEFT JOIN public.financeiro f ON op.id = f.op_id
WHERE op.status IN ('finalizada', 'faturada')
AND (op.nota_fiscal_emitida = FALSE OR op.nota_fiscal_emitida IS NULL)
ORDER BY op.updated_at DESC;

-- =====================================================
-- 8. FUNÇÃO PARA HISTÓRICO DE CLIENTES
-- =====================================================

CREATE OR REPLACE FUNCTION get_historico_cliente(cliente_nome TEXT)
RETURNS TABLE (
  total_ops BIGINT,
  total_faturado NUMERIC,
  total_pago NUMERIC,
  total_pendente NUMERIC,
  ultima_op_data DATE
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(DISTINCT op.id)::BIGINT as total_ops,
    COALESCE(SUM(f.valor_total), 0) as total_faturado,
    COALESCE(SUM(f.valor_pago), 0) as total_pago,
    COALESCE(SUM(f.valor_total - COALESCE(f.valor_pago, 0)), 0) as total_pendente,
    MAX(op.data_inicio)::DATE as ultima_op_data
  FROM public.ordens_producao op
  LEFT JOIN public.financeiro f ON op.id = f.op_id
  WHERE op.cliente ILIKE '%' || cliente_nome || '%';
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- FINALIZAÇÃO
-- =====================================================

-- Atualizar trigger de updated_at para orçamentos
CREATE OR REPLACE FUNCTION update_orcamento_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_orcamento_updated_at ON public.orcamentos;
CREATE TRIGGER update_orcamento_updated_at
  BEFORE UPDATE ON public.orcamentos
  FOR EACH ROW
  EXECUTE FUNCTION update_orcamento_updated_at();
