import Link from 'next/link';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

export default async function Home() {
  const { userId } = await auth();
  if (userId) redirect('/app');

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="max-w-lg space-y-6 text-center">
        <h1 className="text-4xl font-semibold tracking-tight">
          Swell <span className="text-primary">Mermaid</span>
        </h1>
        <p className="text-base text-fg-muted/70">
          Distribuição social automatizada para clientes da Swell Filmes.
        </p>
        <div className="flex justify-center gap-3 pt-2">
          <Link
            href="/sign-in"
            className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-app hover:opacity-90"
          >
            Entrar
          </Link>
        </div>
      </div>
    </main>
  );
}
