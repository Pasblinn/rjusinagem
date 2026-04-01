# Sistema de Ponto Eletrônico

Documentação completa do sistema de controle de ponto eletrônico para funcionários.

## Sumário

1. [Visão Geral](#visão-geral)
2. [Arquitetura](#arquitetura)
3. [Estrutura de Arquivos](#estrutura-de-arquivos)
4. [Banco de Dados](#banco-de-dados)
5. [API e Funções](#api-e-funções)
6. [Frontend Desktop](#frontend-desktop)
7. [Frontend Mobile](#frontend-mobile)
8. [Segurança (RLS)](#segurança-rls)
9. [Fluxo de Uso](#fluxo-de-uso)
10. [Como Replicar](#como-replicar)

---

## Visão Geral

Sistema de ponto eletrônico com duas interfaces:
- **Desktop**: Gerenciamento de funcionários, visualização de registros e relatórios (acesso autenticado)
- **Mobile**: Interface simplificada para funcionários baterem ponto via link único (sem login)

### Características Principais
- Acesso mobile via token UUID (link compartilhável)
- Detecção automática de entrada/saída
- Cálculo automático de horas trabalhadas
- Relatórios por período
- Ajustes manuais pelo financeiro
- Row Level Security (RLS) no Supabase

---

## Arquitetura

```
┌─────────────────────────────────────────────────────────────────┐
│                         SUPABASE                                │
│  ┌─────────────────────┐  ┌──────────────────────────────────┐ │
│  │  funcionarios_ponto │  │         registro_ponto           │ │
│  │  - id               │  │  - id                            │ │
│  │  - nome             │  │  - funcionario_id                │ │
│  │  - cargo            │  │  - data                          │ │
│  │  - ponto_token      │◄─┤  - hora_entrada / hora_saida     │ │
│  │  - ativo            │  │  - total_minutos                 │ │
│  └─────────────────────┘  │  - status (aberto/fechado/ajust) │ │
│                           └──────────────────────────────────┘ │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    RPC Functions                          │  │
│  │  - bater_ponto(token)                                     │  │
│  │  - buscar_funcionario_por_token(token)                    │  │
│  │  - buscar_ponto_aberto(funcionario_id)                    │  │
│  │  - registrar_entrada(token)                               │  │
│  │  - registrar_saida(token)                                 │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
          ┌───────────────────┴───────────────────┐
          ▼                                       ▼
┌─────────────────────┐               ┌─────────────────────┐
│   DESKTOP (React)   │               │   MOBILE (React)    │
│   - PontoTab.tsx    │               │   - PontoMobile.tsx │
│   - Autenticado     │               │   - Via Token       │
│   - Gerenciamento   │               │   - Bater Ponto     │
└─────────────────────┘               └─────────────────────┘
```

---

## Estrutura de Arquivos

```
projeto/
├── database/
│   └── migration_ponto_eletronico.sql    # Schema completo do banco
│
├── src/
│   ├── components/
│   │   └── PontoTab.tsx                  # Componente desktop (855 linhas)
│   │
│   ├── pages/
│   │   └── PontoMobile.tsx               # Página mobile no app principal
│   │
│   ├── services/
│   │   └── api.ts                        # Funções de API (linhas 1100-1531)
│   │
│   └── types/
│       └── index.ts                      # Interfaces TypeScript (linhas 300-357)
│
└── ponto-mobile/                         # App mobile separado (deploy Vercel)
    └── src/
        ├── pages/
        │   └── PontoMobile.tsx           # Interface mobile
        ├── services/
        │   └── api.ts                    # API simplificada
        └── lib/
            └── supabase.ts               # Cliente Supabase
```

---

## Banco de Dados

### Tabela: `funcionarios_ponto`

Cadastro de funcionários que utilizam o ponto eletrônico.

```sql
CREATE TABLE public.funcionarios_ponto (
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
CREATE INDEX idx_funcionarios_ponto_token ON public.funcionarios_ponto(ponto_token);
CREATE INDEX idx_funcionarios_ponto_ativo ON public.funcionarios_ponto(ativo);
CREATE INDEX idx_funcionarios_ponto_user_id ON public.funcionarios_ponto(user_id);
```

### Tabela: `registro_ponto`

Registros de entrada e saída.

```sql
CREATE TABLE public.registro_ponto (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Funcionário
    funcionario_id UUID NOT NULL REFERENCES public.funcionarios_ponto(id) ON DELETE CASCADE,

    -- Data e horários
    data DATE NOT NULL DEFAULT CURRENT_DATE,
    hora_entrada TIMESTAMPTZ,
    hora_saida TIMESTAMPTZ,

    -- Cálculo automático (armazenado em minutos)
    total_minutos INTEGER,

    -- Status: 'aberto' | 'fechado' | 'ajustado'
    status TEXT NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto', 'fechado', 'ajustado')),

    -- Origem: 'mobile' | 'desktop' | 'ajuste'
    origem TEXT DEFAULT 'mobile' CHECK (origem IN ('mobile', 'desktop', 'ajuste')),

    -- Observações (para ajustes manuais)
    observacao TEXT,

    -- Metadados
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID REFERENCES public.users(id)
);

-- Índices
CREATE INDEX idx_registro_ponto_funcionario ON public.registro_ponto(funcionario_id);
CREATE INDEX idx_registro_ponto_data ON public.registro_ponto(data DESC);
CREATE INDEX idx_registro_ponto_status ON public.registro_ponto(status);
CREATE INDEX idx_registro_ponto_funcionario_data ON public.registro_ponto(funcionario_id, data);

-- IMPORTANTE: Apenas um ponto aberto por funcionário
CREATE UNIQUE INDEX idx_unique_ponto_aberto ON public.registro_ponto(funcionario_id) WHERE status = 'aberto';
```

### View: `resumo_ponto_funcionario`

Resumo agregado por funcionário.

```sql
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
```

### View: `ponto_detalhado`

Registros com dados formatados para relatórios.

```sql
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
```

### Funções RPC (Stored Procedures)

#### `bater_ponto(token)` - Função Principal

Detecta automaticamente se é entrada ou saída.

```sql
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
    WHERE fp.ponto_token = p_token AND fp.ativo = TRUE;

    IF v_funcionario_id IS NULL THEN
        RETURN QUERY SELECT FALSE, 'erro'::TEXT,
            'Token inválido ou funcionário inativo'::TEXT,
            NULL::UUID, NULL::TIMESTAMPTZ, NULL::TEXT;
        RETURN;
    END IF;

    -- Verificar se tem ponto aberto
    SELECT rp.id INTO v_ponto_aberto
    FROM public.registro_ponto rp
    WHERE rp.funcionario_id = v_funcionario_id AND rp.status = 'aberto';

    -- Se tem ponto aberto, registra saída; senão, registra entrada
    IF v_ponto_aberto IS NOT NULL THEN
        SELECT * INTO v_resultado FROM registrar_saida(p_token);
        RETURN QUERY SELECT v_resultado.sucesso, 'saida'::TEXT,
            v_resultado.mensagem, v_resultado.registro_id,
            v_resultado.hora, v_resultado.total_horas;
    ELSE
        SELECT * INTO v_resultado FROM registrar_entrada(p_token);
        RETURN QUERY SELECT v_resultado.sucesso, 'entrada'::TEXT,
            v_resultado.mensagem, v_resultado.registro_id,
            v_resultado.hora, NULL::TEXT;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

#### `registrar_entrada(token)`

```sql
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
    FROM public.funcionarios_ponto fp WHERE fp.ponto_token = p_token;

    -- Validações
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
    WHERE rp.funcionario_id = v_funcionario_id AND rp.status = 'aberto';

    IF v_ponto_aberto IS NOT NULL THEN
        RETURN QUERY SELECT FALSE,
            'Já existe um ponto aberto. Registre a saída primeiro.'::TEXT,
            v_ponto_aberto, NULL::TIMESTAMPTZ;
        RETURN;
    END IF;

    -- Registrar entrada
    v_hora_entrada := NOW();
    INSERT INTO public.registro_ponto (funcionario_id, data, hora_entrada, status, origem)
    VALUES (v_funcionario_id, CURRENT_DATE, v_hora_entrada, 'aberto', 'mobile')
    RETURNING id INTO v_novo_registro_id;

    RETURN QUERY SELECT TRUE, 'Entrada registrada com sucesso'::TEXT,
        v_novo_registro_id, v_hora_entrada;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

#### `registrar_saida(token)`

```sql
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
    FROM public.funcionarios_ponto fp WHERE fp.ponto_token = p_token;

    -- Validações
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
    WHERE rp.funcionario_id = v_funcionario_id AND rp.status = 'aberto';

    IF v_ponto_aberto.id IS NULL THEN
        RETURN QUERY SELECT FALSE,
            'Não há ponto aberto. Registre a entrada primeiro.'::TEXT,
            NULL::UUID, NULL::TIMESTAMPTZ, NULL::TEXT;
        RETURN;
    END IF;

    -- Registrar saída e calcular total
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

    RETURN QUERY SELECT TRUE, 'Saída registrada com sucesso'::TEXT,
        v_ponto_aberto.id, v_hora_saida, v_total_horas_formatado;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

#### `buscar_funcionario_por_token(token)`

```sql
CREATE OR REPLACE FUNCTION buscar_funcionario_por_token(p_token UUID)
RETURNS TABLE (
    id UUID,
    nome TEXT,
    cargo TEXT,
    ativo BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT fp.id, fp.nome, fp.cargo, fp.ativo
    FROM public.funcionarios_ponto fp
    WHERE fp.ponto_token = p_token AND fp.ativo = TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

#### `buscar_ponto_aberto(funcionario_id)`

```sql
CREATE OR REPLACE FUNCTION buscar_ponto_aberto(p_funcionario_id UUID)
RETURNS TABLE (
    id UUID,
    data DATE,
    hora_entrada TIMESTAMPTZ,
    status TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT rp.id, rp.data, rp.hora_entrada, rp.status
    FROM public.registro_ponto rp
    WHERE rp.funcionario_id = p_funcionario_id AND rp.status = 'aberto'
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## API e Funções

### Interfaces TypeScript

```typescript
// src/types/index.ts

export type PontoStatus = 'aberto' | 'fechado' | 'ajustado'
export type PontoOrigem = 'mobile' | 'desktop' | 'ajuste'

export interface FuncionarioPonto {
  id: string
  user_id: string | null
  nome: string
  cargo: string | null
  ponto_token: string
  ativo: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface RegistroPonto {
  id: string
  funcionario_id: string
  data: string
  hora_entrada: string | null
  hora_saida: string | null
  total_minutos: number | null
  status: PontoStatus
  origem: PontoOrigem
  observacao: string | null
  created_at: string
  updated_at: string
  updated_by: string | null
}

export interface PontoDetalhado extends RegistroPonto {
  funcionario_nome: string
  funcionario_cargo: string | null
  total_formatado: string
}

export interface ResumoPontoFuncionario {
  funcionario_id: string
  nome: string
  cargo: string | null
  ativo: boolean
  total_registros: number
  total_minutos_trabalhados: number
  pontos_abertos: number
  ultima_data_ponto: string | null
}

export interface ResultadoBaterPonto {
  sucesso: boolean
  tipo: 'entrada' | 'saida' | 'erro'
  mensagem: string
  registro_id: string | null
  hora: string | null
  total_horas: string | null
}
```

### Funções de API (Desktop)

```typescript
// src/services/api.ts

// --- Funções para MOBILE (públicas, via token) ---

// Buscar funcionário pelo token
async buscarFuncionarioPorToken(token: string): Promise<{
  id: string
  nome: string
  cargo: string | null
  ativo: boolean
} | null> {
  const { data, error } = await supabase
    .rpc('buscar_funcionario_por_token', { p_token: token })
  if (error || !data || data.length === 0) return null
  return data[0]
}

// Buscar ponto aberto do funcionário
async buscarPontoAberto(funcionarioId: string): Promise<{
  id: string
  data: string
  hora_entrada: string
  status: string
} | null> {
  const { data, error } = await supabase
    .rpc('buscar_ponto_aberto', { p_funcionario_id: funcionarioId })
  if (error || !data || data.length === 0) return null
  return data[0]
}

// Bater ponto (entrada ou saída automática)
async baterPonto(token: string): Promise<ResultadoBaterPonto> {
  const { data, error } = await supabase
    .rpc('bater_ponto', { p_token: token })
  if (error) {
    return {
      sucesso: false,
      tipo: 'erro',
      mensagem: error.message || 'Erro ao bater ponto',
      registro_id: null,
      hora: null,
      total_horas: null,
    }
  }
  return data[0]
}

// --- Funções para DESKTOP (autenticadas) ---

// Listar funcionários do ponto
async listFuncionariosPonto(filtros?: {
  ativo?: boolean
  busca?: string
}): Promise<FuncionarioPonto[]> {
  let query = supabase
    .from('funcionarios_ponto')
    .select('*')
    .order('nome')

  if (filtros?.ativo !== undefined) {
    query = query.eq('ativo', filtros.ativo)
  }
  if (filtros?.busca) {
    query = query.or(`nome.ilike.%${filtros.busca}%,cargo.ilike.%${filtros.busca}%`)
  }

  const { data, error } = await query
  if (error) return []
  return data || []
}

// Criar funcionário
async createFuncionarioPonto(funcionario: {
  nome: string
  cargo?: string
  user_id?: string
}, userId?: string): Promise<FuncionarioPonto> {
  const { data, error } = await supabase
    .from('funcionarios_ponto')
    .insert([{ ...funcionario, created_by: userId }])
    .select()
    .single()
  if (error) throw error
  return data
}

// Atualizar funcionário
async updateFuncionarioPonto(id: string, updates: {
  nome?: string
  cargo?: string
  ativo?: boolean
}): Promise<FuncionarioPonto> {
  const { data, error } = await supabase
    .from('funcionarios_ponto')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

// Gerar novo token
async regenerarTokenPonto(id: string): Promise<string> {
  const novoToken = crypto.randomUUID()
  const { error } = await supabase
    .from('funcionarios_ponto')
    .update({ ponto_token: novoToken })
    .eq('id', id)
  if (error) throw error
  return novoToken
}

// Listar registros de ponto (usa view ponto_detalhado)
async listRegistrosPonto(filtros?: {
  funcionarioId?: string
  dataInicio?: string
  dataFim?: string
  status?: string
}): Promise<PontoDetalhado[]> {
  let query = supabase
    .from('ponto_detalhado')
    .select('*')
    .order('data', { ascending: false })
    .order('hora_entrada', { ascending: false })

  if (filtros?.funcionarioId) query = query.eq('funcionario_id', filtros.funcionarioId)
  if (filtros?.dataInicio) query = query.gte('data', filtros.dataInicio)
  if (filtros?.dataFim) query = query.lte('data', filtros.dataFim)
  if (filtros?.status) query = query.eq('status', filtros.status)

  const { data, error } = await query
  if (error) return []
  return data || []
}

// Relatório de horas por período (agrupado por funcionário)
async getRelatorioHorasPorPeriodo(filtros: {
  dataInicio: string
  dataFim: string
  funcionarioId?: string
}): Promise<Array<{
  funcionario_id: string
  funcionario_nome: string
  total_dias: number
  total_minutos: number
  total_horas_formatado: string
}>> {
  let query = supabase
    .from('ponto_detalhado')
    .select('*')
    .gte('data', filtros.dataInicio)
    .lte('data', filtros.dataFim)
    .eq('status', 'fechado')  // Só conta registros fechados

  if (filtros.funcionarioId) {
    query = query.eq('funcionario_id', filtros.funcionarioId)
  }

  const { data, error } = await query
  if (error) return []

  // Agrupar por funcionário
  const agrupado: Record<string, any> = {}
  for (const reg of data || []) {
    if (!agrupado[reg.funcionario_id]) {
      agrupado[reg.funcionario_id] = {
        funcionario_id: reg.funcionario_id,
        funcionario_nome: reg.funcionario_nome,
        registros: [],
      }
    }
    agrupado[reg.funcionario_id].registros.push(reg)
  }

  // Calcular totais
  return Object.values(agrupado).map(func => {
    const totalMinutos = func.registros.reduce((acc: number, r: any) =>
      acc + (r.total_minutos || 0), 0)
    const diasUnicos = new Set(func.registros.map((r: any) => r.data)).size
    const horas = Math.floor(totalMinutos / 60)
    const minutos = totalMinutos % 60

    return {
      ...func,
      total_dias: diasUnicos,
      total_minutos: totalMinutos,
      total_horas_formatado: `${horas}h ${minutos}min`,
    }
  })
}

// Criar registro manual (ajuste)
async createRegistroPontoManual(registro: {
  funcionario_id: string
  data: string
  hora_entrada: string
  hora_saida?: string
  observacao?: string
}, userId?: string): Promise<RegistroPonto> {
  let totalMinutos = null
  if (registro.hora_saida && registro.hora_entrada) {
    const entrada = new Date(registro.hora_entrada)
    const saida = new Date(registro.hora_saida)
    totalMinutos = Math.round((saida.getTime() - entrada.getTime()) / 60000)
  }

  const { data, error } = await supabase
    .from('registro_ponto')
    .insert([{
      funcionario_id: registro.funcionario_id,
      data: registro.data,
      hora_entrada: registro.hora_entrada,
      hora_saida: registro.hora_saida || null,
      total_minutos: totalMinutos,
      status: registro.hora_saida ? 'fechado' : 'aberto',
      origem: 'ajuste',
      observacao: registro.observacao || 'Registro manual',
      updated_by: userId,
    }])
    .select()
    .single()
  if (error) throw error
  return data
}
```

---

## Frontend Desktop

### Componente `PontoTab.tsx`

Componente com 3 sub-abas: Funcionários, Registros e Resumo.

```typescript
// src/components/PontoTab.tsx

interface PontoTabProps {
  userId?: string  // ID do usuário logado (para auditoria)
}

export function PontoTab({ userId }: PontoTabProps) {
  const [subTab, setSubTab] = useState<'funcionarios' | 'registros' | 'resumo'>('funcionarios')
  // ... estados e lógica
}
```

#### Sub-aba: Funcionários

- Grid de cards (3 colunas)
- Busca em tempo real
- Ações: Copiar Link, Editar, Excluir
- Modal para criar novo funcionário
- Checkbox "Mostrar inativos"

#### Sub-aba: Registros

- Tabela com filtros (funcionário, data início, data fim)
- Colunas: Funcionário, Data, Entrada, Saída, Total, Status, Origem
- Status com badges coloridos

#### Sub-aba: Resumo

- Filtro de período (Hoje, Semana, Mês, Personalizado)
- Relatório de horas em tabela
- Histórico geral em cards

### Funções Auxiliares

```typescript
const formatDate = (date: string | null) => {
  if (!date) return '-'
  return new Date(date).toLocaleDateString('pt-BR')
}

const formatTime = (datetime: string | null) => {
  if (!datetime) return '-'
  return new Date(datetime).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

const formatMinutesToHours = (minutes: number | null) => {
  if (!minutes) return '0h 0min'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${h}h ${m}min`
}
```

---

## Frontend Mobile

### Página `PontoMobile.tsx`

Interface simplificada para funcionários baterem ponto via celular.

```typescript
// src/pages/PontoMobile.tsx ou ponto-mobile/src/pages/PontoMobile.tsx

export function PontoMobile() {
  const { token } = useParams<{ token: string }>()

  const [loading, setLoading] = useState(true)
  const [processando, setProcessando] = useState(false)
  const [funcionario, setFuncionario] = useState<{...} | null>(null)
  const [pontoAberto, setPontoAberto] = useState<{...} | null>(null)
  const [resultado, setResultado] = useState<ResultadoBaterPonto | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [horaAtual, setHoraAtual] = useState(new Date())

  // Atualizar hora a cada segundo
  useEffect(() => {
    const interval = setInterval(() => setHoraAtual(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])

  // Carregar dados do funcionário pelo token
  useEffect(() => {
    if (token) carregarDados()
  }, [token])

  async function carregarDados() {
    const func = await api.buscarFuncionarioPorToken(token!)
    if (!func) { setErro('Link inválido'); return }
    if (!func.ativo) { setErro('Funcionário inativo'); return }

    setFuncionario(func)
    const ponto = await api.buscarPontoAberto(func.id)
    setPontoAberto(ponto)
  }

  async function handleBaterPonto() {
    const res = await api.baterPonto(token!)
    setResultado(res)
    if (res.sucesso) await carregarDados()
  }

  return (
    // Interface com:
    // - Header: Data + Hora atual (atualiza a cada segundo)
    // - Card: Nome, cargo, status do ponto
    // - Botão: Verde "REGISTRAR ENTRADA" ou Vermelho "REGISTRAR SAÍDA"
  )
}
```

### URL de Acesso

```
https://seu-dominio.com/ponto/{ponto_token}
```

O token é um UUID único gerado automaticamente para cada funcionário.

---

## Segurança (RLS)

### Políticas para `funcionarios_ponto`

```sql
-- Habilitar RLS
ALTER TABLE public.funcionarios_ponto ENABLE ROW LEVEL SECURITY;

-- Financeiro e Chefe podem ver todos
CREATE POLICY "Financeiro e Chefe podem ver funcionarios_ponto"
    ON public.funcionarios_ponto FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid()
            AND users.role IN ('financeiro', 'chefe')
        )
    );

-- Financeiro pode criar
CREATE POLICY "Financeiro pode criar funcionarios_ponto"
    ON public.funcionarios_ponto FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid()
            AND users.role = 'financeiro'
        )
    );

-- Financeiro pode editar
CREATE POLICY "Financeiro pode editar funcionarios_ponto"
    ON public.funcionarios_ponto FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid()
            AND users.role = 'financeiro'
        )
    );
```

### Políticas para `registro_ponto`

```sql
-- Habilitar RLS
ALTER TABLE public.registro_ponto ENABLE ROW LEVEL SECURITY;

-- Financeiro e Chefe podem ver todos os registros
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
CREATE POLICY "Financeiro pode criar registro_ponto"
    ON public.registro_ponto FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid()
            AND users.role = 'financeiro'
        )
    );

-- Financeiro pode editar registros
CREATE POLICY "Financeiro pode editar registro_ponto"
    ON public.registro_ponto FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid()
            AND users.role = 'financeiro'
        )
    );
```

### Permissões Públicas (Mobile)

As funções RPC são `SECURITY DEFINER` e podem ser chamadas anonimamente:

```sql
GRANT EXECUTE ON FUNCTION buscar_funcionario_por_token(UUID) TO anon;
GRANT EXECUTE ON FUNCTION buscar_ponto_aberto(UUID) TO anon;
GRANT EXECUTE ON FUNCTION registrar_entrada(UUID) TO anon;
GRANT EXECUTE ON FUNCTION registrar_saida(UUID) TO anon;
GRANT EXECUTE ON FUNCTION bater_ponto(UUID) TO anon;
```

---

## Fluxo de Uso

### 1. Cadastro de Funcionário (Desktop)

```
Financeiro acessa sistema
    ↓
Aba "Ponto" → Sub-aba "Funcionários"
    ↓
Clica "Novo Funcionário"
    ↓
Preenche nome e cargo
    ↓
Sistema gera token UUID automaticamente
    ↓
Financeiro copia link e envia via WhatsApp
```

### 2. Bater Ponto (Mobile)

```
Funcionário acessa link no celular
    https://ponto.seudominio.com/ponto/{token}
    ↓
Sistema valida token e carrega dados
    ↓
Exibe: Nome, cargo, hora atual, status do ponto
    ↓
Funcionário clica no botão
    ↓
Se não tem ponto aberto:
    → Registra ENTRADA
    → Botão fica vermelho "REGISTRAR SAÍDA"
    ↓
Se tem ponto aberto:
    → Registra SAÍDA
    → Calcula total de horas
    → Botão volta a verde "REGISTRAR ENTRADA"
```

### 3. Visualização de Registros (Desktop)

```
Financeiro/Chefe acessa sistema
    ↓
Aba "Ponto" → Sub-aba "Registros"
    ↓
Filtra por funcionário, período
    ↓
Visualiza entrada, saída, total, status
```

### 4. Relatórios (Desktop)

```
Financeiro acessa sistema
    ↓
Aba "Ponto" → Sub-aba "Resumo"
    ↓
Seleciona período (Dia/Semana/Mês/Custom)
    ↓
Visualiza total de horas por funcionário
```

---

## Como Replicar

### 1. Banco de Dados

Execute o arquivo `database/migration_ponto_eletronico.sql` no Supabase SQL Editor.

### 2. Variáveis de Ambiente

```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anon
```

### 3. Rotas

```typescript
// App principal (desktop)
<Route path="/financeiro" element={<Financeiro />} />

// Rota mobile (pode ser no mesmo app ou separado)
<Route path="/ponto/:token" element={<PontoMobile />} />
```

### 4. Adaptações Necessárias

1. **Tabela de usuários**: Ajustar referência `public.users` para sua tabela de usuários
2. **Roles**: Ajustar os valores de role (`financeiro`, `chefe`) para os do seu sistema
3. **URL do mobile**: Configurar domínio para o app mobile (ex: Vercel)
4. **Branding**: Ajustar nome da empresa no rodapé do mobile

### 5. Checklist de Implementação

- [ ] Executar migration SQL
- [ ] Verificar se funções RPC foram criadas
- [ ] Verificar se views foram criadas
- [ ] Verificar se políticas RLS estão ativas
- [ ] Testar GRANT para funções anônimas
- [ ] Criar componente PontoTab no desktop
- [ ] Criar página PontoMobile
- [ ] Configurar rotas
- [ ] Testar fluxo completo: criar funcionário → copiar link → bater ponto

---

## Melhorias Futuras

- [ ] Geolocalização no registro (latitude/longitude)
- [ ] Notificações de esquecimento de saída
- [ ] Integração com folha de pagamento
- [ ] Pausas (almoço, intervalo)
- [ ] Horas extras automáticas
- [ ] Exportação PDF/Excel
- [ ] Biometria no mobile
- [ ] Progressive Web App (offline)
- [ ] Integração com catraca física
