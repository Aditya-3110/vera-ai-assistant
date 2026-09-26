const express = require("express");
require("dotenv").config();
const {
  contexts,
  conversations,
  processedTriggers,
  persistProcessedTriggers,
} = require("./store.js");
const { generateAIReply } = require("./aiService.js");
const app = express();

const autoReplyCounts = new Map();
app.use(express.json());

app.get("/v1/healthz", (req, res) => {
  res.status(200).json({
    status: "ok",
    service: "Vera AI Merchant Assistant",
    timestamp: new Date().toISOString()
  });
});
app.get("/v1/metadata", (req, res) => {
  res.status(200).json({
    team_name: "Vera AI Assistant",
    team_members: ["Aditya Gupta"],
    model: "Gemini 2.5 Flash",
    approach: "Context-aware merchant engagement assistant",
    contact_email: "adiigupta3110@gmail.com",
    version: "1.0.0",
    submitted_at: new Date().toISOString()
  });
});
app.post("/v1/context", (req, res) => {
  const { scope, context_id, version, payload } = req.body;

  const validScopes = ["category", "merchant", "customer", "trigger"];

  if (!validScopes.includes(scope)) {
    return res.status(400).json({
      accepted: false,
      reason: "invalid_scope"
    });
  }

  if (!context_id || !Number.isInteger(version) || version < 1 || !payload || typeof payload !== "object" || Array.isArray(payload)) {
    return res.status(400).json({
      accepted: false,
      reason: "invalid_payload"
    });
  }

  const key = `${scope}:${context_id}`;
  const current = contexts.get(key);

  if (current && current.version > version) {
    return res.status(409).json({
      accepted: false,
      reason: "stale_version",
      current_version: current.version
    });
  }

  contexts.set(key, {
    version,
    payload
  });

  res.status(200).json({
    accepted: true,
    ack_id: `ack_${context_id}_v${version}`,
    stored_at: new Date().toISOString()
  });
});

app.post("/v1/tick", async (req, res) => {
  const { now, available_triggers = [] } = req.body;

  if (!Array.isArray(available_triggers)) {
    return res.status(400).json({
      error: "available_triggers must be an array"
    });
  }

  const actions = [];

  for (const triggerId of available_triggers) {
    const trigger = contexts.get(`trigger:${triggerId}`)?.payload;
    if (!trigger) continue;

    const suppressionKey = trigger.suppression_key || triggerId;
    if (processedTriggers.has(suppressionKey)) continue;

    const merchantId =
      trigger.merchant_id || trigger.payload?.merchant_id;

    if (!merchantId) continue;

    const merchant = contexts.get(`merchant:${merchantId}`)?.payload;
    if (!merchant) continue;

    const category = contexts.get(
      `category:${merchant.category_slug}`
    )?.payload || {};

    const customerId =
      trigger.customer_id || trigger.payload?.customer_id || null;

    const customer = customerId
      ? contexts.get(`customer:${customerId}`)?.payload || {}
      : {};

    const triggerKind = trigger.kind || "business_update";

    const triggerDetails =
      trigger.summary ||
      trigger.title ||
      trigger.description ||
      "";

    const prompt = `Create a short, natural, personalized opening message for a merchant.

Trigger type: ${triggerKind}
Trigger details: ${triggerDetails}

Explain the update clearly and ask a relevant follow-up question.
Keep the message concise and professional.
Do not invent facts, offers, prices, or commitments.
Return only the message text.`;

    const aiReply = await generateAIReply(
      merchant,
      prompt,
      category,
      trigger,
      customer,
      []
    );

    const conversationId =
      `conv_${merchantId}_${triggerId}_${Date.now()}`;

    actions.push({
      conversation_id: conversationId,
      merchant_id: merchantId,
      customer_id: customerId,
      send_as: "vera",
      trigger_id: triggerId,
      template_name: "vera_ai_v1",
      template_params: [
        merchant.identity?.name || "there",
        triggerKind,
        triggerDetails
      ],
      body: aiReply,
      cta: "open_ended",
      suppression_key: suppressionKey,
      rationale: "Generated a personalized AI message using merchant, category, customer, and trigger context."
    });

    conversations.set(conversationId, []);
    processedTriggers.add(suppressionKey);
    persistProcessedTriggers();
  }

  return res.status(200).json({ actions });
});

app.post("/v1/reply", async(req, res) => {
  const {
    conversation_id,
    merchant_id,
    customer_id,
    from_role,
    message,
    received_at,
    turn_number
  } = req.body;

  if (!conversation_id || !message || !from_role) {
    return res.status(400).json({
      error: "conversation_id, message, and from_role are required"
    });
  }

  const text = message.toLowerCase().trim();
  console.log("AUTO-REPLY DEBUG:", text);

  if (!conversations.has(conversation_id)) {
    conversations.set(conversation_id, []);
  }

  const history = conversations.get(conversation_id);

  history.push({
    role: from_role,
    message,
    received_at,
    turn_number
  });

  const optOutPatterns = [
    "stop messaging",
    "stop contacting",
    "do not message",
    "don't message",
    "unsubscribe",
    "not interested",
    "leave me alone",
    "stop sending"
  ];

  if (optOutPatterns.some(pattern => text.includes(pattern))) {
    return res.status(200).json({
      action: "end",
      rationale: "Merchant explicitly declined further contact. Closing the conversation."
    });
  }

  const autoReplyPatterns = [
    "thank you for contacting",
    "will respond shortly",
    "we will get back",
    "currently unavailable",
    "office hours"
  ];

  if (autoReplyPatterns.some(pattern => text.includes(pattern))) {
  const count = (autoReplyCounts.get(conversation_id) || 0) + 1;
  autoReplyCounts.set(conversation_id, count);

  if (count >= 4) {
    return res.status(200).json({
      action: "end",
      rationale: "Repeated automated replies detected. Ending the conversation."
    });
  }

  return res.status(200).json({
    action: "wait",
    wait_seconds: 14400,
    rationale: "Detected an automated response. Waiting for the merchant to respond."
  });
}

  const waitPatterns = [
    "later",
    "not now",
    "busy",
    "give me some time",
    "remind me"
  ];

  if (waitPatterns.some(pattern => text.includes(pattern))) {
    return res.status(200).json({
      action: "wait",
      wait_seconds: 1800,
      rationale: "Merchant indicated that they are not ready to continue. Waiting before following up."
    });
  }

  const negativePatterns = [
    "no thanks",
    "no thank you",
    "don't need",
    "do not need",
    "not required"
  ];

  if (negativePatterns.some(pattern => text.includes(pattern))) {
    return res.status(200).json({
      action: "end",
      rationale: "Merchant declined the offer. Ending the conversation respectfully."
    });
  }
  const commitmentPatterns = [
  "let's do it",
  "lets do it",
  "what's next",
  "whats next",
  "ready to proceed",
  "go ahead",
  "sounds good",
  "let's proceed",
  "lets proceed",
  "i'm ready"
];

if (commitmentPatterns.some(pattern => text.includes(pattern))) {
  return res.status(200).json({
    action: "send",
    body: "Great! Let's proceed. I'll guide you through the next steps.",
    cta: "confirm",
    rationale: "Merchant has committed. Moving from qualification to action."
  });
}

const merchantContext = contexts.get(`merchant:${merchant_id}`);
const merchant = merchantContext ? merchantContext.payload : {};

const categoryContext = merchant.category_slug
  ? contexts.get(`category:${merchant.category_slug}`)
  : null;

const category = categoryContext ? categoryContext.payload : {};

const customerContext = customer_id
  ? contexts.get(`customer:${customer_id}`)
  : null;

const customer = customerContext ? customerContext.payload : {};

const trigger = {};

const previousHistory = history.slice(0, -1);

const aiReply = await generateAIReply(
  merchant,
  message,
  category,
  trigger,
  customer,
  previousHistory
);

return res.status(200).json({
  action: "send",
  body: aiReply,
  cta: "open_ended",
  rationale: "Generated a personalized response using merchant, category, customer, and conversation context."
});
});
const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
  console.log(`Vera server running on port ${PORT}`);
});