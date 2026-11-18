import { Skia, type SkRuntimeEffect } from '@shopify/react-native-skia';

/**
 * SkSL shader pravog plamena u jezgri orb-plamena (korak 33). Kugla: izvan kruga prozirno, unutra
 * tamni žar, plamen kao kap koju turbulencija (fbm šum koji se diže) trga u jezike, žar na dnu i
 * žeravice koje se dižu. Boje dolaze iz teme (`orbFlameColors`), gibanje iz `orbFireMotion`.
 * Uniformi (redom): `res` veličina u px, `time` s, `height`, `speed`, `embers` (0–1), boje
 * `cCore`, `cMid`, `cGlow`, `cEdge` kao [r, g, b, a] u 0–1.
 */
export const ORB_FIRE_SKSL = `
uniform float2 res;
uniform float time;
uniform float height;
uniform float speed;
uniform float embers;
uniform float4 cCore;
uniform float4 cMid;
uniform float4 cGlow;
uniform float4 cEdge;

float hash(float2 p) { return fract(sin(dot(p, float2(127.1, 311.7))) * 43758.5453); }

float noise(float2 p) {
  float2 i = floor(p);
  float2 f = fract(p);
  float2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + float2(1.0, 0.0)), u.x),
             mix(hash(i + float2(0.0, 1.0)), hash(i + float2(1.0, 1.0)), u.x), u.y);
}

float fbm(float2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * noise(p);
    p = p * 2.03 + float2(1.7, 9.2);
    a *= 0.5;
  }
  return v;
}

half4 main(float2 fragCoord) {
  float2 uv = fragCoord / res;
  float2 c = uv * 2.0 - 1.0;
  float r = length(c);
  float disc = 1.0 - smoothstep(0.97, 1.0, r);
  if (disc <= 0.0) { return half4(0.0); }
  float y = 1.0 - uv.y;
  float t = time * speed;

  // Plamen: kap koja se sužava prema vrhu; koordinate trese turbulencija koja se diže, pa rub
  // puca u jezike.
  float n = fbm(float2(c.x * 3.0, y * 3.2 - t * 1.8));
  float n2 = fbm(float2(c.x * 6.0 + 3.1, y * 6.0 - t * 2.6));
  float2 p = float2(c.x + (n - 0.5) * 0.55 * y, y - 0.12);
  float tall = max(height, 0.05);
  float d = length(float2(p.x * (1.35 + 2.2 * clamp(p.y / tall, 0.0, 1.5)), p.y * (0.95 / tall)));
  float shape = 1.0 - d;
  float f = clamp(shape * 1.5 - (n2 - 0.35) * 0.9 * clamp(y * 1.6, 0.25, 1.0), 0.0, 1.0);

  // Žar na dnu.
  float base = (1.0 - smoothstep(0.0, 0.3, y)) * (0.35 + n2 * 0.4);
  float heat = clamp(max(f, base), 0.0, 1.0);

  float3 col = cEdge.rgb * (0.28 + 0.2 * (1.0 - r));
  col = mix(col, cEdge.rgb, smoothstep(0.0, 0.18, heat));
  col = mix(col, cGlow.rgb, smoothstep(0.12, 0.42, heat));
  col = mix(col, cMid.rgb, smoothstep(0.38, 0.7, heat));
  col = mix(col, cCore.rgb, smoothstep(0.72, 0.98, heat));

  // Žeravice koje se dižu: jedna po stupcu ćelija, pomiče se gore.
  float sparks = 0.0;
  if (embers > 0.0) {
    float2 g = float2(c.x * 4.0, y * 4.0 - t * 1.2);
    float2 id = floor(g);
    float2 fp = fract(g) - 0.5;
    float h = hash(id);
    float2 off = float2(hash(id + 3.3) - 0.5, hash(id + 7.7) - 0.5) * 0.6;
    float d = length(fp - off);
    float on = step(1.0 - embers * 0.5, h);
    sparks = on * (1.0 - smoothstep(0.02, 0.09, d)) * smoothstep(0.15, 0.6, y);
  }
  col = mix(col, cCore.rgb, clamp(sparks, 0.0, 1.0));

  return half4(half3(col) * half(disc), half(disc));
}
`;

let effect: SkRuntimeEffect | null | undefined;

/**
 * Prevedeni shader, jednom po pokretanju. `null` kad Skia nije dostupna ili prevođenje ne uspije —
 * tada orb crta stari plamen bez Skie (nikad prazan krug).
 */
export function orbFireEffect(): SkRuntimeEffect | null {
  if (effect !== undefined) return effect;
  try {
    effect = Skia.RuntimeEffect.Make(ORB_FIRE_SKSL);
  } catch (error) {
    console.warn('Orb fire shader unavailable', error);
    effect = null;
  }
  return effect;
}
