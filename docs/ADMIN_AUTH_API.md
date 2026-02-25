# 🔐 Admin Auth — API Reference for Frontend (exodia-admin-ui)

> **Mục đích:** Tài liệu này dành cho AI code assistant triển khai trang quản trị Admin. Bao gồm toàn bộ endpoint đăng nhập, cơ chế xác thực JWT, data types, và code examples.

---

## Mục lục

1. [Tổng quan](#1-tổng-quan)
2. [Khác biệt với User Auth](#2-khác-biệt-với-user-auth)
3. [Data Types & Interfaces](#3-data-types--interfaces)
4. [API Endpoints](#4-api-endpoints)
   - [4.1 POST /admin/auth/login](#41-post-adminauthlogin)
   - [4.2 GET /admin/auth/me](#42-get-adminauthme)
5. [Authentication Flow](#5-authentication-flow)
6. [Cách sử dụng JWT Token](#6-cách-sử-dụng-jwt-token)
7. [Error Handling](#7-error-handling)
8. [Code Examples (Frontend)](#8-code-examples-frontend)
9. [Lưu ý bảo mật](#9-lưu-ý-bảo-mật)

---

## 1. Tổng quan

```
┌──────────────────┐      POST /admin/auth/login     ┌──────────────────┐
│  exodia-admin-ui │ ──────────────────────────────► │   exodia-core    │
│  (Admin Panel)   │ ◄─── { accessToken, admin } ── │   (NestJS API)   │
│                  │                                  │                  │
│  Lưu token vào   │      GET /admin/auth/me          │  Verify JWT +    │
│  localStorage    │ ──── Authorization: Bearer ───► │  check isActive  │
│                  │ ◄─── { admin info } ──────────── │                  │
└──────────────────┘                                  └──────────────────┘
```

- **Base URL:** `http://localhost:3000` (development)
- **Swagger UI:** `http://localhost:3000/api` (tag: `Admin Auth`)
- **Cơ chế xác thực:** Username/Password → JWT Bearer Token
- **Token hết hạn:** 8 giờ (mặc định)

---

## 2. Khác biệt với User Auth

| Tiêu chí       | User (Trader)              | Admin                         |
| -------------- | -------------------------- | ----------------------------- |
| Đăng nhập bằng | Wallet + EIP-712 Signature | Username + Password           |
| Token          | Không dùng JWT             | JWT Bearer Token              |
| Xác thực       | Mỗi request ký chữ ký      | Gửi JWT trong header          |
| Thời hạn       | Theo Nonce (1 lần)         | 8 giờ (access token)          |
| Guard          | Không có                   | `AdminAuthGuard` kiểm tra JWT |

> **Quan trọng:** Admin **KHÔNG** đăng nhập bằng MetaMask/Wallet. Admin dùng form username/password truyền thống.

---

## 3. Data Types & Interfaces

```typescript
// ─── Admin Role ───
type AdminRole = 'super_admin' | 'operator' | 'support';

// ─── Login Request ───
interface AdminLoginRequest {
  username: string; // Tên đăng nhập (case-insensitive)
  password: string; // Mật khẩu
}

// ─── Login Response ───
interface AdminLoginResponse {
  success: true;
  data: {
    accessToken: string; // JWT token, dùng cho mọi request admin
    admin: {
      username: string; // Tên đăng nhập
      role: AdminRole; // Vai trò: 'super_admin' | 'operator' | 'support'
    };
  };
}

// ─── Me Response (Admin hiện tại) ───
interface AdminMeResponse {
  success: true;
  data: {
    id: string; // MongoDB _id
    username: string;
    role: AdminRole;
  };
}

// ─── Error Response ───
interface AdminErrorResponse {
  statusCode: number;
  message: string;
  error: string;
}
```

---

## 4. API Endpoints

### 4.1 `POST /admin/auth/login`

Đăng nhập admin bằng username và password. Trả về JWT access token.

**Không cần authentication.** Đây là endpoint công khai.

**Request Body:**

```json
{
  "username": "admin",
  "password": "Admin@123456"
}
```

| Field    | Type   | Required | Mô tả                                      |
| -------- | ------ | -------- | ------------------------------------------ |
| username | string | ✅       | Tên đăng nhập (không phân biệt hoa thường) |
| password | string | ✅       | Mật khẩu                                   |

**Response (200) — Thành công:**

```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2NWExYjJjM2Q0ZTVmNiIsInVzZXJuYW1lIjoiYWRtaW4iLCJyb2xlIjoic3VwZXJfYWRtaW4iLCJ0eXBlIjoiYWRtaW4iLCJpYXQiOjE3MDk4NjQwMDAsImV4cCI6MTcwOTg5MjgwMH0.abc123",
    "admin": {
      "username": "admin",
      "role": "super_admin"
    }
  }
}
```

**Response (401) — Sai tên đăng nhập hoặc mật khẩu:**

```json
{
  "statusCode": 401,
  "message": "Tài khoản hoặc mật khẩu không đúng",
  "error": "Unauthorized"
}
```

**Response (401) — Tài khoản bị vô hiệu hóa:**

```json
{
  "statusCode": 401,
  "message": "Tài khoản đã bị vô hiệu hóa",
  "error": "Unauthorized"
}
```

---

### 4.2 `GET /admin/auth/me`

Lấy thông tin admin đang đăng nhập. Dùng để kiểm tra token còn hợp lệ không và lấy thông tin admin hiện tại.

**⚠️ Yêu cầu authentication.** Phải gửi JWT trong header.

**Request Headers:**

```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

**Response (200) — Thành công:**

```json
{
  "success": true,
  "data": {
    "id": "65a1b2c3d4e5f6",
    "username": "admin",
    "role": "super_admin"
  }
}
```

**Response (401) — Token không hợp lệ hoặc hết hạn:**

```json
{
  "statusCode": 401,
  "message": "Token không hợp lệ hoặc đã hết hạn",
  "error": "Unauthorized"
}
```

---

## 5. Authentication Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    ADMIN LOGIN FLOW                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Admin mở trang đăng nhập                                    │
│     └─► Hiển thị form: [Username] [Password] [Login]           │
│                                                                 │
│  2. Admin nhập thông tin → Click Login                          │
│     └─► POST /admin/auth/login { username, password }          │
│                                                                 │
│  3. Server xử lý:                                               │
│     ├─► Tìm admin theo username (lowercase)                    │
│     ├─► Kiểm tra isActive === true                             │
│     ├─► So sánh password bằng bcrypt                           │
│     ├─► Nếu OK → Tạo JWT token + cập nhật lastLoginAt         │
│     └─► Trả về { accessToken, admin }                          │
│                                                                 │
│  4. Frontend nhận response:                                     │
│     ├─► Lưu accessToken vào localStorage hoặc memory           │
│     ├─► Lưu admin info (username, role) vào state              │
│     └─► Redirect tới Dashboard                                 │
│                                                                 │
│  5. Mọi request admin tiếp theo:                               │
│     └─► Gửi header: Authorization: Bearer <accessToken>        │
│                                                                 │
│  6. Khi token hết hạn (401):                                   │
│     └─► Redirect về trang đăng nhập                             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 6. Cách sử dụng JWT Token

Sau khi login thành công, **mọi request tới API admin** đều phải gửi token trong header `Authorization`:

```http
GET /admin/auth/me HTTP/1.1
Host: localhost:3000
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
Content-Type: application/json
```

### JWT Payload (tham khảo, không cần decode ở FE)

```json
{
  "sub": "65a1b2c3d4e5f6", // Admin ID
  "username": "admin",
  "role": "super_admin",
  "type": "admin", // Phân biệt với user token
  "iat": 1709864000, // Issued at
  "exp": 1709892800 // Expires at (8h sau)
}
```

---

## 7. Error Handling

### Bảng mã lỗi

| Status | Khi nào                        | Message                                        | Hành động FE                 |
| ------ | ------------------------------ | ---------------------------------------------- | ---------------------------- |
| 401    | Sai username hoặc password     | `Tài khoản hoặc mật khẩu không đúng`           | Hiện toast error             |
| 401    | Tài khoản bị khóa              | `Tài khoản đã bị vô hiệu hóa`                  | Hiện thông báo liên hệ admin |
| 401    | Token thiếu                    | `Token không được cung cấp`                    | Redirect → login page        |
| 401    | Token hết hạn                  | `Token không hợp lệ hoặc đã hết hạn`           | Redirect → login page        |
| 401    | Admin bị vô hiệu hóa sau login | `Token không hợp lệ hoặc admin bị vô hiệu hóa` | Redirect → login page        |

### Xử lý 401 toàn cục (Axios interceptor)

```typescript
// Nên đặt 1 interceptor xử lý 401 cho tất cả request admin
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Xóa token + redirect về login
      localStorage.removeItem('admin_token');
      window.location.href = '/admin/login';
    }
    return Promise.reject(error);
  },
);
```

---

## 8. Code Examples (Frontend)

### 8.1 API Client setup

```typescript
import axios from 'axios';

const BASE_URL = 'http://localhost:3000';

// Tạo axios instance riêng cho admin
const adminApi = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Interceptor: Tự động gắn token vào mọi request
adminApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('admin_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor: Xử lý token hết hạn
adminApi.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('admin_token');
      localStorage.removeItem('admin_info');
      window.location.href = '/admin/login';
    }
    return Promise.reject(err);
  },
);

export { adminApi };
```

### 8.2 Login function

```typescript
interface LoginResult {
  accessToken: string;
  admin: { username: string; role: string };
}

async function adminLogin(
  username: string,
  password: string,
): Promise<LoginResult> {
  const { data } = await adminApi.post('/admin/auth/login', {
    username,
    password,
  });

  // Lưu token và admin info
  localStorage.setItem('admin_token', data.data.accessToken);
  localStorage.setItem('admin_info', JSON.stringify(data.data.admin));

  return data.data;
}
```

### 8.3 Check auth status (mở app hoặc refresh page)

```typescript
async function checkAdminAuth(): Promise<boolean> {
  const token = localStorage.getItem('admin_token');
  if (!token) return false;

  try {
    const { data } = await adminApi.get('/admin/auth/me');
    // Token hợp lệ, admin vẫn active
    return true;
  } catch {
    // Token hết hạn hoặc admin bị vô hiệu hóa
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_info');
    return false;
  }
}
```

### 8.4 Logout (client-side only)

```typescript
function adminLogout() {
  localStorage.removeItem('admin_token');
  localStorage.removeItem('admin_info');
  window.location.href = '/admin/login';
}
```

### 8.5 Protected route (React example)

```tsx
function AdminRoute({ children }: { children: React.ReactNode }) {
  const [isAuth, setIsAuth] = useState<boolean | null>(null);

  useEffect(() => {
    checkAdminAuth().then(setIsAuth);
  }, []);

  if (isAuth === null) return <LoadingSpinner />;
  if (!isAuth) return <Navigate to="/admin/login" />;

  return <>{children}</>;
}

// Sử dụng:
<Route
  path="/admin/dashboard"
  element={
    <AdminRoute>
      <Dashboard />
    </AdminRoute>
  }
/>;
```

---

## 9. Lưu ý bảo mật

1. **Không hiển thị lý do lỗi cụ thể:** Server luôn trả `"Tài khoản hoặc mật khẩu không đúng"` cho cả username sai lẫn password sai → Chống enumeration attack.

2. **Token storage:** Nên lưu accessToken trong `localStorage` hoặc `sessionStorage`. Nếu muốn bảo mật cao hơn, lưu trong memory (React state) nhưng sẽ mất khi refresh.

3. **HTTPS:** Production phải dùng HTTPS để tránh token bị sniff.

4. **Auto-logout:** Khi nhận 401 từ bất kỳ request nào → xóa token và redirect về login ngay.

5. **Role-based UI:** Dùng `admin.role` để hiển thị/ẩn các tính năng theo vai trò:
   - `super_admin`: Toàn quyền
   - `operator`: Quản lý positions, orders
   - `support`: Chỉ xem (read-only)
