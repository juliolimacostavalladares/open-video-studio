import Fastify from 'fastify';
import cors from '@fastify/cors';
import { z } from 'zod'; // Assuming zod is used for env validation later

const fastify = Fastify({
  logger: true
});

// Define a schema for environment variables if needed for CORS
const envSchema = z.object({
  CORS_ORIGINS: z.string().default('http://localhost:3000'),
});

type Env = z.infer<typeof envSchema>;

// Load environment variables (this is a simplified example, usually done with dotenv)
const env = envSchema.parse(process.env);


fastify.register(cors, {
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    const allowedOrigins = env.CORS_ORIGINS.split(',').map(s => s.trim());

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'), false);
    }
  }
});

fastify.get('/', async (request, reply) => {
  return { hello: 'world', message: 'Backend is running!' };
});

const start = async () => {
  try {
    await fastify.listen({ port: 4000 });
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
