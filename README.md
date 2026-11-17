# TuneMatch — Content-Based Audio Vibe & Music Recommender

TuneMatch is a dark-mode, Spotify-inspired front-end experience that turns song discovery into an intuitive 7-dimensional acoustic exploration. Users search any track—or pick a curated sample—watch a 7-node cosmic neural engine analyze its mathematical DNA, and explore cosine-matched recommendations paired with a live Web Audio API synth preview player.

---

## 1. Overview & Core Concept

- **What It Does**: Simulates an AI-powered content-based music recommender across three continuous animated states: (1) Hero & Song Search Prompt, (2) Neural/Cosmic Curation Visualizer, and (3) Curated Audio DNA Dashboard with interactive playback.
- **Target Audience**: Music enthusiasts, playlist curators, and audio/ML product evaluators looking for tactile, zero-latency sonic exploration.
- **Key Value**: Makes abstract vector-space recommendations (K-Means mood clustering and 7D cosine similarity) tangible, visual, and immediately audible in the browser without external backend dependencies.

---

## 2. User Experience & Visual Design

### Key User Flows

1. **State 1 — Hero & Song Search Prompt**
   - Minimalist single-row top navbar featuring a glowing emerald sonic-wave logo, **TuneMatch** wordmark, and a subtle `Offline 25K Catalog Ready` status indicator.
   - Centered hero headline: _"Discover music by its mathematical DNA."_ with concise subtext explaining 7D audio feature matching (`Tempo, Energy, Danceability, Valence, Acousticness, Instrumentalness, Speechiness`).
   - Glassmorphic search bar prompting _"Type a song you love (e.g., Blinding Lights, Starboy, After Hours)..."_ paired with a glowing `#1DB954` **Analyze & Curate** CTA button.
   - Live autocomplete dropdown showing matching catalog tracks (artwork, title, artist, BPM) with keyboard navigation, plus 4 one-click sample song pills underneath (_Blinding Lights_, _Midnight City_, _Levitating_, _Resonance_) for instant testing.
2. **State 2 — Neural / Cosmic Curation Animation (~2.8s)**
   - Submitting a track smoothly glides the search context upward and unveils a centerpiece **Space & Neural Engine Curation Visualizer** rendered with layered SVG/Canvas and spring physics.
   - Features an orbital cosmic constellation with 7 interconnected trait nodes (_Tempo, Energy, Danceability, Valence, Acousticness, Instrumentalness, Speechiness_), traveling emerald energy pulses along synaptic links, orbiting stardust particles, and an expanding `#1DB954` sonar ring.
   - Cycles smoothly through 4 status captions beneath the visualizer:
     1. _"Extracting 7D acoustic DNA..."_
     2. _"Projecting track into K-Means mood cluster..."_
     3. _"Computing cosine similarity across 25,000 vectors..."_
     4. _"Curating your sonic matches..."_
3. **State 3 — Curated Results & Audio DNA Dashboard**
   - **Pinned Seed Track Card**: Displays album art (with playable synth preview button), track title, artist, assigned **Vibe Cluster** badge (e.g., `Cluster #2 · High-Energy Synth`), and a horizontal **7-Trait Audio DNA Breakdown** with animated emerald fill bars and tabular monospace values. Clicking any trait highlights its telemetry description.
   - **Recommended Tracks Grid (6 Cards)**: Staggered entrance (`fade-up`, `60ms` delay per card). Each card displays square album cover art with a hover-reveal emerald play/pause button, track title, artist, genre, a prominent glowing `#1DB954` **Cosine Match Badge** (e.g., `98.4% Match`), and compact monospace telemetry (`171 BPM · Energy 0.80 · Mood 0.33`).
   - **Interactive Mini Player Bar**: Anchored cleanly at the bottom whenever a track is playing or paused, displaying active cover art, title/artist, live animated equalizer bars, play/pause toggle, elapsed/duration scrub bar, and volume control.
   - **Reset Action**: A crisp **Search Another Track** button transitions smoothly back to State 1 while preserving or cleanly fading audio as desired.

### Visual Identity & Theme

- **Aesthetic Direction**: Ultra-dark, precision audio-instrument aesthetic inspired by modern streaming interfaces and scientific telemetry consoles—clean geometry, calibrated emerald highlights, and generous breathing room.
- **Color Palette (60-30-10 Budget)**:
  - _60% Dominant Canvas_: Deep obsidian `#09090B` and charcoal `#121212` with subtle radial emerald ambient glow behind active focal zones.
  - _30% Structural Surfaces_: Elevated dark cards (`#18181B`) framed by crisp hairline borders (`1px solid rgba(255,255,255,0.08)`), muted slate secondary copy (`#A1A1AA`), and crisp primary text (`#FAFAFA`).
  - _10% Accent_: Electric Spotify Emerald (`#1DB954`, hover/active `#1ED760`) reserved strictly for primary CTAs, active audio waves, cosine similarity highlights, and neural pulse energy.
- **Typography & Tabular Discipline**:
  - _UI & Display_: `Plus Jakarta Sans` (display weights `600`/`700` with `text-wrap: balance`, body `400`/`500`) for crisp geometric legibility.
  - _Audio Telemetry_: `JetBrains Mono` with `font-variant-numeric: tabular-nums` for BPM, cosine percentages, cluster IDs, and 7D trait scores so numbers align cleanly with zero jitter.
- **Motion & Interaction Feel**:
  - Powered by Framer Motion (`motion/react`) with spring physics and settling curve `cubic-bezier(0.22, 1, 0.36, 1)` across state transitions, autocomplete reveal, neural pulses, and staggered card entrances (`prefers-reduced-motion` respected).

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Real Client-Side Cosine Similarity & Deterministic Custom Track Synthesis**
  - _Chosen Approach_: Compute genuine normalized 7D Euclidean/Cosine similarity scores in TypeScript against a curated 24-track catalog across 5 K-Means mood clusters, and deterministically hash unrecognized user queries into valid 7D feature vectors and cluster assignments.
  - _Why_: Every recommendation percentage and trait comparison bar is mathematically consistent and authentic rather than static fake numbers, while fulfilling the pure front-end constraint.
  - _Alternatives Considered_: Hardcoding fixed recommendation arrays per sample song—rejected because custom user searches would break or show identical placeholder results.

- **Decision 2: Procedural Web Audio API Synth Engine for Track Previews**
  - _Chosen Approach_: Build a lightweight, zero-asset Web Audio API synthesizer that schedules rhythmic chords, bassline pulses, and melodic arpeggios modulated by each track's Tempo (BPM), Valence (major vs. minor scale), Energy (low-pass filter cutoff & drive), and Acousticness (warm sine/triangle vs. bright sawtooth).
  - _Why_: Delivers immediate, authentic audio playback for both catalog tracks and custom synthesized songs without fragile external MP3 links or CORS failures.
  - _Alternatives Considered_: External preview URLs—rejected due to broken/expired third-party audio links in sandboxed environments.

- **Decision 3: Bespoke Album Artwork + Procedural Vinyl/Gradient Fallbacks**
  - _Chosen Approach_: Generate high-craft square (`1:1`) moody album cover artworks for core visual clusters and pair every track with a resilient SVG/CSS fallback emblem so zero broken images ever occur.
  - _Why_: Eliminates external stock-photo URL failures while giving the pinned seed card and recommendation grid authentic visual richness.

---

## 4. Technical Architecture & Data Strategy

### Architecture & Component Diagram

```text
┌──────────────────────────────────────────────────────────────────────┐
│                          App Shell (State Machine)                   │
│   State: 'search' ──(submit)──▶ 'analyzing' ──(2.8s)──▶ 'results'   │
└──────────────┬───────────────────────────┬───────────────────────────┘
               │                           │
               ▼                           ▼
┌─────────────────────────────┐  ┌─────────────────────────────────────┐
│   Catalog & 7D Math Engine  │  │     Web Audio Synth Controller      │
│  • 24-track 7D catalog      │  │  • BPM-synced Web Audio scheduler   │
│  • Deterministic query hash │  │  • Trait-driven timbre & harmony    │
│  • Cosine similarity ranker │  │  • Play/pause, seek & volume state  │
└──────────────┬──────────────┘  └──────────────────┬──────────────────┘
               │                                    │
               ▼                                    ▼
┌──────────────────────────────────────────────────────────────────────┐
│                         Interactive View Layer                       │
│  • TopNavBar (TuneMatch logo + Offline 25K Catalog Ready pill)        │
│  • HeroSearchView (Glassmorphic input, autocomplete, sample pills)   │
│  • NeuralCurationVisualizer (7-node orbital mesh + sonar + captions) │
│  • ResultsDashboard (SeedTrackDNA + 6 staggered RecommendationCards) │
│  • MiniAudioPlayer (Persistent bottom bar synced to active track)    │
└──────────────────────────────────────────────────────────────────────┘
```

### Data Model & State

- **Track Entity**: Contains `id`, `title`, `artist`, `genre`, `clusterId`, `clusterLabel`, `coverArt` (generated asset path + curated palette fallback), `durationSec`, and `features` (`bpm`, `energy`, `danceability`, `valence`, `acousticness`, `instrumentalness`, `speechiness`).
- **Recommendation Result**: Pairs a `Track` with its computed `similarityPct` (normalized `0–99.9%` cosine score against the active seed track).
- **App View State**: Single-page state machine (`search` | `analyzing` | `results`) with `seedTrack`, `recommendations`, `activeAudioTrackId`, `isPlaying`, and `playbackProgress`.

### Interactive Component & State Mapping

- **Search Input & Sample Pills**: Typing filters the catalog autocomplete list in real time; pressing Enter, clicking **Analyze & Curate**, or clicking a sample pill resolves a catalog match (or synthesizes a deterministic custom track profile) and transitions to `analyzing`.
- **Neural Visualizer**: Automatically steps through the 4 status captions over 2.8 seconds with synchronized synaptic pulse animations before transitioning seamlessly into `results`.
- **Recommendation Cards & Seed Card**: Hovering reveals the emerald play button; clicking toggles the Web Audio synth preview for that track and activates the bottom **MiniAudioPlayer**. Clicking **Search Another Track** resets cleanly back to `search`.
