const Anthropic = require('@anthropic-ai/sdk');

let client = null;
function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!client) {
    const opts = { apiKey: process.env.ANTHROPIC_API_KEY };
    if (process.env.ANTHROPIC_WORKSPACE_ID) {
      opts.defaultHeaders = { 'anthropic-workspace-id': process.env.ANTHROPIC_WORKSPACE_ID };
    }
    client = new Anthropic(opts);
  }
  return client;
}

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';

function stripJsonFence(text) {
  return text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
}

/**
 * Analyse un document juridique : parties, dates clés, montants, clauses à risque.
 * Retourne un objet structuré ou lève une erreur si la clé API est absente.
 */
async function analyzeDocument(texte, { nomDocument } = {}) {
  const anthropic = getClient();
  if (!anthropic) {
    const err = new Error('ANTHROPIC_API_KEY absente côté serveur.');
    err.code = 'NO_API_KEY';
    throw err;
  }

  const system = `Tu es le moteur d'analyse documentaire de Lexium, un outil destiné à des avocats. Tu analyses un document juridique et tu réponds UNIQUEMENT avec un objet JSON valide, sans texte avant ni après, sans balises markdown.

Format attendu :
{
  "parties": ["nom des parties identifiées"],
  "resume": "un paragraphe de synthèse neutre, factuel",
  "dates_cles": [{"date": "AAAA-MM-JJ", "evenement": "..."}],
  "clauses_a_risque": [
    {
      "niveau": "eleve" | "a_surveiller" | "a_negocier",
      "titre": "titre court du point",
      "explication": "explication factuelle du risque, avec les chiffres/faits pertinents",
      "fondement_juridique": "texte de loi ou principe pertinent, si identifiable — sinon chaîne vide",
      "recommandation": "action concrète suggérée"
    }
  ]
}

Règles impératives :
- Tu ne donnes jamais de conseil juridique définitif : tu identifies des points d'attention pour qu'un avocat les vérifie.
- Si tu cites un article de loi, ne le fais que si tu es raisonnablement confiant de son exactitude ; sinon laisse "fondement_juridique" vide plutôt que d'inventer une référence.
- "clauses_a_risque" peut être vide si le document n'appelle pas de remarque particulière.
- Chaque date de "dates_cles" doit être au format AAAA-MM-JJ, calculée à partir du texte du document ; si une date précise ne peut pas être déterminée avec certitude, omets l'entrée plutôt que de deviner.
- Réponds en français.`;

  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 2000,
    system,
    messages: [
      {
        role: 'user',
        content: `Document${nomDocument ? ` « ${nomDocument} »` : ''} à analyser :\n\n${texte}`,
      },
    ],
  });

  const raw = message.content.map((b) => (b.type === 'text' ? b.text : '')).join('\n');
  try {
    return JSON.parse(stripJsonFence(raw));
  } catch (e) {
    const err = new Error("Réponse du modèle non exploitable (JSON invalide).");
    err.code = 'BAD_JSON';
    err.raw = raw;
    throw err;
  }
}

/**
 * Répond à une question en se fondant strictement sur les documents fournis.
 * `contextDocs`: [{ nom, contenu, dossier }]
 */
async function chatAnswer(question, contextDocs) {
  const anthropic = getClient();
  if (!anthropic) {
    const err = new Error('ANTHROPIC_API_KEY absente côté serveur.');
    err.code = 'NO_API_KEY';
    throw err;
  }

  const contexte = contextDocs.length
    ? contextDocs
        .map((d, i) => `[Document ${i + 1} — ${d.nom}${d.dossier ? `, dossier ${d.dossier}` : ''}]\n${d.contenu}`)
        .join('\n\n---\n\n')
    : '(Aucun document disponible.)';

  const system = `Tu es l'assistant Lexium pour un cabinet d'avocats. Tu réponds à la question de l'avocat en te fondant EXCLUSIVEMENT sur les documents fournis ci-dessous.

Règles impératives :
- Si l'information demandée ne figure pas dans les documents fournis, dis-le clairement plutôt que de deviner ou d'inventer.
- Chaque affirmation factuelle doit être rattachable à un document précis : mentionne son nom entre guillemets dans ta réponse.
- Réponds en français, de façon concise et professionnelle.
- Tu n'es pas un conseil juridique définitif : tu aides à retrouver et synthétiser l'information contenue dans les dossiers.

Documents disponibles :
${contexte}`;

  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1200,
    system,
    messages: [{ role: 'user', content: question }],
  });

  return message.content.map((b) => (b.type === 'text' ? b.text : '')).join('\n');
}

module.exports = { analyzeDocument, chatAnswer };
