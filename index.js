(async function () {
  console.log("[InfoBlock Interceptor] loaded");

  // Keep the latest K assistant messages that have an infoblock
  const KEEP_LAST_N = 1;

  // Matches ANY fenced code block ```...```, with optional language (md/markdown/anything).
  const ANY_FENCE = /```[^\n]*\n[\s\S]*?```/g;

  // Heuristic to decide whether a fenced block is *your* infoblock and not unrelated code.
  const LOOKS_LIKE_INFOBLOCK = /(?:^|\n)\s*Location:|Characters intents:|Emotional state:|Positions:|Outfits:|Remember:/i;

  function getText(msg) {
    if (typeof msg?.mes === "string") return msg.mes;
    if (typeof msg?.content === "string") return msg.content;
    return "";
  }

  function setText(msg, newText) {
    if (typeof msg?.mes === "string") msg.mes = newText;
    else if (typeof msg?.content === "string") msg.content = newText;
  }

  function isAssistant(msg) {
    if (typeof msg?.is_user === "boolean") return msg.is_user === false;
    if (typeof msg?.role === "string") return msg.role === "assistant";
    return false;
  }

  // True if message contains an infoblock-like fenced section
  function hasInfoBlock(text) {
    if (!text) return false;
    ANY_FENCE.lastIndex = 0;
    let m;
    while ((m = ANY_FENCE.exec(text)) !== null) {
      if (LOOKS_LIKE_INFOBLOCK.test(m[0])) return true;
    }
    return false;
  }

  // Remove only the fenced blocks that look like your infoblock
  function stripInfoBlocks(text) {
    if (!text) return text;
    return text.replace(ANY_FENCE, (block) => {
      return LOOKS_LIKE_INFOBLOCK.test(block) ? "" : block;
    }).trim();
  }

  globalThis.stripOldInfoBlocks = async function (chat, contextSize, abort, type) {
    try {
      // Find assistant message indices that contain an infoblock
      const idxWithBlocks = [];
      for (let i = 0; i < chat.length; i++) {
        const msg = chat[i];
        if (!isAssistant(msg)) continue;
        const t = getText(msg);
        if (hasInfoBlock(t)) idxWithBlocks.push(i);
      }

      if (idxWithBlocks.length <= KEEP_LAST_N) return;

      // Keep the newest K, prune the rest (older ones)
      const toPrune = idxWithBlocks.slice(0, -KEEP_LAST_N);

      for (const idx of toPrune) {
        // clone then mutate (ephemeral—visible chat stays intact)
        const clone = structuredClone(chat[idx]);
        setText(clone, stripInfoBlocks(getText(clone)));
        chat[idx] = clone;
      }

      console.log("[InfoBlock Interceptor] pruned indices:", toPrune);
    } catch (e) {
      console.error("[InfoBlock Interceptor] error:", e);
    }
  };
})();
