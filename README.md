# XLab website

Static source for the UChicago Existential Risk Laboratory site. Upload the
contents of this folder (everything except `archive/`) to the web host as-is;
there is no build step.

## Layout

| Path | What it is |
| --- | --- |
| `*.html` | The seven pages. Navigation and footer are identical across them. |
| `css/site.css` | Shared responsive layer (tablet and phone layouts, mobile menu). Page styling is otherwise inline in each HTML file. |
| `js/site.js` | Mobile menu toggle. |
| `js/image-slot.js` | The `<image-slot>` web component used for headshots and logos. Read-only on the live site; images come from each slot's `src`. |
| `brand/` | Logos, risk-area icons, and the XOX fonts (`brand/fonts/`). |
| `images/` | Page photography and funder logos. |
| `images/people/` | Team, faculty, and program headshots. |
| `images/fellows/` | Headshots for the Past Fellows' Work page. |
| `archive/` | Files kept for reference that the site does not use. See `archive/README.md`. Do not upload. |

## Editing notes

- To change a headshot, drop the new file in `images/people/` and point the
  slot's `src` at it. Every `<image-slot>` should carry a `src`; a slot without
  one renders a grey "photo" placeholder.
- The nuclear working group entries for Peters and Cullison still have no
  photo (no file was available when the site was assembled).
- Responsive rules live in `css/site.css` and override the inline desktop
  styles with `!important`. Breakpoints are 900px (tablet) and 640px (phone).
