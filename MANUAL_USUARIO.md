# Manual do Usuário - RJ Usinagem

## Como Usar o Sistema

### Login

1. Abra a aplicação RJ Usinagem
2. Digite seu **e-mail** e **senha**
3. Clique em **Entrar**

Se esqueceu a senha, contate o administrador do sistema.

---

## Para Operadores

### Registrar Produção

1. Na tela inicial, clique na **OP** que você está trabalhando
2. Clique no botão **Registrar Produção**
3. Preencha:
   - **Data**: dia da produção
   - **Turno**: Manhã, Tarde ou Noite
   - **Quantidade Produzida**: quantas peças você produziu
   - **Peças Defeituosas**: quantas saíram com defeito
   - **Observações**: qualquer comentário (opcional)
4. Clique em **Registrar**

✅ Você verá uma mensagem verde "Produção registrada com sucesso!"

### Registrar Defeito

1. Na tela da OP, clique no botão **Registrar Defeito** (vermelho)
2. Preencha:
   - **Data**: quando aconteceu
   - **Quantidade**: quantas peças com defeito
   - **Tipo de Defeito**: o que aconteceu (ex: risco, trinca)
   - **Causa Provável**: por que aconteceu (ex: ferramenta gasta)
   - **Ação Corretiva**: o que foi feito (ex: trocou ferramenta)
3. Clique em **Registrar Defeito**

---

## Para Chefes / Encarregados

### Criar Nova OP

1. Na tela inicial, clique em **Nova OP**
2. Preencha as informações:

**Informações Básicas:**
- **Tipo de OP**: Encomenda ou Estoque
- **Data de Início**: quando começa
- **Data de Término**: quando termina (opcional)

**Preparação da Máquina:** ⚠️ OBRIGATÓRIO
- Descreva toda a preparação necessária

**Material:**
- Preencha os dados do material (opcional)

**Cliente e Peça:**
- Nome do cliente
- Nome da peça
- Quantidade total
- Preço do serviço

**Produção:**
- Máquina utilizada
- Operador responsável

3. Clique em **Salvar OP**

### Editar OP

1. Clique na OP que deseja editar
2. Clique no botão **Editar**
3. Faça as alterações necessárias
4. Clique em **Salvar OP**

⚠️ **IMPORTANTE:** Após a OP ser aprovada, você não poderá mais editar dados do cliente e valores!

### Aprovar OP

1. Abra a OP
2. Clique no botão verde **Aprovar**
3. Digite seu **nome** como supervisor
4. Clique em **Aprovar OP**

✅ Após aprovação:
- A OP fica travada para edição de dados importantes
- A produção ainda pode ser registrada normalmente

### Buscar OPs

Na tela inicial:
- Use a **barra de busca** para procurar por código ou cliente
- Use o **filtro de status** para ver apenas OPs específicas

---

## Para Financeiro (Elizangela)

### Criar Orçamento

1. Clique na aba **Financeiro**
2. Clique em **Novo Orçamento**
3. Preencha:
   - Cliente
   - Nome da peça
   - Quantidade
   - Valor estimado
   - Observações (opcional)
4. Clique em **Criar Orçamento**

### Controlar Pagamentos

1. Na aba **Financeiro**, veja todas as OPs
2. **CORES IMPORTANTES:**
   - 🟢 **VERDE** = Pago
   - 🔴 **VERMELHO** = Não Pago
3. Clique em uma OP para editar dados financeiros

### Editar Dados Financeiros

1. Clique na OP desejada
2. Clique em **Editar** (botão com cifrão)
3. Preencha:
   - **Valor Total**: valor final do serviço
   - **Forma de Pagamento**: PIX, Boleto, etc.
   - **Status do Pagamento**: Pago ou Não Pago
   - **Custos Extras**: custos adicionais que não estavam previstos
   - **Prejuízo por Defeitos**: quanto foi perdido com peças defeituosas
   - **Observações**: anotações (opcional)
4. Veja o **Lucro Final** calculado automaticamente
5. Clique em **Salvar Dados Financeiros**

### Emitir Nota Fiscal

1. Na aba **Financeiro**, clique em **Emitir Nota Fiscal**
2. Isso abrirá o site da Prefeitura de Ponta Grossa
3. Preencha a nota fiscal no site da prefeitura

---

## Entendendo os Status da OP

- **Criada**: OP foi criada mas produção não começou
- **Em Produção**: produção em andamento
- **Finalizada**: produção concluída
- **Faturada**: valor foi faturado para o cliente
- **Nota Emitida**: nota fiscal foi emitida
- **Paga**: cliente pagou

---

## Dicas de Uso

### Todos os Usuários

✅ **Sempre veja a mensagem de confirmação** (verde = sucesso, vermelho = erro)

✅ **Não feche a aplicação durante salvamento** (aguarde a confirmação)

✅ **Use a busca** para encontrar OPs rapidamente

✅ **Clique em Voltar** para retornar à tela anterior

### Chefes

✅ **Preencha a Preparação da Máquina** - este campo é obrigatório e muito importante

✅ **Aprove a OP** quando tiver certeza dos dados do cliente e valor

✅ **Após aprovação**, você não pode mais mudar cliente e valor (segurança)

### Operadores

✅ **Registre a produção todo dia** - não deixe acumular

✅ **Sempre registre defeitos** - isso ajuda a melhorar o processo

✅ **Seja claro nas observações** - outros precisam entender o que aconteceu

### Financeiro

✅ **Atualize o status de pagamento** assim que receber

✅ **Registre custos extras** - isso mostra o lucro real

✅ **Monitore as OPs em vermelho** - são as que ainda não foram pagas

---

## Resolvendo Problemas Comuns

### Não consigo fazer login
- Verifique se digitou o e-mail corretamente
- Verifique se a senha está correta
- Contate o administrador

### Não vejo o botão "Nova OP"
- Você precisa ser Chefe ou Financeiro para criar OPs

### Não vejo a aba "Financeiro"
- Esta aba só aparece para o usuário Financeiro (Elizangela)

### Erro ao salvar
- Verifique se preencheu todos os campos obrigatórios (marcados com *)
- Verifique se tem internet
- Tente novamente

### Não consigo editar a OP
- Se a OP foi aprovada, dados do cliente e valor estão bloqueados (segurança)
- Apenas produção pode ser registrada após aprovação

---

## Contato

Para problemas técnicos ou dúvidas, contate o administrador do sistema.
