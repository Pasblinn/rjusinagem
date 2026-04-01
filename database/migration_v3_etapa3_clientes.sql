-- =====================================================
-- MIGRATION V3 - ETAPA 3: NORMALIZAÇÃO DE CLIENTES
-- =====================================================
-- Problema: Cliente é TEXT em ordens_producao (duplicações)
-- Solução: Criar tabela clientes normalizada
-- =====================================================

-- 1. CRIAR TABELA DE CLIENTES
-- =====================================================

CREATE TABLE IF NOT EXISTS public.clientes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Dados básicos
    nome TEXT NOT NULL,
    nome_fantasia TEXT,
    documento TEXT, -- CPF ou CNPJ
    tipo_documento TEXT CHECK (tipo_documento IN ('cpf', 'cnpj')),

    -- Contato
    email TEXT,
    telefone TEXT,
    celular TEXT,
    contato_nome TEXT, -- Nome da pessoa de contato

    -- Endereço
    endereco TEXT,
    numero TEXT,
    complemento TEXT,
    bairro TEXT,
    cidade TEXT,
    estado TEXT,
    cep TEXT,

    -- Informações comerciais
    observacoes TEXT,
    ativo BOOLEAN DEFAULT TRUE,

    -- Metadados
    created_by UUID REFERENCES public.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID REFERENCES public.users(id)
);

-- 2. ÍNDICES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_clientes_nome
ON public.clientes(nome);

CREATE INDEX IF NOT EXISTS idx_clientes_documento
ON public.clientes(documento);

CREATE INDEX IF NOT EXISTS idx_clientes_ativo
ON public.clientes(ativo);

-- 3. TRIGGER PARA ATUALIZAR updated_at
-- =====================================================

CREATE TRIGGER update_clientes_updated_at
    BEFORE UPDATE ON public.clientes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- 4. RLS (Row Level Security)
-- =====================================================

ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;

-- Todos autenticados podem ver clientes
CREATE POLICY "Todos podem ver clientes"
    ON public.clientes FOR SELECT
    USING (auth.uid() IS NOT NULL);

-- Financeiro e Chefe podem criar clientes
CREATE POLICY "Financeiro e Chefe podem criar clientes"
    ON public.clientes FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid()
            AND role IN ('financeiro', 'chefe')
        )
    );

-- Financeiro e Chefe podem editar clientes
CREATE POLICY "Financeiro e Chefe podem editar clientes"
    ON public.clientes FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid()
            AND role IN ('financeiro', 'chefe')
        )
    );

-- 5. ADICIONAR COLUNA cliente_id NA ordens_producao
-- =====================================================

ALTER TABLE public.ordens_producao
ADD COLUMN IF NOT EXISTS cliente_id UUID REFERENCES public.clientes(id);

CREATE INDEX IF NOT EXISTS idx_op_cliente_id
ON public.ordens_producao(cliente_id);

-- 6. MIGRAR DADOS EXISTENTES
-- =====================================================
-- Esta seção cria clientes a partir dos nomes existentes

-- Inserir clientes únicos a partir das OPs existentes
INSERT INTO public.clientes (nome, ativo, created_at)
SELECT DISTINCT
    cliente as nome,
    TRUE as ativo,
    MIN(created_at) as created_at
FROM public.ordens_producao
WHERE cliente IS NOT NULL AND cliente != ''
GROUP BY cliente
ON CONFLICT DO NOTHING;

-- Atualizar referências nas OPs
UPDATE public.ordens_producao op
SET cliente_id = c.id
FROM public.clientes c
WHERE op.cliente = c.nome
AND op.cliente_id IS NULL;

-- 7. ADICIONAR COLUNA cliente_id NA orcamentos
-- =====================================================

ALTER TABLE public.orcamentos
ADD COLUMN IF NOT EXISTS cliente_id UUID REFERENCES public.clientes(id);

CREATE INDEX IF NOT EXISTS idx_orc_cliente_id
ON public.orcamentos(cliente_id);

-- Atualizar referências nos orçamentos
UPDATE public.orcamentos o
SET cliente_id = c.id
FROM public.clientes c
WHERE o.cliente = c.nome
AND o.cliente_id IS NULL;

-- 8. VIEW PARA ESTATÍSTICAS DO CLIENTE
-- =====================================================

CREATE OR REPLACE VIEW public.cliente_estatisticas AS
SELECT
    c.id,
    c.nome,
    c.documento,
    c.email,
    c.telefone,
    c.ativo,
    COUNT(DISTINCT op.id) as total_ops,
    COALESCE(SUM(op.preco_servico), 0) as total_faturado,
    COALESCE(SUM(f.valor_pago), 0) as total_pago,
    COALESCE(SUM(op.preco_servico), 0) - COALESCE(SUM(f.valor_pago), 0) as total_pendente,
    MAX(op.created_at) as ultima_op_data,
    COUNT(DISTINCT CASE WHEN op.status_financeiro = 'atrasado' THEN op.id END) as ops_atrasadas
FROM public.clientes c
LEFT JOIN public.ordens_producao op ON op.cliente_id = c.id OR op.cliente = c.nome
LEFT JOIN public.financeiro f ON f.op_id = op.id
GROUP BY c.id, c.nome, c.documento, c.email, c.telefone, c.ativo;

-- 9. FUNÇÃO PARA BUSCAR OU CRIAR CLIENTE
-- =====================================================

CREATE OR REPLACE FUNCTION buscar_ou_criar_cliente(
    p_nome TEXT,
    p_user_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_cliente_id UUID;
BEGIN
    -- Tentar encontrar cliente existente
    SELECT id INTO v_cliente_id
    FROM public.clientes
    WHERE LOWER(TRIM(nome)) = LOWER(TRIM(p_nome))
    LIMIT 1;

    -- Se não encontrou, criar novo
    IF v_cliente_id IS NULL THEN
        INSERT INTO public.clientes (nome, created_by)
        VALUES (TRIM(p_nome), p_user_id)
        RETURNING id INTO v_cliente_id;
    END IF;

    RETURN v_cliente_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. COMENTÁRIOS
-- =====================================================

COMMENT ON TABLE public.clientes IS
'Cadastro normalizado de clientes';

COMMENT ON COLUMN public.clientes.documento IS
'CPF (11 dígitos) ou CNPJ (14 dígitos)';

COMMENT ON COLUMN public.ordens_producao.cliente IS
'[DEPRECADO] Usar cliente_id. Mantido para compatibilidade.';

COMMENT ON COLUMN public.ordens_producao.cliente_id IS
'Referência ao cliente normalizado';

-- =====================================================
-- INSTRUÇÕES:
-- =====================================================
-- 1. Execute este script no Supabase SQL Editor
-- 2. Os clientes existentes serão migrados automaticamente
-- 3. O campo "cliente" (TEXT) foi mantido para compatibilidade
-- 4. Gradualmente migre para usar cliente_id
-- 5. A view cliente_estatisticas mostra resumo de cada cliente
-- =====================================================
