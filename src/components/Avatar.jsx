import { ELEMENT } from '../lib/tiers'
export default function Avatar({ node, size = 36, glow }) {
  const ring = node?.playable ? ELEMENT[node.attribute] || ELEMENT[''] : '#9aa4b8'
  return (
    <span className={'avatar' + (node?.playable ? '' : ' npc') + (glow ? ' glow' : '')}
      style={{ width: size, height: size, '--ring': ring }}>
      {node?.image ? <img src={node.image} alt="" loading="lazy" /> : <span>{node?.id?.[0]}</span>}
    </span>
  )
}
