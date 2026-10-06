# Cine-verse

A cinematic real-time movie encyclopedia built with React + Vite.

## Run locally
```bash
npm install
# Create .env with your own TMDB key (never commit it)
# VITE_TMDB_API_KEY=your_key_here
npm run dev
```

## TMDB setup
Create an API key from The Movie Database, then set:
```bash
VITE_TMDB_API_KEY=your_key_here
```

Without an API key, Cine-verse uses a small fallback dataset with real TMDB image URLs so the UI still looks complete.

## Tracking dashboard

Open `/dashboard` on the main app to view the Cine-verse Signal Room. The first-party tracker records privacy-light page views, CTA clicks, searches, media views, visible app-session heartbeats, and native-player watch intervals, publishes validated events to Firebase Realtime Database, and falls back to browser storage when offline. Dashboard readers can sign in with Google to inspect Firebase telemetry and see their profile; signed-out visitors see local telemetry only. No names, movie titles, or raw query text are collected. The launch surface writes the same event shape under the `launch` site label.

Developed by king bae.
