// 弹出窗口脚本 - To-Do Events
// 作者: github:stevenxxzgs
// 版本: 2.0

document.addEventListener('DOMContentLoaded', () => {
  const todoInput = document.getElementById('todoInput');
  const addButton = document.getElementById('addButton');
  const todoList = document.getElementById('todoList');
  const showOnWebsites = document.getElementById('showOnWebsites');
  const transparentBg = document.getElementById('transparentBg');
  const themeToggle = document.getElementById('themeToggle');
  
  // 加载待办事项和设置
  loadTodos();
  loadSettings();
  
  // 初始化暗黑模式
  initTheme();
  
  // 添加按钮涟漪效果
  addRippleEffect();
  
  // 添加新任务
  addButton.addEventListener('click', () => {
    const text = todoInput.value.trim();
    if (text) {
      const todo = { text, completed: false, id: Date.now() };
      saveTodo(todo);
      todoInput.value = '';
      // 添加后自动聚焦回输入框
      todoInput.focus();
    }
  });
  
  // 回车提交
  todoInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      addButton.click();
    }
  });
  
  // 切换"在所有网页上显示"设置
  showOnWebsites.addEventListener('change', () => {
    chrome.storage.local.set({ showOnWebsites: showOnWebsites.checked });
    
    // 通知所有标签页更新显示状态
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach(tab => {
        try {
          // 不发送到内部页面
          if (!tab.url.startsWith('chrome://') && 
              !tab.url.startsWith('edge://') && 
              !tab.url.startsWith('brave://')) {
            // 使用 executeScript 注入一个立即执行的函数，这样不需要消息传递
            chrome.scripting.executeScript({
              target: { tabId: tab.id },
              func: (show) => {
                const widget = document.getElementById('todo-widget-container');
                if (widget) {
                  widget.style.display = show ? 'block' : 'none';
                }
              },
              args: [showOnWebsites.checked]
            }).catch(() => {
              // 可能是权限问题或标签页无法执行脚本，使用消息作为备选方案
              chrome.tabs.sendMessage(tab.id, { 
                action: "updateVisibility", 
                show: showOnWebsites.checked 
              }, () => {
                // 忽略错误
                if (chrome.runtime.lastError) {
                  console.log("标签页可能未准备好接收消息");
                }
              });
            });
          }
        } catch (e) {
          console.log("无法发送到标签页:", tab.id);
        }
      });
    });
  });
  
  // 切换透明背景设置
  transparentBg.addEventListener('change', () => {
    chrome.storage.local.set({ transparentBg: transparentBg.checked });
    
    // 通知所有标签页更新背景
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach(tab => {
        try {
          if (!tab.url.startsWith('chrome://') && 
              !tab.url.startsWith('edge://') && 
              !tab.url.startsWith('brave://')) {
            chrome.scripting.executeScript({
              target: { tabId: tab.id },
              func: (transparent) => {
                const widget = document.getElementById('todo-widget-container');
                if (widget) {
                  widget.style.backgroundColor = transparent ? 'transparent' : 'white';
                  
                  // 更新列表项背景
                  const listItems = document.querySelectorAll('#todoList li');
                  listItems.forEach(item => {
                    item.style.backgroundColor = transparent ? 'rgba(255, 255, 255, 0.5)' : 'rgba(255, 255, 255, 0.9)';
                  });
                }
              },
              args: [transparentBg.checked]
            }).catch(() => {
              // 使用消息作为备选方案
              chrome.tabs.sendMessage(tab.id, { 
                action: "updateBackground", 
                transparent: transparentBg.checked 
              }, () => {
                // 忽略错误
                if (chrome.runtime.lastError) {
                  console.log("标签页可能未准备好接收消息");
                }
              });
            });
          }
        } catch (e) {
          console.log("无法发送到标签页:", e);
        }
      });
    });
  });
  
  // 切换主题
  themeToggle.addEventListener('click', () => {
    const isDark = document.body.classList.toggle('dark-theme');
    themeToggle.textContent = isDark ? 'light_mode' : 'dark_mode';
    chrome.storage.local.set({ darkTheme: isDark });
    
    // 更新按钮和滑块颜色
    const buttons = document.querySelectorAll('.add-btn');
    buttons.forEach(btn => {
      btn.style.backgroundColor = isDark ? '#4d8aaf' : '#66aee0';
    });
    
    // 通知所有标签页更新主题
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach(tab => {
        try {
          if (!tab.url.startsWith('chrome://') && 
              !tab.url.startsWith('edge://') && 
              !tab.url.startsWith('brave://')) {
            chrome.tabs.sendMessage(tab.id, { 
              action: "updateTheme", 
              isDark: isDark 
            }, () => {
              if (chrome.runtime.lastError) {
                // 忽略错误
              }
            });
          }
        } catch (e) {
          console.log("无法发送主题更新到标签页:", e);
        }
      });
    });
  });
  
  // 加载待办事项
  function loadTodos() {
    chrome.storage.local.get(['todos'], (result) => {
      const todos = result.todos || [];
      todoList.innerHTML = '';
      todos.forEach(todo => renderTodo(todo));
      
      // 控制空状态显示
      const emptyState = document.getElementById('emptyState');
      if (todos.length === 0) {
        emptyState.style.display = 'flex';
      } else {
        emptyState.style.display = 'none';
      }
    });
  }
  
  // 加载设置
  function loadSettings() {
    chrome.storage.local.get(['showOnWebsites', 'transparentBg'], (result) => {
      showOnWebsites.checked = result.showOnWebsites || false;
      transparentBg.checked = result.transparentBg !== undefined ? result.transparentBg : true;
    });
  }
  
  // 初始化主题
  function initTheme() {
    // 从存储中加载主题设置
    chrome.storage.local.get(['darkTheme'], (result) => {
      if (result.darkTheme) {
        document.body.classList.add('dark-theme');
        themeToggle.textContent = 'light_mode';
      } else {
        document.body.classList.remove('dark-theme');
        themeToggle.textContent = 'dark_mode';
      }
    });
  }
  
  // 添加按钮涟漪效果
  function addRippleEffect() {
    addButton.addEventListener('click', function(e) {
      const ripple = this.querySelector('.btn-ripple');
      ripple.style.left = `${e.offsetX}px`;
      ripple.style.top = `${e.offsetY}px`;
      ripple.style.animation = 'none';
      
      // 重置动画
      setTimeout(() => {
        ripple.style.animation = 'ripple 0.6s ease-out';
      }, 0);
    });
  }
  
  // 保存待办事项
  function saveTodo(todo) {
    chrome.storage.local.get(['todos'], (result) => {
      const todos = result.todos || [];
      todos.push(todo);
      chrome.storage.local.set({ todos }, () => {
        renderTodo(todo);
        // 隐藏空状态
        document.getElementById('emptyState').style.display = 'none';
        // 短暂闪烁添加按钮以表示成功
        const addBtn = document.getElementById('addButton');
        addBtn.style.backgroundColor = '#4CAF50'; // 绿色表示成功
        setTimeout(() => {
          addBtn.style.backgroundColor = '#66aee0'; // 恢复为主题色
        }, 300);
      });
    });
  }
  
  // 渲染待办事项
  function renderTodo(todo) {
    const todoList = document.getElementById('todoList');
    
    const li = document.createElement('li');
    li.dataset.id = todo.id;
    // 添加完成状态的类名
    if (todo.completed) {
      li.classList.add('completed-task');
    }
    li.innerHTML = `
      <label class="checkbox-container">
        <input type="checkbox" ${todo.completed ? 'checked' : ''}>
        <span class="checkmark"></span>
      </label>
      <span class="todo-text ${todo.completed ? 'completed' : ''}">${todo.text}</span>
      <button class="delete-btn"><i class="material-icons">close</i></button>
    `;
    
    todoList.appendChild(li);
    
    // 设置新添加的元素动画
    li.style.animation = 'fadeIn 0.3s forwards';

    // 添加事件监听器
    const checkbox = li.querySelector('input[type="checkbox"]');
    checkbox.addEventListener('change', () => {
      toggleTodoCompletion(todo.id, checkbox.checked);
      // 立即更新UI
      if (checkbox.checked) {
        li.classList.add('completed-task');
      } else {
        li.classList.remove('completed-task');
      }
    });
    
    // 删除按钮事件
    const deleteBtn = li.querySelector('.delete-btn');
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteTodo(todo.id);
    });
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
      chrome.storage.local.set({ todos: updatedTodos }, () => {
        loadTodos();
      });
    });
  }
  
  // 删除待办事项
  function deleteTodo(id) {
    chrome.storage.local.get(['todos'], (result) => {
      const todos = result.todos || [];
      const updatedTodos = todos.filter(todo => todo.id !== id);
      chrome.storage.local.set({ todos: updatedTodos }, () => {
        loadTodos();
      });
    });
  }
});