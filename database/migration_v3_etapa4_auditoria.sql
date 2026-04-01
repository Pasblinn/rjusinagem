-- =====================================================
-- MIGRATION V3 - ETAPA 4: AUDITORIA E SOFT DELETE
-- =====================================================
-- Problema: Não há rastreabilidade de quem alterou o quê
-- Solução: Adicionar campos de auditoria e soft delete
-- =====================================================

-- 1. ADICIONAR CAMPOS DE AUDITORIA EM ordens_producao
-- =====================================================

ALTER TABLE public.ordens_producao
ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES public.users(id);

ALTER TABLE public.ordens_producao
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE public.ordens_producao
ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES public.users(id);

-- 2. ADICIONAR CAMPOS DE AUDITORIA EM financeiro
-- =====================================================

ALTER TABLE public.financeiro
ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES public.users(id);

ALTER TABLE public.financeiro
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE public.financeiro
ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES public.users(id);

-- 3. ADICIONAR CAMPOS DE AUDITORIA EM orcamentos
-- =====================================================
-- updated_by já existe, adicionar deleted

ALTER TABLE public.orcamentos
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE public.orcamentos
ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES public.users(id);

-- 4. ADICIONAR CAMPOS EM users
-- =====================================================

ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT TRUE;

ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES public.users(id);

ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS last_login TIMESTAMPTZ;

-- Trigger para updated_at em users
DROP TRIGGER IF EXISTS update_users_updated_at ON public.users;

CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- 5. CRIAR TABELA DE LOG DE AUDITORIA
-- =====================================================

CREATE TABLE IF NOT EXISTS public.audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- O que foi alterado
    tabela TEXT NOT NULL,
    registro_id UUID NOT NULL,
    acao TEXT NOT NULL CHECK (acao IN ('INSERT', 'UPDATE', 'DELETE', 'SOFT_DELETE')),

    -- Dados da alteração
    dados_anteriores JSONB,
    dados_novos JSONB,
    campos_alterados TEXT[],

    -- Quem e quando
    usuario_id UUID REFERENCES public.users(id),
    usuario_email TEXT,
    ip_address TEXT,
    user_agent TEXT,

    -- Timestamp
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para o audit_log
CREATE INDEX IF NOT EXISTS idx_audit_tabela
ON public.audit_log(tabela);

CREATE INDEX IF NOT EXISTS idx_audit_registro
ON public.audit_log(registro_id);

CREATE INDEX IF NOT EXISTS idx_audit_usuario
ON public.audit_log(usuario_id);

CREATE INDEX IF NOT EXISTS idx_audit_acao
ON public.audit_log(acao);

CREATE INDEX IF NOT EXISTS idx_audit_created
ON public.audit_log(created_at);

-- 6. FUNÇÃO GENÉRICA PARA REGISTRAR AUDITORIA
-- =====================================================

CREATE OR REPLACE FUNCTION registrar_auditoria(
    p_tabela TEXT,
    p_registro_id UUID,
    p_acao TEXT,
    p_dados_anteriores JSONB DEFAULT NULL,
    p_dados_novos JSONB DEFAULT NULL,
    p_usuario_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_campos_alterados TEXT[];
    v_audit_id UUID;
    v_key TEXT;
BEGIN
    -- Calcular campos alterados
    IF p_dados_anteriores IS NOT NULL AND p_dados_novos IS NOT NULL THEN
        FOR v_key IN SELECT jsonb_object_keys(p_dados_novos)
        LOOP
            IF (p_dados_anteriores->v_key) IS DISTINCT FROM (p_dados_novos->v_key) THEN
                v_campos_alterados := array_append(v_campos_alterados, v_key);
            END IF;
        END LOOP;
    END IF;

    INSERT INTO public.audit_log (
        tabela,
        registro_id,
        acao,
        dados_anteriores,
        dados_novos,
        campos_alterados,
        usuario_id
    ) VALUES (
        p_tabela,
        p_registro_id,
        p_acao,
        p_dados_anteriores,
        p_dados_novos,
        v_campos_alterados,
        p_usuario_id
    )
    RETURNING id INTO v_audit_id;

    RETURN v_audit_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. TRIGGER PARA AUDITORIA AUTOMÁTICA EM ordens_producao
-- =====================================================

CREATE OR REPLACE FUNCTION audit_ordens_producao()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        PERFORM registrar_auditoria(
            'ordens_producao',
            NEW.id,
            'INSERT',
            NULL,
            to_jsonb(NEW),
            NEW.created_by
        );
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        -- Verificar se é soft delete
        IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
            PERFORM registrar_auditoria(
                'ordens_producao',
                NEW.id,
                'SOFT_DELETE',
                to_jsonb(OLD),
                to_jsonb(NEW),
                NEW.deleted_by
            );
        ELSE
            PERFORM registrar_auditoria(
                'ordens_producao',
                NEW.id,
                'UPDATE',
                to_jsonb(OLD),
                to_jsonb(NEW),
                NEW.updated_by
            );
        END IF;
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_audit_ordens_producao ON public.ordens_producao;

CREATE TRIGGER trigger_audit_ordens_producao
    AFTER INSERT OR UPDATE ON public.ordens_producao
    FOR EACH ROW
    EXECUTE FUNCTION audit_ordens_producao();

-- 8. TRIGGER PARA AUDITORIA AUTOMÁTICA EM financeiro
-- =====================================================

CREATE OR REPLACE FUNCTION audit_financeiro()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        PERFORM registrar_auditoria(
            'financeiro',
            NEW.id,
            'INSERT',
            NULL,
            to_jsonb(NEW),
            NULL
        );
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        PERFORM registrar_auditoria(
            'financeiro',
            NEW.id,
            'UPDATE',
            to_jsonb(OLD),
            to_jsonb(NEW),
            NEW.updated_by
        );
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_audit_financeiro ON public.financeiro;

CREATE TRIGGER trigger_audit_financeiro
    AFTER INSERT OR UPDATE ON public.financeiro
    FOR EACH ROW
    EXECUTE FUNCTION audit_financeiro();

-- 9. RLS PARA audit_log
-- =====================================================

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Apenas financeiro pode ver logs
CREATE POLICY "Apenas financeiro pode ver audit_log"
    ON public.audit_log FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid()
            AND role = 'financeiro'
        )
    );

-- Sistema pode inserir (via triggers)
CREATE POLICY "Sistema pode inserir audit_log"
    ON public.audit_log FOR INSERT
    WITH CHECK (true);

-- Ninguém pode editar ou deletar logs
-- Não criamos policies de UPDATE ou DELETE

-- 10. VIEW PARA CONSULTA DO AUDIT LOG
-- =====================================================

CREATE OR REPLACE VIEW public.audit_log_detalhado AS
SELECT
    al.id,
    al.tabela,
    al.registro_id,
    al.acao,
    al.campos_alterados,
    al.dados_anteriores,
    al.dados_novos,
    al.created_at,
    u.nome as usuario_nome,
    u.email as usuario_email,
    u.role as usuario_role
FROM public.audit_log al
LEFT JOIN public.users u ON u.id = al.usuario_id
ORDER BY al.created_at DESC;

-- 11. FUNÇÃO PARA SOFT DELETE
-- =====================================================

CREATE OR REPLACE FUNCTION soft_delete_op(
    p_op_id UUID,
    p_user_id UUID
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE public.ordens_producao
    SET
        deleted_at = NOW(),
        deleted_by = p_user_id
    WHERE id = p_op_id
    AND deleted_at IS NULL;

    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 12. ATUALIZAR VIEWS PARA EXCLUIR DELETADOS
-- =====================================================

-- View de OPs ativas (exclui soft deleted)
CREATE OR REPLACE VIEW public.ordens_producao_ativas AS
SELECT * FROM public.ordens_producao
WHERE deleted_at IS NULL;

-- 13. COMENTÁRIOS
-- =====================================================

COMMENT ON TABLE public.audit_log IS
'Log imutável de todas as alterações no sistema (auditoria)';

COMMENT ON COLUMN public.ordens_producao.deleted_at IS
'Data do soft delete. NULL = registro ativo';

COMMENT ON COLUMN public.ordens_producao.deleted_by IS
'Usuário que realizou o soft delete';

COMMENT ON COLUMN public.ordens_producao.updated_by IS
'Último usuário que alterou o registro';

COMMENT ON COLUMN public.users.active IS
'FALSE = usuário desativado (soft delete)';

-- =====================================================
-- INSTRUÇÕES:
-- =====================================================
-- 1. Execute este script no Supabase SQL Editor
-- 2. Todas as alterações em OPs e Financeiro serão logadas
-- 3. Use soft delete em vez de DELETE físico
-- 4. Consulte audit_log_detalhado para ver histórico
-- =====================================================
