# 📦 Iyzico → E-Arşiv Chrome Extension

Bu Chrome uzantısı, **Iyzico** işlem detay sayfalarından müşteri bilgilerini kaydedip, **e-Arşiv Portalı** fatura oluşturma ekranında bu bilgileri otomatik doldurur.

⏩ **Zaman kazandırır, hatayı azaltır, işinizi hızlandırır!**

---

## 🚀 Özellikler

✅ Iyzico işlem detayında müşteri bilgilerini otomatik kaydeder  
✅ Birden fazla müşteri kaydını telefon numarası ID’si ile saklar  
✅ e-Arşiv Portalı’nda fatura formunu seçilen müşteriyle otomatik doldurur  
✅ Popup arayüzünden kolay seçim ve kontrol

---

## 🔧 Kurulum

1️⃣ ZIP dosyasını indirin ve bir klasöre çıkartın.

2️⃣ Chrome tarayıcısında **Uzantılar Sayfası**na gidin:  
`chrome://extensions/`

3️⃣ Sağ üstten **Geliştirici Modu**’nu açın.

4️⃣ **Paketlenmemiş uzantı yükle** butonuna tıklayın, çıkarttığınız klasörü seçin ve yükleyin.

Yükleme sonrası araç çubuğunda uzantının ikonu görünecektir.

---

## 💡 Kullanım

### 🔹 Iyzico’da Müşteri Kaydet

1. **Iyzico → İşlemler** sayfasına gidin.  
2. Herhangi bir işlem detayına girin.  
3. Sağ üstte uzantı ikonuna tıklayın, popup’ı açın.  
4. **“Yeni Müşteri Kaydet”** butonuna basın.

👉 İşlemi yapan kişinin adı, soyadı, telefon numarası, e-posta ve adres bilgileri kaydedilir.

---

### 🔹 e-Arşiv’de Fatura Doldur

1. **e-Arşiv Portalı → Fatura Oluştur** kısmına gidin.  
2. Sağ üstte uzantı ikonuna tıklayın, popup’ı açın.  
3. Açılır listeden ilgili müşteriyi (telefon numarası ve adıyla listelenir) seçin.  
4. **“Seçili Müşteriyi Doldur”** butonuna basın.

👉 Form alanları (VKN/TCKN, Ad, Soyad, Ülke, Adres vb.) otomatik olarak doldurulur.

---

## ⚠️ Uyarılar

- Kayıt yapılırken müşteri **telefon numarası** ID olarak kullanılır. Aynı numarayla yapılan kayıt, eski verinin üzerine yazılır.
- e-Arşiv form alanlarının ID’leri değişirse (güncellenirse), `content_script.js` içindeki selector’lar güncellenmelidir.
- Gizlilik: Veriler sadece tarayıcıda lokal olarak saklanır, harici bir yere gönderilmez.

---

## 🛠️ Geliştirici Notları

- Kodda eklenen müşteri bilgileri `chrome.storage.local` içinde bir JSON nesnesinde (`customers`) tutulur.
- Popup arayüzü, kayıtlı müşterileri açılır liste ile gösterir.
- İster genişletmek, ister tasarımı güzelleştirmek için açık kaynak yapısı uygundur.

---

📬 **Soruların veya geliştirme isteğin varsa çekinmeden ilet!** 🚀
