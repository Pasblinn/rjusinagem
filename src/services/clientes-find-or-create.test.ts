import { describe, it, expect, vi, beforeEach } from 'vitest'

// vi.hoisted: as variaveis ficam acessiveis dentro do factory do vi.mock
const mocks = vi.hoisted(() => {
  const buscaSingle = vi.fn()
  const insertSingle = vi.fn()
  const eqMock = vi.fn(() => ({ maybeSingle: buscaSingle }))
  const selectMock = vi.fn(() => ({ eq: eqMock }))
  const insertReturnSelect = vi.fn(() => ({ single: insertSingle }))
  const insertMock = vi.fn(() => ({ select: insertReturnSelect }))
  const fromMock = vi.fn(() => ({ select: selectMock, insert: insertMock }))
  return { buscaSingle, insertSingle, insertMock, fromMock }
})

vi.mock('@/services/supabase', () => ({
  supabase: { from: mocks.fromMock },
}))

import { api } from './api'

beforeEach(() => {
  mocks.buscaSingle.mockReset()
  mocks.insertSingle.mockReset()
  mocks.insertMock.mockClear()
  mocks.fromMock.mockClear()
})

describe('api.findOrCreateClientePorDocumento', () => {
  it('retorna null para documento invalido (poucos digitos)', async () => {
    const cli = await api.findOrCreateClientePorDocumento({
      documento: '123',
      nome: 'X',
    })
    expect(cli).toBeNull()
    expect(mocks.fromMock).not.toHaveBeenCalled()
  })

  it('retorna null quando nome esta vazio', async () => {
    const cli = await api.findOrCreateClientePorDocumento({
      documento: '12345678000199',
      nome: '   ',
    })
    expect(cli).toBeNull()
    expect(mocks.fromMock).not.toHaveBeenCalled()
  })

  it('retorna o cliente existente sem inserir quando documento ja esta cadastrado', async () => {
    const existente = {
      id: 'cli-1',
      nome: 'ACME Ltda',
      documento: '12345678000199',
      tipo_documento: 'cnpj',
    }
    mocks.buscaSingle.mockResolvedValueOnce({ data: existente, error: null })

    const cli = await api.findOrCreateClientePorDocumento({
      documento: '12.345.678/0001-99',
      nome: 'qualquer outro nome',
    })

    expect(cli).toEqual(existente)
    expect(mocks.insertMock).not.toHaveBeenCalled()
  })

  it('cria novo cliente quando documento nao existe e marca tipo_documento=cnpj', async () => {
    mocks.buscaSingle.mockResolvedValueOnce({ data: null, error: null })
    const novo = {
      id: 'cli-2',
      nome: 'Novo Cliente',
      documento: '99888777000100',
      tipo_documento: 'cnpj',
    }
    mocks.insertSingle.mockResolvedValueOnce({ data: novo, error: null })

    const cli = await api.findOrCreateClientePorDocumento({
      documento: '99.888.777/0001-00',
      nome: 'Novo Cliente',
      telefone: '(11) 99999-9999',
      email: 'a@b.com',
      userId: 'user-1',
    })

    expect(cli).toEqual(novo)
    expect(mocks.insertMock).toHaveBeenCalledOnce()
    const payload = (mocks.insertMock.mock.calls[0] as any[])[0][0]
    expect(payload.documento).toBe('99888777000100')
    expect(payload.tipo_documento).toBe('cnpj')
    expect(payload.nome).toBe('Novo Cliente')
    expect(payload.created_by).toBe('user-1')
  })

  it('marca tipo_documento=cpf quando documento tem 11 digitos', async () => {
    mocks.buscaSingle.mockResolvedValueOnce({ data: null, error: null })
    mocks.insertSingle.mockResolvedValueOnce({ data: { id: 'cli-3' }, error: null })

    await api.findOrCreateClientePorDocumento({
      documento: '123.456.789-09',
      nome: 'Pessoa Fisica',
    })

    expect((mocks.insertMock.mock.calls[0] as any[])[0][0].tipo_documento).toBe('cpf')
  })

  it('recupera existente em caso de race (unique violation 23505)', async () => {
    mocks.buscaSingle.mockResolvedValueOnce({ data: null, error: null })
    mocks.insertSingle.mockResolvedValueOnce({
      data: null,
      error: { code: '23505', message: 'duplicate key' },
    })
    const vencedor = { id: 'cli-4', nome: 'Vencedor', documento: '12345678000199' }
    mocks.buscaSingle.mockResolvedValueOnce({ data: vencedor, error: null })

    const cli = await api.findOrCreateClientePorDocumento({
      documento: '12345678000199',
      nome: 'Loser',
    })

    expect(cli).toEqual(vencedor)
  })
})
