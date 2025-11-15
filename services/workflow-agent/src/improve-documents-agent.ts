import { StateGraph, END, START, Annotation } from "@langchain/langgraph";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from 'dotenv';
import winston from 'winston';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';

// Load environment variables
config();

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

// Initialize Google AI model
const model = new ChatGoogleGenerativeAI({
  model: "gemini-1.5-flash",
  temperature: 0.7,
  apiKey: process.env.GOOGLE_AI_API_KEY
});

// State management for document improvement workflow
const DocumentImprovementState = Annotation.Root({
  // Input data
  resourceId: Annotation<string>,
  documentContent: Annotation<string>,
  currentArchitecture: Annotation<string>,

  // Processing state
  chunks: Annotation<string[]>,
  currentChunkIndex: Annotation<number>,
  chunkAnalyses: Annotation<any[]>,

  // Progress tracking
  runId: Annotation<string>,
  stateUpdates: Annotation<any[]>,
  errors: Annotation<string[]>,

  // Final output
  suggestions: Annotation<any>,
  completed: Annotation<boolean>
});

type DocumentImprovementStateType = typeof DocumentImprovementState.State;

// Event emitter for real-time updates
const progressEmitter = new EventEmitter();
const activeConnections = new Map<string, any>();

// Utility function to emit state updates
function emitStateUpdate(step: string, message: string, runId: string, details?: any) {
  const update = {
    step,
    message,
    timestamp: new Date().toISOString(),
    runId,
    ...(details && { details })
  };

  logger.info(`📡 [STATE UPDATE] ${step}: ${message}`, { runId });
  progressEmitter.emit('stateUpdate', update);

  return [update];
}

// Document chunking utility
function chunkDocument(content: string, maxChunkSize: number = 4000): string[] {
  // Split by paragraphs first
  const paragraphs = content.split(/\n\s*\n/);
  const chunks: string[] = [];
  let currentChunk = '';

  for (const paragraph of paragraphs) {
    if (currentChunk.length + paragraph.length + 2 <= maxChunkSize) {
      currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
    } else {
      if (currentChunk) {
        chunks.push(currentChunk);
        currentChunk = paragraph;
      } else {
        // Handle very long paragraphs by sentence splitting
        const sentences = paragraph.split(/(?<=\.)\s+/);
        let sentenceChunk = '';

        for (const sentence of sentences) {
          if (sentenceChunk.length + sentence.length + 1 <= maxChunkSize) {
            sentenceChunk += (sentenceChunk ? ' ' : '') + sentence;
          } else {
            if (sentenceChunk) chunks.push(sentenceChunk);
            sentenceChunk = sentence;
          }
        }
        if (sentenceChunk) currentChunk = sentenceChunk;
      }
    }
  }

  if (currentChunk) chunks.push(currentChunk);

  return chunks.filter(chunk => chunk.trim().length > 0);
}

// Node 1: Initialize and chunk document
async function initializeDocument(state: DocumentImprovementStateType): Promise<Partial<DocumentImprovementStateType>> {
  const updates = emitStateUpdate('initialization', 'Preparing document for analysis...', state.runId);

  try {
    // Chunk the document for processing
    const chunks = chunkDocument(state.documentContent);

    logger.info(`📄 [CHUNKING] Document split into ${chunks.length} chunks`, {
      runId: state.runId,
      totalLength: state.documentContent.length,
      avgChunkSize: Math.round(state.documentContent.length / chunks.length)
    });

    // Emit detailed initialization update
    const initCompleteUpdates = emitStateUpdate(
      'initialization_complete',
      `Document prepared for analysis - ${chunks.length} sections ready for processing`,
      state.runId,
      {
        chunkingInfo: {
          totalChunks: chunks.length,
          totalDocumentLength: state.documentContent.length,
          averageChunkSize: Math.round(state.documentContent.length / chunks.length),
          chunkSizes: chunks.map(chunk => chunk.length)
        },
        processingPlan: {
          estimatedDuration: `${Math.ceil(chunks.length * 10)} seconds`,
          analysisDepth: 'Technical concepts, methodologies, and architecture insights'
        }
      }
    );

    return {
      chunks,
      currentChunkIndex: 0,
      chunkAnalyses: [],
      stateUpdates: [...updates, ...initCompleteUpdates]
    };
  } catch (error) {
    return {
      errors: [`Initialization failed: ${error instanceof Error ? error.message : 'Unknown'}`],
      stateUpdates: updates
    };
  }
}

// Node 2: Analyze individual chunk
async function analyzeChunk(state: DocumentImprovementStateType): Promise<Partial<DocumentImprovementStateType>> {
  const chunkNumber = state.currentChunkIndex + 1;
  const totalChunks = state.chunks.length;
  const updates = emitStateUpdate('chunk_analysis', `Analyzing section ${chunkNumber}/${totalChunks}...`, state.runId);

  try {
    const currentChunk = state.chunks[state.currentChunkIndex];

    // Build context from previous analyses to maintain continuity
    const previousContext = state.chunkAnalyses.length > 0 ?
      `PREVIOUS SECTIONS CONTEXT:
${state.chunkAnalyses.map((analysis, idx) =>
  `Section ${idx + 1}: ${analysis.summary}`
).join('\n')}

KEY CONCEPTS FROM PREVIOUS SECTIONS:
${Array.from(new Set(state.chunkAnalyses.flatMap(a => a.keyConcepts || []))).join(', ')}

` : '';

    const prompt = `
You are analyzing a section of a document for architecture improvement insights.

${previousContext}CURRENT DOCUMENT SECTION (${chunkNumber}/${totalChunks}):
"${currentChunk}"

CURRENT ARCHITECTURE REFERENCE:
"${state.currentArchitecture}"

Analyze this section and extract:
1. Key concepts or patterns mentioned
2. Technical insights relevant to architecture
3. Potential improvements this suggests
4. Important methodologies or approaches described

Return your analysis as JSON:
{
  "keyConcepts": ["concept1", "concept2", ...],
  "technicalInsights": ["insight1", "insight2", ...],
  "suggestedImprovements": ["improvement1", "improvement2", ...],
  "methodologies": ["method1", "method2", ...],
  "relevanceScore": 0.0-1.0,
  "summary": "Brief summary of this section's contribution"
}
`;

    const result = await model.invoke(prompt);
    const analysisText = result.content.toString();

    let chunkAnalysis;
    try {
      chunkAnalysis = JSON.parse(analysisText);
    } catch {
      // Fallback if AI doesn't return valid JSON
      chunkAnalysis = {
        keyConcepts: [],
        technicalInsights: [`Analysis of section ${chunkNumber}`],
        suggestedImprovements: [],
        methodologies: [],
        relevanceScore: 0.5,
        summary: `Section ${chunkNumber} processed`
      };
    }

    chunkAnalysis.chunkIndex = state.currentChunkIndex;
    chunkAnalysis.chunkNumber = chunkNumber;

    const newAnalyses = [...state.chunkAnalyses, chunkAnalysis];
    const nextIndex = state.currentChunkIndex + 1;

    logger.info(`✅ [CHUNK ANALYSIS] Section ${chunkNumber} completed`, {
      runId: state.runId,
      relevanceScore: chunkAnalysis.relevanceScore,
      conceptsFound: chunkAnalysis.keyConcepts.length
    });

    // Emit detailed analysis update with rich information
    const detailedUpdates = emitStateUpdate(
      'chunk_analysis_complete',
      `Section ${chunkNumber}/${totalChunks} analyzed - Found ${chunkAnalysis.keyConcepts.length} concepts`,
      state.runId,
      {
        chunkNumber,
        totalChunks,
        analysis: {
          relevanceScore: chunkAnalysis.relevanceScore,
          keyConcepts: chunkAnalysis.keyConcepts,
          technicalInsights: chunkAnalysis.technicalInsights,
          suggestedImprovements: chunkAnalysis.suggestedImprovements,
          methodologies: chunkAnalysis.methodologies,
          summary: chunkAnalysis.summary
        },
        progress: {
          completed: chunkNumber,
          total: totalChunks,
          percentage: Math.round((chunkNumber / totalChunks) * 100)
        }
      }
    );

    return {
      chunkAnalyses: newAnalyses,
      currentChunkIndex: nextIndex,
      stateUpdates: [...updates, ...detailedUpdates]
    };
  } catch (error) {
    return {
      errors: [`Chunk analysis failed: ${error instanceof Error ? error.message : 'Unknown'}`],
      stateUpdates: updates
    };
  }
}

// Node 3: Synthesize all analyses into final suggestions
async function synthesizeFindings(state: DocumentImprovementStateType): Promise<Partial<DocumentImprovementStateType>> {
  const updates = emitStateUpdate('synthesis', 'Synthesizing findings into recommendations...', state.runId);

  try {
    // Combine all chunk analyses
    const allConcepts = state.chunkAnalyses.flatMap(a => a.keyConcepts || []);
    const allInsights = state.chunkAnalyses.flatMap(a => a.technicalInsights || []);
    const allImprovements = state.chunkAnalyses.flatMap(a => a.suggestedImprovements || []);
    const allMethodologies = state.chunkAnalyses.flatMap(a => a.methodologies || []);

    const synthesisPrompt = `
Based on analysis of a large document, synthesize final improvement recommendations.

ANALYZED CONCEPTS (from all sections):
${JSON.stringify(allConcepts, null, 2)}

TECHNICAL INSIGHTS (from all sections):
${JSON.stringify(allInsights, null, 2)}

SUGGESTED IMPROVEMENTS (from all sections):
${JSON.stringify(allImprovements, null, 2)}

METHODOLOGIES IDENTIFIED:
${JSON.stringify(allMethodologies, null, 2)}

CURRENT ARCHITECTURE REFERENCE:
"${state.currentArchitecture}"

Create final recommendations in the EXACT format expected by the existing system:
{
  "improvements": ["improvement 1", "improvement 2", ...],
  "newConcepts": ["concept 1", "concept 2", ...],
  "diagramChanges": ["change 1", "change 2", ...],
  "keyInsights": ["insight 1", "insight 2", ...],
  "summary": "Brief summary of how this document enhances the architecture"
}

Ensure recommendations are:
- Specific and actionable
- Relevant to the current architecture
- Based on the document content analyzed
- Consolidated (remove duplicates and combine similar items)
`;

    const result = await model.invoke(synthesisPrompt);
    const synthesisText = result.content.toString();

    let suggestions;
    try {
      suggestions = JSON.parse(synthesisText);
    } catch {
      // Fallback if AI doesn't return valid JSON
      suggestions = {
        improvements: allImprovements.slice(0, 5),
        newConcepts: allConcepts.slice(0, 5),
        diagramChanges: ["Review document insights for diagram updates"],
        keyInsights: allInsights.slice(0, 5),
        summary: `Document analysis completed with ${state.chunkAnalyses.length} sections processed`
      };
    }

    logger.info(`🎯 [SYNTHESIS] Final recommendations generated`, {
      runId: state.runId,
      improvementsCount: suggestions.improvements?.length || 0,
      conceptsCount: suggestions.newConcepts?.length || 0,
      insightsCount: suggestions.keyInsights?.length || 0
    });

    // Emit detailed synthesis completion with final results
    const synthesisCompleteUpdates = emitStateUpdate(
      'synthesis_complete',
      `Document analysis complete - Generated ${suggestions.improvements?.length || 0} improvements and ${suggestions.newConcepts?.length || 0} new concepts`,
      state.runId,
      {
        finalResults: {
          improvements: suggestions.improvements,
          newConcepts: suggestions.newConcepts,
          diagramChanges: suggestions.diagramChanges,
          keyInsights: suggestions.keyInsights,
          summary: suggestions.summary
        },
        analysisStats: {
          totalChunks: state.chunkAnalyses.length,
          avgRelevanceScore: state.chunkAnalyses.reduce((sum, a) => sum + (a.relevanceScore || 0), 0) / state.chunkAnalyses.length,
          totalConcepts: Array.from(new Set(state.chunkAnalyses.flatMap(a => a.keyConcepts || []))).length,
          totalInsights: state.chunkAnalyses.reduce((sum, a) => sum + (a.technicalInsights?.length || 0), 0)
        }
      }
    );

    return {
      suggestions,
      completed: true,
      stateUpdates: [...updates, ...synthesisCompleteUpdates]
    };
  } catch (error) {
    return {
      errors: [`Synthesis failed: ${error instanceof Error ? error.message : 'Unknown'}`],
      stateUpdates: updates
    };
  }
}

// Conditional function to determine next step
function shouldContinueChunking(state: DocumentImprovementStateType): string {
  if (state.errors && state.errors.length > 0) {
    return END;
  }

  if (state.currentChunkIndex >= state.chunks.length) {
    return "synthesis";
  }

  return "chunk_analysis";
}

// Create the LangGraph workflow
const documentImprovementGraph = new StateGraph(DocumentImprovementState)
  .addNode("initialization", initializeDocument)
  .addNode("chunk_analysis", analyzeChunk)
  .addNode("synthesis", synthesizeFindings)
  .addEdge(START, "initialization")
  .addEdge("initialization", "chunk_analysis")
  .addConditionalEdges("chunk_analysis", shouldContinueChunking, {
    "chunk_analysis": "chunk_analysis",
    "synthesis": "synthesis",
    [END]: END
  })
  .addEdge("synthesis", END);

const compiledGraph = documentImprovementGraph.compile();

// Express server setup
const app = express();
const PORT = process.env.PORT || 8082;

// Middleware
app.use(helmet());
app.use(cors({
  origin: '*',
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'improve-documents-agent',
    timestamp: new Date().toISOString()
  });
});

// Main improve documents endpoint
app.post('/improve-documents', async (req, res) => {
  try {
    const { resourceId, documentContent, currentArchitecture } = req.body;

    if (!resourceId || !documentContent) {
      return res.status(400).json({
        error: 'resourceId and documentContent are required'
      });
    }

    const runId = uuidv4();

    logger.info('🚀 [IMPROVE DOCS] Starting document improvement workflow', {
      resourceId,
      runId,
      documentLength: documentContent.length
    });

    // Store connection for real-time updates
    activeConnections.set(runId, { res, startTime: Date.now() });

    // Run the LangGraph workflow
    const initialState: DocumentImprovementStateType = {
      resourceId,
      documentContent,
      currentArchitecture: currentArchitecture || "",
      chunks: [],
      currentChunkIndex: 0,
      chunkAnalyses: [],
      runId,
      stateUpdates: [],
      errors: [],
      suggestions: null,
      completed: false
    };

    const finalState = await compiledGraph.invoke(initialState);

    if (finalState.errors && finalState.errors.length > 0) {
      logger.error('❌ [IMPROVE DOCS] Workflow failed', {
        errors: finalState.errors,
        runId
      });

      return res.status(500).json({
        success: false,
        error: 'Document improvement failed',
        details: finalState.errors
      });
    }

    logger.info('✅ [IMPROVE DOCS] Workflow completed successfully', {
      runId,
      chunksProcessed: finalState.chunkAnalyses?.length || 0,
      duration: Date.now() - (activeConnections.get(runId)?.startTime || 0)
    });

    // Clean up connection
    activeConnections.delete(runId);

    res.json({
      success: true,
      resourceId,
      runId,
      suggestions: finalState.suggestions,
      metadata: {
        chunksProcessed: finalState.chunkAnalyses?.length || 0,
        documentLength: documentContent.length,
        processingTime: Date.now() - (activeConnections.get(runId)?.startTime || 0)
      }
    });

  } catch (error) {
    logger.error('❌ [IMPROVE DOCS] Unexpected error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Server-Sent Events endpoint for real-time updates
app.get('/stream/:runId', (req, res) => {
  const { runId } = req.params;

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control'
  });

  // Send initial connection confirmation
  res.write(`data: ${JSON.stringify({
    type: 'connected',
    runId,
    timestamp: new Date().toISOString()
  })}\n\n`);

  // Listen for state updates
  const updateHandler = (update: any) => {
    if (update.runId === runId) {
      res.write(`data: ${JSON.stringify({
        type: 'update',
        ...update
      })}\n\n`);
    }
  };

  progressEmitter.on('stateUpdate', updateHandler);

  // Handle client disconnect
  req.on('close', () => {
    progressEmitter.removeListener('stateUpdate', updateHandler);
  });
});

// Start server
app.listen(PORT, () => {
  logger.info('🚀 Improve Documents Agent started', {
    port: PORT,
    environment: process.env.NODE_ENV || 'development'
  });

  console.log(`
╔════════════════════════════════════════════════════════╗
║  🚀 Improve Documents Agent Ready!                     ║
╠════════════════════════════════════════════════════════╣
║  Port:       ${PORT}                                    ║
║  Health:     http://localhost:${PORT}/health          ║
║  Endpoint:   POST /improve-documents                   ║
║  Streaming:  GET /stream/:runId                        ║
╚════════════════════════════════════════════════════════╝
  `);
});

export { app, compiledGraph };