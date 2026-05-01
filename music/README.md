# Background music — drop your own tracks here

Drop royalty-free MP3s into this folder and they'll be picked up automatically as
the in-game background music. The game keeps a queue of every discovered track
and loops it forever. If no tracks are found, the original synth chiptune is used.

## Two ways to add tracks

### Option 1 — manifest (any filenames, any order)

Edit `manifest.json` and list each file:

```json
{
  "tracks": [
    "kickoff.mp3",
    "bossa-nova-loop.mp3",
    "outro.mp3"
  ]
}
```

Files play in the order listed.

### Option 2 — numbered files (zero config)

If `manifest.json` has no tracks (or is missing), the game falls back to probing
for `1.mp3`, `2.mp3`, `3.mp3`, … up to `20.mp3`. It stops at the first miss.
So just name your files `1.mp3`, `2.mp3`, … and you're done — no config to edit.

**`.mpeg` and `.mpg` extensions are also accepted** by the numeric probe — for each
slot the game tries `.mp3` first, then `.mpeg`, then `.mpg`. So `1.mpeg`, `2.mp3`,
`3.mpg` would all be found in order. (For exotic extensions like `.m4a`, `.ogg`,
or `.wav`, use the manifest — those work too, the probe just doesn't look for them.)

## Switching between MP3 and synth in-game

When at least one track is detected, a 🎵 / 🎹 button appears in the top bar
next to the mute toggle. Click it to switch between your MP3 queue and the
built-in synth chiptune. The choice is remembered between visits.

## Notes

- Files are served directly from this folder, so they should be small enough
  to download quickly (under ~5 MB each is comfortable on mobile data).
- The mute button silences both modes. Tab-hidden auto-pauses both modes.
- This folder is committed to the repo, so any tracks you add ship to GitHub.
  Don't drop in anything you don't have rights to redistribute.
