# XLab website

Static source for the UChicago Existential Risk Laboratory site. There is no
build step. The site is published by GitHub Pages from the `main` branch, so
merging to `main` deploys it. Preview: https://uchicago-xlab.github.io/website/

## Layout

| Path | What it is |
| --- | --- |
| `*.html` | The seven pages. Navigation and footer are identical across them. |
| `css/site.css` | Shared responsive layer (tablet and phone layouts, mobile menu). Page styling is otherwise inline in each HTML file. |
| `js/site.js` | Mobile menu toggle, News carousel, pop-up modals, and the scroll-in reveal for elements marked `data-reveal`. |
| `js/image-slot.js` | The `<image-slot>` web component used for headshots and logos. Read-only on the live site; images come from each slot's `src`. |
| `brand/` | Logos, risk-area icons, and the XOX fonts (`brand/fonts/`). |
| `images/` | Page photography and funder logos. |
| `images/people/` | Team, faculty, and program headshots. |
| `images/fellows/` | Headshots for the Past Fellows' Work page. |
| `files/` | PDFs linked from the site. Older cohorts keep the paths they had on the old xrisk.uchicago.edu site so existing links keep working; new cohorts go in `files/<year>/`. |

## Editing notes

- To change a headshot, drop the new file in `images/people/` and point the
  slot's `src` at it. Every `<image-slot>` should carry a `src`; a slot without
  one renders a grey "photo" placeholder.
- The nuclear working group entries for Peters and Cullison still have no
  photo (no file was available when the site was assembled).
- To add a fellow to the Past Fellows' Work page: put the PDF in `files/<year>/`, the headshot in `images/fellows/` as `<year>-<first-last>.webp` (square, face centred), copy one card block in `fellows-outputs.html`, and make sure a year button exists for that cohort.
- Responsive rules live in `css/site.css` and override the inline desktop
  styles with `!important`. Breakpoints are 900px (tablet) and 640px (phone).

## After changing css/site.css or js/site.js

Browsers and GitHub's CDN cache those files by name. Bump the `?v=` version
on the `<link>` and `<script>` tags in every page (they all carry the same
value) so visitors pick up the new file instead of a cached copy.
