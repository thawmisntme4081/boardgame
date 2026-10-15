import {
  ROLE_IDS,
  checkPreflight,
  type PreflightMove,
  type RoleId,
  type SeatId,
  type SetupView,
} from '@pandemic/rules';
import { Button } from '@platform/ui/components/button';
import { CircleCheck } from 'lucide-react';
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

/** A role's card: the player who has it (a check once they confirmed), its name and its power. */
function RoleFace({
  role,
  who,
  confirmed = false,
}: {
  role: RoleId;
  who?: string;
  confirmed?: boolean;
}) {
  const { t } = useTranslation('pandemic');
  return (
    <div
      data-role={role}
      className={`flex h-36 flex-col gap-1 rounded-lg border p-3 text-left shadow-sm ${TEXT_ON[role]}`}
      style={{ background: `var(--color-role-${role})` }}
    >
      {who && (
        <span className="flex items-center gap-1 text-xs font-medium">
          {who}
          {confirmed && <CircleCheck className="size-4" aria-label={t('preflight.ready')} />}
        </span>
      )}
      <span className="font-semibold">{t(`roles.${role}.name`)}</span>
      <span className="text-xs">{t(`roles.${role}.power`)}</span>
    </div>
  );
}

/**
 * "Before the game": the difficulty and the roles (dealt, shown in turn order; or picked from the
 * free ones until you confirm). Everyone confirms, shown by a check next to their name; the last
 * confirm deals the board. Nothing here
 * decides a rule: the buttons follow `checkPreflight`, the same check the server runs.
 */
export function Preflight({ view, presence }: { view: SetupView; presence: SeatPresence | null }) {
  const { t } = useTranslation('pandemic');
  const { you, seats, picks, confirmed, roleMode } = view;
  const can = (move: PreflightMove) => !!you && checkPreflight(view, you, move).ok;
  const send = (move: PreflightMove) => void platform().send(move);
  const done = !!you && confirmed.includes(you);
  const holder = (role: RoleId): SeatId | undefined => seats.find((seat) => picks[seat] === role);
  const name = (seat: SeatId) =>
    seat === you ? `${seatName(presence, seat)} (${t('preflight.you')})` : seatName(presence, seat);

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-4 p-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">{t('preflight.title')}</h1>
        <p className="text-sm text-muted-foreground">
          {t('preflight.summary', { count: view.epidemics })} · {t(`preflight.${roleMode}`)}
        </p>
      </header>

      <section aria-labelledby="roles-title" className="flex flex-col gap-2">
        <h2 id="roles-title" className="font-semibold">
          {t('roles.title')}
        </h2>
        {roleMode === 'random' ? (
          // In turn order.
          <div className="grid grid-cols-4 gap-2">
            {seats.map((seat) => {
              const role = picks[seat];
              return role ? (
                <RoleFace
                  key={seat}
                  role={role}
                  who={name(seat)}
                  confirmed={confirmed.includes(seat)}
                />
              ) : null;
            })}
          </div>
        ) : (
          <>
            <p className="text-sm">{done ? t('preflight.locked') : t('preflight.pickHint')}</p>
            <div role="group" aria-label={t('roles.title')} className="grid grid-cols-4 gap-2">
              {ROLE_IDS.map((role) => {
                const by = holder(role);
                const mine = by === you;
                return (
                  <button
                    key={role}
                    type="button"
                    disabled={!can({ type: 'pick-role', role })}
                    aria-pressed={mine}
                    onClick={() => send({ type: 'pick-role', role })}
                    className={`rounded-lg text-left outline-offset-2 disabled:cursor-not-allowed ${
                      mine ? 'ring-4 ring-primary' : ''
                    } ${by && !mine ? 'opacity-50' : ''}`}
                  >
                    <RoleFace
                      role={role}
                      who={by ? name(by) : undefined}
                      confirmed={!!by && confirmed.includes(by)}
                    />
                  </button>
                );
              })}
            </div>
          </>
        )}
      </section>

      <footer className="flex gap-2">
        <Button variant="outline" onClick={() => void platform().leave()}>
          {t('preflight.leave')}
        </Button>
        {you &&
          (done ? (
            <Button variant="secondary" onClick={() => send({ type: 'unconfirm' })}>
              {t('preflight.undo')}
            </Button>
          ) : (
            <Button disabled={!can({ type: 'confirm' })} onClick={() => send({ type: 'confirm' })}>
              {t('preflight.confirm')}
            </Button>
          ))}
      </footer>
    </main>
  );
}
