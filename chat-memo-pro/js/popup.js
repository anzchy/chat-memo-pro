/**
 * Chat Memo 弹出窗口脚本
 * 负责显示、管理记忆列表与设置
 */

// 当前查看的对话ID
let currentConversationId = null;

// 搜索相关变量
let allConversations = []; // 存储所有对话数据
let filteredConversations = []; // 存储过滤后的对话数据
let currentSearchTerm = ''; // 当前搜索词

// 多选相关变量
let isMultiSelectMode = false; // 是否处于多选模式
let selectedConversations = new Set(); // 存储选中的对话ID

// 动画时间常量
const ANIMATION_DURATION = 200; // 毫秒

// 平台名称映射（全局统一管理）
const PLATFORM_NAMES = {
  'chatgpt': 'ChatGPT',
  'gemini': 'Gemini',
  'claude': 'Claude',
  'deepseek': 'DeepSeek',
  'yuanbao': '腾讯元宝',
  'doubao': '豆包',
  'kimi': 'Kimi'
};

// DOM元素缓存
const elements = {
  // 标签页
  tabMemories: document.getElementById('tab-memories'),
  tabSettings: document.getElementById('tab-settings'),
  memoriesContent: document.getElementById('memories-content'),
  settingsContent: document.getElementById('settings-content'),
  
  // 搜索相关
  searchContainer: document.getElementById('search-container'),
  searchInput: document.getElementById('search-input'),
  clearSearch: document.getElementById('clear-search'),
  
  // 筛选相关
  filterToggle: document.getElementById('filter-toggle'),
  filterDropdown: document.getElementById('filter-dropdown'),
  filterIcon: document.getElementById('filter-icon'),

  startDate: document.getElementById('start-date'),
  endDate: document.getElementById('end-date'),
  startDateClear: document.getElementById('start-date-clear'),
  endDateClear: document.getElementById('end-date-clear'),
  startDatePicker: document.getElementById('start-date-picker'),
  endDatePicker: document.getElementById('end-date-picker'),
  dateWeek: document.getElementById('date-week'),
  dateMonth: document.getElementById('date-month'),
  platformTagsContainer: document.getElementById('platform-tags-container'),
  platformTags: document.getElementById('platform-tags'),
  platformPlaceholder: document.getElementById('platform-placeholder'),
  platformDropdownMenu: document.getElementById('platform-dropdown-menu'),
  applyFilter: document.getElementById('apply-filter'),
  clearFilter: document.getElementById('clear-filter'),
  
  // 搜索结果信息
  searchResultInfo: document.getElementById('search-result-info'),
  resultCountText: document.getElementById('result-count-text'),
  multiSelectToggle: document.getElementById('multi-select-toggle'),
  exportFilteredBtn: document.getElementById('export-filtered-btn'),
  exportFilteredDropdown: document.getElementById('export-filtered-dropdown'),
  exportFilteredSeparate: document.getElementById('export-filtered-separate'),
  exportFilteredMerged: document.getElementById('export-filtered-merged'),
  
  // 记忆列表状态
  memoriesLoading: document.getElementById('memories-loading'),
  memoriesEmpty: document.getElementById('memories-empty'),
  memoriesList: document.getElementById('memories-list'),
  
  // 对话详情
  conversationDetail: document.getElementById('conversation-detail'),
  backToList: document.getElementById('back-to-list'),
  detailTitle: document.getElementById('detail-title'),
  detailTitleInput: document.getElementById('detail-title-input'),
  editTitle: document.getElementById('edit-title'),
  editTitleIcon: document.getElementById('edit-title-icon'),
  openOriginal: document.getElementById('open-original'),
  moreActions: document.getElementById('more-actions'),
  moreActionsDropdown: document.getElementById('more-actions-dropdown'),
  copyConversation: document.getElementById('copy-conversation'),
  detailPlatform: document.getElementById('detail-platform'),
  detailUpdated: document.getElementById('detail-updated'),
  detailMessagesCount: document.getElementById('detail-messages-count'),
  detailMessages: document.getElementById('detail-messages'),
  
  // 修改标题对话框
  editTitleModal: document.getElementById('edit-title-modal'),
  titleInput: document.getElementById('title-input'),
  cancelEdit: document.getElementById('cancel-edit'),
  saveTitle: document.getElementById('save-title'),
  
  // 删除确认对话框
  deleteConfirmModal: document.getElementById('delete-confirm-modal'),
  cancelDelete: document.getElementById('cancel-delete'),
  confirmDelete: document.getElementById('confirm-delete'),
  
  // 设置页面
  autoSaveToggle: document.getElementById('auto-save-toggle'),
  exportBtn: document.getElementById('export-btn'),
  clearBtn: document.getElementById('clear-btn'),
  storageUsage: document.getElementById('storage-usage'),
  storageBar: document.getElementById('storage-bar'),
  
  // 清空确认弹窗
  clearConfirmModal: document.getElementById('clear-confirm-modal'),
  cancelClear: document.getElementById('cancel-clear'),
  confirmClear: document.getElementById('confirm-clear'),
  
  // 顶部概览
  dataOverview: document.querySelector('header'),
  totalConversations: document.getElementById('total-conversations'),
  todayConversations: document.getElementById('today-conversations')
};

// 初始化页面
document.addEventListener('DOMContentLoaded', () => {
  // 初始化国际化
  I18n.initPageI18n();
  
  // 设置版本号
  setVersionNumber();
  
  // 注册事件监听器
  registerEventListeners();
  
  // 加载记忆列表
  loadConversations();
  
  // 加载设置
  loadSettings();
  
  // 加载存储使用情况
  loadStorageUsage();
  
  // 初始化筛选功能
  initializeFilter();
  
  // 动态生成支持平台列表
  generateSupportedPlatformsList();
  
  // 初始化清除搜索按钮状态
  updateClearSearchButtonState();
  
  // 初始化多选按钮状态
  elements.multiSelectToggle.style.display = 'none';
  
  // 监听storage变化来自动刷新
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.sidebar_refresh_trigger) {
      // 自动刷新数据
      loadConversations();
      loadStorageUsage();
      
      // 如果当前在详情页，也刷新详情页
      refreshDetailPageIfActive();
    }
  });
});

// 当弹窗显示时重新加载数据
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    // 如果当前在记忆列表页面，刷新列表
    if (elements.memoriesContent.classList.contains('active') && 
        elements.conversationDetail.classList.contains('hidden')) {
      loadConversations();
    }
    // 刷新存储使用情况
    loadStorageUsage();
    
    // 如果当前在详情页，也刷新详情页
    refreshDetailPageIfActive();
  }
});

// 注册事件监听器
function registerEventListeners() {
  // 标签页切换
  elements.tabMemories.addEventListener('click', () => switchTab('memories'));
  elements.tabSettings.addEventListener('click', () => switchTab('settings'));

  
  // 联系我们按钮
  const contactUsBtn = document.getElementById('contact-us');
  if (contactUsBtn) {
    contactUsBtn.addEventListener('click', () => {
      // 打开联系我们页面
      chrome.tabs.create({
        url: 'https://zkv549gmz8.feishu.cn/share/base/form/shrcnQRBNhLNtVBWSClmb9EKNyd'
      });
    });
  }
  
  // 返回列表
  elements.backToList.addEventListener('click', showMemoriesList);
  
  // 编辑标题
  elements.editTitle.addEventListener('click', handleEditButtonClick);
  elements.detailTitle.addEventListener('dblclick', startInlineEdit);
  elements.detailTitleInput.addEventListener('keydown', handleInlineEditKeydown);
  
  // 点击外部区域保存标题
  document.addEventListener('click', handleOutsideClick);
  elements.cancelEdit.addEventListener('click', hideEditTitleModal);
  elements.saveTitle.addEventListener('click', saveConversationTitle);
  
  // 详情页跳转到原始页面
  elements.openOriginal.addEventListener('click', () => {
    if (currentConversationId) {
      chrome.runtime.sendMessage({
        type: 'getConversationById',
        conversationId: currentConversationId
      }, (response) => {
        if (response && response.conversation && response.conversation.link) {
          openOriginalPage(response.conversation.link);
          hideMoreActionsDropdown();
        }
      });
    }
  });
  
  // 更多操作下拉菜单 - 悬停和点击都可触发
  elements.moreActions.addEventListener('mouseenter', (e) => {
    // 如果标题正在编辑状态，不触发下拉菜单
    if (!elements.detailTitleInput.classList.contains('hidden')) {
      return;
    }
    showMoreActionsDropdown();
  });
  
  // 更多操作按钮点击事件
  elements.moreActions.addEventListener('click', (e) => {
    e.stopPropagation();
    // 如果标题正在编辑状态，视为失焦，保存标题
    if (!elements.detailTitleInput.classList.contains('hidden')) {
      saveInlineEdit();
      return;
    }
    // 如果下拉菜单已显示，则隐藏；否则显示
    if (elements.moreActionsDropdown.classList.contains('hidden')) {
      showMoreActionsDropdown();
    } else {
      hideMoreActionsDropdown();
    }
  });
  
  // 更多操作按钮容器的鼠标离开事件
  const moreActionsContainer = elements.moreActions.closest('.relative');
  if (moreActionsContainer) {
    moreActionsContainer.addEventListener('mouseleave', (e) => {
      // 延迟隐藏，给用户时间移动到下拉菜单
      setTimeout(() => {
        // 检查鼠标是否在下拉菜单区域内
        if (!elements.moreActionsDropdown.matches(':hover') && 
            !elements.moreActions.matches(':hover')) {
          hideMoreActionsDropdown();
        }
      }, 100);
    });
  }
  
  // 下拉菜单的鼠标离开事件
  elements.moreActionsDropdown.addEventListener('mouseleave', (e) => {
    // 延迟隐藏，给用户时间移动回按钮
    setTimeout(() => {
      if (!elements.moreActions.matches(':hover') && 
          !elements.moreActionsDropdown.matches(':hover')) {
        hideMoreActionsDropdown();
      }
    }, 100);
  });
  
  // 复制对话
  elements.copyConversation.addEventListener('click', () => {
    copyCurrentConversation();
    // 保持下拉菜单打开，让用户看到复制成功提示
    // hideMoreActionsDropdown();
  });
  
  // 详情页删除按钮
  const deleteConversationDetailBtn = document.getElementById('delete-conversation-detail');
  if (deleteConversationDetailBtn) {
    deleteConversationDetailBtn.addEventListener('click', () => {
      if (currentConversationId) {
        showDeleteModal(currentConversationId);
        hideMoreActionsDropdown();
      }
    });
  }
  
  // 删除确认
  elements.cancelDelete.addEventListener('click', hideDeleteModal);
  elements.confirmDelete.addEventListener('click', deleteCurrentConversation);
  
  // 设置页面
  elements.autoSaveToggle.addEventListener('change', updateAutoSaveSetting);
  elements.clearBtn.addEventListener('click', showClearConfirmModal);
  
  // 绑定导出按钮下拉菜单事件
  const exportDropdown = document.getElementById('export-dropdown');
  const exportSeparateBtn = document.getElementById('export-separate');
  const exportMergedBtn = document.getElementById('export-merged');
  
  // 点击导出按钮显示/隐藏下拉菜单
  elements.exportBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    exportDropdown.classList.toggle('hidden');
  });
  
  // 点击其他地方隐藏下拉菜单
  document.addEventListener('click', () => {
    exportDropdown.classList.add('hidden');
  });
  
  // 阻止下拉菜单内部点击事件冒泡
  exportDropdown.addEventListener('click', (e) => {
    e.stopPropagation();
  });
  
  // 绑定分别导出按钮事件
  exportSeparateBtn.addEventListener('click', () => {
    exportDropdown.classList.add('hidden');
    exportAllConversations('separate', elements.exportBtn); // 使用主按钮显示状态
  });
  
  // 绑定合并导出按钮事件
  exportMergedBtn.addEventListener('click', () => {
    exportDropdown.classList.add('hidden');  
    exportAllConversations('merged', elements.exportBtn); // 使用主按钮显示状态
  });
  
  // 清空确认弹窗
  elements.cancelClear.addEventListener('click', hideClearConfirmModal);
  elements.confirmClear.addEventListener('click', clearStorage);
  
  // 搜索功能
  elements.searchInput.addEventListener('input', handleSearchInput);
  elements.clearSearch.addEventListener('click', clearSearchInput);
  
  // 多选模式切换
  elements.multiSelectToggle.addEventListener('click', toggleMultiSelectMode);
  
  // 导出筛选结果 - 切换下拉菜单
  elements.exportFilteredBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleFilteredExportDropdown();
  });
  
  // 导出筛选结果 - 分别导出
  elements.exportFilteredSeparate.addEventListener('click', () => {
    hideFilteredExportDropdown();
    exportFilteredConversations('separate');
  });
  
  // 导出筛选结果 - 合并导出
  elements.exportFilteredMerged.addEventListener('click', () => {
    hideFilteredExportDropdown();
    exportFilteredConversations('merged');
  });
  
  // 搜索框回车键处理
  elements.searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
    }
  });
  
  // 筛选功能
  elements.filterToggle.addEventListener('click', toggleFilterDropdown);
  elements.applyFilter.addEventListener('click', applyFilter);
  elements.clearFilter.addEventListener('click', clearFilter);
  
  // 日期快捷选项
  elements.dateWeek.addEventListener('click', () => setQuickDateRange(7));
  elements.dateMonth.addEventListener('click', () => setQuickDateRange(30));
  
  // 日期输入框事件处理
  setupDateInputHandlers();
  
  // 平台标签容器点击事件
  elements.platformTagsContainer.addEventListener('click', (e) => {
    e.stopPropagation();
    togglePlatformDropdown();
  });
  
  // 平台选项点击事件
  const platformOptions = elements.platformDropdownMenu.querySelectorAll('.platform-option');
  platformOptions.forEach(option => {
    option.addEventListener('click', (e) => {
      e.stopPropagation();
      const platform = option.getAttribute('data-platform');
      togglePlatformSelection(platform);
    });
  });
  
  // 防止平台下拉菜单内部点击事件冒泡
  elements.platformDropdownMenu.addEventListener('click', (e) => {
    e.stopPropagation();
  });
  
  // 筛选下拉菜单内部点击事件处理
  elements.filterDropdown.addEventListener('click', (e) => {
    // 检查是否点击了特殊区域（平台或日期相关）
    const isSpecialArea = e.target.closest('#platform-tags-container') || 
                         e.target.closest('#platform-dropdown-menu') ||
                         e.target.closest('#start-date') ||
                         e.target.closest('#end-date') ||
                         e.target.closest('#start-date-picker') ||
                         e.target.closest('#end-date-picker');
    
    if (!isSpecialArea) {
      e.stopPropagation();
      // 关闭所有弹出菜单
      hidePlatformDropdown();
      hideDatePicker('start');
      hideDatePicker('end');
    }
  });
  
  // 为thinking-toggle添加事件监听器，同时处理下拉菜单的全局点击关闭
  document.addEventListener('click', (e) => {
    const toggle = e.target.closest('.thinking-toggle');
    if (toggle) {
      const thinkingId = toggle.getAttribute('data-thinking-id');
      if (thinkingId) {
        toggleThinking(thinkingId);
      }
    }
    
    // 点击其他地方关闭下拉菜单（保留点击关闭功能作为备用）
    if (!e.target.closest('#more-actions') && !e.target.closest('#more-actions-dropdown')) {
      hideMoreActionsDropdown();
    }
    
    // 点击其他地方关闭筛选下拉菜单
    if (!e.target.closest('#filter-toggle') && !e.target.closest('#filter-dropdown')) {
      hideFilterDropdown();
    }
    
    // 点击其他地方关闭平台下拉菜单
    if (!e.target.closest('#platform-tags-container') && 
        !e.target.closest('#platform-dropdown-menu') && 
        !e.target.closest('#filter-dropdown')) {
      hidePlatformDropdown();
    }
    
    // 点击其他地方关闭日期选择器
    if (!e.target.closest('#start-date-picker') && !e.target.closest('#start-date')) {
      hideDatePicker('start');
    }
    if (!e.target.closest('#end-date-picker') && !e.target.closest('#end-date')) {
      hideDatePicker('end');
    }
    
    // 点击其他地方关闭筛选下拉菜单
    if (!e.target.closest('#filter-toggle') && !e.target.closest('#filter-dropdown')) {
      hideFilterDropdown();
    }
    
    // 点击其他地方关闭平台下拉菜单
    if (!e.target.closest('#platform-tags-container') && 
        !e.target.closest('#platform-dropdown-menu') && 
        !e.target.closest('#filter-dropdown')) {
      hidePlatformDropdown();
    }
    
    // 点击其他地方关闭日期选择器
    if (!e.target.closest('#start-date-picker') && !e.target.closest('#start-date')) {
      hideDatePicker('start');
    }
    if (!e.target.closest('#end-date-picker') && !e.target.closest('#end-date')) {
      hideDatePicker('end');
    }
  });
}

// 切换标签页
function switchTab(tabName) {
  const tabs = document.querySelectorAll('.sidebar-btn');
  const contents = document.querySelectorAll('.tab-content');
  
  // 显示主导航和概览（从详情页返回时），但设置页面不显示概览
  if (tabName !== 'settings') {
    elements.dataOverview.classList.remove('hidden');
  } else {
    elements.dataOverview.classList.add('hidden');
  }
  
  // 隐藏详情页
  elements.conversationDetail.classList.add('hidden');
  
  // 更新标签按钮样式
  tabs.forEach(tab => {
    if (tab.id === `tab-${tabName}`) {
      tab.classList.add('active');
    } else {
      tab.classList.remove('active');
    }
  });
  
  // 更新内容显示
  contents.forEach(content => {
    if (content.id === `${tabName}-content`) {
      content.classList.add('active');
      content.classList.remove('hidden');
    } else {
      content.classList.remove('active');
      content.classList.add('hidden');
    }
  });
  
  // 如果切换到记忆列表，刷新数据
  if (tabName === 'memories') {
    // 每次切换到记忆列表时刷新数据
    loadConversations();
    
    // 刷新存储使用情况
    loadStorageUsage();
  }
}

// 加载对话列表
function loadConversations() {
  // 显示加载状态
  elements.memoriesLoading.classList.remove('hidden');
  elements.memoriesEmpty.classList.add('hidden');
  elements.memoriesList.classList.add('hidden');
  
  // 获取所有对话
  chrome.runtime.sendMessage({type: 'getAllConversations'}, (response) => {
    // 隐藏加载状态
    elements.memoriesLoading.classList.add('hidden');
    
    if (response && response.conversations && response.conversations.length > 0) {
      // 存储所有对话数据
      allConversations = response.conversations;
      
      // 应用当前搜索过滤
      performSearch(currentSearchTerm);
    } else {
      // 无数据
      allConversations = [];
      filteredConversations = [];
      elements.memoriesEmpty.classList.remove('hidden');
    }
  });
}

// 渲染对话卡片
function renderConversationCards(conversations) {
  // 清空列表
  const cardsContainer = elements.memoriesList.querySelector('div') || elements.memoriesList;
  cardsContainer.innerHTML = '';
  
  // 为每个对话创建卡片
  conversations.forEach(conversation => {
    const card = createConversationCard(conversation);
    cardsContainer.appendChild(card);
  });
}

// HTML转义函数
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// 创建单个对话卡片
function createConversationCard(conversation) {
  const card = document.createElement('div');
  card.className = 'memory-card bg-white p-4 rounded-lg shadow-sm relative';
  
  // 最后一条消息作为摘要
  const lastMessage = conversation.messages && conversation.messages.length > 0 
    ? conversation.messages[conversation.messages.length - 1] 
    : null;
  
  // 安全处理标题和摘要内容，防止HTML注入，并添加搜索高亮
  const titleText = conversation.title || i18n('noTitle');
  
  // 如果有搜索词，显示搜索命中的片段；否则显示最后一条消息
  let summaryText;
  if (currentSearchTerm && conversation.messages) {
    // 查找包含搜索词的消息片段
    summaryText = findMatchingSnippet(conversation, currentSearchTerm);
  } else {
    // 默认显示最后一条消息
    summaryText = lastMessage 
      ? lastMessage.content.substring(0, 100) + (lastMessage.content.length > 100 ? '...' : '')
      : i18n('noContent');
  }
  
  // 如果有搜索词，则高亮显示，否则正常转义
  const safeTitle = currentSearchTerm ? highlightSearchTerm(titleText, currentSearchTerm) : escapeHtml(titleText);
  const safeSummary = currentSearchTerm ? highlightSearchTerm(summaryText, currentSearchTerm) : escapeHtml(summaryText);
  
  // 判断是否选中状态
  const isSelected = selectedConversations.has(conversation.conversationId);
  
  // 卡片内容
  if (isMultiSelectMode) {
    // 多选模式下的卡片布局
    card.innerHTML = `
      <!-- 多选模式下的布局 -->
      <div class="flex gap-3">
        <!-- 圆形选择器 -->
        <div class="flex-shrink-0 mt-0.5">
          <div class="multi-select-checkbox w-5 h-5 rounded-full border-2 border-gray-300 flex items-center justify-center cursor-pointer transition-all duration-200 ${isSelected ? 'bg-blue-500 border-blue-500' : 'hover:border-blue-400'}">
            ${isSelected ? '<i class="fas fa-check text-white text-xs"></i>' : ''}
          </div>
        </div>
        
        <!-- 卡片内容区域 -->
        <div class="flex-1 min-w-0">
          <!-- 标题和按钮区域 -->
          <div class="flex items-center justify-between mb-2 gap-2">
            <h3 class="font-medium text-sm truncate flex-1">${safeTitle}</h3>
            <!-- 操作按钮区域 - 标题右侧 -->
            <div class="flex items-center gap-1 card-action opacity-0 transition-opacity duration-200 flex-shrink-0">
              <button class="edit-title text-gray-400 hover:text-blue-500 p-1 rounded" title="${escapeHtml(i18n('editConversationTitle') || '编辑标题')}">
                <i class="fas fa-edit text-xs"></i>
              </button>
              <button class="open-original text-gray-400 hover:text-blue-500 p-1 rounded" title="${escapeHtml(i18n('openOriginalPage'))}">
                <i class="fas fa-arrow-up-right-from-square text-xs"></i>
              </button>
              <button class="delete-conversation text-gray-400 hover:text-red-500 p-1 rounded" title="${escapeHtml(i18n('delete'))}">
                <i class="fas fa-trash-alt text-xs"></i>
              </button>
            </div>
          </div>
          
          <!-- 摘要内容 -->
          <p class="text-gray-600 text-sm mb-3 line-clamp-2">
            ${safeSummary}
          </p>
          
          <!-- 底部信息区域 -->
          <div class="flex items-center justify-between text-xs text-gray-500 gap-2">
            <div class="flex items-center gap-3 flex-1 min-w-0">
              <div class="platform-tag platform-${conversation.platform}">${formatPlatformName(conversation.platform)}</div>
              <div class="flex items-center gap-1">
                <i class="fas fa-comment-dots opacity-70"></i>
                <span class="font-medium">${conversation.messages.length}</span>
              </div>
            </div>
            
            <!-- 时间显示区域 - 右下角 -->
            <div class="text-xs text-gray-400 flex-shrink-0">
              <span>${formatTimestamp(getCompatibleTime(conversation))}</span>
            </div>
          </div>
        </div>
      </div>
    `;
  } else {
    // 普通模式下的卡片布局
    card.innerHTML = `
      <!-- 标题和按钮区域 -->
      <div class="flex items-center justify-between mb-2 gap-2">
        <h3 class="font-medium text-sm truncate flex-1">${safeTitle}</h3>
        <!-- 操作按钮区域 - 标题右侧 -->
        <div class="flex items-center gap-1 card-action opacity-0 transition-opacity duration-200 flex-shrink-0">
          <button class="edit-title text-gray-400 hover:text-blue-500 p-1 rounded" title="${escapeHtml(i18n('editConversationTitle') || '编辑标题')}">
            <i class="fas fa-edit text-xs"></i>
          </button>
          <button class="open-original text-gray-400 hover:text-blue-500 p-1 rounded" title="${escapeHtml(i18n('openOriginalPage'))}">
            <i class="fas fa-arrow-up-right-from-square text-xs"></i>
          </button>
          <button class="delete-conversation text-gray-400 hover:text-red-500 p-1 rounded" title="${escapeHtml(i18n('delete'))}">
            <i class="fas fa-trash-alt text-xs"></i>
          </button>
        </div>
      </div>
      
      <!-- 摘要内容 -->
      <p class="text-gray-600 text-sm mb-3 line-clamp-2">
        ${safeSummary}
      </p>
      
      <!-- 底部信息区域 -->
      <div class="flex items-center justify-between text-xs text-gray-500 gap-2">
        <div class="flex items-center gap-3 flex-1 min-w-0">
          <div class="platform-tag platform-${conversation.platform}">${formatPlatformName(conversation.platform)}</div>
          <div class="flex items-center gap-1">
            <i class="fas fa-comment-dots opacity-70"></i>
            <span class="font-medium">${conversation.messages.length}</span>
          </div>
        </div>
        
        <!-- 时间显示区域 - 右下角 -->
        <div class="text-xs text-gray-400 flex-shrink-0">
          <span>${formatTimestamp(getCompatibleTime(conversation))}</span>
        </div>
      </div>
    `;
  }

  // 显式移除title属性以防止tooltip
  const cardTitleElement = card.querySelector('h3');
  if (cardTitleElement) {
    cardTitleElement.removeAttribute('title');
  }
  const cardSummaryElement = card.querySelector('p');
  if (cardSummaryElement) {
    cardSummaryElement.removeAttribute('title');
  }
  
  // 添加点击事件：卡片主体
  card.addEventListener('click', (e) => {
    // 排除操作按钮的点击
    if (!e.target.closest('.open-original') && !e.target.closest('.delete-conversation') && !e.target.closest('.edit-title')) {
      if (isMultiSelectMode) {
        // 多选模式：切换选中状态
        toggleConversationSelection(conversation.conversationId, card);
      } else {
        // 普通模式：显示对话详情
        showConversationDetail(conversation);
      }
    }
  });
  
  // 多选模式下的圆形选择器点击事件
  if (isMultiSelectMode) {
    const checkbox = card.querySelector('.multi-select-checkbox');
    if (checkbox) {
      checkbox.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleConversationSelection(conversation.conversationId, card);
      });
    }
  }
  
  // 编辑标题按钮
  const editBtn = card.querySelector('.edit-title');
  editBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    currentConversationId = conversation.conversationId;
    showEditTitleModal();
  });
  
  // 打开原始页面按钮
  const openBtn = card.querySelector('.open-original');
  openBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    openOriginalPage(conversation.link);
  });
  
  // 删除按钮
  const deleteBtn = card.querySelector('.delete-conversation');
  deleteBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    showDeleteModal(conversation.conversationId);
  });
  
  return card;
}

// 显示对话详情
function showConversationDetail(conversation) {
  currentConversationId = conversation.conversationId;
  
  // 隐藏主导航和概览
  elements.dataOverview.classList.add('hidden');
  
  // 隐藏所有tab内容
  const contents = document.querySelectorAll('.tab-content');
  contents.forEach(content => {
    content.classList.remove('active');
    content.classList.add('hidden');
  });
  
  // 显示详情页
  elements.conversationDetail.classList.remove('hidden');
  elements.conversationDetail.classList.add('active');
  
  // 更新详情页信息
  elements.detailTitle.textContent = conversation.title || i18n('noTitle');
  elements.detailPlatform.textContent = formatPlatformName(conversation.platform);
  elements.detailPlatform.className = `platform-tag platform-${conversation.platform} mr-2`;
  elements.detailUpdated.textContent = formatTimestamp(getCompatibleTime(conversation));
  elements.detailMessagesCount.textContent = conversation.messages.length;
  
  // 渲染消息（传入当前搜索词用于高亮）
  renderConversationMessages(conversation.messages, currentSearchTerm);
}

// 将纯文本转换为HTML，保持换行和格式
function formatTextToHtml(text) {
  if (!text) return '';
  
  // 转义HTML特殊字符
  let escapedText = escapeHtml(text);
  
  // 将换行符转换为<br>标签
  escapedText = escapedText.replace(/\n/g, '<br>');
  
  // 处理多个连续空格（保持原有的空格格式）
  escapedText = escapedText.replace(/  +/g, (match) => {
    return '&nbsp;'.repeat(match.length);
  });
  
  return escapedText;
}

// 检查消息是否需要折叠
function checkIfMessageNeedsCollapse(content) {
  if (!content) return false;
  
  // 检查字符长度（超过140个字符）
  if (content.length > 140) return true;
  
  return false;
}

// 切换消息内容的展开/收折状态
function toggleMessageContent(contentId) {
  const contentElement = document.getElementById(contentId);
  const toggleButton = contentElement.parentElement.querySelector('.message-toggle');
  
  if (!contentElement || !toggleButton) return;
  
  const isCollapsed = contentElement.classList.contains('collapsed');
  const toggleText = toggleButton.querySelector('.toggle-text');
  const toggleIcon = toggleButton.querySelector('i');
  
  if (isCollapsed) {
    // 展开
    contentElement.classList.remove('collapsed');
    toggleText.textContent = '收起';
    toggleButton.classList.add('expanded');
  } else {
    // 收起
    contentElement.classList.add('collapsed');
    toggleText.textContent = '展开';
    toggleButton.classList.remove('expanded');
    
    // 滚动到消息顶部
    setTimeout(() => {
      contentElement.closest('.message-user, .message-ai').scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }, 100);
  }
}

// 渲染对话消息
function renderConversationMessages(messages, searchTerm = '') {
  // 清空消息容器
  elements.detailMessages.innerHTML = '';
  
  let firstMatchElement = null; // 记录第一个匹配的消息元素
  
  // 添加每条消息
  messages.forEach((message, index) => {
    const messageElement = document.createElement('div');
    messageElement.className = `${message.sender === 'user' ? 'message-user' : 'message-ai'}`;
    messageElement.setAttribute('data-message-index', index);
    
    let content = '';
    
    // 消息头部：发送者和时间戳
    content += `<div class="flex justify-between items-start mb-2">
      <div class="message-sender">${message.sender === 'user' ? i18n('user') : i18n('ai')}</div>
      <div class="message-timestamp">${formatTime(getCompatibleTime(message))}</div>
    </div>`;
    
    // 如果是AI消息且有thinking内容
    if (message.sender === 'AI' && message.thinking) {
      const thinkingId = `thinking-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      let thinkingContent = message.thinking;
      
      // 如果有搜索词，先对原始文本进行高亮，再转换为HTML
      if (searchTerm) {
        thinkingContent = highlightSearchTermForDetail(thinkingContent, searchTerm);
      } else {
        thinkingContent = formatTextToHtml(thinkingContent);
      }
      
      content += `<div class="thinking-block">
        <div class="thinking-toggle" data-thinking-id="${thinkingId}">
          <div class="thinking-title">${i18n('thinkingProcess')}</div>
          <div class="thinking-arrow" id="arrow-${thinkingId}"></div>
        </div>
        <div class="thinking-content" id="${thinkingId}" style="display: none;">
          <div style="white-space: pre-wrap; word-wrap: break-word; color: #64748b; font-size: 12px; line-height: 1.5; margin: 0;">${thinkingContent}</div>
        </div>
      </div>`;
    }
    
    // 消息内容 - 先进行高亮处理，再转换为HTML格式
    let messageContent = message.content;
    
    // 如果有搜索词，先对原始文本进行高亮
    if (searchTerm) {
      messageContent = highlightSearchTermForDetail(messageContent, searchTerm);
    } else {
      // 没有搜索词时，正常转换为HTML
      messageContent = formatTextToHtml(messageContent);
    }
    
    // 检查消息内容是否需要折叠（超过一定长度或行数）
    const needsCollapse = checkIfMessageNeedsCollapse(message.content);
    const contentId = `content-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    content += `<div class="message-content-wrapper">
      <div class="message-content${needsCollapse ? ' collapsed' : ''}" id="${contentId}">${messageContent}</div>
      ${needsCollapse ? `<button class="message-toggle" data-content-id="${contentId}">
        <span class="toggle-text">展开</span>
        <i class="fas fa-chevron-down"></i>
      </button>` : ''}
    </div>`;
    
    messageElement.innerHTML = content;
    elements.detailMessages.appendChild(messageElement);
    
    // 检查是否包含搜索词（用于自动滚动定位）
    if (searchTerm && !firstMatchElement) {
      const keywords = searchTerm.toLowerCase().split(/\s+/).filter(k => k.length > 0);
      const messageText = (message.content + ' ' + (message.thinking || '')).toLowerCase();
      
      // 检查是否所有关键词都在消息中
      const hasAllKeywords = keywords.every(keyword => messageText.includes(keyword));
      if (hasAllKeywords) {
        firstMatchElement = messageElement;
      }
    }
  });
  
  // 添加消息展开/收折按钮的事件监听器
  const toggleButtons = elements.detailMessages.querySelectorAll('.message-toggle');
  toggleButtons.forEach(button => {
    button.addEventListener('click', function() {
      const contentId = this.getAttribute('data-content-id');
      toggleMessageContent(contentId);
    });
  });
  
  // 如果有搜索词，尝试滚动到第一个高亮位置
  if (searchTerm) {
    setTimeout(() => {
      const firstMark = elements.detailMessages.querySelector('mark');
      if (firstMark) {
        firstMark.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        });
      } else if (firstMatchElement) {
        // 如果没有mark标签（可能在摘要中），则回退到滚动到整个元素
        firstMatchElement.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        });
      }
    }, 100); // 延迟确保DOM渲染完成
  } else {
    // 没有搜索词时滚动到底部
    elements.detailMessages.scrollTop = elements.detailMessages.scrollHeight;
  }
}

// 返回列表页面
function showMemoriesList() {
  // 使用switchTab函数来正确处理返回逻辑
  switchTab('memories');
  currentConversationId = null;
}

// 显示修改标题对话框
function showEditTitleModal() {
  // 获取当前对话
  chrome.runtime.sendMessage({
    type: 'getConversationById', 
    conversationId: currentConversationId
  }, (response) => {
    if (response && response.conversation) {
      elements.titleInput.value = response.conversation.title || '';
      elements.editTitleModal.classList.remove('hidden');
    }
  });
}

// 隐藏修改标题对话框
function hideEditTitleModal() {
  elements.editTitleModal.classList.add('hidden');
}

// 保存对话标题
function saveConversationTitle() {
  const newTitle = elements.titleInput.value.trim();
  
  if (!newTitle) {
    alert(i18n('inputNewTitle'));
    return;
  }
  
  // 获取当前对话
  chrome.runtime.sendMessage({
    type: 'getConversationById', 
    conversationId: currentConversationId
  }, (response) => {
    if (response && response.conversation) {
      const conversation = response.conversation;
      conversation.title = newTitle;
      
      // 更新到数据库
      chrome.runtime.sendMessage({
        type: 'updateConversation',
        conversation: conversation
      }, (updateResponse) => {
        if (updateResponse && updateResponse.status === 'ok') {
          // 更新UI
          elements.detailTitle.textContent = newTitle;
          hideEditTitleModal();
          // 刷新列表
          loadConversations();
        } else {
          alert(i18n('saveFailed') || '保存失败，请重试');
        }
      });
    }
  });
}

// 处理编辑按钮点击
function handleEditButtonClick(e) {
  e.stopPropagation();
  
  // 如果当前在编辑状态，保存标题
  if (!elements.detailTitleInput.classList.contains('hidden')) {
    saveInlineEdit();
  } else {
    // 否则开始编辑
    startInlineEdit();
  }
}

// 开始内联编辑标题
function startInlineEdit() {
  // 获取当前标题
  const currentTitle = elements.detailTitle.textContent;
  
  // 设置输入框的值
  elements.detailTitleInput.value = currentTitle;
  
  // 隐藏标题，显示输入框
  elements.detailTitle.classList.add('hidden');
  elements.detailTitleInput.classList.remove('hidden');
  
  // 更改按钮样式为绿色对勾
  elements.editTitleIcon.className = 'fas fa-check';
  elements.editTitle.classList.remove('text-gray-500', 'hover:bg-gray-100');
  elements.editTitle.classList.add('text-green-600', 'hover:bg-green-50');
  
  // 聚焦并选中文本
  elements.detailTitleInput.focus();
  elements.detailTitleInput.select();
}

// 保存内联编辑的标题
function saveInlineEdit() {
  const newTitle = elements.detailTitleInput.value.trim();
  
  if (!newTitle) {
    // 如果标题为空，恢复原标题
    cancelInlineEdit();
    return;
  }
  
  // 获取当前对话
  chrome.runtime.sendMessage({
    type: 'getConversationById', 
    conversationId: currentConversationId
  }, (response) => {
    if (response && response.conversation) {
      const conversation = response.conversation;
      
      // 如果标题没有变化，直接取消编辑
      if (conversation.title === newTitle) {
        cancelInlineEdit();
        return;
      }
      
      conversation.title = newTitle;
      
      // 更新到数据库
      chrome.runtime.sendMessage({
        type: 'updateConversation',
        conversation: conversation
      }, (updateResponse) => {
        if (updateResponse && updateResponse.status === 'ok') {
          // 更新UI
          elements.detailTitle.textContent = newTitle;
          cancelInlineEdit();
          // 刷新列表
          loadConversations();
        } else {
          alert(i18n('saveFailed') || '保存失败，请重试');
          cancelInlineEdit();
        }
      });
    } else {
      cancelInlineEdit();
    }
  });
}

// 取消内联编辑
function cancelInlineEdit() {
  // 隐藏输入框，显示标题
  elements.detailTitleInput.classList.add('hidden');
  elements.detailTitle.classList.remove('hidden');
  
  // 恢复按钮样式为编辑图标
  elements.editTitleIcon.className = 'fas fa-edit';
  elements.editTitle.classList.remove('text-green-600', 'hover:bg-green-50');
  elements.editTitle.classList.add('text-gray-500', 'hover:bg-gray-100');
}

// 处理点击外部区域
function handleOutsideClick(e) {
  // 如果不在编辑状态，直接返回
  if (elements.detailTitleInput.classList.contains('hidden')) {
    return;
  }
  
  // 如果点击的是标题区域或编辑按钮，不处理
  if (elements.detailTitleInput.contains(e.target) || 
      elements.editTitle.contains(e.target) ||
      elements.detailTitle.contains(e.target)) {
    return;
  }
  
  // 保存标题
  saveInlineEdit();
}

// 处理内联编辑的键盘事件
function handleInlineEditKeydown(e) {
  if (e.key === 'Enter') {
    e.preventDefault();
    saveInlineEdit();
  } else if (e.key === 'Escape') {
    e.preventDefault();
    cancelInlineEdit();
  }
}

// 显示删除确认对话框
function showDeleteModal(conversationId) {
  currentConversationId = conversationId;
  elements.deleteConfirmModal.classList.remove('hidden');
}

// 隐藏删除确认对话框
function hideDeleteModal() {
  elements.deleteConfirmModal.classList.add('hidden');
}

// 删除当前对话
function deleteCurrentConversation() {
  chrome.runtime.sendMessage({
    type: 'deleteConversation',
    conversationId: currentConversationId
  }, (response) => {
    if (response && response.status === 'ok') {
      // 隐藏对话框
      hideDeleteModal();
      
      // 如果当前在详情页，返回列表
      if (!elements.conversationDetail.classList.contains('hidden')) {
        showMemoriesList();
      }
      
      // 刷新列表
      loadConversations();
      
      // 刷新存储使用情况
      loadStorageUsage();
    } else {
      alert(i18n('deleteFailed') || '删除失败，请重试');
    }
  });
}

// 加载设置
function loadSettings() {
  chrome.runtime.sendMessage({type: 'getSettings'}, (response) => {
    if (response && response.settings) {
      // 更新自动保存开关
      elements.autoSaveToggle.checked = response.settings.autoSave;
      
      // 更新样式
      updateToggleStyle();
    }
  });
}

// 更新自动保存设置
function updateAutoSaveSetting() {
  const autoSave = elements.autoSaveToggle.checked;
  
  // 更新样式
  updateToggleStyle();
  
  // 保存到存储
  chrome.runtime.sendMessage({
    type: 'updateSettings',
    settings: { autoSave }
  }, (response) => {
    if (!response || !response.status === 'ok') {
      alert(i18n('settingsSaveFailed') || '设置保存失败，请重试');
      // 恢复之前的状态
      loadSettings();
    }
  });
}

// 更新开关样式
function updateToggleStyle() {
  // 新的HTML结构不需要手动更新样式，CSS已经处理了
  // 这个函数可以简化或删除，因为新的toggle使用peer选择器自动更新样式
}

// 导出所有记忆（统一导出函数）
function exportAllConversations(exportType = 'separate', buttonElement = null) {
  // 确定要更新状态的按钮元素
  const targetButton = buttonElement || elements.exportBtn;
  
  // 创建按钮管理器
  const buttonManager = new ExportButtonManager(targetButton);
  buttonManager.setLoading();
  
  // 尝试从现有数据获取对话ID，如果没有则重新获取
  if (allConversations && allConversations.length > 0) {
    // 直接使用现有数据
    const conversationIds = allConversations.map(conv => conv.conversationId);
    const metadata = {
      exportMode: 'all',
      totalCount: allConversations.length
    };
    
    // 使用通用导出函数
    performExport(conversationIds, exportType, metadata, buttonManager);
  } else {
    // 重新获取所有对话数据
    chrome.runtime.sendMessage({type: 'getAllConversations'}, (response) => {
      if (response && response.conversations && response.conversations.length > 0) {
        // 获取所有对话的ID列表
        const conversationIds = response.conversations.map(conv => conv.conversationId);
        
        // 准备元数据
        const metadata = {
          exportMode: 'all',
          totalCount: response.conversations.length
        };
        
        // 使用通用导出函数
        performExport(conversationIds, exportType, metadata, buttonManager);
      } else {
        // 没有对话数据
        buttonManager.setError();
      }
    });
  }
}

// 合并导出所有对话为单个文件
function exportMergedConversations() {
  // 使用统一的导出函数，指定为合并模式
  exportAllConversations('merged');
}


// 加载存储使用情况
function loadStorageUsage() {
  chrome.runtime.sendMessage({type: 'getStorageUsage'}, (response) => {
    if (response && response.usage) {
      // 更新总对话数和今日新增
      elements.totalConversations.textContent = response.usage.totalConversations;
      elements.todayConversations.textContent = response.usage.todayNewConversations;
      
      // 计算存储使用量（使用更合理的限制：1GB）
      const maxStorage = 1024 * 1024 * 1024; // 1GB
      const usedBytes = response.usage.totalConversations * 50 * 1024; // 估算每个对话50KB
      const usagePercent = Math.min((usedBytes / maxStorage) * 100, 100);
      
      // 更新存储使用量显示
      elements.storageUsage.textContent = `${formatBytes(usedBytes)} / ${formatBytes(maxStorage)}`;
      elements.storageBar.style.width = `${usagePercent}%`;
      
      // 根据使用量调整颜色
      if (usagePercent > 80) {
        elements.storageBar.className = 'bg-red-600 h-2 rounded-full transition-all';
      } else if (usagePercent > 60) {
        elements.storageBar.className = 'bg-yellow-600 h-2 rounded-full transition-all';
      } else {
        elements.storageBar.className = 'bg-blue-600 h-2 rounded-full transition-all';
      }
    }
  });
}

// 打开原始页面
function openOriginalPage(url) {
  chrome.tabs.create({ url });
}

// 工具函数
// 格式化平台名称为正确的大小写
function formatPlatformName(platform) {
  return PLATFORM_NAMES[platform] || platform;
}

// 兼容性处理器
let compatibility = null;
if (typeof Compatibility !== 'undefined') {
  compatibility = new Compatibility();
}

// 获取兼容的时间字符串
function getCompatibleTime(data) {
  if (compatibility) {
    if (data.messages && Array.isArray(data.messages)) {
      // 如果是对话对象，获取最后消息时间
      return compatibility.getLastMessageTime(data);
    } else {
      // 如果是消息对象，获取消息时间
      return compatibility.getMessageTime(data);
    }
  }
  
  // 降级处理
  return data.lastMessageAt || data.createdAt || data.timestamp || new Date().toISOString();
}

// 格式化时间戳为相对时间
function formatTimestamp(timestamp) {
  // 使用兼容性处理器获取时间
  const compatibleTime = getCompatibleTime({ timestamp });
  const date = new Date(compatibleTime);
  const now = new Date();
  const diffMs = now - date;
  const diffMinutes = Math.floor(diffMs / 60000);
  
  if (diffMinutes < 1) {
    return i18n('justNow');
  } else if (diffMinutes < 60) {
    return I18n.formatTimeAgo(diffMinutes);
  } else if (diffMinutes < 24 * 60) {
    return I18n.formatTimeAgo(diffMinutes);
  } else {
    // 超过一天显示具体日期
    return formatDate(compatibleTime);
  }
}

// 格式化日期
function formatDate(timestamp) {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${padZero(date.getMonth() + 1)}-${padZero(date.getDate())}`;
}

// 格式化时间
function formatTime(timestamp) {
  const date = new Date(timestamp);
  return `${formatDate(timestamp)} ${padZero(date.getHours())}:${padZero(date.getMinutes())}`;
}

// 补零
function padZero(num) {
  return num < 10 ? `0${num}` : num;
}

// 格式化字节为人类可读的形式
function formatBytes(bytes) {
  if (bytes < 1024) {
    return `${bytes} B`;
  } else if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(2)} KB`;
  } else if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  } else {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }
}

// Toast 通知功能
function showToast(message, type = 'info', duration = 3000) {
  const toastContainer = document.getElementById('toast-container');
  if (!toastContainer) return;
  
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  // 根据类型设置图标
  let icon = '';
  switch (type) {
    case 'success':
      icon = '<i class="fas fa-check"></i>';
      break;
    case 'error':
      icon = '<i class="fas fa-times"></i>';
      break;
    case 'warning':
      icon = '<i class="fas fa-exclamation-triangle"></i>';
      break;
    case 'info':
    default:
      icon = '<i class="fas fa-info-circle"></i>';
      break;
  }
  
  toast.innerHTML = `${icon}<span>${message}</span>`;
  
  // 添加到容器
  toastContainer.appendChild(toast);
  
  // 触发显示动画
  setTimeout(() => {
    toast.classList.add('show');
  }, 10);
  
  // 自动移除
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  }, duration);
}

// 清除存储
function clearStorage() {
  // 隐藏确认弹窗
  hideClearConfirmModal();
  
  // 显示加载状态
  const originalText = elements.clearBtn.innerHTML;
  elements.clearBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i>`;
  elements.clearBtn.title = i18n('clearing'); // 使用tooltip显示加载文案
  elements.clearBtn.disabled = true;
  
  chrome.runtime.sendMessage({type: 'clearStorage'}, (response) => {
    if (response && response.status === 'ok') {
      // 只显示成功图标，保持按钮固定宽度（删除操作用红色表示）
      elements.clearBtn.innerHTML = `<i class="fas fa-check text-red-600"></i>`;
      elements.clearBtn.title = i18n('clearSuccess'); // 使用tooltip显示文案
      
      // 显示删除成功toast
      showToast(i18n('clearSuccess'), 'success');
      
      // 刷新列表和存储使用情况
      loadConversations();
      loadStorageUsage();
      
      // 延迟恢复按钮状态
      setTimeout(() => {
        elements.clearBtn.innerHTML = originalText;
        elements.clearBtn.disabled = false;
        elements.clearBtn.title = ''; // 清除tooltip
      }, 2000);
    } else {
      // 只显示失败图标，保持按钮固定宽度
      elements.clearBtn.innerHTML = `<i class="fas fa-times text-red-600"></i>`;
      elements.clearBtn.title = i18n('clearFailed'); // 使用tooltip显示文案
      
      // 延迟恢复按钮状态
      setTimeout(() => {
        elements.clearBtn.innerHTML = originalText;
        elements.clearBtn.disabled = false;
        elements.clearBtn.title = ''; // 清除tooltip
      }, 2000);
    }
  });
}

// 显示清空确认弹窗
function showClearConfirmModal() {
  elements.clearConfirmModal.classList.remove('hidden');
}

// 隐藏清空确认弹窗
function hideClearConfirmModal() {
  elements.clearConfirmModal.classList.add('hidden');
}

// 切换thinking内容显示状态
function toggleThinking(thinkingId) {
  const thinkingContent = document.getElementById(thinkingId);
  const arrow = document.getElementById(`arrow-${thinkingId}`);
  
  if (!thinkingContent || !arrow) {
    return;
  }
  
  if (thinkingContent.style.display === 'none' || !thinkingContent.style.display) {
    thinkingContent.style.display = 'block';
    arrow.className = 'thinking-arrow open';
  } else {
    thinkingContent.style.display = 'none';
    arrow.className = 'thinking-arrow';
  }
}

// 刷新详情页（如果当前在详情页）
function refreshDetailPageIfActive() {
  // 检查是否在详情页
  if (!elements.conversationDetail.classList.contains('hidden') && currentConversationId) {
    // 重新获取对话数据并刷新详情页
    chrome.runtime.sendMessage({
      type: 'getConversationById',
      conversationId: currentConversationId
    }, (response) => {
      if (response && response.conversation) {
        // 更新详情页内容
        const conversation = response.conversation;
        elements.detailTitle.textContent = conversation.title || i18n('noTitle');
        elements.detailPlatform.textContent = formatPlatformName(conversation.platform);
        elements.detailPlatform.className = `platform-tag platform-${conversation.platform} mr-2`;
        elements.detailUpdated.textContent = formatTimestamp(getCompatibleTime(conversation));
        elements.detailMessagesCount.textContent = conversation.messages.length;
        
        // 重新渲染消息列表
        renderConversationMessages(conversation.messages);
      }
    });
  }
}

// 下拉菜单相关函数
function toggleMoreActionsDropdown() {
  const dropdown = elements.moreActionsDropdown;
  if (dropdown.classList.contains('hidden')) {
    showMoreActionsDropdown();
  } else {
    hideMoreActionsDropdown();
  }
}

function showMoreActionsDropdown() {
  elements.moreActionsDropdown.classList.remove('hidden');
}

function hideMoreActionsDropdown() {
  elements.moreActionsDropdown.classList.add('hidden');
}

// 复制当前对话到剪贴板（使用与导出完全相同的格式）
function copyCurrentConversation() {
  if (!currentConversationId) {
    return;
  }
  
  chrome.runtime.sendMessage({
    type: 'getConversationById',
    conversationId: currentConversationId
  }, (response) => {
    if (response && response.conversation) {
      const conversation = response.conversation;
      
      // 使用与导出完全相同的格式
      let output = `# Conversation Title: ${conversation.title || i18n('noTitle')}\n`;
      output += `Original URL: ${conversation.link}\n`;
      output += `Platform: ${formatPlatformName(conversation.platform)}\n`;
      
      // 格式化创建时间为 yyyy-MM-DD hh:mm:ss
      const createdAtFormatted = formatDateTimeForDisplay(new Date(conversation.createdAt));
      output += `Created At: ${createdAtFormatted}\n`;
      output += `Total Messages: ${conversation.messages.length}\n\n`;
      output += '---\n\n';
      
      // 添加每条消息
      conversation.messages.forEach(message => {
        const sender = message.sender === 'user' ? 'User' : 'AI';
        
        // 格式化消息时间为 yyyy-MM-DD hh:mm:ss
        let timestamp = getCompatibleTime(message);
        if (timestamp) {
          try {
            timestamp = formatDateTimeForDisplay(new Date(timestamp));
          } catch (e) {
            // 如果无法解析时间戳，保持原样
          }
        }
        
        output += `${sender}：[${timestamp}]\n`;
        
        // 如果是AI消息且有thinking内容
        if (sender === 'AI' && message.thinking) {
          output += `<${i18n('thinkingProcess')}>\n`;
          output += `${message.thinking}\n`;
          output += `</${i18n('thinkingProcess')}>\n`;
        }
        
        output += `${message.content}\n\n`;
      });
      
      // 复制到剪贴板
      navigator.clipboard.writeText(output).then(() => {
        // 显示复制成功的反馈
        showCopySuccessButton();
      }).catch(err => {
        console.error('复制失败:', err);
        // 降级方案：使用传统的复制方法
        fallbackCopyToClipboard(output);
      });
    }
  });
}

// 格式化日期时间为显示格式（与导出格式一致）
function formatDateTimeForDisplay(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

// 显示复制成功的按钮状态变化
function showCopySuccessButton() {
  const button = elements.copyConversation;
  if (!button) return;
  
  // 保存原始状态
  const originalHTML = button.innerHTML;
  const originalClasses = button.className;
  
  // 更改为成功状态
  button.innerHTML = `<i class="fas fa-check mr-2 text-green-500"></i>${i18n('copySuccess')}`;
  button.classList.add('text-green-600');
  button.disabled = true;
  
  // 2秒后恢复原始状态
  setTimeout(() => {
    button.innerHTML = originalHTML;
    button.className = originalClasses;
    button.disabled = false;
  }, 2000);
}

// 降级复制方案
function fallbackCopyToClipboard(text) {
  const textArea = document.createElement('textarea');
  textArea.value = text;
  textArea.style.position = 'fixed';
  textArea.style.left = '-999999px';
  textArea.style.top = '-999999px';
  
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  
  try {
    document.execCommand('copy');
    return true;
  } catch (err) {
    console.error('降级复制失败:', err);
    return false;
  } finally {
    document.body.removeChild(textArea);
  }
}

// ==================== 搜索功能实现 ====================

/**
 * 处理搜索输入事件
 */
function handleSearchInput(e) {
  const searchTerm = e.target.value.trim();
  currentSearchTerm = searchTerm;
  
  // 更新清除搜索按钮的显示状态
  updateClearSearchButtonState();
  
  // 执行搜索
  performSearch(searchTerm);
}

/**
 * 清空搜索输入
 */
function clearSearchInput() {
  elements.searchInput.value = '';
  currentSearchTerm = '';
  
  // 清空筛选
  clearFilter();
  
  // 恢复显示所有对话
  performSearch('');
}

/**
 * 搜索对话函数
 * @param {Array} conversations - 对话数组
 * @param {string} searchTerm - 搜索词
 * @returns {Array} - 匹配的对话数组
 */
function searchConversations(conversations, searchTerm) {
  if (!searchTerm) return conversations;
  
  // 将搜索词转换为小写，支持大小写不敏感搜索
  const lowerSearchTerm = searchTerm.toLowerCase();
  
  // 支持多关键词搜索（空格分隔）
  const keywords = lowerSearchTerm.split(/\s+/).filter(keyword => keyword.length > 0);
  
  return conversations.filter(conversation => {
    // 搜索标题
    const titleMatch = conversation.title && 
      keywords.every(keyword => conversation.title.toLowerCase().includes(keyword));
    
    // 搜索消息内容
    const contentMatch = conversation.messages && conversation.messages.some(message => {
      return message.content && 
        keywords.every(keyword => message.content.toLowerCase().includes(keyword));
    });
    
    return titleMatch || contentMatch;
  });
}

/**
 * 渲染过滤后的对话列表
 */
function renderFilteredConversations() {
  // 隐藏加载状态
  elements.memoriesLoading.classList.add('hidden');
  
  // 更新结果数量和显示搜索结果信息栏
  updateSearchResultInfo();
  
  if (filteredConversations.length > 0) {
    // 有数据
    elements.memoriesEmpty.classList.add('hidden');
    elements.memoriesList.classList.remove('hidden');
    renderConversationCards(filteredConversations);
  } else {
    // 无数据 - 区分是搜索无结果还是真的没有数据
    elements.memoriesList.classList.add('hidden');
    
    if (currentSearchTerm && allConversations.length > 0) {
      // 搜索无结果
      showSearchEmptyState();
    } else {
      // 真的没有数据
      elements.memoriesEmpty.classList.remove('hidden');
    }
  }
}

/**
 * 显示搜索无结果状态
 */
function showSearchEmptyState() {
  elements.memoriesEmpty.classList.remove('hidden');
  
  // 临时修改空状态的内容为搜索无结果
  const emptyContainer = elements.memoriesEmpty;
  const originalHTML = emptyContainer.innerHTML;
  
  emptyContainer.innerHTML = `
    <div class="text-center">
      <i class="fas fa-search text-4xl text-gray-300 mb-3"></i>
      <p class="text-gray-500 mb-2">${i18n('searchNoResults')}</p>
      <p class="text-sm text-gray-400">${i18n('searchNoResultsHint')}</p>
    </div>
  `;
  
  // 当搜索词清空时恢复原始内容
  const observer = new MutationObserver(() => {
    if (!currentSearchTerm) {
      emptyContainer.innerHTML = originalHTML;
      observer.disconnect();
    }
  });
  
  observer.observe(elements.searchInput, { 
    attributes: true, 
    attributeFilter: ['value'] 
  });
}

/**
 * 高亮搜索关键词（可选功能）
 * @param {string} text - 原始文本
 * @param {string} searchTerm - 搜索词
 * @returns {string} - 高亮后的HTML
 */
function highlightSearchTerm(text, searchTerm) {
  if (!searchTerm || !text) return escapeHtml(text);

  const keywords = searchTerm.toLowerCase().split(/\s+/).filter(keyword => keyword.length > 0);
  let tempText = text;

  // 1. 使用特殊标记包裹关键词
  keywords.forEach(keyword => {
    const regex = new RegExp(`(${escapeRegExp(keyword)})`, 'gi');
    tempText = tempText.replace(regex, '###HIGHLIGHT_START###$1###HIGHLIGHT_END###');
  });

  // 2. 对整个文本进行HTML转义
  let highlightedText = escapeHtml(tempText);

  // 3. 将特殊标记替换为<mark>标签
  highlightedText = highlightedText.replace(/###HIGHLIGHT_START###(.*?)###HIGHLIGHT_END###/g, '<mark class="bg-yellow-200">$1</mark>');

  return highlightedText;
}

/**
 * 为详情页高亮搜索词（先高亮再转HTML）
 * @param {string} text - 要高亮的原始文本
 * @param {string} searchTerm - 搜索词
 * @returns {string} - 高亮并格式化后的HTML
 */
function highlightSearchTermForDetail(text, searchTerm) {
  if (!searchTerm || !text) return formatTextToHtml(text);
  
  const keywords = searchTerm.toLowerCase().split(/\s+/).filter(keyword => keyword.length > 0);
  let highlightedText = text;
  
  // 先对原始文本进行高亮标记（使用特殊标记符）
  keywords.forEach(keyword => {
    const regex = new RegExp(`(${escapeRegExp(keyword)})`, 'gi');
    highlightedText = highlightedText.replace(regex, '###HIGHLIGHT_START###$1###HIGHLIGHT_END###');
  });
  
  // 转换为HTML格式（处理换行符等）
  highlightedText = formatTextToHtml(highlightedText);
  
  // 将特殊标记符替换为实际的高亮标签
  highlightedText = highlightedText.replace(/###HIGHLIGHT_START###(.*?)###HIGHLIGHT_END###/g, '<mark class="bg-yellow-200">$1</mark>');
  
  return highlightedText;
}

/**
 * 转义正则表达式特殊字符
 * @param {string} string - 要转义的字符串
 * @returns {string} - 转义后的字符串
 */
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 查找包含搜索词的消息片段
 * @param {Object} conversation - 对话对象
 * @param {string} searchTerm - 搜索词
 * @returns {string} - 匹配的片段
 */
function findMatchingSnippet(conversation, searchTerm) {
  if (!conversation.messages || !searchTerm) {
    return i18n('noContent');
  }
  
  const keywords = searchTerm.toLowerCase().split(/\s+/).filter(keyword => keyword.length > 0);
  
  // 遍历消息，查找包含所有关键词的消息
  for (const message of conversation.messages) {
    if (message.content) {
      const lowerContent = message.content.toLowerCase();
      const hasAllKeywords = keywords.every(keyword => lowerContent.includes(keyword));
      
      if (hasAllKeywords) {
        // 找到匹配的消息，提取包含关键词的片段
        return extractSnippetAroundKeywords(message.content, keywords);
      }
    }
  }
  
  // 如果没有找到匹配的消息内容，检查标题
  if (conversation.title) {
    const lowerTitle = conversation.title.toLowerCase();
    const hasAllKeywords = keywords.every(keyword => lowerTitle.includes(keyword));
    if (hasAllKeywords) {
      return conversation.title;
    }
  }
  
  return i18n('noContent');
}

/**
 * 提取包含关键词周围的文本片段
 * @param {string} content - 原始内容
 * @param {Array} keywords - 关键词数组
 * @returns {string} - 提取的片段
 */
function extractSnippetAroundKeywords(content, keywords) {
  const maxSnippetLength = 100;
  const contextLength = 20; // 关键词前后的上下文长度
  
  // 找到第一个关键词的位置
  let firstKeywordIndex = -1;
  let matchedKeyword = '';
  
  for (const keyword of keywords) {
    const index = content.toLowerCase().indexOf(keyword);
    if (index !== -1 && (firstKeywordIndex === -1 || index < firstKeywordIndex)) {
      firstKeywordIndex = index;
      matchedKeyword = keyword;
    }
  }
  
  if (firstKeywordIndex === -1) {
    // 如果没有找到关键词，返回开头部分
    return content.substring(0, maxSnippetLength) + (content.length > maxSnippetLength ? '...' : '');
  }
  
  // 计算片段的开始和结束位置
  const start = Math.max(0, firstKeywordIndex - contextLength);
  const end = Math.min(content.length, firstKeywordIndex + matchedKeyword.length + contextLength);
  
  let snippet = content.substring(start, end);
  
  // 如果片段太长，截断并添加省略号
  if (snippet.length > maxSnippetLength) {
    snippet = snippet.substring(0, maxSnippetLength);
  }
  
  // 添加省略号
  const prefix = start > 0 ? '...' : '';
  const suffix = end < content.length || snippet.length === maxSnippetLength ? '...' : '';
  
  return prefix + snippet + suffix;
}

/**
 * 设置版本号显示
 * 从 manifest.json 获取版本号并显示在设置页面
 */
function setVersionNumber() {
  try {
    // 获取扩展的 manifest 信息
    const manifest = chrome.runtime.getManifest();
    const version = manifest.version;
    
    // 查找版本号显示元素并设置
    const versionElement = document.getElementById('version-number');
    if (versionElement) {
      versionElement.textContent = version;
      console.log('版本号已更新为:', version);
    } else {
      console.warn('未找到版本号显示元素');
    }
  } catch (error) {
    console.error('获取版本号失败:', error);
  }
}

// 将函数添加到全局作用域，以便HTML中的onclick可以调用
window.toggleThinking = toggleThinking;

// ==================== 筛选功能实现 ====================

// 筛选状态变量
let currentFilter = {
  startDate: '',
  endDate: '',
  platforms: [],
  quickDateType: '' // 'week', 'month', 或 ''
};

// 临时筛选状态（用于菜单操作）
let tempFilter = {
  startDate: '',
  endDate: '',
  platforms: [],
  quickDateType: ''
};

/**
 * 动态生成平台筛选选项
 */
function generatePlatformFilterOptions() {
  const platformDropdownMenu = elements.platformDropdownMenu;
  if (!platformDropdownMenu) return;

  // 清空现有选项
  platformDropdownMenu.innerHTML = '';

  // 基于 PLATFORM_NAMES 常量动态生成选项
  Object.keys(PLATFORM_NAMES).forEach(platformKey => {
    const platformName = PLATFORM_NAMES[platformKey];
    const optionElement = document.createElement('div');
    optionElement.className = 'platform-option px-3 py-2 hover:bg-blue-50 cursor-pointer transition-colors duration-150';
    optionElement.setAttribute('data-platform', platformKey);
    optionElement.innerHTML = `<span class="text-xs">${platformName}</span>`;
    
    // 添加点击事件
    optionElement.addEventListener('click', () => {
      togglePlatformSelection(platformKey);
    });
    
    platformDropdownMenu.appendChild(optionElement);
  });
}

/**
 * 动态生成设置页面中的支持平台列表
 */
function generateSupportedPlatformsList() {
  // 查找支持平台容器
  const supportedPlatformsContainer = document.querySelector('[data-i18n="supportedPlatforms"]')?.closest('.bg-white')?.querySelector('.space-y-2');
  if (!supportedPlatformsContainer) return;

  // 清空现有内容
  supportedPlatformsContainer.innerHTML = '';

  // 基于 PLATFORM_NAMES 常量动态生成平台列表
  Object.keys(PLATFORM_NAMES).forEach(platformKey => {
    const platformName = PLATFORM_NAMES[platformKey];
    const platformElement = document.createElement('div');
    platformElement.className = 'flex items-center justify-between p-2 bg-gray-50 rounded';
    platformElement.innerHTML = `
      <div class="flex items-center">
        <div class="platform-tag platform-${platformKey} mr-2">${platformName}</div>
      </div>
      <i class="fas fa-check text-green-500"></i>
    `;
    supportedPlatformsContainer.appendChild(platformElement);
  });
}

/**
 * 初始化筛选功能
 */
function initializeFilter() {
  const { HIDDEN, OPACITY_0, SCALE_95 } = FILTER_MENU_CONFIG.CSS_CLASSES;
  
  // 确保筛选下拉菜单初始状态正确
  elements.filterDropdown.classList.add(HIDDEN, OPACITY_0, SCALE_95);
  elements.platformDropdownMenu.classList.add(HIDDEN, OPACITY_0, SCALE_95);
  
  // 应用初始CSS样式
  applyInitialMenuStyles();
  
  // 动态生成平台选项
  generatePlatformFilterOptions();
  
  // 初始化平台标签显示
  updatePlatformTags();
  updatePlatformOptions();
  
  // 初始化筛选按钮状态
  updateFilterButtonState();
  
  // 初始化快捷日期按钮状态
  updateQuickDateButtons();
  
  // 添加窗口大小变化监听器，以调整筛选菜单位置
  window.addEventListener('resize', adjustFilterDropdownPosition);
}

/**
 * 应用初始菜单样式
 */
function applyInitialMenuStyles() {
  // 在HTML中添加必要的样式覆盖
  const styleEl = document.createElement('style');
  styleEl.id = 'filter-menu-styles';
  styleEl.textContent = `
    #filter-dropdown {
      max-width: ${FILTER_MENU_CONFIG.MAX_WIDTH}px !important;
      min-width: ${FILTER_MENU_CONFIG.MIN_WIDTH}px !important;
    }
  `;
  
  // 移除可能存在的旧样式
  const existingStyle = document.getElementById('filter-menu-styles');
  if (existingStyle) {
    existingStyle.remove();
  }
  
  // 添加到文档头部
  document.head.appendChild(styleEl);
}

/**
 * 筛选菜单配置常量
 */
const FILTER_MENU_CONFIG = {
  // 宽度约束
  MAX_WIDTH: 300,      // 最大宽度 260px
  MIN_WIDTH: 240,      // 最小宽度 100px
  MIN_LEFT_MARGIN: 8,  // 左侧最小边距
  // 动画相关
  ANIMATION_DURATION: 200, // 动画持续时间（毫秒）
  // CSS类名
  CSS_CLASSES: {
    HIDDEN: 'hidden',
    OPACITY_0: 'opacity-0',
    OPACITY_100: 'opacity-100',
    SCALE_95: 'scale-95',
    SCALE_100: 'scale-100'
  }
};

/**
 * 调整筛选下拉菜单的位置和宽度
 * 确保在窄侧边栏中不会超出左侧边界，同时保持与筛选图标右对齐
 */
function adjustFilterDropdownPosition() {
  // 如果菜单隐藏，则不需要调整
  if (elements.filterDropdown.classList.contains(FILTER_MENU_CONFIG.CSS_CLASSES.HIDDEN)) return;
  
  // 获取筛选按钮的位置信息
  const filterButton = document.querySelector('#filter-btn');
  if (!filterButton) return;
  
  // 获取按钮右边缘位置
  const buttonRightEdge = filterButton.getBoundingClientRect().right;
  
  // 计算可用的最大宽度（考虑左边距）
  const maxAvailableWidth = buttonRightEdge - FILTER_MENU_CONFIG.MIN_LEFT_MARGIN;
  
  // 确定最终宽度：在约束范围内选择合适的宽度
  let finalWidth;
  
  if (maxAvailableWidth >= FILTER_MENU_CONFIG.MAX_WIDTH) {
    // 空间充足，使用最大宽度
    finalWidth = FILTER_MENU_CONFIG.MAX_WIDTH;
  } else if (maxAvailableWidth >= FILTER_MENU_CONFIG.MIN_WIDTH) {
    // 空间有限但足够最小宽度，使用可用宽度
    finalWidth = maxAvailableWidth;
  } else {
    // 空间不足，强制使用最小宽度
    finalWidth = FILTER_MENU_CONFIG.MIN_WIDTH;
  }
  
  // 应用样式 - 使用!important确保优先级
  applyMenuStyles(elements.filterDropdown, finalWidth);
}

/**
 * 应用菜单样式
 * @param {HTMLElement} menuElement - 菜单元素
 * @param {number} width - 要设置的宽度
 */
function applyMenuStyles(menuElement, width) {
  // 使用cssText一次性设置多个样式，提高性能并确保样式优先级
  menuElement.style.cssText = `
    width: ${width}px !important;
    max-width: ${FILTER_MENU_CONFIG.MAX_WIDTH}px !important;
  `;
}

/**
 * 切换筛选下拉菜单显示状态
 */
function toggleFilterDropdown() {
  const isVisible = !elements.filterDropdown.classList.contains('hidden');
  
  if (isVisible) {
    hideFilterDropdown();
  } else {
    showFilterDropdown();
    // 位置调整已在showFilterDropdown中处理
  }
}

/**
 * 显示筛选下拉菜单
 */
function showFilterDropdown() {
  // 保存当前状态到临时状态
  tempFilter = {
    startDate: currentFilter.startDate,
    endDate: currentFilter.endDate,
    platforms: [...currentFilter.platforms],
    quickDateType: currentFilter.quickDateType
  };
  
  // 关闭其他下拉菜单
  hidePlatformDropdown();
  
  // 显示下拉菜单
  elements.filterDropdown.classList.remove(FILTER_MENU_CONFIG.CSS_CLASSES.HIDDEN);
  
  // 先调整位置，再触发动画
  adjustFilterDropdownPosition();
  
  // 触发动画
  requestAnimationFrame(() => {
    const { OPACITY_0, SCALE_95, OPACITY_100, SCALE_100 } = FILTER_MENU_CONFIG.CSS_CLASSES;
    elements.filterDropdown.classList.remove(OPACITY_0, SCALE_95);
    elements.filterDropdown.classList.add(OPACITY_100, SCALE_100);
  });
}

/**
 * 隐藏筛选下拉菜单
 */
function hideFilterDropdown() {
  const { OPACITY_100, SCALE_100, OPACITY_0, SCALE_95, HIDDEN } = FILTER_MENU_CONFIG.CSS_CLASSES;
  
  elements.filterDropdown.classList.remove(OPACITY_100, SCALE_100);
  elements.filterDropdown.classList.add(OPACITY_0, SCALE_95);
  
  // 延迟隐藏以完成动画
  setTimeout(() => {
    elements.filterDropdown.classList.add(HIDDEN);
    // 重置内联样式，避免样式累积
    elements.filterDropdown.style.cssText = '';
    
    // 恢复到临时状态（撤销未确认的更改）
    restoreFromTempFilter();
  }, FILTER_MENU_CONFIG.ANIMATION_DURATION);
}

/**
 * 隐藏筛选下拉菜单（不恢复状态）
 */
function hideFilterDropdownWithoutRestore() {
  const { OPACITY_100, SCALE_100, OPACITY_0, SCALE_95, HIDDEN } = FILTER_MENU_CONFIG.CSS_CLASSES;
  
  elements.filterDropdown.classList.remove(OPACITY_100, SCALE_100);
  elements.filterDropdown.classList.add(OPACITY_0, SCALE_95);
  
  // 延迟隐藏以完成动画
  setTimeout(() => {
    elements.filterDropdown.classList.add(HIDDEN);
    // 重置内联样式，避免样式累积
    elements.filterDropdown.style.cssText = '';
  }, FILTER_MENU_CONFIG.ANIMATION_DURATION);
}

/**
 * 恢复到临时状态（撤销未确认的更改）
 */
function restoreFromTempFilter() {
  // 恢复筛选状态
  currentFilter = {
    startDate: tempFilter.startDate,
    endDate: tempFilter.endDate,
    platforms: [...tempFilter.platforms],
    quickDateType: tempFilter.quickDateType
  };
  
  // 恢复UI状态
  elements.startDate.value = currentFilter.startDate;
  elements.endDate.value = currentFilter.endDate;
  
  // 更新平台标签和选项显示
  updatePlatformTags();
  updatePlatformOptions();
  
  // 更新筛选按钮状态
  updateFilterButtonState();
  
  // 更新快捷日期按钮状态
  updateQuickDateButtons();
}

/**
 * 切换平台下拉菜单显示状态
 */
function togglePlatformDropdown() {
  const isHidden = elements.platformDropdownMenu.classList.contains('hidden');
  if (isHidden) {
    showPlatformDropdown();
  } else {
    hidePlatformDropdown();
  }
}

/**
 * 显示平台下拉菜单
 */
function showPlatformDropdown() {
  // 隐藏所有日期选择器
  hideDatePicker('start');
  hideDatePicker('end');
  
  elements.platformDropdownMenu.classList.remove('hidden');
  
  // 为平台标签容器添加激活样式（模拟focus状态）
  const platformContainer = elements.platformTagsContainer;
  if (platformContainer) {
    platformContainer.style.outline = 'none';
    platformContainer.style.boxShadow = '0 0 0 2px rgb(59 130 246 / 0.5)';
    platformContainer.style.borderColor = 'transparent';
  }
  
  // 触发动画
  requestAnimationFrame(() => {
    elements.platformDropdownMenu.classList.remove('opacity-0', 'scale-95');
    elements.platformDropdownMenu.classList.add('opacity-100', 'scale-100');
  });
}

/**
 * 隐藏平台下拉菜单
 */
function hidePlatformDropdown() {
  elements.platformDropdownMenu.classList.remove('opacity-100', 'scale-100');
  elements.platformDropdownMenu.classList.add('opacity-0', 'scale-95');
  
  // 移除平台标签容器的激活样式
  const platformContainer = elements.platformTagsContainer;
  if (platformContainer) {
    platformContainer.style.outline = '';
    platformContainer.style.boxShadow = '';
    platformContainer.style.borderColor = '';
  }
  
  // 延迟隐藏以完成动画
  setTimeout(() => {
    elements.platformDropdownMenu.classList.add('hidden');
  }, 200);
}

/**
 * 应用筛选
 */
function applyFilter() {
  // 获取日期筛选
  currentFilter.startDate = elements.startDate.value;
  currentFilter.endDate = elements.endDate.value;
  
  // 平台筛选已经通过togglePlatformSelection更新到currentFilter.platforms中
  
  // 更新临时状态为当前确认的状态
  tempFilter = {
    startDate: currentFilter.startDate,
    endDate: currentFilter.endDate,
    platforms: [...currentFilter.platforms],
    quickDateType: currentFilter.quickDateType
  };
  
  // 更新筛选按钮状态
  updateFilterButtonState();
  
  // 更新清除搜索按钮的显示状态
  updateClearSearchButtonState();
  
  // 隐藏筛选下拉菜单（不会触发恢复，因为临时状态已更新）
  hideFilterDropdownWithoutRestore();
  
  // 重新执行搜索和筛选
  performSearchAndFilter();
}

/**
 * 清空筛选
 */
function clearFilter() {
  // 重置筛选状态
  currentFilter = {
    startDate: '',
    endDate: '',
    platforms: [],
    quickDateType: ''
  };
  
  // 更新临时状态为清空后的状态
  tempFilter = {
    startDate: '',
    endDate: '',
    platforms: [],
    quickDateType: ''
  };
  
  // 清空UI
  elements.startDate.value = '';
  elements.endDate.value = '';
  
  // 更新日期清除按钮显示状态
  updateDateClearButtons();
  
  // 更新平台标签显示
  updatePlatformTags();
  updatePlatformOptions();
  
  // 更新筛选按钮状态
  updateFilterButtonState();
  
  // 更新清除搜索按钮的显示状态
  updateClearSearchButtonState();
  
  // 更新快捷日期按钮状态
  updateQuickDateButtons();
  
  // 隐藏筛选下拉菜单（不恢复状态）
  hideFilterDropdownWithoutRestore();
  
  // 重新执行搜索和筛选
  performSearchAndFilter();
}

/**
 * 一键清除所有筛选和搜索（用于筛选角标）
 */
function clearAllFilters() {
  // 清除搜索词
  currentSearchTerm = '';
  elements.searchInput.value = '';
  
  // 清除筛选条件
  currentFilter = {
    startDate: '',
    endDate: '',
    platforms: [],
    quickDateType: ''
  };
  
  // 更新临时状态
  tempFilter = {
    startDate: '',
    endDate: '',
    platforms: [],
    quickDateType: ''
  };
  
  // 清空UI
  elements.startDate.value = '';
  elements.endDate.value = '';
  
  // 更新日期清除按钮显示状态
  updateDateClearButtons();
  
  // 更新平台标签显示
  updatePlatformTags();
  updatePlatformOptions();
  
  // 更新筛选按钮状态
  updateFilterButtonState();
  
  // 更新清除搜索按钮的显示状态
  updateClearSearchButtonState();
  
  // 更新快捷日期按钮状态
  updateQuickDateButtons();
  
  // 隐藏筛选下拉菜单
  hideFilterDropdownWithoutRestore();
  
  // 重新执行搜索和筛选
  performSearchAndFilter();
}

/**
 * 更新筛选按钮状态
 */
function updateFilterButtonState() {
  const hasFilter = currentFilter.startDate || currentFilter.endDate || currentFilter.platforms.length > 0;
  
  if (hasFilter) {
    elements.filterIcon.classList.remove('text-gray-400');
    elements.filterIcon.classList.add('text-blue-600');
  } else {
    elements.filterIcon.classList.remove('text-blue-600');
    elements.filterIcon.classList.add('text-gray-400');
  }
}

/**
 * 更新清除搜索按钮的显示状态
 */
function updateClearSearchButtonState() {
  const hasSearch = currentSearchTerm && currentSearchTerm.trim() !== '';
  const hasFilter = currentFilter.startDate || currentFilter.endDate || currentFilter.platforms.length > 0;
  const shouldShow = hasSearch || hasFilter;
  
  if (shouldShow) {
    elements.clearSearch.classList.remove('hidden');
  } else {
    elements.clearSearch.classList.add('hidden');
  }
}

/**
 * 更新快捷日期按钮状态
 */
function updateQuickDateButtons() {
  // 重置所有按钮状态
  elements.dateWeek.classList.remove('bg-blue-50', 'text-blue-600');
  elements.dateWeek.classList.add('bg-gray-100', 'text-gray-700');
  elements.dateMonth.classList.remove('bg-blue-50', 'text-blue-600');
  elements.dateMonth.classList.add('bg-gray-100', 'text-gray-700');
  
  // 设置激活状态
  if (currentFilter.quickDateType === 'week') {
    elements.dateWeek.classList.remove('bg-gray-100', 'text-gray-700');
    elements.dateWeek.classList.add('bg-blue-50', 'text-blue-600');
  } else if (currentFilter.quickDateType === 'month') {
    elements.dateMonth.classList.remove('bg-gray-100', 'text-gray-700');
    elements.dateMonth.classList.add('bg-blue-50', 'text-blue-600');
  }
}

/**
 * 执行搜索和筛选
 */
function performSearchAndFilter() {
  let conversations = [...allConversations];
  
  // 应用筛选
  conversations = applyFilterToConversations(conversations);
  
  // 应用搜索
  if (currentSearchTerm) {
    conversations = searchConversations(conversations, currentSearchTerm);
  }
  
  // 更新过滤后的对话列表
  filteredConversations = conversations;
  
  // 渲染结果
  renderFilteredConversations();
}

/**
 * 对对话列表应用筛选条件
 * @param {Array} conversations - 对话数组
 * @returns {Array} - 筛选后的对话数组
 */
function applyFilterToConversations(conversations) {
  return conversations.filter(conversation => {
    // 日期筛选
    if (currentFilter.startDate || currentFilter.endDate) {
      // 使用正确的日期字段，优先级：updatedAt > createdAt > 最后一条消息时间
      let conversationDate;
      
      if (conversation.updatedAt) {
        conversationDate = new Date(conversation.updatedAt);
      } else if (conversation.createdAt) {
        conversationDate = new Date(conversation.createdAt);
      } else if (conversation.messages && conversation.messages.length > 0) {
        // 如果没有创建/更新时间，使用最后一条消息的时间
        const lastMessage = conversation.messages[conversation.messages.length - 1];
        conversationDate = new Date(lastMessage.timestamp);
      } else {
        // 如果所有字段都没有，尝试使用旧字段名
        conversationDate = new Date(conversation.updated || conversation.created || Date.now());
      }
      
      // 输出调试日志，查看对话日期和筛选日期
      console.log('Conversation date:', conversationDate, 
                'Fields:', {
                  updatedAt: conversation.updatedAt,
                  createdAt: conversation.createdAt,
                  updated: conversation.updated,
                  created: conversation.created
                });
      
      if (currentFilter.startDate) {
        const startDate = new Date(currentFilter.startDate);
        console.log('Start date filter:', startDate);
        if (conversationDate < startDate) {
          return false;
        }
      }
      
      if (currentFilter.endDate) {
        const endDate = new Date(currentFilter.endDate);
        // 设置结束日期为当天的23:59:59
        endDate.setHours(23, 59, 59, 999);
        console.log('End date filter:', endDate);
        if (conversationDate > endDate) {
          return false;
        }
      }
    }
    
    // 平台筛选
    if (currentFilter.platforms.length > 0) {
      const conversationPlatform = conversation.platform || getPlatformFromUrl(conversation.url);
      
      // 平台筛选逐步调试已完成
      
      if (!currentFilter.platforms.includes(conversationPlatform)) {
        return false;
      }
    }
    
    return true;
  });
}

/**
 * 从URL获取平台标识
 * @param {string} url - 对话URL
 * @returns {string} - 平台标识
 */
function getPlatformFromUrl(url) {
  if (!url) return 'unknown';
  
  if (url.includes('chatgpt.com') || url.includes('chat.openai.com')) {
    return 'chatgpt';
  } else if (url.includes('chat.deepseek.com')) {
    return 'deepseek';
  } else if (url.includes('gemini.google.com')) {
    return 'gemini';
  } else if (url.includes('yuanbao.tencent.com')) {
    return 'yuanbao';
  } else if (url.includes('doubao.com')) {
    return 'doubao';
  } else if (url.includes('claude.ai')) {
    return 'claude';
  }
  
  return 'unknown';
}

/**
 * 修改原有的performSearch函数以支持筛选
 */
function performSearch(searchTerm) {
  currentSearchTerm = searchTerm;
  performSearchAndFilter();
}

/**
 * 设置快捷日期范围
 * @param {number} days - 天数
 */
function setQuickDateRange(days) {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - days);
  
  // 使用自定义日期选择器的设置方法
  setDateValue('start', startDate);
  setDateValue('end', endDate);
  
  // 设置快捷日期类型（只在菜单中临时设置，不影响实际筛选）
  currentFilter.quickDateType = days === 7 ? 'week' : 'month';
  
  // 更新快捷日期按钮状态
  updateQuickDateButtons();
  
  // 更新筛选按钮状态（显示有变化但不立即应用）
  updateFilterButtonState();
  
  // 更新清除搜索按钮的显示状态
  updateClearSearchButtonState();
  
  // 更新清除搜索按钮的显示状态
  updateClearSearchButtonState();
}

/**
 * 设置自定义日期选择器事件处理
 */
function setupDateInputHandlers() {
  // 初始化日期选择器
  initDatePicker('start');
  initDatePicker('end');
  
  // 点击输入框显示日期选择器
  if (elements.startDate) {
    elements.startDate.addEventListener('click', () => showDatePicker('start'));
  }
  
  if (elements.endDate) {
    elements.endDate.addEventListener('click', () => showDatePicker('end'));
  }
  
  // 清除按钮事件处理
  if (elements.startDateClear) {
    elements.startDateClear.addEventListener('click', (e) => {
      e.stopPropagation();
      clearSingleDate('start');
    });
  }
  
  if (elements.endDateClear) {
    elements.endDateClear.addEventListener('click', (e) => {
      e.stopPropagation();
      clearSingleDate('end');
    });
  }
  
  // 为日期选择器添加内部点击事件阻止冒泡
  const startDatePicker = document.getElementById('start-date-picker');
  const endDatePicker = document.getElementById('end-date-picker');
  
  if (startDatePicker) {
    startDatePicker.addEventListener('click', (e) => {
      e.stopPropagation();
    });
  }
  
  if (endDatePicker) {
    endDatePicker.addEventListener('click', (e) => {
      e.stopPropagation();
    });
  }
  
  // 初始化清除按钮显示状态
  updateDateClearButtons();
}

/**
 * 更新年月显示
 * @param {string} type - 日期选择器类型
 * @param {number} year - 年份
 * @param {number} month - 月份
 */
function updateDateDisplay(type, year, month) {
  const datePicker = document.getElementById(`${type}-date-picker`);
  if (!datePicker) return;
  
  const yearDisplay = datePicker.querySelector('.year-display');
  const monthDisplay = datePicker.querySelector('.month-display');
  const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
  
  if (yearDisplay) yearDisplay.textContent = year + '年';
  if (monthDisplay) monthDisplay.textContent = monthNames[month];
}

/**
 * 初始化日期选择器
 * @param {string} type - 日期选择器类型（start/end）
 */
function initDatePicker(type) {
  const datePicker = document.getElementById(`${type}-date-picker`);
  const input = document.getElementById(`${type}-date`);
  
  if (!datePicker) return;
  
  const currentDate = new Date();
  let displayYear = currentDate.getFullYear();
  let displayMonth = currentDate.getMonth();
  
  // 初始化年月显示
  updateDateDisplay(type, displayYear, displayMonth);
  
  // 导航按钮
  datePicker.querySelectorAll('.date-nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.getAttribute('data-action');
      if (action === 'prev-month') {
        displayMonth--;
        if (displayMonth < 0) {
          displayMonth = 11;
          displayYear--;
        }
      } else if (action === 'next-month') {
        displayMonth++;
        if (displayMonth > 11) {
          displayMonth = 0;
          displayYear++;
        }
      } else if (action === 'prev-year') {
        displayYear--;
      } else if (action === 'next-year') {
        displayYear++;
      }
      updateDateDisplay(type, displayYear, displayMonth);
      renderCalendar(type, displayYear, displayMonth);
    });
  });
  
  // 底部按钮
  datePicker.querySelector('.date-today-btn').addEventListener('click', () => {
    const today = new Date();
    setDateValue(type, today);
    hideDatePicker(type);
  });
  
  // 初始渲染
  renderCalendar(type, displayYear, displayMonth);
}

/**
 * 渲染日历
 * @param {string} type - 日期选择器类型
 * @param {number} year - 年份
 * @param {number} month - 月份
 */
function renderCalendar(type, year, month) {
  const datePicker = document.getElementById(`${type}-date-picker`);
  const dateGrid = datePicker.querySelector('.date-grid');
  
  dateGrid.innerHTML = '';
  
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDate = new Date(firstDay);
  startDate.setDate(startDate.getDate() - firstDay.getDay());
  
  const today = new Date();
  const currentValue = getCurrentDateValue(type);
  
  for (let i = 0; i < 42; i++) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + i);
    
    const dayBtn = document.createElement('button');
    dayBtn.type = 'button';
    dayBtn.textContent = date.getDate();
    dayBtn.className = 'w-8 h-8 text-xs rounded hover:bg-blue-50 transition-colors';
    
    // 样式判断
    if (date.getMonth() !== month) {
      dayBtn.className += ' text-gray-300';
    } else if (date.toDateString() === today.toDateString()) {
      dayBtn.className += ' bg-blue-100 text-blue-600 font-medium';
    } else if (currentValue && date.toDateString() === currentValue.toDateString()) {
      dayBtn.className += ' bg-blue-600 text-white font-medium';
    } else {
      dayBtn.className += ' text-gray-700 hover:bg-blue-50';
    }
    
    // 点击事件
    dayBtn.addEventListener('click', () => {
      setDateValue(type, date);
      hideDatePicker(type);
    });
    
    dateGrid.appendChild(dayBtn);
  }
}

/**
 * 显示日期选择器
 * @param {string} type - 日期选择器类型
 */
function showDatePicker(type) {
  // 隐藏其他日期选择器
  const otherType = type === 'start' ? 'end' : 'start';
  hideDatePicker(otherType);
  
  // 隐藏平台下拉菜单
  hidePlatformDropdown();
  
  const datePicker = document.getElementById(`${type}-date-picker`);
  if (!datePicker) return;
  
  // 为日期输入框添加激活样式（模拟focus状态）
  const dateInput = document.getElementById(`${type}-date`);
  if (dateInput) {
    dateInput.style.outline = 'none';
    dateInput.style.boxShadow = '0 0 0 2px rgb(59 130 246 / 0.5)';
    dateInput.style.borderColor = 'transparent';
  }
  
  datePicker.classList.remove('hidden');
  
  // 更新日历显示
  const currentValue = getCurrentDateValue(type);
  if (currentValue) {
    const year = currentValue.getFullYear();
    const month = currentValue.getMonth();
    updateDateDisplay(type, year, month);
    renderCalendar(type, year, month);
  }
}

/**
 * 隐藏日期选择器
 * @param {string} type - 日期选择器类型
 */
function hideDatePicker(type) {
  const datePicker = document.getElementById(`${type}-date-picker`);
  if (datePicker) {
    datePicker.classList.add('hidden');
  }
  
  // 移除日期输入框的激活样式
  const dateInput = document.getElementById(`${type}-date`);
  if (dateInput) {
    dateInput.style.outline = '';
    dateInput.style.boxShadow = '';
    dateInput.style.borderColor = '';
  }
}

/**
 * 设置日期值
 * @param {string} type - 日期选择器类型
 * @param {Date|null} date - 日期对象
 */
function setDateValue(type, date) {
  const input = document.getElementById(`${type}-date`);
  if (date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    input.value = `${year}/${month}/${day}`;
  } else {
    input.value = '';
  }
  
  // 更新清除按钮显示状态
  updateDateClearButtons();
  
  // 更新筛选条件
  updateFilterConditions();
}

/**
 * 获取当前日期值
 * @param {string} type - 日期选择器类型
 * @returns {Date|null} 日期对象
 */
function getCurrentDateValue(type) {
  const input = document.getElementById(`${type}-date`);
  if (!input.value) return null;
  
  const parts = input.value.split('/');
  if (parts.length !== 3) return null;
  
  const year = parseInt(parts[0]);
  const month = parseInt(parts[1]) - 1;
  const day = parseInt(parts[2]);
  
  return new Date(year, month, day);
}

/**
 * 从输入框更新筛选条件（不立即应用筛选）
 */
function updateFilterConditions() {
  // 转换日期格式为 YYYY-MM-DD
  const startValue = elements.startDate.value;
  const endValue = elements.endDate.value;
  
  currentFilter.startDate = startValue ? convertDateFormat(startValue) : '';
  currentFilter.endDate = endValue ? convertDateFormat(endValue) : '';
  
  // 更新筛选按钮状态
  updateFilterButtonState();
}

/**
 * 转换日期格式从 yyyy/mm/dd 到 yyyy-mm-dd
 * @param {string} dateStr - 日期字符串
 * @returns {string} 转换后的日期字符串
 */
function convertDateFormat(dateStr) {
  if (!dateStr) return '';
  return dateStr.replace(/\//g, '-');
}

// 删除了不再需要的验证函数，让浏览器处理日期验证

/**
 * 清空日期范围
 */
function clearDateRange() {
  // 使用自定义日期选择器的设置方法
  setDateValue('start', null);
  setDateValue('end', null);
  
  // 清空快捷日期类型
  currentFilter.quickDateType = '';
  
  // 更新快捷日期按钮状态
  updateQuickDateButtons();
  
  // 更新筛选按钮状态（显示有变化但不立即应用）
  updateFilterButtonState();
  
  // 更新清除搜索按钮的显示状态
  updateClearSearchButtonState();
  
  // 更新清除搜索按钮的显示状态
  updateClearSearchButtonState();
}

/**
 * 清空单个日期输入框
 * @param {string} type - 日期选择器类型（start/end）
 */
function clearSingleDate(type) {
  // 使用自定义日期选择器的设置方法
  setDateValue(type, null);
  
  // 如果两个日期都被清空，则清空快捷日期类型
  const startValue = elements.startDate.value;
  const endValue = elements.endDate.value;
  if (!startValue && !endValue) {
    currentFilter.quickDateType = '';
    updateQuickDateButtons();
  }
  
  // 更新筛选按钮状态（显示有变化但不立即应用）
  updateFilterButtonState();
  
  // 更新清除搜索按钮的显示状态
  updateClearSearchButtonState();
}

/**
 * 更新日期清除按钮的显示状态
 */
function updateDateClearButtons() {
  // 更新开始日期清除按钮
  if (elements.startDateClear) {
    if (elements.startDate.value) {
      elements.startDateClear.classList.remove('hidden');
    } else {
      elements.startDateClear.classList.add('hidden');
    }
  }
  
  // 更新结束日期清除按钮
  if (elements.endDateClear) {
    if (elements.endDate.value) {
      elements.endDateClear.classList.remove('hidden');
    } else {
      elements.endDateClear.classList.add('hidden');
    }
  }
}

/**
 * 更新平台选择显示
 */
function updatePlatformSelection() {
  const checkboxes = elements.platformDropdownMenu.querySelectorAll('input[type="checkbox"]');
  const selectedPlatforms = [];
  
  checkboxes.forEach(checkbox => {
    if (checkbox.checked) {
      selectedPlatforms.push({
        value: checkbox.value,
        text: checkbox.nextElementSibling.textContent
      });
    }
  });
  
  // 更新显示文本
  if (selectedPlatforms.length === 0) {
    elements.platformSelectedText.textContent = '选择平台';
  } else if (selectedPlatforms.length === 1) {
    elements.platformSelectedText.textContent = selectedPlatforms[0].text;
  } else {
    elements.platformSelectedText.textContent = `已选择 ${selectedPlatforms.length} 个平台`;
  }
}

/**
 * 切换平台选择状态
 */
function togglePlatformSelection(platform) {
  const index = currentFilter.platforms.indexOf(platform);
  
  if (index === -1) {
    // 添加平台
    currentFilter.platforms.push(platform);
  } else {
    // 移除平台
    currentFilter.platforms.splice(index, 1);
  }
  
  updatePlatformTags();
  updatePlatformOptions();
  
  // 更新筛选按钮状态（不立即触发筛选）
  updateFilterButtonState();
  
  // 更新清除搜索按钮的显示状态
  updateClearSearchButtonState();
}

/**
 * 移除平台选择
 */
window.removePlatformSelection = function(platform) {
  const index = currentFilter.platforms.indexOf(platform);
  if (index !== -1) {
    currentFilter.platforms.splice(index, 1);
    updatePlatformTags();
    updatePlatformOptions();
    
    // 更新筛选按钮状态（不立即触发筛选）
    updateFilterButtonState();
    
    // 更新清除搜索按钮的显示状态
    updateClearSearchButtonState();
  }
}

/**
 * 更新平台标签显示
 */
function updatePlatformTags() {
  
  // 清空标签容器
  elements.platformTags.innerHTML = '';
  
  if (currentFilter.platforms.length === 0) {
    // 显示占位符
    elements.platformPlaceholder.style.display = 'inline';
    elements.platformPlaceholder.textContent = i18n('selectPlatforms');
    elements.platformTags.appendChild(elements.platformPlaceholder);
    
    // 应用空状态样式（保持原有高度）
    elements.platformTagsContainer.classList.remove('platform-tags-container-with-tags');
    elements.platformTagsContainer.classList.add('platform-tags-container-empty');
  } else {
    // 隐藏占位符
    elements.platformPlaceholder.style.display = 'none';
    
    // 应用有标签状态样式（减少内边距）
    elements.platformTagsContainer.classList.remove('platform-tags-container-empty');
    elements.platformTagsContainer.classList.add('platform-tags-container-with-tags');
    
    // 添加平台标签
    currentFilter.platforms.forEach(platform => {
      const tag = document.createElement('span');
      tag.className = 'platform-tag inline-flex items-center';
      
      const textSpan = document.createElement('span');
              textSpan.textContent = PLATFORM_NAMES[platform];
      
      const removeBtn = document.createElement('button');
      removeBtn.className = 'ml-1 text-teal-600 hover:text-teal-800 focus:outline-none opacity-70 hover:opacity-100 transition-opacity';
      removeBtn.title = i18n('remove');
      removeBtn.innerHTML = '<i class="fas fa-times" style="font-size: 0.6rem;"></i>';
      
      // 添加点击事件监听器
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        removePlatformSelection(platform);
      });
      
      tag.appendChild(textSpan);
      tag.appendChild(removeBtn);
      elements.platformTags.appendChild(tag);
    });
  }
}

/**
 * 更新平台选项显示状态
 */
function updatePlatformOptions() {
  
  const options = elements.platformDropdownMenu.querySelectorAll('.platform-option');
  options.forEach(option => {
    const platform = option.getAttribute('data-platform');
    const platformName = PLATFORM_NAMES[platform];
    
    if (currentFilter.platforms.includes(platform)) {
      option.innerHTML = `
        <span class="text-xs">${platformName}</span>
        <i class="fas fa-check text-blue-600 ml-auto"></i>
      `;
    } else {
      option.innerHTML = `<span class="text-xs">${platformName}</span>`;
    }
  });
}

/**
 * 更新搜索结果信息栏
 */
function updateSearchResultInfo() {
  const hasSearchOrFilter = currentSearchTerm || 
    currentFilter.startDate || 
    currentFilter.endDate || 
    currentFilter.platforms.length > 0;
  
  if (hasSearchOrFilter) {
    // 显示搜索结果信息栏
    elements.searchResultInfo.classList.remove('hidden');
    
    // 更新结果数量文本
    const count = filteredConversations.length;
    elements.resultCountText.textContent = chrome.i18n.getMessage('foundItems').replace('{count}', count);
    
    // 始终显示按钮，但根据结果数量决定是否禁用
    elements.multiSelectToggle.style.display = 'flex';
    elements.exportFilteredBtn.style.display = 'flex';
    
    if (count > 0) {
      // 有结果时启用按钮
      elements.multiSelectToggle.disabled = false;
      elements.exportFilteredBtn.disabled = false;
      elements.multiSelectToggle.classList.remove('opacity-50', 'cursor-not-allowed');
      elements.exportFilteredBtn.classList.remove('opacity-50', 'cursor-not-allowed');
    } else {
      // 无结果时禁用按钮
      elements.multiSelectToggle.disabled = true;
      elements.exportFilteredBtn.disabled = true;
      elements.multiSelectToggle.classList.add('opacity-50', 'cursor-not-allowed');
      elements.exportFilteredBtn.classList.add('opacity-50', 'cursor-not-allowed');
      
      // 如果当前处于多选模式，退出多选模式
      if (isMultiSelectMode) {
        isMultiSelectMode = false;
        selectedConversations.clear();
        updateMultiSelectButton();
      }
    }
  } else {
    // 隐藏搜索结果信息栏
    elements.searchResultInfo.classList.add('hidden');
    // 重置多选模式
    if (isMultiSelectMode) {
      isMultiSelectMode = false;
      selectedConversations.clear();
      updateMultiSelectButton();
    }
  }
}

/**
 * 通用的导出按钮状态管理器
 */
class ExportButtonManager {
  constructor(button) {
    this.button = button;
    this.originalText = button.innerHTML;
  }
  
  setLoading() {
    // 检查按钮是否包含span标签来决定格式
    const hasSpan = this.originalText.includes('<span>');
    if (hasSpan) {
      this.button.innerHTML = `<i class="fas fa-spinner fa-spin mr-1"></i><span>${chrome.i18n.getMessage('exporting')}</span>`;
    } else {
      this.button.innerHTML = `<i class="fas fa-spinner fa-spin mr-1"></i>${chrome.i18n.getMessage('exporting')}`;
    }
    this.button.disabled = true;
  }
  
  setSuccess() {
    // 检查按钮是否包含span标签来决定格式
    const hasSpan = this.originalText.includes('<span>');
    if (hasSpan) {
      this.button.innerHTML = `<i class="fas fa-check mr-1"></i><span>${chrome.i18n.getMessage('exportSuccess')}</span>`;
    } else {
      this.button.innerHTML = `<i class="fas fa-check mr-1"></i>${chrome.i18n.getMessage('exportSuccess')}`;
    }
    this.scheduleRestore();
  }
  
  setError() {
    // 检查按钮是否包含span标签来决定格式
    const hasSpan = this.originalText.includes('<span>');
    if (hasSpan) {
      this.button.innerHTML = `<i class="fas fa-exclamation-triangle mr-1"></i><span>${chrome.i18n.getMessage('exportError')}</span>`;
    } else {
      this.button.innerHTML = `<i class="fas fa-times mr-1"></i>${chrome.i18n.getMessage('exportFailed')}`;
    }
    this.scheduleRestore();
  }
  
  scheduleRestore() {
    setTimeout(() => {
      this.button.innerHTML = this.originalText;
      this.button.disabled = false;
    }, 2000);
  }
  
  immediateRestore() {
    this.button.innerHTML = this.originalText;
    this.button.disabled = false;
  }
}

/**
 * 通用导出核心函数
 * @param {Array} conversationIds - 对话ID列表
 * @param {string} exportType - 导出类型 ('separate' | 'merged')
 * @param {Object} metadata - 元数据
 * @param {ExportButtonManager} buttonManager - 按钮管理器
 */
function performExport(conversationIds, exportType, metadata, buttonManager) {
  // 检查是否有对话数据
  if (!conversationIds || conversationIds.length === 0) {
    buttonManager.setError();
    return;
  }
  
  // 发送导出请求
  chrome.runtime.sendMessage({
    type: 'exportConversationsByRange',
    conversationIds: conversationIds,
    exportType: exportType,
    metadata: metadata
  }, (response) => {
    if (response && response.url) {
      buttonManager.setSuccess();
    } else {
      buttonManager.setError();
    }
  });
}

/**
 * 导出筛选后的对话（支持多选）
 */
function exportFilteredConversations(mode = 'separate') {
  // 创建按钮管理器
  const buttonManager = new ExportButtonManager(elements.exportFilteredBtn);
  buttonManager.setLoading();
  
  // 确定要导出的对话范围
  let conversationIds;
  
  if (isMultiSelectMode && selectedConversations.size > 0) {
    // 多选模式：导出选中的对话
    conversationIds = Array.from(selectedConversations);
  } else {
    // 普通模式：导出当前筛选结果
    if (filteredConversations.length === 0) {
      buttonManager.immediateRestore();
      return;
    }
    conversationIds = filteredConversations.map(conv => conv.conversationId);
  }
  
  // 准备元数据
  const metadata = {
    searchTerm: currentSearchTerm,
    filter: currentFilter,
    exportMode: isMultiSelectMode ? 'multiselect' : 'filtered',
    selectedCount: isMultiSelectMode ? selectedConversations.size : null,
    filteredCount: filteredConversations.length
  };
  
  // 使用通用导出函数
  performExport(conversationIds, mode, metadata, buttonManager);
}

/**
 * 切换多选模式
 */
function toggleMultiSelectMode() {
  isMultiSelectMode = !isMultiSelectMode;
  
  // 更新按钮状态
  updateMultiSelectButton();
  
  // 清空已选择的对话
  selectedConversations.clear();
  
  // 重新渲染记忆列表以更新卡片样式
  const currentConversations = filteredConversations.length > 0 ? filteredConversations : allConversations;
  if (currentConversations.length > 0) {
    renderConversationCards(currentConversations);
    // 如果有搜索结果信息，更新显示
    updateSearchResultInfo();
  }
}

/**
 * 更新多选按钮的状态
 */
function updateMultiSelectButton() {
  if (isMultiSelectMode) {
    // 激活状态 - 柔和的蓝色背景，低调表示激活
    elements.multiSelectToggle.className = 'px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 focus:outline-none transition-all duration-200 flex items-center gap-1';
    elements.multiSelectToggle.innerHTML = `<i class="fas fa-times text-xs"></i><span>${chrome.i18n.getMessage('cancelButton')}</span>`;
    elements.multiSelectToggle.title = chrome.i18n.getMessage('cancelMultiSelectMode');
  } else {
    // 默认状态 - 透明背景，悬停时显示
    elements.multiSelectToggle.className = 'px-2 py-1 text-xs text-gray-500 rounded hover:bg-blue-100 hover:text-blue-700 focus:outline-none transition-all duration-200 flex items-center gap-1';
    elements.multiSelectToggle.innerHTML = `<i class="fas fa-tasks text-xs"></i><span>${chrome.i18n.getMessage('multiSelect')}</span>`;
    elements.multiSelectToggle.title = chrome.i18n.getMessage('multiSelectMode');
  }
  
  // 更新导出按钮文本
  updateExportButtonText();
}

/**
 * 更新导出按钮的文本
 */
function updateExportButtonText() {
  if (isMultiSelectMode && selectedConversations.size > 0) {
    // 多选模式且有选中项
    const exportSelectedText = chrome.i18n.getMessage('exportSelected').replace('{count}', selectedConversations.size);
    elements.exportFilteredBtn.innerHTML = `<i class="fas fa-download text-xs"></i><span>${exportSelectedText}</span><i class="fas fa-chevron-down text-xs"></i>`;
    const exportSelectedTitle = chrome.i18n.getMessage('exportSelectedTitle').replace('{count}', selectedConversations.size);
    elements.exportFilteredBtn.title = exportSelectedTitle;
  } else {
    // 默认状态
    elements.exportFilteredBtn.innerHTML = `<i class="fas fa-download text-xs"></i><span>${chrome.i18n.getMessage('export')}</span><i class="fas fa-chevron-down text-xs"></i>`;
    elements.exportFilteredBtn.title = chrome.i18n.getMessage('exportFilterResults');
  }
}

/**
 * 切换筛选导出下拉菜单
 */
function toggleFilteredExportDropdown() {
  const dropdown = elements.exportFilteredDropdown;
  if (dropdown.classList.contains('hidden')) {
    dropdown.classList.remove('hidden');
    // 点击其他地方关闭下拉菜单
    setTimeout(() => {
      document.addEventListener('click', hideFilteredExportDropdown, { once: true });
    }, 0);
  } else {
    dropdown.classList.add('hidden');
  }
}

/**
 * 隐藏筛选导出下拉菜单
 */
function hideFilteredExportDropdown() {
  elements.exportFilteredDropdown.classList.add('hidden');
}

/**
 * 切换对话的选中状态
 */
function toggleConversationSelection(conversationId, cardElement) {
  if (selectedConversations.has(conversationId)) {
    // 取消选中
    selectedConversations.delete(conversationId);
    updateCardSelectionState(cardElement, false);
  } else {
    // 选中
    selectedConversations.add(conversationId);
    updateCardSelectionState(cardElement, true);
  }
  
  // 更新导出按钮文本
  updateExportButtonText();
}

/**
 * 更新卡片的选中状态样式
 */
function updateCardSelectionState(cardElement, isSelected) {
  const checkbox = cardElement.querySelector('.multi-select-checkbox');
  
  if (isSelected) {
    // 选中状态 - 只更新checkbox样式
    if (checkbox) {
      checkbox.className = 'multi-select-checkbox w-5 h-5 rounded-full border-2 border-blue-500 bg-blue-500 flex items-center justify-center cursor-pointer transition-all duration-200';
      checkbox.innerHTML = '<i class="fas fa-check text-white text-xs"></i>';
    }
  } else {
    // 未选中状态 - 只更新checkbox样式
    if (checkbox) {
      checkbox.className = 'multi-select-checkbox w-5 h-5 rounded-full border-2 border-gray-300 flex items-center justify-center cursor-pointer transition-all duration-200 hover:border-blue-400';
      checkbox.innerHTML = '';
    }
  }
}
