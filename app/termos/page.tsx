import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Termos de Uso — Swell Mermaid',
  description:
    'Termos de Uso do serviço Swell Mermaid, operado pela Swell Filmes.',
};

/**
 * Página pública: /termos
 *
 * Versão v1 — 30/06/2026.
 *
 * Server Component estático. Conteúdo PT-BR. Tipografia segue tokens do tema
 * dark (bg-app, text-fg, text-fg-muted, primary, etc). Sem dependência de
 * biblioteca markdown — JSX direto pra ficar versionado claro no diff.
 *
 * Pareado com /privacidade. O ID/CNPJ definitivo da operadora fica como
 * placeholder até o usuário preencher; veja seção 1 abaixo.
 */
export default function PaginaTermos() {
  return (
    <div className="min-h-screen bg-app text-fg">
      <div className="mx-auto max-w-3xl px-6 py-12 sm:py-16">
        <Cabecalho />

        <article className="space-y-10 text-[15px] leading-relaxed text-fg/90">
          <section className="space-y-3">
            <H2>1. Aceitação destes Termos</H2>
            <P>
              Estes Termos de Uso (&ldquo;Termos&rdquo;) regem o uso do serviço{' '}
              <strong>Swell Mermaid</strong> (&ldquo;Serviço&rdquo;,
              &ldquo;Plataforma&rdquo;), uma ferramenta de distribuição
              automatizada de conteúdo audiovisual em redes sociais, operada
              por <strong>Swell Filmes</strong> (&ldquo;Swell&rdquo;,
              &ldquo;nós&rdquo;), produtora audiovisual com sede em
              Salvador/BA, CNPJ a ser informado, doravante denominada{' '}
              <em>Operadora</em>.
            </P>
            <P>
              Ao criar uma conta, marcar a caixa de aceite no fluxo de
              onboarding, ou utilizar o Serviço de qualquer forma, você
              declara que leu, compreendeu e aceita integralmente estes
              Termos, bem como a{' '}
              <Link
                href="/privacidade"
                className="text-primary underline-offset-4 hover:underline"
              >
                Política de Privacidade
              </Link>
              .
            </P>
            <P>
              Quando você aceita estes Termos em nome de uma pessoa jurídica
              (empresa, agência, produtora), você declara possuir poderes
              legais para vincular essa pessoa jurídica. A referência a
              &ldquo;você&rdquo; nestes Termos abrange tanto a pessoa física
              quanto a pessoa jurídica representada.
            </P>
          </section>

          <section className="space-y-3">
            <H2>2. Descrição do Serviço</H2>
            <P>
              O Swell Mermaid é um SaaS que permite ao usuário ingerir vídeos
              previamente produzidos, processá-los com auxílio de
              inteligência artificial (extração de frames, classificação,
              geração automatizada de legendas e descrições), armazená-los em
              infraestrutura própria e publicá-los nas redes sociais
              conectadas (Instagram, YouTube, TikTok, LinkedIn), mediante
              aprovação humana prévia.
            </P>
            <P>
              O Serviço integra ferramentas de terceiros (Anthropic / Claude,
              Zernio, Notion, Cloudflare R2, Clerk, Neon, Vercel, Railway).
              O uso dessas integrações está sujeito também aos termos e
              políticas de cada fornecedor.
            </P>
            <P>
              <strong>O Serviço não substitui</strong> a curadoria editorial
              do usuário: toda publicação só sai depois de uma aprovação
              humana explícita no fluxo. Você é o único responsável pelo
              conteúdo final publicado.
            </P>
          </section>

          <section className="space-y-3">
            <H2>3. Cadastro e Conta</H2>
            <P>
              Para utilizar o Serviço, é necessário criar uma conta
              individual, vinculada a um e-mail válido, através do provedor
              de identidade Clerk. Cada conta deve ser usada por uma única
              pessoa.
            </P>
            <P>
              <strong>Idade mínima:</strong> ao se cadastrar, você declara
              ter, no mínimo, 18 (dezoito) anos completos, ou ser
              legalmente capaz de assumir obrigações em seu próprio nome.
            </P>
            <P>
              <strong>Quem pode cadastrar:</strong> apenas administradores
              de empresa devidamente autorizados, ou usuários convidados por
              esses administradores via link de convite gerado dentro do
              próprio Serviço.
            </P>
            <P>
              <strong>Senha e segurança:</strong> você é responsável por
              manter em sigilo as credenciais de acesso à sua conta e por
              toda atividade nela registrada. Em caso de suspeita de uso não
              autorizado, comunique-nos imediatamente pelo e-mail{' '}
              <a
                href="mailto:filmesswell@gmail.com"
                className="text-primary underline-offset-4 hover:underline"
              >
                filmesswell@gmail.com
              </a>
              .
            </P>
          </section>

          <section className="space-y-3">
            <H2>4. Uso Aceitável</H2>
            <P>É expressamente proibido utilizar o Serviço para:</P>
            <Ul>
              <li>
                publicar, armazenar ou distribuir conteúdo ilegal, criminoso,
                difamatório, discriminatório, pornográfico, de incitação ao
                ódio ou que viole direitos de terceiros;
              </li>
              <li>
                veicular conteúdo que infrinja direitos autorais, de imagem,
                marca, patente, segredo industrial ou qualquer outro direito
                de propriedade intelectual de terceiros;
              </li>
              <li>
                praticar spam, automação não autorizada nas redes sociais
                conectadas ou qualquer prática que viole as políticas dessas
                redes;
              </li>
              <li>
                tentar burlar, fazer engenharia reversa, descompilar ou
                interceptar dados do Serviço, sua infraestrutura ou
                fornecedores;
              </li>
              <li>
                usar a Plataforma para enviar conteúdo malicioso (malware,
                phishing, ransomware) ou conteúdo gerado por IA sem a devida
                sinalização nas redes que a exigem (Instagram, TikTok).
              </li>
            </Ul>
            <P>
              O descumprimento destas regras autoriza a Operadora a suspender
              ou encerrar a sua conta, sem aviso prévio, conforme a seção 9.
            </P>
          </section>

          <section className="space-y-3">
            <H2>5. Conteúdo do Usuário</H2>
            <P>
              Todo o conteúdo que você envia, processa ou publica através do
              Serviço (vídeos, áudios, imagens, textos, metadados — em
              conjunto, &ldquo;Conteúdo do Usuário&rdquo;) permanece de sua
              propriedade ou de propriedade de seus clientes finais.{' '}
              <strong>
                A Swell não reivindica qualquer propriedade sobre o Conteúdo
                do Usuário.
              </strong>
            </P>
            <P>
              Você declara e garante que possui todos os direitos, licenças,
              autorizações de imagem, voz e uso de marca necessários para
              processar e publicar tal Conteúdo nas redes sociais conectadas,
              bem como respondendo civil e criminalmente por eventual
              violação de direitos de terceiros.
            </P>
            <P>
              Para que o Serviço funcione, você nos concede uma licença
              limitada, mundial, não-exclusiva, livre de royalties e
              revogável a qualquer momento (pelo encerramento da conta), para
              hospedar, processar (extrair frames, transcrever, gerar copy
              por IA), transmitir e publicar o Conteúdo do Usuário
              exclusivamente nas redes sociais e canais que você mesmo
              conectou via OAuth. Essa licença existe apenas pela duração e
              na medida necessária para a operação do Serviço.
            </P>
          </section>

          <section className="space-y-3">
            <H2>6. Conta Zernio Compartilhada (Beta)</H2>
            <P>
              Durante o período de beta, a publicação nas redes sociais é
              tecnicamente intermediada pela conta Zernio mantida pela Swell
              Filmes, com cada empresa usuária representada como um{' '}
              <em>Profile</em> separado dentro dessa conta. Isso permite que
              novos usuários comecem a publicar sem precisar contratar
              individualmente uma conta Zernio.
            </P>
            <P>
              Você reconhece e concorda que: (i) suas credenciais OAuth com
              as redes sociais ficam armazenadas no painel Zernio sob esse
              Profile; (ii) a Operadora pode, a qualquer momento e mediante
              aviso, encerrar essa modalidade e exigir que você contrate
              diretamente sua própria conta Zernio ou equivalente; (iii) o
              uso responsável de cada Profile é de sua única
              responsabilidade.
            </P>
          </section>

          <section className="space-y-3">
            <H2>7. Disponibilidade e Beta</H2>
            <P>
              O Serviço é oferecido em regime de melhores esforços
              (<em>best-effort</em>), sem garantia de SLA durante o período
              de beta. A Operadora pode realizar manutenções, atualizações,
              interrupções temporárias e mudanças de funcionalidades sem
              aviso prévio, embora vá comunicar quando razoavelmente
              possível.
            </P>
            <P>
              Falhas em serviços de terceiros (Anthropic, Zernio, Notion,
              Cloudflare, redes sociais) podem afetar o funcionamento do
              Serviço, e a Operadora não tem controle direto sobre essas
              dependências.
            </P>
          </section>

          <section className="space-y-3">
            <H2>8. Tarifas e Pagamento</H2>
            <P>
              Durante o período de beta, o Serviço é oferecido{' '}
              <strong>gratuitamente</strong> aos usuários convidados, sem
              cobrança. A Operadora se reserva o direito de instituir tarifas
              ou planos pagos no futuro, e nesse caso comunicará o usuário
              com antecedência mínima de 30 (trinta) dias antes da
              aplicação de qualquer cobrança, permitindo o encerramento
              gratuito da conta caso o usuário não concorde.
            </P>
            <P>
              Não há qualquer obrigação de migração para um plano pago — a
              continuidade do uso será sempre uma escolha do usuário.
            </P>
          </section>

          <section className="space-y-3">
            <H2>9. Suspensão e Encerramento</H2>
            <P>
              A Operadora pode suspender ou encerrar sua conta, a qualquer
              tempo, nas seguintes hipóteses:
            </P>
            <Ul>
              <li>violação destes Termos ou da Política de Privacidade;</li>
              <li>
                uso indevido, fraudulento ou que coloque em risco a
                infraestrutura, os fornecedores ou outros usuários;
              </li>
              <li>
                determinação judicial, administrativa ou de autoridade
                competente;
              </li>
              <li>
                inatividade prolongada por mais de 12 (doze) meses
                consecutivos, mediante aviso prévio de 30 dias.
              </li>
            </Ul>
            <P>
              Você pode encerrar sua conta a qualquer momento solicitando
              exclusão pelo e-mail{' '}
              <a
                href="mailto:filmesswell@gmail.com"
                className="text-primary underline-offset-4 hover:underline"
              >
                filmesswell@gmail.com
              </a>
              . Ao encerrar, a Operadora removerá os dados de sua conta
              conforme descrito na Política de Privacidade, ressalvadas as
              hipóteses de retenção legal.
            </P>
          </section>

          <section className="space-y-3">
            <H2>10. Propriedade Intelectual</H2>
            <P>
              Todos os direitos de propriedade intelectual sobre o código,
              arquitetura, marca, identidade visual, documentação e demais
              elementos do Swell Mermaid são de titularidade exclusiva da
              Swell Filmes. Estes Termos não concedem ao usuário qualquer
              licença sobre tais elementos, exceto a permissão de uso da
              Plataforma conforme aqui descrita.
            </P>
            <P>
              A marca &ldquo;Swell Mermaid&rdquo;, o logotipo e os elementos
              gráficos associados não podem ser usados pelo usuário sem
              autorização escrita expressa da Operadora.
            </P>
          </section>

          <section className="space-y-3">
            <H2>11. Limitação de Responsabilidade</H2>
            <P>
              Na máxima extensão permitida pelo ordenamento jurídico
              brasileiro, incluindo o Código de Defesa do Consumidor (Lei nº
              8.078/90) e o Código Civil (Lei nº 10.406/02), a Operadora não
              será responsável por:
            </P>
            <Ul>
              <li>
                danos indiretos, lucros cessantes, perda de oportunidade ou
                danos morais decorrentes de falhas técnicas, indisponibilidade,
                bugs ou interrupções do Serviço;
              </li>
              <li>
                conteúdo publicado pelo usuário ou consequências de tal
                publicação nas redes sociais conectadas;
              </li>
              <li>
                ações, omissões ou políticas de fornecedores terceiros
                (Anthropic, Zernio, Notion, redes sociais etc.);
              </li>
              <li>
                uso indevido das credenciais de acesso por culpa do próprio
                usuário.
              </li>
            </Ul>
            <P>
              Nada nestes Termos exclui ou limita responsabilidades que não
              possam ser excluídas ou limitadas por lei, especialmente perante
              consumidores conforme o CDC.
            </P>
          </section>

          <section className="space-y-3">
            <H2>12. Lei Aplicável e Foro</H2>
            <P>
              Estes Termos são regidos pelas leis da República Federativa
              do Brasil. Fica eleito o foro da Comarca de{' '}
              <strong>Salvador, Estado da Bahia</strong>, para dirimir
              quaisquer controvérsias decorrentes destes Termos, com renúncia
              expressa a qualquer outro, por mais privilegiado que seja,
              ressalvada a competência do foro de domicílio do consumidor
              quando aplicável.
            </P>
          </section>

          <section className="space-y-3">
            <H2>13. Contato</H2>
            <P>
              Dúvidas, solicitações ou notificações relativas a estes Termos
              podem ser enviadas para:
            </P>
            <div className="rounded-2xl border border-bd/40 bg-surface/60 p-5 text-[14px]">
              <div>
                <strong>Swell Filmes</strong>
              </div>
              <div className="text-fg-muted">Salvador / BA — Brasil</div>
              <div className="mt-2">
                E-mail:{' '}
                <a
                  href="mailto:filmesswell@gmail.com"
                  className="text-primary underline-offset-4 hover:underline"
                >
                  filmesswell@gmail.com
                </a>
              </div>
            </div>
          </section>

          <section className="space-y-3 border-t border-bd/40 pt-8 text-[13px] text-fg-muted">
            <P>
              <strong>Versão:</strong> v1 — vigente a partir de 30/06/2026.
            </P>
            <P>
              Eventuais alterações futuras destes Termos serão comunicadas
              com antecedência mínima de 30 (trinta) dias, conforme descrito
              também na Política de Privacidade.
            </P>
            <P>
              <Link
                href="/privacidade"
                className="text-primary underline-offset-4 hover:underline"
              >
                Ler a Política de Privacidade →
              </Link>
            </P>
          </section>
        </article>

        <Rodape />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mini-componentes locais — tipografia consistente sem importar algo novo.
// ---------------------------------------------------------------------------

function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-serif text-[24px] leading-tight text-fg">{children}</h2>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-fg/85">{children}</p>;
}

function Ul({ children }: { children: React.ReactNode }) {
  return (
    <ul className="list-disc space-y-2 pl-6 text-fg/85 marker:text-primary/70">
      {children}
    </ul>
  );
}

function Cabecalho() {
  return (
    <header className="mb-10 space-y-3">
      <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-fg-muted">
        Swell Mermaid · Documentos Legais
      </div>
      <h1 className="font-serif text-[40px] leading-tight text-fg">
        Termos de Uso
      </h1>
      <p className="text-[14px] text-fg-muted">
        Última atualização: 30 de junho de 2026 · Versão v1
      </p>
    </header>
  );
}

function Rodape() {
  return (
    <footer className="mt-12 flex flex-col gap-3 border-t border-bd/40 pt-6 text-[12px] text-fg-muted sm:flex-row sm:items-center sm:justify-between">
      <div>© Swell Filmes — Salvador / BA</div>
      <div className="flex gap-4">
        <Link
          href="/privacidade"
          className="hover:text-fg hover:underline hover:underline-offset-4"
        >
          Política de Privacidade
        </Link>
        <Link
          href="/"
          className="hover:text-fg hover:underline hover:underline-offset-4"
        >
          Voltar pro site
        </Link>
      </div>
    </footer>
  );
}
