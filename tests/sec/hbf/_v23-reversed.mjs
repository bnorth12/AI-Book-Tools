// SEC-SWEEP ref-v2.3 (plan REF-V2.3-N2 v1.1 §4a): v2.2 keep rows reversed ON PURPOSE. rows.hbf.test.mjs skips exactly these
// ids; ref-v23.hbf.test.mjs replaces each with a required RED row (RV-N08R, RV-N09R, RV-N15R). Every other v2.2 row,
// keep or strip, still runs unchanged, and T1 asserts this list is exactly the v2.2 name rows ref-v2.3 flips.
export const REVERSED_V22_KEEP = Object.freeze({ 'RV-N08': 'RV-N08R', 'RV-N09': 'RV-N09R', 'RV-N15': 'RV-N15R' });
