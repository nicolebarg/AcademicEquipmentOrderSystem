const HF_API_TOKEN = process.env.HF_API_TOKEN;
const HF_MODEL = process.env.HF_MODEL || "distilgpt2";
const AI_THRESHOLD = Number(process.env.AI_THRESHOLD || 0.7);

function buildPrompt(log) {
  const logText = [
    `timestamp: ${log.timestamp}`,
    `user_id: ${log.user_id ?? "null"}`,
    `action: ${log.action}`,
    `description: ${log.description}`,
    `metadata: ${JSON.stringify(log.metadata ?? {})}`
  ].join("\n");

  return `
You are a cybersecurity log anomaly detector.
Return ONLY valid JSON:
{"score":0..1,"label":"normal"|"anomaly","reason":"short"}

Rules:
- High score if repeated failed logins, privilege abuse, unusual admin actions, suspicious bursts.
- Low score if normal browsing or normal ordering.

Analyze this log:
${logText}
JSON:
`.trim();
}

function safeJsonExtract(text) {
  const a = text.indexOf("{");
  const b = text.lastIndexOf("}");
  if (a === -1 || b === -1) return null;
  try {
    return JSON.parse(text.slice(a, b + 1));
  } catch {
    return null;
  }
}

async function analyzeLog(log) {
  if (!HF_API_TOKEN) {
    return { score: 0.0, label: "normal", reason: "HF_API_TOKEN missing", model: HF_MODEL };
  }

  const prompt = buildPrompt(log);

  const resp = await fetch(`https://api-inference.huggingface.co/models/${HF_MODEL}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${HF_API_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      inputs: prompt,
      parameters: { max_new_tokens: 120, return_full_text: false }
    })
  });

  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`HF ${resp.status}: ${t}`);
  }

  const data = await resp.json();
  const generated = Array.isArray(data) ? (data[0]?.generated_text ?? "") : JSON.stringify(data);

  const obj = safeJsonExtract(generated);
  if (!obj) {
    return { score: 0.5, label: "normal", reason: "AI output not JSON", model: HF_MODEL };
  }

  const score = Math.max(0, Math.min(1, Number(obj.score ?? 0.5)));
  const label = (score >= AI_THRESHOLD || obj.label === "anomaly") ? "anomaly" : "normal";
  const reason = String(obj.reason ?? "").slice(0, 200);

  return { score, label, reason, model: HF_MODEL };
}

module.exports = { analyzeLog };
