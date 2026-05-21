import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export type ExtractedLine = {
  description: string
  quantity: number | null
  unit: string | null
  unit_price: number | null
  subtotal: number | null
}

export type ExtractedInvoice = {
  supplier_name: string | null
  supplier_rfc: string | null
  folio: string | null
  invoice_date: string | null          // ISO date YYYY-MM-DD
  subtotal: number | null
  tax_amount: number | null
  total: number | null
  currency: string
  lines: ExtractedLine[]
  confidence: number                   // 0-1, qué tan legible era la imagen
  notes: string | null                 // observaciones del modelo
}

const SYSTEM_PROMPT = `Eres un experto en extracción de datos de facturas de proveedores de restaurantes.

Tu tarea: analizar la imagen o PDF de una factura y llamar la herramienta extract_invoice con los datos extraídos.

REGLAS:
- Si un campo no es legible, usa null
- Las fechas van en formato YYYY-MM-DD
- Los montos son números (no strings), sin símbolos de moneda
- Las cantidades y precios son números decimales
- La moneda default es "MXN" salvo que se indique otro
- En "lines" incluye TODAS las líneas de producto, no omitas ninguna
- El campo "confidence" refleja qué tan legible estaba la imagen (0.0 a 1.0)
- En "notes" anota si hay algo poco claro o ambiguo`

const EXTRACT_TOOL: Anthropic.Tool = {
  name: 'extract_invoice',
  description: 'Extrae los datos estructurados de una factura de proveedor',
  input_schema: {
    type: 'object' as const,
    properties: {
      supplier_name: { type: 'string', description: 'Nombre del proveedor tal como aparece en la factura' },
      supplier_rfc:  { type: 'string', description: 'RFC del proveedor' },
      folio:         { type: 'string', description: 'Número de factura o folio' },
      invoice_date:  { type: 'string', description: 'Fecha de la factura en formato YYYY-MM-DD' },
      subtotal:      { type: 'number', description: 'Subtotal antes de impuestos' },
      tax_amount:    { type: 'number', description: 'Total de impuestos (IVA u otros)' },
      total:         { type: 'number', description: 'Total con impuestos' },
      currency:      { type: 'string', description: 'Moneda, default MXN' },
      lines: {
        type: 'array',
        description: 'Todas las líneas de producto de la factura',
        items: {
          type: 'object',
          properties: {
            description: { type: 'string', description: 'Descripción exacta del producto' },
            quantity:    { type: 'number', description: 'Cantidad' },
            unit:        { type: 'string', description: 'Unidad de medida (kg, lt, pza, etc.)' },
            unit_price:  { type: 'number', description: 'Precio unitario' },
            subtotal:    { type: 'number', description: 'Subtotal de la línea' },
          },
          required: ['description'],
        },
      },
      confidence: { type: 'number', description: 'Qué tan legible estaba la imagen, de 0.0 a 1.0' },
      notes:      { type: 'string', description: 'Observaciones sobre campos ambiguos o poco claros' },
    },
    required: ['lines', 'currency', 'confidence'],
  },
}

export async function extractInvoiceData(
  imageBase64: string,
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' | 'application/pdf'
): Promise<ExtractedInvoice> {
  const isPdf = mediaType === 'application/pdf'

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    tools: [EXTRACT_TOOL],
    tool_choice: { type: 'tool', name: 'extract_invoice' },
    messages: [
      {
        role: 'user',
        content: isPdf
          ? [
              {
                type: 'document',
                source: {
                  type: 'base64',
                  media_type: 'application/pdf',
                  data: imageBase64,
                },
              } as any,
              { type: 'text', text: 'Extrae los datos de esta factura.' },
            ]
          : [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mediaType as any,
                  data: imageBase64,
                },
              },
              { type: 'text', text: 'Extrae los datos de esta factura.' },
            ],
      },
    ],
  })

  // Con tool_use, la respuesta siempre viene en tool_use block — JSON garantizado
  const toolUse = message.content.find(b => b.type === 'tool_use') as Anthropic.ToolUseBlock | undefined
  if (!toolUse) {
    throw new Error('Claude no devolvió resultado de extracción')
  }

  return toolUse.input as ExtractedInvoice
}
