# Deixa

Deixa is a rehearsal app for actors. Upload a script, choose your character, and practice your lines with realistic spoken cues in Brazilian Portuguese.

The product is launching first for Brazilian actors at [deixa.app](https://deixa.app), with an internationalization path toward a global AI scene partner.

## Stack

- Next.js 16 App Router
- React 19
- Supabase auth and saved scripts
- Azure Speech text-to-speech
- Vercel deployment

## Local Development

Add these environment variables to `.env.local`:

```bash
AZURE_SPEECH_KEY=your_azure_speech_key
AZURE_SPEECH_REGION=brazilsouth
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
TTS_AUDIO_BUCKET=tts-audio
```

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Product Roadmap

See [ROADMAP.md](./ROADMAP.md) for the production plan.
