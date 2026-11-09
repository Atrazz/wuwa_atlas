import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import raw from './data/graph.json'
import Graph from './components/Graph.jsx'
import Starfield from './components/Starfield.jsx'
import TopBar from './components/TopBar.jsx'
import Legend from './components/Legend.jsx'
import CharacterPanel from './components/CharacterPanel.jsx'
import RelationPanel from './components/RelationPanel.jsx'
import RulesModal from './components/RulesModal.jsx'
import Splash from './components/Splash.jsx'
import { TIERS } from './lib/tiers'

// stable node/link objects so the simulation keeps positions while filtering
const NODES = raw.nodes.map((n) => ({ ...n }))
const NODE_BY_ID = Object.fromEntries(NODES.map((n) => [n.id, n]))
const LINKS = raw.links.map((l) => ({ ...l }))
const LINK_KEY = (a, b) => [a, b].sort().join('|')
const LINK_BY_KEY = Object.fromEntries(LINKS.map((l) => [LINK_KEY(l.source, l.target), l]))
const lid = (x) => x?.id ?? x

function useSize() {
  const [s, set] = useState({ w: window.innerWidth, h: window.innerHeight })
  useEffect(() => {
    const f = () => set({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener('resize', f)
    return () => window.removeEventListener('resize', f)
  }, [])
  return s
}

export default function App() {
  const { w, h } = useSize()
  const [tiers, setTiers] = useState(() => new Set(['family', 'dialogue', 'voiceline', 'mention']))
  const [showNpc, setShowNpc] = useState(true)
  const [groupByNation, setGroupByNation] = useState(false)
  const [selected, setSelected] = useState(null)
  const [link, setLink] = useState(null)
  const [hoverId, setHoverId] = useState(null)
  const [rules, setRules] = useState(false)
  const [splash, setSplash] = useState(true)

  const data = useMemo(() => {
    const links = []
    const deg = {}
    for (const l of LINKS) {
      const vis = TIERS.find((t) => tiers.has(t.key) && l[t.key].length)
      if (!vis) continue
      const a = NODE_BY_ID[lid(l.source)], b = NODE_BY_ID[lid(l.target)]
      if (!showNpc && (!a.playable || !b.playable)) continue
      l.vis = vis.key
      links.push(l)
      deg[a.id] = (deg[a.id] || 0) + 1
      deg[b.id] = (deg[b.id] || 0) + 1
    }
    const nodes = NODES.filter((n) => (n.playable ? true : showNpc && deg[n.id]))
    for (const n of nodes) n.deg = deg[n.id] || 0
    return { nodes, links }
  }, [tiers, showNpc])

  // keyboard: Esc steps back
  useEffect(() => {
    const f = (e) => {
      if (e.key !== 'Escape') return
      if (rules) setRules(false)
      else if (link) setLink(null)
      else setSelected(null)
    }
    window.addEventListener('keydown', f)
    return () => window.removeEventListener('keydown', f)
  }, [rules, link])

  const selectNode = (id) => { setSelected(id); setLink(null) }
  const openLink = (l) => {
    setLink(l)
    if (!selected || (lid(l.source) !== selected && lid(l.target) !== selected)) setSelected(lid(l.source))
  }
  const openPair = (a, b) => { const l = LINK_BY_KEY[LINK_KEY(a, b)]; if (l) openLink(l) }

  const toggleTier = (k) => setTiers((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n.size ? n : s })

  return (
    <div className="app">
      <Starfield />
      <div className="vignette" />
      <div className="graph-layer">
        <Graph
          data={data}
          tiers={tiers}
          selected={selected}
          focusLink={link}
          hoverId={hoverId}
          onHover={setHoverId}
          onSelect={selectNode}
          onLinkSelect={openLink}
          groupByNation={groupByNation}
          width={w}
          height={h}
        />
      </div>

      <TopBar
        nodes={NODES}
        onPick={selectNode}
        showNpc={showNpc} setShowNpc={setShowNpc}
        groupByNation={groupByNation} setGroupByNation={setGroupByNation}
        onRules={() => setRules(true)}
        stats={{ nodes: data.nodes.length, links: data.links.length }}
      />
      <Legend tiers={tiers} toggle={toggleTier} links={LINKS} />

      <AnimatePresence mode="wait">
        {link ? (
          <RelationPanel key={'L' + lid(link.source) + lid(link.target)} link={link} nodes={NODE_BY_ID}
            perspective={selected} onBack={() => setLink(null)} onClose={() => { setLink(null); setSelected(null) }}
            onPickNode={selectNode} />
        ) : selected ? (
          <CharacterPanel key={'C' + selected} node={NODE_BY_ID[selected]} links={data.links} allLinks={LINKS}
            nodes={NODE_BY_ID} onOpen={openLink} onClose={() => setSelected(null)} />
        ) : null}
      </AnimatePresence>

      {!selected && !splash && (
        <motion.div className="hint" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
          Select a character or a line
        </motion.div>
      )}

      <AnimatePresence>{rules && <RulesModal onClose={() => setRules(false)} meta={raw} onExample={() => { setRules(false); openPair('Chixia', 'Yangyang') }} />}</AnimatePresence>
      <AnimatePresence>{splash && <Splash onDone={() => setSplash(false)} count={{ n: NODES.length, l: LINKS.length }} />}</AnimatePresence>
    </div>
  )
}
