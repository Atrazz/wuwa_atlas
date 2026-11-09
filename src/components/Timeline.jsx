import { useState } from 'react'
import { motion } from 'framer-motion'
import { actLabel } from '../lib/tiers'

// Main-story quests the two share, in story order (from the wiki's prev/next quest chain).
export default function Timeline({ items, total }) {
  const [hover, setHover] = useState(null)
  if (!items?.length) return null
  const chapters = []
  for (const it of items) {
    const c = it.chapter || 'Prologue'
    if (!chapters.length || chapters[chapters.length - 1].c !== c) chapters.push({ c, items: [] })
    chapters[chapters.length - 1].items.push(it)
  }
  const shown = hover ?? items[0]
  return (
    <div className="timeline">
      <div className="tl-head">
        <span>Main story</span>
        <small>{items.length} quest{items.length > 1 ? 's' : ''}</small>
      </div>
      <div className="tl-track">
        {chapters.map((ch, ci) => (
          <div className="tl-chapter" key={ci} style={{ flex: ch.items.length }}>
            <div className="tl-dots">
              {ch.items.map((it, i) => (
                <motion.a key={it.quest} href={it.url} target="_blank" rel="noreferrer"
                  className={'tl-dot' + (it.talked ? ' talked' : '') + (shown === it ? ' on' : '')}
                  initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.25 + (ci * 3 + i) * 0.04 }}
                  onMouseEnter={() => setHover(it)} onMouseLeave={() => setHover(null)}
                  style={{ '--size': `${8 + Math.min(it.n, 60) / 6}px` }} />
              ))}
            </div>
            <div className="tl-cname">{ch.c.replace('Chapter ', 'Ch. ')}</div>
          </div>
        ))}
      </div>
      <div className="tl-caption">
        {shown === items[0] && !hover ? <b>First together: </b> : null}
        <span className="tl-q">{shown.quest}</span>
        <span className="dim"> · {actLabel(shown) || 'Main story'} · {shown.talked ? `${shown.n} lines` : 'present, no exchange'}</span>
      </div>
    </div>
  )
}
