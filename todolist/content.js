// 内容脚本 - To-Do Events
// 作者: github:stevenxxzgs
// 版本: 2.0

// 创建待办事项小部件
function createTodoWidget() {
  // 加载Google字体和图标
  const fontLink = document.createElement('link');
  fontLink.href = 'https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;700&display=swap';
  fontLink.rel = 'stylesheet';
  document.head.appendChild(fontLink);
  
  const iconLink = document.createElement('link');
  iconLink.href = 'https://fonts.googleapis.com/icon?family=Material+Icons';
  iconLink.rel = 'stylesheet';
  document.head.appendChild(iconLink);
  
  // 创建小部件容器
  const container = document.createElement('div');
  container.id = 'todo-widget-container';
  container.style.display = 'none'; // 默认隐藏
  container.style.position = 'fixed';
  container.style.top = '20px';
  container.style.right = '20px';
  container.style.zIndex = '9999';
  container.style.backgroundColor = 'transparent';
  container.style.width = '300px';
  container.style.borderRadius = '8px';
  container.style.padding = '10px';
  container.style.maxHeight = '80vh';
  container.style.overflowY = 'auto';
  container.style.boxSizing = 'border-box';
  container.style.transition = 'all 0.3s ease';
  container.style.border = '1px solid rgba(255, 255, 255, 0.1)';

  // 添加HTML结构
  container.innerHTML = `
    <div class="todos-container">
      <ul id="todoList" class="todo-list"></ul>
    </div>
  `;
  
  document.body.appendChild(container);
  console.log("待办事项小部件已创建");
  
  // 显示待办事项
  loadTodos();
  
  // 检查是否应该显示
  checkVisibility();
  
  checkBackground();
}

// 加载待办事项 - 添加缓存机制
let lastTodosHash = '';
let pendingUpdates = false;
let updateTimeout = null;

function loadTodos() {
  // 如果已经有待处理的更新，不要重复执行
  if (pendingUpdates) return;
  pendingUpdates = true;
  
  // 使用 requestAnimationFrame 确保在下一帧渲染时更新 DOM
  if (updateTimeout) clearTimeout(updateTimeout);
  updateTimeout = setTimeout(() => {
    requestAnimationFrame(() => {
      chrome.storage.local.get(['todos'], (result) => {
        const todos = result.todos || [];
        
        // 使用简单的哈希比较，如果数据没变则不更新
        const currentHash = JSON.stringify(todos);
        if (currentHash === lastTodosHash) {
          pendingUpdates = false;
          return; // 数据没变，无需更新
        }
        lastTodosHash = currentHash;
        
        const todoList = document.getElementById('todoList');
        if (!todoList) {
          pendingUpdates = false;
          return;
        }
        
        // 最小化 DOM 操作：找出哪些需要添加、哪些需要移除
        const existingItems = Array.from(todoList.querySelectorAll('li'));
        const existingIds = existingItems.map(li => li.dataset.id);
        
        // 找出需要添加的新项目
        const todoIds = todos.map(todo => String(todo.id));
        
        // 创建文档片段，减少重排和重绘
        const fragment = document.createDocumentFragment();
        let needsReflow = false;
        
        // 移除不再存在的项目
        existingItems.forEach(item => {
          if (!todoIds.includes(item.dataset.id)) {
            // 添加动画然后移除
            item.style.transition = 'transform 0.3s ease, opacity 0.3s ease';
            item.style.transform = 'translateX(-100%)';
            item.style.opacity = '0';
            needsReflow = true;
            setTimeout(() => {
              if (item.parentNode === todoList) {
                todoList.removeChild(item);
              }
            }, 300);
          }
        });
        
        // 如果需要重排，强制浏览器立即处理
        if (needsReflow) {
          // 触发重排
          void todoList.offsetHeight;
        }
        
        // 添加新项目或更新现有项目
        let newItemsAdded = false;
        todos.forEach((todo, index) => {
          const id = String(todo.id);
          const existingItem = todoList.querySelector(`li[data-id="${id}"]`);
          
          if (!existingItem) {
            // 新项目，添加到文档片段
            const newItem = createTodoElement(todo);
            fragment.appendChild(newItem);
            newItemsAdded = true;
          } else {
            // 更新现有项目状态
            const checkbox = existingItem.querySelector('input[type="checkbox"]');
            if (checkbox && checkbox.checked !== todo.completed) {
              checkbox.checked = todo.completed;
              const todoText = existingItem.querySelector('.todo-text');
              if (todoText) {
                if (todo.completed) {
                  todoText.classList.add('completed');
                  existingItem.classList.add('completed-task');
                } else {
                  todoText.classList.remove('completed');
                  existingItem.classList.remove('completed-task');
                }
              }
            }
            
            // 重新排序，确保顺序正确
            if (index !== Array.from(todoList.children).indexOf(existingItem)) {
              todoList.appendChild(existingItem);
            }
          }
        });
        
        // 一次性添加所有新项目
        if (newItemsAdded) {
          todoList.appendChild(fragment);
        }
        
        pendingUpdates = false;
      });
    });
  }, 50); // 短暂延迟，合并多个快速更新
}

// 创建待办事项元素，但不添加到DOM
function createTodoElement(todo) {
  const li = document.createElement('li');
  li.dataset.id = todo.id;
  if (todo.completed) {
    li.classList.add('completed-task');
  }
  li.innerHTML = `
    <label class="checkbox-container">
      <input type="checkbox" ${todo.completed ? 'checked' : ''}>
      <span class="checkmark"></span>
    </label>
    <span class="todo-text ${todo.completed ? 'completed' : ''}">${todo.text}</span>
    <div class="swipe-hint"><span class="swipe-arrow">↔</span> 左右滑动删除</div>
  `;

  const checkbox = li.querySelector('input[type="checkbox"]');
  checkbox.addEventListener('change', () => {
    // 立即更新UI，不等待存储响应
    const todoText = li.querySelector('.todo-text');
    if (checkbox.checked) {
      todoText.classList.add('completed');
      li.classList.add('completed-task');
    } else {
      todoText.classList.remove('completed');
      li.classList.remove('completed-task');
    }
    
    // 然后更新存储
    toggleTodoCompletion(todo.id, checkbox.checked);
  });
  
  // 添加右滑删除功能
  makeSwipeable(li, todo.id);
  return li;
}

// 渲染待办事项
function renderTodo(todo) {
  // 使用新的创建元素函数
  const todoElement = createTodoElement(todo);
  
  const todoList = document.getElementById('todoList');
  if (!todoList) return;
  
  todoList.appendChild(todoElement);
}

// 切换完成状态
function toggleTodoCompletion(id, completed) {
  chrome.storage.local.get(['todos'], (result) => {
    const todos = result.todos || [];
    const updatedTodos = todos.map(todo => {
      if (todo.id === id) {
        return { ...todo, completed };
      }
      return todo;
    });
    
    // 立即更新UI，不等待存储响应
    const todoElement = document.querySelector(`li[data-id="${id}"]`);
    if (todoElement) {
      const todoText = todoElement.querySelector('.todo-text');
      if (todoText) {
        if (completed) {
          todoText.classList.add('completed');
          todoElement.classList.add('completed-task');
        } else {
          todoText.classList.remove('completed');
          todoElement.classList.remove('completed-task');
        }
      }
    }
    
    chrome.storage.local.set({ todos: updatedTodos });
  });
}

// 检查是否应该显示小部件
function checkVisibility() {
  chrome.storage.local.get(['showOnWebsites'], (result) => {
    const widget = document.getElementById('todo-widget-container');
    if (widget) {
      widget.style.display = result.showOnWebsites ? 'block' : 'none';
    }
  });
}

// 监听来自popup或background的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "updateVisibility") {
    const widget = document.getElementById('todo-widget-container');
    if (widget) {
      widget.style.display = message.show ? 'block' : 'none';
    }
    sendResponse({ success: true });
  } else if (message.action === "updateTodos") {
    // 如果是增量更新且有最新任务，则只添加这个任务而不是重新加载所有任务
    if (message.incrementalUpdate && message.latestTodo) {
      const todo = message.latestTodo;
      const todoList = document.getElementById('todoList');
      if (todoList) {
        const existingItems = Array.from(todoList.querySelectorAll('li')).map(li => li.dataset.id);
        if (!existingItems.includes(String(todo.id))) {
          renderTodo(todo);
          sendResponse({ success: true });
          return true;
        }
      }
    }
    
    loadTodos();
    sendResponse({ success: true });
  } else if (message.action === "checkVisibility") {
    checkVisibility();
    sendResponse({ success: true });
  } else if (message.action === "updateBackground") {
    const widget = document.getElementById('todo-widget-container');
    if (widget) {
      widget.style.backgroundColor = message.transparent ? 'transparent' : 'white';
      
      // 更新列表项背景
      const listItems = document.querySelectorAll('#todoList li');
      listItems.forEach(item => {
        item.style.backgroundColor = message.transparent ? 'rgba(255, 255, 255, 0.5)' : 'rgba(255, 255, 255, 0.9)';
      });
    }
    sendResponse({ success: true });
  } else if (message.action === "updateTheme") {
    checkBackground();
    sendResponse({ success: true });
  }
  return true; // 表示将异步发送响应
});

// 当页面加载完成时创建小部件
if (document.readyState === "complete" || document.readyState === "interactive") {
  setTimeout(createTodoWidget, 0);
} else {
  document.addEventListener('DOMContentLoaded', createTodoWidget);
}

// 检查背景设置
function checkBackground() {
  chrome.storage.local.get(['transparentBg', 'darkTheme'], (result) => {
    const widget = document.getElementById('todo-widget-container');
    if (widget) {
      const isTransparent = result.transparentBg !== undefined ? result.transparentBg : true;
      const isDarkTheme = result.darkTheme || false;
      
      // 应用黑夜模式
      if (isDarkTheme) {
        widget.classList.add('dark-theme');
      } else {
        widget.classList.remove('dark-theme');
      }
      
      // 完全透明时，移除所有背景和边框
      if (isTransparent) {
        widget.style.backgroundColor = 'transparent';
        widget.style.border = 'none';
        widget.style.boxShadow = 'none';
      } else {
        // 不透明时，根据主题设置适当的背景色
        widget.style.backgroundColor = isDarkTheme ? '#1f1f1f' : 'white';
        widget.style.border = isDarkTheme ? '1px solid rgba(80, 80, 80, 0.2)' : '1px solid rgba(0, 0, 0, 0.1)';
        widget.style.boxShadow = isDarkTheme ? '0 3px 8px rgba(0, 0, 0, 0.3)' : '0 2px 6px rgba(0, 0, 0, 0.1)';
      }
      
      // 更新列表项背景
      const listItems = document.querySelectorAll('#todoList li');
      listItems.forEach(item => {
        if (isDarkTheme) {
          item.style.backgroundColor = isTransparent ? 'rgba(40, 40, 40, 0.5)' : 'rgba(50, 50, 50, 0.9)';
          item.style.color = '#f0f0f0';
          item.querySelector('.todo-text').style.color = item.querySelector('.todo-text').classList.contains('completed') ? '#777' : '#f0f0f0';
        } else {
          item.style.backgroundColor = isTransparent ? 'rgba(255, 255, 255, 0.6)' : 'rgba(255, 255, 255, 0.9)';
          item.style.color = '#333';
          item.querySelector('.todo-text').style.color = item.querySelector('.todo-text').classList.contains('completed') ? '#95a5a6' : '#333';
        }
      });
    }
  });
}

// 为元素添加滑动删除功能
function makeSwipeable(element, todoId) {
  let startX, moveX, isSwiping = false;
  const threshold = 100; // 滑动触发删除的阈值
  
  // 触摸开始
  element.addEventListener('touchstart', (e) => {
    startX = e.touches[0].clientX;
    isSwiping = true;
    element.style.transition = '';
    // 添加滑动动作的震动反馈（如果设备支持）
    if (navigator.vibrate) {
      navigator.vibrate(15);
    }
  });
  
  // 鼠标按下（桌面设备的支持）
  element.addEventListener('mousedown', (e) => {
    startX = e.clientX;
    isSwiping = true;
    element.style.transition = '';
    // 阻止文本选择
    e.preventDefault();
  });
  
  // 触摸移动
  element.addEventListener('touchmove', (e) => {
    if (!isSwiping) return;
    moveX = e.touches[0].clientX;
    const diff = moveX - startX;
    // 允许左右两个方向滑动
    if (diff !== 0) {
      element.style.transform = `translateX(${diff}px)`;
      // 根据滑动距离改变背景色
      const opacity = Math.min(Math.abs(diff) / threshold, 1);
      // 使用绿色表示可以删除（当接近阈值时）
      if (Math.abs(diff) > threshold * 0.7) {
        element.style.backgroundColor = `rgba(76, 175, 80, ${opacity * 0.3})`;
      } else {
        element.style.backgroundColor = `rgba(231, 76, 60, ${opacity * 0.2})`;
      }
      
      // 显示滑动提示
      const hint = element.querySelector('.swipe-hint');
      if (hint) {
        hint.style.opacity = opacity;
        // 当超过一定阈值时，修改提示文字
        if (Math.abs(diff) > threshold * 0.7) {
          hint.innerHTML = "<span class='swipe-arrow'>" + (diff > 0 ? "→" : "←") + "</span> 松开以删除";
          hint.style.color = "#4CAF50";
        }
      }
    }
  });
  
  // 鼠标移动
  element.addEventListener('mousemove', (e) => {
    if (!isSwiping) return;
    moveX = e.clientX;
    const diff = moveX - startX;
    // 允许左右两个方向滑动
    if (diff !== 0) {
      element.style.transform = `translateX(${diff}px)`;
      // 根据滑动距离改变背景色
      const opacity = Math.min(Math.abs(diff) / threshold, 1);
      // 使用绿色表示可以删除（当接近阈值时）
      if (Math.abs(diff) > threshold * 0.7) {
        element.style.backgroundColor = `rgba(76, 175, 80, ${opacity * 0.3})`;
      } else {
        element.style.backgroundColor = `rgba(231, 76, 60, ${opacity * 0.2})`;
      }
      
      // 显示滑动提示
      const hint = element.querySelector('.swipe-hint');
      if (hint) {
        hint.style.opacity = opacity;
        // 当超过一定阈值时，修改提示文字
        if (Math.abs(diff) > threshold * 0.7) {
          hint.innerHTML = "<span class='swipe-arrow'>" + (diff > 0 ? "→" : "←") + "</span> 松开以删除";
          hint.style.color = "#4CAF50";
        }
      }
    }
  });
  
  // 触摸结束
  element.addEventListener('touchend', finishSwipe);
  // 鼠标释放
  element.addEventListener('mouseup', finishSwipe);
  // 鼠标离开元素
  element.addEventListener('mouseleave', () => {
    if (isSwiping) {
      finishSwipe();
    }
  });
  
  function finishSwipe() {
    if (!isSwiping) return;
    isSwiping = false;
    
    const diff = moveX - startX;
    if (Math.abs(diff) > threshold) {
      // 滑动超过阈值，执行删除
      element.style.transition = 'transform 0.3s ease, opacity 0.3s ease';
      element.style.transform = `translateX(${diff > 0 ? 100 : -100}%)`;
      element.style.opacity = '0';
      
      // 添加震动反馈
      if (navigator.vibrate) {
        navigator.vibrate([30, 50, 30]);
      }
      
      // 延迟删除以显示动画
      setTimeout(() => {
        deleteTodo(todoId);
      }, 300);
    } else {
      // 未达到阈值，恢复原位
      element.style.transition = 'transform 0.3s ease, background-color 0.3s ease';
      element.style.transform = '';
      element.style.backgroundColor = '';
      
      // 隐藏滑动提示
      const hint = element.querySelector('.swipe-hint');
      if (hint) {
        hint.style.opacity = '0';
        // 重置提示文字
        setTimeout(() => {
          hint.innerHTML = "<span class='swipe-arrow'>↔</span> 左右滑动删除";
          hint.style.color = "#e74c3c";
        }, 300);
      }
    }
  }
}

/* 添加删除函数到 content.js */
function deleteTodo(id) {
  chrome.storage.local.get(['todos'], (result) => {
    const todos = result.todos || [];
    const updatedTodos = todos.filter(todo => todo.id !== id);
    chrome.storage.local.set({ todos: updatedTodos }, () => {
      // 更新视图
      loadTodos();
    });
  });
} 