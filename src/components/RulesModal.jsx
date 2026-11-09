import { motion } from 'framer-motion'
import { TIERS } from '../lib/tiers'

export default function RulesModal({ onClose, meta, onExample }) {
  return (
    <motion.div className="modal-bg" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div className="modal" onClick={(e) => e.stopPropagation()}
        initial={{ y: 40, scale: 0.96, opacity: 0 }} animate={{ y: 0, scale: 1, opacity: 1 }} exit={{ y: 20, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 240, damping: 26 }}>
        <button className="close" onClick={onClose}>✕</button>
        <h2>How it works</h2>
        <p className="lead">Every connection links back to a quote on the wiki. When a pair has several kinds of evidence, the line takes the colour of the strongest.</p>
        <ol className="rules">
          {TIERS.map((t, i) => (
            <motion.li key={t.key} style={{ '--c': t.color }} initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 + i * 0.06 }}>
              <span className="r-icon">{t.icon}</span>
              <div><h3>{t.label}</h3><p>{t.rule}</p></div>
            </motion.li>
          ))}
        </ol>
        <dl className="rules-notes">
          <dt>Bond score</dt>
          <dd>Family 40 · voice line 10 · conversation 6–18 per quest · mention 3 · same scene 1. Sets line thickness and list order.</dd>
          <dt>Main story</dt>
          <dd>Quests in story order. Filled dot: they talk. Hollow dot: both present.</dd>
          <dt>Names</dt>
          <dd>Rover’s variants and Yangyang: Xuanling are merged. Same-scene links are hidden until you turn them on.</dd>
          <dt>Sources</dt>
          <dd><a href={meta.source} target="_blank" rel="noreferrer">Fandom wiki</a>, {meta.pagesParsed} pages, {meta.generated}. Further reading: <a href="https://wuwa.huijiwiki.com/" target="_blank" rel="noreferrer">Huiji wiki</a>, <a href="https://mc.yakitahome.com/" target="_blank" rel="noreferrer">text searcher</a>.</dd>
        </dl>
        <button className="pill gold" onClick={onExample}>Example: Yangyang & Chixia →</button>
      </motion.div>
    </motion.div>
  )
}
