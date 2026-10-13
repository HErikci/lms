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
200: `{ "course": { ...yukarıdaki alanlar, "modules": [{ "id", "title", "order", "lessons": [{ "id", "title", "order", "status" }] }] } }`
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

### POST /api/v1/courses/:courseId/modules (rol: INSTRUCTOR, ADMIN)
İstek: `{ "title": string, "order": number }`
201: `{ "module": { "id", "courseId", "title", "order" } }`

### POST /api/v1/modules/:moduleId/lessons (rol: INSTRUCTOR, ADMIN)
İstek: `{ "title": string, "order": number, "status": "DRAFT"|"PUBLISHED" }`
201: `{ "lesson": { "id", "moduleId", "title", "order", "status" } }`

## Enrollments

### POST /api/v1/courses/:courseId/enroll (rol: STUDENT)
İstek: `{ "method": "OPEN"|"INVITE_CODE"|"ADMIN_ASSIGNED" }`
201: `{ "enrollment": { "id", "userId", "courseId", "method", "enrolledAt" } }`
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
