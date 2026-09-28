import { useEffect, useState } from 'react';
import { SEATS } from '@sky/shared';
import { Button } from '@/components/ui/button';

export function App() {
  const [serverOk, setServerOk] = useState<boolean | null>(null);

  const checkServer = () => {
    fetch('/health')
      .then((res) => setServerOk(res.ok))
      .catch(() => setServerOk(false));
  };

  useEffect(checkServer, []);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 p-4 text-center">
      <h1 className="text-2xl font-semibold">Sky Team Online</h1>
      <p className="text-sm text-muted-foreground">Seats: {SEATS.join(' + ')}</p>
      <p className="text-sm">
        Server: {serverOk === null ? 'checking…' : serverOk ? 'online' : 'offline'}
      </p>
      <Button size="lg" onClick={checkServer}>
        Check server
      </Button>
    </main>
  );
}
