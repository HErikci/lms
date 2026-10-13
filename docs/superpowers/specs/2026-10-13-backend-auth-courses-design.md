# Backend Çekirdeği: Auth + Kurs/İçerik — Tasarım

**Tarih:** 2026-10-13
**Durum:** Onaylandı (brainstorming), uygulama planı bekleniyor

## Amaç

BTK Akademi LMS şu ana kadar yalnızca bir React frontend + mock veri katmanıydı (`web/src/data/dashboard.fixtures.ts`). Bu tasarım, `docs/gereksinimler.md`'de tanımlanan MVP kapsamının ilk dilimini — kimlik doğrulama/RBAC ve kurs/içerik çekirdeği — gerçek bir backend + veritabanı ile hayata geçirir. Sonraki dilimler (sınav, ödev, bildirim) bu temel üzerine eklenecektir.

## Kapsam

Bu dilimde karşılanan gereksinimler:
- **FR-01** Kayıt/giriş (e-posta doğrulaması bu dilimde ertelendi — takip maddesi)
- **FR-04** RBAC — her istek sunucu tarafında rol kontrolünden geçer
- **FR-05** Profil düzenleme (temel alanlar: ad, avatar, dil)
- **FR-20** Kurs → Modül → Ders üç seviyeli hiyerarşi
- **FR-22** Eğitmen içerik yükleme/sıralama/taslak-yayın durumu
- **FR-25** Sıralı/serbest erişim modu
- **FR-26** Kategori/seviye/etiket/anahtar kelime ile filtreleme-arama
- **FR-28** Kayıt yöntemleri: açık kayıt, davet kodu, yönetici ataması

Kapsam dışı (sonraki dilimler): FR-10…13 (panel özet metrikleri — mevcut dashboard fixture'ı kalır, gerçek API'ye bağlanması ayrı bir takip maddesi), sınav (FR-40…), ödev (FR-60…), bildirim (FR-90…), AI asistan (FR-50…).

## Mimari

```
lms/
├── web/        # Mevcut React SPA (değişmeden kalır, sadece data katmanı güncellenir)
└── server/     # YENİ: Node.js + TypeScript + Fastify + Prisma + SQLite (WAL)
    ├── prisma/
    │   ├── schema.prisma
    │   ├── migrations/
    │   └── seed.ts
    ├── src/
    │   ├── app.ts            # Fastify instance, plugin kayıtları
    │   ├── routes/
    │   │   ├── auth.ts
    │   │   ├── courses.ts
    │   │   ├── modules.ts
    │   │   ├── lessons.ts
    │   │   └── enrollments.ts
    │   ├── middleware/
    │   │   └── rbac.ts
    │   ├── lib/
    │   │   ├── prisma.ts
    │   │   └── jwt.ts
    │   └── errors.ts         # Tek tip hata zarfı
    ├── CONTRACT.md           # API sözleşmesi (endpoint'ler, istek/yanıt şemaları)
    ├── ARCHITECTURE.md        # Kodlama standartları, klasör kuralları
    └── package.json
```

`server/` ve `web/` birbirinden bağımsız npm paketleridir (npm workspaces YOK bu dilimde — Approach A, basitlik için ayrı paketler). Teknoloji seçimi `docs/gereksinimler.md` §0 "Teknoloji Yığını Kararı" ile birebir uyumludur: Node.js/Fastify, SQLite WAL, Prisma ORM.

## Veri Modeli (Database Engineer sorumluluğu)

Prisma şeması, aşağıdaki varlıkları ve ilişkilerini tanımlar:

- **User**: id, email (unique), passwordHash, name, avatarUrl, locale, role (enum: STUDENT/INSTRUCTOR/ADMIN), createdAt
- **Course**: id, title, description, category, level, tags (string array / join table), accessMode (enum: SEQUENTIAL/FREE), status (enum: DRAFT/PUBLISHED), instructorId → User
- **Module**: id, courseId → Course, title, order
- **Lesson**: id, moduleId → Module, title, order, status (DRAFT/PUBLISHED) — içerik tipi/dosya alanları bu dilimde minimal (sonraki dilimde genişler)
- **Enrollment**: id, userId → User, courseId → Course, method (enum: OPEN/INVITE_CODE/ADMIN_ASSIGNED), enrolledAt

Migration dosyası versiyonlu olarak `prisma/migrations/` altında tutulur (NFR-54). Seed script, mevcut `dashboard.fixtures.ts`'deki Türkçe örnek verilerle tutarlı demo veri üretir.

**Dosya sahipliği:** Bu şema dosyası ve migration'lar yalnızca Database Engineer tarafından değiştirilir. Backend Developer şemayı okur ama değiştirmez; değişiklik ihtiyacı Tech Lead üzerinden Database Engineer'a iletilir.

## API Sözleşmesi (Software Architect sorumluluğu)

`server/CONTRACT.md` dosyasında, Backend ve Frontend çalışmaya başlamadan ÖNCE tanımlanır:

- `POST /api/v1/auth/register`, `POST /api/v1/auth/login`, `GET /api/v1/auth/me`
- `GET /api/v1/courses` (filtre: category, level, tag, q), `GET /api/v1/courses/:id`, `POST /api/v1/courses` (eğitmen/yönetici)
- `POST /api/v1/courses/:id/modules`, `POST /api/v1/modules/:id/lessons` (sıralama/durum alanlarıyla)
- `POST /api/v1/courses/:id/enroll` (method alanıyla), `GET /api/v1/users/me/courses`

Her endpoint için: istek şeması, başarı yanıtı, hata durumları, gereken rol. Tek tip hata zarfı: `{ "error": { "code": "string", "message": "string (Türkçe)" } }` (NFR-35 ile uyumlu).

`server/ARCHITECTURE.md`, kodlama standartlarını belirler: katman ayrımı (route → service → prisma), isimlendirme, test konumu.

## Backend (Backend Developer sorumluluğu)

- Fastify route handler'ları `CONTRACT.md`'ye birebir uyar.
- Parola: bcrypt (cost ≥ 12, NFR-11).
- Kimlik doğrulama: JWT access token (kısa ömürlü). **Not:** Refresh token / oturum iptali bu dilimde kapsam dışı — NFR-12'nin tam karşılanması takip maddesi olarak işaretlenir.
- RBAC middleware: JWT'den role okur, route bazında izin kontrolü yapar (NFR-14 — sunucu tarafı doğrulama).
- Girdi doğrulama: Fastify şema doğrulama (JSON Schema) ile enjeksiyon/XSS riskine karşı (NFR-13).

## Frontend (Frontend Developer sorumluluğu)

- `web/src/data/useDashboardData.ts`: fixture yerine `fetch('/api/v1/...')` (dönüş tipi `DashboardData` değişmez — mevcut CLAUDE.md kuralına uyumlu; panel özet metrikleri bu dilimde gerçek API'ye taşınmıyorsa fixture ile birleştirilir).
- Yeni basit giriş/kayıt ekranı (route korumasız sayfalar artık JWT gerektirir).
- `Kurslarım` placeholder sayfası, gerçek `GET /api/v1/users/me/courses` ile doldurulur; mevcut `Card`/`Badge`/`ProgressBar` primitive'leri kullanılır (yeni bileşen icat edilmez).
- Token saklama: `localStorage` (basit, bu ölçekte yeterli — NFR-74 kapsamında kurumsal SSO gerekmiyor).

## Hata Yönetimi

Tek hata zarfı backend genelinde tutarlı uygulanır; Fastify global error handler Prisma hatalarını (unique constraint, not found) bu zarfa çevirir. Frontend, `error.message` alanını mevcut `Text`/`Badge` bileşenleriyle gösterir — teknik stack trace kullanıcıya asla sızmaz (NFR-35).

## Test Stratejisi

- **Backend:** Vitest ile auth (kayıt/giriş/RBAC) ve enrollment mantığı için birim testler. Tam %70 kapsam hedefi (NFR-51) bu dilimde iş mantığı katmanıyla sınırlı tutulur; sonraki dilimlerde (sınav puanlama) zorunlu hale gelir.
- **Frontend:** Otomatik test altyapısı henüz yok (CLAUDE.md "Next Steps" ile uyumlu); bu dilimde manuel tarayıcı doğrulaması: kayıt → giriş → dashboard → Kurslarım akışı.

## Ekip Koordinasyonu

- **Tech Lead (ben):** Görev listesini tutar, bağımlılık sırasını yönetir (Mimari sözleşme → DB şema + Backend paralel → Frontend), her agent'ın diff'ini gözden geçirir, sözleşme anlaşmazlıklarını çözer.
- **Software Architect:** `CONTRACT.md` + `ARCHITECTURE.md`'yi ilk yazar (blocking — diğerleri bunu bekler).
- **Database Engineer:** `schema.prisma` + migration + seed — sözleşme onaylandıktan sonra paralel başlar.
- **Backend Developer:** `server/src/` — şema + sözleşme hazır olunca başlar.
- **Frontend Developer:** `web/src/data/` + `Kurslarım` sayfası — sözleşme hazır olunca başlar (backend ile paralel, mock sözleşmeye göre geliştirip sonra gerçek backend'e bağlanabilir).

**Dosya sahipliği çakışmasını önleme:** Her agent yalnızca kendi dizinini değiştirir (`server/prisma/*` ↔ DB Engineer, `server/src/*` ↔ Backend Dev, `web/src/*` ↔ Frontend Dev, `server/CONTRACT.md` + `ARCHITECTURE.md` ↔ Architect). Çapraz dizin değişikliği gerekiyorsa Tech Lead'den geçer.

## Takip Maddeleri (Bu Dilim Dışı)

- Refresh token / oturum iptali (NFR-12 tam uyum)
- E-posta doğrulama (FR-01'in doğrulama kısmı)
- Panel özet metriklerinin gerçek API'ye taşınması (FR-13)
- Sınav, ödev, bildirim modülleri
- Frontend otomatik test altyapısı kurulumu
