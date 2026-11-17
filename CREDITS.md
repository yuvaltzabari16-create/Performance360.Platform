# Credits and licences

Every font, icon, image and video the Performance360 Platform uses, where it comes from, and its licence. Open-source
code libraries are listed separately on the in-app `/licenses` page (generated from `src/lib/legal/dependency-licenses.json`
and checked in CI by `npm run check:licenses`). Checked against the repository on 2026-11-17.

## Fonts

| Font | Where | Source | Licence |
|---|---|---|---|
| System fonts (SF Pro, Segoe UI, Roboto, Heebo or Arial, whichever the device has) | All app text (`--font-sans` in `src/app/globals.css`) | Installed on the visitor's device; the app ships and loads no font files (`font-src 'self'`) | Each device's own licence; nothing is distributed |
| Heebo | Text in the share image `src/app/opengraph-image.png` (rendered into the picture) | Google Fonts | SIL Open Font License 1.1 (commercial use allowed, no visible credit required) |

## Icons and logo

| Item | Source | Licence |
|---|---|---|
| Interface icons (`src/components/ui/Icon.tsx`, `src/components/shell/NavLinks.tsx`, `QuickSheet.tsx`, `ThemeSwitch.tsx` and inline SVGs) | 24×24 line paths written in this repository; no icon library or icon font is imported | Project's own work |
| Performance360 logo (`Logo` in `src/components/ui/index.tsx`) and `src/app/favicon.ico` | The business's own mark | Owned by performance360 |

## Images

| Item | Source | Licence |
|---|---|---|
| Share image `src/app/opengraph-image.png` (1200×630) | Rendered in this repository from the app's colours, logo and text | Project's own work |
| Pitch heat map, charts, avatars | Drawn in code from the user's own data | Project's own work |

The app contains no stock photos. Where a picture would be needed and none is owned, a clear placeholder is used instead.

## Exercise videos (`supabase/data/exercise-library.json`, 347 exercises)

| Host | Count | How it is used | Terms |
|---|---|---|---|
| YouTube | 344 | Embedded with YouTube's own player from the privacy-enhanced domain `youtube-nocookie.com`; thumbnails from `i.ytimg.com`. Nothing is downloaded or re-hosted. | YouTube Terms of Service: embedding through the YouTube player is allowed unless the owner has turned it off. Rights stay with each video's channel; the player shows the channel name. |
| sciofmultispeed.com | 3 | **The MP4 files are played straight from that site** ("Eccentric Rate of Force Development Examples", "Braking Strategy Training", "Technical Framework for 180 Degree Pivot") | **No licence on record.** Linking a third party's video files into the app is not covered by an embed licence. Get written permission from the site owner, link to their page instead of the file, or replace the videos. |

Coaches can add their own video links; they are responsible for having the right to share them (see `/terms`).
