# PC-MA TRAINER — FINAL VERCEL

Esta versão foi preparada para publicação direta na Vercel.

## Estrutura

- `index.html` — aplicação inteira
- `script.js` — lógica de estudo, métricas, revisão e armazenamento local
- `api/gemini.js` — Vercel Function protegendo a chave do Gemini
- `vercel.json` — configuração da Function
- `package.json` — runtime Node

## Deploy

1. Envie tudo para o seu repositório GitHub.
2. Conecte o repositório à Vercel.
3. Em Vercel → Settings → Environment Variables, crie:
   - `GEMINI_API_KEY` = sua chave
   - `GEMINI_MODEL` = `gemini-2.5-pro` (opcional; já é o padrão)
4. Faça um novo deploy.
5. Abra o site.

## Importante

Esta versão usa a capacidade de documento/PDF da própria API Gemini na Function da Vercel. Isso evita colocar a chave no navegador e evita depender de Java/PDFBox no ambiente serverless.

Os dados de progresso desta versão ficam em `localStorage` do navegador, para você já conseguir estudar sem configurar banco. Para login, sincronização entre dispositivos e backup na nuvem, o próximo upgrade deve adicionar Supabase/PostgreSQL.

## O sistema já faz

- PDF ou texto -> IA entende o material
- Geração de questões situacionais
- Gabarito + explicação da correta
- Explicação individual de A/B/C/D
- Caderno de erros
- Revisões adaptativas 1/3/7 e progressão 3/7/15/30
- Missão diária
- Simulado configurável
- Métricas de precisão, retenção, dificuldade, velocidade, consistência e recência
- Índice de Domínio Real
- Previsão de desempenho
- Persistência local no navegador

## Atenção pedagógica

A IA deve trabalhar sobre o material fornecido e não deve inventar conteúdo jurídico. Para legislação, sempre valide a fonte e o texto legal oficial antes de tratar qualquer questão como autoridade jurídica.
