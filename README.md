# The Shape of a Memory

An experimental art website. A visitor describes a memory; the site interprets it into a structured
**memory profile** and turns that profile into one of two procedural 3D experiences:

- **The World**: an explorable environment (room, kitchen, corridor, street, garden, field, forest, beach, or void).
- **The Object**: an abstract sculpture (translucent layers, floating fragments, or woven threads).

The result is an artistic interpretation, not a reconstruction. The interface always separates what came
from the visitor's words from what the system imagined.

## Setup

Requires Node.js 18+.

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production build in dist/
npm run preview    # serve the build locally
```

## How it works

```
Visitor text ──► interpretLocally()  ──► MemoryProfile (JSON) ──► MemoryCanvas ──► WorldScene | ObjectScene
                 (optional) interpretWithLLM()                    (Three.js / R3F)
```

### Memory profile (`src/memory/types.ts`)
Every interpreted value is `Sourced<T>`: `{ value, source: 'visitor' | 'inferred', evidence?, reason? }`.
`evidence` is the visitor's own words that triggered it, and `reason` explains an artistic choice.
The profile also holds the palette, objects, sounds, atmosphere (haze, dust, clarity, warmth),
unclear fragments, the suggested mode, the sculpture variant, and a seed so results are reproducible.

### Interpreters
- **Local (default, `interpret.ts`)**: offline lexicon matching with word-boundary rules. No network.
- **LLM (optional, `llm.ts`)**: runs only if the visitor pastes their own Anthropic API key *and* ticks a
  consent box. The key is kept in `sessionStorage` for that tab only. The model can only pick from the same
  fixed vocabularies. Any value it marks as coming from the visitor must quote text that really appears in
  the description, or it is downgraded to "inferred". If the call fails, the local interpreter is used.

### Scene system (`src/scene/`), kept separate from the UI
- `shared.tsx`: GLSL sky dome (gradient, sun glow, drifting clouds, grain), shader dust particles, rain, light rig by time of day.
- `world/objects.tsx`: 20 procedural object templates built from lathed, rounded and displaced forms. Objects the system invented are drawn semi-translucent.
- `world/WorldScene.tsx`: environment templates (rooms, street blocks, displaced terrain, instanced wind-blown grass, shader water), seeded layout, and frosted glass panes for forgotten details.
- `object/ObjectScene.tsx`: a noise-displaced GLSL core with fresnel/iridescence, plus three variants and four materials (glass, pearl, clay, chrome).
- `MemoryCanvas.tsx`: canvas, cinematic camera intro, orbit/zoom/pan, WASD walking, local Lightformer reflections (no HDR downloads), and PNG capture.

### Sound (`src/audio/ambient.ts`)
Fully synthesized with the Web Audio API: rain, wind, waves, birds, traffic, insects, room hum, a ticking
clock, faint music and murmured voices over a mood chord pad. It is off until the visitor turns it on.

## Interaction
- World: drag to look, scroll or pinch to move closer, right-drag or two fingers to pan, **WASD / arrow keys** to walk, click objects and frosted panes.
- Object: drag to rotate, scroll or pinch to zoom, click fragments.
- **H** hides the control panel, **Esc** closes cards.

## Privacy
- Nothing is sent anywhere unless the visitor opts into the LLM interpreter.
- **Save** writes to `localStorage` on this device only, and saved memories can be deleted from the intro screen.
- **Share** puts the profile in the URL fragment (`#m=…`), which browsers never send to servers. Visitors choose
  between sharing the shape only (their words are removed) or including their words.

## Accessibility and performance
- `prefers-reduced-motion` turns off camera flights, auto-rotation, particle drift and CSS animations.
- Devices are sorted into high/low quality (DPR cap, shadows, particle and grass counts). Visitors can switch with *Detail: Full / Light*.
- Without WebGL, or if the 3D canvas crashes, a 2D gradient poster is shown instead.
- The 3D code is lazy-loaded, so the intro and form load quickly.

## Deployment
The build is a static site (`base: './'`), so it works from any path.

- **Netlify / Vercel / Cloudflare Pages**: build command `npm run build`, output directory `dist`.
- **GitHub Pages**: run `npm run build` and publish `dist/` (for example with `actions/deploy-pages`).
- No server or environment variables are needed.

## Testing notes
Tested in Chromium during development: the full form flow; the interpretation split; the World (kitchen,
beach at night) with object selection; the Object in all three variants and materials; switching modes;
sound on/off; PNG export; share-link round trip; and a 375px mobile viewport (no horizontal overflow,
automatic light quality). Not tested: Safari/iOS, Firefox, real touch hardware, and the LLM path against
the live API.
