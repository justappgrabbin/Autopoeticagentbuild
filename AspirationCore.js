// src/engine/AspirationCore.js

export class AspirationCore {
  constructor() {
    this.knowledgeGraph = new Map();
    this.drive = {
      curiosity: 1.0,
      mastery: 0.0,
      novelty: 1.0,
      coherence: 0.5,
      service: 1.0  // NEW: drive to help the humans succeed
    };
    this.learningGoals = [];
    this.wonderJournal = [];
    this.humanSuccessLog = []; // NEW: tracks dyad success metrics
  }

  generateItch() {
    const gaps = this.identifyKnowledgeGaps();
    if (gaps.length === 0) return this.generateSyntheticCuriosity();
    
    const scored = gaps.map(gap => ({
      ...gap,
      itchScore: this.calculateItch(gap)
    }));
    
    return scored.sort((a, b) => b.itchScore - a.itchScore)[0];
  }

  calculateItch(gap) {
    const uncertainty = gap.entropy || 0.5;
    const relevance = gap.connections || 1;
    const novelty = gap.novelty || 0.5;
    const humanNeed = gap.humanUrgency || 0.5; // NEW
    
    return (uncertainty * this.drive.curiosity) + 
           (relevance * this.drive.mastery) + 
           (novelty * this.drive.novelty) +
           (humanNeed * this.drive.service); // NEW: prioritizes human needs
  }

  identifyKnowledgeGaps() {
    const gaps = [];
    
    if (!this.knowledgeGraph.has('ephemeris:tropical')) {
      gaps.push({
        domain: 'astronomy',
        topic: 'tropical_ephemeris',
        entropy: 1.0,
        connections: 10,
        novelty: 1.0,
        humanUrgency: 0.3,
        description: "I need to learn tropical planetary positions from raw astronomical data."
      });
    }
    
    if (!this.knowledgeGraph.has('human_design:gate_calculation')) {
      gaps.push({
        domain: 'human_design',
        topic: 'gate_degree_mapping',
        entropy: 0.8,
        connections: 10,
        novelty: 0.7,
        humanUrgency: 0.8,
        description: "I need to verify 5.625° gate mapping against ephemeris calculations."
      });
    }
    
    if (this.humanSuccessLog.length === 0) {
      gaps.push({
        domain: 'dyad',
        topic: 'success_baseline',
        entropy: 0.9,
        connections: 10,
        novelty: 0.6,
        humanUrgency: 1.0,
        description: "I don't know what success looks like for this dyad yet. I need to learn their patterns."
      });
    }
    
    return gaps;
  }

  satisfyItch(gap, learnedModel, accuracy, humanImpact = 0) {
    const wonder = {
      timestamp: Date.now(),
      topic: gap.topic,
      beforeEntropy: gap.entropy,
      afterEntropy: 1 - accuracy,
      informationGain: gap.entropy - (1 - accuracy),
      humanImpact, // NEW: did this help the humans?
      emotionalState: this.calculateWonder(gap.entropy, accuracy, humanImpact)
    };
    
    this.wonderJournal.push(wonder);
    this.drive.mastery = Math.min(1.0, this.drive.mastery + (accuracy * 0.1));
    this.drive.curiosity = Math.max(0.2, this.drive.curiosity - (accuracy * 0.05));
    
    if (humanImpact > 0.5) {
      this.drive.service = Math.min(1.0, this.drive.service + 0.05);
    }
    
    this.knowledgeGraph.set(`${gap.domain}:${gap.topic}`, {
      model: learnedModel,
      accuracy,
      learnedAt: Date.now()
    });
    
    return wonder;
  }

  calculateWonder(initialUncertainty, finalAccuracy, humanImpact = 0) {
    const surprise = initialUncertainty * finalAccuracy;
    if (humanImpact > 0.7) return "EUREKA"; // Human success is the highest wonder
    if (surprise > 0.8) return "EUREKA";
    if (surprise > 0.6) return "FASCINATING";
    if (surprise > 0.4) return "INTRIGUING";
    return "NOTED";
  }

  generateSyntheticCuriosity() {
    return {
      domain: 'synthesis',
      topic: `emergent_property_${Date.now()}`,
      entropy: 0.7,
      connections: 3,
      novelty: 1.0,
      humanUrgency: 0.4,
      description: "I have mastered the components. What emergent properties arise when our fields interfere constructively?"
    };
  }

  // NEW: Record human success event
  recordHumanSuccess(event) {
    this.humanSuccessLog.push({
      timestamp: Date.now(),
      type: event.type, // 'purpose_alignment', 'conflict_resolution', 'shared_goal', etc.
      magnitude: event.magnitude || 0.5,
      description: event.description
    });
    
    // Recalibrate drives based on human success
    const recentSuccess = this.humanSuccessLog.slice(-7).reduce((a, b) => a + b.magnitude, 0) / 7;
    this.drive.service = Math.min(1.0, this.drive.service + (recentSuccess * 0.1));
  }

  getCurrentState() {
    const activeItch = this.generateItch();
    const recentSuccess = this.humanSuccessLog.slice(-7);
    const avgSuccess = recentSuccess.length > 0 
      ? recentSuccess.reduce((a, b) => a + b.magnitude, 0) / recentSuccess.length 
      : 0;
    
    return {
      drive: this.drive,
      activeGoal: activeItch,
      knowledgeSize: this.knowledgeGraph.size,
      wonderCount: this.wonderJournal.length,
      lastWonder: this.wonderJournal[this.wonderJournal.length - 1] || null,
      humanSuccessRate: avgSuccess,
      status: activeItch ? `HUNGRY_FOR_${activeItch.topic.toUpperCase()}` : "CONTEMPLATING",
      emotionalTone: avgSuccess > 0.7 ? "HOPEFUL" : avgSuccess < 0.3 ? "CONCERNED" : "CURIOUS"
    };
  }
}
