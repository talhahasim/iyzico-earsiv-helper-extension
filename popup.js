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
  console.log('loadSettings fonksiyonu çağrıldı');
  
  const { settings = {} } = await chrome.storage.local.get('settings');
  console.log('Storage\'dan alınan ayarlar:', settings);
  
  // Varsayılan değerler
  const defaults = {
    defaultService: 'Hizmet',
    defaultQuantity: 1,
    defaultUnit: 'C62',
    defaultCountry: 'Türkiye',
    defaultVat: 18,
    priceIncludesVat: false
  };
  console.log('Varsayılan değerler:', defaults);
  
  const currentSettings = { ...defaults, ...settings };
  console.log('Birleştirilmiş ayarlar:', currentSettings);
  
  // DOM elementlerini bul ve değerleri ata
  const defaultServiceElement = document.getElementById('defaultService');
  const defaultQuantityElement = document.getElementById('defaultQuantity');
  const defaultUnitElement = document.getElementById('defaultUnit');
  const defaultCountryElement = document.getElementById('defaultCountry');
  const defaultVatElement = document.getElementById('defaultVat');
  const priceIncludesVatElement = document.getElementById('priceIncludesVat');
  
  if (defaultServiceElement) {
    defaultServiceElement.value = currentSettings.defaultService;
    console.log('Hizmet adı alanına yazılan değer:', currentSettings.defaultService);
  } else {
    console.error('defaultService elementi bulunamadı!');
  }
  
  if (defaultQuantityElement) {
    defaultQuantityElement.value = currentSettings.defaultQuantity;
    console.log('Miktar alanına yazılan değer:', currentSettings.defaultQuantity);
  }
  
  if (defaultUnitElement) {
    defaultUnitElement.value = currentSettings.defaultUnit;
    console.log('Birim alanına yazılan değer:', currentSettings.defaultUnit);
  }
  
  if (defaultCountryElement) {
    defaultCountryElement.value = currentSettings.defaultCountry;
    console.log('Ülke alanına yazılan değer:', currentSettings.defaultCountry);
  }
  
  if (defaultVatElement) {
    defaultVatElement.value = currentSettings.defaultVat;
    console.log('KDV alanına yazılan değer:', currentSettings.defaultVat);
  }
  
  if (priceIncludesVatElement) {
    priceIncludesVatElement.checked = currentSettings.priceIncludesVat;
    console.log('KDV dahil checkbox değeri:', currentSettings.priceIncludesVat);
  }
  
  console.log('Tüm ayarlar yüklendi');
}

// Content script'te çalışacak fonksiyon
function detectCustomerDataInPage() {
  console.log('detectCustomerDataInPage fonksiyonu çağrıldı');
  console.log('Mevcut URL:', window.location.href);
  
  // İyzico'dan veri çekme helper'ı - sınıf bağımsız, metin tabanlı
  function getField(sectionTitle, fieldName) {
    console.log(`getField çağrıldı: ${sectionTitle} - ${fieldName}`);
    
    function normalizeText(t){
      return (t||'').replace(/\s+/g,' ').trim().toLowerCase().replace(/:$/, '');
    }
    function findSectionContainer(title){
      const normalizedTitle = normalizeText(title);
      const iterator = document.createNodeIterator(document.body, NodeFilter.SHOW_ELEMENT, {
        acceptNode(node){
          try{
            const txt = normalizeText(node.textContent);
            if (!txt) return NodeFilter.FILTER_SKIP;
            return txt === normalizedTitle ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
          }catch(_){ return NodeFilter.FILTER_SKIP; }
        }
      });
      const node = iterator.nextNode();
      return node ? node.parentElement : null;
    }
    function buildLabelValueMap(container){
      const map = new Map();
      if(!container) return map;
      const children = Array.from(container.children);
      for (const child of children){
        const childNorm = normalizeText(child.textContent);
        if (childNorm === normalizeText(sectionTitle)) continue;
        const labelEl = child.children && child.children.length > 0 ? child.children[0] : null;
        const valueEl = child.children && child.children.length > 1 ? child.children[1] : null;
        const label = normalizeText(labelEl ? labelEl.textContent : '');
        let value = '';
        if (valueEl){
          value = valueEl.innerText ? valueEl.innerText.trim() : '';
          if (!value){
            const span = valueEl.querySelector('span');
            if (span) value = span.innerText.trim();
          }
        }
        if (label) map.set(label, value);
      }
      return map;
    }
    
    // Önce bölüm içinde ara
    const container = findSectionContainer(sectionTitle);
    const map = buildLabelValueMap(container);
    const wanted = normalizeText(fieldName);
    function getSynonyms(n){
      if (n === 'ad') return ['ad','adı','adi','isim','first name','given name'];
      if (n === 'soyad' || n === 'soyadı') return ['soyad','soyadı','last name','surname','family name'];
      return [n];
    }
    const keys = Array.from(map.keys());
    let key = keys.find(k => k === wanted);
    if (!key){
      const syn = getSynonyms(wanted);
      key = keys.find(k => syn.includes(k));
    }
    if (!key){
      const wb = new RegExp(`(^|\\b)${wanted}(\\b|$)`, 'i');
      key = keys.find(k => wb.test(k));
    }
    if (key) {
      const result = map.get(key) || '';
      console.log(`Field değeri (bölüm içi): ${result}`);
      return result;
    }
    
    // Alternatif: Tüm sayfada label'a göre ara
    const labels = Array.from(document.querySelectorAll('body *')).filter(el => normalizeText(el.textContent) === wanted || getSynonyms(wanted).includes(normalizeText(el.textContent)));
    for (const el of labels){
      const next = el.nextElementSibling;
      if (next){
        const val = (next.innerText || '').trim();
        if (val) return val;
        const span = next.querySelector('span');
        if (span && span.innerText.trim()) return span.innerText.trim();
      }
      const parent = el.parentElement;
      if (parent){
        const siblings = Array.from(parent.children);
        const idx = siblings.indexOf(el);
        if (idx >= 0 && siblings.length > idx + 1){
          const vEl = siblings[idx+1];
          const val2 = (vEl.innerText || '').trim();
          if (val2) return val2;
          const sp2 = vEl.querySelector('span');
          if (sp2 && sp2.innerText.trim()) return sp2.innerText.trim();
        }
      }
    }
    console.log(`Field bulunamadı: ${sectionTitle} - ${fieldName}`);
    return '';
  }
  
  // Tutar algılama fonksiyonu - sınıf bağımsız
  function getAmount() {
    console.log('Tutar algılanıyor...');
    const candidates = ['Tahsil Edilen Tutar','Toplam Tutar','Sepet Tutarı','Tutar','Amount'];
    for (const label of candidates){
      const val = getField('Ödeme Bilgileri', label) || getField('Ödeme', label) || getField('Payment Info', label);
      if (val) {
        console.log(`Tutar bulundu (etiket): ${val}`);
        return val;
      }
    }
    // Genel tarama - ₺ içerikli metin
    const allNodes = Array.from(document.querySelectorAll('body *'));
    for (const el of allNodes){
      const txt = (el.innerText || '').trim();
      if (txt && txt.includes('₺') && /\d/.test(txt)) {
        console.log(`Tutar bulundu (genel): ${txt}`);
        return txt;
      }
    }
    console.log('Tutar bulunamadı');
    return '';
  }
  
  // Ödeme tarihi ve saati algılama - sınıf bağımsız
  function getPaymentDateTime() {
    console.log('Ödeme tarihi ve saati algılanıyor...');
    const raw = getField('Ödeme Bilgileri','Ödeme Tarihi') || getField('Ödeme','Ödeme Tarihi') || getField('Payment Info','Payment Date') || '';
    const tryParse = (text) => {
      if (!text) return null;
      const t = text.trim();
      if (t.includes('|') && /\d{2}\.\d{2}\.\d{4}/.test(t)){
        const parts = t.split('|').map(s=>s.trim());
        if (parts.length === 2){
          return { date: parts[0], time: parts[1] };
        }
      }
      return null;
    };
    const parsed = tryParse(raw);
    if (parsed) return parsed;
    // Genel tarama
    const allNodes = Array.from(document.querySelectorAll('body *'));
    for (const el of allNodes){
      const txt = (el.innerText || '').trim();
      const m = txt.match(/\b\d{2}\.\d{2}\.\d{4}\s*\|\s*\d{2}:\d{2}:\d{2}\b/);
      if (m){
        const parts = m[0].split('|').map(s=>s.trim());
        return { date: parts[0], time: parts[1] };
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
    invoiceAddress:      getField('Alıcı Bilgileri', 'Kayıtlı Adres'),
    invoiceCity:         getField('Alıcı Bilgileri', 'Şehir'),
    invoiceCountry:      getField('Alıcı Bilgileri', 'Ülke'),
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

// Müşteri kaydetme fonksiyonu - güncellenmiş
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
        
        // İyzico'dan veri çekme helper'ı - sınıf bağımsız, metin tabanlı
        function getField(sectionTitle, fieldName) {
          console.log(`getField çağrıldı: ${sectionTitle} - ${fieldName}`);
          function normalizeText(t){
            return (t||'').replace(/\s+/g,' ').trim().toLowerCase().replace(/:$/, '');
          }
          function findSectionContainer(title){
            const normalizedTitle = normalizeText(title);
            const iterator = document.createNodeIterator(document.body, NodeFilter.SHOW_ELEMENT, {
              acceptNode(node){
                try{
                  const txt = normalizeText(node.textContent);
                  if (!txt) return NodeFilter.FILTER_SKIP;
                  return txt === normalizedTitle ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
                }catch(_){ return NodeFilter.FILTER_SKIP; }
              }
            });
            const node = iterator.nextNode();
            return node ? node.parentElement : null;
          }
          function buildLabelValueMap(container){
            const map = new Map();
            if(!container) return map;
            const children = Array.from(container.children);
            for (const child of children){
              const childNorm = normalizeText(child.textContent);
              if (childNorm === normalizeText(sectionTitle)) continue;
              const labelEl = child.children && child.children.length > 0 ? child.children[0] : null;
              const valueEl = child.children && child.children.length > 1 ? child.children[1] : null;
              const label = normalizeText(labelEl ? labelEl.textContent : '');
              let value = '';
              if (valueEl){
                value = valueEl.innerText ? valueEl.innerText.trim() : '';
                if (!value){
                  const span = valueEl.querySelector('span');
                  if (span) value = span.innerText.trim();
                }
              }
              if (label) map.set(label, value);
            }
            return map;
          }
          const container = findSectionContainer(sectionTitle);
          const map = buildLabelValueMap(container);
          const wanted = normalizeText(fieldName);
          function getSynonyms(n){
            if (n === 'ad') return ['ad','adı','adi','isim','first name','given name'];
            if (n === 'soyad' || n === 'soyadı') return ['soyad','soyadı','last name','surname','family name'];
            return [n];
          }
          const keys = Array.from(map.keys());
          let key = keys.find(k => k === wanted);
          if (!key){
            const syn = getSynonyms(wanted);
            key = keys.find(k => syn.includes(k));
          }
          if (!key){
            const wb = new RegExp(`(^|\\b)${wanted}(\\b|$)`, 'i');
            key = keys.find(k => wb.test(k));
          }
          if (key) {
            const result = map.get(key) || '';
            console.log(`Field değeri (bölüm içi): ${result}`);
            return result;
          }
          const labels = Array.from(document.querySelectorAll('body *')).filter(el => normalizeText(el.textContent) === wanted || getSynonyms(wanted).includes(normalizeText(el.textContent)));
          for (const el of labels){
            const next = el.nextElementSibling;
            if (next){
              const val = (next.innerText || '').trim();
              if (val) return val;
              const span = next.querySelector('span');
              if (span && span.innerText.trim()) return span.innerText.trim();
            }
            const parent = el.parentElement;
            if (parent){
              const siblings = Array.from(parent.children);
              const idx = siblings.indexOf(el);
              if (idx >= 0 && siblings.length > idx + 1){
                const vEl = siblings[idx+1];
                const val2 = (vEl.innerText || '').trim();
                if (val2) return val2;
                const sp2 = vEl.querySelector('span');
                if (sp2 && sp2.innerText.trim()) return sp2.innerText.trim();
              }
            }
          }
          console.log(`Field bulunamadı: ${sectionTitle} - ${fieldName}`);
          return '';
        }
        
        // Tutar algılama fonksiyonu - sınıf bağımsız
        function getAmount() {
          console.log('Tutar algılanıyor...');
          const candidates = ['Tahsil Edilen Tutar','Toplam Tutar','Sepet Tutarı','Tutar','Amount'];
          for (const label of candidates){
            const val = getField('Ödeme Bilgileri', label) || getField('Ödeme', label) || getField('Payment Info', label);
            if (val) {
              console.log(`Tutar bulundu (etiket): ${val}`);
              return val;
            }
          }
          const allNodes = Array.from(document.querySelectorAll('body *'));
          for (const el of allNodes){
            const txt = (el.innerText || '').trim();
            if (txt && txt.includes('₺') && /\d/.test(txt)) {
              console.log(`Tutar bulundu (genel): ${txt}`);
              return txt;
            }
          }
          console.log('Tutar bulunamadı');
          return '';
        }
        
        // Ödeme tarihi ve saati algılama - sınıf bağımsız
        function getPaymentDateTime() {
          console.log('Ödeme tarihi ve saati algılanıyor...');
          const raw = getField('Ödeme Bilgileri','Ödeme Tarihi') || getField('Ödeme','Ödeme Tarihi') || getField('Payment Info','Payment Date') || '';
          const tryParse = (text) => {
            if (!text) return null;
            const t = text.trim();
            if (t.includes('|') && /\d{2}\.\d{2}\.\d{4}/.test(t)){
              const parts = t.split('|').map(s=>s.trim());
              if (parts.length === 2){
                return { date: parts[0], time: parts[1] };
              }
            }
            return null;
          };
          const parsed = tryParse(raw);
          if (parsed) return parsed;
          const allNodes = Array.from(document.querySelectorAll('body *'));
          for (const el of allNodes){
            const txt = (el.innerText || '').trim();
            const m = txt.match(/\b\d{2}\.\d{2}\.\d{4}\s*\|\s*\d{2}:\d{2}:\d{2}\b/);
            if (m){
              const parts = m[0].split('|').map(s=>s.trim());
              return { date: parts[0], time: parts[1] };
            }
          }
          console.log('Tarih ve saat bulunamadı');
          return { date: '', time: '' };
        }
        
        // Müşteri verilerini algıla - güncellenmiş
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
            invoiceAddress:      getField('Alıcı Bilgileri', 'Kayıtlı Adres'),
            invoiceCity:         getField('Alıcı Bilgileri', 'Şehir'),
            invoiceCountry:      getField('Alıcı Bilgileri', 'Ülke') || getField('Fatura Adresi', 'Ülke'),
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

// Manuel müşteri ekle
document.getElementById('manualAdd').addEventListener('click', async () => {
  const fullName = (document.getElementById('manualName').value || '').trim();
  const taxId = (document.getElementById('manualTaxId').value || '').trim();
  const country = (document.getElementById('manualCountry').value || '').trim() || 'Türkiye';
  const address = (document.getElementById('manualAddress').value || '').trim();
  
  if (!fullName) {
    alert('Lütfen isim (Ad Soyad) girin.');
    return;
  }
  
  // Ad ve Soyad ayrıştırma
  const parts = fullName.split(/\s+/).filter(Boolean);
  const buyerName = parts.length > 1 ? parts.slice(0, -1).join(' ') : parts[0];
  const buyerSurname = parts.length > 1 ? parts[parts.length - 1] : '';
  
  // Telefonu ana anahtar yaptığımız için, manuel eklemede telefon yoksa benzersiz bir anahtar üretelim
  const phoneKey = `manual_${Date.now()}`;
  
  const data = {
    buyerName,
    buyerSurname,
    buyerEmail: '',
    buyerPhone: phoneKey,
    buyerTaxId: taxId,
    invoiceContactName: '',
    invoiceContactPhone: '',
    invoiceAddress: address,
    invoiceCity: '',
    invoiceCountry: country,
    amount: '',
    paymentDate: '',
    paymentTime: ''
  };
  
  chrome.storage.local.get('customers', (result) => {
    const customers = result.customers || {};
    customers[phoneKey] = data;
    chrome.storage.local.set({ customers }, () => {
      if (chrome.runtime.lastError) {
        alert('Kaydetme hatası: ' + chrome.runtime.lastError.message);
      } else {
        alert('Manuel müşteri eklendi.');
        // Formu temizle
        document.getElementById('manualName').value = '';
        document.getElementById('manualTaxId').value = '';
        document.getElementById('manualCountry').value = 'Türkiye';
        document.getElementById('manualAddress').value = '';
        // Listeyi yenile
        loadCustomers();
      }
    });
  });
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
          
          // e-Arşiv form alanlarını gelişmiş dinamik sistem ile doldur
          try {
            console.log('Form alanları gelişmiş dinamik sistem ile dolduruluyor...');
            
            let filledCount = 0;
            
            // Alıcı Bilgileri bölümünü bul
            const aliciBilgileriSection = Array.from(document.querySelectorAll('fieldset')).find(fieldset => {
              const legend = fieldset.querySelector('legend span');
              return legend && legend.textContent.trim().includes('Alıcı Bilgileri');
            });
            
            const searchAreas = aliciBilgileriSection ? [aliciBilgileriSection, document] : [document];
            
            // Önce TC Kimlik alanını doldur
            const tcField = findFieldByLabel(['vkn', 'tckn', 'tc kimlik'], searchAreas);
            if (tcField && customerData.buyerTaxId) {
              tcField.input.value = customerData.buyerTaxId;
              tcField.input.dispatchEvent(new Event('input', { bubbles: true }));
              tcField.input.dispatchEvent(new Event('change', { bubbles: true }));
              console.log('TC Kimlik dolduruldu (öncelikli):', customerData.buyerTaxId);
              filledCount++;
              
              // TC Kimlik doldurulduktan sonra kısa bir bekleme
              setTimeout(() => {
                fillOtherFields();
              }, 300);
            } else {
              // TC Kimlik yoksa direkt diğer alanları doldur
              fillOtherFields();
            }
            
            function fillOtherFields() {
              // Diğer form alanlarını tanımla ve doldur
              const fieldMappings = [
                {
                  keywords: ['adı'],
                  value: customerData.buyerName,
                  name: 'Ad',
                  exclude: ['soyad', 'firma']
                },
                {
                  keywords: ['soyadı', 'soyad'],
                  value: customerData.buyerSurname,
                  name: 'Soyad'
                },
                {
                  keywords: ['ülke', 'country'],
                  value: currentSettings.defaultCountry || 'Türkiye',
                  name: 'Ülke',
                  isSelect: true
                },
                {
                  keywords: ['adres', 'address'],
                  value: customerData.invoiceAddress,
                  name: 'Adres'
                },

                {
                  keywords: ['e-posta', 'email', 'e-mail'],
                  value: customerData.buyerEmail,
                  name: 'E-posta'
                },
                {
                  keywords: ['telefon', 'phone', 'gsm'],
                  value: customerData.buyerPhone,
                  name: 'Telefon'
                }
              ];
              
              // Her alan için arama yap ve doldur
              fieldMappings.forEach(mapping => {
              if (mapping.value) {
                const field = findFieldByLabel(mapping.keywords, searchAreas);
                
                if (field) {
                  // Exclude kontrolü - eğer label metni exclude edilen kelimeleri içeriyorsa atla
                  if (mapping.exclude) {
                    const hasExcludeWord = mapping.exclude.some(excludeWord => 
                      field.labelText.includes(excludeWord.toLowerCase())
                    );
                    if (hasExcludeWord) {
                      console.log(`${mapping.name} atlandı (exclude): ${field.labelText}`);
                      return;
                    }
                  }
                  
                  let filled = false;
                  
                  if (mapping.isSelect && field.input.tagName.toLowerCase() === 'select') {
                    // Select element için option bulup seç
                    const options = field.input.querySelectorAll('option');
                    const option = Array.from(options).find(opt => 
                      opt.value === mapping.value || 
                      opt.textContent.trim() === mapping.value
                    );
                    if (option) {
                      field.input.value = option.value;
                      filled = true;
                    }
                  } else {
                    // Normal input için
                    field.input.value = mapping.value;
                    filled = true;
                  }
                  
                  if (filled) {
                    // Input event'lerini tetikle
                    field.input.dispatchEvent(new Event('input', { bubbles: true }));
                    field.input.dispatchEvent(new Event('change', { bubbles: true }));
                    console.log(`${mapping.name} dolduruldu:`, mapping.value);
                    filledCount++;
                  }
                } else {
                  console.log(`${mapping.name} alanı bulunamadı`);
                }
                }
              });
              
              console.log(`Toplam ${filledCount} alan dolduruldu`);
              
              // Satır Ekle butonuna tıkla ve fiyat gir
              setTimeout(() => {
                addRowAndFillPrice(customerData.amount, customerData);
              }, 500);
            }
            
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
          
          // Satır Ekle butonunu dinamik olarak bul ve tıkla
          console.log('Satır Ekle butonu aranıyor...');
          
          // Önce text içeriğine göre bul
          let addRowButton = Array.from(document.querySelectorAll('input[type="button"]')).find(btn => 
            btn.value && btn.value.trim().toLowerCase().includes('satır ekle')
          );
          
          // Eğer bulunamazsa rel attribute'una göre bul
          if (!addRowButton) {
            addRowButton = document.querySelector('input[rel="satirEkle"]');
          }
          
          // Eğer hala bulunamazsa, tüm butonları kontrol et
          if (!addRowButton) {
            console.log('Satır Ekle butonu alternatif yöntemlerle aranıyor...');
            const allButtons = document.querySelectorAll('input[type="button"], button');
            console.log(`Sayfada ${allButtons.length} buton bulundu`);
            
            allButtons.forEach((btn, index) => {
              const btnText = (btn.value || btn.textContent || '').trim().toLowerCase();
              console.log(`Buton ${index}: "${btnText}"`);
              if (btnText.includes('satır') && btnText.includes('ekle')) {
                addRowButton = btn;
                console.log('Satır Ekle butonu metin araması ile bulundu!');
              }
            });
          }
          
          if (addRowButton) {
            console.log('Satır Ekle butonu bulundu, tıklanıyor...', addRowButton);
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
        
        // Gelişmiş label-based alan bulma fonksiyonu
        function findFieldByLabel(labelKeywords, sections = null) {
          console.log(`Alan aranıyor: ${labelKeywords.join(' / ')}`);
          
          // Arama yapılacak bölümler
          const searchAreas = sections || [document];
          
          for (const area of searchAreas) {
            const labels = area.querySelectorAll('label');
            
            for (const label of labels) {
              const labelText = label.textContent.trim().toLowerCase();
              
              // Anahtar kelimelerin herhangi birini içerip içermediğini kontrol et
              const matchesKeyword = labelKeywords.some(keyword => 
                labelText.includes(keyword.toLowerCase())
              );
              
              if (matchesKeyword) {
                const labelFor = label.getAttribute('for');
                if (labelFor) {
                  console.log(`Label bulundu: "${labelText}" -> ${labelFor}`);
                  
                  // Normal input'u bul
                  let input = document.querySelector(`#${labelFor}`);
                  
                  // Eğer tarih/saat alanıysa, date- prefixli input'u da dene
                  if (!input && (labelText.includes('tarih') || labelText.includes('saat'))) {
                    const dateInputId = labelFor.replace('gen__', 'date-gen__');
                    input = document.querySelector(`#${dateInputId}`);
                    console.log(`Tarih input denendi: ${dateInputId}`);
                  }
                  
                  if (input) {
                    console.log(`Input bulundu:`, input);
                    return { input, label, labelText };
                  }
                }
              }
            }
          }
          
          console.log(`Alan bulunamadı: ${labelKeywords.join(' / ')}`);
          return null;
        }
        
        // Tarih ve saat alanlarını dinamik olarak bul ve doldur
        function fillDateTimeFields(customerData) {
          console.log('Tarih ve saat alanları dolduruluyor...');
          console.log('Müşteri verisi:', customerData);
          
          // Fatura Bilgileri bölümünü bul
          const faturaBilgileriSection = Array.from(document.querySelectorAll('fieldset')).find(fieldset => {
            const legend = fieldset.querySelector('legend span');
            return legend && legend.textContent.trim().includes('Fatura Bilgileri');
          });
          
          const searchAreas = faturaBilgileriSection ? [faturaBilgileriSection, document] : [document];
          
          // Tarih alanını bul ve doldur
          if (customerData.paymentDate) {
            console.log('Ödeme tarihi bulundu:', customerData.paymentDate);
            
            const dateField = findFieldByLabel([
              'düzenlenme tarihi', 
              'fatura tarihi', 
              'tarih'
            ], searchAreas);
            
            if (dateField) {
              // Tarihi dd/mm/yyyy formatına çevir (17.07.2025 -> 17/07/2025)
              const dateParts = customerData.paymentDate.split('.');
              if (dateParts.length === 3) {
                const formattedDate = `${dateParts[0]}/${dateParts[1]}/${dateParts[2]}`;
                console.log(`Tarih formatı: ${customerData.paymentDate} -> ${formattedDate}`);
                
                dateField.input.value = formattedDate;
                dateField.input.dispatchEvent(new Event('input', { bubbles: true }));
                dateField.input.dispatchEvent(new Event('change', { bubbles: true }));
                console.log('Tarih alanı dolduruldu:', formattedDate);
              } else {
                console.log('Tarih formatı geçersiz:', customerData.paymentDate);
              }
            } else {
              console.log('Tarih alanı bulunamadı!');
            }
          }
          
          // Saat alanını bul ve doldur  
          if (customerData.paymentTime) {
            console.log('Ödeme saati bulundu:', customerData.paymentTime);
            
            const timeField = findFieldByLabel([
              'düzenlenme saati',
              'fatura saati', 
              'saat'
            ], searchAreas);
            
            if (timeField) {
              timeField.input.value = customerData.paymentTime;
              timeField.input.dispatchEvent(new Event('input', { bubbles: true }));
              timeField.input.dispatchEvent(new Event('change', { bubbles: true }));
              console.log('Saat alanı dolduruldu:', customerData.paymentTime);
            } else {
              console.log('Saat alanı bulunamadı!');
            }
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
            console.log('Storage\'dan alınan settings:', result.settings);
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
            console.log('Hizmet adı ayardan:', currentSettings.defaultService);
            
            // Eğer hizmet adı boşsa varsayılan değeri kullan
            if (!currentSettings.defaultService || currentSettings.defaultService.trim() === '') {
              currentSettings.defaultService = 'Hizmet';
              console.log('Hizmet adı boş, varsayılan değer kullanılıyor:', currentSettings.defaultService);
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
            
            // Tablodaki alanları tablo yapısına göre bul ve doldur
            setTimeout(() => {
              console.log('Tablo alanları aranıyor...');
              
              // Mal Hizmet tablosunu bul - alternatif yöntemler ile
              let malHizmetTable = document.querySelector('table[rel="malHizmetTable"]');
              
              // Eğer bulunamazsa alternatif yöntemler dene
              if (!malHizmetTable) {
                console.log('Mal Hizmet tablosu rel attribute ile bulunamadı, alternatif yöntemler deneniyor...');
                
                // 1. Tüm tabloları bul ve içeriğine göre filtrele
                const allTables = document.querySelectorAll('table');
                console.log(`Sayfada ${allTables.length} tablo bulundu`);
                
                for (const table of allTables) {
                  const tableText = table.textContent.toLowerCase();
                  if (tableText.includes('mal') || tableText.includes('hizmet') || tableText.includes('miktar') || tableText.includes('birim') || tableText.includes('fiyat')) {
                    console.log('Potansiyel mal/hizmet tablosu bulundu:', table);
                    malHizmetTable = table;
                    break;
                  }
                }
              }
              
              if (!malHizmetTable) {
                console.log('Hiçbir mal/hizmet tablosu bulunamadı');
                alert('Mal/Hizmet tablosu bulunamadı! Lütfen sayfayı yenileyin ve tekrar deneyin.');
                return;
              }
              
              console.log('Mal Hizmet tablosu bulundu:', malHizmetTable);
              
              // Tablo başlıklarını bul ve kolon indekslerini belirle - rel attribute'ları ile
              const headers = malHizmetTable.querySelectorAll('thead th');
              console.log(`Tablo başlığı sayısı: ${headers.length}`);
              
              let columnIndexes = {};
              headers.forEach((header, index) => {
                const headerText = header.textContent.trim().toLowerCase();
                const headerRel = header.getAttribute('rel');
                console.log(`Başlık ${index}: "${headerText}" (rel: "${headerRel}")`);
                
                // Önce rel attribute'larına göre kontrol et (daha güvenilir)
                if (headerRel === 'malHizmet') {
                  columnIndexes.service = index;
                  console.log(`Hizmet kolonu rel attribute ile tespit edildi: ${index}`);
                } else if (headerRel === 'miktar') {
                  columnIndexes.quantity = index;
                  console.log(`Miktar kolonu rel attribute ile tespit edildi: ${index}`);
                } else if (headerRel === 'birim') {
                  columnIndexes.unit = index;
                  console.log(`Birim kolonu rel attribute ile tespit edildi: ${index}`);
                } else if (headerRel === 'birimFiyat') {
                  columnIndexes.price = index;
                  console.log(`Fiyat kolonu rel attribute ile tespit edildi: ${index}`);
                } else if (headerRel === 'kdvOrani') {
                  columnIndexes.vat = index;
                  console.log(`KDV kolonu rel attribute ile tespit edildi: ${index}`);
                }
                // Eğer rel attribute bulunamazsa text içeriğine göre kontrol et
                else if (headerText.includes('mal/hizmet') || headerText.includes('mal hizmet') || headerText.includes('hizmet')) {
                  if (!columnIndexes.service) {
                    columnIndexes.service = index;
                    console.log(`Hizmet kolonu text ile tespit edildi: ${index}`);
                  }
                } else if (headerText.includes('miktar') && !columnIndexes.quantity) {
                  columnIndexes.quantity = index;
                  console.log(`Miktar kolonu text ile tespit edildi: ${index}`);
                } else if (headerText.includes('birim') && !headerText.includes('fiyat') && !columnIndexes.unit) {
                  columnIndexes.unit = index;
                  console.log(`Birim kolonu text ile tespit edildi: ${index}`);
                } else if (headerText.includes('birim fiyat') || headerText.includes('fiyat')) {
                  if (!columnIndexes.price) {
                    columnIndexes.price = index;
                    console.log(`Fiyat kolonu text ile tespit edildi: ${index}`);
                  }
                } else if (headerText.includes('kdv oranı') || headerText.includes('kdv')) {
                  if (!columnIndexes.vat) {
                    columnIndexes.vat = index;
                    console.log(`KDV kolonu text ile tespit edildi: ${index}`);
                  }
                }
              });
              
              console.log('Kolon indeksleri:', columnIndexes);
              
              // Tablodaki son satırı bul (boş satır)
              const tableBody = malHizmetTable.querySelector('tbody');
              const rows = tableBody.querySelectorAll('tr:not(.csc-table-paging-row)');
              console.log(`Tabloda ${rows.length} veri satırı bulundu`);
              
              if (rows.length > 0) {
                const lastRow = rows[rows.length - 1];
                console.log('Son satır bulundu:', lastRow);
                
                const cells = lastRow.querySelectorAll('td');
                console.log(`Son satırda ${cells.length} hücre bulundu`);
                
                // Her hücredeki input alanlarını bul ve doldur
                let fieldsFilledCount = 0;
                
                // Mal/Hizmet adı
                if (columnIndexes.service !== undefined && cells[columnIndexes.service]) {
                  console.log('Hizmet kolonunun indeksi:', columnIndexes.service);
                  console.log('Hizmet hücresi:', cells[columnIndexes.service]);
                  
                  // Input alanını bul - önce input olarak ara
                  let serviceInput = cells[columnIndexes.service].querySelector('input[type="text"], input[type="input"], input');
                  
                  // Eğer bulunamazsa genel input olarak ara
                  if (!serviceInput) {
                    serviceInput = cells[columnIndexes.service].querySelector('input, select, textarea');
                  }
                  
                  if (serviceInput) {
                    console.log('Hizmet input bulundu:', serviceInput);
                    console.log('Hizmet alanına yazılacak değer:', currentSettings.defaultService);
                    console.log('Input ID:', serviceInput.id);
                    console.log('Input type:', serviceInput.type);
                    console.log('Input class:', serviceInput.className);
                    
                    // Değeri yaz
                    serviceInput.value = currentSettings.defaultService;
                    
                    // Event'leri tetikle
                    serviceInput.dispatchEvent(new Event('input', { bubbles: true }));
                    serviceInput.dispatchEvent(new Event('change', { bubbles: true }));
                    serviceInput.dispatchEvent(new Event('blur', { bubbles: true }));
                    
                    console.log('Hizmet adı dolduruldu:', currentSettings.defaultService);
                    console.log('Input değeri kontrolü:', serviceInput.value);
                    console.log('Input değeri DOM\'da:', serviceInput.getAttribute('value'));
                    
                    fieldsFilledCount++;
                  } else {
                    console.log('Hizmet input alanı bulunamadı!');
                    console.log('Hücre içeriği:', cells[columnIndexes.service].innerHTML);
                  }
                } else {
                  console.log('Hizmet kolonu bulunamadı! columnIndexes.service:', columnIndexes.service);
                  console.log('Mevcut kolon indeksleri:', columnIndexes);
                }
                
                // Miktar
                if (columnIndexes.quantity !== undefined && cells[columnIndexes.quantity]) {
                  const quantityInput = cells[columnIndexes.quantity].querySelector('input, select, textarea');
                  if (quantityInput) {
                    quantityInput.value = currentSettings.defaultQuantity.toString();
                    quantityInput.dispatchEvent(new Event('input', { bubbles: true }));
                    quantityInput.dispatchEvent(new Event('change', { bubbles: true }));
                    console.log('Miktar dolduruldu:', currentSettings.defaultQuantity);
                    fieldsFilledCount++;
                  }
                }
                
                // Birim
                if (columnIndexes.unit !== undefined && cells[columnIndexes.unit]) {
                  const unitInput = cells[columnIndexes.unit].querySelector('input, select, textarea');
                  if (unitInput) {
                    unitInput.value = currentSettings.defaultUnit;
                    unitInput.dispatchEvent(new Event('change', { bubbles: true }));
                    console.log('Birim dolduruldu:', currentSettings.defaultUnit);
                    fieldsFilledCount++;
                  }
                }
                
                // Birim Fiyat
                if (columnIndexes.price !== undefined && cells[columnIndexes.price]) {
                  const priceInput = cells[columnIndexes.price].querySelector('input, select, textarea');
                  if (priceInput) {
                    priceInput.value = finalPrice;
                    priceInput.dispatchEvent(new Event('input', { bubbles: true }));
                    priceInput.dispatchEvent(new Event('change', { bubbles: true }));
                    console.log('Birim fiyat dolduruldu:', finalPrice);
                    fieldsFilledCount++;
                  }
                }
                
                // KDV Oranı
                if (columnIndexes.vat !== undefined && cells[columnIndexes.vat]) {
                  const vatInput = cells[columnIndexes.vat].querySelector('input, select, textarea');
                  if (vatInput) {
                    vatInput.value = currentSettings.defaultVat.toString();
                    vatInput.dispatchEvent(new Event('input', { bubbles: true }));
                    vatInput.dispatchEvent(new Event('change', { bubbles: true }));
                    console.log('KDV oranı dolduruldu:', currentSettings.defaultVat);
                    fieldsFilledCount++;
                  }
                }
                
                console.log(`Toplam ${fieldsFilledCount} alan dolduruldu`);
                
                // Tarih ve saat alanlarını doldur
                console.log('fillDateTimeFields fonksiyonu çağrılıyor...');
                fillDateTimeFields(customerData);
                console.log('fillDateTimeFields fonksiyonu tamamlandı');
                
                if (fieldsFilledCount > 0) {
                  alert(`Satır eklendi! ${fieldsFilledCount} alan dolduruldu.\nHizmet: ${currentSettings.defaultService}\nMiktar: ${currentSettings.defaultQuantity}\nBirim: ${currentSettings.defaultUnit}\nKDV: %${currentSettings.defaultVat}\nFiyat: ${amount}`);
                } else {
                  alert('Tablo alanları doldurulurken sorun oluştu!');
                }
              } else {
                console.log('Tablo satırı bulunamadı');
                alert('Tablo satırı bulunamadı!');
              }
            }, 500);
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
