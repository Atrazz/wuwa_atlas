"""Copy portrait thumbnails locally into public/portraits and point graph.json at them."""
import json, os, re, urllib.request, time
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
G = os.path.join(ROOT, "src", "data", "graph.json")
D = os.path.join(ROOT, "public", "portraits"); os.makedirs(D, exist_ok=True)
g = json.load(open(G))
for n in g["nodes"]:
    url = n.get("remoteImage") or n.get("image")
    if not url or not url.startswith("http"): continue
    n["remoteImage"] = url
    ext = ".png" if ".png" in url.lower() else ".jpg"
    slug = re.sub(r"[^a-z0-9]+", "-", n["id"].lower()).strip("-") + ext
    path = os.path.join(D, slug)
    if not os.path.exists(path):
        req = urllib.request.Request(url, headers={"User-Agent": "WuwaInteract/0.1"})
        open(path, "wb").write(urllib.request.urlopen(req, timeout=60).read()); time.sleep(0.2)
    n["image"] = "portraits/" + slug
C = os.path.join(ROOT, "public", "cards"); os.makedirs(C, exist_ok=True)
for n in g["nodes"]:
    url = n.get("remoteCard") or n.get("card")
    if not url or not url.startswith("http"): continue
    n["remoteCard"] = url
    base = re.sub(r"[^a-z0-9]+", "-", n["id"].lower()).strip("-")
    path = os.path.join(C, base + ".jpg")
    if not os.path.exists(path):
        # the thumbnail revision in pageimages can be stale; fall back to the un-scaled original
        for u in (url, re.sub(r"/revision/latest.*", "/revision/latest", url)):
            try:
                req = urllib.request.Request(u, headers={"User-Agent": "WuwaInteract/0.1"})
                open(path, "wb").write(urllib.request.urlopen(req, timeout=60).read()); break
            except Exception as e:
                print("card failed", n["id"], e)
        time.sleep(0.2)
    n["card"] = "cards/" + base + ".jpg" if os.path.exists(path) else None
json.dump(g, open(G, "w"), ensure_ascii=False)
print("portraits:", len(os.listdir(D)))
