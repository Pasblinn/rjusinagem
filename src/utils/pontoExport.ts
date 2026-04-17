import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun, WidthType, AlignmentType, HeadingLevel } from 'docx'
import { saveAs } from 'file-saver'

const EMPRESA = {
  nome: 'RJ USINAGEM',
  subtitulo: 'Usinagem de Precisão',
  cnpj: '56.913.744/0001-51',
}

function formatMinutesToHours(minutes: number): string {
  if (!minutes) return '0h 00min'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${h}h ${String(m).padStart(2, '0')}min`
}

function formatDateBR(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('pt-BR')
}

export interface RelatorioHorasRow {
  funcionario_id: string
  funcionario_nome: string
  funcionario_cargo?: string | null
  total_dias: number
  total_minutos: number
  total_horas_formatado: string
  valor_hora?: number | null
}

export interface RelatorioDetalhadoDia {
  data: string
  entrada: string | null
  saida: string | null
  minutos: number
}

export function exportRelatorioHorasPDF(
  rows: RelatorioHorasRow[],
  dataInicio: string,
  dataFim: string,
) {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()

  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text(EMPRESA.nome, pageWidth / 2, 18, { align: 'center' })

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(EMPRESA.subtitulo, pageWidth / 2, 24, { align: 'center' })
  doc.text(`CNPJ: ${EMPRESA.cnpj}`, pageWidth / 2, 29, { align: 'center' })

  doc.setDrawColor(180)
  doc.line(14, 33, pageWidth - 14, 33)

  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text('Relatório de Horas Trabalhadas', pageWidth / 2, 42, { align: 'center' })

  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  doc.text(
    `Período: ${formatDateBR(dataInicio)} a ${formatDateBR(dataFim)}`,
    pageWidth / 2,
    49,
    { align: 'center' },
  )

  const body = rows.map((r) => {
    const pagamento = r.valor_hora && r.valor_hora > 0
      ? `R$ ${((r.total_minutos / 60) * r.valor_hora).toFixed(2).replace('.', ',')}`
      : '-'
    return [
      r.funcionario_nome,
      r.funcionario_cargo || '-',
      `${r.total_dias}`,
      r.total_horas_formatado || formatMinutesToHours(r.total_minutos),
      r.valor_hora ? `R$ ${r.valor_hora.toFixed(2).replace('.', ',')}` : '-',
      pagamento,
    ]
  })

  const totalDias = rows.reduce((acc, r) => acc + r.total_dias, 0)
  const totalMinutos = rows.reduce((acc, r) => acc + r.total_minutos, 0)
  const totalPagamento = rows.reduce((acc, r) => {
    if (!r.valor_hora) return acc
    return acc + (r.total_minutos / 60) * r.valor_hora
  }, 0)

  autoTable(doc, {
    startY: 55,
    head: [['Funcionário', 'Cargo', 'Dias', 'Total Horas', 'R$/hora', 'A pagar']],
    body,
    foot: [
      [
        'TOTAL',
        '',
        `${totalDias}`,
        formatMinutesToHours(totalMinutos),
        '',
        `R$ ${totalPagamento.toFixed(2).replace('.', ',')}`,
      ],
    ],
    theme: 'striped',
    headStyles: { fillColor: [30, 30, 30], textColor: 255, fontStyle: 'bold' },
    footStyles: { fillColor: [230, 230, 230], textColor: 20, fontStyle: 'bold' },
    styles: { fontSize: 10, cellPadding: 3 },
    columnStyles: {
      2: { halign: 'center' },
      3: { halign: 'center' },
      4: { halign: 'right' },
      5: { halign: 'right' },
    },
  })

  const finalY = (doc as any).lastAutoTable.finalY + 12
  doc.setFontSize(9)
  doc.setTextColor(120)
  doc.text(
    `Gerado em ${new Date().toLocaleString('pt-BR')}`,
    pageWidth / 2,
    finalY,
    { align: 'center' },
  )

  const filename = `relatorio-horas-${dataInicio}-${dataFim}.pdf`
  doc.save(filename)
}

export function exportRelatorioFuncionarioPDF(
  funcionarioNome: string,
  funcionarioCargo: string | null,
  valorHora: number | null,
  dias: RelatorioDetalhadoDia[],
  dataInicio: string,
  dataFim: string,
) {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()

  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text(EMPRESA.nome, pageWidth / 2, 18, { align: 'center' })

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(EMPRESA.subtitulo, pageWidth / 2, 24, { align: 'center' })
  doc.text(`CNPJ: ${EMPRESA.cnpj}`, pageWidth / 2, 29, { align: 'center' })

  doc.line(14, 33, pageWidth - 14, 33)

  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text('Folha de Ponto - Detalhado', pageWidth / 2, 42, { align: 'center' })

  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  doc.text(`Funcionário: ${funcionarioNome}`, 14, 52)
  if (funcionarioCargo) {
    doc.text(`Cargo: ${funcionarioCargo}`, 14, 58)
  }
  doc.text(
    `Período: ${formatDateBR(dataInicio)} a ${formatDateBR(dataFim)}`,
    14,
    funcionarioCargo ? 64 : 58,
  )

  const totalMin = dias.reduce((acc, d) => acc + d.minutos, 0)
  const pagamento = valorHora ? (totalMin / 60) * valorHora : 0

  const body = dias.map((d) => [
    formatDateBR(d.data),
    d.entrada ? new Date(d.entrada).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '-',
    d.saida ? new Date(d.saida).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '-',
    formatMinutesToHours(d.minutos),
  ])

  autoTable(doc, {
    startY: funcionarioCargo ? 70 : 64,
    head: [['Data', 'Entrada', 'Saída', 'Horas']],
    body,
    foot: [['TOTAL', '', '', formatMinutesToHours(totalMin)]],
    theme: 'striped',
    headStyles: { fillColor: [30, 30, 30], textColor: 255, fontStyle: 'bold' },
    footStyles: { fillColor: [230, 230, 230], textColor: 20, fontStyle: 'bold' },
    styles: { fontSize: 10 },
    columnStyles: {
      1: { halign: 'center' },
      2: { halign: 'center' },
      3: { halign: 'center' },
    },
  })

  const finalY = (doc as any).lastAutoTable.finalY + 10
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')

  if (valorHora && valorHora > 0) {
    doc.text(`Valor/hora: R$ ${valorHora.toFixed(2).replace('.', ',')}`, 14, finalY)
    doc.text(
      `Total a pagar: R$ ${pagamento.toFixed(2).replace('.', ',')}`,
      14,
      finalY + 7,
    )
  }

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(120)
  doc.text(
    `Gerado em ${new Date().toLocaleString('pt-BR')}`,
    pageWidth / 2,
    finalY + 22,
    { align: 'center' },
  )

  const safeName = funcionarioNome.replace(/[^a-zA-Z0-9]/g, '_')
  doc.save(`folha-ponto-${safeName}-${dataInicio}-${dataFim}.pdf`)
}

function textCell(text: string, opts: { bold?: boolean; align?: (typeof AlignmentType)[keyof typeof AlignmentType] } = {}) {
  return new TableCell({
    children: [
      new Paragraph({
        alignment: opts.align,
        children: [new TextRun({ text, bold: opts.bold })],
      }),
    ],
  })
}

export async function exportRelatorioFuncionarioDOCX(
  funcionarioNome: string,
  funcionarioCargo: string | null,
  valorHora: number | null,
  dias: RelatorioDetalhadoDia[],
  dataInicio: string,
  dataFim: string,
) {
  const totalMin = dias.reduce((acc, d) => acc + d.minutos, 0)
  const pagamento = valorHora ? (totalMin / 60) * valorHora : 0

  const headerRow = new TableRow({
    tableHeader: true,
    children: [
      textCell('Data', { bold: true, align: AlignmentType.CENTER }),
      textCell('Entrada', { bold: true, align: AlignmentType.CENTER }),
      textCell('Saída', { bold: true, align: AlignmentType.CENTER }),
      textCell('Horas', { bold: true, align: AlignmentType.CENTER }),
    ],
  })

  const bodyRows = dias.map((d) => {
    const entrada = d.entrada
      ? new Date(d.entrada).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      : '-'
    const saida = d.saida
      ? new Date(d.saida).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      : '-'
    return new TableRow({
      children: [
        textCell(formatDateBR(d.data)),
        textCell(entrada, { align: AlignmentType.CENTER }),
        textCell(saida, { align: AlignmentType.CENTER }),
        textCell(formatMinutesToHours(d.minutos), { align: AlignmentType.CENTER }),
      ],
    })
  })

  const totalRow = new TableRow({
    children: [
      textCell('TOTAL', { bold: true }),
      textCell(''),
      textCell(''),
      textCell(formatMinutesToHours(totalMin), { bold: true, align: AlignmentType.CENTER }),
    ],
  })

  const docx = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            heading: HeadingLevel.HEADING_1,
            children: [new TextRun({ text: EMPRESA.nome, bold: true })],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: EMPRESA.subtitulo, italics: true })],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: `CNPJ: ${EMPRESA.cnpj}` })],
          }),
          new Paragraph({ children: [new TextRun({ text: '' })] }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            heading: HeadingLevel.HEADING_2,
            children: [new TextRun({ text: 'Folha de Ponto - Detalhado', bold: true })],
          }),
          new Paragraph({ children: [new TextRun({ text: '' })] }),
          new Paragraph({
            children: [new TextRun({ text: `Funcionário: ${funcionarioNome}`, bold: true })],
          }),
          ...(funcionarioCargo
            ? [new Paragraph({ children: [new TextRun({ text: `Cargo: ${funcionarioCargo}` })] })]
            : []),
          new Paragraph({
            children: [
              new TextRun({
                text: `Período: ${formatDateBR(dataInicio)} a ${formatDateBR(dataFim)}`,
              }),
            ],
          }),
          new Paragraph({ children: [new TextRun({ text: '' })] }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [headerRow, ...bodyRows, totalRow],
          }),
          new Paragraph({ children: [new TextRun({ text: '' })] }),
          ...(valorHora && valorHora > 0
            ? [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `Valor/hora: R$ ${valorHora.toFixed(2).replace('.', ',')}`,
                      bold: true,
                    }),
                  ],
                }),
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `Total a pagar: R$ ${pagamento.toFixed(2).replace('.', ',')}`,
                      bold: true,
                    }),
                  ],
                }),
              ]
            : []),
          new Paragraph({ children: [new TextRun({ text: '' })] }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: `Gerado em ${new Date().toLocaleString('pt-BR')}`,
                italics: true,
                size: 18,
              }),
            ],
          }),
        ],
      },
    ],
  })

  const blob = await Packer.toBlob(docx)
  const safeName = funcionarioNome.replace(/[^a-zA-Z0-9]/g, '_')
  saveAs(blob, `folha-ponto-${safeName}-${dataInicio}-${dataFim}.docx`)
}
