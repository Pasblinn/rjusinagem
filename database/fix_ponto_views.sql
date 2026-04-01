-- =====================================================
-- FIX: Criar views do Ponto Eletrônico que estão faltando
-- Execute este script no Supabase SQL Editor
-- =====================================================

-- 1. View: Ponto detalhado (para listagem de registros)
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

-- 2. View: Resumo de ponto por funcionário
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

-- 3. Garantir acesso às views para authenticated
GRANT SELECT ON public.ponto_detalhado TO authenticated;
GRANT SELECT ON public.resumo_ponto_funcionario TO authenticated;

-- 4. RLS para as views (herdam das tabelas base, mas precisamos expor)
-- Views automaticamente herdam RLS das tabelas que consultam

-- 5. Criar função para excluir funcionário
CREATE OR REPLACE FUNCTION excluir_funcionario_ponto(p_funcionario_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    -- Primeiro exclui os registros de ponto do funcionário
    DELETE FROM public.registro_ponto WHERE funcionario_id = p_funcionario_id;

    -- Depois exclui o funcionário
    DELETE FROM public.funcionarios_ponto WHERE id = p_funcionario_id;

    RETURN TRUE;
EXCEPTION
    WHEN OTHERS THEN
        RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Permissão para executar a função
GRANT EXECUTE ON FUNCTION excluir_funcionario_ponto(UUID) TO authenticated;

SELECT 'Views e função de exclusão criadas com sucesso!' AS resultado;
