// Background script for Calendar Time Tracker
console.log('Background script loaded');

// Initialize extension
chrome.runtime.onInstalled.addListener(() => {
    console.log('Extension installed');
});



// Update badge when analysis is complete
function updateBadge(text, color = '#4CAF50') {
    chrome.action.setBadgeText({ text });
    chrome.action.setBadgeBackgroundColor({ color });
    
    // Clear badge after 5 seconds
    setTimeout(() => {
        chrome.action.setBadgeText({ text: '' });
    }, 5000);
}