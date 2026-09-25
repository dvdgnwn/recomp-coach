export type Language = 'id' | 'en';

export interface Translations {
  appName: string;
  appSubtitle: string;
  consentTitle: string;
  consentNotice: string;
  consentCheckbox: string;
  consentContinue: string;
  formTitle: string;
  formSubtitle: string;
  sexLabel: string;
  sexMale: string;
  sexFemale: string;
  ageLabel: string;
  weightLabel: string;
  heightLabel: string;
  waistLabel: string;
  neckLabel: string;
  hipLabel: string;
  submitButton: string;
  calculating: string;
  clearDataButton: string;
  clearDataConfirm: string;
  resultsTitle: string;
  resultsSubtitle: string;
  recalculateButton: string;
  bodyFatLabel: string;
  bodyFatSubtext: string;
  ffmiLabel: string;
  ffmiSubtext: string;
  proteinLabel: string;
  proteinSubtext: string;
  pathLabel: string;
  pathRecomp: string;
  pathCut: string;
  pathLeanBulk: string;
  coachExplanationTitle: string;
  citedReelsTitle: string;
  supportiveNoticeTitle: string;
  supportiveNoticeMessage: string;
  // ── F2: Food Photo ────────────────────────────────────────────────────────
  foodNavLabel: string;
  foodPageTitle: string;
  foodPageSubtitle: string;
  weightInputLabel: string;
  mealsPerDayLabel: string;
  photoLabel: string;
  analyzeButton: string;
  analyzing: string;
  portionSmall: string;
  portionMedium: string;
  portionLarge: string;
  detectedItemsTitle: string;
  notCountedTitle: string;
  notCountedNote: string;
  proteinVsTarget: string;
  suggestionTitle: string;
  targetMet: string;
  estimateDisclaimer: string;
  photoPrivacy: string;
  notFood: string;
  aiUnavailable: string;
  perMealTargetLabel: string;
  validationErrors: {
    ageRange: string;
    weightRange: string;
    heightRange: string;
    waistRange: string;
    neckRange: string;
    hipRange: string;
    waistNeckMale: string;
    waistHipNeckFemale: string;
  };
}

export const translations: Record<Language, Translations> = {
  id: {
    appName: "Recomp Coach",
    appSubtitle: "Fokus pada komposisi tubuh, bukan angka timbangan.",
    consentTitle: "Persetujuan & Privasi",
    consentNotice:
      "Aplikasi ini bukan pengganti nasihat medis, diagnosis, atau penanganan profesional. Data Anda diproses langsung di memori untuk kalkulasi ini dan tidak disimpan di server maupun penyimpanan lokal.",
    consentCheckbox:
      "Saya memahami bahwa ini adalah panduan kebugaran berbasis edukasi dan bukan nasihat medis.",
    consentContinue: "Lanjut ke Pengukuran",
    formTitle: "Ukur Komposisi Tubuh",
    formSubtitle:
      "Masukkan ukuran tubuh Anda untuk menghitung perkiraan lemak tubuh dan jalur yang tepat.",
    sexLabel: "Jenis Kelamin Biologis",
    sexMale: "Pria",
    sexFemale: "Wanita",
    ageLabel: "Usia (tahun)",
    weightLabel: "Berat Badan (kg)",
    heightLabel: "Tinggi Badan (cm)",
    waistLabel: "Lingkar Pinggang (cm)",
    neckLabel: "Lingkar Leher (cm)",
    hipLabel: "Lingkar Pinggul (cm)",
    submitButton: "Analisis Komposisi Tubuh",
    calculating: "Menganalisis data bersama AI Coach...",
    clearDataButton: "Hapus Data Saya",
    clearDataConfirm: "Semua isian telah dibersihkan dari memori.",
    resultsTitle: "Hasil Komposisi Tubuh",
    resultsSubtitle: "Gambaran nyata kondisi tubuh Anda melampaui angka timbangan.",
    recalculateButton: "Hitung Ulang / Ubah Data",
    bodyFatLabel: "Perkiraan Lemak Tubuh (US Navy)",
    bodyFatSubtext:
      "Ditampilkan sebagai rentang estimasi (±3.5%) karena tidak ada satu angka pasti tanpa scan medis.",
    ffmiLabel: "Fat-Free Mass Index (FFMI)",
    ffmiSubtext: "Indeks massa otot bebas lemak relatif terhadap tinggi badan Anda.",
    proteinLabel: "Target Protein Harian",
    proteinSubtext: "Kebutuhan optimal (1.6 - 2.2 g/kg berat badan) untuk sintesis otot.",
    pathLabel: "Jalur Rekomendasi Coach",
    pathRecomp: "Body Recomposition",
    pathCut: "Fokus Penurunan Lemak (Cut)",
    pathLeanBulk: "Fokus Pembentukan Otot (Lean Bulk)",
    coachExplanationTitle: "Mengapa Timbangan Saja Bisa Menipu",
    citedReelsTitle: "Materi Edukasi Terkait",
    supportiveNoticeTitle: "Dukungan & Perhatian untuk Anda",
    supportiveNoticeMessage:
      "Kesehatan dan kesejahteraan Anda adalah yang paling utama. Dari pengukuran yang Anda masukkan, indikator tubuh menunjukkan bahwa Anda kemungkinan berada di bawah berat badan sehat atau mengalami pembatasan nutrisi. Kami tidak memberikan rekomendasi penurunan atau target angka di sini. Kami sangat menyarankan Anda berkonsultasi langsung dengan dokter atau ahli gizi teregistrasi (dietitian) untuk mendapatkan panduan yang aman dan personal.",
    foodNavLabel: "Foto Makanan",
    foodPageTitle: "Foto Makanan",
    foodPageSubtitle: "Foto piring Anda dan kami akan memperkirakan kandungan protein dari foto tersebut.",
    weightInputLabel: "Berat Badan (kg)",
    mealsPerDayLabel: "Jumlah makan per hari",
    photoLabel: "Foto Makanan",
    analyzeButton: "Analisis",
    analyzing: "Menganalisis foto...",
    portionSmall: "Kecil",
    portionMedium: "Sedang",
    portionLarge: "Besar",
    detectedItemsTitle: "Makanan Terdeteksi",
    notCountedTitle: "Tidak Dihitung",
    notCountedNote: "Item berikut tidak dapat dicocokkan dengan data gizi kami.",
    proteinVsTarget: "Protein vs Target",
    suggestionTitle: "Saran Tambahan",
    targetMet: "Target terpenuhi! 🎉",
    estimateDisclaimer: "Estimasi dari foto, bukan penimbangan",
    photoPrivacy: "Foto tidak disimpan",
    notFood: "Foto ini tampaknya bukan makanan. Coba foto piring makanan Anda.",
    aiUnavailable: "AI tidak tersedia, silakan coba lagi.",
    perMealTargetLabel: "Target protein per makan",
    validationErrors: {
      ageRange: "Usia harus antara 18 hingga 100 tahun.",
      weightRange: "Berat badan harus antara 30 hingga 250 kg.",
      heightRange: "Tinggi badan harus antara 100 hingga 250 cm.",
      waistRange: "Lingkar pinggang harus antara 40 hingga 200 cm.",
      neckRange: "Lingkar leher harus antara 20 hingga 70 cm.",
      hipRange: "Lingkar pinggul harus antara 50 hingga 200 cm.",
      waistNeckMale: "Lingkar pinggang harus lebih besar dari lingkar leher.",
      waistHipNeckFemale: "Jumlah pinggang dan pinggul harus lebih besar dari lingkar leher.",
    },
  },
  en: {
    appName: "Recomp Coach",
    appSubtitle: "Focus on body composition, not bathroom scale illusions.",
    consentTitle: "Consent & Privacy",
    consentNotice:
      "This application is for educational purposes and is not a substitute for professional medical advice, diagnosis, or treatment. Your inputs are processed in-memory for this calculation and are never persisted to a server database or local storage.",
    consentCheckbox:
      "I understand that this provides educational fitness guidance and does not constitute medical advice.",
    consentContinue: "Continue to Measurements",
    formTitle: "Body Composition Assessment",
    formSubtitle:
      "Enter your measurements to calculate your estimated body fat range, FFMI, and personalized training path.",
    sexLabel: "Biological Sex",
    sexMale: "Male",
    sexFemale: "Female",
    ageLabel: "Age (years)",
    weightLabel: "Weight (kg)",
    heightLabel: "Height (cm)",
    waistLabel: "Waist Circumference (cm)",
    neckLabel: "Neck Circumference (cm)",
    hipLabel: "Hip Circumference (cm)",
    submitButton: "Analyze Body Composition",
    calculating: "Analyzing with AI Coach...",
    clearDataButton: "Delete My Data",
    clearDataConfirm: "All inputs have been cleared from memory.",
    resultsTitle: "Your Body Composition",
    resultsSubtitle: "Real insight into what is happening beyond the bathroom scale.",
    recalculateButton: "Recalculate / Edit Data",
    bodyFatLabel: "Estimated Body Fat (US Navy)",
    bodyFatSubtext:
      "Always presented as a range (±3.5%) to reflect realistic formula precision.",
    ffmiLabel: "Fat-Free Mass Index (FFMI)",
    ffmiSubtext: "Lean muscle mass index normalized to your height.",
    proteinLabel: "Daily Protein Target",
    proteinSubtext: "Optimal intake (1.6 - 2.2 g/kg bodyweight) for muscle protein synthesis.",
    pathLabel: "Coach Recommended Path",
    pathRecomp: "Body Recomposition",
    pathCut: "Moderate Cut",
    pathLeanBulk: "Lean Bulk",
    coachExplanationTitle: "Why Scale Weight Alone Misleads",
    citedReelsTitle: "Referenced Creator Reels",
    supportiveNoticeTitle: "Care & Support Notice",
    supportiveNoticeMessage:
      "Your health and well-being come first. Based on your measurements, indicators suggest that you may be underweight or in a restrictive energy state. We intentionally bypass weight/target coaching here. We strongly encourage you to speak with a physician or registered dietitian who can provide safe, supportive, and individualized care.",
    foodNavLabel: "Food Photo",
    foodPageTitle: "Food Photo",
    foodPageSubtitle: "Photograph your plate and we'll estimate the protein content from the image.",
    weightInputLabel: "Your Weight (kg)",
    mealsPerDayLabel: "Meals per day",
    photoLabel: "Food Photo",
    analyzeButton: "Analyze",
    analyzing: "Analyzing photo...",
    portionSmall: "Small",
    portionMedium: "Medium",
    portionLarge: "Large",
    detectedItemsTitle: "Detected Foods",
    notCountedTitle: "Not Counted",
    notCountedNote: "The following items could not be matched to our nutrition database.",
    proteinVsTarget: "Protein vs Target",
    suggestionTitle: "Add-on Suggestion",
    targetMet: "Target met! 🎉",
    estimateDisclaimer: "Photo estimate, not a scale measurement",
    photoPrivacy: "Photo not stored",
    notFood: "This photo doesn't appear to be a meal. Please try photographing your plate.",
    aiUnavailable: "AI unavailable, please retry.",
    perMealTargetLabel: "Protein target per meal",
    validationErrors: {
      ageRange: "Age must be between 18 and 100 years.",
      weightRange: "Weight must be between 30 and 250 kg.",
      heightRange: "Height must be between 100 and 250 cm.",
      waistRange: "Waist circumference must be between 40 and 200 cm.",
      neckRange: "Neck circumference must be between 20 and 70 cm.",
      hipRange: "Hip circumference must be between 50 and 200 cm.",
      waistNeckMale: "Waist circumference must be greater than neck circumference.",
      waistHipNeckFemale: "Waist + hip circumference must be greater than neck circumference.",
    },
  },
};
