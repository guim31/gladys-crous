# Menus du Crous

The daily menu of the Crous university restaurants and cafeterias in Gladys,
all over France: open today or not, today's lunch and dinner section by
section, the vegetarian dishes the restaurant marks, a dashboard widget with
today and tomorrow, a scene action that reads the menu out, and triggers for
a dish you watch for ("frites!") or tomorrow's menu.

The menus come from the public feed of the Crous Mobile app: no account, no
key. This integration is not affiliated with the Crous or the CNOUS.

## What you get

- One device per restaurant or cafeteria you add, chosen in your regional
  Crous (26 Crous, from Paris to La Réunion), nearest first if you give your
  home position.
- An "Open today" feature and text features with **today's** lunch, dinner
  and vegetarian dishes, updated a few minutes after midnight.
- A dashboard widget with today's and tomorrow's menus.
- A scene action "Get the Crous menu" and two scene triggers.

## Requirements

- Gladys Assistant 5.3.0 or later.
- Internet access from the Gladys host (the feed is on the internet).

## Installation

1. In Gladys, open **Integrations → Install from GitHub**.
2. Paste `https://github.com/guim31/gladys-crous` and install.
3. Open the integration's **Configuration** tab.

## Configuration

### Settings

- **Regional Crous**: tick the Crous of your university town (Toulouse
  Occitanie, Paris, Lyon…).
- **Home position** (optional): latitude and longitude, for example
  `43.6045, 1.4440` (right-click on a map gives them). The restaurants are
  then offered nearest first.
- **Restaurants offered**: all those of the Crous ticked, or only those within
  2, 5, 10 or 25 km of the home position.
- **Watched words**: words to look for in the dishes, separated by commas
  (`frites, pizza, couscous`: the dishes are in French), for the "Watched
  dish on the menu" trigger. Accents and case do not matter; a word matches
  the start of a word (`frite` finds "Frites", `riz` does not find
  "Chorizo").
- **Refresh**: how often the feeds are read (every 3, 6 or 12 hours).
- **Language of names and messages**: the language of the feature names, the
  states and the scene sentences. Feature names are fixed when a device is
  added.

### Adding restaurants

Save the configuration: the restaurants appear in the **Discover** tab. Add
yours to Gladys, rename it as you like: the widget and the scene sentences
use that name.

### Checking

The **Status** action of the Configuration tab lists, per Crous, the
restaurants found and how many have a menu, the time of the last reading, the
last day published and the last error.

## Devices

| Feature           | Content                                                                                |
| ----------------- | -------------------------------------------------------------------------------------- |
| Open today        | 1 when a menu is published for today (lunch or dinner), 0 otherwise                    |
| Lunch             | today's lunch, section by section ("Plat: … · Pâtes / pizzas: …")                      |
| Dinner            | today's dinner, for the few restaurants that serve one                                 |
| Vegetarian dishes | the dishes marked vegetarian by the restaurant ("Veg …", a "Plat végétarien" section…) |

When there is no menu, the text says why: **Closed** (the Crous publishes a
closure: holidays, public holiday), **Menu not communicated** (open, but no
menu given, or only the prices), **Not served** (nothing published that day,
or no dinner), **Menu not published yet** (after the last day published).
Dish names stay as the restaurants write them, in French. Breakfasts are not
shown.

## Dashboard widget

**Crous menus**: one row per restaurant and day (today, tomorrow), with the
first dishes and a "Veggie" badge when a vegetarian dish is marked. Tap a row
for the whole menu, lunch and dinner. Settings: the restaurants shown (empty:
all of them, four with tomorrow, eight without), show tomorrow, show the
dinner.

## Scene triggers

- **Watched dish on the menu**: a lunch or dinner dish of a watched
  restaurant contains one of the watched words, today (fired between 7:00 and
  10:00) or tomorrow (between 17:00 and 22:00). The optional **Word** filter
  compares exactly: write it in lower case, as in the configuration.
- **Tomorrow's menu published**: a watched restaurant has a menu for
  tomorrow, checked between 17:00 and 22:00 (not for a closure).

Both pass on the restaurant name, the date and the menu; the first also the
meal, the word and the dish found. Each event fires once per restaurant, day,
meal and word, even if the integration restarts in the window.

## Scene action

**Get the Crous menu** answers with a sentence ready for a message or a
speaker: "Resto U' Arsenal, today. Lunch: Plat: Steak de poulet…". Fields: the
restaurant (empty: every watched restaurant), the day (empty: today) and the
meal (empty: lunch, and dinner when served). Outputs: the sentence and
`has_menu` (1 when a menu is published), for a "Continue only if" step.

## Scene examples

- At 11:00 on weekdays: "Get the Crous menu" for lunch, then send the
  sentence to your phone.
- "Watched dish on the menu", day today, word `frites`: a notification.
- "Tomorrow's menu published": a message with the menu of tomorrow.

## Data and refresh

The feed is the one of the Crous Mobile app,
`http://webservices-v2.crous-mobile.fr/feed/<crous>/externe/`, one file per
regional Crous (from 8 KB to 3 MB for Paris). It is only served in plain HTTP
(public data, nothing is sent). One request per Crous at each refresh,
conditional: an unchanged file is not downloaded again. The menus are
published from a few days to a few weeks ahead, depending on the restaurant.
Today's states are recomputed every 10 minutes, so the new day shows within
ten minutes of midnight (Paris time).

## Troubleshooting

- **My restaurant is not in the Discover tab**: tick its Crous and save;
  with a home position, widen the distance.
- **"Not served" or "Menu not published yet"**: the restaurant has not
  published that day; many publish only a few days ahead, and some never do.
  The Status action shows the last day published.
- **A trigger does not fire**: check the time windows, the word filter in
  lower case, and that the restaurant is added to Gladys.
- Logs: `docker logs` of the integration container, `LOG_LEVEL=debug` for
  each reading.

## Limitations

- The menus are only as complete as what each restaurant publishes: some
  publish nothing, some only their prices.
- The vegetarian dishes are those the restaurant marks; an unmarked one is
  not found. No allergens: the feed does not give them.
- The feed is not documented: the Crous may change it without notice.
- Developed without being a student there: feedback welcome.

## Credits

Data: the Crous and the CNOUS, through the Crous Mobile feed. Integration by
guim31, Apache 2.0.
