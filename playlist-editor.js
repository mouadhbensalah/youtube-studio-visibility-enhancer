// playlist-editor.js - YouTube Studio Playlist Batch Editor
// Extends the existing extension for playlist-specific video management

class PlaylistVisibilityEditor {
    constructor() {
        this.isPlaylistPage = false;
        this.videoRows = [];
        this.currentHoveredRow = null;
        this.overlay = null;
        this.keyHandler = null;
        this.scrollPosition = 0;
        
        // Batch processing queue
        this.processingQueue = [];
        this.isProcessing = false;
        this.batchResults = new Map();
        this.completedChanges = new Map(); // Track completed changes
        
        // Page refresh prevention
        this.originalBeforeUnload = null;
        this.originalPushState = null;
        this.originalReplaceState = null;
        this.pageState = null;
        
        // YouTube state tracking
        this.lastRefreshTime = Date.now();
        this.changesSinceRefresh = 0;
        this.maxChangesBeforeReset = 1; // YouTube's apparent limit
        
        this.init();
    }

    init() {
        // Check if we're on a playlist edit page
        if (!this.isPlaylistEditPage()) return;
        
        this.isPlaylistPage = true;
        console.log('🎵 Playlist Visibility Editor: Initializing...');
        
        // Wait for page content to load
        this.waitForContent().then(() => {
            this.setupPlaylistEnhancements();
            this.observeChanges();
        });
    }

    isPlaylistEditPage() {
        const url = window.location.href;
        return url.includes('/playlist/') && url.includes('/videos');
    }

    async waitForContent() {
        return new Promise((resolve) => {
            const checkContent = () => {
                const videoTable = document.querySelector('.video-table-content');
                const videoRows = document.querySelectorAll('ytcp-video-row');
                
                if (videoTable && videoRows.length > 0) {
                    resolve();
                } else {
                    setTimeout(checkContent, 100);
                }
            };
            checkContent();
        });
    }

    setupPlaylistEnhancements() {
        this.createOverlay();
        this.createManualSaveButton();
        this.attachEventListeners();
        this.enhanceVideoRows();
        this.monitorPageRefreshes();
        console.log('✅ Playlist enhancements ready');
    }
    
    createManualSaveButton() {
        // Create floating save button
        this.saveButton = document.createElement('div');
        this.saveButton.id = 'ysve-manual-save';
        this.saveButton.innerHTML = `
            <div class="ysve-save-content">
                <div class="ysve-save-icon">💾</div>
                <div class="ysve-save-text">Save All Changes</div>
                <div class="ysve-save-count">0 pending</div>
            </div>
        `;
        
        this.saveButton.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: rgba(33, 150, 243, 0.95);
            color: white;
            padding: 16px;
            border-radius: 12px;
            cursor: pointer;
            z-index: 10001;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255,255,255,0.2);
            transition: all 0.3s ease;
            display: none;
            min-width: 160px;
        `;
        
        this.saveButton.addEventListener('click', () => {
            this.processAllPendingChanges();
        });
        
        this.saveButton.addEventListener('mouseenter', () => {
            this.saveButton.style.transform = 'scale(1.05)';
            this.saveButton.style.background = 'rgba(33, 150, 243, 1)';
        });
        
        this.saveButton.addEventListener('mouseleave', () => {
            this.saveButton.style.transform = 'scale(1)';
            this.saveButton.style.background = 'rgba(33, 150, 243, 0.95)';
        });
        
        document.body.appendChild(this.saveButton);
    }
    
    updateSaveButton() {
        if (!this.saveButton) return;
        
        const pendingCount = this.processingQueue.length + this.completedChanges.size;
        const countEl = this.saveButton.querySelector('.ysve-save-count');
        
        if (pendingCount > 0) {
            this.saveButton.style.display = 'block';
            countEl.textContent = `${pendingCount} pending`;
        } else {
            this.saveButton.style.display = 'none';
        }
    }
    
    monitorPageRefreshes() {
        // Detect when YouTube refreshes the page content
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                // Check if the video table was replaced (sign of refresh)
                if (mutation.type === 'childList') {
                    const addedNodes = Array.from(mutation.addedNodes);
                    const hasVideoTable = addedNodes.some(node => 
                        node.nodeType === 1 && 
                        (node.classList?.contains('video-table-content') ||
                         node.querySelector?.('.video-table-content'))
                    );
                    
                    if (hasVideoTable) {
                        console.log('🔄 Page refresh detected!');
                        this.handlePageRefresh();
                    }
                }
            });
        });
        
        observer.observe(document.body, { 
            childList: true, 
            subtree: true 
        });
    }
    
    handlePageRefresh() {
        // Reset state after page refresh
        this.lastRefreshTime = Date.now();
        this.changesSinceRefresh = 0;
        
        // Re-enhance new video rows
        setTimeout(() => {
            this.enhanceVideoRows();
            this.restorePendingStates();
        }, 500);
    }
    
    restorePendingStates() {
        // Restore visual states for pending changes
        this.completedChanges.forEach((visibility, videoId) => {
            const row = this.findRowByVideoId(videoId);
            if (row) {
                this.showCompletedState(row, visibility);
            }
        });
    }
    
    findRowByVideoId(videoId) {
        const videoRows = document.querySelectorAll('ytcp-video-row');
        for (const row of videoRows) {
            if (this.getVideoId(row) === videoId) {
                return row;
            }
        }
        return null;
    }

    createOverlay() {
        // Create hover overlay for hotkey hints
        this.overlay = document.createElement('div');
        this.overlay.id = 'ysve-playlist-overlay';
        this.overlay.innerHTML = `
            <div class="ysve-hotkey-hints">
                <div class="ysve-hint" data-key="1">
                    <span class="ysve-key">1</span>
                    <span class="ysve-label">Private</span>
                    <span class="ysve-icon">🔒</span>
                </div>
                <div class="ysve-hint" data-key="2">
                    <span class="ysve-key">2</span>
                    <span class="ysve-label">Unlisted</span>
                    <span class="ysve-icon">🔗</span>
                </div>
                <div class="ysve-hint" data-key="3">
                    <span class="ysve-key">3</span>
                    <span class="ysve-label">Public</span>
                    <span class="ysve-icon">🌍</span>
                </div>
            </div>
            <div class="ysve-current-status"></div>
        `;
        
        document.body.appendChild(this.overlay);
    }

    attachEventListeners() {
        // Keyboard shortcuts
        this.keyHandler = (e) => {
            if (!this.currentHoveredRow) return;
            
            const key = e.key;
            if (['1', '2', '3'].includes(key)) {
                e.preventDefault();
                e.stopPropagation();
                
                const visibilityMap = {
                    '1': 'PRIVATE',
                    '2': 'UNLISTED', 
                    '3': 'PUBLIC'
                };
                
                this.changeVideoVisibility(this.currentHoveredRow, visibilityMap[key]);
            }
        };
        
        document.addEventListener('keydown', this.keyHandler, true);
        
        // Global mouse leave to hide overlay
        document.addEventListener('mouseleave', () => {
            this.hideOverlay();
        });
    }

    enhanceVideoRows() {
        const videoRows = document.querySelectorAll('ytcp-video-row');
        
        videoRows.forEach(row => {
            this.enhanceVideoRow(row);
        });
    }

    enhanceVideoRow(row) {
        // Add hover detection
        row.addEventListener('mouseenter', (e) => {
            this.currentHoveredRow = row;
            this.showOverlay(row);
        });
        
        row.addEventListener('mouseleave', (e) => {
            // Small delay to prevent flickering when moving between elements
            setTimeout(() => {
                if (this.currentHoveredRow === row) {
                    this.currentHoveredRow = null;
                    this.hideOverlay();
                }
            }, 100);
        });
        
        // Add visual enhancement
        row.classList.add('ysve-enhanced-row');
    }

    showOverlay(row) {
        if (!this.overlay) return;
        
        const rect = row.getBoundingClientRect();
        const visibilityCell = row.querySelector('.tablecell-visibility');
        const currentVisibility = this.getCurrentVisibility(row);
        
        // Position overlay
        this.overlay.style.display = 'block';
        this.overlay.style.left = `${rect.right - 200}px`;
        this.overlay.style.top = `${rect.top + window.scrollY}px`;
        
        // Update current status
        const statusEl = this.overlay.querySelector('.ysve-current-status');
        statusEl.textContent = `Current: ${currentVisibility}`;
        statusEl.className = `ysve-current-status ysve-status-${currentVisibility.toLowerCase()}`;
        
        // Highlight corresponding hint
        this.overlay.querySelectorAll('.ysve-hint').forEach(hint => {
            hint.classList.remove('ysve-active');
        });
        
        const visibilityKeyMap = {
            'PRIVATE': '1',
            'UNLISTED': '2', 
            'PUBLIC': '3'
        };
        
        const activeKey = visibilityKeyMap[currentVisibility];
        if (activeKey) {
            const activeHint = this.overlay.querySelector(`[data-key="${activeKey}"]`);
            if (activeHint) activeHint.classList.add('ysve-active');
        }
    }

    hideOverlay() {
        if (this.overlay) {
            this.overlay.style.display = 'none';
        }
    }

    getCurrentVisibility(row) {
        const visibilityCell = row.querySelector('.tablecell-visibility');
        if (!visibilityCell) return 'UNKNOWN';
        
        // Check icon classes to determine current visibility
        if (visibilityCell.querySelector('.privacy-public-icon')) return 'PUBLIC';
        if (visibilityCell.querySelector('.lock-icon')) return 'PRIVATE';
        if (visibilityCell.querySelector('.link-icon')) return 'UNLISTED';
        
        return 'UNKNOWN';
    }

    getVideoId(row) {
        const editLink = row.querySelector('a[href*="/video/"][href*="/edit"]');
        if (!editLink) return null;
        
        const href = editLink.href;
        const match = href.match(/\/video\/([^\/]+)\/edit/);
        return match ? match[1] : null;
    }

    async changeVideoVisibility(row, newVisibility) {
        const videoId = this.getVideoId(row);
        if (!videoId) {
            console.error('Could not extract video ID');
            return;
        }
        
        const currentVisibility = this.getCurrentVisibility(row);
        if (currentVisibility === newVisibility) {
            console.log(`Video ${videoId} already ${newVisibility}`);
            return;
        }
        
        console.log(`🎬 Queuing ${videoId}: ${currentVisibility} → ${newVisibility}`);
        
        // Add to processing queue instead of immediate processing
        this.queueVisibilityChange(row, videoId, newVisibility);
    }
    
    queueVisibilityChange(row, videoId, newVisibility) {
        // Check if this video is already queued or processing
        const existingIndex = this.processingQueue.findIndex(item => item.videoId === videoId);
        if (existingIndex !== -1) {
            // Update existing queue item
            this.processingQueue[existingIndex].newVisibility = newVisibility;
            console.log(`Updated queue item for ${videoId}: ${newVisibility}`);
            this.updateSaveButton();
            return;
        }
        
        // Check if YouTube's change limit is reached
        if (this.changesSinceRefresh >= this.maxChangesBeforeReset) {
            console.log(`⚠️ YouTube change limit reached (${this.changesSinceRefresh}). Storing for manual save.`);
            this.completedChanges.set(videoId, newVisibility);
            this.showCompletedState(row, newVisibility);
            this.updateSaveButton();
            return;
        }
        
        // Add to queue for immediate processing
        this.processingQueue.push({
            row,
            videoId,
            newVisibility,
            timestamp: Date.now()
        });
        
        console.log(`Queued ${videoId} for ${newVisibility}. Queue size: ${this.processingQueue.length}`);
        
        // Show queued state
        this.showQueuedState(row);
        this.updateSaveButton();
        
        // Start processing immediately for first change after refresh
        if (!this.isProcessing && this.changesSinceRefresh === 0) {
            setTimeout(() => {
                if (!this.isProcessing && this.processingQueue.length > 0) {
                    this.processBatch();
                }
            }, 500); // Shorter delay for immediate changes
        }
    }
    
    async processQueueItem(item) {
        const { row, videoId, newVisibility } = item;
        
        this.showLoadingState(row);
        
        try {
            // Use UI method (more reliable than API for now)
            await this.preventRefreshUIMethod(row, newVisibility);
            this.changesSinceRefresh++;
            
            // If this was the last allowed change, store future changes
            if (this.changesSinceRefresh >= this.maxChangesBeforeReset) {
                console.log(`⚠️ Reached YouTube's change limit. Future changes will be stored.`);
            }
            
        } catch (error) {
            throw error;
        }
    }
    
    showCompletedState(row, newVisibility) {
        const visibilityCell = row.querySelector('.tablecell-visibility');
        if (visibilityCell) {
            // Clear existing indicators
            const existingIndicator = visibilityCell.querySelector('.ysve-queue-indicator');
            if (existingIndicator) {
                existingIndicator.remove();
            }
            
            visibilityCell.style.opacity = '0.8';
            visibilityCell.style.borderLeft = '3px solid #9C27B0'; // Purple for completed
            visibilityCell.style.position = 'relative';
            
            // Add completed indicator
            const completedIndicator = document.createElement('div');
            completedIndicator.className = 'ysve-queue-indicator';
            completedIndicator.innerHTML = '📋';
            completedIndicator.style.cssText = `
                position: absolute;
                top: 2px;
                right: 2px;
                fontSize: 12px;
                background: rgba(156, 39, 176, 0.8);
                color: white;
                border-radius: 50%;
                width: 16px;
                height: 16px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 10px;
            `;
            
            visibilityCell.appendChild(completedIndicator);
        }
    }
    
    async processAllPendingChanges() {
        if (this.completedChanges.size === 0 && this.processingQueue.length === 0) {
            console.log('No pending changes to process');
            return;
        }
        
        console.log(`🚀 Processing ${this.completedChanges.size + this.processingQueue.length} pending changes...`);
        
        // Show processing state on save button
        const saveText = this.saveButton.querySelector('.ysve-save-text');
        const originalText = saveText.textContent;
        saveText.textContent = 'Processing...';
        this.saveButton.style.pointerEvents = 'none';
        this.saveButton.style.opacity = '0.7';
        
        try {
            // Process completed changes first (need to trigger UI)
            const completedEntries = Array.from(this.completedChanges.entries());
            for (const [videoId, newVisibility] of completedEntries) {
                const row = this.findRowByVideoId(videoId);
                if (row) {
                    console.log(`Processing completed change: ${videoId} -> ${newVisibility}`);
                    await this.processCompletedChange(row, videoId, newVisibility);
                    await this.delay(1000); // Longer delay for completed changes
                }
            }
            
            // Process any remaining queue items
            if (this.processingQueue.length > 0) {
                await this.processBatch();
            }
            
            // Clear completed changes
            this.completedChanges.clear();
            
            // Show success
            saveText.textContent = 'All Saved!';
            setTimeout(() => {
                this.updateSaveButton();
                saveText.textContent = originalText;
                this.saveButton.style.pointerEvents = 'auto';
                this.saveButton.style.opacity = '1';
            }, 2000);
            
        } catch (error) {
            console.error('Error processing pending changes:', error);
            saveText.textContent = 'Error - Try Again';
            this.saveButton.style.pointerEvents = 'auto';
            this.saveButton.style.opacity = '1';
        }
    }
    
    async processCompletedChange(row, videoId, newVisibility) {
        // For completed changes, we need to trigger the UI interaction
        try {
            await this.preventRefreshUIMethod(row, newVisibility);
            this.updateRowVisual(row, newVisibility);
        } catch (error) {
            console.error(`Failed to process completed change for ${videoId}:`, error);
            throw error;
        }
    }
    
    async processBatch() {
        if (this.processingQueue.length === 0) {
            this.isProcessing = false;
            return;
        }

        this.isProcessing = true;
        console.log(`🚀 Processing batch of ${this.processingQueue.length} videos`);
        
        // Create a copy of the queue to process
        const queueToProcess = [...this.processingQueue];
        this.processingQueue = []; // Clear the queue immediately
        
        // Prevent page refresh during entire batch
        this.blockPageRefresh();
        
        // Process all items in the batch
        for (let i = 0; i < queueToProcess.length; i++) {
            const item = queueToProcess[i];
            
            try {
                console.log(`Processing ${i + 1}/${queueToProcess.length}: ${item.videoId}`);
                await this.processQueueItem(item);
                this.batchResults.set(item.videoId, { success: true, newVisibility: item.newVisibility });
                
                // Longer delay between operations to prevent YouTube throttling
                if (i < queueToProcess.length - 1) { // Don't delay after last item
                    await this.delay(800); // Increased from 200ms to 800ms
                }
                
            } catch (error) {
                console.error(`Failed to process ${item.videoId}:`, error);
                this.batchResults.set(item.videoId, { success: false, error: error.message });
                this.showErrorState(item.row);
            }
        }
        
        // Restore page behavior
        this.unblockPageRefresh();
        
        // Only show batch summary if we actually processed multiple items
        if (queueToProcess.length > 0) {
            this.showBatchSummary();
        }
        
        // Check if there are new items in queue (added during processing)
        if (this.processingQueue.length > 0) {
            console.log('🔄 More items queued during processing, continuing...');
            setTimeout(() => this.processBatch(), 1000); // Restart with delay
        } else {
            this.isProcessing = false;
            console.log('✅ All batches complete');
        }
    }
    
    async processQueueItem(item) {
        const { row, videoId, newVisibility } = item;
        
        this.showLoadingState(row);
        
        try {
            // Try direct API first
            const success = await this.directAPICall(videoId, newVisibility);
            if (success) {
                this.updateRowVisual(row, newVisibility);
                return;
            }
        } catch (error) {
            console.log('Direct API failed, using UI method');
        }
        
        // Fallback to UI method
        await this.preventRefreshUIMethod(row, newVisibility);
    }
    
    showQueuedState(row) {
        const visibilityCell = row.querySelector('.tablecell-visibility');
        if (visibilityCell) {
            // Clear any existing indicators
            const existingIndicator = visibilityCell.querySelector('.ysve-queue-indicator');
            if (existingIndicator) {
                existingIndicator.remove();
            }
            
            visibilityCell.style.opacity = '0.7';
            visibilityCell.style.borderLeft = '3px solid #2196F3';
            visibilityCell.style.position = 'relative';
            
            // Add queue indicator
            const queueIndicator = document.createElement('div');
            queueIndicator.className = 'ysve-queue-indicator';
            queueIndicator.innerHTML = '⏳';
            queueIndicator.style.cssText = `
                position: absolute;
                top: 2px;
                right: 2px;
                fontSize: 12px;
                background: rgba(33, 150, 243, 0.8);
                color: white;
                border-radius: 50%;
                width: 16px;
                height: 16px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 10px;
            `;
            
            visibilityCell.appendChild(queueIndicator);
        }
    }
    
    showLoadingState(row) {
        const visibilityCell = row.querySelector('.tablecell-visibility');
        if (visibilityCell) {
            // Update existing queue indicator to loading state
            const queueIndicator = visibilityCell.querySelector('.ysve-queue-indicator');
            if (queueIndicator) {
                queueIndicator.innerHTML = '🔄';
                queueIndicator.style.background = 'rgba(255, 152, 0, 0.8)';
            }
            
            visibilityCell.style.opacity = '0.5';
            visibilityCell.style.borderLeft = '3px solid #FF9800';
            visibilityCell.style.pointerEvents = 'none';
        }
    }
    
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    showBatchSummary() {
        const successful = Array.from(this.batchResults.values()).filter(r => r.success).length;
        const failed = this.batchResults.size - successful;
        
        // Create temporary notification
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: rgba(0,0,0,0.9);
            color: white;
            padding: 16px;
            border-radius: 8px;
            z-index: 10001;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        `;
        
        notification.innerHTML = `
            <div style="font-weight: 600; margin-bottom: 8px;">Batch Complete!</div>
            <div>✅ ${successful} videos updated</div>
            ${failed > 0 ? `<div>❌ ${failed} failed</div>` : ''}
        `;
        
        document.body.appendChild(notification);
        
        // Remove after 3 seconds
        setTimeout(() => {
            notification.remove();
            this.batchResults.clear();
        }, 3000);
    }

    async triggerVisibilityChange(row, newVisibility) {
        return new Promise(async (resolve, reject) => {
            const videoId = this.getVideoId(row);
            
            try {
                // Method 1: Try direct API approach (bypass UI completely)
                const success = await this.directAPICall(videoId, newVisibility);
                if (success) {
                    console.log(`✅ Direct API success for ${videoId}`);
                    this.updateRowVisual(row, newVisibility);
                    resolve();
                    return;
                }
            } catch (error) {
                console.log('Direct API failed, trying UI method:', error.message);
            }
            
            // Method 2: Enhanced UI approach with refresh prevention
            try {
                await this.preventRefreshUIMethod(row, newVisibility);
                resolve();
            } catch (error) {
                reject(error);
            }
        });
    }
    
    async directAPICall(videoId, newVisibility) {
        // Attempt to intercept and use YouTube's internal API
        try {
            // Find YouTube's internal session token
            const sessionToken = this.extractSessionToken();
            if (!sessionToken) throw new Error('No session token found');
            
            // Use YouTube's internal API endpoint
            const response = await fetch('/youtubei/v1/creator/update_video', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-YouTube-Client-Name': '62',
                    'X-YouTube-Client-Version': '1.0'
                },
                body: JSON.stringify({
                    context: {
                        client: {
                            clientName: 'WEB_CREATOR',
                            clientVersion: '1.0'
                        }
                    },
                    videoId: videoId,
                    update: {
                        privacy: {
                            newPrivacy: newVisibility
                        }
                    },
                    sessionToken: sessionToken
                })
            });
            
            return response.ok;
        } catch (error) {
            throw new Error(`API call failed: ${error.message}`);
        }
    }
    
    extractSessionToken() {
        // Extract YouTube's session token from page
        const scripts = document.querySelectorAll('script');
        for (let script of scripts) {
            if (script.textContent.includes('XSRF_TOKEN') || script.textContent.includes('SESSION_INDEX')) {
                const match = script.textContent.match(/"XSRF_TOKEN":"([^"]+)"/);
                if (match) return match[1];
            }
        }
        
        // Try alternative methods
        const metaToken = document.querySelector('meta[name="csrf-token"]');
        if (metaToken) return metaToken.content;
        
        return null;
    }
    
    async preventRefreshUIMethod(row, newVisibility) {
        return new Promise((resolve, reject) => {
            const dropdownTrigger = row.querySelector('.edit-triangle-icon');
            if (!dropdownTrigger) {
                reject(new Error('Dropdown trigger not found'));
                return;
            }
            
            console.log(`🎬 Opening UI for visibility change: ${newVisibility}`);
            
            // Open dropdown with careful timing
            dropdownTrigger.click();
            
            setTimeout(() => {
                const visibilityModal = document.querySelector('ytcp-video-visibility-select');
                if (!visibilityModal) {
                    reject(new Error('Visibility modal not found'));
                    return;
                }
                
                console.log(`📋 Modal found, looking for ${newVisibility} radio button`);
                
                const radioButton = visibilityModal.querySelector(`tp-yt-paper-radio-button[name="${newVisibility}"]`);
                if (!radioButton) {
                    reject(new Error(`Radio button for ${newVisibility} not found`));
                    return;
                }
                
                // Click the radio button
                radioButton.click();
                console.log(`✓ Clicked ${newVisibility} radio button`);
                
                setTimeout(() => {
                    // Look for save button more aggressively
                    const saveButton = this.findSaveButtonAdvanced();
                    
                    if (saveButton) {
                        console.log('💾 Save button found, intercepting...');
                        
                        // ENHANCED: Intercept ALL possible save mechanisms
                        this.interceptAllSaveActions(visibilityModal, () => {
                            console.log(`✅ Visibility changed to ${newVisibility}`);
                            this.updateRowVisual(row, newVisibility);
                            resolve();
                        });
                        
                        // Click save button
                        saveButton.click();
                    } else {
                        console.error('❌ Save button not found');
                        reject(new Error('Save button not found'));
                    }
                }, 300); // Increased timeout
            }, 500); // Increased timeout for modal
        });
    }
    
    findSaveButtonAdvanced() {
        // Extended search for save buttons
        const selectors = [
            'ytcp-button[aria-label*="Save"]',
            'ytcp-button[aria-label*="Confirm"]',
            'button[aria-label*="Save"]',
            'button[aria-label*="Confirm"]',
            '[data-ve-type="88287"]',
            '.ytcp-button--primary',
            'ytcp-button[type="submit"]',
            'button[type="submit"]',
            'div[role="button"]:has-text("Save")',
            'div[role="button"]:has-text("Confirm")',
            // YouTube-specific patterns
            'ytcp-button.style-primary',
            'ytcp-button[class*="primary"]',
            'button[class*="primary"]',
            '.ytcp-video-visibility-select button',
            '.ytcp-video-visibility-select ytcp-button'
        ];
        
        for (const selector of selectors) {
            try {
                const elements = document.querySelectorAll(selector);
                for (const element of elements) {
                    // Check if button is visible and likely a save button
                    if (element.offsetParent !== null && 
                        (element.textContent.toLowerCase().includes('save') ||
                         element.textContent.toLowerCase().includes('confirm') ||
                         element.getAttribute('aria-label')?.toLowerCase().includes('save'))) {
                        console.log(`Found save button with selector: ${selector}`);
                        return element;
                    }
                }
            } catch (e) {
                // Some selectors might fail, continue
            }
        }
        
        // If no specific save button found, look for the most likely candidate
        const allButtons = document.querySelectorAll('button, ytcp-button, div[role="button"]');
        for (const button of allButtons) {
            const text = button.textContent?.toLowerCase() || '';
            const ariaLabel = button.getAttribute('aria-label')?.toLowerCase() || '';
            
            if (button.offsetParent !== null && 
                (text.includes('save') || text.includes('confirm') || 
                 ariaLabel.includes('save') || ariaLabel.includes('confirm'))) {
                console.log(`Found save button by text/aria-label: ${text || ariaLabel}`);
                return button;
            }
        }
        
        return null;
    }
    
    interceptAllSaveActions(modal, callback) {
        // Method 1: Intercept form submissions
        const forms = modal.querySelectorAll('form');
        forms.forEach(form => {
            const originalSubmit = form.onsubmit;
            form.onsubmit = (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('🛑 Intercepted form submission');
                setTimeout(callback, 100);
                return false;
            };
        });
        
        // Method 2: Watch for modal disappearance (sign of successful save)
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.removedNodes.forEach((node) => {
                    if (node === modal || (node.nodeType === 1 && node.contains && node.contains(modal))) {
                        console.log('🚪 Modal disappeared - save successful');
                        observer.disconnect();
                        setTimeout(callback, 100);
                    }
                });
            });
        });
        
        observer.observe(document.body, { childList: true, subtree: true });
        
        // Method 3: Timeout fallback
        setTimeout(() => {
            observer.disconnect();
            // Check if modal is still visible
            if (!document.body.contains(modal) || modal.style.display === 'none') {
                console.log('⏰ Modal closed by timeout - assuming success');
                callback();
            }
        }, 3000);
    }
    
    blockPageRefresh() {
        // Prevent page refresh/navigation during batch operations
        this.originalBeforeUnload = window.onbeforeunload;
        this.originalPushState = history.pushState;
        this.originalReplaceState = history.replaceState;
        
        // Block navigation
        window.onbeforeunload = (e) => {
            e.preventDefault();
            return false;
        };
        
        // Intercept history changes
        history.pushState = () => {};
        history.replaceState = () => {};
        
        // Block form submissions that might cause refresh
        document.addEventListener('submit', this.preventSubmit, true);
    }
    
    unblockPageRefresh() {
        // Restore normal page behavior
        window.onbeforeunload = this.originalBeforeUnload;
        history.pushState = this.originalPushState;
        history.replaceState = this.originalReplaceState;
        
        document.removeEventListener('submit', this.preventSubmit, true);
    }
    
    preventSubmit = (e) => {
        // Only prevent form submissions that aren't our controlled ones
        if (!e.target.closest('.ysve-controlled-form')) {
            e.preventDefault();
            e.stopPropagation();
            return false;
        }
    }
    
    storeCurrentPageState() {
        // Store current video states to restore after refresh
        this.pageState = {
            videos: [],
            scrollY: window.scrollY
        };
        
        document.querySelectorAll('ytcp-video-row').forEach(row => {
            const videoId = this.getVideoId(row);
            const visibility = this.getCurrentVisibility(row);
            
            if (videoId) {
                this.pageState.videos.push({ videoId, visibility });
            }
        });
    }
    
    findSaveButton() {
        const selectors = [
            'ytcp-button[aria-label*="Save"]',
            'ytcp-button[aria-label*="Confirm"]',
            'button[aria-label*="Save"]',
            'button[aria-label*="Confirm"]',
            '[data-ve-type="88287"]',
            '.ytcp-button--primary',
            'ytcp-button[type="submit"]',
            '[role="button"]:has(span:contains("Save"))',
            'div[role="button"]:has(span:contains("Save"))'
        ];
        
        for (const selector of selectors) {
            const button = document.querySelector(selector);
            if (button && button.offsetParent !== null) { // visible
                return button;
            }
        }
        
        return null;
    }
    
    interceptSaveAction(saveButton, callback) {
        // Clone the button to remove all existing event listeners
        const newButton = saveButton.cloneNode(true);
        saveButton.parentNode.replaceChild(newButton, saveButton);
        
        // Add our controlled click handler
        newButton.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            // Close the modal without refreshing
            const modal = document.querySelector('ytcp-video-visibility-select');
            if (modal) {
                modal.style.display = 'none';
                modal.remove();
            }
            
            // Execute callback immediately
            setTimeout(callback, 100);
        }, { once: true });
        
        // Click the new button
        newButton.click();
    }

    showLoadingState(row) {
        const visibilityCell = row.querySelector('.tablecell-visibility');
        if (visibilityCell) {
            visibilityCell.style.opacity = '0.5';
            visibilityCell.style.pointerEvents = 'none';
        }
    }

    showErrorState(row) {
        const visibilityCell = row.querySelector('.tablecell-visibility');
        if (visibilityCell) {
            visibilityCell.style.opacity = '1';
            visibilityCell.style.pointerEvents = 'auto';
            visibilityCell.style.borderLeft = '3px solid #ff4444';
            
            // Remove error border after 3 seconds
            setTimeout(() => {
                visibilityCell.style.borderLeft = '';
            }, 3000);
        }
    }

    updateRowVisual(row, newVisibility) {
        const visibilityCell = row.querySelector('.tablecell-visibility');
        if (!visibilityCell) return;
        
        // Clear all processing states
        const queueIndicator = visibilityCell.querySelector('.ysve-queue-indicator');
        if (queueIndicator) {
            queueIndicator.remove();
        }
        
        // Reset styles
        visibilityCell.style.opacity = '1';
        visibilityCell.style.pointerEvents = 'auto';
        visibilityCell.style.borderLeft = '';
        
        // Show success indicator temporarily
        visibilityCell.style.borderLeft = '3px solid #4CAF50';
        visibilityCell.style.background = 'rgba(76, 175, 80, 0.1)';
        
        // Add success checkmark
        const successIndicator = document.createElement('div');
        successIndicator.innerHTML = '✅';
        successIndicator.style.cssText = `
            position: absolute;
            top: 2px;
            right: 2px;
            font-size: 12px;
            background: rgba(76, 175, 80, 0.8);
            color: white;
            border-radius: 50%;
            width: 16px;
            height: 16px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 10px;
        `;
        
        visibilityCell.appendChild(successIndicator);
        
        // Remove success indicators after 2 seconds
        setTimeout(() => {
            visibilityCell.style.borderLeft = '';
            visibilityCell.style.background = '';
            if (successIndicator.parentNode) {
                successIndicator.remove();
            }
        }, 2000);
        
        console.log(`✅ Visual updated for ${newVisibility}`);
    }

    observeChanges() {
        // Watch for new video rows being added (pagination, etc.)
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === 1) { // Element node
                        if (node.matches && node.matches('ytcp-video-row')) {
                            this.enhanceVideoRow(node);
                        } else if (node.querySelector) {
                            const newRows = node.querySelectorAll('ytcp-video-row');
                            newRows.forEach(row => this.enhanceVideoRow(row));
                        }
                    }
                });
            });
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    destroy() {
        if (this.keyHandler) {
            document.removeEventListener('keydown', this.keyHandler, true);
        }
        
        if (this.overlay) {
            this.overlay.remove();
        }
        
        // Remove enhanced classes
        document.querySelectorAll('.ysve-enhanced-row').forEach(row => {
            row.classList.remove('ysve-enhanced-row');
        });
    }
}

// Initialize playlist editor when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new PlaylistVisibilityEditor();
    });
} else {
    new PlaylistVisibilityEditor();
}

// Also listen for navigation changes (SPA routing)
let lastUrl = location.href;
new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
        lastUrl = url;
        // Small delay to allow page to load
        setTimeout(() => {
            new PlaylistVisibilityEditor();
        }, 1000);
    }
}).observe(document, { subtree: true, childList: true });