/* Vortex Gamer Web — mismo patrón de idiomas que la app (localStorage 'app_language',
   es/en/fr/it, con fallback a es), adaptado a una web estática sin Angular:
   - Los textos de la interfaz (menú, botones, títulos) llevan data-i18n="CLAVE".
   - El contenido específico de cada idioma (nombre, descripción, trucos...) ya viene
     pre-generado en el HTML dentro de bloques [data-lang="es|en|fr|it"]; aquí solo se
     decide cuál de esos bloques se ve. */
(function () {
  var DICTIONARY = {
    'nav.systems': { es: 'Sistemas', en: 'Systems', fr: 'Systèmes', it: 'Sistemi' },
    'nav.prices': { es: 'Precios', en: 'Prices', fr: 'Prix', it: 'Prezzi' },
    'nav.news': { es: 'Noticias', en: 'News', fr: 'Actualités', it: 'Notizie' },
    'nav.home': { es: 'Inicio', en: 'Home', fr: 'Accueil', it: 'Home' },

    'download.cta': { es: 'Descargar gratis en Google Play', en: 'Free download on Google Play', fr: 'Télécharger gratuitement sur Google Play', it: 'Scarica gratis su Google Play' },
    'download.short': { es: 'Descargar', en: 'Download', fr: 'Télécharger', it: 'Scarica' },

    'hero.tagline': { es: 'Explorador retro con más de 17.000 juegos, minijuegos arcade y guías técnicas — todo en una sola app.', en: 'A retro explorer with over 17,000 games, arcade minigames, and technical guides — all in one app.', fr: 'Un explorateur rétro avec plus de 17 000 jeux, des mini-jeux arcade et des guides techniques — le tout dans une seule application.', it: 'Un esploratore retro con oltre 17.000 giochi, minigiochi arcade e guide tecniche — tutto in un\'unica app.' },
    'hero.explore': { es: 'Explorar sistemas', en: 'Explore systems', fr: 'Explorer les systèmes', it: 'Esplora i sistemi' },
    'hero.prices': { es: 'Ver top de precios', en: 'See top prices', fr: 'Voir le top des prix', it: 'Vedi il top dei prezzi' },

    'systems.title': { es: 'Explora por sistema', en: 'Explore by system', fr: 'Explorer par système', it: 'Esplora per sistema' },
    'systems.sub': { es: 'Miles de juegos clásicos organizados por consola.', en: 'Thousands of classic games organized by console.', fr: 'Des milliers de jeux classiques organisés par console.', it: 'Migliaia di giochi classici organizzati per console.' },
    'systems.count': { es: 'juegos', en: 'games', fr: 'jeux', it: 'giochi' },

    'search.placeholder': { es: 'Buscar un juego por nombre...', en: 'Search a game by name...', fr: 'Rechercher un jeu par nom...', it: 'Cerca un gioco per nome...' },

    'prices.title': { es: 'Top 20 más caros', en: 'Top 20 most expensive', fr: 'Top 20 les plus chers', it: 'Top 20 più cari' },
    'prices.sub': { es: 'Precios de mercado de coleccionista, actualizados cada día.', en: 'Collector market prices, updated daily.', fr: "Prix du marché des collectionneurs, mis à jour chaque jour.", it: 'Prezzi di mercato da collezione, aggiornati ogni giorno.' },
    'prices.updated': { es: 'Actualizado el', en: 'Updated on', fr: 'Mis à jour le', it: 'Aggiornato il' },
    'prices.rank': { es: 'Puesto', en: 'Rank', fr: 'Rang', it: 'Posizione' },
    'prices.name': { es: 'Juego', en: 'Game', fr: 'Jeu', it: 'Gioco' },
    'prices.price': { es: 'Precio', en: 'Price', fr: 'Prix', it: 'Prezzo' },
    'prices.source': { es: 'Fuente: PriceCharting', en: 'Source: PriceCharting', fr: 'Source : PriceCharting', it: 'Fonte: PriceCharting' },
    'prices.hub.title': { es: 'Los juegos retro más caros del mercado', en: "The most expensive retro games on the market", fr: 'Les jeux rétro les plus chers du marché', it: 'I giochi retro più costosi sul mercato' },

    'news.title': { es: 'Últimas noticias de videojuegos', en: 'Latest gaming news', fr: 'Dernières actualités jeux vidéo', it: 'Ultime notizie sui videogiochi' },
    'news.sub': { es: 'Recopiladas cada día, en tu idioma.', en: 'Gathered daily, in your language.', fr: 'Rassemblées chaque jour, dans votre langue.', it: 'Raccolte ogni giorno, nella tua lingua.' },
    'news.readmore': { es: 'Leer noticia completa', en: 'Read full article', fr: "Lire l'article complet", it: "Leggi l'articolo completo" },

    'game.cheats': { es: 'Trucos', en: 'Cheats', fr: 'Astuces', it: 'Trucchi' },
    'game.tips': { es: 'Consejos', en: 'Tips', fr: 'Conseils', it: 'Consigli' },
    'game.description': { es: 'Descripción', en: 'Description', fr: 'Description', it: 'Descrizione' },
    'game.playonapp': { es: 'Consulta la ficha completa y más juegos como este en la app', en: 'See the full sheet and more games like this in the app', fr: "Consultez la fiche complète et plus de jeux comme celui-ci dans l'application", it: "Consulta la scheda completa e altri giochi come questo nell'app" },
    'game.related': { es: 'Más juegos de esta consola', en: 'More games for this console', fr: 'Plus de jeux pour cette console', it: 'Altri giochi per questa console' },

    'footer.madewith': { es: 'Catálogo generado automáticamente a partir de la base de datos de Vortex Gamer.', en: 'Catalog automatically generated from the Vortex Gamer database.', fr: 'Catalogue généré automatiquement à partir de la base de données de Vortex Gamer.', it: 'Catalogo generato automaticamente dal database di Vortex Gamer.' },

    'pagination.prev': { es: 'Anterior', en: 'Previous', fr: 'Précédent', it: 'Precedente' },
    'pagination.next': { es: 'Siguiente', en: 'Next', fr: 'Suivant', it: 'Successivo' },
  };

  var SUPPORTED = ['es', 'en', 'fr', 'it'];
  var STORAGE_KEY = 'app_language';

  function detectLang() {
    try {
      var stored = localStorage.getItem(STORAGE_KEY);
      if (stored && SUPPORTED.indexOf(stored) !== -1) return stored;
    } catch (e) { /* localStorage no disponible (modo privado, etc.) */ }
    var browser = (navigator.language || 'es').split('-')[0];
    return SUPPORTED.indexOf(browser) !== -1 ? browser : 'es';
  }

  function applyLang(lang) {
    document.documentElement.setAttribute('lang', lang);

    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      var key = el.getAttribute('data-i18n');
      var entry = DICTIONARY[key];
      if (entry && entry[lang]) el.textContent = entry[lang];
    });

    document.querySelectorAll('[data-lang]').forEach(function (el) {
      el.classList.toggle('active', el.getAttribute('data-lang') === lang);
    });

    document.querySelectorAll('.flag-button').forEach(function (btn) {
      btn.classList.toggle('active', btn.getAttribute('data-flag') === lang);
    });

    try { localStorage.setItem(STORAGE_KEY, lang); } catch (e) { /* ignorar */ }
  }

  function setLang(lang) {
    if (SUPPORTED.indexOf(lang) === -1) lang = 'es';
    applyLang(lang);
  }

  document.addEventListener('DOMContentLoaded', function () {
    applyLang(detectLang());
    document.querySelectorAll('.flag-button').forEach(function (btn) {
      btn.addEventListener('click', function () {
        setLang(btn.getAttribute('data-flag'));
      });
    });

    // Buscador en vivo dentro de listados de juegos (si la página tiene uno).
    var search = document.getElementById('game-search');
    if (search) {
      search.addEventListener('input', function () {
        var q = search.value.trim().toLowerCase();
        document.querySelectorAll('[data-search-name]').forEach(function (card) {
          var name = card.getAttribute('data-search-name');
          card.style.display = name.indexOf(q) !== -1 ? '' : 'none';
        });
      });
    }
  });

  window.VortexI18n = { setLang: setLang, DICTIONARY: DICTIONARY };
})();
