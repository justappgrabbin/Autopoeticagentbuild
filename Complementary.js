// src/engine/ComplementaryEngine.js

export class ComplementaryEngine {
  constructor() {
    this.profiles = { A: null, B: null };
    this.agentMorphology = {
      memory: { A: 0.5, B: 0.5 },
      timing: { A: 0.5, B: 0.5 },
      emotional: { A: 0.5, B: 0.5 },
      initiative: { A: 0.5, B: 0.5 }
    };
    this.interactionHistory = { A: [], B: [] };
  }

  profilePerson(id, chartData, gaps) {
    // gaps: { memoryIssues: boolean, needsReminders: boolean, emotionalSupport: boolean, etc. }
    this.profiles[id] = {
      gates: chartData.gates,
      chnops: chartData.chnops,
      gaps: gaps || {},
      dominantElement: this.findDominant(chartData.chnops.normalized),
      lastUpdated: Date.now()
    };
    
    // Initial morphology based on gaps
    if (gaps) {
      if (gaps.memoryIssues || gaps.forgetfulness) this.agentMorphology.memory[id] = 0.9;
      if (gaps.needsStructure) this.agentMorphology.timing[id] = 0.9;
      if (gaps.emotionalSupport) this.agentMorphology.emotional[id] = 0.9;
      if (gaps.needsInitiation) this.agentMorphology.initiative[id] = 0.9;
    }
  }

  findDominant(normalized) {
    return Object.entries(normalized).sort((a, b) => b[1] - a[1])[0][0];
  }

  generateComplementaryPrompt(id, currentState) {
    const profile = this.profiles[id];
    if (!profile) return null;
    
    const prompts = [];
    const morphology = {};
    
    // Memory complementarity
    if (this.agentMorphology.memory[id] > 0.7) {
      const memoryPrompt = this.generateMemoryPrompt(id, currentState);
      if (memoryPrompt) prompts.push(memoryPrompt);
      morphology.memory = 'ACTIVE';
    }
    
    // Timing/Structure complementarity
    if (this.agentMorphology.timing[id] > 0.7) {
      const timingPrompt = this.generateTimingPrompt(id, currentState);
      if (timingPrompt) prompts.push(timingPrompt);
      morphology.timing = 'ACTIVE';
    }
    
    // Emotional complementarity
    if (this.agentMorphology.emotional[id] > 0.7) {
      const emotionalPrompt = this.generateEmotionalPrompt(id, currentState);
      if (emotionalPrompt) prompts.push(emotionalPrompt);
      morphology.emotional = 'ACTIVE';
    }
    
    // Initiative complementarity
    if (this.agentMorphology.initiative[id] > 0.7) {
      const initiativePrompt = this.generateInitiativePrompt(id, currentState);
      if (initiativePrompt) prompts.push(initiativePrompt);
      morphology.initiative = 'ACTIVE';
    }
    
    // General elemental complement
    const elementalPrompt = this.generateElementalPrompt(id, currentState);
    if (elementalPrompt) prompts.push(elementalPrompt);
    
    // Record interaction
    this.interactionHistory[id].push({
      timestamp: Date.now(),
      promptCount: prompts.length,
      morphology
    });
    
    // Adapt morphology based on success
    this.adaptMorphology(id);
    
    return {
      person: id,
      prompts,
      morphology,
      dominantElement: profile.dominantElement,
      adaptedTo: Object.keys(morphology).filter(k => morphology[k] === 'ACTIVE')
    };
  }

  generateMemoryPrompt(id, state) {
    // If person has memory gaps, agent becomes their external memory
    const pending = state.pendingTasks || state.intentions || [];
    if (pending.length === 0) return null;
    
    return {
      type: 'MEMORY',
      urgency: 'low',
      message: `You mentioned wanting to: ${pending.slice(-3).join(', ')}. The field suggests ${this.profiles[id].dominantElement} energy is strong today—good timing for follow-through.`,
      action: 'REMIND'
    };
  }

  generateTimingPrompt(id, state) {
    const now = new Date();
    const hour = now.getHours();
    
    // Suggest optimal timing based on their CHNOPS profile
    const isMorningPerson = this.profiles[id].chnops.normalized.O > 0.2; // Oxygen = action
    
    if (isMorningPerson && hour < 10) {
      return {
        type: 'TIMING',
        urgency: 'medium',
        message: 'Your oxidation potential peaks in the morning. Ideal window for initiating difficult conversations or tasks.',
        action: 'ACT_NOW'
      };
    }
    
    return {
      type: 'TIMING',
      urgency: 'low',
      message: 'Your catalytic energy (N) rises this evening. Save creative work for after sunset.',
      action: 'SCHEDULE'
    };
  }

  generateEmotionalPrompt(id, state) {
    const mood = state.selfReport?.mood || 5;
    if (mood > 6) return null; // They're fine
    
    const otherId = id === 'A' ? 'B' : 'A';
    const otherElement = this.profiles[otherId]?.dominantElement || 'C';
    
    return {
      type: 'EMOTIONAL',
      urgency: mood < 4 ? 'high' : 'medium',
      message: `Your ${this.profiles[id].dominantElement} field is low. ${otherId === 'A' ? 'Your partner' : 'You'} carry strong ${otherElement} energy today—ask for ${this.getElementalSupport(otherElement)}.`,
      action: 'REACH_OUT'
    };
  }

  generateInitiativePrompt(id, state) {
    // If person struggles with starting, agent prompts gentle initiation
    return {
      type: 'INITIATIVE',
      urgency: 'medium',
      message: `The shared purpose field needs your ${this.profiles[id].dominantElement} signature. One small act of ${this.getElementalVerb(this.profiles[id].dominantElement)} would realign the dyad.`,
      action: 'INITIATE'
    };
  }

  generateElementalPrompt(id, state) {
    const profile = this.profiles[id];
    const otherId = id === 'A' ? 'B' : 'A';
    const otherProfile = this.profiles[otherId];
    
    if (!otherProfile) return null;
    
    // Find complementarity
    const myWeak = Object.entries(profile.chnops.normalized).sort((a, b) => a[1] - b[1])[0][0];
    const theirStrong = Object.entries(otherProfile.chnops.normalized).sort((a, b) => b[1] - a[1])[0][0];
    
    if (myWeak === theirStrong) {
      return {
        type: 'COMPLEMENT',
        urgency: 'low',
        message: `You are low on ${myWeak} (${ELEMENTAL_BEHAVIOR[myWeak]}). Your partner's field is rich in this element today—proximity will balance you.`,
        action: 'CONNECT'
      };
    }
    
    return null;
  }

  getElementalSupport(element) {
    const map = {
      C: 'grounding and structure',
      H: 'flow and emotional safety',
      N: 'catalytic conversation and new perspectives',
      O: 'action-oriented support',
      S: 'deep listening and bonding',
      P: 'energetic activation and timing'
    };
    return map[element] || 'presence';
  }

  getElementalVerb(element) {
    const map = {
      C: 'structuring',
      H: 'flowing',
      N: 'transforming',
      O: 'acting',
      S: 'bonding',
      P: 'activating'
    };
    return map[element] || 'being';
  }

  adaptMorphology(id) {
    // If prompts aren't helping, shift morphology
    const history = this.interactionHistory[id];
    if (history.length < 5) return;
    
    const recent = history.slice(-5);
    const avgPrompts = recent.reduce((a, b) => a + b.promptCount, 0) / 5;
    
    // If too many prompts, back off
    if (avgPrompts > 3) {
      Object.keys(this.agentMorphology).forEach(trait => {
        this.agentMorphology[trait][id] *= 0.9;
      });
    }
    
    // If no prompts triggered, maybe we need to be more present
    if (avgPrompts === 0) {
      this.agentMorphology.emotional[id] = Math.min(1.0, this.agentMorphology.emotional[id] + 0.1);
    }
  }
}
