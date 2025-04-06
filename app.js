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
let teacherData = { students: [], assessments: {} };
let selectedStudent = null;
let studentToDelete = null;
let selectedGradeStudent = null;
let infoTextSaveTimer = null;
const today = new Date();
const defaultDate = today.getFullYear() + '-' +
                    String(today.getMonth() + 1).padStart(2, '0') + '-' +
                    String(today.getDate()).padStart(2, '0');

// Nhost-Konfiguration
const NHOST_SUBDOMAIN = "meeeuwopykbtjzdlfmjg";
const NHOST_REGION = "eu-central-1";
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

// Initialisierung bei DOM-Ready
document.addEventListener("DOMContentLoaded", function() {
  console.log("WBS Bewertungssystem wird initialisiert...");
  init();
});

async function init() {
  if (examDate) {
    examDate.value = defaultDate;
  }
  await initDatabase();
  initTeacherGrid();
  setupEventListeners();
  hideLoader();
}

function showNotification(message, type = "success") {
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.textContent = message;
  document.body.appendChild(notification);
  setTimeout(() => {
    notification.remove();
  }, 3000);
}

function showLoader() {
  if (mainLoader) {
    mainLoader.style.display = "flex";
  }
}

function hideLoader() {
  if (mainLoader) {
    mainLoader.style.display = "none";
  }
}

function formatDate(isoDateString) {
  if (!isoDateString) return '';
  const date = new Date(isoDateString + "T00:00:00");
  if(isNaN(date.getTime())) return isoDateString;
  return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function getYearFromDate(isoDateString) {
  return isoDateString.split('-')[0];
}

function getAvailableYears() {
  const years = new Set();
  const currentYear = new Date().getFullYear();
  for (let i = 0; i <= 10; i++) {
    years.add((currentYear + i).toString());
  }
  teacherData.students.forEach(student => {
    years.add(getYearFromDate(student.examDate));
  });
  return Array.from(years).sort((a, b) => a - b).reverse();
}

function getAvailableDates(year = null) {
  const dates = new Set();
  teacherData.students.forEach(student => {
    if (!year || getYearFromDate(student.examDate) === year) {
      dates.add(student.examDate);
    }
  });
  return Array.from(dates).sort().reverse();
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

function isStudentOnExamDay(studentId, examDate) {
  return teacherData.students.some(s => s.id !== studentId && s.examDate === examDate);
}

async function initDatabase() {
  try {
    showLoader();
    if (typeof NhostClient === 'undefined' && typeof nhost === 'undefined') {
      console.error("Nhost-Bibliothek ist nicht definiert. Bitte Bibliothek prüfen.");
      showNotification("Fehler bei der Initialisierung. Bitte Seite neu laden.", "error");
      hideLoader();
      return false;
    }
    if (typeof NhostClient !== 'undefined') {
      nhostClient = new NhostClient({ subdomain: NHOST_SUBDOMAIN, region: NHOST_REGION });
    } else if (typeof nhost !== 'undefined') {
      nhostClient = nhost.createClient({ subdomain: NHOST_SUBDOMAIN, region: NHOST_REGION });
    }
    console.log("Nhost-Client erfolgreich initialisiert");
    
    try {
      const { data, error } = await nhostClient.graphql.request({
        query: `
          query CheckTableExists {
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
        showNotification("Die Tabelle 'wbs_data' wurde nicht gefunden. Bitte führen Sie das SQL-Skript aus.", "warning");
      }
    } catch (err) {
      console.error("Fehler bei GraphQL-Abfrage:", err);
    }
    hideLoader();
    return true;
  } catch (error) {
    console.error("Fehler bei der Datenbankinitialisierung:", error);
    hideLoader();
    return false;
  }
}

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

async function loadTeacherData() {
  if (!currentUser) return false;
  try {
    const { data, error } = await nhostClient.graphql.request({
      query: `
        query GetTeacherData {
          wbs_data(where: {teacher_code: {_eq: "${currentUser.code}"}}) {
            id
            teacher_code
            teacher_name
            data
            created_at
            updated_at
          }
        }
      `
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
  } catch (error) {
    console.error("Error in loadTeacherData:", error);
    showNotification("Fehler beim Laden der Daten.", "error");
    return false;
  }
}

async function saveTeacherData() {
  if (!currentUser) return false;
  try {
    const { data: existingData } = await nhostClient.graphql.request({
      query: `
        query CheckTeacherExists {
          wbs_data(where: {teacher_code: {_eq: "${currentUser.code}"}}) {
            id
          }
        }
      `
    });
    let mutation;
    let variables = {};
    if (existingData && existingData.wbs_data && existingData.wbs_data.length > 0) {
      mutation = `
        mutation UpdateTeacherData($teacherCode: String!, $data: jsonb!, $updatedAt: timestamptz!) {
          update_wbs_data(
            where: {teacher_code: {_eq: $teacherCode}}, 
            _set: {
              data: $data, 
              updated_at: $updatedAt
            }
          ) {
            affected_rows
          }
        }
      `;
      variables = {
        teacherCode: currentUser.code,
        data: teacherData,
        updatedAt: new Date().toISOString()
      };
    } else {
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
    const { error } = await nhostClient.graphql.request({
      query: mutation,
      variables: variables
    });
    if (error) {
      console.error("Error saving teacher data:", error);
      showNotification("Fehler beim Speichern der Daten.", "error");
      return false;
    }
    return true;
  } catch (error) {
    console.error("Error in saveTeacherData:", error);
    showNotification("Fehler beim Speichern der Daten.", "error");
    return false;
  }
}

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
      if (e.key === "Enter") login();
    });
  }
  if (logoutBtn) {
    logoutBtn.addEventListener("click", logout);
  }
  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      const tabId = tab.dataset.tab;
      tabs.forEach(t => t.classList.remove("active"));
      tabContents.forEach(c => c.classList.remove("active"));
      tab.classList.add("active");
      document.getElementById(`${tabId}-tab`) && document.getElementById(`${tabId}-tab`).classList.add("active");
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
  if (addStudentBtn) {
    addStudentBtn.addEventListener("click", addNewStudent);
  }
  if (assessmentDateSelect) {
    assessmentDateSelect.addEventListener("change", updateAssessmentStudentList);
  }
  if (overviewYearSelect) {
    overviewYearSelect.addEventListener("change", () => {
      populateOverviewDateSelect();
      updateOverviewContent();
    });
  }
  if (overviewDateSelect) {
    overviewDateSelect.addEventListener("change", updateOverviewContent);
  }
  if (settingsYearSelect) {
    settingsYearSelect.addEventListener("change", populateSettingsDateSelect);
  }
  if (exportDataBtn) {
    exportDataBtn.addEventListener("click", exportData);
  }
  if (deleteDataBtn) {
    deleteDataBtn.addEventListener("click", confirmDeleteAllData);
  }
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

function showPasswordModal(teacher) {
  loginPrompt.textContent = `Bitte geben Sie das Passwort für ${teacher.name} ein:`;
  passwordInput.value = "";
  passwordModal.style.display = "flex";
  passwordInput.focus();
  currentUser = { name: teacher.name, code: teacher.code, password: teacher.password };
}

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
  const sortedStudents = [...teacherData.students].sort((a, b) => new Date(b.examDate) - new Date(a.examDate));
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

async function addNewStudent() {
  const name = newStudentName.value.trim();
  const date = examDate.value;
  if (!name) {
    showNotification("Bitte einen Namen eingeben.", "warning");
    return;
  }
  const existingStudent = teacherData.students.find(s => s.name.toLowerCase() === name.toLowerCase() && s.examDate === date);
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

function showEditStudentModal(student) {
  editStudentName.value = student.name;
  editExamDate.value = student.examDate;
  selectedStudent = student;
  editStudentModal.style.display = "flex";
}

async function saveEditedStudent() {
  const name = editStudentName.value.trim();
  const date = editExamDate.value;
  if (!name) {
    showNotification("Bitte einen Namen eingeben.", "warning");
    return;
  }
  const existingStudent = teacherData.students.find(s => s.id !== selectedStudent.id && s.name.toLowerCase() === name.toLowerCase() && s.examDate === date);
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

function showDeleteConfirmation() {
  studentToDelete = selectedStudent;
  deleteStudentName.textContent = selectedStudent.name;
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

function updateAssessmentTab() {
  populateAssessmentDateSelect();
  updateAssessmentStudentList();
}

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

function updateAssessmentStudentList() {
  if (!assessmentStudentList || !assessmentContent) return;
  const selectedDate = assessmentDateSelect.value;
  assessmentStudentList.innerHTML = '';
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
      html += `<button class="grade-button grade-${i} ${isSelected ? 'selected' : ''}" data-grade="${i}">${i}</button>`;
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

function showEditGradeModal(student) {
  selectedGradeStudent = student;
  const assessment = teacherData.assessments[student.id] || {};
  const finalGrade = assessment.finalGrade || calculateAverageGrade(assessment) || '';
  editFinalGrade.value = finalGrade;
  editGradeModal.style.display = "flex";
}

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

function updateOverviewTab() {
  populateOverviewYearSelect();
  populateOverviewDateSelect();
  updateOverviewContent();
}

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

function updateSettingsTab() {
  populateSettingsYearSelect();
}

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

function exportData() {
  const exportFormatTXT = document.getElementById("exportTXT").checked;
  let dataStr, fileName;
  if(exportFormatTXT) {
    dataStr = "Name,Datum,Präsentation,Inhalt,Sprache,Eindruck,Prüfung,Reflexion,Fachwissen,Dokumentation,Endnote\n";
    teacherData.students.forEach(student => {
      const assessment = teacherData.assessments[student.id] || {};
      const avgGrade = calculateAverageGrade(assessment);
      const finalGrade = assessment.finalGrade || avgGrade || '-';
      dataStr += `${student.name},${formatDate(student.examDate)},${assessment.presentation || '-'},${assessment.content || '-'},${assessment.language || '-'},${assessment.impression || '-'},${assessment.examination || '-'},${assessment.reflection || '-'},${assessment.expertise || '-'},${assessment.documentation || '-'},${finalGrade}\n`;
    });
    fileName = "bewertungen.txt";
    const blob = new Blob([dataStr], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } else {
    dataStr = JSON.stringify(teacherData, null, 2);
    fileName = "bewertungen.json";
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
}
