import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function Media() {
  const [images, setImages] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [copiedName, setCopiedName] = useState('')

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase.functions.invoke('list-media', {})
      if (error || data?.error) {
        setError(data?.error || error?.message || 'Could not load the media library.')
      } else {
        setImages(data.images || [])
      }
      setLoading(false)
    }
    load()
  }, [])

  const filtered = images.filter((img) => img.name.toLowerCase().includes(search.toLowerCase()))

  function copyName(name) {
    navigator.clipboard.writeText(name)
    setCopiedName(name)
    setTimeout(() => setCopiedName(''), 1500)
  }

  return (
    <div className="max-w-5xl">
      <h1 className="font-display text-3xl mb-1">Media Library</h1>
      <p className="text-text-soft text-sm mb-6">
        Every photo already on the site, straight from GitHub. Copy a filename to reuse it as a
        reference — the Publish Story form still takes a fresh upload, so this is best for
        checking what's already there before hunting for a new photo.
      </p>

      {error && (
        <div className="mb-5 text-sm bg-red/10 border border-red/20 text-red rounded-md px-4 py-2.5">
          {error}
        </div>
      )}

      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search filenames…"
        className="w-full bg-paper border border-line rounded-md px-3 py-2 text-sm outline-none focus:border-red transition-colors mb-6"
      />

      {loading ? (
        <p className="text-text-faint text-sm">Loading…</p>
      ) : filtered.length === 0 ? (
        <div className="border border-dashed border-line rounded-lg p-10 text-center">
          <p className="text-text-soft text-sm">No images found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {filtered.map((img) => (
            <div key={img.name} className="border border-line rounded-lg overflow-hidden">
              <img src={img.url} alt={img.name} className="w-full h-28 object-cover bg-paper-2" loading="lazy" />
              <div className="p-2.5">
                <div className="text-xs truncate font-mono" title={img.name}>{img.name}</div>
                <div className="text-[10px] text-text-faint mt-0.5">{img.sizeKb} KB</div>
                <button
                  onClick={() => copyName(img.name)}
                  className="text-[11px] mt-1.5 border border-line hover:border-text-faint px-2 py-1 rounded transition-colors w-full"
                >
                  {copiedName === img.name ? 'Copied!' : 'Copy filename'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
