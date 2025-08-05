// bulk-tab-manager.js - Premium Bulk Tab Opening & Smart Click Management
// Integrates with existing playlist-editor.js architecture

class BulkTabManager {
    constructor() {
        this.isActive = false;
        this.smartClickMode = false;
        this.openTabs = new Set();
        this.tabDetails = new Map(); // Store tab info for smart closing
        this.originalScrollPosition = 0;
        this.bulkButton = null;
        this.clickInterceptor = null;
        
        // Integration with existing playlist editor
        this.playlistEditor = null;
        
        this.init();
    }

    init() {
        // Only activate on playlist pages
        if (!this.isPlaylistEditPage()) return;
        
        console.log('🚀 Bulk Tab Manager: Initializing premium features...');
        
        // Wait for existing playlist editor to load
        this.waitForPlaylistEditor().then(() => {
            this.setupBulkControls();
            this.setupSmartClickInterception();
            this.setupKeyboardShortcuts();
        });
    }

    isPlaylistEditPage() {
        const url = window.location.href;
        return url.includes('/playlist/') && url.includes('/videos');
    }

    async waitForPlaylistEditor() {
        return new Promise((resolve) => {
            const checkEditor = () => {
                // Look for existing playlist editor elements OR just video rows
                const existingOverlay = document.querySelector('#ysve-playlist-overlay');
                const videoRows = document.querySelectorAll('ytcp-video-row');
                
                if (videoRows.length > 0) {
                    console.log('✅ Video rows detected, setting up bulk features...');
                    resolve();
                } else {
                    setTimeout(checkEditor, 200);
                }
            };
            checkEditor();
        });
    }

    setupBulkControls() {
        // Create premium bulk control panel
        this.createBulkControlPanel();
        this.attachBulkEventListeners();
        console.log('✅ Bulk controls ready');
    }

    createBulkControlPanel() {
        // Find optimal location in header area
        const headerArea = document.querySelector('#header, .video-table-content');
        if (!headerArea) {
            console.warn('Header area not found, trying body');
            const firstVideoRow = document.querySelector('ytcp-video-row');
            if (firstVideoRow && firstVideoRow.parentElement) {
                headerArea = firstVideoRow.parentElement;
            } else {
                return;
            }
        }

        // Check if already exists
        if (document.getElementById('ysve-bulk-controls')) {
            console.log('Bulk controls already exist');
            return;
        }

        // Create bulk control container
        const bulkContainer = document.createElement('div');
        bulkContainer.id = 'ysve-bulk-controls';
        bulkContainer.innerHTML = `
            <div class="ysve-bulk-panel">
                <div class="ysve-bulk-header">
                    <div class="ysve-bulk-title">
                        <span class="ysve-bulk-icon">🚀</span>
                        <span class="ysve-bulk-text">Premium Bulk Editor</span>
                        <span class="ysve-beta-badge">PREMIUM</span>
                    </div>
                    <div class="ysve-bulk-stats">
                        <span id="ysve-video-count">0 videos</span>
                    </div>
                </div>
                
                <div class="ysve-bulk-actions">
                    <div class="ysve-action-group">
                        <button id="ysve-open-all-tabs" class="ysve-bulk-btn primary">
                            <span class="ysve-btn-icon">📂</span>
                            <span class="ysve-btn-text">Open All for Edit</span>
                            <span class="ysve-btn-count">(0)</span>
                        </button>
                        
                        <div class="ysve-bulk-options">
                            <button id="ysve-filter-private" class="ysve-filter-btn" data-filter="private">
                                🔒 Private Only
                            </button>
                            <button id="ysve-filter-unlisted" class="ysve-filter-btn" data-filter="unlisted">
                                🔗 Unlisted Only
                            </button>
                            <button id="ysve-filter-public" class="ysve-filter-btn" data-filter="public">
                                🌍 Public Only
                            </button>
                        </div>
                    </div>
                    
                    <div class="ysve-action-group">
                        <button id="ysve-smart-click-toggle" class="ysve-bulk-btn secondary">
                            <span class="ysve-btn-icon">🎯</span>
                            <span class="ysve-btn-text">Smart Click Mode</span>
                            <span class="ysve-toggle-status">OFF</span>
                        </button>
                        
                        <button id="ysve-close-all-tabs" class="ysve-bulk-btn tertiary" disabled>
                            <span class="ysve-btn-icon">🗂️</span>
                            <span class="ysve-btn-text">Close All Edit Tabs</span>
                            <span class="ysve-tab-count">(0)</span>
                        </button>
                    </div>
                </div>
                
                <div class="ysve-bulk-progress" style="display: none;">
                    <div class="ysve-progress-bar">
                        <div class="ysve-progress-fill"></div>
                    </div>
                    <div class="ysve-progress-text">Opening tabs...</div>
                </div>
            </div>
        `;

        // Insert at the top of the video table
        headerArea.insertBefore(bulkContainer, headerArea.firstChild);
        
        // Update video count
        this.updateVideoCount();
        console.log('✅ Bulk control panel created and inserted');
    }

    attachBulkEventListeners() {
        // Open All Tabs button
        const openAllBtn = document.getElementById('ysve-open-all-tabs');
        if (openAllBtn) {
            openAllBtn.addEventListener('click', () => {
                this.openAllTabsForEdit();
            });
        }

        // Filter buttons
        document.querySelectorAll('.ysve-filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.toggleFilter(e.target.dataset.filter);
            });
        });

        // Smart Click toggle
        const smartClickBtn = document.getElementById('ysve-smart-click-toggle');
        if (smartClickBtn) {
            smartClickBtn.addEventListener('click', () => {
                this.toggleSmartClickMode();
            });
        }

        // Close All Tabs button
        const closeAllBtn = document.getElementById('ysve-close-all-tabs');
        if (closeAllBtn) {
            closeAllBtn.addEventListener('click', () => {
                this.closeAllEditTabs();
            });
        }
    }

    updateVideoCount() {
        const allVideos = document.querySelectorAll('ytcp-video-row');
        const filteredVideos = this.getFilteredVideos();
        
        const countEl = document.getElementById('ysve-video-count');
        const btnCountEl = document.querySelector('#ysve-open-all-tabs .ysve-btn-count');
        
        if (countEl) {
            countEl.textContent = `${allVideos.length} videos`;
        }
        
        if (btnCountEl) {
            btnCountEl.textContent = `(${filteredVideos.length})`;
        }
    }

    getFilteredVideos() {
        const allRows = Array.from(document.querySelectorAll('ytcp-video-row'));
        const activeFilters = document.querySelectorAll('.ysve-filter-btn.active');
        
        if (activeFilters.length === 0) {
            return allRows; // No filters = all videos
        }
        
        return allRows.filter(row => {
            const visibility = this.getCurrentVisibility(row);
            return Array.from(activeFilters).some(filter => {
                const filterType = filter.dataset.filter.toUpperCase();
                return visibility === filterType;
            });
        });
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

    toggleFilter(filterType) {
        const filterBtn = document.querySelector(`[data-filter="${filterType}"]`);
        if (!filterBtn) return;
        
        filterBtn.classList.toggle('active');
        this.updateVideoCount();
        
        // Visual feedback
        const activeFilters = document.querySelectorAll('.ysve-filter-btn.active');
        if (activeFilters.length > 0) {
            const filterText = Array.from(activeFilters).map(btn => 
                btn.textContent.trim()
            ).join(', ');
            
            this.showTemporaryMessage(`Filter: ${filterText}`, 2000);
        } else {
            this.showTemporaryMessage('All videos selected', 1500);
        }
    }

    async openAllTabsForEdit() {
        const videos = this.getFilteredVideos();
        
        if (videos.length === 0) {
            this.showTemporaryMessage('No videos to open', 2000);
            return;
        }

        // Confirm large batch operations
        if (videos.length > 20) {
            const confirmed = confirm(
                `🚀 BULK TAB OPERATION\n\n` +
                `This will open ${videos.length} tabs for editing.\n` +
                `Large numbers of tabs may slow your browser.\n\n` +
                `Continue with opening ${videos.length} edit tabs?`
            );
            
            if (!confirmed) return;
        }

        // Store original scroll position
        this.originalScrollPosition = window.scrollY;
        
        // Show progress
        this.showBulkProgress(videos.length);
        
        // Disable button during operation
        const btn = document.getElementById('ysve-open-all-tabs');
        const originalText = btn.querySelector('.ysve-btn-text').textContent;
        btn.disabled = true;
        btn.querySelector('.ysve-btn-text').textContent = 'Opening...';

        try {
            await this.openTabsInBatches(videos);
            
            // Success feedback
            this.showTemporaryMessage(
                `✅ Opened ${videos.length} edit tabs successfully!`, 
                3000
            );
            
            // Enable close tabs button
            this.updateTabCounter();
            
        } catch (error) {
            console.error('Error opening tabs:', error);
            this.showTemporaryMessage('❌ Error opening some tabs', 3000);
        } finally {
            // Restore button
            btn.disabled = false;
            btn.querySelector('.ysve-btn-text').textContent = originalText;
            this.hideBulkProgress();
        }
    }

    async openTabsInBatches(videos) {
        const batchSize = 8; // Open 8 tabs at a time to avoid browser limits
        const delay = 150; // ms between each tab
        
        for (let i = 0; i < videos.length; i += batchSize) {
            const batch = videos.slice(i, i + batchSize);
            
            // Open current batch
            await Promise.all(batch.map(async (row, index) => {
                return new Promise(resolve => {
                    setTimeout(() => {
                        this.openVideoEditTab(row);
                        resolve();
                    }, index * delay);
                });
            }));
            
            // Update progress
            this.updateBulkProgress(Math.min(i + batchSize, videos.length), videos.length);
            
            // Brief pause between batches
            if (i + batchSize < videos.length) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }
    }

    openVideoEditTab(row) {
        const editLink = row.querySelector('a[href*="/video/"][href*="/edit"]');
        if (!editLink) return;
        
        const videoId = this.getVideoId(row);
        const videoTitle = this.getVideoTitle(row);
        
        if (videoId) {
            this.openTabs.add(videoId);
            // Store detailed tab info for smart closing
            this.tabDetails.set(videoId, {
                url: editLink.href,
                title: videoTitle,
                openedAt: Date.now()
            });
        }
        
        // Open in background tab - browser will not switch focus
        const newTab = window.open(editLink.href, '_blank', 'noopener,noreferrer');
        
        // Ensure current tab maintains focus
        window.focus();
        
        // Track tab for potential closing
        if (newTab) {
            console.log(`📂 Opened edit tab for video: ${videoId} (${videoTitle}) - background mode`);
        }
    }

    getVideoId(row) {
        const editLink = row.querySelector('a[href*="/video/"][href*="/edit"]');
        if (!editLink) return null;
        
        const href = editLink.href;
        const match = href.match(/\/video\/([^\/]+)\/edit/);
        return match ? match[1] : null;
    }

    getVideoTitle(row) {
        const titleElement = row.querySelector('.video-title, [id*="video-title"], .title');
        return titleElement ? titleElement.textContent.trim() : 'Unknown Video';
    }

    getVideoTitleFromLink(link) {
        // Try to find title from the closest row
        const row = link.closest('ytcp-video-row');
        if (row) {
            return this.getVideoTitle(row);
        }
        return 'Unknown Video';
    }

    setupSmartClickInterception() {
        console.log('🎯 Setting up smart click interception...');
        
        // Create click interceptor
        this.clickInterceptor = (e) => {
            if (!this.smartClickMode) return;
            
            // Check if this is a video edit link
            const link = e.target.closest('a[href*="/video/"][href*="/edit"]');
            if (link) {
                e.preventDefault();
                e.stopPropagation();
                
                // Open in background tab (don't switch focus)
                const newTab = window.open(link.href, '_blank', 'noopener,noreferrer');
                
                // Immediately return focus to current tab (this ensures you stay here)
                window.focus();
                
                // Track the opened tab with details
                const videoId = this.getVideoIdFromUrl(link.href);
                if (videoId) {
                    this.openTabs.add(videoId);
                    this.tabDetails.set(videoId, {
                        url: link.href,
                        title: this.getVideoTitleFromLink(link),
                        openedAt: Date.now()
                    });
                    this.updateTabCounter();
                }
                
                // Visual feedback with tab count
                this.showClickFeedback(e.target, this.openTabs.size);
                
                console.log(`🎯 Smart click: Opened ${videoId} in background tab (${this.openTabs.size} total)`);
            }
        };
        
        // Don't attach yet - only when smart mode is enabled
    }

    getVideoIdFromUrl(url) {
        const match = url.match(/\/video\/([^\/]+)\/edit/);
        return match ? match[1] : null;
    }

    updateTabCounter() {
        const closeBtn = document.getElementById('ysve-close-all-tabs');
        if (closeBtn) {
            const count = this.openTabs.size;
            closeBtn.disabled = count === 0;
            closeBtn.querySelector('.ysve-tab-count').textContent = `(${count})`;
            
            if (count > 0) {
                closeBtn.style.background = 'linear-gradient(135deg, #ff9800, #f57c00)';
            } else {
                closeBtn.style.background = 'linear-gradient(135deg, #757575, #616161)';
            }
        }
    }

    toggleSmartClickMode() {
        this.smartClickMode = !this.smartClickMode;
        
        const btn = document.getElementById('ysve-smart-click-toggle');
        const statusEl = btn.querySelector('.ysve-toggle-status');
        
        if (this.smartClickMode) {
            // Enable smart click mode
            document.addEventListener('click', this.clickInterceptor, true);
            btn.classList.add('active');
            statusEl.textContent = 'ON';
            
            // Change cursor for video links
            this.addSmartClickStyles();
            
            this.showTemporaryMessage('🎯 Smart Click Mode: ON - All clicks open background tabs!', 3000);
            
        } else {
            // Disable smart click mode
            document.removeEventListener('click', this.clickInterceptor, true);
            btn.classList.remove('active');
            statusEl.textContent = 'OFF';
            
            // Remove cursor styles
            this.removeSmartClickStyles();
            
            this.showTemporaryMessage('🎯 Smart Click Mode: OFF - Normal click navigation', 2000);
        }
    }

    addSmartClickStyles() {
        const style = document.createElement('style');
        style.id = 'ysve-smart-click-styles';
        style.textContent = `
            .ysve-smart-click-active a[href*="/video/"][href*="/edit"] {
                cursor: pointer !important;
                position: relative;
            }
            
            .ysve-smart-click-active a[href*="/video/"][href*="/edit"]:hover::after {
                content: "🎯 Click = Background Tab";
                position: absolute;
                top: -30px;
                left: 50%;
                transform: translateX(-50%);
                background: rgba(0,0,0,0.8);
                color: white;
                padding: 4px 8px;
                border-radius: 4px;
                font-size: 11px;
                white-space: nowrap;
                z-index: 1000;
                pointer-events: none;
            }
        `;
        document.head.appendChild(style);
        
        // Add class to body for styling
        document.body.classList.add('ysve-smart-click-active');
    }

    removeSmartClickStyles() {
        const style = document.getElementById('ysve-smart-click-styles');
        if (style) style.remove();
        
        document.body.classList.remove('ysve-smart-click-active');
    }

    showClickFeedback(element, tabCount) {
        // Brief visual feedback for smart clicks with tab count
        const feedback = document.createElement('div');
        feedback.style.cssText = `
            position: fixed;
            top: ${element.getBoundingClientRect().top}px;
            left: ${element.getBoundingClientRect().left}px;
            background: rgba(33, 150, 243, 0.95);
            color: white;
            padding: 6px 12px;
            border-radius: 6px;
            font-size: 12px;
            z-index: 10000;
            pointer-events: none;
            animation: ysve-click-feedback 1.5s ease-out forwards;
            backdrop-filter: blur(5px);
            border: 1px solid rgba(255,255,255,0.3);
            font-weight: 600;
        `;
        feedback.textContent = `🎯 Tab ${tabCount} opened`;
        
        // Add animation keyframes if not exists
        if (!document.getElementById('ysve-click-feedback-animation')) {
            const animationStyle = document.createElement('style');
            animationStyle.id = 'ysve-click-feedback-animation';
            animationStyle.textContent = `
                @keyframes ysve-click-feedback {
                    0% { opacity: 1; transform: scale(1); }
                    50% { opacity: 1; transform: scale(1.1); }
                    100% { opacity: 0; transform: scale(1.2) translateY(-15px); }
                }
            `;
            document.head.appendChild(animationStyle);
        }
        
        document.body.appendChild(feedback);
        setTimeout(() => feedback.remove(), 1500);
    }

    closeAllEditTabs() {
        const tabCount = this.openTabs.size;
        if (tabCount === 0) {
            this.showTemporaryMessage('No edit tabs to close', 2000);
            return;
        }

        // Show smart tab closing interface
        this.showSmartTabCloser();
    }

    showSmartTabCloser() {
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.5);
            z-index: 10002;
            display: flex;
            align-items: center;
            justify-content: center;
            backdrop-filter: blur(5px);
        `;
        
        // Create tab list for smart closing
        const tabList = Array.from(this.tabDetails.entries()).map(([videoId, details]) => {
            const timeAgo = Math.round((Date.now() - details.openedAt) / 1000);
            return `
                <div style="
                    display: flex;
                    align-items: center;
                    padding: 8px 12px;
                    margin: 4px 0;
                    background: #f8f9fa;
                    border-radius: 6px;
                    border-left: 3px solid #1976d2;
                ">
                    <span style="font-size: 12px; color: #666; margin-right: 8px;">${timeAgo}s ago</span>
                    <span style="flex: 1; font-size: 13px; color: #333;">${details.title.substring(0, 50)}${details.title.length > 50 ? '...' : ''}</span>
                    <code style="background: #e9ecef; padding: 2px 6px; border-radius: 3px; font-size: 10px; color: #495057;">${videoId}</code>
                </div>
            `;
        }).join('');

        modal.innerHTML = `
            <div class="modal-content" style="
                background: white;
                padding: 24px;
                border-radius: 12px;
                max-width: 600px;
                max-height: 80vh;
                overflow-y: auto;
                text-align: center;
                box-shadow: 0 8px 32px rgba(0,0,0,0.3);
                position: relative;
            ">
                <h3 style="margin-top: 0; color: #1976d2;">🗂️ Smart Tab Closer</h3>
                <p style="color: #666; margin-bottom: 20px;">Found ${this.openTabs.size} edit tabs to close:</p>
                
                <div style="
                    max-height: 300px;
                    overflow-y: auto;
                    text-align: left;
                    margin: 16px 0;
                    padding: 12px;
                    background: #ffffff;
                    border: 1px solid #e0e0e0;
                    border-radius: 8px;
                ">
                    ${tabList}
                </div>
                
                <div style="display: flex; gap: 12px; justify-content: center; margin-top: 20px;">
                    <button class="copy-urls-btn" style="
                        background: #28a745;
                        color: white;
                        border: none;
                        padding: 12px 20px;
                        border-radius: 6px;
                        cursor: pointer;
                        font-weight: 600;
                    ">
                        📋 Copy All URLs
                    </button>
                    
                    <button class="open-tab-manager-btn" style="
                        background: #17a2b8;
                        color: white;
                        border: none;
                        padding: 12px 20px;
                        border-radius: 6px;
                        cursor: pointer;
                        font-weight: 600;
                    ">
                        🔧 Tab Manager
                    </button>
                    
                    <button class="close-modal-btn" style="
                        background: #6c757d;
                        color: white;
                        border: none;
                        padding: 12px 20px;
                        border-radius: 6px;
                        cursor: pointer;
                        font-weight: 600;
                    ">
                        Cancel
                    </button>
                </div>
                
                <div style="
                    margin-top: 16px;
                    padding: 12px;
                    background: #e7f3ff;
                    border-radius: 6px;
                    text-align: left;
                    font-size: 13px;
                    color: #0c5460;
                ">
                    <strong>💡 Pro Tips:</strong><br>
                    • <strong>Copy URLs:</strong> Paste in address bar to see all tabs<br>
                    • <strong>Tab Manager:</strong> Chrome's built-in tab management<br>
                    • <strong>Keyboard:</strong> Ctrl+Shift+A → "Close tabs to the right"
                </div>
            </div>
        `;
        
        // Add event listeners
        const copyBtn = modal.querySelector('.copy-urls-btn');
        const tabManagerBtn = modal.querySelector('.open-tab-manager-btn');
        const closeBtn = modal.querySelector('.close-modal-btn');
        
        // Copy all URLs to clipboard
        copyBtn.addEventListener('click', () => {
            const urls = Array.from(this.tabDetails.values()).map(details => details.url);
            navigator.clipboard.writeText(urls.join('\n')).then(() => {
                copyBtn.innerHTML = '✅ Copied!';
                copyBtn.style.background = '#28a745';
                setTimeout(() => {
                    copyBtn.innerHTML = '📋 Copy All URLs';
                }, 2000);
            }).catch(() => {
                // Fallback for older browsers
                const textArea = document.createElement('textarea');
                textArea.value = urls.join('\n');
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
                copyBtn.innerHTML = '✅ Copied!';
            });
        });
        
        // Open Chrome tab manager
        tabManagerBtn.addEventListener('click', () => {
            this.showTemporaryMessage('Press Ctrl+Shift+A for Chrome tab search', 3000);
        });
        
        // Close modal
        closeBtn.addEventListener('click', () => {
            modal.remove();
        });
        
        // Close on background click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
        
        // Close on Escape key
        const escapeHandler = (e) => {
            if (e.key === 'Escape') {
                modal.remove();
                document.removeEventListener('keydown', escapeHandler);
            }
        };
        document.addEventListener('keydown', escapeHandler);
        
        document.body.appendChild(modal);
        
        // Clear our tracking after showing the interface
        setTimeout(() => {
            this.openTabs.clear();
            this.tabDetails.clear();
            this.updateTabCounter();
        }, 1000);
    }

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Only on playlist pages and not when typing
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            
            switch(e.key) {
                case 'B':
                    if (e.ctrlKey || e.metaKey) {
                        e.preventDefault();
                        this.openAllTabsForEdit();
                    }
                    break;
                case 'T':
                    if (e.ctrlKey || e.metaKey) {
                        e.preventDefault();
                        this.toggleSmartClickMode();
                    }
                    break;
            }
        });
        
        console.log('⌨️ Keyboard shortcuts active: Ctrl+B (bulk tabs), Ctrl+T (smart click)');
    }

    showBulkProgress(total) {
        const progressEl = document.querySelector('.ysve-bulk-progress');
        if (progressEl) {
            progressEl.style.display = 'block';
            this.updateBulkProgress(0, total);
        }
    }

    updateBulkProgress(current, total) {
        const progressFill = document.querySelector('.ysve-progress-fill');
        const progressText = document.querySelector('.ysve-progress-text');
        
        if (progressFill && progressText) {
            const percentage = (current / total) * 100;
            progressFill.style.width = `${percentage}%`;
            progressText.textContent = `Opening ${current}/${total} tabs...`;
        }
    }

    hideBulkProgress() {
        const progressEl = document.querySelector('.ysve-bulk-progress');
        if (progressEl) {
            progressEl.style.display = 'none';
        }
    }

    showTemporaryMessage(message, duration = 2000) {
        // Create floating message
        const messageEl = document.createElement('div');
        messageEl.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: rgba(33, 150, 243, 0.95);
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            z-index: 10001;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 14px;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255,255,255,0.2);
            animation: ysve-message-slide-in 0.3s ease-out;
        `;
        messageEl.textContent = message;
        
        // Add slide animation if not exists
        if (!document.getElementById('ysve-message-animation')) {
            const animationStyle = document.createElement('style');
            animationStyle.id = 'ysve-message-animation';
            animationStyle.textContent = `
                @keyframes ysve-message-slide-in {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                @keyframes ysve-message-slide-out {
                    from { transform: translateX(0); opacity: 1; }
                    to { transform: translateX(100%); opacity: 0; }
                }
            `;
            document.head.appendChild(animationStyle);
        }
        
        document.body.appendChild(messageEl);
        
        // Auto-remove after duration
        setTimeout(() => {
            messageEl.style.animation = 'ysve-message-slide-out 0.3s ease-out';
            setTimeout(() => messageEl.remove(), 300);
        }, duration);
    }

    // Integration with existing mutation observer
    observeChanges() {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === 1) {
                        if (node.matches && node.matches('ytcp-video-row')) {
                            this.updateVideoCount();
                        } else if (node.querySelector) {
                            const newRows = node.querySelectorAll('ytcp-video-row');
                            if (newRows.length > 0) {
                                this.updateVideoCount();
                            }
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
        // Clean up event listeners and elements
        if (this.clickInterceptor) {
            document.removeEventListener('click', this.clickInterceptor, true);
        }
        
        this.removeSmartClickStyles();
        
        const bulkControls = document.getElementById('ysve-bulk-controls');
        if (bulkControls) {
            bulkControls.remove();
        }
        
        console.log('🧹 Bulk Tab Manager: Cleaned up');
    }
}

// Initialize bulk tab manager when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        // Small delay to let playlist editor initialize first
        setTimeout(() => {
            new BulkTabManager();
        }, 500);
    });
} else {
    setTimeout(() => {
        new BulkTabManager();
    }, 500);
}

// Listen for navigation changes (YouTube SPA)
let lastBulkUrl = location.href;
new MutationObserver(() => {
    const url = location.href;
    if (url !== lastBulkUrl) {
        lastBulkUrl = url;
        // Small delay to allow page to load
        setTimeout(() => {
            new BulkTabManager();
        }, 1000);
    }
}).observe(document, { subtree: true, childList: true });