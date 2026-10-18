// Run: node core/offerBar.test.mjs
import assert from 'node:assert/strict';
import { getOfferBar, getCouponList, checkCoupon, toggleCoupon, settleLoan, getReminder } from './offerBar.js';
import { COUPONS } from './sampleCoupons.js';

const bar = (amount, extra = {}) => getOfferBar({ amount, coupons: COUPONS, ...extra });

// R1 no coupons → no bar
assert.equal(getOfferBar({ amount: 800, coupons: [] }).showBar, false);
// preview before any amount
assert.deepEqual([bar(null).state, bar(null).action], ['preview', 'viewAll']);
// R5 matching keeps the bar
assert.equal(bar(8000, { matching: true }).state, 'matching');
// R3 + R6 + R7 names exactly what is applied
assert.equal(bar(8000).text, '10 days interest-free, then 30% off interest');
assert.equal(bar(1000).text, '10 days interest-free');
// R2 none fit → bar stays with count
assert.deepEqual([bar(800).state, bar(800).text, bar(800).action], ['unavailable', '4 offers unavailable', 'viewWhy']);
// R4 every unusable coupon has a reason and a fix
const off = getCouponList({ amount: 800, coupons: COUPONS }).flatMap((g) => g.items).filter((i) => !i.usable);
assert.equal(off.length, 4);
assert.ok(off.every((i) => i.reasonText && i.unlockText));
assert.equal(checkCoupon(COUPONS[1], 800).reasonText, 'Loan amount too low');

// R8 the user can switch or drop a coupon per type
const [if10, if3, rd30, rd20] = COUPONS;
let sel = toggleCoupon({ coupons: COUPONS, amount: 8000, coupon: rd20 });
assert.equal(bar(8000, { selection: sel }).text, '10 days interest-free, then 20% off interest');
sel = toggleCoupon({ coupons: COUPONS, amount: 8000, selection: sel, coupon: if10 });
assert.equal(bar(8000, { selection: sel }).text, '20% off interest');
sel = toggleCoupon({ coupons: COUPONS, amount: 8000, selection: sel, coupon: rd20 });
assert.deepEqual([bar(8000, { selection: sel }).state, bar(8000, { selection: sel }).text], ['declined', '4 offers available']);
assert.deepEqual(toggleCoupon({ coupons: COUPONS, amount: 800, coupon: if10 }), {}); // unusable: no change

// R9 after a loan: credit drops, used coupons go, the best one left comes back as a reminder
const after = settleLoan({ amount: 8000, credit: 9550, coupons: COUPONS });
assert.equal(after.credit, 1550);
assert.deepEqual(after.coupons.map((c) => c.id), ['if3', 'rd20']);
assert.equal(getReminder(after).text, '3 days interest-free, expires in 3 days');
assert.equal(getOfferBar({ amount: null, coupons: after.coupons }).text, '3 days interest-free, then 20% off');
assert.equal(getReminder({ coupons: after.coupons, credit: 500 }), null); // nothing fits the credit left

console.log('all offer bar rules pass');
