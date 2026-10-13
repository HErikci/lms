# Claude Code Agent Teams — LMS örnek prompt’ları

Bu dosya [sunumdaki](agent-teams-lms.html) prompt’ların kopyalanabilir sürümüdür. Örnek, bu depodaki `docs/gereksinimler.md` belgesinin FR-26 maddesine dayanır: kurs kataloğunda anahtar kelime, kategori, seviye ve etiketle arama/filtreleme. Mevcut `web/src/features/courses/CoursesPage.tsx` kayıtlı kursları gösterir; katalog için ayrı modül tasarlanır. `server/` kodu şu anda yoktur.

## 0. Etkinleştirme

`~/.claude/settings.json` içindeki `env` alanına ekleyin:

```json
{
  "env": {
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"
  }
}
```

Alternatif olarak PowerShell’de yalnız o oturum için:

```powershell
$env:CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS = '1'
cd D:\btk-akademi\lms
claude
```

Etkileşimli Claude Code oturumunda aşağıdaki prompt’u kullanın. `claude -p` ile açılan etkileşimsiz oturum ekip arkadaşı başlatmaz. Windows’ta varsayılan `in-process` görünümü uygundur.

## 1. Takımı başlatma

```text
Bu depodaki LMS için FR-26 kurs kataloğu arama ve filtreleme özelliğini planla. Önce CLAUDE.md, docs/gereksinimler.md ve ui/DESIGN.md dosyalarını oku. Üç kişilik bir agent team kur: frontend, backend, reviewer.

İlk adımda GET /api/courses için sorgu parametreleri, yanıt alanları ve hata biçimini kısa bir sözleşme olarak öner; benim görebileceğim şekilde özetle. Ardından görev listesi ve bağımlılıkları kur. Frontend yalnız web/src/features/catalog/**, backend yalnız server/src/catalog/** dosyalarını düzenlesin. Reviewer kodu değiştirmeden bulguları docs/catalog-review.md dosyasına yazsın. Paylaşılan route/nav dosyalarını sen, lider olarak, entegrasyonda ele al.

FR-26; boş/yükleniyor/hata durumları; erişilebilirlik; test ve npm run build kabul ölçütleri olsun. Ekip arkadaşlarına eksiksiz görev bağlamı ver, bitmelerini bekle, sonra sonuçları doğrula ve kalan riskleri raporla.
```

## 2. Frontend görevini netleştirme

```text
frontend ekip arkadaşına şu görevi ver: FR-26 için kurs kataloğu arayüzünü web/src/features/catalog/** altında oluştur. Var olan CoursesPage kayıtlı kursları gösteriyor; onu kataloğa dönüştürme. CLAUDE.md ve ui/DESIGN.md kurallarına, ortak bileşenlere ve CSS token'larına uy.

Liderin kararlaştırdığı GET /api/courses sözleşmesini kullan. Anahtar kelime, kategori, seviye ve etiket filtreleri; birlikte filtreleme; yüklenme, boş sonuç ve hata durumları; klavye erişimi ve görünür odak ekle. web/src/routes/index.tsx ve web/src/layout/Sidebar/navItems.ts dosyalarını düzenleme. Tamamlayınca değiştirdiğin dosyaları, doğrulamaları ve entegrasyon için gerekenleri lidere bildir.
```

## 3. Backend görevini netleştirme

```text
backend ekip arkadaşına şu görevi ver: docs/gereksinimler.md içindeki FR-26 ve teknoloji varsayımlarını oku. Henüz sunucu kodu olmayan bu depoda, liderin kararlaştırdığı GET /api/courses sözleşmesine uyan katalog modülünü server/src/catalog/** altında geliştir. Node.js ve SQLite hedefini izle; destekleyici paket/altyapı gerekiyorsa önce lidere bildir.

Anahtar kelime, kategori, seviye, etiket parametrelerini doğrula; birlikte filtrele; boş sonuç ve hata yanıtlarını sözleşmeye uygun üret. Kapsam dışındaki web/** dosyalarına dokunma. Değişiklikleri, çalıştırma adımlarını, test sonuçlarını ve açık bağımlılıkları lidere bildir.
```

## 4. Bağımsız inceleme

```text
reviewer ekip arkadaşına şu görevi ver: FR-26 ve kabul ölçütlerini temel alarak frontend ile backend çıktısını incele. Kod dosyalarını değiştirme. Özellikle filtrelerin birlikte çalışmasını, istemci–API sözleşmesini, boş/yükleniyor/hata durumlarını, klavye erişimini ve doğrulama kanıtlarını kontrol et.

Bulguları önem derecesi, ilgili dosya/satır, beklenen davranış ve önerilen düzeltmeyle docs/catalog-review.md içine yaz. Yanlış alarm olabilecek noktaları ayrıca belirt. Frontend ve backend arkadaşlarına sözleşme uyuşmazlığını doğrudan mesajla bildir; özeti lidere gönder.
```

## 5. İlerleme ve kapanış

```text
frontend'e sor: FR-26 kabul ölçütlerinden hangileri tamamlandı, hangileri bekliyor? Değişen dosyaları ve test kanıtını belirt.
```

```text
backend'e bildir: kategori ve seviye parametreleri API sözleşmesindeki adlarıyla birebir eşleşsin. Sunucu iskeleti ve bağımlılıklar için eksik karar varsa hemen raporla.
```

```text
Ekip arkadaşlarının görevleri bitmeden entegrasyona geçme. Tüm görevleri ve reviewer bulgularını özetle; kritik açıkları gider, sonra kabul ölçütleri için kanıt tablosu ver. web içinde npm run build çalıştır. Test edemediğin noktaları açıkça belirt.
```

## 6. Kendi projen için şablon

```text
[PROJE] içinde [GEREKSİNİM] işini ele al. Önce [BAĞLAM DOSYALARI] dosyalarını oku. [ROL 1], [ROL 2], [REVIEWER] adlı 3 kişilik bir agent team kur.

Önce [ORTAK SÖZLEŞME] üzerinde uzlaş. Her role ayrı dosya alanı ver: [YOLLAR]. Görev bağımlılıklarını ve kabul ölçütlerini yaz. Ekip bitince [TEST KOMUTLARI] çalıştır, bulguları gider ve kanıtları raporla.
```

## Kaynaklar

- [Claude Code — Orchestrate teams of Claude Code sessions](https://code.claude.com/docs/en/agent-teams) (erişim: 13 Ekim 2026)
- Bu depo: `CLAUDE.md`, `docs/gereksinimler.md`, `ui/DESIGN.md`

Agent teams deneysel ve varsayılan olarak kapalıdır. Bir oturumda tek takım bulunur; in-process ekip arkadaşları `/resume` ile geri gelmez. Ekip arkadaşlarının bağlamı ayrıdır, liderin konuşma geçmişini otomatik almazlar. Ekip sayısı arttıkça token kullanımı artar.
