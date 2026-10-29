# Menus du Crous

Das Tagesmenü der Mensen und Cafeterien der Crous (französische
Studierendenwerke) in Gladys, in ganz Frankreich: heute geöffnet oder nicht,
Mittag- und Abendessen nach Rubriken, die vom Restaurant gekennzeichneten
vegetarischen Gerichte, ein Dashboard-Widget mit heute und morgen, eine
Szenen-Aktion, die das Menü vorliest, und Auslöser für ein überwachtes
Gericht („frites!“) oder das Menü von morgen.

Die Menüs stammen aus dem öffentlichen Feed der App Crous Mobile: kein Konto,
kein Schlüssel. Diese Integration ist nicht mit den Crous oder dem CNOUS
verbunden.

## Was du bekommst

- Ein Gerät pro hinzugefügtem Restaurant oder Cafeteria, gewählt in deinem
  regionalen Crous (26 Crous, von Paris bis La Réunion), die nächsten zuerst,
  wenn du die Position deines Zuhauses angibst.
- Eine Funktion „Heute geöffnet“ und Textfunktionen mit dem **heutigen**
  Mittagessen, Abendessen und den vegetarischen Gerichten, aktualisiert
  wenige Minuten nach Mitternacht.
- Ein Dashboard-Widget mit den Menüs von heute und morgen.
- Eine Szenen-Aktion „Crous-Menü abrufen“ und zwei Szenen-Auslöser.

## Voraussetzungen

- Gladys Assistant 5.3.0 oder neuer.
- Internetzugang vom Gladys-Host (der Feed liegt im Internet).

## Installation

1. Öffne in Gladys **Integrationen → Von GitHub installieren**.
2. Füge `https://github.com/guim31/gladys-crous` ein und installiere.
3. Öffne den Tab **Konfiguration** der Integration.

## Konfiguration

### Einstellungen

- **Regionale Crous**: kreuze den Crous deiner Universitätsstadt an
  (Toulouse Occitanie, Paris, Lyon…).
- **Position des Zuhauses** (optional): Breiten- und Längengrad, zum Beispiel
  `43.6045, 1.4440` (ein Rechtsklick auf eine Karte liefert sie). Die
  Restaurants werden dann nach Entfernung angeboten.
- **Angebotene Restaurants**: alle der angekreuzten Crous oder nur die im
  Umkreis von 2, 5, 10 oder 25 km um dein Zuhause.
- **Überwachte Wörter**: Wörter, die in den Gerichten gesucht werden, durch
  Kommas getrennt (`frites, pizza, couscous`: die Gerichte sind französisch),
  für den Auslöser „Überwachtes Gericht im Menü“. Akzente und Groß-/
  Kleinschreibung spielen keine Rolle; ein Wort passt auf den Anfang eines
  Wortes (`frite` findet „Frites“, `riz` findet nicht „Chorizo“).
- **Aktualisierung**: wie oft die Feeds gelesen werden (alle 3, 6 oder
  12 Stunden).
- **Sprache der Namen und Nachrichten**: Sprache der Funktionsnamen, der
  Zustände und der Szenen-Sätze. Die Namen werden beim Hinzufügen eines
  Geräts festgelegt.

### Restaurants hinzufügen

Speichere die Konfiguration: die Restaurants erscheinen im Tab
**Entdecken**. Füge deines zu Gladys hinzu und benenne es nach Wunsch um: das
Widget und die Szenen-Sätze verwenden diesen Namen.

### Prüfen

Die Aktion **Status** im Tab Konfiguration zeigt pro Crous die gefundenen
Restaurants und wie viele ein Menü haben, die Zeit der letzten Abfrage, den
letzten veröffentlichten Tag und den letzten Fehler.

## Geräte

| Funktion              | Inhalt                                                                                            |
| --------------------- | ------------------------------------------------------------------------------------------------- |
| Heute geöffnet        | 1, wenn für heute ein Menü veröffentlicht ist (Mittag oder Abend), sonst 0                        |
| Mittagessen           | das heutige Mittagessen nach Rubriken („Plat: … · Pâtes / pizzas: …“)                             |
| Abendessen            | das heutige Abendessen, für die wenigen Restaurants, die eines anbieten                           |
| Vegetarische Gerichte | die vom Restaurant als vegetarisch gekennzeichneten Gerichte („Veg …“, Rubrik „Plat végétarien“…) |

Ohne Menü sagt der Text, warum: **Geschlossen** (der Crous veröffentlicht
eine Schließung: Ferien, Feiertag), **Menü nicht mitgeteilt** (geöffnet, aber
ohne Menü oder nur mit Preisen), **Kein Service** (an diesem Tag nichts
veröffentlicht, oder kein Abendessen), **Menü noch nicht veröffentlicht**
(nach dem letzten veröffentlichten Tag). Die Gerichte bleiben so, wie die
Restaurants sie schreiben, auf Französisch. Frühstücke werden nicht gezeigt.

## Dashboard-Widget

**Crous-Menüs**: eine Zeile pro Restaurant und Tag (heute, morgen), mit den
ersten Gerichten und einem „Veggie“-Badge, wenn ein vegetarisches Gericht
gekennzeichnet ist. Tippe eine Zeile für das ganze Menü an, Mittag und Abend.
Einstellungen: angezeigte Restaurants (leer: alle, vier mit morgen, acht
ohne), morgen anzeigen, Abendessen anzeigen.

## Szenen-Auslöser

- **Überwachtes Gericht im Menü**: ein Gericht am Mittag oder Abend eines
  verfolgten Restaurants enthält eines der überwachten Wörter, heute
  (ausgelöst zwischen 7 und 10 Uhr) oder morgen (zwischen 17 und 22 Uhr). Der
  optionale Filter **Wort** vergleicht genau: schreibe es klein, wie in der
  Konfiguration.
- **Menü von morgen veröffentlicht**: ein verfolgtes Restaurant hat ein Menü
  für morgen, geprüft zwischen 17 und 22 Uhr (nicht bei einer Schließung).

Beide übergeben den Namen des Restaurants, das Datum und das Menü; der erste
auch die Mahlzeit, das Wort und das gefundene Gericht. Jedes Ereignis wird
einmal pro Restaurant, Tag, Mahlzeit und Wort ausgelöst, auch wenn die
Integration im Zeitfenster neu startet.

## Szenen-Aktion

**Crous-Menü abrufen** antwortet mit einem Satz, fertig für eine Nachricht
oder einen Lautsprecher: „Resto U' Arsenal, heute. Mittag: Plat: Steak de
poulet…“. Felder: das Restaurant (leer: alle verfolgten Restaurants), der Tag
(leer: heute) und die Mahlzeit (leer: Mittag, und Abend, wenn serviert).
Ausgaben: der Satz und `has_menu` (1, wenn ein Menü veröffentlicht ist), für
einen Schritt „Nur fortfahren, wenn“.

## Szenen-Beispiele

- Werktags um 11 Uhr: „Crous-Menü abrufen“ für mittags, dann den Satz an dein
  Telefon senden.
- „Überwachtes Gericht im Menü“, Tag heute, Wort `frites`: eine
  Benachrichtigung.
- „Menü von morgen veröffentlicht“: eine Nachricht mit dem Menü von morgen.

## Daten und Aktualisierung

Der Feed ist der der App Crous Mobile,
`http://webservices-v2.crous-mobile.fr/feed/<crous>/externe/`, eine Datei pro
regionalem Crous (von 8 KB bis 3 MB für Paris). Er wird nur über einfaches
HTTP ausgeliefert (öffentliche Daten, es wird nichts gesendet). Eine Anfrage
pro Crous bei jeder Aktualisierung, bedingt: eine unveränderte Datei wird
nicht erneut geladen. Die Menüs werden je nach Restaurant einige Tage bis
einige Wochen im Voraus veröffentlicht. Die heutigen Zustände werden alle
10 Minuten neu berechnet: der neue Tag erscheint innerhalb von zehn Minuten
nach Mitternacht (Pariser Zeit).

## Fehlerbehebung

- **Mein Restaurant ist nicht im Tab „Entdecken“**: kreuze seinen Crous an
  und speichere; mit einer Position vergrößere die Entfernung.
- **„Kein Service“ oder „Menü noch nicht veröffentlicht“**: das Restaurant
  hat für diesen Tag nichts veröffentlicht; viele veröffentlichen nur wenige
  Tage im Voraus, manche nie. Die Aktion Status zeigt den letzten
  veröffentlichten Tag.
- **Ein Auslöser löst nicht aus**: prüfe die Zeitfenster, den Wortfilter in
  Kleinbuchstaben und ob das Restaurant zu Gladys hinzugefügt ist.
- Protokolle: `docker logs` des Integrations-Containers, `LOG_LEVEL=debug`
  für jede Abfrage.

## Einschränkungen

- Die Menüs sind nur so vollständig wie das, was jedes Restaurant
  veröffentlicht: manche veröffentlichen nichts, manche nur ihre Preise.
- Vegetarische Gerichte sind die, die das Restaurant kennzeichnet; ein nicht
  gekennzeichnetes wird nicht erkannt. Keine Allergene: der Feed liefert sie
  nicht.
- Der Feed ist nicht dokumentiert: der Crous kann ihn ohne Vorwarnung ändern.
- Entwickelt, ohne dort zu studieren: Rückmeldungen sind willkommen.

## Danksagung

Daten: die Crous und der CNOUS, über den Feed von Crous Mobile. Integration
von guim31, Apache 2.0.
