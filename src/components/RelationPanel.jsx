import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Avatar from './Avatar'
import { TIERS, TIER, QUEST_COLOR, bondLabel, facts, actLabel, isKin } from '../lib/tiers'
import Timeline from './Timeline'
import DeepLinks from './DeepLinks'

const panelAnim = {
  initial: { x: 520, opacity: 0 },
  animate: { x: 0, opacity: 1, transition: { type: 'spring', stiffness: 220, damping: 28 } },
  exit: { x: 520, opacity: 0, transition: { duration: 0.25 } },
}

const KIND = { 'Story dialogue': 'Dialogue', 'WavesLine message': 'WavesLine' }
let currentAudio = null
function PlayButton({ src }) {
  const [state, setState] = useState('idle')
  const a = useRef()
  useEffect(() => () => a.current?.pause(), [])
  if (!src) return null
  const toggle = () => {
    if (state === 'playing') { a.current.pause(); setState('idle'); return }
    currentAudio?.pause()
    a.current = a.current || new Audio(src)
    a.current.onended = () => setState('idle')
    a.current.onpause = () => setState('idle')
    a.current.onerror = () => setState('error')
    setState('loading')
    a.current.currentTime = 0
    a.current.play().then(() => setState('playing')).catch(() => setState('error'))
    currentAudio = a.current
  }
  return (
    <button className={'play ' + state} onClick={toggle} title="Play the English voice line">
      {state === 'playing' ? <span className="eq"><i /><i /><i /><i /></span> : state === 'error' ? '✕' : '▶'}
    </button>
  )
}

function Section({ tier, count, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen)
  const t = TIER[tier]
  return (
    <section className="ev-section" style={{ '--c': t.color }}>
      <button className="ev-head" onClick={() => setOpen(!open)} title={t.rule}>
        <span className="ev-icon">{t.icon}</span>
        <span className="ev-title">{t.label}</span>
        <span className="ev-count">{count}</span>
        <span className={'chev' + (open ? ' open' : '')}>⌃</span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div className="ev-body" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}

function QuestCard({ d, a, b, nodes, open: open0 }) {
  const [open, setOpen] = useState(open0)
  const qc = QUEST_COLOR[d.type] || '#9aa4b8'
  return (
    <div className={'quest' + (open ? ' open' : '')}>
      <button className="quest-head" onClick={() => setOpen(!open)}>
        <span className="qtype" style={{ '--q': qc }}>{d.type}</span>
        <span className="qname">{d.quest}</span>
        {d.call > 0 && <span className="qphone" title={`${d.call} exchanges by call`}>☏ {d.channel === 'call' ? 'Call' : d.call}</span>}
        {d.phone > 0 && <span className="qphone" title={`${d.phone} exchanges over WavesLine`}>✉ {d.channel === 'phone' ? 'WavesLine' : d.phone}</span>}
        <span className="qex" title="Back-and-forth lines between the two">{d.exchanges}⇄</span>
      </button>
      {(d.chapter || d.nation) && <div className="qmeta">{[actLabel(d), d.nation].filter(Boolean).join(' · ')}</div>}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="quest-body">
            {d.summary && <p className="qsum">{d.summary}</p>}
            {!d.summary && d.desc && <p className="qsum dim">{d.desc}</p>}
            <Chat lines={d.sample} a={a} b={b} nodes={nodes} phone={d.channel === 'phone'} />
            {d.phoneSample?.length > 0 && <Chat lines={d.phoneSample} a={a} b={b} nodes={nodes} phone />}
            <a className="src" href={d.url} target="_blank" rel="noreferrer">Full quest ↗</a>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function Chat({ lines, a, b, nodes, phone }) {
  return (
            <div className={'chat' + (phone ? ' phone' : '')}>
              {phone && <div className="phone-bar"><span>✉ WavesLine</span><i /></div>}
              {lines.map((s, i) => {
                const side = s.speaker === a ? 'l' : s.speaker === b ? 'r' : 'c'
                return (
                  <motion.div key={i} className={'bubble ' + side} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
                    {side !== 'c' && <Avatar node={nodes[s.speaker]} size={22} />}
                    <div><b>{s.speaker}</b>{s.text}</div>
                  </motion.div>
                )
              })}
            </div>
  )
}

export default function RelationPanel({ link, nodes, perspective, onBack, onClose, onPickNode }) {
  const s = link.source.id ?? link.source, t = link.target.id ?? link.target
  const a = perspective === t ? t : s
  const b = a === s ? t : s
  const A = nodes[a], B = nodes[b]
  const hasRover = a === 'Rover' || b === 'Rover'
  const [showAllQ, setShowAllQ] = useState(false)
  const quests = showAllQ ? link.dialogue : link.dialogue.slice(0, 6)
  const vlA = link.voiceline.filter((v) => v.from === a)
  const vlB = link.voiceline.filter((v) => v.from === b)
  const strength = Math.min(100, Math.round((Math.log2(1 + link.score) / Math.log2(1 + 260)) * 100))

  return (
    <motion.aside className="panel relation" {...panelAnim}>
      <div className="rel-top">
        <button className="back" onClick={onBack}>← {perspective || a}</button>
        <button className="close" onClick={onClose} aria-label="Close">✕</button>
      </div>

      <div className="rel-hero">
        <button className="rel-person" onClick={() => onPickNode(a)}>
          <Avatar node={A} size={72} glow />
          <span>{a}</span>{A.zh && <small className="zh">{A.zh}</small>}
        </button>
        <div className="rel-link">
          <svg viewBox="0 0 120 40" preserveAspectRatio="none">
            <defs>
              <linearGradient id="rl" x1="0" x2="1">
                <stop offset="0" stopColor={TIER[link.strongest].color} stopOpacity=".2" />
                <stop offset=".5" stopColor={TIER[link.strongest].color} />
                <stop offset="1" stopColor={TIER[link.strongest].color} stopOpacity=".2" />
              </linearGradient>
            </defs>
            <path d="M0 20 Q60 2 120 20" className="flow" stroke="url(#rl)" />
            <path d="M0 20 Q60 38 120 20" className="flow rev" stroke="url(#rl)" />
          </svg>
          <span className="rel-strength" style={{ '--c': TIER[link.strongest].color }}>{strength}<small>bond</small></span>
        </div>
        <button className="rel-person" onClick={() => onPickNode(b)}>
          <Avatar node={B} size={72} glow />
          <span>{b}</span>{B.zh && <small className="zh">{B.zh}</small>}
        </button>
      </div>

      <motion.div className="rel-label" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
        {bondLabel(link)}
      </motion.div>
      <p className="rel-desc">{facts(link, a, b).map((f, i) => <span key={i}>{f}</span>)}</p>

      <div className="tier-strip">
        {TIERS.map((x) => (
          <div key={x.key} className={'ts' + (link[x.key].length ? ' has' : '')} style={{ '--c': x.color }} title={x.rule}>
            <span>{x.icon}</span><b>{link[x.key].length}</b><small>{x.short}</small>
          </div>
        ))}
      </div>

      <div className="ev-scroll">
        <Timeline items={link.timeline} />
        {/* Rover is addressed by name constantly, so name-drops of Rover aren't counted:
            for Rover pairs only the WavesLine split is meaningful */}
        {((link.namedrops && !hasRover) || link.phoneTotal > 0 || link.callTotal > 0) && (
          <div className="talkmeter">
            {!hasRover && <div className="tm-head">Says the other’s name</div>}
            {(hasRover ? [] : [a, b]).map((p) => {
              const nd = link.namedrops?.[p]
              const max = Math.max(link.namedrops?.[a]?.times || 0, link.namedrops?.[b]?.times || 0, 1)
              return (
                <div key={p} className="tm-row">
                  <span className="tm-name">{p}</span>
                  <span className="tm-bar"><motion.i initial={{ width: 0 }} animate={{ width: `${((nd?.times || 0) / max) * 100}%` }} transition={{ duration: 0.8, delay: 0.3 }} /></span>
                  <span className="tm-n">{nd ? `${nd.times}× · ${nd.quests} quest${nd.quests > 1 ? 's' : ''}` : '–'}</span>
                </div>
              )
            })}
            {(link.phoneTotal > 0 || link.callTotal > 0) && (
              <div className="tm-foot">Exchanges: <b>{link.talkTotal}</b> in person
                {link.callTotal > 0 && <> · <b>{link.callTotal}</b> by call</>}
                {link.phoneTotal > 0 && <> · <b>{link.phoneTotal}</b> on WavesLine</>}</div>
            )}
          </div>
        )}
        {link.family.length > 0 && (
          <Section tier="family" count={link.family.length}>
            {link.family.map((f, i) => (
              <div key={i} className="ev-card family">
                <div className="fam-line">
                  {isKin(f.role)
                    ? <><b>{f.to}</b> is <b>{f.from}</b>’s <em>{f.role.toLowerCase()}</em></>
                    : <><b>{f.from}</b>’s profile lists <b>{f.to}</b> as {f.field || 'relative'}{f.role && <> · <q>{f.role}</q></>}</>}
                </div>
                <a className="src" href={f.url} target="_blank" rel="noreferrer">{f.from}’s profile ↗</a>
              </div>
            ))}
          </Section>
        )}

        {link.voiceline.length > 0 && (
          <Section tier="voiceline" count={link.voiceline.length}>
            <div className="vl-grid">
              {[[a, b, vlA], [b, a, vlB]].map(([f, to, arr]) => arr.length ? arr.map((v, i) => (
                <motion.figure key={f + i} className={'ev-card vl ' + (f === a ? 'l' : 'r')} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                  <figcaption>
                    <Avatar node={nodes[f]} size={26} />
                    <span><b>{f}</b> on {to}</span>
                    <PlayButton src={v.audio} />
                  </figcaption>
                  <blockquote>{/^["“]/.test(v.text) ? v.text : `“${v.text}”`}</blockquote>
                  <a className="src" href={v.url} target="_blank" rel="noreferrer">{f}’s voice lines ↗</a>
                </motion.figure>
              )) : (
                <div key={f} className="ev-card vl none">
                  <Avatar node={nodes[f]} size={22} /> No voice line from {f}.
                </div>
              ))}
            </div>
          </Section>
        )}

        {link.dialogue.length > 0 && (
          <Section tier="dialogue" count={link.dialogue.length}>
            {quests.map((d, i) => <QuestCard key={d.quest} d={d} a={a} b={b} nodes={nodes} open={i === 0} />)}
            {link.dialogue.length > 6 && (
              <button className="more" onClick={() => setShowAllQ(!showAllQ)}>
                {showAllQ ? 'Show fewer' : `Show all ${link.dialogue.length} quests`}
              </button>
            )}
          </Section>
        )}

        {link.mention.length > 0 && (
          <Section tier="mention" count={link.mention.length}>
            {link.mention.map((m, i) => (
              <figure key={i} className="ev-card mention">
                <figcaption><span className="kind">{KIND[m.kind] || m.kind}</span> <b>{m.from}</b>
                  {m.count > 1 && m.kind !== 'Character story' && <span className="mcount">{m.count}×</span>}</figcaption>
                <blockquote>{/^["“]/.test(m.text) ? m.text : `“${m.text}”`}</blockquote>
                <a className="src" href={m.url} target="_blank" rel="noreferrer">{m.kind === 'Character story' ? `${m.from}’s story “${m.title}”` : m.kind === 'Voice line' ? `${m.from}’s voice lines` : m.title} ↗</a>
              </figure>
            ))}
          </Section>
        )}

        {link.scene.length > 0 && (
          <Section tier="scene" count={link.scene.length} defaultOpen={!link.dialogue.length}>
            <div className="scene-list">
              {link.scene.map((d) => (
                <a key={d.quest} href={d.url} target="_blank" rel="noreferrer" className="scene" style={{ '--q': QUEST_COLOR[d.type] || '#9aa4b8' }}>
                  <i />{d.quest}<small>{d.type}</small>
                </a>
              ))}
            </div>
          </Section>
        )}
        <DeepLinks people={[A, B]} />
        <div className="ev-foot">Quotes from the Wuthering Waves Fandom wiki.</div>
      </div>
    </motion.aside>
  )
}
