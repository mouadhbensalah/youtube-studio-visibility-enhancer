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
        
        console.log(`🎬 Changing ${videoId}: ${currentVisibility} → ${newVisibility}`);
        
        // Store scroll position to restore after change
        this.scrollPosition = window.scrollY;
        
        // Show loading state
        this.showLoadingState(row);
        
        try {
            // Method 1: Try to use the existing dropdown mechanism
            await this.triggerVisibilityChange(row, newVisibility);
            
        } catch (error) {
            console.error('Visibility change failed:', error);
            this.showErrorState(row);
        }
    }

    async triggerVisibilityChange(row, newVisibility) {
        return new Promise((resolve, reject) => {
            // Click the dropdown to open visibility selector
            const dropdownTrigger = row.querySelector('.edit-triangle-icon');
            if (!dropdownTrigger) {
                reject(new Error('Dropdown trigger not found'));
                return;
            }
            
            // Simulate click to open dropdown
            dropdownTrigger.click();
            
            // Wait for visibility modal to appear
            setTimeout(() => {
                const visibilityModal = document.querySelector('ytcp-video-visibility-select');
                if (!visibilityModal) {
                    reject(new Error('Visibility modal not found'));
                    return;
                }
                
                // Find and click the appropriate radio button
                const radioButton = visibilityModal.querySelector(`tp-yt-paper-radio-button[name="${newVisibility}"]`);
                if (!radioButton) {
                    reject(new Error(`Radio button for ${newVisibility} not found`));
                    return;
                }
                
                // Click the radio button
                radioButton.click();
                
                // Look for save/confirm button and click it
                setTimeout(() => {
                    // Try different selectors for save button
                    const saveSelectors = [
                        'ytcp-button[aria-label*="Save"]',
                        'ytcp-button[aria-label*="Confirm"]', 
                        'button[aria-label*="Save"]',
                        '[data-ve-type="88287"]', // YouTube's save button VE type
                        '.ytcp-button.ytcp-button--primary'
                    ];
                    
                    let saveButton = null;
                    for (const selector of saveSelectors) {
                        saveButton = document.querySelector(selector);
                        if (saveButton) break;
                    }
                    
                    if (saveButton) {
                        saveButton.click();
                        
                        // Wait for change to complete and restore scroll
                        setTimeout(() => {
                            window.scrollTo(0, this.scrollPosition);
                            this.updateRowVisual(row, newVisibility);
                            resolve();
                        }, 500);
                    } else {
                        reject(new Error('Save button not found'));
                    }
                }, 200);
            }, 300);
        });
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
        
        // Reset loading state
        visibilityCell.style.opacity = '1';
        visibilityCell.style.pointerEvents = 'auto';
        
        // Update icon (this will be updated by YouTube's own refresh)
        // Just add a success indicator
        visibilityCell.style.borderLeft = '3px solid #00ff88';
        setTimeout(() => {
            visibilityCell.style.borderLeft = '';
        }, 2000);
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