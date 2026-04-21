// server/server.js
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { IngestionEngine } = require('./services/ingestion');
const { VectorStore } = require('./services/vectorStore');
const { KnowledgeIntegrator } = require('./services/knowledgeIntegrator');

const app = express();
const upload = multer({ dest: 'uploads/' });

app.use(cors());
app.use(express.json({ limit: '50mb' }));

const ingestion = new IngestionEngine();
const vectorStore = new VectorStore();
const integrator = new KnowledgeIntegrator();

// Upload endpoint
app.post('/api/library/upload', upload.single('file'), async (req, res) => {
  try {
    const { dyadId } = req.body;
    const filePath = req.file.path;
    const originalName = req.file.originalname;
    
    // Extract content based on file type
    const extraction = await ingestion.extract(filePath, originalName);
    
    // Chunk and embed
    const chunks = await ingestion.chunk(extraction);
    const embeddings = await ingestion.embed(chunks);
    
    // Analyze against existing knowledge
    const gaps = await integrator.findGaps(dyadId, chunks);
    
    // Tag with codons and CHNOPS
    const taggedChunks = chunks.map((chunk, i) => ({
      ...chunk,
      embedding: embeddings[i],
      codonTags: extractCodonTags(chunk.text),
      chnopsSignature: computeChunkCHNOPS(chunk.text)
    }));

    // Store in vector DB
    const docId = await vectorStore.store({
      dyadId,
      filename: originalName,
      type: extraction.type,
      chunks: taggedChunks,
      createdAt: Date.now()
    });

    // Clean up temp file
    fs.unlinkSync(filePath);

    res.json({
      id: docId,
      filename: originalName,
      chunks: chunks.length,
      gaps: gaps,
      summary: extraction.summary,
      integrated: gaps.length > 0
    });
    
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Paste endpoint
app.post('/api/library/ingest', async (req, res) => {
  try {
    const { content, filename, dyadId, type = 'pasted_text' } = req.body;
    
    const chunks = await ingestion.chunk({ text: content, type });
    const embeddings = await ingestion.embed(chunks);
    
    const gaps = await integrator.findGaps(dyadId, chunks);
    
    const taggedChunks = chunks.map((chunk, i) => ({
      ...chunk,
      embedding: embeddings[i],
      codonTags: extractCodonTags(chunk.text),
      chnopsSignature: computeChunkCHNOPS(chunk.text)
    }));

    const docId = await vectorStore.store({
      dyadId,
      filename: filename || 'pasted_snippet',
      type,
      chunks: taggedChunks,
      createdAt: Date.now()
    });

    res.json({
      id: docId,
      chunks: chunks.length,
      gaps,
      integrated: gaps.length > 0
    });
    
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Query endpoint
app.post('/api/library/query', async (req, res) => {
  try {
    const { query, dyadId, topK = 5 } = req.body;
    
    const queryEmbedding = await ingestion.embedQuery(query);
    const results = await vectorStore.similaritySearch(queryEmbedding, dyadId, topK);
    
    // Enhance with agent context
    const enhanced = results.map(r => ({
      ...r,
      relevance: r.score,
      codonContext: r.codonTags,
      suggestedAction: suggestAction(r, query)
    }));
    
    res.json({ results: enhanced });
    
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get library
app.get('/api/library', async (req, res) => {
  const items = await vectorStore.list();
  res.json({ items });
});

// Apply gap fill
app.post('/api/library/apply-gap', async (req, res) => {
  try {
    const { gapId, fileName, dyadId } = req.body;
    const applied = await integrator.applyGap(gapId, dyadId);
    res.json({ applied, gapId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Helper: Extract codon references from text
function extractCodonTags(text) {
  const tags = [];
  const gateMatches = text.match(/Gate\s+(\d+)/gi) || [];
  const codonMatches = text.match(/(Alanine|Arginine|Asparagine|Cysteine|Glutamine|Histidine|Isoleucine|Leucine|Lysine|Methionine|Phenylalanine|Proline|Serine|Threonine|Tryptophan|Tyrosine|Valine)/gi) || [];
  
  gateMatches.forEach(m => {
    const num = parseInt(m.match(/\d+/)[0]);
    tags.push(`gate-${num}`);
  });
  
  codonMatches.forEach(m => tags.push(m.toLowerCase()));
  
  return [...new Set(tags)];
}

// Helper: Compute CHNOPS signature from text
function computeChunkCHNOPS(text) {
  // Simple heuristic: count references to elements/concepts
  const sig = { C: 0, H: 0, N: 0, O: 0, S: 0, P: 0 };
  
  if (text.match(/structure|form|boundary|carbon|scaffold/i)) sig.C += 1;
  if (text.match(/flow|emotion|water|movement|transfer/i)) sig.H += 1;
  if (text.match(/catalysis|transform|mutation|nitrogen|aware/i)) sig.N += 1;
  if (text.match(/action|oxidation|oxygen|manifest|consume/i)) sig.O += 1;
  if (text.match(/bridge|bond|sulfur|connect|resist/i)) sig.S += 1;
  if (text.match(/phosphorylation|activate|timing|energy|power/i)) sig.P += 1;
  
  return sig;
}

function suggestAction(result, query) {
  if (query.match(/gate|codon|amino/i)) return 'CROSS_REFERENCE_CODON';
  if (query.match(/drift|purpose|alignment/i)) return 'CHECK_DYAD_FIELD';
  if (query.match(/experiment|hypothesis|study/i)) return 'GENERATE_STUDY';
  return 'RETRIEVE';
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`[SERVER] Resonance Library running on port ${PORT}`);
});
