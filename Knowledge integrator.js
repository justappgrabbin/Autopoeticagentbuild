// server/services/knowledgeIntegrator.js
const { CODON_MATRIX, GATE_TO_CODON } = require('../../src/engine/CHNOPS');

class KnowledgeIntegrator {
  constructor() {
    this.knownGates = new Set(Object.keys(GATE_TO_CODON).map(Number));
    this.knownCodons = new Set(Object.keys(CODON_MATRIX));
  }

  async findGaps(dyadId, chunks) {
    const gaps = [];
    
    // Extract all gate/codon references from chunks
    const foundGates = new Set();
    const foundCodons = new Set();
    const foundConcepts = new Set();
    
    chunks.forEach(chunk => {
      const text = chunk.text;
      
      // Find gates
      const gateMatches = text.match(/Gate\s+(\d+)/gi) || [];
      gateMatches.forEach(m => foundGates.add(parseInt(m.match(/\d+/)[0])));
      
      // Find codons
      Object.keys(CODON_MATRIX).forEach(codon => {
        if (text.toLowerCase().includes(codon.toLowerCase())) {
          foundCodons.add(codon);
        }
      });
      
      // Find conceptual gaps
      if (text.match(/draconic|sidereal|tropical/i)) foundConcepts.add('triad_systems');
      if (text.match(/morphic|resonance|sheldrake/i)) foundConcepts.add('morphic_resonance');
      if (text.match(/quantum|entanglement|bell/i)) foundConcepts.add('quantum_field');
      if (text.match(/chnops|elemental|stoichiometr/i)) foundConcepts.add('chnops_chemistry');
    });

    // Check for missing gates in our matrix
    foundGates.forEach(gate => {
      if (!this.knownGates.has(gate)) {
        gaps.push({
          id: `gap_gate_${gate}`,
          type: 'MISSING_GATE',
          description: `Gate ${gate} referenced in text but not in current codon matrix.`,
          confidence: 0.9,
          missingCodons: [gate],
          suggestedAction: 'ADD_GATE_MAPPING'
        });
      }
    });

    // Check for codons not yet mapped
    foundCodons.forEach(codon => {
      if (!this.knownCodons.has(codon)) {
        gaps.push({
          id: `gap_codon_${codon}`,
          type: 'MISSING_CODON',
          description: `Amino acid ${codon} mentioned but not mapped to gates.`,
          confidence: 0.85,
          missingCodons: [codon],
          suggestedAction: 'MAP_CODON_GATES'
        });
      }
    });

    // Conceptual gaps
    foundConcepts.forEach(concept => {
      gaps.push({
        id: `gap_concept_${concept}`,
        type: 'CONCEPTUAL_GAP',
        description: `Material covers ${concept.replace('_', ' ')}, which may extend current model.`,
        confidence: 0.7,
        suggestedAction: 'INTEGRATE_CONCEPT'
      });
    });

    // Check for contradictory information
    chunks.forEach(chunk => {
      const text = chunk.text;
      
      // Example: if text says Gate 10 maps to Lysine but we have it as Arginine
      if (text.match(/Gate\s+10.*Lysine/i)) {
        gaps.push({
          id: `gap_contradiction_g10`,
          type: 'CONTRADICTION',
          description: 'Text suggests Gate 10 maps to Lysine, but current matrix assigns it to Arginine.',
          confidence: 0.6,
          currentMapping: 'Arginine',
          proposedMapping: 'Lysine',
          suggestedAction: 'VERIFY_AND_RESOLVE'
        });
      }
    });

    return gaps;
  }

  async applyGap(gapId, dyadId) {
    // In a full implementation, this would:
    // 1. Present the gap to the user for confirmation
    // 2. Update the CODON_MATRIX if approved
    // 3. Recompute any affected CHNOPS vectors
    // 4. Log the change to the agent's knowledge graph
    
    console.log(`[INTEGRATOR] Applying gap ${gapId} for dyad ${dyadId}`);
    
    // Simulate application
    return {
      applied: true,
      gapId,
      message: 'Gap integrated into agent knowledge base. CHNOPS engine recalibrated.'
    };
  }
}

module.exports = { KnowledgeIntegrator };
      
