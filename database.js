const sqlite3 = require('sqlite3').verbose();
const DB_PATH = './istanfix.db'; // Database file will be created in the root directory

// Connect to SQLite database. 
// The database will be created if it doesn't exist.
const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error('Error opening database', err.message);
    } else {
        console.log('Connected to the Istanfix SQLite database.');
        db.serialize(() => {
            createUsersTable();
            createCategoriesTable();
            createDistrictsTable();
            createNeighborhoodsTable();
            createReportsTable();
            createCommentsTable();
            enableForeignKeys();
            populateDefaultCategories();
            populateDefaultDistricts();
            populateDefaultNeighborhoods();
        });
    }
});

function enableForeignKeys() {
    db.run("PRAGMA foreign_keys = ON;", (err) => {
        if (err) {
            console.error("Error enabling foreign keys:", err.message);
        } else {
            console.log("Foreign key support enabled.");
        }
    });
}

function createUsersTable() {
    const createTableSql = `
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            hashed_password TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'user',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `;
    db.run(createTableSql, (err) => {
        if (err) {
            console.error('Error creating users table', err.message);
        } else {
            console.log('Users table created or already exists.');
        }
    });
}

function createCategoriesTable() {
    const createTableSql = `
        CREATE TABLE IF NOT EXISTS categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            icon TEXT,
            description TEXT
        );
    `;
    db.run(createTableSql, (err) => {
        if (err) {
            console.error('Error creating categories table', err.message);
        } else {
            console.log('Categories table created or already exists.');
        }
    });
}

function createDistrictsTable() {
    const createTableSql = `
        CREATE TABLE IF NOT EXISTS districts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            area_code TEXT
        );
    `;
    db.run(createTableSql, (err) => {
        if (err) {
            console.error('Error creating districts table', err.message);
        } else {
            console.log('Districts table created or already exists.');
        }
    });
}

function createNeighborhoodsTable() {
    const createTableSql = `
        CREATE TABLE IF NOT EXISTS neighborhoods (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            district_id INTEGER NOT NULL,
            postal_code TEXT,
            -- CASCADE: İlçe silindiğinde o ilçeye ait tüm mahalleler otomatik olarak silinir
            -- Bu sayede veritabanında sahipsiz mahalle kaydı kalmaz ve tutarlılık korunur
            FOREIGN KEY (district_id) REFERENCES districts(id) ON DELETE CASCADE,
            UNIQUE(name, district_id)
        );
    `;
    db.run(createTableSql, (err) => {
        if (err) {
            console.error('Error creating neighborhoods table', err.message);
        } else {
            console.log('Neighborhoods table created or already exists.');
        }
    });
}

function createReportsTable() {
    const createTableSql = `
        CREATE TABLE IF NOT EXISTS reports (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            category_id INTEGER NOT NULL,
            district_id INTEGER NOT NULL,
            neighborhood_id INTEGER,
            address TEXT NOT NULL,
            description TEXT NOT NULL,
            latitude REAL,
            longitude REAL,
            image_path TEXT,                         
            status TEXT NOT NULL DEFAULT 'open',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            user_id INTEGER,                          -- Foreign key to the users table
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL, -- If user is deleted, set user_id to NULL
            FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT, -- Prevent category deletion if reports exist
            FOREIGN KEY (district_id) REFERENCES districts(id) ON DELETE RESTRICT, -- Prevent district deletion if reports exist
            FOREIGN KEY (neighborhood_id) REFERENCES neighborhoods(id) ON DELETE SET NULL -- If neighborhood is deleted, set neighborhood_id to NULL
        );
    `;

    db.run(createTableSql, (err) => {
        if (err) {
            console.error('Error creating reports table', err.message);
        } else {
            console.log('Reports table (re)created or already exists with user_id foreign key.');
            // Trigger to update `updated_at` on row update (remains the same)
            const createTriggerSql = `
                CREATE TRIGGER IF NOT EXISTS update_reports_updated_at
                AFTER UPDATE ON reports
                FOR EACH ROW
                BEGIN
                    UPDATE reports SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
                END;
            `;
            db.run(createTriggerSql, (triggerErr) => {
                if (triggerErr) {
                    console.error('Error creating updated_at trigger for reports', triggerErr.message);
                } else {
                    console.log('updated_at trigger for reports table created or already exists.');
                }
            });
        }
    });
}

function createCommentsTable() {
    // Yorumlar tablosu - CASCADE kullanımı:
    // 1. Bir rapor silindiğinde, o rapora ait tüm yorumlar otomatik silinir
    // 2. Bir kullanıcı silindiğinde, o kullanıcının tüm yorumları otomatik silinir
    // Bu yapı, veritabanında "sahipsiz" yorum kalmasını önler ve veri bütünlüğünü korur
    const createTableSql = `
        CREATE TABLE IF NOT EXISTS comments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            report_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            content TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
    `;
    db.run(createTableSql, (err) => {
        if (err) {
            console.error('Error creating comments table', err.message);
        } else {
            console.log('Comments table created or already exists.');
        }
    });
}

function populateDefaultCategories() {
    // Check if categories table is empty
    db.get("SELECT COUNT(*) as count FROM categories", (err, row) => {
        if (err) {
            console.error('Error checking categories count', err.message);
            return;
        }
        
        // Only populate if no categories exist
        if (row.count === 0) {
            const categories = [
                { name: 'pothole', icon: '🕳️', description: 'Road damage like holes and cracks' },
                { name: 'streetlight', icon: '💡', description: 'Issues with street lighting' },
                { name: 'trash', icon: '🗑️', description: 'Garbage and waste issues' },
                { name: 'bench', icon: '🪑', description: 'Problems with public seating' },
                { name: 'water', icon: '💧', description: 'Water-related issues like leaks or flooding' },
                { name: 'sidewalk', icon: '🚶', description: 'Damaged or blocked sidewalks' },
                { name: 'other', icon: '🔧', description: 'Other infrastructure issues' }
            ];
            
            const insertSql = 'INSERT INTO categories (name, icon, description) VALUES (?, ?, ?)';
            
            categories.forEach(category => {
                db.run(insertSql, [category.name, category.icon, category.description], (err) => {
                    if (err) {
                        console.error(`Error inserting category ${category.name}:`, err.message);
                    } else {
                        console.log(`Category ${category.name} inserted successfully.`);
                    }
                });
            });
        }
    });
}

function populateDefaultDistricts() {
    // Check if districts table is empty
    db.get("SELECT COUNT(*) as count FROM districts", (err, row) => {
        if (err) {
            console.error('Error checking districts count', err.message);
            return;
        }
        
        // Only populate if no districts exist
        if (row.count === 0) {
            const districts = [
                { name: 'Adalar', area_code: '34970' },
                { name: 'Arnavutköy', area_code: '34275' },
                { name: 'Ataşehir', area_code: '34758' },
                { name: 'Avcılar', area_code: '34310' },
                { name: 'Bağcılar', area_code: '34200' },
                { name: 'Bahçelievler', area_code: '34180' },
                { name: 'Bakırköy', area_code: '34142' },
                { name: 'Başakşehir', area_code: '34480' },
                { name: 'Bayrampaşa', area_code: '34045' },
                { name: 'Beşiktaş', area_code: '34330' },
                { name: 'Beykoz', area_code: '34820' },
                { name: 'Beylikdüzü', area_code: '34520' },
                { name: 'Beyoğlu', area_code: '34420' },
                { name: 'Büyükçekmece', area_code: '34550' },
                { name: 'Çatalca', area_code: '34540' },
                { name: 'Çekmeköy', area_code: '34782' },
                { name: 'Esenler', area_code: '34220' },
                { name: 'Esenyurt', area_code: '34510' },
                { name: 'Eyüpsultan', area_code: '34050' },
                { name: 'Fatih', area_code: '34080' },
                { name: 'Gaziosmanpaşa', area_code: '34245' },
                { name: 'Güngören', area_code: '34160' },
                { name: 'Kadıköy', area_code: '34710' },
                { name: 'Kağıthane', area_code: '34410' },
                { name: 'Kartal', area_code: '34860' },
                { name: 'Küçükçekmece', area_code: '34290' },
                { name: 'Maltepe', area_code: '34840' },
                { name: 'Pendik', area_code: '34890' },
                { name: 'Sancaktepe', area_code: '34785' },
                { name: 'Sarıyer', area_code: '34460' },
                { name: 'Silivri', area_code: '34570' },
                { name: 'Sultanbeyli', area_code: '34935' },
                { name: 'Sultangazi', area_code: '34260' },
                { name: 'Şile', area_code: '34980' },
                { name: 'Şişli', area_code: '34360' },
                { name: 'Tuzla', area_code: '34940' },
                { name: 'Ümraniye', area_code: '34760' },
                { name: 'Üsküdar', area_code: '34660' },
                { name: 'Zeytinburnu', area_code: '34020' }
            ];
            
            const insertSql = 'INSERT INTO districts (name, area_code) VALUES (?, ?)';
            
            districts.forEach(district => {
                db.run(insertSql, [district.name, district.area_code], (err) => {
                    if (err) {
                        console.error(`Error inserting district ${district.name}:`, err.message);
                    } else {
                        console.log(`District ${district.name} inserted successfully.`);
                    }
                });
            });
        }
    });
}

function populateDefaultNeighborhoods() {
    // Check if neighborhoods table is empty
    db.get("SELECT COUNT(*) as count FROM neighborhoods", (err, row) => {
        if (err) {
            console.error('Error checking neighborhoods count', err.message);
            return;
        }
        
        // Only populate if no neighborhoods exist
        if (row.count === 0) {
            // Get district IDs first to ensure we reference correct foreign keys
            db.all("SELECT id, name FROM districts", [], (err, districts) => {
                if (err) {
                    console.error('Error fetching districts for neighborhood population', err.message);
                    return;
                }
                
                // Create a map of district names to IDs for easy reference
                const districtMap = {};
                districts.forEach(district => {
                    districtMap[district.name] = district.id;
                });
                
                // Data from https://atlasbig.com.tr/istanbulun-mahalleleri
                
                // Küçükçekmece mahalleleri
                if (districtMap['Küçükçekmece']) {
                    const kucukcekmeceMahalleleri = [
                        { name: 'Atakent', postal_code: '34307' },
                        { name: 'Halkalı Merkez', postal_code: '34303' },
                        { name: 'İnönü', postal_code: '34295' },
                        { name: 'Kanarya', postal_code: '34290' },
                        { name: 'Mehmet Akif', postal_code: '34307' },
                        { name: 'Cumhuriyet', postal_code: '34290' },
                        { name: 'Atatürk', postal_code: '34303' },
                        { name: 'İstasyon', postal_code: '34295' }
                    ];
                    insertNeighborhoods(kucukcekmeceMahalleleri, districtMap['Küçükçekmece']);
                }
                
                // Bahçelievler mahalleleri
                if (districtMap['Bahçelievler']) {
                    const bahcelievlerMahalleleri = [
                        { name: 'Zafer', postal_code: '34180' },
                        { name: 'Kocasinan Merkez', postal_code: '34186' },
                        { name: 'Soğanlı', postal_code: '34182' },
                        { name: 'Siyavuşpaşa', postal_code: '34182' },
                        { name: 'Bahçelievler', postal_code: '34188' },
                        { name: 'Şirinevler', postal_code: '34188' },
                        { name: 'Hürriyet', postal_code: '34192' },
                        { name: 'Cumhuriyet', postal_code: '34196' }
                    ];
                    insertNeighborhoods(bahcelievlerMahalleleri, districtMap['Bahçelievler']);
                }
                
                // Beylikdüzü mahalleleri
                if (districtMap['Beylikdüzü']) {
                    const beylikduzuMahalleleri = [
                        { name: 'Adnan Kahveci', postal_code: '34528' },
                        { name: 'Barış', postal_code: '34520' },
                        { name: 'Yakuplu', postal_code: '34524' },
                        { name: 'Büyükşehir', postal_code: '34500' },
                        { name: 'Cumhuriyet', postal_code: '34500' },
                        { name: 'Marmara', postal_code: '34520' }
                    ];
                    insertNeighborhoods(beylikduzuMahalleleri, districtMap['Beylikdüzü']);
                }
                
                // Maltepe mahalleleri
                if (districtMap['Maltepe']) {
                    const maltepeMahalleleri = [
                        { name: 'Zümrütevler', postal_code: '34852' },
                        { name: 'Fındıklı', postal_code: '34844' },
                        { name: 'Bağlarbaşı', postal_code: '34841' },
                        { name: 'Cevizli', postal_code: '34846' },
                        { name: 'Altıntepe', postal_code: '34840' },
                        { name: 'Feyzullah', postal_code: '34843' }
                    ];
                    insertNeighborhoods(maltepeMahalleleri, districtMap['Maltepe']);
                }
                
                // Başakşehir mahalleleri
                if (districtMap['Başakşehir']) {
                    const basaksehirMahalleleri = [
                        { name: 'Kayabaşı', postal_code: '34494' },
                        { name: 'Başak', postal_code: '34480' },
                        { name: 'Başakşehir', postal_code: '34480' },
                        { name: 'Güvercintepe', postal_code: '34307' },
                        { name: 'Bahçeşehir 2. Kısım', postal_code: '34488' },
                        { name: 'Bahçeşehir 1. Kısım', postal_code: '34488' }
                    ];
                    insertNeighborhoods(basaksehirMahalleleri, districtMap['Başakşehir']);
                }
                
                // Gaziosmanpaşa mahalleleri
                if (districtMap['Gaziosmanpaşa']) {
                    const gaziosmanpasaMahalleleri = [
                        { name: 'Karadeniz', postal_code: '34255' },
                        { name: 'Barbaros Hayrettin Paşa', postal_code: '34250' },
                        { name: 'Kazım Karabekir', postal_code: '34250' },
                        { name: 'Karayolları', postal_code: '34255' },
                        { name: 'Mevlana', postal_code: '34255' },
                        { name: 'Fevzi Çakmak', postal_code: '34245' }
                    ];
                    insertNeighborhoods(gaziosmanpasaMahalleleri, districtMap['Gaziosmanpaşa']);
                }
                
                // Sultangazi mahalleleri
                if (districtMap['Sultangazi']) {
                    const sultangaziMahalleleri = [
                        { name: '50. Yıl', postal_code: '34265' },
                        { name: 'Esentepe', postal_code: '34270' },
                        { name: 'Cebeci', postal_code: '34270' },
                        { name: 'İsmetpaşa', postal_code: '34265' },
                        { name: 'Yunus Emre', postal_code: '34260' },
                        { name: 'Uğur Mumcu', postal_code: '34265' },
                        { name: 'Sultançiftliği', postal_code: '34265' }
                    ];
                    insertNeighborhoods(sultangaziMahalleleri, districtMap['Sultangazi']);
                }
                
                // Avcılar mahalleleri
                if (districtMap['Avcılar']) {
                    const avcilarMahalleleri = [
                        { name: 'Yeşilkent', postal_code: '34517' },
                        { name: 'Cihangir', postal_code: '34310' },
                        { name: 'Tahtakale', postal_code: '34320' },
                        { name: 'Denizköşkler', postal_code: '34315' },
                        { name: 'Gümüşpala', postal_code: '34320' },
                        { name: 'Ambarlı', postal_code: '34315' }
                    ];
                    insertNeighborhoods(avcilarMahalleleri, districtMap['Avcılar']);
                }
                
                // Pendik mahalleleri
                if (districtMap['Pendik']) {
                    const pendikMahalleleri = [
                        { name: 'Kavakpınar', postal_code: '34899' },
                        { name: 'Yenişehir', postal_code: '34893' },
                        { name: 'Kaynarca', postal_code: '34896' },
                        { name: 'Velibaba', postal_code: '34896' },
                        { name: 'Güzelyalı', postal_code: '34903' },
                        { name: 'Esenyalı', postal_code: '34903' }
                    ];
                    insertNeighborhoods(pendikMahalleleri, districtMap['Pendik']);
                }
                
                // Bağcılar mahalleleri
                if (districtMap['Bağcılar']) {
                    const bagcilarMahalleleri = [
                        { name: 'Demirkapı', postal_code: '34203' },
                        { name: '15 Temmuz', postal_code: '34204' },
                        { name: '100. Yıl', postal_code: '34203' },
                        { name: 'Güneşli', postal_code: '34210' },
                        { name: 'Fatih', postal_code: '34204' },
                        { name: 'Kirazlı', postal_code: '34200' },
                        { name: 'Yıldıztepe', postal_code: '34203' },
                        { name: 'Göztepe', postal_code: '34214' }
                    ];
                    insertNeighborhoods(bagcilarMahalleleri, districtMap['Bağcılar']);
                }
                
                // Kartal mahalleleri
                if (districtMap['Kartal']) {
                    const kartalMahalleleri = [
                        { name: 'Hürriyet', postal_code: '34876' },
                        { name: 'Uğur Mumcu', postal_code: '34880' },
                        { name: 'Yukarı', postal_code: '34870' },
                        { name: 'Topselvi', postal_code: '34873' },
                        { name: 'Kordonboyu', postal_code: '34865' },
                        { name: 'Orhantepe', postal_code: '34865' }
                    ];
                    insertNeighborhoods(kartalMahalleleri, districtMap['Kartal']);
                }
                
                // Ümraniye mahalleleri
                if (districtMap['Ümraniye']) {
                    const umraniyeMahalleleri = [
                        { name: 'İstiklal', postal_code: '34760' },
                        { name: 'Armağanevler', postal_code: '34764' },
                        { name: 'Çakmak', postal_code: '34774' },
                        { name: 'Tepeüstü', postal_code: '34771' },
                        { name: 'Atatürk', postal_code: '34761' },
                        { name: 'Site', postal_code: '34760' }
                    ];
                    insertNeighborhoods(umraniyeMahalleleri, districtMap['Ümraniye']);
                }
                
                // Esenler mahalleleri
                if (districtMap['Esenler']) {
                    const esenlerMahalleleri = [
                        { name: 'Turgut Reis', postal_code: '34235' },
                        { name: 'Fatih', postal_code: '34230' },
                        { name: 'Oruçreis', postal_code: '34230' },
                        { name: 'Nine Hatun', postal_code: '34220' },
                        { name: 'Menderes', postal_code: '34220' },
                        { name: 'Kemer', postal_code: '34220' }
                    ];
                    insertNeighborhoods(esenlerMahalleleri, districtMap['Esenler']);
                }
                
                // Bayrampaşa mahalleleri
                if (districtMap['Bayrampaşa']) {
                    const bayrampasaMahalleleri = [
                        { name: 'Yıldırım', postal_code: '34035' },
                        { name: 'Kartaltepe', postal_code: '34040' },
                        { name: 'Muratpaşa', postal_code: '34040' },
                        { name: 'Ortabayır', postal_code: '34035' },
                        { name: 'İsmetpaşa', postal_code: '34045' },
                        { name: 'Terazidere', postal_code: '34035' }
                    ];
                    insertNeighborhoods(bayrampasaMahalleleri, districtMap['Bayrampaşa']);
                }
                
                // Güngören mahalleleri
                if (districtMap['Güngören']) {
                    const gungorenMahalleleri = [
                        { name: 'Güneştepe', postal_code: '34164' },
                        { name: 'Gençosman', postal_code: '34165' },
                        { name: 'Merkez', postal_code: '34160' },
                        { name: 'Tozkoparan', postal_code: '34160' },
                        { name: 'Akıncılar', postal_code: '34160' },
                        { name: 'Haznedar', postal_code: '34160' }
                    ];
                    insertNeighborhoods(gungorenMahalleleri, districtMap['Güngören']);
                }
                
                // Eyüpsultan mahalleleri
                if (districtMap['Eyüpsultan']) {
                    const eyupsultanMahalleleri = [
                        { name: 'Akşemsettin', postal_code: '34075' },
                        { name: 'Yeşilpınar', postal_code: '34065' },
                        { name: 'Alibeyköy', postal_code: '34060' },
                        { name: 'Göktürk', postal_code: '34077' },
                        { name: 'Güzeltepe', postal_code: '34060' },
                        { name: 'İslambey', postal_code: '34055' }
                    ];
                    insertNeighborhoods(eyupsultanMahalleleri, districtMap['Eyüpsultan']);
                }
                
                // Kağıthane mahalleleri
                if (districtMap['Kağıthane']) {
                    const kagithaneMahalleleri = [
                        { name: 'Hamidiye', postal_code: '34408' },
                        { name: 'Merkez', postal_code: '34406' },
                        { name: 'Çeliktepe', postal_code: '34413' },
                        { name: 'Talatpaşa', postal_code: '34400' },
                        { name: 'Gürsel', postal_code: '34400' },
                        { name: 'Harmantepe', postal_code: '34408' }
                    ];
                    insertNeighborhoods(kagithaneMahalleleri, districtMap['Kağıthane']);
                }
                
                // Zeytinburnu mahalleleri
                if (districtMap['Zeytinburnu']) {
                    const zeytinburnuMahalleleri = [
                        { name: 'Telsiz', postal_code: '34020' },
                        { name: 'Merkez Efendi', postal_code: '34015' },
                        { name: 'Seyitnizam', postal_code: '34015' },
                        { name: 'Yeşiltepe', postal_code: '34025' },
                        { name: 'Çırpıcı', postal_code: '34025' },
                        { name: 'Beştelsiz', postal_code: '34020' }
                    ];
                    insertNeighborhoods(zeytinburnuMahalleleri, districtMap['Zeytinburnu']);
                }
                
                // Bakırköy mahalleleri
                if (districtMap['Bakırköy']) {
                    const bakirköyMahalleleri = [
                        { name: 'Kartaltepe', postal_code: '34142' },
                        { name: 'Cevizlik', postal_code: '34142' },
                        { name: 'Yenimahalle', postal_code: '34142' },
                        { name: 'Sakızağacı', postal_code: '34142' },
                        { name: 'Ataköy 1. Kısım', postal_code: '34158' },
                        { name: 'Zeytinlik', postal_code: '34140' }
                    ];
                    insertNeighborhoods(bakirköyMahalleleri, districtMap['Bakırköy']);
                }
                
                // Beşiktaş mahalleleri
                if (districtMap['Beşiktaş']) {
                    const besiktasMahalleleri = [
                        { name: 'Arnavutköy', postal_code: '34345' },
                        { name: 'Bebek', postal_code: '34342' },
                        { name: 'Levent', postal_code: '34330' },
                        { name: 'Ortaköy', postal_code: '34347' },
                        { name: 'Etiler', postal_code: '34337' },
                        { name: 'Sinanpaşa', postal_code: '34353' },
                        { name: 'Türkali', postal_code: '34357' },
                        { name: 'Ulus', postal_code: '34340' }
                    ];
                    insertNeighborhoods(besiktasMahalleleri, districtMap['Beşiktaş']);
                }
                
                // Kadıköy mahalleleri
                if (districtMap['Kadıköy']) {
                    const kadikoyMahalleleri = [
                        { name: 'Caferağa', postal_code: '34710' },
                        { name: 'Fenerbahçe', postal_code: '34726' },
                        { name: 'Göztepe', postal_code: '34730' },
                        { name: 'Koşuyolu', postal_code: '34718' },
                        { name: 'Moda', postal_code: '34710' },
                        { name: 'Suadiye', postal_code: '34740' },
                        { name: 'Erenköy', postal_code: '34738' },
                        { name: 'Caddebostan', postal_code: '34728' },
                        { name: 'Bostancı', postal_code: '34744' },
                        { name: 'Kozyatağı', postal_code: '34742' }
                    ];
                    insertNeighborhoods(kadikoyMahalleleri, districtMap['Kadıköy']);
                }
                
                // Fatih mahalleleri
                if (districtMap['Fatih']) {
                    const fatihMahalleleri = [
                        { name: 'Sultanahmet', postal_code: '34122' },
                        { name: 'Çarşamba', postal_code: '34083' },
                        { name: 'Karagümrük', postal_code: '34091' },
                        { name: 'Vefa', postal_code: '34134' },
                        { name: 'Zeyrek', postal_code: '34083' },
                        { name: 'Aksaray', postal_code: '34096' },
                        { name: 'Kocamustafapaşa', postal_code: '34098' },
                        { name: 'Fındıkzade', postal_code: '34093' },
                        { name: 'Şehremini', postal_code: '34104' },
                        { name: 'Cerrahpaşa', postal_code: '34098' }
                    ];
                    insertNeighborhoods(fatihMahalleleri, districtMap['Fatih']);
                }
                
                // Şile mahalleleri - az nüfuslu ilçelerden
                if (districtMap['Şile']) {
                    const sileMahalleleri = [
                        { name: 'Değirmençayırı', postal_code: '34980' },
                        { name: 'Yeniköy', postal_code: '34980' },
                        { name: 'Akçakese', postal_code: '34980' },
                        { name: 'Satmazlı', postal_code: '34980' },
                        { name: 'Üvezli', postal_code: '34980' }
                    ];
                    insertNeighborhoods(sileMahalleleri, districtMap['Şile']);
                }
                
                // Adalar mahalleleri - az nüfuslu ilçelerden
                if (districtMap['Adalar']) {
                    const adalarMahalleleri = [
                        { name: 'Burgazada', postal_code: '34975' },
                        { name: 'Büyükada', postal_code: '34970' },
                        { name: 'Heybeliada', postal_code: '34973' },
                        { name: 'Kınalıada', postal_code: '34976' }
                    ];
                    insertNeighborhoods(adalarMahalleleri, districtMap['Adalar']);
                }
                
                // Sarıyer mahalleleri
                if (districtMap['Sarıyer']) {
                    const sariyerMahalleleri = [
                        { name: 'Maslak', postal_code: '34398' },
                        { name: 'Bahçeköy', postal_code: '34473' },
                        { name: 'Rumelihisarı', postal_code: '34470' },
                        { name: 'Emirgan', postal_code: '34467' },
                        { name: 'Tarabya', postal_code: '34457' },
                        { name: 'İstinye', postal_code: '34460' }
                    ];
                    insertNeighborhoods(sariyerMahalleleri, districtMap['Sarıyer']);
                }
                
                // Beyoğlu mahalleleri
                if (districtMap['Beyoğlu']) {
                    const beyogluMahalleleri = [
                        { name: 'Cihangir', postal_code: '34433' },
                        { name: 'Galata', postal_code: '34421' },
                        { name: 'Taksim', postal_code: '34437' },
                        { name: 'Tarlabaşı', postal_code: '34435' },
                        { name: 'Kasımpaşa', postal_code: '34440' },
                        { name: 'Tomtom', postal_code: '34433' }
                    ];
                    insertNeighborhoods(beyogluMahalleleri, districtMap['Beyoğlu']);
                }
                
                // Tuzla mahalleleri
                if (districtMap['Tuzla']) {
                    const tuzlaMahalleleri = [
                        { name: 'Aydınlı', postal_code: '34947' },
                        { name: 'Mimar Sinan', postal_code: '34940' },
                        { name: 'Postane', postal_code: '34940' },
                        { name: 'İçmeler', postal_code: '34947' },
                        { name: 'Aydıntepe', postal_code: '34947' },
                        { name: 'Yayla', postal_code: '34940' }
                    ];
                    insertNeighborhoods(tuzlaMahalleleri, districtMap['Tuzla']);
                }
                
                console.log('Neighborhoods populated successfully with data from AtlasBig.com.tr');
            });
        }
    });
}

function insertNeighborhoods(neighborhoods, districtId) {
    const insertSql = 'INSERT INTO neighborhoods (name, district_id, postal_code) VALUES (?, ?, ?)';
    
    neighborhoods.forEach(neighborhood => {
        db.run(insertSql, [neighborhood.name, districtId, neighborhood.postal_code], (err) => {
            if (err) {
                console.error(`Error inserting neighborhood ${neighborhood.name}:`, err.message);
            } else {
                console.log(`Neighborhood ${neighborhood.name} inserted successfully.`);
            }
        });
    });
}

module.exports = db; 