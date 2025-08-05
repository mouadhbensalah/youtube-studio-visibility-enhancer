// playlist-link-copier.js - One-Click Playlist Link Copy Button
// Adds a copy button to the playlist sidebar for instant clipboard access

class PlaylistLinkCopier {
    constructor() {
        this.playlistUrl = null;
        this.copyButton = null;
        this.globalShortcutHandler = null;
        this.init();
    }

    init() {
        // Only activate on playlist pages
        if (!this.isPlaylistPage()) return;
        
        console.log('📋 Playlist Link Copier: Initializing...');
        
        // Wait for sidebar to load
        this.waitForSidebar().then(() => {
            this.extractPlaylistUrl();
            this.createCopyButton();
            this.setupGlobalShortcut();
        });
    }

    isPlaylistPage() {
        const url = window.location.href;
        return url.includes('/playlist/') && (url.includes('/videos') || url.includes('/edit') || url.includes('/analytics'));
    }

    async waitForSidebar() {
        return new Promise((resolve) => {
            const checkSidebar = () => {
                const sidebar = document.querySelector('#left-nav');
                const mainMenu = document.querySelector('#main-menu');
                
                if (sidebar && mainMenu) {
                    console.log('✅ Sidebar detected, extracting playlist info...');
                    resolve();
                } else {
                    setTimeout(checkSidebar, 200);
                }
            };
            checkSidebar();
        });
    }

    extractPlaylistUrl() {
        // Method 1: From the overlay link (most reliable)
        const overlayLink = document.querySelector('#overlay-link-to-youtube');
        if (overlayLink && overlayLink.href) {
            this.playlistUrl = overlayLink.href;
            console.log('📋 Found playlist URL from overlay:', this.playlistUrl);
            return;
        }

        // Method 2: Extract from current URL
        const currentUrl = window.location.href;
        const playlistIdMatch = currentUrl.match(/\/playlist\/([^\/]+)/);
        if (playlistIdMatch) {
            const playlistId = playlistIdMatch[1];
            this.playlistUrl = `https://www.youtube.com/playlist?list=${playlistId}`;
            console.log('📋 Extracted playlist URL from current URL:', this.playlistUrl);
            return;
        }

        // Method 3: Try to find any YouTube playlist link in the page
        const allLinks = document.querySelectorAll('a[href*="youtube.com/playlist"]');
        if (allLinks.length > 0) {
            this.playlistUrl = allLinks[0].href;
            console.log('📋 Found playlist URL from page links:', this.playlistUrl);
            return;
        }

        console.warn('📋 Could not extract playlist URL');
    }

    createCopyButton() {
        if (!this.playlistUrl) {
            console.warn('📋 No playlist URL found, cannot create copy button');
            return;
        }

        // Check if button already exists
        if (document.getElementById('ysve-copy-playlist-btn')) {
            console.log('📋 Copy button already exists');
            return;
        }

        // Find the main menu list (where Details, Videos, Analytics are)
        const mainMenu = document.querySelector('#main-menu');
        
        if (!mainMenu) {
            console.warn('📋 Could not find main menu in sidebar');
            return;
        }

        // Create a new menu item that matches YouTube's style
        const menuItem = document.createElement('li');
        menuItem.role = 'presentation';
        menuItem.className = 'style-scope ytcp-navigation-drawer';
        menuItem.id = 'ysve-copy-playlist-menu-item';

        menuItem.innerHTML = `
            <ytcp-ve track-click="" class="style-scope ytcp-navigation-drawer" role="none">
                <button id="ysve-copy-playlist-btn" class="menu-item-link ysve-copy-playlist-button style-scope ytcp-navigation-drawer" role="menuitem">
                    <tp-yt-paper-icon-item role="button" tabindex="-1" class="style-scope ytcp-navigation-drawer" style-target="host" aria-disabled="false">
                        <div id="contentIcon" class="content-icon style-scope tp-yt-paper-icon-item">
                            <div class="ysve-copy-icon style-scope ytcp-navigation-drawer">📋</div>
                        </div>
                        <div class="nav-item-text ysve-copy-text style-scope ytcp-navigation-drawer">Copy Playlist Link</div>
                        <div class="ysve-author-credit" style="font-size: 9px; opacity: 0.5; margin-left: auto; padding-right: 8px;">Salih</div>
                    </tp-yt-paper-icon-item>
                </button>
            </ytcp-ve>
        `;

        // Insert after the "Videos" menu item (which is usually the second item)
        const videoMenuItem = mainMenu.children[1]; // Videos is typically the 2nd item
        if (videoMenuItem && videoMenuItem.nextSibling) {
            mainMenu.insertBefore(menuItem, videoMenuItem.nextSibling);
        } else {
            // Fallback: append to the end
            mainMenu.appendChild(menuItem);
        }

        // Add styles
        this.addCopyButtonStyles();

        // Add event listener
        this.attachCopyButtonListener();

        console.log('✅ Copy playlist button created as menu item');
    }

    addCopyButtonStyles() {
        if (document.getElementById('ysve-copy-playlist-styles')) return;

        const style = document.createElement('style');
        style.id = 'ysve-copy-playlist-styles';
        style.textContent = `
            .ysve-copy-playlist-button {
                width: 100%;
                display: flex;
                align-items: center;
                background: transparent;
                border: none;
                cursor: pointer;
                transition: all 0.2s ease;
                font-family: inherit;
                color: inherit;
                text-align: left;
                padding: 0;
                text-decoration: none;
            }

            .ysve-copy-playlist-button:hover {
                background: rgba(96, 96, 96, 0.08);
            }

            .ysve-copy-playlist-button:hover .ysve-copy-icon,
            .ysve-copy-playlist-button:hover .ysve-copy-text {
                color: rgba(96, 96, 96, 1);
            }

            .ysve-copy-playlist-button:active {
                background: rgba(96, 96, 96, 0.12);
            }

            .ysve-copy-icon {
                font-size: 18px;
                width: 24px;
                height: 24px;
                display: flex;
                align-items: center;
                justify-content: center;
                color: rgba(96, 96, 96, 0.88);
            }

            /* Better alignment with YouTube's native menu items */
            .ysve-copy-playlist-button .content-icon {
                margin-right: 24px;
                margin-left: -20px;
                padding-left: 0;
                width: 24px;
            }

            .ysve-copy-playlist-button tp-yt-paper-icon-item {
                padding-left: 0;
                padding-right: 16px;
                margin-left: -20px;
                display: flex;
                align-items: center;
            }

            .ysve-copy-text {
                flex: 1;
                font-size: 14px;
                font-weight: 400;
                color: rgba(96, 96, 96, 0.88);
                min-width: 0;
                letter-spacing: 0.25px;
            }

            .ysve-author-credit {
                transition: opacity 0.2s ease;
                font-size: 8px;
                color: rgba(96, 96, 96, 0.6);
                font-weight: 300;
            }

            .ysve-copy-playlist-button:hover .ysve-author-credit {
                opacity: 0.3;
            }

            /* Success state */
            .ysve-copy-playlist-button.success {
                background: rgba(76, 175, 80, 0.1);
            }

            .ysve-copy-playlist-button.success .ysve-copy-text {
                color: #4caf50;
            }

            .ysve-copy-playlist-button.success .ysve-copy-icon {
                transform: scale(1.1);
            }

            /* Dark mode compatibility */
            @media (prefers-color-scheme: dark) {
                .ysve-copy-playlist-button:hover {
                    background: rgba(255, 255, 255, 0.08);
                }

                .ysve-copy-playlist-button.success {
                    background: rgba(76, 175, 80, 0.15);
                }
            }
        `;

        document.head.appendChild(style);
    }

    attachCopyButtonListener() {
        const copyButton = document.getElementById('ysve-copy-playlist-btn');
        if (!copyButton) return;

        copyButton.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            await this.copyPlaylistLink();
        });
    }

    setupGlobalShortcut() {
        // Global Ctrl+C shortcut for copying playlist link
        this.globalShortcutHandler = (e) => {
            // Only trigger if Ctrl+C is pressed and we're not in an input field
            if ((e.ctrlKey || e.metaKey) && e.key === 'c' && 
                !['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName) &&
                !e.target.isContentEditable) {
                
                // Check if there's any text selected on the page
                const selection = window.getSelection();
                if (selection && selection.toString().length > 0) {
                    // Let default copy behavior handle selected text
                    return;
                }
                
                // No text selected, copy playlist link instead
                e.preventDefault();
                this.copyPlaylistLinkGlobal();
            }
        };
        
        document.addEventListener('keydown', this.globalShortcutHandler);
        console.log('⌨️ Global Ctrl+C shortcut active for playlist link copying');
    }

    async copyPlaylistLink() {
        const button = document.getElementById('ysve-copy-playlist-btn');
        const iconEl = button.querySelector('.ysve-copy-icon');
        const titleEl = button.querySelector('.ysve-copy-text');
        
        const originalTitle = titleEl.textContent;
        const originalIcon = iconEl.textContent;

        try {
            // Copy to clipboard
            await navigator.clipboard.writeText(this.playlistUrl);
            
            // Success feedback
            button.classList.add('success');
            iconEl.textContent = '✅';
            titleEl.textContent = 'Link Copied!';
            
            // Log for debugging
            console.log('📋 Playlist link copied to clipboard:', this.playlistUrl);
            
            // Reset after 2.5 seconds
            setTimeout(() => {
                button.classList.remove('success');
                iconEl.textContent = originalIcon;
                titleEl.textContent = originalTitle;
            }, 2500);
            
        } catch (error) {
            console.error('📋 Failed to copy playlist link:', error);
            
            // Fallback for older browsers or failed copy
            this.fallbackCopy();
            
            // Error feedback
            iconEl.textContent = '⚠️';
            titleEl.textContent = 'Copy Failed';
            
            // Show the link in console for manual copy
            console.log('📋 Manual copy - Playlist link:', this.playlistUrl);
            
            // Reset after 3 seconds
            setTimeout(() => {
                iconEl.textContent = originalIcon;
                titleEl.textContent = originalTitle;
            }, 3000);
        }
    }

    async copyPlaylistLinkGlobal() {
        if (!this.playlistUrl) return;
        
        try {
            await navigator.clipboard.writeText(this.playlistUrl);
            
            // Show temporary notification
            this.showGlobalCopyNotification();
            
            console.log('📋 Playlist link copied via Ctrl+C:', this.playlistUrl);
            
        } catch (error) {
            console.error('📋 Failed to copy playlist link via Ctrl+C:', error);
            this.fallbackCopy();
        }
    }

    showGlobalCopyNotification() {
        // Create temporary notification
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: rgba(76, 175, 80, 0.95);
            color: white;
            padding: 12px 20px;
            border-radius: 6px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 14px;
            font-weight: 500;
            z-index: 10000;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255,255,255,0.2);
            animation: slideInRight 0.3s ease-out;
        `;
        
        notification.innerHTML = `
            <div style="display: flex; align-items: center; gap: 8px;">
                <span>📋</span>
                <span>Playlist link copied!</span>
                <span style="opacity: 0.7; font-size: 12px;">Ctrl+C</span>
            </div>
        `;
        
        // Add slide animation
        if (!document.getElementById('ysve-global-copy-animation')) {
            const animationStyle = document.createElement('style');
            animationStyle.id = 'ysve-global-copy-animation';
            animationStyle.textContent = `
                @keyframes slideInRight {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                @keyframes slideOutRight {
                    from { transform: translateX(0); opacity: 1; }
                    to { transform: translateX(100%); opacity: 0; }
                }
            `;
            document.head.appendChild(animationStyle);
        }
        
        document.body.appendChild(notification);
        
        // Auto-remove after 2.5 seconds
        setTimeout(() => {
            notification.style.animation = 'slideOutRight 0.3s ease-out';
            setTimeout(() => notification.remove(), 300);
        }, 2500);
    }

    fallbackCopy() {
        // Fallback method for older browsers
        try {
            const textArea = document.createElement('textarea');
            textArea.value = this.playlistUrl;
            textArea.style.position = 'fixed';
            textArea.style.opacity = '0';
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            
            console.log('📋 Fallback copy successful');
        } catch (fallbackError) {
            console.error('📋 Fallback copy also failed:', fallbackError);
        }
    }

    // Handle URL changes (YouTube SPA navigation)
    observeUrlChanges() {
        let lastUrl = location.href;
        new MutationObserver(() => {
            const url = location.href;
            if (url !== lastUrl) {
                lastUrl = url;
                // Reinitialize if we're still on a playlist page
                if (this.isPlaylistPage()) {
                    setTimeout(() => {
                        this.extractPlaylistUrl();
                        if (!document.getElementById('ysve-copy-playlist-btn')) {
                            this.createCopyButton();
                            this.setupGlobalShortcut();
                        }
                    }, 1000);
                } else {
                    // Remove button if we're no longer on a playlist page
                    const menuItem = document.getElementById('ysve-copy-playlist-menu-item');
                    if (menuItem) {
                        menuItem.remove();
                    }
                }
            }
        }).observe(document, { subtree: true, childList: true });
    }

    destroy() {
        // Clean up
        const menuItem = document.getElementById('ysve-copy-playlist-menu-item');
        if (menuItem) {
            menuItem.remove();
        }
        
        const styles = document.getElementById('ysve-copy-playlist-styles');
        if (styles) {
            styles.remove();
        }
        
        const animationStyles = document.getElementById('ysve-global-copy-animation');
        if (animationStyles) {
            animationStyles.remove();
        }
        
        // Remove global shortcut listener
        if (this.globalShortcutHandler) {
            document.removeEventListener('keydown', this.globalShortcutHandler);
        }
        
        console.log('🧹 Playlist Link Copier: Cleaned up');
    }
}

// Initialize playlist link copier when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        const copier = new PlaylistLinkCopier();
        copier.observeUrlChanges();
    });
} else {
    const copier = new PlaylistLinkCopier();
    copier.observeUrlChanges();
}

// Also listen for navigation changes (YouTube SPA)
let lastCopierUrl = location.href;
new MutationObserver(() => {
    const url = location.href;
    if (url !== lastCopierUrl) {
        lastCopierUrl = url;
        // Small delay to allow page to load
        setTimeout(() => {
            new PlaylistLinkCopier();
        }, 1000);
    }
}).observe(document, { subtree: true, childList: true });