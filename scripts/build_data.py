"""Turn the raw wiki dump (scripts/raw) into src/data/graph.json.

Every relationship in the output is backed by evidence pulled verbatim from the
Wuthering Waves Fandom wiki. Nothing is invented; labels come from the wiki's own
infobox notes, voice-line titles and quest dialogue.

Evidence tiers (strongest first):
  family    - listed as kin/guardian in the character infobox
  dialogue  - the two characters talk to each other on-screen (in person or by WavesLine)
  voiceline - one has a dedicated "About <other>" voice line
  mention   - named in passing in a voice line or official character story, or
              brought up by name in someone's story dialogue
  scene     - both appear in the same quest, but never address each other directly

Extra analysis: WavesLine (in-game phone) vs in-person conversations, main-story
order via the quests' prev/next chain, and Chinese names for cross-referencing.
"""
import json, os, re, collections, datetime

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, "raw")
OUT = os.path.join(HERE, "..", "src", "data", "graph.json")
WIKI = "https://wutheringwaves.fandom.com/wiki/"


def _opt(n, default=None):
    p = os.path.join(RAW, n)
    return json.load(open(p)) if os.path.exists(p) else ({} if default is None else default)


res_titles = _opt("resonators.json", [])
chars_wt = _opt("characters_wikitext.json")
quests_wt = _opt("quests_wikitext.json")
extra_wt = _opt("extra_wikitext.json")
npc_wt = _opt("npc_wikitext.json")
images = _opt("images.json")
icons = _opt("icons.json")
audio = _opt("audio.json")
npc_images = _opt("npc_images.json")


# ---------------------------------------------------------------- names
def canon(name):
    n = re.sub(r"\s+", " ", name.replace("_", " ")).strip().strip('"').strip()
    if n in ("{{Rover}}", "(Rover)", "Rover") or n.startswith("Rover-") or n.startswith("Rover ("):
        return "Rover"
    if n in ("The Shorekeeper", "Shorekeeper"): return "Shorekeeper"
    if n.startswith("Yangyang: "): return "Yangyang"
    if n == "Hsin the Moon Fox": return "Hsin"
    if n == "Luuk": return "Luuk Herssen"
    return n


PLAYABLE = []
for t in res_titles:
    c = canon(t)
    if c not in PLAYABLE: PLAYABLE.append(c)


# ---------------------------------------------------------------- wikitext cleaning
def _tpl(inner):
    parts = [p.strip() for p in inner.split("|")]
    name = parts[0].lower()
    args = [p for p in parts[1:] if "=" not in p.split(" ")[0]]
    if name == "rover": return "Rover"
    if name in ("a", "icon", "icon/quest", "dialogue start", "dialogue end", "clr", "s"): return ""
    if name == "extra effect": return args[0] if args else ""
    if name == "color": return args[-1] if args else ""
    if name == "rubi": return args[0] if args else ""
    if name in ("w", "lang"): return args[0] if args else ""
    if name == "wavesline":
        m = re.search(r"text\s*=\s*(.*)", inner, re.S); return m.group(1) if m else ""
    return args[-1] if args and len(args[-1]) < 60 else ""


def clean(t):
    t = re.sub(r"<ref[^>]*/>", "", t)
    t = re.sub(r"<ref[^>]*>.*?</ref>", "", t, flags=re.S)
    t = re.sub(r"<!--.*?-->", "", t, flags=re.S)
    for _ in range(6):
        t2 = re.sub(r"\{\{([^{}]*)\}\}", lambda m: _tpl(m.group(1)), t)
        if t2 == t: break
        t = t2
    t = re.sub(r"\[\[(?:File|Image):[^\]]*\]\]", "", t)
    t = re.sub(r"\[\[(?:[^|\]]*\|)?([^\]]+)\]\]", r"\1", t)
    t = re.sub(r"\[https?://\S+ ([^\]]+)\]", r"\1", t)
    t = re.sub(r"<br\s*/?>", " ", t)
    t = re.sub(r"<[^>]+>", "", t)
    t = t.replace("'''", "").replace("''", "")
    return re.sub(r"[ \t]+", " ", t).strip()


def sentences(t):
    return [s.strip() for s in re.split(r"(?<=[.!?…”\"])\s+(?=[A-Z“\"])", t) if s.strip()]


def infobox(wt, name="Resonator Infobox"):
    m = re.search(r"\{\{" + name + r"(.*?)\n\}\}", wt, re.S)
    if not m: return {}
    return {k: v.strip() for k, v in re.findall(r"^\|[ \t]*(\w+)[ \t]*=[ \t]*(.*)$", m.group(1), re.M)}


def zh_name(wt):
    m = re.search(r"\|[ \t]*(?:1_)?zhs[ \t]*=[ \t]*(.*)", wt or "")
    return clean(m.group(1)) if m else ""


def link_target(v):
    m = re.search(r"\[\[([^|\]]+)", v or "")
    return (m.group(1) if m else (v or "")).strip()


# ---------------------------------------------------------------- dialogue parsing
SPEAK = re.compile(r"'''\s*(\{\{Rover\}\}|[^'\n]{1,40}?)\s*:\s*'''\s*(.*)")
TRAILING_SPEAKER = re.compile(r"'''[^']*:'''.*")


AUDIO = re.compile(r"\{\{A\|([^}|]+?)\.ogg")
QUALIFIED = re.compile(r"^(.*?)\s*\(([^)]*)\)$")


def speaker(raw_name):
    """'Jiyan (Contacting)' -> ('Jiyan', 'call'); '??? (Cristoforo)' -> ('Cristoforo', 'talk');
    'Cosmos (Encore)' -> ('Cosmos', 'talk'): the bracket is only who it really is when the name is hidden."""
    name = clean(raw_name)
    if name in ("{{Rover}}", "(Rover)") or name.startswith("Rover"):
        return canon(name), "talk"
    m = QUALIFIED.match(name)
    if not m:
        return canon(name), "talk"
    base, qual = m.group(1).strip(), m.group(2).strip()
    if re.fullmatch(r"\?+", base) and qual and qual != "Contacting":
        return canon(qual), "talk"
    return canon(base), "call" if qual.lower() == "contacting" else "talk"


def audio_scene(raw):
    """Voice files are named '<quest id> <scene> <line>[ m|f]' or '<id>_<scene>_<line>[_M|_F]';
    everything but the line number identifies the scene, so a change means a cut."""
    m = AUDIO.search(raw)
    if not m: return None
    name = re.sub(r"^Vo\s+", "", m.group(1).strip(), flags=re.I)
    name = re.sub(r"[\s_][mfMF]$", "", name)
    tokens = [t for t in re.split(r"[\s_]+", name) if t]
    if len(tokens) < 2 or not tokens[-1].isdigit(): return None
    return tuple(tokens[:-1])


def parse_dialogue(wt):
    """-> list of (speaker, text, channel) with None marking a break between scenes.
    channel: 'phone' inside a {{WavesLine}} block, 'call' for '(Contacting)' speakers, else 'talk'.
    Breaks: '----' rules, blank lines (a gameplay beat), section/step headers,
    {{Dialogue Start/End}}, and a change of scene number in the voice-file names."""
    i = wt.find("==Dialogue")
    if i < 0: i = wt.find("{{Dialogue Start")
    body = wt[i:] if i >= 0 else ""
    lines, phone, depth, scene = [], False, 0, None
    brk = lambda: lines and lines[-1] is not None and lines.append(None)
    for raw in body.split("\n"):
        s = raw.strip()
        if "{{WavesLine" in raw and not phone:
            brk()
            phone, depth = True, 0
        if phone:
            depth += raw.count("{{") - raw.count("}}")
        sc = audio_scene(raw)
        if sc and scene and sc != scene: brk()
        if sc: scene = sc
        if (not s or s.startswith("----") or s.startswith(";") or s.startswith("==")
                or s.startswith("{{Dialogue Start") or s.startswith("{{Dialogue End")):
            brk()
        elif "{Choice}" not in raw:
            for m in SPEAK.finditer(raw):
                spk, ch = speaker(m.group(1))
                txt = TRAILING_SPEAKER.sub("", clean(m.group(2))).strip()
                if txt and spk: lines.append((spk, txt, "phone" if phone else ch))
        if phone and depth <= 0:
            phone = False
            brk()
    return lines


QTYPE_ORDER = {"Main": 0, "Companion": 1, "Tales": 1, "Episodic": 1, "Side": 2, "Exploration": 3,
               "Event": 4, "Leisure Event": 4, "Daily": 5, "Overworld": 6, "Tutorial": 6, "Other": 7}

quests = {}
speaker_quests = collections.Counter()
for title, wt in quests_wt.items():
    ib = infobox(wt, "Quest Infobox")
    if not ib: continue
    dia = parse_dialogue(wt)
    listed = {canon(x) for x in ib.get("characters", "").split(";") if x.strip()}
    # A cast entry such as "Lily (Rinascita)" (an Averardo Vault worker) with no plain "Lily" means
    # this quest's "Lily:" lines belong to that namesake, not to the playable Resonator.
    namesakes = {m.group(1).strip(): x for x in listed for m in [QUALIFIED.match(x)]
                 if m and m.group(1).strip() in PLAYABLE and m.group(1).strip() not in listed and m.group(1).strip() != "Rover"}
    if namesakes:
        dia = [(namesakes.get(l[0], l[0]),) + tuple(l[1:]) if l else l for l in dia]
    speakers = {l[0] for l in dia if l}
    summ = ""
    m = re.search(r"==\s*Summary\s*==(.*?)(\n==[^=])", wt, re.S)
    if m:
        summ = clean(re.sub(r"<small>.*?</small>", "", m.group(1), flags=re.S))
        summ = re.sub(r"^\s*Description\|", "", summ)
    quests[title] = dict(title=title, page=title, type=ib.get("type", "").strip() or "Other",
                         chapter=clean(ib.get("chapter", "")), act=clean(ib.get("act", "")),
                         actNum=clean(ib.get("actNum", "")), nation=clean(ib.get("nation", "")),
                         desc=clean(ib.get("description", "")), summary=summ, dialogue=dia,
                         present=listed | speakers, prev=ib.get("prev", ""), next=ib.get("next", ""))
    for s in speakers: speaker_quests[s] += 1


def page_type(title, wt):
    head = wt.strip()[:200]
    if "/Story" in title or "Event" in head: return "Event"
    if "NPC Infobox" in head: return "Overworld"
    return "Other"


for title, wt in extra_wt.items():
    if title in quests or "Dialogue Start" not in wt: continue
    dia = parse_dialogue(wt)
    if not dia: continue
    speakers = {l[0] for l in dia if l}
    disp = re.sub(r"/\d{4}-\d{2}-\d{2}", "", title).replace("/Story", " · event story")
    quests[title] = dict(title=disp, page=title, type=page_type(title, wt), chapter="", act="", actNum="",
                         nation="", desc="", summary="", dialogue=dia, present=speakers, prev="", next="")
    for s in speakers: speaker_quests[s] += 1

# ---- main-story order: walk the quests' prev/next chain
ROMAN = {"I": 1, "II": 2, "III": 3, "IV": 4, "V": 5, "VI": 6, "VII": 7, "VIII": 8, "IX": 9, "X": 10, "XI": 11, "XII": 12}
mains = {t: q for t, q in quests.items() if q["type"] == "Main"}


def chap_num(q):
    m = re.match(r"Chapter (\w+)", q["chapter"])
    return ROMAN.get(m.group(1), 99) if m else (0 if q["chapter"] in ("", "Prologue") else 98)


heads = sorted((t for t, q in mains.items() if link_target(q["prev"]) not in mains), key=lambda t: (chap_num(mains[t]), t))
order, seen = {}, set()
for h in heads:
    t = h
    while t in mains and t not in seen:
        seen.add(t); order[t] = len(order)
        t = link_target(mains[t]["next"])
for t, q in quests.items():
    q["order"] = order.get(t)

# ---------------------------------------------------------------- choose nodes
JUNK = re.compile(r"\?|^(Resident|Guard|Soldier|Child|Girl|Boy|Man|Woman|Voice|Narrator|Merchant|Student|Kid|All|Everyone|Crowd|Both)\b|\d|Mysterious|Unknown|Strange|Figure|Echo|Member|Staff|Clerk|Officer|Worker|Gatekeeper|Researcher|Villager|Citizen|Waiter|Patron|Customer|Vendor|Old |Young |Elder|Pilgrim|Passerby|Visitor|Tourist|Fan|Doctor|Nurse|Ranger|Agent|Captain|Lieutenant|Sentry|Scout|Driver|Owner|Shopkeeper|Host|Announcer|Reporter|System|AI|Sister|Brother|Mom|Dad|Mother|Father|Guide|Fisher|Farmer|Hunter|Worshipper|Believer|Priest|Knight|Noble|Servant|Maid|Butler|Assistant|Apprentice|Disciple|Teacher|Professor|Lady|Gentleman|Mr\.|Ms\.|Miss|Storyteller|Another|Crew|Sailor|Pirate|Bandit|Thug|Cultist|Acolyte|Envoy|Messenger|Herald|Attendant|Spectator|Audience|Exostrider|Sentinel|Puppet|Bot|Drone|Phantom|Tacet|Construct|KU-|N\.A\.N\.A|I\.R\.I\.S|Unit\b", re.I)
npc_candidates = [s for s, n in speaker_quests.most_common() if s not in PLAYABLE and not JUNK.search(s) and n >= 6]
NPCS = npc_candidates[:40] + [n for n in ("Scar", "Avidius", "Namipon", "Xuanqing", "Jué") if n not in npc_candidates[:40]]
NODES = PLAYABLE + NPCS
NODESET = set(NODES)

# ---------------------------------------------------------------- edges
edges = {}


def edge(a, b):
    a, b = canon(a), canon(b)
    if a == b or a not in NODESET or b not in NODESET: return None
    key = tuple(sorted((a, b)))
    if key not in edges:
        edges[key] = dict(source=key[0], target=key[1], family=[], dialogue=[], scene=[], voiceline=[], mention=[])
    return edges[key]


def has_name(name, text):
    return re.search(r"(?<![\w-])" + re.escape(name) + r"(?![\w-])", text)


node_info = {}
for name in PLAYABLE:
    page = name if name in chars_wt else next((t for t in res_titles if canon(t) == name), name)
    url = WIKI + page.replace(" ", "_")
    ib = infobox(chars_wt.get(page, ""))
    node_info[name] = dict(
        id=name, playable=True, page=url,
        title=clean(ib.get("title", "")), attribute=clean(ib.get("attribute", "")),
        weapon=clean(ib.get("weapon", "")), rarity=int(ib["rarity"]) if ib.get("rarity", "").isdigit() else 0,
        nation=clean(ib.get("nation", "")),
        affiliations=[clean(ib[k]) for k in sorted(ib) if re.fullmatch(r"affiliation\d*", k) and clean(ib[k])],
        image=icons.get(page) or images.get(page) or images.get(name), card=images.get(page),
        zh=zh_name(chars_wt.get(page, "")),
    )
    m = re.search(r"==\s*Official Introduction\s*==\s*\{\{Quote\|(.*?)\|", chars_wt.get(page, ""), re.S)
    node_info[name]["intro"] = clean(m.group(1)) if m else ""

    # --- family from infobox
    # Kept verbatim: `field` is the infobox field (sibling, relative…), `note` is the wiki's own
    # annotation. Notes are free text ("past self", "adopted by former self"), so the UI only
    # turns them into a sentence when they are plain kinship words.
    for k, v in ib.items():
        base = re.match(r"(father|mother|sibling|spouse|child|relative|guardian|parent)(\d*)$", k)
        if not base: continue
        field, num = base.groups()
        field_note = clean(ib.get(k + "Note", "") or ib.get(field + "Note" + num, ""))
        for piece in re.split(r";|<br\s*/?>", v):
            link = re.search(r"\[\[([^|\]]+)", piece)
            inline = re.search(r"\(([^)]*)\)\s*$", clean(piece))
            tname = canon(link.group(1) if link else re.sub(r"\(.*?\)", "", clean(piece)))
            e = edge(name, tname)
            if e is not None:
                note = field_note or (inline.group(1).strip() if inline else "")
                e["family"].append(dict(from_=name, to=tname, field=field, role=note,
                                        source=f"{name}’s profile", url=url))

    # --- voice lines
    vo = chars_wt.get(page + "/Voicelines", "")
    entries = {}
    for k, field, v in re.findall(r"^\|(vo_\d+_\d+)_(title|tx|mention|file)\s*=\s*(.*)$", vo, re.M):
        entries.setdefault(k, {})[field] = v
    for k, ent in entries.items():
        title = clean(ent.get("title", ""))
        tx = clean(ent.get("tx", ""))
        if len(tx) > 2 and tx[0] in '"“' and tx[-1] in '"”' and sum(tx.count(c) for c in '"“”') == 2: tx = tx[1:-1]
        if not tx: continue
        about = re.match(r"About (.+)", title)
        targets = set()
        if about:
            targets.add(canon(about.group(1)))
            for x in ent.get("mention", "").split(";"):
                if x.strip(): targets.add(canon(x))
            for t in targets:
                e = edge(name, t)
                if e is not None:
                    fname = ent.get("file", "").replace("{character}", page).replace("{language}", "").strip().replace(" ", "_")
                    e["voiceline"].append(dict(from_=name, to=t, title=title, text=tx, file=fname, audio=audio.get(fname),
                                               source=f"{name}'s voice lines", url=url + "/Voicelines"))
        for other in NODES:
            if other in (name, "Rover") or other in targets: continue
            if has_name(other, tx):
                e = edge(name, other)
                if e is not None:
                    snip = next((s for s in sentences(tx) if other in s), tx)
                    e["mention"].append(dict(from_=name, to=other, kind="Voice line", title=title, text=snip,
                                             source=f"{name}'s voice line “{title}”", url=url + "/Voicelines"))

    # --- character stories (official lore text)
    bs = chars_wt.get(page + "/Backstory", "")
    m = re.search(r"\{\{Character Stories(.*?)\n\}\}", bs, re.S)
    if m:
        block = m.group(1)
        stories = dict(re.findall(r"\|title(\d+)\s*=\s*(.*)", block))
        for num, text in re.findall(r"\|text(\d+)\s*=\s*(.*?)(?=\n\|\w+\s*=|\Z)", block, re.S):
            txt = clean(text)
            st = clean(stories.get(num, f"Story {num}"))
            for other in NODES:
                if other == name or not has_name(other, txt): continue
                e = edge(name, other)
                if e is None: continue
                snips = [s for s in sentences(txt) if has_name(other, s)]
                e["mention"].append(dict(from_=name, to=other, kind="Character story", title=st,
                                         text=" ".join(snips[:2])[:600], count=len(snips),
                                         source=f"{name}'s character story “{st}”", url=url + "/Backstory"))

for name in NPCS:
    node_info[name] = dict(id=name, playable=False, page=WIKI + name.replace(" ", "_"), title="", attribute="",
                           weapon="", rarity=0, nation="", affiliations=[], image=npc_images.get(name), intro="",
                           zh=zh_name(npc_wt.get(name, "")))

# ---------------------------------------------------------------- quests
NAME_RE = re.compile(r"(?<![\w-])(" + "|".join(re.escape(n) for n in sorted(NODES, key=len, reverse=True) if n != "Rover") + r")(?![\w-])")
namedrops = collections.defaultdict(list)

for q in quests.values():
    dia = q["dialogue"]
    present = [p for p in q["present"] if p in NODESET]
    meta = dict(quest=q["title"], type=q["type"], chapter=q["chapter"], act=q["act"], actNum=q["actNum"],
                nation=q["nation"], url=WIKI + q["page"].replace(" ", "_"), desc=q["desc"], order=q["order"])

    # name drops: A says B's name in a line of dialogue
    for l in dia:
        if not l or l[0] not in NODESET: continue
        for m in NAME_RE.finditer(l[1]):
            other = canon(m.group(1))
            if other != l[0]:
                namedrops[(l[0], other, q["title"])].append((l[1], l[2], meta))

    exch = collections.defaultdict(list)
    for i in range(len(dia) - 1):
        a, b = dia[i], dia[i + 1]
        if not a or not b or a[0] == b[0]: continue
        if a[0] in NODESET and b[0] in NODESET:
            exch[tuple(sorted((a[0], b[0])))].append(i)

    for pair, idxs in exch.items():
        e = edge(*pair)
        if e is None: continue

        def switches(i):
            n = 0
            for x, y in zip(dia[i:i + 6], dia[i + 1:i + 6]):
                if not x or not y: break
                if x[0] in pair and y[0] in pair and x[0] != y[0]: n += 1
            return n

        def take(start):
            out = []
            for l in dia[start:start + 6]:
                if l is None: break
                out.append(dict(speaker=l[0], text=l[1][:280]))
            while out and out[-1]["speaker"] not in pair: out.pop()
            return out

        def chan(i):
            pair_ch = {dia[i][2], dia[i + 1][2]}
            return "phone" if "phone" in pair_ch else "call" if "call" in pair_ch else "talk"
        talk = [i for i in idxs if chan(i) == "talk"]
        phone = [i for i in idxs if chan(i) == "phone"]
        call = [i for i in idxs if chan(i) == "call"]
        best = max(talk or idxs, key=lambda i: (switches(i), -i))
        phone_sample = take(max(phone, key=lambda i: (switches(i), -i))) if phone and talk else []
        summ = [s for s in sentences(q["summary"])
                if (pair[0] in s or pair[0] == "Rover" and re.search(r"\byou\b", s))
                and (pair[1] in s or pair[1] == "Rover" and re.search(r"\byou\b", s))]
        e["dialogue"].append(dict(meta, exchanges=len(idxs), talk=len(talk), phone=len(phone), call=len(call),
                                  channel="talk" if talk else "call" if call else "phone", sample=take(best),
                                  phoneSample=phone_sample, summary=" ".join(summ[:2])[:500]))

    for i, a in enumerate(present):
        for b in present[i + 1:]:
            pair = tuple(sorted((a, b)))
            if pair in exch: continue
            e = edge(a, b)
            if e is None: continue
            summ = [s for s in sentences(q["summary"]) if pair[0] in s and pair[1] in s]
            e["scene"].append(dict(meta, summary=" ".join(summ[:1])[:400]))

# name drops -> mention tier (one entry per quest and direction, strongest first)
by_dir = collections.defaultdict(list)
for (a, b, qt), hits in namedrops.items():
    by_dir[(a, b)].append((qt, hits))
for (a, b), lst in by_dir.items():
    e = edge(a, b)
    if e is None: continue
    lst.sort(key=lambda x: (QTYPE_ORDER.get(x[1][0][2]["type"], 9), -len(x[1])))
    for qt, hits in lst[:8]:
        text, ch, meta = max(hits, key=lambda h: len(h[0]) if len(h[0]) < 260 else 0)
        e["mention"].append(dict(from_=a, to=b, kind="WavesLine message" if ch == "phone" else "Story dialogue",
                                 title=qt, text=text[:300], count=len(hits), questType=meta["type"],
                                 source=f"{a} brings up {b} in “{qt}”" + (f" ({len(hits)}×)" if len(hits) > 1 else ""),
                                 url=meta["url"]))
    e.setdefault("namedrops", {})[a] = dict(times=sum(len(h) for _, h in lst), quests=len(lst))

# ---------------------------------------------------------------- scoring / labels
W = dict(family=40, dialogue=6, scene=1, voiceline=10, mention=3)
out_edges = []
for e in edges.values():
    e["dialogue"].sort(key=lambda d: (QTYPE_ORDER.get(d["type"], 9), d["order"] if d["order"] is not None else 1e9, -d["exchanges"]))
    e["scene"].sort(key=lambda d: (QTYPE_ORDER.get(d["type"], 9), d["order"] if d["order"] is not None else 1e9))
    score = (W["family"] * len(e["family"]) + W["voiceline"] * len(e["voiceline"]) + W["mention"] * min(len(e["mention"]), 6)
             + sum(W["dialogue"] * min(1 + d["exchanges"] / 8, 3) for d in e["dialogue"]) + W["scene"] * min(len(e["scene"]), 10))
    if score < 2: continue
    tiers = [t for t in ("family", "dialogue", "voiceline", "mention", "scene") if e[t]]
    if tiers == ["scene"] and len(e["scene"]) < 2: continue
    e["strongest"] = tiers[0]
    e["score"] = round(score, 1)
    for k in ("family", "voiceline", "mention"):
        for x in e[k]: x["from"] = x.pop("from_")

    # story timeline (main story only — the one part with a reliable order)
    tl = [dict(quest=d["quest"], type=d["type"], order=d["order"], chapter=d["chapter"], actNum=d["actNum"],
               talked=d in e["dialogue"], n=d.get("exchanges", 0), url=d["url"])
          for d in e["dialogue"] + e["scene"] if d["order"] is not None]
    e["timeline"] = sorted(tl, key=lambda d: d["order"])
    if e["timeline"]:
        e["firstMain"] = e["timeline"][0]
    e["phoneTotal"] = sum(d["phone"] for d in e["dialogue"])
    e["talkTotal"] = sum(d["talk"] for d in e["dialogue"])
    e["callTotal"] = sum(d["call"] for d in e["dialogue"])
    e["dialogue"] = e["dialogue"][:40]
    e["scene"] = e["scene"][:30]
    e["mention"] = e["mention"][:20]
    out_edges.append(e)

linked = collections.Counter()
for e in out_edges:
    for a, b in ((e["source"], e["target"]), (e["target"], e["source"])):
        if node_info[b]["playable"]: linked[a] += 1
keep = {n for n in NODES if node_info[n]["playable"] or linked[n] >= 2}
out_edges = [e for e in out_edges if e["source"] in keep and e["target"] in keep]
nodes = [node_info[n] for n in NODES if n in keep]

os.makedirs(os.path.dirname(OUT), exist_ok=True)
json.dump(dict(nodes=nodes, links=out_edges, generated=datetime.date.today().isoformat(),
               source=WIKI, pagesParsed=len(quests), mainQuests=len(mains)),
          open(OUT, "w"), ensure_ascii=False)
c = collections.Counter(e["strongest"] for e in out_edges)
print(len(nodes), "nodes", len(out_edges), "links", dict(c), "| pages parsed", len(quests), "| main quests ordered", len(order))
print("NPCs:", [n for n in NPCS if n in keep])
