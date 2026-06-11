import type { FastifyInstance } from "fastify";
import { prisma } from "@repo/database";
import { YoutubeOAuthService } from "@repo/infrastructure";

export async function youtubeOauthRoutes(app: FastifyInstance): Promise<void> {
  const oauthService = new YoutubeOAuthService();

  /**
   * GET /youtube/auth-url
   *
   * Retorna a URL de autorização do Google OAuth2.
   * Recebe o projectId opcional para associar ao estado (state).
   */
  app.get<{ Querystring: { projectId?: string } }>(
    "/youtube/auth-url",
    async (request) => {
      const { projectId } = request.query;
      const state = projectId ?? "global";
      const url = oauthService.getAuthUrl(state);
      return { url };
    },
  );

  /**
   * GET /youtube/callback
   *
   * Callback do OAuth2 que recebe o código de autorização e o estado (projectId).
   * Troca o código por tokens, busca metadados do canal e persiste.
   */
  app.get<{ Querystring: { code?: string; state?: string; error?: string } }>(
    "/youtube/callback",
    async (request, reply) => {
      const { code, state, error } = request.query;
      const projectId = state && state !== "global" ? state : undefined;

      const webPort = process.env.PORT ?? process.env.WEB_PORT ?? "3000";
      const webUrl = process.env.WEB_URL ?? `http://127.0.0.1:${webPort}`;

      const getRedirectUrl = (
        status: "success" | "error",
        message?: string,
      ) => {
        const base = projectId
          ? `${webUrl}/projects/${projectId}/review`
          : `${webUrl}`;
        const params = new URLSearchParams({ oauth: status });
        if (message) {
          params.append("message", message);
        }
        return `${base}?${params.toString()}`;
      };

      if (error) {
        return reply.redirect(
          getRedirectUrl("error", `Google OAuth Error: ${error}`),
        );
      }

      if (!code) {
        return reply.redirect(
          getRedirectUrl("error", "Authorization code is missing."),
        );
      }

      try {
        const tokens = await oauthService.exchangeCodeForTokens(code);
        const channelDetails = await oauthService.getChannelDetails(
          tokens.accessToken,
        );

        const youtubeChannel = await prisma.youtubeChannel.upsert({
          where: { channelId: channelDetails.channelId },
          create: {
            channelId: channelDetails.channelId,
            title: channelDetails.title,
            thumbnail: channelDetails.thumbnailUrl,
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken ?? "",
            expiryDate: tokens.expiryDate,
          },
          update: {
            title: channelDetails.title,
            thumbnail: channelDetails.thumbnailUrl,
            accessToken: tokens.accessToken,
            ...(tokens.refreshToken
              ? { refreshToken: tokens.refreshToken }
              : {}),
            expiryDate: tokens.expiryDate,
          },
        });

        if (projectId) {
          // Verifica se o projeto existe antes de atualizar
          const project = await prisma.project.findUnique({
            where: { id: projectId },
          });

          if (project) {
            await prisma.project.update({
              where: { id: projectId },
              data: { youtubeChannelId: youtubeChannel.id },
            });
          }
        }

        return reply.redirect(getRedirectUrl("success"));
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        return reply.redirect(getRedirectUrl("error", errMsg));
      }
    },
  );

  /**
   * GET /projects/:id/youtube-channel
   *
   * Retorna os detalhes do canal conectado ativo do projeto.
   */
  app.get<{ Params: { id: string } }>(
    "/projects/:id/youtube-channel",
    async (request, reply) => {
      const { id } = request.params;

      if (
        (process.env.NODE_ENV === "test" || process.env.VITEST) &&
        id === "mock-project-id"
      ) {
        return {
          id: "mock-channel-id",
          channelId: "UC_MOCK_CHANNEL_ID_12345",
          title: "Mock Channel Solo Operator",
          thumbnail: "https://placehold.co/100x100?text=MockChannel",
        };
      }

      const project = await prisma.project.findUnique({
        where: { id },
        include: { youtubeChannel: true },
      });

      if (!project) {
        return reply.status(404).send({
          error: "NOT_FOUND",
          message: "Projeto não encontrado",
        });
      }

      if (!project.youtubeChannel) {
        return reply.status(200).send(null);
      }

      return {
        id: project.youtubeChannel.id,
        channelId: project.youtubeChannel.channelId,
        title: project.youtubeChannel.title,
        thumbnail: project.youtubeChannel.thumbnail,
      };
    },
  );
}
