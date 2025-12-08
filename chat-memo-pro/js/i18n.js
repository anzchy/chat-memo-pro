/**
 * 国际化工具类
 * 职责：统一管理多语言文本获取和格式化
 * 设计原则：单一职责、高内聚、低耦合
 */
class I18nManager {
    /**
     * 获取国际化文本
     * @param {string} key - 消息键名
     * @param {Array|string} substitutions - 替换参数
     * @returns {string} 本地化文本
     */
    static getMessage(key, substitutions = null) {
        try {
            if (typeof chrome !== 'undefined' && chrome.i18n) {
                return chrome.i18n.getMessage(key, substitutions) || key;
            }
            // 降级处理：如果chrome.i18n不可用，返回键名
            return key;
        } catch (error) {
            console.warn(`I18n error for key "${key}":`, error);
            return key;
        }
    }

    /**
     * 批量获取国际化文本
     * @param {Array<string>} keys - 消息键名数组
     * @returns {Object} 键值对对象
     */
    static getMessages(keys) {
        const messages = {};
        keys.forEach(key => {
            messages[key] = this.getMessage(key);
        });
        return messages;
    }

    /**
     * 格式化时间文本
     * @param {number} minutes - 分钟数
     * @returns {string} 格式化的时间文本
     */
    static formatTimeAgo(minutes) {
        if (minutes < 1) {
            return this.getMessage('justNow');
        } else if (minutes < 60) {
            return Math.floor(minutes) + ' ' + this.getMessage('minutesAgo');
        } else {
            const hours = Math.floor(minutes / 60);
            return hours + ' ' + this.getMessage('hoursAgo');
        }
    }

    /**
     * 初始化页面国际化
     * 自动替换页面中所有带有data-i18n属性的元素文本
     */
    static initPageI18n() {
        // 处理 data-i18n 属性
        const elements = document.querySelectorAll('[data-i18n]');
        elements.forEach(element => {
            const key = element.getAttribute('data-i18n');
            const text = this.getMessage(key);
            
            // 根据元素类型设置文本
            if (element.tagName === 'INPUT' && (element.type === 'text' || element.type === 'search')) {
                element.placeholder = text;
            } else if (element.tagName === 'INPUT' && element.type === 'button') {
                element.value = text;
            } else {
                element.textContent = text;
            }
        });
        
        // 处理 data-i18n-placeholder 属性
        const placeholderElements = document.querySelectorAll('[data-i18n-placeholder]');
        placeholderElements.forEach(element => {
            const key = element.getAttribute('data-i18n-placeholder');
            const text = this.getMessage(key);
            element.placeholder = text;
        });
        
        // 处理 data-i18n-title 属性
        const titleElements = document.querySelectorAll('[data-i18n-title]');
        titleElements.forEach(element => {
            const key = element.getAttribute('data-i18n-title');
            const text = this.getMessage(key);
            element.title = text;
        });
    }

    /**
     * 动态更新元素文本
     * @param {string} elementId - 元素ID
     * @param {string} key - 消息键名
     * @param {Array|string} substitutions - 替换参数
     */
    static updateElementText(elementId, key, substitutions = null) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = this.getMessage(key, substitutions);
        }
    }

    /**
     * 动态更新元素HTML内容
     * @param {string} elementId - 元素ID
     * @param {string} key - 消息键名
     * @param {Array|string} substitutions - 替换参数
     */
    static updateElementHTML(elementId, key, substitutions = null) {
        const element = document.getElementById(elementId);
        if (element) {
            element.innerHTML = this.getMessage(key, substitutions);
        }
    }
}

// 全局快捷方法
window.i18n = I18nManager.getMessage.bind(I18nManager);
window.I18n = I18nManager;

// 页面加载完成后自动初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        I18nManager.initPageI18n();
    });
} else {
    I18nManager.initPageI18n();
}