// playlist-link-copier.js - One-Click Playlist Link Copy Button
// Adds a copy button to the playlist sidebar for instant clipboard access

class PlaylistLinkCopier {
    constructor() {
        this.playlistUrl = null;
        this.copyButton = null;
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
                const entityContainer = document.querySelector('#entity-label-container');
                
                if (sidebar && entityContainer) {
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

        // Find the playlist title in the sidebar (where "⚗️ Chimie Organique ~ 2ème Prépa" appears)
        const playlistTitleElement = document.querySelector('#entity-name, .entity-name');
        
        if (!playlistTitleElement) {
            console.warn('📋 Could not find playlist title element in sidebar');
            return;
        }

        // Create the copy button container
        const buttonContainer = document.createElement('div');
        buttonContainer.id = 'ysve-copy-playlist-container';
        buttonContainer.style.cssText = `
            margin: 8px 0 12px 0;
            padding: 0;
        `;

        buttonContainer.innerHTML = `
            <button id="ysve-copy-playlist-btn" class="ysve-copy-playlist-button">
                <div class="ysve-copy-icon">📋</div>
                <div class="ysve-copy-text">Copy Playlist Link</div>
                <div class="ysve-copy-status">📋</div>
            </button>
        `;

        // Insert right after the playlist title
        playlistTitleElement.parentNode.insertBefore(buttonContainer, playlistTitleElement.nextSibling);

        // Add styles
        this.addCopyButtonStyles();

        // Add event listener
        this.attachCopyButtonListener();

        console.log('✅ Copy playlist button created and inserted after playlist title');
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
                gap: 8px;
                padding: 8px 12px;
                background: rgba(33, 150, 243, 0.08);
                border: 1px solid rgba(33, 150, 243, 0.2);
                border-radius: 6px;
                cursor: pointer;
                transition: all 0.2s ease;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                color: inherit;
                text-align: left;
                font-size: 12px;
            }

            .ysve-copy-playlist-button:hover {
                background: rgba(33, 150, 243, 0.12);
                border-color: rgba(33, 150, 243, 0.3);
                transform: translateY(-1px);
                box-shadow: 0 2px 6px rgba(33, 150, 243, 0.15);
            }

            .ysve-copy-playlist-button:active {
                transform: translateY(0);
                box-shadow: 0 1px 3px rgba(33, 150, 243, 0.2);
            }

            .ysve-copy-icon {
                font-size: 14px;
                min-width: 16px;
                text-align: center;
            }

            .ysve-copy-text {
                flex: 1;
                font-weight: 500;
                color: #1976d2;
                min-width: 0;
            }

            .ysve-copy-status {
                font-size: 12px;
                opacity: 0.7;
                transition: all 0.3s ease;
            }

            /* Success state */
            .ysve-copy-playlist-button.success {
                background: rgba(76, 175, 80, 0.1);
                border-color: rgba(76, 175, 80, 0.3);
            }

            .ysve-copy-playlist-button.success .ysve-copy-text {
                color: #4caf50;
            }

            .ysve-copy-playlist-button.success .ysve-copy-status {
                opacity: 1;
                transform: scale(1.1);
            }

            /* Dark mode compatibility */
            @media (prefers-color-scheme: dark) {
                .ysve-copy-playlist-button {
                    background: rgba(33, 150, 243, 0.12);
                    border-color: rgba(33, 150, 243, 0.25);
                }

                .ysve-copy-playlist-button:hover {
                    background: rgba(33, 150, 243, 0.18);
                    border-color: rgba(33, 150, 243, 0.35);
                }

                .ysve-copy-subtitle {
                    color: #ccc;
                }

                .ysve-copy-playlist-button.success {
                    background: rgba(76, 175, 80, 0.15);
                    border-color: rgba(76, 175, 80, 0.35);
                }
            }

            /* Animation for status change */
            @keyframes ysve-copy-success {
                0% { transform: scale(1); }
                50% { transform: scale(1.2); }
                100% { transform: scale(1); }
            }

            .ysve-copy-status.animate {
                animation: ysve-copy-success 0.4s ease-out;
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

    async copyPlaylistLink() {
        const button = document.getElementById('ysve-copy-playlist-btn');
        const statusIcon = button.querySelector('.ysve-copy-status');
        const titleEl = button.querySelector('.ysve-copy-text');
        
        const originalTitle = titleEl.textContent;
        const originalIcon = statusIcon.textContent;

        try {
            // Copy to clipboard
            await navigator.clipboard.writeText(this.playlistUrl);
            
            // Success feedback
            button.classList.add('success');
            statusIcon.textContent = '✅';
            statusIcon.classList.add('animate');
            titleEl.textContent = 'Link Copied!';
            
            // Log for debugging
            console.log('📋 Playlist link copied to clipboard:', this.playlistUrl);
            
            // Reset after 2.5 seconds
            setTimeout(() => {
                button.classList.remove('success');
                statusIcon.classList.remove('animate');
                statusIcon.textContent = originalIcon;
                titleEl.textContent = originalTitle;
            }, 2500);
            
        } catch (error) {
            console.error('📋 Failed to copy playlist link:', error);
            
            // Fallback for older browsers or failed copy
            this.fallbackCopy();
            
            // Error feedback
            statusIcon.textContent = '⚠️';
            titleEl.textContent = 'Copy Failed';
            
            // Show the link in console for manual copy
            console.log('📋 Manual copy - Playlist link:', this.playlistUrl);
            
            // Reset after 3 seconds
            setTimeout(() => {
                statusIcon.textContent = originalIcon;
                titleEl.textContent = originalTitle;
            }, 3000);
        }
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
                        }
                    }, 1000);
                } else {
                    // Remove button if we're no longer on a playlist page
                    const container = document.getElementById('ysve-copy-playlist-container');
                    if (container) {
                        container.remove();
                    }
                }
            }
        }).observe(document, { subtree: true, childList: true });
    }

    destroy() {
        // Clean up
        const container = document.getElementById('ysve-copy-playlist-container');
        if (container) {
            container.remove();
        }
        
        const styles = document.getElementById('ysve-copy-playlist-styles');
        if (styles) {
            styles.remove();
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