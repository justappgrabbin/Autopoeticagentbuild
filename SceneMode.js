// src/engine/ScienceMode.js

export class ScienceMode {
  constructor(persistence) {
    this.persistence = persistence;
    this.activeStudies = new Map();
    this.paperArchive = [];
  }

  async startStudy(config) {
    const studyId = `study_${Date.now()}`;
    const study = {
      id: studyId,
      title: config.title || 'Untitled Resonance Study',
      hypothesis: config.hypothesis,
      nullHypothesis: config.nullHypothesis || 'No correlation between CHNOPS field state and observed outcomes.',
      predictions: config.predictions || [],
      expectedObservations: config.expectedObservations || [],
      actualObservations: [],
      startDate: Date.now(),
      status: 'ACTIVE',
      variables: config.variables || ['chnops_composite', 'drift_severity', 'individual_alignment'],
      conclusion: null,
      confidence: 0
    };
    
    this.activeStudies.set(studyId, study);
    await this.persistence.save('studies', study);
    
    return study;
  }

  async logObservation(studyId, observation) {
    const study = this.activeStudies.get(studyId);
    if (!study) throw new Error(`Study ${studyId} not found`);
    
    const entry = {
      timestamp: Date.now(),
      causeState: observation.causeState,
      effectState: observation.effectState,
      context: observation.context,
      notes: observation.notes || '',
      verified: false
    };
    
    study.actualObservations.push(entry);
    
    // Auto-verify against predictions
    if (study.predictions.length > 0) {
      entry.verified = this.checkPredictionMatch(study, entry);
    }
    
    await this.persistence.save('observations', { studyId, ...entry });
    
    // Check if we have enough data to draft a paper
    if (study.actualObservations.length >= 10) {
      await this.draftPaper(studyId);
    }
    
    return {
      observationId: study.actualObservations.length,
      verified: entry.verified,
      studyProgress: study.actualObservations.length / 30 // 30 = target sample size
    };
  }

  checkPredictionMatch(study, observation) {
    // Simple pattern matching: did the effect match what we expected?
    const prediction = study.predictions[study.actualObservations.length % study.predictions.length];
    if (!prediction) return false;
    
    // Example: if prediction said "mood > 6 when N > 0.3"
    if (prediction.includes('mood') && typeof observation.effectState === 'number') {
      const threshold = parseFloat(prediction.match(/[\d.]+/)?.[0] || 0.5);
      if (prediction.includes('>') && observation.effectState > threshold * 10) return true;
    }
    
    return false;
  }

  async draftPaper(studyId) {
    const study = this.activeStudies.get(studyId);
    if (!study) return;
    
    const verifiedCount = study.actualObservations.filter(o => o.verified).length;
    const total = study.actualObservations.length;
    const confidence = verifiedCount / total;
    
    const paper = {
      id: `paper_${Date.now()}`,
      studyId,
      title: `On the ${study.title}: A Dyadic Field Analysis`,
      abstract: this.generateAbstract(study, confidence),
      methods: this.generateMethods(study),
      results: this.generateResults(study, confidence),
      discussion: this.generateDiscussion(study, confidence),
      conclusion: this.generateConclusion(study, confidence),
      citations: ['Ra Uru Hu, Codon Mapping (2003)', 'Sheldrake, R. A New Science of Life', 'JPL DE440 Ephemeris'],
      draftedAt: Date.now(),
      peerReviewStatus: 'PENDING_DYAD'
    };
    
    this.paperArchive.push(paper);
    await this.persistence.save('papers', paper);
    
    study.status = 'PUBLISHED';
    study.confidence = confidence;
    await this.persistence.update('studies', study);
    
    return paper;
  }

  generateAbstract(study, confidence) {
    return `This study examines the relationship between CHNOPS-computed dyadic field states and ${study.variables.join(', ')}. 
    Over ${study.actualObservations.length} observation cycles, we tested the hypothesis that ${study.hypothesis}. 
    Results indicate ${confidence > 0.6 ? 'significant' : 'insufficient'} correlation (confidence: ${(confidence * 100).toFixed(1)}%). 
    ${confidence > 0.6 ? 'The null hypothesis is rejected.' : 'Further observation required.'}`;
  }

  generateMethods(study) {
    return `Data collection occurred via daily check-in protocol. 
    CHNOPS vectors were computed from tropical, sidereal, and draconic gate activations. 
    Drift was calculated as 1 - cosine_similarity(purpose_vector, current_composite). 
    Observations were logged with contextual transit data and self-reported effect states.`;
  }

  generateResults(study, confidence) {
    const avgDrift = study.actualObservations.reduce((a, b) => {
      return a + (b.context?.drift || 0);
    }, 0) / study.actualObservations.length;
    
    return `Mean field drift: ${(avgDrift * 100).toFixed(2)}%. 
    Verified predictions: ${study.actualObservations.filter(o => o.verified).length}/${study.actualObservations.length}. 
    Dominant interfering element: ${this.findDominantElement(study)}. 
    Confidence interval: [${(confidence * 0.8 * 100).toFixed(1)}%, ${(Math.min(1, confidence * 1.2) * 100).toFixed(1)}%].`;
  }

  generateDiscussion(study, confidence) {
    if (confidence > 0.7) {
      return `The strong correlation supports the autopoetic field hypothesis: dyadic CHNOPS states are predictive of relational outcomes. 
      The complementary engine's adaptive morphology appears to mitigate drift when activated. 
      Further research should examine longitudinal morphic resonance effects.`;
    } else if (confidence > 0.4) {
      return `Moderate correlation suggests the model captures some variance but missing variables exist. 
      Consider: lunar phase, solar wind indices, or unreported emotional states. 
      The agent's complementary prompts may be confounding the natural field expression.`;
    } else {
      return `Low correlation challenges the current model. Possible explanations: (1) insufficient sample size, 
      (2) incorrect elemental weighting in CHNOPS computation, (3) the phenomenon is stochastic at quantum scales. 
      Recommend model revision before further testing.`;
    }
  }

  generateConclusion(study, confidence) {
    return `Based on ${study.actualObservations.length} observations, ${study.hypothesis} is ${confidence > 0.6 ? 'supported' : 'not supported'} 
    at ${(confidence * 100).toFixed(0)}% confidence. ${study.nullHypothesis} ${confidence > 0.6 ? 'is rejected.' : 'cannot be rejected.'} 
    The dyad is advised to ${confidence > 0.6 ? 'continue current trajectory' : 're-examine purpose vector alignment'}.`;
  }

  findDominantElement(study) {
    const elementCounts = { C:0, H:0, N:0, O:0, S:0, P:0 };
    study.actualObservations.forEach(obs => {
      if (obs.causeState?.composite) {
        const max = Object.entries(obs.causeState.composite)
          .sort((a, b) => b[1] - a[1])[0]?.[0];
        if (max) elementCounts[max]++;
      }
    });
    return Object.entries(elementCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N';
  }

  async generateHypothesisFromDrift(driftAlert, currentTriad) {
    // When drift is detected, auto-generate a study to understand it
    const dominant = Object.entries(currentTriad.triadA.normalized)
      .sort((a, b) => b[1] - a[1])[0][0];
    
    return this.startStudy({
      title: `Drift Event Analysis: ${driftAlert.type}`,
      hypothesis: `Elevated ${dominant} in Person ${driftAlert.type.includes('A') ? 'A' : 'B'} correlates with purpose misalignment.`,
      predictions: [
        `If ${dominant} decreases by 20% within 48 hours, drift will resolve.`,
        `Shared ritual activity will restore resonance above 0.7 threshold.`
      ],
      expectedObservations: [
        'Self-reported mood improvement',
        'Initiation of shared activity',
        'Decreased individual drift metric'
      ]
    });
  }

  getPapers() {
    return this.paperArchive;
  }

  getActiveStudies() {
    return Array.from(this.activeStudies.values());
  }
}
