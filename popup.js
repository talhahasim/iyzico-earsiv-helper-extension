// Popup açıldığında kayıtlı müşterileri yükle ve ayarları yükle
document.addEventListener('DOMContentLoaded', () => {
  loadCustomers();
  loadSettings();
  
  // Müşteri arama event listener'ı
  document.getElementById('customerSearch').addEventListener('input', (e) => {
    const searchTerm = e.target.value;
    console.log('Arama terimi:', searchTerm);
    filterCustomers(searchTerm);
  });
});

// Ayarlar butonu
document.getElementById('settings').addEventListener('click', () => {
  const settingsPanel = document.getElementById('settingsPanel');
  const isVisible = settingsPanel.style.display === 'block';
  
  if (isVisible) {
    settingsPanel.style.display = 'none';
  } else {
    settingsPanel.style.display = 'block';
    loadSettings(); // Mevcut ayarları yükle
  }
});

// Ayarları kaydet
document.getElementById('saveSettings').addEventListener('click', () => {
  const settings = {
    defaultService: document.getElementById('defaultService').value,
    defaultQuantity: parseFloat(document.getElementById('defaultQuantity').value) || 1,
    defaultUnit: document.getElementById('defaultUnit').value,
    defaultCountry: document.getElementById('defaultCountry').value,
    defaultVat: parseInt(document.getElementById('defaultVat').value) || 18,
    priceIncludesVat: document.getElementById('priceIncludesVat').checked
  };
  
  chrome.storage.local.set({ settings }, () => {
    if (chrome.runtime.lastError) {
      alert('Ayarlar kaydedilirken hata oluştu: ' + chrome.runtime.lastError.message);
    } else {
      alert('Ayarlar başarıyla kaydedildi!');
      document.getElementById('settingsPanel').style.display = 'none';
    }
  });
});

// Ayarları iptal et
document.getElementById('cancelSettings').addEventListener('click', () => {
  document.getElementById('settingsPanel').style.display = 'none';
  loadSettings(); // Orijinal ayarları geri yükle
});

// Ayarları yükle
async function loadSettings() {
  const { settings = {} } = await chrome.storage.local.get('settings');
  
  // Varsayılan değerler
  const defaults = {
    defaultService: 'Hizmet',
    defaultQuantity: 1,
    defaultUnit: 'C62',
    defaultCountry: 'Türkiye',
    defaultVat: 18,
    priceIncludesVat: false
  };
  
  const currentSettings = { ...defaults, ...settings };
  
  document.getElementById('defaultService').value = currentSettings.defaultService;
  document.getElementById('defaultQuantity').value = currentSettings.defaultQuantity;
  document.getElementById('defaultUnit').value = currentSettings.defaultUnit;
  document.getElementById('defaultCountry').value = currentSettings.defaultCountry;
  document.getElementById('defaultVat').value = currentSettings.defaultVat;
  document.getElementById('priceIncludesVat').checked = currentSettings.priceIncludesVat;
}

// Content script'te çalışacak fonksiyon
function detectCustomerDataInPage() {
  console.log('detectCustomerDataInPage fonksiyonu çağrıldı');
  console.log('Mevcut URL:', window.location.href);
  
  // İyzico'dan veri çekme helper'ı
  function getField(sectionTitle, fieldName) {
    console.log(`getField çağrıldı: ${sectionTitle} - ${fieldName}`);
    
    const secs = Array.from(document.querySelectorAll('section.sc-hKosrt.erRvmr'));
    console.log(`Bulunan section sayısı: ${secs.length}`);
    
    for (const sec of secs) {
      const hdr = sec.querySelector('div.sc-fCmSaK.jICGsw');
      if (hdr && hdr.innerText.trim() === sectionTitle) {
        console.log(`Section bulundu: ${sectionTitle}`);
        const items = Array.from(sec.querySelectorAll(
          'div.sc-iKqsjz.fhjCvX.sc-bguTAn.goVRTW, div.sc-iKqsjz.fhjCvX.sc-bguTAn.cAaCyW'
        ));
        console.log(`Bu section'da ${items.length} item bulundu`);
        
        for (const item of items) {
          const lbl = item.querySelector('div.sc-fQgSAe.gaLQva');
          if (lbl && lbl.innerText.trim() === fieldName) {
            console.log(`Field bulundu: ${fieldName}`);
            const val = item.querySelector('div.sc-gTRfyF.cIMzQq');
            const result = val ? val.innerText.trim() : '';
            console.log(`Field değeri: ${result}`);
            return result;
          }
        }
      }
    }
    console.log(`Field bulunamadı: ${sectionTitle} - ${fieldName}`);
    return '';
  }
  
  // Tutar algılama fonksiyonu
  function getAmount() {
    console.log('Tutar algılanıyor...');
    
    // Önce tüm tutar alanlarını bul
    const amountElements = Array.from(document.querySelectorAll('div.sc-gTRfyF.cIMzQq'));
    console.log(`Bulunan tutar elementi sayısı: ${amountElements.length}`);
    
    for (const element of amountElements) {
      const text = element.innerText.trim();
      console.log(`Tutar elementi içeriği: ${text}`);
      
      // ₺ işareti içeren ve sayısal değer olan elementleri kontrol et
      if (text.includes('₺') && /\d/.test(text)) {
        console.log(`Tutar bulundu: ${text}`);
        return text;
      }
    }
    
    // Alternatif olarak "Tahsil Edilen Tutar" gibi etiketleri ara
    const secs = Array.from(document.querySelectorAll('section.sc-hKosrt.erRvmr'));
    for (const sec of secs) {
      const hdr = sec.querySelector('div.sc-fCmSaK.jICGsw');
      if (hdr) {
        const sectionTitle = hdr.innerText.trim();
        console.log(`Section başlığı: ${sectionTitle}`);
        
        // Ödeme, tutar, tahsilat gibi kelimeleri içeren section'ları kontrol et
        if (sectionTitle.toLowerCase().includes('ödeme') || 
            sectionTitle.toLowerCase().includes('tutar') || 
            sectionTitle.toLowerCase().includes('tahsilat') ||
            sectionTitle.toLowerCase().includes('payment')) {
          
          const items = Array.from(sec.querySelectorAll(
            'div.sc-iKqsjz.fhjCvX.sc-bguTAn.goVRTW, div.sc-iKqsjz.fhjCvX.sc-bguTAn.cAaCyW'
          ));
          
          for (const item of items) {
            const lbl = item.querySelector('div.sc-fQgSAe.gaLQva');
            if (lbl) {
              const labelText = lbl.innerText.trim();
              console.log(`Label: ${labelText}`);
              
              // Tutar ile ilgili etiketleri ara
              if (labelText.toLowerCase().includes('tutar') || 
                  labelText.toLowerCase().includes('amount') ||
                  labelText.toLowerCase().includes('tahsilat') ||
                  labelText.toLowerCase().includes('ödeme')) {
                
                const val = item.querySelector('div.sc-gTRfyF.cIMzQq');
                if (val) {
                  const amount = val.innerText.trim();
                  console.log(`Tutar bulundu (label ile): ${amount}`);
                  return amount;
                }
              }
            }
          }
        }
      }
    }
    
    console.log('Tutar bulunamadı');
    return '';
  }
  
  // Ödeme tarihi ve saati algılama fonksiyonu
  function getPaymentDateTime() {
    console.log('Ödeme tarihi ve saati algılanıyor...');
    
    // Tüm tarih alanlarını bul
    const dateElements = Array.from(document.querySelectorAll('div.sc-gTRfyF.cIMzQq'));
    console.log(`Bulunan tarih elementi sayısı: ${dateElements.length}`);
    
    for (const element of dateElements) {
      const text = element.innerText.trim();
      console.log(`Tarih elementi içeriği: ${text}`);
      
      // Tarih formatını kontrol et (17.07.2025 | 22:21:52)
      if (text.includes('|') && /\d{2}\.\d{2}\.\d{4}/.test(text)) {
        console.log(`Tarih formatı bulundu: ${text}`);
        
        // Tarih ve saati ayır
        const parts = text.split('|').map(part => part.trim());
        if (parts.length === 2) {
          const date = parts[0]; // 17.07.2025
          const time = parts[1]; // 22:21:52
          
          console.log(`Tarih: ${date}, Saat: ${time}`);
          return { date, time };
        }
      }
    }
    
    // Alternatif olarak "Ödeme Tarihi" gibi etiketleri ara
    const secs = Array.from(document.querySelectorAll('section.sc-hKosrt.erRvmr'));
    for (const sec of secs) {
      const hdr = sec.querySelector('div.sc-fCmSaK.jICGsw');
      if (hdr) {
        const sectionTitle = hdr.innerText.trim();
        console.log(`Section başlığı: ${sectionTitle}`);
        
        // Ödeme, tarih, saat gibi kelimeleri içeren section'ları kontrol et
        if (sectionTitle.toLowerCase().includes('ödeme') || 
            sectionTitle.toLowerCase().includes('tarih') || 
            sectionTitle.toLowerCase().includes('saat') ||
            sectionTitle.toLowerCase().includes('payment')) {
          
          const items = Array.from(sec.querySelectorAll(
            'div.sc-iKqsjz.fhjCvX.sc-bguTAn.goVRTW, div.sc-iKqsjz.fhjCvX.sc-bguTAn.cAaCyW'
          ));
          
          for (const item of items) {
            const lbl = item.querySelector('div.sc-fQgSAe.gaLQva');
            if (lbl) {
              const labelText = lbl.innerText.trim();
              console.log(`Label: ${labelText}`);
              
              // Tarih ile ilgili etiketleri ara
              if (labelText.toLowerCase().includes('tarih') || 
                  labelText.toLowerCase().includes('date') ||
                  labelText.toLowerCase().includes('saat') ||
                  labelText.toLowerCase().includes('time')) {
                
                const val = item.querySelector('div.sc-gTRfyF.cIMzQq');
                if (val) {
                  const dateTimeText = val.innerText.trim();
                  console.log(`Tarih/saat bulundu (label ile): ${dateTimeText}`);
                  
                  // Tarih formatını kontrol et
                  if (dateTimeText.includes('|') && /\d{2}\.\d{2}\.\d{4}/.test(dateTimeText)) {
                    const parts = dateTimeText.split('|').map(part => part.trim());
                    if (parts.length === 2) {
                      const date = parts[0];
                      const time = parts[1];
                      console.log(`Tarih: ${date}, Saat: ${time}`);
                      return { date, time };
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
    
    console.log('Tarih ve saat bulunamadı');
    return { date: '', time: '' };
  }
  
  // Sayfa yüklendi mi kontrol et
  if (document.readyState !== 'complete') {
    console.log('Sayfa henüz yüklenmedi');
    return null;
  }
  
  // Ödeme tarihi ve saati al
  const paymentDateTime = getPaymentDateTime();
  
  const data = {
    buyerName:    getField('Alıcı Bilgileri', 'Ad'),
    buyerSurname: getField('Alıcı Bilgileri', 'Soyad'),
    buyerEmail:   getField('Alıcı Bilgileri', 'E-posta'),
    buyerPhone:   getField('Alıcı Bilgileri', 'Cep Telefonu Numarası'),
    buyerTaxId:   getField('Alıcı Bilgileri', 'TC Kimlik Numarası'),
    invoiceContactName:  getField('Fatura Adresi', 'İletişim Kurulacak Kişi Adı'),
    invoiceContactPhone: getField('Fatura Adresi', 'İletişim Bilgisi'),
    invoiceAddress:      getField('Fatura Adresi', 'Adres'),
    invoiceCity:         getField('Fatura Adresi', 'Şehir'),
    invoiceCountry:      getField('Fatura Adresi', 'Ülke'),
    amount:              getAmount(),
    paymentDate:         paymentDateTime.date,
    paymentTime:         paymentDateTime.time
  };
  
  console.log('Algılanan tüm veri:', data);
  
  // Eğer hiç veri bulunamadıysa uyarı ver
  const hasData = Object.values(data).some(value => value && value.trim() !== '');
  if (!hasData) {
    console.log('Hiç veri bulunamadı');
    return null;
  }
  
  console.log('Veri başarıyla algılandı');
  return data;
}

// Müşteri kaydetme fonksiyonu
function saveDataFromIyzicoInPage() {
  console.log('saveDataFromIyzicoInPage fonksiyonu çağrıldı');
  
  const data = detectCustomerDataInPage();
  console.log('Algılanan veri:', data);
  
  if (!data) {
    console.log('Veri algılanamadı, kayıt iptal edildi');
    alert('Müşteri bilgileri alınamadı!');
    return;
  }
  
  const phone = data.buyerPhone;
  console.log('Telefon numarası:', phone);
  
  if (!phone) {
    console.log('Telefon numarası bulunamadı');
    alert('Telefon numarası alınamadı, kayıt iptal edildi.');
    return;
  }
  
  console.log('Chrome storage\'a kaydediliyor...');
  
  // Chrome storage'a kaydet
  chrome.storage.local.get('customers', (result) => {
    console.log('Mevcut customers:', result);
    
    const customers = result.customers || {};
    customers[phone] = data;
    
    console.log('Kaydedilecek customers:', customers);
    
    chrome.storage.local.set({ customers }, () => {
      if (chrome.runtime.lastError) {
        console.error('Storage hatası:', chrome.runtime.lastError);
        alert('Kayıt sırasında hata oluştu: ' + chrome.runtime.lastError.message);
      } else {
        console.log('Müşteri başarıyla kaydedildi');
        alert(`${phone} ID'li müşteri kaydedildi.`);
      }
    });
  });
}

// Müşteri Algıla butonu
document.getElementById('detect').addEventListener('click', async () => {
  console.log('Müşteri Algıla butonuna tıklandı');
  alert('Müşteri Algıla butonuna tıklandı! Şimdi sayfa analiz ediliyor...');
  
  try {
    const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
    console.log('Aktif tab:', tab);
    
    if (!tab) {
      alert('Aktif tab bulunamadı!');
      return;
    }
    
    chrome.scripting.executeScript({
      target: {tabId: tab.id},
      func: detectCustomerDataInPage
    }, (results) => {
      console.log('Script sonuçları:', results);
      
      if (chrome.runtime.lastError) {
        console.error('Script hatası:', chrome.runtime.lastError);
        alert('Script çalıştırılırken hata oluştu: ' + chrome.runtime.lastError.message);
        return;
      }
      
      if (results && results[0] && results[0].result) {
        console.log('Algılanan veri:', results[0].result);
        displayCustomerData(results[0].result);
        alert('Müşteri bilgileri başarıyla algılandı! Aşağıda görebilirsiniz.');
      } else {
        console.log('Veri algılanamadı');
        alert('Bu sayfada müşteri bilgileri bulunamadı. Lütfen Iyzico ödeme sayfasında olduğunuzdan emin olun.');
      }
    });
  } catch (error) {
    console.error('Hata:', error);
    alert('Bir hata oluştu: ' + error.message);
  }
});

document.getElementById('save').addEventListener('click', async () => {
  console.log('Yeni Müşteri Kaydet butonuna tıklandı');
  alert('Yeni Müşteri Kaydet butonuna tıklandı! Kayıt işlemi başlatılıyor...');
  
  try {
  const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
    console.log('Aktif tab:', tab);
    
    if (!tab) {
      alert('Aktif tab bulunamadı!');
      return;
    }
    
    // Fonksiyonu doğrudan string olarak gönder
  chrome.scripting.executeScript({
    target: {tabId: tab.id},
      func: () => {
        console.log('saveDataFromIyzicoInPage fonksiyonu çağrıldı');
        
        // İyzico'dan veri çekme helper'ı
        function getField(sectionTitle, fieldName) {
          console.log(`getField çağrıldı: ${sectionTitle} - ${fieldName}`);
          
          const secs = Array.from(document.querySelectorAll('section.sc-hKosrt.erRvmr'));
          console.log(`Bulunan section sayısı: ${secs.length}`);
          
          for (const sec of secs) {
            const hdr = sec.querySelector('div.sc-fCmSaK.jICGsw');
            if (hdr && hdr.innerText.trim() === sectionTitle) {
              console.log(`Section bulundu: ${sectionTitle}`);
              const items = Array.from(sec.querySelectorAll(
                'div.sc-iKqsjz.fhjCvX.sc-bguTAn.goVRTW, div.sc-iKqsjz.fhjCvX.sc-bguTAn.cAaCyW'
              ));
              console.log(`Bu section'da ${items.length} item bulundu`);
              
              for (const item of items) {
                const lbl = item.querySelector('div.sc-fQgSAe.gaLQva');
                if (lbl && lbl.innerText.trim() === fieldName) {
                  console.log(`Field bulundu: ${fieldName}`);
                  const val = item.querySelector('div.sc-gTRfyF.cIMzQq');
                  const result = val ? val.innerText.trim() : '';
                  console.log(`Field değeri: ${result}`);
                  return result;
                }
              }
            }
          }
          console.log(`Field bulunamadı: ${sectionTitle} - ${fieldName}`);
          return '';
        }
        
        // Tutar algılama fonksiyonu
        function getAmount() {
          console.log('Tutar algılanıyor...');
          
          // Önce tüm tutar alanlarını bul
          const amountElements = Array.from(document.querySelectorAll('div.sc-gTRfyF.cIMzQq'));
          console.log(`Bulunan tutar elementi sayısı: ${amountElements.length}`);
          
          for (const element of amountElements) {
            const text = element.innerText.trim();
            console.log(`Tutar elementi içeriği: ${text}`);
            
            // ₺ işareti içeren ve sayısal değer olan elementleri kontrol et
            if (text.includes('₺') && /\d/.test(text)) {
              console.log(`Tutar bulundu: ${text}`);
              return text;
            }
          }
          
          // Alternatif olarak "Tahsil Edilen Tutar" gibi etiketleri ara
          const secs = Array.from(document.querySelectorAll('section.sc-hKosrt.erRvmr'));
          for (const sec of secs) {
            const hdr = sec.querySelector('div.sc-fCmSaK.jICGsw');
            if (hdr) {
              const sectionTitle = hdr.innerText.trim();
              console.log(`Section başlığı: ${sectionTitle}`);
              
              // Ödeme, tutar, tahsilat gibi kelimeleri içeren section'ları kontrol et
              if (sectionTitle.toLowerCase().includes('ödeme') || 
                  sectionTitle.toLowerCase().includes('tutar') || 
                  sectionTitle.toLowerCase().includes('tahsilat') ||
                  sectionTitle.toLowerCase().includes('payment')) {
                
                const items = Array.from(sec.querySelectorAll(
                  'div.sc-iKqsjz.fhjCvX.sc-bguTAn.goVRTW, div.sc-iKqsjz.fhjCvX.sc-bguTAn.cAaCyW'
                ));
                
                for (const item of items) {
                  const lbl = item.querySelector('div.sc-fQgSAe.gaLQva');
                  if (lbl) {
                    const labelText = lbl.innerText.trim();
                    console.log(`Label: ${labelText}`);
                    
                    // Tutar ile ilgili etiketleri ara
                    if (labelText.toLowerCase().includes('tutar') || 
                        labelText.toLowerCase().includes('amount') ||
                        labelText.toLowerCase().includes('tahsilat') ||
                        labelText.toLowerCase().includes('ödeme')) {
                      
                      const val = item.querySelector('div.sc-gTRfyF.cIMzQq');
                      if (val) {
                        const amount = val.innerText.trim();
                        console.log(`Tutar bulundu (label ile): ${amount}`);
                        return amount;
                      }
                    }
                  }
                }
              }
            }
          }
          
          console.log('Tutar bulunamadı');
          return '';
        }
        
        // Ödeme tarihi ve saati algılama fonksiyonu
        function getPaymentDateTime() {
          console.log('Ödeme tarihi ve saati algılanıyor...');
          
          // Tüm tarih alanlarını bul
          const dateElements = Array.from(document.querySelectorAll('div.sc-gTRfyF.cIMzQq'));
          console.log(`Bulunan tarih elementi sayısı: ${dateElements.length}`);
          
          for (const element of dateElements) {
            const text = element.innerText.trim();
            console.log(`Tarih elementi içeriği: ${text}`);
            
            // Tarih formatını kontrol et (17.07.2025 | 22:21:52)
            if (text.includes('|') && /\d{2}\.\d{2}\.\d{4}/.test(text)) {
              console.log(`Tarih formatı bulundu: ${text}`);
              
              // Tarih ve saati ayır
              const parts = text.split('|').map(part => part.trim());
              if (parts.length === 2) {
                const date = parts[0]; // 17.07.2025
                const time = parts[1]; // 22:21:52
                
                console.log(`Tarih: ${date}, Saat: ${time}`);
                return { date, time };
              }
            }
          }
          
          // Alternatif olarak "Ödeme Tarihi" gibi etiketleri ara
          const secs = Array.from(document.querySelectorAll('section.sc-hKosrt.erRvmr'));
          for (const sec of secs) {
            const hdr = sec.querySelector('div.sc-fCmSaK.jICGsw');
            if (hdr) {
              const sectionTitle = hdr.innerText.trim();
              console.log(`Section başlığı: ${sectionTitle}`);
              
              // Ödeme, tarih, saat gibi kelimeleri içeren section'ları kontrol et
              if (sectionTitle.toLowerCase().includes('ödeme') || 
                  sectionTitle.toLowerCase().includes('tarih') || 
                  sectionTitle.toLowerCase().includes('saat') ||
                  sectionTitle.toLowerCase().includes('payment')) {
                
                const items = Array.from(sec.querySelectorAll(
                  'div.sc-iKqsjz.fhjCvX.sc-bguTAn.goVRTW, div.sc-iKqsjz.fhjCvX.sc-bguTAn.cAaCyW'
                ));
                
                for (const item of items) {
                  const lbl = item.querySelector('div.sc-fQgSAe.gaLQva');
                  if (lbl) {
                    const labelText = lbl.innerText.trim();
                    console.log(`Label: ${labelText}`);
                    
                    // Tarih ile ilgili etiketleri ara
                    if (labelText.toLowerCase().includes('tarih') || 
                        labelText.toLowerCase().includes('date') ||
                        labelText.toLowerCase().includes('saat') ||
                        labelText.toLowerCase().includes('time')) {
                      
                      const val = item.querySelector('div.sc-gTRfyF.cIMzQq');
                      if (val) {
                        const dateTimeText = val.innerText.trim();
                        console.log(`Tarih/saat bulundu (label ile): ${dateTimeText}`);
                        
                        // Tarih formatını kontrol et
                        if (dateTimeText.includes('|') && /\d{2}\.\d{2}\.\d{4}/.test(dateTimeText)) {
                          const parts = dateTimeText.split('|').map(part => part.trim());
                          if (parts.length === 2) {
                            const date = parts[0];
                            const time = parts[1];
                            console.log(`Tarih: ${date}, Saat: ${time}`);
                            return { date, time };
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
          
          console.log('Tarih ve saat bulunamadı');
          return { date: '', time: '' };
        }
        
        // Müşteri verilerini algıla
        function detectCustomerDataInPage() {
          console.log('detectCustomerDataInPage fonksiyonu çağrıldı');
          console.log('Mevcut URL:', window.location.href);
          
          // Sayfa yüklendi mi kontrol et
          if (document.readyState !== 'complete') {
            console.log('Sayfa henüz yüklenmedi');
            return null;
          }
          
          // Ödeme tarihi ve saati al
          const paymentDateTime = getPaymentDateTime();
          
          const data = {
            buyerName:    getField('Alıcı Bilgileri', 'Ad'),
            buyerSurname: getField('Alıcı Bilgileri', 'Soyad'),
            buyerEmail:   getField('Alıcı Bilgileri', 'E-posta'),
            buyerPhone:   getField('Alıcı Bilgileri', 'Cep Telefonu Numarası'),
            buyerTaxId:   getField('Alıcı Bilgileri', 'TC Kimlik Numarası'),
            invoiceContactName:  getField('Fatura Adresi', 'İletişim Kurulacak Kişi Adı'),
            invoiceContactPhone: getField('Fatura Adresi', 'İletişim Bilgisi'),
            invoiceAddress:      getField('Fatura Adresi', 'Adres'),
            invoiceCity:         getField('Fatura Adresi', 'Şehir'),
            invoiceCountry:      getField('Fatura Adresi', 'Ülke'),
            amount:              getAmount(),
            paymentDate:         paymentDateTime.date,
            paymentTime:         paymentDateTime.time
          };
          
          console.log('Algılanan tüm veri:', data);
          
          // Eğer hiç veri bulunamadıysa uyarı ver
          const hasData = Object.values(data).some(value => value && value.trim() !== '');
          if (!hasData) {
            console.log('Hiç veri bulunamadı');
            return null;
          }
          
          console.log('Veri başarıyla algılandı');
          return data;
        }
        
        // Ana kaydetme fonksiyonu
        const data = detectCustomerDataInPage();
        console.log('Algılanan veri:', data);
        
        if (!data) {
          console.log('Veri algılanamadı, kayıt iptal edildi');
          alert('Müşteri bilgileri alınamadı!');
          return;
        }
        
        const phone = data.buyerPhone;
        console.log('Telefon numarası:', phone);
        
        if (!phone) {
          console.log('Telefon numarası bulunamadı');
          alert('Telefon numarası alınamadı, kayıt iptal edildi.');
          return;
        }
        
        console.log('Chrome storage\'a kaydediliyor...');
        
        // Chrome storage'a kaydet
        chrome.storage.local.get('customers', (result) => {
          console.log('Mevcut customers:', result);
          
          const customers = result.customers || {};
          customers[phone] = data;
          
          console.log('Kaydedilecek customers:', customers);
          
          chrome.storage.local.set({ customers }, () => {
            if (chrome.runtime.lastError) {
              console.error('Storage hatası:', chrome.runtime.lastError);
              alert('Kayıt sırasında hata oluştu: ' + chrome.runtime.lastError.message);
            } else {
              console.log('Müşteri başarıyla kaydedildi');
              alert(`${phone} ID'li müşteri kaydedildi.`);
            }
          });
        });
      }
    }, (results) => {
      console.log('Kaydetme script sonuçları:', results);
      
      if (chrome.runtime.lastError) {
        console.error('Script hatası:', chrome.runtime.lastError);
        alert('Script çalıştırılırken hata oluştu: ' + chrome.runtime.lastError.message);
        return;
      }
      
      // Kayıt işlemi tamamlandıktan sonra müşteri listesini yenile
      loadCustomers();
    });
  } catch (error) {
    console.error('Hata:', error);
    alert('Bir hata oluştu: ' + error.message);
  }
});

document.getElementById('fill').addEventListener('click', async () => {
  console.log('Seçili Müşteriyi Doldur butonuna tıklandı');
  
  const phone = document.getElementById('customerList').value;
  if (!phone) {
    alert('Lütfen bir müşteri seçin!');
    return;
  }
  
  console.log('Seçilen telefon:', phone);
  alert(`Seçili Müşteriyi Doldur butonuna tıklandı! ${phone} numaralı müşteri aranıyor...`);
  
  try {
  const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
    console.log('Aktif tab:', tab);
    
    if (!tab) {
      alert('Aktif tab bulunamadı!');
      return;
    }
    
  chrome.scripting.executeScript({
    target: {tabId: tab.id},
      func: (selectedPhone) => {
        console.log('fillDataToEArsiv fonksiyonu çağrıldı');
        console.log('Seçilen telefon:', selectedPhone);
        
        // Chrome storage'dan müşteri bilgilerini al
        chrome.storage.local.get(['customers', 'settings'], (result) => {
          console.log('Storage\'dan alınan customers:', result.customers);
          console.log('Storage\'dan alınan settings:', result.settings);
          
          const customers = result.customers || {};
          const customerData = customers[selectedPhone];
          
          if (!customerData) {
            console.log('Müşteri bulunamadı');
            alert('Seçili müşteri bulunamadı!');
            return;
          }
          
          console.log('Müşteri verisi:', customerData);
          
          // Ayarları al
          const settings = result.settings || {};
          const defaults = {
            defaultService: 'Hizmet',
            defaultQuantity: 1,
            defaultUnit: 'C62',
            defaultCountry: 'Türkiye',
            defaultVat: 18,
            priceIncludesVat: false
          };
          const currentSettings = { ...defaults, ...settings };
          
          // e-Arşiv form alanlarını doldur
          try {
            const fields = [
              { id: '#gen__1033', value: customerData.buyerTaxId, name: 'TC Kimlik' },
              { id: '#gen__1035', value: customerData.buyerName, name: 'Ad' },
              { id: '#gen__1036', value: customerData.buyerSurname, name: 'Soyad' },
              { id: '#gen__1042', value: currentSettings.defaultCountry, name: 'Ülke' },
              { id: '#gen__1043', value: customerData.invoiceAddress, name: 'Adres' }
            ];
            
            let filledCount = 0;
            
            fields.forEach(field => {
              const element = document.querySelector(field.id);
              if (element) {
                element.value = field.value || '';
                console.log(`${field.name} alanı dolduruldu: ${field.value}`);
                filledCount++;
              } else {
                console.log(`${field.name} alanı bulunamadı: ${field.id}`);
              }
            });
            
            console.log(`${filledCount} alan dolduruldu`);
            
            // Satır Ekle butonuna tıkla ve fiyat gir
            setTimeout(() => {
              addRowAndFillPrice(customerData.amount, customerData);
            }, 500);
            
            alert(`e-Arşiv formu seçili müşteriyle dolduruldu! ${filledCount} alan güncellendi. Satır ekleniyor...`);
            
          } catch (error) {
            console.error('Form doldurma hatası:', error);
            alert('Form doldurulurken hata oluştu: ' + error.message);
          }
        });
        
        // Satır ekle ve fiyat gir fonksiyonu
        function addRowAndFillPrice(amount, customerData) {
          console.log('Satır ekleme ve fiyat girme başlatılıyor...');
          console.log('Tutar:', amount);
          console.log('Müşteri verisi:', customerData);
          
          if (!amount) {
            console.log('Tutar bulunamadı, satır ekleme iptal edildi');
            return;
          }
          
          // Satır Ekle butonunu bul ve tıkla
          const addRowButton = document.querySelector('#gen__1092');
          if (addRowButton) {
            console.log('Satır Ekle butonu bulundu, tıklanıyor...');
            addRowButton.click();
            
            // Butona tıkladıktan sonra fiyat alanını bul ve doldur
            setTimeout(() => {
              fillPriceInTable(amount, customerData);
            }, 1000); // 1 saniye bekle
          } else {
            console.log('Satır Ekle butonu bulunamadı');
            alert('Satır Ekle butonu bulunamadı!');
          }
        }
        
        // Tarih ve saat alanlarını doldur
        function fillDateTimeFields(customerData) {
          console.log('Tarih ve saat alanları dolduruluyor...');
          console.log('Müşteri verisi:', customerData);
          
          // Tarih alanını doldur (gen__1026)
          if (customerData.paymentDate) {
            console.log('Ödeme tarihi bulundu:', customerData.paymentDate);
            
            // Tarih alanını bul - doğru ID ile
            let dateInput = document.querySelector('#date-gen__1026');
            if (!dateInput) {
              console.log('#date-gen__1026 bulunamadı, alternatif seçiciler deneniyor...');
              dateInput = document.querySelector('input[id*="date-gen__1026"]');
            }
            if (!dateInput) {
              console.log('input[id*="date-gen__1026"] bulunamadı, tüm input alanları kontrol ediliyor...');
              const allInputs = document.querySelectorAll('input');
              console.log('Sayfadaki tüm input alanları:', allInputs.length);
              allInputs.forEach((input, index) => {
                console.log(`Input ${index}: id="${input.id}", name="${input.name}", type="${input.type}"`);
              });
            }
            
            if (dateInput) {
              console.log('Tarih alanı bulundu:', dateInput);
              console.log('Mevcut değer:', dateInput.value);
              
              // Tarihi dd/mm/yyyy formatına çevir (17.07.2025 -> 17/07/2025)
              const dateParts = customerData.paymentDate.split('.');
              if (dateParts.length === 3) {
                const formattedDate = `${dateParts[0]}/${dateParts[1]}/${dateParts[2]}`;
                console.log(`Tarih formatı: ${customerData.paymentDate} -> ${formattedDate}`);
                
                dateInput.value = formattedDate;
                dateInput.dispatchEvent(new Event('input', { bubbles: true }));
                dateInput.dispatchEvent(new Event('change', { bubbles: true }));
                console.log('Tarih alanı dolduruldu:', formattedDate);
                console.log('Doldurma sonrası değer:', dateInput.value);
              } else {
                console.log('Tarih formatı geçersiz:', customerData.paymentDate);
              }
            } else {
              console.log('Tarih alanı hiçbir şekilde bulunamadı!');
            }
          } else {
            console.log('Ödeme tarihi bulunamadı veya boş');
          }
          
          // Saat alanını doldur (gen__1027)
          if (customerData.paymentTime) {
            console.log('Ödeme saati bulundu:', customerData.paymentTime);
            
            // Saat alanını bul - doğru ID ile
            let timeInput = document.querySelector('#date-gen__1027');
            if (!timeInput) {
              console.log('#date-gen__1027 bulunamadı, alternatif seçiciler deneniyor...');
              timeInput = document.querySelector('input[id*="date-gen__1027"]');
            }
            
            if (timeInput) {
              console.log('Saat alanı bulundu:', timeInput);
              console.log('Mevcut değer:', timeInput.value);
              
              // Saati hh:mm:ss formatında kullan
              console.log(`Saat: ${customerData.paymentTime}`);
              
              timeInput.value = customerData.paymentTime;
              timeInput.dispatchEvent(new Event('input', { bubbles: true }));
              timeInput.dispatchEvent(new Event('change', { bubbles: true }));
              console.log('Saat alanı dolduruldu:', customerData.paymentTime);
              console.log('Doldurma sonrası değer:', timeInput.value);
            } else {
              console.log('Saat alanı hiçbir şekilde bulunamadı!');
            }
          } else {
            console.log('Ödeme saati bulunamadı veya boş');
          }
          
          console.log('Tarih ve saat alanları doldurma tamamlandı');
        }
        
        // Tablodaki fiyat alanını doldur
        function fillPriceInTable(amount, customerData) {
          console.log('Fiyat ve miktar alanları aranıyor...');
          console.log('Müşteri verisi:', customerData);
          
          // Tutarı Türk para birimi formatına çevir (₺590,00 -> 590,00)
          let turkishAmount = amount.replace(/[₺\s]/g, '');
          console.log('Türk formatı tutar:', turkishAmount);
          
          // Ayarları al
          chrome.storage.local.get('settings', (result) => {
            const settings = result.settings || {};
            const defaults = {
              defaultService: 'Hizmet',
              defaultQuantity: 1,
              defaultUnit: 'C62',
              defaultVat: 18,
              priceIncludesVat: false
            };
            const currentSettings = { ...defaults, ...settings };
            
            console.log('Kullanılan ayarlar:', currentSettings);
            
            // Hizmet adı alanını bul ve doldur (gen__1149)
            const serviceInput = document.querySelector('#gen__1149');
            if (serviceInput) {
              serviceInput.value = currentSettings.defaultService;
              serviceInput.dispatchEvent(new Event('input', { bubbles: true }));
              serviceInput.dispatchEvent(new Event('change', { bubbles: true }));
              console.log('Hizmet adı dolduruldu:', currentSettings.defaultService);
            } else {
              console.log('Hizmet adı alanı bulunamadı: #gen__1149');
            }
            
            // Miktar alanını bul ve doldur (gen__1150)
            const quantityInput = document.querySelector('#gen__1150');
            if (quantityInput) {
              quantityInput.value = currentSettings.defaultQuantity.toString();
              quantityInput.dispatchEvent(new Event('input', { bubbles: true }));
              quantityInput.dispatchEvent(new Event('change', { bubbles: true }));
              console.log('Miktar alanı dolduruldu:', currentSettings.defaultQuantity);
            } else {
              console.log('Miktar alanı bulunamadı: #gen__1150');
            }
            
            // Birim alanını bul ve doldur (gen__1151)
            const unitSelect = document.querySelector('#gen__1151');
            if (unitSelect) {
              unitSelect.value = currentSettings.defaultUnit;
              unitSelect.dispatchEvent(new Event('change', { bubbles: true }));
              console.log('Birim alanı dolduruldu:', currentSettings.defaultUnit);
            } else {
              console.log('Birim alanı bulunamadı: #gen__1151');
            }
            
            // KDV alanını bul ve doldur (gen__1159)
            const vatInput = document.querySelector('#gen__1159');
            if (vatInput) {
              vatInput.value = currentSettings.defaultVat.toString();
              vatInput.dispatchEvent(new Event('change', { bubbles: true }));
              console.log('KDV alanı dolduruldu:', currentSettings.defaultVat);
            } else {
              console.log('KDV alanı bulunamadı: #gen__1159');
            }
            
            // Fiyat hesaplama (KDV dahil/hariç)
            let finalPrice = turkishAmount;
            if (currentSettings.priceIncludesVat) {
              // Fiyat KDV dahilse, KDV hariç fiyatı hesapla
              const vatRate = currentSettings.defaultVat / 100;
              const priceWithoutVat = parseFloat(turkishAmount.replace(',', '.')) / (1 + vatRate);
              finalPrice = priceWithoutVat.toFixed(2).replace('.', ',');
              console.log('KDV hariç fiyat hesaplandı:', finalPrice);
            }
            
            // Tablodaki fiyat alanlarını bul (gen__1152 ID'li alanlar)
            const priceInputs = document.querySelectorAll('input[id^="gen__"][id$="52"]');
            console.log(`Bulunan fiyat alanı sayısı: ${priceInputs.length}`);
            
            if (priceInputs.length > 0) {
              // İlk fiyat alanını doldur
              const firstPriceInput = priceInputs[0];
              firstPriceInput.value = finalPrice;
              
              // Input event'ini tetikle (form hesaplamaları için)
              firstPriceInput.dispatchEvent(new Event('input', { bubbles: true }));
              firstPriceInput.dispatchEvent(new Event('change', { bubbles: true }));
              
              console.log(`Fiyat alanı dolduruldu: ${finalPrice}`);
              
              // Tarih ve saat alanlarını doldur
              console.log('fillDateTimeFields fonksiyonu çağrılıyor...');
              fillDateTimeFields(customerData);
              console.log('fillDateTimeFields fonksiyonu tamamlandı');
              
              alert(`Satır eklendi!\nHizmet: ${currentSettings.defaultService}\nMiktar: ${currentSettings.defaultQuantity}\nBirim: ${currentSettings.defaultUnit}\nKDV: %${currentSettings.defaultVat}\nFiyat: ${amount}`);
            } else {
              console.log('Fiyat alanı bulunamadı');
              alert('Fiyat alanı bulunamadı!');
            }
          });
        }
      },
    args: [phone]
    }, (results) => {
      console.log('Doldurma script sonuçları:', results);
      
      if (chrome.runtime.lastError) {
        console.error('Script hatası:', chrome.runtime.lastError);
        alert('Script çalıştırılırken hata oluştu: ' + chrome.runtime.lastError.message);
        return;
      }
    });
  } catch (error) {
    console.error('Hata:', error);
    alert('Bir hata oluştu: ' + error.message);
  }
});

document.getElementById('delete').addEventListener('click', async () => {
  console.log('Seçili Müşteriyi Sil butonuna tıklandı');
  
  const phone = document.getElementById('customerList').value;
  if (!phone) {
    alert('Lütfen silinecek müşteriyi seçin!');
    return;
  }
  
  console.log('Silinecek telefon:', phone);
  
  // Onay al
  const confirmed = confirm(`Bu müşteriyi silmek istediğinizden emin misiniz?\n\nTelefon: ${phone}\n\nBu işlem geri alınamaz!`);
  
  if (!confirmed) {
    console.log('Silme işlemi iptal edildi');
    return;
  }
  
  try {
    // Chrome storage'dan müşteriyi sil
    chrome.storage.local.get('customers', (result) => {
      console.log('Mevcut customers:', result);
      
      const customers = result.customers || {};
      
      if (!customers[phone]) {
        alert('Seçili müşteri bulunamadı!');
        return;
      }
      
      // Müşteri bilgilerini al (silmeden önce göstermek için)
      const customerData = customers[phone];
      const customerName = `${customerData.buyerName} ${customerData.buyerSurname}`;
      
      // Müşteriyi sil
      delete customers[phone];
      
      console.log('Silme sonrası customers:', customers);
      
      // Storage'ı güncelle
      chrome.storage.local.set({ customers }, () => {
        if (chrome.runtime.lastError) {
          console.error('Storage hatası:', chrome.runtime.lastError);
          alert('Silme sırasında hata oluştu: ' + chrome.runtime.lastError.message);
        } else {
          console.log('Müşteri başarıyla silindi');
          alert(`${customerName} (${phone}) başarıyla silindi.`);
          
          // Müşteri listesini yenile
          loadCustomers();
          
          // Eğer müşteri verisi gösteriliyorsa gizle
          const customerDataDiv = document.getElementById('customerData');
          if (customerDataDiv.style.display === 'block') {
            customerDataDiv.style.display = 'none';
          }
        }
      });
    });
  } catch (error) {
    console.error('Hata:', error);
    alert('Bir hata oluştu: ' + error.message);
  }
});

// Müşteri verilerini popup'ta göster
function displayCustomerData(data) {
  console.log('displayCustomerData çağrıldı:', data);
  const container = document.getElementById('customerData');
  container.style.display = 'block';
  
  let html = '<div style="margin-bottom:8px;"><strong>Algılanan Müşteri Bilgileri:</strong></div>';
  
  const fields = [
    { key: 'buyerName', label: 'Ad' },
    { key: 'buyerSurname', label: 'Soyad' },
    { key: 'buyerEmail', label: 'E-posta' },
    { key: 'buyerPhone', label: 'Telefon' },
    { key: 'buyerTaxId', label: 'TC Kimlik' },
    { key: 'amount', label: 'Tutar' },
    { key: 'paymentDate', label: 'Ödeme Tarihi' },
    { key: 'paymentTime', label: 'Ödeme Saati' },
    { key: 'invoiceContactName', label: 'Fatura İletişim Kişisi' },
    { key: 'invoiceContactPhone', label: 'Fatura Telefon' },
    { key: 'invoiceAddress', label: 'Fatura Adresi' },
    { key: 'invoiceCity', label: 'Şehir' },
    { key: 'invoiceCountry', label: 'Ülke' }
  ];
  
  fields.forEach(field => {
    const value = data[field.key] || 'Bulunamadı';
    html += `<div class="data-row"><span class="label">${field.label}:</span> <span class="value">${value}</span></div>`;
  });
  
  container.innerHTML = html;
}

// Tüm müşterileri saklamak için global değişken
let allCustomers = {};

async function loadCustomers() {
  const { customers = {} } = await chrome.storage.local.get('customers');
  allCustomers = customers; // Global değişkene ata
  
  const sel = document.getElementById('customerList');
  sel.innerHTML = '<option value="" disabled>-- Müşteri Seç --</option>';
  
  Object.entries(customers).forEach(([phone, data]) => {
    const opt = document.createElement('option');
    opt.value = phone;
    const amountText = data.amount ? ` - ${data.amount}` : '';
    const dateText = data.paymentDate ? ` (${data.paymentDate})` : '';
    opt.textContent = `${data.buyerName} ${data.buyerSurname} (${phone})${amountText}${dateText}`;
    sel.appendChild(opt);
  });
}

// Müşteri arama fonksiyonu
function filterCustomers(searchTerm) {
  const sel = document.getElementById('customerList');
  sel.innerHTML = '<option value="" disabled>-- Müşteri Seç --</option>';
  
  if (!searchTerm || searchTerm.trim() === '') {
    // Arama boşsa tüm müşterileri göster
    Object.entries(allCustomers).forEach(([phone, data]) => {
      const opt = document.createElement('option');
      opt.value = phone;
      const amountText = data.amount ? ` - ${data.amount}` : '';
      const dateText = data.paymentDate ? ` (${data.paymentDate})` : '';
      opt.textContent = `${data.buyerName} ${data.buyerSurname} (${phone})${amountText}${dateText}`;
      sel.appendChild(opt);
    });
    return;
  }
  
  // Arama terimini küçük harfe çevir
  const searchLower = searchTerm.toLowerCase().trim();
  
  // Müşterileri filtrele
  Object.entries(allCustomers).forEach(([phone, data]) => {
    const customerName = `${data.buyerName} ${data.buyerSurname}`.toLowerCase();
    const customerPhone = phone.toLowerCase();
    const customerEmail = (data.buyerEmail || '').toLowerCase();
    const customerTaxId = (data.buyerTaxId || '').toLowerCase();
    
    // Ad, soyad, telefon, e-posta veya TC kimlik numarasında arama terimi varsa göster
    if (customerName.includes(searchLower) || 
        customerPhone.includes(searchLower) || 
        customerEmail.includes(searchLower) || 
        customerTaxId.includes(searchLower)) {
      
      const opt = document.createElement('option');
      opt.value = phone;
      const amountText = data.amount ? ` - ${data.amount}` : '';
      const dateText = data.paymentDate ? ` (${data.paymentDate})` : '';
      opt.textContent = `${data.buyerName} ${data.buyerSurname} (${phone})${amountText}${dateText}`;
      sel.appendChild(opt);
    }
  });
}