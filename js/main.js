// LorcanaPrint – logica principale del sito (catalogo, lista, PDF)
// ---- State ----
let ALL_CARDS = [];
let FILTERED = [];
const BASKET = new Map(); // key: card.id, value: {card, qty}

// Utility: debounce
function debounce(fn, ms){ let t; return (...args)=>{ clearTimeout(t); t=setTimeout(()=>fn(...args), ms); } }

// Su mobile usiamo la qualità "normal" (media) invece di "small": display retina più nitidi.
const MOBILE_MQ = window.matchMedia('(max-width: 720px)');
function thumbUrl(card){
  return MOBILE_MQ.matches ? (card.__normal || card.__small) : card.__small;
}

function renderSkeletons(n = 12){
  const wrap = document.getElementById('cardsList');
  wrap.innerHTML = '';
  const frag = document.createDocumentFragment();
  for(let i=0;i<n;i++){
    const s = document.createElement('div');
    s.className = 'skeleton';
    frag.appendChild(s);
  }
  wrap.appendChild(frag);
}

// ---- Data Loading (provided snippet adapted) ----
async function loadData() {
  renderSkeletons();
  try {
    const setsResponse = await fetch('https://api.lorcast.com/v0/sets', { headers: { 'Accept': 'application/json' } });
    if (!setsResponse.ok) throw new Error(`Errore HTTP ${setsResponse.status}`);
    const setsData = await setsResponse.json();
    let sets = (setsData.results || []).filter(s => /^(?:13|12|11|10|9|8|7|6|5|4|3|2|1)$/.test(String(s.code)));
    // Order 13 -> 1
    sets.sort((a,b)=> Number(b.code) - Number(a.code));

    const cardsPromises = sets.map(set =>
      fetch(`https://api.lorcast.com/v0/sets/${set.code}/cards`, { headers: { 'Accept': 'application/json' } })
        .then(res => { if (!res.ok) throw new Error(`Errore caricamento set ${set.code}`); return res.json(); })
        .catch(err => { console.warn('Errore singolo set:', set.code, err); return []; })
    );

    const cardsArrays = await Promise.all(cardsPromises);
    const allCards = cardsArrays.flat();

    // Annotate missing fields, ensure image urls
    ALL_CARDS = allCards
      .filter(c => c && c.image_uris && c.image_uris.digital && c.image_uris.digital.small && c.image_uris.digital.large)
      .map(c => ({
        ...c,
        __setCode: c.set?.code ? String(c.set.code) : '',
        __setName: c.set?.name || '',
        __small: c.image_uris.digital.small,
        __normal: c.image_uris.digital.normal || c.image_uris.digital.small,
        __large: c.image_uris.digital.large,
        __full: c.image_uris.digital.full || '',
        __search: [c.name, c.version, c.text, c.classifications?.join(' '), c.type?.join(' '), c.set?.name].filter(Boolean).join(' ').toLowerCase()
      }))
      // Sort by set desc (13->1), then by collector_number asc (numeric-ish)
      .sort((a,b)=> Number(b.__setCode||0) - Number(a.__setCode||0) || (parseInt(a.collector_number) || 0) - (parseInt(b.collector_number) || 0));

    console.log(`✅ Caricate ${ALL_CARDS.length} carte totali.`);
    displayCards(ALL_CARDS);
  } catch (error) {
    console.error('❌ Errore nel caricamento dei dati:', error);
    document.getElementById('cardsList').innerHTML = '<div class="empty-state"><p>Errore nel caricamento delle carte</p></div>';
  }
}

// ---- Rendering ----
function displayCards(cards){
  FILTERED = cards;
  const wrap = document.getElementById('cardsList');
  const count = document.getElementById('resultCount');
  wrap.innerHTML = '';
  count.textContent = `${cards.length} risultati`;
  const frag = document.createDocumentFragment();
  if(cards.length === 0){
    wrap.innerHTML = '<div class="empty-state">Nessun risultato.<br><span style="font-size:12px;opacity:.7">Prova a modificare i filtri.</span></div>';
    return;
  }
  cards.forEach(card => {
    const el = document.createElement('article');
    el.className = 'card';
    el.dataset.cardId = card.id;
    const inBasketQty = BASKET.get(card.id)?.qty || 0;
    const inkName = card.ink || '';
    const inkDot = inkName ? `<span class="ink-dot ink-${escapeHtml(inkName)}" title="${escapeHtml(inkName)}"></span>` : '';
    el.innerHTML = `
      ${inBasketQty ? `<span class="basket-badge" data-badge>×${inBasketQty}</span>` : ''}
      <img src="${thumbUrl(card)}" alt="${escapeHtml(card.name)}" loading="lazy"/>
      <div class="meta">
        <div class="title">${escapeHtml(card.name)}${card.version?` — ${escapeHtml(card.version)}`:''}</div>
        <div class="sub">${inkDot}<span>${escapeHtml(inkName || 'No Ink')} • Cost ${card.cost ?? '-'} • Set ${card.__setCode}</span></div>
        <div class="tags">
          ${card.type?.map(t=>`<span class="tag">${escapeHtml(t)}</span>`).join('')||''}
        </div>
        <button class="add">Aggiungi</button>
      </div>`;
    if(inBasketQty) el.classList.add('in-basket');
    const addBtn = el.querySelector('button.add');
    addBtn.addEventListener('click', ()=> {
      addToBasket(card);
      addBtn.classList.remove('added');
      void addBtn.offsetWidth;
      addBtn.classList.add('added');
      addBtn.textContent = 'Aggiunto ✓';
      clearTimeout(addBtn._t);
      addBtn._t = setTimeout(()=>{ addBtn.classList.remove('added'); addBtn.textContent = 'Aggiungi'; }, 900);
    });
    frag.appendChild(el);
  });
  wrap.appendChild(frag);
}

function updateCatalogBadges(){
  document.querySelectorAll('.card[data-card-id]').forEach(el => {
    const id = el.dataset.cardId;
    const qty = BASKET.get(id)?.qty || 0;
    const existing = el.querySelector('[data-badge]');
    if(qty > 0){
      el.classList.add('in-basket');
      if(existing) existing.textContent = `×${qty}`;
      else {
        const b = document.createElement('span');
        b.className = 'basket-badge';
        b.dataset.badge = '';
        b.textContent = `×${qty}`;
        el.appendChild(b);
      }
    } else {
      el.classList.remove('in-basket');
      existing?.remove();
    }
  });
}

// PDF grid: 9 carte per pagina A4 (3 col × 3 righe alle dimensioni reali)
const PDF_PER_PAGE = 9;

function refreshSelectionViews(){
  const selList = document.getElementById('selList');
  const modalSel = document.getElementById('modalSelList');
  const countSel = document.getElementById('countSel');
  const fab = document.getElementById('openBasket');
  const clearBtn = document.getElementById('clearBasket');
  const pdfBtn = document.getElementById('makePdfBtn');
  const pdfHint = document.getElementById('pdfHint');

  const items = Array.from(BASKET.values());
  const totalQty = items.reduce((a,b)=>a+b.qty,0);
  const pages = Math.max(1, Math.ceil(totalQty / PDF_PER_PAGE));

  countSel.textContent = totalQty === 1 ? '1 carta' : `${totalQty} carte`;
  fab.textContent = `Lista (${totalQty})`;
  clearBtn.style.display = items.length ? '' : 'none';
  pdfBtn.disabled = items.length === 0;
  pdfHint.textContent = items.length === 0
    ? 'Aggiungi almeno una carta'
    : `${totalQty} ${totalQty===1?'carta':'carte'} • ~${pages} ${pages===1?'pagina':'pagine'} A4`;

  function renderInto(container){
    container.innerHTML='';
    if(items.length===0){
      container.innerHTML = '<div class="empty-state">Nessuna carta nella lista.<br><span style="font-size:12px;opacity:.7">Aggiungi carte dal catalogo a sinistra.</span></div>';
      return;
    }
    items.forEach(entry=>{
      const {card, qty} = entry;
      const row = document.createElement('div');
      row.className = 'item';
      const inkName = card.ink || '';
      const inkDot = inkName ? `<span class="ink-dot ink-${escapeHtml(inkName)}"></span>` : '';
      row.innerHTML = `
        <img src="${thumbUrl(card)}" alt="${escapeHtml(card.name)}"/>
        <div class="info">
          <div class="name">${escapeHtml(card.name)} ${card.version?`<span class="muted">— ${escapeHtml(card.version)}</span>`:''}</div>
          <div class="muted" style="display:flex;align-items:center;gap:6px">${inkDot}<span>Set ${card.__setCode} • Cost ${card.cost ?? '-'}</span></div>
        </div>
        <div class="qty">
          <button aria-label="Diminuisci" ${qty<=1?'disabled':''}>−</button>
          <span>${qty}</span>
          <button aria-label="Aumenta" ${qty>=4?'disabled':''}>+</button>
          <button class="trash" title="Rimuovi" aria-label="Rimuovi">×</button>
        </div>`;
      const [btnMinus, spanQty, btnPlus, btnTrash] = row.querySelectorAll('.qty > *');
      btnMinus.addEventListener('click',()=>{
        entry.qty = Math.max(1, entry.qty-1);
        refreshSelectionViews();
      });
      btnPlus.addEventListener('click',()=>{
        entry.qty = Math.min(4, entry.qty+1);
        refreshSelectionViews();
      });
      btnTrash.addEventListener('click',()=>{
        BASKET.delete(card.id);
        refreshSelectionViews();
      });
      container.appendChild(row);
    });
  }

  renderInto(selList);
  renderInto(modalSel);
  updateCatalogBadges();
}

function addToBasket(card){
  const cur = BASKET.get(card.id);
  if(cur){ cur.qty = Math.min(8, cur.qty+1); }
  else { BASKET.set(card.id, {card, qty:1}); }
  refreshSelectionViews();
}

// ---- Filters & Search ----
function applyFilters(){
  const q = document.getElementById('searchInput').value.trim().toLowerCase();
  const ink = document.getElementById('inkFilter').value;
  const minRaw = document.getElementById('minCost').value;
  const maxRaw = document.getElementById('maxCost').value;
  const minC = Number(minRaw);
  const maxC = Number(maxRaw);

  let out = ALL_CARDS;
  if(ink){ out = out.filter(c => c.ink === ink); }
  if(minRaw !== '' && !Number.isNaN(minC)){ out = out.filter(c => (c.cost ?? Infinity) >= minC); }
  if(maxRaw !== '' && !Number.isNaN(maxC)){ out = out.filter(c => (c.cost ?? -Infinity) <= maxC); }
  if(q){ out = out.filter(c => c.__search.includes(q)); }

  const anyFilter = !!(q || ink || minRaw !== '' || maxRaw !== '');
  document.getElementById('clearFilters').style.display = anyFilter ? '' : 'none';

  displayCards(out);
}

function clearAllFilters(){
  document.getElementById('searchInput').value = '';
  document.getElementById('inkFilter').value = '';
  document.getElementById('minCost').value = '';
  document.getElementById('maxCost').value = '';
  applyFilters();
}

const debouncedApply = debounce(applyFilters, 200);

// ---- PDF Generation ----
// Card dimensions and spacing in mm
const MM_TO_PT = 72 / 25.4;
const CARD_W_MM = 63.5;
const CARD_H_MM = 88.9;
const GAP_MM = 0.2;

async function generatePDF(ev){
  console.log('[PDF] Click ricevuto, avvio generazione…');
  const items = Array.from(BASKET.values());
  if(items.length===0){ alert('Aggiungi almeno una carta alla lista.'); return; }

  const btns = [document.getElementById('makePdfBtn'), document.getElementById('makePdfBtnMobile')].filter(Boolean);
  const originalText = btns[0]?.textContent;
  const setBtns = (txt, disabled) => btns.forEach(b => { b.textContent = txt; b.disabled = disabled; });
  setBtns('Preparazione…', true);

  try {
    await _generatePDF(items, (done, total) => setBtns(`Generazione PDF ${done}/${total}…`, true));
    setBtns('PDF creato ✓', false);
    setTimeout(()=> setBtns(originalText, false), 2500);
  } catch (err) {
    console.error('[PDF] Errore:', err);
    alert('Errore durante la generazione del PDF:\n' + (err?.message || err));
    setBtns(originalText, false);
  }
}

async function _generatePDF(items, onProgress){
  if(typeof PDFLib === 'undefined'){
    throw new Error('Libreria pdf-lib non caricata (controlla la connessione o il blocco script).');
  }
  const { PDFDocument, StandardFonts, rgb } = PDFLib;
  const pdfDoc = await PDFDocument.create();

  // Use A4 size in points
  const A4 = { w: 595.28, h: 841.89 };
  const marginPt = 8 * MM_TO_PT; // 5mm margin: necessario per far stare 3 colonne da 63.5mm su A4

  // Lorcast serves AVIF without CORS headers, and pdf-lib supports only JPG/PNG.
  // Workaround: route every image through images.weserv.nl, a public proxy
  // that (a) adds CORS headers and (b) re-encodes the source to JPEG via &output=jpg.
  // Fallback: if the proxy fails, load the original in an <img> and convert via canvas.
  function getSourceImageUrl(card){
    const digital = card.image_uris?.digital || {};
    return digital.large || digital.normal || digital.small
        || card.__large || card.__small || '';
  }

  function getProxiedJpegUrl(sourceUrl){
    const stripped = sourceUrl.replace(/^https?:\/\//, '');
    return `https://images.weserv.nl/?url=${encodeURIComponent(stripped)}&output=jpg&q=92`;
  }

  async function fetchAsArrayBuffer(url, timeoutMs = 15000){
    const ctl = new AbortController();
    const timer = setTimeout(()=> ctl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { cache: 'force-cache', signal: ctl.signal });
      if(!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.arrayBuffer();
    } finally { clearTimeout(timer); }
  }

  function loadImageAsJpegBytes(url, timeoutMs = 15000){
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.decoding = 'async';
      const timer = setTimeout(()=> { img.src = ''; reject(new Error('Timeout caricamento immagine')); }, timeoutMs);
      img.onload = () => {
        clearTimeout(timer);
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          canvas.getContext('2d').drawImage(img, 0, 0);
          canvas.toBlob(async (blob) => {
            if (!blob) { reject(new Error('toBlob nullo')); return; }
            try { resolve(await blob.arrayBuffer()); }
            catch (e) { reject(e); }
          }, 'image/jpeg', 0.92);
        } catch (e) { reject(e); }
      };
      img.onerror = () => { clearTimeout(timer); reject(new Error('Image load error: ' + url)); };
      img.src = url;
    });
  }

  async function embedCardImage(pdfDoc, card){
    const source = getSourceImageUrl(card);
    if(!source) throw new Error('URL immagine non trovato');

    // Primary path: proxy that returns JPEG with CORS headers.
    try {
      const bytes = await fetchAsArrayBuffer(getProxiedJpegUrl(source));
      return await pdfDoc.embedJpg(bytes);
    } catch (proxyErr) {
      console.warn('Proxy weserv fallito, provo canvas fallback:', proxyErr);
    }

    // Fallback: load original via <img>, then re-encode via canvas.
    const bytes = await loadImageAsJpegBytes(source);
    return await pdfDoc.embedJpg(bytes);
  }


  const cardPts = { w: CARD_W_MM * MM_TO_PT, h: CARD_H_MM * MM_TO_PT };
  const gapPt = GAP_MM * MM_TO_PT;

  // Compute grid per page
  const usableW = A4.w - marginPt*2;
  const usableH = A4.h - marginPt*2;
  const cols = Math.max(1, Math.floor((usableW + gapPt) / (cardPts.w + gapPt)));
  const rows = Math.max(1, Math.floor((usableH + gapPt) / (cardPts.h + gapPt)));
  const perPage = cols * rows;

  // Build a flat list with duplicates based on qty
  const flat = [];
  for(const {card, qty} of items){ for(let i=0;i<qty;i++) flat.push(card); }

  let page, x0, y0;
  for(let i=0;i<flat.length;i++){
    if(i % perPage === 0){
      page = pdfDoc.addPage([A4.w, A4.h]);
      x0 = marginPt; y0 = A4.h - marginPt - cardPts.h; // start top-left
    }
    const idxOnPage = i % perPage;
    const r = Math.floor(idxOnPage / cols);
    const c = idxOnPage % cols;
    const x = x0 + c * (cardPts.w + gapPt);
    const y = y0 - r * (cardPts.h + gapPt);

    onProgress?.(i + 1, flat.length);
    try {
      const image = await embedCardImage(pdfDoc, flat[i]);
      page.drawImage(image, { x, y, width: cardPts.w, height: cardPts.h });
    } catch (e) {
      console.warn('[PDF] Carta saltata:', flat[i].name, e);
      page.drawRectangle({ x, y, width: cardPts.w, height: cardPts.h, borderWidth: 1, borderColor: rgb(0.7, 0.7, 0.7) });
      page.drawText('Immagine non disponibile', { x: x + 8, y: y + cardPts.h / 2, size: 9, color: rgb(0.2, 0.2, 0.2) });
    }
  }

  console.log('[PDF] Salvataggio documento…');
  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([pdfBytes], {type:'application/pdf'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'LorcanaPrint.pdf';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=> URL.revokeObjectURL(url), 2000);
}

// ---- Events ----
document.getElementById('searchInput').addEventListener('input', debouncedApply);
document.getElementById('inkFilter').addEventListener('change', applyFilters);
document.getElementById('minCost').addEventListener('input', debouncedApply);
document.getElementById('maxCost').addEventListener('input', debouncedApply);

document.getElementById('makePdfBtn').addEventListener('click', generatePDF);
document.getElementById('makePdfBtnMobile').addEventListener('click', generatePDF);
document.getElementById('clearFilters').addEventListener('click', clearAllFilters);
document.getElementById('clearBasket').addEventListener('click', ()=>{
  if(BASKET.size === 0) return;
  if(confirm('Svuotare l\'intera lista?')){
    BASKET.clear();
    refreshSelectionViews();
  }
});

const modal = document.getElementById('basketModal');
document.getElementById('openBasket').addEventListener('click', ()=>{ modal.showModal(); });
document.getElementById('closeModal').addEventListener('click', ()=> modal.close());

// ---- Helpers ----
function escapeHtml(s){
  return String(s||'').replace(/[&<>"']/g, m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m]));
}

// Kick off
loadData();

