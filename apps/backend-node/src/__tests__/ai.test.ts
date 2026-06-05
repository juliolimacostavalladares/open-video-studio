import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  vi,
  beforeEach,
} from 'vitest';
import { buildApp } from '../app.js';
import { FastifyInstance } from 'fastify';
import { env } from '../env.js';

// Setup mock for GoogleGenAI
const generateContentMock = vi.fn();
vi.mock('@google/genai', () => {
  return {
    GoogleGenAI: vi.fn().mockImplementation(function () {
      return {
        models: {
          generateContent: generateContentMock,
        },
      };
    }),
  };
});

describe('AI Script Generation HTTP API Tests', () => {
  let app: FastifyInstance;
  let originalApiKey: string;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
    originalApiKey = env.GEMINI_API_KEY;
  });

  afterAll(async () => {
    await app.close();
    env.GEMINI_API_KEY = originalApiKey;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    env.GEMINI_API_KEY = 'mocked-gemini-key';
  });

  it('should return 503 Service Unavailable if GEMINI_API_KEY is missing', async () => {
    env.GEMINI_API_KEY = '';

    const response = await app.inject({
      method: 'POST',
      url: '/api/script/generate',
      payload: {
        topic: 'AI and coding',
        sceneCount: 3,
      },
    });

    expect(response.statusCode).toBe(503);
    const body = JSON.parse(response.body);
    expect(body.error).toBe('Service Unavailable');
    expect(body.message).toContain('missing API key');
  });

  it('should return 400 Bad Request if parameters are invalid (topic too short)', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/script/generate',
      payload: {
        topic: 'ab', // min length is 3
        sceneCount: 3,
      },
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error).toBe('Bad Request');
    expect(body.details).toBeDefined();
  });

  it('should return 400 Bad Request if sceneCount is out of bounds', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/script/generate',
      payload: {
        topic: 'Valid topic',
        sceneCount: 50, // max is 20
      },
    });

    expect(response.statusCode).toBe(400);
  });

  it('should return 200 OK and valid script if Gemini returns a compliant response', async () => {
    const mockOutput = {
      title: 'Journey into AI Coding',
      scenes: [
        {
          sceneIndex: 0,
          text: 'AI coding assistants are evolving rapidly, changing the software development landscape.',
          keyword: 'developer programming laptop',
        },
        {
          sceneIndex: 1,
          text: 'With models like Gemini, structured output generation becomes robust and predictable.',
          keyword: 'machine learning network code',
        },
      ],
    };

    generateContentMock.mockResolvedValueOnce({
      text: JSON.stringify(mockOutput),
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/script/generate',
      payload: {
        topic: 'AI Coding Evolution',
        sceneCount: 2,
        tone: 'educational',
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.title).toBe(mockOutput.title);
    const scenes = body.scenes;
    const mockScenes = mockOutput.scenes;
    expect(scenes).toBeDefined();
    expect(mockScenes).toBeDefined();

    const s0 = scenes[0];
    const s1 = scenes[1];
    const m0 = mockScenes[0];
    const m1 = mockScenes[1];

    expect(s0).toBeDefined();
    expect(s1).toBeDefined();
    expect(m0).toBeDefined();
    expect(m1).toBeDefined();

    if (s0 && m0) expect(s0.text).toBe(m0.text);
    if (s1 && m1) expect(s1.keyword).toBe(m1.keyword);
  });

  it('should return 500 Internal Server Error if Gemini returns invalid JSON', async () => {
    generateContentMock.mockResolvedValueOnce({
      text: 'not a json string',
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/script/generate',
      payload: {
        topic: 'AI and coding',
        sceneCount: 2,
      },
    });

    expect(response.statusCode).toBe(500);
    const body = JSON.parse(response.body);
    expect(body.error).toBe('Internal Server Error');
    expect(body.message).toContain('Failed to parse AI response');
  });

  it('should return 500 Internal Server Error if Gemini returns non-compliant schema structure', async () => {
    generateContentMock.mockResolvedValueOnce({
      text: JSON.stringify({
        brokenField: 'missing scenes and title',
      }),
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/script/generate',
      payload: {
        topic: 'AI and coding',
        sceneCount: 2,
      },
    });

    expect(response.statusCode).toBe(500);
    const body = JSON.parse(response.body);
    expect(body.message).toContain('required script schema');
  });
});
