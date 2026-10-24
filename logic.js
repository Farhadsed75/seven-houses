/* Seven Houses schedule — shared by the app and its tests. */
(function (global) {
  'use strict';

  function localDateISO(now = new Date()) {
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function isFriday(now = new Date()) { return now.getDay() === 5; }
  function is25th(now = new Date()) { return now.getDate() === 25; }

  function schedule(now = new Date()) {
    const houses = [3, 2, 1];
    if (isFriday(now)) houses.push(5, 4);
    if (is25th(now)) houses.push(6, 7);
    return houses;
  }

  function normalizeAnswer(s) {
    return String(s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
  }

  function monthsBetween(isoFrom, isoTo) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(isoFrom)) || !/^\d{4}-\d{2}-\d{2}$/.test(String(isoTo))) {
      return -1;
    }
    const [y1, m1] = isoFrom.split('-').map(Number);
    const [y2, m2] = isoTo.split('-').map(Number);
    return (y2 - y1) * 12 + m2 - m1;
  }

  function house7Due(card, now = new Date()) {
    if (!is25th(now)) return false;
    const today = localDateISO(now);
    // After promotion from House 6, the first House 7 review comes
    // two calendar months later, on the 25th (not immediately).
    const anchor = card.last_reviewed_house7 || card.house7_entered_at || card.last_reviewed;
    return !anchor || monthsBetween(anchor, today) >= 2;
  }

  function cardDue(card, house, now = new Date()) {
    if (card.house !== house || !schedule(now).includes(house)) return false;
    // Each card may be graded only once per calendar day.
    if (card.last_reviewed === localDateISO(now)) return false;
    return house !== 7 || house7Due(card, now);
  }

  function dueCounts(cards, now = new Date()) {
    const totals = {}, due = {};
    for (let h = 1; h <= 7; h++) {
      totals[h] = cards.filter(c => c.house === h).length;
      due[h] = cards.filter(c => cardDue(c, h, now)).length;
    }
    return {totals, due};
  }

  function movedHouse(oldHouse, correct) {
    const ok = {1:2, 2:3, 3:4, 4:5, 5:6, 6:7, 7:7};
    const wrong = {1:1, 2:1, 3:1, 4:1, 5:1, 6:4, 7:4};
    if (!(oldHouse in ok)) throw new Error('Invalid house');
    return (correct ? ok : wrong)[oldHouse];
  }

  function gradeCard(card, response, now = new Date()) {
    const today = localDateISO(now);
    if (!cardDue(card, card.house, now)) throw new Error('This card is not due for review.');
    const correct = normalizeAnswer(response) === normalizeAnswer(card.en);
    const before = card.house;
    const after = movedHouse(before, correct);
    card.house = after;
    card.last_reviewed = today;
    if (before === 7) card.last_reviewed_house7 = today;
    if (after === 7 && before !== 7) {
      card.house7_entered_at = today;
      card.last_reviewed_house7 = null;
    }
    return {correct, before, after};
  }

  function pendingCardIds(cards, now = new Date()) {
    const result = [];
    for (const house of schedule(now)) {
      const group = cards.filter(c => cardDue(c, house, now));
      // Mix cards WITHIN each house, while preserving the house review order.
      for (let i = group.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [group[i], group[j]] = [group[j], group[i]];
      }
      result.push(...group.map(c => c.id));
    }
    return result;
  }

  const api = {localDateISO,isFriday,is25th,schedule,normalizeAnswer,monthsBetween,house7Due,cardDue,dueCounts,movedHouse,gradeCard,pendingCardIds};
  global.SevenHousesLogic = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
