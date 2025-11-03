// --- (1) CONSTANTS & CONFIGURATION ---

// TODO: قم بتغيير هذا الباسورد
const HISTORY_PASSWORD = '12345';

// Supabase Configuration
const SUPABASE_URL = 'https://kjiujbsyhxpooppmxgxb.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtqaXVqYnN5aHhwb29wcG14Z3hiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIxMDI0MjcsImV4cCI6MjA3NzY3ODQyN30.PcG8aF4r1RjennleU_14vqxJSAoxY_MyOl9GLdbKVkw';

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- (2) APPLICATION STATE ---

// State object to hold global data
const appState = {
  currentView: 'dashboard',
  isLoading: false,
  // We store patient info here to re-use across calculators
  currentPatientName: '',
  currentPatientIdentifier: '', 
};

// --- (3) HELPER FUNCTIONS ---

// Shortcut for document.querySelector
const $ = (selector) => document.querySelector(selector);

// Helper to render HTML content into the app container
const render = (html) => {
  $('#app-container').innerHTML = html;
};

// Function to format date (e.g., 02/11/2025, 11:15 PM)
const formatDateTime = (dateStr) => {
  const date = new Date(dateStr);
  return date.toLocaleString('en-US', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: true
  });
};

// --- (4) NAVIGATION (ROUTER) ---

/**
 * Main navigation function. Renders different views based on the viewName.
 * @param {string} viewName - The name of the view to render.
 */
function navigateTo(viewName) {
  appState.currentView = viewName;
  switch (viewName) {
    case 'dashboard':
      renderDashboard();
      break;
    case 'heparin':
      renderHeparinCalculator();
      break;
    case 'prophylaxis':
      renderProphylaxisCalculator();
      break;
    case 'ivCalculator':
      renderIVCalculator();
      break;
    case 'renalDosing':
      renderRenalDosing();
      break;
    case 'padua':
      renderPaduaScore();
      break;
    case 'scores':
      renderClinicalScores();
      break;
    case 'converter':
      renderUnitConverter();
      break;
    case 'history':
      renderHistoryPasswordPrompt();
      break;
    default:
      renderDashboard();
  }
  // Add event listeners for the newly rendered content
  addEventListeners();
}

/**
 * Adds event listeners to the elements in the currently rendered view.
 * This function is called after every navigation.
 */
function addEventListeners() {
  // Back button (present in all views except dashboard)
  const backBtn = $('#back-to-dashboard');
  if (backBtn) {
    backBtn.addEventListener('click', () => navigateTo('dashboard'));
  }

  // Dashboard buttons
  if (appState.currentView === 'dashboard') {
    $('[data-nav="heparin"]')?.addEventListener('click', () => navigateTo('heparin'));
    $('[data-nav="prophylaxis"]')?.addEventListener('click', () => navigateTo('prophylaxis'));
    $('[data-nav="ivCalculator"]')?.addEventListener('click', () => navigateTo('ivCalculator'));
    $('[data-nav="renalDosing"]')?.addEventListener('click', () => navigateTo('renalDosing'));
    $('[data-nav="padua"]')?.addEventListener('click', () => navigateTo('padua'));
    $('[data-nav="scores"]')?.addEventListener('click', () => navigateTo('scores'));
    $('[data-nav="converter"]')?.addEventListener('click', () => navigateTo('converter'));
    $('[data-nav="history"]')?.addEventListener('click', () => navigateTo('history'));
  }

  // History Password prompt
  if (appState.currentView === 'history') {
    const historyForm = $('#history-password-form');
    historyForm?.addEventListener('submit', handleHistoryPasswordSubmit);
  }

  // Specific calculator forms
  const heparinForm = $('#heparin-form');
  if (heparinForm) {
    // Add listeners for mode toggle
    $('#initialModeBtn')?.addEventListener('click', () => toggleHeparinMode('initial'));
    $('#maintenanceModeBtn')?.addEventListener('click', () => toggleHeparinMode('maintenance'));
    // Add form submit listener
    heparinForm.addEventListener('submit', handleHeparinSubmit);
  }
  
  const prophylaxisForm = $('#prophylaxis-form');
  if (prophylaxisForm) {
    // Add listeners for checklist items
    prophylaxisForm.querySelectorAll('.risk-factor-card').forEach(card => {
      card.addEventListener('click', handleProphylaxisCheck);
    });
    // ***FIX***: Add submit listener for the new "Save" button
    prophylaxisForm.addEventListener('submit', handleProphylaxisSubmit);
  }
  
  const paduaForm = $('#padua-form');
  if (paduaForm) {
    paduaForm.querySelectorAll('.risk-factor-card').forEach(card => {
      card.addEventListener('click', handlePaduaCheck);
    });
    // ***FIX***: Add submit listener for the new "Save" button
    paduaForm.addEventListener('submit', handlePaduaSubmit);
  }

  const ivForm = $('#iv-form');
  if (ivForm) {
    ivForm.addEventListener('submit', handleIVSubmit);
  }
  
  const renalForm = $('#renal-form');
  if (renalForm) {
    // Live calculation for CrCl
    renalForm.addEventListener('input', handleRenalDosingInput);
  }
  
  const converterForm = $('#converter-form');
  if (converterForm) {
    // Live calculation for converter
    converterForm.addEventListener('input', handleConverterInput);
  }
}

// --- (5) HTML RENDERING FUNCTIONS (VIEWS) ---

// Back button component
const BackButton = () => `
  <div id="back-to-dashboard" class="back-button">
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M19 12H5"></path><path d="M12 19l-7-7 7-7"></path>
    </svg>
    <span>العودة للرئيسية</span>
  </div>
`;

// Patient Info fields component (reusable)
const PatientInfoFields = (name = appState.currentPatientName, identifier = appState.currentPatientIdentifier) => `
  <div class="input-group">
    <label for="patientName">اسم المريض:</label>
    <input type="text" id="patientName" name="patientName" value="${name}" required>
  </div>
  <div class="input-group">
    <label for="patientIdentifier">رقم المريض / الغرفة:</label>
    <input type="text" id="patientIdentifier" name="patientIdentifier" value="${identifier}" required>
  </div>
`;

// --- DESIGN UPGRADE: Inline SVG Icons ---
const Icons = {
  heparin: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0L12 2.69z"></path></svg>`,
  prophylaxis: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>`,
  padua: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle><polyline points="17 11 19 13 23 9"></polyline></svg>`,
  ivCalculator: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H7a2 2 0 0 0-2 2v5a2 2 0 0 1-2 2 2 2 0 0 1 2 2v5a2 2 0 0 0 2 2h1"></path><path d="M16 21h1a2 2 0 0 0 2-2v-5a2 2 0 0 1 2-2 2 2 0 0 1-2-2V5a2 2 0 0 0-2-2h-1"></path><path d="M12 18v-2"></path><path d="M12 8V6"></path><path d="M12 13V11"></path></svg>`,
  renalDosing: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a7 7 0 0 1 7 7c0 5-7 11-7 11s-7-6-7-11a7 7 0 0 1 7-7z"></path><circle cx="12" cy="10" r="3"></circle></svg>`,
  scores: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect><path d="M12 11h4"></path><path d="M12 16h4"></path><path d="M8 11h.01"></path><path d="M8 16h.01"></path></svg>`,
  converter: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 3h5v5"></path><path d="M4 20L21 3"></path><path d="M21 16v5h-5"></path><path d="M3 4l18 18"></path></svg>`,
  history: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 4v6h6"></path><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path></svg>`
};

// Renders the main Dashboard (with Icons)
function renderDashboard() {
  render(`
    <h1 class="text-center" style="font-size: 2.75rem;">CHG - Clinical Toolkit</h1>
    <p class="description text-center">اختر أداة للبدء.</p>
    <div class="flex flex-col gap-4 mt-8">
      <button type="button" class="btn" data-nav="heparin">
        ${Icons.heparin}
        <span>حاسبة الهيبارين</span>
      </button>
      <button type="button" class="btn" data-nav="prophylaxis">
        ${Icons.prophylaxis}
        <span>تقييم قرحة المعدة</span>
      </button>
      <button type="button" class="btn" data-nav="padua">
        ${Icons.padua}
        <span>تقييم Padua (VTE)</span>
      </button>
      <button type="button" class="btn" data-nav="ivCalculator">
        ${Icons.ivCalculator}
        <span>حاسبة المحاليل الوريدية</span>
      </button>
      <button type="button" class="btn" data-nav="renalDosing">
        ${Icons.renalDosing}
        <span>تعديل جرعات الكلى (CrCl)</span>
      </button>
      <button type="button" class="btn" data-nav="scores">
        ${Icons.scores}
        <span>تقييمات أخرى</span>
      </button>
      <button type="button" class="btn" data-nav="converter">
        ${Icons.converter}
        <span>محول الوحدات</span>
      </button>
      <button type="button" class="btn" data-nav="history" style="background-image: linear-gradient(to right, #607d8b, #78909c);">
        ${Icons.history}
        <span>عرض سجل الحسابات</span>
      </button>
    </div>
  `);
}

// Renders the History password prompt
function renderHistoryPasswordPrompt() {
  render(`
    ${BackButton()}
    <h1 class="text-center">عرض السجل</h1>
    <p class="description text-center">الرجاء إدخال كلمة المرور لعرض سجل الحسابات.</p>
    <form id="history-password-form" class="space-y-6">
      <div class="input-group">
        <label for="historyPassword">كلمة المرور:</label>
        <input type="password" id="historyPassword" name="historyPassword" required>
      </div>
      <button type="submit" class="btn">فتح</button>
      <div id="history-result" class="mt-4"></div>
    </form>
  `);
}

// Renders the fetched logs (if password is correct)
async function renderHistoryLogs() {
  render(`
    ${BackButton()}
    <h1 class="text-center">سجل الحسابات</h1>
    <p class="description text-center">عرض آخر 50 عملية حسابية.</p>
    <div id="logs-container"><p class="text-center">جاري تحميل السجلات...</p></div>
  `);

  appState.isLoading = true;
  try {
    let { data: logs, error } = await db
      .from('calculation_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    if (!logs || logs.length === 0) {
      $('#logs-container').innerHTML = '<p class="text-center">لم يتم العثور على أي سجلات.</p>';
      return;
    }
    
    // Build HTML for each log card
    const logsHtml = logs.map(log => `
      <div class="log-card">
        <div class="log-card-header">
          <span class="log-card-title">${log.tool_name.replace(/_/g, ' ')}</span>
          <span class="log-card-time">${formatDateTime(log.created_at)}</span>
        </div>
        <div class="log-card-patient">
          المريض: ${log.patient_name || 'N/A'} (رقم: ${log.patient_identifier || 'N/A'})
        </div>
        <div class="log-card-body">
          ${formatLogData(log)}
        </div>
      </div>
    `).join('');
    
    $('#logs-container').innerHTML = logsHtml;
    
  } catch (error) {
    console.error('Error fetching history:', error);
    $('#logs-container').innerHTML = `<div class="error-box"><p>فشل تحميل السجل. الرجاء التحقق من الاتصال والمحاولة مرة أخرى.</p><p>${error.message}</p></div>`;
  } finally {
    appState.isLoading = false;
    // ***FIX***: Re-add event listeners *after* rendering the new view
    addEventListeners();
  }
}

// Renders the Heparin Calculator
function renderHeparinCalculator() {
  render(`
    ${BackButton()}
    <h1 class="text-center">حاسبة الهيبارين</h1>
    
    <div class="mode-toggle-buttons">
      <button type="button" id="initialModeBtn" class="mode-btn active">الجرعة المبدئية</button>
      <button type="button" id="maintenanceModeBtn" class="mode-btn">تعديل الجرعة</button>
    </div>
    
    <form id="heparin-form" class="space-y-6">
      
      <!-- Patient Info -->
      ${PatientInfoFields()}

      <!-- Common Fields -->
      <div class="input-group">
        <label for="weight">وزن المريض (kg):</label>
        <input type="number" id="weight" name="weight" step="0.1" required>
      </div>
      <div class="input-group">
        <label for="heparinConcentration">تركيز الهيبارين (units/mL):</label>
        <input type="number" id="heparinConcentration" name="heparinConcentration" value="100" step="0.1" required>
      </div>

      <!-- Initial-Only Fields -->
      <div id="initialFields" class="space-y-6">
        <div class="input-group">
          <label for="indication">الداعي للاستعمال (Indication):</label>
          <select id="indication" name="indication" required>
            <option value="">اختر...</option>
            <option value="AF">AF (Atrial Fibrillation)</option>
            <option value="Venous thromboembolism">Venous Thromboembolism</option>
            <option value="Acute coronary syndrome">Acute Coronary Syndrome</option>
          </select>
        </div>
      </div>

      <!-- Maintenance-Only Fields -->
      <div id="maintenanceFields" class="space-y-6 hidden">
        <div class="input-group">
          <label for="currentInfusionRate">المعدل الحالي (mL/hour):</label>
          <input type="number" id="currentInfusionRate" name="currentInfusionRate" step="0.1" required>
        </div>
        <div class="input-group">
          <label for="currentPtt">قيمة الـ PTT الحالية (seconds):</label>
          <input type="number" id="currentPtt" name="currentPtt" step="0.1" required>
        </div>
      </div>

      <button type="submit" class="btn" id="calculateBtn">
        ${Icons.heparin}
        <span>احسب</span>
      </button>
      
      <!-- Result area -->
      <div id="result-area" class="mt-4"></div>
    </form>
  `);
  // Set default required state
  toggleHeparinMode('initial'); 
}

// Renders the Stress Ulcer Prophylaxis calculator
function renderProphylaxisCalculator() {
  const highRiskFactors = [
    'Mechanical Ventilation with no enteral feeding (>48h)', 'Chronic Liver Disease', 'Concerning Coagulopathy',
    'Multiple Trauma, Brain Injury or Spinal Cord', 'Burns over 35% of total surface area', 'Organ Transplant',
    'History of Peptic Ulcer Disease', 'Dual Antiplatelet', 'Septic Shock'
  ];
  const moderateRiskFactors = [
    'Mechanical Ventilation with enteral nutrition', 'Single Antiplatelet Therapy', 'Oral Anticoagulation', 'Sepsis',
    'ICU stay > 7 days', 'Renal Replacement Therapy', 'High Dose Steroids or Immunosuppressant', 'Shock'
  ];
  
  const createChecklist = (factors) => factors.map(factor => `
    <label class="risk-factor-card">
      <input type="checkbox" name="riskFactor" value="${factor}" class="hidden">
      <span>${factor}</span>
    </label>
  `).join('');

  render(`
    ${BackButton()}
    <h1 class="text-center">تقييم قرحة المعدة</h1>
    <form id="prophylaxis-form" class="space-y-6">
      
      <!-- Patient Info -->
      ${PatientInfoFields()}
      
      <p class="font-bold text-lg mb-2">اختر جميع عوامل الخطورة المنطبقة:</p>
      
      <div class="risk-group-heading">عوامل خطورة عالية:</div>
      <div class="risk-factors-container">
        ${createChecklist(highRiskFactors)}
      </div>

      <div class="risk-group-heading">عوامل خطورة متوسطة/منخفضة:</div>
      <div class="risk-factors-container">
        ${createChecklist(moderateRiskFactors)}
      </div>
      
      <!-- Result area -->
      <div id="result-area" class="mt-4"></div>

      <!-- ***FIX***: Added a save button -->
      <div class="mt-6">
        <button type="submit" class="btn" id="saveBtn">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
          <span>حفظ النتيجة</span>
        </button>
      </div>
    </form>
  `);
}

// Renders the Padua Score calculator
function renderPaduaScore() {
  const paduaFactors = {
    'Active cancer': 3,
    'Previous VTE': 3,
    'Reduced mobility': 3,
    'Known thrombophilic condition': 3,
    'Recent trauma/surgery (<1 month)': 2,
    'Age > 70 years': 1,
    'Heart/respiratory failure': 1,
    'Acute MI or ischemic stroke': 1,
    'Acute infection/rheumatologic disorder': 1,
    'Obesity (BMI > 30)': 1,
    'Hormonal treatment': 1,
  };
  
  const createChecklist = (factors) => Object.entries(factors).map(([factor, score]) => `
    <label class="risk-factor-card">
      <input type="checkbox" name="riskFactor" value="${factor}" data-score="${score}" class="hidden">
      <span>${factor} <strong>(+${score})</strong></span>
    </label>
  `).join('');
  
  render(`
    ${BackButton()}
    <h1 class="text-center">تقييم Padua (VTE)</h1>
    <form id="padua-form" class="space-y-6">
      
      <!-- Patient Info -->
      ${PatientInfoFields()}
      
      <p class="font-bold text-lg mb-2">اختر جميع عوامل الخطورة المنطبقة:</p>
      
      <div class="risk-factors-container">
        ${createChecklist(paduaFactors)}
      </div>
      
      <!-- Result area -->
      <div id="result-area" class="mt-4"></div>

      <!-- ***FIX***: Added a save button -->
      <div class="mt-6">
        <button type="submit" class="btn" id="saveBtn">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
          <span>حفظ النتيجة</span>
        </button>
      </div>
    </form>
  `);
}

// Renders the IV Infusion Calculator
function renderIVCalculator() {
  render(`
    ${BackButton()}
    <h1 class="text-center">حاسبة المحاليل الوريدية</h1>
    <form id="iv-form" class="space-y-6">
      
      <!-- Patient Info -->
      ${PatientInfoFields()}
      
      <div class="input-group">
        <label for="weight">وزن المريض (kg):</label>
        <input type="number" id="weight" name="weight" step="0.1" required>
      </div>
      <div class="input-group">
        <label for="drugAmount">إجمالي كمية الدواء (mg):</label>
        <input type="number" id="drugAmount" name="drugAmount" step="0.1" required>
      </div>
      <div class="input-group">
        <label for="solutionVolume">إجمالي حجم المحلول (mL):</label>
        <input type="number" id="solutionVolume" name="solutionVolume" value="250" step="1" required>
      </div>
      <div class="input-group">
        <label for="drugDose">الجرعة المطلوبة:</label>
        <input type="number" id="drugDose" name="drugDose" step="0.01" required>
      </div>
      <div class="input-group">
        <label for="doseUnit">وحدة الجرعة:</label>
        <select id="doseUnit" name="doseUnit" required>
          <option value="mcg/kg/min">mcg/kg/min</option>
          <option value="mcg/min">mcg/min</option>
          <option value="mg/hr">mg/hr</option>
        </select>
      </div>
      
      <button type="submit" class="btn" id="calculateBtn">
        ${Icons.ivCalculator}
        <span>احسب المعدل</span>
      </button>
      
      <!-- Result area -->
      <div id="result-area" class="mt-4"></div>
    </form>
  `);
}

// Renders the Renal Dosing (CrCl) Calculator
function renderRenalDosing() {
  render(`
    ${BackButton()}
    <h1 class="text-center">تعديل جرعات الكلى (CrCl)</h1>
    <p class="description text-center">حساب تصفية الكرياتينين (Cockcroft-Gault).</p>
    <form id="renal-form" class="space-y-6">
      
      <!-- Patient Info -->
      ${PatientInfoFields()}
      
      <div class="input-group">
        <label for="age">العمر (سنوات):</label>
        <input type="number" id="age" name="age">
      </div>
      <div class="input-group">
        <label for="weight">الوزن (kg):</label>
        <input type="number" id="weight" name="weight">
      </div>
      <div class="input-group">
        <label for="creatinine">نسبة الكرياتينين (mg/dL):</label>
        <input type="number" id="creatinine" name="creatinine" step="0.1">
      </div>
      <div class="input-group">
        <label for="gender">الجنس:</label>
        <select id="gender" name="gender">
          <option value="male">ذكر</option>
          <option value="female">أنثى</option>
        </select>
      </div>
      
      <!-- Result area -->
      <div id="result-area" class="mt-4"></div>
    </form>
  `);
}

// Renders the Unit Converter
function renderUnitConverter() {
  render(`
    ${BackButton()}
    <h1 class="text-center">محول الوحدات</h1>
    <form id="converter-form" class="space-y-6">
      <div class="input-group">
        <label for="fromValue">من:</label>
        <input type="number" id="fromValue" name="fromValue" value="1">
        <select id="fromUnit" name="fromUnit" class="mt-2">
          <optgroup label="كتلة">
            <option value="kg">kg</option><option value="g">g</option><option value="mg" selected>mg</option><option value="mcg">mcg</option>
          </optgroup>
          <optgroup label="حجم">
            <option value="L">L</option><option value="mL">mL</option>
          </optgroup>
          <optgroup label="وزن">
            <option value="lbs">lbs</option>
          </optgroup>
        </select>
      </div>
      <div class="input-group">
        <label for="toValue">إلى:</label>
        <input type="text" id="toValue" name="toValue" disabled class="bg-gray-200">
        <select id="toUnit" name="toUnit" class="mt-2">
          <optgroup label="كتلة">
            <option value="kg">kg</option><option value="g">g</option><option value="mg">mg</option><option value="mcg" selected>mcg</option>
          </optgroup>
          <optgroup label="حجم">
            <option value="L">L</option><option value="mL">mL</option>
          </optgroup>
          <optgroup label="وزن">
            <option value="lbs">lbs</option>
          </optgroup>
        </select>
      </div>
    </form>
  `);
  handleConverterInput(); // Calculate initial value
}

// Renders the placeholder for other scores
function renderClinicalScores() {
  render(`
    ${BackButton()}
    <h1 class="text-center">تقييمات إكلينيكية</h1>
    <p class="description text-center">سيتم إضافة المزيد من التقييمات قريباً.</p>
    <div class="space-y-4">
      <button type="button" class="btn opacity-50" disabled>CURB-65 (Pneumonia)</button>
      <button type="button" class="btn opacity-50" disabled>SOFA Score (Sepsis)</button>
      <button type="button" class="btn opacity-50" disabled>CHA₂DS₂-VASc (AF Stroke Risk)</button>
      <button type="button" class="btn opacity-50" disabled>Glasgow Coma Scale (GCS)</button>
    </div>
  `);
}


// --- (6) EVENT HANDLERS & LOGIC ---

// --- Heparin ---
function toggleHeparinMode(mode) {
  const isInitial = (mode === 'initial');
  $('#initialModeBtn').classList.toggle('active', isInitial);
  $('#maintenanceModeBtn').classList.toggle('active', !isInitial);
  
  $('#initialFields').classList.toggle('hidden', !isInitial);
  $('#maintenanceFields').classList.toggle('hidden', isInitial);
  
  // Toggle 'required' attribute
  $('#indication').required = isInitial;
  $('#currentInfusionRate').required = !isInitial;
  $('#currentPtt').required = !isInitial;
  
  // Clear results
  $('#result-area').innerHTML = '';
}

async function handleHeparinSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const resultArea = $('#result-area');
  const calculateBtn = $('#calculateBtn');
  
  if (calculateBtn) {
    calculateBtn.disabled = true;
    calculateBtn.innerHTML = `${Icons.heparin} <span>جاري الحساب...</span>`;
  }
  resultArea.innerHTML = '';
  
  try {
    appState.currentPatientName = form.patientName.value;
    appState.currentPatientIdentifier = form.patientIdentifier.value;
    
    const formData = {
      patientName: appState.currentPatientName,
      patientIdentifier: appState.currentPatientIdentifier,
      weight: parseFloat(form.weight.value),
      heparinConcentration: parseFloat(form.heparinConcentration.value),
      mode: $('.mode-btn.active').id === 'initialModeBtn' ? 'initial' : 'maintenance',
      indication: form.indication.value,
      currentInfusionRate: parseFloat(form.currentInfusionRate.value),
      currentPtt: parseFloat(form.currentPtt.value),
    };

    let result, inputs, toolName;
    if (formData.mode === 'initial') {
      result = calculateInitialHeparinRate(formData);
      toolName = 'heparin_initial';
      inputs = {
        weight_kg: formData.weight,
        concentration: formData.heparinConcentration,
        indication: formData.indication
      };
    } else {
      result = calculateMaintenanceHeparinRate(formData);
      toolName = 'heparin_maintenance';
      inputs = {
        weight_kg: formData.weight,
        concentration: formData.heparinConcentration,
        current_rate_ml_hr: formData.currentInfusionRate,
        current_ptt_sec: formData.currentPtt
      };
    }
    
    // Display result
    if (result.error) {
      resultArea.innerHTML = `<div class="error-box"><p>${result.error}</p></div>`;
    } else {
      resultArea.innerHTML = result.html;
      // Schedule notifications if any
      if (result.notification) {
        scheduleNotification(
          result.notification.title,
          result.notification.body,
          result.notification.delayInMinutes
        );
      }
      if (result.notification_ptt) {
         scheduleNotification(
          result.notification_ptt.title,
          result.notification_ptt.body,
          result.notification_ptt.delayInMinutes
        );
      }
      // Save to Supabase (in the background)
      saveCalculation(
        toolName,
        formData.patientName,
        formData.patientIdentifier,
        inputs,
        result.logData // Save the clean data
      );
    }
    
  } catch (error) {
    resultArea.innerHTML = `<div class="error-box"><p>An unexpected error occurred: ${error.message}</p></div>`;
  } finally {
    if (calculateBtn) {
      calculateBtn.disabled = false;
      calculateBtn.innerHTML = `${Icons.heparin} <span>احسب</span>`;
    }
  }
}

// --- Prophylaxis ---
async function handleProphylaxisCheck(e) {
  // Toggle checked state for styling
  const card = e.currentTarget;
  const checkbox = card.querySelector('input[type="checkbox"]');
  if (e.target.tagName !== 'INPUT') {
    checkbox.checked = !checkbox.checked;
  }
  card.classList.toggle('checked', checkbox.checked);
  
  const form = $('#prophylaxis-form');
  const selectedFactors = Array.from(form.querySelectorAll('input[name="riskFactor"]:checked')).map(cb => cb.value);
  
  const resultArea = $('#result-area');
  
  if (selectedFactors.length === 0) {
    resultArea.innerHTML = '';
    return;
  }
  
  const result = calculateStressUlcerProphylaxis(selectedFactors);
  resultArea.innerHTML = result.html;
}

// "Save" button submit for Prophylaxis
async function handleProphylaxisSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const resultArea = $('#result-area');
  const saveBtn = $('#saveBtn');
  
  const resultHtml = resultArea.innerHTML;
  if (!resultHtml || resultHtml === '') {
    alert('الرجاء اختيار عوامل الخطورة أولاً لحساب النتيجة قبل الحفظ.');
    return;
  }
  
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.textContent = 'جاري الحفظ...';
  }
  
  try {
    const selectedFactors = Array.from(form.querySelectorAll('input[name="riskFactor"]:checked')).map(cb => cb.value);
    const result = calculateStressUlcerProphylaxis(selectedFactors); 
    
    appState.currentPatientName = form.patientName.value || 'N/A';
    appState.currentPatientIdentifier = form.patientIdentifier.value || 'N/A';
    
    const saved = await saveCalculation(
      'stress_ulcer_prophylaxis',
      appState.currentPatientName,
      appState.currentPatientIdentifier,
      { factors: selectedFactors },
      result.logData
    );
    
    if (saved) {
      if(saveBtn) saveBtn.textContent = 'تم الحفظ!';
      resultArea.innerHTML += `<div class="result-box mt-4"><p class="font-bold">تم حفظ النتيجة بنجاح.</p></div>`;
    } else {
      if(saveBtn) saveBtn.textContent = 'فشل الحفظ';
    }
  } catch (error) {
    if(saveBtn) saveBtn.textContent = 'فشل الحفظ';
    resultArea.innerHTML += `<div class="error-box mt-4"><p><strong>خطأ في الحفظ:</strong> ${error.message}</p></div>`;
  } finally {
    setTimeout(() => {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = 'حفظ النتيجة';
      }
    }, 2000);
  }
}


// --- Padua Score ---
async function handlePaduaCheck(e) {
  const card = e.currentTarget;
  const checkbox = card.querySelector('input[type="checkbox"]');
  if (e.target.tagName !== 'INPUT') {
    checkbox.checked = !checkbox.checked;
  }
  card.classList.toggle('checked', checkbox.checked);
  
  const form = $('#padua-form');
  const resultArea = $('#result-area');
  
  let score = 0;
  const selectedFactors = [];
  form.querySelectorAll('input[name="riskFactor"]:checked').forEach(cb => {
    score += parseInt(cb.dataset.score, 10);
    selectedFactors.push(cb.value);
  });
  
  if (selectedFactors.length === 0) {
    resultArea.innerHTML = '';
    return;
  }
  
  const result = calculatePaduaScore(score);
  resultArea.innerHTML = result.html;
}

// "Save" button submit for Padua
async function handlePaduaSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const resultArea = $('#result-area');
  const saveBtn = $('#saveBtn');

  const resultHtml = resultArea.innerHTML;
  if (!resultHtml || resultHtml === '') {
    alert('الرجاء اختيار عوامل الخطورة أولاً لحساب النتيجة قبل الحفظ.');
    return;
  }

  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.textContent = 'جاري الحفظ...';
  }

  try {
    let score = 0;
    const selectedFactors = [];
    form.querySelectorAll('input[name="riskFactor"]:checked').forEach(cb => {
      score += parseInt(cb.dataset.score, 10);
      selectedFactors.push(cb.value);
    });
    const result = calculatePaduaScore(score); 

    appState.currentPatientName = form.patientName.value || 'N/A';
    appState.currentPatientIdentifier = form.patientIdentifier.value || 'N/A';

    const saved = await saveCalculation(
      'padua_score',
      appState.currentPatientName,
      appState.currentPatientIdentifier,
      { factors: selectedFactors },
      result.logData
    );

    if (saved) {
      if(saveBtn) saveBtn.textContent = 'تم الحفظ!';
      resultArea.innerHTML += `<div class="result-box mt-4"><p class="font-bold">تم حفظ النتيجة بنجاح.</p></div>`;
    } else {
      if(saveBtn) saveBtn.textContent = 'فشل الحفظ';
    }
  } catch (error) {
    if(saveBtn) saveBtn.textContent = 'فشل الحفظ';
    resultArea.innerHTML += `<div class="error-box mt-4"><p><strong>خطأ في الحفظ:</strong> ${error.message}</p></div>`;
  } finally {
    setTimeout(() => {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = 'حفظ النتيجة';
      }
    }, 2000);
  }
}


// --- IV Calculator ---
async function handleIVSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const resultArea = $('#result-area');
  const calculateBtn = $('#calculateBtn'); 
  
  if(calculateBtn) {
    calculateBtn.disabled = true;
    calculateBtn.innerHTML = `${Icons.ivCalculator} <span>جاري الحساب...</span>`;
  }
  resultArea.innerHTML = '';
  
  try {
    appState.currentPatientName = form.patientName.value;
    appState.currentPatientIdentifier = form.patientIdentifier.value;
    
    const inputs = {
      weight_kg: parseFloat(form.weight.value),
      drugAmount_mg: parseFloat(form.drugAmount.value),
      solutionVolume_ml: parseFloat(form.solutionVolume.value),
      drugDose: parseFloat(form.drugDose.value),
      doseUnit: form.doseUnit.value
    };

    const result = calculateIVRate(inputs);
    resultArea.innerHTML = result.html;
    
    // Save to Supabase (in background)
    saveCalculation(
      'iv_calculator',
      appState.currentPatientName,
      appState.currentPatientIdentifier,
      inputs,
      result.logData
    );
    
  } catch (error) {
    resultArea.innerHTML = `<div class="error-box"><p>${error.message}</p></div>`;
  } finally {
    if(calculateBtn) {
      calculateBtn.disabled = false;
      calculateBtn.innerHTML = `${Icons.ivCalculator} <span>احسب المعدل</span>`;
    }
  }
}

// --- Renal Dosing (Live) ---
function handleRenalDosingInput() {
  const form = $('#renal-form');
  const resultArea = $('#result-area');
  
  try {
    const inputs = {
      age: parseFloat(form.age.value),
      weight_kg: parseFloat(form.weight.value),
      creatinine_mg_dl: parseFloat(form.creatinine.value),
      gender: form.gender.value
    };
    
    if (inputs.age > 0 && inputs.weight_kg > 0 && inputs.creatinine_mg_dl > 0) {
      const result = calculateCrCl(inputs);
      resultArea.innerHTML = result.html;
    } else {
      resultArea.innerHTML = '';
    }
  } catch (error) {
    resultArea.innerHTML = `<div class="error-box"><p>خطأ في الحساب: ${error.message}</p></div>`;
  }
}

// --- Unit Converter (Live) ---
function handleConverterInput() {
  const form = $('#converter-form');
  const resultField = $('#toValue');
  
  try {
    const inputs = {
      value: parseFloat(form.fromValue.value),
      fromUnit: form.fromUnit.value,
      toUnit: form.toUnit.value
    };
    
    if (isNaN(inputs.value)) {
      resultField.value = 'Invalid Input';
      return;
    }
    
    const result = convertUnits(inputs);
    resultField.value = result;
  } catch (error) {
    resultField.value = 'Error';
  }
}

// --- History Password ---
function handleHistoryPasswordSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const password = form.historyPassword.value;
  const resultArea = $('#history-result');
  
  if (password === HISTORY_PASSWORD) {
    renderHistoryLogs();
  } else {
    resultArea.innerHTML = `<div class="error-box"><p>كلمة المرور غير صحيحة. حاول مرة أخرى.</p></div>`;
  }
}

// --- (7) CALCULATION LOGIC (Translated from code.gs) ---

/**
 * Translated from code.gs: calculateInitialHeparinRate
 */
function calculateInitialHeparinRate(formData) {
  const { weight, heparinConcentration, indication, patientName } = formData;

  if (isNaN(weight) || isNaN(heparinConcentration) || weight <= 0 || heparinConcentration <= 0 || !indication) {
    return { error: 'الرجاء إدخال قيم رقمية صحيحة واختيار الداعي للاستعمال.' };
  }

  let suggestedLoadingDoseUnits = 0;
  let suggestedInitialInfusionRateUnitsPerKg = 0;

  switch (indication) {
    case 'AF':
      suggestedLoadingDoseUnits = Math.min(80 * weight, 5000);
      suggestedInitialInfusionRateUnitsPerKg = 18;
      break;
    case 'Venous thromboembolism':
      suggestedLoadingDoseUnits = Math.min(80 * weight, 10000);
      suggestedInitialInfusionRateUnitsPerKg = 18;
      break;
    case 'Acute coronary syndrome':
      suggestedLoadingDoseUnits = 70 * weight;
      suggestedInitialInfusionRateUnitsPerKg = 18;
      break;
    default:
      return { error: 'Invalid indication selected.' };
  }

  const initialInfusionUnitsPerHour = suggestedInitialInfusionRateUnitsPerKg * weight;
  const initialInfusionRateMl = (initialInfusionUnitsPerHour / heparinConcentration).toFixed(2);
  const loadingDoseMl = (suggestedLoadingDoseUnits / heparinConcentration).toFixed(2);
  const repeatPttHours = 6;
  
  const logData = {
    loading_dose: `${suggestedLoadingDoseUnits.toFixed(0)} units (${loadingDoseMl} mL)`,
    initial_rate: `${initialInfusionRateMl} mL/hour`,
    next_ptt: `in ${repeatPttHours} hours`
  };
  
  const html = `
    <div class="result-box">
      <p class="text-lg">الجرعة التحميلية المقترحة: <span class="font-bold">${logData.loading_dose}</span></p>
      <p class="text-lg mt-2">معدل المحلول المبدئي: <span class="font-bold">${logData.initial_rate}</span></p>
      <p class="text-lg mt-2">فحص الـ PTT القادم: <span class="font-bold">${logData.next_ptt}</span></p>
    </div>
    <div class="info-box">
      <p class="font-bold">تم ضبط تنبيه للمريض ${patientName} خلال ${repeatPttHours} ساعات لفحص الـ PTT.</p>
    </div>
  `;

  return {
    html: html,
    logData: logData,
    notification_ptt: {
      title: `تنبيه هيبارين: ${patientName}`,
      body: `حان وقت فحص الـ PTT القادم (المجدول خلال ${repeatPttHours} ساعات).`,
      delayInMinutes: repeatPttHours * 60
    }
  };
}

/**
 * Translated from code.gs: calculateMaintenanceHeparinRate
 */
function calculateMaintenanceHeparinRate(formData) {
  const { weight, heparinConcentration, currentInfusionRate, currentPtt, patientName } = formData;

  if (isNaN(weight) || isNaN(heparinConcentration) || isNaN(currentInfusionRate) || isNaN(currentPtt) || weight <= 0 || heparinConcentration <= 0 || currentInfusionRate < 0 || currentPtt <= 0) {
    return { error: 'الرجاء إدخال قيم رقمية صحيحة لكل الحقول.' };
  }

  const currentUnitsPerHour = currentInfusionRate * heparinConcentration;
  const currentUnitsPerKgPerHour = currentUnitsPerHour / weight;

  let newUnitsPerKgPerHour = currentUnitsPerKgPerHour;
  let bolusDoseUnits = 0;
  let message = '';
  let stopInfusionMin = 0;
  let repeatPttHours = 6; // Default PTT repeat time
  let boxClass = 'result-box'; // Default is green

  // This logic is directly translated from your code.gs
  if (currentPtt < 40) {
    bolusDoseUnits = 25 * weight;
    newUnitsPerKgPerHour += 3;
    message = 'PTT منخفض جداً (<40). أعط جرعة Bolus وقم بزيادة المعدل.';
    boxClass = 'error-box';
  } else if (currentPtt >= 40 && currentPtt <= 49) {
    newUnitsPerKgPerHour += 2;
    message = 'PTT منخفض (40-49). قم بزيادة المعدل.';
    boxClass = 'info-box';
  } else if (currentPtt >= 50 && currentPtt <= 69) {
    newUnitsPerKgPerHour += 1;
    message = 'PTT منخفض نسبياً (50-69). قم بزيادة المعدل.';
    boxClass = 'info-box';
  } else if (currentPtt >= 70 && currentPtt <= 110) {
    newUnitsPerKgPerHour = currentUnitsPerKgPerHour;
    message = 'PTT في المعدل العلاجي (70-110). لا تغيير في المعدل.';
    // boxClass remains 'result-box' (green)
  } else if (currentPtt >= 111 && currentPtt <= 120) {
    newUnitsPerKgPerHour -= 1;
    message = 'PTT مرتفع نسبياً (111-120). قم بتقليل المعدل.';
    boxClass = 'info-box';
  } else if (currentPtt >= 121 && currentPtt <= 130) {
    stopInfusionMin = 60;
    newUnitsPerKgPerHour -= 2;
    message = `PTT مرتفع (121-130). أوقف المحلول ${stopInfusionMin} دقيقة ثم قلل المعدل.`;
    boxClass = 'error-box';
  } else if (currentPtt >= 131 && currentPtt <= 140) {
    stopInfusionMin = 60;
    newUnitsPerKgPerHour -= 3;
    message = `PTT مرتفع جداً (131-140). أوقف المحلول ${stopInfusionMin} دقيقة ثم قلل المعدل.`;
    boxClass = 'error-box';
  } else if (currentPtt >= 141 && currentPtt <= 150) {
    stopInfusionMin = 120;
    newUnitsPerKgPerHour -= 5;
    message = `PTT مرتفع للغاية (141-150). أوقف المحلول ${stopInfusionMin} دقيقة ثم قلل المعدل.`;
    boxClass = 'error-box';
  } else if (currentPtt > 150) {
    stopInfusionMin = 180;
    newUnitsPerKgPerHour = 0;
    message = `PTT حرج (>150). أوقف المحلول ${stopInfusionMin} دقيقة وتواصل مع الطبيب.`;
    repeatPttHours = 0; // No automatic PTT check
    boxClass = 'error-box';
  }

  if (newUnitsPerKgPerHour < 0) newUnitsPerKgPerHour = 0;

  const newUnitsPerHour = newUnitsPerKgPerHour * weight;
  const newRateMl = (newUnitsPerHour / heparinConcentration).toFixed(2);
  const bolusDoseMl = (bolusDoseUnits / heparinConcentration).toFixed(2);
  
  const logData = {
    new_rate: `${newRateMl} mL/hour`,
    bolus_dose: bolusDoseUnits > 0 ? `${bolusDoseUnits.toFixed(0)} units (${bolusDoseMl} mL)` : 'N/A',
    stop_infusion_min: stopInfusionMin > 0 ? stopInfusionMin : 'N/A',
    next_ptt: repeatPttHours > 0 ? `in ${repeatPttHours} hours` : `حسب تعليمات الطبيب`,
    message: message
  };

  let html = `<div class="${boxClass}">`;
  if (logData.bolus_dose !== 'N/A') {
    html += `<p class="text-lg">جرعة Bolus: <span class="font-bold">${logData.bolus_dose}</span></p>`;
  }
  if (logData.stop_infusion_min !== 'N/A') {
    html += `<p class="text-lg mt-2 text-red-700">إيقاف المحلول لمدة: <span class="font-bold">${logData.stop_infusion_min} دقيقة</span></p>`;
  }
  html += `<p class="text-lg mt-2">المعدل الجديد للمحلول: <span class="font-bold">${logData.new_rate}</span></p>`;
  html += `<p class="text-lg mt-2">فحص الـ PTT القادم: <span class="font-bold">${logData.next_ptt}</span></p>`;
  html += `<p class="text-sm mt-3">${logData.message}</p>`;
  html += `</div>`;
  
  let notifications = {};
  
  // Add stop infusion notification
  if (stopInfusionMin > 0) {
    notifications.notification = {
      title: `تنبيه هيبارين: ${patientName}`,
      body: `حان وقت إعادة تشغيل المحلول (المتوقف ${stopInfusionMin} دقيقة).`,
      delayInMinutes: stopInfusionMin
    };
    html += `<div class="info-box"><p class="font-bold">تم ضبط تنبيه للمريض ${patientName} خلال ${stopInfusionMin} دقيقة لإعادة تشغيل المحلول.</p></div>`;
  }
  
  // Add PTT check notification
  if (repeatPttHours > 0) {
    notifications.notification_ptt = {
      title: `تنبيه هيبارين: ${patientName}`,
      body: `حان وقت فحص الـ PTT القادم (المجدول خلال ${repeatPttHours} ساعات).`,
      delayInMinutes: repeatPttHours * 60
    };
    html += `<div class="info-box"><p class="font-bold">تم ضبط تنبيه للمريض ${patientName} خلال ${repeatPttHours} ساعات لفحص الـ PTT.</p></div>`;
  }

  return {
    html: html,
    logData: logData,
    ...notifications
  };
}

/**
 * Translated from code.gs: calculateStressUlcerProphylaxis
 */
function calculateStressUlcerProphylaxis(selectedFactors) {
  const highRiskFactors = [
    'Mechanical Ventilation with no enteral feeding (>48h)', 'Chronic Liver Disease', 'Concerning Coagulopathy',
    'Multiple Trauma, Brain Injury or Spinal Cord', 'Burns over 35% of total surface area', 'Organ Transplant',
    'History of Peptic Ulcer Disease', 'Dual Antiplatelet', 'Septic Shock'
  ];
  const moderateRiskFactors = [
    'Mechanical Ventilation with enteral nutrition', 'Single Antiplatelet Therapy', 'Oral Anticoagulation', 'Sepsis',
    'ICU stay > 7 days', 'Renal Replacement Therapy', 'High Dose Steroids or Immunosuppressant', 'Shock'
  ];
  
  const highRiskCount = selectedFactors.filter(factor => highRiskFactors.includes(factor)).length;
  const moderateRiskCount = selectedFactors.filter(factor => moderateRiskFactors.includes(factor)).length;

  let riskLevel = 'Low Risk';
  if (highRiskCount > 0) {
    riskLevel = 'High Risk';
  } else if (moderateRiskCount >= 2) {
    riskLevel = 'Moderate Risk';
  }
  
  const isIndicated = (riskLevel === 'High Risk' || riskLevel === 'Moderate Risk');
  const logData = {
    risk_level: riskLevel,
    is_indicated: isIndicated
  };
  
  let html = '';
  if (isIndicated) {
    html = `
      <div class="error-box">
        <p class="text-lg font-bold">مستوى الخطورة: ${riskLevel}</p>
        <p class="mt-1">المريض يحتاج إلى علاج وقائي (Indicated).</p>
      </div>
    `;
  } else {
    html = `
      <div class="result-box">
        <p class="text-lg font-bold">مستوى الخطورة: ${riskLevel}</p>
        <p class="mt-1">المريض لا يحتاج إلى علاج وقائي (Not Indicated).</p>
      </div>
    `;
  }
  
  return { html, logData };
}

/**
 * ***NEW LOGIC*** for Padua Score (not in code.gs)
 */
function calculatePaduaScore(score) {
  let riskLevel = 'Low Risk';
  if (score >= 4) {
    riskLevel = 'High Risk';
  }
  
  const isIndicated = (riskLevel === 'High Risk');
  const logData = {
    score: score,
    risk_level: riskLevel,
    is_indicated: isIndicated
  };
  
  let html = '';
  if (isIndicated) {
    html = `
      <div class="error-box">
        <p class="text-lg font-bold">النقاط: ${score} (مستوى الخطورة: ${riskLevel})</p>
        <p class="mt-1">المريض عرضة للجلطات (HIGH RISK) وينصح بالعلاج الوقائي.</p>
      </div>
    `;
  } else {
    html = `
      <div class="result-box">
        <p class="text-lg font-bold">النقاط: ${score} (مستوى الخطورة: ${riskLevel})</p>
        <p class="mt-1">المريض ليس عرضة للجلطات (LOW RISK) ولا ينصح بالعلاج الوقائي.</p>
      </div>
    `;
  }
  
  return { html, logData };
}


/**
 * ***NEW LOGIC*** for IV Infusion Calculator (not in code.gs)
 */
function calculateIVRate(inputs) {
  const { weight_kg, drugAmount_mg, solutionVolume_ml, drugDose, doseUnit } = inputs;
  
  if (isNaN(weight_kg) || isNaN(drugAmount_mg) || isNaN(solutionVolume_ml) || isNaN(drugDose) ||
      weight_kg <= 0 || drugAmount_mg <= 0 || solutionVolume_ml <= 0 || drugDose <= 0) {
    return { error: 'الرجاء إدخال قيم رقمية صحيحة (أكبر من صفر) لكل الحقول.' };
  }
  
  // 1. Calculate concentration in mg/mL
  const concentration_mg_ml = drugAmount_mg / solutionVolume_ml;
  
  let rate_ml_hr = 0;
  
  // 2. Calculate rate based on unit
  switch (doseUnit) {
    case 'mcg/kg/min':
      // (Dose * weight * 60) / (concentration_mg_ml * 1000)
      rate_ml_hr = (drugDose * weight_kg * 60) / (concentration_mg_ml * 1000);
      break;
    case 'mcg/min':
      // (Dose * 60) / (concentration_mg_ml * 1000)
      rate_ml_hr = (drugDose * 60) / (concentration_mg_ml * 1000);
      break;
    case 'mg/hr':
      // Dose / concentration_mg_ml
      rate_ml_hr = drugDose / concentration_mg_ml;
      break;
    default:
      return { error: 'وحدة الجرعة المختارة غير صحيحة.' };
  }
  
  const logData = {
    rate_ml_hr: rate_ml_hr.toFixed(2)
  };
  
  const html = `
    <div class="result-box">
      <p class="text-lg text-center">اضبط معدل المضخة (Pump Rate) إلى:</p>
      <p class="text-3xl font-bold text-center my-2">${logData.rate_ml_hr} mL/hr</p>
    </div>
  `;
  
  return { html, logData };
}


/**
 * ***NEW HELPER FUNCTION***
 * Formats the log data (inputs and results) into readable HTML.
 * @param {object} log - The log object from Supabase.
 * @returns {string} HTML string.
 */
function formatLogData(log) {
  let inputsHtml = '<strong>المدخلات:</strong><ul class="list-disc" style="padding-right: 1.5rem; margin-top: 0.5rem;">';
  let resultHtml = '<strong>النتيجة:</strong><ul class="list-disc" style="padding-right: 1.5rem; margin-top: 0.5rem;">';

  const inputs = log.inputs || {};
  const result = log.result || {};

  try {
    switch (log.tool_name) {
      case 'heparin_initial':
        inputsHtml += `<li>الوزن: ${inputs.weight_kg} kg</li>`;
        inputsHtml += `<li>التركيز: ${inputs.concentration} u/mL</li>`;
        inputsHtml += `<li>الداعي: ${inputs.indication}</li>`;
        resultHtml += `<li>الجرعة التحميلية: ${result.loading_dose}</li>`;
        resultHtml += `<li>المعدل المبدئي: ${result.initial_rate}</li>`;
        resultHtml += `<li>الـ PTT القادم: ${result.next_ptt}</li>`;
        break;
      
      case 'heparin_maintenance':
        inputsHtml += `<li>الوزن: ${inputs.weight_kg} kg</li>`;
        inputsHtml += `<li>التركيز: ${inputs.concentration} u/mL</li>`;
        inputsHtml += `<li>المعدل الحالي: ${inputs.current_rate_ml_hr} mL/hr</li>`;
        inputsHtml += `<li>الـ PTT الحالي: ${inputs.current_ptt_sec} sec</li>`;
        resultHtml += `<li>المعدل الجديد: ${result.new_rate}</li>`;
        resultHtml += `<li>جرعة Bolus: ${result.bolus_dose}</li>`;
        resultHtml += `<li>إيقاف المحلول: ${result.stop_infusion_min} min</li>`;
        resultHtml += `<li>الـ PTT القادم: ${result.next_ptt}</li>`;
        break;
        
      case 'stress_ulcer_prophylaxis':
      case 'padua_score':
        if(inputs.factors && inputs.factors.length > 0) {
          inputsHtml += `<li>العوامل: ${inputs.factors.join(', ')}</li>`;
        } else {
          inputsHtml += `<li>العوامل: لم يتم اختيار أي عامل</li>`;
        }
        if(result.score !== undefined) resultHtml += `<li>النقاط: ${result.score}</li>`;
        resultHtml += `<li>مستوى الخطورة: ${result.risk_level}</li>`;
        if(result.is_indicated !== undefined) resultHtml += `<li>يحتاج علاج وقائي: ${result.is_indicated ? 'نعم' : 'لا'}</li>`;
        break;

      case 'iv_calculator':
        inputsHtml += `<li>الوزن: ${inputs.weight_kg} kg</li>`;
        inputsHtml += `<li>كمية الدواء: ${inputs.drugAmount_mg} mg</li>`;
        inputsHtml += `<li>حجم المحلول: ${inputs.solutionVolume_ml} mL</li>`;
        inputsHtml += `<li>الجرعة: ${inputs.drugDose} ${inputs.doseUnit}</li>`;
        resultHtml += `<li>المعدل: ${result.rate_ml_hr} mL/hr</li>`;
        break;
        
      default:
        // Fallback for other tools (like renal dosing, if we save it)
        inputsHtml += `<li>${JSON.stringify(inputs)}</li>`;
        resultHtml += `<li>${JSON.stringify(result)}</li>`;
    }
  } catch (e) {
    // In case of any error during formatting, show the raw JSON
    console.error("Error formatting log:", e);
    inputsHtml = `<strong>المدخلات:</strong><pre>${JSON.stringify(inputs, null, 2)}</pre>`;
    resultHtml = `<strong>النتيجة:</strong><pre>${JSON.stringify(result, null, 2)}</pre>`;
  }

  inputsHtml += '</ul>';
  resultHtml += '</ul>';
  return `${inputsHtml}<br>${resultHtml}`;
}

/**
 * New logic for CrCl Calculator
 */
function calculateCrCl(inputs) {
  const { age, weight_kg, creatinine_mg_dl, gender } = inputs;
  
  let crcl = ((140 - age) * weight_kg) / (72 * creatinine_mg_dl);
  if (gender === 'female') {
    crcl *= 0.85;
  }
  
  const logData = {
    crcl_ml_min: crcl.toFixed(1)
  };
  
  const html = `
    <div class="result-box">
      <p class="text-lg text-center">معدل تصفية الكرياتينين المقدر:</p>
      <p class="text-3xl font-bold text-center my-2">${logData.crcl_ml_min} mL/min</p>
      <p class="text-sm text-center mt-4">ملحوظة: هذا الحساب تقديري (Cockcroft-Gault). يجب دائماً مراجعة بروتوكولات المستشفى لتعديل الجرعات.</p>
    </div>
  `;
  
  return { html, logData };
}

/**
 * New logic for Unit Converter
 */
function convertUnits(inputs) {
  const { value, fromUnit, toUnit } = inputs;
  
  // Base unit: mcg
  const conversionsToMcg = {
    'kg': 1000000000,
    'g': 1000000,
    'mg': 1000,
    'mcg': 1,
    'lbs': 453592000 // lbs to g * 1000000
  };
  // Base unit: mL
  const conversionsToMl = {
    'L': 1000,
    'mL': 1
  };
  
  let result;
  
  if (fromUnit in conversionsToMcg && toUnit in conversionsToMcg) {
    const baseValue = value * conversionsToMcg[fromUnit];
    result = baseValue / conversionsToMcg[toUnit];
  } else if (fromUnit in conversionsToMl && toUnit in conversionsToMl) {
    const baseValue = value * conversionsToMl[fromUnit];
    result = baseValue / conversionsToMl[toUnit];
  } else if (fromUnit === 'lbs' && toUnit === 'kg') {
    result = value * 0.453592;
  } else if (fromUnit === 'kg' && toUnit === 'lbs') {
    result = value * 2.20462;
  } else {
    return 'N/A'; // Incompatible units
  }
  
  // Format result nicely
  if (result < 0.001) return result.toExponential(4);
  if (result.toString().split('.')[1]?.length > 4) return result.toFixed(4);
  return result;
}


// --- (8) SUPABASE & NOTIFICATION FUNCTIONS ---

/**
 * Saves a calculation to the Supabase database.
 */
async function saveCalculation(toolName, patientName, patientIdentifier, inputs, result) {
  try {
    const { data, error } = await db
      .from('calculation_logs')
      .insert({
        tool_name: toolName,
        patient_name: patientName,
        patient_identifier: patientIdentifier,
        inputs: inputs,
        result: result
      });
      
    if (error) {
      throw error;
    }
    console.log('Calculation saved:', data);
    return true;
    
  } catch (error) {
    console.error('Error saving to Supabase:', error.message);
    // Show a non-blocking error to the user
    const resultArea = $('#result-area');
    if (resultArea) {
      const errorDiv = document.createElement('div');
      errorDiv.className = 'error-box';
      errorDiv.innerHTML = `<p><strong>خطأ في الحفظ:</strong> لم يتم حفظ السجل. ${error.message}</p>`;
      // Prepend error to result area so calculation is still visible
      resultArea.prepend(errorDiv);
    }
    return false;
  }
}

/**
 * Schedules a local notification.
 * @param {string} title - The title of the notification.
 * @param {string} body - The body text of the notification.
 * @param {number} delayInMinutes - The delay in minutes.
 */
async function scheduleNotification(title, body, delayInMinutes) {
  // --- *** NOTIFICATION FIX *** ---
  // The logic is moved to the Service Worker (sw.js)
  // This function now just checks permission and passes the message.
  
  if (!('Notification' in window) || !('serviceWorker' in navigator)) {
    console.warn('Notifications or Service Worker not supported.');
    return;
  }
  
  // 1. Check/Request Permission
  let permission = Notification.permission;
  if (permission === 'default') {
    console.log('Requesting notification permission...');
    permission = await Notification.requestPermission();
  }

  if (permission === 'denied') {
    console.warn('Notification permission was denied.');
    alert('الرجاء تفعيل الإشعارات في إعدادات المتصفح لاستقبال التنبيهات.');
    return;
  }

  // 2. If permission is granted, pass the job to the Service Worker
  if (permission === 'granted') {
    if (delayInMinutes <= 0) return;
    
    // (TESTING): Set delay to 10 seconds (0.16 minutes) for testing
    // const delayInMs = 0.16 * 60 * 1000;
    
    // (PRODUCTION): Use the real delay
    const delayInMs = delayInMinutes * 60 * 1000;
    
    const icon = 'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEgGVNd8uPcpbKOagpnwi5e8ai6v82sMiSRdWD0ZEgqIayvesaHtPrec7QGQSx-TXtbWb9D5SdZrcXuHCIAvPbHRGqUQV7MKxR_VyjvTs37suGOlDaqS1RuVuN2EsMNm50GDCG_N-ugnwwutUb9OfyJbkGz9k06YvTi0ynwW9jJaBNhIsEkPJ5NOzExt3xzN/s192/10cb804e-ab18-4d8a-8ce0-600bbe8ab10d.png';

    try {
      const swRegistration = await navigator.serviceWorker.ready;
      swRegistration.active.postMessage({
        type: 'scheduleNotification',
        payload: { title, body, delayInMs, icon }
      });
      console.log(`[Main] Notification job passed to SW: "${title}" in ${delayInMinutes} min.`);
    } catch (error) {
      console.error('Error passing notification to Service Worker:', error);
      // Fallback to main thread (less reliable)
      console.warn('Falling back to main thread for notification.');
      setTimeout(() => {
        new Notification(title, { body, icon });
      }, delayInMs);
    }
  }
}


// --- (9) INITIALIZATION ---

// Initial load
document.addEventListener('DOMContentLoaded', () => {
  // We no longer request permission on load.
  // It's requested on-demand by scheduleNotification().
  
  // Render the initial view
  navigateTo('dashboard');
});

