# Menus du Crous

Le menu du jour des restaurants universitaires et cafétérias du Crous dans
Gladys, partout en France : ouvert aujourd'hui ou non, le midi et le soir
rubrique par rubrique, les plats végétariens signalés par le restaurant, un
widget avec aujourd'hui et demain, une action de scène qui lit le menu, et
des déclencheurs pour un plat surveillé (« frites ! ») ou le menu du
lendemain.

Les menus viennent du flux public de l'application Crous Mobile : sans compte
ni clé. Cette intégration n'est pas affiliée aux Crous ni au CNOUS.

## Ce que vous obtenez

- Un appareil par restaurant ou cafétéria ajouté, choisi dans votre Crous
  régional (26 Crous, de Paris à La Réunion), les plus proches en premier si
  vous donnez la position de la maison.
- Une fonctionnalité « Ouvert aujourd'hui » et des textes avec le menu du
  midi, du soir et les plats végétariens **du jour**, mis à jour quelques
  minutes après minuit.
- Un widget avec les menus du jour et de demain.
- Une action de scène « Obtenir le menu du Crous » et deux déclencheurs.

## Prérequis

- Gladys Assistant 5.3.0 ou plus récent.
- Un accès à Internet depuis la machine de Gladys (le flux est en ligne).

## Installation

1. Dans Gladys, ouvrez **Intégrations → Installer depuis GitHub**.
2. Collez `https://github.com/guim31/gladys-crous` et installez.
3. Ouvrez l'onglet **Configuration** de l'intégration.

## Configuration

### Réglages

- **Crous régionaux** : cochez le Crous de votre ville universitaire
  (Toulouse Occitanie, Paris, Lyon…).
- **Position de la maison** (facultatif) : latitude et longitude, par exemple
  `43.6045, 1.4440` (un clic droit sur une carte les donne). Les restaurants
  sont alors proposés du plus proche au plus loin.
- **Restaurants proposés** : tous ceux des Crous cochés, ou seulement ceux à
  moins de 2, 5, 10 ou 25 km de la maison.
- **Mots surveillés** : mots à chercher dans les plats, séparés par des
  virgules (`frites, pizza, couscous`), pour le déclencheur « Plat surveillé
  au menu ». Accents et majuscules ne comptent pas ; un mot correspond au
  début d'un mot (`frite` trouve « Frites », `riz` ne trouve pas « Chorizo »).
- **Rafraîchissement** : fréquence de lecture des flux (toutes les 3, 6 ou
  12 heures).
- **Langue des noms et messages** : langue des noms de fonctionnalités, des
  états et des phrases de scène. Les noms sont figés à l'ajout de l'appareil.

### Ajouter des restaurants

Enregistrez la configuration : les restaurants apparaissent dans l'onglet
**Découverte**. Ajoutez le vôtre à Gladys et renommez-le à votre goût : le
widget et les phrases de scène utilisent ce nom.

### Vérifier

L'action **État** de l'onglet Configuration liste, par Crous, les
restaurants trouvés et combien ont un menu, l'heure de la dernière lecture,
le dernier jour publié et la dernière erreur.

## Appareils

| Fonctionnalité     | Contenu                                                                                     |
| ------------------ | ------------------------------------------------------------------------------------------- |
| Ouvert aujourd'hui | 1 quand un menu est publié pour aujourd'hui (midi ou soir), 0 sinon                         |
| Menu du midi       | le midi du jour, rubrique par rubrique (« Plat : … · Pâtes / pizzas : … »)                  |
| Menu du soir       | le soir du jour, pour les quelques restaurants qui en servent un                            |
| Plats végétariens  | les plats signalés végétariens par le restaurant (« Veg … », rubrique « Plat végétarien »…) |

Sans menu, le texte dit pourquoi : **Fermé** (le Crous publie une fermeture :
vacances, jour férié), **Menu non communiqué** (ouvert, mais sans menu, ou
seulement les tarifs), **Pas de service** (rien de publié ce jour-là, ou pas
de service le soir), **Menu pas encore publié** (après le dernier jour
publié). Les plats restent tels que les restaurants les écrivent. Les petits
déjeuners ne sont pas repris.

## Widget du tableau de bord

**Menus du Crous** : une ligne par restaurant et par jour (aujourd'hui,
demain), avec les premiers plats et un badge « Végé » quand un plat
végétarien est signalé. Touchez une ligne pour le menu complet, midi et soir.
Réglages : restaurants affichés (vide : tous, quatre avec demain, huit sans),
afficher demain, afficher le soir.

## Déclencheurs de scène

- **Plat surveillé au menu** : un plat du midi ou du soir d'un restaurant
  suivi contient un des mots surveillés, aujourd'hui (envoyé entre 7 h et
  10 h) ou demain (entre 17 h et 22 h). Le filtre facultatif **Mot** compare
  exactement : écrivez-le en minuscules, comme dans la configuration.
- **Menu du lendemain publié** : un restaurant suivi a un menu pour demain,
  vérifié entre 17 h et 22 h (pas pour une fermeture).

Les deux transmettent le nom du restaurant, la date et le menu ; le premier
aussi le repas, le mot et le plat trouvé. Chaque événement part une fois par
restaurant, jour, repas et mot, même si l'intégration redémarre dans le
créneau.

## Action de scène

**Obtenir le menu du Crous** répond par une phrase prête pour un message ou
une enceinte : « Resto U' Arsenal, aujourd'hui. Midi : Plat : Steak de
poulet… ». Champs : le restaurant (vide : tous les restaurants suivis), le
jour (vide : aujourd'hui) et le repas (vide : le midi, et le soir s'il est
servi). Sorties : la phrase et `has_menu` (1 quand un menu est publié), pour
une étape « Continuer seulement si ».

## Exemples de scènes

- À 11 h en semaine : « Obtenir le menu du Crous » pour le midi, puis envoyer
  la phrase sur votre téléphone.
- « Plat surveillé au menu », jour aujourd'hui, mot `frites` : une
  notification.
- « Menu du lendemain publié » : un message avec le menu de demain.

## Données et rafraîchissement

Le flux est celui de l'application Crous Mobile,
`http://webservices-v2.crous-mobile.fr/feed/<crous>/externe/`, un fichier par
Crous régional (de 8 Ko à 3 Mo pour Paris). Il n'est servi qu'en HTTP simple
(données publiques, rien n'est envoyé). Une requête par Crous à chaque
rafraîchissement, conditionnelle : un fichier inchangé n'est pas
retéléchargé. Les menus sont publiés de quelques jours à quelques semaines à
l'avance selon le restaurant. Les états du jour sont recalculés toutes les
10 minutes : le nouveau jour s'affiche dans les dix minutes après minuit
(heure de Paris).

## Dépannage

- **Mon restaurant n'est pas dans la Découverte** : cochez son Crous et
  enregistrez ; avec une position, élargissez la distance.
- **« Pas de service » ou « Menu pas encore publié »** : le restaurant n'a
  rien publié pour ce jour ; beaucoup ne publient que quelques jours à
  l'avance, certains jamais. L'action État donne le dernier jour publié.
- **Un déclencheur ne part pas** : vérifiez les créneaux, le filtre de mot en
  minuscules, et que le restaurant est ajouté à Gladys.
- Logs : `docker logs` du conteneur de l'intégration, `LOG_LEVEL=debug` pour
  chaque lecture.

## Limites

- Les menus ne sont pas plus complets que ce que publie chaque restaurant :
  certains ne publient rien, d'autres seulement leurs tarifs.
- Les plats végétariens sont ceux que le restaurant signale ; un plat non
  signalé n'est pas repéré. Pas d'allergènes : le flux ne les donne pas.
- Le flux n'est pas documenté : le Crous peut le changer sans prévenir.
- Développée sans être étudiant sur place : vos retours sont les bienvenus.

## Crédits

Données : les Crous et le CNOUS, via le flux de Crous Mobile. Intégration par
guim31, Apache 2.0.
