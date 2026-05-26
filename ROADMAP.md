# Deixa — Production Roadmap

> Last updated: May 2026  
> Current stack: Next.js 16 · Supabase · Azure Speech · Vercel

---

## Where we are today

| Feature | Status |
|---|---|
| PDF script upload + parsing | ✅ Done |
| Character selection | ✅ Done |
| TTS playback (Azure Speech, pt-BR neural voices) | ✅ Done |
| Background audio pre-generation + caching | ✅ Done |
| Google OAuth + user accounts (Supabase) | ✅ Done |
| Save / load scripts per user | ✅ Done |

---

## Phase 1 — Learning Science Core  *(Highest ROI, build first)*

> **Science basis:** The Noice & Noice research (2006) — the authoritative study of how professional actors memorize — found that rote repetition is the *least effective* method. Active recall, intention-tagging, and chunking outperform passive re-reading by a factor of ~2× in long-term retention. The "testing effect" meta-analysis (150+ studies) gives active recall an effect size of 0.93 vs. 0.31 for passive review.

### 1.1 Active Recall Mode Progression
Replace the current binary "reveal / hide" with a four-stage progression that the app advances automatically based on accuracy:

| Stage | What the actor sees |
|---|---|
| 1. Read | Full text visible |
| 2. First-letter hint | Each word shown as its first letter only (e.g. "W_ d_ y_ w_?") |
| 3. Keyword hint | Only key nouns and verbs visible |
| 4. Blackout | Full hide — off-book test |

> **Why:** The "errorful learning" effect shows that struggling before the answer is revealed strengthens memory traces more than errorless review. Intermediate stages like first-letter hints make the struggle productive without being discouraging.

**Build:** Add `revealMode: "read" | "first-letter" | "keyword" | "blackout"` to `PracticeView`. Progress auto-advances after 3 successful recalls in a row per line.

---

### 1.2 Cue-Only Mode
Currently the app reads the *full* other-character dialogue. Add a mode that plays only the **last 3–5 words** — the true cue the actor must listen for.

> **Why:** Directors' most common note to inexperienced actors is "you know your lines but not your cues." Training the actor's ear to the specific cue trigger (not the whole speech) builds faster, more reliable responses in performance. Every professional app competitor (coldRead, Offbook, Linus) offers this.

**Build:** In `PracticeView`, add `cueMode: boolean`. When enabled, trim the spoken text to the last sentence or last N words before playing.

---

### 1.3 Beat / Chunk Annotation
Let actors divide their script into named "beats" — intentional units rather than line-by-line chunks.

> **Why:** Chunking is one of the most replicated findings in cognitive science. Actors who analyze scripts into motivational beats (e.g., "I try to convince her → she resists → I escalate") learn lines faster and retain them longer because each beat becomes a single memory unit. George Miller (1956) established that working memory holds ~7 items regardless of how large each "item" is — so bigger chunks = more content per session.

**Build:**
- Add beat-marker UI in the character selector or a new "Annotate" stage
- Store beat metadata in the `parsed_script` JSONB column (already exists in DB)
- Practice view groups lines by beat, allows looping a single beat

---

### 1.4 Line-Level Progress Tracking
Track pass/fail on every line, every session.

> **Why:** Without per-line data, spaced repetition (Phase 2) is impossible. This is the data layer everything else builds on.

**Build:**
- New Supabase table: `line_attempts (user_id, script_id, line_id, passed, created_at)`
- After each line, actor marks ✓ (knew it) or ✗ (needed help) — one tap
- Aggregate into a "mastery" percentage per scene and whole script

---

### 1.5 Scene / Exchange Looping
Let actors loop a specific exchange (A→B or A→B→A→B) continuously until comfortable.

> **Why:** The most-requested missing feature in actor forums. Targeted repetition of a difficult exchange is more efficient than running the whole scene again. Background/locked-screen looping (so actors can pace the room without looking at the phone) is specifically called out as a differentiating feature with almost no current competition.

**Build:**
- Add "Loop this scene" button in `PracticeView`
- Range slider to set loop start/end by beat or line index
- Keep audio playing when screen locks (Web Audio API `AudioContext` stays alive on modern browsers; test on iOS)

---

## Phase 2 — Voice Quality & Customization

> **Science basis:** Actors report that robotic or flat delivery "breaks the imaginative contract of the scene" — they stop truly listening and the rehearsal value collapses. Natural-sounding voices with emotional inflection produce measurably better response quality in live rehearsal.

### 2.1 Per-Character Voice Picker
Currently characters are assigned voices round-robin from a fixed list. Give actors explicit control.

**Build:**
- In `CharacterSelector`, show a voice picker per character with name + audio preview (5-second sample)
- Store voice assignments in `parsed_script.voiceMap` (already have the field structure)
- Azure Speech has multiple pt-BR neural voices; surface them with gender and tone labels

### 2.2 Emotional Tone Selector
Azure Speech SSML supports prosody controls, and some voices support expressive styles. Expose simple presets where the selected voice supports them.

> **Why:** Voice coaches emphasize that a practice partner voice should model the intended emotional register of the scene. Dramatic scenes need a different reading than comedy. Actors practicing emotional response work are significantly helped by a reader whose tone matches the scene's energy.

**Build:**
```
Presets:
  calm      → rate: -8%, pitch: -2%
  dramatic  → rate: -4%, pitch: -4%
  urgent    → rate: +12%, pitch: +2%
  comic     → rate: +4%, pitch: +6%
```
Let actors set a preset per character. Stored in voice metadata.

### 2.3 Extended Speed Slider
Expand the current 0.5x–1.5x range to **0.5x–2.0x**.

> **Why:** Voice coaches recommend going *above* performance speed to build recall muscle memory, then returning to normal speed so it "feels slow." The current cap at 1.5x misses this technique. Research consensus: 0.75× for learning passes, 1.0× for standard, 1.25–1.5× for drilling, 2.0× for speed training.

### 2.4 Actor Self-Recording (Replace Any Character Voice)
Let an actor (or a castmate) record their own voice for a character, replacing the TTS reader.

> **Why:** The top competitive differentiator of LineLearner. Actors strongly prefer a real human voice (even their own) because it maintains scene energy. For Brazilian actors specifically, regional accent and prosody matter more than any other voice quality — a castmate recording their own lines in the right regional register is more useful than the best TTS system.

**Build:**
- MediaRecorder API in browser → capture WAV per line
- Upload to Supabase Storage (file bucket), store URL in `voiceMap`
- On playback, prefer stored recording URL over TTS
- Share recording sessions with castmates via invite link

---

## Phase 3 — Spaced Repetition System

> **Science basis:** The spacing effect is one of the most replicated findings in all of cognitive science (hundreds of studies since Ebbinghaus, 1885). Memory decays on a predictable curve. Reviewing material at the moment just before forgetting is maximally efficient for long-term retention. Actors using spaced repetition for scripts retain lines significantly better at performance time than those who mass-practiced.

### 3.1 SM-2 Algorithm Implementation
The SM-2 algorithm (same algorithm Anki uses) schedules each memory item based on rated recall difficulty:
- Rated "easy" → next review in 4+ days, interval grows
- Rated "hard" → next review tomorrow, interval resets

**Build:**
- Compute next-review date per line in `line_attempts` table
- New column: `next_review_at TIMESTAMPTZ`
- New view: "Today's queue" — lines due for review across all scripts

### 3.2 Daily Practice Queue
Home screen shows: "You have 12 lines due for review today" with a one-tap "Start session" button.

**Build:**
- Query `line_attempts` for `next_review_at <= NOW()` per user
- Group by script → show queue per script or mixed
- Session ends when all due lines are reviewed

### 3.3 Practice Streak & Gamification
Daily streak counter (like Duolingo). Streak continues if the user completes their due queue each day.

> **Why:** Streak mechanics dramatically improve daily retention compliance in language-learning apps. Spaced repetition only works if the actor actually shows up on the scheduled day.

---

## Phase 4 — Progress Analytics

### 4.1 Per-Script Dashboard
After a practice session, show:
- Overall mastery % per script
- Per-scene mastery heatmap
- Lines flagged as "difficult" (failed 2+ times)
- Time spent per scene

### 4.2 Learning Curve Graph
Show retention over time per script — tracks how mastery grows as the performance date approaches.

### 4.3 Sleep Scheduling Recommendation
> **Science basis:** Research (PMC3395672) shows declarative memory (the words) consolidates best when learned earlier in the day before sleep. Procedural/physical rehearsal benefits most from evening practice. A simple time-of-day heuristic is actionable.

Display a subtle banner: "Best time for text memorization: morning. Best for run-throughs: evening." Optionally: set a target performance date and auto-generate a practice schedule.

---

## Phase 5 — Collaboration & Cast

### 5.1 Share Script with Cast
Generate an invite link. Castmates join with Google login and see the shared script (their character highlighted).

**Build:**
- `script_collaborators (script_id, user_id, character, role: "owner" | "collaborator")`
- Owner can share; collaborators can practice but not delete

### 5.2 Collaborative Voice Recording
Each cast member records their own character's lines. When Actor A practices, they hear Actor B's actual voice reading B's lines — not TTS.

> **Why:** This is the most requested "dream feature" from actor forums. LineLearner pioneered the concept but with high friction (manual recording). With automatic line-by-line capture, this becomes seamless.

### 5.3 Remote Rehearsal (Stretch Goal)
Two actors in different locations run lines together in real time — one actor's line triggers the other's cue. Uses WebRTC for audio.

---

## Phase 6 — Production Readiness

### 6.1 Subscription Model (Stripe)

**Suggested tiers:**

| Tier | Price | Limits |
|---|---|---|
| **Free** | R$0 | 1 script, 10 lines/day TTS, no progress history |
| **Pro** | R$29/mo | Unlimited scripts, full TTS, spaced repetition, analytics |
| **Ensemble** | R$79/mo | Pro + collaboration for up to 8 cast members |

> **Comps:** Offbook (US$9.99/mo), Rehearsal Pro (US$19.99 one-time). Brazilian market price sensitivity suggests R$29/mo (≈US$6) is the right Pro anchor.

**Build:**
- Stripe Checkout + webhook → update `users.plan` in Supabase
- Feature gates checked server-side in API routes (never client-side)

### 6.2 PWA + Mobile
Wrap the Next.js app as a Progressive Web App for home-screen install on iOS and Android.

- `manifest.json` with app icons
- Service Worker for offline caching of audio blobs (already using ObjectURLs — extend to IndexedDB for persistence)
- "Add to Home Screen" prompt after second session

### 6.3 Error Monitoring
- Add [Sentry](https://sentry.io) for both client and server errors
- Alert on Azure Speech 4xx/5xx error rates (API key expiry or free-tier quota exhaustion is a real operational risk)

### 6.4 Analytics
- [PostHog](https://posthog.com) (open source, LGPD-friendly) for product analytics
- Track: script upload rate, characters selected, lines practiced, drop-off points

### 6.5 Landing Page & SEO
Currently the app URL opens directly to the product. Add a marketing landing page at `/`:
- Hero with demo video
- Feature breakdown
- Testimonials (reach out to early users)
- Pricing section
- SEO: target "como memorizar falas", "app para atores brasileiros", "decorar texto peça de teatro", "deixa teatro", "ai scene partner"

### 6.6 LGPD Compliance
Brazil's data protection law requires:
- Privacy policy and terms of service (in Portuguese)
- Explicit consent checkbox at signup
- Data deletion endpoint (let users delete their account + all data)
- Cookie consent banner

---

## Phase 7 — Advanced (Future)

### 7.1 Live Cue Detection (Speech Recognition)
Like coldRead's killer feature: the app *listens* to the actor speak their line, detects when they finish (using the Web Speech API or Whisper), and automatically fires the next character's line — no button press needed.

> This creates a genuinely conversational rehearsal experience. It is the single largest UX leap available.

**Build:** Web Speech API (free, browser-native) for cue detection. Fall back to a manual "tap to continue" button on unsupported browsers.

### 7.2 AI Pronunciation Coach
After the actor records their lines, use a speech-to-text + phoneme comparison to flag mispronounced words. Especially valuable for verse or period dialogue with unfamiliar vocabulary.

### 7.3 Monologue Mode
Currently the app is optimized for multi-character dialogue. Add a dedicated mode for single-character monologues: timed reading, teleprompter scroll, self-recording for playback review.

---

## Technical Debt to Address Before Scaling

| Issue | Fix |
|---|---|
| Azure Speech API key rotation | Add key-validity health check on startup; Slack/email alert when quota is low |
| No rate limiting on `/api/tts` | Add per-user request rate limit (Vercel Edge Config or Upstash Redis) |
| Audio preloading always runs | Only preload if user has Pro plan or fewer than N lines |
| Script parser is regex-only | Add LLM-assisted parsing fallback for non-standard script formats |
| No test coverage | Add Playwright e2e tests for the critical upload → practice flow |

---

## Feature Priority Matrix (Summary)

| Feature | Evidence | Impact | Effort | Priority |
|---|---|---|---|---|
| Active recall / reveal modes | ⭐⭐⭐ | High | Low | **P0** |
| Cue-only mode | ⭐⭐⭐ | High | Low | **P0** |
| Line-level progress tracking | — | High | Low | **P0** |
| Scene looping | ⭐⭐ | High | Low | **P0** |
| Beat annotation | ⭐⭐⭐ | High | Medium | **P1** |
| Per-character voice picker | ⭐⭐ | High | Medium | **P1** |
| Emotional tone presets | ⭐⭐ | Medium | Low | **P1** |
| Spaced repetition queue | ⭐⭐⭐ | Very high | High | **P1** |
| Actor self-recording | ⭐⭐ | High | High | **P2** |
| Subscription (Stripe) | — | Revenue | Medium | **P2** |
| Collaboration / cast sharing | ⭐ | High | High | **P2** |
| PWA / mobile install | — | Retention | Low | **P2** |
| Speech recognition cue detection | ⭐⭐ | Very high | High | **P3** |
| AI pronunciation coach | — | Medium | High | **P3** |

---

## Suggested Sprint Order

```
Sprint 1 (2 wks): Active recall modes + cue-only mode + line tracking DB
Sprint 2 (2 wks): Scene looping + beat markers + per-character voice picker
Sprint 3 (2 wks): Spaced repetition algorithm + daily queue + streaks
Sprint 4 (2 wks): Progress dashboard + sleep scheduling tip + analytics (PostHog)
Sprint 5 (2 wks): Stripe subscription + feature gates + LGPD compliance
Sprint 6 (2 wks): PWA manifest + offline audio + Sentry error monitoring
Sprint 7 (3 wks): Self-recording + cast sharing + collaborative voice
Sprint 8 (3 wks): Live cue detection (Web Speech API) + landing page + SEO
```

---

*Research sources: Noice & Noice (2006) "What Studies of Actors and Acting Can Tell Us About Memory"; Roediger & Karpicke testing effect meta-analysis; PMC3395672 sleep consolidation study; Backstage/Artfolio/Linus/coldRead competitive analysis (2025–2026).*
