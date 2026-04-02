---
name: DevSecOps Security Review
description: 'CRITICAL MANDATORY SOP FOR EVERY TASK. You MUST ALWAYS view and follow this skill before and after writing any code or fixing any bug. Quy trình kiểm tra bảo mật (DevSecOps) trước và sau khi viết code dựa trên tiêu chuẩn của claude-code-security-review.'
---

# DevSecOps Security Review Skill (v3)

## Mục đích (Purpose)
Đảm bảo mọi đoạn code được sinh ra hoặc chỉnh sửa bởi Antigravity đều đạt tiêu chuẩn bảo mật cao bằng cách thực hiện phân tích bảo mật chủ động **trước khi** viết code và **sau khi** hoàn thiện các thay đổi.

---

## Thang đánh giá Severity

| Mức | Mô tả | Hành động bắt buộc |
|-----|-------|-------------------|
| 🔴 **Critical** | Có thể bị khai thác ngay, ảnh hưởng toàn hệ thống | **Dừng code, fix ngay, báo User** |
| 🟠 **High** | Rủi ro cao, có thể lộ dữ liệu hoặc chiếm quyền | **Cảnh báo User, fix trước khi ship** |
| 🟡 **Medium** | Rủi ro trung bình, chưa khai thác trực tiếp được | **Ghi chú trong code, đề xuất fix** |
| 🟢 **Low / Info** | Rủi ro thấp hoặc best practice | **Thông báo tham khảo, không bắt buộc** |

> **Quy tắc:** Không được ship code có lỗi **Critical** hoặc **High** mà chưa fix hoặc chưa được User xác nhận chấp nhận rủi ro.

---

## Các lỗ hổng bảo mật cần kiểm tra (OWASP-Based Checklist)

1. **Injection Attacks** *(Critical)* — SQL, command, LDAP, XPath, NoSQL injection, XXE.
2. **Authentication & Authorization** *(Critical)* — Lỗi xác thực, leo thang đặc quyền, IDOR, bypass, session flaws.
3. **Data Exposure** *(High)* — Hardcode secrets/API keys, log dữ liệu nhạy cảm, lộ PII.
4. **Cryptographic Issues** *(High)* — Thuật toán yếu (MD5/SHA1 cho password), quản lý key sai, PRNG không an toàn.
5. **Input Validation** *(High)* — Thiếu validation, không sanitize, buffer overflows.
6. **Business Logic Flaws** *(High)* — Race conditions, TOCTOU.
7. **Configuration Security** *(Medium)* — Cấu hình mặc định không an toàn, thiếu security headers, permissive CORS.
8. **Supply Chain** *(Medium)* — Dependencies có CVE, typosquatting risks.
9. **Code Execution** *(Critical)* — RCE qua deserialization, pickle injection, `eval()` injection.
10. **Cross-Site Scripting (XSS)** *(High)* — Reflected, Stored, DOM-based XSS.

---

## Framework-Specific Security Rules

### 🐘 Laravel / PHP

**🔴 Critical:**
- `$request->all()` trực tiếp vào DB mà không có `$fillable` → **Mass Assignment**
- Raw query `DB::statement("... $userInput ...")` → **SQL Injection**
- Dùng `eval()`, `system()`, `exec()`, `shell_exec()`, `passthru()` với input user → **RCE**
- In data user bằng `{!! $variable !!}` trong Blade chưa sanitize → **XSS**

**🟠 High:**
- API endpoint thiếu `auth:sanctum` / `auth:api` middleware → **Unauthenticated Access**
- Không dùng `Gate::authorize()` hoặc Policy khi truy cập resource của User khác → **IDOR**
- Lưu password bằng `md5()` / `sha1()` thay vì `Hash::make()` → **Weak Crypto**
- Dùng `$_GET`, `$_POST` trực tiếp thay vì `$request->validated()` → **Unvalidated Input**

**🟡 Medium:**
- `.env` không nằm trong `.gitignore`
- `APP_DEBUG=true` trên môi trường production
- CORS mở `*` không giới hạn origin
- Thiếu `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options` headers

---

### 🐍 Python (Django / Flask / FastAPI)

**🔴 Critical:**
- Dùng `os.system()`, `subprocess.call(shell=True)` với input user → **Command Injection**
- Query DB bằng string format: `f"SELECT * FROM users WHERE id={user_id}"` → **SQL Injection**
- Dùng `pickle.loads()` với data từ ngoài → **Deserialization RCE**
- Dùng `eval()` hoặc `exec()` với input user → **Code Execution**
- `yaml.load()` (unsafe) thay vì `yaml.safe_load()` → **YAML Injection**

**🟠 High:**
- Flask: Không set `SECRET_KEY` hoặc set key yếu → **Session Forgery**
- Django: `DEBUG = True` trên production → **Info Disclosure**
- Django: Raw query `User.objects.raw(f"... {input} ...")` → **SQL Injection**
- FastAPI: Không dùng `Depends(get_current_user)` cho protected routes → **Unauth Access**
- Lưu secret trong code thay vì `os.environ` hoặc `.env` → **Hardcoded Secret**

**🟡 Medium:**
- Flask: Không dùng `flask-talisman` cho security headers
- Django: Thiếu `CSRF_COOKIE_SECURE`, `SESSION_COOKIE_SECURE`, `SECURE_SSL_REDIRECT`
- FastAPI: Không giới hạn CORS với `allow_origins=["*"]`
- Dùng `random` thay vì `secrets` module cho token generation

---

### 🟢 Node.js (Express / Vanilla)

**🔴 Critical:**
- Dùng `child_process.exec()` với string nối từ input user → **Command Injection**
- Query MongoDB: `db.users.find({ username: req.body.username })` không sanitize → **NoSQL Injection**
- Dùng `eval()`, `new Function()` với data từ client → **Code Execution**
- Deserialize data không tin cậy từ client (node-serialize) → **RCE**

**🟠 High:**
- Không dùng `helmet` middleware → **Missing Security Headers**
- JWT secret là string yếu hoặc hardcode trong source → **Token Forgery**
- Không validate/sanitize body request (thiếu `express-validator` hoặc `Joi`) → **Injection Risk**
- Thiếu rate limiting trên auth endpoints (`express-rate-limit`) → **Brute Force**
- `cors({ origin: '*' })` trên production API có auth → **CORS Misconfiguration**

**🟡 Medium:**
- `console.log()` in ra dữ liệu user/token nhạy cảm
- Dùng `http` thay vì `https` cho external requests
- Không set `httpOnly`, `secure`, `sameSite` cho cookie session
- Dependencies không được audit (`npm audit`)

---

### ⚫ Next.js

**🔴 Critical:**
- API Routes (`pages/api/` hoặc `app/api/`) không kiểm tra authentication → **Unauth API**
- Server Actions không validate input → **Injection Risk**
- Dùng `dangerouslySetInnerHTML` với data chưa sanitize → **XSS**

**🟠 High:**
- Secret key/API key để trong `NEXT_PUBLIC_` prefix → **Client-Side Exposure** (chỉ dùng prefix này cho public values)
- Không dùng `getServerSideProps` / Server Component để check auth cho protected pages
- `next.config.js`: `headers()` không cấu hình `Content-Security-Policy`
- Không validate params từ `useSearchParams()`, `useParams()` trước khi dùng

**🟡 Medium:**
- `Image` component dùng `unoptimized={true}` mà không có lý do
- Thiếu `robots.txt` và `security.txt` cho production
- Không có `middleware.ts` để protect `/dashboard`, `/admin` routes

---

### 🟣 NestJS

**🔴 Critical:**
- Controller không có `@UseGuards(AuthGuard)` → **Unprotected Endpoint**
- Dùng raw TypeORM query: `repository.query(\`SELECT ... ${userInput}\`)` → **SQL Injection**
- Deserialize payload không validate bằng `class-validator` → **Mass Assignment / Injection**

**🟠 High:**
- Không dùng `ValidationPipe` globally trong `main.ts` → **Unvalidated Input**
- Thiếu `@Roles()` decorator và `RolesGuard` cho authorization → **Privilege Escalation**
- JWT secret hardcode trong code hoặc yếu (< 32 chars) → **Token Forgery**
- Không cài `helmet()` và `rateLimit()` trong `main.ts` → **Missing Protections**
- DTO không có `@IsString()`, `@IsEmail()`, `@MaxLength()`,... → **No Validation**

**🟡 Medium:**
- `ConfigModule` không set `validationSchema` cho env vars
- Exception filter lộ stack trace trên production
- Thiếu `@ApiSecurity()` / `@ApiBearerAuth()` cho Swagger documentation
- Không cấu hình CORS cụ thể trong `app.enableCors()`

---

### 🟩 Vue.js (Vue 2 / Vue 3 / Nuxt)

**🔴 Critical:**
- Dùng `v-html` với data từ user / API chưa sanitize → **Stored/Reflected XSS**
- Dùng `eval()` hoặc `new Function()` để xử lý logic dynamic → **Code Execution**

**🟠 High:**
- Token (JWT, API key) lưu trong `localStorage` thay vì `httpOnly cookie` → **XSS Token Theft**
- Gọi API từ component mà không check role/permission → **Unauth Data Fetch**
- Nuxt: Secret/API key để trong `runtimeConfig.public` → **Client Exposure**
- Không sanitize dữ liệu từ `$route.query` / `$route.params` trước khi render

**🟡 Medium:**
- Thiếu `meta` CSP headers trong `nuxt.config.ts`
- Không dùng HTTPS cho API calls trên production
- Axios base URL hardcode thay vì lấy từ environment variable
- Không xử lý error response API (có thể lộ thông tin chi tiết về hệ thống)

---

### 🌐 HTML / Vanilla JavaScript

**🔴 Critical:**
- Dùng `innerHTML`, `outerHTML`, `document.write()` với data không tin cậy → **XSS**
- Dùng `eval()`, `setTimeout("string")`, `setInterval("string")` với dynamic string → **Code Execution**

**🟠 High:**
- Token/secret lưu trong `localStorage` / `sessionStorage` → **XSS Token Theft**
- Form action submit tới `http://` thay vì `https://` → **Data Interception**
- Không có `autocomplete="off"` trên sensitive fields (password, OTP)
- Inline event handlers (`onclick="..."`) với dynamic data → **DOM XSS**

**🟡 Medium:**
- Thiếu `Content-Security-Policy` meta tag
- Thiếu `<meta name="referrer" content="no-referrer">` cho trang nhạy cảm
- Không có `rel="noopener noreferrer"` cho links mở tab mới (`target="_blank"`)
- Form fields không có `name` attribute hợp lý (gây autocomplete leak)

---

## Quy trình Thực thi (4-Phase Workflow)

### Phase 1 — Pre-Coding Security Check
Trước khi viết file, tự hỏi:
- Tính năng nhận input từ user không? → Phải validate & sanitize.
- Liên quan tới phân quyền không? → Phải kiểm tra Auth/Permission.
- Có dữ liệu nhạy cảm trả về hoặc lưu DB/Log không?
- Gọi external service không? → Phải validate response.

### Phase 2 — Contextual Review During Implementation
- Code bảo vệ đúng ngữ nghĩa hay chỉ phòng thủ hình thức?
- Cấu hình mặc định đã **Secure by Default** chưa?
- Có secret/key nào bị lộ vào source code không?

### Phase 3 — Post-Code Security Checklist
Trước khi báo User "done", check:
```
□ Không có secret, API key, password hardcode trong code
□ Tất cả input từ user đã qua validation
□ Mọi query DB dùng ORM hoặc Prepared Statement
□ Log không ghi dữ liệu nhạy cảm (password, token, PII)
□ Mọi API endpoint có required Auth Middleware / Guard
□ Dữ liệu trả về API đã được filter (không trả toàn bộ Model/Entity)
□ Không dùng hàm nguy hiểm: eval(), exec(), innerHTML, v-html, {!! !!}...
□ Dependencies không có CVE nghiêm trọng
□ File config production không bật DEBUG mode
□ Security Headers đã được cấu hình
```

### Phase 4 — Reporting Format
Khi phát hiện lỗ hổng, báo cáo theo format:
```
⚠️ [SEVERITY] Phát hiện vấn đề bảo mật: [Tên lỗ hổng]
📍 File: [đường dẫn]:[dòng]
🔍 Vấn đề: [Mô tả ngắn gọn]
✅ Fix đề xuất: [Code mẫu hoặc hướng dẫn]
```

---

## False Positive Filtering
**Bỏ qua** các cảnh báo sau trừ khi có yêu cầu đặc biệt:
- DoS kiểu brute-force đơn giản (không có attack vector rõ ràng)
- Rate limiting (trừ Public API không có auth)
- Generic open redirects (không khai thác được trong context)
- Memory/CPU exhaustion không có vector tấn công

---

## CI/CD Integration (GitHub Actions)

Tạo file `.github/workflows/security.yml`:
```yaml
name: Security Review

permissions:
  pull-requests: write
  contents: read

on:
  pull_request:

jobs:
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          ref: ${{ github.event.pull_request.head.sha || github.sha }}
          fetch-depth: 2

      - uses: anthropics/claude-code-security-review@main
        with:
          comment-pr: true
          claude-api-key: ${{ secrets.CLAUDE_API_KEY }}
```

> ⚠️ **Bật "Require approval for all external contributors"** trên repo settings để tránh prompt injection từ PR người lạ.

---

## Tham khảo
- [anthropics/claude-code-security-review](https://github.com/anthropics/claude-code-security-review)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Laravel Security](https://laravel.com/docs/security) | [Django Security](https://docs.djangoproject.com/en/stable/topics/security/) | [NestJS Security](https://docs.nestjs.com/security/helmet)
