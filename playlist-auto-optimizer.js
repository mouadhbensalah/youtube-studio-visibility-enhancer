// playlist-auto-optimizer.js - Auto-set to 50 videos on playlist load
// Add this to your extension for automatic page size optimization

class PlaylistAutoOptimizer {
    constructor() {
        this.init();
    }

    init() {
        // Only run on playlist pages
        if (!this.isPlaylistPage()) return;
        
        console.log('🎯 Playlist Auto-Optimizer: Detected playlist page');
        
        // Wait for page to fully load, then optimize
        this.waitForPageLoad().then(() => {
            // Small delay to let everything settle
            setTimeout(() => {
                this.checkAndOptimize();
            }, 1500);
        });
    }

    isPlaylistPage() {
        const url = window.location.href;
        return url.includes('/playlist/') && url.includes('/videos');
    }

    async waitForPageLoad() {
        return new Promise((resolve) => {
            const checkReady = () => {
                const videoRows = document.querySelectorAll('ytcp-video-row');
                const pageSize = document.querySelector('#page-size');
                const pageInfo = document.querySelector('.page-description');
                
                if (videoRows.length > 0 && pageSize && pageInfo) {
                    console.log('✅ Page fully loaded, ready to optimize');
                    resolve();
                } else {
                    setTimeout(checkReady, 500);
                }
            };
            
            // Start checking after initial delay
            setTimeout(checkReady, 1000);
        });
    }

    async checkAndOptimize() {
        const currentCount = document.querySelectorAll('ytcp-video-row').length;
        const pageInfo = document.querySelector('.page-description')?.textContent || '';
        const pageSize = document.querySelector('#page-size');
        const currentPageSizeValue = pageSize?.value || 'unknown';
        
        console.log('📊 Auto-optimizer analysis:');
        console.log(`- Current videos showing: ${currentCount}`);
        console.log(`- Page info: "${pageInfo}"`);
        console.log(`- Current page size setting: ${currentPageSizeValue}`);
        
        // Optimize if showing 10 or 30 videos but more are available
        const shouldOptimize = (currentCount === 10 || currentCount === 30) && 
                              (pageInfo.includes('of many') || this.hasMorePages());
        
        if (shouldOptimize) {
            console.log(`🚀 Auto-optimizing from ${currentCount} to 50 videos for better workflow...`);
            
            try {
                const success = await this.setPageSizeTo50();
                
                if (success) {
                    const newCount = document.querySelectorAll('ytcp-video-row').length;
                    console.log(`✅ Auto-optimization successful: ${currentCount} → ${newCount} videos`);
                    
                    // Show success notification
                    this.showOptimizationNotification(currentCount, newCount);
                } else {
                    console.log('⚠️ Auto-optimization failed - dropdown method unsuccessful');
                }
                
            } catch (error) {
                console.log('⚠️ Auto-optimization error:', error.message);
            }
        } else if (currentCount >= 50) {
            console.log('✅ Already optimized - showing 50+ videos');
        } else if (!pageInfo.includes('of many') && !this.hasMorePages()) {
            console.log(`ℹ️ No optimization needed - playlist has only ${currentCount} videos total`);
        } else {
            console.log('ℹ️ No optimization triggered - conditions not met');
        }
    }

    hasMorePages() {
        // Check if Next button exists and is enabled
        const nextButton = document.querySelector('#navigate-after');
        if (!nextButton) return false;
        
        const isDisabled = nextButton.disabled || 
                          nextButton.getAttribute('aria-disabled') === 'true' ||
                          nextButton.hasAttribute('disabled');
        
        return !isDisabled; // Has more pages if Next button is NOT disabled
    }

    async setPageSizeTo50() {
        console.log('🔧 Setting page size to 50...');
        
        const pageSize = document.querySelector('#page-size');
        if (!pageSize) {
            throw new Error('Page size component not found');
        }
        
        // Step 1: Open dropdown
        const trigger = pageSize.querySelector('ytcp-dropdown-trigger');
        if (!trigger) {
            throw new Error('Dropdown trigger not found');
        }
        
        console.log('🖱️ Opening page size dropdown...');
        trigger.click();
        
        // Step 2: Wait for dropdown to appear
        await this.delay(800);
        
        // Step 3: Find correct dropdown (not creation-menu)
        const dropdowns = document.querySelectorAll('ytcp-text-menu');
        let correctDropdown = null;
        
        for (const dropdown of dropdowns) {
            // Skip creation menu
            if (dropdown.id === 'creation-menu') {
                continue;
            }
            
            // Look for dropdown with page size options
            const options = dropdown.querySelectorAll('tp-yt-paper-item');
            const optionTexts = Array.from(options).map(o => 
                o.querySelector('yt-formatted-string')?.textContent?.trim()
            ).filter(Boolean);
            
            // Check if this dropdown has page size options
            if (optionTexts.includes('10') && optionTexts.includes('30') && optionTexts.includes('50')) {
                correctDropdown = dropdown;
                console.log('✅ Found correct page size dropdown');
                console.log(`📋 Available options: [${optionTexts.join(', ')}]`);
                break;
            }
        }
        
        if (!correctDropdown) {
            throw new Error('Could not find page size dropdown with 50 option');
        }
        
        // Step 4: Find and click 50 option
        const option50 = correctDropdown.querySelector('tp-yt-paper-item[test-id="50"]') ||
                        Array.from(correctDropdown.querySelectorAll('tp-yt-paper-item')).find(item => 
                            item.querySelector('yt-formatted-string')?.textContent?.trim() === '50'
                        );
        
        if (!option50) {
            throw new Error('50 option not found in dropdown');
        }
        
        console.log('🎯 Clicking 50 option...');
        option50.click();
        
        // Step 5: Wait for page to reload with new page size
        console.log('⏳ Waiting for page to reload with 50 videos...');
        await this.waitForPageReload();
        
        // Step 6: Verify the change worked
        const newCount = document.querySelectorAll('ytcp-video-row').length;
        const newPageSizeValue = document.querySelector('#page-size')?.value;
        
        console.log(`📊 After optimization: ${newCount} videos, page size value: ${newPageSizeValue}`);
        
        return newCount >= 40; // Success if we got at least 40 videos (some playlists might have exactly 45, etc.)
    }

    async waitForPageReload() {
        return new Promise((resolve) => {
            const startTime = Date.now();
            const maxWait = 5000; // 5 seconds max
            let checksWithoutChange = 0;
            const maxChecksWithoutChange = 10; // Stop if no changes for 2 seconds
            
            const checkForReload = () => {
                const currentCount = document.querySelectorAll('ytcp-video-row').length;
                const elapsed = Date.now() - startTime;
                
                // Success: Got more videos
                if (currentCount >= 40) {
                    console.log(`✅ Page reloaded successfully: ${currentCount} videos now showing`);
                    resolve();
                    return;
                }
                
                // Keep checking if under time limit
                if (elapsed < maxWait) {
                    checksWithoutChange++;
                    if (checksWithoutChange >= maxChecksWithoutChange) {
                        console.log(`⏰ Stopped waiting: ${currentCount} videos after ${elapsed}ms`);
                        resolve(); // Don't fail, just continue
                    } else {
                        setTimeout(checkForReload, 200);
                    }
                } else {
                    console.log(`⏰ Timeout: ${currentCount} videos after ${elapsed}ms`);
                    resolve(); // Don't fail, just continue
                }
            };
            
            // Start checking after brief delay
            setTimeout(checkForReload, 300);
        });
    }

    showOptimizationNotification(fromCount, toCount) {
        // Don't show notification if already exists
        if (document.getElementById('auto-optimize-notification')) {
            return;
        }
        
        const notification = document.createElement('div');
        notification.id = 'auto-optimize-notification';
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(135deg, #4caf50, #45a049);
            color: white;
            padding: 16px 20px;
            border-radius: 8px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            box-shadow: 0 4px 20px rgba(0,0,0,0.2);
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255,255,255,0.2);
            z-index: 10000;
            animation: slideInRight 0.4s ease-out;
            max-width: 320px;
            cursor: pointer;
        `;
        
        notification.innerHTML = `
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
                <span style="font-size: 20px;">🎯</span>
                <div style="font-weight: 600; font-size: 15px;">Auto-Optimized!</div>
                <button onclick="this.parentElement.parentElement.remove()" style="
                    background: rgba(255,255,255,0.2);
                    border: none;
                    color: white;
                    padding: 2px 6px;
                    border-radius: 4px;
                    cursor: pointer;
                    margin-left: auto;
                    font-size: 12px;
                ">✕</button>
            </div>
            <div style="font-size: 13px; opacity: 0.9; line-height: 1.4;">
                Page size: <strong>${fromCount} → ${toCount} videos</strong><br>
                Ready for enhanced bulk operations!
            </div>
        `;
        
        // Add slide animation if not exists
        if (!document.getElementById('auto-optimize-animation')) {
            const style = document.createElement('style');
            style.id = 'auto-optimize-animation';
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
            if (document.body.contains(notification)) {
                notification.style.animation = 'slideOutRight 0.4s ease-out';
                setTimeout(() => notification.remove(), 400);
            }
        }, 5000);
        
        // Remove on click
        notification.addEventListener('click', () => {
            notification.remove();
        });
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Clean up method
    destroy() {
        const notification = document.getElementById('auto-optimize-notification');
        if (notification) {
            notification.remove();
        }
        
        const styles = document.getElementById('auto-optimize-animation');
        if (styles) {
            styles.remove();
        }
        
        console.log('🧹 Playlist Auto-Optimizer: Cleaned up');
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => {
            new PlaylistAutoOptimizer();
        }, 500);
    });
} else {
    setTimeout(() => {
        new PlaylistAutoOptimizer();
    }, 500);
}

// Handle YouTube SPA navigation
let lastOptimizerUrl = location.href;
new MutationObserver(() => {
    const url = location.href;
    if (url !== lastOptimizerUrl) {
        lastOptimizerUrl = url;
        // Small delay to allow page to load after navigation
        setTimeout(() => {
            new PlaylistAutoOptimizer();
        }, 1500);
    }
}).observe(document, { subtree: true, childList: true });

// Global access for debugging
window.PlaylistAutoOptimizer = PlaylistAutoOptimizer;