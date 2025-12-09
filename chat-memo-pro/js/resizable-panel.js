/**
 * 可调整大小面板类
 * 用于处理侧边栏宽度的拖拽调整、持久化和响应式更新
 */
class ResizablePanel {
  /**
   * 构造函数
   * @param {HTMLElement} element - 要调整大小的DOM元素
   * @param {Object} options - 配置选项
   * @param {number} [options.minWidth=320] - 最小宽度
   * @param {number} [options.maxWidth=800] - 最大宽度
   * @param {number} [options.defaultWidth=400] - 默认宽度
   * @param {number} [options.handleWidth=5] - 拖拽手柄宽度
   */
  constructor(element, options = {}) {
    this.element = element;
    this.options = Object.assign({
      minWidth: 320,
      maxWidth: 800,
      defaultWidth: 400,
      handleWidth: 5
    }, options);

    this.isResizing = false;
    this.startWidth = 0;
    this.startX = 0;
    
    // Bind methods
    this.startResize = this.startResize.bind(this);
    this.resize = this.resize.bind(this);
    this.stopResize = this.stopResize.bind(this);
    this.createResizeHandle = this.createResizeHandle.bind(this);
    this.updateResponsiveClasses = this.updateResponsiveClasses.bind(this);

    // Initialize
    this.init();
  }

  /**
   * 初始化面板
   * 创建手柄、恢复宽度、绑定事件
   */
  init() {
    // Create resize handle
    this.handle = this.createResizeHandle();
    this.element.appendChild(this.handle);

    // Restore saved width
    this.restoreWidth();

    // Event listeners
    this.handle.addEventListener('mousedown', this.startResize);
    
    // Prevent text selection during resize
    this.element.style.position = 'relative';
  }

  /**
   * 创建调整大小的手柄元素
   * @returns {HTMLElement} 手柄DOM元素
   */
  createResizeHandle() {
    const handle = document.createElement('div');
    handle.className = 'resize-handle';
    handle.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: ${this.options.handleWidth}px;
      height: 100%;
      cursor: col-resize;
      z-index: 1000;
      background-color: transparent;
      transition: background-color 0.2s;
    `;

    // Add visual indicator on hover
    handle.addEventListener('mouseenter', () => {
      handle.style.backgroundColor = 'rgba(59, 130, 246, 0.2)';
    });

    handle.addEventListener('mouseleave', () => {
      if (!this.isResizing) {
        handle.style.backgroundColor = 'transparent';
      }
    });

    return handle;
  }

  /**
   * 开始调整大小操作
   * @param {MouseEvent} e - 鼠标事件对象
   */
  startResize(e) {
    this.isResizing = true;
    this.startX = e.clientX;
    
    // For injected sidebar, we're resizing from left edge (width increases as mouse moves left)
    // OR right edge depending on placement.
    // Chat Memo sidebar is usually on the right side of the screen.
    // If it's on the right, dragging the LEFT edge resizes it.
    
    // Check where the handle is relative to the element
    const rect = this.element.getBoundingClientRect();
    const isRightSide = window.innerWidth - rect.right < 100; // Is sidebar anchored to right?
    
    this.startWidth = rect.width;
    
    // Set global cursor
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    
    // Show active state on handle
    this.handle.style.backgroundColor = 'rgba(59, 130, 246, 0.4)';

    // Add global event listeners
    document.addEventListener('mousemove', this.resize);
    document.addEventListener('mouseup', this.stopResize);
    
    // Create tooltip
    this.showTooltip();
  }

  /**
   * 执行调整大小计算
   * @param {MouseEvent} e - 鼠标事件对象
   */
  resize(e) {
    if (!this.isResizing) return;

    // Request animation frame for smooth rendering
    requestAnimationFrame(() => {
      // Calculate new width
      // Since sidebar is on the right, moving mouse to LEFT (smaller clientX) increases width
      const deltaX = this.startX - e.clientX;
      let newWidth = this.startWidth + deltaX;

      // Constrain width
      newWidth = Math.max(this.options.minWidth, Math.min(this.options.maxWidth, newWidth));

      // Apply width
      this.element.style.width = `${newWidth}px`;
      
      // Update responsive classes
      this.updateResponsiveClasses(newWidth);
      
      // Update tooltip
      this.updateTooltip(newWidth);
    });
  }

  /**
   * 停止调整大小
   */
  stopResize() {
    if (!this.isResizing) return;

    this.isResizing = false;
    
    // Reset styles
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    this.handle.style.backgroundColor = 'transparent';

    // Remove global listeners
    document.removeEventListener('mousemove', this.resize);
    document.removeEventListener('mouseup', this.stopResize);

    // Save width
    const currentWidth = parseInt(this.element.style.width, 10);
    this.saveWidth(currentWidth);
    
    // Remove tooltip
    this.hideTooltip();
  }

  /**
   * 根据宽度更新响应式类名
   * @param {number} width - 当前宽度
   */
  updateResponsiveClasses(width) {
    if (width < 450) {
      this.element.classList.add('sidebar-narrow');
      this.element.classList.remove('sidebar-wide');
    } else {
      this.element.classList.remove('sidebar-narrow');
      this.element.classList.add('sidebar-wide');
    }
  }

  /**
   * 保存宽度到存储
   * @param {number} width - 要保存的宽度
   */
  saveWidth(width) {
    localStorage.setItem('chat-memo-sidebar-width', width);
  }

  /**
   * 从存储恢复宽度
   */
  restoreWidth() {
    const savedWidth = localStorage.getItem('chat-memo-sidebar-width');
    if (savedWidth) {
      const width = parseInt(savedWidth, 10);
      // Validate saved width
      const validWidth = Math.max(this.options.minWidth, Math.min(this.options.maxWidth, width));
      this.element.style.width = `${validWidth}px`;
      this.updateResponsiveClasses(validWidth);
    } else {
      this.element.style.width = `${this.options.defaultWidth}px`;
      this.updateResponsiveClasses(this.options.defaultWidth);
    }
  }
  
  /**
   * 显示宽度提示
   */
  showTooltip() {
    this.tooltip = document.createElement('div');
    this.tooltip.className = 'resize-tooltip';
    this.tooltip.style.cssText = `
      position: absolute;
      top: 50%;
      left: -60px;
      transform: translateY(-50%);
      background-color: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      pointer-events: none;
      z-index: 1001;
    `;
    this.tooltip.textContent = `${parseInt(this.element.style.width)}px`;
    this.element.appendChild(this.tooltip);
  }
  
  /**
   * 更新提示文本
   * @param {number} width - 当前宽度
   */
  updateTooltip(width) {
    if (this.tooltip) {
      this.tooltip.textContent = `${Math.round(width)}px`;
    }
  }
  
  /**
   * 隐藏提示
   */
  hideTooltip() {
    if (this.tooltip) {
      this.tooltip.remove();
      this.tooltip = null;
    }
  }
}

// Export for usage
window.ResizablePanel = ResizablePanel;
