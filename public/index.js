/**
 * CHG MEDICAL TOOLKIT - MAIN APPLICATION LOGIC
 * Version: 3.4 (Stable - Final Polish)
 * Features:
 * - Supabase Integration (Logs)
 * - Full Medical Calculators
 * - Native Calendar Integration (.ics)
 * - Perfect History Display (Clean Titles, No Duplicate Data)
 */

// ==========================================
// SECTION 1: CONFIGURATION & CONSTANTS
// ==========================================
const SUPABASE_URL = 'https://kjiujbsyhxpooppmxgxb.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtqaXVqYnN5aHhwb29wcG14Z3hiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIxMDI0MjcsImV4cCI6MjA3NzY3ODQyN30.PcG8aF4r1RjennleU_14vqxJSAoxY_MyOl9GLdbKVkw';
const HISTORY_PASSWORD = 'CHG123';

// ==========================================
// SECTION 2: GLOBAL STATE & VARIABLES
// ==========================================
const appState = {
  currentView: 'dashboard',
  currentHeparinMode: 'initial',
  historyLogs: [],
};

// DOM Elements Cache
let db;
let $;
let $$;
let ui = {}; 

// ==========================================
// SECTION 3: UTILITY FUNCTIONS (HELPERS)
// ==========================================

/**
 * تحويل الاسم البرمجي للأداة إلى اسم عرض واضح
 */
function getToolDisplayName(toolName) {
  const titles = {
    'heparin_initial': 'Heparin Initial Dose',
    'heparin_maintenance': 'Heparin Maintenance',
    'initial': 'Heparin Initial Dose', // For old logs
    'maintenance': 'Heparin Maintenance', // For old logs
    'prophylaxis': 'Stress Ulcer Prophylaxis',
    'padua': 'Padua VTE Score',
    'iv_calc': 'IV Rate Calculator',
    'renal': 'Renal Dosing (CrCl)'
  };
  return titles[toolName] || toolName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

/**
 * دالة مساعدة لإنشاء سطر بيانات (Row)
 */
function createRow(label, value, isAlert = false) {
  if (value === undefined || value === null || value === 'N/A') return '';
  const colorClass = isAlert ? 'text-red-600 font-bold' : 'text-gray-800';
  return `<div class="flex justify-between items-center border-b border-gray-100 last:border-0 py-1">
            <span class="font-medium text-gray-500 text-xs">${label}:</span>
            <span class="${colorClass} text-sm">${value}</span>
          </div>`;
}

/**
 * دالة تنسيق المدخلات (Inputs) - تم التعديل لإخفاء بيانات المريض
 */
function formatLogInputs(tool, inputs) {
  if (!inputs || typeof inputs !== 'object') return '';
  
  let html = '<div class="mb-3 pb-2 border-b border-gray-200">';
  html += '<p class="text-xs font-bold text-gray-400 uppercase mb-1">Inputs</p>';
  
  // Generic mapping for common fields
  const fieldMap = {
    weight_kg: 'Weight (kg)',
    concentration: 'Concentration',
    indication: 'Indication',
    current_rate_ml_hr: 'Current Rate (mL/hr)',
    current_ptt_sec: 'Current PTT',
    drugAmount_mg: 'Drug Amount (mg)',
    solutionVolume_ml: 'Sol. Volume (mL)',
    drugDose: 'Desired Dose',
    doseUnit: 'Unit',
    age: 'Age',
    creatinine_mg_dl: 'Creatinine',
    gender: 'Gender',
    score: 'Score'
  };

  // قائمة الحقول التي يجب إخفاؤها (لأنها مكررة في العنوان)
  const ignoredFields = [
    'patientName', 'patient_name', 
    'patientId', 'patientIdentifier', 'patient_identifier', 'patientID'
  ];

  // Special handling for Arrays (Factors)
  if (inputs.factors && Array.isArray(inputs.factors)) {
    html += `<div class="mb-1"><span class="text-xs text-gray-500">Risk Factors:</span></div>`;
    html += `<ul class="list-disc pl-4 text-xs text-gray-700 mb-2">
      ${inputs.factors.map(f => `<li>${f}</li>`).join('')}
    </ul>`;
  }

  // Iterate over other inputs
  for (const [key, value] of Object.entries(inputs)) {
    if (key === 'factors') continue; 
    if (ignoredFields.includes(key)) continue; // *** FIX: Skip patient details ***
    
    const label = fieldMap[key] || key.replace(/_/g, ' ');
    html += createRow(label, value);
  }
  
  html += '</div>';
  return html;
}

/**
 * دالة تنسيق النتائج (Results)
 */
function formatLogResult(tool, result) {
  if (!result || typeof result !== 'object') return 'No details available';
  
  let html = '<div>';
  html += '<p class="text-xs font-bold text-gray-400 uppercase mb-1">Result</p>';
  
  // 1. Heparin Initial
  if (tool === 'initial' || tool === 'heparin_initial') {
    html += createRow('Loading Dose', result.loading_dose);
    html += createRow('Initial Rate', result.initial_rate);
  } 
  // 2. Heparin Maintenance
  else if (tool === 'maintenance' || tool === 'heparin_maintenance') {
    html += createRow('New Rate', result.new_rate ? `${result.new_rate} mL/hr` : null);
    html += createRow('Bolus', result.bolus_dose); 
    html += createRow('Stop Infusion', result.stop_infusion_min ? `${result.stop_infusion_min} min` : null, true);
    if (result.msg) {
      html += `<div class="mt-2 text-xs bg-yellow-50 text-yellow-800 p-2 rounded border border-yellow-100 italic">
                 ${result.msg}
               </div>`;
    }
  }
  // 3. Prophylaxis
  else if (tool === 'prophylaxis') {
    const isHigh = result.risk === 'High Risk' || result.indicated;
    html += createRow('Risk Level', result.risk, isHigh);
    html += createRow('Indicated', result.indicated ? 'YES' : 'NO', isHigh);
  }
  // 4. Padua
  else if (tool === 'padua') {
    const isHigh = result.score >= 4;
    html += createRow('Score', result.score, isHigh);
    html += createRow('Risk Category', result.risk);
  }
  // 5. IV Calculator
  else if (tool === 'iv_calc') {
    html += createRow('Infusion Rate', `${result.rate} mL/hr`, true);
  }
  // 6. Generic / Fallback
  else {
    for (const [key, value] of Object.entries(result)) {
       html += createRow(key.replace(/_/g, ' '), value);
    }
  }
  
  html += '</div>';
  return html;
}

/**
 * إنشاء ملف تقويم عالمي (.ics) للتعامل مع تقويم الهاتف مباشرة
 */
function createNativeCalendarFile(toolName, patientName, patientId, minutesFromNow) {
  const now = new Date();
  const start = new Date(now.getTime() + minutesFromNow * 60000);
  const end = new Date(start.getTime() + 15 * 60000); 

  const formatDate = (date) => date.toISOString().replace(/-|:|\.\d+/g, '');

  const title = `CHG Alert: ${toolName}`;
  const description = `Patient: ${patientName}\\nID: ${patientId}\\nAction: Check PTT / Monitoring required.`;

  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'BEGIN:VEVENT',
    `DTSTART:${formatDate(start)}`,
    `DTEND:${formatDate(end)}`,
    `SUMMARY:${title}`,
    `DESCRIPTION:${description}`,
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\n');

  return 'data:text/calendar;charset=utf8,' + encodeURIComponent(icsContent);
}

function formatDateTime(isoString) {
  try {
    return new Date(isoString).toLocaleString('en-US', {
      month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true
    });
  } catch (e) { return isoString; }
}

// ==========================================
// SECTION 4: NAVIGATION & UI LOGIC
// ==========================================
function navigateTo(viewId, title) {
  ui.allViews.forEach(view => view.classList.remove('active'));
  const target = $(`#${viewId}`);
  if (target) {
    target.classList.add('active');
    appState.currentView = viewId;
  }
  
  ui.appTitle.textContent = title;
  ui.headerBackButton.style.display = (viewId === 'view-dashboard') ? 'none' : 'block';
  
  ui.allNavButtons.forEach(btn => {
    const navId = btn.dataset.nav;
    let isActive = (navId === 'dashboard' && viewId !== 'view-history') || 
                   (navId === 'history' && viewId === 'view-history');
    btn.classList.toggle('active', isActive);
  });

  ui.appContent.scrollTop = 0;

  if (viewId === 'view-history') {
    resetHistoryView();
  }
}

function resetHistoryView() {
  $('#history-logs-container').innerHTML = '';
  ui.historySearch.value = '';
  appState.historyLogs = [];
  ui.passwordPrompt.classList.remove('hidden');
  $('#password-input').value = '';
  $('#password-input').focus();
  const err = ui.passwordForm.querySelector('.error-box');
  if (err) err.remove();
}

function toggleDarkMode() {
  const isDark = document.body.classList.toggle('dark');
  localStorage.setItem('darkMode', isDark);
}

// ==========================================
// SECTION 5: CALCULATORS LOGIC
// ==========================================

// --- 5.1 Heparin Calculator ---
function calculateInitialHeparinRate(data) {
  const { weight, concentration, indication } = data;
  if (!weight || !concentration || !indication) return { error: 'Missing Data' };

  let loadUnits = 0, rateUnitsKg = 0;
  
  if (indication === 'AF') {
    loadUnits = Math.min(80 * weight, 5000); 
    rateUnitsKg = 18;
  } else if (indication === 'Venous thromboembolism') {
    loadUnits = Math.min(80 * weight, 10000); 
    rateUnitsKg = 18;
  } else if (indication === 'Acute coronary syndrome') {
    loadUnits = 70 * weight; 
    rateUnitsKg = 18; 
  }

  const loadMl = (loadUnits / concentration).toFixed(2);
  const rateMl = ((rateUnitsKg * weight) / concentration).toFixed(2);

  return {
    html: `
      <div class="result-box">
        <p class="result-title">Initial Dose (${indication})</p>
        <p class="mt-2">Loading Dose: <strong>${loadUnits.toFixed(0)} units (${loadMl} mL)</strong></p>
        <p class="mt-2">Infusion Rate: <strong>${rateMl} mL/hr</strong></p>
        <p class="mt-2 text-blue-600">Next PTT Check: <strong>in 6 hours</strong></p>
      </div>`,
    logData: { loading_dose: `${loadUnits}u (${loadMl} mL)`, initial_rate: `${rateMl} mL/hr` },
    alert: { title: "Heparin PTT Check", delay: 360 } // 6 hours
  };
}

function calculateMaintenanceHeparinRate(data) {
  const { weight, concentration, rate, ptt } = data;
  
  const currentUnitsHr = rate * concentration;
  const currentUnitsKgHr = currentUnitsHr / weight;
  
  let newUnitsKgHr = currentUnitsKgHr;
  let bolus = 0;
  let stopMin = 0;
  let nextPtt = 6; // hours
  let msg = '';
  let boxClass = 'result-box';

  if (ptt < 40) {
    bolus = 25 * weight; 
    newUnitsKgHr += 3;   
    msg = 'PTT < 40: Low.';
    boxClass = 'error-box';
  } else if (ptt <= 49) {
    newUnitsKgHr += 2;
    msg = 'PTT 40-49: Low.';
    boxClass = 'error-box';
  } else if (ptt <= 69) {
    newUnitsKgHr += 1;
    msg = 'PTT 50-69: Slightly Low.';
    boxClass = 'error-box';
  } else if (ptt <= 110) {
    msg = 'PTT 70-110: Therapeutic Range. No Change.';
  } else if (ptt <= 120) {
    newUnitsKgHr -= 1;
    msg = 'PTT 111-120: High.';
    boxClass = 'error-box';
  } else if (ptt <= 130) {
    stopMin = 60; 
    newUnitsKgHr -= 2;
    msg = 'PTT 121-130: High. Stop infusion 60m.';
    boxClass = 'error-box';
  } else if (ptt <= 140) {
    stopMin = 60;
    newUnitsKgHr -= 3;
    msg = 'PTT 131-140: Very High. Stop infusion 60m.';
    boxClass = 'error-box';
  } else if (ptt <= 150) {
    stopMin = 120; 
    newUnitsKgHr -= 5;
    msg = 'PTT 141-150: Extremely High. Stop infusion 120m.';
    boxClass = 'error-box';
  } else {
    stopMin = 180; 
    newUnitsKgHr = 0; 
    nextPtt = 0; 
    msg = 'PTT > 150: Critical. Stop 180m & Call MD.';
    boxClass = 'error-box';
  }

  if (newUnitsKgHr < 0) newUnitsKgHr = 0;

  const newRateMl = ((newUnitsKgHr * weight) / concentration).toFixed(2);
  const bolusMl = (bolus / concentration).toFixed(2);
  let nextPttText = nextPtt > 0 ? `in ${nextPtt} hours` : "Per MD Order";

  let html = `<div class="${boxClass}"><p class="result-title">Maintenance Adjustment</p>`;
  if(bolus > 0) html += `<p class="mt-2 text-red-600 font-bold">Give Bolus: ${bolus.toFixed(0)} units (${bolusMl} mL)</p>`;
  if(stopMin > 0) html += `<p class="mt-2 text-red-600 font-bold">STOP Infusion for: ${stopMin} minutes</p>`;
  
  if (nextPtt > 0 && newUnitsKgHr > 0) {
     html += `<p class="mt-2">New Rate: <strong>${newRateMl} mL/hr</strong> <small>(${newUnitsKgHr.toFixed(1)} u/kg/hr)</small></p>`;
  } else if (newUnitsKgHr === 0 && stopMin === 0) {
     html += `<p class="mt-2">Hold Infusion.</p>`;
  }

  html += `<p class="mt-2">Next PTT: <strong>${nextPttText}</strong></p>`;
  html += `<p class="text-sm mt-3 opacity-75 border-t pt-2">${msg}</p></div>`;

  let alert = null;
  if (stopMin > 0) {
    alert = { title: "Restart Heparin", delay: stopMin };
  } else if (nextPtt > 0) {
    alert = { title: "Heparin PTT Check", delay: nextPtt * 60 };
  }

  return { html, logData: { new_rate: newRateMl, msg, bolus_dose: bolus > 0 ? `${bolus.toFixed(0)}u` : null, stop_infusion_min: stopMin }, alert };
}

// --- 5.2 Prophylaxis Calculator ---
function calculateProphylaxis(factors) {
  const highRiskList = [
    'Mechanical Ventilation with no enteral feeding (>48h)', 'Chronic Liver Disease', 'Concerning Coagulopathy',
    'Multiple Trauma, Brain Injury or Spinal Cord', 'Burns over 35% of total surface area', 'Organ Transplant',
    'History of Peptic Ulcer Disease', 'Dual Antiplatelet', 'Septic Shock'
  ];
  const modRiskList = [
    'Mechanical Ventilation with enteral nutrition', 'Single Antiplatelet Therapy', 'Oral Anticoagulation', 'SepsIS',
    'ICU stay > 7 days', 'Renal Replacement Therapy', 'High Dose Steroids or Immunosuppressant', 'Shock'
  ];

  let highCount = factors.filter(f => highRiskList.includes(f)).length;
  let modCount = factors.filter(f => modRiskList.includes(f)).length;

  let risk = 'Low Risk';
  let indicated = false;

  if (highCount > 0) {
    risk = 'High Risk';
    indicated = true;
  } else if (modCount >= 2) {
    risk = 'Moderate Risk';
    indicated = true;
  }

  const color = indicated ? 'error-box' : 'result-box';
  const text = indicated ? 'Stress Ulcer Prophylaxis INDICATED' : 'Prophylaxis NOT Indicated';

  return {
    html: `<div class="${color}"><p class="result-title">${risk}</p><p class="font-bold text-lg">${text}</p></div>`,
    logData: { risk, indicated }
  };
}

// --- 5.3 Padua Score ---
function calculatePadua(score) {
  const risk = score >= 4 ? 'High Risk' : 'Low Risk';
  const color = score >= 4 ? 'error-box' : 'result-box';
  const msg = score >= 4 ? 'VTE Prophylaxis Recommended' : 'VTE Prophylaxis Not Required';

  return {
    html: `<div class="${color}"><p class="result-title">Score: ${score} (${risk})</p><p class="font-bold">${msg}</p></div>`,
    logData: { score, risk }
  };
}

// --- 5.4 IV Rate ---
function calculateIV(d) {
  const conc = d.drugMg / d.volMl; 
  let rate = 0;

  if (d.unit === 'mcg/kg/min') {
    rate = (d.dose * d.weight * 60) / (conc * 1000);
  } else if (d.unit === 'mcg/min') {
    rate = (d.dose * 60) / (conc * 1000);
  } else if (d.unit === 'mg/hr') {
    rate = d.dose / conc;
  }

  return {
    html: `<div class="result-box"><p class="text-center">Infusion Rate</p><p class="text-3xl font-bold text-center my-2">${rate.toFixed(1)} mL/hr</p></div>`,
    logData: { rate: rate.toFixed(1) }
  };
}

// --- 5.5 Renal (CrCl) ---
function calculateRenal(d) {
  let val = ((140 - d.age) * d.weight) / (72 * d.creatinine);
  if (d.gender === 'female') val *= 0.85;

  return {
    html: `<div class="result-box"><p class="text-center">Est. CrCl</p><p class="text-3xl font-bold text-center my-2">${val.toFixed(1)} mL/min</p><p class="text-xs text-center opacity-60">Cockcroft-Gault Equation</p></div>`,
    logData: { crcl: val.toFixed(1) }
  };
}

// --- 5.6 Converter ---
function doConversion(val, from, to) {
  const masses = {kg: 1000000, g: 1000, mg: 1, mcg: 0.001};
  if (masses[from] && masses[to]) {
    const inMg = val * masses[from];
    return inMg / masses[to];
  }
  if (from === 'lbs_kg' && to === 'kg_lbs') return val * 0.453592; 
  if (from === 'kg_lbs' && to === 'lbs_kg') return val * 2.20462; 
  return val; 
}


// ==========================================
// SECTION 6: EVENT HANDLERS
// ==========================================

// --- 6.1 Heparin Handlers ---
async function handleHeparinSubmit(e) {
  e.preventDefault();
  const btn = $('#heparin-calculate-btn');
  const resDiv = $('#heparin-result-area');
  
  btn.disabled = true;
  btn.querySelector('span').textContent = 'Processing...';
  resDiv.innerHTML = '';

  try {
    const common = {
      patientName: $('#heparin-patientName').value,
      patientId: $('#heparin-patientIdentifier').value,
      weight: parseFloat($('#heparin-weight').value),
      concentration: parseFloat($('#heparin-concentration').value),
    };

    if(!common.patientName || !common.patientId) throw new Error("Patient details required");

    let result;
    let inputsToSave;

    if (appState.currentHeparinMode === 'initial') {
      const indication = $('#heparin-indication').value;
      result = calculateInitialHeparinRate({ ...common, indication });
      inputsToSave = { 
        weight_kg: common.weight, 
        concentration: common.concentration, 
        indication: indication 
      };
    } else {
      const rate = parseFloat($('#heparin-currentRate').value);
      const ptt = parseFloat($('#heparin-currentPtt').value);
      result = calculateMaintenanceHeparinRate({ ...common, rate, ptt });
      inputsToSave = { 
        weight_kg: common.weight, 
        concentration: common.concentration, 
        current_rate_ml_hr: rate, 
        current_ptt_sec: ptt 
      };
    }

    let html = result.html;
    
    // *** NATIVE CALENDAR INTEGRATION (.ics) ***
    if (result.alert) {
      const icsDataUrl = createNativeCalendarFile("Heparin", common.patientName, common.patientId, result.alert.delay);
      
      html += `
        <div class="mt-4 pt-4 border-t border-gray-200">
          <a href="${icsDataUrl}" download="CHG_Alert.ics" 
             class="btn w-full flex items-center justify-center" 
             style="background: #2563eb; color: white; text-decoration: none;">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
            Add to Phone Calendar
          </a>
          <p class="text-center text-xs text-gray-500 mt-2">Works with iPhone, Samsung & all devices</p>
        </div>
      `;
    }

    resDiv.innerHTML = html;
    
    await saveLog(appState.currentHeparinMode, common.patientName, common.patientId, inputsToSave, result.logData);

  } catch (err) {
    resDiv.innerHTML = `<div class="error-box">${err.message}</div>`;
  } finally {
    btn.disabled = false;
    btn.querySelector('span').textContent = 'Calculate';
  }
}

// --- 6.2 Prophylaxis Handlers ---
async function handleProphylaxisSubmit(e) {
  e.preventDefault();
  const resDiv = $('#prophylaxis-result-area');
  const btn = $('#prophylaxis-save-btn');
  const checks = Array.from(ui.prophylaxisForm.querySelectorAll('input:checked')).map(c => c.value);

  btn.disabled = true; btn.textContent = 'Saving...';
  
  try {
    const result = calculateProphylaxis(checks);
    const pName = $('#prophylaxis-patientName').value;
    const pId = $('#prophylaxis-patientIdentifier').value;
    if(!pName || !pId) throw new Error("Patient details required");

    resDiv.innerHTML = result.html;
    await saveLog('prophylaxis', pName, pId, { factors: checks }, result.logData);
    btn.textContent = 'Saved!';
  } catch (err) {
    resDiv.innerHTML = `<div class="error-box">${err.message}</div>`;
    btn.textContent = 'Save Result';
  } finally {
    setTimeout(() => { btn.disabled = false; btn.textContent = 'Save Result'; }, 2000);
  }
}

// --- 6.3 Padua Handlers ---
async function handlePaduaSubmit(e) {
  e.preventDefault();
  const resDiv = $('#padua-result-area');
  const btn = $('#padua-save-btn');
  
  let score = 0;
  const factors = [];
  ui.paduaForm.querySelectorAll('input:checked').forEach(c => {
    score += parseInt(c.dataset.score);
    factors.push(c.value);
  });

  btn.disabled = true; btn.textContent = 'Saving...';
  try {
    const result = calculatePadua(score);
    const pName = $('#padua-patientName').value;
    const pId = $('#padua-patientIdentifier').value;
    
    resDiv.innerHTML = result.html;
    await saveLog('padua', pName, pId, { factors, score }, result.logData);
    btn.textContent = 'Saved!';
  } catch (err) {
    resDiv.innerHTML = `<div class="error-box">Error saving</div>`;
  } finally {
    setTimeout(() => { btn.disabled = false; btn.textContent = 'Save Score'; }, 2000);
  }
}

// --- 6.4 IV & Renal Handlers ---
function handleIVSubmit(e) {
  e.preventDefault();
  const resDiv = $('#iv-result-area');
  try {
    const d = {
      weight: parseFloat($('#iv-weight').value),
      drugMg: parseFloat($('#iv-drugAmount').value),
      volMl: parseFloat($('#iv-solutionVolume').value),
      dose: parseFloat($('#iv-drugDose').value),
      unit: $('#iv-doseUnit').value
    };
    // Rename keys to match common mapping in formatLogInputs
    const inputsToSave = {
      weight_kg: d.weight,
      drugAmount_mg: d.drugMg,
      solutionVolume_ml: d.volMl,
      drugDose: d.dose,
      doseUnit: d.unit
    };

    const result = calculateIV(d);
    resDiv.innerHTML = result.html;
    const pName = $('#iv-patientName').value;
    if(pName) saveLog('iv_calc', pName, $('#iv-patientIdentifier').value, inputsToSave, result.logData);
  } catch(err) { resDiv.innerHTML = `<div class="error-box">Check inputs</div>`; }
}

function handleRenalInput() {
  const d = {
    age: parseFloat($('#renal-age').value),
    weight: parseFloat($('#renal-weight').value),
    creatinine: parseFloat($('#renal-creatinine').value),
    gender: $('#renal-gender').value
  };
  if(d.age && d.weight && d.creatinine) {
    $('#renal-result-area').innerHTML = calculateRenal(d).html;
  }
}

// --- 6.5 History & Password ---
function handlePasswordSubmit(e) {
  e.preventDefault();
  if ($('#password-input').value === HISTORY_PASSWORD) {
    ui.passwordPrompt.classList.add('hidden');
    loadHistory();
  } else {
    alert("Incorrect Password");
  }
}

async function loadHistory() {
  const div = $('#history-logs-container');
  div.innerHTML = '<p class="text-center mt-8 text-gray-500">Loading logs...</p>';
  
  const { data, error } = await db.from('calculation_logs').select('*').order('created_at', {ascending: false}).limit(50);
  
  if (error || !data.length) {
    div.innerHTML = '<p class="text-center mt-8 text-gray-500">No logs found.</p>';
    return;
  }
  
  appState.historyLogs = data;
  renderLogs(data);
}

// *** FIXED: FULL DETAIL Log Rendering ***
function renderLogs(logs) {
  const div = $('#history-logs-container');
  div.innerHTML = logs.map(l => `
    <div class="log-entry bg-white p-4 rounded-lg shadow-sm mb-3 border border-gray-100">
      <div class="flex justify-between items-start mb-2 border-b border-gray-100 pb-2">
        <div>
          <!-- استخدام دالة التسمية الجديدة هنا -->
          <span class="block font-bold text-teal-700 capitalize text-lg">${getToolDisplayName(l.tool_name)}</span>
          <span class="text-xs text-gray-400 font-mono">${formatDateTime(l.created_at)}</span>
        </div>
        <div class="text-right">
          <span class="block font-semibold text-gray-800">${l.patient_name}</span>
          <span class="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">ID: ${l.patient_identifier}</span>
        </div>
      </div>
      
      <!-- Display formatted INPUTS -->
      <div class="bg-gray-50 p-3 rounded text-gray-700 mb-2">
        ${formatLogInputs(l.tool_name, l.inputs)}
      </div>

      <!-- Display formatted RESULTS -->
      <div class="bg-blue-50 p-3 rounded text-gray-700 border border-blue-100">
        ${formatLogResult(l.tool_name, l.result)}
      </div>
    </div>
  `).join('');
}

// ==========================================
// SECTION 7: DATABASE & INIT
// ==========================================
async function saveLog(tool, pName, pId, inputs, result) {
  if(!db) return;
  await db.from('calculation_logs').insert({
    tool_name: tool,
    patient_name: pName,
    patient_identifier: pId,
    inputs: inputs,
    result: result
  });
}

document.addEventListener('DOMContentLoaded', () => {
  $ = (s) => document.querySelector(s);
  $$ = (s) => document.querySelectorAll(s);
  
  ui = {
    appTitle: $('#app-title'),
    appContent: $('.app-content'),
    headerBackButton: $('#header-back-button'),
    allViews: $$('.view'),
    allNavButtons: $$('.nav-button'),
    passwordPrompt: $('#password-prompt'),
    passwordForm: $('#password-form'),
    heparinForm: $('#heparin-form'),
    prophylaxisForm: $('#prophylaxis-form'),
    paduaForm: $('#padua-form'),
    historySearch: $('#history-search'),
  };

  try {
    const { createClient } = supabase;
    db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  } catch(e) { console.error("Supabase Error", e); }

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js');
  }

  $('#nav-home').onclick = () => navigateTo('view-dashboard', 'CHG Toolkit');
  $('#nav-history').onclick = () => navigateTo('view-history', 'History');
  ui.headerBackButton.onclick = () => navigateTo('view-dashboard', 'CHG Toolkit');
  
  $('#dark-mode-toggle').onclick = toggleDarkMode;
  
  $$('.tool-card').forEach(c => c.onclick = () => {
    navigateTo(`view-${c.dataset.nav}`, c.querySelector('.tool-card-title').innerText.replace('<br>', ' '));
  });

  $('#heparin-mode-initial').onclick = () => {
    appState.currentHeparinMode = 'initial';
    $('#heparin-initial-fields').classList.remove('hidden');
    $('#heparin-maintenance-fields').classList.add('hidden');
    $('#heparin-mode-initial').classList.add('active');
    $('#heparin-mode-maintenance').classList.remove('active');
  };
  $('#heparin-mode-maintenance').onclick = () => {
    appState.currentHeparinMode = 'maintenance';
    $('#heparin-initial-fields').classList.add('hidden');
    $('#heparin-maintenance-fields').classList.remove('hidden');
    $('#heparin-mode-maintenance').classList.add('active');
    $('#heparin-mode-initial').classList.remove('active');
  };

  ui.heparinForm.onsubmit = handleHeparinSubmit;
  ui.prophylaxisForm.onsubmit = handleProphylaxisSubmit;
  ui.paduaForm.onsubmit = handlePaduaSubmit;
  $('#iv-form').onsubmit = handleIVSubmit;
  ui.passwordForm.onsubmit = handlePasswordSubmit;
  
  $('#renal-form').oninput = handleRenalInput;
  $('#converter-form').oninput = () => {
    const val = parseFloat($('#converter-fromValue').value);
    const res = doConversion(val, $('#converter-fromUnit').value, $('#converter-toUnit').value);
    $('#converter-toValue').value = res;
  };
  
  ui.historySearch.oninput = (e) => {
    const term = e.target.value.toLowerCase();
    renderLogs(appState.historyLogs.filter(l => l.patient_name.toLowerCase().includes(term)));
  };

  const savedMode = localStorage.getItem('darkMode');
  if (savedMode === 'true') document.body.classList.add('dark');
  navigateTo('view-dashboard', 'CHG Toolkit');
});
