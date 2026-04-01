-- =====================================================
-- MIGRATION V3 - ETAPA 5: REGRAS DE NEGÓCIO
-- =====================================================
-- Implementação de constraints e validações no banco
-- =====================================================

-- 1. CONSTRAINT: OP não pode ser paga sem financeiro
-- =====================================================

CREATE OR REPLACE FUNCTION validar_pagamento_op()
RETURNS TRIGGER AS $$
BEGIN
    -- Se está marcando como paga, verificar se tem financeiro
    IF NEW.status_financeiro = 'pago' THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.financeiro
            WHERE op_id = NEW.id
            AND valor_pago >= valor_total
        ) THEN
            RAISE EXCEPTION 'OP não pode ser marcada como paga sem pagamento completo registrado no financeiro';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_validar_pagamento_op ON public.ordens_producao;

CREATE TRIGGER trigger_validar_pagamento_op
    BEFORE UPDATE ON public.ordens_producao
    FOR EACH ROW
    WHEN (NEW.status_financeiro = 'pago' AND OLD.status_financeiro != 'pago')
    EXECUTE FUNCTION validar_pagamento_op();

-- 2. CONSTRAINT: Nota fiscal só pode ser emitida com OP finalizada
-- =====================================================

CREATE OR REPLACE FUNCTION validar_emissao_nota()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.nota_fiscal_emitida = TRUE AND OLD.nota_fiscal_emitida IS DISTINCT FROM TRUE THEN
        IF NEW.status_producao NOT IN ('finalizada', 'cancelada') THEN
            RAISE EXCEPTION 'Nota fiscal só pode ser emitida para OP finalizada ou cancelada';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_validar_emissao_nota ON public.ordens_producao;

CREATE TRIGGER trigger_validar_emissao_nota
    BEFORE UPDATE ON public.ordens_producao
    FOR EACH ROW
    WHEN (NEW.nota_fiscal_emitida = TRUE)
    EXECUTE FUNCTION validar_emissao_nota();

-- 3. CONSTRAINT: Operador não pode editar valores financeiros
-- =====================================================
-- (Implementado via RLS - policies já existentes)

-- 4. CONSTRAINT: OP cancelada gera registro de prejuízo
-- =====================================================

CREATE OR REPLACE FUNCTION processar_cancelamento_op()
RETURNS TRIGGER AS $$
DECLARE
    v_financeiro_id UUID;
BEGIN
    -- Se está cancelando a OP
    IF NEW.status_producao = 'cancelada' AND OLD.status_producao != 'cancelada' THEN
        -- Buscar financeiro
        SELECT id INTO v_financeiro_id
        FROM public.financeiro
        WHERE op_id = NEW.id;

        -- Se tem financeiro e valor não foi totalmente pago, registrar prejuízo
        IF v_financeiro_id IS NOT NULL THEN
            -- Atualizar status financeiro
            UPDATE public.financeiro
            SET status_pagamento = 'cancelado'
            WHERE id = v_financeiro_id;

            -- Registrar movimento de cancelamento
            INSERT INTO public.financeiro_movimentos (
                financeiro_id,
                op_id,
                tipo,
                valor,
                saldo_anterior,
                saldo_atual,
                observacao,
                created_by
            )
            SELECT
                f.id,
                f.op_id,
                'cancelamento',
                f.valor_total - COALESCE(f.valor_pago, 0),
                COALESCE(f.valor_pago, 0),
                0,
                'OP cancelada - prejuízo registrado automaticamente',
                NEW.updated_by
            FROM public.financeiro f
            WHERE f.id = v_financeiro_id
            AND f.valor_pago < f.valor_total;
        END IF;

        -- Atualizar status financeiro da OP
        NEW.status_financeiro := 'cancelado';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_processar_cancelamento ON public.ordens_producao;

CREATE TRIGGER trigger_processar_cancelamento
    BEFORE UPDATE ON public.ordens_producao
    FOR EACH ROW
    WHEN (NEW.status_producao = 'cancelada' AND OLD.status_producao != 'cancelada')
    EXECUTE FUNCTION processar_cancelamento_op();

-- 5. CONSTRAINT: Não permitir edição de OP finalizada (exceto financeiro)
-- =====================================================

CREATE OR REPLACE FUNCTION proteger_op_finalizada()
RETURNS TRIGGER AS $$
BEGIN
    -- Se a OP está finalizada, só permite alterações em campos específicos
    IF OLD.status_producao IN ('finalizada', 'cancelada') THEN
        -- Campos que podem ser alterados após finalização
        IF (
            OLD.nota_fiscal_emitida IS DISTINCT FROM NEW.nota_fiscal_emitida OR
            OLD.nota_fiscal_numero IS DISTINCT FROM NEW.nota_fiscal_numero OR
            OLD.nota_fiscal_data IS DISTINCT FROM NEW.nota_fiscal_data OR
            OLD.status_financeiro IS DISTINCT FROM NEW.status_financeiro OR
            OLD.updated_by IS DISTINCT FROM NEW.updated_by OR
            OLD.updated_at IS DISTINCT FROM NEW.updated_at
        ) THEN
            -- Permitir essas alterações
            RETURN NEW;
        END IF;

        -- Verificar se outros campos foram alterados
        IF (
            OLD.cliente IS DISTINCT FROM NEW.cliente OR
            OLD.nome_peca IS DISTINCT FROM NEW.nome_peca OR
            OLD.quantidade_total IS DISTINCT FROM NEW.quantidade_total OR
            OLD.preco_servico IS DISTINCT FROM NEW.preco_servico OR
            OLD.material IS DISTINCT FROM NEW.material
        ) THEN
            RAISE EXCEPTION 'OP finalizada não pode ter dados de produção alterados';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_proteger_op_finalizada ON public.ordens_producao;

CREATE TRIGGER trigger_proteger_op_finalizada
    BEFORE UPDATE ON public.ordens_producao
    FOR EACH ROW
    EXECUTE FUNCTION proteger_op_finalizada();

-- 6. CONSTRAINT: Valor pago não pode exceder valor total
-- =====================================================

ALTER TABLE public.financeiro
DROP CONSTRAINT IF EXISTS chk_valor_pago_nao_excede;

ALTER TABLE public.financeiro
ADD CONSTRAINT chk_valor_pago_nao_excede
CHECK (valor_pago <= valor_total + 0.01); -- Margem de 1 centavo para arredondamento

-- 7. CONSTRAINT: Data de término não pode ser anterior à data de início
-- =====================================================

ALTER TABLE public.ordens_producao
DROP CONSTRAINT IF EXISTS chk_datas_consistentes;

ALTER TABLE public.ordens_producao
ADD CONSTRAINT chk_datas_consistentes
CHECK (data_termino IS NULL OR data_termino >= data_inicio);

-- 8. CONSTRAINT: Quantidade produzida não pode ser negativa
-- =====================================================

ALTER TABLE public.producao_diaria
DROP CONSTRAINT IF EXISTS chk_quantidade_positiva;

ALTER TABLE public.producao_diaria
ADD CONSTRAINT chk_quantidade_positiva
CHECK (quantidade_produzida >= 0 AND pecas_defeituosas >= 0);

-- 9. FUNÇÃO: Atualizar status financeiro automaticamente
-- =====================================================

CREATE OR REPLACE FUNCTION sincronizar_status_financeiro()
RETURNS TRIGGER AS $$
DECLARE
    v_op_id UUID;
    v_novo_status TEXT;
BEGIN
    v_op_id := NEW.op_id;

    -- Calcular novo status
    IF NEW.valor_pago >= NEW.valor_total THEN
        v_novo_status := 'pago';
    ELSIF NEW.valor_pago > 0 THEN
        v_novo_status := 'parcial';
    ELSIF NEW.data_vencimento IS NOT NULL AND NEW.data_vencimento < CURRENT_DATE THEN
        v_novo_status := 'atrasado';
    ELSE
        v_novo_status := 'pendente';
    END IF;

    -- Atualizar OP
    UPDATE public.ordens_producao
    SET status_financeiro = v_novo_status::status_financeiro_enum
    WHERE id = v_op_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sincronizar_status_financeiro ON public.financeiro;

CREATE TRIGGER trigger_sincronizar_status_financeiro
    AFTER INSERT OR UPDATE ON public.financeiro
    FOR EACH ROW
    EXECUTE FUNCTION sincronizar_status_financeiro();

-- 10. DOCUMENTAÇÃO DAS REGRAS
-- =====================================================

COMMENT ON FUNCTION validar_pagamento_op IS
'REGRA: OP só pode ser marcada como paga se tiver pagamento completo no financeiro';

COMMENT ON FUNCTION validar_emissao_nota IS
'REGRA: Nota fiscal só pode ser emitida para OP finalizada ou cancelada';

COMMENT ON FUNCTION processar_cancelamento_op IS
'REGRA: Cancelamento de OP registra prejuízo automaticamente e cancela financeiro';

COMMENT ON FUNCTION proteger_op_finalizada IS
'REGRA: OP finalizada não permite alteração de dados de produção, apenas financeiros';

COMMENT ON FUNCTION sincronizar_status_financeiro IS
'REGRA: Status financeiro da OP é atualizado automaticamente quando financeiro muda';

-- =====================================================
-- RESUMO DAS REGRAS DE NEGÓCIO IMPLEMENTADAS:
-- =====================================================
-- 1. OP não pode ser marcada como paga sem pagamento completo
-- 2. Nota fiscal só pode ser emitida para OP finalizada
-- 3. Operador não pode editar valores financeiros (RLS)
-- 4. Cancelamento de OP gera prejuízo automaticamente
-- 5. OP finalizada não permite alteração de dados de produção
-- 6. Valor pago não pode exceder valor total
-- 7. Data de término não pode ser anterior à data de início
-- 8. Quantidades não podem ser negativas
-- 9. Status financeiro é sincronizado automaticamente
-- =====================================================
