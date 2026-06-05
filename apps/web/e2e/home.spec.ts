import { test, expect } from '@playwright/test';

test.describe('Open Video Studio Home Page E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the home page before each test
    await page.goto('/');
  });

  test('should render initial UI components and empty state', async ({
    page,
  }) => {
    // Check main headers and form title
    await expect(page.locator('header')).toContainText('Open Video Studio');
    await expect(page.locator('header')).toContainText('Ciclo 2: AI & TTS');
    await expect(page.locator('form h2')).toContainText('Criador de Roteiro');

    // Check presence of form inputs
    const topicTextarea = page.locator('textarea#topic');
    await expect(topicTextarea).toBeVisible();
    await expect(topicTextarea).toHaveAttribute(
      'placeholder',
      /A evolução histórica/,
    );

    const languageSelect = page.locator('select#language');
    await expect(languageSelect).toBeVisible();
    await expect(languageSelect).toHaveValue('Portuguese');

    const sceneCountSlider = page.locator('input#sceneCount');
    await expect(sceneCountSlider).toBeVisible();
    await expect(sceneCountSlider).toHaveValue('5');

    // Check initial timeline empty state
    await expect(page.locator('h3')).toContainText('Roteiro vazio');
    const emptyStateText = page.locator('div.flex-1 p');
    await expect(emptyStateText).toContainText(
      'Preencha as configurações ao lado e clique em Gerar Roteiro',
    );
  });

  test('should show client-side validation errors for invalid input', async ({
    page,
  }) => {
    const topicTextarea = page.locator('textarea#topic');
    const submitButton = page.locator('button[type="submit"]');

    // 1. Submit empty topic
    await submitButton.click();
    const errorAlert = page.locator('span[role="alert"]');
    await expect(errorAlert).toBeVisible();
    await expect(errorAlert).toContainText('O tema do roteiro é obrigatório.');

    // 2. Submit topic too short
    await topicTextarea.fill('AI');
    await submitButton.click();
    await expect(errorAlert).toBeVisible();
    await expect(errorAlert).toContainText(
      'O tema deve ter pelo menos 3 caracteres.',
    );
  });

  test('should successfully generate and display a script when API returns data', async ({
    page,
  }) => {
    const topicTextarea = page.locator('textarea#topic');
    const submitButton = page.locator('button[type="submit"]');

    // Mock script generation API endpoint
    const mockOutput = {
      title: 'A Inteligência Artificial no Futuro',
      scenes: [
        {
          sceneIndex: 0,
          text: 'Esta é a primeira cena do documentário sobre IA.',
          keyword: 'tecnologia futurista',
        },
        {
          sceneIndex: 1,
          text: 'Aqui vemos robôs auxiliando no trabalho diário.',
          keyword: 'robotica',
        },
      ],
    };

    // Route mock with a delay to reliably assert loading states
    await page.route('**/api/script/generate', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 500));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockOutput),
      });
    });

    // Fill form fields
    await topicTextarea.fill('História da IA no mercado de trabalho');

    // Select a tone
    const dramaticToneButton = page.locator('button:has-text("Dramático")');
    await dramaticToneButton.click();

    // Click submit
    await submitButton.click();

    // Check loading indicator shows up (asserting while loading)
    await expect(submitButton).toContainText('Escrevendo Roteiro...');

    // Verify timeline successfully loads with script
    await expect(page.locator('div.flex-1 h1')).toContainText(
      'A Inteligência Artificial no Futuro',
    );

    // Check scenes are rendered properly
    const scene1 = page.locator('text=Cena 1');
    const scene2 = page.locator('text=Cena 2');
    await expect(scene1).toBeVisible();
    await expect(scene2).toBeVisible();

    await expect(page.locator('text=Esta é a primeira cena')).toBeVisible();
    await expect(page.locator('text=Aqui vemos robôs')).toBeVisible();
    await expect(page.locator('text=tecnologia futurista')).toBeVisible();
    await expect(page.locator('text=robotica')).toBeVisible();
  });

  test('should display server error state when API call fails', async ({
    page,
  }) => {
    const topicTextarea = page.locator('textarea#topic');
    const submitButton = page.locator('button[type="submit"]');

    // Mock 500 error from script generation API
    await page.route('**/api/script/generate', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          message: 'Erro interno do servidor da API de IA.',
        }),
      });
    });

    // Fill form and submit
    await topicTextarea.fill('História da IA no mercado de trabalho');
    await submitButton.click();

    // Verify error state in the timeline
    await expect(page.locator('h3')).toContainText('Falha ao gerar roteiro');
    const errorText = page.locator('div.flex-1 p');
    await expect(errorText).toContainText(
      'Erro interno do servidor da API de IA.',
    );
  });
});
