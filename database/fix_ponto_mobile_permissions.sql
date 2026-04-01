-- =====================================================
-- FIX: Permissões para Ponto Mobile (acesso anônimo)
-- Execute este script no Supabase SQL Editor
-- =====================================================

-- Garantir que as funções existem e têm permissão para anon

-- 1. Verificar se a função existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'buscar_funcionario_por_token'
  ) THEN
    RAISE EXCEPTION 'Função buscar_funcionario_por_token não existe! Execute primeiro a migration_ponto_eletronico.sql';
  END IF;
END $$;

-- 2. Dar permissão de execução para anon (usuários não logados)
GRANT EXECUTE ON FUNCTION buscar_funcionario_por_token(UUID) TO anon;
GRANT EXECUTE ON FUNCTION buscar_ponto_aberto(UUID) TO anon;
GRANT EXECUTE ON FUNCTION registrar_entrada(UUID) TO anon;
GRANT EXECUTE ON FUNCTION registrar_saida(UUID) TO anon;
GRANT EXECUTE ON FUNCTION bater_ponto(UUID) TO anon;

-- 3. Dar permissão também para authenticated (caso precise)
GRANT EXECUTE ON FUNCTION buscar_funcionario_por_token(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION buscar_ponto_aberto(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION registrar_entrada(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION registrar_saida(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION bater_ponto(UUID) TO authenticated;

-- 4. Verificar se o funcionário Thiago existe
SELECT
  id,
  nome,
  ponto_token,
  ativo
FROM funcionarios_ponto
WHERE nome ILIKE '%thiago%' OR ponto_token = '34d00d7b-0f0b-48b7-85b8-d265e6375721'::uuid;

-- 5. Testar a função diretamente
SELECT * FROM buscar_funcionario_por_token('34d00d7b-0f0b-48b7-85b8-d265e6375721'::uuid);

SELECT 'Permissões configuradas! Teste o link novamente.' AS resultado;
