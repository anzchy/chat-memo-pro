/**
 * Chat Memo 通用内容处理脚本
 * 负责创建悬浮标签、处理保存状态显示和通用功能
 */

// 悬浮标签DOM元素
let floatTag = null;
let iconElement = null;
let statusElement = null;
let saveButton = null;

// 初始化状态标记，防止重复初始化
let isInitialized = false;

// 全局设置对象
window.keepAIMemorySettings = {
  autoSave: true // 默认开启自动保存
};

/**
 * 检查当前网站是否应该显示悬浮标签
 * 只在支持的 AI 聊天平台显示
 * @returns {boolean}
 */
function shouldShowFloatTag() {
  const url = window.location.href;
  const supportedPlatforms = [
    'https://chat.deepseek.com',
    'https://chatgpt.com',
    'https://chat.openai.com',
    'https://gemini.google.com',
    'https://yuanbao.tencent.com',
    'https://www.doubao.com',
    'https://claude.ai/',
    'https://aistudio.google.com',
    'https://kimi.moonshot.cn',
    'https://kimi.com',
    'https://www.kimi.com'
  ];

  return supportedPlatforms.some(platform => url.startsWith(platform));
}

// 初始化函数
function initCommon() {
  // 防止重复初始化
  if (isInitialized) {
    console.log('Chat-Memo: 已初始化，跳过重复初始化');
    return;
  }
  
  console.log('Chat-Memo: 初始化通用功能');
  isInitialized = true;

  // 安全地从存储中获取设置
  try {
    chrome.storage.sync.get(['settings'], (result) => {
      if (result && result.settings) {
        // 直接更新全局设置对象
        window.keepAIMemorySettings = Object.assign({}, window.keepAIMemorySettings, result.settings);
      }

      // 只在支持的 AI 平台网站创建悬浮标签
      if (shouldShowFloatTag()) {
        createFloatTag();
      }
    });
  } catch (error) {
    console.error('获取设置失败:', error);
    // 出错时，如果当前是支持的 AI 平台，仍然创建悬浮标签
    if (shouldShowFloatTag()) {
      createFloatTag();
    }
  }
  
  // 监听来自后台脚本的消息
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'settingsUpdated' && message.settings) {
      // 更新全局设置
      window.keepAIMemorySettings = Object.assign({}, window.keepAIMemorySettings, message.settings);
      // 只有在有悬浮标签时才更新状态
      if (floatTag) {
        updateFloatTagState();
      }
    }
    sendResponse({status: 'ok'});
    return true;
  });
}

// 清理页面上可能存在的重复悬浮标签
function cleanupExistingFloatTags() {
  // 查找所有可能的悬浮标签元素
  const existingTags = document.querySelectorAll('.keep-ai-memory-float, [data-keep-ai-memory-tag="true"]');
  
  existingTags.forEach(tag => {
    if (tag && tag.parentNode) {
      console.log('Chat-Memo: 清理重复的悬浮标签');
      tag.parentNode.removeChild(tag);
    }
  });
  
  // 清理边缘引导元素
  const existingGuides = document.querySelectorAll('.edge-guide, [data-keep-ai-memory-guide="true"]');
  existingGuides.forEach(guide => {
    if (guide && guide.parentNode) {
      console.log('Chat-Memo: 清理边缘引导元素');
      guide.parentNode.removeChild(guide);
    }
  });
  
  // 重置全局变量
  floatTag = null;
  iconElement = null;
  statusElement = null;
  saveButton = null;
}

// 保存悬浮标签位置到本地存储（基于边缘距离）
function saveFloatTagPosition(x, y, isEdgeDocked = false, dockedSide = null) {
  try {
    // 计算与各边缘的距离
    const distanceFromLeft = x;
    const distanceFromTop = y;
    const distanceFromRight = window.innerWidth - x;
    const distanceFromBottom = window.innerHeight - y;
    
    // 判断标签更靠近哪个边缘，选择最小距离的边作为参考
    let anchor, distance;
    
    if (distanceFromLeft <= distanceFromRight) {
      // 靠近左边
      anchor = 'left';
      distance = distanceFromLeft;
    } else {
      // 靠近右边
      anchor = 'right';
      distance = distanceFromRight;
    }
    
    // 垂直方向也采用相同逻辑
    let verticalAnchor, verticalDistance;
    if (distanceFromTop <= distanceFromBottom) {
      verticalAnchor = 'top';
      verticalDistance = distanceFromTop;
    } else {
      verticalAnchor = 'bottom';
      verticalDistance = distanceFromBottom;
    }
    
    const positionData = {
      anchor,
      distance: Math.max(0, distance),
      verticalAnchor,
      verticalDistance: Math.max(0, verticalDistance),
      isEdgeDocked,
      dockedSide
    };
    
    localStorage.setItem('keep-ai-memory-float-position', JSON.stringify(positionData));
  } catch (error) {
    console.error('保存悬浮标签位置失败:', error);
  }
}

// 从本地存储恢复悬浮标签位置（基于边缘距离）
function restoreFloatTagPosition() {
  try {
    const savedPosition = localStorage.getItem('keep-ai-memory-float-position');
    if (savedPosition) {
      const position = JSON.parse(savedPosition);
      
      // 兼容旧版本的绝对像素位置数据
      if (position.x !== undefined && position.y !== undefined) {
        // 旧版本数据，转换为边缘距离格式并保存
        const distanceFromLeft = position.x;
        const distanceFromRight = window.innerWidth - position.x;
        const distanceFromTop = position.y;
        const distanceFromBottom = window.innerHeight - position.y;
        
        const newPosition = {
          anchor: distanceFromLeft <= distanceFromRight ? 'left' : 'right',
          distance: Math.min(distanceFromLeft, distanceFromRight),
          verticalAnchor: distanceFromTop <= distanceFromBottom ? 'top' : 'bottom',
          verticalDistance: Math.min(distanceFromTop, distanceFromBottom)
        };
        
        // 更新存储为新格式
        localStorage.setItem('keep-ai-memory-float-position', JSON.stringify(newPosition));
        return newPosition;
      }
      
      // 兼容百分比版本数据
      if (position.percentX !== undefined && position.percentY !== undefined) {
        // 百分比数据，转换为边缘距离格式
        const x = (position.percentX / 100) * window.innerWidth;
        const y = (position.percentY / 100) * window.innerHeight;
        
        const distanceFromLeft = x;
        const distanceFromRight = window.innerWidth - x;
        const distanceFromTop = y;
        const distanceFromBottom = window.innerHeight - y;
        
        const newPosition = {
          anchor: distanceFromLeft <= distanceFromRight ? 'left' : 'right',
          distance: Math.min(distanceFromLeft, distanceFromRight),
          verticalAnchor: distanceFromTop <= distanceFromBottom ? 'top' : 'bottom',
          verticalDistance: Math.min(distanceFromTop, distanceFromBottom)
        };
        
        // 更新存储为新格式
        localStorage.setItem('keep-ai-memory-float-position', JSON.stringify(newPosition));
        return newPosition;
      }
      
      // 新版本边缘距离数据
      if (position.anchor !== undefined && position.distance !== undefined) {
        return position;
      }
    }
  } catch (error) {
    console.error('恢复悬浮标签位置失败:', error);
  }
  return null;
}

// 创建悬浮标签
function createFloatTag() {
  // 清理可能存在的旧标签
  cleanupExistingFloatTags();
  
  // 创建悬浮标签元素
  floatTag = document.createElement('div');
  floatTag.className = 'keep-ai-memory-float keep-ai-memory-fade-in';
  floatTag.setAttribute('data-keep-ai-memory-tag', 'true'); // 添加标识属性
  
  // 创建图标元素
  iconElement = document.createElement('div');
  iconElement.className = 'keep-ai-memory-icon';
  
  // 创建logo图片元素
  const logoImg = document.createElement('img');
  logoImg.src = chrome.runtime.getURL('icons/logo.svg'); // 使用SVG格式获得最佳清晰度
  logoImg.alt = 'Chat-Memo Logo';
  logoImg.style.width = '16px';
  logoImg.style.height = '16px';
  logoImg.style.display = 'block';
  logoImg.style.objectFit = 'contain'; // 保持比例
  logoImg.style.objectPosition = 'center'; // 居中显示
  
  // 将logo图片添加到图标容器中
  iconElement.appendChild(logoImg);
  
  // 拖动相关变量
  let isDragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let initialX = 0;
  let initialY = 0;
  let clickStartTime = 0;
  
  // 贴边相关变量
  let leftEdgeGuide = null;
  let rightEdgeGuide = null;
  let isEdgeDocked = false;
  let dockedSide = null; // 'left' 或 'right'
  
  // 贴边检测阈值（像素）
  const EDGE_THRESHOLD = 50;
  
  // 创建边缘引导元素
  function createEdgeGuides() {
    // 左边引导
    leftEdgeGuide = document.createElement('div');
    leftEdgeGuide.className = 'edge-guide left';
    leftEdgeGuide.setAttribute('data-keep-ai-memory-guide', 'true');
    document.body.appendChild(leftEdgeGuide);
    
    // 右边引导
    rightEdgeGuide = document.createElement('div');
    rightEdgeGuide.className = 'edge-guide right';
    rightEdgeGuide.setAttribute('data-keep-ai-memory-guide', 'true');
    document.body.appendChild(rightEdgeGuide);
  }
  
  // 显示边缘引导
  function showEdgeGuide(side) {
    if (side === 'left' && leftEdgeGuide) {
      leftEdgeGuide.classList.add('active');
      rightEdgeGuide.classList.remove('active');
    } else if (side === 'right' && rightEdgeGuide) {
      rightEdgeGuide.classList.add('active');
      leftEdgeGuide.classList.remove('active');
    }
  }
  
  // 隐藏边缘引导
  function hideEdgeGuides() {
    if (leftEdgeGuide) leftEdgeGuide.classList.remove('active');
    if (rightEdgeGuide) rightEdgeGuide.classList.remove('active');
  }
  
  // 清理边缘引导元素
  function cleanupEdgeGuides() {
    if (leftEdgeGuide) {
      leftEdgeGuide.remove();
      leftEdgeGuide = null;
    }
    if (rightEdgeGuide) {
      rightEdgeGuide.remove();
      rightEdgeGuide = null;
    }
  }
  
  // 创建边缘引导元素
  createEdgeGuides();
  
  // 为悬浮标签添加拖动功能
  floatTag.addEventListener('mousedown', function(e) {
    clickStartTime = Date.now();
    isDragging = false;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    
    const rect = floatTag.getBoundingClientRect();
    initialX = rect.left;
    initialY = rect.top;
    
    // 添加拖动样式
    floatTag.style.cursor = 'grabbing';
    floatTag.style.userSelect = 'none';
    
    // 阻止默认行为
    e.preventDefault();
  });
  
  document.addEventListener('mousemove', function(e) {
    if (clickStartTime === 0) return;
    
    const deltaX = e.clientX - dragStartX;
    const deltaY = e.clientY - dragStartY;
    
    // 如枟移动距离超过5px，则认为是拖动
     if (!isDragging && (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5)) {
       isDragging = true;
       floatTag.classList.add('dragging'); // 添加拖动样式
       // 如果当前是贴边状态，先退出贴边模式
       if (isEdgeDocked) {
         floatTag.classList.remove('edge-docked', 'left', 'right');
         isEdgeDocked = false;
         dockedSide = null;
       }
     }
     
     if (isDragging) {
       const newX = initialX + deltaX;
       const newY = initialY + deltaY;
       
       // 限制在视窗范围内
       const maxX = window.innerWidth - floatTag.offsetWidth;
       const maxY = window.innerHeight - floatTag.offsetHeight;
       
       const constrainedX = Math.max(0, Math.min(newX, maxX));
       const constrainedY = Math.max(0, Math.min(newY, maxY));
       
       floatTag.style.left = constrainedX + 'px';
       floatTag.style.top = constrainedY + 'px';
       floatTag.style.right = 'auto'; // 清除right定位
       
       // 边缘检测和视觉引导
       const distanceFromLeft = constrainedX;
       const distanceFromRight = window.innerWidth - constrainedX - floatTag.offsetWidth;
       
       // 移除之前的边缘样式
       floatTag.classList.remove('near-edge');
       
       if (distanceFromLeft <= EDGE_THRESHOLD) {
         // 接近左边缘
         showEdgeGuide('left');
         floatTag.classList.add('near-edge');
       } else if (distanceFromRight <= EDGE_THRESHOLD) {
         // 接近右边缘
         showEdgeGuide('right');
         floatTag.classList.add('near-edge');
       } else {
         // 远离边缘
         hideEdgeGuides();
       }
     }
   });
  
  document.addEventListener('mouseup', function(e) {
    if (clickStartTime === 0) return;
    
    const clickDuration = Date.now() - clickStartTime;
    
    // 恢复样式
     floatTag.classList.remove('dragging'); // 移除拖动样式
     floatTag.style.cursor = 'grab';
     floatTag.style.userSelect = 'auto';
     
     // 如果是点击（不是拖动且时间短）
     if (!isDragging && clickDuration < 300) {
      // 检查扩展上下文是否有效
      if (!chrome.runtime?.id) {
        console.log(chrome.i18n.getMessage('extensionContextInvalid') || '扩展上下文已失效，请刷新页面');
        return;
      }
      
      // 向后台脚本发送消息，请求打开侧边栏
      try {
        chrome.runtime.sendMessage({
          type: 'openSidePanel'
        }, function(response) {
          if (chrome.runtime.lastError) {
            console.error('打开侧边栏失败:', chrome.runtime.lastError);
          } else {
            console.log('侧边栏打开请求已发送');
          }
        });
      } catch (error) {
        console.error('发送消息失败:', error);
      }
    }
    
    // 如果进行了拖动，检查是否需要贴边
    if (isDragging) {
      const rect = floatTag.getBoundingClientRect();
      const distanceFromLeft = rect.left;
      const distanceFromRight = window.innerWidth - rect.left - rect.width;
      
      // 检查是否需要贴边
      if (distanceFromLeft <= EDGE_THRESHOLD) {
        // 贴左边
        floatTag.classList.add('edge-docked', 'left');
        floatTag.style.left = '0px';
        floatTag.style.right = 'auto';
        isEdgeDocked = true;
        dockedSide = 'left';
        // 保存贴边状态
        saveFloatTagPosition(0, rect.top, true, 'left');
      } else if (distanceFromRight <= EDGE_THRESHOLD) {
        // 贴右边
        floatTag.classList.add('edge-docked');
        floatTag.classList.remove('left');
        floatTag.style.right = '0px';
        floatTag.style.left = 'auto';
        isEdgeDocked = true;
        dockedSide = 'right';
        // 保存贴边状态
        saveFloatTagPosition(window.innerWidth - rect.width, rect.top, true, 'right');
      } else {
        // 普通位置，保存新位置
        saveFloatTagPosition(rect.left, rect.top, false);
      }
      
      // 清理样式
      floatTag.classList.remove('near-edge');
      hideEdgeGuides();
    }
    
    // 重置拖动状态
    isDragging = false;
    clickStartTime = 0;
  });
  
  // 添加鼠标悬停效果，提示用户可以点击或拖动
  floatTag.style.cursor = 'grab';
  floatTag.title = chrome.i18n.getMessage('clickToOpenManager') || '点击打开记忆管理器，拖动调整位置';
  
  // 恢复之前保存的位置
  const savedPosition = restoreFloatTagPosition();
  if (savedPosition && savedPosition.anchor !== undefined && savedPosition.distance !== undefined) {
    // 根据边缘距离计算实际像素位置
    let targetX, targetY;
    
    // 水平位置计算
    if (savedPosition.anchor === 'left') {
      targetX = savedPosition.distance;
    } else { // right
      targetX = window.innerWidth - savedPosition.distance;
    }
    
    // 垂直位置计算
    if (savedPosition.verticalAnchor === 'top') {
      targetY = savedPosition.verticalDistance;
    } else { // bottom
      targetY = window.innerHeight - savedPosition.verticalDistance;
    }
    
    // 确保位置在当前视窗范围内（考虑标签尺寸）
    const tagWidth = 200;  // 预估悬浮标签宽度
    const tagHeight = 50;  // 预估悬浮标签高度
    const maxX = window.innerWidth - tagWidth;
    const maxY = window.innerHeight - tagHeight;
    
    const constrainedX = Math.max(0, Math.min(targetX, maxX));
    const constrainedY = Math.max(0, Math.min(targetY, maxY));
    
    floatTag.style.left = constrainedX + 'px';
    floatTag.style.top = constrainedY + 'px';
    floatTag.style.right = 'auto'; // 清除CSS中的right定位
    
    // 恢复贴边状态（如果有）
    if (savedPosition.isEdgeDocked) {
      isEdgeDocked = true;
      dockedSide = savedPosition.dockedSide;
      floatTag.classList.add('edge-docked');
      if (dockedSide === 'left') {
        floatTag.classList.add('left');
        floatTag.style.left = '0px';
        floatTag.style.right = 'auto';
      } else {
        floatTag.style.right = '0px';
        floatTag.style.left = 'auto';
      }
    }
  }
  
  // 创建状态文本元素
  statusElement = document.createElement('div');
  statusElement.className = 'keep-ai-memory-status';
  
  // 创建保存按钮（仅在手动保存模式下显示）
  saveButton = document.createElement('div');
  saveButton.className = 'keep-ai-memory-save';
  saveButton.innerHTML = '<span style="font-size: 14px;">💾</span>'; // 使用Unicode保存图标
  saveButton.addEventListener('click', handleManualSave);
  
  // 添加元素到悬浮标签
  floatTag.appendChild(iconElement);
  floatTag.appendChild(statusElement);
  
  // 添加到页面
  document.body.appendChild(floatTag);
  
  // 加载Font Awesome
  loadFontAwesome();
  
  // 根据设置显示不同状态
  updateFloatTagState();
  
  // 监听窗口大小变化，重新调整悬浮标签位置
  let resizeTimeout;
  window.addEventListener('resize', function() {
    // 使用防抖避免频繁调整
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(function() {
      repositionFloatTag();
    }, 100);
  });
}

// 重新定位悬浮标签（基于保存的边缘距离）
function repositionFloatTag() {
  if (!floatTag) return;
  
  const savedPosition = restoreFloatTagPosition();
  if (savedPosition && savedPosition.anchor !== undefined && savedPosition.distance !== undefined) {
    // 检查是否处于贴边状态
    if (savedPosition.isEdgeDocked && savedPosition.dockedSide) {
      // 恢复贴边状态
      floatTag.classList.add('edge-docked');
      if (savedPosition.dockedSide === 'left') {
        floatTag.classList.add('left');
        floatTag.style.left = '0px';
        floatTag.style.right = 'auto';
      } else { // right
        floatTag.classList.remove('left');
        floatTag.style.right = '0px';
        floatTag.style.left = 'auto';
      }
      
      // 垂直位置计算
      let targetY;
      if (savedPosition.verticalAnchor === 'top') {
        targetY = savedPosition.verticalDistance;
      } else { // bottom
        targetY = window.innerHeight - savedPosition.verticalDistance;
      }
      
      // 确保垂直位置在当前视窗范围内
      const rect = floatTag.getBoundingClientRect();
      const tagHeight = rect.height || 50;
      const maxY = window.innerHeight - tagHeight;
      const constrainedY = Math.max(0, Math.min(targetY, maxY));
      
      floatTag.style.top = constrainedY + 'px';
      return; // 贴边状态已处理，不需要继续执行
    }
    
    // 非贴边状态的常规定位
    let targetX, targetY;
    
    // 水平位置计算
    if (savedPosition.anchor === 'left') {
      targetX = savedPosition.distance;
    } else { // right
      targetX = window.innerWidth - savedPosition.distance;
    }
    
    // 垂直位置计算
    if (savedPosition.verticalAnchor === 'top') {
      targetY = savedPosition.verticalDistance;
    } else { // bottom
      targetY = window.innerHeight - savedPosition.verticalDistance;
    }
    
    // 确保位置在当前视窗范围内
    const rect = floatTag.getBoundingClientRect();
    const tagWidth = rect.width || 200;
    const tagHeight = rect.height || 50;
    const maxX = window.innerWidth - tagWidth;
    const maxY = window.innerHeight - tagHeight;
    
    const constrainedX = Math.max(0, Math.min(targetX, maxX));
    const constrainedY = Math.max(0, Math.min(targetY, maxY));
    
    floatTag.style.left = constrainedX + 'px';
    floatTag.style.top = constrainedY + 'px';
    floatTag.style.right = 'auto';
  }
}

// 生成logo HTML的辅助函数
function createLogoHTML(size = '16px') {
  return `<img src="${chrome.runtime.getURL('icons/logo.svg')}" alt="Chat-Memo Logo" style="width: ${size}; height: ${size}; display: block; object-fit: contain; object-position: center;">`;
}

// 设置悬浮标签状态（统一状态管理函数）
function setFloatTagState(state, text, icon) {
  if (!floatTag || !statusElement || !iconElement) return;
  
  // 保存贴边状态
  const isEdgeDockedState = floatTag.classList.contains('edge-docked');
  const isLeftDocked = floatTag.classList.contains('left');
  
  // 移除所有状态类，但保留贴边状态
  floatTag.className = 'keep-ai-memory-float';
  
  // 恢复贴边状态
  if (isEdgeDockedState) {
    floatTag.classList.add('edge-docked');
    if (isLeftDocked) {
      floatTag.classList.add('left');
    }
  }
  
  // 添加当前状态类
  floatTag.classList.add(`keep-ai-memory-${state}`);
  
  // 更新状态文本
  statusElement.textContent = text;
  
  // 更新图标
  iconElement.innerHTML = icon;
}

// 更新悬浮标签状态
function updateFloatTagState() {
  if (!floatTag) return;
  
  if (window.keepAIMemorySettings.autoSave) {
    // 自动保存模式 - 使用logo
    setFloatTagState('auto-save', chrome.i18n.getMessage('autoSaving') || '自动记忆', createLogoHTML());
    
    // 移除保存按钮（如果存在）
    if (saveButton.parentElement === floatTag) {
      floatTag.removeChild(saveButton);
    }
  } else {
    // 手动保存模式 - 使用logo
    setFloatTagState('manual-save', chrome.i18n.getMessage('manualSave') || '手动保存', createLogoHTML());
    
    // 添加保存按钮（如果不存在）
    if (saveButton.parentElement !== floatTag) {
      floatTag.appendChild(saveButton);
    }
  }
}

// 移除保存中状态函数，简化交互流程

// 显示保存成功状态
function showSuccessStatus() {
  const isEdgeDocked = floatTag && floatTag.classList.contains('edge-docked');
  const isAutoSave = window.keepAIMemorySettings && window.keepAIMemorySettings.autoSave;
  
  if (isEdgeDocked && isAutoSave) {
    // 贴边模式下的自动保存：只更改图标，不显示文字
    const originalText = statusElement.textContent;
    iconElement.innerHTML = '<span style="color: #16a34a; font-size: 16px; font-weight: bold;">✓</span>';
    
    // 延迟恢复图标，但保持贴边状态
    setTimeout(() => {
      iconElement.innerHTML = createLogoHTML();
    }, 1500);
  } else {
    // 普通模式或手动保存：显示完整的成功状态
    setFloatTagState('success', chrome.i18n.getMessage('saveSuccess') || '保存成功', '<span style="color: #16a34a; font-size: 16px; font-weight: bold;">✓</span>');
    
    // 延迟恢复原来的状态
    setTimeout(() => {
      updateFloatTagState();
    }, 2000);
  }
}

// 处理手动保存
function handleManualSave() {
  // 触发页面内容捕获
  window.dispatchEvent(new CustomEvent('keep-ai-memory-manual-save'));
  
  // 检查是否处于贴边状态
  const isEdgeDocked = floatTag && floatTag.classList.contains('edge-docked');
  
  if (isEdgeDocked) {
    // 贴边状态下，保持贴边，只更新图标和状态
    iconElement.innerHTML = '<span style="color: #16a34a; font-size: 16px; font-weight: bold;">✓</span>';
    statusElement.textContent = chrome.i18n.getMessage('saveSuccess') || '保存成功';
    
    // 添加成功状态类，但保持贴边状态
    floatTag.classList.remove('keep-ai-memory-manual-save');
    floatTag.classList.add('keep-ai-memory-success');
    
    // 延迟恢复原来的状态
    setTimeout(() => {
      floatTag.classList.remove('keep-ai-memory-success');
      floatTag.classList.add('keep-ai-memory-manual-save');
      iconElement.innerHTML = createLogoHTML();
      statusElement.textContent = chrome.i18n.getMessage('manualSave') || '手动保存';
    }, 2000);
  } else {
    // 非贴边状态，使用标准成功状态显示
    showSuccessStatus();
  }
}

// 加载Font Awesome
function loadFontAwesome() {
  const fontAwesome = document.createElement('link');
  fontAwesome.rel = 'stylesheet';
  fontAwesome.href = chrome.runtime.getURL('lib/fontawesome/all.min.css');
  document.head.appendChild(fontAwesome);
}

// 导出通用函数和设置
window.keepAIMemoryCommon = {
  showSuccessStatus,
  cleanupFloatTags: cleanupExistingFloatTags // 导出清理函数
};

// 导出设置更新方法
window.keepAIMemory = {
  ...(window.keepAIMemory || {}),
  updateSettings: function(newSettings) {
    window.keepAIMemorySettings = Object.assign({}, window.keepAIMemorySettings, newSettings);
    updateFloatTagState();
  },
  // 重置初始化状态的方法（用于调试或特殊情况）
  resetInitialization: function() {
    isInitialized = false;
    cleanupExistingFloatTags();
    // 清理边缘引导元素
    if (typeof cleanupEdgeGuides === 'function') {
      cleanupEdgeGuides();
    }
  }
};

// 统一初始化入口点，防止重复初始化
function safeInit() {
  // 如果已经初始化，直接返回
  if (isInitialized) {
    return;
  }
  
  // 延迟初始化，确保DOM和脚本完全加载
  setTimeout(initCommon, 100);
}

// 根据DOM状态选择合适的初始化时机
if (document.readyState === 'loading') {
  // DOM还在加载中，等待DOMContentLoaded事件
  document.addEventListener('DOMContentLoaded', safeInit);
} else {
  // DOM已经加载完成，直接初始化
  safeInit();
}

// ============= 侧边栏相关功能 =============
// 注意：侧边栏现在使用 Chrome Side Panel API
// 旧的注入式侧边栏代码（createSidebar, toggleSidebar 等）已移除
