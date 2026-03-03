import { buildVapiAssistantConfig } from '../services/vapiAssistantConfig';

describe('buildVapiAssistantConfig', () => {
  it("includes Sashey's greeting and required tool names", () => {
    const config = buildVapiAssistantConfig({
      getPhoneSystemPrompt: () => "Hey! Thanks for calling Sashey's Kitchen! What can I get for you today?",
      getPhonePromptMetadata: () => ({
        source: 'src/prompts/vapi_system_prompt_sasheys.txt',
        version: 'test-v1',
        hash: 'abc123'
      })
    }, {
      restaurantId: 'sasheys-kitchen-union',
      assistantId: 'assistant-123'
    });

    expect(config.firstMessage).toContain("Sashey's");
    expect(config.model.systemMessage).toContain("Sashey's");

    const toolNames = config.functions.map((tool: { name: string }) => tool.name);
    expect(toolNames).toEqual(expect.arrayContaining([
      'getStoreStatus',
      'searchMenu',
      'getMenuItem',
      'getItemModifiers',
      'quoteOrder',
      'lookupCustomer',
      'createOrder'
    ]));
  });
});
