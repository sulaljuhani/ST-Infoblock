// == InfoBlock Interceptor (ephemeral) ==
// Prunes older <infoblock>...</infoblock> sections from assistant messages
// in the OUTGOING PROMPT only (your visible chat remains unchanged).

// Keep the infoblock in the most recent K assistant replies:
const KEEP_LAST_N = 1;

/**
 * Robust matcher for your exact format:
 * - Matches <infoblock> ... </infoblock> non-greedily.
 * - Case-insensitive, multiline, global.
 * - Tolerates spaces inside tags: < infoblock > </ infoblock >
 * - Works whether or not the block contains ```md fenced content.
 */
const INFOBLOCK_REGEX = /<\s*infoblock\s*>[\s\S]*?<\s*\/\s*infoblock\s*>/gim;

// Optional: if you sometimes forget the closing tag, enable this fallback too:
// const UNBALANCED_FALLBACK = /<\s*infoblock\s*>[\s\S]*?(?:```[\s\S]*?```|$)/gim;
// Then combine:
// const INFOBLOCK_REGEX = new RegExp(
//   `${/<\s*infoblock\s*>[\s\S]*?<\s*\/\s*infoblock\s*>/.source}|${/</.source}`,
//   'gim'
// );

function stripInfoBlocks(text) {
  if (!text || typeof text !== 'string') return text;
  return text.replace(INFOBLOCK_REGEX, '').trim();
}

// Required name must match manifest.json → generate_interceptor
globalThis.stripOldInfoBlocks = async function(chat, contextSize, abort, type) {
  try {
    const assistantIdxsWithBlocks = [];

    for (let i = 0; i < chat.length; i++) {
      const m = chat[i];
      if (m && !m.is_user && typeof m.mes === 'string') {
        if (INFOBLOCK_REGEX.test(m.mes)) {
          assistantIdxsWithBlocks.push(i);
        }
        // Reset for next .test() because /g is set
        INFOBLOCK_REGEX.lastIndex = 0;
      }
    }

    if (assistantIdxsWithBlocks.length <= KEEP_LAST_N) return;

    // Keep the most recent KEEP_LAST_N (highest indices)
    const toPrune = assistantIdxsWithBlocks.slice(0, -KEEP_LAST_N);

    for (const idx of toPrune) {
      const original = chat[idx];
      const cloned = structuredClone(original); // ephemeral change only
      cloned.mes = stripInfoBlocks(original.mes);
      chat[idx] = cloned;
    }
  } catch (e) {
    console.error('[InfoBlock Interceptor] error:', e);
  }
};
