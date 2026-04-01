-- =====================================================
-- MIGRATION: Novas Features - RJ Usinagem
-- Data: 2025-01-22
-- SEGURO: Verifica se já existe antes de criar
-- =====================================================

-- =====================================================
-- 1. ADICIONAR CNPJ DO CLIENTE
-- =====================================================

-- Adicionar cnpj_cliente na tabela orcamentos (se não existir)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'orcamentos'
    AND column_name = 'cnpj_cliente'
  ) THEN
    ALTER TABLE public.orcamentos ADD COLUMN cnpj_cliente TEXT;
    RAISE NOTICE 'Coluna cnpj_cliente adicionada em orcamentos';
  ELSE
    RAISE NOTICE 'Coluna cnpj_cliente já existe em orcamentos';
  END IF;
END $$;

-- Adicionar cnpj_cliente na tabela ordens_producao (se não existir)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'ordens_producao'
    AND column_name = 'cnpj_cliente'
  ) THEN
    ALTER TABLE public.ordens_producao ADD COLUMN cnpj_cliente TEXT;
    RAISE NOTICE 'Coluna cnpj_cliente adicionada em ordens_producao';
  ELSE
    RAISE NOTICE 'Coluna cnpj_cliente já existe em ordens_producao';
  END IF;
END $$;

-- =====================================================
-- 2. CONTAS A PAGAR - TIPOS ENUM
-- =====================================================

-- Criar tipo para tipo de conta (se não existir)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tipo_conta_pagar') THEN
    CREATE TYPE tipo_conta_pagar AS ENUM ('fixa', 'variavel');
    RAISE NOTICE 'Tipo tipo_conta_pagar criado';
  ELSE
    RAISE NOTICE 'Tipo tipo_conta_pagar já existe';
  END IF;
END $$;

-- Criar tipo para status de conta (se não existir)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'status_conta_pagar') THEN
    CREATE TYPE status_conta_pagar AS ENUM ('pendente', 'pago', 'atrasado', 'cancelado');
    RAISE NOTICE 'Tipo status_conta_pagar criado';
  ELSE
    RAISE NOTICE 'Tipo status_conta_pagar já existe';
  END IF;
END $$;

-- Criar tipo para categoria de despesa (se não existir)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'categoria_despesa') THEN
    CREATE TYPE categoria_despesa AS ENUM (
      'aluguel', 'energia', 'agua', 'internet', 'telefone',
      'salarios', 'impostos', 'materiais', 'manutencao',
      'transporte', 'alimentacao', 'outros'
    );
    RAISE NOTICE 'Tipo categoria_despesa criado';
  ELSE
    RAISE NOTICE 'Tipo categoria_despesa já existe';
  END IF;
END $$;

-- =====================================================
-- 3. TABELA CONTAS A PAGAR
-- =====================================================

CREATE TABLE IF NOT EXISTS public.contas_pagar (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  descricao TEXT NOT NULL,
  tipo tipo_conta_pagar NOT NULL DEFAULT 'variavel',
  categoria categoria_despesa NOT NULL DEFAULT 'outros',
  valor DECIMAL(12,2) NOT NULL,
  valor_pago DECIMAL(12,2) DEFAULT 0,
  data_vencimento DATE NOT NULL,
  data_pagamento DATE,
  op_id UUID REFERENCES public.ordens_producao(id) ON DELETE SET NULL,
  recorrente BOOLEAN DEFAULT false,
  dia_vencimento INTEGER,
  status status_conta_pagar NOT NULL DEFAULT 'pendente',
  fornecedor TEXT,
  numero_documento TEXT,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID,
  updated_by UUID
);

-- =====================================================
-- 4. ÍNDICES PARA CONTAS A PAGAR
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_contas_pagar_status ON public.contas_pagar(status);
CREATE INDEX IF NOT EXISTS idx_contas_pagar_vencimento ON public.contas_pagar(data_vencimento);
CREATE INDEX IF NOT EXISTS idx_contas_pagar_tipo ON public.contas_pagar(tipo);
CREATE INDEX IF NOT EXISTS idx_contas_pagar_categoria ON public.contas_pagar(categoria);

-- =====================================================
-- 5. TRIGGER PARA UPDATED_AT
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_contas_pagar_updated_at'
  ) THEN
    CREATE TRIGGER trigger_contas_pagar_updated_at
      BEFORE UPDATE ON public.contas_pagar
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at();
    RAISE NOTICE 'Trigger trigger_contas_pagar_updated_at criado';
  ELSE
    RAISE NOTICE 'Trigger trigger_contas_pagar_updated_at já existe';
  END IF;
END $$;

-- =====================================================
-- 6. RLS PARA CONTAS A PAGAR
-- =====================================================

ALTER TABLE public.contas_pagar ENABLE ROW LEVEL SECURITY;

-- Policy: Financeiro pode fazer tudo
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'contas_pagar'
    AND policyname = 'financeiro_full_contas_pagar'
  ) THEN
    CREATE POLICY financeiro_full_contas_pagar ON public.contas_pagar
      FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM public.users
          WHERE users.id = auth.uid()
          AND users.role = 'financeiro'
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.users
          WHERE users.id = auth.uid()
          AND users.role = 'financeiro'
        )
      );
    RAISE NOTICE 'Policy financeiro_full_contas_pagar criada';
  ELSE
    RAISE NOTICE 'Policy financeiro_full_contas_pagar já existe';
  END IF;
END $$;

-- Policy: Outros usuários podem visualizar
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'contas_pagar'
    AND policyname = 'users_view_contas_pagar'
  ) THEN
    CREATE POLICY users_view_contas_pagar ON public.contas_pagar
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.users
          WHERE users.id = auth.uid()
          AND users.active = true
        )
      );
    RAISE NOTICE 'Policy users_view_contas_pagar criada';
  ELSE
    RAISE NOTICE 'Policy users_view_contas_pagar já existe';
  END IF;
END $$;

-- =====================================================
-- 7. VIEW DASHBOARD CONTAS A PAGAR
-- =====================================================

CREATE OR REPLACE VIEW public.dashboard_contas_pagar AS
SELECT
  COALESCE(SUM(CASE WHEN status = 'pendente' THEN valor - valor_pago ELSE 0 END), 0) as total_pendente,
  COALESCE(SUM(CASE WHEN status = 'atrasado' THEN valor - valor_pago ELSE 0 END), 0) as total_atrasado,
  COALESCE(SUM(CASE
    WHEN status = 'pago'
    AND EXTRACT(MONTH FROM data_pagamento) = EXTRACT(MONTH FROM CURRENT_DATE)
    AND EXTRACT(YEAR FROM data_pagamento) = EXTRACT(YEAR FROM CURRENT_DATE)
    THEN valor_pago ELSE 0
  END), 0) as total_pago_mes,
  COUNT(CASE WHEN status = 'pendente' THEN 1 END) as qtd_pendentes,
  COUNT(CASE WHEN status = 'atrasado' THEN 1 END) as qtd_atrasados,
  COUNT(CASE WHEN status = 'pendente' AND data_vencimento = CURRENT_DATE THEN 1 END) as vencendo_hoje,
  COUNT(CASE
    WHEN status = 'pendente'
    AND data_vencimento BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'
    THEN 1
  END) as vencendo_semana
FROM public.contas_pagar
WHERE status != 'cancelado';

-- =====================================================
-- PRONTO! Script seguro para executar
-- =====================================================
