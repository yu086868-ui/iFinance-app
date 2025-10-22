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
// ==================== 数据分析功能 ====================

// 更新图表函数 - 完整实现
function updateCharts(records) {
    updateCategoryChart(records);
    updateAccountChart(records);
    updateComparisonChart(records);
    updateTrendChart(records);
}

// 分类分布图表 - 完整实现
function updateCategoryChart(records) {
    const categoryChart = document.getElementById('categoryChart');
    if (!categoryChart) return;
    
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
    
    let chartHTML = '';
    
    if (Object.keys(categoryData).length === 0) {
        chartHTML = `
            <div class="no-data" style="text-align: center; padding: 40px; color: #7f8c8d;">
                <div style="font-size: 2em; margin-bottom: 10px;">📊</div>
                <p>本月暂无支出数据</p>
            </div>
        `;
    } else {
        const total = Object.values(categoryData).reduce((sum, amount) => sum + amount, 0);
        
        // 创建饼图
        chartHTML = '<div style="display: flex; flex-wrap: wrap; gap: 20px; align-items: center;">';
        chartHTML += '<div style="flex: 1; min-width: 200px;">';
        
        // 饼图容器
        chartHTML += '<div style="width: 150px; height: 150px; border-radius: 50%; background: conic-gradient(';
        
        const colors = ['#e74c3c', '#3498db', '#9b59b6', '#f39c12', '#1abc9c', '#34495e', '#e67e22', '#95a5a6'];
        let currentAngle = 0;
        
        Object.entries(categoryData).forEach(([category, amount], index) => {
            const percentage = (amount / total) * 100;
            const angle = (percentage / 100) * 360;
            const color = colors[index % colors.length];
            
            chartHTML += `${color} ${currentAngle}deg ${currentAngle + angle}deg`;
            if (index < Object.keys(categoryData).length - 1) {
                chartHTML += ', ';
            }
            currentAngle += angle;
        });
        
        chartHTML += '); margin: 0 auto;"></div>';
        chartHTML += '</div>';
        
        // 图例
        chartHTML += '<div style="flex: 2; min-width: 200px;">';
        chartHTML += '<div style="font-size: 12px; color: #7f8c8d; margin-bottom: 10px;">分类分布</div>';
        
        Object.entries(categoryData).forEach(([category, amount], index) => {
            const percentage = ((amount / total) * 100).toFixed(1);
            const color = colors[index % colors.length];
            
            chartHTML += `
                <div style="display: flex; align-items: center; margin-bottom: 8px; font-size: 14px;">
                    <div style="width: 12px; height: 12px; background: ${color}; border-radius: 2px; margin-right: 8px;"></div>
                    <span style="flex: 1;">${getCategoryName(category)}</span>
                    <span style="color: #2c3e50; font-weight: bold;">¥${amount.toFixed(2)}</span>
                    <span style="color: #7f8c8d; margin-left: 8px;">${percentage}%</span>
                </div>
            `;
        });
        
        chartHTML += '</div>';
        chartHTML += '</div>';
    }
    
    categoryChart.innerHTML = chartHTML;
}

// 账户分布图表
function updateAccountChart(records) {
    const accountChart = document.getElementById('accountChart');
    if (!accountChart) return;
    
    const currentMonth = new Date().toISOString().slice(0, 7);
    const accountData = {};
    
    // 统计本月各账户支出
    const monthExpenses = records.filter(record => 
        record.type === 'expense' && record.date.slice(0, 7) === currentMonth
    );
    
    monthExpenses.forEach(record => {
        if (!accountData[record.account]) {
            accountData[record.account] = 0;
        }
        accountData[record.account] += record.amount;
    });
    
    let chartHTML = '';
    
    if (Object.keys(accountData).length === 0) {
        chartHTML = `
            <div class="no-data" style="text-align: center; padding: 40px; color: #7f8c8d;">
                <div style="font-size: 2em; margin-bottom: 10px;">💳</div>
                <p>本月暂无账户数据</p>
            </div>
        `;
    } else {
        const total = Object.values(accountData).reduce((sum, amount) => sum + amount, 0);
        const maxAmount = Math.max(...Object.values(accountData));
        
        chartHTML = '<div style="padding: 10px 0;">';
        chartHTML += '<div style="font-size: 12px; color: #7f8c8d; margin-bottom: 15px;">账户支出分布</div>';
        
        Object.entries(accountData).forEach(([account, amount]) => {
            const percentage = ((amount / total) * 100).toFixed(1);
            const barWidth = (amount / maxAmount) * 100;
            
            chartHTML += `
                <div style="margin-bottom: 12px;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 14px;">
                        <span>${getAccountName(account)}</span>
                        <span style="color: #2c3e50; font-weight: bold;">¥${amount.toFixed(2)}</span>
                    </div>
                    <div style="background: #ecf0f1; border-radius: 10px; height: 20px; overflow: hidden;">
                        <div style="background: linear-gradient(90deg, #3498db, #2980b9); height: 100%; border-radius: 10px; width: ${barWidth}%; 
                             display: flex; align-items: center; justify-content: flex-end; padding-right: 8px; color: white; font-size: 12px;">
                            ${percentage}%
                        </div>
                    </div>
                </div>
            `;
        });
        
        chartHTML += '</div>';
    }
    
    accountChart.innerHTML = chartHTML;
}

// 月度对比图表
function updateComparisonChart(records) {
    const comparisonChart = document.getElementById('comparisonChart');
    if (!comparisonChart) return;
    
    const currentYear = new Date().getFullYear();
    const monthlyData = {};
    
    // 统计今年每月数据
    for (let month = 1; month <= 12; month++) {
        const monthKey = `${currentYear}-${month.toString().padStart(2, '0')}`;
        const monthRecords = records.filter(record => record.date.startsWith(monthKey));
        
        monthlyData[month] = {
            income: monthRecords.filter(r => r.type === 'income').reduce((sum, r) => sum + r.amount, 0),
            expense: monthRecords.filter(r => r.type === 'expense').reduce((sum, r) => sum + r.amount, 0)
        };
    }
    
    let chartHTML = '';
    const maxAmount = Math.max(...Object.values(monthlyData).flatMap(data => [data.income, data.expense]));
    
    if (maxAmount === 0) {
        chartHTML = `
            <div class="no-data" style="text-align: center; padding: 40px; color: #7f8c8d;">
                <div style="font-size: 2em; margin-bottom: 10px;">📅</div>
                <p>暂无月度对比数据</p>
            </div>
        `;
    } else {
        chartHTML = '<div style="padding: 10px 0;">';
        chartHTML += '<div style="display: flex; justify-content: center; gap: 20px; margin-bottom: 15px; font-size: 12px; color: #7f8c8d;">';
        chartHTML += '<div style="display: flex; align-items: center;"><div style="width: 12px; height: 12px; background: #2ecc71; margin-right: 5px;"></div>收入</div>';
        chartHTML += '<div style="display: flex; align-items: center;"><div style="width: 12px; height: 12px; background: #e74c3c; margin-right: 5px;"></div>支出</div>';
        chartHTML += '</div>';
        
        chartHTML += '<div style="display: flex; align-items: end; height: 200px; gap: 8px; border-bottom: 1px solid #e1e8ed; padding-bottom: 10px;">';
        
        for (let month = 1; month <= 12; month++) {
            const data = monthlyData[month];
            const incomeHeight = (data.income / maxAmount) * 80;
            const expenseHeight = (data.expense / maxAmount) * 80;
            
            chartHTML += `
                <div style="flex: 1; display: flex; flex-direction: column; align-items: center; height: 100%;">
                    <div style="display: flex; align-items: end; height: 100%; gap: 2px;">
                        <div style="width: 8px; background: #2ecc71; border-radius: 2px 2px 0 0; height: ${incomeHeight}%;" title="收入: ¥${data.income.toFixed(2)}"></div>
                        <div style="width: 8px; background: #e74c3c; border-radius: 2px 2px 0 0; height: ${expenseHeight}%;" title="支出: ¥${data.expense.toFixed(2)}"></div>
                    </div>
                    <div style="font-size: 11px; color: #7f8c8d; margin-top: 5px;">${month}月</div>
                </div>
            `;
        }
        
        chartHTML += '</div>';
        chartHTML += '</div>';
    }
    
    comparisonChart.innerHTML = chartHTML;
}

// ==================== 数据工具功能 ====================

// 导入数据功能
async function importData() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = async (event) => {
        const file = event.target.files[0];
        if (!file) return;
        
        try {
            showLoading('正在导入数据...');
            const text = await file.text();
            const records = JSON.parse(text);
            
            if (!Array.isArray(records)) {
                throw new Error('文件格式不正确');
            }
            
            if (!confirm(`即将导入 ${records.length} 条记录，确定继续吗？`)) {
                return;
            }
            
            let successCount = 0;
            let errorCount = 0;
            
            for (const record of records) {
                try {
                    await window.financeAPI.createRecord(record);
                    successCount++;
                } catch (error) {
                    console.error('导入记录失败:', error);
                    errorCount++;
                }
            }
            
            showAlert(`导入完成！成功: ${successCount} 条，失败: ${errorCount} 条`, 'success');
            
            // 重新加载数据
            await loadRecords();
            
        } catch (error) {
            console.error('导入失败:', error);
            showAlert('导入失败: ' + error.message, 'error');
        } finally {
            hideLoading();
        }
    };
    
    input.click();
}

// 高级搜索功能
function showSearch() {
    const modalHTML = `
        <div class="modal" id="searchModal">
            <div class="modal-content">
                <div class="modal-header">
                    <h3>🔍 高级搜索</h3>
                    <button class="btn-close" onclick="closeModal('searchModal')">×</button>
                </div>
                <div class="modal-body">
                    <div class="form-group">
                        <label class="form-label">关键词</label>
                        <input type="text" id="searchKeyword" class="form-input" placeholder="搜索备注或分类">
                    </div>
                    <div class="form-group">
                        <label class="form-label">金额范围</label>
                        <div style="display: flex; gap: 10px;">
                            <input type="number" id="searchMinAmount" class="form-input" placeholder="最小金额">
                            <input type="number" id="searchMaxAmount" class="form-input" placeholder="最大金额">
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">类型</label>
                        <select id="searchRecordType" class="form-input">
                            <option value="all">所有类型</option>
                            <option value="income">收入</option>
                            <option value="expense">支出</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">日期范围</label>
                        <div style="display: flex; gap: 10px;">
                            <input type="date" id="searchStartDate" class="form-input">
                            <input type="date" id="searchEndDate" class="form-input">
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">分类</label>
                        <select id="searchRecordCategory" class="form-input">
                            <option value="all">所有分类</option>
                            <option value="food">餐饮</option>
                            <option value="transport">交通</option>
                            <option value="shopping">购物</option>
                            <option value="entertainment">娱乐</option>
                            <option value="medical">医疗</option>
                            <option value="education">教育</option>
                            <option value="investment">投资</option>
                            <option value="other">其他</option>
                        </select>
                    </div>
                </div>
                <div class="modal-actions">
                    <button onclick="performAdvancedSearch()" class="btn-primary">搜索</button>
                    <button onclick="closeModal('searchModal')" class="btn-secondary">取消</button>
                </div>
            </div>
        </div>
    `;
    
    showModal('searchModal', modalHTML);
}

// 执行高级搜索
async function performAdvancedSearch() {
    try {
        const params = {
            search: document.getElementById('searchKeyword').value || undefined,
            type: document.getElementById('searchRecordType').value !== 'all' ? document.getElementById('searchRecordType').value : undefined,
            category: document.getElementById('searchRecordCategory').value !== 'all' ? document.getElementById('searchRecordCategory').value : undefined,
            startDate: document.getElementById('searchStartDate').value || undefined,
            endDate: document.getElementById('searchEndDate').value || undefined
        };
        
        // 清理空参数
        Object.keys(params).forEach(key => {
            if (params[key] === undefined) {
                delete params[key];
            }
        });
        
        showLoading('正在搜索...');
        const result = await window.financeAPI.getRecords(params);
        
        if (result.success) {
            const filteredRecords = result.data.records;
            displayRecords(filteredRecords);
            showAlert(`找到 ${filteredRecords.length} 条记录`, 'success');
            closeModal('searchModal');
        }
    } catch (error) {
        console.error('搜索失败:', error);
        showAlert('搜索失败: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

// 定期记录功能
function showRecurring() {
    showAlert(`定期记录功能开发中...\n\n计划功能：\n• 设置自动重复记录\n• 支持每日/每周/每月重复\n• 管理重复规则`, 'info');
}

// 数据清理功能
function showCleanup() {
    const modalHTML = `
        <div class="modal" id="cleanupModal">
            <div class="modal-content">
                <div class="modal-header">
                    <h3>🧹 数据清理</h3>
                    <button class="btn-close" onclick="closeModal('cleanupModal')">×</button>
                </div>
                <div class="modal-body">
                    <p style="margin-bottom: 20px; color: #7f8c8d;">请选择要清理的数据类型：</p>
                    
                    <div class="cleanup-option">
                        <label>
                            <input type="checkbox" id="cleanOldData" onchange="toggleCleanupOption('oldData')">
                            <strong>清理旧数据</strong>
                        </label>
                        <div id="oldDataOptions" style="margin-left: 20px; margin-top: 8px; display: none;">
                            <select id="cleanDays" class="form-input">
                                <option value="30">30天前</option>
                                <option value="90">90天前</option>
                                <option value="180">半年前</option>
                                <option value="365">一年前</option>
                            </select>
                        </div>
                    </div>
                    
                    <div class="cleanup-option" style="margin-top: 15px;">
                        <label>
                            <input type="checkbox" id="cleanByCategory" onchange="toggleCleanupOption('category')">
                            <strong>按分类清理</strong>
                        </label>
                        <div id="categoryOptions" style="margin-left: 20px; margin-top: 8px; display: none;">
                            <select id="cleanCategory" class="form-input">
                                <option value="food">餐饮</option>
                                <option value="transport">交通</option>
                                <option value="shopping">购物</option>
                                <option value="entertainment">娱乐</option>
                                <option value="medical">医疗</option>
                                <option value="education">教育</option>
                                <option value="investment">投资</option>
                                <option value="other">其他</option>
                            </select>
                        </div>
                    </div>
                    
                    <div class="cleanup-option" style="margin-top: 15px;">
                        <label>
                            <input type="checkbox" id="cleanByType">
                            <strong>按类型清理</strong>
                        </label>
                        <div style="margin-left: 20px; margin-top: 8px;">
                            <select id="cleanType" class="form-input">
                                <option value="expense">所有支出</option>
                                <option value="income">所有收入</option>
                            </select>
                        </div>
                    </div>
                </div>
                <div class="modal-actions">
                    <button onclick="performCleanup()" class="btn-danger">开始清理</button>
                    <button onclick="closeModal('cleanupModal')" class="btn-secondary">取消</button>
                </div>
            </div>
        </div>
    `;
    
    showModal('cleanupModal', modalHTML);
}

function toggleCleanupOption(type) {
    const optionsDiv = document.getElementById(type + 'Options');
    const checkbox = document.getElementById('clean' + type.charAt(0).toUpperCase() + type.slice(1));
    
    if (optionsDiv) {
        optionsDiv.style.display = checkbox.checked ? 'block' : 'none';
    }
}

async function performCleanup() {
    const cleanOldData = document.getElementById('cleanOldData').checked;
    const cleanByCategory = document.getElementById('cleanByCategory').checked;
    const cleanByType = document.getElementById('cleanByType').checked;
    
    if (!cleanOldData && !cleanByCategory && !cleanByType) {
        showAlert('请至少选择一个清理选项', 'warning');
        return;
    }
    
    if (!confirm('确定要执行数据清理吗？此操作不可恢复！')) {
        return;
    }
    
    try {
        showLoading('正在清理数据...');
        
        // 获取所有记录
        const result = await window.financeAPI.getRecords({ limit: 1000 });
        const allRecords = result.data.records;
        
        let recordsToDelete = [];
        const now = new Date();
        
        if (cleanOldData) {
            const days = parseInt(document.getElementById('cleanDays').value);
            const cutoffDate = new Date(now.setDate(now.getDate() - days)).toISOString().split('T')[0];
            
            recordsToDelete = recordsToDelete.concat(
                allRecords.filter(record => record.date < cutoffDate)
            );
        }
        
        if (cleanByCategory) {
            const category = document.getElementById('cleanCategory').value;
            recordsToDelete = recordsToDelete.concat(
                allRecords.filter(record => record.category === category)
            );
        }
        
        if (cleanByType) {
            const type = document.getElementById('cleanType').value;
            recordsToDelete = recordsToDelete.concat(
                allRecords.filter(record => record.type === type)
            );
        }
        
        // 去重
        const uniqueRecordsToDelete = Array.from(new Set(recordsToDelete.map(r => r.id)))
            .map(id => recordsToDelete.find(r => r.id === id));
        
        if (uniqueRecordsToDelete.length === 0) {
            showAlert('没有找到符合条件的数据', 'info');
            return;
        }
        
        // 批量删除
        let deletedCount = 0;
        for (const record of uniqueRecordsToDelete) {
            try {
                await window.financeAPI.deleteRecord(record.id);
                deletedCount++;
            } catch (error) {
                console.error('删除记录失败:', error);
            }
        }
        
        showAlert(`数据清理完成！删除了 ${deletedCount} 条记录`, 'success');
        closeModal('cleanupModal');
        
        // 重新加载数据
        await loadRecords();
        
    } catch (error) {
        console.error('数据清理失败:', error);
        showAlert('数据清理失败: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

// 详细统计功能
async function showStatistics() {
    try {
        showLoading('正在生成统计报告...');
        
        const currentYear = new Date().getFullYear();
        const result = await window.financeAPI.request(`/analytics/simple-overview?year=${currentYear}`);
        
        if (result.success) {
            const data = result.data;
            
            // 安全地处理数据，避免 null 或 undefined
            const safeData = {
                income: {
                    total: data.income?.total || 0,
                    count: data.income?.count || 0,
                    average: data.income?.average || 0
                },
                expense: {
                    total: data.expense?.total || 0,
                    count: data.expense?.count || 0,
                    average: data.expense?.average || 0
                },
                categories: data.categories || [],
                accounts: data.accounts || [],
                trend: data.trend || [],
                balance: data.balance || 0
            };
            
            const modalHTML = `
                <div class="modal" id="statisticsModal" style="max-width: 800px;">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h3>📊 详细统计报告 - ${currentYear}年</h3>
                            <button class="btn-close" onclick="closeModal('statisticsModal')">×</button>
                        </div>
                        <div class="modal-body" style="max-height: 60vh; overflow-y: auto;">
                            <div class="stat-section">
                                <h4>📈 年度概览</h4>
                                <div class="stats-grid" style="grid-template-columns: repeat(2, 1fr);">
                                    <div class="stat-card">
                                        <div class="stat-value income">¥${safeData.income.total.toFixed(2)}</div>
                                        <div class="stat-label">总收入 (${safeData.income.count}笔)</div>
                                    </div>
                                    <div class="stat-card">
                                        <div class="stat-value expense">¥${safeData.expense.total.toFixed(2)}</div>
                                        <div class="stat-label">总支出 (${safeData.expense.count}笔)</div>
                                    </div>
                                    <div class="stat-card">
                                        <div class="stat-value" style="color: ${safeData.balance >= 0 ? '#2ecc71' : '#e74c3c'}">
                                            ¥${safeData.balance.toFixed(2)}
                                        </div>
                                        <div class="stat-label">净收益</div>
                                    </div>
                                    <div class="stat-card">
                                        <div class="stat-value">${safeData.income.count + safeData.expense.count}</div>
                                        <div class="stat-label">总交易数</div>
                                    </div>
                                </div>
                            </div>
                            
                            ${safeData.categories.length > 0 ? `
                            <div class="stat-section" style="margin-top: 20px;">
                                <h4>🏷️ 支出分类TOP5</h4>
                                ${safeData.categories.slice(0, 5).map(cat => `
                                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #f1f1f1;">
                                        <span>${getCategoryName(cat._id || cat.category)}</span>
                                        <div style="display: flex; align-items: center; gap: 10px;">
                                            <span style="font-weight: bold; color: #e74c3c;">¥${(cat.total || 0).toFixed(2)}</span>
                                            <span style="color: #7f8c8d; font-size: 12px;">${cat.count || 0}笔</span>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                            ` : `
                            <div class="stat-section" style="margin-top: 20px;">
                                <h4>🏷️ 支出分类</h4>
                                <p style="text-align: center; color: #7f8c8d; padding: 20px;">暂无分类数据</p>
                            </div>
                            `}
                            
                            ${safeData.accounts.length > 0 ? `
                            <div class="stat-section" style="margin-top: 20px;">
                                <h4>💳 账户使用情况</h4>
                                ${safeData.accounts.map(acc => `
                                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #f1f1f1;">
                                        <span>${getAccountName(acc._id || acc.account)}</span>
                                        <div style="display: flex; align-items: center; gap: 10px;">
                                            <span style="font-weight: bold; color: #3498db;">¥${(acc.total || 0).toFixed(2)}</span>
                                            <span style="color: #7f8c8d; font-size: 12px;">${acc.count || 0}笔</span>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                            ` : `
                            <div class="stat-section" style="margin-top: 20px;">
                                <h4>💳 账户使用情况</h4>
                                <p style="text-align: center; color: #7f8c8d; padding: 20px;">暂无账户数据</p>
                            </div>
                            `}
                            
                            ${safeData.trend.length > 0 ? `
                            <div class="stat-section" style="margin-top: 20px;">
                                <h4>📅 月度趋势</h4>
                                <div style="background: #f8f9fa; padding: 15px; border-radius: 8px;">
                                    ${safeData.trend.map(item => {
                                        const month = item._id?.month || '未知';
                                        const type = item._id?.type || 'unknown';
                                        const total = item.total || 0;
                                        return `
                                            <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                                                <span>${month}月 ${type === 'income' ? '收入' : type === 'expense' ? '支出' : '未知'}</span>
                                                <span style="color: ${type === 'income' ? '#2ecc71' : '#e74c3c'}; font-weight: bold;">
                                                    ¥${total.toFixed(2)}
                                                </span>
                                            </div>
                                        `;
                                    }).join('')}
                                </div>
                            </div>
                            ` : `
                            <div class="stat-section" style="margin-top: 20px;">
                                <h4>📅 月度趋势</h4>
                                <p style="text-align: center; color: #7f8c8d; padding: 20px;">暂无趋势数据</p>
                            </div>
                            `}
                            
                            <!-- 月度详细统计 -->
                            <div class="stat-section" style="margin-top: 20px;">
                                <h4>📋 月度详细数据</h4>
                                <div style="overflow-x: auto;">
                                    <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                                        <thead>
                                            <tr style="background: #f8f9fa;">
                                                <th style="padding: 10px; text-align: left; border-bottom: 1px solid #e1e8ed;">月份</th>
                                                <th style="padding: 10px; text-align: right; border-bottom: 1px solid #e1e8ed;">收入</th>
                                                <th style="padding: 10px; text-align: right; border-bottom: 1px solid #e1e8ed;">支出</th>
                                                <th style="padding: 10px; text-align: right; border-bottom: 1px solid #e1e8ed;">结余</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            ${generateMonthlyTable(safeData)}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                        <div class="modal-actions">
                            <button onclick="exportStatistics()" class="btn-primary">导出报告</button>
                            <button onclick="closeModal('statisticsModal')" class="btn-secondary">关闭</button>
                        </div>
                    </div>
                </div>
            `;
            
            showModal('statisticsModal', modalHTML);
        } else {
            throw new Error(result.message || '获取统计数据失败');
        }
    } catch (error) {
        console.error('生成统计报告失败:', error);
        showAlert('生成统计报告失败: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

// 生成月度数据表格
function generateMonthlyTable(data) {
    const currentYear = new Date().getFullYear();
    let html = '';
    
    for (let month = 1; month <= 12; month++) {
        const monthKey = `${currentYear}-${month.toString().padStart(2, '0')}`;
        const monthRecords = allRecords.filter(record => record.date.startsWith(monthKey));
        
        const income = monthRecords.filter(r => r.type === 'income').reduce((sum, r) => sum + (r.amount || 0), 0);
        const expense = monthRecords.filter(r => r.type === 'expense').reduce((sum, r) => sum + (r.amount || 0), 0);
        const balance = income - expense;
        
        html += `
            <tr>
                <td style="padding: 8px 10px; border-bottom: 1px solid #f1f1f1;">${month}月</td>
                <td style="padding: 8px 10px; border-bottom: 1px solid #f1f1f1; text-align: right; color: #2ecc71; font-weight: bold;">
                    ¥${income.toFixed(2)}
                </td>
                <td style="padding: 8px 10px; border-bottom: 1px solid #f1f1f1; text-align: right; color: #e74c3c; font-weight: bold;">
                    ¥${expense.toFixed(2)}
                </td>
                <td style="padding: 8px 10px; border-bottom: 1px solid #f1f1f1; text-align: right; color: ${balance >= 0 ? '#2ecc71' : '#e74c3c'}; font-weight: bold;">
                    ¥${balance.toFixed(2)}
                </td>
            </tr>
        `;
    }
    
    // 年度总计
    const totalIncome = allRecords.filter(r => r.type === 'income').reduce((sum, r) => sum + (r.amount || 0), 0);
    const totalExpense = allRecords.filter(r => r.type === 'expense').reduce((sum, r) => sum + (r.amount || 0), 0);
    const totalBalance = totalIncome - totalExpense;
    
    html += `
        <tr style="background: #f8f9fa; font-weight: bold;">
            <td style="padding: 10px; border-top: 2px solid #e1e8ed;">年度总计</td>
            <td style="padding: 10px; border-top: 2px solid #e1e8ed; text-align: right; color: #2ecc71;">
                ¥${totalIncome.toFixed(2)}
            </td>
            <td style="padding: 10px; border-top: 2px solid #e1e8ed; text-align: right; color: #e74c3c;">
                ¥${totalExpense.toFixed(2)}
            </td>
            <td style="padding: 10px; border-top: 2px solid #e1e8ed; text-align: right; color: ${totalBalance >= 0 ? '#2ecc71' : '#e74c3c'};">
                ¥${totalBalance.toFixed(2)}
            </td>
        </tr>
    `;
    
    return html;
}

function exportStatistics() {
    showAlert('统计报告导出功能开发中...', 'info');
}

// ==================== 模态框工具函数 ====================

function showModal(modalId, html) {
    let modalsContainer = document.getElementById('modalsContainer');
    if (!modalsContainer) {
        modalsContainer = document.createElement('div');
        modalsContainer.id = 'modalsContainer';
        document.body.appendChild(modalsContainer);
    }
    
    // 移除已存在的同名模态框
    const existingModal = document.getElementById(modalId);
    if (existingModal) {
        existingModal.remove();
    }
    
    modalsContainer.innerHTML += html;
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.remove();
    }
}
