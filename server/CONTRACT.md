# API Sözleşmesi v1

Taban yol: `/api/v1`. Tüm hata yanıtları: `{ "error": { "code": "string", "message": "Türkçe açıklama" } }`.

## Auth

### POST /api/v1/auth/register
İstek: `{ "email": string, "password": string, "name": string }`
200: `{ "user": { "id": string, "email": string, "name": string, "role": "STUDENT", "avatarUrl": string|null, "locale": string, "createdAt": string }, "token": string }`
409: email zaten kayıtlı → `{ "error": { "code": "EMAIL_TAKEN", "message": "Bu e-posta ile zaten bir hesap var." } }`

### POST /api/v1/auth/login
İstek: `{ "email": string, "password": string }`
200: `{ "user": { "id", "email", "name", "role", "avatarUrl", "locale", "createdAt" }, "token": string }`
401: `{ "error": { "code": "INVALID_CREDENTIALS", "message": "E-posta veya şifre hatalı." } }`

### GET /api/v1/auth/me
Header: `Authorization: Bearer <token>`
200: `{ "user": { "id", "email", "name", "role", "avatarUrl", "locale", "createdAt" } }`
401: token yok/geçersiz → `{ "error": { "code": "UNAUTHORIZED", "message": "Giriş yapmanız gerekiyor." } }`

## Courses

### GET /api/v1/courses?category=&level=&tag=&q=
200: `{ "courses": [{ "id", "title", "description", "category", "level", "tags": string[], "accessMode", "status", "instructors": [{ "id", "name", "avatarUrl": string|null, "position" }] }] }`
Not: `instructors` kursa atanmış eğitmenleri `position` (1 = baş eğitmen) sırasıyla verir; 0 eğitmen olabilir (`[]`). E-posta asla dönmez. Eski tekil eğitmen alanı (`instructorId`) kaldırılmıştır. Aynı `instructors` alanı detay, POST ve PATCH yanıtlarındaki `course` nesnesinde de bulunur.
Not: Varsayılan olarak yalnızca `status: PUBLISHED` kurslar listelenir. Giriş yapmış kullanıcı `ADMIN` ise bu filtre uygulanmaz ve tüm durumlardaki kurslar listelenir (token opsiyonel; `Authorization` header'ı yoksa anonim davranış değişmez).

### GET /api/v1/courses/:id
200: `{ "course": { ...yukarıdaki alanlar, "isEnrolled": boolean, "modules": [{ "id", "title", "order", "lessons": [{ "id", "title", "description": string|null, "contentType", "contentUrl": string|null, "order", "status" }] }] } }`
Not: Kullanıcı kayıtlıysa (`isEnrolled: true`) yanıtta ayrıca `"progress": { "courseId", "percent", "completedLessonIds": string[], "completedCount", "totalLessons" }` alanı bulunur; aksi halde bu alan hiç yer almaz (kursa atanmış INSTRUCTOR ve ADMIN için `isEnrolled` her zaman `false` olduğundan `progress` yoktur).
Not: `isEnrolled`, giriş yapmış kullanıcının bu kursa kayıtlı olup olmadığını belirtir (giriş yapılmamışsa/anonim ise `false`). Kursa atanmış `INSTRUCTOR` veya `ADMIN` için her zaman tam `modules` listesi döner. Diğer tüm kullanıcılar için (kayıtlı olmayan öğrenciler ve anonim ziyaretçiler dahil) `isEnrolled: false` olduğunda `modules: []` döner — kurs başlığı/açıklaması gibi alanlar her durumda döner.
404: `{ "error": { "code": "NOT_FOUND", "message": "Kurs bulunamadı." } }`

### POST /api/v1/courses (rol: INSTRUCTOR, ADMIN)
İstek: `{ "title", "description", "category", "level", "tags": string[], "accessMode": "SEQUENTIAL"|"FREE", "instructorIds"?: string[] }`
201: `{ "course": { ..., "instructors": [...] } }`
Not: Aktif rol `INSTRUCTOR` ise oluşturan kişi otomatik olarak 1. sıraya atanır ve `instructorIds` yok sayılır. `ADMIN` için `instructorIds` (sırasıyla 1..N, tekrarlar atlanır) verilebilir; verilmezse kurs eğitmensiz oluşur.
400: `instructorIds` içinde bilinmeyen kullanıcı → `USER_NOT_FOUND`; INSTRUCTOR rolü olmayan kullanıcı → `USER_NOT_INSTRUCTOR` (kurs oluşturulmaz)
403: yetkisiz rol → `{ "error": { "code": "FORBIDDEN", "message": "Bu işlem için yetkiniz yok." } }`

### PATCH /api/v1/courses/:id (yetki: ADMIN veya kursa atanmış INSTRUCTOR)
Header: `Authorization: Bearer <token>`
İstek: `{ "title"?, "description"?, "category"?, "level"?, "tags"?: string[], "accessMode"?: "SEQUENTIAL"|"FREE", "status"?: "DRAFT"|"PUBLISHED" }` (tüm alanlar opsiyonel)
200: `{ "course": { "id", "title", "description", "category", "level", "tags": string[], "accessMode", "status", "instructors": [...] } }`
Not: PATCH eğitmen atamalarını değiştirmez (bkz. "Course Instructors").
403: kursa atanmamış eğitmen veya başka rol → `{ "error": { "code": "FORBIDDEN", "message": "Bu işlem için yetkiniz yok." } }`
404: `{ "error": { "code": "NOT_FOUND", "message": "Kurs bulunamadı." } }`

### DELETE /api/v1/courses/:id (yetki: ADMIN veya kursa atanmış INSTRUCTOR)
Header: `Authorization: Bearer <token>`
Kursu ve ilişkili tüm modülleri, dersleri ve kayıtları (cascade ile) siler.
200: `{ "success": true }`
403: `{ "error": { "code": "FORBIDDEN", "message": "Bu işlem için yetkiniz yok." } }`
404: `{ "error": { "code": "NOT_FOUND", "message": "Kurs bulunamadı." } }`

### GET /api/v1/courses/:courseId/students (yetki: ADMIN veya kursa atanmış INSTRUCTOR)
Header: `Authorization: Bearer <token>`
200: `{ "students": [{ "id", "name", "email", "enrolledAt", "method" }] }` (`enrolledAt` artan sırada)
403: `{ "error": { "code": "FORBIDDEN", "message": "Bu işlem için yetkiniz yok." } }`
404: `{ "error": { "code": "NOT_FOUND", "message": "Kurs bulunamadı." } }`

### DELETE /api/v1/courses/:courseId/students/:userId (yetki: ADMIN veya kursa atanmış INSTRUCTOR)
Header: `Authorization: Bearer <token>`
Belirtilen kullanıcının bu kurstaki kaydını siler (kayıttan çıkarma).
200: `{ "success": true }`
403: `{ "error": { "code": "FORBIDDEN", "message": "Bu işlem için yetkiniz yok." } }`
404: kurs yoksa → `{ "error": { "code": "NOT_FOUND", "message": "Kurs bulunamadı." } }`
404: kayıt yoksa → `{ "error": { "code": "ENROLLMENT_NOT_FOUND", "message": "Kayıt bulunamadı." } }`

## Course Instructors (Kurs eğitmenleri)

Bir kursun 0..N sıralı eğitmeni olur (`position` 1..N yoğun; 1 = baş eğitmen). "Kursa atanmış INSTRUCTOR" = aktif rolü `INSTRUCTOR` olan ve kursa atanmış kullanıcı; `ADMIN` her kursu yönetebilir. Atamaları yalnızca `ADMIN` yönetir. Eğitmen nesnesi: `{ "id", "name", "avatarUrl": string|null, "position": number }` (e-posta yok). Başarılı yazma işlemleri güncel sıralı liste döner: `{ "instructors": [...] }`.

### GET /api/v1/courses/:courseId/instructors (token opsiyonel)
200: `{ "instructors": [...] }`
404: kurs yoksa veya `DRAFT` olup çağıran kursu yönetemiyorsa → `NOT_FOUND`

### POST /api/v1/courses/:courseId/instructors (rol: ADMIN)
İstek: `{ "userId": string, "position"?: number }` (`position` verilmezse sona eklenir; 1..N+1 aralığına sıkıştırılır, diğerleri kaydırılır)
201: `{ "instructors": [...] }`
400: `USER_NOT_INSTRUCTOR` (kullanıcının `roles` alanında INSTRUCTOR yok), `VALIDATION_ERROR` (userId eksik/geçersiz)
401/403: giriş yok / ADMIN değil
404: `NOT_FOUND` (kurs yok), `USER_NOT_FOUND`
409: `INSTRUCTOR_ALREADY_ASSIGNED`

### DELETE /api/v1/courses/:courseId/instructors/:userId (rol: ADMIN)
Atamayı kaldırır ve kalanları 1..N olarak yeniden numaralar. Son eğitmeni kaldırmak serbesttir.
200: `{ "instructors": [...] }`
404: `NOT_FOUND` (kurs yok), `INSTRUCTOR_NOT_ASSIGNED`

### PUT /api/v1/courses/:courseId/instructors/order (rol: ADMIN)
İstek: `{ "userIds": string[] }` — mevcut atanmış kümeyle birebir aynı olmalı (eksik/fazla/tekrar yok); tek transaction'da uygulanır.
200: `{ "instructors": [...] }`
400: `INVALID_INSTRUCTOR_ORDER`
404: `NOT_FOUND` (kurs yok)

### GET /api/v1/instructors?q= (rol: ADMIN)
`roles` alanında INSTRUCTOR bulunan kullanıcıları listeler (atama seçici için); `q` ad veya e-postada arar.
200: `{ "instructors": [{ "id", "name", "email", "avatarUrl": string|null }] }`

## Modules / Lessons

İçerik türleri (`contentType`), tam olarak şu 5 değerden biri olmalıdır: `"VIDEO_YOUTUBE"`, `"DOCUMENT"`, `"QUIZ"`, `"LINK"`, `"TEXT"`. Belirtilmezse varsayılan `"DOCUMENT"`'tir.
400: geçersiz `contentType` → `{ "error": { "code": "INVALID_CONTENT_TYPE", "message": "Geçersiz içerik türü." } }`

### POST /api/v1/courses/:courseId/modules (rol: INSTRUCTOR, ADMIN; yetki: ADMIN veya kursa atanmış INSTRUCTOR)
İstek: `{ "title": string, "order": number }`
201: `{ "module": { "id", "courseId", "title", "order" } }`
403/404: aşağıdaki PATCH/DELETE ile aynı kurallar.

### PATCH /api/v1/modules/:id (yetki: ADMIN veya kursa atanmış INSTRUCTOR)
Header: `Authorization: Bearer <token>`
İstek: `{ "title"?, "order"? }` (tüm alanlar opsiyonel; gönderilmeyen alanlar değişmeden kalır)
200: `{ "module": { "id", "courseId", "title", "order" } }`
403: `{ "error": { "code": "FORBIDDEN", "message": "Bu kursu düzenleme yetkiniz yok." } }`
404: `{ "error": { "code": "NOT_FOUND", "message": "Modül bulunamadı." } }`

### DELETE /api/v1/modules/:id (yetki: ADMIN veya kursa atanmış INSTRUCTOR)
Header: `Authorization: Bearer <token>`
Modülü ve ilişkili tüm dersleri (cascade ile) siler.
200: `{ "success": true }`
403/404: yukarıdaki PATCH ile aynı.

### POST /api/v1/modules/:moduleId/lessons (rol: INSTRUCTOR, ADMIN; yetki: ADMIN veya kursa atanmış INSTRUCTOR)
İstek: `{ "title": string, "order": number, "status": "DRAFT"|"PUBLISHED", "description"?: string|null, "contentType"?: string, "contentUrl"?: string|null }`
201: `{ "lesson": { "id", "moduleId", "title", "description": string|null, "contentType", "contentUrl": string|null, "order", "status" } }`
400/403/404: aşağıdaki PATCH ile aynı kurallar.

### PATCH /api/v1/lessons/:id (yetki: ADMIN veya dersin bağlı olduğu kursa atanmış INSTRUCTOR)
Header: `Authorization: Bearer <token>`
İstek: `{ "title"?, "order"?, "status"?, "description"?: string|null, "contentType"?, "contentUrl"?: string|null }` (tüm alanlar opsiyonel; gönderilmeyen alanlar değişmeden kalır)
200: `{ "lesson": { "id", "moduleId", "title", "description", "contentType", "contentUrl", "order", "status" } }`
400: `{ "error": { "code": "INVALID_CONTENT_TYPE", "message": "Geçersiz içerik türü." } }`
403: `{ "error": { "code": "FORBIDDEN", "message": "Bu kursu düzenleme yetkiniz yok." } }`
404: `{ "error": { "code": "NOT_FOUND", "message": "Ders bulunamadı." } }`

### DELETE /api/v1/lessons/:id (yetki: ADMIN veya dersin bağlı olduğu kursa atanmış INSTRUCTOR)
Header: `Authorization: Bearer <token>`
200: `{ "success": true }`
403/404: yukarıdaki PATCH ile aynı.

## Enrollments

### POST /api/v1/courses/:courseId/enroll (giriş yapmış herhangi bir rol: STUDENT, INSTRUCTOR, ADMIN)
İstek: `{ "method": "OPEN"|"INVITE_CODE"|"ADMIN_ASSIGNED" }`
201: `{ "enrollment": { "id", "userId", "courseId", "method", "enrolledAt" } }`
404: kurs yoksa veya `status !== "PUBLISHED"` ise (taslak kurslara kayıt engellenir; kursu yönetemeyen biri "yok" ile "henüz yayınlanmadı" durumunu ayırt edemez) → `{ "error": { "code": "NOT_FOUND", "message": "Kurs bulunamadı." } }`
409: zaten kayıtlı → `{ "error": { "code": "ALREADY_ENROLLED", "message": "Bu kursa zaten kayıtlısınız." } }`

## Users

### PATCH /api/v1/users/me
Header: `Authorization: Bearer <token>`
İstek: `{ "name"?: string, "avatarUrl"?: string|null, "locale"?: string }` (tüm alanlar opsiyonel; hiçbiri gönderilmezse mevcut kullanıcı değişmeden döner)
200: `{ "user": { "id", "email", "name", "role", "avatarUrl", "locale", "createdAt" } }`
400: desteklenmeyen `locale` → `{ "error": { "code": "INVALID_LOCALE", "message": "Geçersiz dil seçeneği. Desteklenenler: tr, en." } }`
401: token yok/geçersiz → `{ "error": { "code": "UNAUTHORIZED", "message": "Giriş yapmanız gerekiyor." } }`

### GET /api/v1/users/me/courses
200: `{ "courses": [{ "id", "title", "category", "level", "accessMode", "progress": { "percent": number, "completedCount": number, "totalLessons": number }, "nextLesson": { "id", "title", "contentType", "contentUrl": string|null } | null, "moduleCount": number, "instructors": [{ "id", "name", "avatarUrl": string|null, "position": number }] }] }`
Not: `progress` yalnızca `PUBLISHED` dersler üzerinden hesaplanır; tamamlanan ders yoksa `percent: 0` döner.
Not: `nextLesson` = modüller `order` artan, dersler `order` artan sırayla, kullanıcının henüz tamamlamadığı (`LessonProgress` kaydı olmayan) ilk `PUBLISHED` ders; kursta yayınlanmış ders yoksa veya hepsi tamamlandıysa `null`. `moduleCount` = en az bir `PUBLISHED` dersi olan modül sayısı (boş/yalnızca taslak modüller sayılmaz).
Not: Sıralama: önce `percent` 1..99 olan kurslar (yüksek yüzde önce), sonra `percent` 0, en son `percent` 100; eşitlikte başlığa göre (tr) artan.

## Progress (Kurs tamamlanma oranı)

Tüm uç noktalar giriş gerektirir (herhangi bir rol) ve kullanıcının dersin bağlı olduğu kursa kayıtlı olmasını şart koşar. Yalnızca `status: "PUBLISHED"` dersler sayılır. `percent = totalLessons === 0 ? 0 : Math.round(100 * completedCount / totalLessons)`. `SEQUENTIAL` kurslarda sıralı tamamlama zorunlu değildir (kilit yok).

`progress` nesnesi: `{ "courseId": string, "percent": number, "completedLessonIds": string[], "completedCount": number, "totalLessons": number }` (`completedLessonIds` yalnızca `PUBLISHED` dersleri içerir).

### PUT /api/v1/lessons/:id/completion
Header: `Authorization: Bearer <token>`
Gövde yok (boş gövde `Content-Type: application/json` ile de kabul edilir). Dersi tamamlandı işaretler; idempotent (tekrarında `completedAt` değişmez).
200: `{ "progress": { ... } }`
401: `{ "error": { "code": "UNAUTHORIZED", "message": "Giriş yapmanız gerekiyor." } }`
403: `{ "error": { "code": "NOT_ENROLLED", "message": "Bu kursa kayıtlı değilsiniz." } }`
404: ders yoksa veya `DRAFT` ise → `{ "error": { "code": "NOT_FOUND", "message": "Ders bulunamadı." } }`

### DELETE /api/v1/lessons/:id/completion
Header: `Authorization: Bearer <token>`
Tamamlandı işaretini kaldırır; idempotent (kayıt yoksa da 200).
200: `{ "progress": { ... } }`
401/403/404: PUT ile aynı.

### GET /api/v1/courses/:courseId/progress
Header: `Authorization: Bearer <token>`
200: `{ "progress": { ... } }`
401/403: PUT ile aynı.
404: `{ "error": { "code": "NOT_FOUND", "message": "Kurs bulunamadı." } }`

## Study Activity (Çalışma aktivitesi)

Saklama: ham olay tutulmaz. `StudyActivity` tablosunda (kullanıcı, gün, kurs, kategori) başına tek satır vardır ve her bildirim `seconds` değerini artırır. Gün, `ACTIVITY_TIMEZONE` (varsayılan `Europe/Istanbul`) takvimine göre `YYYY-MM-DD` biçimindedir. Kategori istemciden alınmaz, dersin `contentType` değerinden türetilir: `VIDEO_YOUTUBE` → `VIDEO`, `QUIZ` → `QUIZ`, diğerleri (`DOCUMENT`, `LINK`, `TEXT`) → `READING`. Kurs silinirse kayıtları da silinir.

### POST /api/v1/users/me/activity
Header: `Authorization: Bearer <token>` (giriş yapmış herhangi bir rol; kullanıcı dersin kursuna kayıtlı olmalı)
Body: `{ "lessonId": string, "seconds": number }` (`seconds` pozitif tam sayı; 120'den büyükse 120'ye kırpılır)
İstemci, ders sayfası görünür ve kullanıcı etkinken biriken süreyi yaklaşık 60 saniyede bir ve sayfadan ayrılırken gönderir.
200: `{ "recorded": number }` (kaydedilen saniye)
400: `{ "error": { "code": "VALIDATION_ERROR", "message": "..." } }`
401: `{ "error": { "code": "UNAUTHORIZED", "message": "Giriş yapmanız gerekiyor." } }`
403: `{ "error": { "code": "NOT_ENROLLED", "message": "Bu kursa kayıtlı değilsiniz." } }`
404: `{ "error": { "code": "NOT_FOUND", "message": "Ders bulunamadı." } }` (ders yok veya taslak)

### GET /api/v1/users/me/activity?days=7
Header: `Authorization: Bearer <token>`
`days`: 1–90 arası tam sayı, varsayılan 7. Aralık bugün dahil geriye doğrudur.
200:
```json
{
  "timezone": "Europe/Istanbul",
  "today": "2026-10-13",
  "days": [{ "date": "2026-10-07", "videoSeconds": 0, "quizSeconds": 0, "readingSeconds": 0, "totalSeconds": 0 }],
  "totals": { "todaySeconds": 0, "rangeSeconds": 0, "monthSeconds": 0 },
  "streakDays": 0
}
```
Not: `days` eksiksizdir (çalışılmayan günler 0), eskiden yeniye sıralıdır. `monthSeconds` içinde bulunulan takvim ayının toplamıdır. `streakDays`, bugünden geriye kesintisiz çalışılan gün sayısıdır; bugün henüz çalışılmadıysa dünden itibaren sayılır (en fazla 365).
400: `{ "error": { "code": "VALIDATION_ERROR", "message": "..." } }`
401: `{ "error": { "code": "UNAUTHORIZED", "message": "Giriş yapmanız gerekiyor." } }`

## Quiz Grades (Quiz notları)

Eğitmen/yönetici, `contentType: "QUIZ"` olan bir ders için kursa kayıtlı öğrencilere 0–100 arası tam sayı not girer. Bir öğrenci × ders için tek not tutulur (yeniden notlandırma mevcut notu ezer). `gradedAt` her yazmada (ilk giriş ve güncelleme) şimdiki zamana ayarlanır, `gradedById` notu giren kullanıcıdır (kullanıcı silinirse `null` kalır). Ders silinirse veya öğrenci hesabı silinirse notlar da (cascade) silinir.

Yönetim uç noktaları (ilk üçü) yetki olarak ADMIN veya dersin kursuna atanmış INSTRUCTOR (aktif rol) ister; öğrenciler ve atanmamış eğitmenler `403 FORBIDDEN` alır. Kontrol sırası: 401 (token) → 404 (ders yok; taslak dersler yöneticiler için geçerlidir) → 403 (yetki) → 400 `NOT_A_QUIZ` → gövde doğrulaması → kayıt kontrolü.

Ortak hatalar (ilk üç uç nokta):
401: `{ "error": { "code": "UNAUTHORIZED", "message": "Giriş yapmanız gerekiyor." } }`
403: `{ "error": { "code": "FORBIDDEN", "message": "Bu işlem için yetkiniz yok." } }`
404: `{ "error": { "code": "NOT_FOUND", "message": "Ders bulunamadı." } }`
400: ders `QUIZ` değilse → `{ "error": { "code": "NOT_A_QUIZ", "message": "Bu ders bir quiz değil." } }`

### GET /api/v1/lessons/:lessonId/grades (yetki: ADMIN veya kursa atanmış INSTRUCTOR)
Header: `Authorization: Bearer <token>`
Kursa kayıtlı HER öğrenci için bir satır döner (notu girilmemişse `score` ve `gradedAt` `null`). Satırlar öğrenci adına göre (tr) artan sıralıdır; ad eşitse e-posta. Kayıttan çıkarılmış öğrencilerin (hâlâ not kaydı olsa bile) satırı listelenmez.
200:
```json
{
  "lesson": { "id": "string", "title": "string", "courseId": "string" },
  "grades": [
    {
      "student": { "id": "string", "name": "string", "email": "string", "avatarUrl": "string|null" },
      "score": 85,
      "gradedAt": "2026-10-13T19:40:00.000Z"
    }
  ]
}
```
401/403/404/400: yukarıdaki ortak hatalar.

### PUT /api/v1/lessons/:lessonId/grades/:userId (yetki: ADMIN veya kursa atanmış INSTRUCTOR)
Header: `Authorization: Bearer <token>`
İstek: `{ "score": number }` — `score` zorunlu, 0–100 arası tam sayı olmalıdır (`-1`, `101`, `50.5`, `"80"` ve eksik alan geçersizdir). Not yoksa oluşturur, varsa günceller (upsert); `gradedAt` = şimdi, `gradedById` = çağıran.
200: `{ "grade": { "userId": string, "lessonId": string, "score": number, "gradedAt": string } }`
400: `{ "error": { "code": "VALIDATION_ERROR", "message": "score 0 ile 100 arasında bir tam sayı olmalıdır." } }`
400: `userId` kursa kayıtlı değilse → `{ "error": { "code": "STUDENT_NOT_ENROLLED", "message": "Öğrenci bu kursa kayıtlı değil." } }`
Not: Sistemde hiç bulunmayan bir `userId` de aynı `400 STUDENT_NOT_ENROLLED` yanıtını alır (kullanıcı varlığı sızdırılmaz; `404 USER_NOT_FOUND` dönmez).
401/403/404/400 (`NOT_A_QUIZ`): yukarıdaki ortak hatalar.

### DELETE /api/v1/lessons/:lessonId/grades/:userId (yetki: ADMIN veya kursa atanmış INSTRUCTOR)
Header: `Authorization: Bearer <token>`
Gövde yok. Notu siler; idempotent (not yoksa da 200). Kayıt kontrolü yapılmaz, böylece kayıttan çıkarılmış öğrencinin artık listelenmeyen notu da silinebilir.
200: `{ "deleted": boolean }` (`true`: bir not silindi, `false`: silinecek not yoktu)
401/403/404/400 (`NOT_A_QUIZ`): yukarıdaki ortak hatalar.

### GET /api/v1/users/me/grades
Header: `Authorization: Bearer <token>` (giriş yapmış herhangi bir rol; yalnızca çağıranın kendi notları)
200:
```json
{
  "summary": {
    "averageScore": 80,
    "letterGrade": "BB",
    "level": "İyi",
    "gradeCount": 3,
    "lastScore": 90,
    "trend": 15
  },
  "grades": [
    {
      "lessonId": "string",
      "lessonTitle": "string",
      "courseId": "string",
      "courseTitle": "string",
      "score": 90,
      "gradedAt": "2026-10-13T19:40:00.000Z"
    }
  ]
}
```
Not: `grades` en yeni nottan eskiye (`gradedAt` azalan) sıralıdır; `gradedAt` eşitse `lessonTitle` (tr) artan. Not kaydı olan tüm dersler listelenir (yayın durumu ve güncel kayıt durumu filtrelenmez).
Not: Not yoksa `summary` = `{ "averageScore": null, "letterGrade": null, "level": null, "gradeCount": 0, "lastScore": null, "trend": null }` ve `grades: []` döner.
Not: `averageScore` = `Math.round(tüm notların ortalaması)`. `lastScore` = listedeki ilk (en yeni) notun puanı.
Not: `trend` = `lastScore - Math.round(en yeni not HARİÇ diğer tüm notların ortalaması)`; `gradeCount < 2` ise `null`. Pozitif değer en son notun önceki ortalamanın üstünde, negatif değer altında olduğunu gösterir (örn. notlar 90 (son), 80, 70 → `90 - 75 = +15`).
Not: Harf notu `averageScore` (yuvarlanmış ortalama) üzerinden hesaplanır:

| averageScore | letterGrade |
|---|---|
| ≥ 90 | `AA` |
| ≥ 85 | `BA` |
| ≥ 80 | `BB` |
| ≥ 75 | `CB` |
| ≥ 70 | `CC` |
| ≥ 65 | `DC` |
| ≥ 60 | `DD` |
| ≥ 50 | `FD` |
| < 50 | `FF` |

Not: `level` yine `averageScore` üzerinden: ≥ 85 `"Yüksek"`, ≥ 70 `"İyi"`, ≥ 60 `"Orta"`, aksi halde `"Düşük"`.
401: `{ "error": { "code": "UNAUTHORIZED", "message": "Giriş yapmanız gerekiyor." } }`

## Lesson Feedback (Ders beğeni ve puan)

Saklama: `LessonFeedback` tablosunda (kullanıcı, ders) başına en fazla bir satır vardır (`liked` boolean, `rating` 1–5 veya null). `liked=false` ve `rating=null` olan satır tutulmaz (silinir). Ders veya kullanıcı silinirse satırlar da silinir. Yalnızca YAYINLANMIŞ dersler için geçerlidir; yok veya taslak ders 404 döner.

İki endpoint de aynı yanıtı döner:
`{ "feedback": { "likeCount": number, "ratingCount": number, "ratingAverage": number | null, "mine": { "liked": boolean, "rating": number | null } } }`
`ratingAverage` 1 ondalığa yuvarlanır (örn. (5+4+4)/3 → `4.3`); hiç puan yoksa `null`. `mine` çağıranın satırıdır; yoksa `{ "liked": false, "rating": null }`.

### GET /api/v1/lessons/:lessonId/feedback
Header: `Authorization: Bearer <token>` (yetki: dersin kursuna kayıtlı kullanıcı VEYA ADMIN / kursa atanmış INSTRUCTOR)
200: yukarıdaki yanıt
401: `{ "error": { "code": "UNAUTHORIZED", "message": "Giriş yapmanız gerekiyor." } }`
403: `{ "error": { "code": "NOT_ENROLLED", "message": "Bu kursa kayıtlı değilsiniz." } }`
404: `{ "error": { "code": "NOT_FOUND", "message": "Ders bulunamadı." } }` (ders yok veya taslak)

### PUT /api/v1/lessons/:lessonId/feedback
Header: `Authorization: Bearer <token>` (yalnızca kursa KAYITLI kullanıcılar; kayıtlı olmayan ADMIN/INSTRUCTOR yazamaz → 403)
Body (kısmi): `{ "liked"?: boolean, "rating"?: integer 1..5 | null }`
- En az bir alan gönderilmelidir; `liked` boolean, `rating` 1–5 tam sayı veya `null` olmalıdır (`null` puanı kaldırır). Aksi halde 400 `VALIDATION_ERROR`.
- Gönderilmeyen alanlar mevcut değerini korur.
- Birleşim sonucunda `liked=false` ve `rating=null` ise satır silinir (idempotent); aksi halde oluşturulur/güncellenir.
200: yukarıdaki yanıt (yeniden hesaplanmış)
400/401/403/404: yukarıdaki hata biçimleriyle

## Calendar (Akademik takvim)

Saklama: `CalendarEvent` tablosu. `courseId` null ise genel etkinliktir (herkes görür); doluysa kursa aittir. Kurs silinirse etkinlikleri de silinir; oluşturan kullanıcı silinirse `createdById` null olur. `type`: `lecture` | `lab` | `exam` | `deadline` | `holiday` | `event` (varsayılan `event`).

Tarih biçimi: `allDay=true` etkinlikte `start`/`end` yalnızca tarihtir (`YYYY-MM-DD`, UTC gün başı olarak saklanır); `end` DAHİL DEĞİLDİR (tek günlük etkinlik: `start=2026-10-14`, `end=2026-10-15`). `allDay=false` etkinlikte `start`/`end` `Z` veya ofset içeren ISO tarih-saattir (örn. `2026-10-14T09:00:00.000Z`) ve yanıtta `toISOString()` biçiminde döner.

Etkinlik nesnesi:
```json
{
  "id": "string",
  "title": "string",
  "description": "string | null",
  "type": "lecture",
  "start": "2026-10-14T09:00:00.000Z",
  "end": "2026-10-14T10:30:00.000Z",
  "allDay": false,
  "location": "string | null",
  "course": { "id": "string", "title": "string" },
  "canEdit": true
}
```
Not: `course` genel etkinlikte `null`; `end` yoksa `null`. `canEdit`: ADMIN için her zaman `true`; aktif rolü INSTRUCTOR olan kullanıcı için yalnızca atandığı kursun etkinliklerinde `true`; genel etkinlikler yalnızca ADMIN tarafından düzenlenir; diğerleri için `false`.

### GET /api/v1/calendar/events?from=&to=
Header: `Authorization: Bearer <token>` (giriş yapmış herhangi bir rol)
`from`, `to`: zorunlu; ISO tarih (`YYYY-MM-DD`, UTC gün başı) veya ofsetli tarih-saat. `to > from` ve aralık en fazla 400 gün olmalıdır. Aralık `[from, to)` yarı açıktır.
Kapsam: bitişi olan etkinlik `start < to` ve `end > from` ise; bitişi olmayan etkinlik `from <= start < to` ise dahildir. Çok günlü etkinlik, aralığa yalnızca bir kısmıyla girse de listelenir.
Görünürlük: ADMIN tümünü görür. Diğerleri genel etkinlikleri, kayıtlı oldukları kursların etkinliklerini ve (yalnızca aktif rolü INSTRUCTOR iken) atandıkları kursların etkinliklerini görür.
200: `{ "events": [ <etkinlik>, ... ] }` (`start` artan sıralı)
400: `{ "error": { "code": "VALIDATION_ERROR", "message": "..." } }`
401: `{ "error": { "code": "UNAUTHORIZED", "message": "Giriş yapmanız gerekiyor." } }`

### POST /api/v1/calendar/events
Header: `Authorization: Bearer <token>` (genel etkinlik: yalnızca ADMIN; kurs etkinliği: ADMIN veya kursa atanmış INSTRUCTOR)
Body: `{ "title": string, "type"?: string, "start": string, "end"?: string | null, "allDay"?: boolean, "location"?: string | null, "description"?: string | null, "courseId"?: string | null }`
- `title`: kırpılır, 1–200 karakter. `location` en fazla 200, `description` en fazla 2000 karakter (boş metin `null` olur). `allDay` varsayılan `false`.
- `allDay=true`: `start`/`end` `YYYY-MM-DD` olmalıdır; `end` yoksa `start + 1 gün`; `end > start`.
- `allDay=false`: `start`/`end` ofsetli ISO tarih-saat olmalıdır (ofsetsiz veya yalnız tarih kabul edilmez); `end` opsiyoneldir, verilirse `end > start` ve süre en fazla 31 gündür.
- `courseId` yoksa/`null` ise genel etkinlik.
201: `{ "event": <etkinlik> }`
400: `{ "error": { "code": "VALIDATION_ERROR", "message": "..." } }`
401: `{ "error": { "code": "UNAUTHORIZED", "message": "Giriş yapmanız gerekiyor." } }`
403: `{ "error": { "code": "FORBIDDEN", "message": "Bu işlem için yetkiniz yok." } }`
404: `{ "error": { "code": "NOT_FOUND", "message": "Kurs bulunamadı." } }`

### PATCH /api/v1/calendar/events/:id
Header: `Authorization: Bearer <token>`
Body: POST ile aynı alanların kısmi hali (en az bir alan). Gönderilmeyen alanlar mevcut değerini korur; birleşik sonuç POST kurallarıyla doğrulanır.
- `allDay` değiştirilirse (`false` ↔ `true`) yeni biçime uygun `start` zorunludur; `end` gönderilmezse varsayılana döner (tüm gün: `start + 1 gün`, zamanlı: `null`). `start` olmadan `allDay` değiştirmek 400 `VALIDATION_ERROR` döner.
- Yetki hem mevcut etkinlik için hem (`courseId` değişiyorsa) hedef kurs/genel için gerekir.
200: `{ "event": <etkinlik> }`
400/401/403: yukarıdaki biçimlerle
404: `{ "error": { "code": "NOT_FOUND", "message": "Etkinlik bulunamadı." } }` (hedef kurs yoksa "Kurs bulunamadı.")

### DELETE /api/v1/calendar/events/:id
Header: `Authorization: Bearer <token>` (PATCH ile aynı yetki)
200: `{ "deleted": true }`
401/403: yukarıdaki biçimlerle
404: `{ "error": { "code": "NOT_FOUND", "message": "Etkinlik bulunamadı." } }`
