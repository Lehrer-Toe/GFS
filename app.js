// Bewertungskategorien
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
let nhostClient = null;
let currentUser = null;
let teacherData = {
  students: [],
  assessments: {}
};
let selectedStudent = null;
let studentToDelete = null;
let selectedGradeStudent = null;
let infoTextSaveTimer = null;

// Standarddatum heute
const today = new Date();
const defaultDate = today.getFullYear() + '-' +
                    String(today.getMonth() + 1).padStart(2, '0') + '-' +
                    String(today.getDate()).padStart(2, '0');

// Nhost-Konfiguration (bitte ggf. anpassen!)
const NHOST_SUBDOMAIN = "meeeuwopykbtjzdlfmjg";  // dein Subdomain
const NHOST_REGION = "eu-central-1";            // deine Region

// Standard-Lehrer
const DEFAULT_TEACHERS = [
  { name: "Kretz", code: "KRE", password: "Luna" },
  { name: "Riffel", code: "RIF", password: "Luna" },
  { name: "Töllner", code: "TOE", password: "Luna" }
];

// DOM-Elemente
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
const deleteDataBtn = document.getElementById("deleteDataBtn");
const deleteVerificationCode = document.getElementById("deleteVerificationCode");

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

// App initialisieren
document.addEventListener("DOMContentLoaded", function() {
  console.log("WBS Bewertungssystem wird initialisiert...");
  init();
});

/** 
 * Initialisierung 
 */
async function init() {
  // Standardwert für das Datumsfeld
  if (examDate) {
    examDate.value = defaultDate;
  }

  // Nhost initialisieren
  // Achtung: Muss mit der importierten UMD-Version klappen, => window.Nhost
  if (!window.Nhost) {
    console.error("Nhost ist nicht verfügbar. Möglicherweise ist das CDN blockiert.");
    alert("Nhost-Bibliothek konnte nicht geladen werden. Bitte CDN-Verbindung prüfen!");
    return;
  }

  // Client erstellen
  nhostClient = new window.Nhost.NhostClient({
    subdomain: NHOST_SUBDOMAIN,
    region: NHOST_REGION
  });
  console.log("Nhost-Client erfolgreich initialisiert:", nhostClient);

  // Testabfrage zur Tabelle
  try {
    showLoader();
    const { data, error } = await nhostClient.graphql.request({
      query: `
        query CheckTable {
          wbs_data_aggregate {
            aggregate {
              count
            }
          }
        }
      `
    });
    if (error) {
      console.error("Fehler beim Überprüfen der Tabelle:", error);
      alert("Tabelle 'wbs_data' nicht gefunden oder Zugriff verweigert. Bitte SQL-Skript ausführen!");
    } else {
      console.log("Tabelle 'wbs_data' existiert, Count =", data.wbs_data_aggregate.aggregate.count);
    }
  } catch (err) {
    console.error("GraphQL-Fehler:", err);
    alert("Fehler beim Zugriff auf die wbs_data-Tabelle. Bitte SQL-Skript ausführen oder Nhost-Konfiguration prüfen!");
  } finally {
    hideLoader();
  }

  initTeacherGrid();
  setupEventListeners();
}

/** 
 * Zeigt Loader an 
 */
function showLoader() {
  if (mainLoader) mainLoader.style.display = "flex";
}

/** 
 * Versteckt Loader 
 */
function hideLoader() {
  if (mainLoader) mainLoader.style.display = "none";
}

/** 
 * Zeigt eine Benachrichtigung 
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
 * Init Teacher Cards 
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
 * Passwortmodal anzeigen 
 */
function showPasswordModal(teacher) {
  if (!passwordModal) return;
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
 * Eventlistener einrichten 
 */
function setupEventListeners() {
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
      if (e.key === "Enter") {
        login();
      }
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
      const tabContent = document.getElementById(`${tabId}-tab`);
      if (tabContent) tabContent.classList.add("active");
      switch(tabId) {
        case 'students': updateStudentsTab(); break;
        case 'assessment': updateAssessmentTab(); break;
        case 'overview': updateOverviewTab(); break;
        case 'settings': updateSettingsTab(); break;
      }
    });
  });

  // Schüler hinzufügen
  if (addStudentBtn) {
    addStudentBtn.addEventListener("click", addNewStudent);
  }

  // Bewertungs-Tab
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
    settingsYearSelect.addEventListener("change", populateSettingsDateSelect);
  }
  if (exportDataBtn) {
    exportDataBtn.addEventListener("click", exportData);
  }
  if (deleteDataBtn) {
    deleteDataBtn.addEventListener("click", confirmDeleteAllData);
  }

  // Edit Student Modal
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

  // Edit Grade Modal
  if (closeEditGradeModal) {
    closeEditGradeModal.addEventListener("click", () => {
      editGradeModal.style.display = "none";
    });
  }
  if (saveGradeBtn) {
    saveGradeBtn.addEventListener("click", saveEditedGrade);
  }

  // Confirm Delete Modal
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
 * Login durchführen 
 */
async function login() {
  if (!currentUser) return;
  if (passwordInput.value === currentUser.password) {
    passwordModal.style.display = "none";
    showLoader();
    // Daten laden
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
  teacherData = { students: [], assessments: {} };
  loginSection.style.display = "block";
  appSection.style.display = "none";
  showNotification("Es wurde abgemeldet.");
}

/** 
 * Lehrer-Daten laden (GraphQL) 
 */
async function loadTeacherData() {
  if (!currentUser || !nhostClient) return false;
  try {
    const { data, error } = await nhostClient.graphql.request({
      query: `
        query GetTeacherData($code: String!) {
          wbs_data(where: {teacher_code: {_eq: $code}}) {
            id
            teacher_code
            teacher_name
            data
            created_at
            updated_at
          }
        }
      `,
      variables: { code: currentUser.code }
    });
    if (error) {
      console.error("Error loading teacher data:", error);
      showNotification("Fehler beim Laden der Daten.", "error");
      return false;
    }
    if (data && data.wbs_data && data.wbs_data.length > 0) {
      teacherData = data.wbs_data[0].data;
      migrateAssessmentCategories();
      return true;
    } else {
      teacherData = { students: [], assessments: {} };
      return await saveTeacherData();
    }
  } catch (err) {
    console.error("Error in loadTeacherData:", err);
    showNotification("Fehler beim Laden der Daten (Catch).", "error");
    return false;
  }
}

/** 
 * Migrationslogik für alte Kategorien 
 */
function migrateAssessmentCategories() {
  const categoryMapping = {
    organization: "presentation",
    workBehavior: "content",
    teamwork: "language",
    quality: "impression",
    reflection: "reflection",
    documentation: "documentation"
  };
  for (const studentId in teacherData.assessments) {
    const assessment = teacherData.assessments[studentId];
    for (const oldKey in categoryMapping) {
      if (assessment.hasOwnProperty(oldKey)) {
        const newKey = categoryMapping[oldKey];
        assessment[newKey] = assessment[oldKey];
        if (oldKey !== newKey) delete assessment[oldKey];
      }
    }
    // Neue Kategorien auffüllen
    ASSESSMENT_CATEGORIES.forEach(cat => {
      if (!assessment.hasOwnProperty(cat.id)) {
        assessment[cat.id] = 2;
      }
    });
    // infoText hinzufügen
    if (!assessment.hasOwnProperty("infoText")) {
      assessment.infoText = "";
    }
  }
}

/** 
 * Lehrer-Daten speichern (GraphQL) 
 */
async function saveTeacherData() {
  if (!currentUser || !nhostClient) return false;
  try {
    // Prüfen, ob Datensatz existiert
    const { data: existingData } = await nhostClient.graphql.request({
      query: `
        query CheckTeacherExists($code: String!) {
          wbs_data(where: {teacher_code: {_eq: $code}}) {
            id
          }
        }
      `,
      variables: { code: currentUser.code }
    });
    let mutation;
    let variables = {};
    if (existingData && existingData.wbs_data && existingData.wbs_data.length > 0) {
      // Update
      mutation = `
        mutation UpdateTeacherData($teacherCode: String!, $data: jsonb!) {
          update_wbs_data(
            where: {teacher_code: {_eq: $teacherCode}}, 
            _set: { data: $data, updated_at: "now()" }
          ) {
            affected_rows
          }
        }
      `;
      variables = {
        teacherCode: currentUser.code,
        data: teacherData
      };
    } else {
      // Insert
      mutation = `
        mutation CreateTeacherData($teacherCode: String!, $teacherName: String!, $data: jsonb!) {
          insert_wbs_data_one(
            object: {
              teacher_code: $teacherCode,
              teacher_name: $teacherName,
              data: $data
            }
          ) {
            id
          }
        }
      `;
      variables = {
        teacherCode: currentUser.code,
        teacherName: currentUser.name,
        data: teacherData
      };
    }
    const { error } = await nhostClient.graphql.request({ query: mutation, variables });
    if (error) {
      console.error("Error saving teacher data:", error);
      showNotification("Fehler beim Speichern der Daten.", "error");
      return false;
    }
    return true;
  } catch (err) {
    console.error("Error in saveTeacherData:", err);
    showNotification("Fehler beim Speichern der Daten (Catch).", "error");
    return false;
  }
}

/** 
 * Hilfsfunktionen 
 */
function formatDate(isoString) {
  if (!isoString) return "";
  const d = new Date(isoString + "T00:00:00");
  if (isNaN(d.getTime())) return isoString;
  return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}
function getYearFromDate(isoString) {
  return (isoString || "").split("-")[0] || "";
}
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}
function isStudentOnExamDay(studentId, examDate) {
  return teacherData.students.some(s => s.id !== studentId && s.examDate === examDate);
}
function calculateAverageGrade(assessment) {
  if (!assessment) return null;
  let sum = 0, count = 0;
  ASSESSMENT_CATEGORIES.forEach(cat => {
    const val = assessment[cat.id];
    if (val && val > 0) {
      sum += val;
      count++;
    }
  });
  return count === 0 ? null : (sum / count).toFixed(1);
}

/** 
 * Tabs: Schüler 
 */
function updateStudentsTab() {
  if (!studentsTable) return;
  const tbody = studentsTable.querySelector("tbody");
  tbody.innerHTML = "";
  if (teacherData.students.length === 0) {
    const tr = document.createElement("tr");
    tr.innerHTML = '<td colspan="3">Keine Prüflinge vorhanden</td>';
    tbody.appendChild(tr);
    return;
  }
  const sorted = [...teacherData.students].sort((a, b) => new Date(b.examDate) - new Date(a.examDate));
  sorted.forEach(student => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${student.name}</td>
      <td>${formatDate(student.examDate)}</td>
      <td><button class="edit-btn" data-id="${student.id}">✏️</button></td>
    `;
    tr.querySelector(".edit-btn").addEventListener("click", () => {
      showEditStudentModal(student);
    });
    tbody.appendChild(tr);
  });
}
async function addNewStudent() {
  const name = (newStudentName.value || "").trim();
  const date = examDate.value;
  if (!name) {
    showNotification("Bitte einen Namen eingeben.", "warning");
    return;
  }
  const existing = teacherData.students.find(s => s.name.toLowerCase() === name.toLowerCase() && s.examDate === date);
  if (existing) {
    showNotification(`Ein Prüfling namens "${name}" existiert bereits für dieses Datum.`, "warning");
    return;
  }
  if (isStudentOnExamDay(null, date)) {
    if (!confirm(`Es existiert bereits ein Prüfling am ${formatDate(date)}. Trotzdem fortfahren?`)) {
      return;
    }
  }
  showLoader();
  const newStud = {
    id: generateId(),
    name,
    examDate: date,
    createdAt: new Date().toISOString()
  };
  teacherData.students.push(newStud);
  teacherData.assessments[newStud.id] = {};
  ASSESSMENT_CATEGORIES.forEach(cat => {
    teacherData.assessments[newStud.id][cat.id] = 2;
  });
  teacherData.assessments[newStud.id].infoText = "";
  teacherData.assessments[newStud.id].finalGrade = 2.0;

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
function showEditStudentModal(student) {
  selectedStudent = student;
  editStudentName.value = student.name;
  editExamDate.value = student.examDate;
  editStudentModal.style.display = "flex";
}
async function saveEditedStudent() {
  if (!selectedStudent) return;
  const name = (editStudentName.value || "").trim();
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
  const idx = teacherData.students.findIndex(s => s.id === selectedStudent.id);
  if (idx !== -1) {
    teacherData.students[idx].name = name;
    teacherData.students[idx].examDate = date;
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
function showDeleteConfirmation() {
  studentToDelete = selectedStudent;
  deleteStudentName.textContent = studentToDelete.name;
  editStudentModal.style.display = "none";
  confirmDeleteModal.style.display = "flex";
}
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
 * Tabs: Bewertung 
 */
function updateAssessmentTab() {
  populateAssessmentDateSelect();
  updateAssessmentStudentList();
}
function populateAssessmentDateSelect() {
  if (!assessmentDateSelect) return;
  const dates = getAvailableDates();
  assessmentDateSelect.innerHTML = '<option value="">Bitte wählen...</option>';
  dates.forEach(d => {
    const opt = document.createElement("option");
    opt.value = d;
    opt.textContent = formatDate(d);
    assessmentDateSelect.appendChild(opt);
  });
}
function updateAssessmentStudentList() {
  if (!assessmentStudentList || !assessmentContent) return;
  const selectedDate = assessmentDateSelect.value;
  assessmentStudentList.innerHTML = "";
  if (!selectedDate) {
    assessmentStudentList.innerHTML = '<li>Bitte wählen Sie ein Datum</li>';
    assessmentContent.innerHTML = `
      <div class="welcome-card">
        <h2>Willkommen bei der WBS Bewertungsapp</h2>
        <p>Bitte wählen Sie einen Prüfungstag und Prüfling aus der Liste oder legen Sie einen neuen Prüfling an.</p>
      </div>
    `;
    return;
  }
  const studs = teacherData.students.filter(s => s.examDate === selectedDate);
  if (studs.length === 0) {
    assessmentStudentList.innerHTML = '<li>Keine Prüflinge für dieses Datum</li>';
    return;
  }
  studs.forEach(student => {
    const li = document.createElement("li");
    li.className = "student-item";
    li.dataset.id = student.id;
    const a = teacherData.assessments[student.id] || {};
    const finalGrade = a.finalGrade || "-";
    li.innerHTML = `
      <div class="student-name">${student.name}</div>
      <div class="average-grade grade-${Math.round(finalGrade)}">${finalGrade}</div>
    `;
    li.addEventListener("click", () => {
      document.querySelectorAll(".student-item").forEach(item => item.classList.remove("active"));
      li.classList.add("active");
      showAssessmentForm(student);
    });
    assessmentStudentList.appendChild(li);
  });
}

/** 
 * Bewertungsformular 
 */
function showAssessmentForm(student) {
  selectedStudent = student;
  const assessment = teacherData.assessments[student.id] || {};
  const avgGrade = calculateAverageGrade(assessment);
  const finalGrade = assessment.finalGrade || avgGrade || "-";
  const infoText = assessment.infoText || "";

  let html = `
    <div class="assessment-container">
      <div class="student-header">
        <h2>${student.name}</h2>
        <p>Prüfungsdatum: ${formatDate(student.examDate)}</p>
      </div>
      <div class="info-text-container">
        <h3>Informationen zum Prüfling</h3>
        <textarea id="studentInfoText" rows="6" placeholder="Notizen zum Prüfling eingeben...">${infoText}</textarea>
      </div>
      <div class="final-grade-display">Ø ${avgGrade || '0.0'}</div>
      <div class="final-grade-input">
        <label for="finalGrade">Endnote:</label>
        <input type="number" id="finalGrade" min="1" max="6" step="0.1" value="${finalGrade !== '-' ? finalGrade : ''}">
        <button id="saveFinalGradeBtn">Speichern</button>
        <button id="useAverageBtn">Durchschnitt übernehmen</button>
      </div>
  `;

  // Kategorien-Abschnitte
  ASSESSMENT_CATEGORIES.forEach(cat => {
    const gradeVal = assessment[cat.id] || 0;
    html += `
      <div class="assessment-category">
        <div class="category-header"><h3>${cat.name}</h3></div>
        <div class="category-grade">${gradeVal || '-'}</div>
        <div class="grade-buttons" data-category="${cat.id}">
    `;
    for (let i = 0; i <= 6; i++) {
      const selected = (gradeVal === i) ? "selected" : "";
      html += `<button class="grade-button grade-${i} ${selected}" data-grade="${i}">${i}</button>`;
    }
    html += `</div></div>`;
  });
  html += `</div>`;

  assessmentContent.innerHTML = html;

  // Noten-Buttons
  document.querySelectorAll(".grade-buttons .grade-button").forEach(btn => {
    btn.addEventListener("click", async () => {
      const catId = btn.parentElement.dataset.category;
      const grade = parseInt(btn.dataset.grade);
      btn.parentElement.querySelectorAll("button").forEach(b => b.classList.remove("selected"));
      btn.classList.add("selected");
      btn.parentElement.previousElementSibling.textContent = grade || "-";

      if (!teacherData.assessments[student.id]) {
        teacherData.assessments[student.id] = {};
      }
      teacherData.assessments[student.id][catId] = grade;
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

  // Endnote
  const saveFinalGradeBtn = document.getElementById("saveFinalGradeBtn");
  if (saveFinalGradeBtn) {
    saveFinalGradeBtn.addEventListener("click", async () => {
      const finalGradeInput = document.getElementById("finalGrade");
      const val = parseFloat(finalGradeInput.value);
      if (isNaN(val) || val < 1 || val > 6) {
        showNotification("Bitte eine gültige Note (1-6) eingeben.", "warning");
        return;
      }
      teacherData.assessments[student.id].finalGrade = val;
      await saveTeacherData();
      updateAssessmentStudentList();
      showNotification("Endnote wurde gespeichert.");
    });
  }

  // Durchschnitt übernehmen
  const useAverageBtn = document.getElementById("useAverageBtn");
  if (useAverageBtn) {
    useAverageBtn.addEventListener("click", async () => {
      const avg = calculateAverageGrade(teacherData.assessments[student.id]);
      if (!avg) {
        showNotification("Es gibt noch keinen Durchschnitt.", "warning");
        return;
      }
      document.getElementById("finalGrade").value = avg;
      teacherData.assessments[student.id].finalGrade = parseFloat(avg);
      await saveTeacherData();
      updateAssessmentStudentList();
      showNotification("Durchschnitt als Endnote übernommen.");
    });
  }

  // Infotext
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
 * Autosave für Infotext 
 */
function setupInfoTextAutoSave(studentId) {
  if (infoTextSaveTimer) {
    clearInterval(infoTextSaveTimer);
  }
  infoTextSaveTimer = setInterval(async () => {
    const infoTextArea = document.getElementById("studentInfoText");
    if (infoTextArea && infoTextArea.dataset.changed === "true") {
      teacherData.assessments[studentId].infoText = infoTextArea.value;
      await saveTeacherData();
      infoTextArea.dataset.changed = "false";
      showNotification("Informationstext wurde automatisch gespeichert.", "success");
      infoTextArea.classList.add("save-flash");
      setTimeout(() => {
        infoTextArea.classList.remove("save-flash");
      }, 1000);
    }
  }, 60000);
}

/** 
 * Tabs: Übersicht 
 */
function updateOverviewTab() {
  populateOverviewYearSelect();
  populateOverviewDateSelect();
  updateOverviewContent();
}
function populateOverviewYearSelect() {
  if (!overviewYearSelect) return;
  const years = getAvailableYears();
  overviewYearSelect.innerHTML = '<option value="">Alle Jahre</option>';
  years.forEach(y => {
    const opt = document.createElement("option");
    opt.value = y;
    opt.textContent = y;
    overviewYearSelect.appendChild(opt);
  });
}
function populateOverviewDateSelect() {
  if (!overviewDateSelect) return;
  const selYear = overviewYearSelect.value;
  const dates = getAvailableDates(selYear);
  overviewDateSelect.innerHTML = '<option value="">Alle Tage</option>';
  dates.forEach(d => {
    const opt = document.createElement("option");
    opt.value = d;
    opt.textContent = formatDate(d);
    overviewDateSelect.appendChild(opt);
  });
}
function updateOverviewContent() {
  if (!overviewTable) return;
  const selYear = overviewYearSelect.value;
  const selDate = overviewDateSelect.value;
  const tbody = overviewTable.querySelector("tbody");
  tbody.innerHTML = "";
  let filtered = [...teacherData.students];
  if (selYear) {
    filtered = filtered.filter(s => getYearFromDate(s.examDate) === selYear);
  }
  if (selDate) {
    filtered = filtered.filter(s => s.examDate === selDate);
  }
  filtered.sort((a, b) => new Date(b.examDate) - new Date(a.examDate));
  if (filtered.length === 0) {
    const tr = document.createElement("tr");
    tr.innerHTML = '<td colspan="12">Keine Prüflinge gefunden</td>';
    tbody.appendChild(tr);
    return;
  }
  filtered.forEach(student => {
    const a = teacherData.assessments[student.id] || {};
    const avg = calculateAverageGrade(a);
    const finalGrade = a.finalGrade || avg || "-";
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${student.name}</td>
      <td>${formatDate(student.examDate)}</td>
      <td>${a.presentation || '-'}</td>
      <td>${a.content || '-'}</td>
      <td>${a.language || '-'}</td>
      <td>${a.impression || '-'}</td>
      <td>${a.examination || '-'}</td>
      <td>${a.reflection || '-'}</td>
      <td>${a.expertise || '-'}</td>
      <td>${a.documentation || '-'}</td>
      <td>${finalGrade}</td>
      <td><button class="edit-btn" data-id="${student.id}">✏️</button></td>
    `;
    tr.querySelector(".edit-btn").addEventListener("click", () => {
      showEditGradeModal(student);
    });
    tbody.appendChild(tr);
  });
}

/** 
 * Tabs: Einstellungen 
 */
function updateSettingsTab() {
  populateSettingsYearSelect();
}
function populateSettingsYearSelect() {
  if (!settingsYearSelect) return;
  const years = getAvailableYears();
  settingsYearSelect.innerHTML = '<option value="">Alle Jahre</option>';
  years.forEach(y => {
    const opt = document.createElement("option");
    opt.value = y;
    opt.textContent = y;
    settingsYearSelect.appendChild(opt);
  });
}
function populateSettingsDateSelect() {
  if (!settingsDateSelect) return;
  const selYear = settingsYearSelect.value;
  const dates = getAvailableDates(selYear);
  settingsDateSelect.innerHTML = '<option value="">Alle Tage</option>';
  dates.forEach(d => {
    const opt = document.createElement("option");
    opt.value = d;
    opt.textContent = formatDate(d);
    settingsDateSelect.appendChild(opt);
  });
}

/** 
 * Endnote bearbeiten (Übersicht) 
 */
function showEditGradeModal(student) {
  selectedGradeStudent = student;
  const a = teacherData.assessments[student.id] || {};
  const finalGrade = a.finalGrade || calculateAverageGrade(a) || "";
  editFinalGrade.value = finalGrade;
  editGradeModal.style.display = "flex";
}
async function saveEditedGrade() {
  const val = parseFloat(editFinalGrade.value);
  if (isNaN(val) || val < 1 || val > 6) {
    showNotification("Bitte eine gültige Note (1-6) eingeben.", "warning");
    return;
  }
  showLoader();
  if (!teacherData.assessments[selectedGradeStudent.id]) {
    teacherData.assessments[selectedGradeStudent.id] = {};
    ASSESSMENT_CATEGORIES.forEach(cat => {
      teacherData.assessments[selectedGradeStudent.id][cat.id] = 2;
    });
  }
  teacherData.assessments[selectedGradeStudent.id].finalGrade = val;
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
 * Daten löschen 
 */
function confirmDeleteAllData() {
  const code = (deleteVerificationCode.value || "").trim();
  if (!code || code !== currentUser.code) {
    showNotification("Falsches oder kein Lehrerkürzel.", "warning");
    return;
  }
  if (!confirm("Wirklich ALLE Daten löschen?")) {
    return;
  }
  deleteAllData();
}
async function deleteAllData() {
  showLoader();
  teacherData = { students: [], assessments: {} };
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
 * Daten exportieren 
 */
function exportData() {
  const exportFormatTXT = document.getElementById("exportTXT").checked;
  let dataStr = "", fileName = "";
  if (exportFormatTXT) {
    dataStr = "Name,Datum,Präsentation,Inhalt,Sprache,Eindruck,Prüfung,Reflexion,Fachwissen,Dokumentation,Endnote\n";
    teacherData.students.forEach(student => {
      const a = teacherData.assessments[student.id] || {};
      const avg = calculateAverageGrade(a);
      const finalGrade = a.finalGrade || avg || "-";
      dataStr += `${student.name},${formatDate(student.examDate)},${a.presentation || '-'},${a.content || '-'},${a.language || '-'},${a.impression || '-'},${a.examination || '-'},${a.reflection || '-'},${a.expertise || '-'},${a.documentation || '-'},${finalGrade}\n`;
    });
    fileName = "bewertungen.txt";
    const blob = new Blob([dataStr], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } else {
    // JSON-Export
    dataStr = JSON.stringify(teacherData, null, 2);
    fileName = "bewertungen.json";
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
}
