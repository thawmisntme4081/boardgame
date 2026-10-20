# Pandemic 08: Drawn map and cards

[← Pandemic epic](EPIC.md) · [Master plan](../../PLAN.md) · **Status: 🚧 In progress** · Effort: **medium**

Needs [Pandemic 07](phase-07-translations.md). No images any more (the user's decision): the world map and every card are drawn in SVG, so the card names follow the player's language, the bundle gets smaller, and the board is our own art rather than the published game's pictures.

## Goals

- The board without `map.webp`: continents, links, city dots, both tracks, the deck frames, the cure slots and the supply spots drawn in SVG, at the positions `lib/mapGeometry.ts` already holds.
- Every card (city, event, Epidemic, infection, both backs) drawn by one SVG component, with its texts in the player's language.
- No `<image>` or `<img>` left in the game, and `src/assets/` gone.

## Feature scope

- **In:** coastlines from Natural Earth (public domain; the `world-atlas` package, 1:110m), generated once by a dev script into a committed path (`src/lib/worldLand.ts`) and fitted to the cities' current positions (the board is stylized, so the cities keep their places and the land is the backdrop); the links from `cities.ts` (the Pacific ones split at the map's edges); `components/BoardFurniture.tsx` (tracks, frames, slots); `svgs/Card.tsx`; replacing every use of `lib/cardImages.ts`.
- **Out:** a new layout (every position stays); the expansions' side boards (Pandemic 12 and 13).

Settled with the user: real continents (not a dot grid or an abstract network); one SVG card component with a band in the disease color, the name, an icon and the short effect for events.

## Tasks

Each task is about one sitting (**L** = low, **M** = medium effort) and ends with typecheck, lint and format passing; tests are written and run at the end of the phase, after your review.

- [x] 1. **M** Coastlines, generated once: `games/pandemic/client/scripts/world-map.ts` (devDependencies `world-atlas`, `topojson-client`, `d3-geo`) holds each city's longitude and latitude, fits an equirectangular projection (scale and offset, least squares) onto `CITY_POINTS`, writes the land as one simplified path into `src/lib/worldLand.ts` and prints how far each city is from its real place; `pnpm --filter @pandemic/client world-map` runs it. Done: the least-squares fit alone left cities up to 62 px from their real places (the board is stylized: New York, Manila, Europe), so the land is then bent by a thin-plate spline that takes each city's real place to its place on the board, with points around the frame kept still; the Miller projection fits best (rms 29.4 px before the bend). `src/lib/worldLand.ts`: 43.5 KB of path; devDependencies `world-atlas`, `topojson-client`, `d3-geo`, their types and `tsx`; the client's typecheck covers `scripts/`.
- [x] 2. **M** `WorldMap` without the picture: the ocean, the land, the links (each Pacific pair as two half-lines leaving the left and right edges), a dot in each city's disease color; the labels, tap targets, reach rings and background click stay. Done: `Backdrop` in `WorldMap.tsx` (ocean, `WORLD_LAND`, every link once; the three Pacific links as half-lines running to the left and right edges on the line to the other city's copy beyond the edge), a dot in each city's disease color (`--color-disease-*`); labels, tap targets, reach rings and the background click unchanged. The tracks, frames and supply spots the picture used to draw are gone until task 3; `map.webp` itself is deleted in task 5.
- [x] 3. **M** Board furniture in SVG (`components/BoardFurniture.tsx`, under `MapTracks`): the outbreak track (9 diamonds, the last a skull), the infection rate track (7 circles with `INFECTION_RATES`), the cure slots, the four deck and discard frames, the supply spots. Done: `components/BoardFurniture.tsx`, drawn by `WorldMap` right after the backdrop: the outbreak track (nine diamonds numbered 0 to 7 joined by a line, the last a red skull from lucide), the infection rate track (a green pill of seven circles with the rates), the four cure slots outlined in their disease colors (a light gray for black), the supply panel under the counters, and the four dashed pile frames (green for infection, white for player); the comments in `MapTracks` and `mapGeometry` no longer speak of the picture. Looked at in a rendered screenshot; the card piles still show the old pictures until tasks 4 and 5.
- [x] 4. **M** `svgs/Card.tsx`: a city player card (208 × 290 ratio; a band in the disease color, `cityName`), an event card (icon, name, `eventInfo` effect), the Epidemic card (its three steps), an infection card (279 × 200 ratio), both backs; sized by `width` and `height`; new texts in `en`, `vi` and `fr`. Done: `svgs/Card.tsx` (`<Card face width height />`, itself an `<svg>` with the card's own `viewBox`, so it nests in the map or stands alone; sizes in `lib/cardSizes.ts`): the city card (a band with the disease's name, the city name large in the middle, three stacked cubes of the disease under it) and the infection card (a band, the city name at the top of the body, three small cubes in a row at the bottom); the user rejected the first design's circle and a name-in-the-band layout, the event card (a lucide icon, the name, the effect text wrapped and shrunk to fit), the Epidemic card (three numbered steps), the infection card, and both backs (a globe, a biohazard); names read in the current language and shrink to fit; new keys `cards.event`, `cards.epidemic`, `cards.infection` in `en`, `vi` and `fr`. Checked on rendered contact sheets in the three languages (the longest city names and the longest event text). Nothing uses it yet: task 5 swaps the pictures for it.
- [x] 5. **M** Replace every picture: `HandCards`, `MapTracks` (`Pile`), `InfectionDrawFlight`, `ShuffleFlight`, `DeckBuild`, `EpidemicCard`, `ForecastDialog` and `WorldMap`; delete `lib/cardImages.ts` and `src/assets/`; titles and `aria-label`s stay. Done: `HandCards`, `MapTracks` (`Pile` takes a `face`), `InfectionDrawFlight` (the back and the face are two `Card`s, the flip animates them as before), `ShuffleFlight`, `DeckBuild`, `EpidemicCard`, `ForecastDialog` (an inline `Card`) all draw `Card`; `handFace` in `lib/cards.ts`; `Card` takes a `title`; `lib/cardImages.ts` and `src/assets/` (112 files) deleted; the two image tests of `board.test.tsx` that no longer compiled now check the drawn faces (the rest of the phase's tests are task 7); the client suite passes.
- [x] 6. **L** Look check on desktop in English, Vietnamese and French: the longest names fit on the cards, the map reads well under the pawns and cubes, enough contrast; the bundle size before and after. Done: a real 2-player game on the production build at 1440 × 1000 in English, Vietnamese and French, with outbreaks, a cured and an eradicated disease, three stations, infection and player discards, and a hand with city and event cards. Zero image requests in all three; the cards, the longest names (Ho Chi Minh City / TP. Hồ Chí Minh / Hô Chi Minh-Ville, St. Petersburg / St-Pétersbourg) and the longest event text fit; the map, links, tracks and pile frames read well under the pawns and cubes. Bundle: the Pandemic chunk is 191 KB with the 43 KB of land, and 2.9 MB of pictures are gone (112 files). Small things seen, left as they are: a few city labels sit under a pawn or cubes (Washington, Le Caire), as they did before; the discard pile's small event card has text too small to read (its popover and the hand carry it).

**Checks**

- The land was reshaped at the user's request: the first version bent it so every city sat exactly on its board spot, which crushed Europe and stretched the continents. The land is now a lightly bent one (smoothing 12000, the user's pick) and the 48 cities were moved onto it instead (`CITY_POINTS` in `lib/mapGeometry.ts`, at most 35 px from the old places; `scripts/world-map.ts` computes them: dry land, 25 px apart with more room across than down so labels fit). The script keeps the old places as `FIT_PLACES`, so a new run draws the same land.
- Added later at the user's request: a place for the Contingency Planner's stored event card at the top left of the map, large (`CONTINGENCY_FRAME`, 120 × 167; drawn by `MapTracks` while that role is in play, with the event's card in it; text `tracks.contingencyCard`), instead of the "Stored:" line on its role card (`roles.stored` removed). The bottom row shares one bottom edge (`BOARD_BOTTOM`): cure slots, supply panel, player deck and player discard pile, the last two the same size (102.5 × 143) and moved left of Sydney.
- [ ] 7. **M** Write the phase's tests and run the full suite: `pnpm test`, `pnpm e2e`, `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm build` (after your review of the other tasks). The image tests of `board.test.tsx` become: every card shows its city's name in the language, 48 dots and every link drawn once (the Pacific ones split), no `<image>` or `<img>` on the board; card faces tested in French.

## Checklist

- [ ] Map, furniture and cards drawn in SVG; `src/assets/` removed
- [ ] Cards read in all three languages
- [ ] Tests passing

## Open questions

- None yet.

**Done when:** a full game on desktop shows no image request in the browser, and the map and every card read correctly in all three languages.
