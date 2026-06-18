# SETUP-F2-1 — Como ativar a F2.1 (multi-tenant no backend)

> Esta fase NÃO tem interface ainda. Ela só prepara o terreno: cria um banco
> de dados que vai guardar empresas/usuários/segredos. A CLI continua
> funcionando exatamente como hoje, mas agora lendo a config da Swell de
> dentro do banco em vez de direto do `.env`.

## Divisão de trabalho

- **VOCÊ faz:** criar conta na Neon, copiar a `DATABASE_URL`, colar 2 linhas no `.env`, rodar 3 comandos.
- **Claude já fez:** todo o código, schema, scripts de migração, refatoração da CLI.

## Passo 1 — Você cria conta na Neon (Postgres grátis)

1. Abre **console.neon.tech** → **Sign Up** (recomendo usar o login Google)
2. Plano: **Free** (3GB grátis, dá e sobra)
3. Clica **New Project**:
   - Project name: `swell-distribuidor`
   - Database name: deixa `neondb` (padrão)
   - Region: escolha **AWS us-east-1** (mais próximo do Vercel/Railway)
4. Após criar, ele te leva pro dashboard do projeto.
5. Na seção **Connection string** (centro da tela), tem um campo com algo tipo:
   ```
   postgresql://user:senha@ep-xxx.us-east-1.aws.neon.tech/neondb?sslmode=require
   ```
   Copia **essa linha inteira**.

## Passo 2 — Você gera a chave de criptografia

No terminal, roda:

```sh
openssl rand -base64 32
```

Vai aparecer algo tipo: `K3jM9pT2vQ8sN5xR1wY7zA4bC6dE0fG2hI=`

Copia essa string.

## Passo 3 — Você cola as 2 novas linhas no seu `.env`

Abre seu `.env` atual e **adiciona** essas 2 linhas no final (sem apagar o que já tem):

```
DATABASE_URL=postgresql://user:senha@ep-xxx.us-east-1.aws.neon.tech/neondb?sslmode=require
ENCRYPTION_KEY=K3jM9pT2vQ8sN5xR1wY7zA4bC6dE0fG2hI=
```

(Coloca os valores que você copiou nos passos 1 e 2.)

## Passo 4 — Cria as tabelas no banco

No terminal, na pasta do projeto:

```sh
npm run db:push
```

Vai aparecer um resumo das tabelas que vão ser criadas — confirma com `y`.
Resultado esperado: `[✓] Changes applied`.

## Passo 5 — Migra os segredos da Swell pro banco

```sh
npm run db:migrate-swell
```

Esse script pega NOTION_API_KEY, ZERNIO_API_KEY etc. do seu `.env`, cifra,
e salva no banco como tenant `slug=swell`. Resultado esperado:

```
✅ Tenant "swell" pronto. Teste com:
   npm run distribuir -- --listar-empresas
```

## Passo 6 — Você confirma que tudo funciona

```sh
npm run distribuir -- --listar-empresas
```

Esperado:
```
Empresas ativas:
  swell                → Swell Filmes  (id=1)
```

E o teste real:

```sh
npm run distribuir -- --empresa swell --listar-contas
```

Deve listar suas contas Zernio igualzinho fazia antes.

## Passo 7 — Verifica que a CLI inteira continua funcionando

Os 3 crons no seu Mac (launchd) **continuam funcionando** sem mexer — eles
chamam `npm run distribuir -- --publicar-aprovados` sem o `--empresa`, e o
default é `swell`. Sem regressão.

Se você rodar manualmente um vídeo:

```sh
npm run distribuir -- ./caminho/algum/video.mp4
```

Vai funcionar igual hoje. Por trás, agora ele lê as chaves do banco em vez
do `.env`.

## Quando termina a F2.1

Quando os passos acima derem certo, marca a F2.1 como pronta. Os crons
continuam rodando do Mac (eles só serão movidos pro Railway na F2.6).

A próxima fase é a **F2.2** — montar o app Next.js na Vercel com login Clerk.
Sem mudar nada do que já funciona; tudo novo fica numa pasta `web/`.

## Se algo der errado

- **"DATABASE_URL ausente"** → você esqueceu de salvar o `.env`.
- **"ENCRYPTION_KEY precisa ter 32 bytes em base64"** → a chave que você
  colou está errada. Gere de novo com `openssl rand -base64 32`.
- **"Empresa com slug 'swell' não encontrada"** → você esqueceu de rodar
  `npm run db:migrate-swell` no passo 5.
- **Connection refused / timeout** → a Neon pode estar dormindo no free
  tier. Espera 5s e tenta de novo, ela acorda.

Qualquer outro erro, me cola aqui que eu resolvo.
