(async function () {
  console.log("[InfoBlock Interceptor] loaded");

  const KEEP_LAST_N = 1;
  const INFOBLOCK_REGEX = /```md[\s\S]*?```/gim;

  function stripInfoBlocks(text) {
    if (!text || typeof text !== "string") return text;
    return text.replace(INFOBLOCK_REGEX, "").trim();
  }

  globalThis.stripOldInfoBlocks = async function (chat, contextSize, abort, type) {
    try {
      const assistantIdxs = [];
      for (let i = 0; i < chat.length; i++) {
        const m = chat[i];
        if (!m.is_user && typeof m.mes === "string" && INFOBLOCK_REGEX.test(m.mes)) {
          assistantIdxs.push(i);
        }
        INFOBLOCK_REGEX.lastIndex = 0;
      }

      if (assistantIdxs.length <= KEEP_LAST_N) return;

      const toPrune = assistantIdxs.slice(0, -KEEP_LAST_N);
      for (const idx of toPrune) {
        const clone = structuredClone(chat[idx]);
        clone.mes = stripInfoBlocks(clone.mes);
        chat[idx] = clone;
      }

      console.log("[InfoBlock Interceptor] pruned indices:", toPrune);
    } catch (e) {
      console.error("[InfoBlock Interceptor] error:", e);
    }
  };
})();
