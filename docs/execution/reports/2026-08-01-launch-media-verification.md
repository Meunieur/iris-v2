# Iris v2 launch-media verification

- **Date:** 2026-08-01
- **Scope:** source-preview hero, GitHub social preview and silent launch loop
- **Result:** PASS

## Provenance and boundary

- The composition uses the Iris v2 aperture icon, the tokens and visual rules
  in `DESIGN.md`, and a sanitized representative Neural Observatory capture.
- Rendering was local and code-native through browser frame capture and
  FFmpeg. No HeyGen account, remote media provider or external stock asset was
  used.
- The media contains no desktop chrome, taskbar, personal path, credential,
  private session content or copied JarvisOS data.
- The graph is labelled as local representative data and the copy keeps
  JarvisOS as the sole authority for memory, policy and execution.
- The media claims only the verified source-preview/read-only boundary. It
  shows no provider conversation, workflow mutation or successful task event.

## Artifact evidence

| Artifact | Dimensions / duration | Bytes | SHA-256 |
|---|---:|---:|---|
| `iris-v2-readme-hero.png` | 1600 x 900 | 396068 | `4CA14C1FC9AB1831F3A73AAF4CD0CF4557B0024508E4C9E529D24A8847837B06` |
| `iris-v2-social-preview.png` | 1280 x 640 | 282675 | `0C530A981211D70E89FFF49521FB63508020570646B3C535A6A4056E7B416B28` |
| `iris-v2-launch-loop.mp4` | 1920 x 1080, 8.000 s, 30 fps | 2030266 | `67E922E084E883B2F2B988CDF044C6B259905F825782F02A0249C388C41F0609` |

The MP4 contains one H.264 video stream and no audio stream. A four-frame
contact sheet plus the full-size hero and social image were visually reviewed
for crop, contrast, readable hierarchy, private content and false behavior
claims.

## Public-surface control

The three binaries are individually approved in
`tools/release/public-surface.json`. `docs/media/**` is public, while the
release preflight continues to default-deny every unlisted binary and internal
coordination path.
