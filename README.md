# Cine-verse

A cinematic real-time movie encyclopedia built with React + Vite.

## Run locally
```bash
npm install
cp .env.example .env
# Add your TMDB API key inside .env
npm run dev
```

## TMDB setup
Create an API key from The Movie Database, then set:
```bash
VITE_TMDB_API_KEY=your_key_here
```

Without an API key, Cine-verse uses a small fallback dataset with real TMDB image URLs so the UI still looks complete.

Developed by king bae.
