const MODEL = process.env.GEMINI_MODEL || "gemini-3.6-flash";
const KEY = process.env.GEMINI_API_KEY;

function out(res, status, data) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  return res.status(status).json(data);
}

function clean(text) {
  return String(text || "")
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

async function ai(prompt) {
  if (!KEY) throw new Error("GEMINI_API_KEY não configurada na Vercel.");

  const response = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": KEY
    },
    body: JSON.stringify({
      model: MODEL,
      input: prompt,
      generation_config: {
        thinking_level: "low",
        max_output_tokens: 12000
      }
    })
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error?.message || data?.errors?.[0]?.message || "Erro Gemini");
  }

  const text = data?.output_text || data?.steps
    ?.filter(step => step.type === "model_output")
    ?.flatMap(step => step.content || [])
    ?.filter(block => block.type === "text")
    ?.map(block => block.text)
    ?.join("\n");

  if (!text) throw new Error("A IA não retornou conteúdo.");

  try {
    return JSON.parse(clean(text));
  } catch {
    throw new Error("A IA retornou uma resposta em formato inválido. Tente novamente.");
  }
}

const BASE = `Você é elaborador de questões para o concurso Oficial Investigador PC-MA 2026. O edital específico usa múltipla escolha com CINCO alternativas A,B,C,D,E e UMA única correta. Não use certo/errado. Crie questões inéditas, sem copiar questões reais. Avalie aplicação, interpretação, distinção entre institutos e raciocínio. Use SOMENTE o material fornecido; não invente leis ou fatos. Distratores devem ser plausíveis. Nunca use todas/nenhuma das anteriores. Distribua as letras corretas de forma equilibrada.`;

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return out(res, 204, {});
  if (req.method !== "POST") return out(res, 405, { error: "Método não permitido" });

  try {
    const b = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};

    if (b.action === "analyze_material") {
      return out(res, 200, await ai(`${BASE}\nLeia primeiro o material. Retorne JSON {"tema":"","resumo":"","topicos":[],"subtopicos":[],"pontos_de_atencao":[],"materias":[]}. MATERIAL:\n${String(b.text || "").slice(0, 140000)}`));
    }

    if (b.action === "generate_questions") {
      const n = Math.min(30, Math.max(5, Number(b.quantity || 20)));
      return out(res, 200, await ai(`${BASE}\nGere ${n} questões. Modo: ${b.mode || "treino"}. Cada item deve conter pergunta,a,b,c,d,e,correta,explicacao_correta,explicacao_erradas{a,b,c,d,e},materia,assunto,topico,dificuldade. Explique individualmente todas as alternativas. MATERIAL:\n${String(b.text || "").slice(0, 90000)}\nANÁLISE:${JSON.stringify(b.analysis || {})}\nERROS:${JSON.stringify(b.errors || [])}\nRetorne somente {"questions":[...]}.`));
    }

    if (b.action === "generate_flashcards") {
      const n = Math.min(25, Math.max(5, Number(b.quantity || 15)));
      return out(res, 200, await ai(`${BASE}\nGere ${n} flashcards de lembrança ativa. Retorne somente {"flashcards":[{"pergunta":"","resposta":"","materia":"","assunto":""}]}. MATERIAL:\n${String(b.text || "").slice(0, 90000)}`));
    }

    return out(res, 400, { error: "Ação inválida" });
  } catch (e) {
    return out(res, 500, { error: e.message || "Erro interno" });
  }
}
