# 使用者網站整合指南

本文檔說明如何將外部使用者網站與 CSMS 後端 API 整合。

## 📋 整合概述

CSMS 系統支援兩種前端應用：
1. **管理後台** (http://localhost:7500) - 使用 Cookie 認證
2. **使用者網站** (您的外部網站) - 使用 Bearer Token 認證

兩者使用**同一套 API**，通過 `role` 欄位區分權限。

---

## 🔐 認證流程

### ⚠️ 重要：選擇正確的登入方式

- **👤 使用者**（充電用戶）→ 使用 `POST /api/auth/thirdparty`（手機/Google/Facebook 等，無需密碼）
- **👨‍💼 管理者**（系統管理員）→ 使用 `POST /api/auth/login`（Email + 密碼，僅限 admin 角色）

---

### 1A. 使用者登入 - 第三方登入（推薦）

**端點**: `POST /api/auth/thirdparty`

**支援的登入方式**:
- `phone` - 手機號碼登入
- `google` - Google 帳號登入
- `facebook` - Facebook 帳號登入
- `line` - Line 帳號登入
- `apple` - Apple ID 登入

#### 手機號碼登入範例

**請求範例**:
```javascript
const response = await fetch('http://localhost:7500/api/auth/thirdparty', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    provider: 'phone',
    phone: '0912345678',
    firstName: '小明',  // 可選
    lastName: '王'      // 可選
  })
});

const data = await response.json();
```

#### Google 登入範例

```javascript
const response = await fetch('http://localhost:7500/api/auth/thirdparty', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    provider: 'google',
    email: 'user@gmail.com',
    providerUserId: 'google_user_id_12345',  // 可選
    firstName: 'John',
    lastName: 'Doe'
  })
});

const data = await response.json();
```

**響應範例**:
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid-here",
    "phone": "0912345678",
    "email": "user@example.com",
    "role": "user",
    "firstName": "John",
    "lastName": "Doe",
    "provider": "phone"
  }
}
```

**自動註冊機制**:
- ✅ 首次登入自動創建新用戶
- ✅ 無需額外的註冊流程
- ✅ 再次登入會找到現有用戶

**安全性提醒**:
- ⚠️ 建議在前端完成第三方平台的身份驗證（例如 Google OAuth、簡訊 OTP）後再呼叫
- ⚠️ 生產環境建議配合 Rate Limiting 防止暴力破解
- ⚠️ 僅用於 `role='user'` 的一般使用者，管理者無法使用

---

### 1B. 管理者登入（Email + 密碼）

**端點**: `POST /api/auth/login`

**僅限角色**: `admin`, `super_admin`

**請求範例**:
```javascript
const response = await fetch('http://localhost:7500/api/auth/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    email: 'admin@example.com',
    password: 'password123'
  })
});

const data = await response.json();
```

**響應範例**:
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid-here",
    "email": "user@example.com",
    "role": "user",
    "firstName": "John",
    "lastName": "Doe"
  }
}
```

**儲存 Token**:
```javascript
if (data.success) {
  // 儲存 token 到 localStorage
  localStorage.setItem('authToken', data.token);
  localStorage.setItem('user', JSON.stringify(data.user));
  
  // 或使用 sessionStorage（關閉瀏覽器後清除）
  // sessionStorage.setItem('authToken', data.token);
}
```

---

### 2. 使用 Token 訪問 API

所有需要認證的請求都需要在 Header 中帶上 token：

```javascript
const token = localStorage.getItem('authToken');

const response = await fetch('http://localhost:7500/api/user/profile', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});

const data = await response.json();
```

---

### 3. 登出

**端點**: `POST /api/auth/logout`

```javascript
const token = localStorage.getItem('authToken');

await fetch('http://localhost:7500/api/auth/logout', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

// 清除本地儲存
localStorage.removeItem('authToken');
localStorage.removeItem('user');
```

---

## 📡 可用的 API 端點

### 🔐 認證相關

| 端點 | 方法 | 說明 | 適用對象 | 需要認證 |
|------|------|------|----------|----------|
| `/api/auth/thirdparty` | POST | 統一第三方登入（phone/google/facebook/line/apple） | 👤 使用者 | ❌ |
| `/api/auth/login` | POST | Email + 密碼登入 | 👨‍💼 管理者 (admin/super_admin) | ❌ |
| `/api/auth/logout` | POST | 登出 | 全部 | ✅ |
| `/api/auth/clear-session` | POST/GET | 清除會話 | 全部 | ❌ |

### 👤 用戶相關

| 端點 | 方法 | 說明 | 權限 |
|------|------|------|------|
| `/api/user/profile` | GET | 獲取個人資料 | user/admin |
| `/api/user/profile` | PATCH | 更新個人資料 | user/admin |
| `/api/users/[id]/wallet` | GET | 獲取錢包資訊 | 本人/admin |
| `/api/users/[id]/transactions` | GET | 獲取交易記錄 | 本人/admin |
| `/api/users/[id]/cards` | GET | 獲取 RFID 卡片列表 | 本人/admin |

### 💳 錢包相關

| 端點 | 方法 | 說明 | 權限 |
|------|------|------|------|
| `/api/wallet/topup` | POST | 錢包儲值 | user/admin |
| `/api/wallet/deduct` | POST | 錢包扣款 | system/admin |

### 🔌 充電相關

| 端點 | 方法 | 說明 | 權限 |
|------|------|------|------|
| `/api/stations` | GET | 獲取充電站列表 | public |
| `/api/stations?station_code=STN001` | GET | 查詢特定充電站 | public |
| `/api/guns` | GET | 獲取充電樁列表 | public |
| `/api/guns/[id]` | GET | 獲取充電樁詳情 | public |

### 💰 計費相關

| 端點 | 方法 | 說明 | 權限 |
|------|------|------|------|
| `/api/billing/records` | GET | 獲取計費記錄 | user/admin |
| `/api/tariffs` | GET | 獲取費率列表 | public |

---

## 💻 前端整合範例

### React/Next.js 範例

#### 1. 創建 API 客戶端

```javascript
// lib/apiClient.js

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:7500';

class ApiClient {
  constructor() {
    this.baseUrl = API_BASE_URL;
  }

  getToken() {
    return localStorage.getItem('authToken');
  }

  async request(endpoint, options = {}) {
    const token = this.getToken();
    
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers,
    });

    if (response.status === 401) {
      // Token 過期或無效，清除並重定向到登入
      localStorage.removeItem('authToken');
      localStorage.removeItem('user');
      window.location.href = '/login';
      throw new Error('認證失敗');
    }

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || '請求失敗');
    }

    return data;
  }

  // 認證相關 - 使用者手機登入（推薦）
  async loginWithPhone(phone, userInfo = {}) {
    const data = await this.request('/api/auth/thirdparty', {
      method: 'POST',
      body: JSON.stringify({ 
        provider: 'phone', 
        phone,
        ...userInfo
      }),
    });

    if (data.success && data.token) {
      localStorage.setItem('authToken', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
    }

    return data;
  }

  // 認證相關 - Google 登入
  async loginWithGoogle(email, googleInfo = {}) {
    const data = await this.request('/api/auth/thirdparty', {
      method: 'POST',
      body: JSON.stringify({ 
        provider: 'google', 
        email,
        ...googleInfo
      }),
    });

    if (data.success && data.token) {
      localStorage.setItem('authToken', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
    }

    return data;
  }

  // 認證相關 - Facebook 登入
  async loginWithFacebook(email, fbInfo = {}) {
    const data = await this.request('/api/auth/thirdparty', {
      method: 'POST',
      body: JSON.stringify({ 
        provider: 'facebook', 
        email,
        ...fbInfo
      }),
    });

    if (data.success && data.token) {
      localStorage.setItem('authToken', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
    }

    return data;
  }

  // 認證相關 - 管理者 Email + 密碼登入
  async login(email, password) {
    const data = await this.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    if (data.success && data.token) {
      localStorage.setItem('authToken', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
    }

    return data;
  }

  async logout() {
    await this.request('/api/auth/logout', { method: 'POST' });
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
  }

  // 用戶相關
  async getProfile() {
    return this.request('/api/user/profile');
  }

  async updateProfile(profileData) {
    return this.request('/api/user/profile', {
      method: 'PATCH',
      body: JSON.stringify(profileData),
    });
  }

  async getWallet(userId) {
    return this.request(`/api/users/${userId}/wallet`);
  }

  async getTransactions(userId, params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.request(`/api/users/${userId}/transactions?${queryString}`);
  }

  // 充電站相關
  async getStations(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.request(`/api/stations?${queryString}`);
  }

  async getStation(stationCode) {
    return this.request(`/api/stations?station_code=${stationCode}`);
  }
}

export const apiClient = new ApiClient();
```

#### 2. 登入頁面範例（使用者多種登入方式）

```jsx
// pages/login.jsx
import { useState } from 'react';
import { useRouter } from 'next/router';
import { apiClient } from '../lib/apiClient';

export default function LoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // 手機登入
  const handlePhoneLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await apiClient.loginWithPhone(phone);
      
      if (result.success) {
        router.push('/dashboard');
      }
    } catch (err) {
      setError(err.message || '登入失敗');
    } finally {
      setLoading(false);
    }
  };

  // Google 登入（假設已整合 Google SDK）
  const handleGoogleLogin = async () => {
    try {
      // 使用 Google SDK 獲取用戶資訊
      const googleUser = await window.gapi.auth2.getAuthInstance().signIn();
      const profile = googleUser.getBasicProfile();
      
      const result = await apiClient.loginWithGoogle(
        profile.getEmail(),
        {
          providerUserId: profile.getId(),
          firstName: profile.getGivenName(),
          lastName: profile.getFamilyName()
        }
      );
      
      if (result.success) {
        router.push('/dashboard');
      }
    } catch (err) {
      setError('Google 登入失敗');
    }
  };

  // Facebook 登入（假設已整合 Facebook SDK）
  const handleFacebookLogin = async () => {
    try {
      window.FB.login((response) => {
        if (response.authResponse) {
          window.FB.api('/me', { fields: 'email,first_name,last_name' }, async (profile) => {
            const result = await apiClient.loginWithFacebook(
              profile.email,
              {
                providerUserId: profile.id,
                firstName: profile.first_name,
                lastName: profile.last_name
              }
            );
            
            if (result.success) {
              router.push('/dashboard');
            }
          });
        }
      }, { scope: 'public_profile,email' });
    } catch (err) {
      setError('Facebook 登入失敗');
    }
  };

  return (
    <div className="login-container">
      <h1>使用者登入</h1>
      
      {/* 手機登入表單 */}
      <form onSubmit={handlePhoneLogin}>
        <div>
          <label>手機號碼:</label>
          <input
            type="tel"
            placeholder="0912345678"
            pattern="09\d{8}"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
          />
          <small>請輸入 10 位數字手機號碼</small>
        </div>

        {error && <div className="error">{error}</div>}

        <button type="submit" disabled={loading}>
          {loading ? '登入中...' : '手機登入'}
        </button>
      </form>

      <div className="divider">或使用</div>

      {/* 第三方登入按鈕 */}
      <button onClick={handleGoogleLogin} className="btn-google">
        Google 登入
      </button>
      
      <button onClick={handleFacebookLogin} className="btn-facebook">
        Facebook 登入
      </button>
      
      <p className="note">
        ⚠️ 首次登入會自動創建帳號
      </p>
    </div>
  );
}
```

**管理者登入範例**:
```jsx
// pages/admin-login.jsx
import { useState } from 'react';
import { apiClient } from '../lib/apiClient';

export default function AdminLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      await apiClient.login(email, password);
      window.location.href = '/admin/dashboard';
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="admin-login">
      <h1>管理者登入</h1>
      <p className="note">僅限 admin 和 super_admin 角色</p>
      <form onSubmit={handleLogin}>
        <input 
          type="email" 
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)} 
          required
        />
        <input 
          type="password" 
          placeholder="密碼"
          value={password}
          onChange={(e) => setPassword(e.target.value)} 
          required
        />
        {error && <div className="error">{error}</div>}
        <button type="submit">登入</button>
      </form>
    </div>
  );
}
```

#### 3. 受保護的頁面範例

```jsx
// pages/profile.jsx
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { apiClient } from '../lib/apiClient';

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const data = await apiClient.getProfile();
      setProfile(data.user);
    } catch (error) {
      console.error('載入個人資料失敗:', error);
      // API client 會自動處理 401 錯誤並重定向
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await apiClient.logout();
      router.push('/login');
    } catch (error) {
      console.error('登出失敗:', error);
    }
  };

  if (loading) {
    return <div>載入中...</div>;
  }

  if (!profile) {
    return <div>無法載入個人資料</div>;
  }

  return (
    <div className="profile-container">
      <h1>個人資料</h1>
      
      <div>
        <p><strong>Email:</strong> {profile.email}</p>
        <p><strong>姓名:</strong> {profile.firstName} {profile.lastName}</p>
        <p><strong>角色:</strong> {profile.role}</p>
        <p><strong>電話:</strong> {profile.phone || '未設定'}</p>
      </div>

      <button onClick={handleLogout}>登出</button>
    </div>
  );
}
```

---

## 🔒 安全性建議

### 1. **Token 儲存**
- ✅ 開發環境：使用 `localStorage`
- ⚠️ 生產環境：考慮使用 `httpOnly` cookie 或加密儲存

### 2. **HTTPS**
- ⚠️ 生產環境必須使用 HTTPS
- 確保 API 和前端都使用 HTTPS

### 3. **Token 過期處理**
```javascript
// 在 API client 中添加自動重試邏輯
async request(endpoint, options = {}) {
  try {
    return await this._request(endpoint, options);
  } catch (error) {
    if (error.message === '認證失敗' && !options._retry) {
      // Token 過期，嘗試刷新（如果有刷新機制）
      // 或直接重定向到登入頁面
      window.location.href = '/login';
    }
    throw error;
  }
}
```

### 4. **CORS 配置**

生產環境建議在後端 `src/middleware.ts` 中限制允許的來源：

```typescript
const allowedOrigins = [
  'https://user.yoursite.com',    // 使用者網站
  'https://admin.yoursite.com',   // 管理後台
];

const origin = req.headers.get('origin');
if (allowedOrigins.includes(origin || '')) {
  corsHeaders['Access-Control-Allow-Origin'] = origin;
}
```

---

## 🧪 測試範例

### 使用 curl 測試

```bash
# 1A. 使用者手機登入
curl -X POST http://localhost:7500/api/auth/thirdparty \
  -H "Content-Type: application/json" \
  -d '{"provider":"phone","phone":"0912345678"}' \
  | jq -r '.token'

# 1A-2. 使用者 Google 登入
curl -X POST http://localhost:7500/api/auth/thirdparty \
  -H "Content-Type: application/json" \
  -d '{"provider":"google","email":"user@gmail.com","firstName":"John","lastName":"Doe"}' \
  | jq -r '.token'

# 1A-3. 使用者 Facebook 登入
curl -X POST http://localhost:7500/api/auth/thirdparty \
  -H "Content-Type: application/json" \
  -d '{"provider":"facebook","email":"user@fb.com"}' \
  | jq -r '.token'

# 1B. 管理者登入（Email + 密碼）
curl -X POST http://localhost:7500/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"password123"}' \
  | jq -r '.token'

# 儲存 token
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# 2. 使用 token 訪問 API
curl http://localhost:7500/api/user/profile \
  -H "Authorization: Bearer $TOKEN"

# 3. 更新個人資料
curl -X PATCH http://localhost:7500/api/user/profile \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"firstName":"John","lastName":"Doe","phone":"0912345678"}'

# 4. 登出
curl -X POST http://localhost:7500/api/auth/logout \
  -H "Authorization: Bearer $TOKEN"
```

---

## 📞 支援與問題

如有問題，請參考：
- API 文檔：`docs/API_STRUCTURE.md`
- 後端代碼：`src/app/api/`
- 認證輔助：`src/lib/auth/authHelper.ts`

---

## ✅ 檢查清單

使用者網站整合前的檢查：

- [ ] 後端 API 已啟動（http://localhost:7500）
- [ ] CORS 已配置（允許您的網站來源）
- [ ] **使用者登入**：測試 POST /api/auth/thirdparty（手機/Google/Facebook）
- [ ] **管理者登入**：測試 POST /api/auth/login（Email + 密碼，僅限 admin）
- [ ] 測試使用 token 訪問受保護的 API
- [ ] 實作 token 儲存和自動帶入機制
- [ ] 實作 401 錯誤處理（token 過期）
- [ ] 實作登出功能
- [ ] 驗證角色限制：一般使用者無法使用 /api/auth/login
- [ ] 驗證角色限制：管理者無法使用 /api/auth/thirdparty
- [ ] 測試自動註冊：首次登入自動創建用戶
- [ ] 生產環境配置 HTTPS
- [ ] 生產環境限制 CORS 來源
- [ ] **安全性**：在前端完成第三方平台驗證（Google OAuth、簡訊 OTP）後再呼叫 API
- [ ] **安全性**：配置 Rate Limiting 防止暴力破解

---

## 🎯 總結

您的使用者網站可以：
1. ✅ 使用統一的第三方登入 API (`/api/auth/thirdparty`)
2. ✅ 支援多種登入方式（手機、Google、Facebook、Line、Apple）
3. ✅ 自動註冊：首次登入自動創建用戶
4. ✅ 使用 Bearer Token 認證
5. ✅ 訪問所有用戶相關的 API
6. ✅ 與管理後台共用同一個後端（角色隔離）
7. ✅ 獨立部署和運行

### 登入方式總覽

```
使用者（role='user'）:
├── POST /api/auth/thirdparty (provider=phone)     → 手機登入
├── POST /api/auth/thirdparty (provider=google)    → Google 登入
├── POST /api/auth/thirdparty (provider=facebook)  → Facebook 登入
├── POST /api/auth/thirdparty (provider=line)      → Line 登入
└── POST /api/auth/thirdparty (provider=apple)     → Apple 登入

管理者（role='admin' 或 'super_admin'）:
└── POST /api/auth/login (email + password)        → 傳統登入
```

**不會有任何衝突**，使用者和管理者有明確的角色分離！🎉
