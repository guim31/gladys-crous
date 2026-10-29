// -----------------------------------------------------------------------------
// Texts sent from the container (feature names, states, action messages,
// widget contents, scene outputs), in the four languages of the Gladys
// interface. Entries are strings or functions of one parameter object.
// German says "du", Spanish "usted". Dish names stay as the restaurant
// wrote them, in French.
// -----------------------------------------------------------------------------

export const INIT_FAILED = {
  en: 'Initialization failed, check the integration logs.',
  fr: "L'initialisation a échoué, consultez les logs de l'intégration.",
  de: 'Initialisierung fehlgeschlagen, sieh dir die Protokolle der Integration an.',
  es: 'La inicialización ha fallado, consulte los registros de la integración.',
};

// Feature names, frozen when the device is created (configured language).
export const NAMES = {
  en: {
    open_today: 'Open today',
    lunch: 'Lunch',
    dinner: 'Dinner',
    vegetarian: 'Vegetarian dishes',
  },
  fr: {
    open_today: "Ouvert aujourd'hui",
    lunch: 'Menu du midi',
    dinner: 'Menu du soir',
    vegetarian: 'Plats végétariens',
  },
  de: {
    open_today: 'Heute geöffnet',
    lunch: 'Mittagessen',
    dinner: 'Abendessen',
    vegetarian: 'Vegetarische Gerichte',
  },
  es: {
    open_today: 'Abierto hoy',
    lunch: 'Almuerzo',
    dinner: 'Cena',
    vegetarian: 'Platos vegetarianos',
  },
};

// States, widget contents and scene outputs.
export const TEXT = {
  en: {
    lunch: 'Lunch',
    dinner: 'Dinner',
    none: '—',
    noneMarked: 'none marked',
    closed: 'Closed',
    unknown: 'Menu not communicated',
    notServed: 'Not served',
    notPublished: 'Menu not published yet',
    today: 'Today',
    tomorrow: 'Tomorrow',
    vegetarianBadge: 'Veggie',
    dayToday: 'today',
    dayTomorrow: 'tomorrow',
    sentence: ({ name, day, text }) => `${name}, ${day}. ${text}.`,
    pickRestaurant: 'Add a restaurant in the Discover tab of the integration, then pick it here.',
    gone: 'This restaurant is no longer watched.',
    hidden: ({ count }) =>
      `${count} more restaurant${count === 1 ? '' : 's'}: pick fewer in the settings`,
    noRestaurant: 'No restaurant is watched: add one in the Discover tab of the integration.',
  },
  fr: {
    lunch: 'Midi',
    dinner: 'Soir',
    none: '—',
    noneMarked: 'aucun signalé',
    closed: 'Fermé',
    unknown: 'Menu non communiqué',
    notServed: 'Pas de service',
    notPublished: 'Menu pas encore publié',
    today: "Aujourd'hui",
    tomorrow: 'Demain',
    vegetarianBadge: 'Végé',
    dayToday: "aujourd'hui",
    dayTomorrow: 'demain',
    sentence: ({ name, day, text }) => `${name}, ${day}. ${text}.`,
    pickRestaurant:
      "Ajoutez un restaurant dans l'onglet Découverte de l'intégration, puis choisissez-le ici.",
    gone: "Ce restaurant n'est plus suivi.",
    hidden: ({ count }) =>
      `${count} restaurant${count > 1 ? 's' : ''} de plus : choisissez-en moins dans les réglages`,
    noRestaurant:
      "Aucun restaurant n'est suivi : ajoutez-en un dans l'onglet Découverte de l'intégration.",
  },
  de: {
    lunch: 'Mittag',
    dinner: 'Abend',
    none: '—',
    noneMarked: 'keine gekennzeichnet',
    closed: 'Geschlossen',
    unknown: 'Menü nicht mitgeteilt',
    notServed: 'Kein Service',
    notPublished: 'Menü noch nicht veröffentlicht',
    today: 'Heute',
    tomorrow: 'Morgen',
    vegetarianBadge: 'Veggie',
    dayToday: 'heute',
    dayTomorrow: 'morgen',
    sentence: ({ name, day, text }) => `${name}, ${day}. ${text}.`,
    pickRestaurant:
      'Füge ein Restaurant im Tab „Entdecken“ der Integration hinzu und wähle es hier.',
    gone: 'Dieses Restaurant wird nicht mehr verfolgt.',
    hidden: ({ count }) =>
      `${count} weitere${count === 1 ? 's' : ''} Restaurant${count === 1 ? '' : 's'}: wähle weniger in den Einstellungen`,
    noRestaurant:
      'Kein Restaurant wird verfolgt: füge eines im Tab „Entdecken“ der Integration hinzu.',
  },
  es: {
    lunch: 'Almuerzo',
    dinner: 'Cena',
    none: '—',
    noneMarked: 'ninguno indicado',
    closed: 'Cerrado',
    unknown: 'Menú no comunicado',
    notServed: 'Sin servicio',
    notPublished: 'Menú aún no publicado',
    today: 'Hoy',
    tomorrow: 'Mañana',
    vegetarianBadge: 'Vegetariano',
    dayToday: 'hoy',
    dayTomorrow: 'mañana',
    sentence: ({ name, day, text }) => `${name}, ${day}. ${text}.`,
    pickRestaurant:
      'Añada un restaurante en la pestaña Descubrir de la integración y luego elíjalo aquí.',
    gone: 'Este restaurante ya no está vigilado.',
    hidden: ({ count }) =>
      `${count} restaurante${count === 1 ? '' : 's'} más: elija menos en los ajustes`,
    noRestaurant:
      'No se vigila ningún restaurante: añada uno en la pestaña Descubrir de la integración.',
  },
};

// Answer of the "Status" configuration action.
export const REPORTS = {
  en: {
    noSource: 'No Crous chosen: tick one or more regional Crous above, then save.',
    around: ({ km, count }) =>
      `${count} restaurant${count === 1 ? '' : 's'} offered${km ? ` within ${km} km of home` : ', nearest first'}.`,
    source: ({ name, count, menus }) =>
      `■ Crous ${name}: ${count} restaurant${count === 1 ? '' : 's'}, ${menus} with a menu`,
    read: ({ age }) => `Last reading ${age} min ago.`,
    waiting: 'Not read yet.',
    error: ({ error }) => `Last error: ${error}`,
    lastDate: ({ date }) => `Menus published until ${date}.`,
    watched: ({ count }) => `${count} restaurant${count === 1 ? '' : 's'} added to Gladys.`,
    words: ({ words }) => `Watched words: ${words}.`,
  },
  fr: {
    noSource:
      'Aucun Crous choisi : cochez un ou plusieurs Crous régionaux ci-dessus, puis enregistrez.',
    around: ({ km, count }) =>
      `${count} restaurant${count > 1 ? 's' : ''} proposé${count > 1 ? 's' : ''}${km ? ` à moins de ${km} km de la maison` : ', les plus proches en premier'}.`,
    source: ({ name, count, menus }) =>
      `■ Crous ${name} : ${count} restaurant${count > 1 ? 's' : ''}, ${menus} avec un menu`,
    read: ({ age }) => `Dernière lecture il y a ${age} min.`,
    waiting: 'Pas encore lu.',
    error: ({ error }) => `Dernière erreur : ${error}`,
    lastDate: ({ date }) => `Menus publiés jusqu'au ${date}.`,
    watched: ({ count }) =>
      `${count} restaurant${count > 1 ? 's' : ''} ajouté${count > 1 ? 's' : ''} à Gladys.`,
    words: ({ words }) => `Mots surveillés : ${words}.`,
  },
  de: {
    noSource:
      'Kein Crous gewählt: kreuze oben einen oder mehrere regionale Crous an und speichere.',
    around: ({ km, count }) =>
      `${count} Restaurant${count === 1 ? '' : 's'} angeboten${km ? `, höchstens ${km} km von zu Hause` : ', die nächsten zuerst'}.`,
    source: ({ name, count, menus }) =>
      `■ Crous ${name}: ${count} Restaurant${count === 1 ? '' : 's'}, ${menus} mit Menü`,
    read: ({ age }) => `Letzte Abfrage vor ${age} Min.`,
    waiting: 'Noch nicht abgefragt.',
    error: ({ error }) => `Letzter Fehler: ${error}`,
    lastDate: ({ date }) => `Menüs veröffentlicht bis ${date}.`,
    watched: ({ count }) => `${count} Restaurant${count === 1 ? '' : 's'} zu Gladys hinzugefügt.`,
    words: ({ words }) => `Überwachte Wörter: ${words}.`,
  },
  es: {
    noSource: 'Ningún Crous elegido: marque uno o varios Crous regionales arriba y guarde.',
    around: ({ km, count }) =>
      `${count} restaurante${count === 1 ? '' : 's'} propuesto${count === 1 ? '' : 's'}${km ? ` a menos de ${km} km de casa` : ', los más cercanos primero'}.`,
    source: ({ name, count, menus }) =>
      `■ Crous ${name}: ${count} restaurante${count === 1 ? '' : 's'}, ${menus} con menú`,
    read: ({ age }) => `Última lectura hace ${age} min.`,
    waiting: 'Aún no leído.',
    error: ({ error }) => `Último error: ${error}`,
    lastDate: ({ date }) => `Menús publicados hasta el ${date}.`,
    watched: ({ count }) =>
      `${count} restaurante${count === 1 ? '' : 's'} añadido${count === 1 ? '' : 's'} a Gladys.`,
    words: ({ words }) => `Palabras vigiladas: ${words}.`,
  },
};

/** One text of a table, in a language (English when missing). */
export function say(table, language, key, params = {}) {
  const entry = table[language]?.[key] ?? table.en[key];
  return typeof entry === 'function' ? entry(params) : entry;
}

/** The same text in every language of the table: `{ en, fr, de, es }`. */
export function render(table, key, params = {}) {
  return Object.fromEntries(
    Object.keys(table).map((language) => [language, say(table, language, key, params)]),
  );
}

/** Joins rendered messages (or plain strings), language by language, one per line. */
export function lines(...messages) {
  const languages = Object.keys(messages.find((m) => typeof m === 'object' && m) ?? { en: '' });
  return Object.fromEntries(
    languages.map((language) => [
      language,
      messages
        .filter((message) => message !== null && message !== undefined)
        .map((message) => (typeof message === 'string' ? message : message[language]))
        .join('\n'),
    ]),
  );
}
