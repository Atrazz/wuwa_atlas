import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { huiji, SEARCHER } from '../lib/tiers'

// Outbound links for reading further by hand. The text searcher has no public
// query URL, so we copy the Chinese names to the clipboard and open it.
export default function DeepLinks({ people }) {
  const [toast, setToast] = useState(null)
  const zh = people.filter((p) => p.zh)
  const copyOpen = async () => {
    const q = zh.map((p) => p.zh).join(' ')
    try { await navigator.clipboard.writeText(q) } catch { /* clipboard blocked: the toast still shows the text */ }
    setToast(q)
    setTimeout(() => setToast(null), 4000)
    window.open(SEARCHER, '_blank', 'noopener')
  }
  if (!zh.length) return null
  return (
    <div className="deeplinks">
      <span className="dl-label">Read more</span>
      {zh.map((p) => (
        <a key={p.id} href={huiji(p.zh)} target="_blank" rel="noreferrer" title={`${p.id} on the Chinese Huiji wiki`}>
          Huiji · {p.zh} ↗
        </a>
      ))}
      <button onClick={copyOpen} title="Copies the Chinese names and opens the WuWa text searcher">
        Text searcher ↗
      </button>
      <AnimatePresence>
        {toast && (
          <motion.div className="dl-toast" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            Copied <b>{toast}</b> to search with
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
