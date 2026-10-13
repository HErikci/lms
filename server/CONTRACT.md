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
200: `{ "courses": [{ "id", "title", "description", "category", "level", "tags": string[], "accessMode", "status" }] }`
Not: Varsayılan olarak yalnızca `status: PUBLISHED` kurslar listelenir. Giriş yapmış kullanıcı `ADMIN` ise bu filtre uygulanmaz ve tüm durumlardaki kurslar listelenir (token opsiyonel; `Authorization` header'ı yoksa anonim davranış değişmez).

### GET /api/v1/courses/:id
200: `{ "course": { ...yukarıdaki alanlar, "isEnrolled": boolean, "modules": [{ "id", "title", "order", "lessons": [{ "id", "title", "description": string|null, "contentType", "contentUrl": string|null, "order", "status" }] }] } }`
Not: `isEnrolled`, giriş yapmış kullanıcının bu kursa kayıtlı olup olmadığını belirtir (giriş yapılmamışsa/anonim ise `false`). Kurs sahibi `INSTRUCTOR` veya `ADMIN` için her zaman tam `modules` listesi döner. Diğer tüm kullanıcılar için (kayıtlı olmayan öğrenciler ve anonim ziyaretçiler dahil) `isEnrolled: false` olduğunda `modules: []` döner — kurs başlığı/açıklaması gibi alanlar her durumda döner.
404: `{ "error": { "code": "NOT_FOUND", "message": "Kurs bulunamadı." } }`

### POST /api/v1/courses (rol: INSTRUCTOR, ADMIN)
İstek: `{ "title", "description", "category", "level", "tags": string[], "accessMode": "SEQUENTIAL"|"FREE" }`
201: `{ "course": { ... } }`
403: yetkisiz rol → `{ "error": { "code": "FORBIDDEN", "message": "Bu işlem için yetkiniz yok." } }`

### PATCH /api/v1/courses/:id (yetki: ADMIN veya kursun sahibi INSTRUCTOR)
Header: `Authorization: Bearer <token>`
İstek: `{ "title"?, "description"?, "category"?, "level"?, "tags"?: string[], "accessMode"?: "SEQUENTIAL"|"FREE", "status"?: "DRAFT"|"PUBLISHED" }` (tüm alanlar opsiyonel)
200: `{ "course": { "id", "title", "description", "category", "level", "tags": string[], "accessMode", "status" } }`
403: sahibi olmayan eğitmen veya başka rol → `{ "error": { "code": "FORBIDDEN", "message": "Bu işlem için yetkiniz yok." } }`
404: `{ "error": { "code": "NOT_FOUND", "message": "Kurs bulunamadı." } }`

### DELETE /api/v1/courses/:id (yetki: ADMIN veya kursun sahibi INSTRUCTOR)
Header: `Authorization: Bearer <token>`
Kursu ve ilişkili tüm modülleri, dersleri ve kayıtları (cascade ile) siler.
200: `{ "success": true }`
403: `{ "error": { "code": "FORBIDDEN", "message": "Bu işlem için yetkiniz yok." } }`
404: `{ "error": { "code": "NOT_FOUND", "message": "Kurs bulunamadı." } }`

### GET /api/v1/courses/:courseId/students (yetki: ADMIN veya kursun sahibi INSTRUCTOR)
Header: `Authorization: Bearer <token>`
200: `{ "students": [{ "id", "name", "email", "enrolledAt", "method" }] }` (`enrolledAt` artan sırada)
403: `{ "error": { "code": "FORBIDDEN", "message": "Bu işlem için yetkiniz yok." } }`
404: `{ "error": { "code": "NOT_FOUND", "message": "Kurs bulunamadı." } }`

### DELETE /api/v1/courses/:courseId/students/:userId (yetki: ADMIN veya kursun sahibi INSTRUCTOR)
Header: `Authorization: Bearer <token>`
Belirtilen kullanıcının bu kurstaki kaydını siler (kayıttan çıkarma).
200: `{ "success": true }`
403: `{ "error": { "code": "FORBIDDEN", "message": "Bu işlem için yetkiniz yok." } }`
404: kurs yoksa → `{ "error": { "code": "NOT_FOUND", "message": "Kurs bulunamadı." } }`
404: kayıt yoksa → `{ "error": { "code": "ENROLLMENT_NOT_FOUND", "message": "Kayıt bulunamadı." } }`

## Modules / Lessons

İçerik türleri (`contentType`), tam olarak şu 5 değerden biri olmalıdır: `"VIDEO_YOUTUBE"`, `"DOCUMENT"`, `"QUIZ"`, `"LINK"`, `"TEXT"`. Belirtilmezse varsayılan `"DOCUMENT"`'tir.
400: geçersiz `contentType` → `{ "error": { "code": "INVALID_CONTENT_TYPE", "message": "Geçersiz içerik türü." } }`

### POST /api/v1/courses/:courseId/modules (rol: INSTRUCTOR, ADMIN; yetki: ADMIN veya kursun sahibi INSTRUCTOR)
İstek: `{ "title": string, "order": number }`
201: `{ "module": { "id", "courseId", "title", "order" } }`
403/404: aşağıdaki PATCH/DELETE ile aynı kurallar.

### PATCH /api/v1/modules/:id (yetki: ADMIN veya kursun sahibi INSTRUCTOR)
Header: `Authorization: Bearer <token>`
İstek: `{ "title"?, "order"? }` (tüm alanlar opsiyonel; gönderilmeyen alanlar değişmeden kalır)
200: `{ "module": { "id", "courseId", "title", "order" } }`
403: `{ "error": { "code": "FORBIDDEN", "message": "Bu kursu düzenleme yetkiniz yok." } }`
404: `{ "error": { "code": "NOT_FOUND", "message": "Modül bulunamadı." } }`

### DELETE /api/v1/modules/:id (yetki: ADMIN veya kursun sahibi INSTRUCTOR)
Header: `Authorization: Bearer <token>`
Modülü ve ilişkili tüm dersleri (cascade ile) siler.
200: `{ "success": true }`
403/404: yukarıdaki PATCH ile aynı.

### POST /api/v1/modules/:moduleId/lessons (rol: INSTRUCTOR, ADMIN; yetki: ADMIN veya kursun sahibi INSTRUCTOR)
İstek: `{ "title": string, "order": number, "status": "DRAFT"|"PUBLISHED", "description"?: string|null, "contentType"?: string, "contentUrl"?: string|null }`
201: `{ "lesson": { "id", "moduleId", "title", "description": string|null, "contentType", "contentUrl": string|null, "order", "status" } }`
400/403/404: aşağıdaki PATCH ile aynı kurallar.

### PATCH /api/v1/lessons/:id (yetki: ADMIN veya dersin bağlı olduğu kursun sahibi INSTRUCTOR)
Header: `Authorization: Bearer <token>`
İstek: `{ "title"?, "order"?, "status"?, "description"?: string|null, "contentType"?, "contentUrl"?: string|null }` (tüm alanlar opsiyonel; gönderilmeyen alanlar değişmeden kalır)
200: `{ "lesson": { "id", "moduleId", "title", "description", "contentType", "contentUrl", "order", "status" } }`
400: `{ "error": { "code": "INVALID_CONTENT_TYPE", "message": "Geçersiz içerik türü." } }`
403: `{ "error": { "code": "FORBIDDEN", "message": "Bu kursu düzenleme yetkiniz yok." } }`
404: `{ "error": { "code": "NOT_FOUND", "message": "Ders bulunamadı." } }`

### DELETE /api/v1/lessons/:id (yetki: ADMIN veya dersin bağlı olduğu kursun sahibi INSTRUCTOR)
Header: `Authorization: Bearer <token>`
200: `{ "success": true }`
403/404: yukarıdaki PATCH ile aynı.

## Enrollments

### POST /api/v1/courses/:courseId/enroll (giriş yapmış herhangi bir rol: STUDENT, INSTRUCTOR, ADMIN)
İstek: `{ "method": "OPEN"|"INVITE_CODE"|"ADMIN_ASSIGNED" }`
201: `{ "enrollment": { "id", "userId", "courseId", "method", "enrolledAt" } }`
404: kurs yoksa veya `status !== "PUBLISHED"` ise (taslak kurslara kayıt engellenir; sahibi olmayan biri "yok" ile "henüz yayınlanmadı" durumunu ayırt edemez) → `{ "error": { "code": "NOT_FOUND", "message": "Kurs bulunamadı." } }`
409: zaten kayıtlı → `{ "error": { "code": "ALREADY_ENROLLED", "message": "Bu kursa zaten kayıtlısınız." } }`

## Users

### PATCH /api/v1/users/me
Header: `Authorization: Bearer <token>`
İstek: `{ "name"?: string, "avatarUrl"?: string|null, "locale"?: string }` (tüm alanlar opsiyonel; hiçbiri gönderilmezse mevcut kullanıcı değişmeden döner)
200: `{ "user": { "id", "email", "name", "role", "avatarUrl", "locale", "createdAt" } }`
400: desteklenmeyen `locale` → `{ "error": { "code": "INVALID_LOCALE", "message": "Geçersiz dil seçeneği. Desteklenenler: tr, en." } }`
401: token yok/geçersiz → `{ "error": { "code": "UNAUTHORIZED", "message": "Giriş yapmanız gerekiyor." } }`

### GET /api/v1/users/me/courses
200: `{ "courses": [{ "id", "title", "category", "level", "accessMode" }] }`
