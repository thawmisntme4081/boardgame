// `/`: the game picker, and joining a room by its code.
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { GAMES } from '../games';
import { Shell } from './Shell';

export function Picker() {
  const { t } = useTranslation();
  return (
    <Shell full account>
      <section aria-labelledby="games" className="flex flex-col gap-3">
        <h2 id="games" className="text-xl font-semibold">
          {t('app.chooseGame')}
        </h2>
        <div className="grid grid-cols-2 gap-2 tablet:grid-cols-4">
          {GAMES.map((game) => (
            <Link
              key={game.id}
              to="/play/$gameId"
              params={{ gameId: game.id }}
              className="group rounded outline-offset-4"
            >
              <img
                src={game.image}
                alt={game.id}
                width={300}
                height={400}
                className="aspect-3/4 h-auto w-full rounded object-cover shadow-sm transition duration-200 ease-out group-hover:-translate-y-1.5 group-hover:scale-105 group-hover:shadow-xl group-focus-visible:-translate-y-1.5 group-focus-visible:scale-105 group-focus-visible:shadow-xl motion-reduce:transition-none motion-reduce:group-hover:transform-none"
              />
            </Link>
          ))}
        </div>
      </section>
    </Shell>
  );
}
