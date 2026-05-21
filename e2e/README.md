# E2E Tests (Playwright)

Login → rol bazlı yönlendirme akışını uçtan uca doğrular.

## Kurulum

```bash
bun add -D @playwright/test     # zaten yüklü
bunx playwright install chromium
```

## Çalıştırma

Önceden oluşturulmuş iki test kullanıcısı gerekli:
- `agency_admin` rolünde bir kullanıcı
- `school_admin` rolünde bir kullanıcı

(Rol ataması `handle_new_user` trigger'ı ile yapılır; school_admin için Supabase'de `user_profiles.role` değerini elle güncellemen gerekebilir.)

### Ortam değişkenleri

```bash
export E2E_BASE_URL=http://localhost:8080          # opsiyonel; verilmezse `bun run dev` başlatılır
export E2E_AGENCY_EMAIL=agency@test.local
export E2E_AGENCY_PASSWORD=...
export E2E_SCHOOL_EMAIL=school@test.local
export E2E_SCHOOL_PASSWORD=...
```

### Komutlar

```bash
bunx playwright test                  # tüm testler
bunx playwright test --headed         # tarayıcı görünür
bunx playwright test --ui             # interaktif UI
bunx playwright show-report           # son raporu aç
```

Credentials verilmezse testler `skip` olur (CI'da yeşil kalır).
