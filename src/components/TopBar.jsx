import { useMemo, useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Avatar from './Avatar'

export default function TopBar({ nodes, onPick, showNpc, setShowNpc, groupByNation, setGroupByNation, onRules, stats }) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [idx, setIdx] = useState(0)
  const box = useRef()
  const hits = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return []
    return nodes.filter((n) => n.id.toLowerCase().includes(s) || n.title?.toLowerCase().includes(s) || n.affiliations?.some((a) => a.toLowerCase().includes(s))).slice(0, 8)
  }, [q, nodes])
  useEffect(() => {
    const f = (e) => { if (e.key === '/' && document.activeElement.tagName !== 'INPUT') { e.preventDefault(); box.current?.focus() } }
    addEventListener('keydown', f); return () => removeEventListener('keydown', f)
  }, [])
  const pick = (n) => { onPick(n.id); setQ(''); setOpen(false); box.current?.blur() }

  return (
    <motion.header className="topbar" initial={{ y: -30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 1.9, duration: 0.6 }}>
      <div className="brand">
        <div className="brand-mark"><span /><span /></div>
        <div>
          <div className="brand-title">RESONANCE ATLAS</div>
          <div className="brand-sub">Wuthering Waves character relationships</div>
        </div>
      </div>

      <div className="search">
        <span className="search-icon">⌕</span>
        <kbd className="search-kbd">/</kbd>
        <input ref={box} value={q} placeholder="Search characters or factions"
          onChange={(e) => { setQ(e.target.value); setOpen(true); setIdx(0) }}
          onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') setIdx((i) => Math.min(i + 1, hits.length - 1))
            if (e.key === 'ArrowUp') setIdx((i) => Math.max(i - 1, 0))
            if (e.key === 'Enter' && hits[idx]) pick(hits[idx])
          }} />
        <AnimatePresence>
          {open && hits.length > 0 && (
            <motion.ul className="search-drop" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
              {hits.map((n, i) => (
                <li key={n.id} className={i === idx ? 'on' : ''} onMouseDown={() => pick(n)} onMouseEnter={() => setIdx(i)}>
                  <Avatar node={n} size={28} />
                  <span className="sd-name">{n.id}</span>
                  <span className="sd-meta">{n.playable ? n.title : 'NPC'}</span>
                </li>
              ))}
            </motion.ul>
          )}
        </AnimatePresence>
      </div>

      <div className="controls">
        <button className={'pill' + (showNpc ? ' on' : '')} onClick={() => setShowNpc(!showNpc)} title="Story NPCs who talk with several Resonators">
          <i className="dot" /> NPCs
        </button>
        <button className={'pill' + (groupByNation ? ' on' : '')} onClick={() => setGroupByNation(!groupByNation)} title="Cluster by home nation">
          <i className="dot" /> Group by nation
        </button>
        <button className="pill gold" onClick={onRules}>How it works</button>
        <span className="stat">{stats.nodes} characters · {stats.links} links</span>
      </div>
    </motion.header>
  )
}
