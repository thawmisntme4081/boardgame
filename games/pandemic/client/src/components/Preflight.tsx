import {
  ROLE_IDS,
  checkPreflight,
  type PreflightMove,
  type RoleId,
  type SeatId,
  type SetupView,
} from '@pandemic/rules';
import { Button } from '@platform/ui/components/button';
import type { SeatPresence } from '@platform/ui/game';
import { useTranslation } from 'react-i18next';
import { seatName } from '../lib/names';
import { platform } from '../platform';

/** Text on a role's color: dark on the light ones. */
const TEXT_ON: Record<RoleId, string> = {
  'contingency-planner': 'text-black',
  dispatcher: 'text-white',
  medic: 'text-black',
  'operations-expert': 'text-black',
  'quarantine-specialist': 'text-white',
  researcher: 'text-white',
  scientist: 'text-black',
};

/** A role's card: its name and power, on its color. */
function RoleFace({ role, who }: { role: RoleId; who?: string }) {
  const { t } = useTranslation('pandemic');
  return (
    <div
      data-role={role}
      className={`flex flex-col gap-1 rounded-lg border p-3 text-left shadow-sm ${TEXT_ON[role]}`}
      style={{ background: `var(--color-role-${role})` }}
    >
      {who && <span className="text-xs opacity-80">{who}</span>}
      <span className="font-semibold">{t(`roles.${role}.name`)}</span>
      <span className="text-xs">{t(`roles.${role}.power`)}</span>
    </div>
  );
}

/**
 * "Before the game": the turn order and the difficulty, then the roles (dealt, or picked from the
 * free ones until you confirm). Everyone confirms; the last confirm deals the board. Nothing here
 * decides a rule: the buttons follow `checkPreflight`, the same check the server runs.
 */
export function Preflight({ view, presence }: { view: SetupView; presence: SeatPresence | null }) {
  const { t } = useTranslation('pandemic');
  const { you, seats, picks, confirmed, roleMode } = view;
  const can = (move: PreflightMove) => !!you && checkPreflight(view, you, move).ok;
  const send = (move: PreflightMove) => void platform().send(move);
  const waiting = seats.filter((seat) => !confirmed.includes(seat));
  const holder = (role: RoleId): SeatId | undefined => seats.find((seat) => picks[seat] === role);
  const done = !!you && confirmed.includes(you);

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 p-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">{t('preflight.title')}</h1>
        <p className="text-sm text-muted-foreground">
          {t('preflight.summary', { count: view.epidemics })} · {t(`preflight.${roleMode}`)}
        </p>
      </header>

      <section aria-labelledby="order-title" className="flex flex-col gap-2">
        <h2 id="order-title" className="font-semibold">
          {t('preflight.order')}
        </h2>
        <ol className="flex flex-wrap gap-2">
          {seats.map((seat, i) => (
            <li
              key={seat}
              className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm"
              style={{ borderColor: `var(--color-seat-${seat})` }}
            >
              <span className="font-semibold">{i + 1}.</span>
              <span>{seatName(presence, seat)}</span>
              {seat === you && (
                <span className="text-muted-foreground">({t('preflight.you')})</span>
              )}
              {confirmed.includes(seat) && (
                <span className="font-medium text-green-700">{t('preflight.ready')}</span>
              )}
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="roles-title" className="flex flex-col gap-2">
        <h2 id="roles-title" className="font-semibold">
          {t('roles.title')}
        </h2>
        {roleMode === 'random' ? (
          <div className="grid gap-2 tablet:grid-cols-2">
            {seats.map((seat) => {
              const role = picks[seat];
              return role ? (
                <RoleFace key={seat} role={role} who={seatName(presence, seat)} />
              ) : null;
            })}
          </div>
        ) : (
          <>
            <p className="text-sm">{done ? t('preflight.locked') : t('preflight.pickHint')}</p>
            <div
              role="group"
              aria-label={t('roles.title')}
              className="grid gap-2 tablet:grid-cols-2"
            >
              {ROLE_IDS.map((role) => {
                const by = holder(role);
                const mine = by === you;
                const free = !by;
                return (
                  <button
                    key={role}
                    type="button"
                    disabled={!can({ type: 'pick-role', role })}
                    aria-pressed={mine}
                    onClick={() => send({ type: 'pick-role', role })}
                    className={`rounded-lg text-left outline-offset-2 disabled:cursor-not-allowed ${
                      mine ? 'ring-4 ring-primary' : ''
                    } ${!free && !mine ? 'opacity-50' : ''}`}
                  >
                    <RoleFace
                      role={role}
                      who={
                        mine
                          ? t('preflight.yours')
                          : by
                            ? t('preflight.takenBy', { name: seatName(presence, by) })
                            : undefined
                      }
                    />
                  </button>
                );
              })}
            </div>
          </>
        )}
      </section>

      <footer className="flex flex-col gap-2">
        {you && (
          <Button
            className="h-11"
            disabled={!can({ type: 'confirm' })}
            onClick={() => send({ type: 'confirm' })}
          >
            {t('preflight.confirm')}
          </Button>
        )}
        {waiting.length > 0 && (
          <p role="status" className="text-sm text-muted-foreground">
            {t('preflight.waitingFor', {
              names: waiting.map((seat) => seatName(presence, seat)).join(', '),
            })}
          </p>
        )}
      </footer>
    </main>
  );
}
