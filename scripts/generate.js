/**
 * Generador estático de vortexgamerweb.
 *
 * Lee los datos ya existentes de la propia app (games_index.json + cheats_multilang.json,
 * bundleados en vortex-gamer-develop/src/assets/data) y los precios/noticias en vivo que la
 * app ya consume desde GitHub raw (mismo mecanismo, cero infraestructura nueva), y genera un
 * sitio HTML plano completo: ficha por juego, listados por sistema, rankings de precios y
 * noticias — todo enlazando a la ficha de Google Play.
 *
 * Re-ejecutar este script en cualquier momento regenera el sitio entero desde cero.
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const APP_DATA_DIR = 'C:/Projects/vortex-gamer-develop/src/assets/data';
const OUT_DIR = 'C:/Projects/vortexgamerweb';

// Cambia esto por la ruta final real cuando esté conectada al Worker (mismo dominio que
// menuforgeweb, otra carpeta). Se usa solo para <link rel="canonical">, og:url y sitemap.xml.
const BASE_URL = 'https://wsapps.dpdns.org/vortexgamerweb';

const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.vortex.gamer';

const GAMES_PER_PAGE = 200;

const SYSTEM_NAMES = {
  '3do': '3DO', atari2600: 'Atari 2600', atari7800: 'Atari 7800', atarijaguar: 'Atari Jaguar',
  atomiswave: 'Sammy Atomiswave', famicom: 'Famicom', fds: 'Famicom Disk System',
  gamegear: 'Sega Game Gear', gb: 'Game Boy', gba: 'Game Boy Advance', gbc: 'Game Boy Color',
  genh: 'Sega Genesis (Hacks)', gw: 'Game & Watch', mame: 'Arcade (MAME)',
  mastersystem: 'Sega Master System', megadrive: 'Sega Mega Drive', n64: 'Nintendo 64',
  naomi: 'Sega NAOMI (Arcade)', nds: 'Nintendo DS', neogeo: 'Neo Geo', nes: 'Nintendo (NES)',
  nesh: 'NES (Hacks)', ngp: 'Neo Geo Pocket', ngpc: 'Neo Geo Pocket Color',
  pcengine: 'PC Engine / TurboGrafx-16', pcfx: 'PC-FX', psx: 'PlayStation (PSX)',
  sega32x: 'Sega 32X', sfc: 'Super Famicom', 'sg-1000': 'Sega SG-1000',
  snes: 'Super Nintendo (SNES)', tg16: 'TurboGrafx-16', vectrex: 'Vectrex',
  virtualboy: 'Virtual Boy', wonderswan: 'WonderSwan', wonderswancolor: 'WonderSwan Color',
};

const LANGS = ['es', 'en', 'fr', 'it'];

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

function slugify(str) {
  return String(str)
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'juego';
}

function escapeHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function fieldByLang(obj, base) {
  const out = {};
  for (const lang of LANGS) {
    const key = lang === 'es' ? base : `${base}_${lang}`;
    let val = obj[key];
    if (val == null) val = obj[base];
    out[lang] = val;
  }
  return out;
}

function textFromDescField(val) {
  if (val == null) return '';
  if (Array.isArray(val)) return val.join(' ');
  return String(val);
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'vortexgamerweb-generator' } }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(fetchJson(res.headers.location));
      }
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      let data = '';
      res.on('data', c => (data += c));
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

function writeFile(relPath, content) {
  const full = path.join(OUT_DIR, relPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content, 'utf8');
}

// ---------------------------------------------------------------------------
// Plantillas comunes
// ---------------------------------------------------------------------------

function renderHead({ title, description, canonicalPath, image, jsonLd }) {
  const canonical = `${BASE_URL}${canonicalPath}`;
  const img = image || `${BASE_URL}/assets/logo.png`;
  return `<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}">
<link rel="canonical" href="${canonical}">
<meta property="og:type" content="website">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:image" content="${img}">
<meta property="og:url" content="${canonical}">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="${rel(canonicalPath, '/assets/favicon.png')}">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Orbitron:wght@700;800&family=Inter:wght@400;500;700&display=swap">
<link rel="stylesheet" href="${rel(canonicalPath, '/assets/style.css')}">
${jsonLd ? `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>` : ''}`;
}

// Calcula una ruta relativa desde canonicalPath (p.ej. "/sistemas/snes/") hasta un
// recurso absoluto del sitio (p.ej. "/assets/style.css"), para que el sitio funcione
// igual de bien servido desde la raíz del dominio o desde una subcarpeta (/vortexgamerweb/).
function rel(fromPath, toAbsolute) {
  const depth = fromPath.split('/').filter(Boolean).length;
  const prefix = depth > 0 ? '../'.repeat(depth) : './';
  return prefix + toAbsolute.replace(/^\//, '');
}

function renderHeader(canonicalPath) {
  const home = rel(canonicalPath, '/index.html').replace(/index\.html$/, '');
  return `<header class="site-header">
  <div class="wrap">
    <a href="${home}" style="display:flex;align-items:center;gap:10px;text-decoration:none;">
      <img src="${rel(canonicalPath, '/assets/logo.png')}" alt="Vortex Gamer">
      <span class="brand">VORTEX GAMER</span>
    </a>
    <nav>
      <a href="${rel(canonicalPath, '/sistemas/index.html')}" data-i18n="nav.systems">Sistemas</a>
      <a href="${rel(canonicalPath, '/precios/index.html')}" data-i18n="nav.prices">Precios</a>
      <a href="${rel(canonicalPath, '/noticias/index.html')}" data-i18n="nav.news">Noticias</a>
      <div class="lang-flags">
        ${LANGS.map(l => `<button class="flag-button" data-flag="${l}" aria-label="${l}"><img src="${rel(canonicalPath, '/assets/flags/' + l + '.png')}" alt="${l}"></button>`).join('\n        ')}
      </div>
    </nav>
  </div>
</header>`;
}

function renderDownloadBar() {
  return `<div class="download-bar">
  <span data-i18n="download.cta">Descargar gratis en Google Play</span>
  <a href="${PLAY_STORE_URL}" rel="noopener">▶ <span data-i18n="download.short">Descargar</span></a>
</div>`;
}

function renderFooter(canonicalPath) {
  return `<footer class="site-footer">
  <div class="wrap">
    <p data-i18n="footer.madewith">Catálogo generado automáticamente a partir de la base de datos de Vortex Gamer.</p>
    <p><a href="${PLAY_STORE_URL}" rel="noopener">Vortex Gamer — Google Play</a></p>
  </div>
</footer>
<script src="${rel(canonicalPath, '/assets/i18n.js')}"></script>`;
}

function page({ canonicalPath, title, description, image, jsonLd, body }) {
  return `<!doctype html>
<html lang="es">
<head>
${renderHead({ title, description, canonicalPath, image, jsonLd })}
</head>
<body>
${renderHeader(canonicalPath)}
${body}
${renderFooter(canonicalPath)}
${renderDownloadBar()}
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

async function main() {
  console.log('Cargando datos...');
  const games = JSON.parse(fs.readFileSync(path.join(APP_DATA_DIR, 'games_index.json'), 'utf8'));
  const cheatsRaw = JSON.parse(fs.readFileSync(path.join(APP_DATA_DIR, 'cheats_multilang.json'), 'utf8'));

  let prices = null;
  try {
    prices = await fetchJson('https://raw.githubusercontent.com/wiissdeveloper/news/main/prices.json');
    console.log('prices.json cargado, actualizado:', prices.updated);
  } catch (e) {
    console.warn('No se pudo descargar prices.json (se omite la sección de precios):', e.message);
  }

  let newsByLang = {};
  for (const lang of LANGS) {
    try {
      const data = await fetchJson(`https://raw.githubusercontent.com/wiissdeveloper/news/main/news_${lang}.json`);
      newsByLang[lang] = data.notices || [];
    } catch (e) {
      newsByLang[lang] = [];
    }
  }

  const systemIds = Object.keys(games).filter(s => games[s].length > 0);
  console.log('Sistemas con juegos:', systemIds.length);

  let totalGames = 0;
  const sitemapUrls = [];

  const addSitemap = (p, priority) => sitemapUrls.push({ loc: `${BASE_URL}${p}`, priority: priority || 0.5 });

  // ---------- Páginas de juego + listados por sistema ----------
  for (const systemId of systemIds) {
    const systemName = SYSTEM_NAMES[systemId] || systemId.toUpperCase();
    const gamesInSystem = games[systemId];
    totalGames += gamesInSystem.length;

    const gameLinks = []; // para el listado

    for (const g of gamesInSystem) {
      const slug = slugify(g.name);
      const gamePath = `/sistemas/${systemId}/${g.id}-${slug}/index.html`;
      const gameUrl = `/sistemas/${systemId}/${g.id}-${slug}/`;
      gameLinks.push({ url: gameUrl, name: g.name, image: g.image });

      const descByLang = {};
      for (const lang of LANGS) {
        descByLang[lang] = textFromDescField(g[lang === 'es' ? 'desc' : `desc_${lang}`] ?? g.desc);
      }

      const cheatEntry = cheatsRaw[g.id];
      let cheatsByLang = null, tipsByLang = null;
      if (cheatEntry) {
        cheatsByLang = fieldByLang(cheatEntry, 'cheats');
        tipsByLang = fieldByLang(cheatEntry, 'tips');
      }

      const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'VideoGame',
        name: g.name,
        image: g.image || undefined,
        gamePlatform: systemName,
        description: descByLang.es || descByLang.en || '',
      };

      const langBlocks = (renderFn) => LANGS.map(l => `<div class="lang-panel${l === 'es' ? ' active' : ''}" data-lang="${l}">${renderFn(l)}</div>`).join('\n');

      const hasCheatsOrTips = cheatsByLang && LANGS.some(l => (cheatsByLang[l] && cheatsByLang[l].length) || (tipsByLang[l] && tipsByLang[l].length));

      const body = `<main class="wrap">
  <p class="breadcrumb"><a href="../../../sistemas/index.html" data-i18n="nav.systems">Sistemas</a> / <a href="../index.html">${escapeHtml(systemName)}</a> / ${escapeHtml(g.name)}</p>
  <div class="game-header">
    ${g.image ? `<img class="cover" src="${escapeHtml(g.image)}" alt="${escapeHtml(g.name)}" loading="lazy">` : ''}
    <div class="info">
      <span class="badge">${escapeHtml(systemName)}</span>
      <h1>${escapeHtml(g.name)}</h1>
      <div class="panel-box">
        <h3 data-i18n="game.description">Descripción</h3>
        ${langBlocks(l => `<p>${escapeHtml(descByLang[l] || descByLang.es || '—')}</p>`)}
      </div>
    </div>
  </div>

  ${hasCheatsOrTips ? `<div class="panel-box">
    <h3 data-i18n="game.tips">Consejos</h3>
    ${langBlocks(l => {
      const tips = (tipsByLang && tipsByLang[l]) || [];
      const cheats = (cheatsByLang && cheatsByLang[l]) || [];
      if (!tips.length && !cheats.length) return `<p>—</p>`;
      let html = '';
      if (tips.length) html += `<ul>${tips.map(t => `<li>${escapeHtml(t)}</li>`).join('')}</ul>`;
      if (cheats.length) html += `<h3 data-i18n="game.cheats">Trucos</h3><ul>${cheats.map(t => `<li>${escapeHtml(t)}</li>`).join('')}</ul>`;
      return html;
    })}
  </div>` : ''}

  <div class="panel-box" style="text-align:center;">
    <p data-i18n="game.playonapp">Consulta la ficha completa y más juegos como este en la app</p>
    <a class="btn btn-primary" href="${PLAY_STORE_URL}" rel="noopener" data-i18n="download.cta">Descargar gratis en Google Play</a>
  </div>
</main>`;

      writeFile(gamePath, page({
        canonicalPath: gameUrl,
        title: `${g.name} — ${systemName} | Vortex Gamer`,
        description: (descByLang.es || descByLang.en || `${g.name} para ${systemName}. Ficha, trucos y consejos.`).slice(0, 155),
        image: g.image,
        jsonLd,
        body,
      }));
      addSitemap(gameUrl, 0.6);
    }

    // ---------- Listado paginado del sistema ----------
    const totalPages = Math.max(1, Math.ceil(gameLinks.length / GAMES_PER_PAGE));
    for (let p = 1; p <= totalPages; p++) {
      const slice = gameLinks.slice((p - 1) * GAMES_PER_PAGE, p * GAMES_PER_PAGE);
      const listPath = p === 1 ? `/sistemas/${systemId}/index.html` : `/sistemas/${systemId}/page/${p}/index.html`;
      const listUrl = p === 1 ? `/sistemas/${systemId}/` : `/sistemas/${systemId}/page/${p}/`;
      const depthFix = p === 1 ? '' : '../../';

      const cardsHtml = slice.map(gl => `<a class="card" href="${p === 1 ? gl.url.replace(`/sistemas/${systemId}/`, './') : '../../' + gl.url.replace(`/sistemas/${systemId}/`, '')}" data-search-name="${escapeHtml(gl.name.toLowerCase())}">
        <div class="thumb">${gl.image ? `<img src="${escapeHtml(gl.image)}" alt="${escapeHtml(gl.name)}" loading="lazy">` : ''}</div>
        <div class="body"><div class="name">${escapeHtml(gl.name)}</div></div>
      </a>`).join('\n');

      const pager = totalPages > 1 ? `<div class="pagination">
        ${p > 1 ? `<a href="${p === 2 ? '../../' : '../' + (p - 1) + '/'}" data-i18n="pagination.prev">Anterior</a>` : ''}
        ${Array.from({ length: totalPages }, (_, i) => i + 1).map(n => n === p
          ? `<span class="current">${n}</span>`
          : `<a href="${n === 1 ? (p === 1 ? '#' : '../../') : '../' + n + '/'}">${n}</a>`).join('\n        ')}
        ${p < totalPages ? `<a href="../${p + 1}/" data-i18n="pagination.next">Siguiente</a>` : ''}
      </div>` : '';

      const body = `<main class="wrap">
  <p class="breadcrumb"><a href="${p === 1 ? '../index.html' : '../../../index.html'}" data-i18n="nav.systems">Sistemas</a> / ${escapeHtml(systemName)}</p>
  <h1>${escapeHtml(systemName)}</h1>
  <p class="section-sub">${gameLinks.length} <span data-i18n="systems.count">juegos</span></p>
  <input id="game-search" class="search-box" type="search" data-i18n-placeholder="search.placeholder" placeholder="Buscar un juego por nombre...">
  <div class="grid">
    ${cardsHtml}
  </div>
  ${pager}
</main>`;

      writeFile(listPath, page({
        canonicalPath: listUrl,
        title: p === 1 ? `Juegos de ${systemName} — Vortex Gamer` : `Juegos de ${systemName} (página ${p}) — Vortex Gamer`,
        description: `Explora los ${gameLinks.length} juegos de ${systemName} disponibles en Vortex Gamer: ficha, descripción, trucos y consejos.`,
        body,
      }));
      addSitemap(listUrl, 0.7);
    }

    console.log(`  ${systemId}: ${gameLinks.length} juegos, ${totalPages} página(s)`);
  }

  // ---------- Hub de sistemas ----------
  {
    const cards = systemIds
      .sort((a, b) => games[b].length - games[a].length)
      .map(s => `<a class="system-card" href="${s}/index.html">${escapeHtml(SYSTEM_NAMES[s] || s.toUpperCase())}<span class="count">${games[s].length} <span data-i18n="systems.count">juegos</span></span></a>`)
      .join('\n');

    const body = `<main class="wrap section">
  <h1 data-i18n="systems.title">Explora por sistema</h1>
  <p class="section-sub" data-i18n="systems.sub">Miles de juegos clásicos organizados por consola.</p>
  <div class="system-grid">${cards}</div>
</main>`;

    writeFile('/sistemas/index.html', page({
      canonicalPath: '/sistemas/',
      title: `Todos los sistemas retro (${systemIds.length} consolas) — Vortex Gamer`,
      description: `Explora ${totalGames} juegos retro organizados en ${systemIds.length} sistemas clásicos: NES, SNES, Game Boy, PlayStation, Mega Drive y muchos más.`,
      body,
    }));
    addSitemap('/sistemas/', 0.9);
  }

  // ---------- Precios ----------
  if (prices && prices.systems) {
    const priceSystemIds = Object.keys(prices.systems).filter(s => prices.systems[s] && prices.systems[s].length);

    for (const systemId of priceSystemIds) {
      const systemName = SYSTEM_NAMES[systemId] || systemId.toUpperCase();
      const items = prices.systems[systemId].slice(0, 20);
      const rows = items.map(it => `<tr>
        <td class="rank">#${it.rank}</td>
        <td>${escapeHtml(it.name)}</td>
        <td class="price">$${Number(it.price_usd).toFixed(2)} / ${Number(it.price_eur).toFixed(2)}€</td>
      </tr>`).join('\n');

      const body = `<main class="wrap section">
  <p class="breadcrumb"><a href="../index.html" data-i18n="nav.prices">Precios</a> / ${escapeHtml(systemName)}</p>
  <h1>🔥 Top 20 ${escapeHtml(systemName)} <span data-i18n="prices.title"></span></h1>
  <p class="updated-note"><span data-i18n="prices.updated">Actualizado el</span> ${escapeHtml(prices.updated)} — <span data-i18n="prices.source">Fuente: PriceCharting</span></p>
  <table class="price-table">
    <thead><tr><th data-i18n="prices.rank">Puesto</th><th data-i18n="prices.name">Juego</th><th data-i18n="prices.price">Precio</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="panel-box" style="text-align:center;margin-top:24px;">
    <a class="btn btn-primary" href="${PLAY_STORE_URL}" rel="noopener" data-i18n="download.cta">Descargar gratis en Google Play</a>
  </div>
</main>`;

      writeFile(`/precios/${systemId}/index.html`, page({
        canonicalPath: `/precios/${systemId}/`,
        title: `Top 20 juegos más caros de ${systemName} (${prices.updated}) — Vortex Gamer`,
        description: `Ranking actualizado de los 20 juegos de ${systemName} más caros del mercado de coleccionista, con precios en USD y EUR.`,
        body,
      }));
      addSitemap(`/precios/${systemId}/`, 0.8);
    }

    const hubCards = priceSystemIds.map(s => `<a class="system-card" href="${s}/index.html">🔥 ${escapeHtml(SYSTEM_NAMES[s] || s.toUpperCase())}</a>`).join('\n');
    const hubBody = `<main class="wrap section">
  <h1 data-i18n="prices.hub.title">Los juegos retro más caros del mercado</h1>
  <p class="updated-note"><span data-i18n="prices.updated">Actualizado el</span> ${escapeHtml(prices.updated)}</p>
  <div class="system-grid">${hubCards}</div>
</main>`;
    writeFile('/precios/index.html', page({
      canonicalPath: '/precios/',
      title: `Top de precios de juegos retro por consola — Vortex Gamer`,
      description: `Rankings diarios de los juegos retro más caros del mercado de coleccionista, por consola: NES, SNES, PSX, Mega Drive y más.`,
      body: hubBody,
    }));
    addSitemap('/precios/', 0.9);
  }

  // ---------- Noticias ----------
  {
    const langBlocksNews = LANGS.map(l => {
      const items = (newsByLang[l] || []).slice(0, 12);
      const html = items.map(n => `<div class="news-item">
        ${n.thumbnail ? `<img src="${escapeHtml(n.thumbnail)}" alt="" loading="lazy">` : ''}
        <div>
          <h3>${escapeHtml((n.title || '').trim())}</h3>
          <p>${escapeHtml(n.contentSnippet || '')}</p>
          <a class="src" href="${escapeHtml(n.link)}" rel="noopener nofollow" target="_blank" data-i18n="news.readmore">Leer noticia completa</a>
        </div>
      </div>`).join('\n');
      return `<div class="lang-panel${l === 'es' ? ' active' : ''}" data-lang="${l}">${html || '<p>—</p>'}</div>`;
    }).join('\n');

    const body = `<main class="wrap section">
  <h1 data-i18n="news.title">Últimas noticias de videojuegos</h1>
  <p class="section-sub" data-i18n="news.sub">Recopiladas cada día, en tu idioma.</p>
  ${langBlocksNews}
  <div class="panel-box" style="text-align:center;margin-top:24px;">
    <a class="btn btn-primary" href="${PLAY_STORE_URL}" rel="noopener" data-i18n="download.cta">Descargar gratis en Google Play</a>
  </div>
</main>`;

    writeFile('/noticias/index.html', page({
      canonicalPath: '/noticias/',
      title: `Noticias de videojuegos — Vortex Gamer`,
      description: `Actualidad de videojuegos actualizada cada día, en español, inglés, francés e italiano.`,
      body,
    }));
    addSitemap('/noticias/', 0.6);
  }

  // ---------- Home ----------
  {
    const topSystems = systemIds.sort((a, b) => games[b].length - games[a].length).slice(0, 8);
    const cards = topSystems.map(s => `<a class="system-card" href="sistemas/${s}/index.html">${escapeHtml(SYSTEM_NAMES[s] || s.toUpperCase())}<span class="count">${games[s].length} <span data-i18n="systems.count">juegos</span></span></a>`).join('\n');

    const body = `<main>
  <section class="hero wrap">
    <img class="hero-logo" src="assets/logo.png" alt="Vortex Gamer">
    <h1>VORTEX GAMER</h1>
    <p class="tagline" data-i18n="hero.tagline">Explorador retro con más de 17.000 juegos, minijuegos arcade y guías técnicas — todo en una sola app.</p>
    <div class="cta-row">
      <a class="btn btn-primary" href="${PLAY_STORE_URL}" rel="noopener" data-i18n="download.cta">Descargar gratis en Google Play</a>
      <a class="btn btn-ghost" href="sistemas/index.html" data-i18n="hero.explore">Explorar sistemas</a>
      <a class="btn btn-ghost" href="precios/index.html" data-i18n="hero.prices">Ver top de precios</a>
    </div>
  </section>

  <section class="wrap section">
    <h2 class="section-title" data-i18n="systems.title">Explora por sistema</h2>
    <p class="section-sub" data-i18n="systems.sub">Miles de juegos clásicos organizados por consola.</p>
    <div class="system-grid">${cards}</div>
  </section>
</main>`;

    writeFile('/index.html', page({
      canonicalPath: '/',
      title: `Vortex Gamer — ${totalGames} juegos retro, minijuegos arcade y guías técnicas`,
      description: `Explora ${totalGames} juegos retro con ficha y trucos, juega minijuegos arcade, consulta rankings de precios y guías técnicas. Disponible gratis en Google Play.`,
      body,
    }));
    addSitemap('/', 1.0);
  }

  // ---------- sitemap.xml + robots.txt ----------
  const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapUrls.map(u => `  <url><loc>${u.loc}</loc><priority>${u.priority}</priority></url>`).join('\n')}
</urlset>`;
  writeFile('/sitemap.xml', sitemapXml);
  writeFile('/robots.txt', `User-agent: *\nAllow: /\nSitemap: ${BASE_URL}/sitemap.xml\n`);

  console.log('\n=== LISTO ===');
  console.log('Sistemas:', systemIds.length);
  console.log('Juegos totales:', totalGames);
  console.log('URLs en el sitemap:', sitemapUrls.length);
}

main().catch(e => { console.error(e); process.exit(1); });
