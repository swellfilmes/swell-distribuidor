import Link from 'next/link';
import { redirect } from 'next/navigation';
import { exigirAdmin } from '@/lib-web/auth';
import { EmpresaForm } from '@/components/EmpresaForm';

export const dynamic = 'force-dynamic';

export default async function NovaEmpresaPage() {
  try {
    await exigirAdmin();
  } catch {
    redirect('/app');
  }

  return (
    <div className="mx-auto max-w-2xl">
      <header className="mb-6">
        <Link href="/app/admin" className="text-xs text-ink/55 hover:underline">
          ← Voltar
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Nova empresa</h1>
        <p className="text-sm text-ink/60">
          Só nome e slug são obrigatórios. Você pode deixar Notion e Zernio em branco
          e conectá-los depois pelo botão OAuth / wizard — os segredos são cifrados
          no banco quando preenchidos.
        </p>
      </header>
      <EmpresaForm modo="criar" />
    </div>
  );
}
