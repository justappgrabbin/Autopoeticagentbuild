// server/services/ingestion.js
const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const unzipper = require('unzipper');
const tar = require('tar');
const { OpenAI } = require('openai');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

class IngestionEngine {
  async extract(filePath, originalName) {
    const ext = path.extname(originalName).toLowerCase();
    const mimeType = this.getMimeType(ext);
    
    let text = '';
    let type = 'unknown';

    switch (mimeType) {
      case 'pdf':
        const pdfBuffer = fs.readFileSync(filePath);
        const pdfData = await pdfParse(pdfBuffer);
        text = pdfData.text;
        type = 'pdf';
        break;
        
      case 'docx':
        const docBuffer = fs.readFileSync(filePath);
        const docResult = await mammoth.extractRawText({ buffer: docBuffer });
        text = docResult.value;
        type = 'docx';
        break;
        
      case 'zip':
        text = await this.extractZip(filePath);
        type = 'zip';
        break;
        
      case 'tar':
      case 'gz':
        text = await this.extractTar(filePath);
        type = 'archive';
        break;
        
      case 'code':
      case 'text':
        text = fs.readFileSync(filePath, 'utf-8');
        type = ext.replace('.', '');
        break;
        
      default:
        text = fs.readFileSync(filePath, 'utf-8');
        type = 'text';
    }

    // Generate summary using LLM
    const summary = await this.summarize(text.substring(0, 8000));
    
    return { text, type, summary, originalName };
  }

  async extractZip(filePath) {
    const directory = await unzipper.Open.file(filePath);
    let combined = '';
    
    for (const file of directory.files) {
      if (file.path.match(/\.(js|ts|jsx|tsx|py|md|txt|json|css|html)$/)) {
        const content = await file.buffer();
        combined += `\n\n--- FILE: ${file.path} ---\n\n`;
        combined += content.toString('utf-8').substring(0, 5000);
      }
    }
    
    return combined;
  }

  async extractTar(filePath) {
    const extractPath = `uploads/extracted_${Date.now()}`;
    await fs.promises.mkdir(extractPath, { recursive: true });
    
    await tar.x({
      file: filePath,
      cwd: extractPath,
      filter: (path) => path.match(/\.(js|ts|py|md|txt|json)$/)
    });
    
    const files = await fs.promises.readdir(extractPath, { recursive: true });
    let combined = '';
    
    for (const file of files) {
      const fullPath = path.join(extractPath, file);
      const stat = await fs.promises.stat(fullPath);
      if (stat.isFile()) {
        const content = await fs.promises.readFile(fullPath, 'utf-8');
        combined += `\n\n--- FILE: ${file} ---\n\n`;
        combined += content.substring(0, 5000);
      }
    }
    
    // Cleanup
    await fs.promises.rm(extractPath, { recursive: true });
    return combined;
  }

  async chunk(extraction) {
    const { text, type } = extraction;
    const chunks = [];
    
    // Semantic chunking strategy varies by type
    if (type === 'pdf' || type === 'docx') {
      // Split by paragraphs, respect semantic boundaries
      const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 20);
      let current = '';
      
      for (const para of paragraphs) {
        if ((current + para).length > 800 && current.length > 0) {
          chunks.push({ text: current.trim(), type, metadata: {} });
          current = para;
        } else {
          current += '\n\n' + para;
        }
      }
      if (current) chunks.push({ text: current.trim(), type, metadata: {} });
      
    } else if (['js', 'ts', 'jsx', 'tsx', 'py'].includes(type)) {
      // Code: split by functions/classes
      const codeBlocks = text.split(/(?=(?:function|class|const|let|var|def|import|export)\s)/);
      for (const block of codeBlocks) {
        if (block.trim().length > 10) {
          chunks.push({ 
            text: block.trim(), 
            type: 'code', 
            metadata: { language: type } 
          });
        }
      }
      
    } else {
      // Default: sliding window
      const windowSize = 1000;
      const overlap = 200;
      for (let i = 0; i < text.length; i += windowSize - overlap) {
        chunks.push({
          text: text.substring(i, i + windowSize),
          type: 'text',
          metadata: { offset: i }
        });
      }
    }
    
    return chunks;
  }

  async embed(chunks) {
    const embeddings = [];
    
    // Batch embed via OpenAI
    for (let i = 0; i < chunks.length; i += 20) {
      const batch = chunks.slice(i, i + 20).map(c => c.text.substring(0, 8000));
      const response = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: batch
      });
      
      embeddings.push(...response.data.map(d => d.embedding));
    }
    
    return embeddings;
  }

  async embedQuery(query) {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: query
    });
    return response.data[0].embedding;
  }

  async summarize(text) {
    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'Summarize this text for a resonance knowledge base. Identify: 1) Main concepts, 2) Any codon/amino acid/gate references, 3) Elemental themes (structure, flow, catalysis, etc.), 4) How it might relate to dyadic field theory.'
          },
          { role: 'user', content: text.substring(0, 4000) }
        ],
        temperature: 0.3
      });
      return response.choices[0].message.content;
    } catch (e) {
      return 'Summary unavailable';
    }
  }

  getMimeType(ext) {
    const map = {
      '.pdf': 'pdf',
      '.docx': 'docx',
      '.doc': 'docx',
      '.zip': 'zip',
      '.tar': 'tar',
      '.gz': 'gz',
      '.tgz': 'gz',
      '.js': 'code',
      '.jsx': 'code',
      '.ts': 'code',
      '.tsx': 'code',
      '.py': 'code',
      '.json': 'code',
      '.md': 'text',
      '.txt': 'text'
    };
    return map[ext] || 'text';
  }
}

module.exports = { IngestionEngine };
