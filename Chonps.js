// src/engine/CHNOPS.js

export const CODON_MATRIX = {
  alanine:      { gates: [57, 48, 18, 46], formula: {C:3, H:7,  N:1, O:2, S:0}, theme: "Fear/Survival", circuit: "Splenic" },
  arginine:     { gates: [10, 38, 35, 17, 21, 51], formula: {C:6, H:14, N:4, O:2, S:0}, theme: "Ego/Competition", circuit: "Heart/Root" },
  asparagine:   { gates: [43, 34], formula: {C:4, H:8,  N:2, O:3, S:0}, theme: "Efficiency/Sacral", circuit: "Individual" },
  asparticAcid: { gates: [28, 32], formula: {C:4, H:7,  N:1, O:4, S:0}, theme: "Fear of Death/Failure", circuit: "Splenic/Tribal" },
  cysteine:     { gates: [45, 16], formula: {C:3, H:7,  N:1, O:2, S:1}, theme: "Skills/Rulership", circuit: "Throat/Tribal" },
  glutamine:    { gates: [13, 30], formula: {C:5, H:10, N:2, O:3, S:0}, theme: "Secrets/Desire", circuit: "Solar Plexus" },
  glutamicAcid: { gates: [44, 50], formula: {C:5, H:9,  N:1, O:4, S:0}, theme: "Intelligence/Values", circuit: "Splenic" },
  glycine:      { gates: [6, 47, 64, 40], formula: {C:2, H:5,  N:1, O:2, S:0}, theme: "Chaos/Denial", circuit: "Head/Ajna/Ego" },
  histidine:    { gates: [49, 55], formula: {C:6, H:9,  N:3, O:2, S:0}, theme: "Mutation/Spirit", circuit: "Solar Plexus" },
  isoleucine:   { gates: [61, 60, 19], formula: {C:6, H:13, N:1, O:2, S:0}, theme: "Pressure/Thinking", circuit: "Head/Root" },
  leucine:      { gates: [42, 3, 27, 24, 20, 23], formula: {C:6, H:13, N:1, O:2, S:0}, theme: "Uniqueness/Incarnation", circuit: "Sacral/Throat" },
  lysine:       { gates: [1, 14], formula: {C:6, H:14, N:2, O:2, S:0}, theme: "Direction/Work", circuit: "Sacral/G" },
  methionine:   { gates: [41], formula: {C:5, H:11, N:1, O:2, S:1}, theme: "Initiation/Fantasy", circuit: "Root" },
  phenylalanine:{ gates: [8, 2], formula: {C:9, H:11, N:1, O:2, S:0}, theme: "Driver/Contribution", circuit: "G/Throat" },
  proline:      { gates: [37, 63, 22, 36], formula: {C:5, H:9,  N:1, O:2, S:0}, theme: "Bonding/Emotion", circuit: "Solar Plexus/Throat" },
  serine:       { gates: [58, 54, 53, 39, 52, 15], formula: {C:3, H:7,  N:1, O:3, S:0}, theme: "Pressure/Flow", circuit: "Root" },
  threonine:    { gates: [4, 29], formula: {C:4, H:9,  N:1, O:3, S:0}, theme: "Commitment/Experience", circuit: "Ajna/Sacral" },
  tryptophan:   { gates: [35], formula: {C:11,H:12, N:2, O:2, S:0}, theme: "Experience/Change", circuit: "Throat" },
  tyrosine:     { gates: [11, 56], formula: {C:9, H:11, N:1, O:3, S:0}, theme: "Ideas/Stories", circuit: "Ajna/Throat" },
  valine:       { gates: [26, 44], formula: {C:5, H:11, N:1, O:2, S:0}, theme: "Transmission/Tribe", circuit: "Heart/Throat" }
};

export const GATE_TO_CODON = {};
Object.entries(CODON_MATRIX).forEach(([acid, data]) => {
  data.gates.forEach(gate => {
    GATE_TO_CODON[gate] = acid;
  });
});

export const ELEMENTAL_BEHAVIOR = {
  C: "structure",
  H: "flow",
  N: "catalysis",
  O: "oxidation",
  S: "bridging",
  P: "phosphorylation"
};

export function computeCHNOPS(activatedGates, normalization = 'softmax') {
  const raw = { C: 0, H: 0, N: 0, O: 0, S: 0, P: 0 };
  
  activatedGates.forEach(gate => {
    const codon = CODON_MATRIX[GATE_TO_CODON[gate]];
    if (codon) {
      Object.keys(raw).forEach(el => {
        if (el !== 'P') raw[el] += codon.formula[el] || 0;
      });
    }
  });

  raw.P = (raw.N * 3) + (raw.O * 2) + (raw.S * 5);
  const values = Object.values(raw);
  
  const normalized = {};
  Object.keys(raw).forEach(key => {
    if (normalization === 'unit') normalized[key] = raw[key] / values.reduce((a, b) => a + b, 0);
    else if (normalization === 'softmax') {
      normalized[key] = Math.exp(raw[key]) / values.reduce((a, b) => a + Math.exp(b), 0);
    }
    else normalized[key] = raw[key];
  });

  return { raw, normalized, gateCount: activatedGates.length };
}

export function computeResonance(vectorA, vectorB) {
  const keys = ['C', 'H', 'N', 'O', 'S', 'P'];
  let dot = 0, normA = 0, normB = 0;
  
  keys.forEach(k => {
    dot += vectorA[k] * vectorB[k];
    normA += vectorA[k] ** 2;
    normB += vectorB[k] ** 2;
  });
  
  const similarity = dot / (Math.sqrt(normA) * Math.sqrt(normB));
  
  let interference = "neutral";
  if (similarity > 0.85) interference = "constructive";
  else if (similarity < 0.3) interference = "destructive";
  else if (vectorA.N > vectorB.N * 1.5) interference = "catalytic";
  
  return { similarity, interference, dyadPotential: similarity * (vectorA.P + vectorB.P) };
}
