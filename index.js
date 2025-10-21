// SillyTavern Extension: Remove all infoblocks except the last one
// Place this file in: SillyTavern/public/scripts/extensions/infoblock-filter/index.js

(function() {
    'use strict';

    const extensionName = "infoblock-filter";
    const extensionFolderPath = `scripts/extensions/${extensionName}/`;
    
    function removeOldInfoblocks(messages) {
        if (!Array.isArray(messages) || messages.length === 0) {
            return messages;
        }

        // Regular expression to match infoblock content
        // Matches content between <infoblock> tags and ```md blocks
        const infoblockRegex = /<infoblock>\s*```md\n[\s\S]*?```\s*<\/infoblock>/g;
        
        // Track the last message with an infoblock
        let lastInfoblockIndex = -1;
        
        // First pass: find the last message containing an infoblock
        for (let i = messages.length - 1; i >= 0; i--) {
            if (messages[i].content && typeof messages[i].content === 'string') {
                if (infoblockRegex.test(messages[i].content)) {
                    lastInfoblockIndex = i;
                    break;
                }
            }
        }
        
        // If no infoblock found, return original messages
        if (lastInfoblockIndex === -1) {
            return messages;
        }
        
        // Second pass: remove infoblocks from all messages except the last one
        const processedMessages = messages.map((msg, index) => {
            if (index === lastInfoblockIndex) {
                // Keep this message as-is (contains the last infoblock)
                return msg;
            }
            
            if (msg.content && typeof msg.content === 'string') {
                // Reset regex lastIndex
                infoblockRegex.lastIndex = 0;
                
                // Remove infoblock from this message
                const newContent = msg.content.replace(infoblockRegex, '').trim();
                
                // Only return modified message if content actually changed
                if (newContent !== msg.content) {
                    return {
                        ...msg,
                        content: newContent
                    };
                }
            }
            
            return msg;
        });
        
        return processedMessages;
    }

    // Hook into SillyTavern's prompt modification system
    function setupExtension() {
        // Register the extension
        if (window.SillyTavern && window.SillyTavern.getContext) {
            const context = window.SillyTavern.getContext();
            
            // Hook into the message array before it's sent to the API
            const originalGenerateRaw = context.generateRaw;
            if (originalGenerateRaw) {
                context.generateRaw = async function(...args) {
                    // Intercept and modify the chat messages
                    if (context.chat && Array.isArray(context.chat)) {
                        context.chat = removeOldInfoblocks(context.chat);
                    }
                    return originalGenerateRaw.apply(this, args);
                };
            }
        }

        console.log(`${extensionName} extension loaded`);
    }

    // Alternative: Use the event system if available
    jQuery(async () => {
        setupExtension();
        
        // Also hook into the event system for generation
        if (window.eventSource) {
            window.eventSource.on('CHAT_CHANGED', () => {
                const context = window.SillyTavern?.getContext();
                if (context && context.chat) {
                    context.chat = removeOldInfoblocks(context.chat);
                }
            });
        }
    });

    // Export for testing
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { removeOldInfoblocks };
    }
})();
