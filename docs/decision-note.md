# Decision Note

The biggest decision was to make orchestration explicit instead of hiding it inside one prompt. The backend parses the user request into constraints, decides which agents are needed, runs them in dependency order, and stores a trace. For a full trip request the chain is Destination -> Itinerary -> Budget; for a destination-only request it can skip itinerary work. This makes the routing easy to defend and makes future policy checks possible.

Second, the model provider is an adapter. Gemini is used when `GEMINI_API_KEY` is present, but every agent has deterministic fallback output and the response marks fallback mode. That keeps the app usable in review environments without leaking a key, while preserving the production shape: provider timeouts, mapped errors, and no raw provider payloads exposed to the browser.

Third, persistence is an append-only JSONL audit log rather than a heavier database. The take-home asks for a request log and agent attribution, so a structured file gives durable local state, simple tests, and transparent review. I deliberately cut authentication, travel inventory APIs, streaming tokens, and booking workflows. The app still has a clear loading state and agent activity trace, but I kept the scope focused on the three-agent orchestration contract.
