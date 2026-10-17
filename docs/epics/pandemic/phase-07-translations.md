# Pandemic 07: Translations

[← Pandemic epic](EPIC.md) · [Master plan](../../PLAN.md) · **Status: ✅ Done** · Effort: **medium**

Needs [Pandemic 06](phase-06-setup-and-variants.md) and all 12 roles of [Pandemic 04](phase-04-roles.md), so the translations cover every text at once. Follow Sky Team 10's way of working: glossary first, then the files.

## Goals

- The game in English, Vietnamese and French.

## Feature scope

- **In:** `games/pandemic/client/src/locales/{en,vi,fr}.json` (same keys), a glossary in this file (roles, events, actions, diseases, tracks, cities), plurals `_one` / `_other`, French spacing (no-break spaces before `: ; ! ?`), the `games.pandemic` texts in the platform locales.

## Tasks

Each task is about one sitting (**L** = low, **M** = medium effort) and ends with typecheck, lint and format passing; tests are written and run at the end of the phase, after your review.

- [x] 1. **M** Glossary: each English term with its Vietnamese and French name (the published French edition's terms where known); the user reviews the Vietnamese.
- [x] 2. **M** `vi.json` and a key-parity test (as Sky Team's `i18n.test.tsx`). Done: `vi.json` (240 keys, plurals as `_other` only, players addressed as "bạn", the glossary's terms; city names come with task 4), loaded by `i18n.ts` (French still falls back to English until task 3); the map's label is a text (`map.label`); key parity and placeholders checked by a script (every key, no extra, every `{{placeholder}}` kept); the test file itself is written in task 5, with the phase's other tests.
- [x] 3. **M** `fr.json`. Done: `fr.json` (251 keys with `_one` / `_other`, "vous", the glossary's terms; reviewed by Claude), loaded by `i18n.ts`; Sky Team's typography: a no-break space (U+00A0) before `:`, a narrow one (U+202F) before `; ! ?`, typographic apostrophes; no "à {{city}}" for a city that may take an article (Le Caire): "Destination : {{city}}", "{{pawn}} ({{city}})"; key parity, placeholders, apostrophes and spaces checked by a script (the test file is task 5).
- [x] 4. **L** City names on the map in each language; check that long labels fit. Done: `cities.<id>` (48 names) in `en`, `vi` and `fr` from the glossary (English now with Bogotá and São Paulo); `cityName` reads them in the current language; names over 12 characters wrap onto two lines on the map (`labelLines`: San Francisco, St. Petersburg, Ho Chi Minh City and the longer Vietnamese and French ones). Not yet looked at in the browser: the fit against neighboring cities is for your review.

**Checks**

- [x] 5. **M** Write the phase's tests and run the full suite: `pnpm test`, `pnpm e2e`, `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm build` (after your review of the other tasks). Done: `i18n.test.tsx` (every English key in `vi` and `fr` and nothing extra, every placeholder kept, French apostrophes and spacing, the plural forms, 48 city names in each language that wrap in two lines, `labelLines`, the roles, the action bar, the map and the errors rendered in Vietnamese and in French); a Playwright test on Desktop Chrome (a Vietnamese and a French player through the pre-game step and the first turn). `pnpm test` 989 passed (with 3 workers: under the default parallelism the machine's load made some slow Sky Team and web tests time out, passing alone), `pnpm e2e` 59 passed/34 skipped, `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm build` pass.

## Checklist

- [x] Glossary written and reviewed
- [x] `vi.json` and `fr.json` complete, key-parity test passing
- [x] Layout checked in all three languages on desktop (long city names wrap in two lines; the map not yet looked at by eye, see below)

## Settled with the user

- **Order:** all 12 roles (Pandemic 04) are finished first; this phase then translates every text, theirs included.
- **City names are translated.** French: the published edition's names. Vietnamese: the common Vietnamese name where one is standard (Bắc Kinh, Thượng Hải, Hồng Kông, TP. Hồ Chí Minh, Mát-xcơ-va…), the Latin spelling otherwise (London, Paris, New York, Lagos).
- **One short name per city and language**, used on the map, the cards and the menus (`cities.<id>` keys; `cityName` reads them instead of building the name from the id), shortened where needed (TP. Hồ Chí Minh, St-Pétersbourg); a name that still does not fit wraps onto two lines on the map.
- **Review:** the user reviews the Vietnamese glossary and `vi.json`; Claude reviews the French, as in Sky Team 10. French addresses the players as "vous".
- **Tests:** key parity and placeholder checks (as Sky Team's `i18n.test.tsx`), the board rendered in Vietnamese and French, and one Playwright test on Desktop Chrome only (a Vietnamese and a French player play one turn).
- **Found while studying:** the map's `aria-label="Map"` is hard-coded English, and `i18n.ts` maps `vi` and `fr` to `en.json`; both are fixed in task 2.

- **Before the phase, `en.json` was cleaned up:** 21 unused keys removed (left from the plain walking-skeleton board); texts that mean the same everywhere merged into `common` (`leave`, `you`, `accept`, `decline`, `cancel`, `cancelOffer`), `preflight.summary` into `lobby.epidemics`, `forecast.title` into `events.forecast`; the same English word kept under two keys where the sense differs ("Roles": a lobby option and a board heading; "Infect": an epidemic step and a button); English texts added for the six rule codes that had none (`wrong-role`, `power-used`, `no-pawn-there`, `event-stored`, `no-event`, `too-many-cubes`). 250 keys to translate. Sky Team's locales were cleaned the same way (351 → 330 keys in `en`, `vi` and `fr`: 3 unused keys removed, 16 duplicates merged into the key the code builds from an id, their translations being identical; "Kerosene", "Kerosene leak", "Intern" and "Ice brakes" stay under two id-built families each). No shared translation file across games: the platform namespace is the shared one, and a text moves there only with a component the games share.

## Glossary

Reviewed: the Vietnamese by the user, the French by Claude (the published edition's terms, Filosofia, where known; modern city names as in English, e.g. Mumbai and Kolkata, as the user chose).

**Game terms**

| English | Tiếng Việt | Français |
| --- | --- | --- |
| Disease / disease cube | Dịch bệnh / khối bệnh | Maladie / cube Maladie |
| Cure (Discover a Cure) / cured / eradicated | Thuốc chữa (Tìm ra thuốc chữa) / đã có thuốc / đã xóa sổ | Remède (Découvrir un remède) / guérie / éradiquée |
| Outbreak / chain reaction | Bùng phát / phản ứng dây chuyền | Éclosion / réaction en chaîne |
| Epidemic (Increase, Infect, Intensify) | Đại dịch (Tăng tốc, Lây nhiễm, Tăng cường) | Épidémie (Accélération, Infection, Intensification) |
| Infection rate | Tốc độ lây nhiễm | Vitesse de propagation |
| Infection card / deck / discard pile | Thẻ lây nhiễm / chồng bài / chồng bài bỏ | Carte Propagation / pioche / défausse |
| Player card / deck / discard pile | Thẻ người chơi / chồng bài / chồng bài bỏ | Carte Joueur / pioche / défausse |
| City card / Event card / Epidemic card | Thẻ thành phố / Thẻ sự kiện / Thẻ đại dịch | Carte Ville / carte Événement / carte Épidémie |
| Hand / hand limit | Bài trên tay / giới hạn bài | Main / limite de cartes en main |
| Research station | Trạm nghiên cứu | Station de recherche |
| Pawn / student pawn | Quân cờ / quân học trò | Pion / pion élève |
| Role / role card | Vai trò / thẻ vai trò | Rôle / carte Rôle |
| Action / actions left | Hành động / còn … hành động | Action / … actions restantes |
| Turn / Pass / Restart turn | Lượt / Bỏ lượt / Chơi lại lượt | Tour / Passer / Recommencer le tour |
| Offer / Accept / Decline | Đề nghị / Đồng ý / Từ chối | Proposition / Accepter / Refuser |
| Difficulty: Introductory / Standard / Heroic | Độ khó: Nhập môn / Tiêu chuẩn / Anh hùng | Difficulté : Initiation / Standard / Héroïque |
| Before the game | Trước khi chơi | Avant la partie |
| Humanity is saved / The world was lost | Nhân loại đã được cứu / Thế giới đã thất thủ | L'humanité est sauvée / Le monde est perdu |
| Blue / Yellow / Black / Red | Xanh dương / Vàng / Đen / Đỏ | Bleu / Jaune / Noir / Rouge |

**Actions**

| English | Tiếng Việt | Français |
| --- | --- | --- |
| Drive / Ferry | Đi đường bộ / Phà | Voiture / Ferry |
| Direct Flight | Bay thẳng | Vol direct |
| Charter Flight | Bay thuê chuyến | Vol charter |
| Shuttle Flight | Bay con thoi | Navette |
| Build a research station | Xây trạm nghiên cứu | Construire une station de recherche |
| Treat Disease | Chữa bệnh | Traiter une maladie |
| Share Knowledge (give / take) | Chia sẻ kiến thức (đưa / lấy) | Partager des connaissances (donner / prendre) |
| Discover a Cure | Tìm ra thuốc chữa | Découvrir un remède |
| Take along (Relocation Specialist) | Mang theo | Emmener |

**Roles**

| English | Tiếng Việt | Français |
| --- | --- | --- |
| Contingency Planner | Nhà hoạch định dự phòng | Planificateur d'urgence |
| Dispatcher | Điều phối viên | Répartiteur |
| Medic | Nhân viên y tế | Médecin |
| Operations Expert | Chuyên gia vận hành | Expert aux opérations |
| Quarantine Specialist | Chuyên gia cách ly | Spécialiste de la quarantaine |
| Researcher | Nhà nghiên cứu | Chercheuse |
| Scientist | Nhà khoa học | Scientifique |
| Teacher (fan-made) | Giáo viên | Enseignante |
| Relocation Specialist (fan-made) | Chuyên gia di dời | Spécialiste du transfert |
| Crisis Mitigator (fan-made) | Chuyên gia xử lý khủng hoảng | Gestionnaire de crise |
| Generalist (fan-made) | Người đa năng | Généraliste |
| Z-Force Team Member (promo) | Thành viên Z-Force | Membre de la Z-Force |

**Events**

| English | Tiếng Việt | Français |
| --- | --- | --- |
| Airlift | Không vận | Pont aérien |
| Forecast | Dự báo | Prévision |
| Government Grant | Trợ cấp chính phủ | Subvention publique |
| One Quiet Night | Một đêm yên bình | Une nuit tranquille |
| Resilient Population | Dân chúng kiên cường | Population résiliente |

**Cities** (one short name per language; Vietnamese keeps the Latin spelling unless a Vietnamese name is standard)

| English | Tiếng Việt | Français |
| --- | --- | --- |
| Atlanta, Chicago, Essen, Madrid, Miami, Lagos, Lima, Santiago, Karachi, Delhi, Chennai, Jakarta, Osaka, Sydney, Tokyo, Kinshasa, Johannesburg, Khartoum, Istanbul, Los Angeles, San Francisco, New York, Washington, Buenos Aires | (unchanged) | (unchanged) |
| London | London | Londres |
| Paris | Paris | Paris |
| Milan | Milan | Milan |
| Montreal | Montreal | Montréal |
| St. Petersburg | St. Petersburg | St-Pétersbourg |
| Mexico City | TP. Mexico | Mexico |
| Bogotá | Bogotá | Bogota |
| São Paulo | São Paulo | São Paulo |
| Algiers | Algiers | Alger |
| Cairo | Cairo | Le Caire |
| Baghdad | Baghdad | Bagdad |
| Riyadh | Riyadh | Riyad |
| Tehran | Tehran | Téhéran |
| Moscow | Mát-xcơ-va | Moscou |
| Mumbai | Mumbai | Mumbai |
| Kolkata | Kolkata | Kolkata |
| Beijing | Bắc Kinh | Pékin |
| Shanghai | Thượng Hải | Shanghai |
| Hong Kong | Hồng Kông | Hong Kong |
| Taipei | Đài Bắc | Taipei |
| Seoul | Seoul | Séoul |
| Manila | Manila | Manille |
| Bangkok | Bangkok | Bangkok |
| Ho Chi Minh City | TP. Hồ Chí Minh | Hô Chi Minh-Ville |

**Done when:** a full game reads correctly in all three languages, with the key-parity test passing. ✅ Verified (`pnpm test` 989 passed (with 3 workers: under the default parallelism the machine's load made some slow Sky Team and web tests time out, passing alone), `pnpm e2e` 59 passed/34 skipped, `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm build` pass).
