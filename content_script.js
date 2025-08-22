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
  const labels = Array.from(document.querySelectorAll('body *')).filter(el => normalizeText(el.textContent) === wanted);
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

// Müşteri verilerini algıla (kaydetmeden) - güncellenmiş
function detectCustomerData() {
  console.log('detectCustomerData fonksiyonu çağrıldı');
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

// "Yeni Müşteri Kaydet"
function saveDataFromIyzico() {
  console.log('Content script saveDataFromIyzico çağrıldı');
  const data = detectCustomerData();
  if (!data) {
    console.log('Veri algılanamadı');
    return;
  }
  
  const phone = data.buyerPhone;
  if (!phone) {
    console.log('Telefon numarası bulunamadı');
    return alert('Telefon numarası alınamadı, kayıt iptal edildi.');
  }
  
  console.log('Chrome storage\'a kaydediliyor...');
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

// "Seçili Müşteriyi Doldur" - Dinamik alan bulma ile
function fillDataToEArsiv(phone) {
  chrome.storage.local.get('customers', ({ customers = {} }) => {
    const d = customers[phone];
    if (!d) return alert('Seçili müşteri bulunamadı!');
    
    console.log('Form alanları dinamik olarak dolduruluyor...');
    
    // Alıcı Bilgileri bölümünü bul
    const aliciBilgileriSection = Array.from(document.querySelectorAll('fieldset')).find(fieldset => {
      const legend = fieldset.querySelector('legend span');
      return legend && legend.textContent.trim().includes('Alıcı Bilgileri');
    });
    
    if (aliciBilgileriSection) {
      console.log('Alıcı Bilgileri bölümü bulundu');
      
      let filledCount = 0;
      
      // Önce TC Kimlik alanını bul ve doldur
      const labels = aliciBilgileriSection.querySelectorAll('label');
      let tcField = null;
      
      for (const label of labels) {
        const labelText = label.textContent.trim().toLowerCase();
        const labelFor = label.getAttribute('for');
        
        if (labelFor && (labelText.includes('vkn') || labelText.includes('tckn'))) {
          tcField = document.querySelector(`#${labelFor}`);
          if (tcField && d.buyerTaxId) {
            tcField.value = d.buyerTaxId;
            tcField.dispatchEvent(new Event('input', { bubbles: true }));
            tcField.dispatchEvent(new Event('change', { bubbles: true }));
            console.log('TC Kimlik dolduruldu (öncelikli):', d.buyerTaxId);
            filledCount++;
            break;
          }
        }
      }
      
      // TC Kimlik doldurulduktan sonra kısa bekleme ve diğer alanları doldur
      setTimeout(() => {
        labels.forEach(label => {
          const labelText = label.textContent.trim().toLowerCase();
          const labelFor = label.getAttribute('for');
          
          if (labelFor) {
            const input = document.querySelector(`#${labelFor}`);
            if (input) {
              // TC Kimlik zaten dolduruldu, atla
              if (labelText.includes('vkn') || labelText.includes('tckn')) {
                return;
              } else if (labelText.includes('unvan')) {
                // Unvan alanı boş bırakılıyor
                console.log('Unvan alanı atlandı');
              } else if (labelText.includes('adı') && !labelText.includes('soyad')) {
                input.value = d.buyerName || '';
                console.log('Ad dolduruldu:', d.buyerName);
                filledCount++;
              } else if (labelText.includes('soyadı')) {
                input.value = d.buyerSurname || '';
                console.log('Soyad dolduruldu:', d.buyerSurname);
                filledCount++;
              } else if (labelText.includes('ülke')) {
                input.value = 'Türkiye';
                console.log('Ülke dolduruldu: Türkiye');
                filledCount++;
              } else if (labelText.includes('vergi dairesi')) {
                // Vergi dairesi alanı boş bırakılıyor
                console.log('Vergi dairesi alanı atlandı');
              } else if (labelText.includes('adres')) {
                input.value = d.invoiceAddress || '';
                console.log('Adres dolduruldu:', d.invoiceAddress);
                filledCount++;
              }
              
              // Input event'lerini tetikle
              input.dispatchEvent(new Event('input', { bubbles: true }));
              input.dispatchEvent(new Event('change', { bubbles: true }));
            }
          }
        });
        
        console.log(`Toplam ${filledCount} alan dolduruldu`);
        alert(`e-Arşiv formu seçili müşteriyle dolduruldu! ${filledCount} alan güncellendi.`);
      }, 300);
    } else {
      console.log('Alıcı Bilgileri bölümü bulunamadı');
      alert('Alıcı Bilgileri bölümü bulunamadı!');
    }
  });
}
