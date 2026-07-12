(function(){
  'use strict';

  /* ---------- Config ---------- */
  const FIVE_EURO_URL = 'https://py.pl/eyzwMpO5jFVLkRDCzoNxQw';
  const EGG_CHANCE = 0.05; // 5% di probabilità easter egg
  const THANKS_MS = 620;   // durata overlay "Grazie davvero ❤️"
  const PALETTE = ['#6ee7ff','#a78bfa','#f4b740','#10b981','#ef4444']; // colori già usati dal sito

  const PHRASES = [
    'Il server purtroppo non si alimenta ad affetto.',
    'Ogni caffè aumenta la motivazione dello sviluppatore.',
    'Prometto di spenderli in caffeina.',
    'Le feature strane non si sviluppano da sole.',
    'Grazie anche solo per aver aperto questa finestra ❤️',
    'Un caffè oggi, un bug fixato domani. Forse.',
    'Il dominio si rinnova da solo? No. No, non lo fa.',
    'Lo sviluppatore accetta anche complimenti, ma il server no.',
    'Niente pubblicità qui: solo sensi di colpa gentili.',
    'Ogni donazione riduce del 3% la mia voglia di mollare tutto.',
    'I PDF si generano gratis, i caffè no.',
    'Questo sito è gratis. Il caffè dello sviluppatore purtroppo no.',
    'Se stai leggendo questa frase, il generatore di frasi casuali funziona.',
    'Il 100% delle donazioni finanzia caffeina di qualità discutibile.',
    'Anche 50 centesimi fanno la loro figura. Giuro.',
    'Donare fa bene al karma. Fonte: mi conviene dirlo.',
    'Sostieni la ricerca… di nuove carte da stampare.',
    'Un piccolo passo per te, un caffè gigante per me.',
    'Il pulsante Chiudi funziona, ma fa un po\' male.',
    'Le monetine dimenticate nel divano hanno finalmente uno scopo.',
    'Nessun animale è stato maltrattato per questo sito. Solo lo sviluppatore.',
    'Il caffè è il carburante ufficiale di questo progetto.',
    'Se il sito ti ha risparmiato 10 minuti, direi che siamo pari con 1€.',
    'Anche i siti gratuiti hanno i sentimenti. E le bollette.',
    'Con 1€ non compri quasi niente. Tranne la mia eterna gratitudine.',
    'Questo messaggio si autodistruggerà… no, in realtà resta qui.',
    'Il tasto donazione era triste, così l\'ho fatto rimbalzare.',
    'Statisticamente, chi dona è una persona migliore. Statisticamente.',
    'L\'hosting non accetta pagamenti in buone intenzioni.',
    'Un caffè al giorno toglie i bug di torno. (Non è vero, ma suona bene.)',
    'Questo popup è stato scritto con molta umiltà. Più o meno.',
    'Se sei arrivato a leggere fin qui, ti meriti già un grazie ❤️'
  ];

  const EGG_PHRASES = [
    'Achievement unlocked: Persona fantastica.',
    'Lo sviluppatore ha sorriso.',
    '+10 motivazione',
    'Hai trovato l\'easter egg! 🥚 (5% di probabilità!)',
    'Colpo critico di gentilezza ×2!',
    '🎁 Drop raro: gratitudine leggendaria.'
  ];

  /* ---------- Elementi ---------- */
  const fab         = document.getElementById('donateWidgetFab');
  const modal       = document.getElementById('donateWidgetModal');
  const mega        = document.getElementById('donateWidgetMega');
  const phraseEl    = document.getElementById('donateWidgetPhrase');
  const eggEl       = document.getElementById('donateWidgetEgg');
  const confettiEl  = document.getElementById('donateWidgetConfetti');
  const fwLeft      = document.getElementById('donateWidgetFwLeft');
  const fwRight     = document.getElementById('donateWidgetFwRight');
  const countdownEl = document.getElementById('donateWidgetCountdown');
  const thanksEl    = document.getElementById('donateWidgetThanks');

  // Timer attivi solo mentre la modal 5€ è aperta (azzerati alla chiusura)
  let megaTimers = [];
  let thanksTimer = null;

  /* ---------- Utility ---------- */
  function randomPhrase(){
    return PHRASES[Math.floor(Math.random() * PHRASES.length)];
  }

  /* ---------- Modal principale ---------- */
  function openDonateModal(){
    phraseEl.textContent = '“' + randomPhrase() + '”';
    // Easter egg: 5% di probabilità a ogni apertura
    if(Math.random() < EGG_CHANCE){
      eggEl.textContent = EGG_PHRASES[Math.floor(Math.random() * EGG_PHRASES.length)];
      eggEl.hidden = false;
      // re-trigger dell'animazione pop
      eggEl.style.animation = 'none';
      void eggEl.offsetWidth;
      eggEl.style.animation = '';
    } else {
      eggEl.hidden = true;
    }
    modal.showModal();
  }

  function closeDonateModal(){
    if(modal.open) modal.close();
  }

  /* ---------- Apertura PayPal + ringraziamento ---------- */
  function openPaypal(url){
    const win = window.open(url, '_blank', 'noopener');
    if(!win) window.location.href = url; // fallback se il popup è bloccato
  }

  function showThankYou(url){
    // chiudi le modal per rendere visibile l'overlay
    if(mega.open) mega.close();
    closeDonateModal();
    thanksEl.classList.remove('donate-widget-thanks--show');
    void thanksEl.offsetWidth; // re-trigger animazione
    thanksEl.classList.add('donate-widget-thanks--show');
    clearTimeout(thanksTimer);
    thanksTimer = setTimeout(() => {
      thanksEl.classList.remove('donate-widget-thanks--show');
      openPaypal(url);
    }, THANKS_MS);
  }

  /* ---------- Modal 5€ ---------- */
  function showFiveEuroModal(){
    closeDonateModal();
    mega.showModal();
    launchFireworks();
    launchConfetti();
    fakeCountdown();
  }

  // Pulizia completa alla chiusura: niente timer né elementi residui nel DOM
  function clearMegaEffects(){
    megaTimers.forEach(clearTimeout);
    megaTimers = [];
    confettiEl.textContent = '';
    fwLeft.textContent = '';
    fwRight.textContent = '';
    countdownEl.textContent = '';
  }

  /* ---------- Coriandoli ---------- */
  function launchConfetti(){
    confettiEl.textContent = '';
    const frag = document.createDocumentFragment();
    for(let i = 0; i < 60; i++){
      const piece = document.createElement('span');
      piece.className = 'donate-widget-confetti-piece';
      piece.style.left = (Math.random() * 100) + '%';
      piece.style.width = (6 + Math.random() * 5) + 'px';
      piece.style.height = (10 + Math.random() * 6) + 'px';
      piece.style.background = PALETTE[i % PALETTE.length];
      piece.style.animationDuration = (3.2 + Math.random() * 2.5) + 's';
      // delay negativo: la "pioggia" è già in corso all'apertura
      piece.style.animationDelay = (-Math.random() * 5) + 's';
      frag.appendChild(piece);
    }
    confettiEl.appendChild(frag);
  }

  /* ---------- Fuochi d'artificio ---------- */
  function launchFireworks(){
    [fwLeft, fwRight].forEach(side => {
      side.textContent = '';
      for(let b = 0; b < 3; b++){
        const burst = document.createElement('div');
        burst.className = 'donate-widget-fw-burst';
        burst.style.top = (15 + Math.random() * 55) + '%';
        burst.style.left = (20 + Math.random() * 60) + '%';
        const delay = (b * 0.7 + Math.random() * 0.4).toFixed(2) + 's';
        const dur = (1.5 + Math.random() * 0.7).toFixed(2) + 's';
        for(let p = 0; p < 16; p++){
          const particle = document.createElement('span');
          const angle = (Math.PI * 2 * p) / 16 + Math.random() * 0.3;
          const dist = 45 + Math.random() * 55;
          particle.style.setProperty('--dw-x', (Math.cos(angle) * dist).toFixed(1) + 'px');
          particle.style.setProperty('--dw-y', (Math.sin(angle) * dist).toFixed(1) + 'px');
          particle.style.background = PALETTE[p % PALETTE.length];
          particle.style.animationDuration = dur;
          particle.style.animationDelay = delay;
          if(p % 4 === 0) particle.classList.add('donate-widget-fw-ray');
          burst.appendChild(particle);
        }
        side.appendChild(burst);
      }
    });
  }

  /* ---------- Countdown finto ---------- */
  function fakeCountdown(){
    countdownEl.innerHTML = '<div class="donate-widget-countdown-label">Ripensaci...</div>';
    const label = countdownEl.firstChild;

    function showNum(n){
      // nuovo nodo a ogni tick: l'animazione pop riparte da zero
      const old = countdownEl.querySelector('.donate-widget-countdown-num');
      if(old) old.remove();
      const num = document.createElement('span');
      num.className = 'donate-widget-countdown-num';
      num.textContent = n;
      countdownEl.appendChild(num);
    }

    showNum('3');
    megaTimers.push(setTimeout(() => showNum('2'), 1000));
    megaTimers.push(setTimeout(() => showNum('1'), 2000));
    megaTimers.push(setTimeout(() => {
      countdownEl.innerHTML = '<div class="donate-widget-countdown-final">Ti prego continua ❤️</div>';
    }, 3000));
    void label; // il label resta visibile per tutta la durata del countdown
  }

  /* ---------- Accessibilità ---------- */
  // I <dialog> nativi con showModal() gestiscono già ESC e focus;
  // queste funzioni sono una rete di sicurezza esplicita.
  function handleEscapeKey(e){
    if(e.key !== 'Escape') return;
    if(mega.open) mega.close();
    else if(modal.open) modal.close();
  }

  function trapFocus(dialogEl){
    dialogEl.addEventListener('keydown', (e) => {
      if(e.key !== 'Tab') return;
      const focusables = dialogEl.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
      if(!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if(e.shiftKey && document.activeElement === first){ e.preventDefault(); last.focus(); }
      else if(!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
    });
  }

  /* ---------- Init ---------- */
  function initDonateWidget(){
    fab.addEventListener('click', openDonateModal);
    document.getElementById('donateWidgetClose').addEventListener('click', closeDonateModal);

    // click sul backdrop = chiusura (il contenuto è dentro un wrapper,
    // quindi e.target === dialog solo cliccando fuori)
    modal.addEventListener('click', (e) => { if(e.target === modal) modal.close(); });
    mega.addEventListener('click', (e) => { if(e.target === mega) mega.close(); });

    // importi con link diretto: ringraziamento breve, poi PayPal
    modal.querySelectorAll('[data-donate-url]').forEach(btn => {
      btn.addEventListener('click', () => showThankYou(btn.dataset.donateUrl));
    });

    // 5€: modal speciale
    document.getElementById('donateWidgetFive').addEventListener('click', showFiveEuroModal);
    document.getElementById('donateWidgetMegaYes').addEventListener('click', () => showThankYou(FIVE_EURO_URL));
    document.getElementById('donateWidgetMegaNo').addEventListener('click', () => mega.close());

    // pulizia effetti a ogni chiusura (incluso ESC / backdrop)
    mega.addEventListener('close', clearMegaEffects);

    document.addEventListener('keydown', handleEscapeKey);
    trapFocus(modal);
    trapFocus(mega);
  }

  initDonateWidget();
})();

