export interface IPromptParams {
  [key: string]: number | string | string[];
}

export enum SupportedLanguage {
  EN = "en",
  ES = "es",
}

export type AsyncTemplateLoader = () => Promise<string>;

type TemplateLoaders = Partial<Record<SupportedLanguage, AsyncTemplateLoader>>;

export abstract class AsyncMultiLanguagePrompt<T extends IPromptParams> {
  private templateCache: Partial<Record<SupportedLanguage, string>> = {};

  protected constructor(
    protected params: T,
    private templateLoaders: TemplateLoaders
  ) {}

  async getPrompt(language: SupportedLanguage): Promise<string> {
    const loader = this.templateLoaders[language];
    if (!loader) {
      throw new Error(`Language '${language}' is not supported.`);
    }

    if (!this.templateCache[language]) {
      this.templateCache[language] = await loader();
    }

    const template = this.templateCache[language]!;
    let prompt = template;
    for (const [key, value] of Object.entries(this.params)) {
      const placeholder = `{{${key}}}`;
      if (Array.isArray(value)) {
        prompt = prompt.replace(placeholder, value.join(", "));
      } else {
        prompt = prompt.replace(placeholder, value.toString());
      }
    }
    return prompt;
  }

  getSupportedLanguages(): SupportedLanguage[] {
    return Object.keys(this.templateLoaders) as SupportedLanguage[];
  }
}
