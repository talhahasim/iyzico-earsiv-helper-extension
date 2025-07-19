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

// Müşteri verilerini algıla (kaydetmeden)
function detectCustomerData() {
  console.log('detectCustomerData fonksiyonu çağrıldı');
  console.log('Mevcut URL:', window.location.href);
  
  // Sayfa yüklendi mi kontrol et
  if (document.readyState !== 'complete') {
    console.log('Sayfa henüz yüklenmedi');
    return null;
  }
  
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
    invoiceCountry:      getField('Fatura Adresi', 'Ülke')
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

// "Seçili Müşteriyi Doldur"
function fillDataToEArsiv(phone) {
  chrome.storage.local.get('customers', ({ customers = {} }) => {
    const d = customers[phone];
    if (!d) return alert('Seçili müşteri bulunamadı!');
    document.querySelector('#gen__1033').value = d.buyerTaxId;
    document.querySelector('#gen__1034').value = `${d.buyerName} ${d.buyerSurname}`;
    document.querySelector('#gen__1035').value = d.buyerName;
    document.querySelector('#gen__1036').value = d.buyerSurname;
    document.querySelector('#gen__1042').value = d.invoiceCountry;
    document.querySelector('#gen__1043').value = d.invoiceAddress;
    alert('e-Arşiv formu seçili müşteriyle dolduruldu!');
  });
}