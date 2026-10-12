/**
 * Dock: an upright browser window with two tabs, the second in front. A second
 * window stands hidden just behind it. The pointer's position across the
 * figure runs one spring through three acts: a new tab rises in the strip,
 * right beside the one in front; that tab pulls its own window out from behind
 * the first and carries it to the right; then the window steps forward and
 * slides back over the first, settling in front of it as the active tab, its
 * player covering the page. The new tab is the bright mark; once its window is
 * mostly out, the window's outline takes the bright stroke too. The two
 * windows part symmetrically, the first stepping left as the new one steps
 * right, so the figure stays centred on its rest pose throughout. The slider
 * is how far apart they travel before the new one comes round.
 *
 * The pattern: scrub (Exploded's), staged. One spring, read as three phases,
 * and a hit test on a fixed screen band, so the moving window never changes
 * what the pointer reads. The window changes depth only while it stands clear
 * of the first, so its swap in the paint order never shows.
 */
const {
  Cam, clamp, fillet, fit, poly, proj, rrect, seg,
  spring, stepS, disposer, mk, pointer, register,
} = HL;

const W = 150, H = 92, R = 6, TK = 2.4;           // a window, in its own (u, v) plane, and its thickness
const TW = 34, TH = 14, PITCH = 38, U0 = 10;        // a tab: width, height, slot pitch, first slot's left edge
const ACTIVE = 1, NEW = 2;                           // the tab in front at rest, and the slot the new one opens in
const GAP = 10, SINK = TH + 2;                       // how far behind (then ahead) the moving window stands, how far its tab hides
const A1 = 0.22, A2 = 0.55, A3 = 0.7;                // the scrub's acts: rise until A1, out until A2, forward until A3, then home
const MAX_TRAVEL = 172;
const ease = (t) => t * t * (3 - 2 * t);
const part = (p, a, b) => ease(clamp((p - a) / (b - a), 0, 1));

const TAB = fillet([[0, 0], [TW, 0], [TW - 4, TH], [4, TH]], [0.5, 0.5, 3, 3]);
const FACE = fillet([[0, 0], [W, 0], [W, H], [0, H]], [R, R, R, R]);

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let travel = value;

  const C = Cam(45, 0.5, 1.5);
  // Fitted to both windows at their widest parting, which is symmetric about the rest pose.
  const HALF = MAX_TRAVEL / 2;
  fit(C, [
    [-HALF, -TK, 0], [-HALF, 0, H + TH], [W, GAP, 0], [0, GAP, H + TH],
    [HALF + W, -GAP, 0], [HALF + W, GAP, 0], [HALF + W, GAP, H + TH], [HALF, -GAP, H + TH],
  ], 200, 166);
  const P = proj(C);
  /** A world point on a window's plane: u along it, v up it, at depth y. */
  const at = (u, v, y) => P(u, y, v);
  const shape = (pts, du, dv, y) => poly(pts.map(([u, v]) => at(u + du, v + dv, y)));
  const box = (u0, v0, u1, v1, r, du, y) => poly(rrect(u0, v0, u1, v1, r, 4).map((q) => at(q.u + du, q.v, y)));
  const tabAt = (slot, du, lift, y) => shape(TAB, U0 + slot * PITCH + du, H - 2 + lift, y - TK / 2);

  const g = mk("g", {}, svg);

  // The moving window, in its own group: behind the first while y < 0, moved after it once it steps forward.
  const backG = mk("g", {}, g);
  const back = {
    plate: mk("path", { class: "lo" }, backG), tab: mk("path", { class: "sil" }, backG),
    face: mk("path", { class: "sil" }, backG), screen: mk("path", { class: "nf lo" }, backG),
    bar: mk("path", { class: "nf lo" }, backG), knob: mk("circle", { r: 1.6, class: "dot m" }, backG),
    joint: mk("path", { class: "nf" }, backG),
  };

  // The first window, which never moves: plate, its two tabs, face, the dim page, and the joint under the tab in front.
  const frontG = mk("g", {}, g);
  mk("path", { d: shape(FACE, 0, 0, -TK), class: "lo" }, frontG);
  const front = [0, 1].map((i) => mk("path", { d: tabAt(i, 0, 0, 0), class: "sil" }, frontG));
  mk("path", { d: shape(FACE, 0, 0, 0), class: "sil" }, frontG);
  mk("path", {
    d: box(10, H - 20, W - 30, H - 11, 4, 0, 0) + box(W - 24, H - 20, W - 10, H - 11, 3, 0, 0) + box(10, 12, 46, H - 30, 3, 0, 0),
    class: "nf lo",
  }, frontG);
  mk("path", {
    d: [[H - 38, 0.8], [H - 48, 0.66], [H - 58, 0.74], [H - 72, 0.42]].map(([v, f]) => seg(at(56, v, 0), at(56 + (W - 66) * f, v, 0))).join(""),
    class: "nf lo",
  }, frontG);
  const ju = U0 + ACTIVE * PITCH;
  const joint = mk("path", { d: seg(at(ju + 1.5, H, 0), at(ju + TW - 1.5, H, 0)), class: "nf" }, frontG);

  const sp = spring(0, { eps: 0.05 });
  let drawn = NaN, ahead = false;
  function drawBack(p) {
    if (p === drawn) return;
    drawn = p;
    const rise = part(p, 0, A1), fwd = part(p, A2, A3);
    const apart = (part(p, A1, A2) - part(p, A3, 1)) * travel, du = apart / 2, y = -GAP + fwd * 2 * GAP;
    // the first window steps left as far as the new one steps right; the projection is linear, so a shift is exact
    const [ox, oy] = at(0, 0, 0), [fx, fy] = at(-apart / 2, 0, 0);
    frontG.setAttribute("transform", apart ? `translate(${fx - ox} ${fy - oy})` : "");
    if ((y > 0) !== ahead) { ahead = y > 0; ahead ? g.appendChild(backG) : g.insertBefore(backG, frontG); }
    back.plate.setAttribute("d", shape(FACE, du, 0, y - TK));
    back.face.setAttribute("d", shape(FACE, du, 0, y));
    back.tab.setAttribute("d", tabAt(NEW, du, -SINK + rise * SINK, y));
    back.screen.setAttribute("d", box(10, 18, W - 10, H - 10, 4, du, y));
    back.bar.setAttribute("d", seg(at(du + 16, 11, y), at(du + W - 16, 11, y)));
    const [kx, ky] = at(du + 16 + (W - 32) * 0.38, 11, y);
    back.knob.setAttribute("cx", kx); back.knob.setAttribute("cy", ky);
    const nu = U0 + NEW * PITCH + du;
    back.joint.setAttribute("d", rise > 0.4 ? seg(at(nu + 1.5, H, y), at(nu + TW - 1.5, H, y)) : "");
    back.face.classList.toggle("hi", p > A1 + (A2 - A1) * 0.55);
    back.tab.classList.toggle("hi", rise > 0.4);
    front[ACTIVE].classList.toggle("hi", rise <= 0.4);
    joint.setAttribute("d", rise > 0.4 ? "" : seg(at(ju + 1.5, H, 0), at(ju + TW - 1.5, H, 0)));
  }

  const B = register(stage, (dt) => {
    const moving = stepS(sp, dt);
    drawBack(sp.x / 100);
    return moving;
  });
  bag.add(B.unregister);

  // The band the pointer is read on: the widest parting's left edge to its right edge. Fixed.
  const left = at(-HALF, H / 2, 0)[0], right = at(HALF + W, H / 2, -GAP)[0];
  const top = at(-HALF, H + TH, 0)[1] - 12, bottom = at(HALF + W, 0, -GAP)[1] + 12;
  let over = null;

  function retarget() {
    const p = over === null ? 0 : over;
    sp.t = p * 100;
    read.textContent = over === null ? "rest"
      : p < A1 ? "tab 2 → 3"
      : p < A3 ? `tab 3 · ${Math.round(part(p, A1, A2) * 100)}%`
      : `tab 3 · front ${Math.round(part(p, A3, 1) * 100)}%`;
    B.wake();
  }

  bag.add(pointer(stage, {
    move: ([x, y]) => {
      over = y < top - 40 || y > bottom + 40 ? null : clamp(((x - left) / (right - left)) * 1.25 - 0.1, 0, 1);
      retarget();
    },
    leave: () => { over = null; retarget(); },
  }));
  bag.add(() => svg.replaceChildren());
  retarget();

  return {
    set: (v) => { travel = v; drawn = NaN; drawBack(sp.x / 100); },
    destroy: bag.dispose,
  };
}

hairline({
  name: "dock",
  means: "A browser window: a new tab rises beside the one in front, pulls its own window out, then brings it round to the front as the active tab.",
  rules: [1, 3, 4, 6, 8],
  range: [155, 162, 172],
  tour: [[120, 150], [200, 172], [270, 186], [345, 200], null],
  mount,
});
