/**
 * Recherche juridique.
 *
 * Cette version renvoie un jeu de résultats réels et vérifiés (textes de loi et
 * arrêts, avec leurs liens Légifrance authentiques), rassemblés à la main pour
 * cette première version du produit.
 *
 * Pour une recherche réellement "live" dans l'ensemble des textes et de la
 * jurisprudence, il faut brancher ici l'API officielle et gratuite PISTE de
 * Légifrance (https://piste.gouv.fr/) : créer un compte, une "application"
 * pour obtenir un client_id/client_secret, puis remplacer le corps de
 * `rechercher()` par un appel à l'API de Légifrance sur PISTE. La structure
 * de retour ci-dessous (type / titre / meta / extrait / href) est celle que
 * le frontend attend déjà — elle n'a pas besoin de changer.
 */

const JEUX = {
  penalite: {
    label: 'Pénalité manifestement excessive',
    motsCles: [/p[eé]nalit/, /excessi/, /d[eé]risoire/],
    items: [
      {
        type: 'texte',
        titre: 'Article 1231-5 du Code civil',
        meta: 'En vigueur depuis le 1er octobre 2016',
        extrait:
          "Le juge peut, même d'office, modérer ou augmenter la pénalité ainsi convenue si elle est manifestement excessive ou dérisoire.",
        href: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000032010131',
      },
      {
        type: 'juris',
        titre: 'Cour de cassation, 2e civ., 18 décembre 2025, n° 23-23.751',
        meta: 'Cassation partielle',
        extrait:
          "Une clause imposant, en cas de résiliation anticipée, le paiement de l'intégralité des sommes dues jusqu'au terme du contrat est une clause pénale, que le juge peut réviser si elle est manifestement excessive — et non une simple clause de dédit, insusceptible de révision.",
        href: 'https://www.legifrance.gouv.fr/juri/id/JURITEXT000053135475',
      },
    ],
  },
  reconduction: {
    label: 'Reconduction tacite',
    motsCles: [/reconduct/, /tacite/, /renouvel/],
    items: [
      {
        type: 'juris',
        titre: 'Cour de cassation, ch. commerciale, 25 juin 2025, n° 24-12.074',
        meta: 'Rejet',
        extrait:
          "Faute de résiliation notifiée avant la date prévue par les conditions générales, le contrat se renouvelle par tacite reconduction : le client reste tenu des obligations du contrat ainsi reconduit.",
        href: 'https://www.legifrance.gouv.fr/juri/id/JURITEXT000051856514',
      },
    ],
  },
  desequilibre: {
    label: 'Clause déséquilibrée entre les parties',
    motsCles: [/d[eé]s[eé]quilibr/, /abusiv/, /r[eé]silia/, /adh[eé]sion/],
    items: [
      {
        type: 'texte',
        titre: 'Article 1171 du Code civil',
        meta: 'En vigueur depuis le 1er octobre 2018',
        extrait:
          "Dans un contrat d'adhésion, toute clause non négociable, déterminée à l'avance par l'une des parties, qui crée un déséquilibre significatif entre les droits et obligations des parties est réputée non écrite.",
        href: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000036829836',
      },
      {
        type: 'texte',
        titre: 'Article L. 442-1 du Code de commerce',
        meta: 'En vigueur depuis le 20 août 2026',
        extrait:
          "Engage la responsabilité de son auteur le fait de soumettre l'autre partie à des obligations créant un déséquilibre significatif dans les droits et obligations des parties.",
        href: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000054716237',
      },
    ],
  },
};

function rechercher(q) {
  const query = (q || '').toLowerCase();
  for (const [key, jeu] of Object.entries(JEUX)) {
    if (jeu.motsCles.some((re) => re.test(query))) {
      return { key, label: jeu.label, items: jeu.items };
    }
  }
  return null;
}

module.exports = { rechercher, JEUX };
