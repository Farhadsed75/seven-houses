/* Seven Houses, a private offline-first vocabulary app. */
(() => {
  'use strict';
  const L = window.SevenHousesLogic;
  const STORAGE_KEY = 'seven-houses-v1-words';
  const $ = id => document.getElementById(id);
  let cards = [];
  let queue = [];
  let graded = false;
  let feedback = null;
  let sessionCorrect = 0;
  let sessionAnswered = 0;
  let currentDate = L.localDateISO();
  let editingId = null;
  let toastTimer = null;

  const HOUSE_NAMES = {1:'Daily',2:'Daily',3:'Daily',4:'Friday',5:'Friday',6:'25th',7:'2 months'};

  function makeId() {
    if (globalThis.crypto && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
    return `card-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  function dateOrNull(value) {
    return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
  }

  function parseCard(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const en = String(raw.en ?? '').trim(), fa = String(raw.fa ?? '').trim();
    const house = Number(raw.house ?? 1);
    if (!en || !fa || !Number.isInteger(house) || house < 1 || house > 7) return null;
    return {
      id: typeof raw.id === 'string' && raw.id ? raw.id : makeId(),
      en, fa, house,
      last_reviewed: dateOrNull(raw.last_reviewed),
      last_reviewed_house7: dateOrNull(raw.last_reviewed_house7),
      house7_entered_at: dateOrNull(raw.house7_entered_at)
    };
  }

  function load() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return [];
      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed)) throw new Error('Unrecognized saved data');
      return parsed.map(parseCard).filter(Boolean);
    } catch (err) {
      alert(`Couldn't load stored words: ${err.message}. Your existing storage has not been changed.`);
      return [];
    }
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cards));
      return true;
    } catch (err) {
      alert(`Couldn't save data on this device: ${err.message}. Export or free up device storage.`);
      return false;
    }
  }

  function notify(message) {
    const toast = $('toast');
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 3000);
  }

  function getNow() { return new Date(); }

  function ensureToday() {
    const now = getNow();
    const d = L.localDateISO(now);
    if (d === currentDate) return false;
    currentDate = d;
    queue = L.pendingCardIds(cards, now);
    graded = false;
    feedback = null;
    sessionCorrect = 0;
    sessionAnswered = 0;
    renderAll();
    notify('New local day: your review schedule was refreshed.');
    return true;
  }

  function refreshQueue(preserveCurrent = false) {
    const fresh = L.pendingCardIds(cards, getNow());
    if (preserveCurrent && graded && queue.length) {
      // Retain the reviewed card on screen until Next is tapped.
      queue = [queue[0], ...fresh];
    } else {
      queue = fresh;
      graded = false;
      feedback = null;
    }
    renderAll();
  }

  function currentCard() {
    if (!queue.length) return null;
    return cards.find(c => c.id === queue[0]) || null;
  }

  function renderDashboard() {
    const now = getNow();
    const localeDate = new Intl.DateTimeFormat(undefined, {weekday:'short', month:'short',day:'numeric',year:'numeric'}).format(now);
    $('local-date').textContent = localeDate;
    const onFriday = L.isFriday(now), on25th = L.is25th(now);
    const bits = ['Daily: Houses 3 → 2 → 1'];
    if (onFriday) bits.push('Friday: 5 → 4');
    if (on25th) bits.push('25th: 6 → 7 (when due)');
    $('schedule-line').textContent = bits.join('  ·  ');
    const {totals,due} = L.dueCounts(cards, now);
    $('due-total').textContent = String(Object.values(due).reduce((a,b) => a+b,0));
    $('total-words').textContent = String(cards.length);
    $('reviewed-today').textContent = String(cards.filter(c => c.last_reviewed === currentDate).length);
    const grid = $('house-grid');
    grid.replaceChildren();
    for(let h=1;h<=7;h++) {
      const tile = document.createElement('div');
      tile.className = 'house-tile' + (L.schedule(now).includes(h) ? ' active':'');
      const title = document.createElement('div'); title.className='tile-label'; title.textContent=`House ${h}`;
      const count = document.createElement('div'); count.className='tile-count'; count.textContent=`${due[h]} / ${totals[h]}`;
      const cadence = document.createElement('div'); cadence.className='tile-cadence'; cadence.textContent=HOUSE_NAMES[h];
      tile.append(title,count,cadence);
      grid.appendChild(tile);
    }
  }

  function renderReview() {
    const card = currentCard();
    const haveCard = Boolean(card);
    $('practice-area').hidden = !haveCard;
    $('empty-state').hidden = haveCard;
    $('active-house').textContent = haveCard ? `House ${graded && feedback ? feedback.before : card.house}` : 'House —';
    $('card-step').textContent = haveCard ? `${queue.length} remaining in queue` : 'Complete';
    $('session-progress').textContent = `${sessionAnswered} answered`;
    $('accuracy-text').textContent = sessionAnswered ? `Session accuracy: ${Math.round(100 * sessionCorrect/sessionAnswered)}% (${sessionCorrect}/${sessionAnswered})` : 'Session accuracy: —';
    if (!haveCard) return;
    $('persian-word').textContent = card.fa;
    const input = $('answer-input');
    input.disabled = false;
    $('check-button').hidden = graded;
    $('next-button').hidden = !graded;
    $('check-button').disabled = graded;
    $('next-button').disabled = !graded;
    $('skip-button').disabled = graded;
    const result = $('feedback');
    result.hidden = !graded;
    result.className = graded ? `feedback ${feedback.correct ? 'right' : 'wrong'}` : 'feedback';
    if (graded) {
      const resultLabel = feedback.correct ? '✓ Correct!' : '✕ Not quite.';
      result.textContent = `${resultLabel}  ${feedback.correct ? '' : `Correct answer: ${feedback.answer}.  `}House ${feedback.before} → House ${feedback.after}.`;
      $('answer-hint').textContent = 'Press Enter again or tap Next word to continue.';
    } else {
      result.textContent = '';
      $('answer-hint').textContent = 'Press Enter to check; press Enter again for the next card.';
    }
  }

  function renderList() {
    const q = L.normalizeAnswer($('search-input').value);
    const filtered = [...cards].sort((a,b) => a.house-b.house || a.en.localeCompare(b.en)).filter(c => {
      if (!q) return true;
      return L.normalizeAnswer(`${c.en} ${c.fa} ${c.house}`).includes(q);
    });
    const list = $('words-list');
    list.replaceChildren();
    if (!filtered.length) {
      const msg = document.createElement('p');
      msg.className = 'microcopy';
      msg.textContent = cards.length ? 'No matching cards.' : 'No words yet. Add your first Persian and English word pair.';
      list.appendChild(msg);
    }
    for (const c of filtered) {
      const row = document.createElement('div'); row.className = 'word-row';
      const info = document.createElement('div'); info.className = 'word-info';
      const house = document.createElement('span'); house.className='word-house'; house.textContent=`H${c.house}`;
      const pair = document.createElement('div'); pair.className='word-pair';
      const en = document.createElement('div'); en.className='word-en'; en.textContent=c.en;
      const fa = document.createElement('div'); fa.className='word-fa'; fa.dir='auto'; fa.textContent=c.fa;
      const last = document.createElement('div'); last.className='word-date';
      last.textContent = `Last reviewed: ${c.last_reviewed || 'Never'}`;
      pair.append(en,fa,last);
      info.append(house,pair);
      const actions = document.createElement('div'); actions.className='word-actions';
      const editBtn = document.createElement('button'); editBtn.type='button';editBtn.textContent='Edit';
      editBtn.addEventListener('click',()=>openDialog(c.id));
      const deleteBtn = document.createElement('button');deleteBtn.type='button';deleteBtn.textContent='Delete';deleteBtn.className='danger';
      deleteBtn.addEventListener('click',()=>deleteCard(c.id));
      actions.append(editBtn,deleteBtn);
      row.append(info,actions);
      list.appendChild(row);
    }
    $('list-footer').textContent = `Showing ${filtered.length} of ${cards.length} word pairs`;
  }

  function renderAll() { renderDashboard(); renderReview(); renderList(); }

  function onCheck(event) {
    event.preventDefault();
    if (ensureToday()) return;
    const card = currentCard();
    if (!card) return;
    if (graded) { nextCard(); return; }
    const answer = $('answer-input').value;
    // Guard against unavailable local storage: keep card unanswered if persistence fails.
    const backup = {...card};
    let result;
    try { result = L.gradeCard(card, answer, getNow()); }
    catch (err) { notify(err.message); refreshQueue(); return; }
    if (!save()) { Object.assign(card,backup); return; }
    graded = true;
    feedback = {...result, answer:card.en};
    sessionAnswered++;
    if (result.correct) sessionCorrect++;
    renderDashboard();
    renderReview();
    renderList();
    // Keep focus in the same input: the next Enter advances the card.
    $('answer-input').focus();
  }

  function nextCard() {
    if (ensureToday()) return;
    if (!graded || !queue.length) return;
    queue.shift();
    graded = false;
    feedback = null;
    // Prune outdated items while keeping the pending order.
    queue = queue.filter(id => {
      const c=cards.find(card=>card.id===id);
      return c && L.cardDue(c,c.house,getNow());
    });
    $('answer-input').value = '';
    renderAll();
    if (queue.length) $('answer-input').focus();
    else notify('All due reviews are complete.');
  }

  function skipCard() {
    if (ensureToday()) return;
    if (graded || !queue.length) return;
    queue.push(queue.shift());
    $('answer-input').value='';
    renderReview();
    $('answer-input').focus();
    if (queue.length===1) notify('This card remains in today’s queue until you answer it.');
  }

  function openDialog(id = null) {
    editingId = id;
    const existing = cards.find(c => c.id===id);
    $('dialog-heading').textContent = existing ? 'Edit word' : 'Add word';
    $('fa-field').value = existing ? existing.fa : '';
    $('en-field').value = existing ? existing.en : '';
    $('house-field').value = existing ? String(existing.house) : '1';
    $('word-dialog').showModal();
    setTimeout(() => $('fa-field').focus(), 0);
  }

  function saveWord(event) {
    event.preventDefault();
    ensureToday();
    const en = $('en-field').value.trim(), fa = $('fa-field').value.trim();
    const house = Number($('house-field').value);
    if (!en || !fa || house < 1 || house > 7) return;
    const duplicate = cards.some(c => c.id !== editingId && L.normalizeAnswer(c.en) === L.normalizeAnswer(en) && L.normalizeAnswer(c.fa) === L.normalizeAnswer(fa));
    if (duplicate) { notify('This English–Persian pair already exists.'); return; }
    if (editingId) {
      const c = cards.find(c => c.id===editingId);
      if (!c) {notify('Card no longer exists.');return;}
      const old = {...c};
      c.en=en;c.fa=fa;
      if (c.house!==house) {
        c.house=house;
        // Manually moving a card starts its new schedule from the current day.
        c.last_reviewed=L.localDateISO();
        if (house===7) { c.house7_entered_at=c.last_reviewed;c.last_reviewed_house7=null; }
      }
      if (!save()) {Object.assign(c,old);return;}
    } else {
      const today=L.localDateISO();
      // New daily words are due now; manually created non-daily house cards
      // begin their interval now rather than being instantly due.
      cards.push({id:makeId(),en,fa,house,
        last_reviewed: house>=4 ? today : null,
        last_reviewed_house7:null,
        house7_entered_at: house===7 ? today : null});
      if (!save()) {cards.pop();return;}
    }
    $('word-dialog').close();
    // Rebuild remaining queue so edited/deleted cards cannot leave stale indices.
    // If current card has been graded, preserve its feedback until Next.
    const keepGraded=graded && editingId !== (queue[0] || null);
    refreshQueue(keepGraded);
    $('answer-input').value='';
    notify(editingId ? 'Word updated.' : 'Word added to House 1.');
  }

  function deleteCard(id) {
    const c=cards.find(card=>card.id===id);
    if (!c) return;
    if (!confirm(`Delete this card?\n\n${c.fa} → ${c.en}\nHouse ${c.house}\n\nThis cannot be undone unless you restore a backup.`)) return;
    const prev=cards;
    cards=cards.filter(card=>card.id!==id);
    if (!save()) {cards=prev;return;}
    refreshQueue(graded && queue[0]!==id);
    notify('Word deleted.');
  }

  function exportJson() {
    // Only fields accepted by the original Python Card dataclass:
    const portable=cards.map(c=>({
      en:c.en,fa:c.fa,house:c.house,
      last_reviewed:c.last_reviewed,
      last_reviewed_house7:c.last_reviewed_house7
    }));
    const json=JSON.stringify(portable,null,2);
    const blob=new Blob([json],{type:'application/json;charset=utf-8'});
    const url=URL.createObjectURL(blob);
    const link=document.createElement('a');
    link.href=url;
    link.download=`leitner_words_${L.localDateISO()}.json`;
    document.body.appendChild(link);link.click();link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),10000);
    notify('Backup prepared. Save the JSON file in Files.');
  }

  async function importJson(event) {
    const file=event.target.files && event.target.files[0];
    if (!file) return;
    try {
      const data=JSON.parse(await file.text());
      const rows=Array.isArray(data) ? data : (data && Array.isArray(data.cards) ? data.cards : null);
      if (!rows) throw new Error('Expected an array of cards or an object with a cards array.');
      let added=0, invalid=0, duplicate=0;
      const original=cards.slice();
      const keys=new Set(cards.map(c=>`${L.normalizeAnswer(c.en)}\u0000${L.normalizeAnswer(c.fa)}`));
      for(const raw of rows){
        const parsed=parseCard(raw);
        if (!parsed){invalid++;continue;}
        const key=`${L.normalizeAnswer(parsed.en)}\u0000${L.normalizeAnswer(parsed.fa)}`;
        if(keys.has(key)){duplicate++;continue;}
        parsed.id=makeId();
        cards.push(parsed);keys.add(key);added++;
      }
      if (!save()){cards=original;return;}
      refreshQueue();
      notify(`Imported ${added} cards (${duplicate} duplicates, ${invalid} invalid skipped).`);
    }catch(err){ alert(`Import failed: ${err.message}`); }
    finally{ event.target.value=''; }
  }

  function registerEvents() {
    $('answer-form').addEventListener('submit', onCheck);
    $('answer-input').addEventListener('keydown', event=>{
      if (event.key==='Enter') {
        event.preventDefault();
        onCheck(event);
      }
    });
    $('next-button').addEventListener('click',nextCard);
    $('skip-button').addEventListener('click',skipCard);
    $('add-top').addEventListener('click',()=>openDialog());
    $('add-manage').addEventListener('click',()=>openDialog());
    $('empty-add').addEventListener('click',()=>openDialog());
    $('close-dialog').addEventListener('click',()=>$('word-dialog').close());
    $('cancel-dialog').addEventListener('click',()=>$('word-dialog').close());
    $('word-form').addEventListener('submit',saveWord);
    $('search-input').addEventListener('input',renderList);
    $('rebuild-button').addEventListener('click',()=>{
      if(ensureToday()) return;
      refreshQueue(graded);
      notify('Remaining due reviews refreshed.');
    });
    $('export-button').addEventListener('click',exportJson);
    $('import-file').addEventListener('change',importJson);
    window.addEventListener('focus', ensureToday);
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)ensureToday();});
    setInterval(ensureToday,60000);
  }

  function init() {
    cards=load();
    queue=L.pendingCardIds(cards,getNow());
    registerEvents();
    renderAll();
    if ('serviceWorker' in navigator && window.isSecureContext) {
      navigator.serviceWorker.register('./sw.js').catch(()=>{});
    }
  }
  init();
})();
