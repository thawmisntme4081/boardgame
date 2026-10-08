// Before round 1: who flies which seat, the Special Ability cards, and both players' confirm.
import { ABILITY_IDS, SEATS, type PlayerView, type Presence } from '@sky/rules';
import { Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { chooseSeat, confirmSetup, pickAbility } from '../api';
import { Button } from '@platform/ui/components/button';
import { SEAT_STYLE } from '../lib/seatStyle';
import { abilitiesChosen, isBeforeTakeoff } from '../lib/setup';
import { cn } from '@platform/ui/utils';
import { seatName } from '../messages';
import { partnerOf } from '../partner';
import { abilityText } from '../scenarioText';

/** The creator picks a seat; the partner sees the choice (their own seat turns solid). */
function RoleChoice({ view, presence }: { view: PlayerView; presence: Presence | null }) {
  const { t } = useTranslation('sky-team');
  const chosen = view.crew.rolesChosen;
  const creator = presence?.[view.seat]?.creator === true;
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium">
        {creator
          ? t(chosen ? 'preflight.rolesKept' : 'preflight.rolesYou')
          : t(chosen ? 'preflight.rolesKeptPartner' : 'preflight.rolesPartner', {
              name: partnerOf(view, presence).name,
            })}
      </p>
      <div className="flex gap-2" role="group" aria-label={t('preflight.roles')}>
        {SEATS.map((seat) => {
          const mine = chosen && seat === view.seat;
          return (
            <button
              key={seat}
              type="button"
              aria-pressed={mine}
              disabled={!creator}
              onClick={() => void chooseSeat(seat)}
              className={cn(
                'h-11 flex-1 rounded-lg border-2 px-4 text-sm font-semibold transition disabled:cursor-default tablet:flex-none',
                mine ? SEAT_STYLE[seat].seatButtonOn : SEAT_STYLE[seat].seatButton,
                !creator && !mine && 'hover:bg-transparent',
              )}
            >
              {seatName(seat)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function AbilityChoice({ view, presence }: { view: PlayerView; presence: Presence | null }) {
  const { t } = useTranslation('sky-team');
  const count = view.scenario.abilities;
  const me = presence?.[view.seat];
  const { seat: partnerSeat, info: partner, name: partnerName } = partnerOf(view, presence);
  // Two cards: one each. One card: the creator's.
  const canPick = count === 2 || me?.creator === true;
  const intro =
    count === 2
      ? t('preflight.abilitiesEach')
      : canPick
        ? t('preflight.abilitiesYou')
        : t('preflight.abilitiesPartner', { name: partnerName });
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-sm font-medium">{intro}</legend>
      <div className="grid grid-cols-1 gap-2 tablet:grid-cols-2 desktop:grid-cols-3">
        {ABILITY_IDS.map((ability) => {
          const mine = view.crew.picks[view.seat] === ability;
          const theirs =
            view.crew.picks[partnerSeat] === ability &&
            (count === 2 || view.crew.host === partnerSeat);
          const { name, rule } = abilityText(ability);
          return (
            <button
              key={ability}
              type="button"
              aria-pressed={mine}
              disabled={!canPick || theirs}
              onClick={() => void pickAbility(mine ? null : ability)}
              className={cn(
                'flex min-h-11 flex-col items-start gap-0.5 rounded-xl border-2 px-3 py-2 text-left transition disabled:cursor-default',
                mine
                  ? SEAT_STYLE[view.seat].pick
                  : theirs
                    ? SEAT_STYLE[partnerSeat].partnerPick
                    : 'border-border bg-background hover:bg-muted',
                !canPick && !mine && !theirs && 'opacity-60',
              )}
            >
              <span className="flex w-full items-center gap-1.5 text-sm font-semibold">
                {mine && <Check aria-hidden="true" className="size-4" />}
                {name}
                {(mine || theirs) && (
                  <span className="ml-auto text-xs font-normal text-muted-foreground">
                    {mine
                      ? t('preflight.yourPick')
                      : t('preflight.partnersPick', { name: partner?.name ?? '' })}
                  </span>
                )}
              </span>
              <span className="text-xs text-muted-foreground">{rule}</span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

/** Both players confirm; round 1 (and its traffic die) starts once both have. */
function ConfirmRow({ view, presence }: { view: PlayerView; presence: Presence | null }) {
  const { t } = useTranslation('sky-team');
  const { seat: partnerSeat, info: partner } = partnerOf(view, presence);
  const { rolesChosen, confirmed } = view.crew;
  const ready = Boolean(partner) && rolesChosen && abilitiesChosen(view);
  const missing = !partner
    ? t('preflight.waitingPartner')
    : !rolesChosen
      ? t('preflight.chooseRoles')
      : !abilitiesChosen(view)
        ? t('preflight.chooseAbilities')
        : null;
  return (
    <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-2 border-t pt-3">
      <p className="mr-auto text-sm text-muted-foreground" role="status">
        {missing ??
          (confirmed[view.seat]
            ? t('preflight.waitingConfirm', { name: partner?.name ?? '' })
            : partner && confirmed[partnerSeat]
              ? t('preflight.partnerConfirmed', { name: partner.name })
              : '')}
      </p>
      <Button
        className="h-11"
        disabled={!ready || confirmed[view.seat]}
        onClick={() => void confirmSetup()}
      >
        {t('preflight.confirm')}
      </Button>
    </div>
  );
}

/** Shown above the tracks until both players confirm: roles, Special Abilities, confirm. */
export function Preflight({ view, presence }: { view: PlayerView; presence: Presence | null }) {
  const { t } = useTranslation('sky-team');
  if (!isBeforeTakeoff(view)) return null;
  return (
    <section
      aria-label={t('preflight.title')}
      className="flex flex-col gap-3 border-b bg-card px-4 py-3"
    >
      <h2 className="text-sm font-semibold">{t('preflight.title')}</h2>
      <RoleChoice view={view} presence={presence} />
      {view.scenario.abilities > 0 && <AbilityChoice view={view} presence={presence} />}
      <ConfirmRow view={view} presence={presence} />
    </section>
  );
}
