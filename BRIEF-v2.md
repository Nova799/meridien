# MÉRIDIEN — Brief créatif v2
*Un carnet d'intention. Une question par jour. Relié, pas dématérialisé.*
*Remplace conceptuellement BRIEF.md pour la v2. localStorage uniquement, zéro réseau.*

## 1. Concept & scope v2

**Phrase :** Méridien v2 est un *carnet de bord* — papier ligné, spirale, marge vermillon, tampons encre — qui tient le rituel d'une question par jour, multiplié par des carnets thématiques.

**Scope v2 (tout en local, zéro compte) :** carnets multiples avec onglets de couleur, question configurable par carnet (banque + rotation quotidienne), tags + recherche plein texte (`/`), vue « Année » façon contributions, export/import JSON complet, mode « Encre de nuit », print stylesheet, onboarding 3 écrans, stats enrichies, command palette légère (`Cmd/Ctrl+K`).

**Positionnement :** toujours le rituel court, jamais le réseau social. Le carnet est l'interface — l'écran est une page, pas une app.

## 2. Direction artistique — NOTEBOOK assumé

**Palette papier/encre (jour)**
- Encre — `#221F1B` (texte principal ; jamais noir pur)
- Papier — `#FBF8EF` (papier vergé clair, chaud)
- Papier veilleuse — `#F3EFE3` (fond du carnet sous la page)
- Marge vermillon — `#B4432E` (filet vertical 1,5 px, à 56 px du bord gauche)
- Lignage — `#C9CDD6` (bleu-gris papier, hauteur de ligne 28 px)
- Ocre — `#C8762C` (tampon, streak, focus)
- Sauge — `#8A9B7E` (validation) · Cendre — `#6E6A62` (secondaire) · Brume — `#D8D3C8` (vide)

**Variante « Encre de nuit » (persistée, bascule `Cmd/Ctrl+Shift+D` ou palette)**
- Papier charbon — `#1E1D1A` (papier nuit) · page `#25241F`
- Encre crème — `#EDE6D6` (texte) ; secondaire `#A9A294`
- Marge vermillon terne — `#8A4A38` ; lignage `#3A3833` ; ocre `#D18A3F` (rehaussé pour contraste)
- Contraste texte ≥ 7:1 ; aucun gris pur, tout tire vers brun-charbon.

**Typographies (système uniquement)**
- Question du jour & titres : Georgia italic (« Segoe Script » interdit) ; `« cursive »` système avec parcimonie (signatures, onboarding uniquement — jamais le corps).
- Corps/UI : -apple-system/Segoe UI/Roboto. Chiffres : Georgia `tabular-nums`. Aucun webfont.

**Couches CSS — la page papier (aucune image externe)**
1. **Texture papier** : `background-color` + `repeating-linear-gradient(0deg, transparent 0 2px, rgba(110,106,98,.02) 2px 4px)` (grain horizontal fin) + `radial-gradient` très subtil pour vieillissement des coins ; `background-blend-mode: multiply`. Nuit : varier opacités, teinter crème.
2. **Lignage** : `repeating-linear-gradient(to bottom, transparent 0 calc(28px - 1px), var(--lignage) calc(28px - 1px) 28px)` aligné sur l'interligne du texte (`line-height: 28px`).
3. **Marge rouge** : `linear-gradient(to right, transparent 0 55px, var(--vermillon) 55px 56.5px, transparent 56.5px)` sur la page, ou pseudo-élément `.page::before` en `position:absolute`.
4. **Trous de perforation** : colonne de `radial-gradient(circle at 8px center, var(--papier-veilleuse) 0 5px, rgba(0,0,0,.18) 5.5px 6.5px, transparent 7px)` répétés via `background-repeat: repeat-y; background-size: 100% 64px` sur un pseudo-élément `.page::after` à gauche — effet ombre portée interne = trou crédible.
5. **Reliure** : à gauche, spirale = `repeating-radial-gradient` ou pseudo-éléments `.spiral-ring` (cerclements `border: 2px solid #8f8a7d; border-radius:50%` avec `box-shadow: inset`) ; alternative cousue = double pointillé `border-left: 2px dashed` + surpiqûre. Choisir spirale par défaut ; cousue en option print.
6. **Onglets de carnet** : `<button class="tab-carnet">` positionnés en `absolute` à droite, débordants de 10 px, colorés par carnet (couleurs sourdes : ocre, sauge, vermillon, bleu-ardoise `#4A5A6A`, prune `#5D4A5A`, forêt `#3E5A44`) ; onglet actif = pleine hauteur + ombre.
7. **Tampon « Gardé »** : `::after` sur la page sauvegardée — texte « GARDÉ » en Georgia bold, `color: var(--ocre)`, `opacity:.85`, `border: 3px double currentColor`, `border-radius: 6px`, `transform: rotate(-8deg)`, `mask-image: radial-gradient(…)` optionnel pour l'usure d'encre.
8. **Ombres** : `box-shadow: 0 1px 2px rgba(0,0,0,.15), 0 8px 24px rgba(28,26,23,.18)` sur la page posée ; sous la nuit, crème à faible opacité.
9. **Print stylesheet** (`@media print`) : fond blanc forcé, lignage + marge vermillon conservés via mêmes gradients (imprimable en noir/gris), perforations masquées ou en gris 10%, reliure/spirale masquées, une page = un jour (`page-break-after`), en-tête/pied = titre carnet + date. `print-color-adjust: exact`.

**Grille** : colonne 680 px (carnet plus large), marges ≥ 20 px ; rythme 8 px ; la question occupe le tiers haut, la réponse sur les interlignes.

## 3. Micro-copy FR v2 (complet)

*Onboarding (3 écrans max, passé ensuite, `meridien.onboarded = true`)*
- O1 : « Ceci est un carnet, pas une appli. » — « Une question par jour. Quelques lignes. Rien d'autre. » — bouton « Ouvrir le carnet »
- O2 : « Choisissez vos carnets. » — « Intention, Idées, Gratitude… chaque carnet a son onglet et sa question. » — bouton « Créer mon premier carnet » (préremplit « Intention »)
- O3 : « Tout reste ici. » — « Aucune donnée ne sort de ce navigateur. Exportez quand vous voulez. » — bouton « Écrire la première page »

*Aujourd'hui*
- Date en petites capitales ; question en italique ; placeholder « Quelques lignes suffisent… »
- Bouton « Garder cette page » → après save : tampon GARDÉ + « Noté. À demain pour la suite. » ; réouverture : « Vous avez déjà écrit aujourd'hui. Modifier la page ? »
- Tag input sous la saisie : placeholder « tags (virgule)… » ; indice tags : « #idée #gratitude »

*Carnets*
- « Nouveau carnet » · placeholder nom « Nom du carnet… » · renommer : « Renommer « Idées » » · supprimer : « Supprimer ce carnet et ses pages ? » + confirmation « Garder / Supprimer »
- Question par carnet : « La question de ce carnet » + « Changer de question » · rotation : « Rotation quotidienne : activée / désactivée »
- Carnet vide : « Ce carnet est neuf. La première page est celle d'aujourd'hui. »

*Recherche (` / `)* — placeholder « Chercher dans les pages… » · résultats : « N pages pour « … » » · vide : « Aucune page. Essayez un mot plus simple. »

*Vue Année* — titre « L'année en pages » · légende : « Une case = une page. » · hover/focus case : « 14 novembre — Intention » · vide : « L'année commence aujourd'hui. »

*Statistiques* — libellés : « Jours consécutifs » · « Total de pages » · « Plus longue série » · « Meilleure période » (mois le plus dense, « novembre 2026 — 12 pages ») · « Par carnet » · « Par jour de la semaine » · export : « Exporter (.json) » · import : « Restaurer une archive » · confirm import : « Remplacer les données actuelles par l'archive ? »

*Command palette (`Cmd/Ctrl+K`)* — placeholder « Que voulez-vous faire ? » · actions listées : « Nouvelle page », « Changer de carnet… », « Aller à la date… », « Basculer Encre de nuit », « Exporter l'archive », « Importer une archive », « Chercher… »

*Toasts / encre*
- Export : « Archive exportée — méridien-export.json » · Import réussi : « Archive restaurée — N pages. » · Import invalide : « Ce fichier n'est pas une archive Méridien. »
- Thème : « Encre de nuit » / « Encre de jour » · Carnet créé : « Carnet « Gratitude » ouvert. » · Tag ajouté silencieusement (pas de toast)

## 4. Vues & écrans

- **Aujourd'hui** (`#/`, `1`) : page spirale complète ; date, question, saisie lignée auto-ext, tags, bouton Garder. Sélecteur de carnet = onglets à droite.
- **Archive** (`#/archive`, `2`) : grille mensuelle, cases = miniatures de couverture (canvas) sur fond papier ; jour vide = case Brume ; `←/→` mois ; clic → détail (date, carnet, question, texte, couverture) avec tampon GARDÉ.
- **Année** (`#/annee`, `4`) : heatmap 53×7 façon contributions, cases 10–12 px, 4 niveaux d'encre (0 page / 1–2 / 3–5 / 6+ via opacité ocre sur papier), mois en étiquettes, tooltip/aria-label daté, clic case → détail du jour.
- **Statistiques** (`#/stats`, `3`) : deux grands nombres (série, total) ; « Plus longue série » ; « Meilleure période » ; répartition par carnet (barres horizontales) ; par jour de semaine (7 barres CSS, `height: calc()`), pic ocre ; export + import.
- **Onboarding** (route `#/bienvenue`, auto au 1er lancement) : 3 écrans plein cadre, papier, une illustration CSS par écran (spirale, onglets, tampon), pas de carrousel auto.
- **Command palette** (modale légère) : input + liste filtrée flèches/`Enter`, `Échap` ferme ; actions = sections §3 ; « Aller à la date… » accepte `JJ/MM` ou `JJ mois`.
- **Recherche** (`/` depuis toute vue) : overlay filtrant titre+texte+tags, surlignage des occurrences (`<mark>`), `Enter` → détail.

## 5. Raccourcis clavier (tous)

`1` Aujourd'hui · `2` Archive · `3` Statistiques · `4` Année · `/` recherche · `Cmd/Ctrl+K` palette · `Cmd/Ctrl+Enter` garder · `Cmd/Ctrl+Shift+D` Encre de nuit · `←/→` mois (archive) · `↑/↓` navigation heatmap · `Échap` fermer/retour · `Tab` circule (cases, onglets carnets) · `E` exporter (stats) · `N` nouveau carnet (quand palette ouverte : « nouveau carnet »).

## 6. Couverture générative — règles conservées, adaptées tampon

1. Graine FNV-1a(`dateISO + texte`) — déterministe, inchangé. 2. Teinte = graine mod 360, sat. ~45 %, lum. 38→68 %. 3. Dégradé diagonal (angle = graine mod 90 + 30°, 2–3 stops ±24°). 4. Motif : (a) bandes horizons, (b) arcs azimut, (c) grain pointillé ; opacité inversement proportionnelle à la longueur du texte. 5. Composition plein cadre + date « 14·11 » bas-droite, alpha 0,6. 6. **Adaptation notebook** : la couverture devient « ex-libris » — fine bordure encre double ligne, léger `filter: sepia(.2)` print, et en vue détail le tampon GARDÉ s'imprime par-dessus (rotation −8°). 7. Streak ≥ 7 : fine ligne d'horizon ocre conservée, jamais de flamme. 8. Canvas toujours `role="img"` + `aria-label` daté.

## 7. Données (localStorage, zéro réseau)

- `meridien.carnets` : `[{id, nom, couleur, questionId?, rotation}]` · `meridien.questions` : banque par défaut (12 questions FR, ex. « Qu'est-ce qui compte, aujourd'hui ? », « Qu'est-ce que je remets à demain ? », « Pour quoi suis-je reconnaissant ? »…) + custom.
- `meridien.pages` : `{id, carnetId, dateISO, texte, tags[], question, seed}` · `meridien.prefs` : thème, carnet actif, onboarded · `meridien.export` : JSON `{version: 2, carnets, questions, pages, prefs}` ; import valide version + structure, fusion ou remplacement (choix utilisateur).

## 8. Défauts à éviter

- « SaaS crème » générique (Inter, dégradés violets, 3 cartes + icônes) — interdit.
- Skeuomorphisme lourd : spirale 3D photoréaliste, papier « détrempé », ombre portée partout — la suggestion suffit.
- Emojis décoratifs (✓ et ★ tolérés, rien d'autre) ; gamification anxieuse (flammes, relances rouges, points) — jamais.
- Texte corporate ou culpabilisant (« Ne cassez pas votre série ! ») — toujours la porte ouverte.
- Saturation criarde dans les couvertures ; palette sourde, print-like.
- Contrastes < 4,5:1 (sonde encre/charbon incluse), focus invisibles, canvas sans alternative.
- Toute dépendance réseau (fonts CDN, analytics, images externes pour la texture) — la texture est 100 % CSS.
- Surcharge : pas de sidebar permanente ; les onglets carnets + palette suffisent.
- Print cassé : fond sombre à l'impression, reliure noire opaque, sauts de page au milieu d'une page de journal.
- Import destructeur sans confirmation ; export sans version de schéma.
