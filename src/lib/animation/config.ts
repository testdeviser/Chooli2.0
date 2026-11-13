/**
 * Single source of truth for the cinematic introduction.
 * Everything a designer may want to tune lives here: assets, world scale, the walking
 * route, the scroll timeline, the four camera compositions, lighting and text timing.
 */

export const BRAND = {
  navy: '#082D58',
  navyDeep: '#041A35',
  orange: '#FF7100',
  lightBlue: '#B6E3F6',
  offWhite: '#F5F7FA',
  charcoal: '#1F2937',
} as const;

export const LINKS = {
  site: 'https://choolidigitalmarketing.com',
  about: 'https://choolidigitalmarketing.com/about-us',
  contact: 'https://choolidigitalmarketing.com/contact',
  givingBack: 'https://choolidigitalmarketing.com/giving-back',
  seo: 'https://choolidigitalmarketing.com/seo',
  locations: 'https://choolidigitalmarketing.com/locations',
  industries: 'https://choolidigitalmarketing.com/industries',
  blog: 'https://choolidigitalmarketing.com/blog',
  phone: 'tel:+18129877007',
} as const;

/* ------------------------------------------------------------------ assets */

export const MOUNTAIN = {
  /** built from assets/mountain-new-latest.glb by scripts/convert_mountain_glb.py */
  url: '/models/mountain.glb',
  urlLite: '/models/mountain-lite.glb',
  /**
   * The source is 2.9 x 2.6 m. Its southern border is cut 0.37 m above its low northern
   * foot, and the summit rises 0.235 m above that cut. The ground plane is placed at the
   * height of the southern cut (see `anchor`), so the low, holed northern half sits below
   * the plain and only the peak rises out of it. At 150x the summit stands ~35 m above the
   * plain, ~105 m behind the route.
   */
  scale: 150,
  /**
   * Point of the source mesh (Blender coordinates, metres) that is placed at the world
   * origin: x of the summit, height of the southern cut (= ground plane), and the straight
   * southern border. The character walks on the plain just south of it (+z), facing the camera,
   * with the summit straight behind.
   */
  anchor: [0.387, 1.322, -2.4] as [number, number, number],
  /** turns the mountain around its anchor; 0 = summit behind the route */
  rotationY: 0,
  /** the flat ground plane the character walks on; the mountain rises out of it */
  groundY: 0,
  /** optional dusk grade of the mountain texture (0 = original photo colours) */
  grade: 0,
  gradeLow: '#262331',
  gradeHigh: '#d7b592',
  /** how strongly the mountain's border fades into the ground texture (0 = off) */
  edgeFade: 1,
};

/** Procedural snow-and-rock texture of the ground plane (also used at the mountain's foot); colours are per theme. */
export const GROUND = {
  /** 0 = bare rock, 1 = mostly snow */
  snowCover: 0.5,
  /** strength of the surface relief (bump) close to the camera */
  bump: 0.9,
};

/**
 * Copies of the mountain placed around the scene so there is a mountain on the horizon in
 * every direction. `angle` (degrees) is measured around the end of the route, 0 = straight
 * behind the character (where the main mountain is), +90 = screen-right in the opening shot.
 * Each copy is turned to show its good southern face toward the route; `mirror` flips it so
 * repeats are less recognisable. Distances are from the route end to the copy's southern
 * border, in metres; the summit is another ~105 m x `scale` further out.
 */
export const RANGE: { angle: number; distance: number; scale: number; mirror?: boolean; spin?: number }[] = [
  { angle: -34, distance: 230, scale: 1.15, mirror: true, spin: 8 },
  { angle: 33, distance: 225, scale: 1.1, spin: -10 },
  { angle: -95, distance: 210, scale: 0.95, spin: 12 },
  { angle: 92, distance: 200, scale: 1.0, mirror: true, spin: -6 },
  { angle: -150, distance: 230, scale: 1.1, mirror: true, spin: 15 },
  { angle: 150, distance: 240, scale: 1.0, spin: -12 },
  { angle: 180, distance: 270, scale: 1.2, mirror: true },
];

/** world position of the mountain group (anchor at the origin) */
export const mountainPosition: [number, number, number] = [
  -MOUNTAIN.anchor[0] * MOUNTAIN.scale,
  -MOUNTAIN.anchor[1] * MOUNTAIN.scale,
  MOUNTAIN.anchor[2] * MOUNTAIN.scale,
];

export const CHARACTER = {
  /**
   * Gus-v1 (assets/Gus-v1.glb, a static T-pose sculpt) rigged to the Mixamo skeleton with the
   * Idle / Walk / Stretch motions by scripts/gusv1/prep.py + scripts/gusv1/rig.py.
   * The previous Gus is in backups/gus-character-pre-v1-2026-11-13/; the Mixamo stand-in is
   * /models/character.glb.
   */
  url: '/models/gus-character.glb',
  clips: { idle: 'Idle', walk: 'Walk', gesture: 'Stretch' },
  /**
   * The arm stretch (Arm-Stretching.fbx) plays once, in real time, when Gus reaches the
   * "It's me, Gus." screen, then he eases back to standing. It blends out if the visitor
   * scrolls away and replays on the next arrival.
   */
  gesture: {
    /** plays while scroll progress is between the end of the walk and this value */
    until: 0.86,
    blendIn: 0.5,
    blendOut: 0.7,
    /** blend-out time when the visitor scrolls away mid-gesture */
    leave: 0.35,
  },
  /** metres travelled per walk cycle (measured on the retargeted walk) */
  stride: 1.4546,
  scale: 1,
  /** extra Y rotation if a model does not face +Z in its rest pose */
  facingOffset: 0,
  /** approximate standing height, used for camera framing */
  height: 1.79,
  /** hidden in the opening shot; fades in out of the haze over this scroll range */
  fadeIn: [0.07, 0.2] as [number, number],
  /** subtle breathing while standing; the walk itself is always scroll-scrubbed */
  idleBreathing: true,
  /** material overrides keyed by material name (none: Gus uses his own textures) */
  materials: {} as Record<string, { color: string; roughness: number; metalness: number }>,
};

/* ------------------------------------------------------------------- route */

/**
 * Straight route on the flat plain at the southern foot of the mountain.
 * World units (metres), [x, z]. The character walks from `start` toward the camera (+z);
 * the mountain's southern border is at z = 0 and its summit ~105 m behind it.
 * The length is `cycles` whole walk cycles so the walk ends in a neutral passing pose.
 */
export const ROUTE = {
  start: [0, 12] as [number, number],
  direction: [0, 1] as [number, number],
  cycles: 6,
  /** distance over which standing <-> walking is blended at each end */
  blendDistance: 0.55,
  /** share of the walk spent accelerating / decelerating */
  easePortion: 0.2,
};

/**
 * Gus's footprints in the snow, so the walk does not cross an empty field.
 * Generated in code (no image files).
 */
export const LANDSCAPE = {
  footprints: {
    /** distance between the left and right feet (half, metres) */
    gauge: 0.15,
    /** print width x length (metres): a big Bigfoot foot */
    size: [0.3, 0.56] as [number, number],
    /** a print forms this far after the foot that made it (metres along the walk) */
    formAfter: 0.3,
    color: '#46607f',
    opacity: 0.78,
  },
};

/** Lenis smooth scrolling for the whole page. */
export const SMOOTH_SCROLL = {
  /** 0..1: lower = smoother / longer glide, higher = snappier */
  lerp: 0.06,
  /** scales wheel / touchpad distance per gesture */
  wheelMultiplier: 0.8,
};

/* ---------------------------------------------------------------- timeline */

/** Scroll progress (0..1) across the pinned introduction. */
export const TIMELINE = {
  walk: [0.2, 0.55] as [number, number],
  /** total scroll length of the pinned intro, in viewport heights */
  scrollLengthVh: 465,
  /**
   * Scroll position (0..1 of the scrubbed range) -> timeline progress, piecewise linear.
   * The first stretch (opening mountain -> "It's me, Gus." at 0.555) is compressed so the
   * visitor reaches Gus quickly (~0.7 viewport heights); the rest keeps its earlier pace.
   */
  scrollMap: [
    [0, 0],
    [0.264, 0.555],
    [1, 1],
  ] as [number, number][],
  /**
   * ScrollTrigger scrub: `true` locks the intro to the scroll position. Lenis already
   * smooths the scroll itself, so adding a second delay here would only feel rubbery.
   */
  scrub: true as number | boolean,
};

/**
 * Camera compositions. Coordinates are in the route's local frame:
 *   [side, up, front]  -  side = screen-right when facing the character,
 *                         front = toward the opening camera.
 * `cam` is measured from the END of the route (where the character stops),
 * `look` is measured from the character's CURRENT position, so the camera keeps
 * tracking the character while it walks.
 */
export interface Shot {
  name: string;
  at: number;
  cam: [number, number, number];
  look: [number, number, number];
  fov: number;
}

export const SHOTS: Shot[] = [
  // Camera A - wide establishing shot
  { name: 'A  wide', at: 0.0, cam: [2.5, 8.6, 41], look: [0, 7, 0], fov: 38 },
  { name: 'A  settle', at: 0.2, cam: [2.0, 8.0, 39], look: [0, 6.5, 0], fov: 38 },
  // Camera B - lower, closer tracking shot while Gus walks in (slightly to his side)
  { name: 'B  track', at: 0.37, cam: [3.4, 2.3, 11.5], look: [0, 1.45, 0], fov: 37 },
  // Camera C - "It's me, Gus." medium shot
  { name: 'C  gus', at: 0.55, cam: [0.0, 0.95, 4.5], look: [0, 1.3, 0], fov: 40 },
  { name: 'C  hold', at: 0.72, cam: [-0.3, 0.95, 4.25], look: [0, 1.3, 0], fov: 40 },
  // Camera D - three-quarter view, ~30 degrees off frontal, character left of frame
  { name: 'D  about', at: 0.9, cam: [-2.3, 1.0, 3.98], look: [1.0, 1.3, 0.58], fov: 40 },
  { name: 'D  drift', at: 1.0, cam: [-2.48, 1.02, 3.86], look: [1.0, 1.3, 0.58], fov: 40 },
];

/** Animated clouds drawn in the sky dome (behind every mountain); colours and cover are per theme. */
export const CLOUDS = {
  /** larger = smaller, more numerous clouds */
  size: 1.5,
  opacity: 1,
  /** drift direction in the route frame [side, front] and overall speed */
  wind: [0.022, -0.01] as [number, number],
  speed: 1,
};

/** Soft filled brand word standing behind the main peak in the opening shot. */
export const BRAND_WORD = {
  text: 'CHOOLI',
  /** world position of the centre of the word (metres); the summit is at z = -105 */
  position: [0, 64, -300] as [number, number, number],
  /** plane size in metres; the word fills ~94% of the width */
  size: [420, 105] as [number, number],
  /** extra space between letters, in em */
  letterSpacing: 0.14,
  /** colours and transparency of the letters are per theme (THEMES[...].word) */
  /** seconds between light sweeps across the word */
  sweepEvery: 6,
  /** on load the word rises this many metres from behind the mountain */
  riseFrom: 70,
  /** scroll progress over which the word fades out */
  fade: [0.1, 0.3] as [number, number],
};

/** One-time opening sequence, in seconds from the moment the scene is first shown. */
export const INTRO = {
  /** the mountain alone, then CHOOLI rises from behind it */
  wordAt: 1.0,
  wordDuration: 2.6,
  /** the floating header slides in */
  headerAt: 3.0,
  /** the hero copy and scroll hint appear */
  copyAt: 3.6,
};

export const CAMERA = {
  /** mouse parallax: camera offset as a share of its distance to the subject [side, up] */
  parallax: [0.035, 0.018] as [number, number],
  near: 0.1,
  far: 600,
  /** camera never drops closer than this to the terrain */
  minClearance: 0.7,
  /**
   * Opening pull-back (disabled for reduced motion): the camera starts this far from the
   * wide shot, in the route frame [side, up, front] (negative front = toward the mountain),
   * and eases back over `duration` seconds. Scrolling to `scroll` progress finishes it.
   */
  pullBack: {
    from: [0, 9, -40] as [number, number, number],
    /** while close, the camera aims this much further up/out (toward the summit) */
    lookFrom: [0, 26, -95] as [number, number, number],
    duration: 4.5,
    scroll: 0.07,
  },
};

/* ------------------------------------------------------------- environment */

export const ENVIRONMENT = {
  /** where the sun's glow sits on the horizon, route frame [side, front] */
  glowDirection: [20, -13] as [number, number],
  rimDirection: [-12, 9, -16] as [number, number, number],
  shadowRadius: 8,
};

/* ------------------------------------------------------------------ themes */

export type ThemeName = 'morning' | 'night';

/**
 * The two looks of the scene. Everything that changes between them lives here; switching
 * cross-fades every value over THEME_TRANSITION seconds.
 */
export const THEMES = {
  morning: {
    label: 'Morning',
    /** sunrise: deep blue overhead, peach horizon, low warm sun lighting the peaks */
    sky: { zenith: '#1d4c9a', mid: '#5b8ed6', horizon: '#f2cdbb', glow: '#ffae74' },
    fogColor: '#c8cde2',
    fogDensity: 0.0027,
    /** key light direction in the route frame [side, up, front] */
    sunDirection: [22, 11, 7] as [number, number, number],
    sunColor: '#ffd9b8',
    sunIntensity: 5.0,
    rimColor: '#ffd6bd',
    rimIntensity: 1.0,
    fillColor: '#c9d6f0',
    fillIntensity: 0.55,
    hemiSky: '#a9c3ec',
    hemiGround: '#665a62',
    hemiIntensity: 1.05,
    clouds: { lit: '#ffe6d6', shade: '#7f90bb', rim: '#ffa877', cover: 0.46 },
    ground: { snow: '#e6e8f4', rock: '#8a7a74', rockDark: '#4f4650' },
    /** alpenglow: warm light on the upper mountain, cool blue toward its foot */
    glow: { warm: '#ffd8bd', cool: '#b3c3e8', strength: 0.42 },
    /** low mist rolling along the foot of the mountains */
    mist: { color: '#eee9f4', opacity: 0.72 },
    /** CHOOLI: deep sky blue that dissolves into the haze where it meets the mountain */
    word: { top: '#1c4f99', mid: '#3a78c6', base: '#c9dbee', alphaTop: 0.78, alphaBase: 0.0, sweep: '#ffffff' },
  },
  night: {
    label: 'Night',
    /** navy dusk with an orange afterglow */
    sky: { zenith: '#03142c', mid: '#0B3A70', horizon: '#6a6a94', glow: '#FF7100' },
    fogColor: '#33456b',
    fogDensity: 0.003,
    sunDirection: [20, 9, 7] as [number, number, number],
    sunColor: '#ffb27a',
    sunIntensity: 4.2,
    rimColor: '#7fb4ff',
    rimIntensity: 1.3,
    fillColor: '#b9cbee',
    fillIntensity: 0.55,
    hemiSky: '#8fb0de',
    hemiGround: '#231f2b',
    hemiIntensity: 0.85,
    clouds: { lit: '#d9bfd6', shade: '#1b2a55', rim: '#ff8a4a', cover: 0.43 },
    ground: { snow: '#c9d1df', rock: '#7d6b62', rockDark: '#3e3536' },
    glow: { warm: '#ffb48c', cool: '#7084bb', strength: 0.4 },
    mist: { color: '#7d86b4', opacity: 0.6 },
    /** CHOOLI: warm white at the top glowing into Chooli orange */
    word: { top: '#ffffff', mid: '#ffc394', base: '#ff7100', alphaTop: 0.62, alphaBase: 0.04, sweep: '#ffe0bf' },
  },
} satisfies Record<ThemeName, unknown>;

export type ThemePalette = (typeof THEMES)['morning'];
export const DEFAULT_THEME: ThemeName = 'morning';
/** seconds for the cross-fade between themes */
export const THEME_TRANSITION = 1.6;

/** Cinematic finish for the 3D scene (skipped on low-power devices). */
export const CINEMATIC = {
  /** alpenglow height range (world metres): fully cool below `low`, fully warm above `high` */
  glowHeight: [3, 42] as [number, number],
  mist: {
    /** curtains of mist standing along the mountains' foot, [z, height, speed] */
    layers: [
      [1, 14, 0.6],
      [5, 11, 0.9],
      [9, 8, 1.2],
    ] as [number, number, number][],
    width: 520,
  },
  /** soft glow on the brightest highlights */
  bloom: { strength: 0.32, radius: 0.55, threshold: 0.82 },
  contrast: 1.06,
  saturation: 1.1,
  /** darkening toward the frame edges (0 = off) */
  vignette: 0.42,
};

/* -------------------------------------------------------------------- copy */

export const COPY = {
  hero: {
    eyebrow: 'Chooli Digital Marketing',
    line: 'Traversing the ups and downs of digital marketing to reach the mountain top together.',
  },
  gus: {
    eyebrow: 'Meet your guide',
    heading: "It's me, Gus.",
    sub: 'Your guide to smarter digital growth.',
    /** from the Chooli brand board v1.0 (identity block) */
    body: 'Bigfoot makes Chooli memorable. Real expertise and results make it worth hiring.',
    /** short facts about Chooli: brand board (four specialties, Southern Indiana) + brief (Giving Back) */
    glance: {
      label: 'Chooli at a glance',
      stats: [
        { v: '4', k: 'Core specialties' },
        { v: '10%', k: 'Of monthly retainers given to nonprofits' },
      ],
      line: 'Rooted in Southern Indiana. Not limited by it.',
    },
  },
  about: {
    /** "Why Choose Chooli" titles from the current choolidigitalmarketing.com homepage */
    heading: 'Meet Chooli.',
    headingRest: 'A different kind of digital marketing agency.',
    bodyLead: 'No fluff. No nonsense.',
    body: 'Just thoughtful strategies, real expertise, and a team focused on helping businesses grow.',
    why: ['Local Strategy, Real Community Focus', 'Clear, Transparent Communication', 'Practical Growth Plans', 'Results That Matter'],
  },
};

/**
 * "Real results" case-study slider (section after the services).
 * PLACEHOLDER CONTENT: copied from the design mock-up so the layout can be reviewed. The
 * brand board forbids invented results and testimonials - replace every story with an
 * approved case study (client, numbers, quote, permission) before launch.
 */
export const CASES = {
  eyebrow: 'Real results. No magic.',
  heading: "Here's the work and the results behind it.",
  placeholder: true,
  stories: [
    {
      client: 'Client A',
      mark: 'swirl',
      problem: 'Terra & Trail struggled with rising ad costs and an underperforming website.',
      quote: 'Chooli Digital Marketing excels above the rest! Kie and his team do stellar work and are unmatched when it comes to service. Build your SEO with Chooli Digital Marketing!',
      author: 'Alex Longest',
      metrics: [
        { value: '€130K', label: 'ARR in 30 days' },
        { value: '2500+', label: 'users signed up in two days' },
        { value: '€7.5M', label: 'ARR partnership announced' },
      ],
      href: '#',
    },
    {
      client: 'Client B',
      mark: 'clover',
      problem: 'Terra & Trail struggled with rising ad costs and an underperforming website.',
      quote: 'Chooli Digital Marketing excels above the rest! Kie and his team do stellar work and are unmatched when it comes to service. Build your SEO with Chooli Digital Marketing!',
      author: 'Alex Longest',
      metrics: [
        { value: '€130K', label: 'ARR in 30 days' },
        { value: '2500+', label: 'users signed up in two days' },
        { value: '€7.5M', label: 'ARR partnership announced' },
      ],
      href: '#',
    },
    {
      client: 'Client C',
      mark: 'wave',
      problem: 'Terra & Trail struggled with rising ad costs and an underperforming website.',
      quote: 'Chooli Digital Marketing excels above the rest! Kie and his team do stellar work and are unmatched when it comes to service. Build your SEO with Chooli Digital Marketing!',
      author: 'Alex Longest',
      metrics: [
        { value: '€130K', label: 'ARR in 30 days' },
        { value: '2500+', label: 'users signed up in two days' },
        { value: '€7.5M', label: 'ARR partnership announced' },
      ],
      href: '#',
    },
    {
      client: 'Client D',
      mark: 'step',
      problem: 'Terra & Trail struggled with rising ad costs and an underperforming website.',
      quote: 'Chooli Digital Marketing excels above the rest! Kie and his team do stellar work and are unmatched when it comes to service. Build your SEO with Chooli Digital Marketing!',
      author: 'Alex Longest',
      metrics: [
        { value: '€130K', label: 'ARR in 30 days' },
        { value: '2500+', label: 'users signed up in two days' },
        { value: '€7.5M', label: 'ARR partnership announced' },
      ],
      href: '#',
    },
    {
      client: 'Client E',
      mark: 'ring',
      problem: 'Terra & Trail struggled with rising ad costs and an underperforming website.',
      quote: 'Chooli Digital Marketing excels above the rest! Kie and his team do stellar work and are unmatched when it comes to service. Build your SEO with Chooli Digital Marketing!',
      author: 'Alex Longest',
      metrics: [
        { value: '€130K', label: 'ARR in 30 days' },
        { value: '2500+', label: 'users signed up in two days' },
        { value: '€7.5M', label: 'ARR partnership announced' },
      ],
      href: '#',
    },
  ],
};

/** When each piece of text appears / leaves, in scroll progress. */
export const TEXT = {
  hero: { in: [-1, -1], out: [0.1, 0.19] },
  scrollHint: { in: [-1, -1], out: [0.03, 0.1] },
  gusHeading: { in: [0.555, 0.615], out: [0.72, 0.775] },
  /** final screen (Meet Chooli + Why Choose Chooli); its pieces follow each other from here */
  about: { in: [0.855, 0.89], out: [2, 2] },
  /** soft scrim behind the Gus copy */
  gusScrim: { in: [0.5, 0.6], out: [0.72, 0.8] },
  /** dark scrim behind the About copy */
  aboutScrim: { in: [0.8, 0.92], out: [2, 2] },
};
