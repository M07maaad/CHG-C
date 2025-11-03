// --- (1) CONSTANTS & CONFIGURATION ---

// Password for the history page
const HISTORY_PASSWORD = '12345'; // TODO: Change this password

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

// Function to format date (e.g., 11/02/2025, 11:15 PM)
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

  // Dashboard buttons (now uses data-nav attributes on the new cards)
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
    // Add submit listener for the "Save" button
    prophylaxisForm.addEventListener('submit', handleProphylaxisSubmit);
  }
  
  const paduaForm = $('#padua-form');
  if (paduaForm) {
    paduaForm.querySelectorAll('.risk-factor-card').forEach(card => {
      card.addEventListener('click', handlePaduaCheck);
    });
    // Add submit listener for the "Save" button
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
    <!-- ***FIX: Reverted to English*** -->
    <span>Back to Dashboard</span>
  </div>
`;

// Patient Info fields component (reusable)
const PatientInfoFields = (name = appState.currentPatientName, identifier = appState.currentPatientIdentifier) => `
  <div class="input-group">
    <!-- ***FIX: Reverted to English*** -->
    <label for="patientName">Patient Name:</label>
    <input type="text" id="patientName" name="patientName" value="${name}" required>
  </div>
  <div class="input-group">
    <!-- ***FIX: Reverted to English*** -->
    <label for="patientIdentifier">Patient ID / Room No.:</label>
    <input type="text" id="patientIdentifier" name="patientIdentifier" value="${identifier}" required>
  </div>
`;

// Inline SVG Icons
const Icons = {
  heparin: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0L12 2.69z"></path></svg>`,
  prophylaxis: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>`,
  padua: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle><polyline points="17 11 19 13 23 9"></polyline></svg>`,
  ivCalculator: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H7a2 2 0 0 0-2 2v5a2 2 0 0 1-2 2 2 2 0 0 1 2 2v5a2 2 0 0 0 2 2h1"></path><path d="M16 21h1a2 2 0 0 0 2-2v-5a2 2 0 0 1 2-2 2 2 0 0 1-2-2V5a2 2 0 0 0-2-2h-1"></path><path d="M12 18v-2"></path><path d="M12 8V6"></path><path d="M12 13V11"></path></svg>`,
  renalDosing: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a7 7 0 0 1 7 7c0 5-7 11-7 11s-7-6-7-11a7 7 0 0 1 7-7z"></path><circle cx="12" cy="10" r="3"></circle></svg>`,
  scores: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect><path d="M12 11h4"></path><path d="M12 16h4"></path><path d="M8 11h.01"></path><path d="M8 16h.01"></path></svg>`,
  converter: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 3h5v5"></path><path d="M4 20L21 3"></path><path d="M21 16v5h-5"></path><path d="M3 4l18 18"></path></svg>`,
  history: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 4v6h6"></path><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path></svg>`
};

// Renders the main Dashboard (with NEW Grid Layout)
function renderDashboard() {
  render(`
    <h1 class="text-center">CHG - Clinical Toolkit</h1>
    <p class="description text-center">Select a tool to get started.</p>
    
    <!-- ***FIX: NEW Professional Dashboard Grid*** -->
    <div class="dashboard-grid">
      <div class="tool-card" data-nav="heparin">
        ${Icons.heparin}
        <span>Heparin<br>Calculator</span>
      </div>
      <div class="tool-card" data-nav="prophylaxis">
        ${Icons.prophylaxis}
        <span>Stress Ulcer<br>Prophylaxis</span>
      </div>
      <div class="tool-card" data-nav="padua">
        ${Icons.padua}
        <span>Padua (VTE)<br>Score</span>
      </div>
      <div class="tool-card" data-nav="ivCalculator">
        ${Icons.ivCalculator}
        <span>IV Infusion<br>Calculator</span>
      </div>
      <div class="tool-card" data-nav="renalDosing">
        ${Icons.renalDosing}
        <span>Renal Dosing<br>(CrCl)</span>
      </div>
      <div class="tool-card" data-nav="scores">
        ${Icons.scores}
        <span>Other<br>Clinical Scores</span>
      </div>
      <div class="tool-card" data-nav="converter">
        ${Icons.converter}
        <span>Unit<br>Converter</span>
      </div>
      <div class="tool-card history-card" data-nav="history">
        ${Icons.history}
        <span>Calculation<br>History</span>
      </div>
    </div>
  `);
}

// Renders the History password prompt
function renderHistoryPasswordPrompt() {
  render(`
    ${BackButton()}
    <!-- ***FIX: Reverted to English*** -->
    <h1 class="text-center">Calculation History</h1>
    <p class="description text-center">Please enter the password to view the calculation logs.</p>
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
    <!-- ***FIX: Reverted to English*** -->
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
      $('#logs-container').innerHTML = '<p class="text-center">No logs found.</p>';
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
          Patient: ${log.patient_name || 'N/A'} (ID: ${log.patient_identifier || 'N/A'})
        </div>
        <div class="log-card-body">
          ${formatLogData(log)}
        </div>
      </div>
    `).join('');
    
    $('#logs-container').innerHTML = logsHtml;
    
  } catch (error) {
    console.error('Error fetching history:', error);
    $('#logs-container').innerHTML = `<div class="error-box"><p>Failed to load history. Please check connection.</p><p>${error.message}</p></div>`;
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
    <!-- ***FIX: Reverted to English*** -->
    <h1 class="text-center">Heparin Calculator</h1>
    
    <div class="mode-toggle-buttons">
      <button type="button" id="initialModeBtn" class="mode-btn active">Initial Dose</button>
      <button type="button" id="maintenanceModeBtn" class="mode-btn">Maintenance Dose</button>
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
            <option value="">Select...</option>
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

      <button type="submit" class="btn" id="calculateBtn">
        ${Icons.heparin}
        <span>Calculate</span>
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
    <!-- ***FIX: Reverted to English*** -->
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

      <!-- Save button -->
      <div class="mt-6">
        <button type="submit" class="btn" id="saveBtn">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
          <span>Save Result</span>
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
    <!-- ***FIX: Reverted to English*** -->
    <h1 class="text-center">Padua (VTE) Score</h1>
    <form id="padua-form" class="space-y-6">
      
      <!-- Patient Info -->
      ${PatientInfoFields()}
      
      <p class="font-bold text-lg mb-2">Select all applicable risk factors:</p>
      
      <div class="risk-factors-container">
        ${createChecklist(paduaFactors)}
      </div>
      
      <!-- Result area -->
      <div id="result-area" class="mt-4"></div>

      <!-- Save button -->
      <div class="mt-6">
        <button type="submit" class="btn" id="saveBtn">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
          <span>Save Score</span>
        </button>
      </div>
    </form>
  `);
}

// Renders the IV Infusion Calculator
function renderIVCalculator() {
  render(`
    ${BackButton()}
    <!-- ***FIX: Reverted to English*** -->
    <h1 class="text-center">IV Infusion Calculator</h1>
    <form id="iv-form" class="space-y-6">
      
      <!-- Patient Info -->
      ${PatientInfoFields()}
      
      <div class="input-group">
        <label for="weight">Patient Weight (kg):</label>
        <input type="number" id="weight" name="weight" step="0.1" required>
      </div>
      <div class="input-group">
        <label for="drugAmount">Total Drug Amount (mg):</label>
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
      
      <button type="submit" class="btn" id="calculateBtn">
        ${Icons.ivCalculator}
        <span>Calculate Rate</span>
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
    <!-- ***FIX: Reverted to English*** -->
    <h1 class="text-center">Renal Dosing (CrCl)</h1>
    <p class="description text-center">Cockcroft-Gault Creatinine Clearance.</p>
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
    <!-- ***FIX: Reverted to English*** -->
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
    <!-- ***FIX: Reverted to English*** -->
    <h1 class="text-center">Clinical Scores</h1>
    <p class="description text-center">More scoring tools will be added soon.</p>
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
    calculateBtn.innerHTML = `${Icons.heparin} <span>Calculating...</span>`;
  }
  resultArea.innerHTML = '';
  
  try {
    appState.currentPatientName = form.patientName.value;
    appState.currentPatientIdentifier = form.patientIdentifier.value;
    
    // ***FIX***: Check for active button *outside* the form
    const mode = document.querySelector('.mode-btn.active').id === 'initialModeBtn' ? 'initial' : 'maintenance';

    const formData = {
      patientName: appState.currentPatientName,
      patientIdentifier: appState.currentPatientIdentifier,
      weight: parseFloat(form.weight.value),
      heparinConcentration: parseFloat(form.heparinConcentration.value),
      mode: mode,
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
      calculateBtn.innerHTML = `${Icons.heparin} <span>Calculate</span>`;
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
    alert('Please select risk factors to calculate a result before saving.');
    return;
  }
  
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';
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
      if(saveBtn) saveBtn.textContent = 'Saved!';
      // Find the existing result box and append to it
      const existingResultBox = resultArea.querySelector('.result-box, .error-box');
      if (existingResultBox) {
        existingResultBox.innerHTML += `<p class="font-bold mt-4">Result saved successfully.</p>`;
      }
    } else {
      if(saveBtn) saveBtn.textContent = 'Save Failed';
    }
  } catch (error) {
    if(saveBtn) saveBtn.textContent = 'Save Failed';
    resultArea.innerHTML += `<div class="error-box mt-4"><p><strong>Save Error:</strong> ${error.message}</p></div>`;
  } finally {
    setTimeout(() => {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save Result';
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
    alert('Please select risk factors to calculate a score before saving.');
    return;
  }

  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';
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
      if(saveBtn) saveBtn.textContent = 'Saved!';
      const existingResultBox = resultArea.querySelector('.result-box, .error-box');
      if (existingResultBox) {
        existingResultBox.innerHTML += `<p class="font-bold mt-4">Score saved successfully.</p>`;
      }
    } else {
      if(saveBtn) saveBtn.textContent = 'Save Failed';
    }
  } catch (error) {
    if(saveBtn) saveBtn.textContent = 'Save Failed';
    resultArea.innerHTML += `<div class="error-box mt-4"><p><strong>Save Error:</strong> ${error.message}</p></div>`;
  } finally {
    setTimeout(() => {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save Score';
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
    calculateBtn.innerHTML = `${Icons.ivCalculator} <span>Calculating...</span>`;
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
      calculateBtn.innerHTML = `${Icons.ivCalculator} <span>Calculate Rate</span>`;
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
    resultArea.innerHTML = `<div class="error-box"><p>Calculation error: ${error.message}</p></div>`;
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
    resultArea.innerHTML = `<div class="error-box"><p>Incorrect password. Please try again.</p></div>`;
  }
}

// --- (7) CALCULATION LOGIC (Translated from code.gs) ---

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
      <p class="font-bold">Notification set for ${patientName} in ${repeatPttHours} hours for PTT check.</p>
    </div>
  `;

  return {
    html: html,
    logData: logData,
    notification_ptt: {
      title: `Heparin Alert: ${patientName}`,
      body: `Time for scheduled ${repeatPttHours}-hour PTT check.`,
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
    return { error: 'Please enter valid numerical values for all fields.' };
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
    next_ptt: repeatPttHours > 0 ? `in ${repeatPttHours} hours` : `Per physician's instructions`,
    message: message
  };

  let html = `<div class="${boxClass}">`;
  if (logData.bolus_dose !== 'N/A') {
    html += `<p class="text-lg">Suggested Bolus: <span class="font-bold">${logData.bolus_dose}</span></p>`;
  }
  if (logData.stop_infusion_min !== 'N/A') {
    html += `<p class="text-lg mt-2 text-red-700">Stop Infusion: <span class="font-bold">${logData.stop_infusion_min} minutes</span></p>`;
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
    html += `<div class="info-box"><p class="font-bold">Notification set for ${patientName} in ${stopInfusionMin} min to restart infusion.</p></div>`;
  }
  
  // Add PTT check notification
  if (repeatPttHours > 0) {
    notifications.notification_ptt = {
      title: `Heparin Alert: ${patientName}`,
      body: `Time for scheduled ${repeatPttHours}-hour PTT check.`,
      delayInMinutes: repeatPttHours * 60
    };
    html += `<div class="info-box"><p class="font-bold">Notification set for ${patientName} in ${repeatPttHours} hours for PTT check.</p></div>`;
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
        <p class="mt-1">Patient is INDICATED for prophylaxis.</p>
      </div>
    `;
  } else {
    html = `
      <div class="result-box">
        <p class="text-lg font-bold">Risk Level: ${riskLevel}</p>
        <p class="mt-1">Patient is NOT INDICATED for prophylaxis.</p>
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
        <p class="text-lg font-bold">Score: ${score} (Risk Level: ${riskLevel})</p>
        <p class="mt-1">Patient is at HIGH RISK for VTE. Prophylaxis recommended.</p>
      </div>
    `;
  } else {
    html = `
      <div class="result-box">
        <p class="text-lg font-bold">Score: ${score} (Risk Level: ${riskLevel})</p>
        <p class="mt-1">Patient is at LOW RISK for VTE. Prophylaxis not required.</p>
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
    return { error: 'Please enter valid, positive numerical values for all fields.' };
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
      return { error: 'Invalid dose unit selected.' };
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
 * ***NEW HELPER FUNCTION***
 * Formats the log data (inputs and results) into readable HTML.
 * @param {object} log - The log object from Supabase.
 * @returns {string} HTML string.
 */
function formatLogData(log) {
  let inputsHtml = '<strong>Inputs:</strong><ul style="list-style-type: disc; padding-left: 1.5rem; margin-top: 0.5rem;">';
  let resultHtml = '<strong>Result:</strong><ul style="list-style-type: disc; padding-left: 1.5rem; margin-top: 0.5rem;">';

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
        // Fallback for other tools (like renal dosing, if we save it)
        inputsHtml += `<li>${JSON.stringify(inputs)}</li>`;
        resultHtml += `<li>${JSON.stringify(result)}</li>`;
    }
  } catch (e) {
    // In case of any error during formatting, show the raw JSON
    console.error("Error formatting log:", e);
    inputsHtml = `<strong>Inputs:</strong><pre>${JSON.stringify(inputs, null, 2)}</pre>`;
    resultHtml = `<strong>Result:</strong><pre>${JSON.stringify(result, null, 2)}</pre>`;
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
      <p class="text-lg text-center">Estimated Creatinine Clearance:</p>
      <p class="text-3xl font-bold text-center my-2">${logData.crcl_ml_min} mL/min</p>
      <p class="text-sm text-center mt-4">Note: This is an estimate (Cockcroft-Gault). Always consult hospital protocols for dose adjustments.</p>
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
      errorDiv.innerHTML = `<p><strong>Save Error:</strong> Log was not saved. ${error.message}</p>`;
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
  // Logic is now passed to the Service Worker (sw.js)
  
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
    alert('Please enable notifications in your browser settings to receive alerts.');
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
  // Render the initial view
  navigateTo('dashboard');
});

