import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { GenerateScriptInputSchema } from '@repo/types';
import { generateScript } from '../lib/ai.js';

/**
 * Fastify plugin defining routes for script generation.
 */
export async function scriptRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
) {
  fastify.post('/generate', async (request, reply) => {
    // Validate request body using Zod schema
    const parseResult = GenerateScriptInputSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Invalid input parameters for script generation.',
        details: parseResult.error.format(),
      });
    }

    try {
      const script = await generateScript(parseResult.data);
      return reply.send(script);
    } catch (error) {
      fastify.log.error('Script generation failed:', error);

      const errorMessage = (error as Error).message;

      if (errorMessage.includes('GEMINI_API_KEY')) {
        return reply.status(503).send({
          error: 'Service Unavailable',
          message:
            'AI script generation service is not configured on the server (missing API key).',
        });
      }

      return reply.status(500).send({
        error: 'Internal Server Error',
        message:
          errorMessage ||
          'An unexpected error occurred while generating the script.',
      });
    }
  });
}
