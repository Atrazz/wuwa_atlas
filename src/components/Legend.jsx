import { motion } from 'framer-motion'
import { TIERS } from '../lib/tiers'

export default function Legend({ tiers, toggle, links }) {
  const counts = Object.fromEntries(TIERS.map((t) => [t.key, links.filter((l) => l[t.key].length).length]))
  return (
    <motion.div className="legend" initial={{ x: -30, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 2.1, duration: 0.6 }}>
      <div className="legend-title">Evidence <span>strongest first</span></div>
      {TIERS.map((t, i) => (
        <motion.button key={t.key} className={'legend-row' + (tiers.has(t.key) ? ' on' : '')} onClick={() => toggle(t.key)}
          style={{ '--c': t.color }} whileHover={{ x: 4 }} title={t.rule}>
          <span className={'legend-line ' + t.key} />
          <span className="legend-label">{t.label}</span>
          <span className="legend-n">{counts[t.key]}</span>
        </motion.button>
      ))}
      <div className="legend-foot">Click to show or hide</div>
    </motion.div>
  )
}
