# Veli modülü

Veli Yönetimi `/yonetim/veliler`, Veli Paneli `/veli` adresindedir. Bu sürümde raporu veli veya yönetici paneldeki gönderim düğmeleriyle talep eder.

## Kullanım

1. Yönetici olarak Kullanıcı Yönetimi'nden öğrencinin doğum tarihini kaydedin. Kayıt sırasında girilen tarih de kullanılabilir; mevcut öğrencilerin tarihleri kendiliğinden tahmin edilmez.
2. Veli için kullanıcı hesabı oluşturun veya mevcut hesaba **Veli** (`GUARDIAN`) rolünü ekleyin. Hesap birden fazla role sahipse veli, üst menüden Veli rolüne geçebilir.
3. Veli Yönetimi'nde 18 yaş altındaki aktif öğrenciyi ve veli hesabını seçip bağlantıyı oluşturun. Aynı veli birden fazla çocuğa, bir çocuk birden fazla veliye bağlanabilir.
4. Veli kendi panelinde SMS numarasını ve rapor alma tercihlerini kaydeder. Yönetici de bağlantı oluştururken velinin verdiği kanal iznini kaydedebilir. Varsayılan olarak iki kanal da kapalıdır.
5. **E-posta gönder** veya **SMS gönder** düğmesi raporu bağlı velinin hesabındaki e-posta adresine ya da kayıtlı telefonuna gönderir. Alıcı olarak başka bir hesap veya adres seçilemez.

E-posta, kurs ilerlemesi, ders notları, paylaşılabilen sınav sonuçları ve son 7 takvim günündeki çalışma süresini içerir. SMS aynı bilgilerin kısa özetini içerir. Panelde görünmeyen sınav puanları bildirimde de paylaşılmaz. Gönderim geçmişi bekleyen, sağlayıcının kabul ettiği ve başarısız istekleri gösterir; sağlayıcı kabulü teslimat teyidi değildir.

## Kurulum

Sunucu dizininde bağımlılıkları kurduktan sonra:

```powershell
$env:DATABASE_URL = 'file:./dev.db?connection_limit=1'
npm.cmd run prisma:generate
npm.cmd exec prisma migrate deploy
```

Normal çalıştırma için `server/.env.example` dosyasını `server/.env` olarak kopyalayıp veritabanı, JWT ve kullanılacak bildirim sağlayıcısını yapılandırın. E-posta için `RESEND_API_KEY` ve `GUARDIAN_EMAIL_FROM`; SMS için `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` ve `TWILIO_SMS_FROM` gereklidir. [Bildirim kurulum dokümanı](../server/GUARDIAN_NOTIFICATIONS.md) ayrıntıları açıklar.

## Erişim ve doğrulama

Yalnızca yönetici veli bağlantısı kurabilir veya kaldırabilir. Veli başka öğrencinin raporuna, tercihlerine veya gönderim geçmişine erişemez. Öğrencinin 18. doğum gününde, doğum tarihi kaldırıldığında, öğrenci/veli rolü geri alındığında, hesap devre dışı bırakıldığında veya bağlantı kaldırıldığında erişim tekrar yapılan denetimle kesilir. Yaş, uygulamanın takvim saat dilimine göre hesaplanır (varsayılan `Europe/Istanbul`). Doğum tarihini sonradan değiştirme yetkisi yöneticidedir.

Her bağlantı için iki kanalın ortak 60 saniyelik gönderim sınırı vardır. Eksik sağlayıcı ayarı veya sağlayıcı hatası başarılı gönderim olarak gösterilmez. Testler gerçek mesaj göndermez.

```powershell
# server dizini
npm.cmd test
npm.cmd run build

# web dizini
npm.cmd run typecheck
npm.cmd run build
```
