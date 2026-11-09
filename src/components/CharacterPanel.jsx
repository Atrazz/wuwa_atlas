import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import Avatar from './Avatar'
import DeepLinks from './DeepLinks'
import { TIERS, TIER, ELEMENT, bondLabel, other } from '../lib/tiers'

const panelAnim = {
  initial: { x: 460, opacity: 0 },
  animate: { x: 0, opacity: 1, transition: { type: 'spring', stiffness: 220, damping: 28 } },
  exit: { x: 460, opacity: 0, transition: { duration: 0.25 } },
}

export default function CharacterPanel({ node, links, nodes, onOpen, onClose }) {
  const [filter, setFilter] = useState(null)
  const [more, setMore] = useState(false)
  const mine = useMemo(() => links
    .filter((l) => (l.source.id ?? l.source) === node.id || (l.target.id ?? l.target) === node.id)
    .sort((a, b) => b.score - a.score), [links, node])
  const shown = filter ? mine.filter((l) => l[filter].length) : mine
  const max = mine[0]?.score || 1
  const el = ELEMENT[node.attribute] || ELEMENT['']

  return (
    <motion.aside className="panel" {...panelAnim} style={{ '--el': el }}>
      <button className="close" onClick={onClose} aria-label="Close">✕</button>
      <div className="char-hero">
        {node.card && <img className="char-card" src={node.card} alt="" onError={(e) => (e.currentTarget.style.display = 'none')} />}
        <div className="char-hero-fade" />
        <div className="char-hero-body">
          <Avatar node={node} size={64} glow />
          <div>
            <motion.h2 initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>{node.id}</motion.h2>
            {(node.title || node.zh) && <div className="char-title">{node.title}{node.zh && <span className="zh"> {node.zh}</span>}</div>}
            <div className="chips">
              {node.attribute && <span className="chip el">{node.attribute}</span>}
              {node.weapon && <span className="chip">{node.weapon}</span>}
              {node.rarity > 0 && <span className="chip gold">{'★'.repeat(node.rarity)}</span>}
              {!node.playable && <span className="chip">Story NPC</span>}
              {node.nation && <span className="chip">{node.nation}</span>}
              {node.affiliations?.filter((a) => a !== node.nation).map((a) => <span key={a} className="chip ghost">{a}</span>)}
            </div>
          </div>
        </div>
      </div>

      {node.intro && (
        <div className={'intro' + (more ? ' open' : '')} onClick={() => setMore(!more)}>
          {node.intro.split('\n').filter(Boolean).map((p, i) => <p key={i}>{p}</p>)}
          <span className="intro-more">{more ? 'Less' : 'More'}</span>
        </div>
      )}

      <div className="cp-links"><DeepLinks people={[node]} /></div>
      <div className="section-head">
        <span>Connections</span><span className="count">{mine.length}</span>
        <a className="src" href={node.page} target="_blank" rel="noreferrer">wiki ↗</a>
      </div>
      <div className="tier-filter">
        <button className={!filter ? 'on' : ''} onClick={() => setFilter(null)}>All</button>
        {TIERS.map((t) => {
          const n = mine.filter((l) => l[t.key].length).length
          return n ? (
            <button key={t.key} className={filter === t.key ? 'on' : ''} style={{ '--c': t.color }} onClick={() => setFilter(filter === t.key ? null : t.key)}>
              <i style={{ background: t.color }} />{t.short} <b>{n}</b>
            </button>
          ) : null
        })}
      </div>

      <ul className="bond-list">
        {shown.map((l, i) => {
          const o = nodes[other(l, node.id)]
          const t = TIER[l.vis]
          return (
            <motion.li key={o.id} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(i * 0.025, 0.6) }}
              onClick={() => onOpen(l)} style={{ '--c': t.color }} whileHover={{ x: -4 }}>
              <Avatar node={o} size={38} />
              <div className="bond-main">
                <div className="bond-name">{o.id}</div>
                <div className="bond-label">{bondLabel(l)}</div>
                <div className="bond-bar"><span style={{ width: `${Math.max(6, (l.score / max) * 100)}%` }} /></div>
              </div>
              <div className="bond-tiers">
                {TIERS.filter((x) => l[x.key].length).map((x) => (
                  <span key={x.key} title={`${x.label}: ${l[x.key].length}`} style={{ color: x.color }}>{x.icon}</span>
                ))}
              </div>
            </motion.li>
          )
        })}
        {!shown.length && <li className="empty">Nothing here with the current filters.</li>}
      </ul>
    </motion.aside>
  )
}
