# 2048 for Hadyn

Private anniversary 2048. Static files — drop on Cloudflare Pages when you’re ready.

## Add photos

Put square WebP files in `photos/` named:

`2.webp` `4.webp` `8.webp` `16.webp` `32.webp` `64.webp` `128.webp` `256.webp` `512.webp` `1024.webp` `2048.webp`

Aim for 200–400px, compressed. Missing files show a numbered pink tile. Captions are in `config.js`.

## Add music

Drop a track at `audio/song.mp3`. The Music button is already wired.

## Run locally

Open `index.html` in a browser, or:

```bash
npx --yes serve .
```

Tests:

```bash
node game.test.js
```

## Cloudflare later

Pages: upload this folder. Then put **Cloudflare Access** in front of the project so the photos aren’t reachable by URL. The in-page password is a gift lock, not a server gate.
