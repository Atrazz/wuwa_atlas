// Evidence tiers — the "rules" for how a relationship is classified.
// Order matters: strongest first.
export const TIERS = [
  { key: 'family', label: 'Family', short: 'Family', color: '#f2c86b', icon: '◆',
    rule: 'Listed as relatives or guardian on the wiki profile.' },
  { key: 'dialogue', label: 'Conversation', short: 'Talked', color: '#5ee6ff', icon: '❖',
    rule: 'Speak to each other in a quest, in person or on WavesLine.' },
  { key: 'voiceline', label: 'Voice line', short: 'Voice line', color: '#b38cff', icon: '♪',
    rule: 'Has an “About …” voice line for the other.' },
  { key: 'mention', label: 'Mention', short: 'Mentioned', color: '#ff8fb1', icon: '✦',
    rule: 'Named in a voice line, character story or story dialogue.' },
  { key: 'scene', label: 'Same scene', short: 'Same quest', color: '#7f8ea6', icon: '○',
    rule: 'In the same quest without speaking to each other.' },
]
export const TIER = Object.fromEntries(TIERS.map((t) => [t.key, t]))

export const ELEMENT = {
  Aero: '#55f0b5', Glacio: '#4cc4ee', Fusion: '#f0744e', Electro: '#b46bff',
  Spectro: '#f5e27a', Havoc: '#e04f9f', Multiple: '#e8c77a', '': '#8a93a6',
}

export const QUEST_COLOR = {
  Main: '#e8c77a', Companion: '#ff9ec4', Tales: '#ff9ec4', Episodic: '#ff9ec4', Side: '#7fd4ff',
  Exploration: '#8ce0a8', Event: '#c8a2ff', 'Leisure Event': '#c8a2ff', Daily: '#9aa4b8', Tutorial: '#9aa4b8',
}

export const other = (link, id) => (link.source.id ?? link.source) === id ? (link.target.id ?? link.target) : (link.source.id ?? link.source)

// Wiki family notes are free text ("past self", "adopted by former self"). Only plain
// kinship words are safe to read as "<to> is <from>'s <note>".
const KIN = /^(adoptive |younger |older |elder |half-|step-?|distant )*(sister|brother|sibling|mother|father|parent|aunt|uncle|grandfather|grandmother|cousin|daughter|son|niece|nephew|ward|guardian|relative|student\/ward|student|teacher)(, .*)?$/i
export const isKin = (role) => KIN.test((role || '').trim())

export function bondLabel(l) {
  if (l.family?.length) return 'Family'
  const vl = l.voiceline.length
  const vMutual = new Set(l.voiceline.map((v) => v.from)).size > 1
  const d = l.dialogue.length
  if (d >= 6 && vMutual) return 'Close companions'
  if (d >= 6) return 'Often together'
  if (d >= 1 && vl) return 'Acquainted'
  if (d >= 1) return 'Have met'
  if (vl) return 'Know of each other'
  if (l.mention.length) return 'Linked in lore'
  return 'Crossed paths'
}

export function tierCounts(l) {
  return TIERS.map((t) => ({ ...t, n: l[t.key]?.length || 0 })).filter((t) => t.n)
}

// A few short facts for the relationship header.
export function facts(l, a, b) {
  const out = []
  const kin = l.family.filter((f) => isKin(f.role))
  for (const f of kin) out.push(`${f.to}: ${f.role.toLowerCase()}`)
  if (l.family.length && !kin.length) out.push('family link on the wiki profiles')
  if (l.dialogue.length) {
    const main = l.dialogue.filter((d) => d.type === 'Main').length
    out.push(`${l.dialogue.length} quest${l.dialogue.length > 1 ? 's' : ''} together${main ? ` (${main} main)` : ''}`)
    const ex = l.dialogue.reduce((s, d) => s + d.exchanges, 0)
    out.push(`${ex} line${ex > 1 ? 's' : ''} exchanged`)
  }
  const froms = [...new Set(l.voiceline.map((v) => v.from))]
  if (froms.length === 2) out.push('voice lines both ways')
  else if (froms.length === 1) out.push(`voice line from ${froms[0]}`)
  if (!out.length && l.scene.length) out.push(`${l.scene.length} shared quest${l.scene.length > 1 ? 's' : ''}, no conversation`)
  return out
}

export const huiji = (zh) => `https://wuwa.huijiwiki.com/wiki/${encodeURIComponent(zh)}`
export const SEARCHER = 'https://mc.yakitahome.com/search'
export const actLabel = (d) => [d.chapter, d.actNum && (/^[IVX]+$/.test(d.actNum) ? `Act ${d.actNum}` : d.actNum)].filter(Boolean).join(' · ')
