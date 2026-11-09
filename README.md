# Resonance Atlas — Wuthering Waves relationship graph

An interactive, animated map of who knows whom in Wuthering Waves. Every line is backed by evidence quoted from the
[Wuthering Waves Fandom wiki](https://wutheringwaves.fandom.com/wiki/).

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # static site in dist/
```

## How bonds are classified (strongest → weakest)

| Tier | Rule | Source on the wiki |
|---|---|---|
| ◆ Kinship | Listed as family/guardian/ward in the infobox | `Character` page infobox (`sibling`, `child`, `relative` + note) |
| ❖ Story: direct conversation | A speaks and B replies right after in a quest's dialogue | Quest pages, `==Dialogue==` section |
| ♪ Voice line | A dedicated "About X" voice line (with playable audio) | `Character/Voicelines` |
| ✦ Mention | Named in passing in another voice line or an official Character Story | `Character/Voicelines`, `Character/Backstory` |
| ○ Shared scene | Both in the same quest without talking directly | Quest infobox `characters` + speakers |

### Deeper analysis (per relationship)

- **Main-story timeline**: every main quest the pair shares, in story order (the order comes from each quest's
  `prev`/`next` links on the wiki), showing whether they talked or were only both present.
- **WavesLine vs in person**: lines inside `{{WavesLine}}` phone chats are counted separately and shown as a phone chat.
- **Name-drops**: every story line where one character says the other's name, so you can see who keeps whom on their mind.
- **Coverage**: quests plus event stories, overworld scenes and NPC dialogue: ~1,300 wiki pages.

Bond strength = family 40 · voice line 10 each · quest with dialogue 6–18 · mention 3 · shared scene 1.

## Data pipeline

`scripts/` downloads raw wikitext through the MediaWiki API (cached in `scripts/raw/`), then builds
`src/data/graph.json` and local portraits in `public/`.

```bash
npm run data           # use cache, rebuild graph.json
npm run data:refresh   # re-download everything from the wiki (new characters/quests)
```

Each panel links to the Chinese [Huiji wiki](https://wuwa.huijiwiki.com/) and the
[WuWa text searcher](https://mc.yakitahome.com/) (the button copies the Chinese names to paste in). Both sites' robots.txt
ask AI agents not to collect their content (`ai-input=no` / Anthropic agents disallowed), so they are linked for
reading by hand, never scraped.

Fan project; game assets and text © Kuro Games, text via the Fandom wiki (CC BY-SA).

## Deploy (GitHub Pages)

`.github/workflows/deploy.yml` builds the site and publishes `dist/` on every push to `main`.
One-time setup: in the repo go to **Settings → Pages → Build and deployment → Source: GitHub Actions**.
The site is then served at `https://<user>.github.io/<repo>/` (Vite `base: './'` makes paths work under any repo name).
