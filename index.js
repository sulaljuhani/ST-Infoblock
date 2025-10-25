// Infoblock Filter Extension for SillyTavern
// Removes all infoblocks except the most recent one

(function() {
    'use strict';
    
    const extensionName = 'infoblock-filter';
    let isEnabled = true;
    
    console.log(`[${extensionName}] Extension initializing...`);
    
    function hasInfoblock(content) {
        if (typeof content !== 'string' || !content) {
            return false;
        }

        const infoblockTestRegex = /<infoblock>[\s\S]*?<\/infoblock>/i;
        return infoblockTestRegex.test(content);
    }

    function stripInfoblocks(content) {
        const infoblockReplaceRegex = /<infoblock>[\s\S]*?<\/infoblock>/gi;
        return content.replace(infoblockReplaceRegex, '').trim();
    }

    function findLastInfoblockIndex(items, getContent) {
        for (let i = items.length - 1; i >= 0; i--) {
            const content = getContent(items[i]);
            if (typeof content === 'string' && hasInfoblock(content)) {
                return i;
            }
        }

        return -1;
    }

    /**
     * Process messages array and remove old infoblocks
     */
    function processMessages(messages) {
        if (!messages || !Array.isArray(messages) || messages.length === 0) {
            return messages;
        }

        console.log(`[${extensionName}] Processing ${messages.length} messages`);

        const lastInfoblockIndex = findLastInfoblockIndex(messages, msg => msg?.content || '');

        if (lastInfoblockIndex === -1) {
            console.log(`[${extensionName}] No infoblocks found in messages`);
            return messages;
        }

        console.log(`[${extensionName}] Found last infoblock at index ${lastInfoblockIndex}`);

        let removedCount = 0;
        const processedMessages = messages.map((msg, index) => {
            if (index === lastInfoblockIndex) {
                return msg;
            }

            const content = msg?.content || '';
            if (typeof content === 'string' && hasInfoblock(content)) {
                const cleanedContent = stripInfoblocks(content);
                removedCount++;
                console.log(`[${extensionName}] Removed infoblock from message ${index}`);
                return {
                    ...msg,
                    content: cleanedContent
                };
            }

            return msg;
        });

        console.log(`[${extensionName}] Removed ${removedCount} old infoblock(s)`);
        return processedMessages;
    }

    function applyInfoblockFilterToChat(chatMessages) {
        if (!Array.isArray(chatMessages) || chatMessages.length === 0) {
            return null;
        }

        const getContent = message => {
            if (!message) {
                return '';
            }

            if (Object.prototype.hasOwnProperty.call(message, 'mes')) {
                return message.mes;
            }

            if (Object.prototype.hasOwnProperty.call(message, 'content')) {
                return message.content;
            }

            return '';
        };

        const setContent = (message, value) => {
            if (!message) {
                return;
            }

            if (Object.prototype.hasOwnProperty.call(message, 'mes')) {
                message.mes = value;
            } else if (Object.prototype.hasOwnProperty.call(message, 'content')) {
                message.content = value;
            }
        };

        const lastInfoblockIndex = findLastInfoblockIndex(chatMessages, getContent);

        if (lastInfoblockIndex === -1) {
            return null;
        }

        const modifications = [];
        let removedCount = 0;

        for (let i = 0; i < chatMessages.length; i++) {
            if (i === lastInfoblockIndex) {
                continue;
            }

            const content = getContent(chatMessages[i]);

            if (typeof content === 'string' && hasInfoblock(content)) {
                const cleanedContent = stripInfoblocks(content);

                if (cleanedContent !== content) {
                    modifications.push({
                        message: chatMessages[i],
                        property: Object.prototype.hasOwnProperty.call(chatMessages[i], 'mes') ? 'mes' : 'content',
                        original: content
                    });

                    setContent(chatMessages[i], cleanedContent);
                    removedCount++;
                }
            }
        }

        if (removedCount > 0) {
            console.log(`[${extensionName}] Temporarily removed ${removedCount} infoblock(s) from chat history before formatting`);
        }

        return modifications.length ? modifications : null;
    }

    function restoreChatModifications(modifications) {
        if (!Array.isArray(modifications)) {
            return;
        }

        modifications.forEach(({ message, property, original }) => {
            if (!message || typeof original !== 'string') {
                return;
            }

            if (property === 'mes') {
                message.mes = original;
            } else if (property === 'content') {
                message.content = original;
            }
        });
    }
    
    /**
     * Intercept fetch requests
     */
    const originalFetch = window.fetch;
    window.fetch = async function(...args) {
        const [urlOrRequest, options] = args;

        // Handle requests created with the Request constructor and no options passed
        if (urlOrRequest instanceof Request && options === undefined) {
            if (!isEnabled) {
                return originalFetch.call(this, urlOrRequest);
            }

            try {
                const clonedRequest = urlOrRequest.clone();
                const bodyText = await clonedRequest.text();

                if (bodyText) {
                    const data = JSON.parse(bodyText);

                    if (data.messages && Array.isArray(data.messages)) {
                        console.log(`[${extensionName}] Intercepting fetch request to:`, clonedRequest.url);
                        console.log(`[${extensionName}] Original message count: ${data.messages.length}`);

                        data.messages = processMessages(data.messages);

                        const modifiedRequest = new Request(clonedRequest, {
                            body: JSON.stringify(data)
                        });

                        console.log(`[${extensionName}] Modified request sent`);
                        return originalFetch.call(this, modifiedRequest);
                    }
                }
            } catch (e) {
                // Not JSON or parsing error - continue normally
            }

            return originalFetch.call(this, urlOrRequest);
        }

        // Check if this is an API request with a body provided via options
        if (options && options.body && typeof options.body === 'string') {
            try {
                const data = JSON.parse(options.body);

                // Check if it has messages array (OpenAI/Claude format)
                if (data.messages && Array.isArray(data.messages) && isEnabled) {
                    console.log(`[${extensionName}] Intercepting fetch request to:`, urlOrRequest);
                    console.log(`[${extensionName}] Original message count: ${data.messages.length}`);

                    // Process the messages
                    data.messages = processMessages(data.messages);

                    // Update the body with processed messages
                    options.body = JSON.stringify(data);
                    console.log(`[${extensionName}] Modified request sent`);
                }
            } catch (e) {
                // Not JSON or parsing error - continue normally
            }
        }

        return originalFetch.apply(this, args);
    };
    
    /**
     * Intercept XMLHttpRequest (backup method)
     */
    const originalXHRSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.send = function(body) {
        if (body && typeof body === 'string' && isEnabled) {
            try {
                const data = JSON.parse(body);
                
                if (data.messages && Array.isArray(data.messages)) {
                    console.log(`[${extensionName}] Intercepting XHR request`);
                    console.log(`[${extensionName}] Original message count: ${data.messages.length}`);
                    
                    data.messages = processMessages(data.messages);
                    body = JSON.stringify(data);
                    console.log(`[${extensionName}] Modified XHR request sent`);
                }
            } catch (e) {
                // Not JSON or parsing error - continue normally
            }
        }
        
        return originalXHRSend.call(this, body);
    };
    
    console.log(`[${extensionName}] Fetch and XHR interceptors installed`);
    
    /**
     * Create settings UI
     */
    function createUI() {
        const settingsHTML = `
            <div class="infoblock-filter-settings">
                <div class="inline-drawer">
                    <div class="inline-drawer-toggle inline-drawer-header">
                        <b>Infoblock Filter</b>
                        <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
                    </div>
                    <div class="inline-drawer-content">
                        <label class="checkbox_label" for="infoblock_filter_enabled">
                            <input type="checkbox" id="infoblock_filter_enabled" checked />
                            <span>Enable Infoblock Filter</span>
                        </label>
                        <div style="margin-top: 10px;">
                            <small>Removes all <code>&lt;infoblock&gt;</code> sections except the most recent one to reduce token usage.</small>
                        </div>
                        <div style="margin-top: 10px;">
                            <button id="infoblock_filter_test" class="menu_button">
                                <i class="fa-solid fa-flask"></i>
                                Test Filter
                            </button>
                        </div>
                        <div id="infoblock_filter_status" style="margin-top: 10px; font-size: 12px; color: #888;"></div>
                    </div>
                </div>
            </div>
        `;
        
        $('#extensions_settings2').append(settingsHTML);
        
        // Event listener for enable/disable
        $('#infoblock_filter_enabled').on('change', function() {
            isEnabled = $(this).prop('checked');
            console.log(`[${extensionName}] Extension ${isEnabled ? 'enabled' : 'disabled'}`);
            updateStatus();
        });
        
        // Test button
        $('#infoblock_filter_test').on('click', function() {
            console.log(`[${extensionName}] Running test...`);
            const testMessages = [
                { role: 'user', content: 'Hello' },
                { role: 'assistant', content: 'Hi there!\n<infoblock>\n```md\nTest: Old\n```\n</infoblock>' },
                { role: 'user', content: 'How are you?' },
                { role: 'assistant', content: 'Good!\n<infoblock>\n```md\nTest: New\n```\n</infoblock>' }
            ];
            
            const result = processMessages(testMessages);
            const hasOldInfoblock = result[1].content.includes('<infoblock>');
            const hasNewInfoblock = result[3].content.includes('<infoblock>');
            
            if (!hasOldInfoblock && hasNewInfoblock) {
                $('#infoblock_filter_status').html('<span style="color: #4CAF50;">✓ Test passed! Filter is working correctly.</span>');
            } else {
                $('#infoblock_filter_status').html('<span style="color: #f44336;">✗ Test failed. Check console for details.</span>');
            }
            
            console.log(`[${extensionName}] Test result:`, result);
        });
        
        updateStatus();
    }
    
    function updateStatus() {
        if (isEnabled) {
            $('#infoblock_filter_status').html('<span style="color: #4CAF50;">Active - Filtering infoblocks</span>');
        } else {
            $('#infoblock_filter_status').html('<span style="color: #ff9800;">Disabled</span>');
        }
    }
    
    // Initialize when DOM is ready
    function wrapGenerateWhenReady() {
        const maxAttempts = 40;
        let attempts = 0;

        const intervalId = setInterval(() => {
            const generateFn = window.generate;

            if (typeof generateFn === 'function') {
                clearInterval(intervalId);

                if (generateFn.__infoblockFilterWrapped) {
                    return;
                }

                const originalGenerate = generateFn;

                const wrappedGenerate = async function(...args) {
                    let modifications = null;

                    if (isEnabled && Array.isArray(window.chat)) {
                        try {
                            modifications = applyInfoblockFilterToChat(window.chat);
                        } catch (error) {
                            console.error(`[${extensionName}] Failed to apply pre-format infoblock filtering:`, error);
                        }
                    }

                    try {
                        return await originalGenerate.apply(this, args);
                    } finally {
                        if (modifications) {
                            restoreChatModifications(modifications);
                        }
                    }
                };

                wrappedGenerate.__infoblockFilterWrapped = true;
                window.generate = wrappedGenerate;

                console.log(`[${extensionName}] generate() wrapped for pre-format infoblock filtering`);
                return;
            }

            attempts++;

            if (attempts >= maxAttempts) {
                clearInterval(intervalId);
                console.warn(`[${extensionName}] Unable to hook generate(); relying on network interception only`);
            }
        }, 250);
    }

    jQuery(async () => {
        // Wait a bit for SillyTavern to fully load
        await new Promise(resolve => setTimeout(resolve, 1000));
        createUI();
        wrapGenerateWhenReady();
        console.log(`[${extensionName}] Extension loaded and ready`);
    });
    
})();
