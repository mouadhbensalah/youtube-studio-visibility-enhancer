// pagination-bypass.js - YouTube Playlist Pagination Breaker
// Enhanced version with fully automated pagination loading

class PlaylistPaginationBypass {
    constructor() {
        this.isActive = false;
        this.totalVideosLoaded = 0;
        this.progressIndicator = null;
        this.loadingInProgress = false;
        this.maxRetries = 3;
        this.currentRetries = 0;
        this.pageLoadTimeout = 4000; // 4 seconds between pages
        this.maxPages = 15; // Safety limit
        
        this.init();
    }

    init() {
        // Only activate on playlist video pages
        if (!this.isPlaylistVideosPage()) return;
        
        console.log('🔓 Pagination Bypass: Initializing...');
        
        // Wait for page to load completely
        this.waitForPageLoad().then(() => {
            this.createBypassControls();
            this.analyzeCurrentState();
        });
    }

    isPlaylistVideosPage() {
        const url = window.location.href;
        return url.includes('/playlist/') && url.includes('/videos');
    }

    async waitForPageLoad() {
        return new Promise((resolve) => {
            const checkPageReady = () => {
                const videoTable = document.querySelector('.video-table-content');
                const footer = document.querySelector('ytcp-table-footer');
                const videos = document.querySelectorAll('ytcp-video-row');
                
                if (videoTable && footer && videos.length > 0) {
                    console.log('✅ Page ready for pagination bypass');
                    
                    // Auto-optimize page size on load
                    setTimeout(() => {
                        this.autoOptimizePageSize();
                    }, 1000);
                    
                    resolve();
                } else {
                    setTimeout(checkPageReady, 200);
                }
            };
            checkPageReady();
        });
    }

    analyzeCurrentState() {
        const currentVideos = document.querySelectorAll('ytcp-video-row').length;
        const pageInfo = document.querySelector('.page-description');
        const nextButton = document.querySelector('#navigate-after');
        
        console.log('📊 Current state analysis:');
        console.log('- Videos loaded:', currentVideos);
        console.log('- Page info:', pageInfo?.textContent);
        console.log('- Next button disabled:', this.isNextButtonDisabled(nextButton));
        
        this.totalVideosLoaded = currentVideos;
        this.updateProgressIndicator();
    }

    createBypassControls() {
        // Find the bulk editor header to add our controls
        const bulkHeader = document.querySelector('#ysve-bulk-controls .ysve-bulk-actions');
        
        if (!bulkHeader) {
            console.warn('🔓 Bulk controls not found, creating standalone bypass controls');
            this.createStandaloneControls();
            return;
        }

        // Add bypass controls to existing bulk editor
        const bypassGroup = document.createElement('div');
        bypassGroup.className = 'ysve-action-group';
        bypassGroup.innerHTML = `
            <button id="ysve-load-all-videos" class="ysve-bulk-btn secondary">
                <span class="ysve-btn-icon">🔓</span>
                <span class="ysve-btn-text">Load All Videos</span>
                <span class="ysve-btn-count" id="ysve-bypass-count">(${this.totalVideosLoaded})</span>
            </button>
            
            <div class="ysve-bypass-progress" id="ysve-bypass-progress" style="display: none;">
                <div class="ysve-progress-bar">
                    <div class="ysve-progress-fill" id="ysve-bypass-fill"></div>
                </div>
                <div class="ysve-progress-text" id="ysve-bypass-text">Loading videos...</div>
            </div>
        `;

        bulkHeader.appendChild(bypassGroup);
        
        // Add event listener
        document.getElementById('ysve-load-all-videos').addEventListener('click', () => {
            this.startAutomatedPaginationBypass();
        });

        console.log('✅ Pagination bypass controls added to bulk editor');
    }

    createStandaloneControls() {
        // Create standalone controls if bulk editor not available
        const videoTable = document.querySelector('.video-table-content');
        if (!videoTable) return;

        const bypassContainer = document.createElement('div');
        bypassContainer.id = 'ysve-pagination-bypass';
        bypassContainer.style.cssText = `
            margin: 16px 0;
            padding: 16px;
            background: linear-gradient(135deg, rgba(255, 152, 0, 0.05), rgba(255, 87, 34, 0.05));
            border: 1px solid rgba(255, 152, 0, 0.2);
            border-radius: 8px;
        `;

        bypassContainer.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
                <div>
                    <h3 style="margin: 0; color: #ff9800; font-size: 16px;">🔓 Pagination Bypass</h3>
                    <p style="margin: 4px 0 0 0; color: #666; font-size: 13px;">Load all videos in this playlist automatically</p>
                </div>
                <button id="ysve-load-all-videos" style="
                    background: linear-gradient(135deg, #ff9800, #f57c00);
                    color: white;
                    border: none;
                    padding: 12px 20px;
                    border-radius: 6px;
                    cursor: pointer;
                    font-weight: 600;
                ">
                    🔓 Load All Videos (${this.totalVideosLoaded})
                </button>
            </div>
            
            <div class="ysve-bypass-progress" id="ysve-bypass-progress" style="display: none;">
                <div style="
                    width: 100%;
                    height: 4px;
                    background: rgba(255, 152, 0, 0.2);
                    border-radius: 2px;
                    overflow: hidden;
                    margin-bottom: 8px;
                ">
                    <div id="ysve-bypass-fill" style="
                        height: 100%;
                        background: linear-gradient(90deg, #ff9800, #f57c00);
                        width: 0%;
                        transition: width 0.3s ease;
                    "></div>
                </div>
                <div id="ysve-bypass-text" style="font-size: 12px; color: #666; text-align: center;">
                    Ready to load all videos...
                </div>
            </div>
        `;

        videoTable.parentNode.insertBefore(bypassContainer, videoTable);

        // Add event listener
        document.getElementById('ysve-load-all-videos').addEventListener('click', () => {
            this.startAutomatedPaginationBypass();
        });

        console.log('✅ Standalone pagination bypass controls created');
    }

    async startAutomatedPaginationBypass() {
        if (this.loadingInProgress) {
            console.log('🔓 Bypass already in progress');
            return;
        }

        this.loadingInProgress = true;
        this.showProgress();
        
        console.log('🚀 Starting automated pagination bypass...');

        // Update button state
        const btn = document.getElementById('ysve-load-all-videos');
        const originalText = btn.querySelector('.ysve-btn-text')?.textContent || btn.textContent;
        if (btn.querySelector('.ysve-btn-text')) {
            btn.querySelector('.ysve-btn-text').textContent = 'Loading...';
        } else {
            btn.textContent = '🔄 Loading...';
        }
        btn.disabled = true;

        try {
            await this.loadAllPagesAutomatically();
            this.showCompletionMessage();
            
        } catch (error) {
            console.error('❌ Pagination bypass failed:', error);
            this.showErrorMessage(error.message);
        } finally {
            this.loadingInProgress = false;
            this.hideProgress();
            
            // Restore button
            btn.disabled = false;
            if (btn.querySelector('.ysve-btn-text')) {
                btn.querySelector('.ysve-btn-text').textContent = originalText;
            } else {
                btn.textContent = `🔓 Load All Videos (${this.totalVideosLoaded})`;
            }
        }
    }

    async loadAllPagesAutomatically() {
        console.log('🔓 Starting automatic pagination loading...');
        
        let pageCount = 1;
        
        while (pageCount <= this.maxPages) {
            console.log(`\n📄 === PAGE ${pageCount} ===`);
            
            // Get current state
            const currentVideos = document.querySelectorAll('ytcp-video-row').length;
            const nextBtn = document.querySelector('#navigate-after');
            
            console.log(`Current videos: ${currentVideos}`);
            this.totalVideosLoaded = currentVideos;
            this.updateProgressIndicator();
            
            // Check if Next button is disabled (reached end)
            const isDisabled = this.isNextButtonDisabled(nextBtn);
            console.log(`Next button disabled: ${isDisabled}`);
            
            if (isDisabled) {
                console.log('🏁 REACHED END! No more pages available.');
                break;
            }
            
            // Click Next button
            console.log('🖱️ Clicking Next...');
            await this.clickNextButton(nextBtn);
            
            // Wait for page to load with proper timeout
            console.log(`⏳ Waiting ${this.pageLoadTimeout/1000}s for page to load...`);
            await this.waitForNewContent();
            
            // Verify new videos loaded
            const newCount = document.querySelectorAll('ytcp-video-row').length;
            console.log(`Videos after click: ${newCount}`);
            
            if (newCount <= currentVideos) {
                console.log('⚠️ No new videos loaded after clicking Next.');
                
                // Check if we've actually reached the end by examining button state more carefully
                const updatedNextBtn = document.querySelector('#navigate-after');
                const isReallyDisabled = this.isNextButtonDisabled(updatedNextBtn);
                
                if (isReallyDisabled) {
                    console.log('🏁 Confirmed: Next button is now disabled, reached end of playlist');
                    this.totalVideosLoaded = newCount;
                    break;
                }
                
                // Try one more time with longer wait (maybe slow loading)
                console.log('🔄 Button not disabled, trying extended wait for slow loading...');
                await this.delay(3000); // Longer wait
                
                const finalCount = document.querySelectorAll('ytcp-video-row').length;
                if (finalCount <= currentVideos) {
                    // Double-check button state again
                    const finalNextBtn = document.querySelector('#navigate-after');
                    if (this.isNextButtonDisabled(finalNextBtn)) {
                        console.log('🏁 Final check: Button disabled, definitely at the end');
                        this.totalVideosLoaded = finalCount;
                        break;
                    } else {
                        console.log('❌ Still no new videos but button not disabled. Something may be stuck.');
                        this.totalVideosLoaded = finalCount;
                        break;
                    }
                } else {
                    console.log(`✅ Found ${finalCount} videos after extended wait`);
                    this.totalVideosLoaded = finalCount;
                }
            } else {
                this.totalVideosLoaded = newCount;
            }
            
            pageCount++;
            
            // Show progress
            this.updateProgressText(`Loaded page ${pageCount-1}... (${this.totalVideosLoaded} videos)`);
            
            // Brief delay between pages
            await this.delay(200);
        }
        
        // Final update
        const finalCount = document.querySelectorAll('ytcp-video-row').length;
        this.totalVideosLoaded = finalCount;
        
        console.log(`\n✅ PAGINATION COMPLETE!`);
        console.log(`📊 Final Results:`);
        console.log(`   - Pages loaded: ${pageCount - 1}`);
        console.log(`   - Total videos: ${finalCount}`);
        console.log(`   - Time taken: ~${((pageCount - 1) * this.pageLoadTimeout / 1000).toFixed(1)}s`);
    }

    isNextButtonDisabled(nextBtn) {
        if (!nextBtn) return true;
        
        // Enhanced detection using the properties you shared
        const checks = [
            nextBtn.disabled,
            nextBtn.getAttribute('aria-disabled') === 'true',
            nextBtn.classList.contains('disabled'),
            nextBtn.hasAttribute('disabled'),
            nextBtn.getAttribute('tabindex') === '-1' && nextBtn.hasAttribute('disabled'), // Your specific case
            window.getComputedStyle(nextBtn).pointerEvents === 'none'
        ];
        
        // Additional check for the SVG pointer-events (from your HTML)
        const svg = nextBtn.querySelector('svg');
        if (svg && window.getComputedStyle(svg).pointerEvents === 'none') {
            checks.push(true);
        }
        
        const isDisabled = checks.some(check => check === true);
        
        // Debug logging for your specific case
        if (isDisabled) {
            console.log('🔍 Next button is disabled - reached end of playlist');
            console.log(`   - disabled: ${nextBtn.disabled}`);
            console.log(`   - aria-disabled: ${nextBtn.getAttribute('aria-disabled')}`);
            console.log(`   - tabindex: ${nextBtn.getAttribute('tabindex')}`);
            console.log(`   - has disabled attribute: ${nextBtn.hasAttribute('disabled')}`);
        }
        
        return isDisabled;
    }

    async clickNextButton(nextBtn) {
        return new Promise((resolve) => {
            // Ensure button is in viewport
            nextBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
            
            setTimeout(() => {
                try {
                    // Direct click method
                    nextBtn.click();
                    console.log('✓ Next button clicked successfully');
                } catch (e) {
                    console.log('Direct click failed, trying event dispatch...');
                    
                    // Fallback: dispatch click event
                    const clickEvent = new MouseEvent('click', {
                        bubbles: true,
                        cancelable: true,
                        view: window
                    });
                    nextBtn.dispatchEvent(clickEvent);
                    console.log('✓ Click event dispatched');
                }
                
                resolve();
            }, 300); // Small delay for scroll to complete
        });
    }

    async waitForNewContent() {
        return new Promise((resolve) => {
            const startTime = Date.now();
            const startCount = document.querySelectorAll('ytcp-video-row').length;
            let stableCount = 0;
            const maxStableChecks = 8;
            
            const checkForContent = () => {
                const currentCount = document.querySelectorAll('ytcp-video-row').length;
                const elapsed = Date.now() - startTime;
                
                // New content appeared
                if (currentCount > startCount) {
                    console.log(`✅ New content detected: ${currentCount} videos (was ${startCount})`);
                    setTimeout(resolve, 500); // Wait a bit more for stability
                    return;
                }
                
                // Content is stable (no changes)
                if (currentCount === startCount) {
                    stableCount++;
                    if (stableCount >= maxStableChecks) {
                        console.log(`📊 Content stable after ${elapsed}ms: ${currentCount} videos`);
                        resolve();
                        return;
                    }
                }
                
                // Timeout check
                if (elapsed >= this.pageLoadTimeout) {
                    console.log(`⏰ Timeout reached after ${elapsed}ms: ${currentCount} videos`);
                    resolve();
                    return;
                }
                
                // Continue checking
                setTimeout(checkForContent, 200);
            };
            
            // Start checking after brief delay
            setTimeout(checkForContent, 300);
        });
    }

    showProgress() {
        const progressEl = document.getElementById('ysve-bypass-progress');
        if (progressEl) {
            progressEl.style.display = 'block';
        }
    }

    hideProgress() {
        const progressEl = document.getElementById('ysve-bypass-progress');
        if (progressEl) {
            progressEl.style.display = 'none';
        }
    }

    updateProgressIndicator() {
        const countEl = document.getElementById('ysve-bypass-count');
        if (countEl) {
            countEl.textContent = `(${this.totalVideosLoaded})`;
        }
        
        // Also update standalone button if it exists
        const standaloneBtn = document.querySelector('#ysve-pagination-bypass button');
        if (standaloneBtn && !this.loadingInProgress) {
            standaloneBtn.textContent = `🔓 Load All Videos (${this.totalVideosLoaded})`;
        }
    }

    updateProgressText(text) {
        const textEl = document.getElementById('ysve-bypass-text');
        if (textEl) {
            textEl.textContent = text;
        }
    }

    showCompletionMessage() {
        const textEl = document.getElementById('ysve-bypass-text');
        if (textEl) {
            textEl.textContent = `✅ Complete! Loaded ${this.totalVideosLoaded} videos total`;
            textEl.style.color = '#4caf50';
        }
        
        // Show success notification
        this.showNotification(
            `🔓 Pagination Bypass Complete!`, 
            `Successfully loaded ${this.totalVideosLoaded} videos. All playlist content is now available for bulk editing.`,
            'success'
        );
        
        console.log(`✅ Pagination bypass complete: ${this.totalVideosLoaded} videos loaded`);
        
        // Update all related UI elements
        this.updateProgressIndicator();
        
        // Trigger update for bulk editor if it exists
        window.dispatchEvent(new CustomEvent('paginationComplete', {
            detail: { totalVideos: this.totalVideosLoaded }
        }));
    }

    showErrorMessage(error) {
        const textEl = document.getElementById('ysve-bypass-text');
        if (textEl) {
            textEl.textContent = `❌ Error: ${error}`;
            textEl.style.color = '#f44336';
        }
        
        this.showNotification(
            `❌ Pagination Bypass Error`, 
            `Failed to load all videos: ${error}`,
            'error'
        );
    }

    showNotification(title, message, type = 'info') {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            max-width: 400px;
            background: ${type === 'success' ? 'rgba(76, 175, 80, 0.95)' : 
                        type === 'error' ? 'rgba(244, 67, 54, 0.95)' : 
                        'rgba(33, 150, 243, 0.95)'};
            color: white;
            padding: 16px 20px;
            border-radius: 8px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            box-shadow: 0 4px 20px rgba(0,0,0,0.2);
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255,255,255,0.2);
            z-index: 10000;
            animation: slideInRight 0.3s ease-out;
        `;
        
        notification.innerHTML = `
            <div style="font-weight: 600; margin-bottom: 4px;">${title}</div>
            <div style="font-size: 13px; opacity: 0.9;">${message}</div>
        `;
        
        // Add animation styles if not exists
        if (!document.getElementById('ysve-bypass-notification-styles')) {
            const style = document.createElement('style');
            style.id = 'ysve-bypass-notification-styles';
            style.textContent = `
                @keyframes slideInRight {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                @keyframes slideOutRight {
                    from { transform: translateX(0); opacity: 1; }
                    to { transform: translateX(100%); opacity: 0; }
                }
            `;
            document.head.appendChild(style);
        }
        
        document.body.appendChild(notification);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            notification.style.animation = 'slideOutRight 0.3s ease-out';
            setTimeout(() => notification.remove(), 300);
        }, 5000);
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Auto-optimize page size on load
    async autoOptimizePageSize() {
        const currentVideos = document.querySelectorAll('ytcp-video-row').length;
        const pageInfo = document.querySelector('.page-description')?.textContent || '';
        
        console.log('🎯 Auto-optimization check:', {
            currentVideos,
            pageInfo
        });
        
        // Only optimize if we have exactly 30 videos and there are more available
        if (currentVideos === 30 && (pageInfo.includes('of many') || pageInfo.includes('of'))) {
            console.log('📈 Auto-setting page size to 50 for better workflow...');
            
            try {
                await this.setPageSizeTo50();
                
                // Show helpful notification
                setTimeout(() => {
                    this.showNotification(
                        '🎯 Smart Optimization',
                        'Automatically set to 50 videos per page for better workflow!',
                        'info'
                    );
                }, 1000);
                
            } catch (error) {
                console.log('⚠️ Could not auto-optimize page size:', error.message);
            }
        } else if (currentVideos >= 50) {
            console.log('✅ Already showing 50+ videos, no optimization needed');
        } else {
            console.log('ℹ️ Playlist has ≤30 videos total, no optimization needed');
        }
    }

    async setPageSizeTo50() {
        return new Promise(async (resolve, reject) => {
            try {
                // Find the page size dropdown
                const pageSize = document.querySelector('#page-size');
                if (!pageSize) {
                    reject(new Error('Page size dropdown not found'));
                    return;
                }

                console.log('🖱️ Opening page size dropdown...');
                
                // Click to open dropdown
                const trigger = pageSize.querySelector('ytcp-dropdown-trigger');
                if (!trigger) {
                    reject(new Error('Dropdown trigger not found'));
                    return;
                }
                
                trigger.click();
                
                // Wait for dropdown to appear
                await this.delay(500);
                
                // Find and click the 50 option
                const dropdown = document.querySelector('ytcp-text-menu, tp-yt-paper-listbox');
                if (!dropdown) {
                    reject(new Error('Dropdown menu not found'));
                    return;
                }
                
                const options = dropdown.querySelectorAll('tp-yt-paper-item, [role="option"]');
                console.log(`📋 Found ${options.length} page size options`);
                
                let option50 = null;
                for (const option of options) {
                    const text = option.textContent.trim();
                    console.log(`   - Option: "${text}"`);
                    if (text === '50') {
                        option50 = option;
                        break;
                    }
                }
                
                if (!option50) {
                    // Close dropdown if we can't find 50
                    trigger.click();
                    reject(new Error('50 videos option not found'));
                    return;
                }
                
                console.log('🎯 Clicking 50 videos option...');
                option50.click();
                
                // Wait for page to reload with new count
                console.log('⏳ Waiting for page to reload with 50 videos...');
                await this.waitForPageReload();
                
                // Verify the change worked
                const newCount = document.querySelectorAll('ytcp-video-row').length;
                console.log(`✅ Page size optimization complete: ${newCount} videos now showing`);
                
                // Update our tracking
                this.totalVideosLoaded = newCount;
                this.analyzeCurrentState();
                
                resolve(newCount);
                
            } catch (error) {
                console.error('❌ Failed to set page size to 50:', error);
                reject(error);
            }
        });
    }

    async waitForPageReload() {
        return new Promise((resolve) => {
            const startCount = document.querySelectorAll('ytcp-video-row').length;
            let checkCount = 0;
            const maxChecks = 20; // 4 seconds max wait
            
            const checkForReload = () => {
                const currentCount = document.querySelectorAll('ytcp-video-row').length;
                checkCount++;
                
                // Page reloaded with more content
                if (currentCount > startCount) {
                    console.log(`✅ Page reloaded: ${startCount} → ${currentCount} videos`);
                    resolve();
                    return;
                }
                
                // Timeout reached
                if (checkCount >= maxChecks) {
                    console.log(`⏰ Reload timeout: still ${currentCount} videos`);
                    resolve(); // Don't fail, just continue
                    return;
                }
                
                // Continue checking
                setTimeout(checkForReload, 200);
            };
            
            // Start checking after brief delay
            setTimeout(checkForReload, 300);
        });
    }

    destroy() {
        const bypassContainer = document.getElementById('ysve-pagination-bypass');
        if (bypassContainer) {
            bypassContainer.remove();
        }
        
        const notificationStyles = document.getElementById('ysve-bypass-notification-styles');
        if (notificationStyles) {
            notificationStyles.remove();
        }
        
        console.log('🧹 Pagination Bypass: Cleaned up');
    }
}

// Initialize pagination bypass when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => {
            new PlaylistPaginationBypass();
        }, 1000);
    });
} else {
    setTimeout(() => {
        new PlaylistPaginationBypass();
    }, 1000);
}

// Listen for navigation changes (YouTube SPA)
let lastBypassUrl = location.href;
new MutationObserver(() => {
    const url = location.href;
    if (url !== lastBypassUrl) {
        lastBypassUrl = url;
        // Small delay to allow page to load
        setTimeout(() => {
            new PlaylistPaginationBypass();
        }, 2000);
    }
}).observe(document, { subtree: true, childList: true });