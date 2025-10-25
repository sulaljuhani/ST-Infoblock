// Infoblock Filter Extension for SillyTavern
// Removes all infoblocks except the most recent one

(function() {
    'use strict';
    
    const extensionName = 'infoblock-filter';
    let isEnabled = true;
    
    console.log(`[${extensionName}] Extension initializing...`);
    
    /**
     * Process messages array and remove old infoblocks
     */
    function processMessages(messages) {
        if (!messages || !Array.isArray(messages) || messages.length === 0) {
            return messages;
        }
        
        console.log(`[${extensionName}] Processing ${messages.length} messages`);
        
        // Find the index of the last message containing an infoblock
        let lastInfoblockIndex = -1;
        
        for (let i = messages.length - 1; i >= 0; i--) {
            const content = messages[i].content || '';
            if (typeof content === 'string') {
                // Create fresh regex for each test to avoid state issues
                const infoblockTestRegex = /<infoblock>[\s\S]*?<\/infoblock>/i;
                if (infoblockTestRegex.test(content)) {
                    lastInfoblockIndex = i;
                    console.log(`[${extensionName}] Found last infoblock at index ${i}`);
                    break;
                }
            }
        }
        
        if (lastInfoblockIndex === -1) {
            console.log(`[${extensionName}] No infoblocks found in messages`);
            return messages;
        }
        
        // Process messages
        let removedCount = 0;
        const processedMessages = messages.map((msg, index) => {
            // Keep the last infoblock message unchanged
            if (index === lastInfoblockIndex) {
                return msg;
            }
            
            const content = msg.content || '';
            if (typeof content === 'string') {
                // Create fresh regex for each test and replace
                const infoblockTestRegex = /<infoblock>[\s\S]*?<\/infoblock>/i;
                const infoblockReplaceRegex = /<infoblock>[\s\S]*?<\/infoblock>/gi;
                
                if (infoblockTestRegex.test(content)) {
                    const cleanedContent = content.replace(infoblockReplaceRegex, '').trim();
                    removedCount++;
                    console.log(`[${extensionName}] Removed infoblock from message ${index}`);
                    return {
                        ...msg,
                        content: cleanedContent
                    };
                }
            }
            
            return msg;
        });
        
        console.log(`[${extensionName}] Removed ${removedCount} old infoblock(s)`);
        return processedMessages;
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
    jQuery(async () => {
        // Wait a bit for SillyTavern to fully load
        await new Promise(resolve => setTimeout(resolve, 1000));
        createUI();
        console.log(`[${extensionName}] Extension loaded and ready`);
    });
    
})();
