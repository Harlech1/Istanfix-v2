# **ISTANFIX PROJE FİNAL RAPORU**

## 1. Proje Genel Bakış

Istanfix, İstanbul genelindeki kamu altyapı sorunlarının bildirilmesini ve takip edilmesini sağlayan, veritabanı tabanlı bir enformasyon sistemidir. Sistem, vatandaşların bozuk sokak lambaları, çukurlar veya zarar görmüş banklar gibi sorunları bildirmesine; ilgili kamu görevlilerinin de bu bildirimlerin durumunu güncellemesine ve kullanıcılarla iletişim kurmasına imkân tanır.

## 2. Ayrıntılı Gereksinimler

### İşlevsel Gereksinimler

1. **Kullanıcı Yönetimi**

   * E-posta ve parola ile kullanıcı kaydı
   * Kullanıcı kimlik doğrulama (giriş/çıkış)
   * Farklı rollerin desteklenmesi (normal kullanıcı, kamu görevlisi)
   * Kamu görevlisi doğrulaması için özel kod kullanımı

2. **Rapor Yönetimi**

   * Yeni altyapı sorun raporu oluşturma
   * Sorunların görsel belgelendirilmesi için görsel yükleme
   * Bildirilen tüm sorunları filtreleyerek görüntüleme
   * Rapor durumu güncelleme (açık, üzerinde çalışılıyor, çözüldü)
   * Rapor silme (raporu oluşturan kullanıcı veya kamu görevlileri)

3. **Yorum Sistemi**

   * Raporlara yorum ekleme
   * Raporlardaki yorumları görüntüleme
   * Yorum silme (yorumu yazan kullanıcı veya kamu görevlileri)

4. **Konum Servisleri**

   * Raporlar için coğrafi konum verisi alma
   * Harita üzerinde rapor konumunun gösterimi
   * Raporları ilçe bazında organize etme

5. **UI/UX Gereksinimleri**

   * Mobil ve masaüstü için duyarlı (responsive) tasarım
   * Karanlık mod desteği
   * Durum göstergeleri ile kullanıcı dostu arayüz
   * Kullanıcı eylemleri için gerçek zamanlı geri bildirim

### Fonksiyonel Olmayan Gereksinimler

1. **Güvenlik**

   * Parola karma (hash) mekanizması
   * Girdi doğrulama
   * Rol tabanlı erişim kontrolü
   * Güvenli dosya yükleme

2. **Kullanılabilirlik**

   * Sezgisel gezinme
   * Tutarlı tasarım dili
   * Doğru form doğrulama ve hata mesajları

## 3. Veritabanı Tasarımı

### Varlık-İlişki (ER) Diyagramı

```
+----------+       +-----------+       +-----------+
|   Users  |       |  Reports  |       | Comments  |
+----------+       +-----------+       +-----------+
| id (PK)  |<------|  user_id  |       | id (PK)   |
| name     |       |  id (PK)  |<------| report_id |
| email    |       |  category |       | user_id   |
| password |       |  district |       | content   |
| role     |       |  address  |       | created_at|
| created_at       |  description      +-----------+
+----------+       |  latitude |
                   |  longitude|
                   |  image_path|
                   |  status   |
                   |  created_at|
                   |  updated_at|
                   +-----------+
```

### İlişkisel Şema

1. **Users Tablosu**

   * `id` (Birincil Anahtar, Tamsayı, Otomatik artan)
   * `name` (Metin, Boş olamaz)
   * `email` (Metin, Boş olamaz, Benzersiz)
   * `hashed_password` (Metin, Boş olamaz)
   * `profile_photo_url` (Metin, Boş olabilir)
   * `role` (Metin, Boş olamaz, Varsayılan 'user')
   * `created_at` (Tarih-Saat, Varsayılan Geçerli Zaman Damgası)

2. **Reports Tablosu**

   * `id` (Birincil Anahtar, Tamsayı, Otomatik artan)
   * `user_id` (Yabancı Anahtar → Users.id, Boş olabilir, silindiğinde NULL)
   * `category` (Metin, Boş olamaz)
   * `district` (Metin, Boş olamaz)
   * `address` (Metin, Boş olamaz)
   * `description` (Metin, Boş olamaz)
   * `latitude` (Ondalık, Boş olabilir)
   * `longitude` (Ondalık, Boş olabilir)
   * `image_path` (Metin, Boş olabilir)
   * `status` (Metin, Boş olamaz, Varsayılan 'open')
   * `created_at` (Tarih-Saat, Varsayılan Geçerli Zaman Damgası)
   * `updated_at` (Tarih-Saat, Varsayılan Geçerli Zaman Damgası)

3. **Comments Tablosu**

   * `id` (Birincil Anahtar, Tamsayı, Otomatik artan)
   * `report_id` (Yabancı Anahtar → Reports.id, Boş olamaz, Cascade)
   * `user_id` (Yabancı Anahtar → Users.id, Boş olamaz, Cascade)
   * `content` (Metin, Boş olamaz)
   * `created_at` (Tarih-Saat, Varsayılan Geçerli Zaman Damgası)

### Fonksiyonel Bağımlılıklar

**Users Tablosu**

* id → name, email, hashed\_password, profile\_photo\_url, role, created\_at
* email → id (email benzersiz)

**Reports Tablosu**

* id → user\_id, category, district, address, description, latitude, longitude, image\_path, status, created\_at, updated\_at

**Comments Tablosu**

* id → report\_id, user\_id, content, created\_at

### Normalleştirme Analizi

Şema hâlihazırda Üçüncü Normal Form’dadır (3NF) çünkü:

1. **1NF**: Tüm sütunlar atomiktir, tekrar eden grup yoktur.
2. **2NF**: Tüm anahtar-dışı sütunlar, tam olarak birincil anahtara bağlıdır.
3. **3NF**: Hiçbir anahtar-dışı sütun, transitif olarak birincil anahtara bağlı değildir.

## 4. SQL Deyimleri

### DDL (CREATE TABLE Deyimleri)

```sql
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    hashed_password TEXT NOT NULL,
    profile_photo_url TEXT,
    role TEXT NOT NULL DEFAULT 'user',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT NOT NULL,
    district TEXT NOT NULL,
    address TEXT NOT NULL,
    description TEXT NOT NULL,
    latitude REAL,
    longitude REAL,
    image_path TEXT,
    status TEXT NOT NULL DEFAULT 'open',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    user_id INTEGER,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    report_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

### Tetikleyiciler (Triggers)

```sql
CREATE TRIGGER IF NOT EXISTS update_reports_updated_at
AFTER UPDATE ON reports
FOR EACH ROW
BEGIN
    UPDATE reports SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
END;
```

### Örnek SQL Sorguları

#### SELECT Sorguları

```sql
-- Kullanıcı bilgileri ile birlikte tüm raporları getir
SELECT r.*, u.name as user_name, u.profile_photo_url as user_photo_url 
FROM reports r
LEFT JOIN users u ON r.user_id = u.id
ORDER BY r.created_at DESC;

-- Belirli bir rapora ait yorumları getir
SELECT c.*, u.name as user_name, u.profile_photo_url as user_photo_url, u.role as user_role
FROM comments c
LEFT JOIN users u ON c.user_id = u.id
WHERE c.report_id = ?
ORDER BY c.created_at ASC;
```

#### INSERT Sorguları

```sql
-- Yeni kullanıcı oluştur
INSERT INTO users (name, email, hashed_password, profile_photo_url, role) 
VALUES (?, ?, ?, ?, ?);

-- Yeni rapor oluştur
INSERT INTO reports (category, district, address, description, latitude, longitude, status, image_path, user_id) 
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);

-- Yorum ekle
INSERT INTO comments (report_id, user_id, content)
VALUES (?, ?, ?);
```

#### UPDATE Sorguları

```sql
-- Rapor durumunu güncelle
UPDATE reports SET status = ?, updated_at = CURRENT_TIMESTAMP 
WHERE id = ?;
```

#### DELETE Sorguları

```sql
-- Rapor sil
DELETE FROM reports WHERE id = ?;

-- Yorum sil
DELETE FROM comments WHERE id = ?;
```

## 5. Uygulama Mimarisi

### Ön Yüz (Frontend)

Istanfix’in ön yüzü, vanilla JavaScript, HTML ve CSS kullanarak istemci tarafında (client-side rendered) çalışır. Temel bileşenler:

1. **Kimlik Doğrulama Modülü**

   * Giriş/Kayıt formları
   * localStorage ile oturum yönetimi
   * Rol tabanlı arayüz öğeleri

2. **Raporlar Modülü**

   * Filtrelenebilir rapor listesi
   * Rapor oluşturma formu
   * Durum güncellemeleri
   * Görsel yükleme
   * Konum verisi yakalama

3. **Yorumlar Modülü**

   * Her rapor için yorum listesi
   * Yorum gönderme
   * Yorum silme

4. **UI Bileşenleri**

   * Karanlık mod anahtarı
   * Duyarlı yerleşim
   * Durum göstergeleri
   * Kullanıcı avatarları

### Arka Yüz (Backend)

Arka uç, aşağıdaki bileşenlerle Node.js + Express sunucusu kullanır:

1. **API Uç Noktaları**

   * Kimlik doğrulama
   * Rapor CRUD işlemleri
   * Yorum CRUD işlemleri
   * Statik dosya servisi

2. **Veritabanı Katmanı**

   * Kalıcı depolama için SQLite
   * Bağlantı yönetimi
   * Sorgu çalıştırma

3. **Ara Yazılım (Middleware)**

   * Kimlik doğrulama kontrolü
   * Dosya yükleme (Multer)
   * Hata yönetimi
   * İstek ayrıştırma

### Veri Akışı

1. Kullanıcı, ön yüz üzerinden istek gönderir.
2. İstek ilgili Express uç noktasına gider.
3. Sunucu, gerekirse SQLite veritabanıyla etkileşime geçerek isteği işler.
4. Yanıt istemciye döner.
5. Ön yüz, yanıtı alarak arayüzü günceller.

## 6. Kullanılan Teknolojiler

### Ön Yüz

* HTML5
* CSS3 (tema için CSS değişkenleri)
* Vanilla JavaScript
* localStorage ile istemci tarafı veri kalıcılığı

### Arka Yüz

* Node.js
* Express.js
* SQLite3
* bcryptjs (parola karması)
* Multer (dosya yükleme)

### Geliştirme Araçları

* Git (sürüm kontrolü)
* npm (paket yönetimi)

## 7. Gerçekleştirilen Özellikler

### Kullanıcı Yönetimi

* ✅ Kullanıcı kaydı
* ✅ Kullanıcı kimlik doğrulama
* ✅ Rol tabanlı izinler
* ✅ Kamu görevlisi doğrulaması

### Rapor Yönetimi

* ✅ Rapor oluşturma
* ✅ Rapor görüntüleme
* ✅ Rapor durumu güncelleme (yalnızca kamu görevlileri)
* ✅ Rapor silme (sahibi ve kamu görevlileri)
* ✅ Raporlar için görsel yükleme

### Yorum Sistemi

* ✅ Yorum ekleme
* ✅ Yorum görüntüleme
* ✅ Yorum silme

### UI/UX Özellikleri

* ✅ Duyarlı tasarım
* ✅ Karanlık mod
* ✅ Sezgisel gezinme
* ✅ Durum göstergeleri

## 8. Gelecekteki Geliştirmeler

1. **Gelişmiş Filtreleme**

   * Tarih, durum ve kategoriye göre rapor filtreleme
   * Belirli raporları bulmak için arama işlevi

2. **Kullanıcı Profilleri**

   * Kullanıcıların profil bilgilerini düzenleyebilmesi
   * Kullanıcı etkinlik geçmişini gösteren profil sayfaları

3. **Bildirimler**

   * Durum değişiklikleri için e-posta bildirimleri
   * Uygulama içi bildirim sistemi

4. **Analitik**

   * Kamu görevlileri için istatistik panosu
   * Sorun yoğunluğunu gösteren ısı haritaları

5. **Mobil Uygulama**

   * iOS ve Android için yerel (native) uygulamalar

## 9. Sonuç

Istanfix projesi, İstanbul’daki altyapı sorunlarının bildirilmesi ve takibi için veritabanı tabanlı bir enformasyon sistemini başarıyla hayata geçirmiştir. Uygulama, temiz ve sezgisel bir arayüz ile güçlü arka uç işlevselliğini bir araya getirerek tüm temel gereksinimleri karşılamaktadır. Veritabanı tasarımı, veri ihtiyaçlarını etkin biçimde desteklerken uygun normalizasyonu korur.

Rol tabanlı izinler ve yorum sistemi, vatandaşlar ile kamu görevlileri arasındaki iletişimi güçlendirerek kamu altyapı sorunlarının daha şeffaf ve verimli bir şekilde ele alınmasını sağlar.

---

## Ek: Veritabanı Diyagramı

```
┌─────────────────────┐         ┌──────────────────────┐         ┌─────────────────────┐
│      Users          │         │       Reports        │         │      Comments       │
├─────────────────────┤         ├──────────────────────┤         ├─────────────────────┤
│ id (PK)             │         │ id (PK)              │         │ id (PK)             │
│ name                │         │ user_id (FK)         │         │ report_id (FK)      │
│ email               │         │ category             │         │ user_id (FK)        │
│ hashed_password     │         │ district             │         │ content             │
│ profile_photo_url   │         │ address              │         │ created_at          │
│ role                │         │ description          │         └─────────────────────┘
│ created_at          │         │ latitude             │                  ▲
└─────────────────────┘         │ longitude            │                  │
         ▲                      │ image_path           │                  │
         │                      │ status               │                  │
         │                      │ created_at           │                  │
         │                      │ updated_at           │                  │
         └──────────────────────┼──────────────────────┘                  │
                               │                                          │
                               └──────────────────────────────────────────┘
```

