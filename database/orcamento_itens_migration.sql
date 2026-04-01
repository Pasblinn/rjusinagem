-- =====================================================
-- MIGRAÇÃO: Orçamentos com múltiplos itens
-- Execute este script no Supabase SQL Editor
-- =====================================================

-- 1. Adicionar novos campos na tabela orcamentos
ALTER TABLE public.orcamentos
ADD COLUMN IF NOT EXISTS cliente_id UUID REFERENCES public.clientes(id),
ADD COLUMN IF NOT EXISTS cnpj_cliente VARCHAR(20),
ADD COLUMN IF NOT EXISTS telefone_cliente VARCHAR(20),
ADD COLUMN IF NOT EXISTS email_cliente VARCHAR(255),
ADD COLUMN IF NOT EXISTS valor_total DECIMAL(15,2) DEFAULT 0;

-- 2. Criar tabela de itens do orçamento
CREATE TABLE IF NOT EXISTS public.orcamento_itens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    orcamento_id UUID NOT NULL REFERENCES public.orcamentos(id) ON DELETE CASCADE,
    nome_peca VARCHAR(255) NOT NULL,
    quantidade INTEGER NOT NULL DEFAULT 1,
    valor_unitario DECIMAL(15,2) NOT NULL DEFAULT 0,
    subtotal DECIMAL(15,2) GENERATED ALWAYS AS (quantidade * valor_unitario) STORED,
    observacoes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Índices para performance
CREATE INDEX IF NOT EXISTS idx_orcamento_itens_orcamento_id ON public.orcamento_itens(orcamento_id);
CREATE INDEX IF NOT EXISTS idx_orcamentos_cliente_id ON public.orcamentos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_orcamentos_cnpj ON public.orcamentos(cnpj_cliente);

-- 4. RLS para orcamento_itens
ALTER TABLE public.orcamento_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view orcamento_itens"
ON public.orcamento_itens FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert orcamento_itens"
ON public.orcamento_itens FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update orcamento_itens"
ON public.orcamento_itens FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete orcamento_itens"
ON public.orcamento_itens FOR DELETE
TO authenticated
USING (true);

-- 5. Grant permissions
GRANT ALL ON public.orcamento_itens TO authenticated;

-- 6. Função para calcular valor total do orçamento
CREATE OR REPLACE FUNCTION atualizar_valor_total_orcamento()
RETURNS TRIGGER AS $$
BEGIN
    -- Atualizar valor_total do orçamento
    UPDATE public.orcamentos
    SET valor_total = COALESCE((
        SELECT SUM(subtotal)
        FROM public.orcamento_itens
        WHERE orcamento_id = COALESCE(NEW.orcamento_id, OLD.orcamento_id)
    ), 0)
    WHERE id = COALESCE(NEW.orcamento_id, OLD.orcamento_id);

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Triggers para manter valor_total atualizado
DROP TRIGGER IF EXISTS trigger_atualizar_valor_total_insert ON public.orcamento_itens;
DROP TRIGGER IF EXISTS trigger_atualizar_valor_total_update ON public.orcamento_itens;
DROP TRIGGER IF EXISTS trigger_atualizar_valor_total_delete ON public.orcamento_itens;

CREATE TRIGGER trigger_atualizar_valor_total_insert
AFTER INSERT ON public.orcamento_itens
FOR EACH ROW
EXECUTE FUNCTION atualizar_valor_total_orcamento();

CREATE TRIGGER trigger_atualizar_valor_total_update
AFTER UPDATE ON public.orcamento_itens
FOR EACH ROW
EXECUTE FUNCTION atualizar_valor_total_orcamento();

CREATE TRIGGER trigger_atualizar_valor_total_delete
AFTER DELETE ON public.orcamento_itens
FOR EACH ROW
EXECUTE FUNCTION atualizar_valor_total_orcamento();

-- 8. Migrar dados existentes (orçamentos antigos)
-- Criar item para cada orçamento que tem nome_peca e quantidade
INSERT INTO public.orcamento_itens (orcamento_id, nome_peca, quantidade, valor_unitario, observacoes)
SELECT
    id AS orcamento_id,
    nome_peca,
    COALESCE(quantidade, 1) AS quantidade,
    CASE
        WHEN quantidade > 0 THEN valor_estimado / quantidade
        ELSE valor_estimado
    END AS valor_unitario,
    NULL AS observacoes
FROM public.orcamentos
WHERE nome_peca IS NOT NULL
  AND nome_peca != ''
  AND NOT EXISTS (
    SELECT 1 FROM public.orcamento_itens oi WHERE oi.orcamento_id = orcamentos.id
  );

-- 9. Atualizar valor_total dos orçamentos existentes
UPDATE public.orcamentos o
SET valor_total = COALESCE((
    SELECT SUM(subtotal)
    FROM public.orcamento_itens
    WHERE orcamento_id = o.id
), o.valor_estimado);

SELECT 'Migração concluída com sucesso!' AS resultado;
