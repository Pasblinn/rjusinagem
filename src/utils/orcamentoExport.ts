import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun, WidthType, AlignmentType, BorderStyle, HeadingLevel } from 'docx'
import { saveAs } from 'file-saver'
import { Orcamento, OrcamentoItem } from '@/types'

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('pt-BR')
}

function formatCNPJ(doc: string | null): string {
  if (!doc) return '-'
  const nums = doc.replace(/\D/g, '')
  if (nums.length === 14) {
    return nums.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
  }
  if (nums.length === 11) {
    return nums.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
  }
  return doc
}

// ═══════════════════════════════════════════════════════════
// PDF Export
// ═══════════════════════════════════════════════════════════
export function exportOrcamentoPDF(orcamento: Orcamento, itens: OrcamentoItem[]) {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()

  // Header - empresa
  doc.setFillColor(30, 64, 175) // blue-800
  doc.rect(0, 0, pageWidth, 40, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(22)
  doc.setFont('helvetica', 'bold')
  doc.text('RJ USINAGEM', 14, 18)

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text('Usinagem de Precisão', 14, 26)
  doc.text('CNPJ: 00.000.000/0000-00', 14, 32)

  // Título do documento
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text('ORÇAMENTO', pageWidth - 14, 18, { align: 'right' })

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(`Data: ${formatDate(orcamento.created_at)}`, pageWidth - 14, 26, { align: 'right' })
  doc.text(`Versão: ${orcamento.versao}`, pageWidth - 14, 32, { align: 'right' })

  // Dados do cliente
  let y = 50
  doc.setTextColor(30, 64, 175)
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('DADOS DO CLIENTE', 14, y)
  y += 2
  doc.setDrawColor(30, 64, 175)
  doc.setLineWidth(0.5)
  doc.line(14, y, pageWidth - 14, y)

  y += 8
  doc.setTextColor(60, 60, 60)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')

  const clienteInfo = [
    ['Cliente:', orcamento.cliente],
    ['CNPJ/CPF:', formatCNPJ(orcamento.cnpj_cliente)],
    ['Telefone:', orcamento.telefone_cliente || '-'],
    ['E-mail:', orcamento.email_cliente || '-'],
  ]

  clienteInfo.forEach(([label, value]) => {
    doc.setFont('helvetica', 'bold')
    doc.text(label, 14, y)
    doc.setFont('helvetica', 'normal')
    doc.text(value, 50, y)
    y += 6
  })

  // Tabela de itens
  y += 6
  doc.setTextColor(30, 64, 175)
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('ITENS DO ORÇAMENTO', 14, y)
  y += 2
  doc.line(14, y, pageWidth - 14, y)
  y += 4

  const tableData = itens.map((item, idx) => [
    (idx + 1).toString(),
    item.nome_peca,
    item.quantidade.toString(),
    formatCurrency(item.valor_unitario),
    formatCurrency(item.subtotal),
    item.observacoes || '-',
  ])

  autoTable(doc, {
    startY: y,
    head: [['#', 'Peça/Serviço', 'Qtd', 'Valor Unit.', 'Subtotal', 'Observações']],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: [30, 64, 175],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9,
    },
    bodyStyles: {
      fontSize: 9,
      textColor: [60, 60, 60],
    },
    alternateRowStyles: {
      fillColor: [240, 245, 255],
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      2: { halign: 'center', cellWidth: 15 },
      3: { halign: 'right', cellWidth: 30 },
      4: { halign: 'right', cellWidth: 30 },
    },
    margin: { left: 14, right: 14 },
  })

  // Total
  const finalY = (doc as any).lastAutoTable.finalY + 8
  doc.setFillColor(30, 64, 175)
  doc.roundedRect(pageWidth - 90, finalY, 76, 14, 2, 2, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('TOTAL:', pageWidth - 86, finalY + 10)
  doc.text(formatCurrency(orcamento.valor_total || orcamento.valor_estimado), pageWidth - 18, finalY + 10, { align: 'right' })

  // Observações
  if (orcamento.observacoes) {
    const obsY = finalY + 26
    doc.setTextColor(30, 64, 175)
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text('OBSERVAÇÕES', 14, obsY)
    doc.setTextColor(60, 60, 60)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    const lines = doc.splitTextToSize(orcamento.observacoes, pageWidth - 28)
    doc.text(lines, 14, obsY + 7)
  }

  // Rodapé
  const footerY = doc.internal.pageSize.getHeight() - 20
  doc.setDrawColor(200, 200, 200)
  doc.setLineWidth(0.3)
  doc.line(14, footerY, pageWidth - 14, footerY)
  doc.setTextColor(150, 150, 150)
  doc.setFontSize(8)
  doc.text('RJ Usinagem - Documento gerado automaticamente pelo sistema', pageWidth / 2, footerY + 6, { align: 'center' })
  doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, pageWidth / 2, footerY + 11, { align: 'center' })

  const filename = `Orcamento_${orcamento.cliente.replace(/\s+/g, '_')}_${formatDate(orcamento.created_at).replace(/\//g, '-')}.pdf`
  doc.save(filename)
}

// ═══════════════════════════════════════════════════════════
// DOCX Export
// ═══════════════════════════════════════════════════════════
export async function exportOrcamentoDOCX(orcamento: Orcamento, itens: OrcamentoItem[]) {
  const borderNone = {
    top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  } as const

  const borderAll = {
    top: { style: BorderStyle.SINGLE, size: 1, color: '999999' },
    bottom: { style: BorderStyle.SINGLE, size: 1, color: '999999' },
    left: { style: BorderStyle.SINGLE, size: 1, color: '999999' },
    right: { style: BorderStyle.SINGLE, size: 1, color: '999999' },
  } as const

  function makeCell(text: string, bold = false, options: { width?: number; shading?: string; alignment?: (typeof AlignmentType)[keyof typeof AlignmentType]; color?: string; borders?: typeof borderAll } = {}): TableCell {
    return new TableCell({
      width: options.width ? { size: options.width, type: WidthType.PERCENTAGE } : undefined,
      shading: options.shading ? { fill: options.shading } : undefined,
      borders: options.borders || borderAll,
      children: [
        new Paragraph({
          alignment: options.alignment || AlignmentType.LEFT,
          spacing: { before: 40, after: 40 },
          children: [
            new TextRun({
              text,
              bold,
              size: 20,
              color: options.color || '3C3C3C',
              font: 'Calibri',
            }),
          ],
        }),
      ],
    })
  }

  // Header rows (info do cliente)
  function infoRow(label: string, value: string): TableRow {
    return new TableRow({
      children: [
        new TableCell({
          width: { size: 20, type: WidthType.PERCENTAGE },
          borders: borderNone,
          children: [new Paragraph({ children: [new TextRun({ text: label, bold: true, size: 20, font: 'Calibri', color: '3C3C3C' })] })],
        }),
        new TableCell({
          width: { size: 80, type: WidthType.PERCENTAGE },
          borders: borderNone,
          children: [new Paragraph({ children: [new TextRun({ text: value, size: 20, font: 'Calibri', color: '3C3C3C' })] })],
        }),
      ],
    })
  }

  // Tabela de itens
  const headerRow = new TableRow({
    tableHeader: true,
    children: [
      makeCell('#', true, { width: 5, shading: '1E40AF', color: 'FFFFFF', alignment: AlignmentType.CENTER }),
      makeCell('Peça/Serviço', true, { width: 30, shading: '1E40AF', color: 'FFFFFF' }),
      makeCell('Qtd', true, { width: 10, shading: '1E40AF', color: 'FFFFFF', alignment: AlignmentType.CENTER }),
      makeCell('Valor Unit.', true, { width: 15, shading: '1E40AF', color: 'FFFFFF', alignment: AlignmentType.RIGHT }),
      makeCell('Subtotal', true, { width: 15, shading: '1E40AF', color: 'FFFFFF', alignment: AlignmentType.RIGHT }),
      makeCell('Observações', true, { width: 25, shading: '1E40AF', color: 'FFFFFF' }),
    ],
  })

  const itemRows = itens.map((item, idx) =>
    new TableRow({
      children: [
        makeCell((idx + 1).toString(), false, { alignment: AlignmentType.CENTER, shading: idx % 2 === 1 ? 'F0F5FF' : undefined }),
        makeCell(item.nome_peca, false, { shading: idx % 2 === 1 ? 'F0F5FF' : undefined }),
        makeCell(item.quantidade.toString(), false, { alignment: AlignmentType.CENTER, shading: idx % 2 === 1 ? 'F0F5FF' : undefined }),
        makeCell(formatCurrency(item.valor_unitario), false, { alignment: AlignmentType.RIGHT, shading: idx % 2 === 1 ? 'F0F5FF' : undefined }),
        makeCell(formatCurrency(item.subtotal), false, { alignment: AlignmentType.RIGHT, shading: idx % 2 === 1 ? 'F0F5FF' : undefined }),
        makeCell(item.observacoes || '-', false, { shading: idx % 2 === 1 ? 'F0F5FF' : undefined }),
      ],
    })
  )

  // Total row
  const totalRow = new TableRow({
    children: [
      new TableCell({
        columnSpan: 4,
        borders: borderAll,
        shading: { fill: '1E40AF' },
        children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: 'TOTAL:', bold: true, size: 24, color: 'FFFFFF', font: 'Calibri' })] })],
      }),
      new TableCell({
        columnSpan: 2,
        borders: borderAll,
        shading: { fill: '1E40AF' },
        children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: formatCurrency(orcamento.valor_total || orcamento.valor_estimado), bold: true, size: 24, color: 'FFFFFF', font: 'Calibri' })] })],
      }),
    ],
  })

  const children: (Paragraph | Table)[] = [
    // Título empresa
    new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing: { after: 40 },
      children: [new TextRun({ text: 'RJ USINAGEM', bold: true, size: 36, color: '1E40AF', font: 'Calibri' })],
    }),
    new Paragraph({
      spacing: { after: 40 },
      children: [new TextRun({ text: 'Usinagem de Precisão', size: 20, color: '666666', font: 'Calibri' })],
    }),
    new Paragraph({
      spacing: { after: 200 },
      children: [new TextRun({ text: `CNPJ: 00.000.000/0000-00`, size: 18, color: '999999', font: 'Calibri' })],
    }),

    // Título orçamento
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 200, after: 100 },
      heading: HeadingLevel.HEADING_1,
      children: [new TextRun({ text: 'ORÇAMENTO', bold: true, size: 32, color: '1E40AF', font: 'Calibri' })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 300 },
      children: [
        new TextRun({ text: `Data: ${formatDate(orcamento.created_at)}  |  Versão: ${orcamento.versao}`, size: 20, color: '666666', font: 'Calibri' }),
      ],
    }),

    // Dados do cliente
    new Paragraph({
      spacing: { before: 200, after: 100 },
      children: [new TextRun({ text: 'DADOS DO CLIENTE', bold: true, size: 24, color: '1E40AF', font: 'Calibri' })],
    }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        infoRow('Cliente:', orcamento.cliente),
        infoRow('CNPJ/CPF:', formatCNPJ(orcamento.cnpj_cliente)),
        infoRow('Telefone:', orcamento.telefone_cliente || '-'),
        infoRow('E-mail:', orcamento.email_cliente || '-'),
      ],
    }),

    // Itens
    new Paragraph({
      spacing: { before: 300, after: 100 },
      children: [new TextRun({ text: 'ITENS DO ORÇAMENTO', bold: true, size: 24, color: '1E40AF', font: 'Calibri' })],
    }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [headerRow, ...itemRows, totalRow],
    }),
  ]

  // Observações
  if (orcamento.observacoes) {
    children.push(
      new Paragraph({
        spacing: { before: 300, after: 100 },
        children: [new TextRun({ text: 'OBSERVAÇÕES', bold: true, size: 24, color: '1E40AF', font: 'Calibri' })],
      }),
      new Paragraph({
        children: [new TextRun({ text: orcamento.observacoes, size: 20, color: '3C3C3C', font: 'Calibri' })],
      }),
    )
  }

  // Rodapé
  children.push(
    new Paragraph({
      spacing: { before: 400 },
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: 'RJ Usinagem - Documento gerado automaticamente pelo sistema', size: 16, color: '999999', font: 'Calibri' })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: `Gerado em: ${new Date().toLocaleString('pt-BR')}`, size: 16, color: '999999', font: 'Calibri' })],
    }),
  )

  const docFile = new Document({
    sections: [{ children }],
  })

  const blob = await Packer.toBlob(docFile)
  const filename = `Orcamento_${orcamento.cliente.replace(/\s+/g, '_')}_${formatDate(orcamento.created_at).replace(/\//g, '-')}.docx`
  saveAs(blob, filename)
}
