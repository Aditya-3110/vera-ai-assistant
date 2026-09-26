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

  if (current && current.version >= version) {
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

app.post("/v1/tick", (req, res) => {
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

    const merchantId =
      trigger.merchant_id || trigger.payload?.merchant_id;

    if (!merchantId) continue;

    const merchant = contexts.get(`merchant:${merchantId}`)?.payload;

    if (!merchant) continue;

    const category = contexts.get(
      `category:${merchant.category_slug}`
    )?.payload;

    if (!category) continue;

    const customerId =
      trigger.customer_id || trigger.payload?.customer_id || null;

    const customer = customerId
      ? contexts.get(`customer:${customerId}`)?.payload
      : null;

    const merchantName =
      merchant.identity?.name || "there";

    const triggerKind =
      trigger.kind || "business_update";

    const triggerDetails =
      trigger.payload?.summary ||
      trigger.payload?.title ||
      trigger.payload?.description ||
      "";

    const conversationId =
      `conv_${merchantId}_${triggerId}_${Date.now()}`;

    const message = triggerDetails
      ? `Hi ${merchantName}, here's an update regarding ${triggerKind.replace(/_/g, " ")}: ${triggerDetails}. Would you like to explore this further?`
      : `Hi ${merchantName}, there's a new update regarding ${triggerKind.replace(/_/g, " ")}. Would you like to explore this further?`;

    actions.push({
      conversation_id: conversationId,
      merchant_id: merchantId,
      customer_id: null,
      send_as: "vera",
      trigger_id: triggerId,
      template_name: "vera_generic_v1",
      template_params: [merchantName, triggerKind, triggerDetails],
      body: message,
      cta: "open_ended",
      suppression_key: trigger.suppression_key || "",
      rationale: `Generated a merchant-facing message using the available ${triggerKind} trigger and merchant context.`
    });

    conversations.set(conversationId, []);
  }

  return res.status(200).json({ actions });
});