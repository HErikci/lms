# Veli bildirimleri

Yönetici, doğum tarihi girilmiş 18 yaşından küçük öğrenciyi aktif `GUARDIAN` hesabına bağlar. Veli panelinde kanal izni etkinleştirildikten sonra rapor e-posta veya SMS ile gönderilebilir. Gönderim anında öğrenci yaşı, iki hesabın aktifliği, rolleri, öğrenci bağlantısı ve kanal izni yeniden kontrol edilir. E-posta alıcısı bağlı veli hesabının e-posta adresidir; SMS alıcısı bağlantıda kaydedilen uluslararası telefon numarasıdır.

## E-posta kurulumu

Sunucu `.env` dosyasında `RESEND_API_KEY` ve `GUARDIAN_EMAIL_FROM` tanımlayın. `GUARDIAN_EMAIL_FROM` için Resend hesabınızda doğrulanmış alan adına ait adres kullanın; örnek: `BTK Akademi <rapor@okulunuz.example>`. Sunucuyu yeniden başlatın. Geliştirme veya test anahtarlarıyla izin verilen alıcılar sağlayıcı hesabına bağlıdır.

Uygulama [Resend Send Email API](https://resend.com/docs/api-reference/emails/send-email) üzerinden düz metin rapor gönderir. Rapor, kurs ilerlemesi, ders notları, paylaşılabilen sınav sonuçları ve son 7 günlük çalışma süresini içerir. Rapor oluşturma katmanı paylaşılmayan sınav notlarını gizler. Her bildirim kimliği için bir `Idempotency-Key` gönderilir; [Resend idempotency belgeleri](https://resend.com/docs/dashboard/emails/idempotency-keys) sağlayıcı davranışını açıklar.

## SMS kurulumu

Sunucu `.env` dosyasında aşağıdaki değerleri tanımlayıp sunucuyu yeniden başlatın:

- `TWILIO_ACCOUNT_SID`: `AC` ile başlayan Twilio hesap kimliği.
- `TWILIO_AUTH_TOKEN`: Twilio hesap erişim anahtarı.
- `TWILIO_SMS_FROM`: SMS gönderebilen Twilio numarası, örnek `+15551234567`.

Veli telefonunu E.164 biçiminde kaydedin, örnek `+905551234567`. Gönderici hesabında hedef ülke için gönderim izni ve geçerli numara gereklidir; deneme hesabında alıcı doğrulaması da gerekebilir. Uygulama [Twilio Messages API](https://www.twilio.com/docs/messaging/api/message-resource) üzerinden HTTPS Basic kimlik doğrulama ve form kodlamasıyla gönderir. SMS, öğrencinin adı, kurs sayısı, tamamlanan ders sayısı, paylaşılan notların ortalaması ve son 7 günlük çalışma süresinin kısa özetini içerir. Türkçe karakterler sağlayıcı tarafından birden fazla SMS segmentine bölünebilir; ücretlendirme Twilio hesabınızda takip edilir.

## Gönderim ve kayıt davranışı

`GuardianNotification` durumları: `PENDING` (gönderim başlatıldı), `SENT` (sağlayıcı isteği kabul etti), `FAILED` (yapılandırma, bağlantı veya sağlayıcı hatası). `SENT`, mesajın telefon veya gelen kutusuna ulaştığının kanıtı değildir; teslimat makbuzu/webhook entegrasyonu bulunmaz. `providerMessageId`, sağlayıcı panelinde inceleme için saklanır. Hatalar güvenli ve genel metinle kaydedilir; sağlayıcının ham hata yanıtı, alıcı ayrıntıları ve erişim anahtarları kaydedilmez.

Her veli–öğrenci bağlantısı için kanallar arasında ortak 60 saniye bekleme süresi vardır. Rezervasyon ve `PENDING` kaydı kısa bir veritabanı işlemi içinde oluşturulur; sağlayıcı çağrısı bu işlemin dışında yapılır. Başarısız denemeler de 60 saniye beklemeyi gerektirir. Eksik sağlayıcı ayarlarında `503 NOTIFICATION_NOT_CONFIGURED` döner ve `FAILED` kaydı tutulur. Uygulama sahte başarı veya konsola gönderim kullanmaz.

Sağlayıcı çağrıları 15 saniyede zaman aşımına uğrar. Otomatik yeniden gönderim yapılmaz: ağ zaman aşımında sağlayıcı mesajı kabul etmiş olabilir; tekrar göndermeden önce sağlayıcı panelini kontrol edin. Sunucu gönderim sırasında kapanırsa kayıt `PENDING` kalabilir; aynı kontrol bu kayıtlar için de uygulanır. Bu sürümde gönderim veli veya yönetici tarafından panel üzerinden başlatılır; zamanlanmış otomatik rapor görevi bulunmaz.

Testler `fetch` işlevini taklit eder; gerçek e-posta/SMS göndermez. Veritabanıyla izin, yaş/rol, bekleme süresi ve başarı/hata kayıtları doğrulanır.
