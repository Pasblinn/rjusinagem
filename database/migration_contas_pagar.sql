-- =====================================================
-- MIGRATION: Contas a Pagar
-- Data: 2025-01-22
-- Descrição: Adiciona módulo de Contas a Pagar
-- =====================================================

-- Tipo de conta a pagar
CREATE TYPE tipo_conta_pagar AS ENUM ('fixa', 'variavel');

-- Status do pagamento
CREATE TYPE status_conta_pagar AS ENUM ('pendente', 'pago', 'atrasado', 'cancelado');

-- Categoria de despesa
CREATE TYPE categoria_despesa AS ENUM (
  'aluguel',
  'energia',
  'agua',
  'internet',
  'telefone',
  'salarios',
  'impostos',
  'materiais',
  'manutencao',
  'transporte',
  'alimentacao',
  'outros'
);

-- Tabela principal de contas a pagar
CREATE TABLE contas_pagar (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Informações básicas
  descricao TEXT NOT NULL,
  tipo tipo_conta_pagar NOT NULL DEFAULT 'variavel',
  categoria categoria_despesa NOT NULL DEFAULT 'outros',

  -- Valores
  valor DECIMAL(12,2) NOT NULL,
  valor_pago DECIMAL(12,2) DEFAULT 0,

  -- Datas
  data_vencimento DATE NOT NULL,
  data_pagamento DATE,

  -- Vínculo opcional com OP (para custos variáveis de projeto)
  op_id UUID REFERENCES ordens_producao(id) ON DELETE SET NULL,

  -- Recorrência (para contas fixas)
  recorrente BOOLEAN DEFAULT false,
  dia_vencimento INTEGER, -- Dia do mês para contas recorrentes

  -- Status
  status status_conta_pagar NOT NULL DEFAULT 'pendente',

  -- Observações
  fornecedor TEXT,
  numero_documento TEXT,
  observacoes TEXT,

  -- Auditoria
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

-- Índices para performance
CREATE INDEX idx_contas_pagar_status ON contas_pagar(status);
CREATE INDEX idx_contas_pagar_vencimento ON contas_pagar(data_vencimento);
CREATE INDEX idx_contas_pagar_tipo ON contas_pagar(tipo);
CREATE INDEX idx_contas_pagar_categoria ON contas_pagar(categoria);
CREATE INDEX idx_contas_pagar_op ON contas_pagar(op_id) WHERE op_id IS NOT NULL;

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_contas_pagar_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_contas_pagar_updated_at
  BEFORE UPDATE ON contas_pagar
  FOR EACH ROW
  EXECUTE FUNCTION update_contas_pagar_updated_at();

-- Trigger para atualizar status baseado na data de vencimento
CREATE OR REPLACE FUNCTION update_contas_pagar_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Se pagou o valor total, marca como pago
  IF NEW.valor_pago >= NEW.valor AND NEW.status != 'pago' THEN
    NEW.status = 'pago';
    NEW.data_pagamento = COALESCE(NEW.data_pagamento, CURRENT_DATE);
  -- Se está pendente e passou da data de vencimento, marca como atrasado
  ELSIF NEW.status = 'pendente' AND NEW.data_vencimento < CURRENT_DATE THEN
    NEW.status = 'atrasado';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_contas_pagar_status
  BEFORE INSERT OR UPDATE ON contas_pagar
  FOR EACH ROW
  EXECUTE FUNCTION update_contas_pagar_status();

-- View para dashboard de contas a pagar
CREATE OR REPLACE VIEW dashboard_contas_pagar AS
SELECT
  -- Total pendente
  COALESCE(SUM(CASE WHEN status = 'pendente' THEN valor - valor_pago ELSE 0 END), 0) as total_pendente,
  -- Total atrasado
  COALESCE(SUM(CASE WHEN status = 'atrasado' THEN valor - valor_pago ELSE 0 END), 0) as total_atrasado,
  -- Total pago no mês atual
  COALESCE(SUM(CASE
    WHEN status = 'pago'
    AND EXTRACT(MONTH FROM data_pagamento) = EXTRACT(MONTH FROM CURRENT_DATE)
    AND EXTRACT(YEAR FROM data_pagamento) = EXTRACT(YEAR FROM CURRENT_DATE)
    THEN valor_pago ELSE 0
  END), 0) as total_pago_mes,
  -- Quantidade por status
  COUNT(CASE WHEN status = 'pendente' THEN 1 END) as qtd_pendentes,
  COUNT(CASE WHEN status = 'atrasado' THEN 1 END) as qtd_atrasados,
  -- Vencendo hoje
  COUNT(CASE WHEN status = 'pendente' AND data_vencimento = CURRENT_DATE THEN 1 END) as vencendo_hoje,
  -- Vencendo esta semana
  COUNT(CASE
    WHEN status = 'pendente'
    AND data_vencimento BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'
    THEN 1
  END) as vencendo_semana
FROM contas_pagar
WHERE status != 'cancelado';

-- RLS Policies
ALTER TABLE contas_pagar ENABLE ROW LEVEL SECURITY;

-- Admin e financeiro podem fazer tudo
CREATE POLICY "admin_financeiro_full_access" ON contas_pagar
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = (SELECT auth.uid())
      AND usuarios.role IN ('admin', 'financeiro')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = (SELECT auth.uid())
      AND usuarios.role IN ('admin', 'financeiro')
    )
  );

-- Outros usuários podem apenas visualizar
CREATE POLICY "users_view_contas_pagar" ON contas_pagar
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = (SELECT auth.uid())
      AND usuarios.ativo = true
    )
  );

-- Comentários
COMMENT ON TABLE contas_pagar IS 'Registro de contas a pagar da empresa';
COMMENT ON COLUMN contas_pagar.tipo IS 'fixa = despesas recorrentes, variavel = despesas por projeto/pontual';
COMMENT ON COLUMN contas_pagar.recorrente IS 'Se true, gera nova conta automaticamente todo mês';
