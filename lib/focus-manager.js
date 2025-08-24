/**
 * Focus Manager for MCPretentious
 * 
 * Preserves and restores window focus during terminal operations
 * Uses a hybrid approach for best performance:
 * - lsappinfo for fast app detection
 * - open command for fast app activation
 * - AppleScript only for iTerm2 window selection
 */

import { execSync } from 'child_process';

/**
 * Get the currently focused application and window
 * @returns {Object|null} Focus information or null if failed
 */
export function getCurrentFocus() {
  try {
    // Use fast lsappinfo for basic app detection
    const frontASN = execSync('lsappinfo front 2>/dev/null', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
    const appInfo = execSync(`lsappinfo info -only name -only bundleid ${frontASN} 2>/dev/null`, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
    
    // Parse the output
    let appName = '';
    let bundleId = '';
    
    const nameMatch = appInfo.match(/"LSDisplayName"="([^"]+)"/);
    if (nameMatch) {
      appName = nameMatch[1];
    }
    
    const bundleMatch = appInfo.match(/"CFBundleIdentifier"="([^"]+)"/);
    if (bundleMatch) {
      bundleId = bundleMatch[1];
    }
    
    // Fix Electron apps that report incorrectly
    if (bundleId.includes('com.microsoft.VSCode')) {
      appName = 'Visual Studio Code';
    } else if (bundleId.includes('com.tinyspeck.slack')) {
      appName = 'Slack';
    } else if (bundleId.includes('com.hnc.Discord')) {
      appName = 'Discord';
    } else if (bundleId.includes('com.github.Electron')) {
      // Generic Electron app - try to get better name
      const processName = execSync(`lsappinfo info -only name ${frontASN} 2>/dev/null`, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
      const procMatch = processName.match(/"LSDisplayName"="([^"]+)"/);
      if (procMatch) {
        appName = procMatch[1];
      }
    }
    
    // For iTerm2, we need AppleScript to get window details
    if (appName === 'iTerm2') {
      const script = `
        tell application "iTerm2"
          if (count of windows) > 0 then
            set currentWin to current window
            return (id of currentWin as string) & "|" & (name of currentWin)
          end if
        end tell
      `;
      
      try {
        const result = execSync(`osascript <<'EOF' 2>/dev/null
${script}
EOF`, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
        
        const [windowId, windowName] = result.split('|');
        
        return {
          app: 'iTerm2',
          windowId: windowId || null,
          windowName: windowName || null,
          bundleId
        };
      } catch (err) {
        // Fallback if AppleScript fails
        return {
          app: 'iTerm2',
          windowId: null,
          windowName: null,
          bundleId
        };
      }
    }
    
    return {
      app: appName,
      windowId: null,
      windowName: null,
      bundleId
    };
  } catch (err) {
    // Silent failure - focus preservation is optional
    return null;
  }
}

/**
 * Restore focus to a previously focused application/window
 * @param {Object} focusInfo - Focus information from getCurrentFocus
 */
export function restoreFocus(focusInfo) {
  if (!focusInfo || !focusInfo.app) return;
  
  try {
    if (focusInfo.app === 'iTerm2' && focusInfo.windowId) {
      // For iTerm2 windows: Must use AppleScript (no alternative)
      const script = `
        tell application "iTerm2"
          repeat with w in windows
            if (id of w as string) = "${focusInfo.windowId}" then
              select w
              exit repeat
            end if
          end repeat
        end tell
      `;
      
      execSync(`osascript <<'EOF' 2>/dev/null
${script}
EOF`, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] });
      
    } else if (focusInfo.app) {
      // For other apps: Use fast 'open' command (2-3x faster than AppleScript)
      try {
        execSync(`open -a "${focusInfo.app}" 2>/dev/null`, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] });
      } catch (err) {
        // Fallback for apps that 'open' can't find - try bundle ID
        if (focusInfo.bundleId) {
          try {
            execSync(`open -b "${focusInfo.bundleId}" 2>/dev/null`, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] });
          } catch (bundleErr) {
            // Last resort: AppleScript
            execSync(`osascript -e 'tell application "${focusInfo.app}" to activate' 2>/dev/null`, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] });
          }
        }
      }
    }
  } catch (err) {
    // Silent failure - focus restoration is best-effort
  }
}

/**
 * Execute an operation while preserving focus
 * @param {Function} operation - Async operation to execute
 * @returns {*} Result of the operation
 */
export async function withFocusPreservation(operation) {
  const originalFocus = getCurrentFocus();
  
  try {
    const result = await operation();
    
    // Restore focus after a short delay to ensure operation completed
    if (originalFocus) {
      setTimeout(() => restoreFocus(originalFocus), 100);
    }
    
    return result;
  } catch (err) {
    // Still try to restore focus on error
    if (originalFocus) {
      setTimeout(() => restoreFocus(originalFocus), 100);
    }
    throw err;
  }
}