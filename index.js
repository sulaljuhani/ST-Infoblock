// SillyTavern Extension: Remove all infoblocks except the last one
// This version hooks into the prompt modification pipeline

import { eventSource, event_types } from '../../../script.js';
import { extension_settings, saveSettingsDebounced } from '../../../../script.js';
import { power_user } from '../../../power-user.js';

const extensionName = 'infoblock-filter';

const defaultSettings = {
    enabled: true
};

// Regular expression to match infoblock content
const infoblockRegex = /<infoblock>\s*```md\n[\s\S]*?```\s*<\/infoblock>/g;

function getSettings() {
    if (!extension_settings.infoblock_filter) {
        extension_settings.infoblock_filter = structuredClone(defaultSettings);
    }
    return extension_settings.infoblock_filter;
}

function saveSettings() {
    saveSettingsDebounced();
}

/**
 * Processes messages array and removes all infoblocks except the last one
 */
function processMessages(messages) {
    const settings = getSettings();
    
    if (!settings.enabled || !Array.isArray(messages) || messages.length === 0) {
        return messages;
    }

    console.log(`[${extensionName}] Processing ${messages.length} messages`);
    
    // Find the last message containing an infoblock
    let lastInfoblockIndex = -1;
    
    for (let i = messages.length - 1; i >= 0; i--) {
        const message = messages[i];
        // Check different possible message structures
        const content = message.content || message.mes || '';
        
        if (typeof content === 'string') {
            infoblockRegex.lastIndex = 0;
            if (infoblockRegex.test(content)) {
                lastInfoblockIndex = i;
                console.log(`[${extensionName}] Found last infoblock at index ${i}`);
                break;
            }
        }
    }
    
    // If no infoblock found, return original messages
    if (lastInfoblockIndex === -1) {
        console.log(`[${extensionName}] No infoblocks found`);
        return messages;
    }
    
    // Create modified copy of messages
    const modifiedMessages = messages.map((message, i) => {
        if (i === lastInfoblockIndex) {
            // Keep the last infoblock as-is
            return message;
        }
        
        // Get content from either 'content' or 'mes' field
        const content = message.content || message.mes || '';
        
        if (typeof content === 'string') {
            infoblockRegex.lastIndex = 0;
            const newContent = content.replace(infoblockRegex, '').trim();
            
            if (newContent !== content) {
                console.log(`[${extensionName}] Removed infoblock from message ${i}`);
                // Create a new message object with modified content
                const modifiedMessage = { ...message };
                if (message.content !== undefined) {
                    modifiedMessage.content = newContent;
                }
                if (message.mes !== undefined) {
                    modifiedMessage.mes = newContent;
                }
                return modifiedMessage;
            }
        }
        
        return message;
    });
    
    return modifiedMessages;
}

/**
 * Hook into the message sending pipeline
 */
function hookIntoGeneration() {
    // Store original Generate function
    const originalGenerate = window.Generate;
    
    if (typeof originalGenerate === 'function') {
        window.Generate = async function(...args) {
            console.log(`[${extensionName}] Intercepting Generate call`);
            
            // Get the context
            const context = SillyTavern.getContext();
            if (context && context.chat) {
                // Process the chat before generation
                context.chat = processMessages(context.chat);
            }
            
            // Call original function
            return originalGenerate.apply(this, args);
        };
        
        console.log(`[${extensionName}] Hooked into Generate function`);
    }
}

/**
 * Alternative hook using event system
 */
function setupEventListeners() {
    // Listen for generation events
    eventSource.on(event_types.GENERATION_STARTED, () => {
        const settings = getSettings();
        if (!settings.enabled) return;
        
        const context = SillyTavern.getContext();
        if (context && context.chat) {
            console.log(`[${extensionName}] Processing on GENERATION_STARTED`);
            context.chat = processMessages(context.chat);
        }
    });
    
    // Also process on chat change
    eventSource.on(event_types.CHAT_CHANGED, () => {
        const settings = getSettings();
        if (!settings.enabled) return;
        
        const context = SillyTavern.getContext();
        if (context && context.chat) {
            console.log(`[${extensionName}] Processing on CHAT_CHANGED`);
            context.chat = processMessages(context.chat);
        }
    });
    
    console.log(`[${extensionName}] Event listeners registered`);
}

/**
 * Create settings UI
 */
function createSettingsUI() {
    const html = `
        <div class="infoblock-filter-settings">
            <div class="inline-drawer">
                <div class="inline-drawer-toggle inline-drawer-header">
                    <b>Infoblock Filter</b>
                    <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
                </div>
                <div class="inline-drawer-content">
                    <label class="checkbox_label" for="infoblock_filter_enabled">
                        <input type="checkbox" id="infoblock_filter_enabled" />
                        <span>Enable Infoblock Filter</span>
                    </label>
                    <div class="note">
                        <small>Removes all infoblocks except the most recent one from chat history to reduce token usage.</small>
                    </div>
                    <hr>
                    <div class="note">
                        <small><strong>How it works:</strong> This extension scans your chat history and removes all <code>&lt;infoblock&gt;</code> sections except for the last one, keeping your context window clean while maintaining the current state tracking.</small>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    $('#extensions_settings2').append(html);
    
    const settings = getSettings();
    $('#infoblock_filter_enabled').prop('checked', settings.enabled);
    
    $('#infoblock_filter_enabled').on('change', function() {
        const settings = getSettings();
        settings.enabled = $(this).prop('checked');
        saveSettings();
        console.log(`[${extensionName}] Extension ${settings.enabled ? 'enabled' : 'disabled'}`);
    });
}

/**
 * Initialize extension
 */
jQuery(async () => {
    // Wait for SillyTavern to be ready
    while (!window.SillyTavern) {
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    createSettingsUI();
    setupEventListeners();
    hookIntoGeneration();
    
    console.log(`[${extensionName}] Extension loaded successfully`);
    
    const settings = getSettings();
    console.log(`[${extensionName}] Current settings:`, settings);
});
