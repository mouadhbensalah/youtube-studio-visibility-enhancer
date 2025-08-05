// YouTube Studio Visibility Enhancer - Content Script
class YouTubeVisibilityEnhancer {
  constructor() {
    this.isActive = false;
    this.batchMode = false;
    this.selectedVideos = new Set();
    this.originalElements = new Map();
    this.undoStack = [];
    
    this.init();
  }

  init() {
    // Wait for YouTube Studio to load
    this.waitForStudioLoad();
    
    // Listen for navigation changes (YouTube is SPA)
    this.observeNavigation();
    
    // Listen for keyboard shortcuts
    this.setupKeyboardShortcuts();
  }

  waitForStudioLoad() {
    const checkInterval = setInterval(() => {
      if (document.querySelector('ytcp-video-metadata-visibility') || 
          document.querySelector('ytcp-video-visibility-select') || 
          document.querySelector('[data-video-id]')) {
        clearInterval(checkInterval);
        this.enhanceVisibilityControls();
      }
    }, 1000);
  }

  observeNavigation() {
    // Monitor for YouTube Studio navigation changes
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.addedNodes.length > 0) {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === 1) { // Element node
              if (node.querySelector && node.querySelector('ytcp-video-visibility-select')) {
                setTimeout(() => this.enhanceVisibilityControls(), 500);
              }
            }
          });
        }
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  enhanceVisibilityControls() {
    // Handle single video edit page
    this.enhanceSingleVideoPage();
    
    // Handle video list/dashboard page
    this.enhanceVideoListPage();
  }

  enhanceSingleVideoPage() {
    // Target the visibility section in the sidebar
    const visibilitySection = document.querySelector('ytcp-video-metadata-visibility');
    if (!visibilitySection || visibilitySection.dataset.enhanced) return;

    visibilitySection.dataset.enhanced = 'true';
    
    // Get current visibility state
    const visibilityText = visibilitySection.querySelector('#visibility-text');
    const currentVisibility = visibilityText ? visibilityText.textContent.trim() : 'Unlisted';
    
    // Create enhanced UI and insert it above the original
    const enhancedContainer = this.createEnhancedInlineControls(null, currentVisibility);
    
    // Insert before the original visibility section
    visibilitySection.parentNode.insertBefore(enhancedContainer, visibilitySection);
    
    // Hide the original dropdown-style interface
    visibilitySection.style.display = 'none';

    // Auto-save functionality
    this.setupAutoSave(enhancedContainer);
  }

  enhanceVideoListPage() {
    // Look for video rows in the content library
    const videoRows = document.querySelectorAll('[data-video-id]:not([data-enhanced])');
    
    videoRows.forEach(row => {
      row.dataset.enhanced = 'true';
      this.addInlineVisibilityToRow(row);
    });

    // Add batch controls if multiple videos present
    if (videoRows.length > 1) {
      this.addBatchControls();
    }
  }

  createEnhancedInlineControls(originalRadioGroup, currentVisibility = 'Unlisted') {
    const container = document.createElement('div');
    container.className = 'yt-visibility-enhanced-container';
    container.innerHTML = `
      <div class="yt-visibility-enhanced-header">
        <div class="header-main">
          <div class="header-icon">🚀</div>
          <h3>Quick Visibility</h3>
          <div class="safe-mode-badge">SAFE MODE</div>
        </div>
        <div class="yt-visibility-shortcuts">
          <kbd>1</kbd> Private · <kbd>2</kbd> Unlisted · <kbd>3</kbd> Public ⚠️
        </div>
      </div>
      <div class="yt-visibility-enhanced-controls">
        <label class="yt-visibility-option" data-value="PRIVATE" title="Only you can see this video. Perfect for drafts and private content.">
          <div class="radio-section">
            <input type="radio" name="visibility" value="PRIVATE">
            <span class="radio-custom"></span>
          </div>
          <div class="label-section">
            <strong>🔒 Private</strong>
          </div>
        </label>
        <label class="yt-visibility-option" data-value="UNLISTED" title="Anyone with the link can view. Good for sharing with specific people.">
          <div class="radio-section">
            <input type="radio" name="visibility" value="UNLISTED">
            <span class="radio-custom"></span>
          </div>
          <div class="label-section">
            <strong>🔗 Unlisted</strong>
          </div>
        </label>
        <label class="yt-visibility-option" data-value="PUBLIC" title="⚠️ EVERYONE on YouTube can find and watch this video!">
          <div class="radio-section">
            <input type="radio" name="visibility" value="PUBLIC">
            <span class="radio-custom"></span>
          </div>
          <div class="label-section">
            <strong>⚠️ Public</strong>
          </div>
        </label>
      </div>
      <div class="yt-visibility-status">
        <span class="status-text">Ready to save</span>
        <button class="undo-btn" disabled>↶ Undo</button>
      </div>
      <div class="safety-notice">
        <small>Public changes require confirmation to prevent accidents</small>
      </div>
    `;

    // Set current selection based on the actual YouTube visibility
    const visibilityMap = {
      'Private': 'PRIVATE',
      'Unlisted': 'UNLISTED', 
      'Public': 'PUBLIC'
    };
    
    const mappedValue = visibilityMap[currentVisibility] || 'UNLISTED';
    const radio = container.querySelector(`input[value="${mappedValue}"]`);
    if (radio) radio.checked = true;

    return container;
  }

  addInlineVisibilityToRow(videoRow) {
    const videoId = videoRow.dataset.videoId;
    if (!videoId) return;

    // Find insertion point (usually after title/thumbnail)
    const insertPoint = videoRow.querySelector('.video-title') || 
                       videoRow.querySelector('[id*="video-title"]') ||
                       videoRow.children[1];

    if (!insertPoint) return;

    const inlineControls = document.createElement('div');
    inlineControls.className = 'yt-visibility-row-controls';
    inlineControls.innerHTML = `
      <div class="batch-checkbox">
        <input type="checkbox" data-video-id="${videoId}">
      </div>
      <div class="visibility-buttons">
        <button class="vis-btn private" data-value="PRIVATE" title="Set Private (1)">🔒</button>
        <button class="vis-btn unlisted active" data-value="UNLISTED" title="Set Unlisted (2)">🔗</button>
        <button class="vis-btn public" data-value="PUBLIC" title="Set Public (3)">🌐</button>
      </div>
      <div class="quick-status">Unlisted</div>
    `;

    insertPoint.parentNode.insertBefore(inlineControls, insertPoint.nextSibling);

    // Add click handlers
    this.setupRowControlHandlers(inlineControls, videoId);
  }

  addBatchControls() {
    if (document.querySelector('.yt-batch-controls')) return;

    const batchControls = document.createElement('div');
    batchControls.className = 'yt-batch-controls';
    batchControls.innerHTML = `
      <div class="batch-header">
        <button class="batch-toggle">📋 Batch Mode</button>
        <span class="selected-count">0 selected</span>
      </div>
      <div class="batch-actions" style="display: none;">
        <button class="batch-action" data-action="private">Set Selected to Private</button>
        <button class="batch-action" data-action="unlisted">Set Selected to Unlisted</button>
        <button class="batch-action" data-action="public">Set Selected to Public</button>
        <button class="batch-clear">Clear Selection</button>
      </div>
    `;

    // Insert at top of content area
    const contentArea = document.querySelector('#content') || 
                       document.querySelector('.content-area') ||
                       document.body;
    contentArea.insertBefore(batchControls, contentArea.firstChild);

    this.setupBatchControlHandlers(batchControls);
  }

  setupAutoSave(container) {
    const radios = container.querySelectorAll('input[type="radio"]');
    const statusText = container.querySelector('.status-text');
    const undoBtn = container.querySelector('.undo-btn');

    radios.forEach(radio => {
      radio.addEventListener('change', (e) => {
        if (e.target.checked) {
          const newValue = e.target.value;
          const oldValue = this.getCurrentVisibility();
          
          // SAFETY CHECK: Confirm before making video PUBLIC
          if (newValue === 'PUBLIC') {
            const confirmPublic = confirm(
              '⚠️ MAKE VIDEO PUBLIC?\n\n' +
              'This will make your video visible to EVERYONE on YouTube.\n' +
              'Anyone can search for and watch this video.\n\n' +
              'Are you absolutely sure you want to continue?'
            );
            
            if (!confirmPublic) {
              // User cancelled - revert to previous selection
              const oldRadio = container.querySelector(`input[value="${oldValue}"]`);
              if (oldRadio) {
                oldRadio.checked = true;
              }
              statusText.textContent = 'Public change cancelled';
              statusText.style.color = '#ff6b6b';
              setTimeout(() => {
                statusText.style.color = '';
                statusText.textContent = `Still ${this.getVisibilityLabel(oldValue)}`;
              }, 2000);
              return;
            }
          }
          
          // SAFETY CHECK: Warn when changing FROM public
          if (oldValue === 'PUBLIC' && newValue !== 'PUBLIC') {
            const confirmChange = confirm(
              '📊 CHANGE FROM PUBLIC?\n\n' +
              'Your video is currently PUBLIC and may have views/engagement.\n' +
              'Changing to ' + this.getVisibilityLabel(newValue) + ' will affect its discoverability.\n\n' +
              'Continue with this change?'
            );
            
            if (!confirmChange) {
              // User cancelled - revert to PUBLIC
              const publicRadio = container.querySelector(`input[value="PUBLIC"]`);
              if (publicRadio) {
                publicRadio.checked = true;
              }
              statusText.textContent = 'Change cancelled';
              statusText.style.color = '#ff6b6b';
              setTimeout(() => {
                statusText.style.color = '';
                statusText.textContent = 'Still Public';
              }, 2000);
              return;
            }
          }

          // Proceed with the change
          this.undoStack.push({
            action: 'visibility-change',
            oldValue: oldValue,
            newValue: newValue,
            timestamp: Date.now()
          });

          undoBtn.disabled = false;
          statusText.textContent = 'Saving...';
          statusText.style.color = '#2196f3';
          
          // Trigger the YouTube change
          this.triggerYouTubeVisibilityChange(newValue);
          
          setTimeout(() => {
            statusText.style.color = '#4caf50';
            statusText.textContent = `✓ Set to ${this.getVisibilityLabel(newValue)}`;
          }, 800);
        }
      });
    });

    undoBtn.addEventListener('click', () => {
      this.performUndo();
    });
  }

  setupRowControlHandlers(controls, videoId) {
    const buttons = controls.querySelectorAll('.vis-btn');
    const checkbox = controls.querySelector('input[type="checkbox"]');
    const status = controls.querySelector('.quick-status');

    buttons.forEach(button => {
      button.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        const newValue = button.dataset.value;
        
        // Update UI immediately
        buttons.forEach(b => b.classList.remove('active'));
        button.classList.add('active');
        status.textContent = this.getVisibilityLabel(newValue);
        
        // Queue the API call
        this.queueVisibilityChange(videoId, newValue);
      });
    });

    checkbox.addEventListener('change', (e) => {
      if (e.target.checked) {
        this.selectedVideos.add(videoId);
      } else {
        this.selectedVideos.delete(videoId);
      }
      this.updateBatchCounter();
    });
  }

  setupBatchControlHandlers(batchControls) {
    const toggleBtn = batchControls.querySelector('.batch-toggle');
    const actions = batchControls.querySelector('.batch-actions');
    const actionBtns = batchControls.querySelectorAll('.batch-action');
    const clearBtn = batchControls.querySelector('.batch-clear');

    toggleBtn.addEventListener('click', () => {
      this.batchMode = !this.batchMode;
      actions.style.display = this.batchMode ? 'flex' : 'none';
      
      // Show/hide checkboxes
      document.querySelectorAll('.batch-checkbox').forEach(cb => {
        cb.style.display = this.batchMode ? 'block' : 'none';
      });
      
      toggleBtn.textContent = this.batchMode ? '✓ Batch Mode' : '📋 Batch Mode';
    });

    actionBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action.toUpperCase();
        this.performBatchAction(action);
      });
    });

    clearBtn.addEventListener('click', () => {
      this.selectedVideos.clear();
      document.querySelectorAll('.batch-checkbox input').forEach(cb => {
        cb.checked = false;
      });
      this.updateBatchCounter();
    });
  }

  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Only trigger on single video pages and when not typing
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      
      const container = document.querySelector('.yt-visibility-enhanced-container');
      if (!container) return;

      switch(e.key) {
        case '1':
          e.preventDefault();
          this.setVisibility('PRIVATE');
          break;
        case '2':
          e.preventDefault();
          this.setVisibility('UNLISTED');
          break;
        case '3':
          e.preventDefault();
          this.setVisibility('PUBLIC');
          break;
        case 'z':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            this.performUndo();
          }
          break;
      }
    });
  }

  setVisibility(value) {
    const radio = document.querySelector(`.yt-visibility-enhanced-container input[value="${value}"]`);
    if (radio) {
      // For PUBLIC, always show confirmation even with keyboard shortcut
      if (value === 'PUBLIC') {
        const confirmPublic = confirm(
          '⚠️ KEYBOARD SHORTCUT: MAKE PUBLIC?\n\n' +
          'You pressed "3" to make this video PUBLIC.\n' +
          'This will make it visible to EVERYONE on YouTube.\n\n' +
          'Continue?'
        );
        
        if (!confirmPublic) {
          return; // Don't change anything
        }
      }
      
      radio.checked = true;
      radio.dispatchEvent(new Event('change'));
    }
  }

  triggerYouTubeVisibilityChange(newValue) {
    // Method 1: Try to click the visibility dropdown button
    const dropdownButton = document.querySelector('ytcp-video-metadata-visibility #select-button');
    if (dropdownButton) {
      dropdownButton.click();
      
      // Wait for the dropdown to appear, then select the option
      setTimeout(() => {
        // Look for the visibility popup/dialog
        const visibilityDialog = document.querySelector('ytcp-video-visibility-edit-popup');
        if (visibilityDialog) {
          const targetRadio = visibilityDialog.querySelector(`tp-yt-paper-radio-button[name="${newValue}"]`);
          if (targetRadio) {
            targetRadio.click();
            
            // Click Done/Save button
            setTimeout(() => {
              const doneBtn = visibilityDialog.querySelector('[aria-label*="Done"], [aria-label*="Save"], .save-button, .done-button');
              if (doneBtn && !doneBtn.disabled) {
                doneBtn.click();
              }
            }, 100);
          }
        }
      }, 300);
    }
    
    // Method 2: Try to trigger save button in header
    setTimeout(() => {
      const saveBtn = document.querySelector('#save');
      if (saveBtn && !saveBtn.disabled) {
        saveBtn.click();
      }
    }, 600);
  }

  queueVisibilityChange(videoId, visibility) {
    // In a real implementation, this would call YouTube's API
    // For now, we'll simulate the change with visual feedback
    console.log(`Queued: Set video ${videoId} to ${visibility}`);
    
    // Store the change for potential undo
    this.undoStack.push({
      action: 'batch-change',
      videoId: videoId,
      newValue: visibility,
      timestamp: Date.now()
    });
  }

  performBatchAction(visibility) {
    if (this.selectedVideos.size === 0) {
      alert('Please select videos first');
      return;
    }

    const count = this.selectedVideos.size;
    if (!confirm(`Set ${count} video${count > 1 ? 's' : ''} to ${this.getVisibilityLabel(visibility)}?`)) {
      return;
    }

    // Process batch with progress indicator
    this.showBatchProgress(count);
    
    let processed = 0;
    this.selectedVideos.forEach(videoId => {
      setTimeout(() => {
        this.queueVisibilityChange(videoId, visibility);
        processed++;
        this.updateBatchProgress(processed, count);
        
        if (processed === count) {
          this.hideBatchProgress();
          this.selectedVideos.clear();
          this.updateBatchCounter();
        }
      }, processed * 200); // Stagger requests to avoid rate limiting
    });
  }

  performUndo() {
    if (this.undoStack.length === 0) return;
    
    const lastAction = this.undoStack.pop();
    
    if (lastAction.action === 'visibility-change') {
      this.setVisibility(lastAction.oldValue);
    }
    
    const undoBtn = document.querySelector('.undo-btn');
    if (undoBtn) {
      undoBtn.disabled = this.undoStack.length === 0;
    }
  }

  updateBatchCounter() {
    const counter = document.querySelector('.selected-count');
    if (counter) {
      const count = this.selectedVideos.size;
      counter.textContent = `${count} selected`;
    }
  }

  showBatchProgress(total) {
    const progressEl = document.createElement('div');
    progressEl.className = 'yt-batch-progress';
    progressEl.innerHTML = `
      <div class="progress-bar">
        <div class="progress-fill" style="width: 0%"></div>
      </div>
      <span class="progress-text">Processing 0 of ${total}...</span>
    `;
    document.body.appendChild(progressEl);
  }

  updateBatchProgress(current, total) {
    const progressEl = document.querySelector('.yt-batch-progress');
    if (progressEl) {
      const fill = progressEl.querySelector('.progress-fill');
      const text = progressEl.querySelector('.progress-text');
      
      const percent = (current / total) * 100;
      fill.style.width = `${percent}%`;
      text.textContent = `Processing ${current} of ${total}...`;
    }
  }

  hideBatchProgress() {
    const progressEl = document.querySelector('.yt-batch-progress');
    if (progressEl) {
      setTimeout(() => progressEl.remove(), 1000);
    }
  }

  getCurrentVisibility() {
    const selected = document.querySelector('tp-yt-paper-radio-button.iron-selected');
    return selected ? selected.getAttribute('name') : 'UNLISTED';
  }

  getVisibilityLabel(value) {
    const labels = {
      'PRIVATE': 'Private',
      'UNLISTED': 'Unlisted', 
      'PUBLIC': 'Public'
    };
    return labels[value] || value;
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new YouTubeVisibilityEnhancer();
  });
} else {
  new YouTubeVisibilityEnhancer();
}