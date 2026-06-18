# SETUP-F2-2 — App Next.js + Login Clerk

> Esta fase entrega: você abre o navegador, faz login, vê seu nome na tela e
> o seletor "Empresa: Swell Filmes". Páginas internas ainda são placeholders
> (preenchidas nas próximas fases). Nada do que já funciona quebra.

## Divisão de trabalho

- **VOCÊ faz:** criar conta na Clerk, copiar 2 chaves, colar no `.env`, rodar `npm run dev`.
- **Claude já fez:** todo o código do Next.js, layout, login, seletor de empresa, sync com banco.

## Passo 1 — Você cria conta na Clerk

1. Abre **https://clerk.com** → **Sign up** (recomendo login com Google).
2. Após criar conta, clica em **+ Create application**.
3. Application name: `swell-distribuidor`.
4. Em **Sign-in options**, deixa marcado **Email** e **Google** (pode deixar os outros desmarcados).
5. Clica **Create application**.

## Passo 2 — Você copia as 2 chaves

Após criar, a Clerk te leva direto pra tela com as chaves. Procura por:

```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxxxxxxxx
CLERK_SECRET_KEY=sk_test_xxxxxxxxx
```

Copia as 2 (ou usa o botão de "Copy" do código pronto que ela já mostra).

## Passo 3 — Adicionar 3 linhas no `.env`

Abre o `.env` (já existe na raiz) e **adiciona** no final:

```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...   # cole aqui
CLERK_SECRET_KEY=sk_test_...                    # cole aqui
SWELL_ADMIN_EMAIL=filmesswell@gmail.com         # seu email
```

> O `SWELL_ADMIN_EMAIL` precisa ser o **mesmo email** que você vai usar pra
> logar no Clerk. Quando você logar com esse email, o sistema te marca
> automaticamente como admin e te vincula à empresa Swell. Sem ele, você loga
> mas fica sem nenhuma empresa.

Salva o `.env`.

## Passo 4 — Roda o servidor

No terminal, na pasta do projeto:

```sh
npm run dev
```

Esperado:
```
▲ Next.js 16.x
- Local:        http://localhost:3000
- Network:      http://192.168.x.x:3000

✓ Ready in 1.2s
```

## Passo 5 — Você testa no navegador

1. Abre **http://localhost:3000**.
2. Vê a tela "Swell Distribuidor" com botão **Entrar**.
3. Clica **Entrar** → tela do Clerk.
4. Loga com Google (usando `filmesswell@gmail.com`) ou com email/senha.
5. Após login você é redirecionado pra `/app`.
6. Deve aparecer:
   - Sidebar com: Visão geral / Tabela / Subir vídeo / Configurações
   - Topbar com: "Empresa: Swell Filmes" + foto do seu avatar Google
   - Conteúdo: "Olá, [seu nome]" e a mensagem de F2.2 pronta.

## Critérios de pronto (F2.2 ✅)

- [ ] Login com Google funciona.
- [ ] Você cai em `/app` automaticamente.
- [ ] Sidebar e topbar aparecem.
- [ ] Seu nome aparece em "Olá, ...".
- [ ] Empresa ativa mostra "Swell Filmes".
- [ ] Você consegue clicar nas 4 abas e navegar (todas com placeholder).
- [ ] Clicar no avatar → "Sign out" volta pra tela inicial.

## Se algo der errado

- **"Missing publishable key" ou "Invalid key"** → conferir se colou as 2 chaves do Clerk corretamente, sem espaços, com `pk_test_` e `sk_test_` no início.
- **Você loga mas o app mostra "Nenhuma empresa vinculada"** → você esqueceu o `SWELL_ADMIN_EMAIL` no `.env`, ou ele não bate exatamente com seu email do Clerk. Confere e reinicia o `npm run dev`.
- **Tela branca / erro 500** → me cola o erro do terminal aqui.
- **Erro de banco "DATABASE_URL"** → a F2.1 não terminou direito. Volta no `SETUP-F2-1.md`.

## O que NÃO faz ainda

- ❌ Não mostra dados reais do Notion (F2.3).
- ❌ Não tem upload funcionando (F2.4).
- ❌ Não tem admin pra cadastrar nova empresa (F2.7).
- ❌ Ainda roda só no seu Mac em localhost. Deploy na Vercel vem depois.

Próxima fase, **F2.3**, conecta a tabela do Notion na aba "Tabela".
