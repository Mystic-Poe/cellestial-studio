// The sky's shaders. Four programs draw everything: lines (the honeycomb, its
// struts and the figures), stars (B4, B5, the claim between them and the fall),
// and the two parts of B3 (core and ring).
//
// Nothing here is colour-managed: textures come in as they are stored and the
// output goes out as it is written, so a pixel of a pack image lands on the
// screen with the value it has in the file, and light adds up the way
// "screen/additive" means it in the spec.
//
// Every program writes premultiplied colour and is blended ONE,
// ONE_MINUS_SRC_ALPHA: alpha is how much the fragment hides of what is behind
// it, and light with alpha 0 simply adds. There is no depth buffer; the
// layers are drawn far to near.
//
// The camera never turns, so "facing the camera" is "lying in x, y", and
// sizes on screen are world sizes times focal / depth. Screen measures are
// CSS pixels; `uDpr` is device pixels per CSS pixel.

const COMMON = /* glsl */ `
vec2 rot(vec2 p, float a) {
	float c = cos(a);
	float s = sin(a);
	return vec2(c * p.x - s * p.y, s * p.x + c * p.y);
}

// Whole up to far.x, then falling off with length far.y, and gone at far.z.
float farFade(float depth, vec3 far) {
	float f = depth < far.x ? 1.0 : exp(-(depth - far.x) / far.y);
	return f * (1.0 - smoothstep(0.7 * far.z, far.z, depth));
}
`;

// ───────────────────────────────────────────────────────────── lines ──

/**
 * One instance is one segment from aA to aB, drawn as a quad that faces the
 * screen. Its width is a world width, so near lines are thicker than far
 * ones, but never under `uWidth.y` pixels (it dims instead) and never over
 * `uWidth.z`.
 */
export const LINE_VERTEX = /* glsl */ `
attribute vec3 aA;
attribute vec3 aB;
attribute vec2 aPulse;

uniform vec3 uOffset;
uniform vec2 uHalfRes;
uniform float uFocal;
uniform float uDpr;
uniform vec3 uWidth;
uniform float uThin;
uniform float uClip;

varying float vSide;
varying float vHalf;
varying float vDepth;
varying float vAlong;
varying float vThin;
varying vec2 vXY;
varying vec2 vPulse;

void main() {
	vec3 wa = aA + uOffset;
	vec3 wb = aB + uOffset;
	vec4 a = viewMatrix * vec4(wa, 1.0);
	vec4 b = viewMatrix * vec4(wb, 1.0);
	float n = -uClip;
	if (a.z > n && b.z > n) {
		gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
		return;
	}
	// Cut the segment where it would pass behind the lens.
	float ta = a.z > n ? (n - a.z) / (b.z - a.z) : 0.0;
	float tb = b.z > n ? (n - a.z) / (b.z - a.z) : 1.0;
	vec4 pa = mix(a, b, ta);
	vec4 pb = mix(a, b, tb);
	vec4 ca = projectionMatrix * pa;
	vec4 cb = projectionMatrix * pb;
	vec2 sa = ca.xy / ca.w * uHalfRes;
	vec2 sb = cb.xy / cb.w * uHalfRes;
	vec2 dir = sb - sa;
	float len = length(dir);
	dir = len > 1e-5 ? dir / len : vec2(1.0, 0.0);
	vec2 across = vec2(-dir.y, dir.x);

	bool first = position.x < 0.5;
	vec4 p = first ? pa : pb;
	vec4 c = first ? ca : cb;
	float depth = -p.z;
	float trueW = uWidth.x > 0.0 ? uWidth.x * uFocal / depth : uWidth.y;
	float w = clamp(trueW, uWidth.y, uWidth.z);
	float halfW = 0.5 * w + 1.0 / uDpr;
	c.xy += across * position.y * halfW / uHalfRes * c.w;
	gl_Position = c;

	vSide = position.y * halfW;
	vHalf = 0.5 * w;
	vDepth = depth;
	vAlong = first ? ta : tb;
	// Thinner than a pixel it dims, but gently: a far figure is still a figure.
	vThin = min(1.0, pow(trueW / uWidth.y, uThin));
	vXY = mix(wa.xy, wb.xy, vAlong);
	vPulse = aPulse;
}
`;

export const LINE_FRAGMENT = /* glsl */ `
uniform vec3 uColor;
uniform float uAlpha;
uniform vec2 uNear;
uniform vec3 uFar;
uniform vec4 uRadial;
uniform vec3 uStrut;
uniform vec3 uPulseColor;
uniform float uTime;
uniform float uDpr;

varying float vSide;
varying float vHalf;
varying float vDepth;
varying float vAlong;
varying float vThin;
varying vec2 vXY;
varying vec2 vPulse;
${COMMON}
void main() {
	float edge = 0.5 / uDpr;
	float across = 1.0 - smoothstep(vHalf - edge, vHalf + edge, abs(vSide));
	float near = smoothstep(uNear.x, uNear.y, vDepth);
	float far = farFade(vDepth, uFar);
	// The plane under a layer is a disc about the flight axis: it has no edge to see.
	float disc = uRadial.w > 0.0 ? 1.0 - smoothstep(uRadial.z, uRadial.w, length(vXY - uRadial.xy)) : 1.0;
	// A strut is brightest where it meets a plane and faint in between, so it is
	// seen to pass, and the far end of the tunnel stays dark.
	float along = 1.0;
	if (uStrut.x > 0.5) {
		float m = min(vAlong, 1.0 - vAlong);
		along = uStrut.y + (1.0 - uStrut.y) * exp(-m / uStrut.z);
	}
	float base = uAlpha * across * near * far * disc * vThin * along;
	// A bead passing: the edge lights for a moment.
	float age = uTime - vPulse.x;
	float lit = age < 0.0 ? 0.0 : vPulse.y * smoothstep(0.0, 0.05, age) * exp(-age / 0.5);
	float pulse = lit * across * near * disc * min(1.0, far * 3.0) * min(1.0, uAlpha * 40.0);
	gl_FragColor = vec4(uColor * base + uPulseColor * pulse, 0.0);
}
`;

// ───────────────────────────────────────────────────────────── stars ──

/**
 * One instance is one star: a quad about its centre, big enough for the B5
 * glow, stretched upward by its trail when it falls. Far away a star is
 * never drawn smaller than `uMinPx`; it dims instead, so a distant figure is
 * still a figure of points.
 */
export const STAR_VERTEX = /* glsl */ `
attribute vec4 aStar;
attribute vec4 aState;

uniform vec3 uOffset;
uniform vec2 uHalfRes;
uniform float uFocal;
uniform float uBaseR;
uniform float uAlpha;
uniform vec2 uNear;
uniform vec3 uFar;
uniform vec4 uFall;
uniform float uMinPx;
uniform float uTrailMax;
uniform float uTrailStar;
uniform float uTime;

varying vec2 vP;
varying float vRpx;
varying float vTrue;
varying float vFade;
varying float vLit;
varying float vIgn;
varying float vSeed;
varying float vBoost;
varying vec2 vTrail;
${COMMON}
const float REACH = 1.75;

void main() {
	vec3 centre = vec3(aStar.xy, 0.0) + uOffset;
	// The fall: one gravity for every star; each lets go a moment apart.
	float ft = max(0.0, uFall.x - aStar.w * uFall.z);
	float speed = uFall.y * ft;
	centre.y -= 0.5 * uFall.y * ft * ft;

	vec4 v = viewMatrix * vec4(centre, 1.0);
	float depth = -v.z;
	if (depth < 0.012) {
		gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
		return;
	}
	float scale = uFocal / depth;
	float boost = aState.z;
	float rpx = aStar.z * uBaseR * scale * (1.0 + 0.08 * boost);
	float reff = max(rpx, uMinPx);
	float trailPx = min(speed * uFall.w * scale * max(1.0, reff / uTrailStar), uTrailMax * reff);

	vec2 px = position.xy * reff * REACH;
	if (position.y > 0.0) px.y += trailPx;
	vec4 c = projectionMatrix * v;
	c.xy += px / uHalfRes * c.w;
	gl_Position = c;

	vP = px / reff;
	vRpx = reff;
	vTrue = rpx;
	vFade = uAlpha * smoothstep(uNear.x, uNear.y, depth) * farFade(depth, uFar) * min(1.0, rpx / uMinPx);
	vLit = aState.x;
	vIgn = aState.y < 0.0 ? -1.0 : uTime - aState.y;
	vSeed = aStar.w;
	vBoost = boost;
	vTrail = vec2(trailPx / reff, smoothstep(0.0, 0.3, ft));
}
`;

export const STAR_FRAGMENT = /* glsl */ `
uniform sampler2D tB4;
uniform sampler2D tB4Station;
uniform vec2 uB4Close;
uniform sampler2D tB5;
uniform vec3 uB4;
uniform vec3 uB5;
uniform vec3 uBlue;
uniform vec3 uBlueWhite;
uniform vec3 uIgnite;
uniform float uRim;
uniform float uBody;
uniform float uFarGain;
uniform float uTime;
uniform float uIdle;
uniform float uDpr;

varying vec2 vP;
varying float vRpx;
varying float vTrue;
varying float vFade;
varying float vLit;
varying float vIgn;
varying float vSeed;
varying float vBoost;
varying vec2 vTrail;
${COMMON}
void main() {
	float r = length(vP);
	float aa = 1.0 / max(vRpx * uDpr, 0.5);
	float disc = 1.0 - smoothstep(1.0 - aa, 1.0 + aa, r);

	// Each star sits at its own angle and turns very slowly about it.
	float turn = (vSeed - 0.5) * 1.6 + uIdle * uTime * (0.03 + 0.05 * vSeed) * (vSeed > 0.5 ? 1.0 : -1.0);
	vec2 q = rot(vP, turn);
	vec2 d = vec2(q.x, -q.y);
	// B4 and B5 are one sphere in two frames: each is sampled about its own disc.
	vec4 b4 = texture2D(tB4, uB4.xy + d * uB4.z);
	vec3 b5 = texture2D(tB5, uB5.xy + d * uB5.z).rgb * (1.0 - smoothstep(1.56, 1.72, r));

	// B4, asleep: the dark sphere, with a thin blue light on its edge and just
	// off it so that it reads on black. Small and far, the whole of it is that light.
	// From far away the sphere itself cannot be seen: what is left is its light, a
	// small steel-blue point, so that a distant figure is still a figure of stars.
	float small = 1.0 - smoothstep(2.0, 8.0, vTrue);
	float rim = uRim * (1.0 + 2.4 * vBoost) * (1.0 + uFarGain * small);
	float limb = smoothstep(0.78, 1.0, r);
	limb = mix(limb * limb, 1.0, 1.0 - smoothstep(1.5, 5.0, vTrue));
	float halo = exp(-max(r - 1.0, 0.0) / 0.16);
	// At its station a star is 26 to 50 px across, and the pack's hair-fine traces
	// average away: there it is the station picture, the same sphere with its brass
	// traces made to carry. Flown in on, it becomes the pack's own.
	vec3 station = texture2D(tB4Station, uB4.xy + d * uB4.z).rgb;
	float close = smoothstep(uB4Close.x, uB4Close.y, vRpx);
	vec3 body = mix(station, b4.rgb * uBody, close) * (1.0 + 0.7 * vBoost);
	vec3 empty = body * disc + uBlue * rim * (0.85 * limb * disc + halo * (1.0 - disc));

	// B5, alive, and the claim that takes one to the other: the charge runs
	// down the traces from the pole they fan out of, white at its head; then
	// the whole sphere comes up, flashes, and settles.
	float lit = vLit;
	float gain = 1.0;
	vec3 fire = vec3(0.0);
	if (vIgn >= 0.0) {
		float tf = vIgn / uIgnite.x;
		float along = length(q - vec2(0.0, 0.95)) / 1.95;
		float front = tf * 1.3;
		float lum = max(b5.r, max(b5.g, b5.b));
		float traces = smoothstep(0.3, 0.62, lum);
		float behind = 1.0 - smoothstep(front - 0.1, front, along);
		float whole = smoothstep(0.75, 1.2, tf);
		lit = max(vLit * step(uIgnite.x + uIgnite.y + uIgnite.z, vIgn), behind * mix(traces, 1.0, whole));
		float head = exp(-pow((along - front) / 0.085, 2.0)) * (1.0 - smoothstep(0.95, 1.25, tf));
		fire = uBlueWhite * (head * (0.35 + traces) * 1.25 * disc);
		float tb = (vIgn - uIgnite.x) / uIgnite.y;
		float flash = tb < 0.0 ? smoothstep(-0.45, 0.0, tb) : exp(-tb * 2.4);
		flash *= 1.0 - smoothstep(uIgnite.x + uIgnite.y, uIgnite.x + uIgnite.y + uIgnite.z, vIgn);
		gain = 1.0 + 0.9 * flash;
		fire += uBlue * (flash * 0.6 * exp(-max(r - 1.0, 0.0) / 0.42) * (1.0 - disc));
		fire += uBlueWhite * (flash * 0.22 * disc);
	}
	vec3 rgb = mix(empty, b5 * gain, lit) + fire;

	// The fall: a streak of light above the star, tapering upward.
	if (vTrail.y > 0.0) {
		float t = clamp(vP.y / max(vTrail.x, 0.001), 0.0, 1.0);
		float w = mix(0.72, 0.05, t);
		float streak = (1.0 - smoothstep(0.2 * w, w, abs(vP.x))) * pow(1.0 - t, 1.5) * step(0.0, vP.y);
		rgb += mix(uBlue, uBlueWhite, 0.4 * (1.0 - t)) * (streak * vTrail.y * 0.85 * (1.0 - disc));
	}

	gl_FragColor = vec4(rgb * vFade, disc * vFade);
}
`;

// ──────────────────────────────────────────────────────────────── B3 ──

/** A quad about a point, `uExtent` disc radii to each side. */
export const CORE_VERTEX = /* glsl */ `
uniform vec3 uCentre;
uniform float uRadius;
uniform float uExtent;

varying vec2 vP;
varying float vDepth;

void main() {
	vec3 world = uCentre + vec3(position.xy * uRadius * uExtent, 0.0);
	vec4 v = viewMatrix * vec4(world, 1.0);
	gl_Position = projectionMatrix * v;
	vP = position.xy * uExtent;
	vDepth = -(viewMatrix * vec4(uCentre, 1.0)).z;
}
`;

/**
 * The core picture is light on black. Its disc hides what is behind it (the
 * far halves of the rings); its corona and glow add. Round it, a wide soft
 * halo drawn in code: the most important light in the sky.
 */
export const CORE_FRAGMENT = /* glsl */ `
uniform sampler2D tCore;
uniform vec3 uDisc;
uniform vec3 uBlue;
uniform float uAlpha;
uniform float uPulse;
uniform float uHalo;
uniform float uTime;
uniform float uIdle;
uniform vec2 uNear;
uniform vec3 uFar;

varying vec2 vP;
varying float vDepth;
${COMMON}
void main() {
	float r = length(vP);
	// The surface and its corona drift round, slowly.
	vec2 q = rot(vP, uIdle * uTime * 0.045);
	vec3 pic = texture2D(tCore, uDisc.xy + vec2(q.x, -q.y) * uDisc.z).rgb;
	pic *= 1.0 - smoothstep(2.85, 3.15, r);
	float breath = 1.0 + uIdle * 0.07 * sin(uTime * 0.8) * smoothstep(0.95, 1.5, r);
	float halo = uHalo * (exp(-r / 1.7) + 0.35 * exp(-r / 4.0)) * (1.0 - smoothstep(6.5, 9.0, r));
	// A pulse: the surface brightens and the halo swells out with it.
	halo *= 1.0 + uPulse * (1.6 + 1.2 * smoothstep(1.0, 4.0, r));
	vec3 rgb = pic * breath * (1.0 + 0.35 * uPulse) + uBlue * halo;
	float hide = 1.0 - smoothstep(0.9, 0.99, r);
	float fade = uAlpha * smoothstep(uNear.x, uNear.y, vDepth) * farFade(vDepth, uFar);
	gl_FragColor = vec4(rgb * fade, hide * fade);
}
`;

/**
 * The ring picture on a quad about the ring's own centre: squashed across
 * its short axis (a different tilt), turned in the plane of the screen, and
 * scaled. `uRing` is the centre in pixels of the picture and the pixels per
 * world unit; `uAxis` is the unit vector of the short axis, towards the half
 * of the band that is nearer the viewer.
 */
export const RING_VERTEX = /* glsl */ `
uniform vec3 uCentre;
uniform vec2 uSize;
uniform vec3 uRing;
uniform vec2 uAxis;
uniform float uSquash;
uniform float uAngle;
uniform float uScale;

varying vec2 vUv;
varying float vNear;
varying vec2 vOff;
varying float vDepth;
${COMMON}
void main() {
	// position.xy runs over the picture, 0..1, y down as the file has it.
	vec2 pixel = position.xy * uSize;
	vec2 t = vec2(pixel.x - uRing.x, uRing.y - pixel.y);
	float across = dot(t, uAxis);
	vec2 laid = t + (uSquash - 1.0) * across * uAxis;
	vec2 off = rot(laid, uAngle) * (uScale / uRing.z);
	vec4 v = viewMatrix * vec4(uCentre + vec3(off, 0.0), 1.0);
	gl_Position = projectionMatrix * v;
	vUv = position.xy;
	vNear = across;
	vOff = off;
	vDepth = -(viewMatrix * vec4(uCentre, 1.0)).z;
}
`;

/**
 * Drawn twice. Under the core: the whole band. Over the core: only the half
 * that is nearer than the core, feathered at the two ends where the band
 * turns away, so nothing can be seen to switch as it turns.
 */
export const RING_FRAGMENT = /* glsl */ `
uniform sampler2D tRing;
uniform vec3 uBlueWhite;
uniform float uAlpha;
uniform float uFront;
uniform float uFeather;
uniform float uLight;
uniform float uCoreR;
uniform vec2 uNear;
uniform vec3 uFar;

varying vec2 vUv;
varying float vNear;
varying vec2 vOff;
varying float vDepth;
${COMMON}
void main() {
	vec4 px = texture2D(tRing, vUv);
	float a = px.a * uAlpha;
	if (uFront > 0.5) a *= smoothstep(0.0, uFeather, vNear);
	// The star at the middle lights the brass around it.
	float reach = length(vOff) / uCoreR;
	vec3 rgb = px.rgb + uBlueWhite * (uLight * exp(-max(reach - 1.0, 0.0) / 1.4));
	float fade = smoothstep(uNear.x, uNear.y, vDepth) * farFade(vDepth, uFar);
	a *= fade;
	gl_FragColor = vec4(rgb * a, a);
}
`;
