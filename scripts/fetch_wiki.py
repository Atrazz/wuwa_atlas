"""Download raw wikitext from the Wuthering Waves Fandom wiki (MediaWiki API).
Output: scripts/raw/*.json  (cache; re-run with --force to refresh)
"""
import json, os, sys, time, urllib.parse, urllib.request

API = "https://wutheringwaves.fandom.com/api.php"
UA = "WuwaInteract/0.1 (fan project; relationship graph)"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "raw")
FORCE = "--force" in sys.argv
os.makedirs(OUT, exist_ok=True)

def api(**params):
    params["format"] = "json"
    url = API + "?" + urllib.parse.urlencode(params)
    for attempt in range(5):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.load(r)
        except Exception as e:
            print("retry", attempt, e, file=sys.stderr); time.sleep(2 + attempt * 3)
    raise RuntimeError(url)

def list_all(listname, prefix, **params):
    out, cont = [], {}
    while True:
        d = api(action="query", list=listname, **params, **cont)
        out += d["query"][listname]
        if "continue" not in d: return out
        cont = {k: v for k, v in d["continue"].items()}

def contents(titles):
    """title -> wikitext (follows redirects)"""
    res = {}
    for i in range(0, len(titles), 50):
        chunk = titles[i:i+50]
        d = api(action="query", prop="revisions", rvprop="content", rvslots="main",
                titles="|".join(chunk), redirects=1)
        q = d["query"]
        back = {}
        for r in q.get("redirects", []): back[r["to"]] = back.get(r["to"], []) + [r["from"]]
        for n in q.get("normalized", []): back.setdefault(n["to"], []).append(n["from"])
        for p in q["pages"].values():
            if "revisions" not in p: continue
            txt = p["revisions"][0]["slots"]["main"]["*"]
            res[p["title"]] = txt
            for f in back.get(p["title"], []):
                res[f] = txt
                for f2 in back.get(f, []): res[f2] = txt
        time.sleep(0.4)
        print(f"  {min(i+50, len(titles))}/{len(titles)}", file=sys.stderr)
    return res

def cached(name, fn):
    path = os.path.join(OUT, name)
    if os.path.exists(path) and not FORCE:
        return json.load(open(path))
    data = fn(); json.dump(data, open(path, "w"), ensure_ascii=False); return data

print("resonators...", file=sys.stderr)
res = cached("resonators.json", lambda: [m["title"] for m in list_all(
    "categorymembers", "cm", cmtitle="Category:Playable_Resonators", cmlimit=500)])

pages = []
for r in res:
    pages += [r, r + "/Voicelines", r + "/Backstory"]
print("character pages...", file=sys.stderr)
cached("characters_wikitext.json", lambda: contents(pages))

print("character images...", file=sys.stderr)
def images():
    out = {}
    for i in range(0, len(res), 50):
        d = api(action="query", prop="pageimages", piprop="thumbnail|original", pithumbsize=300,
                titles="|".join(res[i:i+50]))
        for p in d["query"]["pages"].values():
            out[p["title"]] = (p.get("thumbnail") or {}).get("source")
    return out
cached("images.json", images)

print("quests...", file=sys.stderr)
quests = cached("quest_titles.json", lambda: [m["title"] for m in list_all(
    "embeddedin", "ei", eititle="Template:Quest_Infobox", eilimit=500, einamespace=0)])
cached("quests_wikitext.json", lambda: contents(quests))
print("done", file=sys.stderr)

# ---- NPC portraits + local copies of all portraits (run after build_data.py once)
GRAPH = os.path.join(os.path.dirname(OUT), "..", "src", "data", "graph.json")
if os.path.exists(GRAPH):
    g = json.load(open(GRAPH))
    npcs = [n["id"] for n in g["nodes"] if not n["playable"]]
    def npc_imgs():
        out = {}
        for i in range(0, len(npcs), 50):
            d = api(action="query", prop="pageimages", piprop="thumbnail", pithumbsize=300,
                    titles="|".join(npcs[i:i+50]), redirects=1)
            back = {r["to"]: r["from"] for r in d["query"].get("redirects", [])}
            for p in d["query"]["pages"].values():
                out[back.get(p["title"], p["title"])] = (p.get("thumbnail") or {}).get("source")
        return out
    cached("npc_images.json", npc_imgs)

def file_urls(names, width=None):
    out = {}
    names = [n for n in names if n]
    for i in range(0, len(names), 50):
        kw = dict(iiurlwidth=width) if width else {}
        d = api(action="query", prop="imageinfo", iiprop="url", titles="|".join("File:" + n for n in names[i:i+50]), **kw)
        norm = {x["to"]: x["from"] for x in d["query"].get("normalized", [])}
        for p in d["query"]["pages"].values():
            if "imageinfo" not in p: continue
            ii = p["imageinfo"][0]
            key = norm.get(p["title"], p["title"])[5:].replace(" ", "_")
            out[key] = ii.get("thumburl") or ii["url"]
        time.sleep(0.3)
    return out

print("resonator icons...", file=sys.stderr)
cached("icons.json", lambda: {k.replace("Resonator_", "").replace(".png", "").replace("_", " "): v
                              for k, v in file_urls(["Resonator_" + r.replace(" ", "_") + ".png" for r in res], 160).items()})
if os.path.exists(GRAPH):
    g = json.load(open(GRAPH))
    files = sorted({v["file"] for e in g["links"] for v in e["voiceline"] if v.get("file")})
    print("voice audio...", len(files), file=sys.stderr)
    cached("audio.json", lambda: file_urls(files))

# ---- every other page that carries story dialogue (event stories, overworld scenes, NPC chatter)
print("extra dialogue pages...", file=sys.stderr)
def extra_titles():
    qs = set(quests)
    return [m["title"] for m in list_all("embeddedin", "ei", eititle="Template:Dialogue_Start", eilimit=500, einamespace=0)
            if m["title"] not in qs]
extra = cached("extra_titles.json", extra_titles)
cached("extra_wikitext.json", lambda: contents(extra))

if os.path.exists(GRAPH):
    g = json.load(open(GRAPH))
    npcs = [n["id"] for n in g["nodes"] if not n["playable"]]
    print("npc pages...", file=sys.stderr)
    cached("npc_wikitext.json", lambda: contents(npcs))
