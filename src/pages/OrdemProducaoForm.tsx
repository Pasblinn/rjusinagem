import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Save, ArrowLeft, Image as ImageIcon, X } from 'lucide-react'
import { Layout } from '@/components/Layout'
import { Card } from '@/components/Card'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { Textarea } from '@/components/Textarea'
import { Select } from '@/components/Select'
import { Toast } from '@/components/Toast'
import { useAuth } from '@/contexts/AuthContext'
import { api } from '@/services/api'
import { Cliente } from '@/types'

export function OrdemProducaoForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const isNew = !id

  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [clientesLegado, setClientesLegado] = useState<string[]>([])

  // Estado para imagem da planta
  const [imagemFile, setImagemFile] = useState<File | null>(null)
  const [imagemPreview, setImagemPreview] = useState<string | null>(null)
  const [imagemExistente, setImagemExistente] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [formData, setFormData] = useState({
    tipo: 'encomenda',
    data_inicio: new Date().toISOString().split('T')[0],
    data_termino: '',
    preparacao_maquina: '', // kept for editing legacy OPs
    material: '',
    codigo_descricao_material: '',
    quantidade_material: '',
    lote: '',
    fornecedor: '',
    observacoes_material: '',
    cliente: '',
    cnpj_cliente: '',
    nome_peca: '',
    quantidade_total: '',
    unidade: '',
    preco_servico: '',
    preco_material: '',
    maquina_utilizada: '',
    operador_responsavel: '',
  })

  useEffect(() => {
    if (!isNew) {
      loadOP()
    }
    loadClientes()
  }, [id])

  async function loadClientes() {
    try {
      // Tenta carregar da tabela normalizada V3
      const clientesNormalizados = await api.listClientes({ ativo: true })
      setClientes(clientesNormalizados)

      // Também carrega clientes legados (de OPs existentes)
      const clientesLegados = await api.getClientes()
      setClientesLegado(clientesLegados)
    } catch (error) {
      console.warn('Erro ao carregar clientes:', error)
    }
  }

  async function loadOP() {
    try {
      setLoading(true)
      const op = await api.getOrdemProducao(id!)
      setFormData({
        tipo: op.tipo,
        data_inicio: op.data_inicio,
        data_termino: op.data_termino || '',
        preparacao_maquina: op.preparacao_maquina || '',
        material: op.material || '',
        codigo_descricao_material: op.codigo_descricao_material || '',
        quantidade_material: op.quantidade_material || '',
        lote: op.lote || '',
        fornecedor: op.fornecedor || '',
        observacoes_material: op.observacoes_material || '',
        cliente: op.cliente,
        cnpj_cliente: (op as any).cnpj_cliente || '',
        nome_peca: op.nome_peca,
        quantidade_total: op.quantidade_total.toString(),
        unidade: op.unidade || '',
        preco_servico: op.preco_servico.toString(),
        preco_material: op.preco_material?.toString() || '',
        maquina_utilizada: op.maquina_utilizada || '',
        operador_responsavel: op.operador_responsavel || '',
      })
      if (op.imagem_planta_url) {
        setImagemExistente(op.imagem_planta_url)
        setImagemPreview(op.imagem_planta_url)
      }
    } catch (error: any) {
      setToast({ message: 'Erro ao carregar OP', type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleImagemChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImagemFile(file)
    const reader = new FileReader()
    reader.onloadend = () => setImagemPreview(reader.result as string)
    reader.readAsDataURL(file)
  }

  const handleRemoverImagem = () => {
    setImagemFile(null)
    setImagemPreview(null)
    setImagemExistente(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      setLoading(true)

      let savedOpId: string = id || ''

      if (isNew) {
        const codigo = await api.gerarCodigoOP()
        const savedOp = await api.createOrdemProducao({
          codigo,
          tipo: formData.tipo as 'encomenda' | 'estoque',
          data_inicio: formData.data_inicio,
          data_termino: formData.data_termino || null,
          // V3: Status separados - API define defaults automaticamente
          status_producao: 'criada',
          status_financeiro: 'pendente',
          preparacao_maquina: formData.preparacao_maquina || null,
          material: formData.material || null,
          codigo_descricao_material: formData.codigo_descricao_material || null,
          quantidade_material: formData.quantidade_material || null,
          lote: formData.lote || null,
          fornecedor: formData.fornecedor || null,
          observacoes_material: formData.observacoes_material || null,
          cliente: formData.cliente,
          cnpj_cliente: formData.cnpj_cliente || null,
          nome_peca: formData.nome_peca,
          quantidade_total: parseInt(formData.quantidade_total),
          unidade: formData.unidade || null,
          preco_servico: formData.preco_servico ? parseFloat(formData.preco_servico) : 0,
          preco_material: formData.preco_material ? parseFloat(formData.preco_material) : null,
          maquina_utilizada: formData.maquina_utilizada || null,
          operador_responsavel: formData.operador_responsavel || null,
          created_by: user!.id,
          aprovada: false,
        } as any)
        savedOpId = savedOp.id
        setToast({ message: 'OP criada com sucesso!', type: 'success' })
      } else {
        await api.updateOrdemProducao(id!, {
          tipo: formData.tipo as 'encomenda' | 'estoque',
          data_inicio: formData.data_inicio,
          data_termino: formData.data_termino || null,
          preparacao_maquina: formData.preparacao_maquina || null,
          material: formData.material || null,
          codigo_descricao_material: formData.codigo_descricao_material || null,
          quantidade_material: formData.quantidade_material || null,
          lote: formData.lote || null,
          fornecedor: formData.fornecedor || null,
          observacoes_material: formData.observacoes_material || null,
          cliente: formData.cliente,
          cnpj_cliente: formData.cnpj_cliente || null,
          nome_peca: formData.nome_peca,
          quantidade_total: parseInt(formData.quantidade_total),
          unidade: formData.unidade || null,
          preco_servico: formData.preco_servico ? parseFloat(formData.preco_servico) : 0,
          preco_material: formData.preco_material ? parseFloat(formData.preco_material) : null,
          maquina_utilizada: formData.maquina_utilizada || null,
          operador_responsavel: formData.operador_responsavel || null,
        } as any)
        setToast({ message: 'OP atualizada com sucesso!', type: 'success' })
      }

      // Upload ou remoção de imagem
      if (imagemFile && savedOpId) {
        try {
          await api.uploadImagemPlanta(savedOpId, imagemFile)
        } catch (imgErr) {
          console.error('Erro ao fazer upload da imagem:', imgErr)
          setToast({ message: 'OP salva, mas houve erro no upload da imagem', type: 'error' })
        }
      } else if (!imagemPreview && imagemExistente && savedOpId) {
        try {
          await api.removeImagemPlanta(savedOpId)
        } catch (imgErr) {
          console.error('Erro ao remover imagem:', imgErr)
        }
      }

      setTimeout(() => navigate('/'), 1000)
    } catch (error: any) {
      setToast({ message: error.message || 'Erro ao salvar OP', type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  if (loading && !isNew) {
    return (
      <Layout>
        <div className="text-center py-12">
          <p className="text-gray-600 dark:text-slate-400 text-lg">Carregando...</p>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="secondary"
              onClick={() => navigate('/')}
            >
              <ArrowLeft size={20} className="inline mr-2" />
              Voltar
            </Button>
            <div>
              <h2 className="text-3xl font-bold text-gray-900 dark:text-slate-100">
                {isNew ? 'Nova Ordem de Produção' : 'Editar Ordem de Produção'}
              </h2>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Card>
            <h3 className="text-xl font-bold text-gray-900 dark:text-slate-100 mb-4">Informações Básicas</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Select
                label="Tipo de OP"
                options={[
                  { value: 'encomenda', label: 'Encomenda' },
                  { value: 'estoque', label: 'Estoque' },
                ]}
                value={formData.tipo}
                onChange={(e) => handleChange('tipo', e.target.value)}
                required
              />
              <Input
                label="Data de Início"
                type="date"
                value={formData.data_inicio}
                onChange={(e) => handleChange('data_inicio', e.target.value)}
                required
              />
              <Input
                label="Data de Término (Opcional)"
                type="date"
                value={formData.data_termino}
                onChange={(e) => handleChange('data_termino', e.target.value)}
              />
            </div>
          </Card>

          <Card>
            <h3 className="text-xl font-bold text-gray-900 dark:text-slate-100 mb-4">Informações de Material</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Material"
                value={formData.material}
                onChange={(e) => handleChange('material', e.target.value)}
              />
              <Input
                label="Código / Descrição"
                value={formData.codigo_descricao_material}
                onChange={(e) => handleChange('codigo_descricao_material', e.target.value)}
              />
              <Input
                label="Quantidade"
                value={formData.quantidade_material}
                onChange={(e) => handleChange('quantidade_material', e.target.value)}
                placeholder="Ex: 5 barras, 10kg, 3 chapas"
              />
              <Input
                label="Lote"
                value={formData.lote}
                onChange={(e) => handleChange('lote', e.target.value)}
              />
              <Input
                label="Fornecedor"
                value={formData.fornecedor}
                onChange={(e) => handleChange('fornecedor', e.target.value)}
              />
            </div>
            <div className="mt-4">
              <Textarea
                label="Observações"
                value={formData.observacoes_material}
                onChange={(e) => handleChange('observacoes_material', e.target.value)}
              />
            </div>
          </Card>

          <Card>
            <h3 className="text-xl font-bold text-gray-900 dark:text-slate-100 mb-4">Cliente e Peça</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-base font-semibold text-gray-700 dark:text-slate-300 mb-2">
                  Nome do Cliente <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  list="clientes-list"
                  value={formData.cliente}
                  onChange={(e) => handleChange('cliente', e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg text-lg focus:outline-none focus:border-blue-500"
                  placeholder="Digite ou selecione um cliente..."
                  required
                />
                <datalist id="clientes-list">
                  {/* Clientes da tabela normalizada V3 */}
                  {clientes.map((c) => (
                    <option key={c.id} value={c.nome} />
                  ))}
                  {/* Clientes legados que não estão na tabela */}
                  {clientesLegado
                    .filter(nome => !clientes.some(c => c.nome.toLowerCase() === nome.toLowerCase()))
                    .map((nome) => (
                      <option key={nome} value={nome} />
                    ))
                  }
                </datalist>
              </div>
              <Input
                label="CNPJ do Cliente"
                value={formData.cnpj_cliente}
                onChange={(e) => handleChange('cnpj_cliente', e.target.value)}
                placeholder="00.000.000/0000-00"
              />
              <Input
                label="Nome da Peça"
                value={formData.nome_peca}
                onChange={(e) => handleChange('nome_peca', e.target.value)}
                required
              />
              <div className="grid grid-cols-2 gap-2">
                <Input
                  label="Quantidade Total"
                  type="number"
                  value={formData.quantidade_total}
                  onChange={(e) => handleChange('quantidade_total', e.target.value)}
                  required
                />
                <Input
                  label="Unidade"
                  value={formData.unidade}
                  onChange={(e) => handleChange('unidade', e.target.value)}
                  placeholder="Ex: peças, metros, kg"
                />
              </div>
              <Input
                label={`Preço do Serviço (R$)${formData.tipo === 'estoque' ? ' - Opcional' : ''}`}
                type="number"
                step="0.01"
                value={formData.preco_servico}
                onChange={(e) => handleChange('preco_servico', e.target.value)}
                required={formData.tipo !== 'estoque'}
              />
              <Input
                label="Preço Gasto com Material (R$)"
                type="number"
                step="0.01"
                value={formData.preco_material}
                onChange={(e) => handleChange('preco_material', e.target.value)}
                placeholder="Opcional"
              />
            </div>
          </Card>

          <Card>
            <h3 className="text-xl font-bold text-gray-900 dark:text-slate-100 mb-4">Produção</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Máquina Utilizada"
                value={formData.maquina_utilizada}
                onChange={(e) => handleChange('maquina_utilizada', e.target.value)}
              />
              <Input
                label="Operador Responsável"
                value={formData.operador_responsavel}
                onChange={(e) => handleChange('operador_responsavel', e.target.value)}
              />
            </div>
          </Card>

          <Card>
            <h3 className="text-xl font-bold text-gray-900 dark:text-slate-100 mb-2">Planta / Desenho da Peça</h3>
            <p className="text-sm text-gray-600 dark:text-slate-400 mb-4">Imagem do desenho técnico ou planta da peça (opcional)</p>

            {imagemPreview ? (
              <div className="relative inline-block">
                <img
                  src={imagemPreview}
                  alt="Planta da peça"
                  className="max-w-full max-h-80 rounded-lg border-2 border-gray-200"
                />
                <button
                  type="button"
                  onClick={handleRemoverImagem}
                  className="absolute top-2 right-2 bg-red-600 text-white rounded-full p-1 hover:bg-red-700 transition-colors"
                  title="Remover imagem"
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 dark:border-slate-700 rounded-lg cursor-pointer hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors">
                <ImageIcon size={32} className="text-gray-400 mb-2" />
                <p className="text-gray-600 dark:text-slate-400 font-medium">Clique para adicionar a planta/desenho</p>
                <p className="text-sm text-gray-400 mt-1">PNG, JPG até 10MB</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept="image/*"
                  onChange={handleImagemChange}
                />
              </label>
            )}
          </Card>

          <div className="flex gap-4">
            <Button
              type="submit"
              size="lg"
              disabled={loading}
            >
              <Save size={20} className="inline mr-2" />
              {loading ? 'Salvando...' : 'Salvar OP'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="lg"
              onClick={() => navigate('/')}
            >
              Cancelar
            </Button>
          </div>
        </form>
      </div>
    </Layout>
  )
}
