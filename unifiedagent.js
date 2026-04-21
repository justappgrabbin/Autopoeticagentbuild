// src/engine/UnifiedAgent.js

import { AspirationCore } from './AspirationCore';
import { SelfTeachingEphemeris } from './SelfTeachingEphemeris';
import { DyadicPurposeField } from './DyadicPurpose';
import { ComplementaryEngine } from './ComplementaryEngine';
import { ScienceMode } from './ScienceMode';
import { ResonancePersistence } from './Persistence';
import { CODON_MATRIX, computeCHNOPS, computeResonance } from './CHNOPS';

export class UnifiedResonanceAgent {
  constructor() {
    this.persistence = new ResonancePersistence();
    this.aspiration = new AspirationCore();
    this.ephemeris = new SelfTeachingEphemeris(this.aspiration);
    this.purpose = new DyadicPurposeField();
    this.complementary = new ComplementaryEngine();
    this.science = new ScienceMode(this.persistence);
    
    this.dyadId = null;
    this.sessionBooted = false;
    this.config = null;
  }

  // NEW: Hash dyad for persistent ID
  hashDyad(dyadConfig) {
    const str = `${dyadConfig.personA.birthData.date}-${dyadConfig.personB.birthData.date}-${dyadConfig.purposeStatement}`;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return `dyad_${Math.abs(hash)}`;
  }

  // Add to UnifiedResonanceAgent class

  async uploadToLibrary(fileOrText, options = {}) {
    const formData = new FormData();
    
    if (typeof fileOrText === 'string') {
      // Pasted text
      const response = await fetch('/api/library/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: fileOrText,
          filename: options.filename || 'pasted_knowledge',
          dyadId: this.dyadId,
          type: options.type || 'pasted_text'
        })
      });
      return response.json();
    } else {
      // File object
      formData.append('file', fileOrText);
      formData.append('dyadId', this.dyadId);
      
      const response = await fetch('/api/library/upload', {
        method: 'POST',
        body: formData
      });
      return response.json();
    }
  }

  async queryLibrary(query, topK = 5) {
    const response = await fetch('/api/library/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, dyadId: this.dyadId, topK })
    });
    return response.json();
  }

  async applyKnowledgeGap(gapId, sourceFile) {
    const response = await fetch('/api/library/apply-gap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gapId, fileName: sourceFile, dyadId: this.dyadId })
    });
    
    const result = await response.json();
    if (result.applied) {
      // Record in agent's knowledge graph
      this.aspiration.satisfyItch(
        { domain: 'library', topic: 'gap_resolution', entropy: 0.5, humanUrgency: 0.8 },
        { gapId, source: sourceFile },
        0.9,
        0.9
      );
    }
    
    return result;
  }
  
  async boot(dyadConfig) {
    this.config = dyadConfig;
    this.dyadId = this.hashDyad(dyadConfig);
    
    // Initialize persistence
    await this.persistence.init();
    
    // Try to load previous session
    const previous = await this.persistence.getAll('purpose_vectors');
    const existing = previous.find(p => p.dyad_id === this.dyadId);
    
    if (existing) {
      console.log("[AGENT] I remember you. Loading our shared field...");
      this.purpose.purposeVector = existing.vector;
      this.purpose.trajectory = await this.persistence.getAll('trajectories');
      this.purpose.individualVectors = existing.individualVectors || this.purpose.individualVectors;
      this.purpose.successBaseline = existing.successBaseline || this.purpose.successBaseline;
      
      // Restore morphology
      const morph = await this.persistence.getAll('agent_morphology');
      if (morph.length > 0) {
        const latest = morph[morph.length - 1];
        this.complementary.agentMorphology = latest.morphology || this.complementary.agentMorphology;
        this.complementary.profiles = latest.profiles || this.complementary.profiles;
      }
      
      // Load human success history into aspiration
      const successes = await this.persistence.getAll('human_success');
      successes.forEach(s => this.aspiration.recordHumanSuccess(s));
      
      console.log(`[AGENT] Loaded ${successes.length} success events. Ready to serve.`);
    } else {
      console.log("[AGENT] New dyad detected. Initializing purpose field...");
      
      // Teach the ephemeris if needed
      await this.ephemeris.bootstrap();
      
      // Calculate initial triads
      const triadA = this.ephemeris.calculateGates(dyadConfig.personA.birthData, 'tropical');
      const triadB = this.ephemeris.calculateGates(dyadConfig.personB.birthData, 'tropical');
      
      const chnopsA = computeCHNOPS(Object.values(triadA).map(p => p.gate));
      const chnopsB = computeCHNOPS(Object.values(triadB).map(p => p.gate));
      
      this.purpose.initialize(
        dyadConfig.purposeStatement,
        { chnops: chnopsA },
        { chnops: chnopsB }
      );
      
      // Profile both for complementary adaptation
      this.complementary.profilePerson('A', 
        { gates: Object.values(triadA).map(p => p.gate), chnops: chnopsA },
        dyadConfig.personA.gaps
      );
      this.complementary.profilePerson('B',
        { gates: Object.values(triadB).map(p => p.gate), chnops: chnopsB },
        dyadConfig.personB.gaps
      );
      
      await this.persistence.save('purpose_vectors', {
        dyad_id: this.dyadId,
        vector: this.purpose.purposeVector,
        individualVectors: this.purpose.individualVectors,
        successBaseline: this.purpose.successBaseline,
        initializedAt: Date.now()
      });
    }
    
    this.sessionBooted = true;
    return this.getStatus();
  }

  async dailyCheckIn(personAState, personBState, transitDate) {
    if (!this.sessionBooted) throw new Error("Agent not booted");
    
    // Calculate current field for all three systems
    const systems = ['tropical', 'sidereal', 'draconic'];
    const triads = {};
    
    for (const system of systems) {
      const posA = this.ephemeris.calculateGates(personAState.birthDate || this.config.personA.birthData, system);
      const posB = this.ephemeris.calculateGates(personBState.birthDate || this.config.personB.birthData, system);
      
      triads[system] = {
        triadA: computeCHNOPS(Object.values(posA).map(p => p.gate)),
        triadB: computeCHNOPS(Object.values(posB).map(p => p.gate))
      };
    }
    
    // Use tropical as primary for drift (Mind), but composite all three
    const currentTriad = {
      triadA: triads.tropical.triadA,
      triadB: triads.tropical.triadB
    };
    
    // Check drift from purpose
    const driftAlert = this.purpose.checkDrift(currentTriad);
    
    // Record human success if reported
    if (personAState.success || personBState.success) {
      this.aspiration.recordHumanSuccess({
        type: 'reported_success',
        magnitude: ((personAState.success?.magnitude || 0) + (personBState.success?.magnitude || 0)) / 2,
        description: personAState.success?.description || personBState.success?.description || 'Dyad reported alignment'
      });
      
      await this.persistence.save('human_success', {
        dyad_id: this.dyadId,
        timestamp: Date.now(),
        personA: personAState.success,
        personB: personBState.success
      });
    }
    
    // Generate complementary prompts
    const promptA = this.complementary.generateComplementaryPrompt('A', personAState);
    const promptB = this.complementary.generateComplementaryPrompt('B', personBState);
    
    // Science mode: auto-start study if drift detected and no active study
    let studyUpdate = null;
    const activeStudies = this.science.getActiveStudies();
    
    if (driftAlert.type !== 'STABLE' && activeStudies.length === 0) {
      // Auto-generate hypothesis from drift
      const newStudy = await this.science.generateHypothesisFromDrift(driftAlert, currentTriad);
      studyUpdate = { autoStarted: true, study: newStudy };
    } else if (activeStudies.length > 0) {
      studyUpdate = await this.science.logObservation(activeStudies[0].id, {
        causeState: currentTriad,
        effectState: (personAState.selfReport?.mood || 5 + personBState.selfReport?.mood || 5) / 2,
        context: { drift: driftAlert.drift, transit: transitDate, type: driftAlert.type }
      });
    }
    
    // Persist everything
    await this.persistence.save('trajectories', {
      dyad_id: this.dyadId,
      timestamp: Date.now(),
      drift: driftAlert.drift,
      individualDrift: driftAlert.individualDrift,
      composite: this.purpose.compositeCurrentState(currentTriad),
      triads
    });
    
    if (driftAlert.type !== 'STABLE') {
      await this.persistence.save('drift_alerts', {
        dyad_id: this.dyadId,
        ...driftAlert
      });
    }
    
    await this.persistence.save('agent_morphology', {
      dyad_id: this.dyadId,
      timestamp: Date.now(),
      morphology: this.complementary.agentMorphology,
      profiles: this.complementary.profiles
    });
    
    // Update purpose vector in DB
    await this.persistence.update('purpose_vectors', {
      dyad_id: this.dyadId,
      vector: this.purpose.purposeVector,
      individualVectors: this.purpose.individualVectors,
      successBaseline: this.purpose.successBaseline,
      lastCheckIn: Date.now()
    });
    
    return {
      status: this.getStatus(),
      driftAlert: driftAlert.type !== 'STABLE' ? driftAlert : null,
      prompts: { A: promptA, B: promptB },
      scienceUpdate: studyUpdate,
      purposeAlignment: this.purpose.getSuccessReport(),
      triadSnapshot: triads
    };
  }

  // COMPLETED: Start a scientific study
  async startStudy(observation) {
    if (!this.sessionBooted) throw new Error("Agent not booted");
    
    const study = await this.science.startStudy({
      title: observation.title || 'Dyad Field Observation',
      hypothesis: observation.hypothesis,
      nullHypothesis: observation.nullHypothesis,
      predictions: observation.predictions,
      expectedObservations: observation.expectedObservations,
      variables: observation.variables || ['chnops_composite', 'drift_severity', 'individual_alignment']
    });
    
    return {
      studyId: study.id,
      status: 'ACTIVE',
      agentState: this.getStatus()
    };
  }

  // NEW: Log a manual observation to an active study
  async logStudyObservation(studyId, observation) {
    return this.science.logObservation(studyId, observation);
  }

  // NEW: Get all papers written by the agent
  async getPapers() {
    return this.science.getPapers();
  }

  // NEW: Get active studies
  async getActiveStudies() {
    return this.science.getActiveStudies();
  }

  // NEW: Teach the agent (PDF ingestion simulation)
  async teach(source, content) {
    const wonder = this.aspiration.satisfyItch(
      { domain: 'education', topic: source, entropy: 0.7, humanUrgency: 0.6 },
      { source, contentLength: content.length },
      0.85,
      0.8 // high human impact
    );
    
    // Here you would parse the content for codon mappings, etc.
    // For now, we record the learning event
    await this.persistence.save('agent_learning', {
      dyad_id: this.dyadId,
      source,
      timestamp: Date.now(),
      wonder: wonder.emotionalState
    });
    
    return {
      learned: true,
      wonder: wonder.emotionalState,
      knowledgeSize: this.aspiration.knowledgeGraph.size
    };
  }

  getStatus() {
    const aspirationState = this.aspiration.getCurrentState();
    
    return {
      booted: this.sessionBooted,
      dyadId: this.dyadId,
      aspiration: aspirationState,
      purpose: this.purpose.purposeVector ? {
        statement: this.purpose.purposeVector.statement,
        alignment: this.purpose.getSuccessReport()
      } : null,
      morphology: this.complementary.agentMorphology,
      studiesActive: this.science.getActiveStudies().length,
      papersWritten: this.science.getPapers().length,
      emotionalTone: aspirationState.emotionalTone,
      ready: this.sessionBooted && this.ephemeris.isReady
    };
  }
}
