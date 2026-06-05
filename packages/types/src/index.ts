import { z } from 'zod';

// Brand Kit Schema (stored as JSON in Database)
export const BrandKitSchema = z.object({
  primaryColor: z
    .string()
    .regex(/^#[0-9A-F]{6}$/i, 'Must be a valid hex color code'),
  secondaryColor: z
    .string()
    .regex(/^#[0-9A-F]{6}$/i, 'Must be a valid hex color code'),
  accentColor: z
    .string()
    .regex(/^#[0-9A-F]{6}$/i, 'Must be a valid hex color code'),
  fontFamily: z.string().min(1, 'Font family is required'),
  watermarkUrl: z.string().url().nullable().optional(),
  watermarkOpacity: z.number().min(0).max(1).default(0.5),
  subtitleStyle: z
    .object({
      fontSize: z.number().min(8).max(120).default(24),
      fontColor: z
        .string()
        .regex(/^#[0-9A-F]{6}$/i)
        .default('#FFFFFF'),
      borderColor: z
        .string()
        .regex(/^#[0-9A-F]{6}$/i)
        .default('#000000'),
      borderWidth: z.number().min(0).max(10).default(2),
      shadowColor: z
        .string()
        .regex(/^#[0-9A-F]{6}$/i)
        .default('#000000'),
      shadowOffset: z.number().min(0).max(20).default(4),
    })
    .default({
      fontSize: 24,
      fontColor: '#FFFFFF',
      borderColor: '#000000',
      borderWidth: 2,
      shadowColor: '#000000',
      shadowOffset: 4,
    }),
});

export type BrandKit = z.infer<typeof BrandKitSchema>;

// Channel Schema
export const ChannelSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1, 'Channel name cannot be empty'),
  youtubeId: z.string().min(1, 'YouTube Channel ID is required'),
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
  tokenExpiry: z.string().or(z.date()),
  brandKit: BrandKitSchema,
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()),
});

export type Channel = z.infer<typeof ChannelSchema>;

export const CreateChannelInputSchema = ChannelSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type CreateChannelInput = z.infer<typeof CreateChannelInputSchema>;

// Voice Profile Schema
export const VoiceProfileSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1, 'Voice profile name is required'),
  sampleUrl: z.string().url('Sample URL must be a valid URL'),
  voicePath: z.string().min(1, 'Voice path location is required'),
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()),
});

export type VoiceProfile = z.infer<typeof VoiceProfileSchema>;

export const CreateVoiceProfileInputSchema = VoiceProfileSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type CreateVoiceProfileInput = z.infer<
  typeof CreateVoiceProfileInputSchema
>;

// Project Status Enum
export const ProjectStatusSchema = z.enum([
  'draft',
  'generating_voice',
  'generating_assets',
  'rendering',
  'rendered',
  'uploading',
  'published',
  'failed',
]);

export type ProjectStatus = z.infer<typeof ProjectStatusSchema>;

// Project Schema
export const ProjectSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1, 'Project title is required'),
  status: ProjectStatusSchema.default('draft'),
  script: z.string().min(1, 'Project script is required'),
  channelId: z.string().uuid(),
  voiceProfileId: z.string().uuid(),
  duration: z.number().nonnegative().default(0), // in seconds
  youtubeVideoId: z.string().nullable().optional(),
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()),
});

export type Project = z.infer<typeof ProjectSchema>;

export const CreateProjectInputSchema = ProjectSchema.omit({
  id: true,
  status: true,
  duration: true,
  youtubeVideoId: true,
  createdAt: true,
  updatedAt: true,
});

export type CreateProjectInput = z.infer<typeof CreateProjectInputSchema>;

// Scene Schema
export const SceneSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  sceneIndex: z.number().nonnegative(),
  text: z.string().min(1, 'Scene text cannot be empty'),
  voiceUrl: z.string().url().nullable().optional(),
  voiceDuration: z.number().nonnegative().default(0), // in seconds
  assetUrl: z.string().url().nullable().optional(),
  assetType: z.enum(['video', 'image']).nullable().optional(),
  keyword: z.string().nullable().optional(),
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()),
});

export type Scene = z.infer<typeof SceneSchema>;

export const CreateSceneInputSchema = SceneSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type CreateSceneInput = z.infer<typeof CreateSceneInputSchema>;

// AI Script Generation input schema
export const GenerateScriptInputSchema = z.object({
  topic: z.string().min(3, 'Topic must be at least 3 characters long'),
  tone: z.string().default('educational'),
  sceneCount: z.coerce.number().int().min(1).max(20).default(5),
  language: z.string().default('Portuguese'),
});

export type GenerateScriptInput = z.infer<typeof GenerateScriptInputSchema>;

// Sub-structure for a scene in the generated script
export const ScriptSceneSchema = z.object({
  sceneIndex: z.number().int().nonnegative(),
  text: z.string().min(1, 'Scene text cannot be empty'),
  keyword: z.string().min(1, 'Scene search keyword cannot be empty'),
});

export type ScriptScene = z.infer<typeof ScriptSceneSchema>;

// AI Script Generation output schema
export const GenerateScriptOutputSchema = z.object({
  title: z.string().min(1, 'Video title is required'),
  scenes: z.array(ScriptSceneSchema).min(1, 'At least one scene is required'),
});

export type GenerateScriptOutput = z.infer<typeof GenerateScriptOutputSchema>;
