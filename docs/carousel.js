/**
 * Carousel: a round slide-projector tray holding sixteen slides on edge, in
 * radial slots round a hub. At rest the slide at the gate stands half out.
 * The slide nearest the pointer rises out of its slot and its neighbours rise
 * less, staggered outwards from it on the 700ms lift curve. Each slide is a
 * square mount with its film window; the hub carries the lock knob. The
 * slider is the stagger, in ms.
 *
 * The pattern: discrete items (Riffle's). Tweens, a stagger by ring distance,
 * and a hit test against each slide's fixed lane on screen, from its seated
 * foot to its fully raised top, so a rising slide cannot flip the choice.
 */
const {
  Cam, facing, fit, hull, open, poly, prism, proj, ringAt, rrect, run,
  tdone, tset, tval, tween, disposer, mk, pointer, put, reflect, register, solid,
} = HL;

const N = 16, GATE = 4;                       // slides, and the slot at the projector's gate
const RO = 62, WT = 3, WH = 12, FL = 2;        // tray: outer radius, wall, wall height, floor
const RA = 27, RB = 56, SH = 26, TK = 1.6;     // a slide: inner and outer radius, height, thickness
const HUB = 15, HH = 13, KNOB = 6, KH = 4;     // hub and its lock knob
const LIFT = 24, REST_LIFT = 10, NEAR = [1, 0.55, 0.25, 0.08];
const MID = (RA + RB) / 2, REACH = 22;          // a slide's lane on screen, and how far from it a pointer still counts

// half a slot off the axes, so no slide points straight at the viewer and draws edge-on as a hairline
const ang = (i) => ((i + 0.5) / N) * Math.PI * 2;
const ringDist = (i, a) => { const d = Math.abs(i - a) % N; return Math.min(d, N - d); };
/** A run of points ordered left to right on screen. */
const LR = (pts) => (pts[0][0] <= pts[pts.length - 1][0] ? pts : pts.slice().reverse());
const disc = (R, n = 14) => rrect(-R, -R, R, R, R, n);

/** The tray, which never moves: `far` is painted before the slides, `near` after them. */
function tray(P, front) {
  const outer = disc(RO), inner = disc(RO - WT);
  const far = [
    [poly(hull(ringAt(P, outer, 0).concat(ringAt(P, outer, WH)))), "sil"],
    [poly(ringAt(P, inner, WH)), "nf"],
    [open(ringAt(P, run(inner, (q) => !front(q)), FL + 0.5)), "nf lo"],
  ];
  const iF = LR(ringAt(P, run(inner, front), WH)), oT = LR(ringAt(P, run(outer, front), WH)), oB = LR(ringAt(P, run(outer, front), 0));
  const near = [
    [poly([...iF, oT[oT.length - 1], ...oB.slice().reverse(), oT[0]]), "fo"],
    [open(oT), "nf lo"],
    [open(iF), "nf"],
    [open([oT[0], ...oB, oT[oT.length - 1]]), "nf sil"],
  ];
  return { far, near };
}

/** Slide i lifted by `lift`: its back, its face and its film window, as path strings. */
function pose(P, i, lift, nearSide) {
  const c = Math.cos(ang(i)), s = Math.sin(ang(i));
  // the face is the side of the plate turned towards the viewer (+x +y)
  const t = nearSide ? 1 : -1, tx = -s * t, ty = c * t;
  const at = (u, v, off) => P(c * (RA + u) + tx * off, s * (RA + u) + ty * off, FL + lift + v);
  const mount = rrect(0, 0, RB - RA, SH, 2.6, 4), win = rrect(5, 6, RB - RA - 5, SH - 6, 1.4, 4);
  return {
    back: poly(mount.map((q) => at(q.u, q.v, -TK / 2))),
    face: poly(mount.map((q) => at(q.u, q.v, TK / 2))),
    win: poly(win.map((q) => at(q.u, q.v, TK / 2))),
  };
}

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let stag = value;

  // Fitted to the tray with every slide fully lifted, so nothing leaves the frame in any pose.
  const C = Cam(45, 0.5, 1.95);
  const extreme = [[RO, 0, 0], [-RO, 0, 0], [0, RO, 0], [0, -RO, 0], [RO * 0.71, RO * 0.71, 0], [-RO * 0.71, -RO * 0.71, 0]];
  for (let i = 0; i < N; i++) extreme.push([Math.cos(ang(i)) * RB, Math.sin(ang(i)) * RB, FL + SH + LIFT]);
  fit(C, extreme, 200, 166);
  const P = proj(C), front = facing(C);
  const paths = tray(P, front);

  const g = mk("g", {}, svg);
  reflect(svg, g, P, front, disc(RO), 0, 14);
  for (const [d, cls] of paths.far) mk("path", { d, class: cls }, g);

  // Slides behind the hub, the hub, then the slides in front: painting back to front.
  const depth = (i) => Math.cos(ang(i)) + Math.sin(ang(i));
  const order = [...Array(N).keys()].sort((a, b) => depth(a) - depth(b));
  const slides = new Array(N);
  const addSlide = (i) => {
    const grp = mk("g", {}, g);
    slides[i] = {
      near: -Math.sin(ang(i)) + Math.cos(ang(i)) >= 0,
      back: mk("path", { class: "lo" }, grp), face: mk("path", { class: "sil" }, grp), win: mk("path", { class: "nf lo" }, grp),
      z: tween(i === GATE ? REST_LIFT : 0), drawn: NaN,
    };
  };
  order.filter((i) => depth(i) < 0).forEach(addSlide);
  put(solid(g), prism(P, front, disc(HUB), disc(HUB - 1.6), 0, HH));
  put(solid(g), prism(P, front, disc(KNOB, 8), disc(KNOB - 1, 8), HH, HH + KH));
  order.filter((i) => depth(i) >= 0).forEach(addSlide);
  for (const [d, cls] of paths.near) mk("path", { d, class: cls }, g);

  function draw(i, lift) {
    const sl = slides[i];
    if (lift === sl.drawn) return;
    sl.drawn = lift;
    const q = pose(P, i, lift, sl.near);
    sl.back.setAttribute("d", q.back);
    sl.face.setAttribute("d", q.face);
    sl.win.setAttribute("d", q.win);
  }

  const B = register(stage, (_dt, now) => {
    let moving = false;
    slides.forEach((sl, i) => { draw(i, tval(sl.z, now)); if (!tdone(sl.z, now)) moving = true; });
    return moving;
  });
  bag.add(B.unregister);

  /** Each slide's lane: the screen segment from its seated middle to its fully raised top. Fixed, never redrawn. */
  const lanes = slides.map((_, i) => {
    const x = Math.cos(ang(i)) * MID, y = Math.sin(ang(i)) * MID;
    return [P(x, y, FL + SH / 2), P(x, y, FL + SH + LIFT)];
  });
  /** [distance off the lane, distance along it from the seated middle], in viewBox units. */
  const toLane = ([px, py], [[ax, ay], [bx, by]]) => {
    const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy);
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (len * len)));
    return [Math.hypot(px - ax - t * dx, py - ay - t * dy), t * len];
  };
  /** The slide whose lane is nearest the pointer; where lanes line up on screen, the one seated nearest wins. -1 when none is within reach. */
  function hit(p) {
    let best = -1, bc = Infinity;
    lanes.forEach((ln, i) => {
      const [off, along] = toLane(p, ln), cost = off + 0.35 * along;
      if (off < REACH && cost < bc) { bc = cost; best = i; }
    });
    return best;
  }

  let act = -1;
  const lit = (i) => (act < 0 ? i === GATE : i === act);
  const caption = (a) => (a < 0 ? "rest" : "slide " + String(a + 1).padStart(2, "0"));
  /** Raises slide a (-1 seats them all, the gate's half out). The stagger spreads from the slide raised, or the one let go. */
  function setActive(a) {
    if (a === act) return;
    const now = performance.now(), from = a >= 0 ? a : act;
    act = a;
    slides.forEach((sl, i) => {
      const d = ringDist(i, from);
      const to = a < 0 ? (i === GATE ? REST_LIFT : 0) : LIFT * (NEAR[ringDist(i, a)] || 0);
      tset(sl.z, to, now, d * stag);
      sl.face.classList.toggle("hi", lit(i));
    });
    read.textContent = caption(a);
    B.wake();
  }

  slides.forEach((sl, i) => sl.face.classList.toggle("hi", lit(i)));
  bag.add(pointer(stage, { move: (p) => setActive(hit(p)), leave: () => setActive(-1) }));
  bag.add(() => svg.replaceChildren());

  return {
    set: (v) => { stag = v; },
    destroy: bag.dispose,
  };
}

hairline({
  name: "carousel",
  means: "A slide tray of sixteen: the slide nearest the pointer rises out of its slot, and its neighbours follow it up in turn.",
  rules: [1, 2, 5, 8],
  range: [0, 45, 90],
  tour: [[216, 210], [121, 162], [267, 148], null],
  mount,
});
