# Auditoria — Pilar 11: Produto & Modelo de Negócio

**Projeto:** Swell Mermaid (ex-Swell Distribuidor)
**Data:** 2026-06-30
**Auditor:** Investidor + Product Manager (modo crítico)
**Estado:** Rodada de testes humanos (pré-venda, multi-tenant operacional, monetização zero)

---

## NOTA FINAL: 3.0 / 10

> Produto técnico funcional, **modelo de negócio inexistente**. Há um SaaS rodando em produção sem ICP definido, sem preço, sem termos, sem limites, sem billing, sem diferencial articulado. É um projeto de engenharia disfarçado de produto. Para uma rodada de testes humanos isso é tolerável — para evoluir para receita é bloqueante.

Distribuição da nota:
- Proposta de valor articulada: 4/10 (existe pra Swell, não pra mercado)
- Diferencial competitivo: 2/10 (nenhuma feature defensável vs incumbents)
- Pricing & packaging: 0/10 (não existe)
- Billing & cobrança: 0/10 (não existe)
- Limites por plano / fair-use: 0/10 (não existe)
- Governança de aprovação multi-nível: 5/10 (RBAC owner/editor existe, mas não modela cliente-do-cliente)
- Métricas de produto instrumentadas: 2/10 (logs, mas sem dashboard de KPIs de produto)
- Termos / Privacidade / LGPD: 0/10 (zero documentação legal)
- Suporte & SLA: 1/10 (canal informal: Notion + WhatsApp do Swell)
- Defensibilidade / moat: 2/10 (tom de voz custom + integração Notion é fraco)

---

## 1. Proposta de Valor

### O que existe hoje
- **Pitch implícito** (de `app/page.tsx` e `COMO-FUNCIONA.md`): "Distribuição social automatizada para clientes da Swell Filmes" + "um robô digital que pega vídeos prontos da Swell".
- **Pitch de convite** (de `app/convite/[token]/page.tsx`): "Você foi convidado a testar — Crie sua conta e configure sua empresa em ~5 minutos."

### Problemas
- O nome público (Swell Distribuidor / Swell Mermaid) carrega marca da produtora-mãe. Para vender pra outras produtoras é antagônico — concorrência usa a ferramenta do "rival". Vide `app/page.tsx:13` ainda fala "Swell Distribuidor".
- Não há landing page comercial. `app/page.tsx` é uma porta de login com 2 linhas. Visitante anônimo não entende o que é, pra quem, quanto custa.
- A descrição do produto em `COMO-FUNCIONA.md` é guia interno escrito em português coloquial — útil para a equipe Swell, péssimo como marketing.

### ICP (Ideal Customer Profile) — não definido
Há sinais conflitantes em quem é o cliente:
- **Hipótese A — Produtoras audiovisuais premium B2B** (replicar o caso Swell): 5-50 funcionários, atende indústria, faz aftermovies/institucional. Mercado BR: estimo 200-500 produtoras de porte similar.
- **Hipótese B — Agências de marketing com produção interna**: maior TAM (~3-5k no BR), mas precisa de features de cliente (briefing, aprovação multi-nível) que o produto NÃO tem.
- **Hipótese C — Creators / brand studios solo**: produto seria over-engineered (cérebro + redator + avaliador + agendador) pra quem só quer agendar reel.

O CLAUDE.md fala "atender outras produtoras/clientes" sem nunca cravar. O schema (`empresas` + `empresa_users` + role owner/editor) suporta A, mas a hierarquia produtora→cliente-final NÃO existe no banco — sintoma de que o caso B/C nunca foi modelado.

### Score: 4/10
Existe value prop pra Swell. Não existe pra mercado.

---

## 2. Diferencial vs Concorrência

### Competidores diretos
| Player | Preço aprox (BRL/mês) | Posicionamento |
|---|---|---|
| Buffer | R$ 30-100 | Simples, agendamento puro |
| Hootsuite | R$ 250-1500 | Enterprise, analytics |
| Later | R$ 100-400 | Visual planner, foco IG |
| Metricool | R$ 80-500 | BR-friendly, analytics fortes |
| mLabs (BR) | R$ 90-500 | Player nacional dominante em PMEs |
| Etus (BR) | R$ 120-600 | Foco em agências |
| Postiz / Publer | R$ 50-300 | Open-source / barato |

### O que Swell Mermaid tem de diferente
1. **Pipeline de IA multi-agente para copy** (cérebro → redator → avaliador → agendador) treinado no tom Swell premium. Útil — mas **não defensável**: qualquer concorrente integra Claude/GPT em 2 sprints. mLabs e Metricool **já têm** copy AI em produção.
2. **Análise visual de frames pra inferir contexto**. Real diferencial técnico hoje (poucos fazem). Mas vai virar commodity em 6-12 meses.
3. **Aprovação humana no Notion**. Isso é ANTI-feature pra maior parte do mercado — pessoas pagam SaaS pra fugir do Notion. Só faz sentido pra quem já vive em Notion.
4. **Multi-tenant com BYOK (Bring Your Own Key)** — empresa traz Notion+Zernio próprios. Reduz custo unitário mas atrita onboarding brutal.

### O que falta vs concorrência
- Analytics (engajamento, alcance, retorno) — ZERO no produto.
- Calendário visual editorial — só existe via Notion (view "Calendário de Publicação").
- Biblioteca de mídia organizada — R2 é cego, não tem UI.
- Aprovação por cliente externo (link público, sem login) — feature core de agências.
- Integração com banco de imagens / Canva / Figma.
- Resposta automática a DMs / comentários.
- A/B testing de copy.
- Mobile app — nada.

### Defensibilidade real (moat)
- **Marca Swell**: defensável pra Swell, anti-defensável pra produto de mercado.
- **Tom de voz custom**: pode virar moat se for vendido como "tom da SUA marca, treinado em 90 dias". Hoje é hard-coded em `src/brain/tomSwell.ts`.
- **Integração Zernio**: ZERO moat — qualquer um pega Zernio API.
- **Dados de engajamento próprios**: hoje NÃO captura analytics pós-publicação. Esse seria o moat real (otimização de horários baseada em dados do próprio cliente).

### Score: 2/10
Diferencial técnico real (~6 meses de vantagem em pipeline AI), mas zero moat estrutural.

---

## 3. Pricing & Packaging

### Estado atual
**Não existe.** Confirmado por grep em `src/`, `app/`, `lib-web/`: zero referência a `stripe`, `billing`, `payment`, `subscription`, `pricing`, `plano`, `trial`, `credits`. Todas as ocorrências de "limite" são técnicas (limite de caracteres do Notion, limite de redes Zernio, retry com backoff).

`tenant_secrets` no schema NÃO tem coluna `plano`, `quotaMensal`, `proximoVencimento`, `cardId`, nada. `empresas` tem apenas `ativo: boolean` — o único mecanismo de cobrança é "desligo manualmente se não pagar".

### Recomendação de tiering
Tirar do nada, baseado em ICP "produtora pequena/média BR":

| Plano | Preço (BRL/mês) | Vídeos/mês | Empresas | Usuários | Redes | Retenção R2 | Suporte |
|---|---|---|---|---|---|---|---|
| **Starter** | R$ 197 | 15 | 1 | 2 | 4 | 60d | Email 48h |
| **Studio** | R$ 497 | 50 | 3 | 5 | 4 | 180d | Email 24h |
| **Agency** | R$ 1.197 | 150 | 10 | 15 | 4 | 365d | Slack/WhatsApp 4h |
| **Custom** | R$ 2.500+ | ∞ | ∞ | ∞ | 4+ | ∞ | Dedicado |

Justificativa de números:
- Preço-âncora: mLabs Pro ~R$ 290, Metricool Advanced ~R$ 350. Swell precisa cobrar prêmio por causa do custo Claude (~$0.12/vídeo = R$ 0.60).
- Margem: Starter R$ 197 - custo (R$ 9 Claude + R$ 5 R2 + R$ 20 Zernio rateado) = R$ 163 margem bruta (83%). Saudável.
- Limite de vídeos é a dimensão que escala custo (Claude). Limite de empresas/usuários é dimensão de upsell.

### Trial / Freemium
Recomendado: **14 dias trial com cartão upfront**, NÃO free tier permanente. Razões:
- Claude custa dinheiro real por uso — free tier é financeiramente ruim.
- ICP B2B paga sem dor; freemium atrai usuário não-ideal.
- Cartão upfront filtra >70% dos curiosos sem reduzir conversão de quem é sério.

### Score: 0/10
Não existe nem rascunho. Crítico antes de qualquer mídia paga.

---

## 4. Billing Integration

### Estado atual
**Inexistente.** Não há Stripe, Asaas, Pagar.me, Iugu, nada. Não há webhook de pagamento, nem trigger de bloqueio por inadimplência, nem nota fiscal.

### Recomendação
- **Stripe** se for cobrar internacionalmente (cartão BR funciona, boleto via Stripe BR é OK desde 2024).
- **Asaas ou Iugu** se for BR-only — emissão NF-e nativa, PIX assinatura, boleto sem dor.
- Modelo: assinatura mensal + add-on por vídeo excedente (R$ 8/vídeo extra).
- Webhook → atualiza `empresas.ativo = false` se 2 cobranças falham consecutivas.
- Auto-downgrade se trial expira sem cartão.

### Score: 0/10

---

## 5. Limites por Plano / Fair-use

### Estado atual
Zero enforcement. Worker (`worker/`) executa qualquer job de qualquer empresa sem checar quota. R2 sobe arquivo de qualquer tamanho. Cron `--publicar-aprovados` publica sem teto.

Risco: uma empresa-testador maliciosa pode subir 10.000 vídeos e queimar:
- R2 storage (R$ 1.500/mês com 10k×150MB)
- Claude API key compartilhada da Swell (~R$ 6.000 em pipeline completo)
- Quota Zernio compartilhada

### Recomendação
Tabela `empresas` precisa de:
```sql
plano text not null default 'starter',
quota_videos_mes integer not null default 15,
videos_usados_mes integer not null default 0,
mes_referencia date not null default current_date,
plano_expira_em timestamp
```

Middleware de quota antes de:
1. Upload em `/api/r2/upload` — reject 402 se quota cheia.
2. Job de ingest — reject e marca como `bloqueado_quota`.
3. Publicação — reject silenciosa, notifica owner por email.

Reset mensal via cron `--reset-quotas` no dia 1.

### Score: 0/10

---

## 6. Governança de Aprovação

### Estado atual (schema)
- `empresa_users.role`: `'owner' | 'editor'` (claros).
- Tabela `users.role`: `'admin' | 'member'` — admin Swell global.
- Convites: `convites` (adicionar a empresa existente) e `convites_onboarding` (criar empresa nova).

### Cobertura por persona

| Persona | Coberto? | Como |
|---|---|---|
| Admin Swell (super-admin) | Sim | `users.role = 'admin'` + `exigirAdmin()` em `app/app/admin/` |
| Owner empresa-cliente | Sim | `empresa_users.role = 'owner'` |
| Editor empresa-cliente | Sim | `empresa_users.role = 'editor'` |
| **Cliente do cliente** (ex: Austral aprovando vídeo da Swell) | **NÃO** | Não modelado. Aprovação acontece dentro do Notion da produtora, sem login no SaaS. |
| Reviewer externo (link mágico, sem signup) | NÃO | Não existe. |

### Problema crítico
O caso de uso real da Swell (Swell produz → cliente Austral aprova → publica na conta @austral) **não está no produto**. Hoje quem aprova é a própria Swell ou Isa, dentro do Notion interno. Quando essa produtora começar a usar com cliente externo, vai precisar de:
- Convite com escopo de aprovação (vê só posts de cliente X).
- Aprovação por link sem signup (UX padrão de agência).
- Trilha de auditoria (quem aprovou, quando, IP).
- Comentários inline na copy.

Nada disso existe.

### Score: 5/10
Core RBAC funciona. Mas modelo mental "produtora → cliente → audiência" só foi implementado nas 2 primeiras camadas.

---

## 7. Métricas de Produto

### O que existe
- Status no Notion (`Aguardando`, `Agendado`, `Aprovado`, `Publicado`).
- Logs do worker no Railway.
- Avaliador dá nota 0-10 por caption.
- Notion guarda link de cada post publicado.

### O que NÃO existe (instrumentação)
- **Time-to-publish** (upload → publicação): não medido. Dado fundamental pra vender pra agência.
- **Approval rate**: aprovado / total criado. Indica qualidade da copy AI.
- **Edit rate**: copy editada vs aceita as-is. Mede qualidade real do redator.
- **Success rate por rede**: % de posts que vão ao ar OK em IG vs YT vs TT vs LI. Dado crítico — provavelmente IG e TT falham mais por compliance Zernio.
- **Posts/mês por empresa**: zero dashboard. Não dá pra fazer upsell sem isso.
- **Churn**: nem mensurável — não há billing.
- **NPS / CSAT**: não coletado.
- **MAU / DAU**: Clerk tem mas não está agregado.
- **Custo Claude por empresa**: não rastreado — risco de empresa cara dar prejuízo invisível.
- **Distribuição de notas do avaliador**: não tabulada — não sabemos se "qualidade alta" é só narrativa.

### Score: 2/10
Logs cruos existem. Produto não está sendo medido.

---

## 8. Termos de Uso / Privacidade / LGPD

### Estado atual
- Zero página de Termos.
- Zero página de Privacidade.
- Zero DPA (Data Processing Agreement).
- Zero menção a LGPD em qualquer arquivo do repo.

### Riscos LGPD reais
1. **Dados sensíveis processados pelo Claude**: vídeos B2B podem ter rostos de funcionários de cliente final (Austral, Metroval). Está sendo enviado pra Anthropic (US) sem base legal documentada e sem contrato cliente-produtora cobrindo.
2. **R2 fora do BR** (EU/US). Para vídeo de cliente industrial, OK; para vídeo com pessoa identificável e finalidade comercial, exige transferência internacional documentada (ANPD).
3. **Notion DB do cliente fica com a empresa-tenant**, OK, mas a base de jobs / users / convites é da Swell (controladora) — Swell é operador ou controlador? Não está definido.
4. **Direito de exclusão**: o `project_r2_limpeza_adiada.md` diz que "limpeza R2 foi adiada". Isso é problema LGPD — se titular pede exclusão, não há mecanismo.
5. **Retenção indefinida** de logs do worker no Railway.

### Recomendação mínima
- Termos de Uso (foco: limitação de responsabilidade, propriedade do conteúdo é do cliente).
- Política de Privacidade (foco: dados que coleta, finalidade, retenção, base legal Art. 7º LGPD).
- DPA template entre Swell e produtora-cliente (Swell = operadora ou sub-operadora).
- Endpoint `DELETE /api/empresas/[id]/dados` (cumprimento Art. 18 LGPD).
- Footer obrigatório em landing com link Termos + Privacidade + DPO.
- Designar DPO (mesmo que seja o próprio Swell, precisa CNPJ + email público).

### Score: 0/10
Risco regulatório real assim que segundo cliente entrar.

---

## 9. Suporte & SLA

### Estado atual
- Sem help center.
- Sem chat in-app (Intercom, Crisp, Chatwoot).
- Sem ticket system.
- Canal real: WhatsApp do Swell pessoal (inferido).
- Sem SLA documentado.
- Sem status page.

Para rodada de teste com 3-5 amigos da Swell, OK. Para venda comercial, é caos garantido.

### Recomendação
- Crisp (gratuito até X conversas) embutido na app autenticada.
- Help center em Notion público (Swell já vive em Notion).
- SLA por plano (Starter 48h, Studio 24h, Agency 4h).
- Status page (statuspage.io grátis ou Vercel-deployed simples).
- Alertas → Sentry + email Swell quando Zernio cai.

### Score: 1/10

---

## 10. Análise de Mercado BR

### TAM/SAM/SOM rascunho

**TAM**: SaaS de social media management global = USD 30B em 2026.
**SAM** (BR + vertical produtoras/agências): 200-500 produtoras de porte similar à Swell + 2-3k agências com produção própria. Ticket médio R$ 500/mês × 3.000 = **R$ 18M ARR**.
**SOM** (alcançável em 24 meses): 30 produtoras pagantes × R$ 500 = **R$ 180k ARR** — só dá pra cobrir 1 dev full-time + infra.

### Preço-âncora vs concorrência BR
- mLabs Pro R$ 287 — líder de mercado
- Etus Premium R$ 400
- Metricool Advanced R$ 320

Swell Mermaid pode cobrar **prêmio de 30-50%** se posicionar como "pro produtoras premium" (não para PME). Mas perde se posicionar como "mais um agendador". O pipeline AI + tom de marca é o argumento de prêmio.

### Score: implícito no pricing — 0/10 hoje, potencial 6/10

---

## 11. Defensibilidade (Moat)

### Fontes potenciais de moat (priorizadas)
1. **Dados de engajamento próprios** — se capturar analytics pós-publicação (alcance, salvamentos, comments) de cada cliente e usar pra otimizar horários e copy futuros. **NÃO implementado.** Esse seria o moat real.
2. **Tom de voz personalizado por marca** — fine-tuning leve do redator com exemplos do cliente. Hoje hard-coded pra Swell.
3. **Workflow produtora→cliente→aprovação** — se virar referência de mercado, vira padrão (network effect leve).
4. **Integração Notion deep** — quem já vive em Notion fica preso. Defensável pra esse subset.
5. **Custo de switching** baixo: cliente leva vídeos no R2 dele (na real é da Swell), Notion é dele, contas Zernio são dele. **Migração é fácil = ruim pra retenção.**

### O que NÃO é moat (apesar de parecer)
- Pipeline multi-agente Claude — replicável em sprints.
- Análise visual de frames — virou commodity em 2025.
- Zernio — qualquer concorrente pluga.
- Marca Swell — moat pra Swell, ANTI-moat pra produto multi-tenant.

### Score: 2/10

---

## Score Card Consolidado

| Dimensão | Nota |
|---|---|
| Proposta de valor | 4/10 |
| Diferencial competitivo | 2/10 |
| Pricing & packaging | 0/10 |
| Billing integration | 0/10 |
| Limites por plano | 0/10 |
| Governança aprovação | 5/10 |
| Métricas de produto | 2/10 |
| Termos / LGPD | 0/10 |
| Suporte / SLA | 1/10 |
| Defensibilidade | 2/10 |
| **MÉDIA PONDERADA** | **3.0/10** |

---

## Top 10 Recomendações Priorizadas

### P0 — Bloqueante antes de cobrar de QUALQUER cliente
1. **Decidir ICP em uma frase.** Workshop de 4h com Swell. Sair com: "Vendemos pra _____ que sofrem de _____ e pagam R$ ____ pra resolver _____."
2. **Definir tabela de planos (Starter / Studio / Agency)** com limites em vídeos/mês, empresas, retenção. Mesmo que seja chute, publicar.
3. **Página /precos pública** + landing comercial decente (não a tela atual com 2 linhas).
4. **Termos de Uso + Política de Privacidade** redigidos por advogado (custo ~R$ 2-5k) ou template Iubenda (R$ 200/mês).
5. **Endpoint de exclusão de dados** (LGPD Art. 18) e política de retenção R2.

### P1 — Antes do 3º cliente pagante
6. **Stripe ou Asaas integrado** com webhook que desliga `empresas.ativo`.
7. **Quotas com enforcement no upload e no worker** — coluna `videos_usados_mes` + middleware.
8. **Dashboard de métricas de produto** mínimo: time-to-publish, success rate por rede, posts/mês por empresa. Não precisa ser bonito — só PG view + página interna.

### P2 — Próximos 90 dias se atingir 5 clientes pagantes
9. **Capturar analytics pós-publicação** via Zernio (ou polling APIs) e mostrar dashboard pro cliente. Esse é o moat real.
10. **Modelar persona "cliente-do-cliente"** no schema: aprovação por link mágico sem signup, escopada por workspace dentro da empresa-tenant.

---

## Veredito do Investidor

> "Produto técnico bonito demais pro estágio comercial. Time investiu em pipeline AI multi-agente e schema multi-tenant antes de saber para quem vende. Sem ICP, sem preço e sem termos, NÃO É INVESTÍVEL hoje — mesmo que estivesse buscando rodada. Faria checagem pós-3 clientes pagantes (R$ 500-1000/mês) com Stripe rodando, dashboard de métricas e churn medido em 60d. Aí sim conversa."

> "O caminho mais curto pra defensibilidade é capturar engajamento pós-publicação e fechar o loop com o redator. Isso vira dado proprietário em 90 dias e é difícil de replicar em <6 meses. É a tese."

## Veredito do Product Manager

> "Construir featuredbacklog parou; cliente backlog não começou. Fica no básico antes da próxima feature: 5 entrevistas com produtoras concorrentes da Swell, descobrir disposição-a-pagar real, e cravar pricing. Sem isso o produto continua sendo brinquedo interno da Swell — bem-feito, mas brinquedo."
