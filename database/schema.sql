-- RJ Usinagem - Database Schema
-- PostgreSQL / Supabase

-- Habilitar extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enum types
CREATE TYPE user_role AS ENUM ('financeiro', 'chefe', 'operador');
CREATE TYPE op_status AS ENUM ('criada', 'em_producao', 'finalizada', 'faturada', 'nota_emitida', 'paga');
CREATE TYPE op_type AS ENUM ('encomenda', 'estoque');
CREATE TYPE payment_status AS ENUM ('nao_pago', 'pago');
CREATE TYPE orcamento_status AS ENUM ('aberto', 'convertido', 'cancelado');

-- Tabela de usuários customizada (complementa auth.users do Supabase)
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  nome TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'operador',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de Ordens de Produção
CREATE TABLE public.ordens_producao (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  codigo TEXT UNIQUE NOT NULL,
  tipo op_type NOT NULL DEFAULT 'encomenda',
  data_inicio DATE NOT NULL,
  data_termino DATE,
  status op_status NOT NULL DEFAULT 'criada',

  -- Preparação obrigatória
  preparacao_maquina TEXT NOT NULL,

  -- Informações de material
  material TEXT,
  codigo_descricao_material TEXT,
  quantidade_material NUMERIC,
  lote TEXT,
  fornecedor TEXT,
  observacoes_material TEXT,

  -- Cliente e peça
  cliente TEXT NOT NULL,
  nome_peca TEXT NOT NULL,
  quantidade_total INTEGER NOT NULL,
  preco_servico NUMERIC(10, 2) NOT NULL,

  -- Produção
  maquina_utilizada TEXT,
  operador_responsavel TEXT,

  -- Aprovação
  supervisor_nome TEXT,
  supervisor_data_aprovacao TIMESTAMPTZ,
  aprovada BOOLEAN DEFAULT FALSE,

  -- Metadata
  created_by UUID NOT NULL REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de Produção Diária
CREATE TABLE public.producao_diaria (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  op_id UUID NOT NULL REFERENCES public.ordens_producao(id) ON DELETE CASCADE,
  data DATE NOT NULL,
  turno TEXT NOT NULL,
  quantidade_produzida INTEGER NOT NULL DEFAULT 0,
  pecas_defeituosas INTEGER NOT NULL DEFAULT 0,
  observacoes TEXT,
  operador_id UUID NOT NULL REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de Peças Defeituosas (detalhamento)
CREATE TABLE public.pecas_defeituosas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  op_id UUID NOT NULL REFERENCES public.ordens_producao(id) ON DELETE CASCADE,
  data DATE NOT NULL,
  quantidade INTEGER NOT NULL,
  tipo_defeito TEXT NOT NULL,
  causa_provavel TEXT NOT NULL,
  acao_corretiva TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela Financeiro
CREATE TABLE public.financeiro (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  op_id UUID UNIQUE NOT NULL REFERENCES public.ordens_producao(id) ON DELETE CASCADE,
  valor_total NUMERIC(10, 2) NOT NULL,
  forma_pagamento TEXT NOT NULL,
  status_pagamento payment_status NOT NULL DEFAULT 'nao_pago',
  custos_extras NUMERIC(10, 2) DEFAULT 0,
  prejuizo_defeitos NUMERIC(10, 2) DEFAULT 0,
  lucro_final NUMERIC(10, 2) GENERATED ALWAYS AS (valor_total - custos_extras - prejuizo_defeitos) STORED,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de Orçamentos
CREATE TABLE public.orcamentos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cliente TEXT NOT NULL,
  nome_peca TEXT NOT NULL,
  quantidade INTEGER NOT NULL,
  valor_estimado NUMERIC(10, 2) NOT NULL,
  observacoes TEXT,
  status orcamento_status NOT NULL DEFAULT 'aberto',
  convertido_op_id UUID REFERENCES public.ordens_producao(id),
  created_by UUID NOT NULL REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX idx_op_status ON public.ordens_producao(status);
CREATE INDEX idx_op_codigo ON public.ordens_producao(codigo);
CREATE INDEX idx_op_data_inicio ON public.ordens_producao(data_inicio);
CREATE INDEX idx_producao_op_id ON public.producao_diaria(op_id);
CREATE INDEX idx_financeiro_status ON public.financeiro(status_pagamento);
CREATE INDEX idx_orcamento_status ON public.orcamentos(status);

-- Função para gerar código de OP automaticamente
CREATE OR REPLACE FUNCTION gerar_codigo_op()
RETURNS TEXT AS $$
DECLARE
  ano TEXT;
  contador INTEGER;
  codigo TEXT;
BEGIN
  ano := TO_CHAR(NOW(), 'YYYY');

  SELECT COUNT(*) + 1 INTO contador
  FROM public.ordens_producao
  WHERE codigo LIKE 'OP-' || ano || '-%';

  codigo := 'OP-' || ano || '-' || LPAD(contador::TEXT, 4, '0');

  RETURN codigo;
END;
$$ LANGUAGE plpgsql;

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_op_updated_at
  BEFORE UPDATE ON public.ordens_producao
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_financeiro_updated_at
  BEFORE UPDATE ON public.financeiro
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Row Level Security (RLS)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ordens_producao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.producao_diaria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pecas_defeituosas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financeiro ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orcamentos ENABLE ROW LEVEL SECURITY;

-- Policies para users
CREATE POLICY "Usuários podem ver todos os usuários"
  ON public.users FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Policies para ordens_producao
CREATE POLICY "Todos podem ver OPs"
  ON public.ordens_producao FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Financeiro e Chefe podem criar OPs"
  ON public.ordens_producao FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND role IN ('financeiro', 'chefe')
    )
  );

CREATE POLICY "Financeiro e Chefe podem editar OPs não aprovadas"
  ON public.ordens_producao FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND role IN ('financeiro', 'chefe')
    )
  );

-- Policies para producao_diaria
CREATE POLICY "Todos podem ver produção"
  ON public.producao_diaria FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Operadores podem registrar produção"
  ON public.producao_diaria FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Policies para pecas_defeituosas
CREATE POLICY "Todos podem ver defeitos"
  ON public.pecas_defeituosas FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Operadores podem registrar defeitos"
  ON public.pecas_defeituosas FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Policies para financeiro
CREATE POLICY "Apenas financeiro pode ver dados financeiros"
  ON public.financeiro FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND role = 'financeiro'
    )
  );

CREATE POLICY "Apenas financeiro pode criar dados financeiros"
  ON public.financeiro FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND role = 'financeiro'
    )
  );

CREATE POLICY "Apenas financeiro pode editar dados financeiros"
  ON public.financeiro FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND role = 'financeiro'
    )
  );

-- Policies para orcamentos
CREATE POLICY "Apenas financeiro pode ver orçamentos"
  ON public.orcamentos FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND role = 'financeiro'
    )
  );

CREATE POLICY "Apenas financeiro pode criar orçamentos"
  ON public.orcamentos FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND role = 'financeiro'
    )
  );

-- View para dashboard stats
CREATE OR REPLACE VIEW dashboard_stats AS
SELECT
  (SELECT COUNT(*) FROM public.ordens_producao) as total_ops,
  (SELECT COUNT(*) FROM public.ordens_producao WHERE status = 'em_producao') as ops_em_producao,
  (SELECT COUNT(*) FROM public.ordens_producao
   WHERE status = 'finalizada'
   AND EXTRACT(MONTH FROM data_termino) = EXTRACT(MONTH FROM NOW())
   AND EXTRACT(YEAR FROM data_termino) = EXTRACT(YEAR FROM NOW())
  ) as ops_finalizadas_mes,
  COALESCE((
    SELECT SUM(f.valor_total)
    FROM public.financeiro f
    WHERE f.status_pagamento = 'nao_pago'
  ), 0) as valor_a_receber;

-- Inserir usuário financeiro padrão (Elizangela)
-- IMPORTANTE: Após criar o usuário no Supabase Auth, execute:
-- INSERT INTO public.users (id, email, nome, role)
-- VALUES ('uuid-do-usuario-criado', 'elizangela@rjusinagem.com.br', 'Elizangela', 'financeiro');
