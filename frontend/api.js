// frontend/api.js - 确保这个文件正确
class FinanceAPI {
    constructor() {
        this.baseURL = this.getBaseURL();
        this.token = localStorage.getItem('authToken');
        this.user = JSON.parse(localStorage.getItem('user') || 'null');
    }

    getBaseURL() {
        return 'http://localhost:5000/api';
    }

    setToken(token) {
        this.token = token;
        localStorage.setItem('authToken', token);
    }

    setUser(user) {
        this.user = user;
        localStorage.setItem('user', JSON.stringify(user));
    }

    getHeaders() {
        const headers = {
            'Content-Type': 'application/json'
        };
        
        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }
        
        return headers;
    }

    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const config = {
            headers: this.getHeaders(),
            ...options
        };

        try {
            const response = await fetch(url, config);
            const data = await response.json();

            if (!response.ok) {
                if (response.status === 401) {
                    this.logout();
                    window.location.href = 'login.html';
                }
                throw new Error(data.message || '请求失败');
            }

            return data;
        } catch (error) {
            console.error('API请求错误:', error);
            throw error;
        }
    }

    logout() {
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
        this.token = null;
        this.user = null;
    }

    // 认证相关
    async login(credentials) {
        const result = await this.request('/auth/login', {
            method: 'POST',
            body: JSON.stringify(credentials)
        });
        
        if (result.success) {
            this.setToken(result.data.token);
            this.setUser(result.data.user);
        }
        
        return result;
    }

    async register(userData) {
        const result = await this.request('/auth/register', {
            method: 'POST',
            body: JSON.stringify(userData)
        });
        
        if (result.success) {
            this.setToken(result.data.token);
            this.setUser(result.data.user);
        }
        
        return result;
    }

    async getProfile() {
        return this.request('/auth/me');
    }

    // 记录相关
    async getRecords(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        return this.request(`/records?${queryString}`);
    }

    async createRecord(recordData) {
        return this.request('/records', {
            method: 'POST',
            body: JSON.stringify(recordData)
        });
    }

    async updateRecord(id, recordData) {
        return this.request(`/records/${id}`, {
            method: 'PUT',
            body: JSON.stringify(recordData)
        });
    }

    async deleteRecord(id) {
        return this.request(`/records/${id}`, {
            method: 'DELETE'
        });
    }

    // 预算相关
    async getBudgetUsage(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        return this.request(`/budgets/usage?${queryString}`);
   }

    async deleteBudget(id) {
        return this.request(`/budgets/${id}`, {
            method: 'DELETE'
        });
   }
    async setBudget(budgetData) {
        return this.request('/budgets', {
            method: 'POST',
            body: JSON.stringify(budgetData)
        });
    }

    // 统计相关
    async getOverview(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        return this.request(`/analytics/overview?${queryString}`);
    }
}

// 创建全局API实例
window.financeAPI = new FinanceAPI();