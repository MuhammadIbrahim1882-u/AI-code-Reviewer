require("dotenv").config();
const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const MODEL = process.env.MODEL || "claude-sonnet-5-5";
const MAX_CHARS = 20000;

app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

const SYSTEM = `You are a senior engineer doing a code review.
Find real bugs, security problems, edge cases and maintainability issues in the code.
Reply with ONLY a JSON object, no markdown fences, in this shape:
{"summary": "2 sentence overall assessment",
 "issues": [{"severity": "bug" | "warning" | "suggestion",
             "line": <number or null>,
             "title": "short title",
             "explanation": "why it is a problem",
             "fix": "corrected code snippet or empty string"}]}
Order issues by severity (bugs first). If the code is fine, return an empty issues list.`;

app.get("/api/health", (req, res) => res.json({ ok: true, hasKey: Boolean(process.env.ANTHROPIC_API_KEY), model: MODEL }));

app.post("/api/review", async (req, res) => {
  const { code, language } = req.body || {};
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: "ANTHROPIC_API_KEY is missing. Add it to your .env file and restart the server." });
  }
  if (typeof code !== "string" || !code.trim()) {
    return res.status(400).json({ error: "Paste some code to review." });
  }
  if (code.length > MAX_CHARS) {
    return res.status(400).json({ error: `Code is too long. Limit is ${MAX_CHARS} characters.` });
  }

  const numbered = code.split("\n").map((l, i) => `${i + 1}: ${l}`).join("\n");
  const lang = language && language !== "auto" ? language : "unknown (detect it)";

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 3000,
        system: SYSTEM,
        messages: [{ role: "user", content: `Language: ${lang}\n\nCode (with line numbers):\n${numbered}` }]
      })
    });
    const data = await r.json();
    if (!r.ok) {
      return res.status(502).json({ error: data?.error?.message || "The LLM API returned an error." });
    }
    const text = (data.content || []).map(b => b.text || "").join("");
    const clean = text.replace(/```json|```/g, "").trim();
    let result;
    try {
      result = JSON.parse(clean);
    } catch {
      return res.status(502).json({ error: "The model reply could not be read. Try again." });
    }
    result.issues = Array.isArray(result.issues) ? result.issues : [];
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not reach the LLM API. Check your internet connection." });
  }
});

app.listen(PORT, () => console.log(`AI Code Reviewer running at http://localhost:${PORT}`));
