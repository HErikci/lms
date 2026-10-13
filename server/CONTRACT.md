# API Sözleşmesi v1

Taban yol: `/api/v1`. Tüm hata yanıtları: `{ "error": { "code": "string", "message": "Türkçe açıklama" } }`.

## Auth

### POST /api/v1/auth/register
İstek: `{ "email": string, "password": string, "name": string }`
200: `{ "user": { "id": string, "email": string, "name": string, "role": "STUDENT" }, "token": string }`
409: email zaten kayıtlı → `{ "error": { "code": "EMAIL_TAKEN", "message": "Bu e-posta ile zaten bir hesap var." } }`

### POST /api/v1/auth/login
İstek: `{ "email": string, "password": string }`
200: `{ "user": { "id", "email", "name", "role" }, "token": string }`
401: `{ "error": { "code": "INVALID_CREDENTIALS", "message": "E-posta veya şifre hatalı." } }`

### GET /api/v1/auth/me
Header: `Authorization: Bearer <token>`
200: `{ "user": { "id", "email", "name", "role" } }`
401: token yok/geçersiz → `{ "error": { "code": "UNAUTHORIZED", "message": "Giriş yapmanız gerekiyor." } }`

## Courses

### GET /api/v1/courses?category=&level=&tag=&q=
200: `{ "courses": [{ "id", "title", "description", "category", "level", "tags": string[], "accessMode", "status" }] }`

### GET /api/v1/courses/:id
200: `{ "course": { ...yukarıdaki alanlar, "modules": [{ "id", "title", "order", "lessons": [{ "id", "title", "order", "status" }] }] } }`
404: `{ "error": { "code": "NOT_FOUND", "message": "Kurs bulunamadı." } }`

### POST /api/v1/courses (rol: INSTRUCTOR, ADMIN)
İstek: `{ "title", "description", "category", "level", "tags": string[], "accessMode": "SEQUENTIAL"|"FREE" }`
201: `{ "course": { ... } }`
403: yetkisiz rol → `{ "error": { "code": "FORBIDDEN", "message": "Bu işlem için yetkiniz yok." } }`

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

### GET /api/v1/users/me/courses
200: `{ "courses": [{ "id", "title", "category", "level", "accessMode" }] }`
