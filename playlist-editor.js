// playlist-editor.js - YouTube Studio Playlist Batch Editor
// Fixed version - stable core with enhanced save detection

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
        this.completedChanges = new Map();
        
        // Smart position caching
        this.videoPositions = new Map(); // videoId -> { scrollY, rowRect }
        
        // YouTube state tracking
        this.changesSinceRefresh = 0;
        this.maxChangesBeforeReset = 1;
        
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
        console.log('✅ Playlist enhancements ready');
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

    createManualSaveButton() {
        // Create floating save button
        this.saveButton = document.createElement('div');
        this.saveButton.id = 'ysve-manual-save';
        this.saveButton.innerHTML = `
            <div class="ysve-save-content">
                <div class="ysve-save-icon">💾</div>
                <div class="ysve-save-text">Save All Changes</div>
                <div class="ysve-save-count">0 pending</div>
                <div class="ysve-progress-bar" style="display: none;">
                    <div class="ysve-progress-fill"></div>
                </div>
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
        
        // Add progress bar styles
        const progressBarStyle = document.createElement('style');
        progressBarStyle.textContent = `
            .ysve-progress-bar {
                width: 100%;
                height: 4px;
                background: rgba(255,255,255,0.2);
                border-radius: 2px;
                margin-top: 8px;
                overflow: hidden;
            }
            .ysve-progress-fill {
                height: 100%;
                background: rgba(255,255,255,0.8);
                border-radius: 2px;
                transition: width 0.3s ease;
                width: 0%;
            }
        `;
        document.head.appendChild(progressBarStyle);
        
        this.saveButton.addEventListener('click', () => {
            this.processAllPendingChanges();
        });
        
        document.body.appendChild(this.saveButton);
    }
    
    updateProgress(current, total) {
        const progressBar = this.saveButton.querySelector('.ysve-progress-bar');
        const progressFill = this.saveButton.querySelector('.ysve-progress-fill');
        
        if (total > 0) {
            progressBar.style.display = 'block';
            const percentage = (current / total) * 100;
            progressFill.style.width = `${percentage}%`;
        } else {
            progressBar.style.display = 'none';
        }
    }

    updateSaveButton() {
        if (!this.saveButton) return;
        
        const pendingCount = this.processingQueue.length + this.completedChanges.size;
        const countEl = this.saveButton.querySelector('.ysve-save-count');
        
        if (pendingCount > 0) {
            this.saveButton.style.display = 'block';
            countEl.textContent = `${pendingCount} pending`;
            
            // Show cached positions info
            const cachedCount = this.videoPositions.size;
            if (cachedCount > 0) {
                countEl.textContent = `${pendingCount} pending (${cachedCount} cached)`;
            }
        } else {
            this.saveButton.style.display = 'none';
            
            // Clean up old cached positions when no pending changes
            this.cleanupOldCachedPositions();
        }
    }
    
    cleanupOldCachedPositions() {
        // Remove cached positions older than 5 minutes
        const maxAge = 5 * 60 * 1000; // 5 minutes
        const now = Date.now();
        
        for (const [videoId, position] of this.videoPositions.entries()) {
            if (now - position.timestamp > maxAge) {
                console.log(`🧹 Cleaning up old cached position for ${videoId}`);
                this.videoPositions.delete(videoId);
            }
        }
    }
    
    // Enhanced position caching for better accuracy
    cacheVideoPosition(videoId, row) {
        try {
            const rect = row.getBoundingClientRect();
            const scrollY = window.scrollY;
            
            // Calculate more precise positioning data
            const viewportHeight = window.innerHeight;
            const documentHeight = document.documentElement.scrollHeight;
            const scrollPercentage = scrollY / (documentHeight - viewportHeight);
            
            // Store comprehensive position info
            this.videoPositions.set(videoId, {
                scrollY: scrollY,
                relativeTop: rect.top,
                rowHeight: rect.height,
                scrollPercentage: scrollPercentage,
                viewportHeight: viewportHeight,
                timestamp: Date.now(),
                // Store some context for validation
                rowIndex: this.getApproximateRowIndex(row)
            });
            
            console.log(`📍 Cached enhanced position for ${videoId}: scroll=${scrollY} (${Math.round(scrollPercentage * 100)}%)`);
            
        } catch (error) {
            console.warn(`Failed to cache position for ${videoId}:`, error);
        }
    }
    
    getApproximateRowIndex(row) {
        // Get approximate row position for validation
        const allRows = document.querySelectorAll('ytcp-video-row');
        return Array.from(allRows).indexOf(row);
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

    changeVideoVisibility(row, newVisibility) {
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
        
        // Cache the current position when marking the video
        this.cacheVideoPosition(videoId, row);
        
        // Check if YouTube's change limit is reached OR if we're already processing
        if (this.changesSinceRefresh >= this.maxChangesBeforeReset || this.isProcessing) {
            console.log(`⚠️ YouTube change limit reached or currently processing. Storing for manual save.`);
            this.completedChanges.set(videoId, newVisibility);
            this.showCompletedState(row, newVisibility);
            this.updateSaveButton();
            return;
        }
        
        // Process immediately for first change
        this.queueVisibilityChange(row, videoId, newVisibility);
    }
    
    cacheVideoPosition(videoId, row) {
        try {
            const rect = row.getBoundingClientRect();
            const scrollY = window.scrollY;
            
            // Store both scroll position and relative position info
            this.videoPositions.set(videoId, {
                scrollY: scrollY,
                relativeTop: rect.top,
                rowHeight: rect.height,
                timestamp: Date.now()
            });
            
            console.log(`📍 Cached position for ${videoId}: scroll=${scrollY}, top=${rect.top}`);
            
        } catch (error) {
            console.warn(`Failed to cache position for ${videoId}:`, error);
        }
    }

    queueVisibilityChange(row, videoId, newVisibility) {
        // Add to queue
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
        
        // Start processing immediately
        if (!this.isProcessing) {
            setTimeout(() => {
                if (!this.isProcessing && this.processingQueue.length > 0) {
                    this.processBatch();
                }
            }, 500);
        }
    }

    async processBatch() {
        if (this.processingQueue.length === 0) {
            this.isProcessing = false;
            return;
        }

        this.isProcessing = true;
        console.log(`🚀 Processing batch of ${this.processingQueue.length} videos`);
        
        // Process one item from queue
        const item = this.processingQueue.shift();
        
        try {
            await this.processQueueItem(item);
            this.batchResults.set(item.videoId, { success: true, newVisibility: item.newVisibility });
            this.changesSinceRefresh++;
            
        } catch (error) {
            console.error(`Failed to process ${item.videoId}:`, error);
            this.batchResults.set(item.videoId, { success: false, error: error.message });
            this.showErrorState(item.row);
        }
        
        this.isProcessing = false;
        this.updateSaveButton();
        
        // Show simple notification for single changes
        if (this.processingQueue.length === 0) {
            console.log('✅ Processing complete');
        }
    }

    async processQueueItem(item) {
        const { row, videoId, newVisibility } = item;
        
        this.showLoadingState(row);
        
        try {
            await this.triggerVisibilityChange(row, newVisibility);
            
        } catch (error) {
            throw error;
        }
    }

    async triggerVisibilityChange(row, newVisibility) {
        return new Promise((resolve, reject) => {
            // Verify row still exists and is valid
            if (!row || !document.body.contains(row)) {
                reject(new Error('Row no longer exists in DOM'));
                return;
            }
            
            const dropdownTrigger = row.querySelector('.edit-triangle-icon');
            if (!dropdownTrigger) {
                reject(new Error('Dropdown trigger not found'));
                return;
            }
            
            console.log(`🎬 Opening UI for visibility change: ${newVisibility}`);
            
            // Close any existing modals first
            this.closeAnyOpenModals();
            
            setTimeout(() => {
                // Click dropdown
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
                    
                    // Click radio button
                    radioButton.click();
                    console.log(`✓ Clicked ${newVisibility} radio button`);
                    
                    setTimeout(() => {
                        // Enhanced save button detection
                        const saveButton = this.findSaveButton();
                        
                        if (saveButton) {
                            console.log('💾 Save button found, clicking...');
                            
                            // Set up success detection
                            this.watchForModalClose(visibilityModal, () => {
                                console.log(`✅ Visibility changed to ${newVisibility}`);
                                this.updateRowVisual(row, newVisibility);
                                resolve();
                            });
                            
                            // Click save button
                            saveButton.click();
                            
                        } else {
                            console.log('❌ Save button not found, trying cancel and retry...');
                            
                            // Try to find and click cancel button
                            const cancelButton = visibilityModal.querySelector('[aria-label*="Cancel"], [aria-label*="Close"], .cancel-button');
                            if (cancelButton) {
                                console.log('🚫 Clicking cancel button');
                                cancelButton.click();
                                
                                setTimeout(() => {
                                    reject(new Error('Save button not found, cancelled modal'));
                                }, 300);
                            } else {
                                // Force close modal and reject
                                console.log('🔧 Force closing modal due to missing save button');
                                this.closeAnyOpenModals();
                                reject(new Error('Save button not found, no cancel option'));
                            }
                        }
                    }, 500); // Increased timeout for save button detection
                }, 700); // Increased timeout for modal appearance
            }, 200); // Small delay before opening dropdown
        });
    }

    findSaveButton() {
        const selectors = [
            'ytcp-button[aria-label*="Save"]',
            'ytcp-button[aria-label*="save" i]',
            'button[aria-label*="Save"]',
            'button[aria-label*="save" i]',
            'ytcp-button[aria-label*="Confirm"]',
            'button[aria-label*="Confirm"]',
            '[data-ve-type="88287"]',
            '.ytcp-button--primary',
            'ytcp-button[type="submit"]',
            'button[type="submit"]',
            '.ytcp-video-visibility-select button',
            '.ytcp-video-visibility-select ytcp-button'
        ];
        
        for (const selector of selectors) {
            try {
                const elements = document.querySelectorAll(selector);
                for (const element of elements) {
                    if (element.offsetParent !== null) {
                        const text = element.textContent?.toLowerCase() || '';
                        const ariaLabel = element.getAttribute('aria-label')?.toLowerCase() || '';
                        
                        if (text.includes('save') || text.includes('confirm') || 
                            ariaLabel.includes('save') || ariaLabel.includes('confirm') ||
                            element.className.includes('primary')) {
                            console.log(`Found save button: ${selector}`);
                            return element;
                        }
                    }
                }
            } catch (e) {
                // Continue
            }
        }
        
        // Last resort: any visible button in modal
        const modal = document.querySelector('ytcp-video-visibility-select');
        if (modal) {
            const buttons = modal.querySelectorAll('button, ytcp-button');
            for (const button of buttons) {
                if (button.offsetParent !== null) {
                    console.log('Using fallback button:', button);
                    return button;
                }
            }
        }
        
        return null;
    }

    watchForModalClose(modal, callback) {
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
        
        // Timeout fallback
        setTimeout(() => {
            observer.disconnect();
            if (!document.body.contains(modal) || modal.style.display === 'none') {
                console.log('⏰ Modal closed by timeout - assuming success');
                callback();
            }
        }, 3000);
    }

    showQueuedState(row) {
        const visibilityCell = row.querySelector('.tablecell-visibility');
        if (visibilityCell) {
            visibilityCell.style.opacity = '0.7';
            visibilityCell.style.borderLeft = '3px solid #2196F3';
        }
    }

    showLoadingState(row) {
        const visibilityCell = row.querySelector('.tablecell-visibility');
        if (visibilityCell) {
            visibilityCell.style.opacity = '0.5';
            visibilityCell.style.borderLeft = '3px solid #FF9800';
        }
    }

    showCompletedState(row, newVisibility) {
        const visibilityCell = row.querySelector('.tablecell-visibility');
        if (visibilityCell) {
            visibilityCell.style.opacity = '0.8';
            visibilityCell.style.borderLeft = '3px solid #9C27B0';
        }
    }

    showErrorState(row) {
        const visibilityCell = row.querySelector('.tablecell-visibility');
        if (visibilityCell) {
            visibilityCell.style.borderLeft = '3px solid #ff4444';
            setTimeout(() => {
                visibilityCell.style.borderLeft = '';
            }, 3000);
        }
    }

    updateRowVisual(row, newVisibility) {
        const visibilityCell = row.querySelector('.tablecell-visibility');
        if (!visibilityCell) return;
        
        // Reset styles
        visibilityCell.style.opacity = '1';
        visibilityCell.style.borderLeft = '3px solid #4CAF50';
        
        // Remove success indicator after 2 seconds
        setTimeout(() => {
            visibilityCell.style.borderLeft = '';
        }, 2000);
        
        console.log(`✅ Visual updated for ${newVisibility}`);
    }

    async processAllPendingChanges() {
        if (this.completedChanges.size === 0) {
            console.log('No pending changes to process');
            return;
        }
        
        console.log(`🚀 Processing ${this.completedChanges.size} pending changes...`);
        
        const saveText = this.saveButton.querySelector('.ysve-save-text');
        const originalText = saveText.textContent;
        saveText.textContent = 'Processing...';
        this.saveButton.style.pointerEvents = 'none';
        
        // Store original scroll position
        const originalScrollY = window.scrollY;
        
        // Convert to array to avoid modification during iteration
        const changesToProcess = Array.from(this.completedChanges.entries());
        let successCount = 0;
        let errorCount = 0;
        
        try {
            for (let i = 0; i < changesToProcess.length; i++) {
                const [videoId, newVisibility] = changesToProcess[i];
                
                console.log(`📋 Processing ${i + 1}/${changesToProcess.length}: ${videoId} → ${newVisibility}`);
                saveText.textContent = `Processing ${i + 1}/${changesToProcess.length}...`;
                this.updateProgress(i, changesToProcess.length);
                
                // Find row with auto-scroll if needed
                const row = await this.findRowByVideoIdWithScroll(videoId);
                if (!row) {
                    console.warn(`❌ Row not found for video ${videoId} even after scrolling, skipping`);
                    errorCount++;
                    continue;
                }
                
                try {
                    await this.triggerVisibilityChangeWithRetry(row, videoId, newVisibility);
                    successCount++;
                    console.log(`✅ Successfully processed ${videoId}`);
                    
                    // Update progress
                    this.updateProgress(i + 1, changesToProcess.length);
                    
                    // Longer delay between changes to let YouTube settle
                    if (i < changesToProcess.length - 1) {
                        await this.delay(2000);
                    }
                    
                } catch (error) {
                    console.error(`❌ Failed to process ${videoId}:`, error.message);
                    errorCount++;
                    
                    // Close any stuck modals before continuing
                    this.closeAnyOpenModals();
                    await this.delay(500);
                }
            }
            
            // Restore original scroll position
            window.scrollTo({
                top: originalScrollY,
                behavior: 'smooth'
            });
            
            // Clear completed changes
            this.completedChanges.clear();
            
            // Show results
            if (errorCount === 0) {
                saveText.textContent = `✅ All ${successCount} Saved!`;
            } else {
                saveText.textContent = `⚠️ ${successCount} saved, ${errorCount} failed`;
            }
            
            setTimeout(() => {
                this.updateSaveButton();
                saveText.textContent = originalText;
                this.saveButton.style.pointerEvents = 'auto';
            }, 3000);
            
        } catch (error) {
            console.error('Critical error in batch processing:', error);
            saveText.textContent = 'Error - Try Again';
            this.saveButton.style.pointerEvents = 'auto';
            
            // Restore scroll position on error too
            window.scrollTo({
                top: originalScrollY,
                behavior: 'smooth'
            });
        }
    }
    
    async findRowByVideoIdWithScroll(videoId) {
        // First, try to find the row without scrolling
        let row = this.findRowByVideoId(videoId);
        if (row) {
            console.log(`📍 Found ${videoId} without scrolling`);
            return row;
        }
        
        // Check if we have a cached position for this video
        const cachedPosition = this.videoPositions.get(videoId);
        if (cachedPosition) {
            console.log(`🎯 Using cached position for ${videoId}: scroll=${cachedPosition.scrollY}`);
            
            // Jump directly to the cached scroll position
            window.scrollTo({
                top: cachedPosition.scrollY,
                behavior: 'smooth'
            });
            
            // Wait for scroll to complete
            await this.delay(800);
            
            // Try to find the row again
            row = this.findRowByVideoId(videoId);
            if (row) {
                console.log(`✅ Found ${videoId} using cached position!`);
                
                // Fine-tune position to center the row
                row.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center'
                });
                
                await this.delay(300);
                return row;
            } else {
                console.log(`⚠️ Cached position didn't work for ${videoId}, falling back to search...`);
            }
        }
        
        console.log(`🔍 Video ${videoId} not found with cache, searching with scroll...`);
        
        // Fallback to the original search method
        return this.searchWithIncrementalScroll(videoId);
    }
    
    async searchWithIncrementalScroll(videoId) {
        // Get current scroll position
        const startScrollY = window.scrollY;
        const maxScrollAttempts = 10;
        const scrollStep = window.innerHeight * 0.8; // Scroll ~80% of viewport height
        
        for (let attempt = 0; attempt < maxScrollAttempts; attempt++) {
            // Scroll down to load more content
            const targetScrollY = startScrollY + (scrollStep * (attempt + 1));
            
            console.log(`📜 Scroll attempt ${attempt + 1}: scrolling to ${targetScrollY}`);
            
            window.scrollTo({
                top: targetScrollY,
                behavior: 'smooth'
            });
            
            // Wait for scroll to complete and content to load
            await this.delay(800);
            
            // Check if we've reached the bottom
            const isAtBottom = (window.innerHeight + window.scrollY) >= (document.body.scrollHeight - 100);
            
            // Try to find the row again
            const row = this.findRowByVideoId(videoId);
            if (row) {
                console.log(`✅ Found ${videoId} after scrolling (attempt ${attempt + 1})`);
                
                // Update the cached position with the correct one
                this.cacheVideoPosition(videoId, row);
                
                // Scroll the specific row into view for better interaction
                row.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center'
                });
                
                // Wait for scroll to complete
                await this.delay(500);
                
                return row;
            }
            
            // If we've reached the bottom and still haven't found it, give up
            if (isAtBottom) {
                console.log(`🔚 Reached bottom of page, video ${videoId} not found`);
                break;
            }
        }
        
        console.log(`❌ Could not find video ${videoId} after ${maxScrollAttempts} scroll attempts`);
        return null;
    }
    
    async triggerVisibilityChangeWithRetry(row, videoId, newVisibility, retryCount = 0) {
        const maxRetries = 2;
        
        try {
            await this.triggerVisibilityChange(row, newVisibility);
            
        } catch (error) {
            console.log(`Attempt ${retryCount + 1} failed for ${videoId}: ${error.message}`);
            
            if (retryCount < maxRetries) {
                console.log(`🔄 Retrying ${videoId} (${retryCount + 1}/${maxRetries})`);
                
                // Close any stuck modals
                this.closeAnyOpenModals();
                await this.delay(1000);
                
                // Get fresh row reference
                const freshRow = this.findRowByVideoId(videoId);
                if (freshRow) {
                    return this.triggerVisibilityChangeWithRetry(freshRow, videoId, newVisibility, retryCount + 1);
                } else {
                    throw new Error(`Row disappeared after retry for ${videoId}`);
                }
            } else {
                throw new Error(`Failed after ${maxRetries} retries: ${error.message}`);
            }
        }
    }
    
    closeAnyOpenModals() {
        // Close any visibility modals that might be stuck open
        const modals = document.querySelectorAll('ytcp-video-visibility-select');
        modals.forEach(modal => {
            try {
                // Try to find and click cancel/close button
                const cancelButton = modal.querySelector('[aria-label*="Cancel"], [aria-label*="Close"], .cancel-button');
                if (cancelButton) {
                    console.log('🚫 Clicking cancel button on stuck modal');
                    cancelButton.click();
                } else {
                    // Force close
                    console.log('🔧 Force closing stuck modal');
                    modal.style.display = 'none';
                    if (modal.parentNode) {
                        modal.parentNode.removeChild(modal);
                    }
                }
            } catch (e) {
                console.log('Error closing modal:', e);
            }
        });
        
        // Also close any generic dialogs
        const dialogs = document.querySelectorAll('[role="dialog"], .dialog, .modal');
        dialogs.forEach(dialog => {
            if (dialog.style.display !== 'none') {
                console.log('🚪 Closing dialog');
                dialog.style.display = 'none';
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

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    observeChanges() {
        // Watch for new video rows being added
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === 1) {
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
        
        if (this.saveButton) {
            this.saveButton.remove();
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