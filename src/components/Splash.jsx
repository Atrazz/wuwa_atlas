import { useEffect } from 'react'
import { motion } from 'framer-motion'

export default function Splash({ onDone, count }) {
  useEffect(() => { const t = setTimeout(onDone, 2300); return () => clearTimeout(t) }, [])
  return (
    <motion.div className="splash" onClick={onDone} initial={{ opacity: 1 }} exit={{ opacity: 0, scale: 1.04 }} transition={{ duration: 0.8 }}>
      <div className="splash-rings">
        {[0, 1, 2].map((i) => (
          <motion.span key={i} initial={{ scale: 0.3, opacity: 0 }} animate={{ scale: 1, opacity: 1, rotate: i % 2 ? -90 : 90 }}
            transition={{ duration: 1.8, delay: i * 0.15, ease: [0.2, 0.8, 0.2, 1] }} style={{ inset: `${i * 40}px` }} />
        ))}
      </div>
      <motion.div className="splash-title" initial={{ letterSpacing: '0.9em', opacity: 0 }} animate={{ letterSpacing: '0.35em', opacity: 1 }} transition={{ duration: 1.4 }}>
        RESONANCE ATLAS
      </motion.div>
      <motion.div className="splash-sub" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}>
        {count.n} characters · {count.l} relationships
      </motion.div>
    </motion.div>
  )
}
