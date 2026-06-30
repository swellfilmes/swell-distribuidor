import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Política de Privacidade — Swell Mermaid',
  description:
    'Como o Swell Mermaid trata dados pessoais sob a LGPD (Lei nº 13.709/2018).',
};

/**
 * Página pública: /privacidade
 *
 * Versão v1 — 30/06/2026. Estrutura LGPD-compliant (Lei nº 13.709/2018).
 *
 * Server Component estático. Sem markdown — JSX direto. Mesmas conveções
 * tipográficas da página /termos.
 *
 * O CNPJ definitivo da operadora fica como placeholder até o usuário
 * preencher; ver seção 1.
 */
export default function PaginaPrivacidade() {
  return (
    <div className="min-h-screen bg-app text-fg">
      <div className="mx-auto max-w-3xl px-6 py-12 sm:py-16">
        <Cabecalho />

        <article className="space-y-10 text-[15px] leading-relaxed text-fg/90">
          <section className="space-y-3">
            <H2>1. Quem somos</H2>
            <P>
              Esta Política descreve como a <strong>Swell Filmes</strong>{' '}
              (&ldquo;Swell&rdquo;, &ldquo;Controladora&rdquo;,
              &ldquo;nós&rdquo;), produtora audiovisual com sede em
              Salvador/BA, CNPJ a ser informado, trata dados pessoais ao
              operar o serviço <strong>Swell Mermaid</strong>{' '}
              (&ldquo;Serviço&rdquo;), em conformidade com a Lei Geral de
              Proteção de Dados Pessoais (Lei nº 13.709/2018 —
              &ldquo;LGPD&rdquo;).
            </P>
            <P>
              <strong>Encarregado de Proteção de Dados (DPO):</strong> João
              Costa, contato:{' '}
              <a
                href="mailto:filmesswell@gmail.com"
                className="text-primary underline-offset-4 hover:underline"
              >
                filmesswell@gmail.com
              </a>
              . Toda comunicação sobre dados pessoais, direitos de
              titulares ou incidentes de segurança deve ser direcionada a
              esse e-mail.
            </P>
          </section>

          <section className="space-y-3">
            <H2>2. Quais dados coletamos</H2>
            <P>Coletamos e tratamos as seguintes categorias de dados:</P>
            <Ul>
              <li>
                <strong>Dados cadastrais:</strong> nome completo (quando
                informado pelo provedor de identidade), endereço de e-mail,
                identificador do usuário no Clerk, papel atribuído (admin /
                membro / owner / editor) e empresa(s) associada(s);
              </li>
              <li>
                <strong>Conteúdo do usuário:</strong> vídeos enviados,
                metadados (nome de arquivo, cliente, tipo, orientação),
                frames extraídos para análise, legendas e textos gerados por
                IA, datas de publicação programadas;
              </li>
              <li>
                <strong>Credenciais de integração (cifradas):</strong>{' '}
                chaves de API e tokens OAuth de Notion e Zernio, IDs de
                contas conectadas das redes sociais — todos armazenados
                cifrados em repouso (AES-256-GCM) no nosso banco de dados;
              </li>
              <li>
                <strong>Dados técnicos / de uso:</strong> endereço IP,
                user-agent, logs de acesso, identificadores de sessão,
                horários de operações realizadas, registros de erros e
                desempenho;
              </li>
              <li>
                <strong>Cookies essenciais:</strong> cookie de sessão do
                Clerk, cookie de empresa ativa, preferências de tema —
                ver seção 12.
              </li>
            </Ul>
            <P>
              <strong>Não coletamos</strong> dados sensíveis (origem racial
              ou étnica, convicção religiosa, opinião política, dado de
              saúde, biometria, vida sexual etc.) nem dados financeiros
              (cartão de crédito, dados bancários), uma vez que o Serviço
              não envolve pagamentos diretos pelo usuário durante o beta.
            </P>
          </section>

          <section className="space-y-3">
            <H2>3. Como coletamos</H2>
            <Ul>
              <li>
                <strong>Diretamente do titular:</strong> quando você cria
                conta, preenche formulários de onboarding, faz upload de
                vídeos ou edita textos no Serviço;
              </li>
              <li>
                <strong>Provedor de identidade (Clerk):</strong> nome e
                e-mail vinculados à sua conta, repassados a nós no momento
                do login (você consente ao se cadastrar no Clerk);
              </li>
              <li>
                <strong>OAuth Notion / Zernio:</strong> ao conectar sua
                conta Notion ou autorizar o Profile Zernio, recebemos tokens
                de acesso emitidos por esses serviços, que armazenamos
                cifrados;
              </li>
              <li>
                <strong>Coleta automática:</strong> logs técnicos (IP,
                user-agent, requisições) são coletados pela infraestrutura
                de hospedagem (Vercel, Railway) sempre que você usa o
                Serviço.
              </li>
            </Ul>
          </section>

          <section className="space-y-3">
            <H2>4. Bases legais (Art. 7º da LGPD)</H2>
            <P>
              Cada tratamento de dados realizado pelo Serviço se enquadra em
              uma das seguintes bases legais:
            </P>
            <Ul>
              <li>
                <strong>Execução de contrato</strong> (Art. 7º, V): tratamos
                seus dados cadastrais, conteúdo enviado, credenciais
                cifradas e logs operacionais para entregar as funcionalidades
                contratadas no momento em que você aceita os Termos de Uso;
              </li>
              <li>
                <strong>Legítimo interesse</strong> (Art. 7º, IX): coleta de
                logs técnicos para garantir segurança, prevenção a fraudes,
                diagnóstico de bugs e melhoria do Serviço, sempre observado
                o teste de proporcionalidade e os direitos do titular;
              </li>
              <li>
                <strong>Cumprimento de obrigação legal ou regulatória</strong>{' '}
                (Art. 7º, II): retenção de logs e dados pelo prazo
                necessário para cumprir exigências legais, regulatórias ou
                ordens judiciais;
              </li>
              <li>
                <strong>Consentimento</strong> (Art. 7º, I): tratamentos
                acessórios ou novos que venham a ser implementados serão
                precedidos de pedido específico e granular de consentimento.
              </li>
            </Ul>
          </section>

          <section className="space-y-3">
            <H2>5. Para que usamos</H2>
            <P>Usamos seus dados pessoais para as seguintes finalidades:</P>
            <Ul>
              <li>
                operar o Serviço: autenticar você, mostrar a interface,
                processar vídeos e disponibilizar a fila de aprovação;
              </li>
              <li>
                gerar copy automatizada via Claude (Anthropic): enviamos
                frames do seu vídeo + metadados de nome de arquivo para a
                API da Anthropic, que retorna a sugestão de legenda. Nem o
                seu nome nem seu e-mail são enviados nesse fluxo;
              </li>
              <li>
                publicar nas redes sociais conectadas: enviamos o vídeo
                hospedado no Cloudflare R2 (URL pública) e o texto aprovado
                para a API Zernio, que entrega ao Instagram, YouTube, TikTok
                e/ou LinkedIn;
              </li>
              <li>
                manter histórico no Notion: criamos linha no banco Notion da
                empresa (sob suas próprias credenciais OAuth) para registrar
                status, links publicados e datas de publicação;
              </li>
              <li>
                segurança e monitoramento: prevenção a fraude, detecção de
                abusos, resposta a incidentes;
              </li>
              <li>
                comunicação operacional: avisos sobre conta, mudanças nestes
                documentos legais, falhas relevantes do Serviço.
              </li>
            </Ul>
          </section>

          <section className="space-y-3">
            <H2>6. Com quem compartilhamos (subprocessadores)</H2>
            <P>
              Para operar o Serviço, contratamos fornecedores que atuam como{' '}
              <em>operadores</em> de dados pessoais, sob nossas instruções e
              com cláusulas contratuais de proteção. São eles:
            </P>
            <div className="overflow-hidden rounded-2xl border border-bd/40">
              <table className="w-full text-[13.5px]">
                <thead className="bg-surface-2/60 text-fg-muted">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">
                      Fornecedor
                    </th>
                    <th className="px-4 py-2 text-left font-medium">Papel</th>
                    <th className="px-4 py-2 text-left font-medium">
                      País-sede
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-bd/30 text-fg/85">
                  <Linha
                    f="Anthropic"
                    papel="Modelo Claude — classifica frames, gera copy"
                    pais="EUA"
                  />
                  <Linha
                    f="Vercel"
                    papel="Hospedagem do frontend e edge functions"
                    pais="EUA"
                  />
                  <Linha
                    f="Railway"
                    papel="Hospedagem do worker que processa vídeos"
                    pais="EUA"
                  />
                  <Linha
                    f="Cloudflare R2"
                    papel="Armazenamento dos vídeos e thumbnails"
                    pais="Global / EUA"
                  />
                  <Linha
                    f="Neon"
                    papel="Banco de dados Postgres"
                    pais="EUA"
                  />
                  <Linha
                    f="Clerk"
                    papel="Provedor de identidade e login"
                    pais="EUA"
                  />
                  <Linha
                    f="Zernio"
                    papel="Publicação unificada nas redes sociais"
                    pais="UE / Global"
                  />
                  <Linha
                    f="Notion"
                    papel="Fila de aprovação e histórico de publicações"
                    pais="EUA"
                  />
                </tbody>
              </table>
            </div>
            <P>
              Esses fornecedores recebem apenas os dados estritamente
              necessários para a finalidade contratada e estão sujeitos a
              compromissos contratuais e técnicos de confidencialidade,
              segurança e respeito à LGPD ou normativos equivalentes (GDPR
              na União Europeia, CCPA na Califórnia etc.).
            </P>
            <P>
              Não vendemos, alugamos ou cedemos dados pessoais a terceiros
              para finalidades de marketing ou perfilamento.
            </P>
          </section>

          <section className="space-y-3">
            <H2>7. Transferência internacional de dados</H2>
            <P>
              Por usarmos fornecedores sediados nos Estados Unidos da América
              e/ou na União Europeia, alguns dados pessoais podem ser
              processados fora do território brasileiro. Esta transferência
              é amparada pela LGPD (Art. 33, V e VIII):
            </P>
            <Ul>
              <li>
                <strong>Necessidade contratual:</strong> a transferência é
                indispensável para executar o contrato firmado com você
                (entregar o Serviço);
              </li>
              <li>
                <strong>Cláusulas-padrão / garantias adequadas:</strong>{' '}
                contratamos cada fornecedor sob compromissos que asseguram
                nível de proteção compatível com a LGPD, incluindo Standard
                Contractual Clauses (SCCs) e Data Processing Agreements
                (DPAs);
              </li>
              <li>
                <strong>Minimização:</strong> só são enviados os dados
                estritamente necessários para a finalidade de cada
                fornecedor.
              </li>
            </Ul>
          </section>

          <section className="space-y-3">
            <H2>8. Retenção e descarte</H2>
            <Ul>
              <li>
                <strong>Vídeos no Cloudflare R2:</strong> retidos enquanto a
                conta estiver ativa, conforme necessidade operacional. Podem
                ser excluídos a pedido do titular;
              </li>
              <li>
                <strong>Dados cadastrais e logs operacionais:</strong>{' '}
                retidos pelo tempo da relação contratual e por até 5 (cinco)
                anos após o encerramento da conta, para cumprir prazos
                prescricionais previstos no Código Civil;
              </li>
              <li>
                <strong>Credenciais cifradas:</strong> excluídas
                imediatamente em caso de desconexão da integração ou
                encerramento da conta;
              </li>
              <li>
                <strong>Logs técnicos (IP, requisições):</strong> retidos por
                até 12 (doze) meses, salvo prazo maior exigido por lei (Marco
                Civil da Internet — Lei nº 12.965/2014).
              </li>
            </Ul>
            <P>
              Após os prazos de retenção, os dados são eliminados ou
              anonimizados de forma segura e irreversível, salvo quando a
              retenção for legalmente exigida.
            </P>
          </section>

          <section className="space-y-3">
            <H2>9. Direitos do titular (Art. 18 da LGPD)</H2>
            <P>Você, como titular dos dados pessoais, tem direito a:</P>
            <Ul>
              <li>
                <strong>confirmar</strong> a existência de tratamento dos
                seus dados;
              </li>
              <li>
                <strong>acessar</strong> os dados pessoais que mantemos
                sobre você;
              </li>
              <li>
                <strong>corrigir</strong> dados incompletos, inexatos ou
                desatualizados;
              </li>
              <li>
                solicitar a <strong>anonimização, bloqueio ou eliminação</strong>{' '}
                de dados desnecessários, excessivos ou tratados em
                desconformidade com a LGPD;
              </li>
              <li>
                solicitar a <strong>portabilidade</strong> dos seus dados a
                outro fornecedor de serviço ou produto, observados os
                segredos comercial e industrial;
              </li>
              <li>
                solicitar a <strong>eliminação</strong> dos dados pessoais
                tratados com base em consentimento;
              </li>
              <li>
                obter <strong>informação sobre compartilhamentos</strong>{' '}
                realizados com entidades públicas e privadas;
              </li>
              <li>
                obter <strong>informação sobre a possibilidade de não
                fornecer consentimento</strong> e as consequências dessa
                negativa;
              </li>
              <li>
                <strong>revogar o consentimento</strong> a qualquer momento,
                quando for esta a base legal aplicável.
              </li>
            </Ul>
          </section>

          <section className="space-y-3">
            <H2>10. Como exercer seus direitos</H2>
            <P>
              Para exercer qualquer um dos direitos acima, envie sua
              solicitação para{' '}
              <a
                href="mailto:filmesswell@gmail.com"
                className="text-primary underline-offset-4 hover:underline"
              >
                filmesswell@gmail.com
              </a>{' '}
              com o assunto &ldquo;LGPD — Direito do Titular&rdquo;,
              identificando-se com o e-mail vinculado à conta.
            </P>
            <P>
              <strong>Prazo de resposta:</strong> responderemos em até 15
              (quinze) dias, podendo prorrogar em casos justificados,
              conforme permitido pela LGPD.
            </P>
            <P>
              Em alguns casos, poderemos solicitar dados adicionais para
              confirmar sua identidade e impedir que alguém finja ser você.
            </P>
          </section>

          <section className="space-y-3">
            <H2>11. Segurança da informação</H2>
            <P>
              Adotamos medidas técnicas e administrativas razoáveis para
              proteger seus dados:
            </P>
            <Ul>
              <li>
                <strong>Cifragem em repouso:</strong> credenciais sensíveis
                (chaves Notion, Zernio, tokens OAuth) ficam cifradas com{' '}
                <strong>AES-256-GCM</strong> no banco;
              </li>
              <li>
                <strong>Cifragem em trânsito:</strong> todo o tráfego é
                obrigatoriamente HTTPS (TLS 1.2+), incluindo upload de
                vídeos para o Cloudflare R2;
              </li>
              <li>
                <strong>Controle de acesso:</strong> autenticação via Clerk
                (provedor especializado), papéis granulares por empresa,
                isolamento multi-tenant no banco;
              </li>
              <li>
                <strong>Princípio do menor privilégio:</strong> integrações
                externas operam com escopos OAuth mínimos;
              </li>
              <li>
                <strong>Monitoramento:</strong> logs de erro centralizados
                para identificar incidentes;
              </li>
              <li>
                <strong>Resposta a incidentes:</strong> em caso de incidente
                de segurança que possa acarretar risco ou dano relevante,
                comunicaremos a ANPD e os titulares afetados nos prazos
                previstos pela LGPD.
              </li>
            </Ul>
          </section>

          <section className="space-y-3">
            <H2>12. Cookies</H2>
            <P>
              Usamos apenas cookies <strong>essenciais</strong> para o
              funcionamento do Serviço:
            </P>
            <Ul>
              <li>
                <strong>Cookie de sessão Clerk:</strong> mantém você logado
                no Serviço;
              </li>
              <li>
                <strong>Cookie de empresa ativa:</strong> guarda o slug da
                empresa selecionada no seletor de empresas;
              </li>
              <li>
                <strong>Preferências de tema:</strong> se aplicável,
                armazena modo claro/escuro escolhido.
              </li>
            </Ul>
            <P>
              <strong>Não usamos</strong> cookies de analytics de terceiros
              (Google Analytics, Meta Pixel, etc.) nem de publicidade
              comportamental.
            </P>
          </section>

          <section className="space-y-3">
            <H2>13. Crianças e adolescentes</H2>
            <P>
              O Serviço não é direcionado a menores de 18 anos. Não
              coletamos intencionalmente dados de menores. Se tomarmos
              conhecimento de cadastro de menor, encerraremos a conta e
              eliminaremos os dados associados.
            </P>
          </section>

          <section className="space-y-3">
            <H2>14. Alterações desta Política</H2>
            <P>
              Podemos atualizar esta Política para refletir mudanças no
              Serviço, na legislação ou em fornecedores. Alterações
              substanciais serão comunicadas com antecedência mínima de 30
              (trinta) dias por e-mail e por aviso visível no Serviço, e a
              versão atual estará sempre disponível em{' '}
              <Link
                href="/privacidade"
                className="text-primary underline-offset-4 hover:underline"
              >
                /privacidade
              </Link>{' '}
              com indicação da data de vigência.
            </P>
          </section>

          <section className="space-y-3">
            <H2>15. Autoridade Nacional de Proteção de Dados (ANPD)</H2>
            <P>
              Caso entenda que não respondemos adequadamente a uma
              solicitação ou que houve violação dos seus direitos sob a
              LGPD, você pode apresentar reclamação à{' '}
              <strong>
                Autoridade Nacional de Proteção de Dados (ANPD)
              </strong>{' '}
              pelo canal oficial:{' '}
              <a
                href="https://www.gov.br/anpd/"
                target="_blank"
                rel="noreferrer"
                className="text-primary underline-offset-4 hover:underline"
              >
                gov.br/anpd
              </a>
              .
            </P>
          </section>

          <section className="space-y-3">
            <H2>16. Contato do Encarregado (DPO)</H2>
            <div className="rounded-2xl border border-bd/40 bg-surface/60 p-5 text-[14px]">
              <div>
                <strong>Encarregado de Proteção de Dados:</strong> João Costa
              </div>
              <div className="mt-1">
                <strong>Operadora:</strong> Swell Filmes — Salvador / BA
              </div>
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
              <Link
                href="/termos"
                className="text-primary underline-offset-4 hover:underline"
              >
                Ler os Termos de Uso →
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
// Tipografia consistente com /termos.
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

function Linha({
  f,
  papel,
  pais,
}: {
  f: string;
  papel: string;
  pais: string;
}) {
  return (
    <tr>
      <td className="px-4 py-2 font-medium text-fg">{f}</td>
      <td className="px-4 py-2">{papel}</td>
      <td className="px-4 py-2 text-fg-muted">{pais}</td>
    </tr>
  );
}

function Cabecalho() {
  return (
    <header className="mb-10 space-y-3">
      <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-fg-muted">
        Swell Mermaid · Documentos Legais
      </div>
      <h1 className="font-serif text-[40px] leading-tight text-fg">
        Política de Privacidade
      </h1>
      <p className="text-[14px] text-fg-muted">
        Última atualização: 30 de junho de 2026 · Versão v1 · LGPD (Lei nº
        13.709/2018)
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
          href="/termos"
          className="hover:text-fg hover:underline hover:underline-offset-4"
        >
          Termos de Uso
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
