// Debug Helper Tools - Paste these in console to diagnose YouTube behavior

// 1. COMPREHENSIVE EVENT MONITORING
window.debugYouTube = {
    eventLog: [],
    
    startMonitoring() {
        console.log('🔍 Starting comprehensive YouTube monitoring...');
        
        // Monitor ALL events
        ['click', 'submit', 'change', 'input', 'focus', 'blur', 'keydown', 'keyup'].forEach(eventType => {
            document.addEventListener(eventType, (e) => {
                const log = {
                    type: eventType,
                    target: e.target.tagName + (e.target.className ? '.' + e.target.className.split(' ').join('.') : ''),
                    time: new Date().toISOString(),
                    targetElement: e.target
                };
                this.eventLog.push(log);
                
                if (eventType === 'click' || eventType === 'submit') {
                    console.log('📍 Event:', log);
                }
            }, true);
        });
        
        // Monitor network requests
        this.monitorNetworkRequests();
        
        // Monitor page navigation
        this.monitorNavigation();
        
        // Monitor DOM mutations
        this.monitorDOMMutations();
    },
    
    monitorNetworkRequests() {
        const originalFetch = window.fetch;
        window.fetch = function(...args) {
            console.log('🌐 Fetch request:', args[0]);
            return originalFetch.apply(this, arguments).then(response => {
                console.log('📥 Fetch response:', response.status, args[0]);
                return response;
            });
        };
        
        // Monitor XMLHttpRequest
        const originalXHR = window.XMLHttpRequest.prototype.open;
        window.XMLHttpRequest.prototype.open = function(method, url) {
            console.log('🔗 XHR request:', method, url);
            return originalXHR.apply(this, arguments);
        };
    },
    
    monitorNavigation() {
        ['beforeunload', 'unload', 'pagehide', 'pageshow'].forEach(event => {
            window.addEventListener(event, (e) => {
                console.log(`🚪 Navigation event: ${event}`);
            });
        });
        
        // Monitor history changes
        const originalPushState = history.pushState;
        const originalReplaceState = history.replaceState;
        
        history.pushState = function(...args) {
            console.log('📚 pushState:', args);
            return originalPushState.apply(this, arguments);
        };
        
        history.replaceState = function(...args) {
            console.log('📝 replaceState:', args);
            return originalReplaceState.apply(this, arguments);
        };
    },
    
    monitorDOMMutations() {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach(node => {
                        if (node.nodeType === 1 && node.tagName === 'YTCP-VIDEO-VISIBILITY-SELECT') {
                            console.log('👁️ Visibility modal appeared!');
                        }
                    });
                    
                    mutation.removedNodes.forEach(node => {
                        if (node.nodeType === 1 && node.tagName === 'YTCP-VIDEO-VISIBILITY-SELECT') {
                            console.log('🚪 Visibility modal disappeared!');
                        }
                    });
                }
            });
        });
        
        observer.observe(document.body, { 
            childList: true, 
            subtree: true,
            attributes: true,
            attributeFilter: ['style', 'class', 'hidden']
        });
    },
    
    getRecentEvents(seconds = 10) {
        const cutoff = new Date(Date.now() - seconds * 1000);
        return this.eventLog.filter(log => new Date(log.time) > cutoff);
    },
    
    analyzePattern() {
        console.log('📊 Analysis of recent events:');
        const recent = this.getRecentEvents(30);
        
        const clicks = recent.filter(e => e.type === 'click');
        const submits = recent.filter(e => e.type === 'submit');
        
        console.log(`Clicks: ${clicks.length}`, clicks);
        console.log(`Submits: ${submits.length}`, submits);
        
        return { clicks, submits, all: recent };
    }
};

// 2. YOUTUBE STATE INSPECTOR
window.inspectYouTubeState = {
    checkPageState() {
        console.log('🔍 Current YouTube page state:');
        
        // Check for any blocking states
        const modals = document.querySelectorAll('[role="dialog"], .ytcp-modal, ytcp-video-visibility-select');
        console.log('Modals open:', modals.length, Array.from(modals));
        
        // Check form states
        const forms = document.querySelectorAll('form');
        console.log('Forms on page:', forms.length);
        
        // Check video rows
        const videoRows = document.querySelectorAll('ytcp-video-row');
        console.log('Video rows:', videoRows.length);
        
        // Check for any error states
        const errors = document.querySelectorAll('[role="alert"], .error, .warning');
        console.log('Error/warning elements:', errors.length, Array.from(errors));
        
        // Check for loading states
        const spinners = document.querySelectorAll('[role="progressbar"], .spinner, .loading');
        console.log('Loading indicators:', spinners.length, Array.from(spinners));
    },
    
    checkExtensionState() {
        // Check if our extension is working
        const enhancedRows = document.querySelectorAll('.ysve-enhanced-row');
        const overlay = document.querySelector('#ysve-playlist-overlay');
        const queueIndicators = document.querySelectorAll('.ysve-queue-indicator');
        
        console.log('🔧 Extension state:');
        console.log('Enhanced rows:', enhancedRows.length);
        console.log('Overlay present:', !!overlay);
        console.log('Queue indicators:', queueIndicators.length);
        
        return {
            enhancedRows: enhancedRows.length,
            overlayPresent: !!overlay,
            queueIndicators: queueIndicators.length
        };
    }
};

// 3. QUICK TEST FUNCTIONS
window.testYouTube = {
    // Test if clicking dropdown works
    testDropdownClick() {
        const firstRow = document.querySelector('ytcp-video-row');
        if (firstRow) {
            const dropdown = firstRow.querySelector('.edit-triangle-icon');
            if (dropdown) {
                console.log('🖱️ Testing dropdown click...');
                dropdown.click();
                setTimeout(() => {
                    const modal = document.querySelector('ytcp-video-visibility-select');
                    console.log('Modal appeared:', !!modal);
                }, 500);
            }
        }
    },
    
    // Test radio button clicking
    testRadioClick() {
        const modal = document.querySelector('ytcp-video-visibility-select');
        if (modal) {
            const radios = modal.querySelectorAll('tp-yt-paper-radio-button');
            console.log('🔘 Available radios:', Array.from(radios).map(r => r.name));
            
            const privateRadio = modal.querySelector('[name="PRIVATE"]');
            if (privateRadio) {
                console.log('🖱️ Clicking PRIVATE radio...');
                privateRadio.click();
            }
        }
    },
    
    // Force close any open modals
    closeAllModals() {
        const modals = document.querySelectorAll('ytcp-video-visibility-select, [role="dialog"]');
        modals.forEach(modal => {
            modal.style.display = 'none';
            modal.remove();
        });
        console.log('🚪 Closed all modals');
    }
};

// AUTO-START MONITORING
console.log('🚀 Debug tools loaded! Available commands:');
console.log('debugYouTube.startMonitoring() - Start comprehensive monitoring');
console.log('inspectYouTubeState.checkPageState() - Check current page state');
console.log('inspectYouTubeState.checkExtensionState() - Check extension state');
console.log('testYouTube.testDropdownClick() - Test dropdown functionality');
console.log('debugYouTube.analyzePattern() - Analyze recent events');

// Start monitoring automatically
debugYouTube.startMonitoring();