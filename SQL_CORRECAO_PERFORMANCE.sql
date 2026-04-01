-- ╔══════════════════════════════════════════════════════════════════╗
-- ║  SQL DE CORREÇÃO DE PERFORMANCE E SEGURANÇA                    ║
-- ║  Projeto: RJ Usinagem                                          ║
-- ║  Data: 2026-03-03                                               ║
-- ║                                                                  ║
-- ║  INSTRUÇÕES:                                                     ║
-- ║  Execute cada seção separadamente no Supabase SQL Editor.       ║
-- ║  Nenhum dado existente será apagado ou alterado.                ║
-- ╚══════════════════════════════════════════════════════════════════╝

-- ═══════════════════════════════════════════════════════════════════
-- PARTE 1: ÍNDICES PARA FOREIGN KEYS (20 índices faltantes)
-- Totalmente seguro: CREATE INDEX IF NOT EXISTS
-- Impacto: Melhora JOINs, DELETEs cascata e queries com filtro FK
-- ═══════════════════════════════════════════════════════════════════

-- clientes
CREATE INDEX IF NOT EXISTS idx_clientes_created_by ON clientes(created_by);
CREATE INDEX IF NOT EXISTS idx_clientes_updated_by ON clientes(updated_by);

-- contas_pagar
CREATE INDEX IF NOT EXISTS idx_contas_pagar_op_id ON contas_pagar(op_id);

-- contas_receber_avulsas
CREATE INDEX IF NOT EXISTS idx_contas_receber_avulsas_op_id ON contas_receber_avulsas(op_id);

-- financeiro
CREATE INDEX IF NOT EXISTS idx_financeiro_updated_by ON financeiro(updated_by);
CREATE INDEX IF NOT EXISTS idx_financeiro_deleted_by ON financeiro(deleted_by);

-- financeiro_movimentos
CREATE INDEX IF NOT EXISTS idx_fin_mov_created_by ON financeiro_movimentos(created_by);

-- funcionarios_ponto
CREATE INDEX IF NOT EXISTS idx_funcionarios_ponto_created_by ON funcionarios_ponto(created_by);

-- historico_financeiro
CREATE INDEX IF NOT EXISTS idx_historico_usuario ON historico_financeiro(usuario_id);

-- orcamentos
CREATE INDEX IF NOT EXISTS idx_orc_convertido_op_id ON orcamentos(convertido_op_id);
CREATE INDEX IF NOT EXISTS idx_orc_created_by ON orcamentos(created_by);
CREATE INDEX IF NOT EXISTS idx_orc_updated_by ON orcamentos(updated_by);
CREATE INDEX IF NOT EXISTS idx_orc_deleted_by ON orcamentos(deleted_by);

-- ordens_producao
CREATE INDEX IF NOT EXISTS idx_op_created_by ON ordens_producao(created_by);
CREATE INDEX IF NOT EXISTS idx_op_updated_by ON ordens_producao(updated_by);
CREATE INDEX IF NOT EXISTS idx_op_deleted_by ON ordens_producao(deleted_by);

-- pecas_defeituosas (IMPORTANTE - usado em queries frequentes)
CREATE INDEX IF NOT EXISTS idx_pecas_defeituosas_op_id ON pecas_defeituosas(op_id);

-- producao_diaria
CREATE INDEX IF NOT EXISTS idx_producao_operador_id ON producao_diaria(operador_id);

-- registro_ponto
CREATE INDEX IF NOT EXISTS idx_registro_ponto_updated_by ON registro_ponto(updated_by);

-- users
CREATE INDEX IF NOT EXISTS idx_users_updated_by ON users(updated_by);


-- ═══════════════════════════════════════════════════════════════════
-- PARTE 2: CORRIGIR POLICIES COM InitPlan (SELECT auth.uid())
-- O padrão (SELECT auth.uid() AS uid) cria subquery desnecessária.
-- Supabase recomenda usar auth.uid() diretamente.
--
-- ⚠️ Precisa DROP + CREATE para cada policy (não tem ALTER POLICY para
-- mudar a expressão). A troca é atômica - não há janela sem policy.
-- ═══════════════════════════════════════════════════════════════════

-- ─── financeiro (4 policies com InitPlan) ───
DROP POLICY IF EXISTS "Authenticated users can view financeiro" ON financeiro;
CREATE POLICY "Authenticated users can view financeiro" ON financeiro
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can insert financeiro" ON financeiro;
CREATE POLICY "Authenticated users can insert financeiro" ON financeiro
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can update financeiro" ON financeiro;
CREATE POLICY "Authenticated users can update financeiro" ON financeiro
  FOR UPDATE USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can delete financeiro" ON financeiro;
CREATE POLICY "Authenticated users can delete financeiro" ON financeiro
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- ─── ordens_producao (4 policies com InitPlan) ───
DROP POLICY IF EXISTS "Authenticated users can view OPs" ON ordens_producao;
CREATE POLICY "Authenticated users can view OPs" ON ordens_producao
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can insert OPs" ON ordens_producao;
CREATE POLICY "Authenticated users can insert OPs" ON ordens_producao
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can update OPs" ON ordens_producao;
CREATE POLICY "Authenticated users can update OPs" ON ordens_producao
  FOR UPDATE USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can delete OPs" ON ordens_producao;
CREATE POLICY "Authenticated users can delete OPs" ON ordens_producao
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- ─── producao_diaria (4 policies com InitPlan) ───
DROP POLICY IF EXISTS "Authenticated users can view producao" ON producao_diaria;
CREATE POLICY "Authenticated users can view producao" ON producao_diaria
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can insert producao" ON producao_diaria;
CREATE POLICY "Authenticated users can insert producao" ON producao_diaria
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can update producao" ON producao_diaria;
CREATE POLICY "Authenticated users can update producao" ON producao_diaria
  FOR UPDATE USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can delete producao" ON producao_diaria;
CREATE POLICY "Authenticated users can delete producao" ON producao_diaria
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- ─── users (2 policies com InitPlan) ───
DROP POLICY IF EXISTS "Users can view all users" ON users;
CREATE POLICY "Users can view all users" ON users
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can update own profile" ON users;
CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (auth.uid() = id);


-- ═══════════════════════════════════════════════════════════════════
-- PARTE 3: REMOVER POLICIES DUPLICADAS em pecas_defeituosas
-- Existem 2 conjuntos idênticos (8 policies, deveria ser 4).
-- Um usa "(SELECT auth.uid())" e outro usa "auth.uid()".
-- Vamos remover os que usam InitPlan (padrão lento).
-- ═══════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Authenticated users can view pecas" ON pecas_defeituosas;
DROP POLICY IF EXISTS "Authenticated users can insert pecas" ON pecas_defeituosas;
DROP POLICY IF EXISTS "Authenticated users can update pecas" ON pecas_defeituosas;
DROP POLICY IF EXISTS "Authenticated users can delete pecas" ON pecas_defeituosas;
-- As 4 policies restantes ("...pecas_defeituosas") já usam auth.uid() correto.


-- ═══════════════════════════════════════════════════════════════════
-- PARTE 4: ADICIONAR AUTH CHECK em policies "true" (segurança)
-- contas_receber_avulsas, orcamentos e orcamento_itens aceitam
-- qualquer request sem verificar autenticação.
-- ═══════════════════════════════════════════════════════════════════

-- ─── contas_receber_avulsas (trocar "true" por auth check) ───
DROP POLICY IF EXISTS "All auth on contas_receber_avulsas" ON contas_receber_avulsas;
CREATE POLICY "Authenticated full access contas_receber_avulsas" ON contas_receber_avulsas
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ─── orcamentos (trocar "true" por auth check) ───
DROP POLICY IF EXISTS "Authenticated users can view orcamentos" ON orcamentos;
CREATE POLICY "Authenticated users can view orcamentos" ON orcamentos
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can create orcamentos" ON orcamentos;
CREATE POLICY "Authenticated users can create orcamentos" ON orcamentos
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can update orcamentos" ON orcamentos;
CREATE POLICY "Authenticated users can update orcamentos" ON orcamentos
  FOR UPDATE USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can delete orcamentos" ON orcamentos;
CREATE POLICY "Authenticated users can delete orcamentos" ON orcamentos
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- ─── orcamento_itens (trocar "true" por auth check) ───
DROP POLICY IF EXISTS "Authenticated users can view orcamento_itens" ON orcamento_itens;
CREATE POLICY "Authenticated users can view orcamento_itens" ON orcamento_itens
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can insert orcamento_itens" ON orcamento_itens;
CREATE POLICY "Authenticated users can insert orcamento_itens" ON orcamento_itens
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can update orcamento_itens" ON orcamento_itens;
CREATE POLICY "Authenticated users can update orcamento_itens" ON orcamento_itens
  FOR UPDATE USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can delete orcamento_itens" ON orcamento_itens;
CREATE POLICY "Authenticated users can delete orcamento_itens" ON orcamento_itens
  FOR DELETE USING (auth.uid() IS NOT NULL);


-- ═══════════════════════════════════════════════════════════════════
-- PARTE 5: CONFLITO em audit_log INSERT
-- Existem 2 INSERT policies: uma com CHECK true e outra com false.
-- A "true" anula a "false", mas gera warning. Remover a conflitante.
-- ═══════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "prevent_direct_insert_audit_log" ON audit_log;


-- ═══════════════════════════════════════════════════════════════════
-- PARTE 6: POLICY REDUNDANTE em ordens_producao UPDATE
-- Há 2 policies UPDATE permissivas. A geral ("Authenticated users can
-- update OPs") permite tudo, tornando a específica ("Financeiro e Chefe
-- podem editar OPs não aprovadas") redundante. Removemos a redundante.
-- ═══════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Financeiro e Chefe podem editar OPs não aprovadas" ON ordens_producao;


-- ═══════════════════════════════════════════════════════════════════
-- FIM - RESUMO
-- ═══════════════════════════════════════════════════════════════════
-- Parte 1: +20 índices (FK sem índice → performance em JOINs/DELETEs)
-- Parte 2: 14 policies corrigidas (InitPlan → auth.uid() direto)
-- Parte 3: 4 policies duplicadas removidas (pecas_defeituosas)
-- Parte 4: 10 policies com segurança adicionada (true → auth check)
-- Parte 5: 1 policy conflitante removida (audit_log)
-- Parte 6: 1 policy redundante removida (ordens_producao)
-- Total corrigido: ~50 problemas
-- Nenhum dado foi alterado ou excluído.
