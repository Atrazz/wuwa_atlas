import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import ForceGraph2D from 'react-force-graph-2d'
import { forceCollide, forceX, forceY } from 'd3-force'
import { TIER, TIERS, ELEMENT, other } from '../lib/tiers'

const imgCache = {}
function img(src) {
  if (!src) return null
  if (!imgCache[src]) {
    const i = new Image()
    i.src = src
    imgCache[src] = i
  }
  return imgCache[src]
}

const NATION_ANCHOR = {
  Huanglong: [-260, -40], Rinascita: [260, -20], 'Lahai-Roi': [40, 260],
  'The Black Shores': [-60, -260], 'Night City': [300, 240], '': [0, 0],
}

function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`
}

export default function Graph({ data, tiers, selected, focusLink, hoverId, onHover, onSelect, onLinkSelect, groupByNation, width, height }) {
  const fg = useRef()
  const [hoverLink, setHoverLink] = useState(null)
  const t0 = useRef(performance.now())

  // neighbours of the selected node
  const neigh = useMemo(() => {
    const s = new Set()
    if (!selected) return s
    for (const l of data.links) {
      const a = l.source.id ?? l.source, b = l.target.id ?? l.target
      if (a === selected) s.add(b)
      if (b === selected) s.add(a)
    }
    return s
  }, [data, selected])

  useEffect(() => {
    const g = fg.current
    if (!g) return
    g.d3Force('charge').strength(-260).distanceMax(700)
    g.d3Force('link')
      .distance((l) => 150 - Math.min(l.score, 120) * 0.6)
      .strength((l) => Math.min(0.08 + l.score / 400, 0.6))
    g.d3Force('collide', forceCollide(30))
    if (groupByNation) {
      g.d3Force('x', forceX((n) => (NATION_ANCHOR[n.nation] || [0, 0])[0]).strength(0.12))
      g.d3Force('y', forceY((n) => (NATION_ANCHOR[n.nation] || [0, 0])[1]).strength(0.12))
    } else {
      g.d3Force('x', forceX(0).strength(0.03))
      g.d3Force('y', forceY(0).strength(0.03))
    }
    g.d3ReheatSimulation()
  }, [groupByNation, data])

  // centre on selection
  useEffect(() => {
    const g = fg.current
    if (!g || !selected) return
    const n = data.nodes.find((x) => x.id === selected)
    if (n && n.x != null) {
      g.centerAt(n.x + 60, n.y, 900)
      g.zoom(Math.max(g.zoom(), 1.6), 900)
    }
  }, [selected])

  useEffect(() => {
    const id = setTimeout(() => fg.current?.zoomToFit(1200, 80), 1800)
    return () => clearTimeout(id)
  }, [])

  const isLinkActive = useCallback((l) => {
    if (focusLink && l === focusLink) return true
    if (!selected) return true
    return (l.source.id ?? l.source) === selected || (l.target.id ?? l.target) === selected
  }, [selected, focusLink])

  const drawNode = useCallback((node, ctx, scale) => {
    const t = (performance.now() - t0.current) / 1000
    const isSel = node.id === selected
    const isNeigh = neigh.has(node.id)
    const dim = selected && !isSel && !isNeigh
    const isHover = node.id === hoverId
    const inFocusLink = focusLink && (focusLink.source.id === node.id || focusLink.target.id === node.id)
    const r = node.playable ? (node.id === 'Rover' ? 17 : 13) : 10
    const R = r * (isSel ? 1.5 : isHover || inFocusLink ? 1.25 : 1)
    const ring = ELEMENT[node.attribute] || ELEMENT['']

    ctx.save()
    ctx.globalAlpha = dim ? 0.13 : 1

    // halo
    if (isSel || isHover || inFocusLink) {
      const pulse = 1 + 0.12 * Math.sin(t * 3)
      const grd = ctx.createRadialGradient(node.x, node.y, R * 0.8, node.x, node.y, R * 2.6 * pulse)
      grd.addColorStop(0, hexA(ring, 0.55))
      grd.addColorStop(1, hexA(ring, 0))
      ctx.fillStyle = grd
      ctx.beginPath(); ctx.arc(node.x, node.y, R * 2.6 * pulse, 0, Math.PI * 2); ctx.fill()
      // rotating rune ring
      ctx.strokeStyle = hexA('#e8c77a', 0.85)
      ctx.lineWidth = 1 / scale * 1.2
      ctx.setLineDash([4 / scale, 6 / scale])
      ctx.lineDashOffset = -t * 20 / scale
      ctx.beginPath(); ctx.arc(node.x, node.y, R + 6, 0, Math.PI * 2); ctx.stroke()
      ctx.setLineDash([])
    }

    // portrait
    ctx.beginPath(); ctx.arc(node.x, node.y, R, 0, Math.PI * 2)
    ctx.fillStyle = '#0d121b'; ctx.fill()
    const im = img(node.image)
    if (im && im.complete && im.naturalWidth) {
      ctx.save(); ctx.clip()
      const s = node.playable ? 1 : 1
      const w = im.naturalWidth, h = im.naturalHeight
      // npc art is often full-body: crop top square
      const side = Math.min(w, h)
      const sy = node.playable ? 0 : Math.max(0, h * 0.04)
      ctx.drawImage(im, (w - side) / 2, sy, side, side, node.x - R * s, node.y - R * s, R * 2 * s, R * 2 * s)
      ctx.restore()
    }
    ctx.lineWidth = (isSel ? 2.4 : 1.6) / Math.sqrt(scale)
    ctx.strokeStyle = node.playable ? ring : '#9aa4b8'
    ctx.beginPath(); ctx.arc(node.x, node.y, R, 0, Math.PI * 2); ctx.stroke()
    if (!node.playable) {
      ctx.setLineDash([2, 2]); ctx.strokeStyle = 'rgba(255,255,255,.35)'
      ctx.beginPath(); ctx.arc(node.x, node.y, R + 2.5, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([])
    }

    // label
    if (scale > 0.9 || isSel || isHover || isNeigh) {
      const fs = 10.5 * (isSel ? 1.2 : 1)
      ctx.save()
      ctx.translate(node.x, node.y + R + 3 / scale)
      ctx.scale(1 / scale, 1 / scale)
      ctx.font = `${isSel ? 600 : 500} ${fs}px Inter, sans-serif`
      ctx.textAlign = 'center'; ctx.textBaseline = 'top'
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(5,7,11,.9)'
      ctx.strokeText(node.id, 0, 0)
      ctx.fillStyle = isSel ? '#f5dc9d' : 'rgba(232,236,245,.92)'
      ctx.fillText(node.id, 0, 0)
      ctx.restore()
    }
    ctx.restore()
  }, [selected, neigh, hoverId, focusLink])

  const linkColor = useCallback((l) => {
    const tier = TIER[l.vis]
    const active = isLinkActive(l)
    const strong = selected || hoverLink === l || focusLink === l
    if (!active) return 'rgba(120,130,150,0.025)'
    return hexA(tier.color, strong ? 0.9 : l.vis === 'scene' ? 0.18 : 0.35)
  }, [isLinkActive, selected, hoverLink, focusLink])

  return (
    <ForceGraph2D
      ref={fg}
      width={width}
      height={height}
      graphData={data}
      backgroundColor="rgba(0,0,0,0)"
      nodeRelSize={13}
      nodeCanvasObject={drawNode}
      nodePointerAreaPaint={(n, color, ctx) => { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(n.x, n.y, 16, 0, Math.PI * 2); ctx.fill() }}
      linkColor={linkColor}
      linkWidth={(l) => (isLinkActive(l) ? 0.6 + Math.log2(1 + l.score) * (selected || focusLink === l || hoverLink === l ? 0.55 : 0.28) : 0.3)}
      linkLineDash={(l) => (l.vis === 'scene' ? [3, 3] : l.vis === 'mention' ? [1, 3] : null)}
      linkCurvature={0.12}
      linkDirectionalParticles={(l) => (selected && isLinkActive(l)) || focusLink === l || hoverLink === l ? Math.min(1 + Math.round(l.score / 25), 5) : 0}
      linkDirectionalParticleWidth={(l) => (focusLink === l ? 4 : 2.6)}
      linkDirectionalParticleSpeed={(l) => 0.004 + Math.min(l.score, 100) / 25000}
      linkDirectionalParticleColor={(l) => TIER[l.vis].color}
      linkHoverPrecision={6}
      onLinkHover={(l) => { setHoverLink(l); document.body.style.cursor = l ? 'pointer' : '' }}
      onNodeHover={(n) => { onHover(n?.id || null); document.body.style.cursor = n ? 'pointer' : '' }}
      onNodeClick={(n) => onSelect(n.id)}
      onLinkClick={(l) => onLinkSelect(l)}
      onBackgroundClick={() => onSelect(null)}
      autoPauseRedraw={false}
      cooldownTicks={300}
      d3VelocityDecay={0.3}
      warmupTicks={40}
      minZoom={0.3}
      maxZoom={6}
    />
  )
}
