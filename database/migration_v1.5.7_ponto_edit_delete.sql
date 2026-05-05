-- =====================================================
-- MIGRATION v1.5.7: Edição/exclusão de registros de ponto
-- =====================================================
-- Data: 2026-05-05
-- Objetivo:
--   Permitir que o financeiro apague registros de ponto
--   (ajustes manuais incorretos, batidas duplicadas, etc).
--
-- Observação: as APIs `createRegistroPontoManual` e
-- `updateRegistroPonto` já existem no frontend e usam INSERT
-- e UPDATE diretos na tabela — políticas RLS já cobrem.
--
-- O que falta: política RLS de DELETE para financeiro.
-- =====================================================

DROP POLICY IF EXISTS "Financeiro pode deletar registro_ponto" ON public.registro_ponto;
CREATE POLICY "Financeiro pode deletar registro_ponto"
    ON public.registro_ponto FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid()
            AND users.role = 'financeiro'
        )
    );

SELECT 'Migration v1.5.7 aplicada: financeiro pode deletar registros de ponto' AS resultado;
