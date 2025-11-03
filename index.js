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
    <span>Back to Dashboard</span>
  </div>
`;

// Patient Info fields component (reusable)
const PatientInfoFields = (name = appState.currentPatientName, identifier = appState.currentPatientIdentifier) => `
  <div class="input-group">
    <label for="patientName">Patient Name:</label>
    <input type="text" id="patientName" name="patientName" value="${name}" required>
  </div>
  <div class="input-group">
    <label for="patientIdentifier">Patient ID / Room No.:</label>
    <input type="text" id="patientIdentifier" name="patientIdentifier" value="${identifier}" required>
  </div>
`;

// Renders the main Dashboard
function renderDashboard() {
  render(`
    <h1 class="text-center" style="font-size: 2.75rem;">CHG - Clinical Toolkit</h1>
    <p class="description text-center">Select a tool to proceed.</p>
    <div class="flex flex-col gap-4 mt-8">
      <button type="button" class="btn" data-nav="heparin">Heparin Calculator</button>
      <button type="button" class="btn" data-nav="prophylaxis">Stress Ulcer Prophylaxis</button>
      <button type="button" class="btn" data-nav="padua">Padua Score (VTE)</button>
      <button type="button" class="btn" data-nav="ivCalculator">IV Infusion Calculator</button>
      <button type="button" class="btn" data-nav="renalDosing">Renal Dosing (CrCl)</button>
      <button type="button" class="btn" data-nav="scores">Other Clinical Scores</button>
      <button type="button" class="btn" data-nav="converter">Unit Converter</button>
      <button type="button" class="btn" data-nav="history" style="background-image: linear-gradient(to right, #607d8b, #78909c);">View Calculation History</button>
    </div>
  `);
}

// Renders the History password prompt
function renderHistoryPasswordPrompt() {
  render(`
    ${BackButton()}
    <h1 class="text-center">View History</h1>
    <p class="description text-center">Please enter the password to view the calculation history.</p>
    <form id="history-password-form" class="space-y-6">
      <div class="input-group">
        <label for="historyPassword">Password:</label>
        <input type="password" id="historyPassword" name="historyPassword" required>
      </div>
      <button type="submit" class="btn">Unlock</button>
      <div id="history-result" class="mt-4"></div>
    </form>
  `);
}

// Renders the fetched logs (if password is correct)
async function renderHistoryLogs() {
  render(`
    ${BackButton()}
    <h1 class="text-center">Calculation History</h1>
    <p class="description text-center">Showing the last 50 calculations.</p>
    <div id="logs-container"><p class="text-center">Loading logs...</p></div>
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
      $('#logs-container').innerHTML = '<p class="text-center">No calculation logs found.</p>';
      return;
    }
    
    // Build HTML for each log card
    const logsHtml = logs.map(log => `
      <div class="log-card">
        <div class="log-card-header">
          <span class="log-card-title">${log.tool_name.replace('_', ' ')}</span>
          <span class="log-card-time">${formatDateTime(log.created_at)}</span>
        </div>
        <div class="log-card-patient">
          Patient: ${log.patient_name || 'N/A'} (ID: ${log.patient_identifier || 'N/A'})
        </div>
        <div class="log-card-body">
          <strong>Inputs:</strong>
          <pre>${JSON.stringify(log.inputs, null, 2)}</pre>
          <strong>Result:</strong>
          <pre>${JSON.stringify(log.result, null, 2)}</pre>
        </div>
      </div>
    `).join('');
    
    $('#logs-container').innerHTML = logsHtml;
    
  } catch (error) {
    console.error('Error fetching history:', error);
    $('#logs-container').innerHTML = `<div class="error-box"><p>Failed to load history. Please check the connection and try again.</p><p>${error.message}</p></div>`;
  } finally {
    appState.isLoading = false;
    // ***FIX***: Re-add event listeners *after* rendering the new view
    // This will make the "Back" button work on this async-loaded page.
    addEventListeners();
  }
}

// Renders the Heparin Calculator
function renderHeparinCalculator() {
  render(`
    ${BackButton()}
    <h1 class="text-center">Heparin Calculator</h1>
    
    <div class="mode-toggle-buttons">
      <button type="button" id="initialModeBtn" class="mode-btn active">Initial Heparin</button>
      <button type="button" id="maintenanceModeBtn" class="mode-btn">Maintenance Heparin</button>
    </div>
    
    <form id="heparin-form" class="space-y-6">
      
      <!-- Patient Info -->
      ${PatientInfoFields()}

      <!-- Common Fields -->
      <div class="input-group">
        <label for="weight">Patient Weight (kg):</label>
        <input type="number" id="weight" name="weight" step="0.1" required>
      </div>
      <div class="input-group">
        <label for="heparinConcentration">Heparin Concentration (units/mL):</label>
        <input type="number" id="heparinConcentration" name="heparinConcentration" value="100" step="0.1" required>
      </div>

      <!-- Initial-Only Fields -->
      <div id="initialFields" class="space-y-6">
        <div class="input-group">
          <label for="indication">Indication:</label>
          <select id="indication" name="indication" required>
            <option value="">Select Indication...</option>
            <option value="AF">AF (Atrial Fibrillation)</option>
            <option value="Venous thromboembolism">Venous Thromboembolism</option>
            <option value="Acute coronary syndrome">Acute Coronary Syndrome</option>
          </select>
        </div>
      </div>

      <!-- Maintenance-Only Fields -->
      <div id="maintenanceFields" class="space-y-6 hidden">
        <div class="input-group">
          <label for="currentInfusionRate">Current Infusion Rate (mL/hour):</label>
          <input type="number" id="currentInfusionRate" name="currentInfusionRate" step="0.1" required>
        </div>
        <div class="input-group">
          <label for="currentPtt">Current PTT Value (seconds):</label>
          <input type="number" id="currentPtt" name="currentPtt" step="0.1" required>
        </div>
      </div>

      <button type="submit" class="btn" id="calculateBtn">Calculate</button>
      
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
    <h1 class="text-center">Stress Ulcer Prophylaxis</h1>
    <form id="prophylaxis-form" class="space-y-6">
      
      <!-- Patient Info -->
      ${PatientInfoFields()}
      
      <p class="font-bold text-lg mb-2">Select all applicable risk factors:</p>
      
      <div class="risk-group-heading">High Risk Factors:</div>
      <div class="risk-factors-container">
        ${createChecklist(highRiskFactors)}
      </div>

      <div class="risk-group-heading">Moderate to Low Risk Factors:</div>
      <div class="risk-factors-container">
        ${createChecklist(moderateRiskFactors)}
      </div>
      
      <!-- Result area -->
      <div id="result-area" class="mt-4"></div>

      <!-- ***FIX***: Added a save button -->
      <div class="mt-6">
        <button type="submit" class="btn" id="saveBtn">Save Calculation</button>
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
    <h1 class="text-center">Padua Score (VTE)</h1>
    <form id="padua-form" class="space-y-6">
      
      <!-- Patient Info -->
      ${PatientInfoFields()}
      
      <p class="font-bold text-lg mb-2">Select all applicable risk factors:</p>
      
      <div class="risk-factors-container">
        ${createChecklist(paduaFactors)}
      </div>
      
      <!-- Result area -->
      <div id="result-area" class="mt-4"></div>

      <!-- ***FIX***: Added a save button -->
      <div class="mt-6">
        <button type="submit" class="btn" id="saveBtn">Save Calculation</button>
      </div>
    </form>
  `);
}

// Renders the IV Infusion Calculator
function renderIVCalculator() {
  render(`
    ${BackButton()}
    <h1 class="text-center">IV Infusion Calculator</h1>
    <form id="iv-form" class="space-y-6">
      
      <!-- Patient Info -->
      ${PatientInfoFields()}
      
      <div class="input-group">
        <label for="weight">Patient Weight (kg):</label>
        <input type="number" id="weight" name="weight" step="0.1" required>
      </div>
      <div class="input-group">
        <label for="drugAmount">Total Drug Amount in Solution (mg):</label>
        <input type="number" id="drugAmount" name="drugAmount" step="0.1" required>
      </div>
      <div class="input-group">
        <label for="solutionVolume">Total Solution Volume (mL):</label>
        <input type="number" id="solutionVolume" name="solutionVolume" value="250" step="1" required>
      </div>
      <div class="input-group">
        <label for="drugDose">Desired Dose:</label>
        <input type="number" id="drugDose" name="drugDose" step="0.01" required>
      </div>
      <div class="input-group">
        <label for="doseUnit">Dose Unit:</label>
        <select id="doseUnit" name="doseUnit" required>
          <option value="mcg/kg/min">mcg/kg/min</option>
          <option value="mcg/min">mcg/min</option>
          <option value="mg/hr">mg/hr</option>
        </select>
      </div>
      
      <button type="submit" class="btn">Calculate Rate</button>
      
      <!-- Result area -->
      <div id="result-area" class="mt-4"></div>
    </form>
  `);
}

// Renders the Renal Dosing (CrCl) Calculator
function renderRenalDosing() {
  render(`
    ${BackButton()}
    <h1 class="text-center">Renal Dosing (CrCl)</h1>
    <p class="description text-center">Calculates Creatinine Clearance using Cockcroft-Gault equation.</p>
    <form id="renal-form" class="space-y-6">
      
      <!-- Patient Info -->
      ${PatientInfoFields()}
      
      <div class="input-group">
        <label for="age">Age (years):</label>
        <input type="number" id="age" name="age">
      </div>
      <div class="input-group">
        <label for="weight">Weight (kg):</label>
        <input type="number" id="weight" name="weight">
      </div>
      <div class="input-group">
        <label for="creatinine">Serum Creatinine (mg/dL):</label>
        <input type="number" id="creatinine" name="creatinine" step="0.1">
      </div>
      <div class="input-group">
        <label for="gender">Gender:</label>
        <select id="gender" name="gender">
          <option value="male">Male</option>
          <option value="female">Female</option>
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
    <h1 class="text-center">Unit Converter</h1>
    <form id="converter-form" class="space-y-6">
      <div class="input-group">
        <label for="fromValue">From:</label>
        <input type="number" id="fromValue" name="fromValue" value="1">
        <select id="fromUnit" name="fromUnit" class="mt-2">
          <optgroup label="Mass">
            <option value="kg">kg</option><option value="g">g</option><option value="mg" selected>mg</option><option value="mcg">mcg</option>
          </optgroup>
          <optgroup label="Volume">
            <option value="L">L</option><option value="mL">mL</option>
          </optgroup>
          <optgroup label="Weight">
            <option value="lbs">lbs</option>
          </optgroup>
        </select>
      </div>
      <div class="input-group">
        <label for="toValue">To:</label>
        <input type="text" id="toValue" name="toValue" disabled class="bg-gray-200">
        <select id="toUnit" name="toUnit" class="mt-2">
          <optgroup label="Mass">
            <option value="kg">kg</option><option value="g">g</option><option value="mg">mg</option><option value="mcg" selected>mcg</option>
          </optgroup>
          <optgroup label="Volume">
            <option value="L">L</option><option value="mL">mL</option>
          </optgroup>
          <optgroup label="Weight">
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
    <h1 class="text-center">Clinical Scoring</h1>
    <p class="description text-center">More scoring systems will be added soon.</p>
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
  
  calculateBtn.disabled = true;
  calculateBtn.textContent = 'Calculating...';
  resultArea.innerHTML = '';
  
  // Store patient info in state
  appState.currentPatientName = form.patientName.value;
  appState.currentPatientIdentifier = form.patientIdentifier.value;
  
  const formData = {
    patientName: appState.currentPatientName,
    patientIdentifier: appState.currentPatientIdentifier,
    weight: parseFloat(form.weight.value),
    heparinConcentration: parseFloat(form.heparinConcentration.value),
    mode: form.querySelector('.mode-btn.active').id === 'initialModeBtn' ? 'initial' : 'maintenance',
    indication: form.indication.value,
    currentInfusionRate: parseFloat(form.currentInfusionRate.value),
    currentPtt: parseFloat(form.currentPtt.value),
  };
  
  try {
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
      // Save to Supabase
      await saveCalculation(
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
    calculateBtn.textContent = 'Calculate';
  }
}

// --- Prophylaxis ---
async function handleProphylaxisCheck(e) {
  // Toggle checked state for styling
  const card = e.currentTarget;
  const checkbox = card.querySelector('input[type="checkbox"]');
  checkbox.checked = !checkbox.checked;
  card.classList.toggle('checked', checkbox.checked);
  
  // Get all selected factors
  const form = $('#prophylaxis-form');
  const selectedFactors = Array.from(form.querySelectorAll('input[name="riskFactor"]:checked')).map(cb => cb.value);
  
  const resultArea = $('#result-area');
  
  if (selectedFactors.length === 0) {
    resultArea.innerHTML = '';
    return;
  }
  
  const result = calculateStressUlcerProphylaxis(selectedFactors);
  
  // Display result
  resultArea.innerHTML = result.html;
  
  // --- ***FIX***: REMOVED auto-save from here ---
  // The save logic is moved to handleProphylaxisSubmit
}

// ***NEW FUNCTION***: Handles the "Save" button submit for Prophylaxis
async function handleProphylaxisSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const resultArea = $('#result-area');
  const saveBtn = $('#saveBtn');
  
  // Check if there is a result to save
  const resultHtml = resultArea.innerHTML;
  if (!resultHtml || resultHtml === '') {
    alert('Please select risk factors to calculate before saving.');
    return;
  }
  
  saveBtn.disabled = true;
  saveBtn.textContent = 'Saving...';
  
  // Get data to save
  const selectedFactors = Array.from(form.querySelectorAll('input[name="riskFactor"]:checked')).map(cb => cb.value);
  const result = calculateStressUlcerProphylaxis(selectedFactors); // Recalculate to get clean log data
  
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
    saveBtn.textContent = 'Saved!';
    resultArea.innerHTML += `<div class="result-box mt-4"><p class="font-bold">Calculation saved successfully.</p></div>`;
  } else {
    saveBtn.textContent = 'Save Failed';
    // The saveCalculation function already prepends an error box
  }
  
  setTimeout(() => {
    saveBtn.disabled = false;
    saveBtn.textContent = 'Save Calculation';
  }, 2000);
}


// --- Padua Score ---
async function handlePaduaCheck(e) {
  const card = e.currentTarget;
  const checkbox = card.querySelector('input[type="checkbox"]');
  checkbox.checked = !checkbox.checked;
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
  
  // --- ***FIX***: REMOVED auto-save from here ---
}

// ***NEW FUNCTION***: Handles the "Save" button submit for Padua
async function handlePaduaSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const resultArea = $('#result-area');
  const saveBtn = $('#saveBtn');

  // Check if there is a result to save
  const resultHtml = resultArea.innerHTML;
  if (!resultHtml || resultHtml === '') {
    alert('Please select risk factors to calculate before saving.');
    return;
  }

  saveBtn.disabled = true;
  saveBtn.textContent = 'Saving...';

  // Get data to save
  let score = 0;
  const selectedFactors = [];
  form.querySelectorAll('input[name="riskFactor"]:checked').forEach(cb => {
    score += parseInt(cb.dataset.score, 10);
    selectedFactors.push(cb.value);
  });
  const result = calculatePaduaScore(score); // Recalculate to get clean log data

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
    saveBtn.textContent = 'Saved!';
    resultArea.innerHTML += `<div class="result-box mt-4"><p class="font-bold">Calculation saved successfully.</p></div>`;
  } else {
    saveBtn.textContent = 'Save Failed';
  }

  setTimeout(() => {
    saveBtn.disabled = false;
    saveBtn.textContent = 'Save Calculation';
  }, 2000);
}


// --- IV Calculator ---
async function handleIVSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const resultArea = $('#result-area');
  resultArea.innerHTML = '';
  
  appState.currentPatientName = form.patientName.value;
  appState.currentPatientIdentifier = form.patientIdentifier.value;
  
  const inputs = {
    weight_kg: parseFloat(form.weight.value),
    drugAmount_mg: parseFloat(form.drugAmount.value),
    solutionVolume_ml: parseFloat(form.solutionVolume.value),
    drugDose: parseFloat(form.drugDose.value),
    doseUnit: form.doseUnit.value
  };
  
  try {
    const result = calculateIVRate(inputs);
    resultArea.innerHTML = result.html;
    
    // Save to Supabase
    await saveCalculation(
      'iv_calculator',
      appState.currentPatientName,
      appState.currentPatientIdentifier,
      inputs,
      result.logData
    );
    
  } catch (error) {
    resultArea.innerHTML = `<div class="error-box"><p>${error.message}</p></div>`;
  }
}

// --- Renal Dosing (Live) ---
function handleRenalDosingInput() {
  const form = $('#renal-form');
  const resultArea = $('#result-area');
  
  const inputs = {
    age: parseFloat(form.age.value),
    weight_kg: parseFloat(form.weight.value),
    creatinine_mg_dl: parseFloat(form.creatinine.value),
    gender: form.gender.value
  };
  
  // Only calculate if all fields are valid
  if (inputs.age > 0 && inputs.weight_kg > 0 && inputs.creatinine_mg_dl > 0) {
    const result = calculateCrCl(inputs);
    resultArea.innerHTML = result.html;
    
    // Save to Supabase (we can save live, or add a save button)
    // For now, let's not auto-save this one to avoid spamming.
    // We can add a "Save" button if needed.
  } else {
    resultArea.innerHTML = '';
  }
}

// --- Unit Converter (Live) ---
function handleConverterInput() {
  const form = $('#converter-form');
  const resultField = $('#toValue');
  
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
}

// --- History Password ---
function handleHistoryPasswordSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const password = form.historyPassword.value;
  const resultArea = $('#history-result');
  
  if (password === HISTORY_PASSWORD) {
    // Password is correct, fetch and render logs
    renderHistoryLogs();
    // ***FIX***: No need to call addEventListeners() here,
    // it's now called *inside* renderHistoryLogs()
  } else {
    resultArea.innerHTML = `<div class="error-box"><p>Invalid password. Try again.</p></div>`;
  }
}

// --- (7) CALCULATION LOGIC (Translated from code.gs) ---

/**
 * Translated from code.gs: calculateInitialHeparinRate
 */
function calculateInitialHeparinRate(formData) {
  const { weight, heparinConcentration, indication, patientName } = formData;

  if (isNaN(weight) || isNaN(heparinConcentration) || weight <= 0 || heparinConcentration <= 0 || !indication) {
    return { error: 'Please enter valid numeric values for all fields and select an indication.' };
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
      <p class="text-lg">Suggested Loading Dose: <span class="font-bold">${logData.loading_dose}</span></p>
      <p class="text-lg mt-2">Initial Infusion Rate: <span class="font-bold">${logData.initial_rate}</span></p>
      <p class="text-lg mt-2">Next PTT Check: <span class="font-bold">${logData.next_ptt}</span></p>
    </div>
    <div class="info-box">
      <p class="font-bold">Notification set for ${patientName} in ${repeatPttHours} hours to check PTT.</p>
    </div>
  `;

  return {
    html: html,
    logData: logData,
    notification_ptt: {
      title: `Heparin Alert: ${patientName}`,
      body: `Time for next PTT check (scheduled in ${repeatPttHours} hours).`,
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
    return { error: 'Please enter valid numeric values for all fields.' };
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
    message = 'Very low PTT (<40). Give bolus and increase infusion rate.';
    boxClass = 'error-box';
  } else if (currentPtt >= 40 && currentPtt <= 49) {
    newUnitsPerKgPerHour += 2;
    message = 'Low PTT (40-49). Increase infusion rate.';
    boxClass = 'info-box';
  } else if (currentPtt >= 50 && currentPtt <= 69) {
    newUnitsPerKgPerHour += 1;
    message = 'Relatively low PTT (50-69). Increase infusion rate.';
    boxClass = 'info-box';
  } else if (currentPtt >= 70 && currentPtt <= 110) {
    newUnitsPerKgPerHour = currentUnitsPerKgPerHour;
    message = 'PTT is within therapeutic range (70-110). No change in rate.';
    // boxClass remains 'result-box' (green)
  } else if (currentPtt >= 111 && currentPtt <= 120) {
    newUnitsPerKgPerHour -= 1;
    message = 'Relatively high PTT (111-120). Decrease infusion rate.';
    boxClass = 'info-box';
  } else if (currentPtt >= 121 && currentPtt <= 130) {
    stopInfusionMin = 60;
    newUnitsPerKgPerHour -= 2;
    message = `High PTT (121-130). Stop infusion for ${stopInfusionMin} min then decrease.`;
    boxClass = 'error-box';
  } else if (currentPtt >= 131 && currentPtt <= 140) {
    stopInfusionMin = 60;
    newUnitsPerKgPerHour -= 3;
    message = `Very high PTT (131-140). Stop infusion for ${stopInfusionMin} min then decrease.`;
    boxClass = 'error-box';
  } else if (currentPtt >= 141 && currentPtt <= 150) {
    stopInfusionMin = 120;
    newUnitsPerKgPerHour -= 5;
    message = `Extremely high PTT (141-150). Stop infusion for ${stopInfusionMin} min then decrease.`;
    boxClass = 'error-box';
  } else if (currentPtt > 150) {
    stopInfusionMin = 180;
    newUnitsPerKgPerHour = 0;
    message = `Critically high PTT (>150). Stop infusion for ${stopInfusionMin} min. Contact physician.`;
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
    next_ptt: repeatPttHours > 0 ? `in ${repeatPttHours} hours` : `According to physician's instructions`,
    message: message
  };

  let html = `<div class="${boxClass}">`;
  if (logData.bolus_dose !== 'N/A') {
    html += `<p class="text-lg">Bolus Dose: <span class="font-bold">${logData.bolus_dose}</span></p>`;
  }
  if (logData.stop_infusion_min !== 'N/A') {
    html += `<p class="text-lg mt-2 text-red-700">Stop Infusion For: <span class="font-bold">${logData.stop_infusion_min} minutes</span></p>`;
  }
  html += `<p class="text-lg mt-2">New Infusion Rate: <span class="font-bold">${logData.new_rate}</span></p>`;
  html += `<p class="text-lg mt-2">Next PTT Check: <span class="font-bold">${logData.next_ptt}</span></p>`;
  html += `<p class="text-sm mt-3">${logData.message}</p>`;
  html += `</div>`;
  
  let notifications = {};
  
  // Add stop infusion notification
  if (stopInfusionMin > 0) {
    notifications.notification = {
      title: `Heparin Alert: ${patientName}`,
      body: `Time to RESTART infusion (stopped for ${stopInfusionMin} min).`,
      delayInMinutes: stopInfusionMin
    };
    html += `<div class="info-box"><p class="font-bold">Notification set for ${patientName} in ${stopInfusionMin} minutes to restart infusion.</p></div>`;
  }
  
  // Add PTT check notification
  if (repeatPttHours > 0) {
    notifications.notification_ptt = {
      title: `Heparin Alert: ${patientName}`,
      body: `Time for next PTT check (scheduled in ${repeatPttHours} hours).`,
      delayInMinutes: repeatPttHours * 60
    };
    html += `<div class="info-box"><p class="font-bold">Notification set for ${patientName} in ${repeatPttHours} hours to check PTT.</p></div>`;
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
        <p class="text-lg font-bold">Risk Level: ${riskLevel}</p>
        <p class="mt-1">Patient is INDICATED and requires prophylaxis.</p>
      </div>
    `;
  } else {
    html = `
      <div class="result-box">
        <p class="text-lg font-bold">Risk Level: ${riskLevel}</p>
        <p class="mt-1">Patient is NOT indicated for prophylaxis.</p>
      </div>
    `;
  }
  
  return { html, logData };
}

/**
 * New logic for Padua Score
 */
function calculatePaduaScore(score) {
  const isHighRisk = score >= 4;
  const logData = {
    score: score,
    risk_level: isHighRisk ? 'High Risk' : 'Low Risk'
  };
  
  let html = '';
  if (isHighRisk) {
    html = `
      <div class="error-box">
        <p class="text-lg font-bold">Total Score: ${score}</p>
        <p class="mt-1">High Risk for VTE. Pharmacological prophylaxis recommended.</p>
      </div>
    `;
  } else {
    html = `
      <div class="result-box">
        <p class="text-lg font-bold">Total Score: ${score}</p>
        <p class="mt-1">Low Risk for VTE. Prophylaxis not required.</p>
      </div>
    `;
  }
  
  return { html, logData };
}

/**
 * New logic for IV Calculator
 */
function calculateIVRate(inputs) {
  const { weight_kg, drugAmount_mg, solutionVolume_ml, drugDose, doseUnit } = inputs;

  if (!weight_kg || !drugAmount_mg || !solutionVolume_ml || !drugDose) {
    throw new Error('Please fill all fields.');
  }

  const concentrationMgMl = drugAmount_mg / solutionVolume_ml;
  const concentrationMcgMl = concentrationMgMl * 1000;
  
  let rateMlHr;

  if (doseUnit === 'mcg/kg/min') {
    rateMlHr = (drugDose * weight_kg * 60) / concentrationMcgMl;
  } else if (doseUnit === 'mg/hr') {
    rateMlHr = drugDose / concentrationMgMl;
  } else { // mcg/min
    rateMlHr = (drugDose * 60) / concentrationMcgMl;
  }
  
  if (isNaN(rateMlHr) || !isFinite(rateMlHr)) {
    throw new Error('Calculation error. Check for division by zero (e.g., concentration).');
  }
  
  const logData = {
    rate_ml_hr: rateMlHr.toFixed(2)
  };
  
  const html = `
    <div class="result-box">
      <p class="text-lg text-center">Set Infusion Pump to:</p>
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
      <p class="text-sm text-center mt-4">Note: Cockcroft-Gault estimation. Always consult hospital-specific protocols for dose adjustments.</p>
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
  return result.toFixed(4);
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
      errorDiv.innerHTML = `<p><strong>Save Error:</strong> Could not save log to database. ${error.message}</p>`;
      // Prepend error to result area so calculation is still visible
      resultArea.prepend(errorDiv);
    }
    return false;
  }
}

/**
 * Requests permission to show notifications.
 */
function requestNotificationPermission() {
  if (!('Notification' in window)) {
    console.log('This browser does not support notifications.');
    return;
  }
  
  if (Notification.permission !== 'denied') {
    Notification.requestPermission().then(permission => {
      if (permission === 'granted') {
        console.log('Notification permission granted.');
      }
    });
  }
}

/**
 * Schedules a local notification.
 * @param {string} title - The title of the notification.
 * @param {string} body - The body text of the notification.
 * @param {number} delayInMinutes - The delay in minutes.
 */
function scheduleNotification(title, body, delayInMinutes) {
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    console.warn(`Cannot schedule notification (permission ${Notification.permission}). Title: ${title}`);
    return;
  }
  
  if (delayInMinutes <= 0) return;
  
  const delayInMs = delayInMinutes * 60 * 1000;
  
  console.log(`Scheduling notification: "${title}" in ${delayInMinutes} minutes.`);
  
  setTimeout(() => {
    // We need to re-check permission in case user revokes it
    if (Notification.permission === 'granted') {
      const notification = new Notification(title, {
        body: body,
        icon: 'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEgGVNd8uPcpbKOagpnwi5e8ai6v82sMiSRdWD0ZEgqIayvesaHtPrec7QGQSx-TXtbWb9D5SdZrcXuHCIAvPbHRGqUQV7MKxR_VyjvTs37suGOlDaqS1RuVuN2EsMNm50GDCG_N-ugnwwutUb9OfyJbkGz9k06YvTi0ynwW9jJaBNhIsEkPJ5NOzExt3xzN/s192/10cb804e-ab18-4d8a-8ce0-600bbe8ab10d.png'
      });
      console.log('Notification triggered:', notification);
    }
  }, delayInMs);
}


// --- (9) INITIALIZATION ---

// Initial load
document.addEventListener('DOMContentLoaded', () => {
  // Request notification permission on first load
  requestNotificationPermission();
  
  // Render the initial view
  navigateTo('dashboard');
});

