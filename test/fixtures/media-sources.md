Media API fixtures:

- `openverse-sfx.json`: first result of `GET https://api.openverse.org/v1/audio/?q=whoosh&license=cc0,by,by-sa,pdm&page_size=3`, recorded 2026-10-17.
- `openverse-music.json`: first result of `GET https://api.openverse.org/v1/audio/?q=ambient&category=music&license=cc0,by,by-sa,pdm&page_size=3`, recorded 2026-10-17.
- `pexels-video.json`: the published Video Resource response from https://www.pexels.com/api/documentation/ (2026-10-17), with the documentation's ellipses removed and preview pictures shortened. This is a documentation fixture, not a live authenticated recording. No Pexels API key was available. Its `oauth2_token_id` query parameter is part of the public example file URL, not an API key.
