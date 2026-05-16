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

const SYSTEM_PROMPT = `Eres un experto en extracción de datos de facturas mexicanas de proveedores de restaurantes.

Tu tarea: analizar la imagen o PDF de una factura y devolver un JSON estructurado con los datos.

REGLAS:
- Devuelve SOLO JSON válido, sin texto adicional, sin markdown
- Si un campo no es legible, usa null
- Las fechas van en formato YYYY-MM-DD
- Los montos son números (no strings), sin símbolos de moneda
- Las cantidades y precios son números decimales
- La moneda default es "MXN" salvo que se indique otro
- En "lines" incluye TODAS las líneas de producto, no omitas ninguna
- El campo "confidence" refleja qué tan legible estaba la imagen (0.0 a 1.0)
- En "notes" anota si hay algo poco claro o ambiguo

SCHEMA ESPERADO:
{
  "supplier_name": "Nombre del proveedor tal como aparece",
  "supplier_rfc": "RFC del proveedor o null",
  "folio": "Número de factura/folio",
  "invoice_date": "YYYY-MM-DD",
  "subtotal": 1234.56,
  "tax_amount": 197.53,
  "total": 1432.09,
  "currency": "MXN",
  "lines": [
    {
      "description": "Descripción exacta del producto como aparece",
      "quantity": 5.0,
      "unit": "kg",
      "unit_price": 89.50,
      "subtotal": 447.50
    }
  ],
  "confidence": 0.95,
  "notes": null
}`

export async function extractInvoiceData(
  imageBase64: string,
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' | 'application/pdf'
): Promise<ExtractedInvoice> {
  const isPdf = mediaType === 'application/pdf'

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
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

  const raw = message.content[0].type === 'text' ? message.content[0].text : ''

  try {
    return JSON.parse(raw) as ExtractedInvoice
  } catch {
    throw new Error(`Claude devolvió JSON inválido: ${raw.substring(0, 200)}`)
  }
}
