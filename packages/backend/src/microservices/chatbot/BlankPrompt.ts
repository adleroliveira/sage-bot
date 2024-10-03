import {
  AsyncMultiLanguagePrompt,
  AsyncTemplateLoader,
  IPromptParams,
  SupportedLanguage,
} from "../../aws-backend/bedrock/AsyncMultiLanguagePrompt";

export interface BlankPromptParams extends IPromptParams {
  prompt: string;
}

const en = async () => `{{prompt}}`;
const es = async () => ``;

export class BlankPromptPrompt extends AsyncMultiLanguagePrompt<BlankPromptParams> {
  constructor(params: BlankPromptParams) {
    const templates: Record<SupportedLanguage, AsyncTemplateLoader> = {
      [SupportedLanguage.EN]: en,
      [SupportedLanguage.ES]: es,
    };

    super(params, templates);
  }
}
