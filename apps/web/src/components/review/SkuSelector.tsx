import { useState, useEffect } from 'react'
import { catalogApi, type Sku } from '../../lib/api'

type Props = {
  value: Sku | null
  onChange: (sku: Sku) => void
}

export function SkuSelector({ value, onChange }: Props) {
  const [query, setQuery] = useState(value?.name ?? '')
  const [results, setResults] = useState<Sku[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (query.length < 2) {
      setResults([])
      return
    }
    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const { data } = await catalogApi.searchSkus(query)
        setResults(data.data)
        setOpen(true)
      } finally {
        setLoading(false)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [query])

  return (
    <div className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        placeholder="Buscar SKU..."
        className="w-full border rounded px-2 py-1 text-sm"
      />
      {loading && (
        <span className="absolute right-2 top-1.5 text-gray-400 text-xs">...</span>
      )}
      {open && results.length > 0 && (
        <ul className="absolute z-10 mt-1 w-full bg-white border rounded shadow-lg max-h-48 overflow-y-auto">
          {results.map((sku) => (
            <li
              key={sku.id}
              onClick={() => {
                onChange(sku)
                setQuery(sku.name)
                setOpen(false)
              }}
              className="px-3 py-2 hover:bg-blue-50 cursor-pointer text-sm"
            >
              <span className="font-medium">{sku.name}</span>
              <span className="text-gray-400 ml-2 text-xs">{sku.code} · {sku.unit}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
