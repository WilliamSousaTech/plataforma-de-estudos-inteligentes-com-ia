const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-pro";
const API_KEY = process.env.GEMINI_API_KEY;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

function json(res, status, data) {
  return res.status(status).setHeader("Content-Type", "application/json").setHeaders(CORS).send(JSON.stringify(data));
}

function stripCodeFence(text) {
  return String(text || "")
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

async function callGemini(parts, schema, temperature = 0.25) {
  if (!API_KEY) throw new Error("GEMINI_API_KEY não configurada na Vercel.");

  const body = {
    contents: [{ role: "user", parts }],
    generationConfig: {
      temperature,
      responseMimeType: "application/json",
      responseSchema: schema
    }
  };

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
  const r = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": API_KEY
    },
    body: JSON.stringify(body)
  });

  const data = await r.json();
  if (!r.ok) {
    throw new Error(data?.error?.message || "Erro ao chamar a API Gemini.");
  }

  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("A Gemini não retornou conteúdo.");

  return JSON.parse(stripCodeFence(text));
}

const processSchema = {
  type: "object",
  properties: {
    tema: { type: "string" },
    topicos_chave: { type: "array", items: { type: "string" } },
    subtopicos: { type: "array", items: { type: "string" } },
    artigos_lei: { type: "array", items: { type: "string" } },
    resumo: { type: "string" },
    riscos_de_confusao: { type: "array", items: { type: "string" } }
  },
  required: ["tema", "topicos_chave", "subtopicos", "artigos_lei", "resumo", "riscos_de_confusao"]
};

const quizItem = {
  type: "object",
  properties: {
    pergunta: { type: "string" },
    a: { type: "string" },
    b: { type: "string" },
    c: { type: "string" },
    d: { type: "string" },
    correta: { type: "string", enum: ["a","b","c","d"] },
    explicacao_correta: { type: "string" },
    explicacao_erradas: {
      type: "object",
      properties: {
        a: { type: "string" }, b: { type: "string" },
        c: { type: "string" }, d: { type: "string" }
      },
      required: ["a","b","c","d"]
    },
    materia: { type: "string" },
    assunto: { type: "string" },
    topico: { type: "string" },
    dificuldade: { type: "string", enum: ["fácil","média","difícil","muito_difícil"] }
  },
  required: ["pergunta","a","b","c","d","correta","explicacao_correta","explicacao_erradas","materia","assunto","topico","dificuldade"]
};

const quizSchema = {
  type: "array",
  items: quizItem,
  minItems: 5,
  maxItems: 30
};

const analysisSchema = {
  type: "object",
  properties: {
    dominio: { type: "number", minimum: 0, maximum: 100 },
    pontos_fracos: { type: "array", items: { type: "string" } },
    pontos_fortes: { type: "array", items: { type: "string" } },
    risco_esquecimento: { type: "number", minimum: 0, maximum: 100 },
    prioridade_hoje: { type: "array", items: { type: "string" } },
    plano_7_dias: { type: "array", items: { type: "string" } },
    previsao_desempenho: { type: "number", minimum: 0, maximum: 100 },
    justificativa: { type: "string" }
  },
  required: ["dominio","pontos_fracos","pontos_fortes","risco_esquecimento","prioridade_hoje","plano_7_dias","previsao_desempenho","justificativa"]
};

const processInstruction = `
Você é um professor de preparação para concursos policiais, especialista em PC-MA e em questões situacionais no estilo FGV.
Primeiro ENTENDA o material antes de produzir qualquer questão.
Não invente leis, artigos, exceções ou conceitos que não estejam sustentados pelo material.
Identifique o tema, tópicos, sub-tópicos e artigos de lei. Aponte riscos de confusão.
`;

const quizInstruction = `
Você está criando um treinamento de alto nível para PC-MA.
Gere questões inéditas e situacionais, no estilo FGV, baseadas SOMENTE no material/contexto fornecido.
NÃO faça perguntas de mera memorização quando for possível transformar o conteúdo em caso prático.
Cada questão deve obrigatoriamente:
1) ter um caso/enunciado claro;
2) ter A, B, C e D;
3) ter apenas UMA alternativa correta;
4) informar o gabarito;
5) explicar a correta;
6) explicar INDIVIDUALMENTE por que A, B, C e D estão erradas/certas;
7) identificar matéria, assunto e tópico;
8) variar dificuldade.
Não repita frases nem alternativas entre questões.
`;

const analysisInstruction = `
Você é um analista pedagógico rigoroso.
Não confunda acerto em questões fáceis com domínio.
Considere erros recorrentes, retenção, desempenho por dificuldade, tempo, recência e estabilidade.
A previsão é uma estimativa de desempenho no próximo simulado, não uma garantia de aprovação.
`;

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(204).setHeaders(CORS).send("");
  if (req.method !== "POST") return json(res, 405, { error: "Método não permitido." });

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const action = body.action;

    if (action === "process") {
      const parts = [{ text: processInstruction }];
      if (body.text) parts.push({ text: `MATERIAL DE ESTUDO:\n${body.text.slice(0, 120000)}` });
      if (body.fileBase64) {
        parts.push({ inlineData: { mimeType: "application/pdf", data: body.fileBase64 } });
        parts.push({ text: "Este PDF pode ser tratado como documento. Extraia e compreenda o texto antes da análise." });
      }
      const result = await callGemini(parts, processSchema, 0.15);
      return json(res, 200, result);
    }

    if (action === "quiz") {
      const quantidade = Math.min(Math.max(Number(body.quantidade || 10), 5), 30);
      const instruction = `${quizInstruction}
Crie ${quantidade} questões.
Tema: ${body.tema || "não informado"}
Tópicos prioritários: ${(body.topicos || []).join("; ")}
Nível geral: ${body.nivel || "adaptativo"}
Material resumido: ${body.resumo || ""}
Contexto adicional: ${body.contexto || ""}
`;
      return json(res, 200, await callGemini([{ text: instruction }], quizSchema, 0.35));
    }

    if (action === "analyze") {
      const instruction = `${analysisInstruction}
Histórico do aluno em JSON:
${JSON.stringify(body.historico || {}, null, 2)}
`;
      return json(res, 200, await callGemini([{ text: instruction }], analysisSchema, 0.15));
    }

    return json(res, 400, { error: "Ação inválida." });
  } catch (e) {
    return json(res, 500, { error: e.message || "Erro interno." });
  }
}
