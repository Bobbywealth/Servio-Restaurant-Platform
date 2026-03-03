export interface VapiPromptSource {
  getPhoneSystemPrompt(): string;
  getPhonePromptMetadata(): { source: string; version: string; hash: string };
}

export function buildVapiAssistantConfig(
  promptSource: VapiPromptSource,
  options: { restaurantId?: string; assistantId?: string } = {}
) {
  const promptMetadata = promptSource.getPhonePromptMetadata();

  return {
    metadata: {
      ...(options.restaurantId ? { restaurantId: options.restaurantId } : {}),
      ...(options.assistantId ? { assistantId: options.assistantId } : {}),
      promptVersion: promptMetadata.version,
      promptHash: promptMetadata.hash,
      promptSource: promptMetadata.source
    },
    model: {
      provider: 'openai',
      model: 'gpt-4-turbo-preview',
      temperature: 0.3,
      maxTokens: 150,
      systemMessage: promptSource.getPhoneSystemPrompt()
    },
    voice: {
      provider: 'openai',
      voiceId: 'nova',
      speed: 1.1
    },
    transcriber: {
      provider: 'deepgram',
      model: 'nova-2',
      language: 'en-US',
      smartFormat: true,
      utteranceEndMs: 800,
      keyterm: ['jerk chicken', 'oxtail', 'ackee', 'saltfish', 'curry goat', 'rice and peas', 'plantain', 'festival', 'callaloo', 'sorrel', 'ginger beer', 'pickup', 'delivery']
    },
    firstMessage: "Hi! Welcome to Sashey's Kitchen. I'm Servio. What can I get for you today?",
    endCallMessage: "Thanks for calling! Your order's in. Have a great day!",
    endCallPhrases: ['goodbye', 'bye', "that's all", 'hang up', 'end call', "that's it"],
    recordingEnabled: true,
    maxDurationSeconds: 600,
    silenceTimeoutSeconds: 10,
    responseDelaySeconds: 0,
    llmRequestDelaySeconds: 0,
    numWordsToInterruptAssistant: 1,
    maxTokens: 150,
    emotionRecognitionEnabled: false,
    backchannelingEnabled: true,
    backgroundDenoisingEnabled: true,
    modelOutputInMessagesEnabled: false,
    transportConfigurations: [{
      provider: 'twilio',
      timeout: 60,
      record: false
    }],
    functions: [
      { name: 'getStoreStatus', description: 'Check if the restaurant is currently open and get operating hours', parameters: { type: 'object', properties: { restaurantId: { type: 'string', description: 'Restaurant ID (optional if provided via metadata)' }, restaurantSlug: { type: 'string', description: 'Restaurant slug (optional fallback)' } } } },
      { name: 'searchMenu', description: 'Step 1 of order flow: search for items on the menu by name or category before selecting a specific item', parameters: { type: 'object', properties: { q: { type: 'string', description: 'Search query' }, restaurantId: { type: 'string', description: 'Restaurant ID (optional). Always pass this when available from assistant metadata or call context.' }, restaurantSlug: { type: 'string', description: 'Restaurant slug (optional fallback)' } }, required: ['q'] } },
      { name: 'getMenuItem', description: 'Step 2 of order flow: get full details for a specific menu item by ID returned from searchMenu', parameters: { type: 'object', properties: { id: { type: 'string', description: 'Preferred: item ID returned by searchMenu' }, name: { type: 'string', description: 'Fallback: item name when no ID is available' }, itemName: { type: 'string', description: 'Alias for name' }, restaurantId: { type: 'string', description: 'Restaurant ID (optional if provided via metadata)' }, restaurantSlug: { type: 'string', description: 'Restaurant slug (optional fallback)' } }, anyOf: [{ required: ['id'] }, { required: ['name'] }, { required: ['itemName'] }] } },
      { name: 'getItemModifiers', description: 'Step 3 of order flow: get ONLY unresolved required modifier questions for a selected menu item. Ask required unresolved questions only; do not ask optional groups unless customer requests changes.', parameters: { type: 'object', properties: { itemId: { type: 'string', description: 'The menu item ID from searchMenu results' }, restaurantId: { type: 'string', description: 'Restaurant ID (optional). Always pass this when available from assistant metadata or call context.' } }, required: ['itemId'] } },
      { name: 'quoteOrder', description: 'Step 4 of order flow: validate order and compute subtotal/tax/total. You must confirm this quote with customer before createOrder.', parameters: { type: 'object', properties: { items: { type: 'array', items: { type: 'object', properties: { itemId: { type: 'string' }, qty: { type: 'number' }, modifiers: { type: 'object' } }, required: ['itemId', 'qty'] } }, orderType: { type: 'string', enum: ['pickup', 'delivery', 'dine-in'] }, restaurantId: { type: 'string', description: 'Restaurant ID (optional). Always pass this when available from assistant metadata or call context.' }, restaurantSlug: { type: 'string', description: 'Restaurant slug (optional fallback)' } }, required: ['items', 'orderType'] } },
      { name: 'lookupCustomer', description: 'Look up a customer by phone number to retrieve their name and details. Use this at the start of the call to personalize the experience for returning customers.', parameters: { type: 'object', properties: { phone: { type: 'string', description: 'Customer phone number to look up' }, restaurantId: { type: 'string', description: 'Restaurant ID (optional). Always pass this when available from assistant metadata or call context.' }, restaurantSlug: { type: 'string', description: 'Restaurant slug (optional fallback)' } }, required: ['phone'] } },
      { name: 'createOrder', description: 'Step 5 of order flow: place the final order only after quoteOrder succeeds and customer explicitly confirms the quote. For returning customers (recognized by phone), customer fields are optional.', parameters: { type: 'object', properties: { items: { type: 'array', items: { type: 'object', properties: { itemId: { type: 'string', description: 'Menu item ID' }, qty: { type: 'number', description: 'Quantity' }, modifiers: { type: 'object', description: 'Modifier selections keyed by modifier group id' } }, required: ['itemId', 'qty'] } }, customerId: { type: 'string', description: 'Customer ID from lookupCustomer tool (optional for recognized customers)' }, customer: { type: 'object', properties: { name: { type: 'string', description: 'Customer name (required for all createOrder calls)' }, phone: { type: 'string', description: 'Phone number (required unless customerId is provided)' }, email: { type: 'string', description: 'Email address (optional)' }, lastInitial: { type: 'string', description: 'Last initial (optional, auto-derived from name)' } } }, totals: { type: 'object', properties: { subtotal: { type: 'number' }, tax: { type: 'number' }, fees: { type: 'number' }, total: { type: 'number' } } }, orderType: { type: 'string', enum: ['pickup', 'delivery', 'dine-in'] }, pickupTime: { type: 'string', description: 'Preferred pickup time for pickup orders (ISO format)' }, callId: { type: 'string', description: 'Call ID from Vapi' }, restaurantId: { type: 'string', description: 'Restaurant ID (optional). Always pass this when available from assistant metadata or call context.' }, restaurantSlug: { type: 'string', description: 'Restaurant slug (optional fallback)' } }, required: ['items', 'orderType'] } }
    ]
  };
}
