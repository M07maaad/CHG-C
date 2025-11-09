// --- (1) CONSTANTS & CONFIGURATION ---
const SUPABASE_URL = 'https://kjiujbsyhxpooppmxgxb.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtqaXVqYnN5aHhwb29wcG14Z3hiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIxMDI0MjcsImV4cCI6MjA3NzY3ODQyN30.PcG8aF4r1RjennleU_14vqxJSAoxY_MyOl9GLdbKVkw';
const HISTORY_PASSWORD = 'CHG123'; // The password you requested
const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- (2) DOM ELEMENT SELECTORS ---
// App Shell
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);
const appHeader = $('.app-header');
const appTitle = $('#app-title');
const appContent = $('.app-content');
const headerBackButton = $('#header-back-button');
const allViews = $$('.view');
const allNavButtons = $$('.nav-button');
const passwordPrompt = $('#password-prompt');

// Forms & Inputs
const heparinForm = $('#heparin-form');
const prophylaxisForm = $('#prophylaxis-form');
const paduaForm = $('#padua-form');
const ivForm = $('#iv-form');
const renalForm = $('#renal-form');
const converterForm = $('#converter-form');
const passwordForm = $('#password-form');

// --- (3) APPLICATION STATE ---
const appState = {
  currentView: 'dashboard',
  currentHeparinMode: 'initial',
  currentPatientName: '',
  currentPatientIdentifier: '',
};

// --- (4) NAVIGATION ---

/**
 * Main navigation function. Shows/hides views.
 * @param {string} viewId - The ID of the view to show (e.g., "view-heparin").
 * @param {string} title - The title to set in the app header.
 */
function navigateTo(viewId, title) {
  // 1. Hide all views
  allViews.forEach(view => view.classList.remove('active'));
  
  // 2. Show the target view
  const targetView = $(`#${viewId}`);
  if (targetView) {
    targetView.classList.add('active');
    appState.currentView = viewId;
  }
  
  // 3. Update Header
  appTitle.textContent = title;
  headerBackButton.style.display = (viewId === 'view-dashboard') ? 'none' : 'block';
  
  // 4. Update Bottom Nav active state
  allNavButtons.forEach(btn => {
    const isHistoryBtn = btn.id === 'nav-history' && viewId.includes('history');
    const isHomeBtn = btn.id === 'nav-home' && !viewId.includes('history');
    btn.classList.toggle('active', isHomeBtn || isHistoryBtn);
  });
  
  // 5. Scroll content to top
  appContent.scrollTop = 0;
  
  // 6. Special case for History (password prompt)
  if (viewId === 'view-history') {
    // Clear old history content
    $('#view-history').innerHTML = ''; 
    // Show password prompt
    passwordPrompt.classList.remove('hidden');
    $('#password-input').focus();
  }
}

// --- (5) EVENT LISTENER INITIALIZATION ---

/**
 * Registers the Service Worker for PWA functionality.
 */
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js')
        .then(registration => {
          console.log('Service Worker registered with scope:', registration.scope);
        })
        .catch(error => {
          console.error('Service Worker registration failed:', error);
        });
    });
  }
}

/**
 * Attaches all event listeners for the application.
 */
function initializeEventListeners() {
  // Bottom Nav
  $('#nav-home').addEventListener('click', () => navigateTo('view-dashboard', 'CHG Toolkit'));
  $('#nav-history').addEventListener('click', () => navigateTo('view-history', 'Calculation History'));

  // Header Back Button
  headerBackButton.addEventListener('click', () => navigateTo('view-dashboard', 'CHG Toolkit'));

  // Dashboard Cards
  $$('.tool-card').forEach(card => {
    card.addEventListener('click', () => {
      const navTarget = card.dataset.nav;
      const viewId = `view-${navTarget}`;
      // Get title from the card itself
      const title = card.querySelector('.tool-card-title').innerText.replace('<br>', ' ');
      navigateTo(viewId, title);
    });
  });
  
  // --- Form: Heparin ---
  $('#heparin-mode-initial').addEventListener('click', () => toggleHeparinMode('initial'));
  $('#heparin-mode-maintenance').addEventListener('click', () => toggleHeparinMode('maintenance'));
  heparinForm.addEventListener('submit', handleHeparinSubmit);
  
  // --- Form: Prophylaxis ---
  prophylaxisForm.addEventListener('submit', handleProphylaxisSubmit);
  prophylaxisForm.querySelectorAll('.risk-factor-card input').forEach(cb => {
    cb.addEventListener('change', handleProphylaxisCheck);
  });
  
  // --- Form: Padua ---
  paduaForm.addEventListener('submit', handlePaduaSubmit);
  paduaForm.querySelectorAll('.risk-factor-card input').forEach(cb => {
    cb.addEventListener('change', handlePaduaCheck);
  });
  
  // --- Form: IV Calculator ---
  ivForm.addEventListener('submit', handleIVSubmit);
  
  // --- Form: Renal (Live) ---
  renalForm.addEventListener('input', handleRenalInput);
  
  // --- Form: Converter (Live) ---
  converterForm.addEventListener('input', handleConverterInput);
  
  // --- Password Prompt ---
  passwordForm.addEventListener('submit', handlePasswordSubmit);
  $('#password-cancel').addEventListener('click', () => {
    passwordPrompt.classList.add('hidden');
    navigateTo('view-dashboard', 'CHG Toolkit'); // Go back home
  });
}

// --- (6) EVENT HANDLERS (Form Submission & Logic) ---

// --- Password ---
function handlePasswordSubmit(e) {
  e.preventDefault();
  const password = $('#password-input').value;
  if (password === HISTORY_PASSWORD) {
    passwordPrompt.classList.add('hidden');
    loadHistoryLogs();
  } else {
    alert('Incorrect password. Please try again.');
    $('#password-input').value = '';
  }
}

async function loadHistoryLogs() {
  const historyView = $('#view-history');
  historyView.innerHTML = `<p class="text-center text-lg text-gray-600 mt-10">Loading history...</p>`;
  
  try {
    const { data: logs, error } = await db
      .from('calculation_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    if (!logs || logs.length === 0) {
      historyView.innerHTML = `<p class="text-center text-lg text-gray-600 mt-10">No logs found.</p>`;
      return;
    }
    
    // Build HTML for each log card
    const logsHtml = logs.map(log => `
      <div class="log-entry">
        <div class="log-header">
          <span class="log-tool-name">${log.tool_name.replace(/_/g, ' ')}</span>
          <span class="log-timestamp">${formatDateTime(log.created_at)}</span>
        </div>
        <p class="log-patient">
          Patient: ${log.patient_name || 'N/A'} (ID: ${log.patient_identifier || 'N/A'})
        </p>
        <div class="log-details">
          ${formatLogData(log)}
        </div>
      </div>
    `).join('');
    
    historyView.innerHTML = logsHtml;
    
  } catch (error) {
    console.error('Error fetching history:', error);
    historyView.innerHTML = `<div class="error-box"><p>Failed to load history. Please check connection.</p><p>${error.message}</p></div>`;
  }
}

// --- Heparin ---
function toggleHeparinMode(mode) {
  appState.currentHeparinMode = mode;
  const isInitial = (mode === 'initial');
  
  $('#heparin-mode-initial').classList.toggle('active', isInitial);
  $('#heparin-mode-maintenance').classList.toggle('active', !isInitial);
  
  $('#heparin-initial-fields').classList.toggle('hidden', !isInitial);
  $('#heparin-maintenance-fields').classList.toggle('hidden', isInitial);
  
  // Toggle 'required' attribute
  $('#heparin-indication').required = isInitial;
  $('#heparin-currentRate').required = !isInitial;
  $('#heparin-currentPtt').required = !isInitial;
  
  $('#heparin-result-area').innerHTML = '';
}

async function handleHeparinSubmit(e) {
  e.preventDefault();
  const resultArea = $('#heparin-result-area');
  const calculateBtn = $('#heparin-calculate-btn');
  
  calculateBtn.disabled = true;
  calculateBtn.querySelector('span').textContent = 'Calculating...';
  resultArea.innerHTML = '';
  
  try {
    const formData = {
      patientName: $('#heparin-patientName').value,
      patientIdentifier: $('#heparin-patientIdentifier').value,
      weight: parseFloat($('#heparin-weight').value),
      heparinConcentration: parseFloat($('#heparin-concentration').value),
      indication: $('#heparin-indication').value,
      currentInfusionRate: parseFloat($('#heparin-currentRate').value),
      currentPtt: parseFloat($('#heparin-currentPtt').value),
    };
    
    let result, inputs, toolName;
    
    if (appState.currentHeparinMode === 'initial') {
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
      
      // Save to Supabase (in the background, no await)
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
    calculateBtn.disabled = false;
    calculateBtn.querySelector('span').textContent = 'Calculate';
  }
}

// --- Prophylaxis ---
function handleProphylaxisCheck() {
  const selectedFactors = Array.from(prophylaxisForm.querySelectorAll('input[name="riskFactor"]:checked')).map(cb => cb.value);
  const resultArea = $('#prophylaxis-result-area');
  
  if (selectedFactors.length === 0) {
    resultArea.innerHTML = '';
    return;
  }
  
  const result = calculateStressUlcerProphylaxis(selectedFactors);
  resultArea.innerHTML = result.html;
}

async function handleProphylaxisSubmit(e) {
  e.preventDefault();
  const resultArea = $('#prophylaxis-result-area');
  const saveBtn = $('#prophylaxis-save-btn');
  
  if (resultArea.innerHTML === '') {
    alert('Please select risk factors to calculate a result before saving.');
    return;
  }
  
  saveBtn.disabled = true;
  saveBtn.querySelector('span').textContent = 'Saving...';
  
  try {
    const selectedFactors = Array.from(prophylaxisForm.querySelectorAll('input[name="riskFactor"]:checked')).map(cb => cb.value);
    const result = calculateStressUlcerProphylaxis(selectedFactors); 
    
    const patientName = $('#prophylaxis-patientName').value;
    const patientIdentifier = $('#prophylaxis-patientIdentifier').value;
    
    await saveCalculation(
      'stress_ulcer_prophylaxis',
      patientName,
      patientIdentifier,
      { factors: selectedFactors },
      result.logData
    );
    
    saveBtn.querySelector('span').textContent = 'Saved!';
    
  } catch (error) {
    saveBtn.querySelector('span').textContent = 'Save Failed';
    resultArea.innerHTML += `<div class="error-box mt-4"><p><strong>Save Error:</strong> ${error.message}</p></div>`;
  } finally {
    setTimeout(() => {
      saveBtn.disabled = false;
      saveBtn.querySelector('span').textContent = 'Save Result';
    }, 2000);
  }
}

// --- Padua ---
function handlePaduaCheck() {
  const resultArea = $('#padua-result-area');
  
  let score = 0;
  const selectedFactors = [];
  paduaForm.querySelectorAll('input[name="riskFactor"]:checked').forEach(cb => {
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

async function handlePaduaSubmit(e) {
  e.preventDefault();
  const resultArea = $('#padua-result-area');
  const saveBtn = $('#padua-save-btn');

  if (resultArea.innerHTML === '') {
    alert('Please select risk factors to calculate a score before saving.');
    return;
  }

  saveBtn.disabled = true;
  saveBtn.querySelector('span').textContent = 'Saving...';

  try {
    let score = 0;
    const selectedFactors = [];
    paduaForm.querySelectorAll('input[name="riskFactor"]:checked').forEach(cb => {
      score += parseInt(cb.dataset.score, 10);
      selectedFactors.push(cb.value);
    });
    const result = calculatePaduaScore(score); 

    const patientName = $('#padua-patientName').value;
    const patientIdentifier = $('#padua-patientIdentifier').value;

    await saveCalculation(
      'padua_score',
      patientName,
      patientIdentifier,
      { factors: selectedFactors },
      result.logData
    );

    saveBtn.querySelector('span').textContent = 'Saved!';

  } catch (error) {
    saveBtn.querySelector('span').textContent = 'Save Failed';
    resultArea.innerHTML += `<div class="error-box mt-4"><p><strong>Save Error:</strong> ${error.message}</p></div>`;
  } finally {
    setTimeout(() => {
      saveBtn.disabled = false;
      saveBtn.querySelector('span').textContent = 'Save Score';
    }, 2000);
  }
}

// --- IV Calculator ---
async function handleIVSubmit(e) {
  e.preventDefault();
  const resultArea = $('#iv-result-area');
  const calculateBtn = $('#iv-calculate-btn'); 
  
  calculateBtn.disabled = true;
  calculateBtn.querySelector('span').textContent = 'Calculating...';
  resultArea.innerHTML = '';
  
  try {
    const inputs = {
      weight_kg: parseFloat($('#iv-weight').value),
      drugAmount_mg: parseFloat($('#iv-drugAmount').value),
      solutionVolume_ml: parseFloat($('#iv-solutionVolume').value),
      drugDose: parseFloat($('#iv-drugDose').value),
      doseUnit: $('#iv-doseUnit').value
    };
    
    const patientName = $('#iv-patientName').value;
    const patientIdentifier = $('#iv-patientIdentifier').value;

    const result = calculateIVRate(inputs);
    resultArea.innerHTML = result.html;
    
    // Save to Supabase (in background)
    saveCalculation(
      'iv_calculator',
      patientName,
      patientIdentifier,
      inputs,
      result.logData
    );
    
  } catch (error) {
    resultArea.innerHTML = `<div class="error-box"><p>${error.message}</p></div>`;
  } finally {
    calculateBtn.disabled = false;
    calculateBtn.querySelector('span').textContent = 'Calculate Rate';
  }
}

// --- Renal Dosing (Live) ---
function handleRenalInput() {
  const resultArea = $('#renal-result-area');
  try {
    const inputs = {
      age: parseFloat($('#renal-age').value),
      weight_kg: parseFloat($('#renal-weight').value),
      creatinine_mg_dl: parseFloat($('#renal-creatinine').value),
      gender: $('#renal-gender').value
    };
    
    if (inputs.age > 0 && inputs.weight_kg > 0 && inputs.creatinine_mg_dl > 0) {
      const result = calculateCrCl(inputs);
      resultArea.innerHTML = result.html;
    } else {
      resultArea.innerHTML = '';
    }
  } catch (error) {
    resultArea.innerHTML = `<div class="error-box"><p>Calculation error: ${error.message}</p></div>`;
  }
}

// --- Unit Converter (Live) ---
function handleConverterInput() {
  const resultField = $('#converter-toValue');
  try {
    const inputs = {
      value: parseFloat($('#converter-fromValue').value),
      fromUnit: $('#converter-fromUnit').value,
      toUnit: $('#converter-toUnit').value
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

// --- (7) CALCULATION LOGIC (Translated from code.gs & New) ---

/**
 * Translated from code.gs: calculateInitialHeparinRate
 */
function calculateInitialHeparinRate(formData) {
  const { weight, heparinConcentration, indication, patientName } = formData;

  if (isNaN(weight) || isNaN(heparinConcentration) || weight <= 0 || heparinConcentration <= 0 || !indication) {
    return { error: 'Please enter valid numerical values and select an indication.' };
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
  
  // *** TEST: 1 Minute Notification ***
  const repeatPttMinutes = 1; // Was 6 * 60
  
  const logData = {
    loading_dose: `${suggestedLoadingDoseUnits.toFixed(0)} units (${loadingDoseMl} mL)`,
    initial_rate: `${initialInfusionRateMl} mL/hour`,
    next_ptt: `in ${repeatPttMinutes} minutes`
  };
  
  const html = `
    <div class="result-box">
      <p class="result-title">Initial Dose Calculation</p>
      <p class="text-lg mt-2">Suggested Loading Dose: <span class="font-bold">${logData.loading_dose}</span></p>
      <p class="text-lg mt-2">Initial Infusion Rate: <span class="font-bold">${logData.initial_rate}</span></p>
      <p class="text-lg mt-2">Next PTT Check: <span class="font-bold">${logData.next_ptt}</span></p>
    </div>
    <div class="result-box" style="background-color: #fffde7; border-color: #fdd835; color: #6f6f00;">
      <p class="font-bold">TEST: Notification set for ${patientName} in ${repeatPttMinutes} minute(s) for PTT check.</p>
    </div>
  `;

  return {
    html: html,
    logData: logData,
    notification_ptt: {
      title: `Heparin Alert: ${patientName}`,
      body: `Time for scheduled PTT check.`,
      delayInMinutes: repeatPttMinutes
    }
  };
}

/**
 * Translated from code.gs: calculateMaintenanceHeparinRate
 */
function calculateMaintenanceHeparinRate(formData) {
  const { weight, heparinConcentration, currentInfusionRate, currentPtt, patientName } = formData;

  if (isNaN(weight) || isNaN(heparinConcentration) || isNaN(currentInfusionRate) || isNaN(currentPtt) || weight <= 0 || heparinConcentration <= 0 || currentInfusionRate < 0 || currentPtt <= 0) {
    return { error: 'Please enter valid numerical values for all fields.' };
  }

  const currentUnitsPerHour = currentInfusionRate * heparinConcentration;
  const currentUnitsPerKgPerHour = currentUnitsPerHour / weight;

  let newUnitsPerKgPerHour = currentUnitsPerKgPerHour;
  let bolusDoseUnits = 0;
  let message = '';
  let stopInfusionMin = 0;
  
  // *** TEST: 1 Minute Notification ***
  let repeatPttMinutes = 1; // Was 6 * 60
  
  let boxClass = 'result-box'; // Default is green

  // This logic is directly translated from your code.gs
  if (currentPtt < 40) {
    bolusDoseUnits = 25 * weight;
    newUnitsPerKgPerHour += 3;
    message = 'Very low PTT (<40). Give bolus and increase infusion rate.';
    boxClass = 'error-box';
  } else if (currentPtt >= 40 && currentPtt <= 49) {
    newUnitsPerKgPerHour += 2;
    message = 'Low PTT (40-49). Increase infusion rate.';
    boxClass = 'error-box'; // Still sub-therapeutic
  } else if (currentPtt >= 50 && currentPtt <= 69) {
    newUnitsPerKgPerHour += 1;
    message = 'Relatively low PTT (50-69). Increase infusion rate.';
    boxClass = 'error-box'; // Still sub-therapeutic
  } else if (currentPtt >= 70 && currentPtt <= 110) {
    newUnitsPerKgPerHour = currentUnitsPerKgPerHour;
    message = 'PTT is within therapeutic range (70-110). No change in rate.';
    // boxClass remains 'result-box' (green)
  } else if (currentPtt >= 111 && currentPtt <= 120) {
    newUnitsPerKgPerHour -= 1;
    message = 'Relatively high PTT (111-120). Decrease infusion rate.';
    boxClass = 'error-box'; // Supra-therapeutic
  } else if (currentPtt >= 121 && currentPtt <= 130) {
    stopInfusionMin = 60;
    newUnitsPerKgPerHour -= 2;
    message = `High PTT (121-130). Stop infusion for ${stopInfusionMin} minutes then decrease infusion rate.`;
    boxClass = 'error-box';
  } else if (currentPtt >= 131 && currentPtt <= 140) {
    stopInfusionMin = 60;
    newUnitsPerKgPerHour -= 3;
    message = `Very high PTT (131-140). Stop infusion for ${stopInfusionMin} minutes then decrease infusion rate.`;
    boxClass = 'error-box';
  } else if (currentPtt >= 141 && currentPtt <= 150) {
    stopInfusionMin = 120;
    newUnitsPerKgPerHour -= 5;
    message = `Extremely high PTT (141-150). Stop infusion for ${stopInfusionMin} minutes then decrease infusion rate.`;
    boxClass = 'error-box';
  } else if (currentPtt > 150) {
    stopInfusionMin = 180;
    newUnitsPerKgPerHour = 0;
    message = `Critically high PTT (>150). Stop infusion for ${stopInfusionMin} minutes and contact physician immediately for re-evaluation.`;
    repeatPttMinutes = 0; // No automatic PTT check
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
    next_ptt: repeatPttMinutes > 0 ? `in ${repeatPttMinutes} minutes` : `Per physician's instructions`,
    message: message
  };

  let html = `<div class="${boxClass}"> <p class="result-title">Maintenance Dose Adjustment</p>`;
  if (logData.bolus_dose !== 'N/A') {
    html += `<p class="text-lg mt-2">Suggested Bolus: <span class="font-bold">${logData.bolus_dose}</span></p>`;
  }
  if (logData.stop_infusion_min !== 'N/A') {
    html += `<p class="text-lg mt-2 font-bold" style="color: #c62828;">Stop Infusion: <span class="font-bold">${logData.stop_infusion_min} minutes</span></p>`;
  }
  html += `<p class="text-lg mt-2">New Infusion Rate: <span class="font-bold">${logData.new_rate}</span></p>`;
  html += `<p class="text-lg mt-2">Next PTT Check: <span class="font-bold">${logData.next_ptt}</span></p>`;
  html += `<p class="text-sm mt-3">${logData.message}</p>`;
  html += `</div>`;
  
  let notifications = {};
  
  // Add stop infusion notification (TEST: 1 minute)
  if (stopInfusionMin > 0) {
    const stopDelay = 1; // *** TEST: 1 Minute Notification *** (Was stopInfusionMin)
    notifications.notification = {
      title: `Heparin Alert: ${patientName}`,
      body: `TEST: Time to RESTART infusion (Original stop: ${stopInfusionMin} min).`,
      delayInMinutes: stopDelay
    };
    html += `<div class="result-box" style="background-color: #fffde7; border-color: #fdd835; color: #6f6f00;"><p class="font-bold">TEST: Notification set for ${patientName} in ${stopDelay} min to restart infusion.</p></div>`;
  }
  
  // Add PTT check notification (TEST: 1 minute)
  if (repeatPttMinutes > 0) {
    notifications.notification_ptt = {
      title: `Heparin Alert: ${patientName}`,
      body: `TEST: Time for scheduled PTT check (Original: ${logData.next_ptt}).`,
      delayInMinutes: repeatPttMinutes
    };
    html += `<div class="result-box" style="background-color: #fffde7; border-color: #fdd835; color: #6f6f00;"><p class="font-bold">TEST: Notification set for ${patientName} in ${repeatPttMinutes} min for PTT check.</p></div>`;
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
        <p class="result-title">Risk Level: ${riskLevel}</p>
        <p class="mt-1 font-bold">Patient is INDICATED for prophylaxis.</p>
      </div>
    `;
  } else {
    html = `
      <div class="result-box">
        <p class="result-title">Risk Level: ${riskLevel}</p>
        <p class="mt-1 font-bold">Patient is NOT INDICATED for prophylaxis.</p>
      </div>
    `;
  }
  
  return { html, logData };
}

/**
 * New logic for Padua Score
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
        <p class="result-title">Score: ${score} (Risk Level: ${riskLevel})</p>
        <p class="mt-1 font-bold">Patient is at HIGH RISK for VTE. Prophylaxis recommended.</p>
      </div>
    `;
  } else {
    html = `
      <div class="result-box">
        <p class="result-title">Score: ${score} (Risk Level: ${riskLevel})</p>
        <p class="mt-1 font-bold">Patient is at LOW RISK for VTE. Prophylaxis not required.</p>
      </div>
    `;
  }
  
  return { html, logData };
}

/**
 * New logic for IV Infusion Calculator
 */
function calculateIVRate(inputs) {
  const { weight_kg, drugAmount_mg, solutionVolume_ml, drugDose, doseUnit } = inputs;
  
  if (isNaN(weight_kg) || isNaN(drugAmount_mg) || isNaN(solutionVolume_ml) || isNaN(drugDose) ||
      weight_kg <= 0 || drugAmount_mg <= 0 || solutionVolume_ml <= 0 || drugDose <= 0) {
    throw new Error('Please enter valid, positive numerical values for all fields.');
  }
  
  const concentration_mg_ml = drugAmount_mg / solutionVolume_ml;
  let rate_ml_hr = 0;
  
  switch (doseUnit) {
    case 'mcg/kg/min':
      rate_ml_hr = (drugDose * weight_kg * 60) / (concentration_mg_ml * 1000);
      break;
    case 'mcg/min':
      rate_ml_hr = (drugDose * 60) / (concentration_mg_ml * 1000);
      break;
    case 'mg/hr':
      rate_ml_hr = drugDose / concentration_mg_ml;
      break;
    default:
      throw new Error('Invalid dose unit selected.');
  }
  
  const logData = {
    rate_ml_hr: rate_ml_hr.toFixed(2)
  };
  
  const html = `
    <div class="result-box">
      <p class="text-lg text-center">Set Pump Rate to:</p>
      <p class="text-3xl font-bold text-center my-2">${logData.rate_ml_hr} mL/hr</p>
    </div>
  `;
  
  return { html, logData };
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
      <p class="text-lg text-center">Estimated Creatinine Clearance:</p>
      <p class="text-3xl font-bold text-center my-2">${logData.crcl_ml_min} mL/min</p>
      <p class="text-sm text-center mt-4">Note: Cockcroft-Gault. Always consult hospital protocols.</p>
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
  const massConversions = {
    'kg': 1000000000, 'g': 1000000, 'mg': 1000, 'mcg': 1,
  };
  // Base unit: mL
  const volumeConversions = {
    'L': 1000, 'mL': 1
  };
  // Weight conversions
  const weightConversions = {
    'lbs_kg': 0.453592, // lbs to kg
    'kg_lbs': 2.20462   // kg to lbs
  };

  let result;
  
  if (fromUnit in massConversions && toUnit in massConversions) {
    const baseValue = value * massConversions[fromUnit];
    result = baseValue / massConversions[toUnit];
  } else if (fromUnit in volumeConversions && toUnit in volumeConversions) {
    const baseValue = value * volumeConversions[fromUnit];
    result = baseValue / volumeConversions[toUnit];
  } else if (fromUnit === 'lbs' && toUnit === 'kg') {
    result = value * weightConversions['lbs_kg'];
  } else if (fromUnit === 'kg' && toUnit === 'lbs') {
    result = value * weightConversions['kg_lbs'];
  } else if (fromUnit === 'lbs' && toUnit === 'lbs_kg') {
    result = value * weightConversions['lbs_kg'];
  } else if (fromUnit === 'kg' && toUnit === 'kg_lbs') {
    result = value * weightConversions['kg_lbs'];
  } else {
    return 'N/A'; // Incompatible units
  }
  
  // Format result nicely
  if (result < 0.0001) return result.toExponential(4);
  if (result.toString().split('.')[1]?.length > 4) return result.toFixed(4);
  return result.toString();
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
    
  } catch (error) {
    console.error('Error saving to Supabase:', error.message);
    // Show a non-blocking error to the user
    const resultArea = $(`#${appState.currentView.replace('view-','_')}result-area`);
    if (resultArea) {
      const errorDiv = document.createElement('div');
      errorDiv.className = 'error-box mt-4';
      errorDiv.innerHTML = `<p><strong>Save Error:</strong> Log was not saved. ${error.message}</p>`;
      resultArea.appendChild(errorDiv); // Append error
    }
  }
}

/**
 * Schedules a local notification via the Service Worker.
 */
async function scheduleNotification(title, body, delayInMinutes) {
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
    // Don't alert here, it's annoying. The user knows they denied it.
    return;
  }

  // 2. If permission is granted, pass the job to the Service Worker
  if (permission === 'granted') {
    if (delayInMinutes <= 0) return;
    
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
    }
  }
}

/**
 * Formats the log data (inputs and results) into readable HTML.
 */
function formatLogData(log) {
  let inputsHtml = '<div class="log-details-title">Inputs:</div><ul>';
  let resultHtml = '<div class="log-details-title">Result:</div><ul>';

  const inputs = log.inputs || {};
  const result = log.result || {};

  try {
    switch (log.tool_name) {
      case 'heparin_initial':
        inputsHtml += `<li>Weight: ${inputs.weight_kg} kg</li>`;
        inputsHtml += `<li>Concentration: ${inputs.concentration} u/mL</li>`;
        inputsHtml += `<li>Indication: ${inputs.indication}</li>`;
        resultHtml += `<li>Loading Dose: ${result.loading_dose}</li>`;
        resultHtml += `<li>Initial Rate: ${result.initial_rate}</li>`;
        resultHtml += `<li>Next PTT: ${result.next_ptt}</li>`;
        break;
      
      case 'heparin_maintenance':
        inputsHtml += `<li>Weight: ${inputs.weight_kg} kg</li>`;
        inputsHtml += `<li>Concentration: ${inputs.concentration} u/mL</li>`;
        inputsHtml += `<li>Current Rate: ${inputs.current_rate_ml_hr} mL/hr</li>`;
        inputsHtml += `<li>Current PTT: ${inputs.current_ptt_sec} sec</li>`;
        resultHtml += `<li>New Rate: ${result.new_rate}</li>`;
        resultHtml += `<li>Bolus Dose: ${result.bolus_dose}</li>`;
        resultHtml += `<li>Stop Infusion: ${result.stop_infusion_min} min</li>`;
        resultHtml += `<li>Next PTT: ${result.next_ptt}</li>`;
        break;
        
      case 'stress_ulcer_prophylaxis':
      case 'padua_score':
        if(inputs.factors && inputs.factors.length > 0) {
          inputsHtml += `<li>Factors: ${inputs.factors.join(', ')}</li>`;
        } else {
          inputsHtml += `<li>Factors: No factors selected</li>`;
        }
        if(result.score !== undefined) resultHtml += `<li>Score: ${result.score}</li>`;
        resultHtml += `<li>Risk Level: ${result.risk_level}</li>`;
        if(result.is_indicated !== undefined) resultHtml += `<li>Indicated: ${result.is_indicated ? 'Yes' : 'No'}</li>`;
        break;

      case 'iv_calculator':
        inputsHtml += `<li>Weight: ${inputs.weight_kg} kg</li>`;
        inputsHtml += `<li>Drug Amount: ${inputs.drugAmount_mg} mg</li>`;
        inputsHtml += `<li>Solution Volume: ${inputs.solutionVolume_ml} mL</li>`;
        inputsHtml += `<li>Dose: ${inputs.drugDose} ${inputs.doseUnit}</li>`;
        resultHtml += `<li>Rate: ${result.rate_ml_hr} mL/hr</li>`;
        break;
        
      default:
        inputsHtml += `<li>${JSON.stringify(inputs)}</li>`;
        resultHtml += `<li>${JSON.stringify(result)}</li>`;
    }
  } catch (e) {
    console.error("Error formatting log:", e);
    inputsHtml = `<strong>Inputs:</strong><pre>${JSON.stringify(inputs, null, 2)}</pre>`;
    resultHtml = `<strong>Result:</strong><pre>${JSON.stringify(result, null, 2)}</pre>`;
  }

  inputsHtml += '</ul>';
  resultHtml += '</ul>';
  return `${inputsHtml}${resultHtml}`;
}

// --- (9) INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
  registerServiceWorker();
  initializeEventListeners();
  // Set initial view
  navigateTo('view-dashboard', 'CHG Toolkit');
  // Trigger live calculation for converters on load
  handleConverterInput();
  handleRenalInput();
});
