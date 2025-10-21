(async function () {
  console.log("[InfoBlock Interceptor] loaded");

  // --- CONFIG ----
  // Keep the newest K assistant messages that contain an infoblock.
  // You asked for "remove all except the last", so K = 1.
  const KEEP_LAST_N = 1;

  // Define what an "infoblock" is:
  // Any fenced block starting with ```md or ```markdown (case-insensitive).
  // Example: ```md\nLocation: ...\n```
  const INFOBLOCK_FENCE = /```(?:md|markdown)\s*\r?\n[\s\S]*?```/gim;

  // --- HELPERS ---
  function isAssistant(msg) {
    if (typeof msg?.is_user === "boolean") return msg.is_user === false;
    if (typeof msg?.role === "string") return msg.role === "assistant";
    return false;
  }

  function getText(msg) {
    if (typeof msg?.mes === "string") return msg.mes;
    if (typeof msg?.content === "string") return msg.content;
    return "";
  }

  function setText(msg, newText) {
    if (typeof msg?.mes === "string") msg.mes = newText;
    else if (typeof msg?.content === "string") msg.content = newText;
  }

  function containsInfoBlock(text) {
    if (!text) return false;
    INFOBLOCK_FENCE.lastIndex = 0;
    return INFOBLOCK_FENCE.test(text);
  }

  function stripInfoBlocks(text) {
    if (!text) return text;
    // Remove ALL fenced md/markdown blocks from this text
    return text.replace(INFOBLOCK_FENCE, "").trim();
  }

  // The function name must match "generate_interceptor" in manifest.json
  globalThis.stripOldInfoBlocks = async function (chat, contextSize, abort, type) {
    try {
      // 1) Find assistant messages that contain at least one infoblock
      const idxWithBlocks = [];
      for (let i = 0; i < chat.length; i++) {
        const msg = chat[i];
        if (!isAssistant(msg)) continue;
        if (containsInfoBlock(getText(msg))) idxWithBlocks.push(i);
      }

      if (idxWithBlocks.length === 0) {
        // Nothing to do
        return chat;
      }

      // 2) Keep only the newest KEEP_LAST_N; prune the rest
      const toPrune = idxWithBlocks.slice(0, Math.max(0, idxWithBlocks.length - KEEP_LAST_N));

      // 3) Prune by cloning only the messages we modify (ephemeral)
      for (const idx of toPrune) {
        const original = chat[idx];
        const clone = structuredClone(original);
        const before = getText(clone);
        const after = stripInfoBlocks(before);
        setText(clone, after);
        chat[idx] = clone;
        console.log(`[InfoBlock Interceptor] pruned infoblock(s) from msg index ${idx}`);
      }

      return chat; // IMPORTANT for some builds
    } catch (e) {
      console.error("[InfoBlock Interceptor] error:", e);
      return chat; // Fail-safe
    }
  };
})();
