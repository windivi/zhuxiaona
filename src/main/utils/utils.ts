/**
 * Safely stringify arbitrary values for logging.
 */
export function deepStringify(value: any, opts?: { maxDepth?: number; maxLength?: number }) {
  const maxDepth = opts?.maxDepth ?? 5
  const maxLength = opts?.maxLength ?? 20000
  const seen = new WeakSet()
  function _stringify(v: any, depth: number): string {
    if (v === null) return 'null'
    if (v === undefined) return 'undefined'
    if (typeof v === 'string') return v
    if (typeof v === 'number' || typeof v === 'boolean') return String(v)
    if (typeof v === 'function') return `[Function: ${v.name || 'anonymous'}]`
    if (typeof v === 'symbol') return v.toString()
    if (v instanceof Error) return v.stack || v.message
    if (typeof Buffer !== 'undefined' && (Buffer as any).isBuffer && (Buffer as any).isBuffer(v)) {
      try { return v.toString('utf8') } catch (e) { return '[Buffer]' }
    }
    if (Array.isArray(v)) {
      if (seen.has(v)) return '[Circular]'
      if (depth <= 0) return '[Array]'
      seen.add(v)
      const items = v.slice(0, 50).map((it) => _stringify(it, depth - 1))
      if (v.length > 50) items.push('...')
      return `[${items.join(',')}]`
    }
    if (typeof v === 'object') {
      if (seen.has(v)) return '[Circular]'
      if (depth <= 0) return '[Object]'
      seen.add(v)
      try {
        const keys = Object.keys(v).slice(0, 200)
        const parts = keys.map((k) => {
          let val
          try { val = _stringify((v as any)[k], depth - 1) } catch (e) { val = '[Throws]' }
          return `${k}:${val}`
        })
        if (Object.keys(v).length > keys.length) parts.push('...')
        return `{${parts.join(',')}}`
      } catch (e) { return '[Object]' }
    }
    try { return String(v) } catch (e) { return '[Unknown]' }
  }
  let out = _stringify(value, maxDepth)
  if (out.length > maxLength) out = out.slice(0, maxLength) + '...'
  return out
}
