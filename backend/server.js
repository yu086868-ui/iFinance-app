const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();

// 中间件
app.use(cors({
    origin: ['http://localhost:8000', 'http://127.0.0.1:8000', 'http://localhost:3000'],
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// SQLite 数据库连接
const db = new sqlite3.Database('./finance.db', (err) => {
    if (err) {
        console.error('❌ 数据库连接失败:', err.message);
    } else {
        console.log('✅ 已连接到 SQLite 数据库');
        initializeDatabase();
    }
});

// 初始化数据库表
function initializeDatabase() {
    // 用户表
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        currency TEXT DEFAULT 'CNY',
        monthly_budget REAL DEFAULT 0,
        preferences TEXT DEFAULT '{}',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // 记录表
    db.run(`CREATE TABLE IF NOT EXISTS records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
        amount REAL NOT NULL,
        currency TEXT DEFAULT 'CNY',
        category TEXT NOT NULL,
        account TEXT NOT NULL,
        date TEXT NOT NULL,
        note TEXT,
        tags TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
    )`);

    // 预算表
    db.run(`CREATE TABLE IF NOT EXISTS budgets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        category TEXT NOT NULL,
        amount REAL NOT NULL,
        period TEXT DEFAULT 'monthly',
        year INTEGER,
        month INTEGER,
        alerts_enabled BOOLEAN DEFAULT 1,
        threshold INTEGER DEFAULT 80,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id),
        UNIQUE(user_id, category, year, month)
    )`);

    console.log('✅ 数据库表初始化完成');
}

// JWT 中间件
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({
            success: false,
            message: '访问被拒绝，请先登录'
        });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(403).json({
            success: false,
            message: 'Token 无效'
        });
    }
};

// 健康检查
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        database: 'SQLite'
    });
});

// 用户注册
app.post('/api/auth/register', async (req, res) => {
    try {
        const { username, email, password, currency = 'CNY' } = req.body;

        if (!username || !email || !password) {
            return res.status(400).json({
                success: false,
                message: '请填写所有必填字段'
            });
        }

        // 检查用户是否已存在
        db.get(
            'SELECT id FROM users WHERE username = ? OR email = ?',
            [username, email],
            async (err, row) => {
                if (err) {
                    return res.status(500).json({
                        success: false,
                        message: '数据库错误',
                        error: err.message
                    });
                }

                if (row) {
                    return res.status(400).json({
                        success: false,
                        message: '用户名或邮箱已存在'
                    });
                }

                // 加密密码
                const hashedPassword = await bcrypt.hash(password, 12);

                // 创建用户
                db.run(
                    'INSERT INTO users (username, email, password, currency) VALUES (?, ?, ?, ?)',
                    [username, email, hashedPassword, currency],
                    function(err) {
                        if (err) {
                            return res.status(500).json({
                                success: false,
                                message: '注册失败',
                                error: err.message
                            });
                        }

                        // 生成 JWT token
                        const token = jwt.sign(
                            { id: this.lastID, username },
                            process.env.JWT_SECRET || 'fallback_secret',
                            { expiresIn: process.env.JWT_EXPIRE || '30d' }
                        );

                        res.status(201).json({
                            success: true,
                            message: '注册成功',
                            data: {
                                user: {
                                    id: this.lastID,
                                    username,
                                    email,
                                    currency
                                },
                                token
                            }
                        });
                    }
                );
            }
        );
    } catch (error) {
        res.status(500).json({
            success: false,
            message: '服务器错误',
            error: error.message
        });
    }
});

// 用户登录
app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({
            success: false,
            message: '请输入邮箱和密码'
        });
    }

    db.get(
        'SELECT * FROM users WHERE email = ?',
        [email],
        async (err, user) => {
            if (err) {
                return res.status(500).json({
                    success: false,
                    message: '数据库错误',
                    error: err.message
                });
            }

            if (!user) {
                return res.status(401).json({
                    success: false,
                    message: '邮箱或密码错误'
                });
            }

            // 验证密码
            const validPassword = await bcrypt.compare(password, user.password);
            if (!validPassword) {
                return res.status(401).json({
                    success: false,
                    message: '邮箱或密码错误'
                });
            }

            // 生成 JWT token
            const token = jwt.sign(
                { id: user.id, username: user.username },
                process.env.JWT_SECRET || 'fallback_secret',
                { expiresIn: process.env.JWT_EXPIRE || '30d' }
            );

            res.json({
                success: true,
                message: '登录成功',
                data: {
                    user: {
                        id: user.id,
                        username: user.username,
                        email: user.email,
                        currency: user.currency,
                        monthlyBudget: user.monthly_budget,
                        preferences: JSON.parse(user.preferences || '{}')
                    },
                    token
                }
            });
        }
    );
});

// 获取当前用户信息
app.get('/api/auth/me', authenticateToken, (req, res) => {
    db.get(
        'SELECT id, username, email, currency, monthly_budget, preferences FROM users WHERE id = ?',
        [req.user.id],
        (err, user) => {
            if (err) {
                return res.status(500).json({
                    success: false,
                    message: '数据库错误',
                    error: err.message
                });
            }

            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: '用户不存在'
                });
            }

            res.json({
                success: true,
                data: {
                    user: {
                        ...user,
                        preferences: JSON.parse(user.preferences || '{}')
                    }
                }
            });
        }
    );
});

// 获取记录列表
app.get('/api/records', authenticateToken, (req, res) => {
    const {
        page = 1,
        limit = 100,
        type,
        category,
        account,
        startDate,
        endDate,
        search
    } = req.query;

    let query = 'SELECT * FROM records WHERE user_id = ?';
    let params = [req.user.id];

    if (type) {
        query += ' AND type = ?';
        params.push(type);
    }
    if (category) {
        query += ' AND category = ?';
        params.push(category);
    }
    if (account) {
        query += ' AND account = ?';
        params.push(account);
    }
    if (startDate) {
        query += ' AND date >= ?';
        params.push(startDate);
    }
    if (endDate) {
        query += ' AND date <= ?';
        params.push(endDate);
    }
    if (search) {
        query += ' AND (note LIKE ? OR category LIKE ?)';
        const searchTerm = `%${search}%`;
        params.push(searchTerm, searchTerm);
    }

    query += ' ORDER BY date DESC, created_at DESC LIMIT ? OFFSET ?';
    const offset = (page - 1) * limit;
    params.push(parseInt(limit), offset);

    db.all(query, params, (err, records) => {
        if (err) {
            return res.status(500).json({
                success: false,
                message: '获取记录失败',
                error: err.message
            });
        }

        console.log(`✅ 返回 ${records.length} 条记录`); // 添加日志

        res.json({
            success: true,
            data: {
                records: records,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: records.length,
                    pages: 1
                }
            }
        });
    });
});

// 创建记录
app.post('/api/records', authenticateToken, (req, res) => {
    const {
        type,
        amount,
        currency = 'CNY',
        category,
        account,
        date,
        note = ''
    } = req.body;

    if (!type || !amount || !category || !account || !date) {
        return res.status(400).json({
            success: false,
            message: '请填写所有必填字段'
        });
    }

    if (amount <= 0) {
        return res.status(400).json({
            success: false,
            message: '金额必须大于0'
        });
    }

    db.run(
        `INSERT INTO records 
         (user_id, type, amount, currency, category, account, date, note) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [req.user.id, type, amount, currency, category, account, date, note],
        function(err) {
            if (err) {
                return res.status(500).json({
                    success: false,
                    message: '创建记录失败',
                    error: err.message
                });
            }

            res.status(201).json({
                success: true,
                message: '记录创建成功',
                data: { id: this.lastID }
            });
        }
    );
});

// 删除记录
app.delete('/api/records/:id', authenticateToken, (req, res) => {
    const { id } = req.params;

    db.run(
        'DELETE FROM records WHERE id = ? AND user_id = ?',
        [id, req.user.id],
        function(err) {
            if (err) {
                return res.status(500).json({
                    success: false,
                    message: '删除记录失败',
                    error: err.message
                });
            }

            if (this.changes === 0) {
                return res.status(404).json({
                    success: false,
                    message: '记录不存在'
                });
            }

            res.json({
                success: true,
                message: '记录删除成功'
            });
        }
    );
});

// 修复统计接口 - 在 server.js 的路由部分添加
app.get('/api/analytics/simple-overview', authenticateToken, (req, res) => {
    const { year } = req.query;
    const currentYear = year || new Date().getFullYear();
    
    // 构建查询条件
    const startDate = `${currentYear}-01-01`;
    const endDate = `${currentYear}-12-31`;
    
    // 获取收入统计
    db.get(
        `SELECT 
            COALESCE(SUM(amount), 0) as total,
            COALESCE(COUNT(*), 0) as count
         FROM records 
         WHERE user_id = ? AND type = 'income' AND date BETWEEN ? AND ?`,
        [req.user.id, startDate, endDate],
        (err, incomeStats) => {
            if (err) {
                return res.status(500).json({
                    success: false,
                    message: '获取收入统计失败',
                    error: err.message
                });
            }

            // 获取支出统计
            db.get(
                `SELECT 
                    COALESCE(SUM(amount), 0) as total,
                    COALESCE(COUNT(*), 0) as count
                 FROM records 
                 WHERE user_id = ? AND type = 'expense' AND date BETWEEN ? AND ?`,
                [req.user.id, startDate, endDate],
                (err, expenseStats) => {
                    if (err) {
                        return res.status(500).json({
                            success: false,
                            message: '获取支出统计失败',
                            error: err.message
                        });
                    }

                    // 获取分类统计
                    db.all(
                        `SELECT 
                            category,
                            COALESCE(SUM(amount), 0) as total,
                            COALESCE(COUNT(*), 0) as count
                         FROM records 
                         WHERE user_id = ? AND type = 'expense' AND date BETWEEN ? AND ?
                         GROUP BY category
                         ORDER BY total DESC`,
                        [req.user.id, startDate, endDate],
                        (err, categoryStats) => {
                            if (err) {
                                return res.status(500).json({
                                    success: false,
                                    message: '获取分类统计失败',
                                    error: err.message
                                });
                            }

                            // 获取账户统计
                            db.all(
                                `SELECT 
                                    account,
                                    COALESCE(SUM(amount), 0) as total,
                                    COALESCE(COUNT(*), 0) as count
                                 FROM records 
                                 WHERE user_id = ? AND type = 'expense' AND date BETWEEN ? AND ?
                                 GROUP BY account`,
                                [req.user.id, startDate, endDate],
                                (err, accountStats) => {
                                    if (err) {
                                        return res.status(500).json({
                                            success: false,
                                            message: '获取账户统计失败',
                                            error: err.message
                                        });
                                    }

                                    res.json({
                                        success: true,
                                        data: {
                                            income: incomeStats || { total: 0, count: 0 },
                                            expense: expenseStats || { total: 0, count: 0 },
                                            categories: categoryStats || [],
                                            accounts: accountStats || [],
                                            trend: [], // 简化处理，不包含趋势数据
                                            balance: (incomeStats?.total || 0) - (expenseStats?.total || 0)
                                        }
                                    });
                                }
                            );
                        }
                    );
                }
            );
        }
    );
});

// ==================== 预算管理 API ====================

// 获取用户预算列表
app.get('/api/budgets', authenticateToken, (req, res) => {
    const { year, month } = req.query;
    const currentYear = year || new Date().getFullYear();
    const currentMonth = month || new Date().getMonth() + 1;

    let query = 'SELECT * FROM budgets WHERE user_id = ?';
    let params = [req.user.id];

    if (year && month) {
        query += ' AND year = ? AND month = ?';
        params.push(parseInt(year), parseInt(month));
    } else if (year) {
        query += ' AND year = ?';
        params.push(parseInt(year));
    }

    query += ' ORDER BY year DESC, month DESC, category ASC';

    db.all(query, params, (err, budgets) => {
        if (err) {
            console.error('获取预算失败:', err);
            return res.status(500).json({
                success: false,
                message: '获取预算失败',
                error: err.message
            });
        }

        res.json({
            success: true,
            data: { budgets }
        });
    });
});

// 设置预算
app.post('/api/budgets', authenticateToken, (req, res) => {
    const { category, amount, period = 'monthly', year, month } = req.body;

    if (!category || !amount || amount <= 0) {
        return res.status(400).json({
            success: false,
            message: '请提供有效的分类和金额'
        });
    }

    const currentYear = year || new Date().getFullYear();
    const currentMonth = period === 'monthly' ? (month || new Date().getMonth() + 1) : null;

    // 检查是否已存在相同分类的预算
    const checkQuery = 'SELECT id FROM budgets WHERE user_id = ? AND category = ? AND year = ? AND month = ?';
    
    db.get(checkQuery, [req.user.id, category, currentYear, currentMonth], (err, existing) => {
        if (err) {
            return res.status(500).json({
                success: false,
                message: '检查预算失败',
                error: err.message
            });
        }

        if (existing) {
            // 更新现有预算
            db.run(
                'UPDATE budgets SET amount = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [amount, existing.id],
                function(err) {
                    if (err) {
                        return res.status(500).json({
                            success: false,
                            message: '更新预算失败',
                            error: err.message
                        });
                    }

                    res.json({
                        success: true,
                        message: '预算更新成功'
                    });
                }
            );
        } else {
            // 创建新预算
            db.run(
                `INSERT INTO budgets (user_id, category, amount, period, year, month) 
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [req.user.id, category, amount, period, currentYear, currentMonth],
                function(err) {
                    if (err) {
                        return res.status(500).json({
                            success: false,
                            message: '设置预算失败',
                            error: err.message
                        });
                    }

                    res.json({
                        success: true,
                        message: '预算设置成功',
                        data: { id: this.lastID }
                    });
                }
            );
        }
    });
});

// 删除预算
app.delete('/api/budgets/:id', authenticateToken, (req, res) => {
    const { id } = req.params;

    db.run(
        'DELETE FROM budgets WHERE id = ? AND user_id = ?',
        [id, req.user.id],
        function(err) {
            if (err) {
                return res.status(500).json({
                    success: false,
                    message: '删除预算失败',
                    error: err.message
                });
            }

            if (this.changes === 0) {
                return res.status(404).json({
                    success: false,
                    message: '预算不存在'
                });
            }

            res.json({
                success: true,
                message: '预算删除成功'
            });
        }
    );
});

// 获取预算使用情况统计
app.get('/api/budgets/usage', authenticateToken, (req, res) => {
    const { year, month } = req.query;
    const currentYear = year || new Date().getFullYear();
    const currentMonth = month || new Date().getMonth() + 1;
    const startDate = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;
    const endDate = new Date(currentYear, currentMonth, 0).toISOString().split('T')[0];

    // 获取预算列表
    db.all(
        'SELECT * FROM budgets WHERE user_id = ? AND year = ? AND month = ?',
        [req.user.id, currentYear, currentMonth],
        (err, budgets) => {
            if (err) {
                return res.status(500).json({
                    success: false,
                    message: '获取预算失败',
                    error: err.message
                });
            }

            // 获取各分类的实际支出
            db.all(
                `SELECT category, SUM(amount) as actual_amount 
                 FROM records 
                 WHERE user_id = ? AND type = 'expense' AND date BETWEEN ? AND ?
                 GROUP BY category`,
                [req.user.id, startDate, endDate],
                (err, expenses) => {
                    if (err) {
                        return res.status(500).json({
                            success: false,
                            message: '获取支出数据失败',
                            error: err.message
                        });
                    }

                    const expenseMap = {};
                    expenses.forEach(expense => {
                        expenseMap[expense.category] = expense.actual_amount;
                    });

                    // 合并预算和实际支出数据
                    const budgetUsage = budgets.map(budget => {
                        const actual = expenseMap[budget.category] || 0;
                        const remaining = budget.amount - actual;
                        const usagePercent = budget.amount > 0 ? (actual / budget.amount) * 100 : 0;

                        return {
                            ...budget,
                            actual_amount: actual,
                            remaining_amount: remaining,
                            usage_percent: usagePercent,
                            is_over_budget: remaining < 0
                        };
                    });

                    res.json({
                        success: true,
                        data: {
                            budgets: budgetUsage,
                            summary: {
                                total_budget: budgets.reduce((sum, b) => sum + b.amount, 0),
                                total_actual: expenses.reduce((sum, e) => sum + e.actual_amount, 0),
                                total_remaining: budgets.reduce((sum, b) => sum + b.amount, 0) - expenses.reduce((sum, e) => sum + e.actual_amount, 0)
                            }
                        }
                    });
                }
            );
        }
    );
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 SQLite 后端服务运行在 http://localhost:${PORT}`);
    console.log(`📊 数据库: SQLite (finance.db)`);
});