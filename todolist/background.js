// 监听扩展图标点击
chrome.action.onClicked.addListener(async (tab) => {
  // 检查是否是受限制的页面
  if (tab.url.startsWith('chrome://') || tab.url.startsWith('edge://') || tab.url.startsWith('brave://') || 
      tab.url.startsWith('about:') || tab.url.startsWith('file://')) {
    // 显示通知
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icon128.png',
      title: '待办事项',
      message: '此扩展无法在浏览器内部页面上运行。请在普通网页上使用。'
    });
    return;
  }

  try {
    // 注入内容脚本
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["content.js"]
      });
      
      // 注入CSS
      await chrome.scripting.insertCSS({
        target: { tabId: tab.id },
        files: ["content.css"]
      });
      
      // 等待脚本加载
      await new Promise(resolve => setTimeout(resolve, 300));
    } catch (e) {
      console.log("脚本或CSS可能已存在:", e);
    }
    
    // 发送切换消息
    console.log("发送toggleWidget消息到标签页:", tab.id);
    chrome.tabs.sendMessage(tab.id, { action: "toggleWidget" });
  } catch (error) {
    console.error("操作失败:", error);
  }
});

// 监听存储变化
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local' && (changes.todos || changes.showOnWebsites || changes.darkTheme)) {
    // 使用节流函数防止频繁更新
    if (changes.todos && !changes.todos.newValue) {
      // 如果是删除操作，不需要通知所有标签页
      return;
    }
    
    // 使用防抖，减少短时间内的多次更新
    clearTimeout(window.updateDebounceTimer);
    window.updateDebounceTimer = setTimeout(() => {
      // 如果待办事项或显示设置发生变化，通知所有标签页更新
      chrome.tabs.query({}, (tabs) => {
        // 获取启用了显示功能的标志，只在必要时通知标签页
        chrome.storage.local.get(['showOnWebsites'], (result) => {
          // 如果未启用在所有页面上显示，则不需要广播
          if (!result.showOnWebsites && changes.todos && !changes.showOnWebsites) {
            return;
          }
          
          tabs.forEach(tab => {
            // 不发送到内部页面
            if (!tab.url.startsWith('chrome://') && 
                !tab.url.startsWith('edge://') && 
                !tab.url.startsWith('brave://')) {
              // 只注入一次，使用标记防止重复注入
              if (!tab.todoScriptInjected) {
                chrome.scripting.executeScript({
                  target: { tabId: tab.id },
                  files: ["content.js"]
                }).then(() => {
                  tab.todoScriptInjected = true;
                  chrome.scripting.insertCSS({
                    target: { tabId: tab.id },
                    files: ["content.css"]
                  });
                }).catch(e => console.log("注入脚本失败或已存在:", e));
              } else {
                // 短暂延迟后尝试更新
                setTimeout(() => {
                  // 使用回调捕获错误，而不是try-catch（不适用于异步操作）
                  chrome.tabs.sendMessage(tab.id, { 
                    action: changes.darkTheme ? "updateTheme" : "updateTodos",
                    // 添加增量更新标志
                    incrementalUpdate: changes.todos && changes.todos.newValue && 
                                     changes.todos.oldValue && 
                                     changes.todos.newValue.length > changes.todos.oldValue.length,
                    latestTodo: changes.todos && changes.todos.newValue && 
                               changes.todos.newValue[changes.todos.newValue.length-1]
                  }, () => {
                    if (chrome.runtime.lastError) {
                      // 忽略错误，这是预期的如果内容脚本尚未准备好
                      console.log(`发送到标签页 ${tab.id} 的消息被忽略:`, chrome.runtime.lastError.message);
                    }
                  });
                }, 100);
              }
            }
          });
        });
      });
    }, 200); // 200ms 防抖延迟
  }
});

// 初始化扩展
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(['showOnWebsites'], (result) => {
    if (result.showOnWebsites === undefined) {
      chrome.storage.local.set({ showOnWebsites: false });
    }
  });
});

// 监听标签页更新，确保在新标签页中显示
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // 仅当页面完成加载且不是内部页面时
  if (changeInfo.status === 'complete' && 
      !tab.url.startsWith('chrome://') && 
      !tab.url.startsWith('edge://') && 
      !tab.url.startsWith('brave://')) {
    
    // 检查设置是否启用了在所有网站显示
    chrome.storage.local.get(['showOnWebsites'], (result) => {
      if (result.showOnWebsites) {
        // 使用Promise.all并添加延迟
        Promise.all([
          chrome.scripting.executeScript({
            target: { tabId: tabId },
            files: ["content.js"]
          }).catch(e => console.log("注入脚本失败或已存在:", e)),
          
          chrome.scripting.insertCSS({
            target: { tabId: tabId },
            files: ["content.css"]
          }).catch(e => console.log("注入CSS失败或已存在:", e))
        ]).then(() => {
          // 等待内容脚本初始化
          setTimeout(() => {
            // 使用回调捕获错误
            chrome.tabs.sendMessage(tabId, { action: "checkVisibility" }, () => {
              if (chrome.runtime.lastError) {
                // 忽略错误
                console.log("内容脚本可能还没准备好");
              }
            });
          }, 500);
        });
      }
    });
  }
}); 