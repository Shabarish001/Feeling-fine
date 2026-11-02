# FEELING FIND design system (Liquid Glass + editorial ivory/lavender)

Skill: `.claude/skills/liquid-glass-claude-skill`. Tokens: `app/styles/tokens.css`. Materials: `app/styles/glass.css`.

## Layer map

| Element | Layer | Glass | Tier | Reason |
|---|---|---|---|---|
| Header pill | Functional | yes | Regular | Floats over scrolling content, always reachable |
| Results filter bar (search/sort) | Functional | yes | Regular | Sticky over the product grid |
| Map toolbar (search/tag filters) | Functional | yes | Regular (static on phones) | Floats over the map |
| Store detail sheet | Functional | yes | Thick | Text-dense, contextual overlay |
| Home store-search control | Functional | yes | Regular | Sits over brand light, in view with the header only |
| Hero tags on sculpture | Decorative label | static variant | none | Same look, no per-frame cost |
| Product cards, store cards, wizard card, forms, chat, imagery | Content | no | none | Content stays solid and readable |

Budget: desktop ≤3 filtered layers per view (stores page: header, toolbar, sheet); phones ≤2.
Fallbacks: `@supports not backdrop-filter`, `prefers-reduced-transparency`, `prefers-contrast: more`, `forced-colors` all give solid fills with visible borders.

## Shared pieces
- Tokens: colour, type, 4/8 spacing, radius roles, ink-tinted shadows, glass tier opacity/blur, motion.
- Classes: `.glass .glass-thin|regular|thick`, `.glass-static`, `.btn`/`.discover-button` (single tinted primary), `.btn-secondary`, `.tag`, `.badge-demo|live`, `.card`, `.choice`.
- Components (`components/ui`): `Reveal`, `FabricSculpture` (CSS 3D, no dependency), `GarmentArt`. Discover split into `Choices`, `ProductCard`, `ResultsView`, `LoadingEdit`.

## Limitations
- No licensed fashion photography is bundled; imagery is illustrated (garment silhouettes, CSS fabric sculpture). Real product photos show automatically for non-demo products that have `image_url`.
- Refraction/lensing from the skill (SVG displacement) was not implemented; the glass is blur, tint, rim light and shadow.
- Contrast over glass was not measured with tooling. Text sits on Regular/Thick fills at 0.72/0.86 ivory opacity.
- Wishlist uses the existing `save` feedback action, so it needs an account.
- The nearby-stores chat reply depends on the Anthropic key; in the screenshots it was still loading.
