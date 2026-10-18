import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { getOfferBar, getCouponList, terms, toggleCoupon, settleLoan, getReminder } from '../../core/offerBar.js';
import { COUPONS, CREDIT } from '../../core/sampleCoupons.js';
import tokens from '../../core/tokens.json';
import statusRight from './assets/status-right.svg';
import arrowLeft from './assets/arrow-left.svg';
import arrowRight from './assets/arrow-right.svg';
import arrowRightGold from './assets/arrow-right-gold.svg';
import deleteIcon from './assets/delete.svg';
import bankIcon from './assets/bank-cmb.svg';
import checkOn from './assets/check-on.svg';
import checkOff from './assets/check-off.svg';
import checkDisabled from './assets/check-disabled.svg';
import clockIcon from './assets/clock.svg';
import arrowRightOrange from './assets/arrow-right-orange.svg';

const MATCH_DELAY = tokens.motion.matchDelay;
const toNumber = (s) => (s === '' || s === '.' ? null : Number(s));
const yuan = (n) => '¥' + n.toLocaleString('en-US');

/* ─────────────────────────────  The flow  ───────────────────────────── */
const STEPS = [
  { label: 'Type an amount', note: 'The offer shows before any amount is typed.' },
  { label: 'Matching', note: 'The offer keeps its place while it matches.' },
  { label: 'Best offer applied', note: 'The row names exactly what is applied.' },
  { label: 'Amount no longer fits', note: 'The row stays and says how many are unavailable.' },
  { label: 'See why', note: 'Each coupon shows its minimum and why it does not apply.' },
  { label: 'Change the amount', note: 'Raise the amount and the offer comes back.' },
];

const TRY = [
  { v: '8000', label: '8,000', what: 'Every coupon fits. The best pair is applied.' },
  { v: '1500', label: '1,500', what: 'Some coupons fit. The best one that fits is applied.' },
  { v: '800', label: '800', what: 'Nothing fits. The row stays and says why.' },
];

const PlayIcon = () => (<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 1.8v8.4a.6.6 0 0 0 .9.5l6.6-4.2a.6.6 0 0 0 0-1L3.9 1.3a.6.6 0 0 0-.9.5Z" fill="currentColor" /></svg>);
const StopIcon = () => (<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><rect x="2.5" y="2.5" width="7" height="7" rx="1.2" fill="currentColor" /></svg>);
const ResetIcon = () => (<svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true"><path d="M2.8 8a5.2 5.2 0 1 0 1.6-3.75M2.6 1.9v2.8h2.8" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>);

const HASH = typeof location !== 'undefined' ? location.hash : '';
const RECORD = HASH.startsWith('#record');
// Exploration: the same page, but every digit change in the amount moves (#roll).
const ROLL = HASH.includes('roll');

export default function App() {
  const [raw, setRaw] = useState('');
  // The account: credit and coupons change after a loan (R9).
  const [account, setAccount] = useState({ credit: CREDIT, coupons: COUPONS });
  const [loan, setLoan] = useState(null); // { amount, reminder } while the status screen is up
  const [matching, setMatching] = useState(false);
  const [keypad, setKeypad] = useState(false);
  const [sheet, setSheet] = useState(null); // null | 'all' | 'select'
  const [step, setStep] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const timer = useRef(null);
  const playRef = useRef(0);

  const amount = toNumber(raw);
  // R8: the best pick is a default. `selection` is what the user confirmed; `draft` lives while the sheet is open.
  const [selection, setSelection] = useState({});
  const [draft, setDraft] = useState({});
  const bar = useMemo(() => getOfferBar({ amount, coupons: account.coupons, matching, selection }), [amount, matching, selection, account]);
  const list = useMemo(() => getCouponList({ amount, coupons: account.coupons, selection: sheet === 'select' ? draft : selection }), [amount, selection, draft, sheet, account]);
  const openSheet = (v) => { setDraft(selection); setKeypad(false); setSheet(v); };
  const pick = (coupon) => setDraft((d) => toggleCoupon({ coupons: account.coupons, amount, selection: d, coupon }));
  const confirmSheet = () => { if (sheet === 'select') setSelection(draft); setSheet(null); };

  // Any edit re-matches after a short pause (R5).
  const edit = (next) => {
    setRaw(next);
    setSelection({}); // a new amount re-matches from the best
    clearTimeout(timer.current);
    if (toNumber(next)) {
      setMatching(true);
      timer.current = setTimeout(() => setMatching(false), MATCH_DELAY);
    } else setMatching(false);
  };

  const press = (k) => {
    if (k === 'ok') return setKeypad(false);
    if (k === 'del') return edit(raw.slice(0, -1));
    if (k === '.' && (raw.includes('.') || raw === '')) return;
    if (raw.includes('.') && raw.split('.')[1].length >= 2) return;
    const next = raw === '0' && k !== '.' ? k : raw + k;
    if (Number(next) > account.credit) return;
    edit(next);
  };

  /* Scripted walkthrough: drives the same handlers a person would. */
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const pressRef = useRef(press); pressRef.current = press;
  const tap = async (keys, run, gap = 150) => {
    for (const k of keys) { if (playRef.current !== run) return; pressRef.current(k); await wait(gap); }
  };
  const reset = (value = '', kb = false) => { clearTimeout(timer.current); setMatching(false); setRaw(value); setKeypad(kb); setSheet(null); setSelection({}); setLoan(null); setAccount({ credit: CREDIT, coupons: COUPONS }); };

  /* R9: borrow → status screen → the reminder can bring the user back with what is left. */
  const borrow = () => {
    if (!amount || bar.state === 'matching' || amount > account.credit) return;
    stop();
    const next = settleLoan({ amount, credit: account.credit, coupons: account.coupons, selection });
    setLoan({ amount, reminder: getReminder(next) });
    setAccount({ credit: next.credit, coupons: next.coupons });
    setRaw(''); setSelection({}); setKeypad(false); setSheet(null);
  };
  const reborrow = () => { setLoan(null); setRaw(''); setSelection({}); };

  const runStep = async (i, run) => {
    setStep(i);
    const steps = {
      0: async () => reset(),
      1: async () => { setKeypad(true); await wait(450); await tap('8000', run); },
      2: async () => { await wait(300); setKeypad(false); },
      3: async () => { setKeypad(true); await wait(450); await tap(['del'], run, 140); },
      4: async () => { setKeypad(false); await wait(400); if (playRef.current === run) openSheet('select'); },
      5: async () => { setSheet(null); await wait(450); setKeypad(true); await wait(400); await tap(['del', 'del', 'del'], run, 110); await tap('1000', run); await wait(MATCH_DELAY + 500); if (playRef.current === run) setKeypad(false); },
    };
    await steps[i]();
  };

  const play = async () => {
    const run = ++playRef.current;
    setPlaying(true); setTried(null);
    const holds = [1200, 1300, 2000, 2200, 2800, 2400];
    do {
      reset();
      for (let i = 0; i < STEPS.length; i++) {
        if (playRef.current !== run) return;
        await runStep(i, run);
        await wait(holds[i]);
      }
    } while (RECORD && playRef.current === run);
    if (playRef.current === run) { setPlaying(false); setStep(-1); }
  };
  const stop = () => { playRef.current++; setPlaying(false); setStep(-1); setTried(null); };
  const restart = () => { stop(); reset(); };
  // Hint buttons type the amount on the keypad, the same way a person would.
  const [tried, setTried] = useState(null);
  const tryAmount = async (v) => {
    const run = ++playRef.current; setPlaying(false); setStep(-1); setTried(v);
    // Rolling version: a preset jumps straight to the new amount, so every column spins like an odometer.
    if (ROLL) { setKeypad(false); setSheet(null); setLoan(null); edit(v); return; }
    reset('', true); await wait(250);
    await tap(v, run, 90);
    await wait(MATCH_DELAY + 300);
    if (playRef.current === run) setKeypad(false);
  };

  // Fit the real-size phone to the window height.
  // Desktop: real-size phone in a frame, fitted to the window.
  // Phone browser: no frame, the prototype fills the screen and is used by touch.
  const [view, setView] = useState({ zoom: 1, mobile: false, h: 844 });
  useEffect(() => {
    const fit = () => {
      const mobile = false; // phones get the same framed layout as desktop, just scaled to fit
      if (mobile) {
        const w = document.documentElement.clientWidth, h = window.visualViewport?.height ?? window.innerHeight;
        const zoom = w / 390;
        setView({ zoom, mobile, h: Math.floor(h / zoom) });
      } else {
        setView({ zoom: Math.min(RECORD ? 2 : 1, ((window.visualViewport?.height ?? window.innerHeight) - (RECORD ? 48 : window.innerWidth < 500 ? 118 : 150)) / 864, (window.innerWidth - 32) / 410), mobile, h: 844 });
      }
    };
    fit(); window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);

  // Physical keyboard: digits, ".", Backspace, Enter, Esc. The on-screen key lights up too.
  const [flash, setFlash] = useState(null);
  const keyRef = useRef(null);
  keyRef.current = (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    let k = null;
    if (/^[0-9]$/.test(e.key)) k = e.key;
    else if (e.key === '.' || e.key === 'Decimal') k = '.';
    else if (e.key === 'Backspace' || e.key === 'Delete') k = 'del';
    else if (e.key === 'Enter') k = 'ok';
    else if (e.key === 'Escape') k = 'esc';
    if (!k) return;
    e.preventDefault();
    stop();
    if (k === 'esc') { setSheet(null); setKeypad(false); return; }
    if (k === 'ok') {
      if (sheet) return confirmSheet();           // Enter = Confirm on the sheet
      if (!keypad) return setKeypad(true);       // Enter opens the keypad
    } else {
      if (sheet) return;
      setKeypad(true);
    }
    press(k);
    setFlash(k);
    setTimeout(() => setFlash((f) => (f === k ? null : f)), 140);
  };
  useEffect(() => {
    if (RECORD) return;
    const h = (e) => keyRef.current(e);
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  useEffect(() => { if (RECORD) play(); return () => clearTimeout(timer.current); }, []);

  const caption = step >= 0 ? STEPS[step] : tried ? { note: TRY.find((t) => t.v === tried).what } : null;

  return (
    <main className={RECORD ? 'page record' : view.mobile ? 'page mobile' : 'page'}>
      <div className="stage" style={{ width: (view.mobile ? 390 : 410) * view.zoom, height: (view.mobile ? view.h : 864) * view.zoom, '--z': view.zoom, '--screen-h': view.h + 'px' }}>
        <Phone
          raw={raw}
          bar={bar}
          amount={amount}
          list={list}
          keypad={keypad}
          flash={flash}
          sheet={sheet}
          onFocus={() => { stop(); setKeypad(true); }}
          onPress={(k) => { stop(); press(k); }}
          onOpenSheet={(v) => { stop(); openSheet(v); }}
          onCloseSheet={() => setSheet(null)}
          onPick={pick}
          onConfirm={confirmSheet}
          credit={account.credit}
          loan={loan}
          onBorrow={borrow}
          onDone={() => { stop(); reset(); }}
          onReborrow={reborrow}
        />
      </div>

      {!RECORD && !view.mobile && (
        <header className="meta">
          <div className="meta-title">Offer row</div>
          <div className="meta-sub">WeChat Pay · Shuyi Yuan</div>
        </header>
      )}

      {!RECORD && !view.mobile && (
        <div className="dock-area">
          <p className="caption" aria-live="polite">
            {playing && step >= 0 && (
              <span className="progress" aria-hidden="true">
                {STEPS.map((_, i) => <i key={i} className={i < step ? 'done' : i === step ? 'now' : ''} />)}
              </span>
            )}
            {caption && <span key={caption.note} className="caption-in">{caption.note}</span>}
          </p>
          <div className="dock" role="toolbar" aria-label="Demo controls">
            <span className="dock-label">Try</span>
            {TRY.map((t) => (
              <button key={t.v} className={tried === t.v ? 'chip on' : 'chip'} onClick={() => tryAmount(t.v)}>¥{t.label}</button>
            ))}
            <span className="dock-sep" aria-hidden="true" />
            <button className="dock-btn" onClick={playing ? stop : play}>
              {playing ? <StopIcon /> : <PlayIcon />}
              <span>{playing ? 'Stop' : 'Replay'}</span>
            </button>
            <button className="dock-icon" onClick={restart} aria-label="Reset" title="Reset"><ResetIcon /></button>
          </div>
        </div>
      )}
    </main>
  );
}

/* ─────────────────────────────  Phone  ───────────────────────────── */
function Phone({ raw, bar, amount, list, keypad, flash, sheet, onFocus, onPress, onOpenSheet, onCloseSheet, onPick, onConfirm, credit, loan, onBorrow, onDone, onReborrow }) {
  const detailed = bar.state === 'applied' || bar.state === 'declined' || bar.state === 'unavailable';
  return (
    <div className="phone" role="img" aria-label="Loan page prototype">
      <div className="screen">
        <StatusBar />
        <div className="nav"><img src={arrowLeft} width="12" height="24" alt="" /></div>
        <div className="amount-block">
          <div className="label">Loan Amount</div>
          <button className="amount" onClick={onFocus} aria-label="Edit loan amount">
            <span className="yen">¥</span>
            {ROLL ? <RollingDigits value={raw} /> : <span className="digits">{raw}</span>}
            {(keypad || raw === '') && <span className="caret" />}
          </button>
          <div className="credit">Available Credit ¥{credit.toFixed(2)}</div>
        </div>

        {bar.showBar && <OfferArea bar={bar} amount={amount} onOpen={onOpenSheet} />}

        <div className={detailed ? 'account show' : 'account'}>
          <div className="row"><span className="k">Account</span><span className="v"><BankIcon /> CMB Debit Card (8746)</span><Chevron right /></div>
          <div className="row"><span className="k">Purpose</span><span className="v">Daily Expenses</span><Chevron right /></div>
        </div>

        <div className={keypad ? 'cta hide' : 'cta'}>
          <button className="borrow" disabled={!amount || bar.state === 'matching'} onClick={onBorrow}>Borrow</button>
        </div>

        <Keypad open={keypad} flash={flash} onPress={onPress} />
        {loan && <Status key={loan.amount + '-' + credit} loan={loan} onDone={onDone} onReborrow={onReborrow} />}
        <Sheet variant={sheet} list={list} amount={amount} onClose={onCloseSheet} onPick={onPick} onConfirm={onConfirm} />
        <div className="home" aria-hidden="true" />
      </div>
    </div>
  );
}

/* Rolling digits. Each position is a 0–9 strip behind a 44px window:
   typed digits rise in, deleted ones drop out, and a jump to a new amount spins
   every column to its new digit, right to left, like an odometer. */
let rollId = 0;
function RollingDigits({ value }) {
  const [items, setItems] = useState(() => [...value].map((ch) => ({ id: ++rollId, ch, state: 'idle' })));
  const prev = useRef(value);
  useEffect(() => {
    const from = prev.current; prev.current = value;
    if (from === value) return;
    setItems((cur) => {
      const live = cur.filter((it) => it.state !== 'out');
      const next = [...value].map((ch, i) => (live[i] ? { ...live[i], ch, state: 'idle' } : { id: ++rollId, ch, state: 'in' }));
      const leaving = live.slice(value.length).map((it) => ({ ...it, state: 'out' }));
      return [...next, ...leaving];
    });
    const t = setTimeout(() => setItems((cur) => cur.filter((it) => it.state !== 'out')), 220);
    return () => clearTimeout(t);
  }, [value]);
  const n = items.filter((it) => it.state !== 'out').length;
  return (
    <span className="digits roll" aria-label={value}>
      {items.map((it, i) => (
        <span key={it.id} className={'col ' + it.state} style={{ '--d': /\d/.test(it.ch) ? it.ch : 0, '--delay': Math.max(0, n - 1 - i) * 30 + 'ms' }} aria-hidden="true">
          {/\d/.test(it.ch)
            ? <span className="strip">{'0123456789'.split('').map((d) => <span key={d}>{d}</span>)}</span>
            : <span className="strip">{it.ch}</span>}
        </span>
      ))}
    </span>
  );
}

/* The anchor: same top edge, same row. Height and content animate in place. */
function OfferArea({ bar, amount, onOpen }) {
  const inner = useRef(null);
  const [h, setH] = useState(52);
  useLayoutEffect(() => {
    const el = inner.current;
    const ro = new ResizeObserver(() => setH(el.offsetHeight));
    ro.observe(el); setH(el.offsetHeight);
    return () => ro.disconnect();
  }, []);

  const s = bar.state;
  const t = s === 'applied' || s === 'declined' ? terms(amount, bar.applied) : s === 'unavailable' ? terms(amount, { interestFree: null, rateDiscount: null }) : null;

  return (
    <div className={`offer ${s}`} style={{ height: h }}>
      <div ref={inner} className="offer-inner">
        {s === 'preview' && (
          <button className="row preview" onClick={() => onOpen('all')}>
            <span className="gold swap" key="p">{bar.text}</span>
            <span className="link">View all</span>
          </button>
        )}

        {s === 'matching' && (
          <div className="row matching swap" key="m"><Spinner /> {bar.text}</div>
        )}

        {(s === 'applied' || s === 'declined' || s === 'unavailable') && (
          <>
            {s !== 'unavailable' ? (
              <button className="row offer-row" onClick={() => onOpen('select')}>
                <span className="k">Offer</span>
                <span className={`v swap ${s === 'applied' ? 'gold' : 'faint'}`} key={bar.text}>{bar.text}</span>
                <Chevron right gold={s === 'applied'} />
              </button>
            ) : (
              <button className="row offer-row" onClick={() => onOpen('select')}>
                <span className="k">Offer</span>
                <span className="v faint swap" key={bar.text}>{bar.text}<Chevron right inline /></span>
              </button>
            )}
            <div className="row fade"><span className="k">Interest</span><span className="v">{t.interest}</span></div>
            <div className="row fade"><span className="k">Rate</span><span className="v">{t.rate}</span></div>
            <div className="row fade"><span className="k">Details</span><span className="v">Interest accrues daily. Repay any amount early from the next day.</span></div>
          </>
        )}
      </div>
    </div>
  );
}

function Keypad({ open, flash, onPress }) {
  const c = (k, base = 'key') => (flash === k ? base + ' pressed' : base);
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
  return (
    <div className={open ? 'keypad open' : 'keypad'} aria-hidden={!open}>
      <div className="keypad-fade" aria-hidden="true" />
      <div className="keys">
        {keys.map((k) => <button key={k} className={c(k)} tabIndex={open ? 0 : -1} onClick={() => onPress(k)}>{k}</button>)}
        <button className={c('0', 'key zero')} tabIndex={open ? 0 : -1} onClick={() => onPress('0')}>0</button>
        <button className={c('.')} tabIndex={open ? 0 : -1} onClick={() => onPress('.')}>.</button>
      </div>
      <div className="side">
        <button className={c('del')} aria-label="Delete" tabIndex={open ? 0 : -1} onClick={() => onPress('del')}><DelIcon /></button>
        <button className={c('ok', 'key confirm')} tabIndex={open ? 0 : -1} onClick={() => onPress('ok')}>Confirm</button>
      </div>
    </div>
  );
}

/* Status after Borrow (Figma 2909 → 2910). Processing counts down, then funds are on the way. */
function Status({ loan, onDone, onReborrow }) {
  const [left, setLeft] = useState(5);
  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);
  const sent = left <= 0;
  const money = '¥' + loan.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (
    <div className={sent ? 'status-page sent' : 'status-page'}>
      <StatusBar />
      <div className="st-label">Status</div>
      <div className="st-line l1" />
      <div className="st-line l2" />
      <svg className="st-dot d1" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="4" /></svg>
      <svg className="st-dot d2" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="4" /></svg>
      <img className="st-clock c2" src={clockIcon} width="40" height="40" alt="" />
      <svg className="st-dot d3" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="4" /></svg>
      <img className="st-clock c3" src={clockIcon} width="40" height="40" alt="" />
      <div className="st-text t1"><div className="st-title">Loan Submitted</div><div className="st-sub">Loan amount {money}</div></div>
      <div className="st-text t2"><div className="st-title">{sent ? 'Bank Approved' : `Bank Processing (${left}s)`}</div></div>
      <div className="st-text t3">
        <div className="st-title">Funds Sent to Your Account</div>
        <div className="st-sub">{sent ? 'Expected in CMB Debit Card (8746) within 2 hours' : 'CMB Debit Card (8746)'}</div>
      </div>
      {loan.reminder && (
        <button className="st-reminder" onClick={onReborrow}>{loan.reminder.text}<img src={arrowRightOrange} width="10" height="20" alt="" /></button>
      )}
      <button className="st-done" onClick={onDone}>Done</button>
      <div className="home" aria-hidden="true" />
    </div>
  );
}

/* Two sheets from the Figma file: "Coupons" (view all, before an amount) and "Select Offers". */
function Sheet({ variant, list, amount, onClose, onPick, onConfirm }) {
  const last = useRef('all');
  if (variant) last.current = variant;
  const v = last.current;
  const select = v === 'select';
  return (
    <div className={variant ? 'sheet-wrap open' : 'sheet-wrap'} aria-hidden={!variant}>
      <div className="scrim" onClick={onClose} />
      <div className={`sheet ${v}`} role="dialog" aria-label={select ? 'Select Offers' : 'Coupons'}>
        <header>
          {select ? (
            <button className="close x" aria-label="Close" onClick={onClose}><CloseIcon /></button>
          ) : (
            <button className="close round" aria-label="Close" onClick={onClose}><Chevron down /></button>
          )}
          <div className="title">{select ? 'Select Offers' : 'Coupons'}</div>
          <div className="scope">{select ? 'One per type, different types can combine' : 'Coupons for「Bank Loans」Only'}</div>
        </header>
        <div className="sheet-body">
          {list.map((g) => (
            <section key={g.type}>
              <h3>{select ? g.title.replace(' Coupon', '') : g.title}</h3>
              {g.items.map(({ coupon: c, usable, reasonText, selected }) => {
                const off = select && !usable && amount != null;
                const rate = c.type === 'rateDiscount';
                return (
                  <Row key={c.id} pickable={select && !off} className={`coupon${off ? ' off' : ''}`} onClick={() => onPick(c)} selected={selected}>
                    {select && <img className="check" src={selected ? checkOn : off ? checkDisabled : checkOff} width="24" height="24" alt="" />}
                    <div className="ticket">
                      <div className="l">
                        <div>{rate ? c.title : 'Interest-Free'}</div>
                        <div className="sub">{c.expires}</div>
                      </div>
                      <div className="r">
                        <div className="strong">{rate ? <>{`${+(0.04 * (1 - c.discount)).toFixed(3)}%`}<s>0.04%</s></> : c.title}</div>
                        <div className="sub">{select ? `${yuan(c.minAmount)} minimum loan` : `Minimum loan ${yuan(c.minAmount)}`}</div>
                        {off && <div className="sub">{reasonText}</div>}
                      </div>
                    </div>
                  </Row>
                );
              })}
            </section>
          ))}
        </div>
        {select && <footer><button className="confirm-wide" onClick={onConfirm}>Confirm</button></footer>}
      </div>
    </div>
  );
}

/* ── small icons ── */
const Chevron = ({ right, down, gold, inline }) =>
  right ? (
    <img className={inline ? 'arrow inline' : 'arrow'} src={gold ? arrowRightGold : arrowRight} width="10" height="20" alt="" />
  ) : (
    <svg className={down ? 'chev d' : 'chev'} width="10" height="16" viewBox="0 0 10 16" aria-hidden="true">
      <path d="M8 2 2 8l6 6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
const Spinner = () => <span className="spinner" aria-hidden="true" />;
// A usable coupon in "Select Offers" is a real button; everything else is static.
const Row = ({ pickable, selected, children, ...rest }) =>
  pickable ? <button type="button" role="radio" aria-checked={selected} {...rest}>{children}</button> : <div {...rest}>{children}</div>;
const Check = () => (<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 6.2 5 8.6l4.6-5" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>);
const CloseIcon = () => (<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="m2 2 12 12M14 2 2 14" stroke="#111" strokeWidth="1.5" strokeLinecap="round" /></svg>);
const DelIcon = () => <img src={deleteIcon} width="24" height="24" alt="" />;
const BankIcon = () => <img src={bankIcon} width="20" height="20" alt="" />;
const StatusBar = () => (
  <div className="status">
    <span>9:41</span>
    <img src={statusRight} width="78" height="13" alt="" />
  </div>
);
