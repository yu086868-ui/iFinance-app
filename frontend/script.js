// 全局变量
let currentUser = null;
let allRecords = [];
let autoRefreshInterval = null;

// 检查认证状态
function checkAuthentication() {
    const token = localStorage.getItem('authToken');
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    
    if (!token || !user) {
        window.location.href = 'login.html';
        return;
    }
    
    currentUser = user;
    
    // 显示用户信息
    const userWelcome = document.getElementById('userWelcome');
    if (userWelcome) {
        userWelcome.textContent = `欢迎，${user.username}`;
    }
    
    // 初始化应用
    initApp();
}

// 初始化应用
async function initApp() {
    console.log('🚀 初始化记账应用...');
    loadTheme();
    
    // 设置默认日期为今天
    const dateInput = document.getElementById('date');
    if (dateInput) {
        dateInput.valueAsDate = new Date();
    }
    
    // 按顺序加载数据
    await loadRecords();  // 先加载记录
    await loadBudget();   // 再加载预算（依赖记录数据）
    
    // 启动自动刷新
    startAutoRefresh();
    
    console.log('✅ 应用初始化完成');
}

// 退出登录
function logout() {
    if (confirm('确定要退出登录吗？')) {
        stopAutoRefresh();
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
        if (window.financeAPI) {
            window.financeAPI.logout();
        }
        window.location.href = 'login.html';
    }
}

// 自动刷新功能
function startAutoRefresh() {
    autoRefreshInterval = setInterval(() => {
        console.log('🔄 自动刷新数据...');
        loadRecords();
    }, 30000); // 30秒刷新一次
}

function stopAutoRefresh() {
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
        autoRefreshInterval = null;
    }
}

// 主题切换
function toggleTheme() {
    const body = document.body;
    const isDark = body.classList.contains('dark-theme');
    
    if (isDark) {
        body.classList.remove('dark-theme');
        body.classList.add('light-theme');
        localStorage.setItem('theme', 'light');
    } else {
        body.classList.remove('light-theme');
        body.classList.add('dark-theme');
        localStorage.setItem('theme', 'dark');
    }
}

function loadTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.body.className = savedTheme + '-theme';
}

// 快速记账功能
function quickAdd(category) {
    const button = event.target;
    const amount = button.getAttribute('data-amount');
    
    document.getElementById('quickAmount').value = amount;
    document.getElementById('quickCategory').value = category;
    document.getElementById('quickAddForm').style.display = 'block';
}

function showQuickAdd() {
    document.getElementById('quickAddForm').style.display = 'block';
}

function hideQuickAdd() {
    document.getElementById('quickAddForm').style.display = 'none';
    // 清空表单
    document.getElementById('quickAmount').value = '';
    document.getElementById('quickNote').value = '';
}

async function submitQuickAdd() {
    const amount = document.getElementById('quickAmount').value;
    const category = document.getElementById('quickCategory').value;
    const note = document.getElementById('quickNote').value;
    
    if (!amount) {
        showAlert('请输入金额', 'warning');
        return;
    }
    
    const record = {
        type: 'expense',
        amount: parseFloat(amount),
        category: category,
        account: 'cash',
        date: new Date().toISOString().split('T')[0],
        note: note,
        currency: 'CNY'
    };
    
    await addRecordToAPI(record);
    hideQuickAdd();
}

// 主记账功能
async function addRecord() {
    const type = document.getElementById('type').value;
    const amount = parseFloat(document.getElementById('amount').value);
    const category = document.getElementById('category').value;
    const account = document.getElementById('account').value;
    const date = document.getElementById('date').value;
    const note = document.getElementById('note').value;
    
    // 验证输入
    if (!amount || amount <= 0) {
        showAlert('请输入有效的金额', 'warning');
        return;
    }
    
    if (!category) {
        showAlert('请选择分类', 'warning');
        return;
    }
    
    if (!date) {
        showAlert('请选择日期', 'warning');
        return;
    }
    
    const record = {
        type: type,
        amount: amount,
        category: category,
        account: account,
        date: date,
        note: note,
        currency: 'CNY'
    };
    
    await addRecordToAPI(record);
}

async function addRecordToAPI(record) {
    try {
        showLoading('正在添加记录...');
        console.log('📝 添加记录:', record);
        
        const result = await window.financeAPI.createRecord(record);
        console.log('✅ 添加记录响应:', result);
        
        if (result.success) {
            // 清空表单
            document.getElementById('amount').value = '';
            document.getElementById('note').value = '';
            document.getElementById('category').selectedIndex = 0;
            
            showAlert('记录添加成功！', 'success');
            
            // 立即重新加载数据，确保界面更新
            await loadRecords();
        } else {
            throw new Error(result.message || '添加失败');
        }
    } catch (error) {
        console.error('❌ 添加记录失败:', error);
        showAlert('添加记录失败: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

// 数据加载功能
async function loadRecords() {
    try {
        console.log('🔄 开始加载记录...');
        showLoading('正在加载记录...');
        
        const result = await window.financeAPI.getRecords();
        console.log('📊 加载记录响应:', result);
        
        if (result.success) {
            allRecords = result.data.records || [];
            console.log(`✅ 成功加载 ${allRecords.length} 条记录`);
            
            // 更新所有界面
            displayRecords(allRecords);
            updateStatistics(allRecords);
            updateCharts(allRecords);
            
            if (allRecords.length > 0) {
                showAlert(`已加载 ${allRecords.length} 条记录`, 'success');
            }
        } else {
            throw new Error(result.message || '加载失败');
        }
    } catch (error) {
        console.error('❌ 加载记录失败:', error);
        showAlert('加载记录失败: ' + error.message, 'error');
        allRecords = [];
        displayRecords([]);
        updateCharts([]); // 确保图表也更新为空状态
    } finally {
        hideLoading();
    }
}

// 显示记录列表
function displayRecords(records) {
    const recordList = document.getElementById('recordList');
    if (!recordList) return;
    
    recordList.innerHTML = '';
    
    // 按日期排序（最新的在前面）
    records.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    if (records.length === 0) {
        recordList.innerHTML = `
            <div class="no-records">
                <div style="text-align: center; padding: 40px; color: #7f8c8d;">
                    <div style="font-size: 3em; margin-bottom: 20px;">📝</div>
                    <h3>还没有任何记录</h3>
                    <p>开始添加你的第一笔账吧！</p>
                </div>
            </div>
        `;
        return;
    }
    
    records.forEach(record => {
        const recordElement = document.createElement('div');
        recordElement.className = 'record-item';
        recordElement.innerHTML = `
            <div class="record-info">
                <span class="record-category category-${record.category}">${getCategoryName(record.category)}</span>
                <span class="record-date">${formatDate(record.date)}</span>
                <span class="account-tag">${getAccountName(record.account)}</span>
            </div>
            <span class="record-note">${record.note || '无备注'}</span>
            <span class="record-amount ${record.type}">
                ${record.type === 'income' ? '+' : '-'}${record.amount.toFixed(2)}
            </span>
            <button class="btn-delete" onclick="deleteRecord(${record.id})" title="删除记录">删除</button>
        `;
        recordList.appendChild(recordElement);
    });
}

// 删除记录
async function deleteRecord(id) {
    if (!confirm('确定要删除这条记录吗？')) {
        return;
    }
    
    try {
        showLoading('正在删除...');
        console.log('🗑️ 删除记录:', id);
        
        const result = await window.financeAPI.deleteRecord(id);
        console.log('✅ 删除响应:', result);
        
        if (result.success) {
            showAlert('记录删除成功！', 'success');
            // 立即重新加载数据
            await loadRecords();
        } else {
            throw new Error(result.message || '删除失败');
        }
    } catch (error) {
        console.error('❌ 删除记录失败:', error);
        showAlert('删除记录失败: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

// 统计信息更新
function updateStatistics(records) {
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
    
    let monthIncome = 0;
    let monthExpense = 0;
    let monthTransactions = 0;
    
    records.forEach(record => {
        if (record.date.slice(0, 7) === currentMonth) {
            monthTransactions++;
            if (record.type === 'income') {
                monthIncome += record.amount;
            } else {
                monthExpense += record.amount;
            }
        }
    });
    
    const balance = monthIncome - monthExpense;
    
    // 更新页面显示
    updateElementText('monthIncome', monthIncome.toFixed(2));
    updateElementText('monthExpense', monthExpense.toFixed(2));
    updateElementText('monthBalance', balance.toFixed(2));
    
    // 计算日均消费
    const currentDay = new Date().getDate();
    const dailyAverage = monthExpense / Math.max(currentDay, 1);
    updateElementText('dailyAverage', dailyAverage.toFixed(2));
    
    // 消费趋势（简单判断）
    const spendingTrendElement = document.getElementById('spendingTrend');
    if (spendingTrendElement) {
        if (monthExpense > 0) {
            spendingTrendElement.textContent = monthTransactions > 10 ? '↑' : '→';
        } else {
            spendingTrendElement.textContent = '→';
        }
    }
    
    console.log(`📈 统计更新: 收入 ${monthIncome}, 支出 ${monthExpense}, 余额 ${balance}`);
}

// 图表更新
function updateCharts(records) {
    updateCategoryChart(records);
    updateTrendChart(records);
}

function updateCategoryChart(records) {
    const categoryBars = document.getElementById('categoryBars');
    if (!categoryBars) return;
    
    const currentMonth = new Date().toISOString().slice(0, 7);
    const categoryData = {};
    
    // 统计本月各分类支出
    const monthExpenses = records.filter(record => 
        record.type === 'expense' && record.date.slice(0, 7) === currentMonth
    );
    
    monthExpenses.forEach(record => {
        if (!categoryData[record.category]) {
            categoryData[record.category] = 0;
        }
        categoryData[record.category] += record.amount;
    });
    
    categoryBars.innerHTML = '';
    
    if (Object.keys(categoryData).length === 0) {
        categoryBars.innerHTML = `
            <div class="no-data" style="text-align: center; padding: 40px; color: #7f8c8d;">
                <div style="font-size: 2em; margin-bottom: 10px;">📊</div>
                <p>本月暂无支出数据</p>
            </div>
        `;
        return;
    }
    
    const maxAmount = Math.max(...Object.values(categoryData));
    
    Object.entries(categoryData).forEach(([category, amount]) => {
        const percentage = (amount / maxAmount) * 100;
        const percentageText = ((amount / monthExpenses.reduce((sum, r) => sum + r.amount, 0)) * 100).toFixed(1);
        
        const barElement = document.createElement('div');
        barElement.className = 'category-bar';
        barElement.innerHTML = `
            <span class="category-name">${getCategoryName(category)}</span>
            <div class="bar-container">
                <div class="bar" style="width: ${percentage}%"></div>
            </div>
            <span class="category-amount">¥${amount.toFixed(2)} (${percentageText}%)</span>
        `;
        categoryBars.appendChild(barElement);
    });
}

// 修复消费趋势图表
function updateTrendChart(records) {
    const trendChart = document.getElementById('trendChart');
    if (!trendChart) return;
    
    // 获取最近7天的数据
    const last7Days = [];
    const today = new Date();
    
    for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(today.getDate() - i);
        last7Days.push(date.toISOString().split('T')[0]);
    }
    
    // 计算每天的总支出
    const dailyData = last7Days.map(date => {
        const dayExpense = records
            .filter(record => 
                record.type === 'expense' && 
                record.date === date
            )
            .reduce((sum, record) => sum + record.amount, 0);
        return { 
            date, 
            amount: dayExpense,
            displayDate: date.slice(5) // 显示 MM-DD
        };
    });
    
    const maxAmount = Math.max(...dailyData.map(d => d.amount), 1); // 避免除0
    
    let chartHTML = '';
    
    if (maxAmount === 0) {
        chartHTML = `
            <div class="no-data" style="text-align: center; padding: 40px; color: #7f8c8d;">
                <div style="font-size: 2em; margin-bottom: 10px;">📈</div>
                <p>最近7天暂无消费数据</p>
            </div>
        `;
    } else {
        chartHTML = `
            <div style="padding: 15px;">
                <div style="font-size: 12px; color: #7f8c8d; margin-bottom: 10px; text-align: center;">
                    最近7天消费趋势
                </div>
                <div style="display: flex; align-items: end; justify-content: space-between; height: 120px; 
                     border-bottom: 1px solid #e1e8ed; padding-bottom: 10px; gap: 5px;">
                    ${dailyData.map(day => {
                        const height = (day.amount / maxAmount) * 80;
                        return `
                            <div style="flex: 1; display: flex; flex-direction: column; align-items: center; height: 100%;">
                                <div style="width: 100%; display: flex; flex-direction: column; align-items: center; height: 100%; justify-content: end;">
                                    <div style="width: 80%; background: linear-gradient(to top, #3498db, #2980b9); 
                                         border-radius: 4px 4px 0 0; height: ${Math.max(height, 5)}%; 
                                         min-height: 5px; position: relative;">
                                        <div style="position: absolute; top: -20px; left: 50%; transform: translateX(-50%); 
                                             font-size: 10px; color: #2c3e50; white-space: nowrap;">
                                            ¥${day.amount.toFixed(0)}
                                        </div>
                                    </div>
                                </div>
                                <div style="font-size: 10px; color: #7f8c8d; margin-top: 5px; text-align: center;">
                                    ${day.displayDate}
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
                <div style="display: flex; justify-content: space-between; margin-top: 8px; font-size: 11px; color: #7f8c8d;">
                    <span>总计: ¥${dailyData.reduce((sum, day) => sum + day.amount, 0).toFixed(2)}</span>
                    <span>日均: ¥${(dailyData.reduce((sum, day) => sum + day.amount, 0) / 7).toFixed(2)}</span>
                </div>
            </div>
        `;
    }
    
    trendChart.innerHTML = chartHTML;
}

// 预算管理
async function loadBudget() {
    try {
        const result = await window.financeAPI.getBudgets();
        if (result.success && result.data.budgets && result.data.budgets.length > 0) {
            updateBudgetDisplay(result.data.budgets);
        } else {
            updateBudgetDisplay([]);
        }
    } catch (error) {
        console.error('加载预算失败:', error);
        updateBudgetDisplay([]);
    }
}

function updateBudgetDisplay(budgets) {
    const budgetAmountElement = document.getElementById('budgetAmount');
    const budgetRemainingElement = document.getElementById('budgetRemaining');
    const progressFill = document.getElementById('budgetProgress');
    const usedAmountElement = document.getElementById('usedAmount');
    const remainingAmountElement = document.getElementById('remainingAmount');
    
    if (!budgets || budgets.length === 0) {
        if (budgetAmountElement) budgetAmountElement.textContent = '未设置';
        if (budgetRemainingElement) budgetRemainingElement.textContent = '0';
        if (progressFill) progressFill.style.width = '0%';
        if (usedAmountElement) usedAmountElement.textContent = '0';
        if (remainingAmountElement) remainingAmountElement.textContent = '0';
        return;
    }
    
    // 使用第一个预算（简化处理）
    const budget = budgets[0];
    const currentMonth = new Date().toISOString().slice(0, 7);
    
    const monthExpense = allRecords
        .filter(record => record.type === 'expense' && record.date.slice(0, 7) === currentMonth)
        .reduce((sum, record) => sum + record.amount, 0);
    
    const remaining = budget.amount - monthExpense;
    const usagePercent = Math.min((monthExpense / budget.amount) * 100, 100);
    
    if (budgetAmountElement) budgetAmountElement.textContent = `¥${budget.amount.toFixed(2)}`;
    if (budgetRemainingElement) budgetRemainingElement.textContent = remaining.toFixed(2);
    if (progressFill) {
        progressFill.style.width = usagePercent + '%';
        // 根据使用率设置颜色
        if (usagePercent >= 90) {
            progressFill.style.background = 'linear-gradient(90deg, #e74c3c, #c0392b)';
        } else if (usagePercent >= 70) {
            progressFill.style.background = 'linear-gradient(90deg, #f39c12, #e67e22)';
        } else {
            progressFill.style.background = 'linear-gradient(90deg, #2ecc71, #27ae60)';
        }
    }
    if (usedAmountElement) usedAmountElement.textContent = monthExpense.toFixed(2);
    if (remainingAmountElement) remainingAmountElement.textContent = remaining.toFixed(2);
    
    // 预算提醒
    if (remaining < 0) {
        showAlert(`预算超支！已超出 ${Math.abs(remaining).toFixed(2)} 元`, 'warning');
    } else if (usagePercent >= 80) {
        showAlert(`预算警告：已使用 ${usagePercent.toFixed(1)}%`, 'warning');
    }
}


// 搜索和筛选功能
function searchRecords() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    
    if (!searchTerm) {
        displayRecords(allRecords);
        return;
    }
    
    const filteredRecords = allRecords.filter(record => 
        (record.note && record.note.toLowerCase().includes(searchTerm)) ||
        getCategoryName(record.category).toLowerCase().includes(searchTerm) ||
        record.amount.toString().includes(searchTerm) ||
        getAccountName(record.account).toLowerCase().includes(searchTerm)
    );
    
    displayRecords(filteredRecords);
    
    if (filteredRecords.length === 0) {
        showAlert(`没有找到包含"${searchTerm}"的记录`, 'info');
    }
}

function toggleSort() {
    showAlert(`排序功能开发中...`, 'info');
}

// 数据导出导入
async function exportData() {
    try {
        showLoading('正在导出数据...');
        
        const dataStr = JSON.stringify(allRecords, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = `记账数据_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        showAlert('数据导出成功！', 'success');
    } catch (error) {
        console.error('导出失败:', error);
        showAlert('导出失败: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

function importData() {
    showAlert(`数据导入功能开发中...`, 'info');
}

// 提醒功能
function showAlert(message, type = 'info') {
    const alertsContainer = document.getElementById('alertsContainer');
    if (!alertsContainer) return;
    
    const alert = document.createElement('div');
    alert.className = `alert ${type}`;
    alert.innerHTML = `
        <span>${getAlertIcon(type)}</span>
        <span>${message}</span>
        <button onclick="this.parentElement.remove()" style="margin-left: auto; background: none; border: none; cursor: pointer; font-size: 16px;">×</button>
    `;
    
    alertsContainer.appendChild(alert);
    
    // 自动移除提醒
    setTimeout(() => {
        if (alert.parentElement) {
            alert.remove();
        }
    }, 5000);
}

function getAlertIcon(type) {
    const icons = {
        'warning': '⚠️',
        'info': 'ℹ️',
        'success': '✅',
        'error': '❌'
    };
    return icons[type] || 'ℹ️';
}

// 加载状态
function showLoading(message = '加载中...') {
    // 可以在这里添加加载动画
    console.log('⏳ ' + message);
}

function hideLoading() {
    // 隐藏加载动画
}

// 工具函数
function getCategoryName(category) {
    const categories = {
        'food': '餐饮',
        'transport': '交通',
        'shopping': '购物',
        'entertainment': '娱乐',
        'medical': '医疗',
        'education': '教育',
        'investment': '投资',
        'other': '其他'
    };
    return categories[category] || category;
}

function getAccountName(account) {
    const accounts = {
        'cash': '现金',
        'bank': '银行卡',
        'alipay': '支付宝',
        'wechat': '微信支付',
        'credit': '信用卡',
        'digital': '数字钱包'
    };
    return accounts[account] || account;
}

function formatDate(dateString) {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.toDateString() === today.toDateString()) {
        return '今天';
    } else if (date.toDateString() === yesterday.toDateString()) {
        return '昨天';
    } else {
        return `${date.getMonth() + 1}月${date.getDate()}日`;
    }
}

function updateElementText(elementId, text) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = text;
    }
}

// 页面事件监听
document.addEventListener('DOMContentLoaded', function() {
    console.log('📄 页面加载完成');
    checkAuthentication();
});

// 页面卸载时清理
window.addEventListener('beforeunload', function() {
    stopAutoRefresh();
    console.log('🧹 清理资源');
});

// 键盘快捷键
document.addEventListener('keydown', function(event) {
    if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') return;
    
    switch(event.key.toLowerCase()) {
        case 'q':
            event.preventDefault();
            showQuickAdd();
            break;
        case 'f':
            event.preventDefault();
            const searchInput = document.getElementById('searchInput');
            if (searchInput) searchInput.focus();
            break;
        case 'e':
            event.preventDefault();
            exportData();
            break;
        case 'd':
            event.preventDefault();
            toggleTheme();
            break;
    }
});
