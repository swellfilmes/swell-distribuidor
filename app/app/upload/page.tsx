import { redirect } from 'next/navigation';
import { syncUsuarioAtual } from '@/lib-web/auth';
import { getEmpresaAtiva } from '@/lib-web/empresaAtiva';
import { Uploader } from '@/components/Uploader';

export const dynamic = 'force-dynamic';

export default async function UploadPage() {
  const user = await syncUsuarioAtual();
  if (!user) redirect('/sign-in');

  const empresa = await getEmpresaAtiva();
  if (!empresa) {
    return (
      <div className="mx-auto max-w-2xl rounded-lg border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
        Você ainda não tem nenhuma empresa vinculada. Peça pro admin te
        adicionar.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Subir mídia</h1>
        <p className="text-sm text-fg-muted/60">
          Aceita vídeo, foto ou carrossel (2+ fotos juntas). O cérebro analisa o
          conteúdo, gera legenda por rede e cria a linha aguardando aprovação no
          Notion da <strong>{empresa.nome}</strong>.
        </p>
      </header>
      <Uploader />
    </div>
  );
}
