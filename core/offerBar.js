/**
 * Offer Bar · core logic (framework-free)
 *
 * No DOM, no React, no dependencies. Give it business data;
 * it returns what the offer bar should show. Any UI renders the result as-is.
 *
 * Rules (from the Fenfu loan-page redesign):
 *  R1  No coupons → no offer bar. Users without coupons never see an empty promise.
 *  R2  Coupons exist but none fit → the bar stays and says how many are unavailable.
 *  R3  The bar names exactly what is applied, never a generic "discount applied".
 *  R4  Every unavailable coupon states what limits it and what would unlock it.
 *  R5  While matching, the bar keeps its position and type; only the content changes.
 *  R6  One coupon per type; different types combine.
 *  R7  Best coupon: more free days > higher max amount > lower min amount > earlier expiry.
 *  R8  The best pick is a default, not a lock: the user can switch or drop a coupon per type.
 *  R9  After a loan, credit goes down, used coupons are gone, and the best one left is offered back.
 */

const yuan = (n) => '¥' + Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 });

/** R4 · Can this coupon be used at this amount, and if not, why. */
export function checkCoupon(coupon, amount) {
  if (amount == null || amount <= 0) return { usable: true, reason: null };
  if (coupon.minAmount != null && amount < coupon.minAmount) {
    return { usable: false, reason: 'belowMin', reasonText: 'Loan amount too low', unlockText: `Borrow ${yuan(coupon.minAmount)} or more` };
  }
  if (coupon.maxAmount != null && amount > coupon.maxAmount) {
    return { usable: false, reason: 'aboveMax', reasonText: 'Loan amount too high', unlockText: `Borrow ${yuan(coupon.maxAmount)} or less` };
  }
  return { usable: true, reason: null };
}

/** R7 · ranking. Negative = a is better. */
function compare(a, b) {
  const v = (c) => (c.type === 'interestFree' ? c.days ?? 0 : c.discount ?? 0);
  return (
    v(b) - v(a) ||
    (b.maxAmount ?? Infinity) - (a.maxAmount ?? Infinity) ||
    (a.minAmount ?? 0) - (b.minAmount ?? 0) ||
    (a.expiresOrder ?? 0) - (b.expiresOrder ?? 0)
  );
}

/** R6 · best usable coupon per type. */
export function pickBest(coupons, amount) {
  const best = { interestFree: null, rateDiscount: null };
  for (const type of ['interestFree', 'rateDiscount']) {
    best[type] = coupons.filter((c) => c.type === type && checkCoupon(c, amount).usable).sort(compare)[0] ?? null;
  }
  return best;
}

/** R3 · one line naming exactly what is applied. */
export function describe(best, { short = false } = {}) {
  const f = best.interestFree, d = best.rateDiscount;
  const off = d ? `${Math.round(d.discount * 100)}% off${short ? '' : ' interest'}` : '';
  if (f && d) return `${f.days} days interest-free, then ${off}`;
  if (f) return `${f.days} days interest-free`;
  if (d) return off.charAt(0).toUpperCase() + off.slice(1);
  return '';
}

/** Loan terms shown under the offer, computed from what is applied. */
export function terms(amount, best, baseDailyRate = 0.0004) {
  const rate = baseDailyRate * (1 - (best.rateDiscount?.discount ?? 0));
  const perDay = amount * rate;
  const free = best.interestFree?.days ?? 0;
  const pct = (x) => (x * 100).toFixed(3).replace(/0+$/, '').replace(/\.$/, '') + '%';
  return {
    interest: free ? `¥0 for ${free} days, then ${yuan(perDay.toFixed(2))}/day` : `${yuan(perDay.toFixed(2))}/day`,
    rate: `${pct(rate)} daily, ${(rate * 365 * 100).toFixed(1)}% APR`,
    baseRate: best.rateDiscount ? pct(baseDailyRate) : null,
  };
}

/**
 * R8 · What is applied, given an optional user selection.
 * selection[type]: undefined = use the best (default) · null = user dropped this type · id = user's pick.
 * A pick that no longer fits the amount falls back to the best.
 */
export function resolveApplied(coupons, amount, selection = {}) {
  const best = pickBest(coupons, amount);
  const out = { interestFree: null, rateDiscount: null };
  for (const type of Object.keys(out)) {
    const pick = selection[type];
    if (pick === undefined) { out[type] = best[type]; continue; }
    if (pick === null) continue;
    const c = coupons.find((x) => x.id === pick && x.type === type);
    out[type] = c && checkCoupon(c, amount).usable ? c : best[type];
  }
  return out;
}

/** R6 + R8 · Tapping a usable coupon picks it; tapping the picked one drops it. Returns a new selection. */
export function toggleCoupon({ coupons, amount, selection = {}, coupon }) {
  if (!checkCoupon(coupon, amount).usable) return selection;
  const current = resolveApplied(coupons, amount, selection)[coupon.type];
  return { ...selection, [coupon.type]: current?.id === coupon.id ? null : coupon.id };
}

/**
 * The one entry point a UI needs.
 * @returns {{ state: 'none'|'preview'|'matching'|'applied'|'declined'|'unavailable', showBar: boolean,
 *             text: string, action: null|'viewAll'|'viewWhy'|'change', applied: object, unavailableCount: number }}
 */
export function getOfferBar({ amount, coupons, matching = false, selection = {} }) {
  const empty = { interestFree: null, rateDiscount: null };
  if (!coupons?.length) return { state: 'none', showBar: false, text: '', action: null, applied: empty, unavailableCount: 0 }; // R1
  if (amount == null || amount <= 0) {
    const best = pickBest(coupons, null);
    return { state: 'preview', showBar: true, text: describe(best, { short: true }), action: 'viewAll', applied: best, unavailableCount: 0 };
  }
  if (matching) return { state: 'matching', showBar: true, text: 'Matching your best offer', action: null, applied: empty, unavailableCount: 0 }; // R5
  const unavailableCount = coupons.filter((c) => !checkCoupon(c, amount).usable).length;
  const best = pickBest(coupons, amount);
  if (!best.interestFree && !best.rateDiscount) {
    return { state: 'unavailable', showBar: true, text: `${unavailableCount} ${unavailableCount === 1 ? 'offer' : 'offers'} unavailable`, action: 'viewWhy', applied: empty, unavailableCount }; // R2
  }
  const applied = resolveApplied(coupons, amount, selection);
  if (!applied.interestFree && !applied.rateDiscount) {
    const n = coupons.length - unavailableCount;
    return { state: 'declined', showBar: true, text: `${n} ${n === 1 ? 'offer' : 'offers'} available`, action: 'change', applied, unavailableCount }; // R8
  }
  return { state: 'applied', showBar: true, text: describe(applied), action: 'change', applied, unavailableCount };
}

/** Data for the coupon sheet: usable first, each unusable one with its reason (R4). */
export function getCouponList({ amount, coupons, selection = {} }) {
  const best = resolveApplied(coupons, amount, selection);
  return [
    { type: 'interestFree', title: 'Interest-Free Coupon' },
    { type: 'rateDiscount', title: 'Interest Discount Coupon' },
  ]
    .map((g) => ({
      ...g,
      items: coupons
        .filter((c) => c.type === g.type)
        .map((c) => ({ coupon: c, ...checkCoupon(c, amount), selected: best[g.type]?.id === c.id }))
        .sort((x, y) => Number(y.usable) - Number(x.usable) || compare(x.coupon, y.coupon)),
    }))
    .filter((g) => g.items.length);
}

/** R9 · What the account looks like after a loan: less credit, used coupons removed. */
export function settleLoan({ amount, credit, coupons, selection = {} }) {
  const applied = resolveApplied(coupons, amount, selection);
  const used = new Set([applied.interestFree?.id, applied.rateDiscount?.id].filter(Boolean));
  return { credit: Math.round((credit - amount) * 100) / 100, coupons: coupons.filter((c) => !used.has(c.id)), applied };
}

/** R9 · The one remaining coupon worth a reminder, if any can still be used within the credit left. */
export function getReminder({ coupons, credit }) {
  const fits = (c) => (c.minAmount ?? 0) <= credit;
  for (const type of ['interestFree', 'rateDiscount']) {
    const c = coupons.filter((x) => x.type === type && fits(x)).sort(compare)[0];
    if (c) {
      const what = type === 'interestFree' ? `${c.days} days interest-free` : `${Math.round(c.discount * 100)}% off interest`;
      return { coupon: c, text: c.daysLeft != null ? `${what}, expires in ${c.daysLeft} ${c.daysLeft === 1 ? 'day' : 'days'}` : what };
    }
  }
  return null;
}
