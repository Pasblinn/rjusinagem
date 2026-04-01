-- =====================================================
-- MIGRATION: PONTO ELETRÔNICO
-- =====================================================
-- Feature: Sistema de controle de ponto para funcionários
-- Acesso: Mobile via token (sem login) + Desktop (financeiro/chefe)
-- =====================================================

-- =====================================================
-- 1. TABELA: funcionarios_ponto
-- =====================================================
-- Funcionários que podem bater ponto (separado de users)
-- user_id é opcional - nem todo funcionário tem conta no sistema

CREATE TABLE IF NOT EXISTS public.funcionarios_ponto (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Vínculo opcional com usuário do sistema
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,

    -- Dados do funcionário
    nome TEXT NOT NULL,
    cargo TEXT,

    -- Token para acesso mobile (link único)
    ponto_token UUID UNIQUE NOT NULL DEFAULT uuid_generate_v4(),

    -- Status
    ativo BOOLEAN DEFAULT TRUE,

    -- Metadados
    created_by UUID REFERENCES public.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_funcionarios_ponto_token
ON public.funcionarios_ponto(ponto_token);

CREATE INDEX IF NOT EXISTS idx_funcionarios_ponto_ativo
ON public.funcionarios_ponto(ativo);

CREATE INDEX IF NOT EXISTS idx_funcionarios_ponto_user_id
ON public.funcionarios_ponto(user_id);

-- Trigger para updated_at
DROP TRIGGER IF EXISTS update_funcionarios_ponto_updated_at ON public.funcionarios_ponto;
CREATE TRIGGER update_funcionarios_ponto_updated_at
    BEFORE UPDATE ON public.funcionarios_ponto
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- =====================================================
-- 2. TABELA: registro_ponto
-- =====================================================
-- Registros de entrada/saída dos funcionários

CREATE TABLE IF NOT EXISTS public.registro_ponto (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Funcionário
    funcionario_id UUID NOT NULL REFERENCES public.funcionarios_ponto(id) ON DELETE CASCADE,

    -- Data e horários
    data DATE NOT NULL DEFAULT CURRENT_DATE,
    hora_entrada TIMESTAMPTZ,
    hora_saida TIMESTAMPTZ,

    -- Cálculo automático
    total_minutos INTEGER,  -- Armazenado em minutos para facilitar cálculos

    -- Status do registro
    status TEXT NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto', 'fechado', 'ajustado')),

    -- Origem do registro
    origem TEXT DEFAULT 'mobile' CHECK (origem IN ('mobile', 'desktop', 'ajuste')),

    -- Observações (para ajustes manuais)
    observacao TEXT,

    -- Metadados
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID REFERENCES public.users(id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_registro_ponto_funcionario
ON public.registro_ponto(funcionario_id);

CREATE INDEX IF NOT EXISTS idx_registro_ponto_data
ON public.registro_ponto(data DESC);

CREATE INDEX IF NOT EXISTS idx_registro_ponto_status
ON public.registro_ponto(status);

CREATE INDEX IF NOT EXISTS idx_registro_ponto_funcionario_data
ON public.registro_ponto(funcionario_id, data);

-- Constraint: apenas um ponto aberto por funcionário
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_ponto_aberto
ON public.registro_ponto(funcionario_id)
WHERE status = 'aberto';

-- Trigger para updated_at
DROP TRIGGER IF EXISTS update_registro_ponto_updated_at ON public.registro_ponto;
CREATE TRIGGER update_registro_ponto_updated_at
    BEFORE UPDATE ON public.registro_ponto
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- =====================================================
-- 3. FUNÇÕES DE NEGÓCIO
-- =====================================================

-- Função: Buscar funcionário pelo token (para mobile)
CREATE OR REPLACE FUNCTION buscar_funcionario_por_token(p_token UUID)
RETURNS TABLE (
    id UUID,
    nome TEXT,
    cargo TEXT,
    ativo BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        fp.id,
        fp.nome,
        fp.cargo,
        fp.ativo
    FROM public.funcionarios_ponto fp
    WHERE fp.ponto_token = p_token
    AND fp.ativo = TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função: Buscar ponto aberto do dia
CREATE OR REPLACE FUNCTION buscar_ponto_aberto(p_funcionario_id UUID)
RETURNS TABLE (
    id UUID,
    data DATE,
    hora_entrada TIMESTAMPTZ,
    status TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        rp.id,
        rp.data,
        rp.hora_entrada,
        rp.status
    FROM public.registro_ponto rp
    WHERE rp.funcionario_id = p_funcionario_id
    AND rp.status = 'aberto'
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função: Registrar entrada
CREATE OR REPLACE FUNCTION registrar_entrada(p_token UUID)
RETURNS TABLE (
    sucesso BOOLEAN,
    mensagem TEXT,
    registro_id UUID,
    hora TIMESTAMPTZ
) AS $$
DECLARE
    v_funcionario_id UUID;
    v_funcionario_ativo BOOLEAN;
    v_ponto_aberto UUID;
    v_novo_registro_id UUID;
    v_hora_entrada TIMESTAMPTZ;
BEGIN
    -- Buscar funcionário pelo token
    SELECT fp.id, fp.ativo INTO v_funcionario_id, v_funcionario_ativo
    FROM public.funcionarios_ponto fp
    WHERE fp.ponto_token = p_token;

    -- Validar funcionário
    IF v_funcionario_id IS NULL THEN
        RETURN QUERY SELECT FALSE, 'Token inválido'::TEXT, NULL::UUID, NULL::TIMESTAMPTZ;
        RETURN;
    END IF;

    IF NOT v_funcionario_ativo THEN
        RETURN QUERY SELECT FALSE, 'Funcionário inativo'::TEXT, NULL::UUID, NULL::TIMESTAMPTZ;
        RETURN;
    END IF;

    -- Verificar se já tem ponto aberto
    SELECT rp.id INTO v_ponto_aberto
    FROM public.registro_ponto rp
    WHERE rp.funcionario_id = v_funcionario_id
    AND rp.status = 'aberto';

    IF v_ponto_aberto IS NOT NULL THEN
        RETURN QUERY SELECT FALSE, 'Já existe um ponto aberto. Registre a saída primeiro.'::TEXT, v_ponto_aberto, NULL::TIMESTAMPTZ;
        RETURN;
    END IF;

    -- Registrar entrada
    v_hora_entrada := NOW();

    INSERT INTO public.registro_ponto (funcionario_id, data, hora_entrada, status, origem)
    VALUES (v_funcionario_id, CURRENT_DATE, v_hora_entrada, 'aberto', 'mobile')
    RETURNING id INTO v_novo_registro_id;

    RETURN QUERY SELECT TRUE, 'Entrada registrada com sucesso'::TEXT, v_novo_registro_id, v_hora_entrada;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função: Registrar saída
CREATE OR REPLACE FUNCTION registrar_saida(p_token UUID)
RETURNS TABLE (
    sucesso BOOLEAN,
    mensagem TEXT,
    registro_id UUID,
    hora TIMESTAMPTZ,
    total_horas TEXT
) AS $$
DECLARE
    v_funcionario_id UUID;
    v_funcionario_ativo BOOLEAN;
    v_ponto_aberto RECORD;
    v_hora_saida TIMESTAMPTZ;
    v_total_minutos INTEGER;
    v_total_horas_formatado TEXT;
BEGIN
    -- Buscar funcionário pelo token
    SELECT fp.id, fp.ativo INTO v_funcionario_id, v_funcionario_ativo
    FROM public.funcionarios_ponto fp
    WHERE fp.ponto_token = p_token;

    -- Validar funcionário
    IF v_funcionario_id IS NULL THEN
        RETURN QUERY SELECT FALSE, 'Token inválido'::TEXT, NULL::UUID, NULL::TIMESTAMPTZ, NULL::TEXT;
        RETURN;
    END IF;

    IF NOT v_funcionario_ativo THEN
        RETURN QUERY SELECT FALSE, 'Funcionário inativo'::TEXT, NULL::UUID, NULL::TIMESTAMPTZ, NULL::TEXT;
        RETURN;
    END IF;

    -- Buscar ponto aberto
    SELECT rp.id, rp.hora_entrada INTO v_ponto_aberto
    FROM public.registro_ponto rp
    WHERE rp.funcionario_id = v_funcionario_id
    AND rp.status = 'aberto';

    IF v_ponto_aberto.id IS NULL THEN
        RETURN QUERY SELECT FALSE, 'Não há ponto aberto. Registre a entrada primeiro.'::TEXT, NULL::UUID, NULL::TIMESTAMPTZ, NULL::TEXT;
        RETURN;
    END IF;

    -- Registrar saída
    v_hora_saida := NOW();
    v_total_minutos := EXTRACT(EPOCH FROM (v_hora_saida - v_ponto_aberto.hora_entrada)) / 60;
    v_total_horas_formatado := CONCAT(
        FLOOR(v_total_minutos / 60)::TEXT, 'h ',
        (v_total_minutos % 60)::TEXT, 'min'
    );

    UPDATE public.registro_ponto
    SET hora_saida = v_hora_saida,
        total_minutos = v_total_minutos,
        status = 'fechado',
        updated_at = NOW()
    WHERE id = v_ponto_aberto.id;

    RETURN QUERY SELECT TRUE, 'Saída registrada com sucesso'::TEXT, v_ponto_aberto.id, v_hora_saida, v_total_horas_formatado;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função: Bater ponto (detecta automaticamente entrada/saída)
CREATE OR REPLACE FUNCTION bater_ponto(p_token UUID)
RETURNS TABLE (
    sucesso BOOLEAN,
    tipo TEXT,
    mensagem TEXT,
    registro_id UUID,
    hora TIMESTAMPTZ,
    total_horas TEXT
) AS $$
DECLARE
    v_funcionario_id UUID;
    v_ponto_aberto UUID;
    v_resultado RECORD;
BEGIN
    -- Buscar funcionário pelo token
    SELECT fp.id INTO v_funcionario_id
    FROM public.funcionarios_ponto fp
    WHERE fp.ponto_token = p_token
    AND fp.ativo = TRUE;

    IF v_funcionario_id IS NULL THEN
        RETURN QUERY SELECT FALSE, 'erro'::TEXT, 'Token inválido ou funcionário inativo'::TEXT, NULL::UUID, NULL::TIMESTAMPTZ, NULL::TEXT;
        RETURN;
    END IF;

    -- Verificar se tem ponto aberto
    SELECT rp.id INTO v_ponto_aberto
    FROM public.registro_ponto rp
    WHERE rp.funcionario_id = v_funcionario_id
    AND rp.status = 'aberto';

    -- Se tem ponto aberto, registra saída; senão, registra entrada
    IF v_ponto_aberto IS NOT NULL THEN
        -- Registrar saída
        SELECT * INTO v_resultado FROM registrar_saida(p_token);
        RETURN QUERY SELECT v_resultado.sucesso, 'saida'::TEXT, v_resultado.mensagem, v_resultado.registro_id, v_resultado.hora, v_resultado.total_horas;
    ELSE
        -- Registrar entrada
        SELECT * INTO v_resultado FROM registrar_entrada(p_token);
        RETURN QUERY SELECT v_resultado.sucesso, 'entrada'::TEXT, v_resultado.mensagem, v_resultado.registro_id, v_resultado.hora, NULL::TEXT;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 4. VIEWS PARA RELATÓRIOS
-- =====================================================

-- View: Resumo de ponto por funcionário
CREATE OR REPLACE VIEW public.resumo_ponto_funcionario AS
SELECT
    fp.id AS funcionario_id,
    fp.nome,
    fp.cargo,
    fp.ativo,
    COUNT(rp.id) AS total_registros,
    SUM(CASE WHEN rp.status = 'fechado' THEN rp.total_minutos ELSE 0 END) AS total_minutos_trabalhados,
    COUNT(CASE WHEN rp.status = 'aberto' THEN 1 END) AS pontos_abertos,
    MAX(rp.data) AS ultima_data_ponto
FROM public.funcionarios_ponto fp
LEFT JOIN public.registro_ponto rp ON rp.funcionario_id = fp.id
GROUP BY fp.id, fp.nome, fp.cargo, fp.ativo;

-- View: Ponto detalhado (para relatórios)
CREATE OR REPLACE VIEW public.ponto_detalhado AS
SELECT
    rp.id,
    rp.funcionario_id,
    fp.nome AS funcionario_nome,
    fp.cargo AS funcionario_cargo,
    rp.data,
    rp.hora_entrada,
    rp.hora_saida,
    rp.total_minutos,
    CONCAT(
        FLOOR(COALESCE(rp.total_minutos, 0) / 60)::TEXT, 'h ',
        (COALESCE(rp.total_minutos, 0) % 60)::TEXT, 'min'
    ) AS total_formatado,
    rp.status,
    rp.origem,
    rp.observacao,
    rp.created_at,
    rp.updated_by
FROM public.registro_ponto rp
JOIN public.funcionarios_ponto fp ON fp.id = rp.funcionario_id
ORDER BY rp.data DESC, rp.hora_entrada DESC;

-- =====================================================
-- 5. ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Habilitar RLS
ALTER TABLE public.funcionarios_ponto ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registro_ponto ENABLE ROW LEVEL SECURITY;

-- Políticas para funcionarios_ponto
-- Financeiro e Chefe podem ver todos
DROP POLICY IF EXISTS "Financeiro e Chefe podem ver funcionarios_ponto" ON public.funcionarios_ponto;
CREATE POLICY "Financeiro e Chefe podem ver funcionarios_ponto"
    ON public.funcionarios_ponto FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid()
            AND users.role IN ('financeiro', 'chefe')
        )
    );

-- Financeiro pode criar funcionarios
DROP POLICY IF EXISTS "Financeiro pode criar funcionarios_ponto" ON public.funcionarios_ponto;
CREATE POLICY "Financeiro pode criar funcionarios_ponto"
    ON public.funcionarios_ponto FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid()
            AND users.role = 'financeiro'
        )
    );

-- Financeiro pode editar funcionarios
DROP POLICY IF EXISTS "Financeiro pode editar funcionarios_ponto" ON public.funcionarios_ponto;
CREATE POLICY "Financeiro pode editar funcionarios_ponto"
    ON public.funcionarios_ponto FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid()
            AND users.role = 'financeiro'
        )
    );

-- Políticas para registro_ponto
-- Financeiro e Chefe podem ver todos os registros
DROP POLICY IF EXISTS "Financeiro e Chefe podem ver registro_ponto" ON public.registro_ponto;
CREATE POLICY "Financeiro e Chefe podem ver registro_ponto"
    ON public.registro_ponto FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid()
            AND users.role IN ('financeiro', 'chefe')
        )
    );

-- Financeiro pode criar registros (ajustes manuais)
DROP POLICY IF EXISTS "Financeiro pode criar registro_ponto" ON public.registro_ponto;
CREATE POLICY "Financeiro pode criar registro_ponto"
    ON public.registro_ponto FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid()
            AND users.role = 'financeiro'
        )
    );

-- Financeiro pode editar registros (ajustes)
DROP POLICY IF EXISTS "Financeiro pode editar registro_ponto" ON public.registro_ponto;
CREATE POLICY "Financeiro pode editar registro_ponto"
    ON public.registro_ponto FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid()
            AND users.role = 'financeiro'
        )
    );

-- =====================================================
-- 6. PERMISSÕES PÚBLICAS PARA FUNÇÕES (MOBILE)
-- =====================================================
-- As funções de bater ponto são SECURITY DEFINER, então
-- podem ser chamadas sem autenticação via token

GRANT EXECUTE ON FUNCTION buscar_funcionario_por_token(UUID) TO anon;
GRANT EXECUTE ON FUNCTION buscar_ponto_aberto(UUID) TO anon;
GRANT EXECUTE ON FUNCTION registrar_entrada(UUID) TO anon;
GRANT EXECUTE ON FUNCTION registrar_saida(UUID) TO anon;
GRANT EXECUTE ON FUNCTION bater_ponto(UUID) TO anon;

-- =====================================================
-- 7. COMENTÁRIOS
-- =====================================================

COMMENT ON TABLE public.funcionarios_ponto IS
'Funcionários que utilizam o ponto eletrônico. Separado de users para permitir funcionários sem acesso ao sistema.';

COMMENT ON TABLE public.registro_ponto IS
'Registros de entrada e saída do ponto eletrônico.';

COMMENT ON COLUMN public.funcionarios_ponto.ponto_token IS
'Token UUID único para acesso mobile sem login. Usado na URL: /ponto/{token}';

COMMENT ON COLUMN public.registro_ponto.total_minutos IS
'Total de minutos trabalhados, calculado automaticamente ao registrar saída.';

COMMENT ON FUNCTION bater_ponto(UUID) IS
'Função principal para bater ponto. Detecta automaticamente se é entrada ou saída.';

-- =====================================================
-- INSTRUÇÕES:
-- =====================================================
-- 1. Execute este script no Supabase SQL Editor
-- 2. Crie funcionários na aba Ponto Eletrônico do sistema desktop
-- 3. Copie o link gerado e envie para o funcionário
-- 4. Funcionário acessa o link no celular para bater ponto
-- =====================================================

SELECT 'Ponto Eletrônico configurado com sucesso!' AS resultado;
