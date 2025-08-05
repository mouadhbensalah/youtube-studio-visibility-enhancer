// YouTube Studio Visibility Enhancer - Background Service Worker

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    // Set default settings
    chrome.storage.sync.set({
      enableKeyboardShortcuts: true,
      enableBatchMode: true,
      enableAutoSave: true,
      showNotifications: true
    });
    
    // Open welcome page
    chrome.tabs.create({
      url: chrome.runtime.getURL('welcome.html')
    });
  }
});

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'BATCH_OPERATION_START':
      handleBatchOperationStart(message.data, sender);
      break;
      
    case 'BATCH_OPERATION_COMPLETE':
      handleBatchOperationComplete(message.data, sender);
      break;
      
    case 'VISIBILITY_CHANGED':
      handleVisibilityChanged(message.data, sender);
      break;
      
    case 'GET_SETTINGS':
      getSettings().then(settings => sendResponse(settings));
      return true; // Keep message channel open for async response
      
    case 'UPDATE_SETTINGS':
      updateSettings(message.data).then(() => sendResponse({success: true}));
      return true;
  }
});

async function handleBatchOperationStart(data, sender) {
  const { videoCount, operation } = data;
  
  // Show notification if enabled and available
  try {
    const settings = await getSettings();
    if (settings.showNotifications && chrome.notifications) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/></svg>',
        title: 'YouTube Visibility Enhancer',
        message: `Starting batch operation: ${operation} on ${videoCount} videos`
      });
    }
  } catch (error) {
    console.log('Notifications not available in development mode');
  }
  
  // Update badge if available
  try {
    if (chrome.action) {
      chrome.action.setBadgeText({
        text: videoCount.toString(),
        tabId: sender.tab.id
      });
      
      chrome.action.setBadgeBackgroundColor({
        color: '#1976d2',
        tabId: sender.tab.id
      });
    }
  } catch (error) {
    console.log('Badge API not available in development mode');
  }
}

async function handleBatchOperationComplete(data, sender) {
  const { processedCount, successCount, errorCount } = data;
  
  // Clear badge if available
  try {
    if (chrome.action) {
      chrome.action.setBadgeText({
        text: '',
        tabId: sender.tab.id
      });
    }
  } catch (error) {
    console.log('Badge API not available in development mode');
  }
  
  // Show completion notification if available
  try {
    const settings = await getSettings();
    if (settings.showNotifications && chrome.notifications) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/></svg>',
        title: 'Batch Operation Complete',
        message: `Processed ${processedCount} videos. ${successCount} successful, ${errorCount} errors.`
      });
    }
  } catch (error) {
    console.log('Notifications not available in development mode');
  }
}

async function handleVisibilityChanged(data, sender) {
  const { videoId, oldVisibility, newVisibility, timestamp } = data;
  
  // Store in history for analytics
  const history = await getVisibilityHistory();
  history.push({
    videoId,
    oldVisibility,
    newVisibility,
    timestamp,
    tabId: sender.tab.id
  });
  
  // Keep only last 1000 entries
  if (history.length > 1000) {
    history.splice(0, history.length - 1000);
  }
  
  chrome.storage.local.set({ visibilityHistory: history });
}

async function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get({
      enableKeyboardShortcuts: true,
      enableBatchMode: true,
      enableAutoSave: true,
      showNotifications: true,
      batchDelay: 200, // ms between batch operations
      maxBatchSize: 50
    }, resolve);
  });
}

async function updateSettings(newSettings) {
  return chrome.storage.sync.set(newSettings);
}

async function getVisibilityHistory() {
  return new Promise((resolve) => {
    chrome.storage.local.get({ visibilityHistory: [] }, (result) => {
      resolve(result.visibilityHistory);
    });
  });
}

// Context menu for quick actions (with error handling)
try {
  chrome.contextMenus.create({
    id: 'quick-visibility',
    title: 'Quick Visibility Change',
    contexts: ['page'],
    documentUrlPatterns: ['https://studio.youtube.com/*']
  });

  chrome.contextMenus.create({
    id: 'set-private',
    parentId: 'quick-visibility',
    title: 'Set to Private',
    contexts: ['page']
  });

  chrome.contextMenus.create({
    id: 'set-unlisted',
    parentId: 'quick-visibility',
    title: 'Set to Unlisted',
    contexts: ['page']
  });

  chrome.contextMenus.create({
    id: 'set-public',
    parentId: 'quick-visibility',
    title: 'Set to Public',
    contexts: ['page']
  });

  chrome.contextMenus.onClicked.addListener((info, tab) => {
    const visibilityMap = {
      'set-private': 'PRIVATE',
      'set-unlisted': 'UNLISTED',
      'set-public': 'PUBLIC'
    };
    
    const visibility = visibilityMap[info.menuItemId];
    if (visibility) {
      chrome.tabs.sendMessage(tab.id, {
        type: 'CONTEXT_MENU_VISIBILITY_CHANGE',
        visibility: visibility
      });
    }
  });
} catch (error) {
  console.log('Context menus not available in development mode');
}

// Analytics and usage tracking (privacy-friendly)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'TRACK_USAGE') {
    trackUsage(message.data);
  }
});

async function trackUsage(data) {
  // Store usage statistics locally (no external tracking)
  const stats = await getUsageStats();
  
  const today = new Date().toDateString();
  if (!stats[today]) {
    stats[today] = {
      visibilityChanges: 0,
      batchOperations: 0,
      keyboardShortcuts: 0,
      timesSaved: 0
    };
  }
  
  stats[today][data.action] = (stats[today][data.action] || 0) + 1;
  
  // Calculate time saved (estimate: 5 seconds per manual operation)
  if (data.action === 'visibilityChanges' || data.action === 'batchOperations') {
    stats[today].timesSaved += data.count ? data.count * 5 : 5;
  }
  
  chrome.storage.local.set({ usageStats: stats });
}

async function getUsageStats() {
  return new Promise((resolve) => {
    chrome.storage.local.get({ usageStats: {} }, (result) => {
      resolve(result.usageStats);
    });
  });
}