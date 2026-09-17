const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-5";

function apiKey() {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    throw new Error(
      "ANTHROPIC_API_KEY manquante. Ajoutez-la dans le fichier .env (voir .env.example)."
    );
  }
  return key;
}

async function callMessages({ system, messages, tools, maxTokens }) {
  const body = {
    model: MODEL,
    max_tokens: maxTokens || 1500,
    messages,
  };
  if (system) body.system = system;
  if (tools) body.tools = tools;

  const response = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey(),
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw new Error("Erreur API Anthropic (" + response.status + ") : " + errText);
  }
  return response.json();
}

function extractText(data) {
  return (data.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n");
}

function extractJson(text) {
  const cleaned = text.replace(/```json|```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("Réponse de l'IA illisible (pas de JSON trouvé).");
  return JSON.parse(cleaned.slice(start, end + 1));
}

function profileContext(user) {
  const specs = user.specialites ? JSON.parse(user.specialites) : [];
  return (
    "Cabinet : " + user.cabinet + ", avocat référent " + user.avocat +
    (user.barreau ? ", barreau de " + user.barreau : "") +
    ". Domaines de spécialisation habituels : " + (specs.length ? specs.join(", ") : "non précisées") + "."
  );
}

async function analyserDocument(texte, user) {
  const system =
    "Tu es un assistant qui aide un avocat français à analyser un document ou une situation de dossier.\n" +
    profileContext(user) + "\n\n" +
    "Réponds UNIQUEMENT avec un objet JSON valide (pas de texte avant/après, pas de balises markdown), avec exactement ces clés :\n" +
    '- "domaine" : chaîne courte, le domaine du droit concerné\n' +
    '- "resume" : chaîne, résumé du document ou de la situation en 3 à 5 phrases\n' +
    '- "qualification" : chaîne, qualification juridique préliminaire, 1 à 2 phrases\n' +
    '- "points_a_verifier" : tableau de 3 à 6 chaînes, éléments à vérifier ou informations manquantes\n' +
    '- "delais" : tableau de 2 à 4 chaînes, délais ou prescriptions à vérifier en priorité\n' +
    '- "taches" : tableau de 4 à 8 chaînes, actions concrètes et immédiatement actionnables\n' +
    '- "pieces" : tableau de 3 à 7 chaînes, documents ou pièces à réunir\n\n' +
    "Reste générique sur les noms propres, dates et montants s'ils ne sont pas donnés explicitement : n'invente rien.";

  const data = await callMessages({
    system,
    messages: [{ role: "user", content: texte }],
    maxTokens: 1500,
  });
  return extractJson(extractText(data));
}

async function redigerTexte({ typeActe, instructions, contexte }, user) {
  const system =
    "Tu es un assistant qui aide un avocat français à rédiger un premier projet de texte.\n" +
    profileContext(user) + "\n\n" +
    "Rédige un projet de \"" + typeActe + "\" dans un style juridique formel français, clair et structuré. " +
    "N'invente aucun nom propre, date ou montant qui ne serait pas donné dans le contexte : utilise des mentions génériques entre crochets si besoin (ex. [nom du client], [date]). " +
    "Ce texte est un premier jet destiné à être relu et complété par l'avocat.\n\n" +
    "Réponds UNIQUEMENT avec le texte rédigé, sans commentaire ni balise.";

  const userContent =
    "Contexte du dossier :\n" + (contexte || "(non précisé)") + "\n\nInstructions spécifiques :\n" + (instructions || "(aucune, rédige un projet standard pour ce type d'acte)");

  const data = await callMessages({
    system,
    messages: [{ role: "user", content: userContent }],
    maxTokens: 1800,
  });
  return extractText(data).trim();
}

async function rechercheJuridique(question) {
  const system =
    "Tu es un assistant de recherche juridique pour un avocat français. " +
    "Utilise la recherche web pour trouver des sources fiables et à jour (Légifrance, Judilibre, Cour de cassation, Conseil d'État, doctrine reconnue). " +
    "Réponds de façon structurée et concise, en citant explicitement tes sources. " +
    "Rappelle que toute source doit être vérifiée et imprimée par l'avocat avant utilisation en procédure.";

  const data = await callMessages({
    system,
    messages: [{ role: "user", content: question }],
    tools: [{ type: "web_search_20250305", name: "web_search" }],
    maxTokens: 2000,
  });

  const reponse = extractText(data);
  const sources = [];
  (data.content || []).forEach((block) => {
    if (block.type === "web_search_tool_result" && Array.isArray(block.content)) {
      block.content.forEach((r) => {
        if (r.url) sources.push({ url: r.url, title: r.title || r.url });
      });
    }
  });
  return { reponse, sources };
}

module.exports = { analyserDocument, redigerTexte, rechercheJuridique };
