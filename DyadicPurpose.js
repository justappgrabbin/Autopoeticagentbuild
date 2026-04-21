// src/engine/DyadicPurpose.js

export class DyadicPurposeField {
  constructor() {
    this.purposeVector = null;
    this.trajectory = [];
    this.individualVectors = { A: null, B: null };
    this.successBaseline = null;
    this.driftThreshold = 0.35;
  }

  initialize(purposeStatement, chnopsA, chnopsB) {
    // The purpose is a vector in CHNOPS space
    // It represents the "chemistry" of the relationship's highest potential
    this.purposeVector = this.synthesizePurposeVector(chnopsA, chnopsB, purposeStatement);
    this.individualVectors.A = chnopsA;
    this.individualVectors.B = chnopsB;
    this.successBaseline = this.computeSuccessBaseline(chnopsA, chnopsB);
    
    return this.purposeVector;
  }

  synthesizePurposeVector(chnopsA, chnopsB, statement) {
    // Purpose is the constructive interference of both fields
    // Weighted toward what creates growth (N) and sustainable structure (C)
    const composite = {};
    const keys = ['C', 'H', 'N', 'O', 'S', 'P'];
    
    keys.forEach(k => {
      const avg = (chnopsA.normalized[k] + chnopsB.normalized[k]) / 2;
      const diff = Math.abs(chnopsA.normalized[k] - chnopsB.normalized[k]);
      // Purpose favors balance with slight catalytic bias
      composite[k] = avg + (diff * 0.3);
    });
    
    // Normalize
    const sum = Object.values(composite).reduce((a, b) => a + b, 0);
    const normalized = {};
    Object.keys(composite).forEach(k => {
      normalized[k] = composite[k] / sum;
    });
    
    return {
      raw: composite,
      normalized,
      statement,
      createdAt: Date.now()
    };
  }

  computeSuccessBaseline(chnopsA, chnopsB) {
    // What does "success" look like chemically for this dyad?
    return {
      resonanceTarget: 0.75,
      catalysisFloor: Math.min(chnopsA.normalized.N, chnopsB.normalized.N) * 1.2,
      structureCeiling: Math.max(chnopsA.normalized.C, chnopsB.normalized.C) * 0.9,
      flowMinimum: (chnopsA.normalized.H + chnopsB.normalized.H) / 2,
      baselineDate: Date.now()
    };
  }

  checkDrift(currentTriad) {
    // Compare current state to purpose vector
    const currentComposite = this.compositeCurrentState(currentTriad);
    const similarity = this.cosineSimilarity(
      this.purposeVector.normalized,
      currentComposite.normalized
    );
    
    const drift = 1 - similarity;
    const individualDrift = {
      A: 1 - this.cosineSimilarity(this.individualVectors.A.normalized, currentTriad.triadA.normalized),
      B: 1 - this.cosineSimilarity(this.individualVectors.B.normalized, currentTriad.triadB.normalized)
    };

    // Check against success baseline
    const belowCatalysis = currentComposite.normalized.N < this.successBaseline.catalysisFloor;
    const belowFlow = currentComposite.normalized.H < this.successBaseline.flowMinimum;
    
    let type = 'STABLE';
    let severity = 0;
    let message = '';
    
    if (drift > this.driftThreshold) {
      type = 'DRIFT';
      severity = drift;
      message = `Purpose field drift detected: ${(drift * 100).toFixed(1)}% deviation from shared vector.`;
    }
    
    if (individualDrift.A > this.driftThreshold && individualDrift.B > this.driftThreshold) {
      type = 'DYAD_DRIFT';
      severity = Math.max(individualDrift.A, individualDrift.B);
      message += ' Both individuals diverging from purpose.';
    } else if (individualDrift.A > this.driftThreshold) {
      type = 'A_DRIFT';
      severity = individualDrift.A;
      message += ' Person A diverging from purpose.';
    } else if (individualDrift.B > this.driftThreshold) {
      type = 'B_DRIFT';
      severity = individualDrift.B;
      message += ' Person B diverging from purpose.';
    }

    if (belowCatalysis && belowFlow) {
      type = 'CRISIS';
      severity = 0.9;
      message = 'Critical: Both catalytic and flow energies below success baseline. Intervention recommended.';
    }

    return {
      type,
      severity,
      drift,
      individualDrift,
      message,
      currentComposite,
      timestamp: Date.now()
    };
  }

  compositeCurrentState(currentTriad) {
    const avg = {};
    const keys = ['C', 'H', 'N', 'O', 'S', 'P'];
    
    keys.forEach(k => {
      avg[k] = (currentTriad.triadA.normalized[k] + currentTriad.triadB.normalized[k]) / 2;
    });
    
    return { normalized: avg };
  }

  getSuccessReport() {
    if (!this.trajectory.length) return null;
    
    const recent = this.trajectory.slice(-30); // last 30 check-ins
    const avgDrift = recent.reduce((a, b) => a + b.drift, 0) / recent.length;
    const trend = recent.length > 1 
      ? recent[recent.length - 1].drift - recent[0].drift 
      : 0;
    
    return {
      currentAlignment: (1 - avgDrift) * 100,
      trend: trend < -0.05 ? 'IMPROVING' : trend > 0.05 ? 'DECLINING' : 'STABLE',
      daysTracked: recent.length,
      purposeStatement: this.purposeVector.statement,
      recommendation: this.generateRecommendation(avgDrift, trend)
    };
  }

  generateRecommendation(avgDrift, trend) {
    if (avgDrift < 0.2 && trend < 0) return "Maintain current trajectory. Field is coherent.";
    if (avgDrift < 0.4 && trend > 0) return "Minor course correction suggested. Review shared intentions.";
    if (avgDrift > 0.4) return "Significant drift detected. Initiate dyad realignment protocol.";
    return "Continue observation.";
  }

  cosineSimilarity(a, b) {
    const keys = ['C', 'H', 'N', 'O', 'S', 'P'];
    let dot = 0, normA = 0, normB = 0;
    keys.forEach(k => {
      dot += a[k] * b[k];
      normA += a[k] ** 2;
      normB += b[k] ** 2;
    });
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}
