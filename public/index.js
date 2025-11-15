// --- (1) CONSTANTS & CONFIGURATION ---
// هذه المتغيرات آمنة هنا لأنها مجرد نصوص
const SUPABASE_URL = 'https://kjiujbsyhxpooppmxgxb.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtqaXVqYnN5aHhwb29wcG14Z3hiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIxMDI0MjcsImV4cCI6MjA3NzY3ODQyN30.PcG8aF4r1RjennleU_14vqxJSAoxY_MyOl9GLdbKVkw';
const HISTORY_PASSWORD = 'CHG123';
const VAPID_PUBLIC_KEY = 'BEmbnBlwEteOvULB_yijKhjLmyB2ElPl4ihiY3tG9NBGMuSLTnp-yFlEphfEWEOwxU1_Cm0XUN6_5zf-BLaFW0w';

// --- (2) APPLICATION STATE ---
// آمن هنا لأنه مجرد تعريف لكائن
const appState = {
  currentView: 'dashboard',
  currentHeparinMode: 'initial',
  historyLogs: [],
};

// --- (3) GLOBAL VARIABLES (To be initialized later) ---
// سنقوم بتعريف المتغيرات هنا، ولكن سنقوم بتعيين قيمها داخل DOMContentLoaded
let db;
let $;
let $$;

// DOM Elements
let appHeader, appTitle, appContent, headerBackButton, allViews, allNavButtons;
let passwordPrompt, darkModeToggle, heparinForm, prophylaxisForm, paduaForm;
let ivForm, renalForm, converterForm, passwordForm, historySearch;


// --- (4) NAVIGATION ---
// (تعريف الدوال آمن في أي مكان)
function navigateTo(viewId, title) {
  allViews.forEach(view => view.classList.remove('active'));
  const targetView = $(`#${viewId}`);
  if (targetView) {
    targetView.classList.add('active');
    appState.currentView = viewId;
  }
  appTitle.textContent = title;
  headerBackButton.style.display = (viewId === 'view-dashboard') ? 'none' : 'block';
  allNavButtons.forEach(btn => {
    const navId = btn.dataset.nav;
    let isActive = false;
    if (navId === 'dashboard') {
        isActive = (viewId !== 'view-history');
    } else if (navId === 'history') {
        isActive = (viewId === 'view-history');
    }
    btn.classList.toggle('active', isActive);
  });
  appContent.scrollTop = 0;
  if (viewId === 'view-history') {
    $('#history-logs-container').innerHTML = '';
    $('#history-search').value = '';
    appState.historyLogs = [];
    passwordPrompt.classList.remove('hidden');
    $('#password-input').value = '';
    $('#password-input').focus();
    const oldError = passwordForm.querySelector('.error-box');
    if (oldError) {
      oldError.remove();
    }
  }
}

function formatDateTime(isoString) {
  try {
    return new Date(isoString).toLocaleString('en-US', {
      year: '2-digit', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: true
    });
  } catch (e) {
    return isoString;
  }
}

// --- *** NEW (Push Notification Helpers) *** ---
function getUserId() {
  let userId = localStorage.getItem('chg_user_id');
  if (!userId) {
    userId = crypto.randomUUID();
    localStorage.setItem('chg_user_id', userId);
  }
  return userId;
}
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// --- (5) EVENT LISTENER INITIALIZATION ---
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

function initializeEventListeners() {
  // (All old listeners are the same)
  $('#nav-home').addEventListener('click', () => navigateTo('view-dashboard', 'CHG Toolkit'));
  $('#nav-history').addEventListener('click', () => navigateTo('view-history', 'Calculation History'));
  headerBackButton.addEventListener('click', () => navigateTo('view-dashboard', 'CHG Toolkit'));
  darkModeToggle.addEventListener('click', toggleDarkMode);
  $$('.tool-card').forEach(card => {
    card.addEventListener('click', () => {
      const navTarget = card.dataset.nav;
      const viewId = `view-${navTarget}`;
      const title = card.querySelector('.tool-card-title').innerText.replace('<br>', ' ');
      navigateTo(viewId, title);
    });
  });
  $('#heparin-mode-initial').addEventListener('click', () => toggleHeparinMode('initial'));
  $('#heparin-mode-maintenance').addEventListener('click', () => toggleHeparinMode('maintenance'));
  heparinForm.addEventListener('submit', handleHeparinSubmit);
  prophylaxisForm.addEventListener('submit', handleProphylaxisSubmit);
  prophylaxisForm.querySelectorAll('.risk-factor-card input').forEach(cb => {
    cb.addEventListener('change', handleProphylaxisCheck);
  });
  paduaForm.addEventListener('submit', handlePaduaSubmit);
  paduaForm.querySelectorAll('.risk-factor-card input').forEach(cb => {
    cb.addEventListener('change', handlePaduaCheck);
  });
  ivForm.addEventListener('submit', handleIVSubmit);
  renalForm.addEventListener('input', handleRenalInput);
  converterForm.addEventListener('input', handleConverterInput);
  passwordForm.addEventListener('submit', handlePasswordSubmit);
  $('#password-cancel').addEventListener('click', () => {
    passwordPrompt.classList.add('hidden');
    navigateTo('view-dashboard', 'CHG Toolkit');
  });
  historySearch.addEventListener('input', handleHistorySearch);
}

// --- *** NEW: Push Notification Subscription Logic *** ---
async function subscribeUserToPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('Push Notifications not supported by this browser.');
    return;
  }
  
  // Ask for permission *first*
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.warn('Notification permission was not granted.');
      return; // User denied, stop here.
    }
  } catch (permError) {
     console.error('Failed to request notification permission:', permError);
     return;
  }

  // If permission is granted, proceed to subscribe
  try {
    const swRegistration = await navigator.serviceWorker.ready;
    let subscription = await swRegistration.pushManager.getSubscription();

    if (subscription === null) {
      // No subscription exists, create one.
      console.log('Subscribing to Push Notifications...');
      subscription = await swRegistration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });
    }

    const currentUserId = getUserId();
    
    // Save the subscription to the new 'push_subscriptions' table
    const { error } = await db
      .from('push_subscriptions')
      .upsert({
        user_id: currentUserId,
        subscription_data: subscription
      }, { onConflict: 'user_id' }); // Use upsert to update if it changes

    if (error) throw error;
    console.log('User is subscribed and subscription saved to DB.');

  } catch (error) {
    console.error('Failed to subscribe or save subscription:', error);
    // This could fail if user blocks notifications *after* granting them
    // or if VAPID key is wrong.
  }
}


// --- (6) EVENT HANDLERS (Form Submission & Logic) ---

// (Dark Mode, Password, History, other forms... all same as before)
// ...
function initializeDarkMode() {
  const savedMode = localStorage.getItem('darkMode');
  if (savedMode === 'true') {
    document.body.classList.add('dark');
  } else {
    document.body.classList.remove('dark');
  }
}
function toggleDarkMode() {
  const isDark = document.body.classList.toggle('dark');
  localStorage.setItem('darkMode', isDark);
}
function handlePasswordSubmit(e) {
  e.preventDefault();
  const password = $('#password-input').value;
  const oldError = passwordForm.querySelector('.error-box');
  if (oldError) oldError.remove();
  
  if (password === HISTORY_PASSWORD) {
    passwordPrompt.classList.add('hidden');
    loadHistoryLogs();
  } else {
    const errorBox = document.createElement('div');
    errorBox.className = 'error-box';
    errorBox.style.marginTop = '1rem';
    errorBox.innerHTML = '<p>Incorrect password. Please try again.</p>';
    passwordForm.appendChild(errorBox);
    $('#password-input').value = '';
    $('#password-input').focus();
  }
}
async function loadHistoryLogs() {
  const historyContainer = $('#history-logs-container');
  historyContainer.innerHTML = `<p class="text-center text-lg text-gray-600 dark:text-gray-400 mt-10">Loading history...</p>`;
  try {
    const { data: logs, error } = await db
      .from('calculation_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw error;
    if (!logs || logs.length === 0) {
      historyContainer.innerHTML = `<p class="text-center text-lg text-gray-600 dark:text-gray-400 mt-10">No logs found.</p>`;
      return;
    }
    appState.historyLogs = logs;
    renderHistoryLogs(logs);
  } catch (error) {
    console.error('Error fetching history:', error);
    historyContainer.innerHTML = `<div class="error-box"><p>Failed to load history. Please check connection.</p><p>${error.message}</p></div>`;
  }
}
function renderHistoryLogs(logs) {
  const historyContainer = $('#history-logs-container');
  if (!logs || logs.length === 0) {
    historyContainer.innerHTML = `<p class="text-center text-lg text-gray-600 dark:text-gray-400 mt-10">No matching logs found.</p>`;
    return;
  }
  const logsHtml = logs.map(log => `
    <div class="log-entry" data-patient-name="${(log.patient_name || '').toLowerCase()}">
      <div class="log-header">
        <span class="log-tool-name">${(log.tool_name || 'N/A').replace(/_/g, ' ')}</span>
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
  historyContainer.innerHTML = logsHtml;
}
function handleHistorySearch(e) {
  const searchTerm = e.target.value.toLowerCase();
  const filteredLogs = appState.historyLogs.filter(log => {
    return (log.patient_name || '').toLowerCase().includes(searchTerm);
  });
  renderHistoryLogs(filteredLogs);
}
// ...
// (Other form handlers: toggleHeparinMode, handleProphylaxisCheck, etc...)
function toggleHeparinMode(mode) {
  appState.currentHeparinMode = mode;
  const isInitial = (mode === 'initial');
  $('#heparin-mode-initial').classList.toggle('active', isInitial);
  $('#heparin-mode-maintenance').classList.toggle('active', !isInitial);
  $('#heparin-initial-fields').classList.toggle('hidden', !isInitial);
  $('#heparin-maintenance-fields').classList.toggle('hidden', isInitial);
  $('#heparin-indication').required = isInitial;
  $('#heparin-currentRate').required = !isInitial;
  $('#heparin-currentPtt').required = !isInitial;
  $('#heparin-result-area').innerHTML = '';
}

// --- *** MAJOR CHANGE: handleHeparinSubmit *** ---
async function handleHeparinSubmit(e) {
  e.preventDefault();
  const resultArea = $('#heparin-result-area');
  const calculateBtn = $('#heparin-calculate-btn');
  
  // --- *** FIX: Ask for permission on first click *** ---
  // This is our "user gesture"
  // We run this *before* disabling the button
  try {
    await subscribeUserToPush();
  } catch (subError) {
    console.error("Failed to subscribe:", subError);
    // Don't block calculation, just log the error
  }
  // --- End of fix ---
  
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
    
    if (!formData.patientName || !formData.patientIdentifier) {
        throw new Error('Patient Name and ID are required.');
    }
    
    let result, inputs, toolName;
    
    if (appState.currentHeparinMode === 'initial') {
      if (isNaN(formData.weight) || isNaN(formData.heparinConcentration) || !formData.indication) {
         throw new Error('Weight, Concentration, and Indication are required for initial dose.');
      }
      result = calculateInitialHeparinRate(formData);
      toolName = 'heparin_initial';
      inputs = {
        weight_kg: formData.weight,
        concentration: formData.heparinConcentration,
        indication: formData.indication
      };
    } else {
      if (isNaN(formData.weight) || isNaN(formData.heparinConcentration) || isNaN(formData.currentInfusionRate) || isNaN(formData.currentPtt)) {
         throw new Error('Weight, Concentration, Current Rate, and Current PTT are required for maintenance.');
      }
      result = calculateMaintenanceHeparinRate(formData);
      toolName = 'heparin_maintenance';
      inputs = {
        weight_kg: formData.weight,
        concentration: formData.heparinConcentration,
        current_rate_ml_hr: formData.currentInfusionRate,
        current_ptt_sec: formData.currentPtt
      };
    }
    
    if (result.error) {
      resultArea.innerHTML = `<div class="error-box"><p>${result.error}</p></div>`;
    } else {
      resultArea.innerHTML = result.html;
      
      // --- *** NEW: Schedule Notifications via Supabase DB *** ---
      // (This replaces the old 'scheduleNotification' calls)
      const currentUserId = getUserId();
      const notificationsToSchedule = [];

      // Check for PTT reminder
      if (result.notification_ptt) {
        const pttDelayInMs = result.notification_ptt.delayInMinutes * 60 * 1000;
        notificationsToSchedule.push({
          user_id: currentUserId,
          fire_at: new Date(Date.now() + pttDelayInMs).toISOString(),
          title: result.notification_ptt.title,
          body: result.notification_ptt.body
        });
      }
      
      // Check for 'Stop Infusion' reminder
      if (result.notification) {
        const stopDelayInMs = result.notification.delayInMinutes * 60 * 1000;
        notificationsToSchedule.push({
          user_id: currentUserId,
          fire_at: new Date(Date.now() + stopDelayInMs).toISOString(),
          title: result.notification.title,
          body: result.notification.body
        });
      }

      // If we have any notifications to schedule, insert them into the queue
      if (notificationsToSchedule.length > 0) {
        try {
          const { error } = await db
            .from('notification_queue')
            .insert(notificationsToSchedule);
          if (error) throw error;
          console.log('Notifications successfully scheduled in DB queue.');
        } catch (dbError) {
          console.error('Failed to schedule notifications in DB:', dbError);
          // Show a non-blocking error in the UI
          resultArea.innerHTML += `<div class="error-box mt-4"><p><strong>Notification Error:</strong> Failed to schedule reminders. ${dbError.message}</p></div>`;
        }
      }
      
      // --- Save to Supabase (in the background) ---
      // (This logic is unchanged)
      saveCalculation(
        toolName,
        formData.patientName,
        formData.patientIdentifier,
        inputs,
        result.logData
      );
    }
    
  } catch (error) {
    resultArea.innerHTML = `<div class="error-box"><p>An unexpected error occurred: ${error.message}</p></div>`;
  } finally {
    calculateBtn.disabled = false;
    calculateBtn.querySelector('span').textContent = 'Calculate';
  }
}

// (Other form handlers... same as before)
async function handleProphylaxisSubmit(e) {
  e.preventDefault();
  const resultArea = $('#prophylaxis-result-area');
  const saveBtn = $('#prophylaxis-save-btn');
  const oldError = prophylaxisForm.querySelector('.save-error-box');
  if(oldError) oldError.remove();
  if (resultArea.innerHTML === '') {
    const errorBox = document.createElement('div');
    errorBox.className = 'error-box save-error-box';
    errorBox.style.marginTop = '1rem';
    errorBox.innerHTML = '<p>Please select risk factors to calculate a result before saving.</p>';
    resultArea.parentNode.insertBefore(errorBox, saveBtn);
    return;
  }
  saveBtn.disabled = true;
  saveBtn.querySelector('span').textContent = 'Saving...';
  try {
    const selectedFactors = Array.from(prophylaxisForm.querySelectorAll('input[name="riskFactor"]:checked')).map(cb => cb.value);
    const result = calculateStressUlcerProphylaxis(selectedFactors);
    const patientName = $('#prophylaxis-patientName').value;
    const patientIdentifier = $('#prophylaxis-patientIdentifier').value;
    if (!patientName || !patientIdentifier) {
        throw new Error('Patient Name and ID are required to save.');
    }
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
async function handlePaduaSubmit(e) {
  e.preventDefault();
  const resultArea = $('#padua-result-area');
  const saveBtn = $('#padua-save-btn');
  const oldError = paduaForm.querySelector('.save-error-box');
  if(oldError) oldError.remove();
  if (resultArea.innerHTML === '') {
    const errorBox = document.createElement('div');
    errorBox.className = 'error-box save-error-box';
    errorBox.style.marginTop = '1rem';
    errorBox.innerHTML = '<p>Please select risk factors to calculate a score before saving.</p>';
    resultArea.parentNode.insertBefore(errorBox, saveBtn);
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
    if (!patientName || !patientIdentifier) {
        throw new Error('Patient Name and ID are required to save.');
    }
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
function handlePaduaCheck() {
  const resultArea = $('#padua-result-area');
  let score = 0;
  paduaForm.querySelectorAll('input[name="riskFactor"]:checked').forEach(cb => {
    score += parseInt(cb.dataset.score, 10);
  });
  const selectedFactors = Array.from(paduaForm.querySelectorAll('input[name="riskFactor"]:checked')).map(cb => cb.value);
  if (selectedFactors.length === 0) {
    resultArea.innerHTML = '';
    return;
  }
  const result = calculatePaduaScore(score);
  resultArea.innerHTML = result.html;
}
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
    if (!patientName || !patientIdentifier) {
        throw new Error('Patient Name and ID are required.');
    }
    if (isNaN(inputs.weight_kg) || isNaN(inputs.drugAmount_mg) || isNaN(inputs.solutionVolume_ml) || isNaN(inputs.drugDose)) {
        throw new Error('All calculation fields must be valid numbers.');
    }
    const result = calculateIVRate(inputs);
    resultArea.innerHTML = result.html;
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
function handleConverterInput() {
  const resultField = $('#converter-toValue');
  const fromUnit = $('#converter-fromUnit').value;
  const toUnitField = $('#converter-toUnit');
  if (fromUnit === 'lbs_kg') toUnitField.value = 'kg_lbs';
  if (fromUnit === 'kg_lbs') toUnitField.value = 'lbs_kg';
  const toUnit = toUnitField.value;
  try {
    const inputs = {
      value: parseFloat($('#converter-fromValue').value),
      fromUnit: fromUnit,
      toUnit: toUnit
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
// ...
// (Calculation logic functions: calculateInitialHeparinRate, etc... are UNCHANGED)
// ...
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
  const repeatPttMinutes = 1; // 1 Minute Notification Test
  const logData = {
    loading_dose: `${suggestedLoadingDoseUnits.toFixed(0)} units (${loadingDoseMl} mL)`,
    initial_rate: `${initialInfusionRateMl} mL/hour`,
    next_ptt: `in 6 hours (TEST: 1 min)`
  };
  const html = `
    <div class="result-box">
      <p class="result-title">Initial Dose Calculation</p>
      <p class="text-lg mt-2">Suggested Loading Dose: <span class="font-bold">${logData.loading_dose}</span></p>
      <p class="text-lg mt-2">Initial Infusion Rate: <span class="font-bold">${logData.initial_rate}</span></p>
      <p class="text-lg mt-2">Next PTT Check: <span class="font-bold">in 6 hours</span></p>
    </div>
    <div class="result-box-notification">
      <p class="font-bold">TEST: Notification scheduled in DB for ${patientName} in ${repeatPttMinutes} minute(s) for PTT check.</p>
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
  let repeatPttHours = 6;
  let boxClass = 'result-box';
  if (currentPtt < 40) {
    bolusDoseUnits = 25 * weight; newUnitsPerKgPerHour += 3; message = 'Very low PTT (<40).'; boxClass = 'error-box';
  } else if (currentPtt <= 49) {
    newUnitsPerKgPerHour += 2; message = 'Low PTT (40-49).'; boxClass = 'error-box';
  } else if (currentPtt <= 69) {
    newUnitsPerKgPerHour += 1; message = 'Relatively low PTT (50-69).'; boxClass = 'error-box';
  } else if (currentPtt <= 110) {
    message = 'PTT is within therapeutic range (70-110).';
  } else if (currentPtt <= 120) {
    newUnitsPerKgPerHour -= 1; message = 'Relatively high PTT (111-120).'; boxClass = 'error-box';
  } else if (currentPtt <= 130) {
    stopInfusionMin = 60; newUnitsPerKgPerHour -= 2; message = `High PTT (121-130). Stop infusion for ${stopInfusionMin} min.`; boxClass = 'error-box';
  } else if (currentPtt <= 140) {
    stopInfusionMin = 60; newUnitsPerKgPerHour -= 3; message = `Very high PTT (131-140). Stop infusion for ${stopInfusionMin} min.`; boxClass = 'error-box';
  } else if (currentPtt <= 150) {
    stopInfusionMin = 120; newUnitsPerKgPerHour -= 5; message = `Extremely high PTT (141-150). Stop infusion for ${stopInfusionMin} min.`; boxClass = 'error-box';
  } else if (currentPtt > 150) {
    stopInfusionMin = 180; newUnitsPerKgPerHour = 0; message = `Critically high PTT (>150). Stop infusion for ${stopInfusionMin} min.`; repeatPttHours = 0; boxClass = 'error-box';
  }
  if (newUnitsPerKgPerHour < 0) newUnitsPerKgPerHour = 0;
  const newUnitsPerHour = newUnitsPerKgPerHour * weight;
  const newRateMl = (newUnitsPerHour / heparinConcentration).toFixed(2);
  const bolusDoseMl = (bolusDoseUnits / heparinConcentration).toFixed(2);
  const repeatPttMinutes_TEST = 1;
  let nextPttText = `in ${repeatPttHours} hours`;
  if (repeatPttHours === 0) {
    nextPttText = `Per physician's instructions`;
  }
  const logData = {
    new_rate: `${newRateMl} mL/hour`,
    bolus_dose: bolusDoseUnits > 0 ? `${bolusDoseUnits.toFixed(0)} units (${bolusDoseMl} mL)` : 'N/A',
    stop_infusion_min: stopInfusionMin > 0 ? stopInfusionMin : 'N/A',
    next_ptt: `${nextPttText} (TEST: 1 min)`,
    message: message
  };
  let html = `<div class="${boxClass}"> <p class="result-title">Maintenance Dose Adjustment</p>`;
  if (logData.bolus_dose !== 'N/A') html += `<p class="text-lg mt-2">Suggested Bolus: <span class="font-bold">${logData.bolus_dose}</span></p>`;
  if (logData.stop_infusion_min !== 'N/A') html += `<p class="text-lg mt-2 font-bold text-red-700 dark:text-red-400">Stop Infusion: <span class="font-bold">${logData.stop_infusion_min} minutes</span></p>`;
  html += `<p class="text-lg mt-2">New Infusion Rate: <span class="font-bold">${logData.new_rate}</span></p>`;
  html += `<p class="text-lg mt-2">Next PTT Check: <span class="font-bold">${nextPttText}</span></p>`;
  html += `<p class="text-sm mt-3 opacity-80">${logData.message}</p></div>`;
  let notifications = {};
  if (stopInfusionMin > 0) {
    const stopDelay_TEST = 1;
    notifications.notification = {
      title: `Heparin Alert: ${patientName}`,
      body: `TEST: Time to RESTART infusion (Original stop: ${stopInfusionMin} min).`,
      delayInMinutes: stopDelay_TEST
    };
    html += `<div class="result-box-notification"><p class="font-bold">TEST: Notification scheduled in DB for ${patientName} in ${stopDelay_TEST} min to restart infusion.</p></div>`;
  }
  if (repeatPttHours > 0) {
    notifications.notification_ptt = {
      title: `Heparin Alert: ${patientName}`,
      body: `TEST: Time for scheduled PTT check (Original: ${nextPttText}).`,
      delayInMinutes: repeatPttMinutes_TEST
    };
    html += `<div class="result-box-notification"><p class="font-bold">TEST: Notification scheduled in DB for ${patientName} in ${repeatPttMinutes_TEST} min for PTT check.</p></div>`;
  }
  return { html: html, logData: logData, ...notifications };
}
function calculateStressUlcerProphylaxis(selectedFactors) {
  const highRiskFactors = [
    'Mechanical Ventilation with no enteral feeding (>48h)', 'Chronic Liver Disease', 'Concerning Coagulopathy',
    'Multiple Trauma, Brain Injury or Spinal Cord', 'Burns over 35% of total surface area', 'Organ Transplant',
    'History of Peptic Ulcer Disease', 'Dual Antiplatelet', 'Septic Shock'
  ];
  const moderateRiskFactors = [
    'Mechanical Ventilation with enteral nutrition', 'Single Antiplatelet Therapy', 'Oral Anticoagulation', 'SepsIS',
    'ICU stay > 7 days', 'Renal Replacement Therapy', 'High Dose Steroids or Immunosuppressant', 'Shock'
  ];
  const highRiskCount = selectedFactors.filter(factor => highRiskFactors.includes(factor)).length;
  const moderateRiskCount = selectedFactors.filter(factor => moderateRiskFactors.includes(factor)).length;
  let riskLevel = 'Low Risk';
  if (highRiskCount > 0) riskLevel = 'High Risk';
  else if (moderateRiskCount >= 2) riskLevel = 'Moderate Risk';
  const isIndicated = (riskLevel === 'High Risk' || riskLevel === 'Moderate Risk');
  const logData = { risk_level: riskLevel, is_indicated: isIndicated };
  let html = '';
  if (isIndicated) {
    html = `<div class="error-box"><p class="result-title">Risk Level: ${riskLevel}</p><p class="mt-1 font-bold">Patient is INDICATED for prophylaxis.</p></div>`;
  } else {
    html = `<div class="result-box"><p class="result-title">Risk Level: ${riskLevel}</p><p class="mt-1 font-bold">Patient is NOT INDICATED for prophylaxis.</p></div>`;
  }
  return { html, logData };
}
function calculatePaduaScore(score) {
  let riskLevel = 'Low Risk';
  if (score >= 4) riskLevel = 'High Risk';
  const isIndicated = (riskLevel === 'High Risk');
  const logData = { score: score, risk_level: riskLevel, is_indicated: isIndicated };
  let html = '';
  if (isIndicated) {
    html = `<div class="error-box"><p class="result-title">Score: ${score} (Risk Level: ${riskLevel})</p><p class="mt-1 font-bold">Patient is at HIGH RISK for VTE. Prophylaxis recommended.</p></div>`;
  } else {
    html = `<div class="result-box"><p class="result-title">Score: ${score} (Risk Level: ${riskLevel})</p><p class="mt-1 font-bold">Patient is at LOW RISK for VTE. Prophylaxis not required.</p></div>`;
  }
  return { html, logData };
}
function calculateIVRate(inputs) {
  const { weight_kg, drugAmount_mg, solutionVolume_ml, drugDose, doseUnit } = inputs;
  if (isNaN(weight_kg) || isNaN(drugAmount_mg) || isNaN(solutionVolume_ml) || isNaN(drugDose) || weight_kg <= 0 || drugAmount_mg <= 0 || solutionVolume_ml <= 0 || drugDose <= 0) {
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
  const logData = { rate_ml_hr: rate_ml_hr.toFixed(2) };
  const html = `
    <div class="result-box">
      <p class="text-lg text-center">Set Pump Rate to:</p>
      <p class="text-3xl font-bold text-center my-2">${logData.rate_ml_hr} mL/hr</p>
    </div>
  `;
  return { html, logData };
}
function calculateCrCl(inputs) {
  const { age, weight_kg, creatinine_mg_dl, gender } = inputs;
  let crcl = ((140 - age) * weight_kg) / (72 * creatinine_mg_dl);
  if (gender === 'female') crcl *= 0.85;
  const logData = { crcl_ml_min: crcl.toFixed(1) };
  const html = `
    <div class="result-box">
      <p class="text-lg text-center">Estimated Creatinine Clearance:</p>
      <p class="text-3xl font-bold text-center my-2">${logData.crcl_ml_min} mL/min</p>
      <p class="text-sm text-center mt-4 opacity-80">Note: Cockcroft-Gault. Always consult hospital protocols.</p>
    </div>
  `;
  return { html, logData };
}
function convertUnits(inputs) {
  const { value, fromUnit, toUnit } = inputs;
  const massConversions = { 'kg': 1000000000, 'g': 1000000, 'mg': 1000, 'mcg': 1 };
  const volumeConversions = { 'L': 1000, 'mL': 1 };
  const weightConversions = { 'lbs_kg': 0.453592, 'kg_lbs': 2.20462 };
  let result;
  if (fromUnit in massConversions && toUnit in massConversions) {
    const baseValue = value * massConversions[fromUnit];
    result = baseValue / massConversions[toUnit];
  } else if (fromUnit in volumeConversions && toUnit in volumeConversions) {
    const baseValue = value * volumeConversions[fromUnit];
    result = baseValue / volumeConversions[toUnit];
  } else if (fromUnit === 'lbs_kg' && toUnit === 'kg_lbs') {
    result = value * weightConversions['lbs_kg'];
  } else if (fromUnit === 'kg_lbs' && toUnit === 'lbs_kg') {
    result = value * weightConversions['kg_lbs'];
  } else {
    return 'N/A';
  }
  if (result < 0.0001 && result > 0) return result.toExponential(4);
  if (result.toString().split('.')[1]?.length > 4) return result.toFixed(4);
  return result.toString();
}

// --- (8) SUPABASE & NOTIFICATION FUNCTIONS ---
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
    if (error) throw error;
    console.log('Calculation saved:', data);
  } catch (error) {
    console.error('Error saving to Supabase:', error.message);
    const currentViewId = appState.currentView;
    const resultArea = $(`#${currentViewId} .result-box, #${currentViewId} .error-box`);
    if (resultArea && !resultArea.parentNode.querySelector('.save-error-box')) {
      const errorDiv = document.createElement('div');
      errorDiv.className = 'error-box save-error-box';
      errorDiv.style.marginTop = '1rem';
      errorDiv.innerHTML = `<p><strong>Save Error:</strong> Log was not saved. ${error.message}</p>`;
      resultArea.parentNode.insertBefore(errorDiv, resultArea.nextSibling);
    }
  }
}

// (formatLogData function is unchanged)
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
        Object.keys(inputs).forEach(key => { inputsHtml += `<li>${key.replace(/_/g, ' ')}: ${inputs[key]}</li>`; });
        Object.keys(result).forEach(key => { resultHtml += `<li>${key.replace(/_/g, ' ')}: ${result[key]}</li>`; });
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
// هذا هو الكود الوحيد الذي سيتم تشغيله عند بدء تشغيل الصفحة
document.addEventListener('DOMContentLoaded', () => {
  
  // --- (الخطوة 1) تعريف الـ Selectors ---
  // الآن نحن متأكدون 100% أن الـ DOM جاهز
  $ = (selector) => document.querySelector(selector);
  $$ = (selector) => document.querySelectorAll(selector);

  // --- (الخطوة 2) تهيئة Supabase بأمان ---
  try {
    // 'supabase' يأتي من ملف الـ CDN في index.html
    const { createClient } = supabase;
    db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log('Supabase client initialized.');
  } catch (e) {
    console.error("CRITICAL: Failed to initialize Supabase. Check CDN script.", e);
    // إذا فشل تحميل Supabase CDN، سيتوقف التطبيق هنا
    alert("Database connection failed. Please check your internet and refresh the app.");
    return; // إيقاف التنفيذ
  }
  
  // --- (الخطوة 3) تعيين قيم متغيرات عناصر الصفحة ---
  // تم نقل كل هذا الكود من أعلى الملف إلى هنا
  appHeader = $('.app-header');
  appTitle = $('#app-title');
  appContent = $('.app-content');
  headerBackButton = $('#header-back-button');
  allViews = $$('.view');
  allNavButtons = $$('.nav-button');
  passwordPrompt = $('#password-prompt');
  darkModeToggle = $('#dark-mode-toggle');
  heparinForm = $('#heparin-form');
  prophylaxisForm = $('#prophylaxis-form');
  paduaForm = $('#padua-form');
  ivForm = $('#iv-form');
  renalForm = $('#renal-form');
  converterForm = $('#converter-form');
  passwordForm = $('#password-form');
  historySearch = $('#history-search');

  // --- (الخطوة 4) تشغيل التطبيق (الكود الأصلي) ---
  // الآن هذا الكود سيعمل بأمان
  registerServiceWorker();
  initializeEventListeners(); // <-- هذا السطر هو مفتاح حل المشكلة
  initializeDarkMode();
  
  // (تم حذف استدعاء subscribeUserToPush() من هنا بشكل صحيح في ملفك)
  
  navigateTo('view-dashboard', 'CHG Toolkit');
  
  // تأكد من أن هذه العناصر موجودة قبل استدعاء الدوال
  if(converterForm) handleConverterInput();
  if(renalForm) handleRenalInput();
});
