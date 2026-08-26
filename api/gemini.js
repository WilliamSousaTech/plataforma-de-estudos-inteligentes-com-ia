const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-pro";
const API_KEY = process.env.GEMINI_API_KEY;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

/**
 * Retorna JSON para o frontend e aplica os headers CORS
 * de forma compatível com Vercel/Node.js.
 */
function json(res, status, data) {
  Object.entries(CORS).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  return res
    .status(status)
    .setHeader("Content-Type", "application/json")
    .send(JSON.stringify(data));
}

/**
 * Remove cercas de código caso a IA eventualmente
 * retorne ```json ... ```.
 */
function stripCodeFence(text) {
  return String(text || "")
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

/**
 * Chama a API Gemini.
 */
async function callGemini(parts, schema, temperature = 0.25) {
  if (!API_KEY) {
    throw new Error(
      "GEMINI_API_KEY não configurada na Vercel."
    );
  }

  const body = {
    contents: [
      {
        role: "user",
        parts
      }
    ],

    generationConfig: {
      temperature,
      responseMimeType: "application/json",
      responseSchema: schema
    }
  };

  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

  const response = await fetch(url, {
    method: "POST",

    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": API_KEY
    },

    body: JSON.stringify(body)
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data?.error?.message ||
      "Erro ao chamar a API Gemini."
    );
  }

  const text =
    data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error(
      "A Gemini não retornou conteúdo."
    );
  }

  try {
    return JSON.parse(
      stripCodeFence(text)
    );
  } catch (error) {
    console.error(
      "Resposta recebida da Gemini:",
      text
    );

    throw new Error(
      "A Gemini retornou um JSON inválido."
    );
  }
}


/* =========================================================
   SCHEMA — PROCESSAMENTO DO MATERIAL
========================================================= */

const processSchema = {
  type: "object",

  properties: {
    tema: {
      type: "string"
    },

    topicos_chave: {
      type: "array",
      items: {
        type: "string"
      }
    },

    subtopicos: {
      type: "array",
      items: {
        type: "string"
      }
    },

    artigos_lei: {
      type: "array",
      items: {
        type: "string"
      }
    },

    resumo: {
      type: "string"
    },

    riscos_de_confusao: {
      type: "array",
      items: {
        type: "string"
      }
    }
  },

  required: [
    "tema",
    "topicos_chave",
    "subtopicos",
    "artigos_lei",
    "resumo",
    "riscos_de_confusao"
  ]
};


/* =========================================================
   SCHEMA — QUESTÕES
========================================================= */

const quizItem = {
  type: "object",

  properties: {
    pergunta: {
      type: "string"
    },

    a: {
      type: "string"
    },

    b: {
      type: "string"
    },

    c: {
      type: "string"
    },

    d: {
      type: "string"
    },

    correta: {
      type: "string",
      enum: [
        "a",
        "b",
        "c",
        "d"
      ]
    },

    explicacao_correta: {
      type: "string"
    },

    explicacao_erradas: {
      type: "object",

      properties: {
        a: {
          type: "string"
        },

        b: {
          type: "string"
        },

        c: {
          type: "string"
        },

        d: {
          type: "string"
        }
      },

      required: [
        "a",
        "b",
        "c",
        "d"
      ]
    },

    materia: {
      type: "string"
    },

    assunto: {
      type: "string"
    },

    topico: {
      type: "string"
    },

    dificuldade: {
      type: "string",

      enum: [
        "fácil",
        "média",
        "difícil",
        "muito_difícil"
      ]
    }
  },

  required: [
    "pergunta",
    "a",
    "b",
    "c",
    "d",
    "correta",
    "explicacao_correta",
    "explicacao_erradas",
    "materia",
    "assunto",
    "topico",
    "dificuldade"
  ]
};


/* =========================================================
   SCHEMA — LISTA DE QUESTÕES
========================================================= */

const quizSchema = {
  type: "array",

  items: quizItem,

  minItems: 5,

  maxItems: 30
};


/* =========================================================
   SCHEMA — ANÁLISE DE DESEMPENHO
========================================================= */

const analysisSchema = {
  type: "object",

  properties: {
    dominio: {
      type: "number",
      minimum: 0,
      maximum: 100
    },

    pontos_fracos: {
      type: "array",
      items: {
        type: "string"
      }
    },

    pontos_fortes: {
      type: "array",
      items: {
        type: "string"
      }
    },

    risco_esquecimento: {
      type: "number",
      minimum: 0,
      maximum: 100
    },

    prioridade_hoje: {
      type: "array",
      items: {
        type: "string"
      }
    },

    plano_7_dias: {
      type: "array",
      items: {
        type: "string"
      }
    },

    previsao_desempenho: {
      type: "number",
      minimum: 0,
      maximum: 100
    },

    justificativa: {
      type: "string"
    }
  },

  required: [
    "dominio",
    "pontos_fracos",
    "pontos_fortes",
    "risco_esquecimento",
    "prioridade_hoje",
    "plano_7_dias",
    "previsao_desempenho",
    "justificativa"
  ]
};


/* =========================================================
   INSTRUÇÕES DA IA
========================================================= */

const processInstruction = `
Você é um professor especialista em preparação
para concursos policiais, com foco na PC-MA
e no estilo de cobrança da banca FGV.

Sua primeira função é COMPREENDER profundamente
o material antes de gerar qualquer questão.

Analise o conteúdo com atenção.

Não invente:
- leis;
- artigos;
- conceitos;
- exceções;
- jurisprudência;
- informações que não estejam sustentadas
  pelo material fornecido.

Identifique:

1. Tema principal.
2. Tópicos mais importantes.
3. Subtópicos.
4. Artigos de lei e referências citadas.
5. Resumo objetivo.
6. Pontos que podem gerar confusão entre conceitos.
`;


const quizInstruction = `
Você está criando um treinamento de alto nível
para preparação da PC-MA.

As questões devem seguir uma abordagem
situacional inspirada no estilo FGV.

REGRAS OBRIGATÓRIAS:

1. Crie questões inéditas.
2. Evite perguntas puramente decorativas.
3. Sempre que possível utilize casos práticos.
4. O enunciado deve contextualizar uma situação.
5. Deve existir apenas UMA alternativa correta.
6. Deve haver quatro alternativas:
   A, B, C e D.
7. Informe explicitamente o gabarito.
8. Explique detalhadamente por que a correta está correta.
9. Explique INDIVIDUALMENTE por que cada alternativa
   está errada ou correta.
10. Identifique matéria, assunto e tópico.
11. Varie a dificuldade.
12. Não copie literalmente questões anteriores.
13. Não crie conteúdo jurídico não sustentado
    pelo material fornecido.

O objetivo é fazer o aluno RACIOCINAR,
não simplesmente reconhecer uma frase decorada.
`;


const analysisInstruction = `
Você é um analista pedagógico extremamente rigoroso.

Analise o histórico do aluno.

Não confunda:
- acerto ocasional;
- acerto em questão fácil;
- memorização recente;

com domínio verdadeiro.

Considere:

- precisão;
- retenção;
- dificuldade das questões;
- tempo de resposta;
- consistência;
- recência;
- erros repetidos;
- assuntos com maior risco de esquecimento.

A previsão de desempenho é uma ESTIMATIVA.
Nunca trate como garantia de aprovação.

Identifique os assuntos que realmente precisam
de atenção imediata.
`;


/* =========================================================
   HANDLER PRINCIPAL
========================================================= */

export default async function handler(req, res) {

  /*
   * CORS para requisições OPTIONS.
   */
  if (req.method === "OPTIONS") {

    Object.entries(CORS).forEach(([key, value]) => {
      res.setHeader(key, value);
    });

    return res
      .status(204)
      .send("");
  }


  /*
   * Aceitamos somente POST.
   */
  if (req.method !== "POST") {

    return json(
      res,
      405,
      {
        error: "Método não permitido."
      }
    );
  }


  try {

    /*
     * Dependendo da configuração da Vercel,
     * req.body pode já ser objeto ou string.
     */
    const body =
      typeof req.body === "string"
        ? JSON.parse(req.body)
        : req.body || {};


    const action =
      body.action;


    /* =====================================================
       PROCESSAR MATERIAL
    ===================================================== */

    if (action === "process") {

      const parts = [
        {
          text: processInstruction
        }
      ];


      /*
       * Texto colado pelo usuário.
       */
      if (
        body.text &&
        body.text.trim()
      ) {

        parts.push({
          text:
            `MATERIAL DE ESTUDO:\n${body.text.slice(
              0,
              120000
            )}`
        });
      }


      /*
       * PDF enviado em Base64.
       *
       * A Gemini recebe o PDF como documento.
       */
      if (body.fileBase64) {

        parts.push({
          inlineData: {
            mimeType: "application/pdf",
            data: body.fileBase64
          }
        });

        parts.push({
          text: `
Analise este PDF como documento.

Primeiro extraia e compreenda
o conteúdo textual.

Depois identifique o tema,
os tópicos, subtópicos,
artigos e riscos de confusão.
`
        });
      }


      /*
       * Garante que existe alguma entrada.
       */
      if (
        !body.text &&
        !body.fileBase64
      ) {

        return json(
          res,
          400,
          {
            error:
              "Envie um PDF ou cole um texto."
          }
        );
      }


      const result =
        await callGemini(
          parts,
          processSchema,
          0.15
        );


      return json(
        res,
        200,
        result
      );
    }


    /* =====================================================
       GERAR QUIZ
    ===================================================== */

    if (action === "quiz") {

      const quantidade = Math.min(
        Math.max(
          Number(
            body.quantidade || 10
          ),
          5
        ),
        30
      );


      const topicos =
        Array.isArray(body.topicos)
          ? body.topicos.join("; ")
          : String(
              body.topicos || ""
            );


      const instruction = `
${quizInstruction}

Gere exatamente
${quantidade}
questões.

TEMA:
${body.tema || "Não informado"}

TÓPICOS PRIORITÁRIOS:
${topicos || "Não informado"}

NÍVEL:
${body.nivel || "adaptativo"}

RESUMO DO MATERIAL:
${body.resumo || "Não informado"}

SUBTÓPICOS:
${body.contexto || "Não informado"}
`;


      const resultado =
        await callGemini(
          [
            {
              text: instruction
            }
          ],
          quizSchema,
          0.35
        );


      return json(
        res,
        200,
        resultado
      );
    }


    /* =====================================================
       ANALISAR DESEMPENHO
    ===================================================== */

    if (action === "analyze") {

      const historico =
        JSON.stringify(
          body.historico || {},
          null,
          2
        );


      const instruction = `
${analysisInstruction}

HISTÓRICO DO ALUNO:

${historico}
`;


      const resultado =
        await callGemini(
          [
            {
              text: instruction
            }
          ],
          analysisSchema,
          0.15
        );


      return json(
        res,
        200,
        resultado
      );
    }


    /*
     * Ação desconhecida.
     */
    return json(
      res,
      400,
      {
        error:
          "Ação inválida."
      }
    );


  } catch (error) {

    console.error(
      "Erro na API:",
      error
    );

    return json(
      res,
      500,
      {
        error:
          error?.message ||
          "Erro interno na API."
      }
    );
  }
}