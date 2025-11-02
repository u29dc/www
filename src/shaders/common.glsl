// Common GLSL Snippets
//
// ## SUMMARY
// Shared GLSL utilities (noise, quad vertices) reused by multiple render pipelines.
//
// ## RESPONSIBILITIES
// - Provide lightweight hash-based noise implementation
// - Offer normalized quad coordinate helpers for fullscreen passes

#ifndef NOISE_SNIPPET
#define NOISE_SNIPPET

float wg_hash(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}

float wg_noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);

    float a = wg_hash(i);
    float b = wg_hash(i + vec2(1.0, 0.0));
    float c = wg_hash(i + vec2(0.0, 1.0));
    float d = wg_hash(i + vec2(1.0, 1.0));

    return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

#endif

