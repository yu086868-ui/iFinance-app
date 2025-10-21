// backend/seed-data.js
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');

const db = new sqlite3.Database('./finance.db');

async function createSampleData() {
    console.log('开始创建样例数据...');

    // 创建测试用户
    const hashedPassword = await bcrypt.hash('123456', 12);
    
    db.run(
        `INSERT OR IGNORE INTO users (username, email, password, currency, monthly_budget) 
         VALUES (?, ?, ?, ?, ?)`,
        ['testuser', 'test@example.com', hashedPassword, 'CNY', 3000],
        function(err) {
            if (err) {
                console.error('创建用户失败:', err);
                return;
            }
            
            const userId = this.lastID;
            console.log('✅ 创建测试用户成功, ID:', userId);
            
            // 创建样例记录
            const sampleRecords = [
                // 收入记录
                { type: 'income', amount: 8000, category: 'salary', account: 'bank', date: '2024-10-01', note: '工资收入' },
                { type: 'income', amount: 500, category: 'investment', account: 'alipay', date: '2024-10-05', note: '理财收益' },
                { type: 'income', amount: 300, category: 'other', account: 'wechat', date: '2024-10-10', note: '兼职收入' },
                
                // 支出记录 - 餐饮
                { type: 'expense', amount: 35, category: 'food', account: 'alipay', date: '2024-10-01', note: '早餐' },
                { type: 'expense', amount: 48, category: 'food', account: 'wechat', date: '2024-10-01', note: '午餐' },
                { type: 'expense', amount: 65, category: 'food', account: 'alipay', date: '2024-10-01', note: '晚餐' },
                { type: 'expense', amount: 120, category: 'food', account: 'cash', date: '2024-10-02', note: '周末聚餐' },
                { type: 'expense', amount: 85, category: 'food', account: 'alipay', date: '2024-10-03', note: '外卖' },
                { type: 'expense', amount: 25, category: 'food', account: 'wechat', date: '2024-10-04', note: '咖啡' },
                
                // 交通
                { type: 'expense', amount: 8, category: 'transport', account: 'alipay', date: '2024-10-02', note: '地铁' },
                { type: 'expense', amount: 25, category: 'transport', account: 'wechat', date: '2024-10-03', note: '打车' },
                { type: 'expense', amount: 150, category: 'transport', account: 'bank', date: '2024-10-05', note: '加油' },
                { type: 'expense', amount: 5, category: 'transport', account: 'alipay', date: '2024-10-06', note: '公交' },
                
                // 购物
                { type: 'expense', amount: 299, category: 'shopping', account: 'credit', date: '2024-10-04', note: '衣服' },
                { type: 'expense', amount: 89, category: 'shopping', account: 'alipay', date: '2024-10-05', note: '日用品' },
                { type: 'expense', amount: 1599, category: 'shopping', account: 'credit', date: '2024-10-07', note: '电子产品' },
                
                // 娱乐
                { type: 'expense', amount: 45, category: 'entertainment', account: 'wechat', date: '2024-10-06', note: '电影票' },
                { type: 'expense', amount: 180, category: 'entertainment', account: 'alipay', date: '2024-10-08', note: 'KTV' },
                { type: 'expense', amount: 320, category: 'entertainment', account: 'bank', date: '2024-10-10', note: '游乐场' },
                
                // 医疗
                { type: 'expense', amount: 68, category: 'medical', account: 'alipay', date: '2024-10-03', note: '买药' },
                { type: 'expense', amount: 200, category: 'medical', account: 'bank', date: '2024-10-09', note: '体检' },
                
                // 教育
                { type: 'expense', amount: 299, category: 'education', account: 'alipay', date: '2024-10-02', note: '在线课程' },
                { type: 'expense', amount: 150, category: 'education', account: 'wechat', date: '2024-10-05', note: '书籍' },
                
                // 其他
                { type: 'expense', amount: 50, category: 'other', account: 'cash', date: '2024-10-04', note: '捐款' },
                { type: 'expense', amount: 35, category: 'other', account: 'alipay', date: '2024-10-07', note: '快递费' }
            ];

            let insertedCount = 0;
            sampleRecords.forEach(record => {
                db.run(
                    `INSERT INTO records 
                     (user_id, type, amount, currency, category, account, date, note) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                    [userId, record.type, record.amount, 'CNY', record.category, record.account, record.date, record.note],
                    function(err) {
                        if (err) {
                            console.error('插入记录失败:', err);
                        } else {
                            insertedCount++;
                        }
                        
                        // 所有记录插入完成后显示统计
                        if (insertedCount === sampleRecords.length) {
                            console.log(`✅ 成功创建 ${insertedCount} 条样例记录`);
                            
                            // 创建预算数据
                            const sampleBudgets = [
                                { category: 'food', amount: 1000 },
                                { category: 'transport', amount: 500 },
                                { category: 'shopping', amount: 800 },
                                { category: 'entertainment', amount: 300 },
                                { category: 'medical', amount: 200 },
                                { category: 'education', amount: 400 }
                            ];

                            let budgetCount = 0;
                            const currentYear = new Date().getFullYear();
                            const currentMonth = new Date().getMonth() + 1;

                            sampleBudgets.forEach(budget => {
                                db.run(
                                    `INSERT OR REPLACE INTO budgets 
                                     (user_id, category, amount, period, year, month) 
                                     VALUES (?, ?, ?, ?, ?, ?)`,
                                    [userId, budget.category, budget.amount, 'monthly', currentYear, currentMonth],
                                    function(err) {
                                        if (err) {
                                            console.error('创建预算失败:', err);
                                        } else {
                                            budgetCount++;
                                        }
                                        
                                        if (budgetCount === sampleBudgets.length) {
                                            console.log(`✅ 成功创建 ${budgetCount} 个预算设置`);
                                            console.log('🎉 样例数据创建完成！');
                                            console.log('📝 测试账号: test@example.com / 123456');
                                            db.close();
                                        }
                                    }
                                );
                            });
                        }
                    }
                );
            });
        }
    );
}

// 运行创建脚本
createSampleData().catch(console.error);