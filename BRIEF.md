# MÉRIDIEN — Brief créatif
*Un rituel d'une question par jour. Rien de plus.*

## 1. Concept & positionnement

**Concept en une phrase :** Méridien est un journal d'intention minimaliste — chaque jour, une seule question (« Qu'est-ce qui compte, aujourd'hui ? »), quelques lignes pour répondre, une couverture générative archivée.

**À qui ça parle :** les gens qui réfléchissent trop et écrivent peu — indépendants, créatifs, personnes en surcharge silencieuse — qui veulent un point d'ancrage quotidien sans la culpabilité d'un journal raté, sans feed, sans compte, sans notifications.

**Pourquoi c'est captivant :** la contrainte (une question, un jour, une réponse) transforme l'acte d'écrire en rituel. La série de jours et la couverture générative rendent chaque réponse unique et tangible. Zéro dépendance, zéro réseau : l'outil s'efface, la question reste.

## 2. Direction artistique

**Palette**
- Encre — `#1C1A17` (texte principal, fond sombre optionnel)
- Papier — `#FAF7F2` (fond principal, blanc cassé chaud)
- Ocre — `#C8762C` (accent unique : actions, streak, focus)
- Sauge — `#8A9B7E` (validation douce, états positifs)
- Brume — `#D8D3C8` (lignes, bordures, état vide)
- Cendre — `#6E6A62` (texte secondaire)

**Typographies (système uniquement)**
- Titres & la question du jour : Georgia, « Iowan Old Style », Palatino, serif — italique pour la question.
- Corps & interface : -apple-system, BlinkMacSystemFont, « Segoe UI », Roboto, sans-serif.
- Chiffres (stats) : Georgia avec `font-variant-numeric: tabular-nums`.
- Aucun webfont, aucun CDN.

**Grille & rythme**
- Colonne centrale max 640 px, marges généreuses (min. 24 px latérales).
- Rythme vertical en multiples de 8 px ; la question occupe le tiers supérieur, la saisie le centre, le calendrier fantôme du mois en pied.
- Grille archive : 7 colonnes (lun→dim), cellules carrées, gap 8 px.

**3 principes de design**
1. *Une chose à la fois* — chaque écran a une seule hiérarchie ; rien ne concurrence la question.
2. *Le silence est une fonctionnalité* — pas de badges, pas de rouge, pas de compteurs agressifs ; le vide est beau.
3. *Le geste avant le bouton* — clavier d'abord ; chaque action visible l'est parce qu'elle est utile au doigt lent aussi.

## 3. Micro-copy française complète

- **Titre (onglet / header) :** Méridien
- **Sous-titre :** « Un journal d'intention. Une question par jour. »
- **La question :** « Qu'est-ce qui compte, aujourd'hui ? »
- **Placeholder saisie :** « Quelques lignes suffisent… »
- **Bouton principal :** « Garder cette page » (Cmd/Ctrl+Enter)
- **Lien/bouton archive :** « Archive » — stats : « Statistiques » — export : « Exporter (.json) »
- **État vide archive :** « Rien d'archivé pour l'instant. La première page est celle d'aujourd'hui. »
- **État vide stats :** « Vos statistiques apparaîtront après votre première réponse. »
- **Stats libellés :** « Jours consécutifs » / « Total de jours écrits »
- **Rappel streak 1 :** « Encore un jour, et la série continue. »
- **Rappel streak 2 :** « La série tient à une phrase. À tout à l'heure. »
- **Retour après sauvegarde :** « Noté. À demain pour la suite. »
- **Export confirmé :** « Archive exportée — méridien-export.json »
- **Réponse déjà existante (édition) :** « Vous avez déjà écrit aujourd'hui. Modifier la page ? »

## 4. Les trois vues

**Vue 1 — Aujourd'hui** (route `#/`, touche `1`)
- Contenu : date du jour en petit capitales (« SAMEDI 14 NOVEMBRE »), la question en italique serif 32–40 px, zone de saisie auto-extensible (aucune bordure, fond transparent, focus = filet ocre 2 px en bas), bouton « Garder cette page » discret.
- Comportement : saisie clavier-first, curseur posé dans la zone au chargement ; sauvegarde via Cmd/Ctrl+Enter ou bouton ; sauvegarde → micro-phrase de retour en fondu, bouton devient « Page gardée ✓ » (sans emoji récurrent : un seul ✓ toléré), date ajoutée à l'archive ; réouverture le même jour = édition.
- Raccourcis : `Cmd/Ctrl+Enter` sauvegarder · `1/2/3` changer de vue · `Échap` retirer le focus.

**Vue 2 — Archive** (`#/archive`, touche `2`)
- Contenu : grille mensuelle (mois courant par défaut, navigation ‹ mois ›), chaque jour écrit = cellule avec sa couverture générative (mini-canvas) ; jours vides = case Brume, sans texte. Légende sobre : « Chaque case est une page. »
- Comportement : clic sur une case remplie → détail (date, question, texte intégral, couverture en grand) ; `←/→` change de mois ; la case du jour est cerclée d'ocre.
- Raccourcis : `2` vue · `←/→` mois · `Échap` retour grille · `Tab` circule dans les cases.

**Vue 3 — Stats** (`#/stats`, touche `3`)
- Contenu : deux grands nombres — « Jours consécutifs » (streak courant, chiffre ocre) et « Total de jours écrits » ; sous-bloc « Plus longue série » en Cendre ; bouton « Exporter (.json) ».
- Comportement : calculé depuis localStorage à chaque affichage ; streak interrompu = affichage neutre (« 0 — la série reprend aujourd'hui »), jamais culpabilisant ; export génère un Blob JSON (date, texte, hash couverture) téléchargé en local.
- Raccourcis : `3` vue · `E` exporter · `1/2` autres vues.

## 5. Couverture générative (règles)

Chaque page génère une couverture unique, dessinée en canvas, aucun asset :
1. **Graine** = hash simple (type FNV-1a) de `dateISO + texte` — même entrée, même image, toujours.
2. **Teinte** = graine mod 360 pour le dégradé ; saturation ~45 %, luminosité 38→68 % pour garder le registre papier/encre ; accent ocre réservé aux petites séries écrites (streak ≥ 7 : fine ligne d'horizon en ocre, discret).
3. **Dégradé** = linéaire diagonal (angle = graine mod 90 + 30°), 2–3 stops dérivés de la teinte (± 24° en teinte).
4. **Motif** = un de trois archétypes choisis par `hash % 3` : (a) bandes horizontales douces façon horizon de mer ; (b) arcs concentriques façon azimut ; (c) grain pointillé dense sur dégradé. Épaisseur/opacité dérivées de la longueur du texte (texte long = motif plus calme).
5. **Composition** = dégradé plein cadre + motif en faible opacité + date en petit (« 14·11 ») en bas à droite, police système, alpha 0,6.
6. Pas de visage, pas de lettre, pas de symbole chargé de sens — c'est une couleur, pas un oracle.

## 6. Défauts à éviter

- Design générique « SaaS crème » : Inter partout, dégradés violets, ombres portées molles, trois cartes avec icônes.
- Emojis en décoration (✓ unique autorisé ; jamais 🌞 🔥 ✨ comme garniture).
- Gamification anxieuse : flammes, points, badges, relance rouge quand on rate un jour.
- Surcharge : sidebar, avatar, settings encombrés ; Méridien n'a pas de compte.
- Texte en latin de remplissage ou micro-copy corporate (« Boostez votre mindfulness ! »). Non : des phrases courtes, humaines, sans exclamation.
- Couvertures criarde : saturation max, néons — la palette reste sourde, print-like.
- Accessibilité en option : contrastes < 4,5:1, focus invisibles, canvas sans alternative texte (toujours `role="img"` + `aria-label` daté).
- Dépendance réseau déguisée : analytics, fonts distantes, CDN « pour dépanner » — interdits.
- Copies tristes : jamais « Vous avez raté votre série ». Toujours la porte ouverte.
