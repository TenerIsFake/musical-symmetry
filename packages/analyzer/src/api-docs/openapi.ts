export function getOpenApiSpec() {
  return {
    openapi: '3.0.3',
    info: {
      title: 'Musical Symmetry API',
      version: '1.0.0',
      description: 'Analyze pitch-class sets using group theory. Classify chords, compute voice-leading distances, and generate symmetry visualizations.',
    },
    servers: [{ url: 'https://symmetry.tendrid.us/api' }],
    paths: {
      '/classify': {
        post: {
          summary: 'Classify a pitch-class set',
          description: 'Returns the symmetry group, interval vector, Mulliken label, and more for any set of pitch classes.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['pitchClasses'],
                  properties: {
                    pitchClasses: {
                      type: 'array',
                      items: { type: 'integer', minimum: 0, maximum: 11 },
                      minItems: 2,
                      example: [0, 4, 7],
                    },
                  },
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'Symmetry analysis result',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/ClassifyResponse' } } },
            },
            '400': { description: 'Invalid input' },
            '429': { description: 'Rate limit exceeded' },
          },
        },
      },
      '/classify/batch': {
        post: {
          summary: 'Classify up to 1000 pitch-class sets',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['sets'],
                  properties: {
                    sets: {
                      type: 'array',
                      items: { type: 'array', items: { type: 'integer', minimum: 0, maximum: 11 } },
                      maxItems: 1000,
                      example: [[0, 4, 7], [0, 3, 6, 9]],
                    },
                  },
                },
              },
            },
          },
          responses: {
            '200': { description: 'Batch results' },
            '400': { description: 'Invalid input' },
            '429': { description: 'Rate limit exceeded' },
          },
        },
      },
      '/voice-leading': {
        post: {
          summary: 'Compute voice-leading distance',
          description: 'Minimal voice-leading distance between two pitch-class sets, using the generalized algorithm that handles unequal cardinalities.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['from', 'to'],
                  properties: {
                    from: { type: 'array', items: { type: 'integer' }, example: [0, 4, 7] },
                    to: { type: 'array', items: { type: 'integer' }, example: [0, 3, 7] },
                  },
                },
              },
            },
          },
          responses: { '200': { description: 'Distance and analyses of both sets' } },
        },
      },
      '/analyze': {
        post: {
          summary: 'Analyze a music file',
          description: 'Upload MIDI, MusicXML, or WAV. Returns per-beat symmetry analysis with voice-leading distances.',
          requestBody: {
            required: true,
            content: {
              'multipart/form-data': {
                schema: {
                  type: 'object',
                  required: ['file'],
                  properties: {
                    file: { type: 'string', format: 'binary' },
                    sliceMode: { type: 'string', enum: ['beat', 'measure'], default: 'beat' },
                    minNotes: { type: 'integer', minimum: 1, maximum: 12, default: 2 },
                  },
                },
              },
            },
          },
          responses: { '200': { description: 'Timeline analysis' } },
        },
      },
      '/report': {
        post: {
          summary: 'Generate PDF analysis report',
          description: 'Same as /analyze but returns a downloadable PDF. Requires authentication (free: 1/day, pro: 20/day).',
          requestBody: {
            required: true,
            content: {
              'multipart/form-data': {
                schema: {
                  type: 'object',
                  required: ['file'],
                  properties: {
                    file: { type: 'string', format: 'binary' },
                    sliceMode: { type: 'string', enum: ['beat', 'measure'] },
                    minNotes: { type: 'integer' },
                  },
                },
              },
            },
          },
          responses: { '200': { description: 'PDF file', content: { 'application/pdf': {} } } },
        },
      },
      '/og/{style}': {
        get: {
          summary: 'Generate OG card SVG',
          parameters: [
            { name: 'style', in: 'path', required: true, schema: { type: 'string' } },
            { name: 'pcs', in: 'query', required: true, schema: { type: 'string' }, example: '0,4,7' },
          ],
          responses: { '200': { description: 'SVG image', content: { 'image/svg+xml': {} } } },
        },
      },
    },
    components: {
      schemas: {
        ClassifyResponse: {
          type: 'object',
          properties: {
            analysis: { $ref: '#/components/schemas/SymmetryAnalysis' },
            chord: { type: 'object', nullable: true },
          },
        },
        SymmetryAnalysis: {
          type: 'object',
          properties: {
            pitchClasses: { type: 'array', items: { type: 'integer' } },
            abstractGroup: { type: 'string', example: 'C1' },
            stabilizerOrder: { type: 'integer' },
            distinctTranspositions: { type: 'integer' },
            intervalVector: { type: 'array', items: { type: 'integer' }, minItems: 6, maxItems: 6 },
            mullikenLabel: { type: 'string' },
            maximallyEven: { type: 'boolean' },
            myhillProperty: { type: 'boolean' },
          },
        },
      },
      securitySchemes: {
        apiKey: { type: 'apiKey', in: 'header', name: 'x-api-key' },
      },
    },
  };
}
