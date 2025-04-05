/* 
  Beispiel: Vollständiger Code für app.js, um Supabase komplett auf Nhost umzustellen.
  Statt "supabase.createClient(...)" wird der offizielle Nhost-Client (@nhost/nhost-js) verwendet.
  Alle Supabase-spezifischen Stellen (RPC, from('...'), etc.) wurden entfernt oder durch GraphQL ersetzt.
  Die Struktur (Events, DOM-Manipulation, Variablen, etc.) bleibt weitgehend gleich.
*/

import { NhostClient } from '@nhost/nhost-js'

// Nhost-Einstellungen:
const NHOST_SUBDOMAIN = "IHRE_NHOST_SUBDOMAIN"  // z.B. "abcd1234"
const NHOST_REGION = "eu-central-1"            // oder andere Region laut Nhost-Dashboard

// GraphQL-Queries/Mutations für die Tabelle "wbs_data" in Nhost:
const LOAD_TEACHER_DATA = `
  query LoadTeacherData($teacher_code: String!) {
    wbs_data(where: {teacher_code: {_eq: $teacher_code}}) {
      id
      teacher_code
      teacher_name
      data
    }
  }
`;

const UPSERT_TEACHER_DATA = `
  mutation UpsertTeacherData(
    $teacher_code: String!
    $teacher_name: String!
    $data: jsonb!
  ) {
    insert_wbs_data(
      objects: {
        teacher_code: $teacher_code
        teacher_name: $teacher_name
        data: $data
      }
      on_conflict: {
        constraint: wbs_data_teacher_code_key
        update_columns: [data, teacher_name, updated_at]
      }
    ) {
      affected_rows
    }
  }
`;

// Neue Bewertungskategorien
const ASSESSMENT_CATEGORIES = [
  { id: "presentation", name: "Präsentation" },
  { id: "content", name: "Inhalt" },
  { id: "language", name: "Sprache" },
  { id: "impression", name: "Eindruck" },
  { id: "examination", name: "Prüfung" },
  { id: "reflection", name: "Reflexion" },
  { id: "expertise", name: "Fachwissen" },
  { id: "documentation", name: "Dokumentation" }
];

// Globale Variablen
let nhost = null;
let currentUser = null;
let teacherData = {
  students: [],
  assessments: {}
};
let selectedStudent = null;
let studentToDelete = null;
let selectedGradeStudent = null;
let infoTextSaveTimer = null;

// Aktuelles Datum (lokale Zeit in Deutschland)
const today = new Date();
const defaultDate = 
  today.getFullYear() + '-' + 
  String(today.getMonth() + 1).padStart(2, '0') + '-' + 
  String(today.getDate()).padStart(2, '0');

// Dom-Elemente
const mainLoader = document.getElementById("mainLoader");
const loginSection = document.getElementById("loginSection");
const appSection = document.getElementById("appSection");
const teacherGrid = document.getElementById("teacherGrid");
const teacherAvatar = document.getElementById("teacherAvatar");
const teacherName = document.getElementById("teacherName");
const passwordModal = document.getElementById("passwordModal");
const passwordInput = document.getElementById("passwordInput");
const loginPrompt = document.getElementById("loginPrompt");
const confirmLogin = document.getElementById("confirmLogin");
const cancelLogin = document.getElementById("cancelLogin");
const closePasswordModal = document.getElementById("closePasswordModal");
const logoutBtn = document.getElementById("logoutBtn");

const newStudentName = document.getElementById("newStudentName");
const examDate = document.getElementById("examDate");
const addStudentBtn = document.getElementById("addStudentBtn");
const studentsTable = document.getElementById("studentsTable");

const assessmentDateSelect = document.getElementById("assessmentDateSelect");
const assessmentStudentList = document.getElementById("assessmentStudentList");
const assessmentContent = document.getElementById("assessmentContent");

const overviewYearSelect = document.getElementById("overviewYearSelect");
const overviewDateSelect = document.getElementById("overviewDateSelect");
const overviewTable = document.getElementById("overviewTable");

const settingsYearSelect = document.getElementById("settingsYearSelect");
const settingsDateSelect = document.getElementById("settingsDateSelect");
const exportDataBtn = document.getElementById("exportDataBtn");
const deleteVerificationCode = document.getElementById("deleteVerificationCode");
const deleteDataBtn = document.getElementById("deleteDataBtn");

const editStudentModal = document.getElementById("editStudentModal");
const closeEditStudentModal = document.getElementById("closeEditStudentModal");
const editStudentName = document.getElementById("editStudentName");
const editExamDate = document.getElementById("editExamDate");
const saveStudentBtn = document.getElementById("saveStudentBtn");
const deleteStudentBtn = document.getElementById("deleteStudentBtn");

const editGradeModal = document.getElementById("editGradeModal");
const closeEditGradeModal = document.getElementById("closeEditGradeModal");
const editFinalGrade = document.getElementById("editFinalGrade");
const saveGradeBtn = document.getElementById("saveGradeBtn");

const confirmDeleteModal = document.getElementById("confirmDeleteModal");
const closeConfirmDeleteModal = document.getElementById("closeConfirmDeleteModal");
const deleteStudentName = document.getElementById("deleteStudentName");
const cancelDeleteBtn = document.getElementById("cancelDeleteBtn");
const confirmDeleteBtn = document.getElementById("confirmDeleteBtn");

const tabs = document.querySelectorAll(".tab");
const tabContents = document.querySelectorAll(".tab-content");

// Default-Lehrer, analog zum bisherigen System
const DEFAULT_TEACHERS = [
  { name: "Kretz", code: "KRE", password: "Luna" },
  { name: "Riffel", code: "RIF", password: "Luna" },
  { name: "Töllner", code: "TOE", password: "Luna" }
];

// Event-Listener, sobald DOM geladen ist
document.addEventListener("DOMContentLoaded", function() {
  console.log("WBS Bewertungssystem (Nhost-Version) wird initialisiert...");
  init();
});

/**
 * Initialisiert die Anwendung
 */
async function init() {
  // Nhost-Client erstellen
  nhost = new NhostClient({
    subdomain: NHOST_SUBDOMAIN,
    region: NHOST_REGION
  });

  if (examDate) {
    examDate.value = defaultDate;
  }

  showLoader();
  await initDatabase();
  initTeacherGrid();
  setupEventListeners();
  hideLoader();
}

/**
 * Zeigt eine Benachrichtigung an
 */
function showNotification(message, type = "success") {
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.textContent = message;
  document.body.appendChild(notification);
  setTimeout(() => {
    notification.remove();
  }, 3000);
}

/**
 * Zeigt den Ladebildschirm an
 */
function showLoader() {
  if (mainLoader) {
    mainLoader.style.display = "flex";
  }
}

/**
 * Versteckt den Ladebildschirm
 */
function hideLoader() {
  if (mainLoader) {
    mainLoader.style.display = "none";
  }
}

/**
 * Formatiert ein ISO-Datumstring in deutsches Format
 */
function formatDate(isoDateString) {
  if (!isoDateString) return '';
  const date = new Date(isoDateString + "T00:00:00");
  if(isNaN(date.getTime())) return isoDateString;
  return date.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

/**
 * Extrahiert das Jahr aus einem ISO-Datumstring
 */
function getYearFromDate(isoDateString) {
  return isoDateString.split('-')[0];
}

/**
 * Gibt die verfügbaren Jahre zurück
 */
function getAvailableYears() {
  const years = new Set();
  const currentYear = new Date().getFullYear();
  
  // Jahre vom aktuellen Jahr bis 10 Jahre in die Zukunft
  for (let i = 0; i <= 10; i++) {
    years.add((currentYear + i).toString());
  }
  
  // Jahre aus den Schülerdaten hinzufügen
  teacherData.students.forEach(student => {
    years.add(getYearFromDate(student.examDate));
  });
  
  // Absteigend sortieren
  return Array.from(years).sort((a, b) => a - b).reverse();
}

/**
 * Gibt die verfügbaren Termine zurück
 */
function getAvailableDates(year = null) {
  const dates = new Set();
  teacherData.students.forEach(student => {
    if (!year || getYearFromDate(student.examDate) === year) {
      dates.add(student.examDate);
    }
  });
  return Array.from(dates).sort().reverse();
}

/**
 * Generiert eine eindeutige ID
 */
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

/**
 * Prüft, ob bereits ein Student an einem Prüfungstag existiert
 */
function isStudentOnExamDay(studentId, examDate) {
  return teacherData.students.some(
    s => s.id !== studentId && s.examDate === examDate
  );
}

/**
 * Nhost-Datenbank vorbereiten
 */
async function initDatabase() {
  try {
    console.log("Nhost-Verbindung – keine automatische Tabellenerstellung. Bitte sicherstellen, dass 'wbs_data' existiert.");
    return true;
  } catch (error) {
    console.error("Fehler bei der Nhost-Initialisierung:", error);
    return false;
  }
}

/**
 * Führt eine Migration der alten Bewertungskategorien auf die neuen durch
 */
function migrateAssessmentCategories() {
  const categoryMapping = {
    'organization': 'presentation',
    'workBehavior': 'content',
    'teamwork': 'language',
    'quality': 'impression',
    'reflection': 'reflection', 
    'documentation': 'documentation'
  };
  for (const studentId in teacherData.assessments) {
    const assessment = teacherData.assessments[studentId];
    for (const oldCategory in categoryMapping) {
      if (assessment.hasOwnProperty(oldCategory)) {
        const newCategory = categoryMapping[oldCategory];
        assessment[newCategory] = assessment[oldCategory];
        if (oldCategory !== newCategory) {
          delete assessment[oldCategory];
        }
      }
    }
    ASSESSMENT_CATEGORIES.forEach(category => {
      if (!assessment.hasOwnProperty(category.id)) {
        assessment[category.id] = 2;
      }
    });
    if (!assessment.hasOwnProperty('infoText')) {
      assessment['infoText'] = '';
    }
  }
}

/**
 * Lädt die Daten des aktuellen Lehrers via GraphQL
 */
async function loadTeacherData() {
  if (!currentUser) return false;
  try {
    const { data, error } = await nhost.graphql.request(LOAD_TEACHER_DATA, {
      teacher_code: currentUser.code
    });
    
    if (error) {
      console.error("Fehler beim Laden der Lehrerdaten:", error);
      showNotification("Fehler beim Laden der Daten.", "error");
      return false;
    }
    if (data && data.wbs_data && data.wbs_data.length > 0) {
      teacherData = data.wbs_data[0].data;
      migrateAssessmentCategories();
      return true;
    } else {
      teacherData = {
        students: [],
        assessments: {}
      };
      return await saveTeacherData();
    }
  } catch (err) {
    console.error("Fehler in loadTeacherData:", err);
    showNotification("Fehler beim Laden der Daten.", "error");
    return false;
  }
}

/**
 * Speichert die Daten des aktuellen Lehrers via GraphQL
 */
async function saveTeacherData() {
  if (!currentUser) return false;
  try {
    const { error } = await nhost.graphql.request(UPSERT_TEACHER_DATA, {
      teacher_code: currentUser.code,
      teacher_name: currentUser.name,
      data: teacherData
    });
    if (error) {
      console.error("Fehler beim Speichern der Daten:", error);
      showNotification("Fehler beim Speichern der Daten.", "error");
      return false;
    }
    return true;
  } catch (err) {
    console.error("Fehler in saveTeacherData:", err);
    showNotification("Fehler beim Speichern der Daten.", "error");
    return false;
  }
}

/**
 * Initialisiert das Lehrer-Grid im Login-Bereich
 */
function initTeacherGrid() {
  if (!teacherGrid) return;
  teacherGrid.innerHTML = "";
  DEFAULT_TEACHERS.forEach(teacher => {
    const card = document.createElement("div");
    card.className = "teacher-card";
    card.dataset.code = teacher.code;
    card.dataset.name = teacher.name;
    card.innerHTML = `
      <img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23e0e0e0'/%3E%3Ctext x='50' y='60' font-family='Arial' font-size='30' text-anchor='middle' fill='%23666'%3E${teacher.code.charAt(0)}%3C/text%3E%3C/svg%3E" alt="${teacher.name}">
      <h3>${teacher.name}</h3>
    `;
    card.addEventListener("click", () => {
      showPasswordModal(teacher);
    });
    teacherGrid.appendChild(card);
  });
}

/**
 * Richtet alle Event-Listener ein
 */
function setupEventListeners() {
  // Login
  if (closePasswordModal) {
    closePasswordModal.addEventListener("click", () => {
      passwordModal.style.display = "none";
    });
  }
  if (cancelLogin) {
    cancelLogin.addEventListener("click", () => {
      passwordModal.style.display = "none";
    });
  }
  if (confirmLogin) {
    confirmLogin.addEventListener("click", login);
  }
  if (passwordInput) {
    passwordInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") login();
    });
  }
  if (logoutBtn) {
    logoutBtn.addEventListener("click", logout);
  }
  
  // Tabs
  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      const tabId = tab.dataset.tab;
      tabs.forEach(t => t.classList.remove("active"));
      tabContents.forEach(c => c.classList.remove("active"));
      tab.classList.add("active");
      document.getElementById(`${tabId}-tab`).classList.add("active");
      switch(tabId) {
        case 'students':
          updateStudentsTab();
          break;
        case 'assessment':
          updateAssessmentTab();
          break;
        case 'overview':
          updateOverviewTab();
          break;
        case 'settings':
          updateSettingsTab();
          break;
      }
    });
  });
  
  // Schüler
  if (addStudentBtn) {
    addStudentBtn.addEventListener("click", addNewStudent);
  }
  
  // Bewertung
  if (assessmentDateSelect) {
    assessmentDateSelect.addEventListener("change", updateAssessmentStudentList);
  }
  
  // Übersicht
  if (overviewYearSelect) {
    overviewYearSelect.addEventListener("change", () => {
      populateOverviewDateSelect();
      updateOverviewContent();
    });
  }
  if (overviewDateSelect) {
    overviewDateSelect.addEventListener("change", updateOverviewContent);
  }
  
  // Einstellungen
  if (settingsYearSelect) {
    settingsYearSelect.addEventListener("change", () => {
      populateSettingsDateSelect();
    });
  }
  if (exportDataBtn) {
    exportDataBtn.addEventListener("click", exportData);
  }
  if (deleteDataBtn) {
    deleteDataBtn.addEventListener("click", confirmDeleteAllData);
  }
  
  // Modals
  if (closeEditStudentModal) {
    closeEditStudentModal.addEventListener("click", () => {
      editStudentModal.style.display = "none";
    });
  }
  if (saveStudentBtn) {
    saveStudentBtn.addEventListener("click", saveEditedStudent);
  }
  if (deleteStudentBtn) {
    deleteStudentBtn.addEventListener("click", showDeleteConfirmation);
  }
  if (closeEditGradeModal) {
    closeEditGradeModal.addEventListener("click", () => {
      editGradeModal.style.display = "none";
    });
  }
  if (saveGradeBtn) {
    saveGradeBtn.addEventListener("click", saveEditedGrade);
  }
  if (closeConfirmDeleteModal) {
    closeConfirmDeleteModal.addEventListener("click", () => {
      confirmDeleteModal.style.display = "none";
    });
  }
  if (cancelDeleteBtn) {
    cancelDeleteBtn.addEventListener("click", () => {
      confirmDeleteModal.style.display = "none";
    });
  }
  if (confirmDeleteBtn) {
    confirmDeleteBtn.addEventListener("click", deleteStudent);
  }
}

/**
 * Zeigt den Passwort-Dialog
 */
function showPasswordModal(teacher) {
  loginPrompt.textContent = `Bitte geben Sie das Passwort für ${teacher.name} ein:`;
  passwordInput.value = "";
  passwordModal.style.display = "flex";
  passwordInput.focus();
  currentUser = {
    name: teacher.name,
    code: teacher.code,
    password: teacher.password
  };
}

/**
 * Login-Prozess
 */
async function login() {
  if (passwordInput.value === currentUser.password) {
    passwordModal.style.display = "none";
    showLoader();
    await loadTeacherData();
    loginSection.style.display = "none";
    appSection.style.display = "block";
    teacherAvatar.textContent = currentUser.code.charAt(0);
    teacherName.textContent = currentUser.name;
    updateStudentsTab();
    hideLoader();
    showNotification(`Willkommen, ${currentUser.name}!`);
  } else {
    showNotification("Falsches Passwort!", "error");
  }
}

/**
 * Logout
 */
function logout() {
  if (infoTextSaveTimer) {
    clearInterval(infoTextSaveTimer);
    infoTextSaveTimer = null;
  }
  currentUser = null;
  teacherData = {
    students: [],
    assessments: {}
  };
  loginSection.style.display = "block";
  appSection.style.display = "none";
  showNotification("Abgemeldet.");
}

/**
 * Berechnet die Durchschnittsnote
 */
function calculateAverageGrade(assessment) {
  if (!assessment) return null;
  let sum = 0;
  let count = 0;
  ASSESSMENT_CATEGORIES.forEach(category => {
    if (assessment[category.id] && assessment[category.id] > 0) {
      sum += assessment[category.id];
      count++;
    }
  });
  if (count === 0) return null;
  return (sum / count).toFixed(1);
}

/**
 * Aktualisiert den "Schüler anlegen"-Tab
 */
function updateStudentsTab() {
  if (!studentsTable) return;
  const tbody = studentsTable.querySelector('tbody');
  tbody.innerHTML = '';
  if (teacherData.students.length === 0) {
    const tr = document.createElement('tr');
    tr.innerHTML = '<td colspan="3">Keine Prüflinge vorhanden</td>';
    tbody.appendChild(tr);
    return;
  }
  const sortedStudents = [...teacherData.students].sort((a, b) => {
    return new Date(b.examDate) - new Date(a.examDate);
  });
  sortedStudents.forEach(student => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${student.name}</td>
      <td>${formatDate(student.examDate)}</td>
      <td>
        <button class="edit-btn" data-id="${student.id}">✏️</button>
      </td>
    `;
    tr.querySelector('.edit-btn').addEventListener('click', () => {
      showEditStudentModal(student);
    });
    tbody.appendChild(tr);
  });
}

/**
 * Legt einen neuen Prüfling an
 */
async function addNewStudent() {
  const name = newStudentName.value.trim();
  const date = examDate.value;
  if (!name) {
    showNotification("Bitte einen Namen eingeben.", "warning");
    return;
  }
  const existingStudent = teacherData.students.find(s => 
    s.name.toLowerCase() === name.toLowerCase() && s.examDate === date
  );
  if (existingStudent) {
    showNotification(`Ein Prüfling namens "${name}" existiert bereits für dieses Datum.`, "warning");
    return;
  }
  if (isStudentOnExamDay(null, date)) {
    if (!confirm(`Es existiert bereits ein Prüfling am ${formatDate(date)}. Trotzdem fortfahren?`)) {
      return;
    }
  }
  const newStudent = {
    id: generateId(),
    name: name,
    examDate: date,
    createdAt: new Date().toISOString()
  };
  showLoader();
  teacherData.students.push(newStudent);
  teacherData.assessments[newStudent.id] = {};
  
  // Standardwerte für Kategorien
  ASSESSMENT_CATEGORIES.forEach(category => {
    teacherData.assessments[newStudent.id][category.id] = 2;
  });
  teacherData.assessments[newStudent.id].infoText = '';
  teacherData.assessments[newStudent.id].finalGrade = 2.0;
  
  const saved = await saveTeacherData();
  if (saved) {
    newStudentName.value = "";
    examDate.value = defaultDate;
    updateStudentsTab();
    populateAssessmentDateSelect();
    showNotification(`Prüfling "${name}" wurde hinzugefügt.`);
  }
  hideLoader();
}

/**
 * Zeigt das Modal zum Bearbeiten eines Prüflings
 */
function showEditStudentModal(student) {
  editStudentName.value = student.name;
  editExamDate.value = student.examDate;
  selectedStudent = student;
  editStudentModal.style.display = "flex";
}

/**
 * Speichert Änderungen an einem Prüfling
 */
async function saveEditedStudent() {
  const name = editStudentName.value.trim();
  const date = editExamDate.value;
  if (!name) {
    showNotification("Bitte einen Namen eingeben.", "warning");
    return;
  }
  const existingStudent = teacherData.students.find(s => 
    s.id !== selectedStudent.id && 
    s.name.toLowerCase() === name.toLowerCase() && 
    s.examDate === date
  );
  if (existingStudent) {
    showNotification(`Ein Prüfling namens "${name}" existiert bereits für dieses Datum.`, "warning");
    return;
  }
  if (date !== selectedStudent.examDate && isStudentOnExamDay(selectedStudent.id, date)) {
    if (!confirm(`Es existiert bereits ein Prüfling am ${formatDate(date)}. Trotzdem fortfahren?`)) {
      return;
    }
  }
  showLoader();
  const index = teacherData.students.findIndex(s => s.id === selectedStudent.id);
  if (index !== -1) {
    teacherData.students[index].name = name;
    teacherData.students[index].examDate = date;
    const saved = await saveTeacherData();
    if (saved) {
      updateStudentsTab();
      populateAssessmentDateSelect();
      showNotification(`Prüfling "${name}" wurde aktualisiert.`);
    }
  }
  hideLoader();
  editStudentModal.style.display = "none";
}

/**
 * Zeigt die Bestätigung zum Löschen eines Prüflings
 */
function showDeleteConfirmation() {
  studentToDelete = selectedStudent;
  deleteStudentName.textContent = selectedStudent.name;
  editStudentModal.style.display = "none";
  confirmDeleteModal.style.display = "flex";
}

/**
 * Löscht einen Prüfling
 */
async function deleteStudent() {
  if (!studentToDelete) return;
  showLoader();
  teacherData.students = teacherData.students.filter(s => s.id !== studentToDelete.id);
  delete teacherData.assessments[studentToDelete.id];
  const saved = await saveTeacherData();
  if (saved) {
    updateStudentsTab();
    populateAssessmentDateSelect();
    updateOverviewTab();
    showNotification(`Prüfling "${studentToDelete.name}" wurde gelöscht.`);
  }
  hideLoader();
  confirmDeleteModal.style.display = "none";
  studentToDelete = null;
}

/**
 * Bewertungs-Tab aktualisieren
 */
function updateAssessmentTab() {
  populateAssessmentDateSelect();
  updateAssessmentStudentList();
}

/**
 * Datum-Dropdown im Bewertungs-Tab füllen
 */
function populateAssessmentDateSelect() {
  if (!assessmentDateSelect) return;
  const dates = getAvailableDates();
  assessmentDateSelect.innerHTML = '<option value="">Bitte wählen...</option>';
  dates.forEach(date => {
    const option = document.createElement('option');
    option.value = date;
    option.textContent = formatDate(date);
    assessmentDateSelect.appendChild(option);
  });
}

/**
 * Schülerliste im Bewertungs-Tab aktualisieren
 */
function updateAssessmentStudentList() {
  if (!assessmentStudentList || !assessmentContent) return;
  const selectedDate = assessmentDateSelect.value;
  assessmentStudentList.innerHTML = '';
  if (!selectedDate) {
    assessmentStudentList.innerHTML = '<li>Bitte wählen Sie ein Datum</li>';
    assessmentContent.innerHTML = `
      <div class="welcome-card">
        <h2>Willkommen bei der WBS Bewertungsapp</h2>
        <p>Bitte einen Prüfungstag und Prüfling auswählen oder einen neuen Prüfling anlegen.</p>
      </div>
    `;
    return;
  }
  const studentsForDate = teacherData.students.filter(s => s.examDate === selectedDate);
  if (studentsForDate.length === 0) {
    assessmentStudentList.innerHTML = '<li>Keine Prüflinge für dieses Datum</li>';
    return;
  }
  studentsForDate.forEach(student => {
    const li = document.createElement('li');
    li.className = 'student-item';
    li.dataset.id = student.id;
    const assessment = teacherData.assessments[student.id] || {};
    const finalGrade = assessment.finalGrade || '-';
    li.innerHTML = `
      <div class="student-name">${student.name}</div>
      <div class="average-grade grade-${Math.round(finalGrade)}">${finalGrade}</div>
    `;
    li.addEventListener('click', () => {
      document.querySelectorAll('.student-item').forEach(item => {
        item.classList.remove('active');
      });
      li.classList.add('active');
      showAssessmentForm(student);
    });
    assessmentStudentList.appendChild(li);
  });
}

/**
 * Timer für automatisches Speichern des Infotextes
 */
function setupInfoTextAutoSave(studentId) {
  if (infoTextSaveTimer) {
    clearInterval(infoTextSaveTimer);
  }
  infoTextSaveTimer = setInterval(async () => {
    const infoTextArea = document.getElementById("studentInfoText");
    if (infoTextArea && infoTextArea.dataset.changed === "true") {
      const infoText = infoTextArea.value;
      if (teacherData.assessments[studentId]) {
        teacherData.assessments[studentId].infoText = infoText;
        await saveTeacherData();
        infoTextArea.dataset.changed = "false";
        showNotification("Informationstext wurde automatisch gespeichert.", "success");
        infoTextArea.classList.add('save-flash');
        setTimeout(() => {
          infoTextArea.classList.remove('save-flash');
        }, 1000);
      }
    }
  }, 60000);
}

/**
 * Bewertungsformular für einen Prüfling anzeigen
 */
function showAssessmentForm(student) {
  selectedStudent = student;
  const assessment = teacherData.assessments[student.id] || {};
  const avgGrade = calculateAverageGrade(assessment);
  const finalGrade = assessment.finalGrade || avgGrade || '-';
  const infoText = assessment.infoText || '';
  
  let html = `
    <div class="assessment-container">
      <div class="student-header">
        <h2>${student.name}</h2>
        <p>Prüfungsdatum: ${formatDate(student.examDate)}</p>
      </div>
      
      <div class="info-text-container">
        <h3>Informationen zum Prüfling</h3>
        <textarea id="studentInfoText" rows="6" placeholder="Notizen...">${infoText}</textarea>
      </div>
      
      <div class="final-grade-display">Ø ${avgGrade || '0.0'}</div>
      
      <div class="final-grade-input">
        <label for="finalGrade">Endnote:</label>
        <input type="number" id="finalGrade" min="1" max="6" step="0.1" value="${finalGrade !== '-' ? finalGrade : ''}">
        <button id="saveFinalGradeBtn">Speichern</button>
        <button id="useAverageBtn">Durchschnitt übernehmen</button>
      </div>
  `;
  
  ASSESSMENT_CATEGORIES.forEach(category => {
    const grade = assessment[category.id] || 0;
    html += `
      <div class="assessment-category">
        <div class="category-header">
          <h3>${category.name}</h3>
        </div>
        <div class="category-grade">${grade || '-'}</div>
        <div class="grade-buttons" data-category="${category.id}">
    `;
    for (let i = 0; i <= 6; i++) {
      const isSelected = grade === i;
      html += `
        <button class="grade-button grade-${i} ${isSelected ? 'selected' : ''}" data-grade="${i}">${i}</button>
      `;
    }
    html += `
        </div>
      </div>
    `;
  });
  html += `</div>`;
  assessmentContent.innerHTML = html;
  
  document.querySelectorAll(".grade-buttons .grade-button").forEach(btn => {
    btn.addEventListener("click", async () => {
      const category = btn.parentElement.dataset.category;
      const grade = parseInt(btn.dataset.grade);
      const buttons = btn.parentElement.querySelectorAll("button");
      buttons.forEach(b => b.classList.remove("selected"));
      btn.classList.add("selected");
      btn.parentElement.previousElementSibling.textContent = grade || '-';
      if (!teacherData.assessments[student.id]) {
        teacherData.assessments[student.id] = {};
      }
      teacherData.assessments[student.id][category] = grade;
      const newAvg = calculateAverageGrade(teacherData.assessments[student.id]);
      document.querySelector(".final-grade-display").textContent = `Ø ${newAvg || '0.0'}`;
      if (!teacherData.assessments[student.id].finalGrade) {
        teacherData.assessments[student.id].finalGrade = parseFloat(newAvg);
        const fgInput = document.getElementById("finalGrade");
        if (fgInput) fgInput.value = newAvg;
      }
      await saveTeacherData();
      updateAssessmentStudentList();
    });
  });
  
  const saveFinalGradeBtn = document.getElementById("saveFinalGradeBtn");
  if (saveFinalGradeBtn) {
    saveFinalGradeBtn.addEventListener("click", async () => {
      const finalGradeInput = document.getElementById("finalGrade");
      const finalGradeValue = parseFloat(finalGradeInput.value);
      if (isNaN(finalGradeValue) || finalGradeValue < 1 || finalGradeValue > 6) {
        showNotification("Bitte eine gültige Note (1-6) eingeben.", "warning");
        return;
      }
      teacherData.assessments[student.id].finalGrade = finalGradeValue;
      await saveTeacherData();
      updateAssessmentStudentList();
      showNotification("Endnote wurde gespeichert.");
    });
  }
  
  const useAverageBtn = document.getElementById("useAverageBtn");
  if (useAverageBtn) {
    useAverageBtn.addEventListener("click", async () => {
      const avgGrade = calculateAverageGrade(teacherData.assessments[student.id]);
      if (!avgGrade) {
        showNotification("Es gibt noch keinen Durchschnitt.", "warning");
        return;
      }
      document.getElementById("finalGrade").value = avgGrade;
      teacherData.assessments[student.id].finalGrade = parseFloat(avgGrade);
      await saveTeacherData();
      updateAssessmentStudentList();
      showNotification("Durchschnitt als Endnote übernommen.");
    });
  }
  
  const infoTextArea = document.getElementById("studentInfoText");
  if (infoTextArea) {
    infoTextArea.dataset.changed = "false";
    infoTextArea.addEventListener("input", () => {
      infoTextArea.dataset.changed = "true";
    });
    infoTextArea.addEventListener("blur", async () => {
      if (infoTextArea.dataset.changed === "true") {
        teacherData.assessments[student.id].infoText = infoTextArea.value;
        await saveTeacherData();
        infoTextArea.dataset.changed = "false";
        showNotification("Informationstext gespeichert.");
      }
    });
    setupInfoTextAutoSave(student.id);
  }
}

/**
 * Zeigt das Modal zum Bearbeiten einer Endnote
 */
function showEditGradeModal(student) {
  selectedGradeStudent = student;
  const assessment = teacherData.assessments[student.id] || {};
  const finalGrade = assessment.finalGrade || calculateAverageGrade(assessment) || '';
  editFinalGrade.value = finalGrade;
  editGradeModal.style.display = "flex";
}

/**
 * Speichert eine bearbeitete Note
 */
async function saveEditedGrade() {
  const finalGradeValue = parseFloat(editFinalGrade.value);
  if (isNaN(finalGradeValue) || finalGradeValue < 1 || finalGradeValue > 6) {
    showNotification("Bitte eine gültige Note (1-6) eingeben.", "warning");
    return;
  }
  showLoader();
  if (!teacherData.assessments[selectedGradeStudent.id]) {
    teacherData.assessments[selectedGradeStudent.id] = {};
    ASSESSMENT_CATEGORIES.forEach(category => {
      teacherData.assessments[selectedGradeStudent.id][category.id] = 2;
    });
  }
  teacherData.assessments[selectedGradeStudent.id].finalGrade = finalGradeValue;
  const saved = await saveTeacherData();
  if (saved) {
    updateOverviewContent();
    updateAssessmentStudentList();
    showNotification(`Endnote für "${selectedGradeStudent.name}" wurde aktualisiert.`);
  }
  hideLoader();
  editGradeModal.style.display = "none";
  selectedGradeStudent = null;
}

/**
 * Übersicht-Tab aktualisieren
 */
function updateOverviewTab() {
  populateOverviewYearSelect();
  populateOverviewDateSelect();
  updateOverviewContent();
}

/**
 * Jahr-Dropdown in Übersicht befüllen
 */
function populateOverviewYearSelect() {
  if (!overviewYearSelect) return;
  const years = getAvailableYears();
  overviewYearSelect.innerHTML = '<option value="">Alle Jahre</option>';
  years.forEach(year => {
    const option = document.createElement('option');
    option.value = year;
    option.textContent = year;
    overviewYearSelect.appendChild(option);
  });
}

/**
 * Datum-Dropdown in Übersicht befüllen
 */
function populateOverviewDateSelect() {
  if (!overviewDateSelect) return;
  const selectedYear = overviewYearSelect.value;
  const dates = getAvailableDates(selectedYear);
  overviewDateSelect.innerHTML = '<option value="">Alle Tage</option>';
  dates.forEach(date => {
    const option = document.createElement('option');
    option.value = date;
    option.textContent = formatDate(date);
    overviewDateSelect.appendChild(option);
  });
}

/**
 * Übersichts-Inhalt aktualisieren
 */
function updateOverviewContent() {
  if (!overviewTable) return;
  const selectedYear = overviewYearSelect.value;
  const selectedDate = overviewDateSelect.value;
  const tbody = overviewTable.querySelector('tbody');
  tbody.innerHTML = '';
  
  let filteredStudents = [...teacherData.students];
  if (selectedYear) {
    filteredStudents = filteredStudents.filter(s => getYearFromDate(s.examDate) === selectedYear);
  }
  if (selectedDate) {
    filteredStudents = filteredStudents.filter(s => s.examDate === selectedDate);
  }
  filteredStudents.sort((a, b) => new Date(b.examDate) - new Date(a.examDate));
  
  if (filteredStudents.length === 0) {
    const tr = document.createElement('tr');
    tr.innerHTML = '<td colspan="12">Keine Prüflinge gefunden</td>';
    tbody.appendChild(tr);
    return;
  }
  
  filteredStudents.forEach(student => {
    const assessment = teacherData.assessments[student.id] || {};
    const avgGrade = calculateAverageGrade(assessment);
    const finalGrade = assessment.finalGrade || avgGrade || '-';
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${student.name}</td>
      <td>${formatDate(student.examDate)}</td>
      <td>${assessment.presentation || '-'}</td>
      <td>${assessment.content || '-'}</td>
      <td>${assessment.language || '-'}</td>
      <td>${assessment.impression || '-'}</td>
      <td>${assessment.examination || '-'}</td>
      <td>${assessment.reflection || '-'}</td>
      <td>${assessment.expertise || '-'}</td>
      <td>${assessment.documentation || '-'}</td>
      <td>${finalGrade}</td>
      <td>
        <button class="edit-btn" data-id="${student.id}">✏️</button>
      </td>
    `;
    tr.querySelector('.edit-btn').addEventListener('click', () => {
      showEditGradeModal(student);
    });
    tbody.appendChild(tr);
  });
}

/**
 * Einstellungen-Tab aktualisieren
 */
function updateSettingsTab() {
  populateSettingsYearSelect();
}

/**
 * Jahr-Dropdown in Einstellungen befüllen
 */
function populateSettingsYearSelect() {
  if (!settingsYearSelect) return;
  const years = getAvailableYears();
  settingsYearSelect.innerHTML = '<option value="">Alle Jahre</option>';
  years.forEach(year => {
    const option = document.createElement('option');
    option.value = year;
    option.textContent = year;
    settingsYearSelect.appendChild(option);
  });
}

/**
 * Datum-Dropdown in Einstellungen befüllen
 */
function populateSettingsDateSelect() {
  if (!settingsDateSelect) return;
  const selectedYear = settingsYearSelect.value;
  const dates = getAvailableDates(selectedYear);
  settingsDateSelect.innerHTML = '<option value="">Alle Tage</option>';
  dates.forEach(date => {
    const option = document.createElement('option');
    option.value = date;
    option.textContent = formatDate(date);
    settingsDateSelect.appendChild(option);
  });
}

/**
 * Bestätigen, alle Daten zu löschen
 */
function confirmDeleteAllData() {
  const code = deleteVerificationCode.value.trim();
  if (!code || code !== currentUser.code) {
    showNotification("Falsches oder kein Lehrerkürzel.", "warning");
    return;
  }
  if (!confirm("Wirklich ALLE Daten löschen?")) {
    return;
  }
  deleteAllData();
}

/**
 * Alle Daten löschen
 */
async function deleteAllData() {
  showLoader();
  teacherData = {
    students: [],
    assessments: {}
  };
  const saved = await saveTeacherData();
  if (saved) {
    updateStudentsTab();
    updateAssessmentTab();
    updateOverviewTab();
    showNotification("Alle Daten wurden gelöscht.");
  }
  hideLoader();
}

/**
 * Daten exportieren (TXT oder JSON)
 */
function exportData() {
  const selectedYear = settingsYearSelect.value;
  const selectedDate = settingsDateSelect.value;
  let filteredStudents = [...teacherData.students];

  if (selectedYear) {
    filteredStudents = filteredStudents.filter(s => getYearFromDate(s.examDate) === selectedYear);
  }
  if (selectedDate) {
    filteredStudents = filteredStudents.filter(s => s.examDate === selectedDate);
  }

  const exportTXT = document.getElementById("exportTXT");
  const exportJSON = document.getElementById("exportJSON");

  if (exportJSON && exportJSON.checked) {
    exportToJSON(filteredStudents, selectedYear, selectedDate);
  } else {
    exportToTXT(filteredStudents, selectedYear, selectedDate);
  }
}

function exportToJSON(filteredStudents, selectedYear, selectedDate) {
  try {
    const exportObject = {
      teacher: {
        name: currentUser.name,
        code: currentUser.code
      },
      filters: {
        year: selectedYear || "Alle", 
        date: selectedDate ? formatDate(selectedDate) : "Alle"
      },
      exportDate: new Date().toLocaleDateString('de-DE'),
      students: filteredStudents.map(s => {
        const a = teacherData.assessments[s.id] || {};
        return {
          id: s.id,
          name: s.name,
          examDate: formatDate(s.examDate),
          createdAt: s.createdAt,
          infoText: a.infoText || "",
          finalGrade: a.finalGrade || calculateAverageGrade(a) || "",
          presentation: a.presentation || 0,
          content: a.content || 0,
          language: a.language || 0,
          impression: a.impression || 0,
          examination: a.examination || 0,
          reflection: a.reflection || 0,
          expertise: a.expertise || 0,
          documentation: a.documentation || 0
        };
      })
    };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportObject, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `wbs_export_${new Date().getTime()}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  } catch (e) {
    showNotification("Fehler beim JSON-Export.", "error");
  }
}

function exportToTXT(filteredStudents, selectedYear, selectedDate) {
  try {
    let lines = [];
    lines.push(`Lehrer: ${currentUser.name} (${currentUser.code})`);
    lines.push(`Exportdatum: ${new Date().toLocaleDateString('de-DE')}`);
    lines.push(`Filter: Jahr=${selectedYear || "Alle"}, Tag=${selectedDate ? formatDate(selectedDate) : "Alle"}`);
    lines.push("--------------------------------------------");
    
    filteredStudents.forEach(s => {
      const a = teacherData.assessments[s.id] || {};
      const avg = calculateAverageGrade(a);
      const finalGrade = a.finalGrade || avg || '-';
      lines.push(`Prüfling: ${s.name}`);
      lines.push(`Datum: ${formatDate(s.examDate)}`);
      lines.push(`Endnote: ${finalGrade}`);
      lines.push(`Info: ${a.infoText || ""}`);
      lines.push("Bewertungen:");
      ASSESSMENT_CATEGORIES.forEach(cat => {
        lines.push(`  - ${cat.name}: ${a[cat.id] || 0}`);
      });
      lines.push("--------------------------------------------");
    });
    
    const dataStr = "data:text/plain;charset=utf-8," + encodeURIComponent(lines.join("\n"));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `wbs_export_${new Date().getTime()}.txt`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  } catch (e) {
    showNotification("Fehler beim TXT-Export.", "error");
  }
}
