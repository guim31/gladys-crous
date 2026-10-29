# Menus du Crous — Gladys Assistant integration

The **daily menus of the Crous university restaurants and cafeterias**, all
over France, in [Gladys Assistant](https://gladysassistant.com): open today or
not, today's lunch and dinner section by section, the vegetarian dishes the
restaurant marks, a dashboard widget with today and tomorrow, a scene action
that reads the menu out, and scene triggers for a watched dish or tomorrow's
menu.

The 26 regional Crous are supported (Paris, Lyon, Toulouse, Lille, Bordeaux,
Rennes, La Réunion…). Restaurants are offered by Crous, nearest first when a
home position is given.

Developed without being a student there: feedback welcome.

## Requirements

- Gladys Assistant **5.3.0** or later.
- Internet access from the Gladys host. No account, no key.

## Installation

1. In Gladys, open **Integrations → Install from GitHub**.
2. Paste `https://github.com/guim31/gladys-crous` and install.
3. In the **Configuration** tab, tick your regional Crous (and optionally your
   home position), save, then add your restaurant from the **Discover** tab.

User documentation: [English](docs/en.md), [Français](docs/fr.md),
[Deutsch](docs/de.md), [Español](docs/es.md).

## Data source

The public feed of the Crous Mobile app,
`http://webservices-v2.crous-mobile.fr/feed/<crous>/externe/crous-<crous>.min.json`:
one file per regional Crous with its restaurants (name, position, type) and
their menus. It is the same content as the `menu.xml` feed of the same folder,
already split into meals, sections and dishes. It is served in plain HTTP only
(HTTPS answers 404), sends an ETag (the integration makes conditional
requests), and is read every 3, 6 or 12 hours.

## Limitations

- The menus are only as complete as what each restaurant publishes: some
  publish nothing, some only their prices, most only a few days ahead.
- Vegetarian dishes are only those the restaurant marks. No allergens.
- Breakfasts (cafeteria formulas) are not shown.
- The feed is undocumented and may change without notice.

## Development

```bash
npm ci
npm run format:check && npm run lint && npm test
npx -y github:GladysAssistant/integration-store --skip-image-check .
```

See [CLAUDE.md](CLAUDE.md) for the architecture and the rules of the project.

## Credits

- Data: the Crous and the CNOUS, through the Crous Mobile feed.
- Built on the official
  [integration template](https://github.com/GladysAssistant/integration-template-js)
  and [SDK](https://github.com/GladysAssistant/integration-sdk-js) of Gladys
  Assistant.
- Cover: the logo of the Crous network,
  [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Logo_Crous.svg)
  (public domain).

This integration is not affiliated with the Crous or the CNOUS.

## License

[Apache 2.0](LICENSE)
