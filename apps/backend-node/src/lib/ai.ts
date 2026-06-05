import { GoogleGenAI } from '@google/genai';
import { env } from '../env.js';
import {
  GenerateScriptInput,
  GenerateScriptOutput,
  GenerateScriptOutputSchema,
} from '@repo/types';

let aiInstance: GoogleGenAI | null = null;

/**
 * Returns the configured Gemini AI client.
 * Throws an explicit error if GEMINI_API_KEY is not defined.
 */
export function getGeminiClient(): GoogleGenAI {
  if (!env.GEMINI_API_KEY) {
    throw new Error(
      '❌ GEMINI_API_KEY is not configured in the environment variables.',
    );
  }

  if (!aiInstance) {
    aiInstance = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
  }
  return aiInstance;
}

/**
 * Generates a structured video script based on input parameters using Gemini.
 */
export async function generateScript(
  input: GenerateScriptInput,
): Promise<GenerateScriptOutput> {
  const ai = getGeminiClient();
  const model = env.GEMINI_MODEL || 'gemini-2.5-flash';

  const systemInstruction = `You are a professional AI video scriptwriter. Your job is to write high-quality structured video scripts based on user parameters.
    The response MUST be a valid JSON object matching the following structure:
    {
      "title": "A short and catchy title of the video",
      "scenes": [
        {
          "sceneIndex": 0,
          "text": "The narration text for the scene (about 25-45 words in the requested language).",
          "keyword": "A highly descriptive search keyword in English (1-3 words) to find matching stock footage or images on Pexels (e.g., 'man working on laptop', 'drone shot forest')."
        }
      ]
    }
    
    CRITICAL:
    1. Respond ONLY with the JSON structure. Do not include markdown codeblocks (\`\`\`json ... \`\`\`), explanations, or conversational text.
    2. Write the narration "text" in the requested language (Default: Portuguese).
    3. The search "keyword" MUST ALWAYS be in English, regardless of the narration language, because stock video APIs (like Pexels) only support English queries.
    4. Ensure sceneIndex is 0-indexed, sequential, and matching the requested sceneCount.`;

  const userPrompt = `Topic: "${input.topic}"
Tone: "${input.tone}"
Scene Count: ${input.sceneCount}
Language: "${input.language}"`;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: userPrompt,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error('AI returned an empty response.');
    }

    // Parse the JSON output
    let parsedData: unknown;
    try {
      // Clean potential JSON markdown wrapper just in case
      let cleanText = text.trim();
      if (cleanText.startsWith('```json')) {
        cleanText = cleanText.substring(7);
      }
      if (cleanText.endsWith('```')) {
        cleanText = cleanText.substring(0, cleanText.length - 3);
      }
      cleanText = cleanText.trim();
      parsedData = JSON.parse(cleanText);
    } catch (parseError) {
      console.error('Failed to parse Gemini response text:', text);
      throw new Error(
        `Failed to parse AI response as JSON: ${(parseError as Error).message}`,
      );
    }

    // Validate using Zod schema
    const validatedData = GenerateScriptOutputSchema.safeParse(parsedData);
    if (!validatedData.success) {
      console.error(
        'Invalid script schema from Gemini:',
        JSON.stringify(validatedData.error.format(), null, 2),
      );
      throw new Error(
        'AI returned a response that does not match the required script schema.',
      );
    }

    return validatedData.data;
  } catch (error) {
    console.error('❌ Error during script generation:', error);
    throw error;
  }
}
