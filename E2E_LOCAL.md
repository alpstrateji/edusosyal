# E2E Testleri — Local Çalıştırma Planı

Bu dosya, Playwright E2E testlerinin **local** ortamda nasıl çalıştırılacağını anlatır.
Şu an uygulama "kabuk UI" modunda — giriş zorunluluğu kaldırıldı, kullanıcı direkt sayfalara girebilir.
Auth tekrar açıldığında aşağıdaki adımlar geçerli olacak.

---

## 1. Kurulum (tek sefer)

```bash
bun add -D @playwright/test
bunx playwright install chromium
```

`playwright.config.ts` ve `e2e/auth-role-routing.spec.ts` repoda hazır.

## 2. Test kullanıcıları

Supabase (`iqiqlpzhdawjfrndrikb`) üzerinde iki kullanıcı oluştur:

| Rol            | E-posta (örnek)       | Notlar                                                  |
| -------------- | --------------------- | ------------------------------------------------------- |
| `agency_admin` | `agency@test.local`   | `handle_new_user` trigger'ı default olarak bunu atar.   |
| `school_admin` | `school@test.local`   | Oluşturduktan sonra SQL editor'da role'ü güncelle:      |

```sql
update public.user_profiles
set role = 'school_admin'
where id = (select id from auth.users where email = 'school@test.local');
```

## 3. Ortam değişkenleri

Proje köküne `.env.e2e` (gitignore'lı) oluştur:

```bash
E2E_BASE_URL=http://localhost:8080
E2E_AGENCY_EMAIL=agency@test.local
E2E_AGENCY_PASSWORD=Test1234!
E2E_SCHOOL_EMAIL=school@test.local
E2E_SCHOOL_PASSWORD=Test1234!
```

Yüklemek için:

```bash
set -a; source .env.e2e; set +a
```

## 4. Çalıştırma

```bash
# Dev server zaten çalışıyorsa:
bun run test:e2e

# UI modu (debug için):
bun run test:e2e:ui

# Sadece bir test:
bunx playwright test -g "agency_admin"

# Rapor:
bunx playwright show-report
```

`E2E_BASE_URL` verilmezse `playwright.config.ts` otomatik `bun run dev` başlatır.

## 5. Test senaryoları

`e2e/auth-role-routing.spec.ts` içinde:

1. `agency_admin` giriş yapar → `/dashboard`
2. `school_admin` giriş yapar → `/leads`
3. `school_admin` `/dashboard`'a gitmeye çalışır → `/leads`'e geri atılır
4. Oturumsuz `/dashboard` → `/login`

Credentials verilmezse testler `skip` olur (CI yeşil kalır).

## 6. Auth tekrar açıldığında

Şu an `App.tsx` içindeki `ProtectedRoute` ve `RoleRoute` sarmalları geçici olarak kaldırıldı.
Auth'u geri açmak için `App.tsx`'i eski haline döndürmek yeterli (git history'den).
Bu dosyadaki adımlar değişmeden geçerli olacak.
