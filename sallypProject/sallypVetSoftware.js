const STORAGE_KEY = "vet-clinic-state-v2";
const STORAGE_FALLBACK_KEY = "vet-clinic-state-session-fallback-v1";
const ATTACHMENT_DB_NAME = "vet-clinic-attachments";
const ATTACHMENT_STORE_NAME = "attachmentBlobs";
const APP_STATE_DB_NAME = "vet-clinic-state";
const APP_STATE_STORE_NAME = "appState";
const APP_STATE_RECORD_KEY = "serializedState";
const FULL_BACKUP_SCHEMA_VERSION = 1;
const FULL_BACKUP_ROOT_DIR = "oneclick-backup";
const FULL_BACKUP_STATE_PATH = `${FULL_BACKUP_ROOT_DIR}/state.json`;
const FULL_BACKUP_MANIFEST_PATH = `${FULL_BACKUP_ROOT_DIR}/manifest.json`;
const FULL_BACKUP_ATTACHMENTS_PREFIX = `${FULL_BACKUP_ROOT_DIR}/attachments/`;
const LOCALSTORAGE_SOFT_LIMIT_BYTES = 4.5 * 1024 * 1024;
const LEGACY_INLINE_DATA_MAX_CHARS = 2_000_000;
const JSZIP_CDN_URL =
  "https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js";
const PDFJS_CDN_URL =
  "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js";
const PDFJS_WORKER_CDN_URL =
  "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js";
const ONECLICK_API_BASE = String(
  globalThis.ONECLICK_API_BASE || "http://localhost:4242",
).replace(/\/+$/, "");
const AI_REQUEST_TIMEOUT_MS = 30000;
const AI_ATTACHMENT_MAX_FILES = 8;
const AI_ATTACHMENT_MAX_IMAGES = 3;
const AI_ATTACHMENT_MAX_TEXT_CHARS = 12000;
const AI_ATTACHMENT_MAX_TEXT_PER_FILE_CHARS = 2200;
const AI_ATTACHMENT_TEXT_READ_BYTES = 180000;
const AI_ATTACHMENT_MAX_PDF_PAGES = 5;
const AI_ATTACHMENT_MAX_PDF_FILES = 2;
const AI_ATTACHMENT_MAX_PDF_DATA_URL_CHARS = 1_600_000;
const AI_ATTACHMENT_IMAGE_MAX_DIMENSION = 900;
const AI_ATTACHMENT_IMAGE_JPEG_QUALITY = 0.72;
const AI_ATTACHMENT_MAX_IMAGE_DATA_URL_CHARS = 350000;
const nowIso = () => new Date().toISOString();
const todayYmd = () => new Date().toISOString().slice(0, 10);
const remindersLogic = globalThis.RemindersLogic || {};
const REMINDER_WINDOW_OPTIONS = Array.isArray(
  remindersLogic.REMINDER_WINDOW_OPTIONS,
)
  ? remindersLogic.REMINDER_WINDOW_OPTIONS
  : [
      { key: "next7", label: "Next 7 days", days: 7 },
      { key: "next30", label: "Next 30 days", days: 30 },
      { key: "next60", label: "Next 60 days", days: 60 },
      { key: "next90", label: "Next 90 days", days: 90 },
      { key: "custom", label: "Custom Range", days: null },
    ];
const REMINDER_CATEGORIES = remindersLogic.REMINDER_CATEGORIES || {
  dueSoonNoAppointment: "dueSoonNoAppointment",
  dueSoonHasAppointment: "dueSoonHasAppointment",
  appointmentsScheduled: "appointmentsScheduled",
};

let attachmentDbPromise = null;
let appStateDbPromise = null;
let pdfJsLoadPromise = null;
let pendingLegacyAttachmentMigrations = [];
let pendingMigrationWarnings = [];
let persistSizeWarningShown = false;
let storageWarningShown = false;
let stateVersionCounter = 0;
const clientAttachmentAiCache = new Map();
const startupStorageStatus = {
  level: "ok",
  message: "",
};
const storageDiagnostics = {
  lastLoad: null,
  lastPersist: null,
};

function updateStorageDiagnostics(type, payload) {
  storageDiagnostics[type] = {
    ...payload,
    recordedAt: nowIso(),
  };
  renderStartupStorageStatus();
}

function canUseStorage(storage) {
  if (!storage) return false;
  try {
    const probeKey = "__oneclick_storage_probe__";
    storage.setItem(probeKey, "1");
    storage.removeItem(probeKey);
    return true;
  } catch {
    return false;
  }
}

const hasLocalStorage = canUseStorage(globalThis.localStorage);
const hasSessionStorage = canUseStorage(globalThis.sessionStorage);
let runtimeHasLocalStorage = hasLocalStorage;
let runtimeHasSessionStorage = hasSessionStorage;

const baseState = {
  inventoryItems: [],
  clients: [
    {
      clientId: crypto.randomUUID(),
      firstName: "Ava",
      lastName: "Martinez",
      contacts: [
        { name: "Ava Martinez", phone: "5551112222", isPrimary: true },
      ],
      email: "",
      patients: [
        {
          patientId: crypto.randomUUID(),
          name: "Milo",
          species: "Dog",
          breed: "",
          sex: "Neutered Male",
          dateOfBirth: "",
          age: "",
          medicalNotes: [],
          priorRecords: [],
          preventiveReminders: [],
          visits: [],
        },
      ],
    },
  ],
  activeClientId: null,
  activePatientId: null,
  activeVisitId: null,
  editingClientId: null,
  editingPatientId: null,
  newClientPatients: [],
  visitDraft: null,
  pendingNavigation: null,
  aiChatsByClient: {},
  activeAiChatByClient: {},
};

const state = structuredClone(baseState);
const homePanelState = {
  revenueVisible: false,
  duePaymentsVisible: false,
  remindersVisible: false,
  inventoryVisible: false,
};
const remindersUiState = {
  windowKey: "next30",
  customStart: "",
  customEnd: "",
  activeCategory: REMINDER_CATEGORIES.dueSoonNoAppointment,
};
let remindersRowsByPatient = new Map();
let pendingAppointmentSchedulerPrefill = null;

const els = Object.fromEntries(
  [
    "flashMessage",
    "homeStorageStatus",
    "homeScreen",
    "homeFinanceSummary",
    "homeDuePaymentsSummary",
    "homeRemindersSummary",
    "homeLabsBtn",
    "homeLabsPendingCount",
    "homeSettingsRevenueBtn",
    "homeSettingsDuePaymentsBtn",
    "homeSettingsRemindersBtn",
    "homeSettingsInventoryBtn",
    "labsScreen",
    "labsPendingMeta",
    "labsList",
    "labsError",
    "remindersScreen",
    "remindersListTitle",
    "remindersListMeta",
    "remindersList",
    "remindersListError",
    "addClientScreen",
    "editClientScreen",
    "clientDetailScreen",
    "editPatientScreen",
    "patientDetailScreen",
    "inventoryPanel",
    "inventoryName",
    "inventorySku",
    "inventoryLotNumber",
    "inventoryExpirationDate",
    "inventoryOnHandQty",
    "inventoryUnit",
    "inventoryUnitCost",
    "inventoryReorderLevel",
    "inventoryControlled",
    "inventoryDeaSchedule",
    "addInventoryItemBtn",
    "inventoryError",
    "inventorySummary",
    "inventoryList",
    "visitEditorScreen",
    "searchInput",
    "searchResults",
    "openAddClientBtn",
    "clientFirstName",
    "clientLastName",
    "clientPhone",
    "clientEmail",
    "clientContactsList",
    "addClientContactBtn",
    "newPatientList",
    "addPatientRowBtn",
    "addClientError",
    "saveClientBtn",
    "editClientFirstName",
    "editClientLastName",
    "editClientPhone",
    "editClientEmail",
    "editClientError",
    "saveClientEditBtn",
    "clientDetailHeader",
    "clientCheckoutPanel",
    "clientCheckoutSummary",
    "detailPatientName",
    "detailPatientSpecies",
    "detailPatientBreed",
    "detailPatientSex",
    "detailPatientAge",
    "detailPatientDateOfBirth",
    "clientDetailError",
    "saveDetailPatientBtn",
    "editPatientName",
    "editPatientSpecies",
    "editPatientBreed",
    "editPatientSex",
    "editPatientAge",
    "editPatientDateOfBirth",
    "editPatientError",
    "savePatientEditBtn",
    "patientSummary",
    "patientWeightTrendMeta",
    "patientWeightChart",
    "patientWeightSeriesList",
    "patientWeightLbsInput",
    "patientWeightKgPreview",
    "savePatientWeightBtn",
    "patientCheckoutPanel",
    "patientCheckoutSummary",
    "patientDeclinedServicesLog",
    "visitList",
    "newVisitReason",
    "startVisitBtn",
    "patientAppointmentSchedulerPanel",
    "patientAppointmentDateInput",
    "patientAppointmentStatusInput",
    "patientAppointmentReasonInput",
    "schedulePatientAppointmentBtn",
    "patientAppointmentSchedulerError",
    "patientAppointmentList",
    "clientAiQuestion",
    "askClientAiBtn",
    "clientAiError",
    "clientAiChatSelect",
    "clientAiNewChatBtn",
    "clientAiMessages",
    "patientDetailError",
    "visitStatusBadge",
    "visitPatientContext",
    "visitMeta",
    "visitDate",
    "visitReason",
    "visitWeightLbs",
    "visitWeightKgPreview",
    "visitWeightTrendMeta",
    "visitWeightChart",
    "visitWeightSeriesList",
    "soapSubjective",
    "soapObjective",
    "soapAssessment",
    "soapPlan",
    "visitOrderCatalogSelect",
    "visitOrderError",
    "visitOrderList",
    "visitOrderTotals",
    "addAttachmentBtn",
    "attachmentFileInput",
    "attachmentList",
    "visitEditorError",
    "visitEditorSuccess",
    "saveVisitBtn",
    "finalizeVisitBtn",
    "deleteVisitBtn",
    "visitDeleteHelpText",
    "exportVisitPdfBtn",
    "addPatientAttachmentBtn",
    "patientAttachmentFileInput",
    "patientAttachmentList",
    "patientMedicalNoteInput",
    "addPatientMedicalNoteBtn",
    "patientMedicalNotesList",
    "patientDiagnosticsList",
    "exportPatientBtn",
    "exportFullBackupBtn",
    "importFullBackupBtn",
    "importFullBackupInput",
    "closeoutDateInput",
    "exportCloseoutBtn",
    "confirmModal",
    "confirmModalMessage",
    "confirmModalActions",
    "reminderDueDateModal",
    "reminderDueDateInput",
    "reminderDueDateError",
    "reminderDueDateSaveBtn",
    "reminderDueDateCancelBtn",
    "visitSelectionModal",
    "visitSelectionList",
    "priorRecordSelectionList",
    "includePriorRecordsCheckbox",
    "visitSelectionError",
    "visitSelectionConfirmBtn",
    "visitSelectionCancelBtn",
    "clientDetailActions",
    "patientDetailActions",
    "editClientContactsList",
    "addEditClientContactBtn",
  ].map((id) => [id, document.getElementById(id)]),
);

const defaultContact = () => ({ name: "", phone: "", isPrimary: false });
const defaultPatientDraft = () => ({
  name: "",
  species: "",
  breed: "",
  sex: "",
  age: "",
  dateOfBirth: "",
});
const PREVENTIVE_REMINDER_CATEGORIES = [
  "vaccine",
  "diagnostic test",
  "preventive medication",
  "follow-up visit",
];
const PREVENTIVE_REMINDER_TYPE_CODES = [
  "rabies",
  "da2pp",
  "bordetella",
  "influenza",
  "leptospirosis",
  "fvrcp",
  "felv",
  "fecal_test",
  "heartworm_test",
  "heartworm_preventive",
  "flea_tick_preventive",
];
const PREVENTIVE_REMINDER_SPECIES_SCOPES = ["dog", "cat", "both"];
const PREVENTIVE_REMINDER_STATUSES = [
  "active",
  "completed",
  "overdue",
  "due",
  "upcoming",
  "not due",
  "paused",
  "declined",
];
const PREVENTIVE_REMINDER_RECURRENCE_RULES = [
  "monthly",
  "yearly",
  "custom months",
];
const VISIT_ORDER_STATUS_LABELS = {
  completed: "Completed",
  declined: "Client Declined",
};
const SERVICE_CATALOG = [
  {
    serviceCode: "physical_exam",
    name: "Physical Exam",
    category: "exam",
    defaultUnitPriceCents: 6500,
  },
  {
    serviceCode: "nail_trim",
    name: "Nail Trim",
    category: "procedure",
    defaultUnitPriceCents: 2800,
  },
  {
    serviceCode: "heartworm_test",
    name: "Heartworm Test",
    category: "diagnostic",
    defaultUnitPriceCents: 5200,
  },
  {
    serviceCode: "rabies_vaccine",
    name: "Rabies Vaccine",
    category: "vaccine",
    defaultUnitPriceCents: 4200,
  },
  {
    serviceCode: "da2pp_vaccine",
    name: "DA2PP Vaccine",
    category: "vaccine",
    defaultUnitPriceCents: 4700,
  },
  {
    serviceCode: "leptospirosis_vaccine",
    name: "Leptospirosis Vaccine",
    category: "vaccine",
    defaultUnitPriceCents: 4800,
  },
  {
    serviceCode: "bordetella_vaccine",
    name: "Bordetella Vaccine",
    category: "vaccine",
    defaultUnitPriceCents: 3900,
  },
  {
    serviceCode: "influenza_vaccine",
    name: "Canine Influenza Vaccine",
    category: "vaccine",
    defaultUnitPriceCents: 5600,
  },
  {
    serviceCode: "fvrcp_vaccine",
    name: "FVRCP Vaccine",
    category: "vaccine",
    defaultUnitPriceCents: 4600,
  },
  {
    serviceCode: "felv_vaccine",
    name: "FeLV Vaccine",
    category: "vaccine",
    defaultUnitPriceCents: 4900,
  },
  {
    serviceCode: "fecal_test",
    name: "Fecal Test",
    category: "diagnostic",
    defaultUnitPriceCents: 4500,
  },
  {
    serviceCode: "proheart12_injection",
    name: "ProHeart 12",
    category: "preventive",
    defaultUnitPriceCents: 12900,
  },
  {
    serviceCode: "bravecto_quantum",
    name: "Bravecto Quantum",
    category: "preventive",
    defaultUnitPriceCents: 9800,
  },
  {
    serviceCode: "ear_cleaning",
    name: "Ear Cleaning",
    category: "procedure",
    defaultUnitPriceCents: 3500,
  },
];
const SERVICE_REMINDER_TYPE_MAP = {
  rabies_vaccine: "rabies",
  da2pp_vaccine: "da2pp",
  leptospirosis_vaccine: "leptospirosis",
  bordetella_vaccine: "bordetella",
  influenza_vaccine: "influenza",
  fvrcp_vaccine: "fvrcp",
  felv_vaccine: "felv",
  heartworm_test: "heartworm_test",
  fecal_test: "fecal_test",
  proheart12_injection: "heartworm_preventive",
  bravecto_quantum: "flea_tick_preventive",
};
const REMINDER_DUE_WINDOW_DAYS = 7;
const REMINDER_UPCOMING_WINDOW_DAYS = 30;
const REMINDER_MATCH_KEYWORDS = {
  rabies: ["rabies"],
  da2pp: ["da2pp", "distemper", "parvo"],
  bordetella: ["bordetella", "kennel cough"],
  influenza: ["influenza", "flu vaccine"],
  leptospirosis: ["leptospirosis", "lepto"],
  fvrcp: ["fvrcp"],
  felv: ["felv", "feline leukemia"],
  fecal_test: ["fecal test", "fecal"],
  heartworm_test: ["heartworm test"],
  heartworm_preventive: ["heartworm preventive", "heartworm prevention"],
  flea_tick_preventive: ["flea", "tick preventive", "flea tick preventive"],
};

const REMINDER_TEMPLATE_CATALOG = {
  dog: [
    {
      typeCode: "fecal_test",
      category: "diagnostic test",
      speciesScope: "dog",
      intervalMonths: 6,
    },
    {
      typeCode: "heartworm_test",
      category: "diagnostic test",
      speciesScope: "dog",
      intervalMonths: 12,
    },
    {
      typeCode: "rabies",
      category: "vaccine",
      speciesScope: "dog",
      intervalMonths: 36,
    },
    {
      typeCode: "da2pp",
      category: "vaccine",
      speciesScope: "dog",
      intervalMonths: 12,
    },
    {
      typeCode: "bordetella",
      category: "vaccine",
      speciesScope: "dog",
      intervalMonths: 6,
    },
    {
      typeCode: "influenza",
      category: "vaccine",
      speciesScope: "dog",
      intervalMonths: 12,
    },
    {
      typeCode: "leptospirosis",
      category: "vaccine",
      speciesScope: "dog",
      intervalMonths: 12,
    },
    {
      typeCode: "heartworm_preventive",
      category: "preventive medication",
      speciesScope: "dog",
      intervalMonths: 12,
    },
    {
      typeCode: "flea_tick_preventive",
      category: "preventive medication",
      speciesScope: "dog",
      intervalMonths: 12,
    },
  ],
  cat: [
    {
      typeCode: "fecal_test",
      category: "diagnostic test",
      speciesScope: "cat",
      intervalMonths: 6,
    },
    {
      typeCode: "rabies",
      category: "vaccine",
      speciesScope: "cat",
      intervalMonths: 36,
    },
    {
      typeCode: "fvrcp",
      category: "vaccine",
      speciesScope: "cat",
      intervalMonths: 12,
    },
    {
      typeCode: "felv",
      category: "vaccine",
      speciesScope: "cat",
      intervalMonths: 12,
    },
    {
      typeCode: "flea_tick_preventive",
      category: "preventive medication",
      speciesScope: "cat",
      intervalMonths: 12,
    },
  ],
};
const REMINDER_TYPE_CATEGORY_MAP = {
  rabies: "vaccine",
  da2pp: "vaccine",
  bordetella: "vaccine",
  influenza: "vaccine",
  leptospirosis: "vaccine",
  fvrcp: "vaccine",
  felv: "vaccine",
  fecal_test: "diagnostic test",
  heartworm_test: "diagnostic test",
  heartworm_preventive: "preventive medication",
  flea_tick_preventive: "preventive medication",
};
const REMINDER_VARIABLE_INTERVAL_CHOICES = {
  da2pp: [
    { months: 12, label: "1 year booster" },
    { months: 36, label: "3 year booster" },
  ],
  leptospirosis: [
    { months: 6, label: "6 months" },
    { months: 12, label: "1 year" },
  ],
  rabies: [
    { months: 12, label: "1 year booster" },
    { months: 36, label: "3 year booster" },
  ],
  influenza: [
    { months: 6, label: "6 months" },
    { months: 12, label: "1 year" },
  ],
};
const REMINDER_FIXED_INTERVAL_MONTHS = {
  bordetella: 6,
  heartworm_test: 12,
  fecal_test: 6,
  heartworm_preventive: 12,
  flea_tick_preventive: 12,
  fvrcp: 12,
  felv: 12,
};

function addMonthsToYmd(startDate, monthsToAdd) {
  const baseDate = new Date(`${startDate}T00:00:00`);
  if (Number.isNaN(baseDate.getTime())) return "";
  baseDate.setMonth(baseDate.getMonth() + monthsToAdd);
  return baseDate.toISOString().slice(0, 10);
}

function intervalMonthsBetweenYmd(startDate, endDate) {
  const startMatch = String(startDate || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const endMatch = String(endDate || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!startMatch || !endMatch) return 12;
  const startYear = Number.parseInt(startMatch[1], 10);
  const startMonth = Number.parseInt(startMatch[2], 10);
  const startDay = Number.parseInt(startMatch[3], 10);
  const endYear = Number.parseInt(endMatch[1], 10);
  const endMonth = Number.parseInt(endMatch[2], 10);
  const endDay = Number.parseInt(endMatch[3], 10);
  if (
    ![startYear, startMonth, startDay, endYear, endMonth, endDay].every(
      Number.isFinite,
    )
  )
    return 12;

  let months = (endYear - startYear) * 12 + (endMonth - startMonth);
  if (endDay < startDay) months -= 1;
  if (!Number.isFinite(months) || months < 1) return 1;
  return months;
}

function reminderRuleToIntervalMonths(recurrenceRule) {
  const normalizedRule =
    typeof recurrenceRule === "string"
      ? recurrenceRule.trim().toLowerCase()
      : String(recurrenceRule?.rule || recurrenceRule?.recurrenceRule || "")
          .trim()
          .toLowerCase();
  const intervalMonths = Number.parseInt(recurrenceRule?.intervalMonths, 10);
  const typeCode = String(recurrenceRule?.typeCode || "")
    .trim()
    .toLowerCase();
  const category = String(recurrenceRule?.category || "")
    .trim()
    .toLowerCase();

  if (normalizedRule === "custom months")
    return Number.isFinite(intervalMonths) && intervalMonths > 0
      ? intervalMonths
      : 12;
  if (normalizedRule === "monthly") return 1;
  if (normalizedRule === "yearly")
    return Number.isFinite(intervalMonths) && intervalMonths > 0
      ? intervalMonths
      : 12;
  if (["heartworm_preventive", "flea_tick_preventive"].includes(typeCode))
    return 1;
  if (Number.isFinite(intervalMonths) && intervalMonths > 0)
    return intervalMonths;
  if (["vaccine", "diagnostic test"].includes(category)) return 12;
  return 12;
}

function computeNextDueDate(lastCompletedDate, recurrenceRule) {
  if (!lastCompletedDate) return "";
  return addMonthsToYmd(
    lastCompletedDate,
    reminderRuleToIntervalMonths(recurrenceRule),
  );
}

function computeReminderStatus(dueDate, today = todayYmd()) {
  if (!dueDate) return "not due";
  const todayDate = new Date(`${today}T12:00:00`);
  const due = new Date(`${dueDate}T12:00:00`);
  if (Number.isNaN(todayDate.getTime()) || Number.isNaN(due.getTime()))
    return "not due";
  const msPerDay = 1000 * 60 * 60 * 24;
  const daysUntilDue = Math.round(
    (due.getTime() - todayDate.getTime()) / msPerDay,
  );

  if (daysUntilDue < -REMINDER_DUE_WINDOW_DAYS) return "overdue";
  if (daysUntilDue <= REMINDER_DUE_WINDOW_DAYS) return "due";
  if (daysUntilDue <= REMINDER_UPCOMING_WINDOW_DAYS) return "upcoming";
  return "not due";
}

function recomputeReminder(reminder, today = todayYmd()) {
  const nextDueDate =
    reminder.dueDate ||
    computeNextDueDate(reminder.lastCompletedDate, reminder);
  const currentStatus = String(reminder.status || "")
    .trim()
    .toLowerCase();
  if (currentStatus === "paused" || currentStatus === "declined") {
    return {
      ...reminder,
      dueDate: nextDueDate,
    };
  }
  return {
    ...reminder,
    dueDate: nextDueDate,
    status: computeReminderStatus(nextDueDate, today),
  };
}

function recomputePatientReminderStatuses(patient, today = todayYmd()) {
  if (!Array.isArray(patient?.preventiveReminders)) return;
  patient.preventiveReminders = patient.preventiveReminders.map((reminder) =>
    recomputeReminder(reminder, today),
  );
}

function recomputeAllReminderStatuses(today = todayYmd()) {
  for (const client of state.clients || []) {
    for (const patient of client.patients || [])
      recomputePatientReminderStatuses(patient, today);
  }
}

function completePreventiveReminder(
  reminder,
  completedDate = todayYmd(),
  today = todayYmd(),
) {
  const nextDueDate = computeNextDueDate(completedDate, reminder);
  return {
    ...reminder,
    lastCompletedDate: completedDate,
    dueDate: nextDueDate,
    status: computeReminderStatus(nextDueDate, today),
  };
}

function reminderTypeLabel(typeCode = "") {
  return (
    String(typeCode || "")
      .trim()
      .replace(/_/g, " ") || "reminder"
  );
}

function reminderCategoryForType(typeCode = "") {
  const normalized = String(typeCode || "")
    .trim()
    .toLowerCase();
  return REMINDER_TYPE_CATEGORY_MAP[normalized] || "follow-up visit";
}

async function chooseReminderCompletionIntervalMonths(reminderTypeCode) {
  const normalized = String(reminderTypeCode || "")
    .trim()
    .toLowerCase();
  const variableChoices = REMINDER_VARIABLE_INTERVAL_CHOICES[normalized];
  if (Array.isArray(variableChoices) && variableChoices.length) {
    const choice = await showConfirm(
      `Set next due interval for ${reminderTypeLabel(normalized)}.`,
      [
        ...variableChoices.map((item) => ({
          key: String(item.months),
          label: item.label,
        })),
        { key: "cancel", label: "Cancel" },
      ],
    );
    if (choice === "cancel") return null;
    const parsedMonths = Number.parseInt(choice, 10);
    if (!Number.isFinite(parsedMonths) || parsedMonths <= 0) return null;
    return parsedMonths;
  }
  const fixedMonths = Number.parseInt(
    REMINDER_FIXED_INTERVAL_MONTHS[normalized],
    10,
  );
  if (Number.isFinite(fixedMonths) && fixedMonths > 0) return fixedMonths;
  return 12;
}

function defaultReminderIntervalMonths(reminder) {
  const explicitInterval = Number.parseInt(reminder?.intervalMonths, 10);
  if (Number.isFinite(explicitInterval) && explicitInterval > 0)
    return explicitInterval;
  const typeCode = String(reminder?.typeCode || "")
    .trim()
    .toLowerCase();
  const fixedMonths = Number.parseInt(
    REMINDER_FIXED_INTERVAL_MONTHS[typeCode],
    10,
  );
  if (Number.isFinite(fixedMonths) && fixedMonths > 0) return fixedMonths;
  const variableChoices = REMINDER_VARIABLE_INTERVAL_CHOICES[typeCode];
  if (Array.isArray(variableChoices) && variableChoices.length) {
    const fallbackVariableMonths = Number.parseInt(
      variableChoices[0]?.months,
      10,
    );
    if (Number.isFinite(fallbackVariableMonths) && fallbackVariableMonths > 0)
      return fallbackVariableMonths;
  }
  return 12;
}

async function completeReminderWithRules(
  reminder,
  { completedDate = todayYmd() } = {},
) {
  const normalizedCompletedDate = /^\d{4}-\d{2}-\d{2}$/.test(
    String(completedDate || ""),
  )
    ? String(completedDate || "").slice(0, 10)
    : todayYmd();
  const normalizedTypeCode = String(reminder?.typeCode || "")
    .trim()
    .toLowerCase();
  const normalizedCategory = String(
    REMINDER_TYPE_CATEGORY_MAP[normalizedTypeCode] ||
      reminder?.category ||
      reminderCategoryForType(normalizedTypeCode),
  )
    .trim()
    .toLowerCase();

  if (normalizedCategory === "vaccine") {
    const fallbackIntervalMonths = defaultReminderIntervalMonths(reminder);
    const defaultDueDate =
      computeNextDueDate(normalizedCompletedDate, {
        ...reminder,
        recurrenceRule: recurrenceRuleFromIntervalMonths(
          fallbackIntervalMonths,
        ),
        intervalMonths: fallbackIntervalMonths,
      }) || addMonthsToYmd(normalizedCompletedDate, fallbackIntervalMonths);
    const selectedDueDate = await openReminderDueDateModal(
      defaultDueDate || normalizedCompletedDate,
    );
    if (!selectedDueDate) return null;
    const intervalMonths = intervalMonthsBetweenYmd(
      normalizedCompletedDate,
      selectedDueDate,
    );
    return {
      ...reminder,
      recurrenceRule: recurrenceRuleFromIntervalMonths(intervalMonths),
      intervalMonths,
      lastCompletedDate: normalizedCompletedDate,
      dueDate: selectedDueDate,
      status: computeReminderStatus(selectedDueDate),
    };
  }

  const intervalMonths = await chooseReminderCompletionIntervalMonths(
    reminder?.typeCode,
  );
  if (!intervalMonths) return null;
  return completePreventiveReminder(
    {
      ...reminder,
      recurrenceRule: recurrenceRuleFromIntervalMonths(intervalMonths),
      intervalMonths,
    },
    normalizedCompletedDate,
  );
}

function recurrenceRuleFromIntervalMonths(intervalMonths) {
  if (intervalMonths === 1) return "monthly";
  if (intervalMonths === 12) return "yearly";
  return "custom months";
}

function ensureReminderForType(
  patient,
  typeCode,
  category,
  anchorDate = todayYmd(),
) {
  if (!patient) return null;
  if (!Array.isArray(patient.preventiveReminders))
    patient.preventiveReminders = [];
  const normalizedTypeCode = String(typeCode || "")
    .trim()
    .toLowerCase();
  let reminder = patient.preventiveReminders.find(
    (item) => item.typeCode === normalizedTypeCode,
  );
  if (reminder) return reminder;
  const parsedCategory = String(category || "")
    .trim()
    .toLowerCase();
  reminder = migratePreventiveReminder(
    {
      patientId: patient.patientId,
      category: PREVENTIVE_REMINDER_CATEGORIES.includes(parsedCategory)
        ? parsedCategory
        : "follow-up visit",
      typeCode: normalizedTypeCode,
      speciesScope: ["dog", "cat"].includes(
        String(patient.species || "")
          .trim()
          .toLowerCase(),
      )
        ? String(patient.species || "")
            .trim()
            .toLowerCase()
        : "both",
      status: "active",
      dueDate: anchorDate,
      recurrenceRule: "yearly",
      intervalMonths: 12,
      ownerNotificationPreferences: { sms: false, email: false, inApp: true },
    },
    patient.patientId,
  );
  patient.preventiveReminders.push(reminder);
  return reminder;
}

function syncOrderDrivenReminderEffects(patient) {
  if (!patient) return;
  const mappedReminderTypes = new Set(Object.values(SERVICE_REMINDER_TYPE_MAP));
  const latestEventByType = {};

  for (const visit of patient.visits || []) {
    const visitDate = String(visit.visitDate || "").trim();
    if (!visitDate) continue;
    const payment = migrateVisitPayment(visit.payment || {});
    const paidInFull = payment.status === "paid";
    for (const orderItem of visit.orderedItems || []) {
      const reminderTypeCode = SERVICE_REMINDER_TYPE_MAP[orderItem.serviceCode];
      if (!reminderTypeCode) continue;
      const normalizedOrderItem = migrateVisitOrderItem(orderItem);
      if (normalizedOrderItem.status !== "declined" && !paidInFull) continue;
      const eventStatus =
        normalizedOrderItem.status === "declined" ? "declined" : "completed";
      const eventAt = `${visitDate}T${String(normalizedOrderItem.completedAt || normalizedOrderItem.orderedAt || "").slice(11, 19) || "00:00:00"}`;
      const existing = latestEventByType[reminderTypeCode];
      if (!existing || eventAt > existing.eventAt) {
        latestEventByType[reminderTypeCode] = {
          eventAt,
          visitDate,
          eventStatus,
          serviceCode: orderItem.serviceCode,
        };
      }
    }
  }

  if (!Array.isArray(patient.preventiveReminders))
    patient.preventiveReminders = [];
  patient.preventiveReminders = patient.preventiveReminders.map((reminder) => {
    if (!mappedReminderTypes.has(reminder.typeCode)) return reminder;
    const latestEvent = latestEventByType[reminder.typeCode];
    if (!latestEvent) return reminder;
    if (latestEvent.eventStatus === "declined") {
      return {
        ...reminder,
        lastCompletedDate: "",
        dueDate: "",
        status: "declined",
      };
    }
    const completed = completePreventiveReminder(
      reminder,
      latestEvent.visitDate,
    );
    return ["paused", "declined"].includes(reminder.status)
      ? { ...completed, status: reminder.status }
      : completed;
  });

  for (const [serviceCode, reminderTypeCode] of Object.entries(
    SERVICE_REMINDER_TYPE_MAP,
  )) {
    const latestEvent = latestEventByType[reminderTypeCode];
    if (!latestEvent) continue;
    const existingReminder = patient.preventiveReminders.find(
      (reminder) => reminder.typeCode === reminderTypeCode,
    );
    if (existingReminder) continue;
    const createdReminder = ensureReminderForType(
      patient,
      reminderTypeCode,
      reminderCategoryForService(serviceCode),
      latestEvent.visitDate,
    );
    if (!createdReminder) continue;
    patient.preventiveReminders = patient.preventiveReminders.map(
      (reminder) => {
        if (reminder.reminderId !== createdReminder.reminderId) return reminder;
        if (latestEvent.eventStatus === "declined")
          return {
            ...reminder,
            status: "declined",
            dueDate: "",
            lastCompletedDate: "",
          };
        return completePreventiveReminder(reminder, latestEvent.visitDate);
      },
    );
  }
}

function buildReminderFromTemplate(patient, template, anchorDate = todayYmd()) {
  const intervalMonths = Number.parseInt(template.intervalMonths, 10);
  return migratePreventiveReminder(
    {
      patientId: patient.patientId,
      category: template.category,
      typeCode: template.typeCode,
      speciesScope: template.speciesScope,
      status: "active",
      dueDate: addMonthsToYmd(anchorDate, intervalMonths),
      recurrenceRule: recurrenceRuleFromIntervalMonths(intervalMonths),
      intervalMonths,
      ownerNotificationPreferences: { sms: false, email: false, inApp: true },
      notes: `Auto-seeded from ${patient.species || "patient"} preventive protocol.`,
    },
    patient.patientId,
  );
}

function seedRemindersFromTemplateCatalog(
  patient,
  { forceReseed = false, anchorDate = todayYmd() } = {},
) {
  if (!patient) return;
  if (!Array.isArray(patient.preventiveReminders))
    patient.preventiveReminders = [];
  const normalizeValue = (value) =>
    String(value || "")
      .trim()
      .toLowerCase();
  const speciesKey = normalizeValue(patient.species);
  const templates = REMINDER_TEMPLATE_CATALOG[speciesKey];
  if (!templates?.length) return;

  if (forceReseed) {
    const templateTypeCodes = new Set(
      templates.map((template) => template.typeCode),
    );
    patient.preventiveReminders = patient.preventiveReminders.filter(
      (reminder) => !templateTypeCodes.has(normalizeValue(reminder.typeCode)),
    );
  }

  const existingTypeCodes = new Set(
    patient.preventiveReminders.map((reminder) =>
      normalizeValue(reminder.typeCode),
    ),
  );
  for (const template of templates) {
    if (existingTypeCodes.has(template.typeCode)) continue;
    patient.preventiveReminders.push(
      buildReminderFromTemplate(patient, template, anchorDate),
    );
    existingTypeCodes.add(template.typeCode);
  }
  recomputePatientReminderStatuses(patient);
}

function setPatientProtocolEnabled(patient, isEnabled, options = {}) {
  if (!patient) return;
  patient.protocolEnabled = Boolean(isEnabled);
  if (patient.protocolEnabled)
    seedRemindersFromTemplateCatalog(patient, options);
}

function migratePreventiveReminder(reminder = {}, patientId = "") {
  const category = String(reminder.category || "")
    .trim()
    .toLowerCase();
  const typeCode = String(reminder.typeCode || "")
    .trim()
    .toLowerCase();
  const speciesScope = String(reminder.speciesScope || "")
    .trim()
    .toLowerCase();
  const status = String(reminder.status || "")
    .trim()
    .toLowerCase();
  const recurrenceRule = String(reminder.recurrenceRule || "")
    .trim()
    .toLowerCase();
  return {
    reminderId: String(reminder.reminderId || crypto.randomUUID()),
    patientId: String(reminder.patientId || patientId || ""),
    category: PREVENTIVE_REMINDER_CATEGORIES.includes(category)
      ? category
      : "vaccine",
    typeCode: PREVENTIVE_REMINDER_TYPE_CODES.includes(typeCode)
      ? typeCode
      : PREVENTIVE_REMINDER_TYPE_CODES[0],
    speciesScope: PREVENTIVE_REMINDER_SPECIES_SCOPES.includes(speciesScope)
      ? speciesScope
      : "both",
    status: PREVENTIVE_REMINDER_STATUSES.includes(status) ? status : "active",
    lastCompletedDate: String(reminder.lastCompletedDate || ""),
    dueDate: String(reminder.dueDate || ""),
    recurrenceRule: PREVENTIVE_REMINDER_RECURRENCE_RULES.includes(
      recurrenceRule,
    )
      ? recurrenceRule
      : "yearly",
    intervalMonths:
      Number.parseInt(reminder.intervalMonths, 10) > 0
        ? Number.parseInt(reminder.intervalMonths, 10)
        : 12,
    ownerNotificationPreferences: {
      sms: Boolean(reminder.ownerNotificationPreferences?.sms),
      email: Boolean(reminder.ownerNotificationPreferences?.email),
      inApp: Boolean(reminder.ownerNotificationPreferences?.inApp),
    },
    notes: String(reminder.notes || ""),
  };
}

function migrateVisitOrderItem(orderItem = {}) {
  const fallbackService = SERVICE_CATALOG[0];
  const rawServiceCode = String(orderItem.serviceCode || "")
    .trim()
    .toLowerCase();
  const service =
    SERVICE_CATALOG.find((item) => item.serviceCode === rawServiceCode) ||
    fallbackService;
  const quantity = Number.parseFloat(orderItem.quantity);
  const unitPriceCentsRaw = Number.parseInt(orderItem.unitPriceCents, 10);
  const unitPriceCents =
    Number.isFinite(unitPriceCentsRaw) && unitPriceCentsRaw >= 0
      ? unitPriceCentsRaw
      : service.defaultUnitPriceCents;
  const rawStatus = String(orderItem.status || "")
    .trim()
    .toLowerCase();
  const status = rawStatus === "declined" ? "declined" : "completed";
  const resultText = String(
    orderItem.resultText || orderItem.result || orderItem.labResult || "",
  ).trim();
  return {
    orderItemId: String(orderItem.orderItemId || crypto.randomUUID()),
    serviceCode: service.serviceCode,
    status,
    quantity:
      Number.isFinite(quantity) && quantity > 0
        ? Number.parseFloat(quantity.toFixed(2))
        : 1,
    unitPriceCents,
    notes: String(orderItem.notes || "").trim(),
    resultText,
    resultEnteredAt: resultText
      ? String(
          orderItem.resultEnteredAt ||
            orderItem.resultAt ||
            orderItem.labResultAt ||
            "",
        ).trim()
      : "",
    orderedAt: String(orderItem.orderedAt || nowIso()),
    completedAt:
      status === "declined"
        ? ""
        : String(orderItem.completedAt || orderItem.orderedAt || nowIso()),
  };
}

function normalizeManualPaymentMethod(method) {
  const value = String(method || "")
    .trim()
    .toLowerCase();
  return ["cash", "card", "tap", "check", "other"].includes(value)
    ? value
    : "other";
}

function migrateManualPaymentEntry(entry = {}) {
  const amountCentsRaw = Number.parseInt(entry?.amountCents, 10);
  return {
    entryId: String(entry?.entryId || crypto.randomUUID()),
    amountCents:
      Number.isFinite(amountCentsRaw) && amountCentsRaw > 0
        ? amountCentsRaw
        : 0,
    method: normalizeManualPaymentMethod(entry?.method),
    note: String(entry?.note || "").trim(),
    at: String(entry?.at || nowIso()),
  };
}

function normalizeEstimateStatus(status) {
  const value = String(status || "")
    .trim()
    .toLowerCase();
  return ["draft", "approved", "declined"].includes(value) ? value : "draft";
}

function migrateVisitEstimate(estimate = {}, currentSubtotalCents = 0) {
  const amountRaw = Number.parseInt(estimate?.amountCents, 10);
  const amountCents =
    Number.isFinite(amountRaw) && amountRaw >= 0
      ? amountRaw
      : Math.max(0, currentSubtotalCents);
  return {
    status: normalizeEstimateStatus(estimate?.status),
    amountCents,
    preparedAt: String(estimate?.preparedAt || ""),
    approvedAt: String(estimate?.approvedAt || ""),
    declinedAt: String(estimate?.declinedAt || ""),
    note: String(estimate?.note || "").trim(),
  };
}

function estimateStatusLabel(status) {
  const value = normalizeEstimateStatus(status);
  if (value === "approved") return "Approved";
  if (value === "declined") return "Declined";
  return "Draft";
}

function syncVisitEstimateWithCharges(visit, { reason = "" } = {}) {
  if (!visit) return { changed: false, needsApproval: false };
  const subtotalCents = visitSubtotalFromVisitCents(visit);
  const estimate = migrateVisitEstimate(visit.estimate || {}, subtotalCents);
  const changed = estimate.amountCents !== subtotalCents;
  if (changed) {
    estimate.amountCents = subtotalCents;
    if (estimate.status !== "draft") {
      estimate.status = "draft";
      estimate.approvedAt = "";
      estimate.declinedAt = "";
      const reasonText = String(
        reason || "Charges changed. Re-approval required.",
      ).trim();
      estimate.note = reasonText;
    }
  }
  visit.estimate = estimate;
  return {
    changed,
    needsApproval: estimate.status !== "approved",
  };
}

function migrateVisitPayment(payment = {}) {
  const statusRaw = String(payment?.status || "")
    .trim()
    .toLowerCase();
  const methodRaw = String(payment?.method || "")
    .trim()
    .toLowerCase();
  const status = ["unpaid", "pending", "paid", "failed", "canceled"].includes(
    statusRaw,
  )
    ? statusRaw
    : "unpaid";
  const method = ["web", "terminal", "manual"].includes(methodRaw)
    ? methodRaw
    : "";
  const amountPaidRaw = Number.parseInt(payment?.amountPaidCents, 10);
  const requestedAmountRaw = Number.parseInt(payment?.requestedAmountCents, 10);
  const manualEntries = Array.isArray(payment?.manualEntries)
    ? payment.manualEntries
        .map((entry) => migrateManualPaymentEntry(entry))
        .filter((entry) => entry.amountCents > 0)
    : [];
  const sumManualEntries = manualEntries.reduce(
    (sum, entry) => sum + entry.amountCents,
    0,
  );
  const amountPaidCents =
    Number.isFinite(amountPaidRaw) && amountPaidRaw >= 0
      ? amountPaidRaw
      : sumManualEntries;
  const requestedAmountCents =
    Number.isFinite(requestedAmountRaw) && requestedAmountRaw >= 0
      ? requestedAmountRaw
      : 0;
  let normalizedStatus = status;
  if (requestedAmountCents > 0 && amountPaidCents >= requestedAmountCents)
    normalizedStatus = "paid";
  else if (amountPaidCents > 0 && normalizedStatus === "unpaid")
    normalizedStatus = "pending";
  return {
    status: normalizedStatus,
    method,
    amountPaidCents,
    requestedAmountCents,
    squarePaymentId: String(payment?.squarePaymentId || "").trim(),
    squareReceiptUrl: String(payment?.squareReceiptUrl || "").trim(),
    squareTerminalCheckoutId: String(
      payment?.squareTerminalCheckoutId || "",
    ).trim(),
    terminalDeviceId: String(payment?.terminalDeviceId || "").trim(),
    updatedAt: String(payment?.updatedAt || ""),
    manualEntries,
  };
}

function migrateVisit(visit = {}) {
  const orderedItems = Array.isArray(visit.orderedItems)
    ? visit.orderedItems.map((orderItem) => migrateVisitOrderItem(orderItem))
    : [];
  const subtotalCents = visitOrderSubtotalCents(
    orderedItems.filter((orderItem) => orderItem.status !== "declined"),
  );
  const estimate = migrateVisitEstimate(visit.estimate || {}, subtotalCents);
  if (estimate.amountCents !== subtotalCents) {
    estimate.amountCents = subtotalCents;
    if (estimate.status === "approved") {
      estimate.status = "draft";
      estimate.approvedAt = "";
      estimate.note = "Charges changed. Re-approval required.";
    }
  }
  return {
    ...visit,
    orderedItems,
    estimate,
    payment: migrateVisitPayment(visit.payment || {}),
  };
}

function normalizeInventoryAdjustment(adjustment = {}) {
  const deltaQty = Number.parseFloat(adjustment.deltaQty);
  return {
    adjustmentId: String(adjustment.adjustmentId || crypto.randomUUID()),
    at: String(adjustment.at || nowIso()),
    deltaQty: Number.isFinite(deltaQty)
      ? Number.parseFloat(deltaQty.toFixed(2))
      : 0,
    reason: String(adjustment.reason || "").trim(),
    actor: String(adjustment.actor || "User"),
  };
}

function normalizeInventoryItem(item = {}) {
  const onHandQty = Number.parseFloat(item.onHandQty);
  const reorderLevel = Number.parseFloat(item.reorderLevel);
  const unitCostCents = Number.isFinite(Number(item.unitCostCents))
    ? Number.parseInt(item.unitCostCents, 10)
    : (dollarsToCents(item.unitCost) ?? 0);
  return {
    itemId: String(item.itemId || crypto.randomUUID()),
    name: String(item.name || "").trim(),
    sku: String(item.sku || "").trim(),
    lotNumber: String(item.lotNumber || "").trim(),
    expirationDate: String(item.expirationDate || ""),
    unit: String(item.unit || "").trim() || "unit",
    onHandQty: Number.isFinite(onHandQty)
      ? Number.parseFloat(onHandQty.toFixed(2))
      : 0,
    reorderLevel: Number.isFinite(reorderLevel)
      ? Number.parseFloat(reorderLevel.toFixed(2))
      : 0,
    unitCostCents:
      Number.isFinite(unitCostCents) && unitCostCents >= 0 ? unitCostCents : 0,
    controlled: Boolean(item.controlled),
    deaSchedule: String(item.deaSchedule || "")
      .trim()
      .toUpperCase(),
    adjustments: Array.isArray(item.adjustments)
      ? item.adjustments.map((adjustment) =>
          normalizeInventoryAdjustment(adjustment),
        )
      : [],
  };
}

function normalizeMedicalNote(note) {
  if (typeof note === "string") {
    return {
      noteId: crypto.randomUUID(),
      text: note.trim(),
      notedAt: nowIso(),
      createdBy: "User",
    };
  }
  return {
    noteId: String(note?.noteId || crypto.randomUUID()),
    text: String(note?.text || note?.note || "").trim(),
    notedAt: String(note?.notedAt || note?.createdAt || nowIso()),
    createdBy: String(note?.createdBy || "User"),
  };
}

function getPrimaryContact(client) {
  return (
    (client.contacts || []).find((contact) => contact.isPrimary) ||
    client.contacts?.[0] ||
    null
  );
}

function computeAgeFromDateOfBirth(dateOfBirth, referenceDate = new Date()) {
  if (!dateOfBirth) return "";
  const dob = new Date(`${dateOfBirth}T00:00:00`);
  if (Number.isNaN(dob.getTime())) return "";
  const ref = new Date(referenceDate);
  let age = ref.getFullYear() - dob.getFullYear();
  const monthDiff = ref.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && ref.getDate() < dob.getDate()))
    age -= 1;
  return age < 0 ? "" : String(age);
}

function computeDateOfBirthFromAge(age, referenceDate = new Date()) {
  const years = Number.parseInt(age, 10);
  if (!Number.isFinite(years) || years < 0) return "";
  const ref = new Date(referenceDate);
  ref.setFullYear(ref.getFullYear() - years);
  return ref.toISOString().slice(0, 10);
}

function migrateClient(client = {}) {
  const migratedContacts = Array.isArray(client.contacts)
    ? client.contacts.map((contact, index) => ({
        name: String(contact?.name || "").trim(),
        phone: String(contact?.phone || "").replace(/\D/g, ""),
        isPrimary:
          Boolean(contact?.isPrimary) &&
          index === client.contacts.findIndex((c) => c?.isPrimary),
      }))
    : [];
  if (!migratedContacts.length && client.phoneNumber) {
    migratedContacts.push({
      name: `${client.firstName || ""} ${client.lastName || ""}`.trim(),
      phone: String(client.phoneNumber || "").replace(/\D/g, ""),
      isPrimary: true,
    });
  }
  if (migratedContacts.length && !migratedContacts.some((c) => c.isPrimary))
    migratedContacts[0].isPrimary = true;
  if (migratedContacts.length > 1) {
    let found = false;
    migratedContacts.forEach((contact) => {
      if (contact.isPrimary && !found) found = true;
      else contact.isPrimary = false;
    });
  }
  return {
    ...client,
    contacts: migratedContacts,
    patients: Array.isArray(client.patients)
      ? client.patients.map((patient) => ({
          ...patient,
          protocolEnabled:
            patient.protocolEnabled === undefined
              ? Boolean(
                  Array.isArray(patient.preventiveReminders) &&
                  patient.preventiveReminders.length,
                )
              : Boolean(patient.protocolEnabled),
          breed: patient.breed || "",
          dateOfBirth: patient.dateOfBirth || "",
          age: patient.age || "",
          medicalNotes: Array.isArray(patient.medicalNotes)
            ? patient.medicalNotes
                .map((note) => normalizeMedicalNote(note))
                .filter((note) => note.text)
            : [],
          priorRecords: Array.isArray(patient.priorRecords)
            ? patient.priorRecords
            : [],
          preventiveReminders: Array.isArray(patient.preventiveReminders)
            ? patient.preventiveReminders
                .filter(
                  (reminder) =>
                    String(reminder?.typeCode || "")
                      .trim()
                      .toLowerCase() !== "next_visit",
                )
                .map((reminder) =>
                  migratePreventiveReminder(reminder, patient.patientId),
                )
            : [],
          visits: Array.isArray(patient.visits)
            ? patient.visits.map((visit) => migrateVisit(visit))
            : [],
        }))
      : [],
  };
}

function normalizePatients(client) {
  if (!Array.isArray(client?.patients)) return;
  client.patients.forEach((patient) => {
    if (!Array.isArray(patient.medicalNotes)) patient.medicalNotes = [];
    else
      patient.medicalNotes = patient.medicalNotes
        .map((note) => normalizeMedicalNote(note))
        .filter((note) => note.text);
    if (!Array.isArray(patient.priorRecords)) patient.priorRecords = [];
    if (!Array.isArray(patient.preventiveReminders))
      patient.preventiveReminders = [];
    else {
      patient.preventiveReminders = patient.preventiveReminders
        .filter(
          (reminder) =>
            String(reminder?.typeCode || "")
              .trim()
              .toLowerCase() !== "next_visit",
        )
        .map((reminder) =>
          migratePreventiveReminder(reminder, patient.patientId),
        );
    }
    if (patient.protocolEnabled) seedRemindersFromTemplateCatalog(patient);
    recomputePatientReminderStatuses(patient);
    if (!Array.isArray(patient.visits)) patient.visits = [];
    patient.visits = patient.visits.map((visit) => migrateVisit(visit));
  });
}

function estimateBytes(value) {
  return new Blob([String(value || "")]).size;
}

function openAttachmentDb() {
  if (attachmentDbPromise) return attachmentDbPromise;
  attachmentDbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(ATTACHMENT_DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(ATTACHMENT_STORE_NAME))
        db.createObjectStore(ATTACHMENT_STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error || new Error("Failed to open attachment database."));
  });
  return attachmentDbPromise;
}

function openAppStateDb() {
  if (appStateDbPromise) return appStateDbPromise;
  appStateDbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(APP_STATE_DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(APP_STATE_STORE_NAME))
        db.createObjectStore(APP_STATE_STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error || new Error("Failed to open app state database."));
  });
  return appStateDbPromise;
}

async function putAppState(serializedState) {
  if (typeof serializedState !== "string" || !serializedState) return;
  const db = await openAppStateDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(APP_STATE_STORE_NAME, "readwrite");
    tx.objectStore(APP_STATE_STORE_NAME).put(
      serializedState,
      APP_STATE_RECORD_KEY,
    );
    tx.oncomplete = () => resolve();
    tx.onerror = () =>
      reject(tx.error || new Error("Failed writing app state."));
    tx.onabort = () =>
      reject(tx.error || new Error("App state write aborted."));
  });
}

async function getAppState() {
  const db = await openAppStateDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(APP_STATE_STORE_NAME, "readonly");
    const req = tx.objectStore(APP_STATE_STORE_NAME).get(APP_STATE_RECORD_KEY);
    req.onsuccess = () =>
      resolve(typeof req.result === "string" ? req.result : "");
    req.onerror = () =>
      reject(req.error || new Error("Failed reading app state."));
  });
}

async function putAttachmentBlob(blobKey, blob) {
  if (!blobKey || !blob) return;
  const db = await openAttachmentDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(ATTACHMENT_STORE_NAME, "readwrite");
    tx.objectStore(ATTACHMENT_STORE_NAME).put(blob, blobKey);
    tx.oncomplete = () => resolve();
    tx.onerror = () =>
      reject(tx.error || new Error("Failed writing attachment blob."));
    tx.onabort = () =>
      reject(tx.error || new Error("Attachment blob write aborted."));
  });
}

async function getAttachmentBlob(blobKey) {
  if (!blobKey) return null;
  const db = await openAttachmentDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(ATTACHMENT_STORE_NAME, "readonly");
    const req = tx.objectStore(ATTACHMENT_STORE_NAME).get(blobKey);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () =>
      reject(req.error || new Error("Failed reading attachment blob."));
  });
}

async function deleteAttachmentBlob(blobKey) {
  if (!blobKey) return;
  const db = await openAttachmentDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(ATTACHMENT_STORE_NAME, "readwrite");
    tx.objectStore(ATTACHMENT_STORE_NAME).delete(blobKey);
    tx.oncomplete = () => resolve();
    tx.onerror = () =>
      reject(tx.error || new Error("Failed deleting attachment blob."));
    tx.onabort = () =>
      reject(tx.error || new Error("Attachment blob delete aborted."));
  });
}

function attachmentBlobKeyFor(attachment) {
  if (!attachment) return null;
  if (attachment.blobKey) return attachment.blobKey;
  if (attachment.attachmentId) return `att:${attachment.attachmentId}`;
  return null;
}

function normalizeAttachmentMetadata(attachment = {}) {
  return {
    attachmentId: String(attachment.attachmentId || crypto.randomUUID()),
    name: String(attachment.name || "Attachment"),
    type: String(attachment.type || "application/octet-stream"),
    linkedAt: attachment.linkedAt || nowIso(),
    blobKey: attachment.blobKey || attachmentBlobKeyFor(attachment),
  };
}

async function deleteAttachmentCollection(attachments = []) {
  for (const attachment of attachments) {
    await deleteAttachmentBlob(
      attachment?.blobKey || attachmentBlobKeyFor(attachment),
    );
  }
  return true;
}

async function deletePatientAttachmentBlobs(patient) {
  await deleteAttachmentCollection(patient?.priorRecords || []);
  for (const visit of patient?.visits || [])
    await deleteAttachmentCollection(visit.attachments || []);
}

async function deleteClientAttachmentBlobs(client) {
  for (const patient of client?.patients || [])
    await deletePatientAttachmentBlobs(patient);
}

function collectAttachmentMetadataAndLegacyPayloads(stateObject) {
  const legacyPayloads = [];
  const migrateList = (attachments = []) =>
    attachments.map((attachment) => {
      const next = normalizeAttachmentMetadata(attachment);
      if (typeof attachment?.data === "string" && attachment.data) {
        if (attachment.data.length > LEGACY_INLINE_DATA_MAX_CHARS) {
          pendingMigrationWarnings.push(
            `Skipped oversized legacy attachment "${next.name}" (${Math.round(attachment.data.length / 1024)} KB inline). Re-upload this file if needed.`,
          );
        } else {
          legacyPayloads.push({
            blobKey: next.blobKey,
            dataUrl: attachment.data,
            type: next.type,
            name: next.name,
          });
        }
      }
      return next;
    });

  for (const client of stateObject.clients || []) {
    for (const patient of client.patients || []) {
      patient.priorRecords = migrateList(patient.priorRecords || []);
      for (const visit of patient.visits || [])
        visit.attachments = migrateList(visit.attachments || []);
    }
  }
  if (stateObject.visitDraft?.attachments)
    stateObject.visitDraft.attachments = migrateList(
      stateObject.visitDraft.attachments || [],
    );
  return legacyPayloads;
}

async function fileToData(fileOrBlob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(fileOrBlob);
  });
}

async function resolveAttachmentDataUrl(attachment) {
  if (attachment?.data) return attachment.data;
  const blob = await getAttachmentBlob(
    attachment?.blobKey || attachmentBlobKeyFor(attachment),
  );
  if (!blob) return "";
  return fileToData(blob);
}

function attachmentName(attachment = {}) {
  const value = String(attachment?.name || "Attachment").trim();
  return value || "Attachment";
}

function attachmentMimeType(attachment = {}, blob = null) {
  return String(attachment?.type || blob?.type || "")
    .trim()
    .toLowerCase();
}

function isPdfAttachment(attachment = {}, blob = null) {
  const mime = attachmentMimeType(attachment, blob);
  const name = attachmentName(attachment).toLowerCase();
  return mime === "application/pdf" || name.endsWith(".pdf");
}

function isImageAttachment(attachment = {}, blob = null) {
  return attachmentMimeType(attachment, blob).startsWith("image/");
}

function isLikelyTextAttachment(attachment = {}, blob = null) {
  const mime = attachmentMimeType(attachment, blob);
  const name = attachmentName(attachment).toLowerCase();
  if (mime.startsWith("text/")) return true;
  if (
    mime.includes("json") ||
    mime.includes("xml") ||
    mime.includes("yaml") ||
    mime.includes("csv")
  )
    return true;
  return [
    ".txt",
    ".md",
    ".csv",
    ".json",
    ".xml",
    ".yaml",
    ".yml",
    ".log",
    ".rtf",
  ].some((ext) => name.endsWith(ext));
}

function normalizeAiAttachmentText(value, maxChars) {
  const cleaned = String(value || "")
    .replace(/\u0000/g, "")
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (!Number.isFinite(maxChars) || maxChars <= 0) return "";
  if (cleaned.length <= maxChars) return cleaned;
  return `${cleaned.slice(0, maxChars).trimEnd()}\n[truncated]`;
}

function collectClientAttachmentRecords(client) {
  const rows = [];
  for (const patient of client?.patients || []) {
    for (const attachment of patient?.priorRecords || []) {
      rows.push({
        attachment,
        patientName: String(patient?.name || "Unknown patient"),
        sourceLabel: "Prior record",
        linkedAt: attachment?.linkedAt || "",
      });
    }
    for (const visit of patient?.visits || []) {
      for (const attachment of visit?.attachments || []) {
        rows.push({
          attachment,
          patientName: String(patient?.name || "Unknown patient"),
          sourceLabel: `Visit ${visit?.visitDate || "unknown"}`,
          linkedAt:
            attachment?.linkedAt || visit?.visitDate || visit?.createdAt || "",
        });
      }
    }
  }
  return rows.sort(
    (a, b) =>
      String(b?.linkedAt || "").localeCompare(String(a?.linkedAt || "")) ||
      attachmentName(a?.attachment).localeCompare(
        attachmentName(b?.attachment),
      ),
  );
}

function buildClientAttachmentFingerprint(client) {
  return collectClientAttachmentRecords(client)
    .map((row) =>
      [
        row.attachment?.blobKey || attachmentBlobKeyFor(row.attachment) || "",
        row.attachment?.name || "",
        row.attachment?.type || "",
        row.linkedAt || "",
        row.patientName || "",
        row.sourceLabel || "",
      ].join("|"),
    )
    .join("||");
}

function setClientAttachmentAiCache(cacheKey, fingerprint, payload) {
  clientAttachmentAiCache.set(cacheKey, {
    fingerprint,
    attachmentContext: String(payload?.attachmentContext || ""),
    attachmentImages: Array.isArray(payload?.attachmentImages)
      ? payload.attachmentImages
          .map((image) => ({
            name: String(image?.name || "image"),
            mimeType: String(image?.mimeType || "image/jpeg"),
            dataUrl: String(image?.dataUrl || ""),
          }))
          .filter((image) => image.dataUrl)
      : [],
    attachmentDocuments: Array.isArray(payload?.attachmentDocuments)
      ? payload.attachmentDocuments
          .map((document) => ({
            name: String(document?.name || "attachment.pdf"),
            mimeType: "application/pdf",
            dataUrl: String(document?.dataUrl || ""),
          }))
          .filter((document) => document.dataUrl)
      : [],
  });
  while (clientAttachmentAiCache.size > 12) {
    const firstKey = clientAttachmentAiCache.keys().next().value;
    if (!firstKey) break;
    clientAttachmentAiCache.delete(firstKey);
  }
}

async function loadPdfLibrary() {
  if (window.pdfjsLib) {
    if (window.pdfjsLib.GlobalWorkerOptions)
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_CDN_URL;
    return window.pdfjsLib;
  }
  if (!pdfJsLoadPromise) {
    pdfJsLoadPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector(
        'script[data-pdfjs-loader="true"]',
      );
      const onLoad = () => {
        if (!window.pdfjsLib) {
          reject(new Error("PDF parser loaded but unavailable."));
          return;
        }
        resolve(window.pdfjsLib);
      };
      if (existing) {
        if (window.pdfjsLib) {
          resolve(window.pdfjsLib);
          return;
        }
        existing.addEventListener("load", onLoad, { once: true });
        existing.addEventListener(
          "error",
          () => reject(new Error("Failed to load PDF parser.")),
          { once: true },
        );
        return;
      }
      const script = document.createElement("script");
      script.src = PDFJS_CDN_URL;
      script.async = true;
      script.dataset.pdfjsLoader = "true";
      script.addEventListener("load", onLoad, { once: true });
      script.addEventListener(
        "error",
        () => reject(new Error("Failed to load PDF parser.")),
        { once: true },
      );
      document.head.appendChild(script);
    });
  }
  try {
    const lib = await pdfJsLoadPromise;
    if (lib?.GlobalWorkerOptions)
      lib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_CDN_URL;
    return lib;
  } catch (error) {
    pdfJsLoadPromise = null;
    throw error;
  }
}

async function extractPdfTextForAi(blob, maxChars) {
  if (!blob || typeof blob.arrayBuffer !== "function") return "";
  const pdfjs = await loadPdfLibrary();
  const buffer = await blob.arrayBuffer();
  const loadingTask = pdfjs.getDocument({ data: buffer });
  let pdfDocument = null;
  try {
    pdfDocument = await loadingTask.promise;
    const sections = [];
    for (
      let pageNumber = 1;
      pageNumber <=
      Math.min(pdfDocument.numPages || 0, AI_ATTACHMENT_MAX_PDF_PAGES);
      pageNumber += 1
    ) {
      const used = sections.join("\n").length;
      const remaining = Math.max(0, maxChars - used);
      if (remaining <= 80) break;
      const page = await pdfDocument.getPage(pageNumber);
      const textContent = await page.getTextContent();
      const rawText = textContent.items
        .map((item) => String(item?.str || ""))
        .join(" ");
      const pageText = normalizeAiAttachmentText(rawText, remaining);
      if (pageText) sections.push(`Page ${pageNumber}: ${pageText}`);
    }
    return normalizeAiAttachmentText(sections.join("\n"), maxChars);
  } finally {
    try {
      if (pdfDocument?.destroy) await pdfDocument.destroy();
      else if (loadingTask?.destroy) loadingTask.destroy();
    } catch {}
  }
}

async function extractTextAttachmentForAi(blob, maxChars) {
  if (!blob || typeof blob.slice !== "function") return "";
  const raw = await blob.slice(0, AI_ATTACHMENT_TEXT_READ_BYTES).text();
  return normalizeAiAttachmentText(raw, maxChars);
}

function normalizePdfDataUrl(dataUrl) {
  const value = String(dataUrl || "").trim();
  if (!value.includes(";base64,")) return "";
  if (value.startsWith("data:application/pdf;base64,")) return value;
  const [, encoded = ""] = value.split(";base64,");
  if (!encoded) return "";
  return `data:application/pdf;base64,${encoded}`;
}

async function imageBlobToAiDataUrl(blob) {
  if (!blob) return "";
  let objectUrl = "";
  let imageBitmap = null;
  try {
    let source = null;
    let width = 0;
    let height = 0;
    if (typeof createImageBitmap === "function") {
      imageBitmap = await createImageBitmap(blob);
      source = imageBitmap;
      width = imageBitmap.width;
      height = imageBitmap.height;
    } else {
      objectUrl = URL.createObjectURL(blob);
      source = await new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () =>
          reject(new Error("Could not decode image attachment."));
        image.src = objectUrl;
      });
      width = source.naturalWidth || source.width;
      height = source.naturalHeight || source.height;
    }
    if (!source || !width || !height) return "";
    const scale = Math.min(
      1,
      AI_ATTACHMENT_IMAGE_MAX_DIMENSION / Math.max(width, height),
    );
    const targetWidth = Math.max(1, Math.round(width * scale));
    const targetHeight = Math.max(1, Math.round(height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) return "";
    context.drawImage(source, 0, 0, targetWidth, targetHeight);
    const dataUrl = canvas.toDataURL(
      "image/jpeg",
      AI_ATTACHMENT_IMAGE_JPEG_QUALITY,
    );
    if (!dataUrl.startsWith("data:image/")) return "";
    if (dataUrl.length > AI_ATTACHMENT_MAX_IMAGE_DATA_URL_CHARS) return "";
    return dataUrl;
  } catch {
    try {
      const fallbackDataUrl = await fileToData(blob);
      if (fallbackDataUrl.length <= AI_ATTACHMENT_MAX_IMAGE_DATA_URL_CHARS)
        return fallbackDataUrl;
    } catch {}
    return "";
  } finally {
    if (imageBitmap?.close) imageBitmap.close();
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
}

async function buildClientAttachmentAiInput(client) {
  const cacheKey = clientAiKey(client?.clientId);
  if (!cacheKey)
    return {
      attachmentContext: "",
      attachmentImages: [],
      attachmentDocuments: [],
    };
  const fingerprint = buildClientAttachmentFingerprint(client);
  const cached = clientAttachmentAiCache.get(cacheKey);
  if (cached?.fingerprint === fingerprint) {
    return {
      attachmentContext: cached.attachmentContext,
      attachmentImages: cached.attachmentImages.map((image) => ({ ...image })),
      attachmentDocuments: Array.isArray(cached.attachmentDocuments)
        ? cached.attachmentDocuments.map((document) => ({ ...document }))
        : [],
    };
  }

  const allRows = collectClientAttachmentRecords(client);
  if (!allRows.length) {
    const empty = {
      attachmentContext: "",
      attachmentImages: [],
      attachmentDocuments: [],
    };
    setClientAttachmentAiCache(cacheKey, fingerprint, empty);
    return empty;
  }

  const rows = allRows.slice(0, AI_ATTACHMENT_MAX_FILES);
  const textSections = [];
  const imageSections = [];
  const documentSections = [];
  let pdfSeenCount = 0;
  let pdfUploadSkippedCount = 0;
  let remainingChars = AI_ATTACHMENT_MAX_TEXT_CHARS;

  for (const row of rows) {
    const attachment = row.attachment || {};
    const blobKey = attachment?.blobKey || attachmentBlobKeyFor(attachment);
    if (!blobKey) continue;
    let blob = null;
    try {
      blob = await getAttachmentBlob(blobKey);
    } catch {
      blob = null;
    }
    if (!blob) continue;

    const name = attachmentName(attachment);
    const sourceLine = `${row.patientName} | ${row.sourceLabel}`;
    const perFileCharLimit = Math.min(
      remainingChars,
      AI_ATTACHMENT_MAX_TEXT_PER_FILE_CHARS,
    );
    const pdfAttachment = isPdfAttachment(attachment, blob);

    if (perFileCharLimit > 80 && pdfAttachment) {
      try {
        const pdfText = await extractPdfTextForAi(blob, perFileCharLimit);
        if (pdfText) {
          textSections.push(`Attachment: ${name} (${sourceLine})\n${pdfText}`);
          remainingChars = Math.max(0, remainingChars - pdfText.length);
        }
      } catch {}
    } else if (
      perFileCharLimit > 80 &&
      isLikelyTextAttachment(attachment, blob)
    ) {
      try {
        const text = await extractTextAttachmentForAi(blob, perFileCharLimit);
        if (text) {
          textSections.push(`Attachment: ${name} (${sourceLine})\n${text}`);
          remainingChars = Math.max(0, remainingChars - text.length);
        }
      } catch {}
    }

    if (pdfAttachment) {
      pdfSeenCount += 1;
      if (documentSections.length < AI_ATTACHMENT_MAX_PDF_FILES) {
        try {
          const rawDataUrl = await fileToData(blob);
          const dataUrl = normalizePdfDataUrl(rawDataUrl);
          if (
            dataUrl &&
            dataUrl.length <= AI_ATTACHMENT_MAX_PDF_DATA_URL_CHARS
          ) {
            documentSections.push({
              name,
              mimeType: "application/pdf",
              dataUrl,
            });
          } else {
            pdfUploadSkippedCount += 1;
          }
        } catch {
          pdfUploadSkippedCount += 1;
        }
      }
    }

    if (
      imageSections.length < AI_ATTACHMENT_MAX_IMAGES &&
      isImageAttachment(attachment, blob)
    ) {
      const dataUrl = await imageBlobToAiDataUrl(blob);
      if (dataUrl) {
        imageSections.push({
          name,
          mimeType: "image/jpeg",
          dataUrl,
        });
      }
    }
  }

  const contextParts = [];
  if (textSections.length)
    contextParts.push(`Attachment excerpts:\n${textSections.join("\n\n")}`);
  const skippedCount = Math.max(0, allRows.length - rows.length);
  if (skippedCount > 0)
    contextParts.push(
      `Note: ${skippedCount} additional attachment(s) were not scanned due to limits.`,
    );
  const additionalPdfSkippedByLimit = Math.max(
    0,
    pdfSeenCount - documentSections.length - pdfUploadSkippedCount,
  );
  if (additionalPdfSkippedByLimit > 0) {
    contextParts.push(
      `Note: ${additionalPdfSkippedByLimit} PDF attachment(s) were not sent as full files due to limits.`,
    );
  }
  if (pdfUploadSkippedCount > 0) {
    contextParts.push(
      `Note: ${pdfUploadSkippedCount} PDF attachment(s) were too large or unreadable to send as full files.`,
    );
  }
  const payload = {
    attachmentContext: contextParts.join("\n\n"),
    attachmentImages: imageSections,
    attachmentDocuments: documentSections,
  };
  setClientAttachmentAiCache(cacheKey, fingerprint, payload);
  return payload;
}

async function persistLegacyAttachmentMigrations() {
  if (!pendingLegacyAttachmentMigrations.length) return false;
  const work = [...pendingLegacyAttachmentMigrations];
  pendingLegacyAttachmentMigrations = [];
  for (const item of work) {
    try {
      const response = await fetch(item.dataUrl);
      const blob = await response.blob();
      await putAttachmentBlob(item.blobKey, blob);
    } catch {
      pendingMigrationWarnings.push(
        `Could not migrate legacy attachment "${item.name}". Please re-upload it.`,
      );
    }
  }
  return true;
}

function deserializeStatePayload(rawOrParsed) {
  if (!rawOrParsed) return null;
  try {
    const parsed =
      typeof rawOrParsed === "string" ? JSON.parse(rawOrParsed) : rawOrParsed;
    const merged = {
      ...structuredClone(baseState),
      ...parsed,
      visitDraft: null,
      pendingNavigation: null,
    };
    merged.inventoryItems = Array.isArray(merged.inventoryItems)
      ? merged.inventoryItems
          .map((item) => normalizeInventoryItem(item))
          .filter((item) => item.name)
      : [];
    merged.clients = (merged.clients || []).map(migrateClient);
    merged.clients.forEach(normalizePatients);
    if (!merged.aiChatsByClient || typeof merged.aiChatsByClient !== "object")
      merged.aiChatsByClient = {};
    if (
      !merged.activeAiChatByClient ||
      typeof merged.activeAiChatByClient !== "object"
    )
      merged.activeAiChatByClient = {};
    for (const [key, chats] of Object.entries(merged.aiChatsByClient)) {
      const normalized = Array.isArray(chats)
        ? chats.map((chat, index) => ({
            chatId: String(chat?.chatId || crypto.randomUUID()),
            title: String(chat?.title || `Chat ${index + 1}`),
            createdAt: String(chat?.createdAt || nowIso()),
            messages: Array.isArray(chat?.messages)
              ? chat.messages
                  .map((message) => ({
                    role:
                      String(message?.role || "").toLowerCase() === "assistant"
                        ? "assistant"
                        : "user",
                    content: String(message?.content || "").trim(),
                    model: String(message?.model || "").trim(),
                    at: String(message?.at || nowIso()),
                  }))
                  .filter((message) => message.content)
              : [],
          }))
        : [];
      merged.aiChatsByClient[key] = normalized;
    }
    pendingLegacyAttachmentMigrations =
      collectAttachmentMetadataAndLegacyPayloads(merged);
    return merged;
  } catch {
    return null;
  }
}

function toFreshnessMetadata(payload) {
  const savedAtMs = Date.parse(payload?.savedAt || "");
  return {
    stateVersion: Number.isFinite(Number(payload?.stateVersion))
      ? Number(payload.stateVersion)
      : 0,
    savedAtMs: Number.isFinite(savedAtMs) ? savedAtMs : 0,
  };
}

function compareFreshness(a, b) {
  if (!a) return -1;
  if (!b) return 1;
  if (a.stateVersion !== b.stateVersion) return a.stateVersion - b.stateVersion;
  return a.savedAtMs - b.savedAtMs;
}

function serializeStatePayload() {
  stateVersionCounter += 1;
  const serializable = {
    ...state,
    visitDraft: null,
    pendingNavigation: null,
    stateVersion: stateVersionCounter,
    savedAt: nowIso(),
  };
  return JSON.stringify(serializable);
}

async function loadState() {
  let indexedDbRaw = "";
  try {
    indexedDbRaw = await getAppState();
  } catch {}

  if (indexedDbRaw) {
    try {
      const parsed = JSON.parse(indexedDbRaw);
      const hydratedState = deserializeStatePayload(parsed);
      if (hydratedState) {
        stateVersionCounter = toFreshnessMetadata(parsed)?.stateVersion || 0;
        if (runtimeHasLocalStorage) {
          try {
            localStorage.setItem(STORAGE_KEY, indexedDbRaw);
          } catch {}
        }
        if (runtimeHasSessionStorage) {
          try {
            sessionStorage.setItem(STORAGE_FALLBACK_KEY, indexedDbRaw);
          } catch {}
        }
        const loadResult = {
          chosenBackend: "indexedDB",
          stateVersion: stateVersionCounter,
          savedAt: parsed?.savedAt || null,
          clientCount: hydratedState.clients.length,
        };
        console.info("[storage] loadState", loadResult);
        updateStorageDiagnostics("lastLoad", loadResult);
        return hydratedState;
      }
    } catch {}
  }

  const candidates = [];
  if (runtimeHasLocalStorage)
    candidates.push({
      backend: "localStorage",
      raw: localStorage.getItem(STORAGE_KEY),
    });
  if (runtimeHasSessionStorage)
    candidates.push({
      backend: "sessionStorage",
      raw: sessionStorage.getItem(STORAGE_FALLBACK_KEY),
    });

  let freshest = null;
  let nextState = null;
  let freshestSavedAt = null;
  for (const candidate of candidates) {
    if (!candidate?.raw) continue;
    try {
      const parsed = JSON.parse(candidate.raw);
      const hydratedState = deserializeStatePayload(parsed);
      if (!hydratedState) continue;
      const freshness = toFreshnessMetadata(parsed);
      if (!freshest || compareFreshness(freshness, freshest) > 0) {
        freshest = freshness;
        freshest.backend = candidate.backend;
        freshestSavedAt = parsed?.savedAt || null;
        nextState = hydratedState;
      }
    } catch {}
  }

  if (nextState) {
    stateVersionCounter = freshest?.stateVersion || 0;
    const loadResult = {
      chosenBackend: freshest?.backend || "unknown",
      stateVersion: freshest?.stateVersion || 0,
      savedAt: freshestSavedAt,
      clientCount: nextState.clients.length,
    };
    console.info("[storage] loadState", loadResult);
    updateStorageDiagnostics("lastLoad", loadResult);
    return nextState;
  }
  const loadResult = {
    chosenBackend: "baseState",
    stateVersion: 0,
    savedAt: null,
    clientCount: baseState.clients.length,
  };
  console.info("[storage] loadState", loadResult);
  updateStorageDiagnostics("lastLoad", loadResult);
  return structuredClone(baseState);
}

function hydrateStateFromIndexedDb() {
  return loadState();
}

async function persist() {
  recomputeAllReminderStatuses();
  const serialized = serializeStatePayload();
  const sizeBytes = estimateBytes(serialized);
  if (sizeBytes >= LOCALSTORAGE_SOFT_LIMIT_BYTES && !persistSizeWarningShown) {
    persistSizeWarningShown = true;
    showFlash(
      "warning",
      "Storage is nearly full. Consider deleting old records or attachments.",
    );
  }

  const successfulBackends = [];
  const backendResults = [];

  try {
    await putAppState(serialized);
    successfulBackends.push("indexedDB");
    backendResults.push({ backend: "indexedDB", ok: true });
  } catch (err) {
    const name = err?.name || "Error";
    const message = err?.message || "Unknown IndexedDB error";
    backendResults.push({
      backend: "indexedDB",
      ok: false,
      error: { name, message },
    });
  }

  if (runtimeHasLocalStorage) {
    try {
      localStorage.setItem(STORAGE_KEY, serialized);
      successfulBackends.push("localStorage");
      backendResults.push({ backend: "localStorage", ok: true });
    } catch (err) {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {}
      const name = err?.name || "Error";
      const message = err?.message || "Unknown localStorage error";
      backendResults.push({
        backend: "localStorage",
        ok: false,
        error: { name, message },
      });
    }
  } else {
    backendResults.push({
      backend: "localStorage",
      ok: false,
      skipped: true,
      reason: "unavailable",
    });
  }

  if (runtimeHasSessionStorage) {
    try {
      sessionStorage.setItem(STORAGE_FALLBACK_KEY, serialized);
      successfulBackends.push("sessionStorage");
      backendResults.push({ backend: "sessionStorage", ok: true });
    } catch (err) {
      try {
        sessionStorage.removeItem(STORAGE_FALLBACK_KEY);
      } catch {}
      const name = err?.name || "Error";
      const message = err?.message || "Unknown sessionStorage error";
      backendResults.push({
        backend: "sessionStorage",
        ok: false,
        error: { name, message },
      });
    }
  } else {
    backendResults.push({
      backend: "sessionStorage",
      ok: false,
      skipped: true,
      reason: "unavailable",
    });
  }

  const wrote = successfulBackends.includes("indexedDB");
  if (!wrote && !storageWarningShown) {
    storageWarningShown = true;
    showFlash(
      "warning",
      "Could not save data in browser storage. New records may disappear after refresh.",
    );
  }

  const persistResult = { ok: wrote, backendResults };
  if (wrote) console.info("[storage] persist", persistResult);
  else console.warn("[storage] persist", persistResult);
  updateStorageDiagnostics("lastPersist", persistResult);

  return {
    ok: wrote,
    backend: successfulBackends.join(",") || "none",
    ...(backendResults.some((result) => !result.ok && result.error)
      ? {
          error: backendResults
            .filter((result) => result.error)
            .map(
              (result) =>
                `${result.backend}: ${result.error.name}: ${result.error.message}`,
            )
            .join(" | "),
        }
      : {}),
  };
}

const normalizeText = (v) =>
  String(v || "")
    .trim()
    .toLowerCase();
const normalizePhone = (v) => String(v || "").replace(/\D/g, "");
const formatPhone = (v) => {
  const d = normalizePhone(v);
  return d.length === 10
    ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`
    : d;
};
const serviceCatalogItem = (serviceCode) =>
  SERVICE_CATALOG.find(
    (item) =>
      item.serviceCode ===
      String(serviceCode || "")
        .trim()
        .toLowerCase(),
  ) || null;
const serviceLabel = (serviceCode) =>
  serviceCatalogItem(serviceCode)?.name || "Service";
const serviceCategoryLabel = (serviceCode) =>
  serviceCatalogItem(serviceCode)?.category || "general";
const reminderCategoryForService = (serviceCode) => {
  const category = serviceCategoryLabel(serviceCode);
  if (category === "vaccine") return "vaccine";
  if (category === "diagnostic") return "diagnostic test";
  if (category === "preventive") return "preventive medication";
  return "follow-up visit";
};
const serviceDefaultUnitPriceCents = (serviceCode) =>
  serviceCatalogItem(serviceCode)?.defaultUnitPriceCents || 0;
const visitOrderStatusLabel = (status) =>
  VISIT_ORDER_STATUS_LABELS[
    String(status || "")
      .trim()
      .toLowerCase()
  ] || "Completed";
const centsToDollars = (cents) =>
  Number.isFinite(Number(cents)) ? (Number(cents) / 100).toFixed(2) : "0.00";
const dollarsToCents = (value) => {
  const numeric = Number.parseFloat(
    String(value || "").replace(/[^0-9.]/g, ""),
  );
  if (!Number.isFinite(numeric) || numeric < 0) return null;
  return Math.round(numeric * 100);
};
const orderItemLineTotalCents = (orderItem) => {
  if (
    String(orderItem?.status || "")
      .trim()
      .toLowerCase() === "declined"
  )
    return 0;
  const quantity = Number.parseFloat(orderItem?.quantity);
  const unitPriceCents = Number.parseInt(orderItem?.unitPriceCents, 10);
  if (
    !Number.isFinite(quantity) ||
    quantity <= 0 ||
    !Number.isFinite(unitPriceCents) ||
    unitPriceCents < 0
  )
    return 0;
  return Math.round(quantity * unitPriceCents);
};
const visitOrderSubtotalCents = (orderedItems = []) =>
  orderedItems.reduce(
    (total, orderItem) => total + orderItemLineTotalCents(orderItem),
    0,
  );
const payableVisitOrderItems = (visit) =>
  Array.isArray(visit?.orderedItems)
    ? visit.orderedItems
        .map((orderItem) => migrateVisitOrderItem(orderItem))
        .filter((orderItem) => orderItem.status !== "declined")
    : [];
const visitSubtotalFromVisitCents = (visit) =>
  visitOrderSubtotalCents(payableVisitOrderItems(visit));
const visitPaidAmountCents = (visit) =>
  Math.max(
    0,
    Number.parseInt(
      migrateVisitPayment(visit?.payment || {}).amountPaidCents,
      10,
    ) || 0,
  );
const visitAmountDueCents = (visit) =>
  Math.max(0, visitSubtotalFromVisitCents(visit) - visitPaidAmountCents(visit));
const paymentStatusLabel = (status) => {
  if (status === "paid") return "Paid";
  if (status === "pending") return "Partially Paid";
  if (status === "failed") return "Failed";
  if (status === "canceled") return "Canceled";
  return "Unpaid";
};
const manualPaymentMethodLabel = (method) => {
  if (method === "cash") return "Cash";
  if (method === "card") return "Card";
  if (method === "tap") return "Tap";
  if (method === "check") return "Check";
  return "Other";
};
function collectPatientPaymentHistory(patient) {
  const rows = [];
  for (const visit of patient?.visits || []) {
    const payment = migrateVisitPayment(visit?.payment || {});
    const visitDate = String(visit?.visitDate || "");
    const visitReason = String(visit?.reasonForVisit || "").trim();
    if (payment.manualEntries.length) {
      for (const entry of payment.manualEntries) {
        rows.push({
          entryId: entry.entryId,
          visitId: String(visit?.visitId || ""),
          visitDate,
          visitReason,
          amountCents: entry.amountCents,
          method: entry.method,
          note: entry.note,
          at: String(entry.at || ""),
        });
      }
      continue;
    }
    if (payment.amountPaidCents > 0) {
      rows.push({
        entryId: `legacy-${visit?.visitId || crypto.randomUUID()}`,
        visitId: String(visit?.visitId || ""),
        visitDate,
        visitReason,
        amountCents: payment.amountPaidCents,
        method: normalizeManualPaymentMethod(payment.method || "other"),
        note: "Recorded before detailed payment log support.",
        at: String(
          payment.updatedAt || visit?.lastEditedAt || `${visitDate}T00:00:00`,
        ),
      });
    }
  }
  return rows.sort(
    (a, b) =>
      String(b.at || "").localeCompare(String(a.at || "")) ||
      String(b.visitDate || "").localeCompare(String(a.visitDate || "")),
  );
}

function collectClientPaymentHistory(client) {
  const rows = [];
  for (const patient of client?.patients || []) {
    const patientName = String(patient?.name || "Unknown patient");
    for (const entry of collectPatientPaymentHistory(patient)) {
      rows.push({
        ...entry,
        patientId: String(patient?.patientId || ""),
        patientName,
      });
    }
  }
  return rows.sort(
    (a, b) =>
      String(b.at || "").localeCompare(String(a.at || "")) ||
      String(b.visitDate || "").localeCompare(String(a.visitDate || "")) ||
      String(a.patientName || "").localeCompare(String(b.patientName || "")),
  );
}

function collectClientCheckoutVisitRows(client, { includePaid = false } = {}) {
  const rows = [];
  for (const patient of client?.patients || []) {
    const patientName = String(patient?.name || "Unknown patient");
    for (const visit of patient?.visits || []) {
      const charges = payableVisitOrderItems(visit);
      if (!charges.length) continue;
      const subtotalCents = visitOrderSubtotalCents(charges);
      if (subtotalCents <= 0) continue;
      const payment = migrateVisitPayment(visit.payment || {});
      const paidCents = Math.max(
        0,
        Number.parseInt(payment.amountPaidCents, 10) || 0,
      );
      const dueCents = Math.max(0, subtotalCents - paidCents);
      if (!includePaid && dueCents <= 0) continue;
      rows.push({
        clientId: String(client?.clientId || ""),
        patientId: String(patient?.patientId || ""),
        patientName,
        visitId: String(visit?.visitId || ""),
        visitDate: String(visit?.visitDate || ""),
        visitReason: String(visit?.reasonForVisit || ""),
        charges,
        subtotalCents,
        paidCents,
        dueCents,
        paymentStatus: payment.status,
      });
    }
  }
  return rows.sort(
    (a, b) =>
      Number(b.dueCents || 0) - Number(a.dueCents || 0) ||
      String(b.visitDate || "").localeCompare(String(a.visitDate || "")) ||
      String(a.patientName || "").localeCompare(String(b.patientName || "")),
  );
}

function reminderDoneForVisit(reminder, visitDate) {
  const completedDate = String(reminder?.lastCompletedDate || "").trim();
  const visitDateValue = String(visitDate || "").trim();
  if (!completedDate || !visitDateValue) return false;
  return completedDate >= visitDateValue;
}

function pendingReminderActionsForCheckoutRow(patient, row) {
  if (!patient || !row) return [];
  const reminderByType = new Map(
    (patient.preventiveReminders || []).map((reminder) => [
      String(reminder.typeCode || "")
        .trim()
        .toLowerCase(),
      reminder,
    ]),
  );
  const uniqueReminderTypes = new Set();
  for (const orderItem of row.charges || []) {
    const reminderType = String(
      SERVICE_REMINDER_TYPE_MAP[orderItem.serviceCode] || "",
    )
      .trim()
      .toLowerCase();
    if (!reminderType) continue;
    uniqueReminderTypes.add(reminderType);
  }
  const actions = [];
  for (const reminderType of uniqueReminderTypes) {
    const reminder = reminderByType.get(reminderType);
    if (reminderDoneForVisit(reminder, row.visitDate)) continue;
    actions.push({
      typeCode: reminderType,
      label: reminderTypeLabel(reminderType),
    });
  }
  return actions;
}

function csvEscape(value) {
  const text = String(value ?? "");
  if (!/[",\n]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

function buildCloseoutReport(dateYmd) {
  const date = String(dateYmd || todayYmd()).slice(0, 10);
  const paymentRows = [];
  const visitRows = [];
  const totalsByMethod = {
    cash: 0,
    card: 0,
    tap: 0,
    check: 0,
    other: 0,
  };

  for (const client of state.clients || []) {
    const clientName =
      `${client.firstName || ""} ${client.lastName || ""}`.trim() ||
      "Unknown client";
    for (const patient of client.patients || []) {
      const patientName = String(patient?.name || "Unknown patient");
      for (const visit of patient.visits || []) {
        const subtotalCents = visitSubtotalFromVisitCents(visit);
        const payment = migrateVisitPayment(visit.payment || {});
        const paidCents = Math.max(
          0,
          Number.parseInt(payment.amountPaidCents, 10) || 0,
        );
        const dueCents = Math.max(0, subtotalCents - paidCents);
        const estimate = migrateVisitEstimate(
          visit.estimate || {},
          subtotalCents,
        );
        if (String(visit.visitDate || "") === date) {
          visitRows.push({
            visitDate: String(visit.visitDate || ""),
            clientName,
            patientName,
            visitReason: String(visit.reasonForVisit || ""),
            estimateStatus: estimateStatusLabel(estimate.status),
            paymentStatus: paymentStatusLabel(payment.status),
            subtotalCents,
            paidCents,
            dueCents,
          });
        }

        const detailedEntries = (payment.manualEntries || []).map((entry) => ({
          at: String(entry.at || ""),
          amountCents: entry.amountCents,
          method: normalizeManualPaymentMethod(entry.method),
          note: entry.note,
        }));
        const entries = detailedEntries.length
          ? detailedEntries
          : paidCents > 0 && String(payment.updatedAt || "").startsWith(date)
            ? [
                {
                  at: String(payment.updatedAt || ""),
                  amountCents: paidCents,
                  method: normalizeManualPaymentMethod(
                    payment.method || "other",
                  ),
                  note: "Legacy payment entry",
                },
              ]
            : [];

        for (const entry of entries) {
          if (!String(entry.at || "").startsWith(date)) continue;
          paymentRows.push({
            at: String(entry.at || ""),
            clientName,
            patientName,
            visitDate: String(visit.visitDate || ""),
            visitReason: String(visit.reasonForVisit || ""),
            method: normalizeManualPaymentMethod(entry.method),
            amountCents: Math.max(
              0,
              Number.parseInt(entry.amountCents, 10) || 0,
            ),
            note: String(entry.note || ""),
          });
          totalsByMethod[normalizeManualPaymentMethod(entry.method)] +=
            Math.max(0, Number.parseInt(entry.amountCents, 10) || 0);
        }
      }
    }
  }

  paymentRows.sort((a, b) =>
    String(b.at || "").localeCompare(String(a.at || "")),
  );
  visitRows.sort(
    (a, b) =>
      String(a.visitDate || "").localeCompare(String(b.visitDate || "")) ||
      String(a.clientName || "").localeCompare(String(b.clientName || "")) ||
      String(a.patientName || "").localeCompare(String(b.patientName || "")),
  );
  const totalPaymentsCents = paymentRows.reduce(
    (sum, row) => sum + row.amountCents,
    0,
  );
  const totalDueCents = visitRows.reduce((sum, row) => sum + row.dueCents, 0);
  return {
    date,
    paymentRows,
    visitRows,
    totalsByMethod,
    totalPaymentsCents,
    totalDueCents,
  };
}

function buildCloseoutCsv(report) {
  const lines = [];
  lines.push("OneClick Day-End Closeout");
  lines.push(`Date,${csvEscape(report.date)}`);
  lines.push(`Payments Count,${report.paymentRows.length}`);
  lines.push(`Payments Total,${centsToDollars(report.totalPaymentsCents)}`);
  lines.push(
    `Outstanding Due (visits on date),${centsToDollars(report.totalDueCents)}`,
  );
  lines.push(`Cash Total,${centsToDollars(report.totalsByMethod.cash)}`);
  lines.push(`Card Total,${centsToDollars(report.totalsByMethod.card)}`);
  lines.push(`Tap Total,${centsToDollars(report.totalsByMethod.tap)}`);
  lines.push(`Check Total,${centsToDollars(report.totalsByMethod.check)}`);
  lines.push(`Other Total,${centsToDollars(report.totalsByMethod.other)}`);
  lines.push("");
  lines.push("Payments");
  lines.push(
    "timestamp,client,patient,visit_date,visit_reason,method,amount,note",
  );
  for (const row of report.paymentRows) {
    lines.push(
      [
        csvEscape(
          String(row.at || "")
            .replace("T", " ")
            .slice(0, 16),
        ),
        csvEscape(row.clientName),
        csvEscape(row.patientName),
        csvEscape(formatDisplayDate(row.visitDate)),
        csvEscape(row.visitReason),
        csvEscape(manualPaymentMethodLabel(row.method)),
        csvEscape(centsToDollars(row.amountCents)),
        csvEscape(row.note),
      ].join(","),
    );
  }
  lines.push("");
  lines.push("Visits On Closeout Date");
  lines.push(
    "visit_date,client,patient,visit_reason,estimate_status,payment_status,subtotal,paid,due",
  );
  for (const row of report.visitRows) {
    lines.push(
      [
        csvEscape(formatDisplayDate(row.visitDate)),
        csvEscape(row.clientName),
        csvEscape(row.patientName),
        csvEscape(row.visitReason),
        csvEscape(row.estimateStatus),
        csvEscape(row.paymentStatus),
        csvEscape(centsToDollars(row.subtotalCents)),
        csvEscape(centsToDollars(row.paidCents)),
        csvEscape(centsToDollars(row.dueCents)),
      ].join(","),
    );
  }
  return `${lines.join("\n")}\n`;
}

function exportCloseoutCsv(dateYmd) {
  const report = buildCloseoutReport(dateYmd);
  const csv = buildCloseoutCsv(report);
  downloadBlob(
    new Blob([csv], { type: "text/csv;charset=utf-8" }),
    `oneclick-closeout-${report.date}.csv`,
  );
  return report;
}

function collectOutstandingBalances() {
  const rows = [];
  for (const client of state.clients || []) {
    const clientName =
      `${client.firstName || ""} ${client.lastName || ""}`.trim() ||
      "Unknown client";
    for (const patient of client.patients || []) {
      const patientName = String(patient?.name || "Unknown patient");
      for (const visit of patient.visits || []) {
        const subtotalCents = visitSubtotalFromVisitCents(visit);
        if (subtotalCents <= 0) continue;
        const payment = migrateVisitPayment(visit.payment || {});
        const paidCents = Math.max(
          0,
          Number.parseInt(payment.amountPaidCents, 10) || 0,
        );
        const dueCents = Math.max(0, subtotalCents - paidCents);
        if (dueCents <= 0) continue;
        const estimate = migrateVisitEstimate(
          visit.estimate || {},
          subtotalCents,
        );
        rows.push({
          visitId: String(visit.visitId || ""),
          clientId: String(client.clientId || ""),
          patientId: String(patient.patientId || ""),
          clientName,
          patientName,
          visitDate: String(visit.visitDate || ""),
          visitReason: String(visit.reasonForVisit || ""),
          paymentStatus: payment.status,
          estimateStatus: estimate.status,
          dueCents,
        });
      }
    }
  }
  return rows.sort(
    (a, b) =>
      Number(b.dueCents || 0) - Number(a.dueCents || 0) ||
      String(a.visitDate || "").localeCompare(String(b.visitDate || "")) ||
      String(a.clientName || "").localeCompare(String(b.clientName || "")) ||
      String(a.patientName || "").localeCompare(String(b.patientName || "")),
  );
}

function buildDiagnosticLabToken(clientId, patientId, visitId, orderItemId) {
  return [clientId, patientId, visitId, orderItemId]
    .map((value) => encodeURIComponent(String(value || "")))
    .join("|");
}

function parseDiagnosticLabToken(token) {
  const raw = String(token || "").trim();
  if (!raw) return null;
  const parts = raw.split("|");
  if (parts.length !== 4) return null;
  try {
    const [clientId, patientId, visitId, orderItemId] = parts.map((value) =>
      decodeURIComponent(value),
    );
    if (!clientId || !patientId || !visitId || !orderItemId) return null;
    return { clientId, patientId, visitId, orderItemId };
  } catch {
    return null;
  }
}

function collectDiagnosticLabRows({ pendingOnly = false } = {}) {
  const rows = [];
  for (const client of state.clients || []) {
    const clientId = String(client.clientId || "");
    const clientName =
      `${client.firstName || ""} ${client.lastName || ""}`.trim() ||
      "Unknown client";
    for (const patient of client.patients || []) {
      const patientId = String(patient.patientId || "");
      const patientName = String(patient.name || "Unknown patient");
      for (const visit of patient.visits || []) {
        const visitId = String(visit.visitId || "");
        const visitDate = String(visit.visitDate || "");
        const visitReason = String(visit.reasonForVisit || "").trim();
        for (const orderItem of visit.orderedItems || []) {
          const normalized = migrateVisitOrderItem(orderItem);
          if (serviceCategoryLabel(normalized.serviceCode) !== "diagnostic")
            continue;
          if (normalized.status === "declined") continue;
          const resultText = String(normalized.resultText || "").trim();
          if (pendingOnly && resultText) continue;
          rows.push({
            token: buildDiagnosticLabToken(
              clientId,
              patientId,
              visitId,
              normalized.orderItemId,
            ),
            clientId,
            patientId,
            visitId,
            orderItemId: String(normalized.orderItemId || ""),
            clientName,
            patientName,
            visitDate,
            visitReason,
            serviceName: serviceLabel(normalized.serviceCode),
            quantity: normalized.quantity,
            chargeCents: orderItemLineTotalCents(normalized),
            resultText,
            resultEnteredAt: String(normalized.resultEnteredAt || ""),
            notes: String(normalized.notes || "").trim(),
          });
        }
      }
    }
  }
  return rows.sort(
    (a, b) =>
      String(a.visitDate || "").localeCompare(String(b.visitDate || "")) ||
      String(a.clientName || "").localeCompare(String(b.clientName || "")) ||
      String(a.patientName || "").localeCompare(String(b.patientName || "")) ||
      String(a.serviceName || "").localeCompare(String(b.serviceName || "")),
  );
}

function findDiagnosticLabContext(token) {
  const parsed = parseDiagnosticLabToken(token);
  if (!parsed) return null;
  const patient = findPatient(parsed.clientId, parsed.patientId);
  const visit = findVisit(patient, parsed.visitId);
  if (!patient || !visit) return null;
  const orderItemIndex = (visit.orderedItems || []).findIndex(
    (item) => String(item?.orderItemId || "") === parsed.orderItemId,
  );
  if (orderItemIndex < 0) return null;
  return {
    ...parsed,
    patient,
    visit,
    orderItemIndex,
  };
}

function updateHomeLabsButton() {
  if (!els.homeLabsPendingCount || !els.homeLabsBtn) return;
  const pendingCount = collectDiagnosticLabRows({ pendingOnly: true }).length;
  els.homeLabsPendingCount.textContent = String(pendingCount);
  els.homeLabsBtn.title = pendingCount
    ? `${pendingCount} diagnostic result${pendingCount === 1 ? "" : "s"} pending`
    : "No pending diagnostic results";
}

function renderLabsScreen() {
  if (!els.labsList || !els.labsPendingMeta) return;
  const pendingRows = collectDiagnosticLabRows({ pendingOnly: true });
  updateHomeLabsButton();
  if (els.labsError) els.labsError.textContent = "";

  if (!pendingRows.length) {
    els.labsPendingMeta.textContent = "All diagnostics have results entered.";
    els.labsList.innerHTML = "<p class='muted'>No pending labs right now.</p>";
    return;
  }

  els.labsPendingMeta.textContent = `${pendingRows.length} diagnostic result${pendingRows.length === 1 ? "" : "s"} still need to be entered.`;
  els.labsList.innerHTML = pendingRows
    .map(
      (row) => `
    <div class="card" data-lab-row="${esc(row.token)}">
      <p><strong>${esc(row.serviceName)}</strong></p>
      <p class="muted">Client: ${esc(row.clientName)} • Pet: <button class="name-patient" data-open-patient="${row.clientId}:${row.patientId}">${esc(row.patientName)}</button></p>
      <p class="muted">Visit: ${esc(formatDisplayDate(row.visitDate))} • Qty ${esc(row.quantity)}${row.chargeCents > 0 ? ` • $${centsToDollars(row.chargeCents)}` : ""}</p>
      ${row.notes ? `<p class="muted">Order note: ${esc(row.notes)}</p>` : ""}
      <div class="form-group">
        <label class="field-label">Lab Result</label>
        <textarea data-lab-result-input="${esc(row.token)}" placeholder="Enter result details, values, and interpretation"></textarea>
      </div>
      <div class="actions-row">
        <button type="button" data-save-lab-result="${esc(row.token)}">Save Result</button>
      </div>
    </div>
  `,
    )
    .join("");
}

function renderHomeFinanceSummary() {
  if (!els.homeFinanceSummary) return;
  const outstandingRows = collectOutstandingBalances();
  const outstandingTotalCents = outstandingRows.reduce(
    (sum, row) => sum + row.dueCents,
    0,
  );
  const dueClientCount = new Set(outstandingRows.map((row) => row.clientId))
    .size;
  const todayReport = buildCloseoutReport(todayYmd());
  els.homeFinanceSummary.innerHTML = `
    <h3>Revenue Snapshot</h3>
    <div class="home-finance-grid">
      <div>
        <div class="home-client-metrics">
          <span class="home-metric">Open Balances: ${outstandingRows.length}</span>
          <span class="home-metric">A/R Total: $${centsToDollars(outstandingTotalCents)}</span>
          <span class="home-metric">Clients with Due: ${dueClientCount}</span>
        </div>
        <p class="muted">Top balances due now.</p>
      </div>
      <div>
        <div class="home-client-metrics">
          <span class="home-metric">Today Payments: ${todayReport.paymentRows.length}</span>
          <span class="home-metric">Today Collected: $${centsToDollars(todayReport.totalPaymentsCents)}</span>
          <span class="home-metric">Today Due: $${centsToDollars(todayReport.totalDueCents)}</span>
        </div>
        <p class="muted">Run closeout export for the full day ledger and method totals.</p>
      </div>
    </div>
  `;
}

function renderHomeDuePaymentsSummary() {
  if (!els.homeDuePaymentsSummary) return;
  const outstandingRows = collectOutstandingBalances();
  const totalDueCents = outstandingRows.reduce(
    (sum, row) => sum + row.dueCents,
    0,
  );
  const visibleRows = outstandingRows.slice(0, 20);
  const hiddenCount = Math.max(0, outstandingRows.length - visibleRows.length);
  const rowsMarkup = visibleRows.length
    ? visibleRows
        .map(
          (row) => `
      <div class="home-finance-row">
        <div class="row-main">
          <button class="name-patient" data-open-patient="${row.clientId}:${row.patientId}">${esc(row.patientName)}</button>
          <span class="muted">${esc(row.clientName)} • ${esc(formatDisplayDate(row.visitDate))}</span>
        </div>
        <div class="row">
          <span><strong>Due $${centsToDollars(row.dueCents)}</strong></span>
          <span class="muted">Payment: ${esc(paymentStatusLabel(row.paymentStatus))}</span>
        </div>
        ${row.visitReason ? `<p class="muted">${esc(row.visitReason)}</p>` : ""}
        <div class="actions-row">
          <button type="button" class="secondary-btn" data-open-checkout="${row.clientId}:${row.patientId}:${row.visitId}">Open Checkout</button>
        </div>
      </div>
    `,
        )
        .join("")
    : `<p class="muted home-finance-empty">No due payments right now.</p>`;
  els.homeDuePaymentsSummary.innerHTML = `
    <h3>Due Payments</h3>
    <p class="muted">Outstanding balances: ${outstandingRows.length} visit${outstandingRows.length === 1 ? "" : "s"} • total due $${centsToDollars(totalDueCents)}.</p>
    <div class="home-finance-list">${rowsMarkup}</div>
    ${hiddenCount ? `<p class="muted">Showing first ${visibleRows.length}. ${hiddenCount} more due payment${hiddenCount === 1 ? "" : "s"} not shown.</p>` : ""}
  `;
}

function resolveRemindersWindow() {
  const fallback = {
    key: remindersUiState.windowKey,
    label: "Next 30 days",
    start: todayYmd(),
    end: todayYmd(),
    valid: true,
    error: "",
  };
  if (typeof remindersLogic.resolveReminderWindow !== "function")
    return fallback;
  return remindersLogic.resolveReminderWindow({
    windowKey: remindersUiState.windowKey,
    today: todayYmd(),
    customStart: remindersUiState.customStart,
    customEnd: remindersUiState.customEnd,
  });
}

function computeRemindersData() {
  const window = resolveRemindersWindow();
  if (typeof remindersLogic.buildReminderDataset !== "function") {
    return {
      window,
      counts: {
        dueSoonNoAppointment: 0,
        dueSoonHasAppointment: 0,
        appointmentsScheduled: 0,
      },
      rows: [],
    };
  }
  const dataset = remindersLogic.buildReminderDataset(state.clients, {
    today: todayYmd(),
    windowEnd: window.end,
    includeOverdue: true,
  });
  remindersRowsByPatient = new Map(
    dataset.rows.map((row) => [`${row.clientId}:${row.patientId}`, row]),
  );
  return {
    window,
    counts: dataset.counts,
    rows: dataset.rows,
  };
}

function reminderCategoryLabel(category) {
  if (category === REMINDER_CATEGORIES.dueSoonNoAppointment)
    return "Due Soon (No Appointment)";
  if (category === REMINDER_CATEGORIES.dueSoonHasAppointment)
    return "Due Soon (Has Appointment)";
  if (category === REMINDER_CATEGORIES.appointmentsScheduled)
    return "Appointments Scheduled";
  return "Reminders";
}

function routeReminders(category = remindersUiState.activeCategory) {
  if (typeof remindersLogic.remindersRoute === "function")
    return remindersLogic.remindersRoute(category);
  return "#/reminders/dueSoonNoAppointment";
}

function renderHomeRemindersSummary() {
  if (!els.homeRemindersSummary) return;
  const { window, counts } = computeRemindersData();
  const optionsMarkup = REMINDER_WINDOW_OPTIONS.map(
    (option) =>
      `<option value="${esc(option.key)}" ${option.key === remindersUiState.windowKey ? "selected" : ""}>${esc(option.label)}</option>`,
  ).join("");
  const customRangeMarkup =
    remindersUiState.windowKey === "custom"
      ? `<div class="home-reminders-controls">
        <label class="muted" for="homeRemindersCustomStart">Start</label>
        <input id="homeRemindersCustomStart" type="date" value="${esc(remindersUiState.customStart || window.start)}" />
        <label class="muted" for="homeRemindersCustomEnd">End</label>
        <input id="homeRemindersCustomEnd" type="date" value="${esc(remindersUiState.customEnd || window.end)}" />
      </div>`
      : "";
  const windowRangeLabel = `${formatDisplayDate(window.start)} - ${formatDisplayDate(window.end)}`;
  els.homeRemindersSummary.innerHTML = `
    <div class="home-reminders-head">
      <h3>Reminders</h3>
      <div class="home-reminders-controls">
        <label class="muted" for="homeRemindersWindowSelect">Time Window</label>
        <select id="homeRemindersWindowSelect">${optionsMarkup}</select>
      </div>
    </div>
    ${customRangeMarkup}
    <p class="muted">${window.label}: ${esc(windowRangeLabel)}${window.valid ? "" : ` • ${esc(window.error)}`}</p>
    <div class="home-reminders-tiles">
      <button type="button" class="home-reminders-tile" data-open-reminders-category="${REMINDER_CATEGORIES.dueSoonNoAppointment}">
        <span class="tile-title">Due Soon (No Appointment)</span>
        <span class="tile-count">${counts.dueSoonNoAppointment}</span>
      </button>
      <button type="button" class="home-reminders-tile" data-open-reminders-category="${REMINDER_CATEGORIES.dueSoonHasAppointment}">
        <span class="tile-title">Due Soon (Has Appointment)</span>
        <span class="tile-count">${counts.dueSoonHasAppointment}</span>
      </button>
      <button type="button" class="home-reminders-tile" data-open-reminders-category="${REMINDER_CATEGORIES.appointmentsScheduled}">
        <span class="tile-title">Appointments Scheduled</span>
        <span class="tile-count">${counts.appointmentsScheduled}</span>
      </button>
    </div>
  `;
}

function renderRemindersListScreen() {
  if (!els.remindersList || !els.remindersListMeta || !els.remindersListTitle)
    return;
  const { window, rows } = computeRemindersData();
  const category = remindersUiState.activeCategory;
  const filteredRows =
    typeof remindersLogic.filterRowsByCategory === "function"
      ? remindersLogic.filterRowsByCategory(rows, category)
      : rows;
  els.remindersListTitle.textContent = reminderCategoryLabel(category);
  els.remindersListMeta.textContent = `${window.label} (${formatDisplayDate(window.start)} - ${formatDisplayDate(window.end)}) • ${filteredRows.length} patient${filteredRows.length === 1 ? "" : "s"}`;
  if (els.remindersListError)
    els.remindersListError.textContent = window.valid ? "" : window.error;

  if (!filteredRows.length) {
    els.remindersList.innerHTML =
      "<p class='muted'>No reminders in this category for the selected window.</p>";
    return;
  }

  els.remindersList.innerHTML = filteredRows
    .map((row) => {
      const dueClass = row.overdue ? "due-overdue" : "due-soon";
      const dueReason = row.dueReason
        ? `<p class="muted">Due reason: ${esc(row.dueReason)}</p>`
        : "";
      const appointmentText = row.hasAppointment
        ? `Appt ${esc(formatDisplayDate(row.appointmentDate))}`
        : "No appointment";
      const actionMarkup = row.hasAppointment
        ? `<button type="button" data-open-visit="${esc(row.appointmentVisitId)}">View</button>
         <button type="button" class="secondary-btn" data-reminder-reschedule="${esc(row.appointmentVisitId)}">Reschedule</button>`
        : `<button type="button" data-reminder-schedule="${esc(`${row.clientId}:${row.patientId}`)}">Schedule</button>`;
      return `
      <div class="reminder-list-row">
        <div class="reminder-list-row-head">
          <div>
            <p><button class="name-patient" data-open-patient="${row.clientId}:${row.patientId}">${esc(row.patientName)}</button></p>
            <p class="muted">${esc(row.clientName)}</p>
          </div>
          <div>
            <p class="${dueClass}">${esc(row.dueRelative || "Due date unavailable")}</p>
            <p class="muted">Due date: ${esc(formatDisplayDate(row.dueDate))}</p>
            <p class="muted">${appointmentText}</p>
          </div>
        </div>
        ${dueReason}
        <div class="actions-row">${actionMarkup}</div>
      </div>
    `;
    })
    .join("");
}

function openRemindersList(category, { syncRoute = true } = {}) {
  remindersUiState.activeCategory = category;
  renderRemindersListScreen();
  showScreen("reminders", {
    route: syncRoute ? routeReminders(category) : null,
  });
}

function suggestedReminderVisitReason(row) {
  const dueReason = String(row?.dueReason || "").trim();
  if (dueReason) return `Reminder follow-up: ${dueReason}`;
  return "Reminder follow-up";
}

function normalizedAppointmentStatusForVisit(visit) {
  if (typeof remindersLogic.normalizeAppointmentStatus === "function") {
    return remindersLogic.normalizeAppointmentStatus(
      visit?.appointmentStatus,
      visit?.status,
    );
  }
  const explicit = String(visit?.appointmentStatus || "")
    .trim()
    .toLowerCase();
  if (
    ["scheduled", "confirmed", "cancelled", "no-show", "completed"].includes(
      explicit,
    )
  )
    return explicit;
  return "";
}

function listPatientAppointments(patient) {
  return [...(patient?.visits || [])]
    .map((visit) => {
      const appointmentStatus = normalizedAppointmentStatusForVisit(visit);
      if (!["scheduled", "confirmed"].includes(appointmentStatus)) return null;
      const visitDate = String(visit?.visitDate || "").trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(visitDate)) return null;
      return {
        visitId: String(visit?.visitId || ""),
        visitDate,
        appointmentStatus,
        reasonForVisit: String(visit?.reasonForVisit || "").trim(),
      };
    })
    .filter(Boolean)
    .sort(
      (a, b) =>
        String(a.visitDate || "").localeCompare(String(b.visitDate || "")) ||
        String(a.reasonForVisit || "").localeCompare(
          String(b.reasonForVisit || ""),
        ),
    );
}

function renderPatientAppointmentScheduler(patient, { prefill = null } = {}) {
  if (
    !els.patientAppointmentDateInput ||
    !els.patientAppointmentReasonInput ||
    !els.patientAppointmentStatusInput ||
    !els.patientAppointmentList
  )
    return;

  const datePrefill = String(prefill?.appointmentDate || "").trim();
  const statusPrefill = String(prefill?.appointmentStatus || "")
    .trim()
    .toLowerCase();
  const reasonPrefill = String(prefill?.reasonForVisit || "").trim();
  if (datePrefill) els.patientAppointmentDateInput.value = datePrefill;
  else if (!els.patientAppointmentDateInput.value)
    els.patientAppointmentDateInput.value = todayYmd();
  if (["scheduled", "confirmed"].includes(statusPrefill))
    els.patientAppointmentStatusInput.value = statusPrefill;
  if (reasonPrefill) els.patientAppointmentReasonInput.value = reasonPrefill;
  if (els.patientAppointmentSchedulerError)
    els.patientAppointmentSchedulerError.textContent = "";

  const rows = listPatientAppointments(patient);
  if (!rows.length) {
    els.patientAppointmentList.innerHTML =
      "<p class='muted'>No scheduled appointments.</p>";
    return;
  }
  els.patientAppointmentList.innerHTML = rows
    .map(
      (row) => `
    <div class="appointment-scheduler-item">
      <p><strong>${esc(formatDisplayDate(row.visitDate))}</strong> • ${esc(row.appointmentStatus === "confirmed" ? "Confirmed" : "Scheduled")}</p>
      <p class="muted">${esc(row.reasonForVisit || "No reason provided")}</p>
      <div class="actions-row">
        <button type="button" data-open-visit="${esc(row.visitId)}">View</button>
        <button type="button" class="secondary-btn" data-reminder-reschedule="${esc(row.visitId)}">Reschedule</button>
      </div>
    </div>
  `,
    )
    .join("");
}

const formatDisplayDate = (ymd) => {
  const value = String(ymd || "").trim();
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return value || "—";
  return `${match[2]}/${match[3]}/${match[1]}`;
};
const textToHtml = (value) => esc(String(value || "")).replace(/\n/g, "<br />");
const lbsToKg = (lbs) =>
  Number.isFinite(Number(lbs || 0))
    ? (Number(lbs || 0) * 0.45359237).toFixed(2)
    : "0.00";
const inventoryItemValueCents = (item) =>
  Math.max(
    0,
    Math.round(
      (Number(item?.onHandQty) || 0) * (Number(item?.unitCostCents) || 0),
    ),
  );

const findClient = (id) => state.clients.find((c) => c.clientId === id) || null;
const findPatient = (clientId, patientId) =>
  findClient(clientId)?.patients.find((p) => p.patientId === patientId) || null;
const findVisit = (patient, visitId) =>
  patient?.visits.find((v) => v.visitId === visitId) || null;
const findInventoryItem = (itemId) =>
  (state.inventoryItems || []).find((item) => item.itemId === itemId) || null;

function parseWeightLbs(value) {
  const numeric = Number.parseFloat(String(value ?? "").trim());
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  return Number.parseFloat(numeric.toFixed(2));
}

function buildPatientWeightSeries(
  patient,
  { activeVisitId = "", activeVisitDate = "", activeWeightLbs = "" } = {},
) {
  const points = [];
  for (const visit of patient?.visits || []) {
    const weightLbs = parseWeightLbs(visit?.vitals?.weightLbs);
    if (weightLbs === null) continue;
    points.push({
      visitId: String(visit?.visitId || ""),
      visitDate: String(visit?.visitDate || ""),
      createdAt: String(visit?.createdAt || visit?.lastEditedAt || ""),
      weightLbs,
    });
  }
  const sortPoints = () =>
    points.sort(
      (a, b) =>
        String(a.visitDate || "").localeCompare(String(b.visitDate || "")) ||
        String(a.createdAt || "").localeCompare(String(b.createdAt || "")) ||
        String(a.visitId || "").localeCompare(String(b.visitId || "")),
    );
  sortPoints();

  const activeId = String(activeVisitId || "");
  if (!activeId) return points;
  const activeWeight = parseWeightLbs(activeWeightLbs);
  const pointIndex = points.findIndex((point) => point.visitId === activeId);
  const normalizedDate = String(activeVisitDate || "").trim() || todayYmd();
  if (activeWeight === null) {
    if (pointIndex >= 0) points.splice(pointIndex, 1);
  } else if (pointIndex >= 0) {
    points[pointIndex].weightLbs = activeWeight;
    points[pointIndex].visitDate = normalizedDate;
  } else {
    points.push({
      visitId: activeId,
      visitDate: normalizedDate,
      createdAt: nowIso(),
      weightLbs: activeWeight,
    });
  }
  sortPoints();
  return points;
}

function latestPatientWeightPoint(patient) {
  const points = buildPatientWeightSeries(patient);
  return points.length ? points[points.length - 1] : null;
}

function buildWeightTrackerChartSvg(points) {
  const chartWidth = 640;
  const chartHeight = 230;
  const padLeft = 52;
  const padRight = 18;
  const padTop = 16;
  const padBottom = 40;
  const xSpan = Math.max(1, chartWidth - padLeft - padRight);
  const ySpan = Math.max(1, chartHeight - padTop - padBottom);
  const weights = points.map((point) => point.weightLbs);
  let minWeight = Math.min(...weights);
  let maxWeight = Math.max(...weights);
  if (minWeight === maxWeight) {
    minWeight = Math.max(0, minWeight - 1);
    maxWeight = maxWeight + 1;
  }
  const weightRange = Math.max(0.01, maxWeight - minWeight);
  const xFor = (index) =>
    padLeft +
    (points.length <= 1 ? xSpan / 2 : (index / (points.length - 1)) * xSpan);
  const yFor = (weight) =>
    padTop + ((maxWeight - weight) / weightRange) * ySpan;
  const polylinePoints = points
    .map(
      (point, index) =>
        `${xFor(index).toFixed(2)},${yFor(point.weightLbs).toFixed(2)}`,
    )
    .join(" ");
  const circles = points
    .map(
      (point, index) =>
        `<circle class="weight-tracker-point" cx="${xFor(index).toFixed(2)}" cy="${yFor(point.weightLbs).toFixed(2)}" r="4"></circle>`,
    )
    .join("");
  const valueLabels = points
    .map(
      (point, index) =>
        `<text x="${xFor(index).toFixed(2)}" y="${(yFor(point.weightLbs) - 8).toFixed(2)}" fill="#d8e7ff" font-size="10" text-anchor="middle">${point.weightLbs.toFixed(2)}</text>`,
    )
    .join("");
  const firstLabel = formatDisplayDate(points[0]?.visitDate || "");
  const lastLabel = formatDisplayDate(
    points[points.length - 1]?.visitDate || "",
  );
  const latestPoint = points[points.length - 1];
  return `
    <svg viewBox="0 0 ${chartWidth} ${chartHeight}" role="img" aria-label="Weight trend chart">
      <line x1="${padLeft}" y1="${chartHeight - padBottom}" x2="${chartWidth - padRight}" y2="${chartHeight - padBottom}" stroke="#30415f" stroke-width="1"></line>
      <line x1="${padLeft}" y1="${padTop}" x2="${padLeft}" y2="${chartHeight - padBottom}" stroke="#30415f" stroke-width="1"></line>
      <polyline points="${polylinePoints}" fill="none" stroke="#7ab0ff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"></polyline>
      ${circles}
      ${valueLabels}
      <text x="${padLeft}" y="${padTop + 10}" fill="#9ea7bd" font-size="11">${maxWeight.toFixed(2)} lbs</text>
      <text x="${padLeft}" y="${chartHeight - padBottom - 6}" fill="#9ea7bd" font-size="11">${minWeight.toFixed(2)} lbs</text>
      <text x="${padLeft}" y="${chartHeight - 12}" fill="#9ea7bd" font-size="11">${esc(firstLabel)}</text>
      <text x="${chartWidth - padRight}" y="${chartHeight - 12}" fill="#9ea7bd" font-size="11" text-anchor="end">${esc(lastLabel)}</text>
      <text x="${chartWidth - padRight}" y="${padTop + 10}" fill="#d5e4ff" font-size="11" text-anchor="end">Latest: ${latestPoint.weightLbs.toFixed(2)} lbs</text>
    </svg>
  `;
}

function renderVisitWeightTracker() {
  if (!els.visitWeightChart || !els.visitWeightTrendMeta) return;
  const patient = findPatient(state.activeClientId, state.activePatientId);
  if (!patient || !state.activeVisitId) {
    els.visitWeightChart.innerHTML = `<div class="weight-tracker-empty muted">No patient selected.</div>`;
    els.visitWeightTrendMeta.textContent = "";
    if (els.visitWeightSeriesList) els.visitWeightSeriesList.innerHTML = "";
    return;
  }
  const points = buildPatientWeightSeries(patient, {
    activeVisitId: state.activeVisitId,
    activeVisitDate: String(els.visitDate?.value || ""),
    activeWeightLbs: String(els.visitWeightLbs?.value || ""),
  });
  if (!points.length) {
    els.visitWeightChart.innerHTML = `<div class="weight-tracker-empty muted">Add a weight to this visit to start tracking trends.</div>`;
    els.visitWeightTrendMeta.textContent = "No weigh-ins recorded yet.";
    if (els.visitWeightSeriesList) els.visitWeightSeriesList.innerHTML = "";
    return;
  }
  els.visitWeightChart.innerHTML = buildWeightTrackerChartSvg(points);
  if (els.visitWeightSeriesList) {
    const activeVisitId = String(state.activeVisitId || "");
    els.visitWeightSeriesList.innerHTML = points
      .slice()
      .reverse()
      .map((point) => {
        const activeTag = point.visitId === activeVisitId ? " (current)" : "";
        return `
        <div class="weight-series-row">
          <div class="row">
            <span><strong>${point.weightLbs.toFixed(2)} lbs</strong> (${lbsToKg(point.weightLbs)} kg)</span>
            <span class="muted">${esc(formatDisplayDate(point.visitDate))}${esc(activeTag)}</span>
          </div>
        </div>
      `;
      })
      .join("");
  }
  const firstPoint = points[0];
  const lastPoint = points[points.length - 1];
  if (points.length === 1) {
    els.visitWeightTrendMeta.textContent = `1 weigh-in recorded (${formatDisplayDate(lastPoint.visitDate)}).`;
    return;
  }
  const delta = Number((lastPoint.weightLbs - firstPoint.weightLbs).toFixed(2));
  const direction = delta > 0 ? "gain" : delta < 0 ? "loss" : "no net change";
  const deltaPrefix = delta > 0 ? "+" : "";
  els.visitWeightTrendMeta.textContent = `${points.length} weigh-ins from ${formatDisplayDate(firstPoint.visitDate)} to ${formatDisplayDate(lastPoint.visitDate)}: ${deltaPrefix}${delta.toFixed(2)} lbs (${direction}).`;
}

function renderPatientWeightTracker(patient) {
  if (!els.patientWeightChart || !els.patientWeightTrendMeta) return;
  if (!patient) {
    els.patientWeightChart.innerHTML = `<div class="weight-tracker-empty muted">No patient selected.</div>`;
    els.patientWeightTrendMeta.textContent = "";
    if (els.patientWeightSeriesList) els.patientWeightSeriesList.innerHTML = "";
    return;
  }
  const points = buildPatientWeightSeries(patient);
  if (!points.length) {
    els.patientWeightChart.innerHTML = `<div class="weight-tracker-empty muted">No weigh-ins recorded yet.</div>`;
    els.patientWeightTrendMeta.textContent = "No weigh-ins recorded yet.";
    if (els.patientWeightSeriesList) els.patientWeightSeriesList.innerHTML = "";
    return;
  }
  els.patientWeightChart.innerHTML = buildWeightTrackerChartSvg(points);
  if (els.patientWeightSeriesList) {
    const latestPoint = points[points.length - 1];
    const historyRowsMarkup = points
      .slice()
      .reverse()
      .map((point) => {
        const deleteToken = `${String(state.activeClientId || "")}:${String(patient.patientId || "")}:${String(point.visitId || "")}`;
        return `
        <div class="weight-series-row weight-history-row">
          <div class="weight-history-main">
            <span class="muted">${esc(formatDisplayDate(point.visitDate))}</span>
            <span><strong>${point.weightLbs.toFixed(2)} lbs</strong> (${lbsToKg(point.weightLbs)} kg)</span>
          </div>
          <button type="button" class="danger weight-history-delete" data-delete-patient-weight="${esc(deleteToken)}">Delete</button>
        </div>
      `;
      })
      .join("");
    els.patientWeightSeriesList.innerHTML = `
      <details class="collapsible-panel weight-history-collapsible">
        <summary>Weight History (${points.length}) • Latest ${latestPoint.weightLbs.toFixed(2)} lbs (${lbsToKg(latestPoint.weightLbs)} kg) on ${esc(formatDisplayDate(latestPoint.visitDate))}</summary>
        <div class="collapsible-content">
          <div class="weight-history-list">
            ${historyRowsMarkup}
          </div>
        </div>
      </details>
    `;
  }
  const firstPoint = points[0];
  const lastPoint = points[points.length - 1];
  if (points.length === 1) {
    els.patientWeightTrendMeta.textContent = `1 weigh-in recorded (${formatDisplayDate(lastPoint.visitDate)}).`;
    return;
  }
  const delta = Number((lastPoint.weightLbs - firstPoint.weightLbs).toFixed(2));
  const direction = delta > 0 ? "gain" : delta < 0 ? "loss" : "no net change";
  const deltaPrefix = delta > 0 ? "+" : "";
  els.patientWeightTrendMeta.textContent = `${points.length} weigh-ins from ${formatDisplayDate(firstPoint.visitDate)} to ${formatDisplayDate(lastPoint.visitDate)}: ${deltaPrefix}${delta.toFixed(2)} lbs (${direction}).`;
}

function renderPatientWeightKgPreview() {
  if (!els.patientWeightKgPreview || !els.patientWeightLbsInput) return;
  els.patientWeightKgPreview.textContent = lbsToKg(
    els.patientWeightLbsInput.value,
  );
}

function showFlash(type, message) {
  els.flashMessage.innerHTML = `<div class="banner ${type}">${message}</div>`;
  setTimeout(() => {
    if (els.flashMessage.textContent.includes(message))
      els.flashMessage.innerHTML = "";
  }, 2200);
}

function buildClientAiContext(client) {
  const lines = [];
  lines.push(`Client: ${client.firstName} ${client.lastName}`);
  lines.push(`Email: ${client.email || "none"}`);
  lines.push("Contacts:");
  for (const contact of client.contacts || []) {
    lines.push(
      `- ${contact.isPrimary ? "[Primary] " : ""}${contact.name || "Unnamed"} (${formatPhone(contact.phone || "") || "no phone"})`,
    );
  }
  for (const patient of client.patients || []) {
    lines.push("");
    lines.push(`Patient: ${patient.name}`);
    lines.push(
      `Signalment: ${patient.species || "Unknown"} | ${patient.breed || "Unknown breed"} | ${patient.sex || "Unknown sex"} | Age ${patient.age || "—"} | DOB ${patient.dateOfBirth || "—"}`,
    );
    lines.push("Reminders:");
    const reminders = [...(patient.preventiveReminders || [])].sort(
      (a, b) =>
        String(a.dueDate || "9999-12-31").localeCompare(
          String(b.dueDate || "9999-12-31"),
        ) || String(a.typeCode || "").localeCompare(String(b.typeCode || "")),
    );
    if (!reminders.length) lines.push("- none");
    for (const reminder of reminders) {
      lines.push(
        `- ${reminder.typeCode} | status=${reminder.status} | due=${reminder.dueDate || "—"} | last_completed=${reminder.lastCompletedDate || "—"}`,
      );
    }
    lines.push("Visits:");
    const visits = [...(patient.visits || [])].sort(
      (a, b) =>
        String(b.visitDate || "").localeCompare(String(a.visitDate || "")) ||
        String(b.createdAt || "").localeCompare(String(a.createdAt || "")),
    );
    if (!visits.length) lines.push("- none");
    for (const visit of visits) {
      lines.push(
        `- Visit ${visit.visitDate || "—"} | status=${visit.status || "draft"} | reason=${visit.reasonForVisit || "none"} | weight_lbs=${visit.vitals?.weightLbs || "—"} | soap_assessment=${visit.soap?.assessment || "none"} | soap_plan=${visit.soap?.plan || "none"}`,
      );
      const chargeLines = (visit.orderedItems || []).map((item) => {
        const normalized = migrateVisitOrderItem(item);
        return `${serviceLabel(normalized.serviceCode)} x${normalized.quantity} | status=${normalized.status} | unit=$${centsToDollars(normalized.unitPriceCents)} | line_total=$${centsToDollars(orderItemLineTotalCents(normalized))}`;
      });
      lines.push(
        `  Charges: ${chargeLines.length ? chargeLines.join("; ") : "none"}`,
      );
    }
  }
  return lines.join("\n");
}

const clientAiKey = (clientId) => String(clientId || "");
function aiChatsForClient(clientId) {
  const key = clientAiKey(clientId);
  if (!key) return [];
  if (!Array.isArray(state.aiChatsByClient[key]))
    state.aiChatsByClient[key] = [];
  return state.aiChatsByClient[key];
}
function activeAiChatId(clientId) {
  return state.activeAiChatByClient[clientAiKey(clientId)] || "";
}
function setActiveAiChatId(clientId, chatId) {
  state.activeAiChatByClient[clientAiKey(clientId)] = chatId;
}
function createAiChat(clientId) {
  const chats = aiChatsForClient(clientId);
  const chat = {
    chatId: crypto.randomUUID(),
    title: `New chat ${chats.length + 1}`,
    createdAt: nowIso(),
    messages: [],
  };
  chats.push(chat);
  setActiveAiChatId(clientId, chat.chatId);
  return chat;
}
function ensureActiveAiChat(clientId) {
  const chats = aiChatsForClient(clientId);
  if (!chats.length) return createAiChat(clientId);
  const activeId = activeAiChatId(clientId);
  const existing = chats.find((chat) => chat.chatId === activeId);
  if (existing) return existing;
  setActiveAiChatId(clientId, chats[0].chatId);
  return chats[0];
}
function parseAiQuestionInput(rawQuestion) {
  const text = String(rawQuestion || "").trim();
  if (!text) return { question: "", modelPreference: "auto" };
  if (text.toLowerCase().startsWith("/nano "))
    return { question: text.slice(6).trim(), modelPreference: "nano" };
  if (text.toLowerCase().startsWith("/mini "))
    return { question: text.slice(6).trim(), modelPreference: "mini" };
  if (text.toLowerCase().startsWith("/power "))
    return { question: text.slice(7).trim(), modelPreference: "power" };
  return { question: text, modelPreference: "auto" };
}
function buildAiConversationPrompt(question, messages = []) {
  const history = messages
    .slice(-8)
    .map(
      (message) =>
        `${message.role === "assistant" ? "Assistant" : "User"}: ${message.content}`,
    )
    .join("\n");
  if (!history) return question;
  return `Conversation so far:\n${history}\n\nNew user message:\n${question}\n\nRespond directly and concisely.`;
}
function renderClientAiChats(clientId) {
  if (!els.clientAiChatSelect) return;
  const chats = aiChatsForClient(clientId);
  const activeId = activeAiChatId(clientId);
  if (!chats.length) {
    els.clientAiChatSelect.innerHTML = "<option value=''>No chats yet</option>";
    return;
  }
  els.clientAiChatSelect.innerHTML = chats
    .map((chat, index) => {
      const titleSource =
        chat.messages.find((message) => message.role === "user")?.content ||
        chat.title ||
        `Chat ${index + 1}`;
      const title =
        String(titleSource).trim().slice(0, 52) || `Chat ${index + 1}`;
      const selected = chat.chatId === activeId ? "selected" : "";
      return `<option value="${chat.chatId}" ${selected}>${esc(title)}</option>`;
    })
    .join("");
}
function renderClientAiMessages(clientId) {
  if (!els.clientAiMessages) return;
  const chat = ensureActiveAiChat(clientId);
  if (!chat.messages.length) {
    els.clientAiMessages.innerHTML =
      "<div class='ai-chat-empty'>Start a message to begin.</div>";
    return;
  }
  els.clientAiMessages.innerHTML = chat.messages
    .map((message) => {
      const roleClass = message.role === "assistant" ? "assistant" : "user";
      const meta =
        message.role === "assistant" && message.model
          ? `<div class=\"ai-msg-meta\">${esc(message.model)}</div>`
          : "";
      return `<div class=\"ai-msg ${roleClass}\">${textToHtml(message.content)}${meta}</div>`;
    })
    .join("");
  els.clientAiMessages.scrollTop = els.clientAiMessages.scrollHeight;
}
async function askClientAiViaApi(
  client,
  question,
  { modelPreference = "auto", messages = [] } = {},
) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), AI_REQUEST_TIMEOUT_MS);
  let attachmentInput = {
    attachmentContext: "",
    attachmentImages: [],
    attachmentDocuments: [],
  };
  try {
    attachmentInput = await buildClientAttachmentAiInput(client);
  } catch {}
  try {
    const response = await fetch(`${ONECLICK_API_BASE}/api/ai/client-ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        question: buildAiConversationPrompt(question, messages),
        clientContext: buildClientAiContext(client),
        modelPreference,
        attachmentContext: attachmentInput.attachmentContext,
        attachmentImages: attachmentInput.attachmentImages,
        attachmentDocuments: attachmentInput.attachmentDocuments,
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok)
      throw new Error(
        String(payload?.error || `AI request failed (${response.status}).`),
      );
    const answer = String(payload?.answer || "").trim();
    if (!answer) throw new Error("Model returned an empty response.");
    return { answer, model: String(payload?.model || "").trim() };
  } finally {
    clearTimeout(timeoutId);
  }
}

function updateVisitPayment(visit, patch = {}) {
  if (!visit) return;
  visit.payment = migrateVisitPayment({
    ...migrateVisitPayment(visit.payment || {}),
    ...patch,
    updatedAt: nowIso(),
  });
}

function findManualPaymentElements(visitId) {
  const scope = els.patientCheckoutSummary;
  if (!scope) return {};
  const id = String(visitId || "");
  return {
    amountInput: scope.querySelector(`[data-manual-pay-amount=\"${id}\"]`),
    methodInput: scope.querySelector(`[data-manual-pay-method=\"${id}\"]`),
    noteInput: scope.querySelector(`[data-manual-pay-note=\"${id}\"]`),
    status: scope.querySelector(`[data-manual-pay-status=\"${id}\"]`),
    error: scope.querySelector(`[data-manual-pay-error=\"${id}\"]`),
    recordBtn: scope.querySelector(`[data-manual-pay-record=\"${id}\"]`),
  };
}

function clearManualPaymentError(visitId) {
  const { error } = findManualPaymentElements(visitId);
  if (error) error.textContent = "";
}

function setManualPaymentError(visitId, message) {
  const { error } = findManualPaymentElements(visitId);
  if (error) error.textContent = String(message || "");
}

function setManualPaymentStatus(visitId, message) {
  const { status } = findManualPaymentElements(visitId);
  if (status) status.textContent = String(message || "");
}

async function recordManualPaymentForVisit(
  visit,
  { amountCents, method, note },
) {
  if (!visit?.visitId) throw new Error("Visit is unavailable.");
  const requestedAmountCents = visitSubtotalFromVisitCents(visit);
  if (requestedAmountCents <= 0)
    throw new Error("No amount due for this visit.");

  const payment = migrateVisitPayment(visit.payment || {});
  const paidAlready = Math.max(0, payment.amountPaidCents);
  const remaining = Math.max(0, requestedAmountCents - paidAlready);
  if (remaining <= 0) throw new Error("This visit is already fully paid.");
  if (!Number.isFinite(amountCents) || amountCents <= 0)
    throw new Error("Enter a valid payment amount.");

  const appliedAmount = Math.min(remaining, amountCents);
  const nextManualEntries = [
    ...(payment.manualEntries || []),
    migrateManualPaymentEntry({
      amountCents: appliedAmount,
      method: normalizeManualPaymentMethod(method),
      note: String(note || "").trim(),
      at: nowIso(),
    }),
  ];
  const nextPaidAmount = paidAlready + appliedAmount;
  const nextStatus =
    nextPaidAmount >= requestedAmountCents ? "paid" : "pending";

  updateVisitPayment(visit, {
    method: "manual",
    status: nextStatus,
    requestedAmountCents,
    amountPaidCents: nextPaidAmount,
    manualEntries: nextManualEntries,
  });
  const context = findVisitContext(visit.visitId);
  const patientForVisit = context
    ? findPatient(context.clientId, context.patientId)
    : null;
  if (patientForVisit) syncOrderDrivenReminderEffects(patientForVisit);
  const saveResult = await persist();
  if (!saveResult.ok)
    throw new Error(
      "Payment recorded but could not be saved to local storage.",
    );
  openPatientDetail(state.activeClientId, state.activePatientId);

  if (amountCents > appliedAmount) {
    showFlash(
      "warning",
      `Recorded $${centsToDollars(appliedAmount)}. Remaining balance was lower than entered amount.`,
    );
    return;
  }
  if (nextStatus === "paid") {
    showFlash(
      "success",
      `Payment complete: $${centsToDollars(appliedAmount)} recorded.`,
    );
    return;
  }
  showFlash(
    "success",
    `Partial payment recorded: $${centsToDollars(appliedAmount)}.`,
  );
}

function findClientManualPaymentElements(clientId) {
  const scope = els.clientCheckoutSummary;
  if (!scope) return {};
  const id = String(clientId || "");
  return {
    amountInput: scope.querySelector(
      `[data-client-manual-pay-amount=\"${id}\"]`,
    ),
    methodInput: scope.querySelector(
      `[data-client-manual-pay-method=\"${id}\"]`,
    ),
    noteInput: scope.querySelector(`[data-client-manual-pay-note=\"${id}\"]`),
    status: scope.querySelector(`[data-client-manual-pay-status=\"${id}\"]`),
    error: scope.querySelector(`[data-client-manual-pay-error=\"${id}\"]`),
    recordBtn: scope.querySelector(`[data-client-manual-pay-record=\"${id}\"]`),
  };
}

function clearClientManualPaymentError(clientId) {
  const { error } = findClientManualPaymentElements(clientId);
  if (error) error.textContent = "";
}

function setClientManualPaymentError(clientId, message) {
  const { error } = findClientManualPaymentElements(clientId);
  if (error) error.textContent = String(message || "");
}

function setClientManualPaymentStatus(clientId, message) {
  const { status } = findClientManualPaymentElements(clientId);
  if (status) status.textContent = String(message || "");
}

async function recordManualPaymentForClient(
  client,
  { amountCents, method, note },
) {
  if (!client?.clientId) throw new Error("Client is unavailable.");
  const dueRows = collectClientCheckoutVisitRows(client, {
    includePaid: false,
  }).filter((row) => row.dueCents > 0);
  if (!dueRows.length) throw new Error("No amount due for this client.");
  if (!Number.isFinite(amountCents) || amountCents <= 0)
    throw new Error("Enter a valid payment amount.");

  const totalDueCents = dueRows.reduce((sum, row) => sum + row.dueCents, 0);
  const appliedTargetCents = Math.min(amountCents, totalDueCents);
  let remainingToApplyCents = appliedTargetCents;
  let appliedTotalCents = 0;
  const paymentAt = nowIso();
  const touchedPatientIds = new Set();
  const sortedForAllocation = dueRows
    .slice()
    .sort(
      (a, b) =>
        String(a.visitDate || "9999-12-31").localeCompare(
          String(b.visitDate || "9999-12-31"),
        ) ||
        String(a.patientName || "").localeCompare(
          String(b.patientName || ""),
        ) ||
        String(a.visitId || "").localeCompare(String(b.visitId || "")),
    );

  for (const row of sortedForAllocation) {
    if (remainingToApplyCents <= 0) break;
    const patient = findPatient(client.clientId, row.patientId);
    const visit = findVisit(patient, row.visitId);
    if (!visit) continue;

    const requestedAmountCents = visitSubtotalFromVisitCents(visit);
    const payment = migrateVisitPayment(visit.payment || {});
    const paidAlreadyCents = Math.max(0, payment.amountPaidCents);
    const visitRemainingCents = Math.max(
      0,
      requestedAmountCents - paidAlreadyCents,
    );
    if (visitRemainingCents <= 0) continue;

    const appliedForVisitCents = Math.min(
      visitRemainingCents,
      remainingToApplyCents,
    );
    if (appliedForVisitCents <= 0) continue;
    const nextManualEntries = [
      ...(payment.manualEntries || []),
      migrateManualPaymentEntry({
        amountCents: appliedForVisitCents,
        method: normalizeManualPaymentMethod(method),
        note: String(note || "").trim(),
        at: paymentAt,
      }),
    ];
    const nextPaidAmountCents = paidAlreadyCents + appliedForVisitCents;
    const nextStatus =
      nextPaidAmountCents >= requestedAmountCents ? "paid" : "pending";
    updateVisitPayment(visit, {
      method: "manual",
      status: nextStatus,
      requestedAmountCents,
      amountPaidCents: nextPaidAmountCents,
      manualEntries: nextManualEntries,
    });
    touchedPatientIds.add(String(row.patientId || ""));
    remainingToApplyCents -= appliedForVisitCents;
    appliedTotalCents += appliedForVisitCents;
  }

  if (appliedTotalCents <= 0)
    throw new Error("No due balances were available to apply this payment.");
  for (const patientId of touchedPatientIds) {
    const patient = findPatient(client.clientId, patientId);
    if (patient) syncOrderDrivenReminderEffects(patient);
  }
  const saveResult = await persist();
  if (!saveResult.ok)
    throw new Error(
      "Payment recorded but could not be saved to local storage.",
    );
  openClientDetail(client.clientId);

  if (amountCents > appliedTotalCents) {
    showFlash(
      "warning",
      `Recorded $${centsToDollars(appliedTotalCents)}. Remaining balance was lower than entered amount.`,
    );
    return;
  }
  if (appliedTotalCents >= totalDueCents) {
    showFlash(
      "success",
      `Payment complete: $${centsToDollars(appliedTotalCents)} recorded across client balances.`,
    );
    return;
  }
  showFlash(
    "success",
    `Partial client payment recorded: $${centsToDollars(appliedTotalCents)}.`,
  );
}

async function markReminderDoneForVisit(
  clientId,
  patientId,
  visitId,
  reminderTypeCode,
) {
  const client = findClient(clientId);
  const patient = findPatient(clientId, patientId);
  const visit = findVisit(patient, visitId);
  if (!client || !patient || !visit)
    throw new Error("Could not locate this visit reminder.");

  const typeCode = String(reminderTypeCode || "")
    .trim()
    .toLowerCase();
  if (!typeCode) throw new Error("Reminder type is missing.");
  const category = reminderCategoryForType(typeCode);
  const reminder = ensureReminderForType(
    patient,
    typeCode,
    category,
    String(visit.visitDate || todayYmd()),
  );
  if (!reminder) throw new Error("Could not prepare this reminder.");
  const reminderIndex = patient.preventiveReminders.findIndex(
    (item) => item.reminderId === reminder.reminderId,
  );
  if (reminderIndex < 0) throw new Error("Reminder could not be found.");

  const completedReminder = await completeReminderWithRules(reminder, {
    completedDate: String(visit.visitDate || todayYmd()),
  });
  if (!completedReminder) return false;
  patient.preventiveReminders[reminderIndex] = completedReminder;

  const saveResult = await persist();
  if (!saveResult.ok)
    throw new Error(
      "Reminder updated but could not be saved to local storage.",
    );
  openClientDetail(client.clientId);
  showFlash("success", `${reminderTypeLabel(typeCode)} marked done.`);
  return true;
}

function findEstimateActionElements(visitId) {
  const scope = els.patientCheckoutSummary;
  if (!scope) return {};
  const id = String(visitId || "");
  return {
    noteInput: scope.querySelector(`[data-estimate-note=\"${id}\"]`),
    status: scope.querySelector(`[data-estimate-status=\"${id}\"]`),
    error: scope.querySelector(`[data-estimate-error=\"${id}\"]`),
    prepareBtn: scope.querySelector(`[data-estimate-prepare=\"${id}\"]`),
    approveBtn: scope.querySelector(`[data-estimate-approve=\"${id}\"]`),
    declineBtn: scope.querySelector(`[data-estimate-decline=\"${id}\"]`),
  };
}

function setEstimateActionStatus(visitId, message) {
  const { status } = findEstimateActionElements(visitId);
  if (status) status.textContent = String(message || "");
}

function clearEstimateActionError(visitId) {
  const { error } = findEstimateActionElements(visitId);
  if (error) error.textContent = "";
}

function setEstimateActionError(visitId, message) {
  const { error } = findEstimateActionElements(visitId);
  if (error) error.textContent = String(message || "");
}

async function updateVisitEstimateForAction(visit, action, note = "") {
  if (!visit?.visitId) throw new Error("Visit is unavailable.");
  const subtotalCents = visitSubtotalFromVisitCents(visit);
  const estimate = migrateVisitEstimate(visit.estimate || {}, subtotalCents);
  const now = nowIso();
  const cleanNote = String(note || "").trim();

  if (action === "prepare") {
    estimate.status = "draft";
    estimate.amountCents = subtotalCents;
    estimate.preparedAt = now;
    estimate.approvedAt = "";
    estimate.declinedAt = "";
    if (cleanNote) estimate.note = cleanNote;
  } else if (action === "approve") {
    if (subtotalCents <= 0)
      throw new Error("Add charges before approving an estimate.");
    estimate.status = "approved";
    estimate.amountCents = subtotalCents;
    estimate.preparedAt = estimate.preparedAt || now;
    estimate.approvedAt = now;
    estimate.declinedAt = "";
    estimate.note = cleanNote;
  } else if (action === "decline") {
    estimate.status = "declined";
    estimate.amountCents = subtotalCents;
    estimate.preparedAt = estimate.preparedAt || now;
    estimate.declinedAt = now;
    estimate.approvedAt = "";
    estimate.note = cleanNote;
  } else {
    throw new Error("Unsupported estimate action.");
  }

  visit.estimate = estimate;
  if (action !== "approve" && visit.payment?.status === "pending") {
    updateVisitPayment(visit, {
      status: "unpaid",
      amountPaidCents: 0,
      manualEntries: [],
    });
  }
  const saveResult = await persist();
  if (!saveResult.ok)
    throw new Error(
      "Estimate updated but could not be saved to local storage.",
    );
  openPatientDetail(state.activeClientId, state.activePatientId);
  if (action === "approve") showFlash("success", "Estimate approved.");
  else if (action === "decline") showFlash("warning", "Estimate declined.");
  else showFlash("success", "Estimate prepared.");
}

function storageBackendRoundTrip(storage, keyPrefix) {
  if (!canUseStorage(storage)) return false;
  try {
    const probeKey = `${keyPrefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const payload = JSON.stringify({ at: nowIso(), probe: true });
    storage.setItem(probeKey, payload);
    const wrote = storage.getItem(probeKey) === payload;
    storage.removeItem(probeKey);
    return wrote;
  } catch {
    return false;
  }
}

async function canRoundTripIndexedDbState() {
  try {
    const db = await openAppStateDb();
    const probeKey = `${APP_STATE_RECORD_KEY}-startup-probe`;
    const payload = JSON.stringify({ at: nowIso(), probe: true });
    await new Promise((resolve, reject) => {
      const tx = db.transaction(APP_STATE_STORE_NAME, "readwrite");
      const store = tx.objectStore(APP_STATE_STORE_NAME);
      store.put(payload, probeKey);
      tx.oncomplete = () => resolve();
      tx.onerror = () =>
        reject(tx.error || new Error("Failed writing IndexedDB probe."));
      tx.onabort = () =>
        reject(tx.error || new Error("IndexedDB probe write aborted."));
    });
    const readbackMatched = await new Promise((resolve, reject) => {
      const tx = db.transaction(APP_STATE_STORE_NAME, "readonly");
      const req = tx.objectStore(APP_STATE_STORE_NAME).get(probeKey);
      req.onsuccess = () => resolve(req.result === payload);
      req.onerror = () =>
        reject(req.error || new Error("Failed reading IndexedDB probe."));
    });
    await new Promise((resolve, reject) => {
      const tx = db.transaction(APP_STATE_STORE_NAME, "readwrite");
      tx.objectStore(APP_STATE_STORE_NAME).delete(probeKey);
      tx.oncomplete = () => resolve();
      tx.onerror = () =>
        reject(tx.error || new Error("Failed removing IndexedDB probe."));
      tx.onabort = () =>
        reject(tx.error || new Error("IndexedDB probe delete aborted."));
    });
    return readbackMatched;
  } catch {
    return false;
  }
}

function renderStartupStorageStatus() {
  if (!els.homeStorageStatus) return;
  els.homeStorageStatus.innerHTML = "";
  if (startupStorageStatus.level !== "ok") {
    const banner = document.createElement("div");
    banner.className = `banner ${startupStorageStatus.level}`;
    banner.textContent = startupStorageStatus.message;
    els.homeStorageStatus.append(banner);
  }
}

async function runStartupStorageCheck() {
  runtimeHasLocalStorage = storageBackendRoundTrip(
    globalThis.localStorage,
    "__oneclick_localstorage_startup_probe__",
  );
  runtimeHasSessionStorage = storageBackendRoundTrip(
    globalThis.sessionStorage,
    "__oneclick_sessionstorage_startup_probe__",
  );
  if (runtimeHasLocalStorage || runtimeHasSessionStorage) return;

  const hasIndexedDbFallback = await canRoundTripIndexedDbState();
  if (hasIndexedDbFallback) {
    startupStorageStatus.level = "warning";
    startupStorageStatus.message =
      "Browser storage unavailable. Running in fallback mode via IndexedDB. Data may not persist after refresh.";
    return;
  }

  startupStorageStatus.level = "error";
  startupStorageStatus.message =
    "Browser storage unavailable. Cannot persist data.";
}
function clearVisitMessages() {
  els.visitEditorError.textContent = "";
  els.visitEditorSuccess.textContent = "";
}
const esc = (v) =>
  String(v || "").replace(
    /[&<>\"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
  );

function downloadBlob(blob, filename) {
  const a = document.createElement("a");
  const url = URL.createObjectURL(blob);
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1200);
}

async function loadZipLibrary() {
  if (window.JSZip) return window.JSZip;
  await new Promise((resolve, reject) => {
    const existing = document.querySelector(
      `script[data-jszip-loader=\"true\"]`,
    );
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error("Failed to load JSZip.")),
        { once: true },
      );
      return;
    }
    const script = document.createElement("script");
    script.src = JSZIP_CDN_URL;
    script.async = true;
    script.dataset.jszipLoader = "true";
    script.addEventListener("load", resolve, { once: true });
    script.addEventListener(
      "error",
      () => reject(new Error("Failed to load JSZip.")),
      { once: true },
    );
    document.head.appendChild(script);
  });
  if (!window.JSZip) throw new Error("JSZip unavailable after loading.");
  return window.JSZip;
}

function sanitizeFilename(name, fallback = "attachment") {
  const cleaned = String(name || fallback)
    .replace(/[\\/:*?"<>|]+/g, "-")
    .trim();
  return cleaned || fallback;
}

function snapshotStatePayloadForBackup() {
  return {
    ...structuredClone(state),
    visitDraft: null,
    pendingNavigation: null,
    stateVersion: stateVersionCounter,
    savedAt: nowIso(),
  };
}

function collectAttachmentBlobKeysFromState(stateObject) {
  const keys = new Set();
  const appendFromList = (attachments = []) => {
    for (const attachment of attachments || []) {
      const key = attachment?.blobKey || attachmentBlobKeyFor(attachment);
      if (key) keys.add(String(key));
    }
  };
  for (const client of stateObject?.clients || []) {
    for (const patient of client?.patients || []) {
      appendFromList(patient?.priorRecords || []);
      for (const visit of patient?.visits || [])
        appendFromList(visit?.attachments || []);
    }
  }
  appendFromList(stateObject?.visitDraft?.attachments || []);
  return [...keys];
}

function encodeBlobKeyForBackup(blobKey) {
  return encodeURIComponent(String(blobKey || ""));
}

function decodeBlobKeyFromBackupPath(path) {
  const normalizedPath = String(path || "");
  if (!normalizedPath.startsWith(FULL_BACKUP_ATTACHMENTS_PREFIX)) return "";
  const encoded = normalizedPath.slice(FULL_BACKUP_ATTACHMENTS_PREFIX.length);
  try {
    return decodeURIComponent(encoded);
  } catch {
    return encoded;
  }
}

function timestampForBackupFilename() {
  return nowIso().replace(/[-:]/g, "").replace("T", "-").replace(/\..+$/, "Z");
}

async function clearAttachmentDbStore() {
  const db = await openAttachmentDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(ATTACHMENT_STORE_NAME, "readwrite");
    tx.objectStore(ATTACHMENT_STORE_NAME).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () =>
      reject(tx.error || new Error("Failed clearing attachment storage."));
    tx.onabort = () =>
      reject(tx.error || new Error("Attachment storage clear aborted."));
  });
}

function applyLoadedStateToRuntime(loadedState) {
  state.clients = loadedState.clients || [];
  state.inventoryItems = loadedState.inventoryItems || [];
  state.activeClientId = loadedState.activeClientId || null;
  state.activePatientId = loadedState.activePatientId || null;
  state.activeVisitId = loadedState.activeVisitId || null;
  state.editingClientId = loadedState.editingClientId || null;
  state.editingPatientId = loadedState.editingPatientId || null;
  state.newClientPatients = loadedState.newClientPatients || [];
  state.visitDraft = null;
  state.pendingNavigation = null;
}

async function exportFullBackup() {
  const JSZip = await loadZipLibrary();
  const snapshot = snapshotStatePayloadForBackup();
  const attachmentBlobKeys = collectAttachmentBlobKeysFromState(snapshot);
  const zip = new JSZip();
  const missingBlobKeys = [];

  zip.file(FULL_BACKUP_STATE_PATH, JSON.stringify(snapshot));
  for (const blobKey of attachmentBlobKeys) {
    const blob = await getAttachmentBlob(blobKey);
    if (!blob) {
      missingBlobKeys.push(blobKey);
      continue;
    }
    zip.file(
      `${FULL_BACKUP_ATTACHMENTS_PREFIX}${encodeBlobKeyForBackup(blobKey)}`,
      blob,
    );
  }

  zip.file(
    FULL_BACKUP_MANIFEST_PATH,
    JSON.stringify(
      {
        app: "oneclick",
        schemaVersion: FULL_BACKUP_SCHEMA_VERSION,
        exportedAt: nowIso(),
        stateVersion: snapshot.stateVersion || 0,
        attachmentBlobKeys,
        includedAttachmentCount:
          attachmentBlobKeys.length - missingBlobKeys.length,
        missingAttachmentBlobKeys: missingBlobKeys,
      },
      null,
      2,
    ),
  );

  const zipBlob = await zip.generateAsync({ type: "blob" });
  downloadBlob(
    zipBlob,
    `oneclick-full-backup-${timestampForBackupFilename()}.zip`,
  );
  if (missingBlobKeys.length) {
    showFlash(
      "warning",
      `Backup exported with ${missingBlobKeys.length} missing attachment(s).`,
    );
  } else {
    showFlash(
      "success",
      `Backup exported (${attachmentBlobKeys.length} attachment blob${attachmentBlobKeys.length === 1 ? "" : "s"}).`,
    );
  }
}

function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () =>
      reject(reader.error || new Error("Could not read backup file."));
    reader.readAsArrayBuffer(file);
  });
}

async function importFullBackup(file) {
  const JSZip = await loadZipLibrary();
  const zipBuffer = await readFileAsArrayBuffer(file);
  const zip = await JSZip.loadAsync(zipBuffer);

  const stateEntry = zip.file(FULL_BACKUP_STATE_PATH) || zip.file("state.json");
  if (!stateEntry) throw new Error("Backup is missing state.json.");

  const stateRaw = await stateEntry.async("string");
  let parsedState = null;
  try {
    parsedState = JSON.parse(stateRaw);
  } catch {
    throw new Error("Backup state.json is not valid JSON.");
  }
  const hydratedState = deserializeStatePayload(parsedState);
  if (!hydratedState)
    throw new Error("Backup state is not compatible with this app.");

  const attachmentFiles = zip.filter(
    (relativePath, entry) =>
      !entry.dir &&
      (relativePath.startsWith(FULL_BACKUP_ATTACHMENTS_PREFIX) ||
        relativePath.startsWith("attachments/")),
  );
  const importedAttachmentBlobs = [];
  for (const entry of attachmentFiles) {
    const blobKey = entry.name.startsWith(FULL_BACKUP_ATTACHMENTS_PREFIX)
      ? decodeBlobKeyFromBackupPath(entry.name)
      : (() => {
          const encoded = entry.name.replace(/^attachments\//, "");
          try {
            return decodeURIComponent(encoded);
          } catch {
            return encoded;
          }
        })();
    if (!blobKey) continue;
    importedAttachmentBlobs.push({ blobKey, blob: await entry.async("blob") });
  }

  await clearAttachmentDbStore();
  for (const item of importedAttachmentBlobs)
    await putAttachmentBlob(item.blobKey, item.blob);

  applyLoadedStateToRuntime(hydratedState);
  stateVersionCounter = toFreshnessMetadata(parsedState)?.stateVersion || 0;
  const persistResult = await persist();
  if (!persistResult.ok)
    throw new Error(
      "Restore loaded but failed to persist to local browser storage.",
    );

  syncInventoryControlledUi();
  resetInventoryForm();
  renderSearchResults();
  updateHash(routeHome(), { replace: true });
  applyRoute(routeHome());

  const expectedAttachmentCount =
    collectAttachmentBlobKeysFromState(hydratedState).length;
  if (importedAttachmentBlobs.length < expectedAttachmentCount) {
    showFlash(
      "warning",
      `Restore complete. Imported ${importedAttachmentBlobs.length}/${expectedAttachmentCount} attachment blobs.`,
    );
  } else {
    showFlash(
      "success",
      `Restore complete. Imported ${importedAttachmentBlobs.length} attachment blobs.`,
    );
  }
}

function showConfirm(message, actions) {
  els.confirmModalMessage.textContent = message;
  els.confirmModalActions.innerHTML = actions
    .map(
      (a) =>
        `<button data-confirm-act="${a.key}" class="${a.className || ""}">${a.label}</button>`,
    )
    .join("");
  els.confirmModal.classList.remove("hidden");
  return new Promise((resolve) => {
    const handler = (event) => {
      const key = event.target.dataset.confirmAct;
      if (!key) return;
      els.confirmModal.classList.add("hidden");
      els.confirmModalActions.removeEventListener("click", handler);
      resolve(key);
    };
    els.confirmModalActions.addEventListener("click", handler);
  });
}

function openReminderDueDateModal(defaultDueDate = todayYmd()) {
  const fallbackDate = /^\d{4}-\d{2}-\d{2}$/.test(String(defaultDueDate || ""))
    ? defaultDueDate
    : todayYmd();
  els.reminderDueDateInput.value = fallbackDate;
  els.reminderDueDateError.textContent = "";
  els.reminderDueDateModal.classList.remove("hidden");

  return new Promise((resolve) => {
    const close = (value) => {
      els.reminderDueDateModal.classList.add("hidden");
      els.reminderDueDateSaveBtn.removeEventListener("click", onSave);
      els.reminderDueDateCancelBtn.removeEventListener("click", onCancel);
      resolve(value);
    };

    const onCancel = () => close(null);
    const onSave = () => {
      const dueDate = String(els.reminderDueDateInput.value || "").trim();
      if (!dueDate) {
        els.reminderDueDateError.textContent = "Please choose a due date.";
        return;
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
        els.reminderDueDateError.textContent = "Use YYYY-MM-DD format.";
        return;
      }
      const parsed = new Date(`${dueDate}T00:00:00`);
      if (Number.isNaN(parsed.getTime())) {
        els.reminderDueDateError.textContent = "Please choose a valid date.";
        return;
      }
      close(dueDate);
    };

    els.reminderDueDateSaveBtn.addEventListener("click", onSave);
    els.reminderDueDateCancelBtn.addEventListener("click", onCancel);
  });
}

function settingsMenu(actionsMarkup) {
  return `<div class="menu-wrap"><button class="menu-toggle" type="button" data-menu-toggle="true" aria-label="Open settings menu"><span class="menu-toggle-line"></span><span class="menu-toggle-line"></span><span class="menu-toggle-line"></span></button><div class="menu-popover hidden">${actionsMarkup}</div></div>`;
}

function setHomePanelVisibility(panel, visible) {
  const nextVisible = Boolean(visible);
  if (panel === "revenue") {
    homePanelState.revenueVisible = nextVisible;
    if (els.homeFinanceSummary)
      els.homeFinanceSummary.classList.toggle("hidden", !nextVisible);
  }
  if (panel === "duePayments") {
    homePanelState.duePaymentsVisible = nextVisible;
    if (els.homeDuePaymentsSummary)
      els.homeDuePaymentsSummary.classList.toggle("hidden", !nextVisible);
  }
  if (panel === "reminders") {
    homePanelState.remindersVisible = nextVisible;
    if (els.homeRemindersSummary)
      els.homeRemindersSummary.classList.toggle("hidden", !nextVisible);
  }
  if (panel === "inventory") {
    homePanelState.inventoryVisible = nextVisible;
    if (els.inventoryPanel) {
      els.inventoryPanel.classList.toggle("hidden", !nextVisible);
      if (nextVisible) els.inventoryPanel.open = true;
    }
  }
}

function toggleHomePanelVisibility(panel) {
  if (panel === "revenue")
    setHomePanelVisibility("revenue", !homePanelState.revenueVisible);
  if (panel === "duePayments")
    setHomePanelVisibility("duePayments", !homePanelState.duePaymentsVisible);
  if (panel === "reminders")
    setHomePanelVisibility("reminders", !homePanelState.remindersVisible);
  if (panel === "inventory")
    setHomePanelVisibility("inventory", !homePanelState.inventoryVisible);
  updateHomeSettingsMenuLabels();
}

function updateHomeSettingsMenuLabels() {
  const dueCount = collectOutstandingBalances().length;
  const reminderCounts = computeRemindersData().counts;
  if (els.homeSettingsRevenueBtn) {
    const actionLabel = homePanelState.revenueVisible ? "Hide" : "Show";
    els.homeSettingsRevenueBtn.textContent = `${actionLabel} Revenue Snapshot`;
  }
  if (els.homeSettingsDuePaymentsBtn) {
    const actionLabel = homePanelState.duePaymentsVisible ? "Hide" : "Show";
    const suffix = dueCount ? ` (${dueCount} due)` : "";
    els.homeSettingsDuePaymentsBtn.textContent = `${actionLabel} Due Payments${suffix}`;
  }
  if (els.homeSettingsRemindersBtn) {
    const actionLabel = homePanelState.remindersVisible ? "Hide" : "Show";
    const dueSoonCount =
      Number(reminderCounts.dueSoonNoAppointment || 0) +
      Number(reminderCounts.dueSoonHasAppointment || 0);
    const suffix = dueSoonCount ? ` (${dueSoonCount} due soon)` : "";
    els.homeSettingsRemindersBtn.textContent = `${actionLabel} Reminders${suffix}`;
  }
  if (els.homeSettingsInventoryBtn) {
    const actionLabel = homePanelState.inventoryVisible ? "Hide" : "Show";
    els.homeSettingsInventoryBtn.textContent = `${actionLabel} Inventory DEA & Tax Tracking`;
  }
}

function formatVisitSelectionLabel(visit) {
  return `${visit.visitDate} • ${visit.reasonForVisit || "No reason provided"}`;
}

function formatPatientSignalment(patient) {
  const latestWeight = latestPatientWeightPoint(patient);
  const latestWeightText = latestWeight
    ? ` • Latest wt ${latestWeight.weightLbs.toFixed(2)} lbs`
    : "";
  return `${patient.species || "No species"}${patient.breed ? ` • ${patient.breed}` : ""}${patient.sex ? ` • ${patient.sex}` : ""} • Age: ${patient.age || "—"} • DOB: ${patient.dateOfBirth || "—"}${latestWeightText}`;
}

function formatPriorRecordSelectionLabel(record) {
  const linked = record.linkedAt
    ? String(record.linkedAt).slice(0, 10)
    : "Unknown date";
  return `${linked} • ${record.name || "Unnamed attachment"}`;
}

function openVisitSelectionModal(visits, priorRecords = []) {
  return new Promise((resolve) => {
    const sortedPriorRecords = [...priorRecords].sort((a, b) =>
      String(a.linkedAt || "").localeCompare(String(b.linkedAt || "")),
    );
    els.visitSelectionError.textContent = "";
    els.includePriorRecordsCheckbox.checked = Boolean(
      sortedPriorRecords.length,
    );
    els.includePriorRecordsCheckbox.disabled = !sortedPriorRecords.length;
    els.visitSelectionList.innerHTML = visits
      .map(
        (visit, i) => `
      <label class="visit-selection-item">
        <input type="checkbox" data-visit-index="${i}" checked />
        <span>${esc(formatVisitSelectionLabel(visit))}</span>
      </label>`,
      )
      .join("");
    els.priorRecordSelectionList.innerHTML = sortedPriorRecords.length
      ? sortedPriorRecords
          .map(
            (record, i) => `
      <label class="visit-selection-item">
        <input type="checkbox" data-prior-record-index="${i}" checked />
        <span>${esc(formatPriorRecordSelectionLabel(record))}</span>
      </label>`,
          )
          .join("")
      : "<p class='muted'>No prior medical records available.</p>";
    els.priorRecordSelectionList.classList.toggle(
      "hidden",
      !sortedPriorRecords.length || !els.includePriorRecordsCheckbox.checked,
    );
    els.visitSelectionModal.classList.remove("hidden");

    const close = (selected) => {
      els.visitSelectionModal.classList.add("hidden");
      els.visitSelectionConfirmBtn.removeEventListener("click", onConfirm);
      els.visitSelectionCancelBtn.removeEventListener("click", onCancel);
      els.includePriorRecordsCheckbox.removeEventListener(
        "change",
        onTogglePriorRecords,
      );
      resolve(selected);
    };

    const onTogglePriorRecords = () => {
      const show =
        els.includePriorRecordsCheckbox.checked && sortedPriorRecords.length;
      els.priorRecordSelectionList.classList.toggle("hidden", !show);
    };

    const onConfirm = () => {
      const selectedVisits = Array.from(
        els.visitSelectionList.querySelectorAll(
          'input[type="checkbox"]:checked',
        ),
      ).map((input) => visits[Number(input.dataset.visitIndex)]);
      const selectedPriorRecords = els.includePriorRecordsCheckbox.checked
        ? Array.from(
            els.priorRecordSelectionList.querySelectorAll(
              'input[type="checkbox"]:checked',
            ),
          ).map(
            (input) =>
              sortedPriorRecords[Number(input.dataset.priorRecordIndex)],
          )
        : [];
      if (!selectedVisits.length && !selectedPriorRecords.length) {
        els.visitSelectionError.textContent =
          "Select at least one visit or prior medical record to export.";
        return;
      }
      close({ visits: selectedVisits, priorRecords: selectedPriorRecords });
    };

    const onCancel = () => close(null);

    els.includePriorRecordsCheckbox.addEventListener(
      "change",
      onTogglePriorRecords,
    );
    els.visitSelectionConfirmBtn.addEventListener("click", onConfirm);
    els.visitSelectionCancelBtn.addEventListener("click", onCancel);
  });
}

function showScreen(name, { route = null, replaceRoute = false } = {}) {
  const map = {
    home: els.homeScreen,
    labs: els.labsScreen,
    reminders: els.remindersScreen,
    addClient: els.addClientScreen,
    editClient: els.editClientScreen,
    clientDetail: els.clientDetailScreen,
    editPatient: els.editPatientScreen,
    patientDetail: els.patientDetailScreen,
    visitEditor: els.visitEditorScreen,
  };
  Object.entries(map).forEach(([k, el]) =>
    el.classList.toggle("hidden", k !== name),
  );
  document.body.classList.toggle("home-screen-active", name === "home");
  const brandTitle = document.getElementById("brandTitle");
  if (brandTitle) brandTitle.textContent = "ONECLICK";
  if (route) updateHash(route, { replace: replaceRoute });
}

const normalizeHash = (hash) => {
  const raw = String(hash || "")
    .replace(/^#/, "")
    .trim();
  if (!raw) return "#/home";
  return raw.startsWith("/") ? `#${raw}` : `#/${raw}`;
};
const getRouteHash = () => normalizeHash(window.location.hash);
const routeHome = () => "#/home";
const routeLabs = () => "#/labs";
const routeAddClient = () => "#/add-client";
const routeClient = (clientId) => `#/client/${encodeURIComponent(clientId)}`;
const routePatient = (clientId, patientId) =>
  `#/client/${encodeURIComponent(clientId)}/patient/${encodeURIComponent(patientId)}`;
const routeVisit = (visitId) => `#/visit/${encodeURIComponent(visitId)}`;

let lastRouteHash = routeHome();
let syncingHash = false;

function updateHash(hash, { replace = false } = {}) {
  const next = normalizeHash(hash);
  if (getRouteHash() === next) return;
  syncingHash = true;
  if (replace) window.location.replace(next);
  else window.location.hash = next;
}

function findVisitContext(visitId) {
  for (const client of state.clients) {
    for (const patient of client.patients) {
      const visit = patient.visits.find((v) => v.visitId === visitId);
      if (visit)
        return {
          clientId: client.clientId,
          patientId: patient.patientId,
          visit,
        };
    }
  }
  return null;
}

function visitFromInputs() {
  const currentStatus =
    String(state.visitDraft?.status || "")
      .trim()
      .toLowerCase() === "finalized"
      ? "finalized"
      : "draft";
  return {
    visitId: state.activeVisitId,
    visitDate: els.visitDate.value || todayYmd(),
    status: currentStatus,
    reasonForVisit: els.visitReason.value.trim(),
    vitals: {
      weightLbs: els.visitWeightLbs.value,
      weightKg: lbsToKg(els.visitWeightLbs.value),
    },
    soap: {
      subjective: els.soapSubjective.value.trim(),
      objective: els.soapObjective.value.trim(),
      assessment: els.soapAssessment.value.trim(),
      plan: els.soapPlan.value.trim(),
    },
    orderedItems: structuredClone(state.visitDraft?.orderedItems || []),
    attachments: structuredClone(state.visitDraft?.attachments || []),
    estimate: structuredClone(
      state.visitDraft?.estimate || migrateVisitEstimate({}),
    ),
    payment: structuredClone(
      state.visitDraft?.payment || migrateVisitPayment({}),
    ),
  };
}

function editableVisitSnapshot(source = {}) {
  const normalize = (value) => String(value ?? "").trim();
  const attachments = Array.isArray(source.attachments)
    ? source.attachments
    : [];
  const orderedItems = Array.isArray(source.orderedItems)
    ? source.orderedItems
    : [];
  return {
    visitDate: normalize(source.visitDate),
    status: normalize(source.status),
    reasonForVisit: normalize(source.reasonForVisit),
    vitals: {
      weightLbs: normalize(source.vitals?.weightLbs),
    },
    soap: {
      subjective: normalize(source.soap?.subjective),
      objective: normalize(source.soap?.objective),
      assessment: normalize(source.soap?.assessment),
      plan: normalize(source.soap?.plan),
    },
    orderedItems: orderedItems.map((orderItem) => ({
      orderItemId: normalize(orderItem?.orderItemId),
      serviceCode: normalize(orderItem?.serviceCode),
      status: normalize(orderItem?.status),
      quantity: normalize(orderItem?.quantity),
      unitPriceCents: normalize(orderItem?.unitPriceCents),
      notes: normalize(orderItem?.notes),
    })),
    attachments: attachments.map((attachment) => ({
      attachmentId: normalize(attachment?.attachmentId),
      name: normalize(attachment?.name),
    })),
  };
}

function draftDirty() {
  const patient = findPatient(state.activeClientId, state.activePatientId);
  const visit = findVisit(patient, state.activeVisitId);
  if (!visit || !state.visitDraft) return false;
  const persistedSnapshot = editableVisitSnapshot(visit);
  const draftSnapshot = editableVisitSnapshot(visitFromInputs());
  return JSON.stringify(persistedSnapshot) !== JSON.stringify(draftSnapshot);
}

function editableVisitSnapshotRegressionUnit() {
  const persistedVisit = {
    visitId: "visit-1",
    visitDate: "2026-01-20",
    status: "draft",
    reasonForVisit: " Checkup ",
    vitals: { weightLbs: 12, weightKg: "5.44" },
    soap: {
      subjective: " eating well ",
      objective: " normal exam ",
      assessment: " healthy ",
      plan: " routine follow up ",
    },
    attachments: [{ attachmentId: "a1", name: "lab-result.pdf", size: 99 }],
    versions: [{ at: "2026-01-20T00:00:00.000Z" }],
    createdAt: "2026-01-20T00:00:00.000Z",
    lastEditedAt: "2026-01-20T00:00:00.000Z",
    lastEditedBy: "User",
    unknownExtraProperty: "ignore-me",
  };
  const unchangedFormVisit = {
    visitDate: "2026-01-20",
    status: "draft",
    reasonForVisit: "Checkup",
    vitals: { weightLbs: "12", weightKg: "5.44" },
    soap: {
      subjective: "eating well",
      objective: "normal exam",
      assessment: "healthy",
      plan: "routine follow up",
    },
    attachments: [
      { attachmentId: "a1", name: "lab-result.pdf", url: "blob:1" },
    ],
  };
  const editedFormVisit = {
    ...unchangedFormVisit,
    soap: { ...unchangedFormVisit.soap, plan: "updated plan" },
  };

  return {
    noWarningAfterSave:
      JSON.stringify(editableVisitSnapshot(persistedVisit)) ===
      JSON.stringify(editableVisitSnapshot(unchangedFormVisit)),
    warningAfterEdit:
      JSON.stringify(editableVisitSnapshot(persistedVisit)) !==
      JSON.stringify(editableVisitSnapshot(editedFormVisit)),
  };
}

async function guardUnsaved(onLeave = () => {}) {
  if (els.visitEditorScreen.classList.contains("hidden") || !draftDirty()) {
    onLeave();
    return true;
  }
  const choice = await showConfirm(
    "Changes and attachments will be lost unless you click Save Visit.",
    [
      { key: "stay", label: "Stay" },
      { key: "leave", label: "Leave without saving", className: "danger" },
    ],
  );
  if (choice === "leave") {
    state.visitDraft = null;
    onLeave();
    return true;
  }
  return false;
}

function applyRoute(hash) {
  const route = normalizeHash(hash);
  const parts = route
    .replace(/^#\//, "")
    .split("/")
    .filter(Boolean)
    .map(decodeURIComponent);
  if (parts.length === 1 && parts[0] === "home") {
    showScreen("home");
    renderSearchResults();
    lastRouteHash = route;
    return;
  }
  if (parts.length === 1 && parts[0] === "labs") {
    renderLabsScreen();
    showScreen("labs", { route: routeLabs() });
    lastRouteHash = route;
    return;
  }
  if (parts[0] === "reminders") {
    const rawCategory = String(parts[1] || "");
    const category =
      typeof remindersLogic.parseRemindersRouteCategory === "function"
        ? remindersLogic.parseRemindersRouteCategory(rawCategory)
        : REMINDER_CATEGORIES.dueSoonNoAppointment;
    openRemindersList(category, { syncRoute: false });
    lastRouteHash = route;
    return;
  }
  if (parts.length === 1 && parts[0] === "add-client") {
    state.newClientPatients = state.newClientPatients.length
      ? state.newClientPatients
      : [defaultPatientDraft()];
    renderNewPatientRows();
    showScreen("addClient");
    lastRouteHash = route;
    return;
  }
  if (parts[0] === "client" && parts[1] && parts.length === 2) {
    if (openClientDetail(parts[1], { syncRoute: false })) lastRouteHash = route;
    else updateHash(routeHome(), { replace: true });
    return;
  }
  if (parts[0] === "client" && parts[1] && parts[2] === "patient" && parts[3]) {
    if (openPatientDetail(parts[1], parts[3], { syncRoute: false }))
      lastRouteHash = route;
    else updateHash(routeHome(), { replace: true });
    return;
  }
  if (parts[0] === "visit" && parts[1] && parts.length === 2) {
    if (openVisitEditor(parts[1], { syncRoute: false })) lastRouteHash = route;
    else updateHash(routeHome(), { replace: true });
    return;
  }
  updateHash(routeHome(), { replace: true });
}

async function navigateTo(hash, { replace = false } = {}) {
  return guardUnsaved(() => updateHash(hash, { replace }));
}

function syncInventoryControlledUi() {
  if (!els.inventoryControlled || !els.inventoryDeaSchedule) return;
  const isControlled = els.inventoryControlled.value === "yes";
  els.inventoryDeaSchedule.disabled = !isControlled;
  if (!isControlled) els.inventoryDeaSchedule.value = "";
}

function resetInventoryForm() {
  if (!els.inventoryName) return;
  els.inventoryName.value = "";
  els.inventorySku.value = "";
  els.inventoryLotNumber.value = "";
  els.inventoryExpirationDate.value = "";
  els.inventoryOnHandQty.value = "0";
  els.inventoryUnit.value = "";
  els.inventoryUnitCost.value = "0";
  els.inventoryReorderLevel.value = "0";
  els.inventoryControlled.value = "no";
  els.inventoryDeaSchedule.value = "";
  syncInventoryControlledUi();
}

function renderInventorySection() {
  if (!els.inventoryList || !els.inventorySummary) return;
  const items = [...(state.inventoryItems || [])].sort(
    (a, b) =>
      normalizeText(a.name).localeCompare(normalizeText(b.name)) ||
      normalizeText(a.sku).localeCompare(normalizeText(b.sku)),
  );
  const totalValueCents = items.reduce(
    (sum, item) => sum + inventoryItemValueCents(item),
    0,
  );
  const lowStockCount = items.filter(
    (item) => Number(item.onHandQty || 0) <= Number(item.reorderLevel || 0),
  ).length;
  const controlledCount = items.filter((item) => item.controlled).length;
  const expiringSoonCount = items.filter((item) => {
    const value = String(item.expirationDate || "");
    if (!value) return false;
    const expiry = new Date(`${value}T12:00:00`);
    if (Number.isNaN(expiry.getTime())) return false;
    const soon = new Date();
    soon.setDate(soon.getDate() + 60);
    return expiry <= soon;
  }).length;

  els.inventorySummary.innerHTML = `
    <span class="home-metric">Items: ${items.length}</span>
    <span class="home-metric">Inventory Value: $${centsToDollars(totalValueCents)}</span>
    <span class="home-metric">Low Stock: ${lowStockCount}</span>
    <span class="home-metric">DEA Controlled: ${controlledCount}</span>
    <span class="home-metric">Expiring &lt;60d: ${expiringSoonCount}</span>
  `;

  if (!items.length) {
    els.inventoryList.innerHTML =
      "<p class='muted'>No inventory items yet.</p>";
    return;
  }

  els.inventoryList.innerHTML = items
    .map((item) => {
      const adjustments = [...(item.adjustments || [])]
        .sort((a, b) => String(b.at || "").localeCompare(String(a.at || "")))
        .slice(0, 5);
      const lowStock =
        Number(item.onHandQty || 0) <= Number(item.reorderLevel || 0);
      const controlledBadge = item.controlled
        ? ` • DEA ${esc(item.deaSchedule || "?")}`
        : "";
      return `
      <div class="card">
        <div class="inventory-item-head">
          <p><strong>${esc(item.name)}</strong> <span class="muted">${esc(item.sku || "No SKU")}</span></p>
          <button class="danger" data-delete-inventory-item="${item.itemId}">Delete</button>
        </div>
        <div class="inventory-item-meta muted">
          <span>On hand: ${esc(item.onHandQty)} ${esc(item.unit)}</span>
          <span>Unit cost: $${centsToDollars(item.unitCostCents)}</span>
          <span>Value: $${centsToDollars(inventoryItemValueCents(item))}</span>
          <span>Reorder @ ${esc(item.reorderLevel)}${lowStock ? " (LOW)" : ""}</span>
          <span>Lot: ${esc(item.lotNumber || "—")}</span>
          <span>Exp: ${esc(formatDisplayDate(item.expirationDate) || "—")}</span>
          <span>${item.controlled ? "Controlled" : "Non-controlled"}${controlledBadge}</span>
        </div>
        <div class="inventory-adjust-row">
          <input type="number" min="0.01" step="0.01" value="1" data-inventory-adjust-qty="${item.itemId}" />
          <input type="text" placeholder="Reason (sale, waste, receive, correction)" data-inventory-adjust-reason="${item.itemId}" />
          <button type="button" data-inventory-adjust="in:${item.itemId}">Add</button>
          <button type="button" data-inventory-adjust="out:${item.itemId}" class="danger">Use</button>
          <button type="button" data-inventory-adjust="set:${item.itemId}">Set Qty</button>
        </div>
        <div class="inventory-log">
          <p class="muted"><strong>Recent Adjustments</strong></p>
          ${
            adjustments.length
              ? adjustments
                  .map(
                    (entry) =>
                      `<div class="inventory-log-item muted">${esc(
                        String(entry.at || "")
                          .slice(0, 16)
                          .replace("T", " "),
                      )} • ${entry.deltaQty >= 0 ? "+" : ""}${esc(entry.deltaQty)} ${esc(item.unit)}${entry.reason ? ` • ${esc(entry.reason)}` : ""}</div>`,
                  )
                  .join("")
              : "<p class='muted'>No adjustments yet.</p>"
          }
        </div>
      </div>
    `;
    })
    .join("");
}

function renderSearchResults() {
  recomputeAllReminderStatuses();
  renderInventorySection();
  renderHomeFinanceSummary();
  renderHomeDuePaymentsSummary();
  renderHomeRemindersSummary();
  updateHomeLabsButton();
  updateHomeSettingsMenuLabels();
  const q = normalizeText(els.searchInput.value);
  const qPhone = normalizePhone(els.searchInput.value);
  const clients = state.clients.filter((client) => {
    const contacts = client.contacts || [];
    if (!q && !qPhone) return true;
    const matchName = normalizeText(
      `${client.firstName} ${client.lastName}`,
    ).includes(q);
    const matchPatient = client.patients.some((p) =>
      normalizeText(p.name).includes(q),
    );
    const matchContactName = contacts.some((contact) =>
      normalizeText(contact.name).includes(q),
    );
    const matchContactPhone = qPhone
      ? contacts.some((contact) =>
          normalizePhone(contact.phone).includes(qPhone),
        )
      : false;
    return matchName || matchPatient || matchContactName || matchContactPhone;
  });
  els.searchResults.innerHTML = clients.length
    ? clients
        .map((client) => {
          const primary = getPrimaryContact(client);
          const primaryName =
            (
              primary?.name ||
              `${client.firstName} ${client.lastName}` ||
              "Unnamed"
            ).trim() || "Unnamed";
          const primaryPhone = formatPhone(primary?.phone || "");
          const additionalContacts = (client.contacts || []).filter(
            (contact) => !contact.isPrimary && (contact.name || contact.phone),
          );
          return `
    <div class="card home-client-card">
      <div class="home-client-head">
        <div class="row-main">
          <div class="home-client-name"><button class="name-client" data-open-client="${client.clientId}">${esc(client.firstName)} ${esc(client.lastName)}</button></div>
          <div class="muted">Primary: ${esc(primaryName)}${primaryPhone ? ` • ${primaryPhone}` : ""}</div>
        </div>
      </div>
      ${additionalContacts.map((contact) => `<div class="home-contact-row muted">Additional contact: ${esc(contact.name || "Unnamed")}${contact.phone ? ` • ${formatPhone(contact.phone)}` : ""}</div>`).join("")}
      <div class="home-patient-list">
        ${client.patients
          .map((patient) => {
            const ageLabel = patient.age ? `${esc(patient.age)}y` : "Age —";
            const sexLabel = patient.sex ? esc(patient.sex) : "Sex —";
            const breedLabel = patient.breed ? esc(patient.breed) : "Breed —";
            return `<div class="home-patient-row row"><div class="row-main"><button class="name-patient" data-open-patient="${client.clientId}:${patient.patientId}">${esc(patient.name)}</button><span class="muted">${ageLabel} • ${sexLabel} • ${breedLabel}</span></div></div>`;
          })
          .join("")}
      </div>
    </div>`;
        })
        .join("")
    : "<p>No matches found.</p>";
}

function openClientDetail(clientId, { syncRoute = true } = {}) {
  const client = findClient(clientId);
  if (!client) return false;
  client.patients.forEach((patient) =>
    recomputePatientReminderStatuses(patient),
  );
  state.activeClientId = clientId;
  const primary = getPrimaryContact(client);
  const patientRows = client.patients.length
    ? client.patients
        .map((patient) => {
          const species = String(patient.species || "").trim();
          const breed = String(patient.breed || "").trim();
          const sex = String(patient.sex || "").trim();
          const signalment = `${species || "No species"}${breed ? ` • ${breed}` : ""}${sex ? ` • ${sex}` : ""}`;
          return `<div class="home-patient-row row"><div class="row-main"><button class="name-patient" data-open-patient="${client.clientId}:${patient.patientId}">${esc(patient.name || "Unnamed patient")}</button><span class="muted">${esc(signalment)}</span></div></div>`;
        })
        .join("")
    : "<p class='muted'>No patients yet.</p>";
  els.clientDetailHeader.innerHTML = `
    <div class="card">
      <p><strong>${client.firstName} ${client.lastName}</strong></p>
      <p>Primary: ${primary ? `${esc(primary.name || "Unnamed")} (${formatPhone(primary.phone)})` : "No primary contact"} ${client.email ? `• ${client.email}` : ""}</p>
      <div class="section-gap">
        <p><strong>Patients</strong></p>
        <div class="home-patient-list">${patientRows}</div>
      </div>
    </div>
  `;
  els.clientDetailActions.innerHTML = settingsMenu(
    `<button data-edit-client="${client.clientId}">Edit</button><button data-delete-client="${client.clientId}" class="danger">Delete</button>`,
  );
  if (els.clientCheckoutSummary)
    els.clientCheckoutSummary.innerHTML = renderClientCheckoutSummary(client);
  if (els.clientCheckoutPanel) els.clientCheckoutPanel.open = true;
  if (els.clientAiQuestion) els.clientAiQuestion.value = "";
  if (els.clientAiError) els.clientAiError.textContent = "";
  ensureActiveAiChat(client.clientId);
  renderClientAiChats(client.clientId);
  renderClientAiMessages(client.clientId);
  els.detailPatientName.value = "";
  els.detailPatientSpecies.value = "";
  els.detailPatientBreed.value = "";
  els.detailPatientSex.value = "";
  els.detailPatientAge.value = "";
  els.detailPatientDateOfBirth.value = "";
  els.clientDetailError.textContent = "";
  showScreen("clientDetail", {
    route: syncRoute ? routeClient(clientId) : null,
  });
  return true;
}

function inferReminderMatchesFromVisit(visit, reminders = []) {
  const note =
    `${visit.reasonForVisit || ""} ${visit.soap?.assessment || ""} ${visit.soap?.plan || ""}`.toLowerCase();
  return reminders.filter((reminder) => {
    const keywords = REMINDER_MATCH_KEYWORDS[reminder.typeCode] || [];
    return keywords.some((keyword) => note.includes(keyword));
  });
}

function renderPatientCheckoutSummary(patient, { preferredVisitId = "" } = {}) {
  const visitsByRecent = [...(patient?.visits || [])].sort(
    (a, b) =>
      String(b.visitDate || "").localeCompare(String(a.visitDate || "")) ||
      String(b.createdAt || "").localeCompare(String(a.createdAt || "")),
  );
  if (!visitsByRecent.length) {
    return `<div class="card"><h3>Checkout Summary</h3><p class="muted">No visits yet.</p></div>`;
  }

  const chargeableVisits = visitsByRecent.filter(
    (visit) => payableVisitOrderItems(visit).length,
  );
  if (!chargeableVisits.length) {
    return `<div class="card"><h3>Checkout Summary</h3><p class="muted">No charges added yet for this patient.</p></div>`;
  }
  const preferredId = String(preferredVisitId || "").trim();
  let latestVisit = preferredId
    ? chargeableVisits.find((visit) => visit.visitId === preferredId)
    : null;
  if (!latestVisit) {
    latestVisit =
      chargeableVisits.find((visit) => {
        const subtotalCents = visitSubtotalFromVisitCents(visit);
        const payment = migrateVisitPayment(visit.payment || {});
        const paidCents = Math.max(
          0,
          Number.parseInt(payment.amountPaidCents, 10) || 0,
        );
        return Math.max(0, subtotalCents - paidCents) > 0;
      }) || chargeableVisits[0];
  }

  latestVisit.payment = migrateVisitPayment(latestVisit.payment || {});
  const charges = payableVisitOrderItems(latestVisit);
  const subtotalCents = visitOrderSubtotalCents(charges);
  const payment = migrateVisitPayment(latestVisit.payment || {});
  const paidCents = Math.max(
    0,
    Number.parseInt(payment.amountPaidCents, 10) || 0,
  );
  const amountDueCents = Math.max(0, subtotalCents - paidCents);
  const paymentStatus = paymentStatusLabel(payment.status);
  const manualEntries = [...(payment.manualEntries || [])].sort((a, b) =>
    String(b.at || "").localeCompare(String(a.at || "")),
  );
  const allPaymentHistoryEntries = collectPatientPaymentHistory(patient);
  const allPaymentHistoryTotalCents = allPaymentHistoryEntries.reduce(
    (sum, row) => sum + row.amountCents,
    0,
  );
  const chargeRows = charges
    .map(
      (orderItem) => `
    <div class="row">
      <span>${esc(serviceLabel(orderItem.serviceCode))} x${esc(orderItem.quantity)}</span>
      <span class="muted">@ $${centsToDollars(orderItem.unitPriceCents)} = $${centsToDollars(orderItemLineTotalCents(orderItem))}</span>
    </div>
  `,
    )
    .join("");
  const manualHistory = manualEntries.length
    ? `
      <div class="section-gap">
        <p><strong>Latest Visit Payment Log</strong></p>
        ${manualEntries
          .map(
            (entry) => `
          <div class="card">
            <div class="row">
              <span><strong>$${centsToDollars(entry.amountCents)}</strong></span>
              <span class="muted">${esc(manualPaymentMethodLabel(entry.method))} • ${esc(
                String(entry.at || "")
                  .slice(0, 16)
                  .replace("T", " "),
              )}</span>
            </div>
            ${entry.note ? `<p class="muted">${esc(entry.note)}</p>` : ""}
          </div>
        `,
          )
          .join("")}
      </div>
    `
    : `<p class="muted">No manual payments recorded yet.</p>`;
  const allPaymentHistory = allPaymentHistoryEntries.length
    ? `
      <div class="section-gap">
        <p><strong>Payment History (All Entries)</strong></p>
        <p class="muted">Every recorded payment is listed here for this patient.</p>
        <p class="muted">Total recorded: $${centsToDollars(allPaymentHistoryTotalCents)} across ${allPaymentHistoryEntries.length} payment${allPaymentHistoryEntries.length === 1 ? "" : "s"}.</p>
        ${allPaymentHistoryEntries
          .map(
            (entry) => `
          <div class="card">
            <div class="row">
              <span><strong>$${centsToDollars(entry.amountCents)}</strong></span>
              <span class="muted">${esc(manualPaymentMethodLabel(entry.method))} • ${esc(
                String(entry.at || "")
                  .slice(0, 16)
                  .replace("T", " "),
              )}</span>
            </div>
            <p class="muted">Visit: ${esc(formatDisplayDate(entry.visitDate))}${entry.visitReason ? ` • ${esc(entry.visitReason)}` : ""}</p>
            ${entry.note ? `<p class="muted">${esc(entry.note)}</p>` : ""}
          </div>
        `,
          )
          .join("")}
      </div>
    `
    : `<p class="muted">No payment history yet.</p>`;
  const payControls =
    amountDueCents > 0
      ? `
      <div class="checkout-payments card">
        <h4>Record Manual Payment</h4>
        <p class="muted">Use this when payment happens outside this app (cash, card via Square app, or tap on phone).</p>
        <div class="row">
          <input type="number" min="0.01" step="0.01" data-manual-pay-amount="${latestVisit.visitId}" value="${centsToDollars(amountDueCents)}" />
          <select data-manual-pay-method="${latestVisit.visitId}">
            <option value="cash">Cash</option>
            <option value="card">Card</option>
            <option value="tap">Tap</option>
            <option value="check">Check</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div class="row">
          <input type="text" data-manual-pay-note="${latestVisit.visitId}" placeholder="Payment note (optional)" />
          <button type="button" data-manual-pay-record="${latestVisit.visitId}">Record Payment</button>
        </div>
        <p class="muted" data-manual-pay-status="${latestVisit.visitId}"></p>
        <div class="error" data-manual-pay-error="${latestVisit.visitId}"></div>
      </div>
    `
      : `<p class="muted">No balance due.</p>`;

  return `
    <div class="card">
      <h3>Checkout Summary</h3>
      <p class="muted">Latest visit: ${esc(formatDisplayDate(latestVisit.visitDate))} • ${esc(latestVisit.reasonForVisit || "No reason")}</p>
      ${chargeRows}
      <p><strong>Subtotal:</strong> $${centsToDollars(subtotalCents)}</p>
      <p><strong>Payment status:</strong> ${paymentStatus}</p>
      <p><strong>Amount paid:</strong> $${centsToDollars(paidCents)}</p>
      <p><strong>Amount due:</strong> $${centsToDollars(amountDueCents)}</p>
      ${payControls}
      ${manualHistory}
      ${allPaymentHistory}
    </div>
  `;
}

function renderClientCheckoutSummary(client) {
  const dueRows = collectClientCheckoutVisitRows(client, {
    includePaid: false,
  });
  const totalDueCents = dueRows.reduce((sum, row) => sum + row.dueCents, 0);
  const totalPaidCents = dueRows.reduce((sum, row) => sum + row.paidCents, 0);
  const totalSubtotalCents = dueRows.reduce(
    (sum, row) => sum + row.subtotalCents,
    0,
  );
  const duePetCount = new Set(dueRows.map((row) => row.patientId)).size;
  const paymentHistoryRows = collectClientPaymentHistory(client);
  const paymentHistoryTotalCents = paymentHistoryRows.reduce(
    (sum, row) => sum + row.amountCents,
    0,
  );
  const patientById = new Map(
    (client.patients || []).map((patient) => [
      String(patient.patientId || ""),
      patient,
    ]),
  );
  const invoiceRenderItems = dueRows.map((row) => {
    const patient = patientById.get(String(row.patientId || ""));
    const pendingReminderActions = pendingReminderActionsForCheckoutRow(
      patient,
      row,
    );
    const chargeRows = row.charges
      .map(
        (orderItem) => `
      <div class="row">
        <span>${esc(serviceLabel(orderItem.serviceCode))} x${esc(orderItem.quantity)}</span>
        <span class="muted">@ $${centsToDollars(orderItem.unitPriceCents)} = $${centsToDollars(orderItemLineTotalCents(orderItem))}</span>
      </div>
    `,
      )
      .join("");
    const reminderActionsMarkup = pendingReminderActions.length
      ? `
        <div class="section-gap">
          <p><strong>Reminder Actions</strong></p>
          <p class="muted">Use Make done before payment so due dates update correctly.</p>
          ${pendingReminderActions
            .map(
              (action) => `
            <div class="row">
              <span class="muted">${esc(action.label)}</span>
              <button type="button" data-make-done-reminder="${row.clientId}:${row.patientId}:${row.visitId}:${action.typeCode}">Make done</button>
            </div>
          `,
            )
            .join("")}
        </div>
      `
      : "";
    return {
      pendingCount: pendingReminderActions.length,
      markup: `
        <div class="card">
          <p><strong>Pet:</strong> <button class="name-patient" data-open-patient="${row.clientId}:${row.patientId}">${esc(row.patientName)}</button></p>
          <p class="muted">Visit: ${esc(formatDisplayDate(row.visitDate))}${row.visitReason ? ` • ${esc(row.visitReason)}` : ""}</p>
          ${chargeRows}
          ${reminderActionsMarkup}
          <p><strong>Subtotal:</strong> $${centsToDollars(row.subtotalCents)}</p>
          <p><strong>Payment status:</strong> ${esc(paymentStatusLabel(row.paymentStatus))}</p>
          <p><strong>Amount paid:</strong> $${centsToDollars(row.paidCents)}</p>
          <p><strong>Amount due:</strong> $${centsToDollars(row.dueCents)}</p>
        </div>
      `,
    };
  });
  const pendingMakeDoneCount = invoiceRenderItems.reduce(
    (sum, item) => sum + item.pendingCount,
    0,
  );
  const paymentBlockedByReminders = pendingMakeDoneCount > 0;
  const combinedPayControls =
    totalDueCents > 0
      ? `
      <div class="checkout-payments card">
        <h4>Record Manual Payment (All Pets)</h4>
        <p class="muted">Use one payment when the client is paying balances for multiple pets. Payment applies to oldest open visits first.</p>
        <div class="row">
          <input type="number" min="0.01" step="0.01" data-client-manual-pay-amount="${client.clientId}" value="${centsToDollars(totalDueCents)}" />
          <select data-client-manual-pay-method="${client.clientId}">
            <option value="cash">Cash</option>
            <option value="card">Card</option>
            <option value="tap">Tap</option>
            <option value="check">Check</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div class="row">
          <input type="text" data-client-manual-pay-note="${client.clientId}" placeholder="Payment note (optional)" />
          <button type="button" data-client-manual-pay-record="${client.clientId}" ${paymentBlockedByReminders ? "disabled" : ""}>Record Payment</button>
        </div>
        ${paymentBlockedByReminders ? `<p class="muted">Complete ${pendingMakeDoneCount} reminder item${pendingMakeDoneCount === 1 ? "" : "s"} using Make done before recording payment.</p>` : ""}
        <p class="muted" data-client-manual-pay-status="${client.clientId}"></p>
        <div class="error" data-client-manual-pay-error="${client.clientId}"></div>
      </div>
    `
      : `<p class="muted">No balance due right now.</p>`;
  const invoiceRowsMarkup = invoiceRenderItems.length
    ? invoiceRenderItems.map((item) => item.markup).join("")
    : `<p class="muted">No checkout charges available for this client yet.</p>`;

  const paymentHistoryRowsMarkup = paymentHistoryRows.length
    ? paymentHistoryRows
        .map(
          (entry) => `
      <div class="nested card">
        <div class="row">
          <span><strong>$${centsToDollars(entry.amountCents)}</strong></span>
          <span class="muted">${esc(manualPaymentMethodLabel(entry.method))} • ${esc(
            String(entry.at || "")
              .slice(0, 16)
              .replace("T", " "),
          )}</span>
        </div>
        <p class="muted">Pet: ${esc(entry.patientName)} • Visit: ${esc(formatDisplayDate(entry.visitDate))}${entry.visitReason ? ` • ${esc(entry.visitReason)}` : ""}</p>
        ${entry.note ? `<p class="muted">${esc(entry.note)}</p>` : ""}
      </div>
    `,
        )
        .join("")
    : `<p class="muted">No payment history yet.</p>`;
  const paymentHistoryMarkup = `
    <details class="collapsible-panel">
      <summary>Payment History (All Pets)</summary>
      <div class="collapsible-content">
        <p class="muted">Total recorded: $${centsToDollars(paymentHistoryTotalCents)} across ${paymentHistoryRows.length} payment${paymentHistoryRows.length === 1 ? "" : "s"}.</p>
        ${paymentHistoryRowsMarkup}
      </div>
    </details>
  `;

  return `
    <div class="card">
      <h3>Checkout Summary</h3>
      <p class="muted">Open invoices: ${dueRows.length} visit${dueRows.length === 1 ? "" : "s"} across ${duePetCount} pet${duePetCount === 1 ? "" : "s"}.</p>
      <p><strong>Invoice subtotal:</strong> $${centsToDollars(totalSubtotalCents)}</p>
      <p><strong>Amount paid:</strong> $${centsToDollars(totalPaidCents)}</p>
      <p><strong>Total due:</strong> $${centsToDollars(totalDueCents)}</p>
      ${combinedPayControls}
    </div>
    <div class="section-gap">${invoiceRowsMarkup}</div>
    ${paymentHistoryMarkup}
  `;
}

function renderPatientDeclinedServicesLog(patient) {
  const declinedEntries = [];
  for (const visit of patient?.visits || []) {
    const visitDate = String(visit.visitDate || "").trim();
    for (const orderItem of visit.orderedItems || []) {
      const normalized = migrateVisitOrderItem(orderItem);
      if (normalized.status !== "declined") continue;
      const eventAt = String(
        normalized.orderedAt ||
          normalized.completedAt ||
          `${visitDate}T00:00:00`,
      );
      declinedEntries.push({ visitDate, orderItem: normalized, eventAt });
    }
  }
  declinedEntries.sort((a, b) =>
    String(b.eventAt || "").localeCompare(String(a.eventAt || "")),
  );

  if (!declinedEntries.length) {
    return `<div class="card"><p class="muted">No declined services yet.</p></div>`;
  }

  const rows = declinedEntries
    .map(
      ({ visitDate, orderItem }) => `
    <div class="card">
      <p><strong>${esc(serviceLabel(orderItem.serviceCode))}</strong></p>
      <p class="muted">Declined on visit ${esc(formatDisplayDate(visitDate))} • Qty ${esc(orderItem.quantity)}</p>
      ${orderItem.notes ? `<p class="muted">Notes: ${esc(orderItem.notes)}</p>` : ""}
    </div>
  `,
    )
    .join("");

  return `<div class="section-gap">${rows}</div>`;
}

function renderPatientMedicalNotes(patient) {
  const notes = [...(patient.medicalNotes || [])]
    .filter((note) => String(note?.text || "").trim())
    .sort((a, b) =>
      String(b.notedAt || "").localeCompare(String(a.notedAt || "")),
    );
  if (!notes.length) {
    els.patientMedicalNotesList.innerHTML =
      "<p class='muted'>No medical notes yet.</p>";
    return;
  }
  els.patientMedicalNotesList.innerHTML = notes
    .map((note) => {
      const when =
        String(note.notedAt || "")
          .slice(0, 16)
          .replace("T", " ") || "Unknown date";
      return `<div class="card"><p>${textToHtml(note.text)}</p><p class="muted">Added ${esc(when)}${note.createdBy ? ` • ${esc(note.createdBy)}` : ""}</p><button class="danger" data-delete-medical-note="${note.noteId}">Delete</button></div>`;
    })
    .join("");
}

function renderPatientDiagnostics(patient) {
  if (!els.patientDiagnosticsList) return;
  const diagnosticEntries = [];
  for (const visit of patient?.visits || []) {
    const visitDate = String(visit?.visitDate || "").trim();
    const visitReason = String(visit?.reasonForVisit || "").trim();
    for (const orderItem of visit?.orderedItems || []) {
      const normalized = migrateVisitOrderItem(orderItem);
      if (serviceCategoryLabel(normalized.serviceCode) !== "diagnostic")
        continue;
      const eventAt = String(
        normalized.completedAt ||
          normalized.orderedAt ||
          `${visitDate}T00:00:00`,
      );
      diagnosticEntries.push({
        visitDate,
        visitReason,
        orderItem: normalized,
        eventAt,
      });
    }
  }
  diagnosticEntries.sort((a, b) =>
    String(b.eventAt || "").localeCompare(String(a.eventAt || "")),
  );
  if (!diagnosticEntries.length) {
    els.patientDiagnosticsList.innerHTML =
      "<p class='muted'>No diagnostics yet.</p>";
    return;
  }
  els.patientDiagnosticsList.innerHTML = diagnosticEntries
    .map((entry) => {
      const lineTotalCents = orderItemLineTotalCents(entry.orderItem);
      const resultText = String(entry.orderItem.resultText || "").trim();
      return `
      <div class="card">
        <p><strong>${esc(serviceLabel(entry.orderItem.serviceCode))}</strong></p>
        <p class="muted">Visit: ${esc(formatDisplayDate(entry.visitDate))}</p>
        <p class="muted">Status: ${esc(visitOrderStatusLabel(entry.orderItem.status))} • Qty ${esc(entry.orderItem.quantity)}${lineTotalCents > 0 ? ` • $${centsToDollars(lineTotalCents)}` : ""}</p>
        <p class="muted">Results: ${resultText ? textToHtml(resultText) : "Pending"}</p>
        ${entry.orderItem.notes ? `<p class="muted">Notes: ${esc(entry.orderItem.notes)}</p>` : ""}
      </div>
    `;
    })
    .join("");
}

function openPatientDetail(
  clientId,
  patientId,
  {
    syncRoute = true,
    focusCheckout = false,
    focusCheckoutVisitId = "",
    focusAppointmentScheduler = false,
    appointmentPrefill = null,
  } = {},
) {
  const client = findClient(clientId);
  const patient = findPatient(clientId, patientId);
  if (!client || !patient) return false;
  for (const visit of patient.visits || []) {
    visit.payment = migrateVisitPayment(visit.payment || {});
    visit.estimate = migrateVisitEstimate(
      visit.estimate || {},
      visitSubtotalFromVisitCents(visit),
    );
    syncVisitEstimateWithCharges(visit, {
      reason: "Charges changed. Re-approval required.",
    });
  }
  recomputePatientReminderStatuses(patient);
  state.activeClientId = clientId;
  state.activePatientId = patientId;
  els.patientDetailActions.innerHTML = settingsMenu(
    `<button data-edit-patient="${clientId}:${patientId}">Edit</button><button data-delete-patient="${clientId}:${patientId}" class="danger">Delete</button>`,
  );
  const primary = getPrimaryContact(client);
  const ownerLabel = primary
    ? `${primary.name || "Unnamed"} (${formatPhone(primary.phone)})`
    : `${client.firstName} ${client.lastName}`;
  const reminders = patient.preventiveReminders || [];
  const reminderSortRank = (status) =>
    ({
      overdue: 0,
      due: 1,
      upcoming: 2,
      "not due": 3,
      paused: 4,
      declined: 5,
    })[status] ?? 5;
  const remindersSorted = [...reminders].sort((a, b) => {
    const rankDelta = reminderSortRank(a.status) - reminderSortRank(b.status);
    if (rankDelta !== 0) return rankDelta;
    const aDue = String(a.dueDate || "9999-12-31");
    const bDue = String(b.dueDate || "9999-12-31");
    if (aDue !== bDue) return aDue.localeCompare(bDue);
    return String(a.typeCode || "").localeCompare(String(b.typeCode || ""));
  });
  const reminderSummary = {
    overdue: reminders.filter((reminder) => reminder.status === "overdue")
      .length,
    due: reminders.filter((reminder) => reminder.status === "due").length,
    upcoming: reminders.filter((reminder) => reminder.status === "upcoming")
      .length,
    notDue: reminders.filter((reminder) => reminder.status === "not due")
      .length,
    paused: reminders.filter((reminder) => reminder.status === "paused").length,
    declined: reminders.filter((reminder) => reminder.status === "declined")
      .length,
  };
  const statusClassForReminder = (reminder) => {
    if (reminder.status === "paused") return "paused";
    if (reminder.status === "overdue") return "overdue";
    if (reminder.status === "due") return "due";
    if (reminder.status === "upcoming") return "upcoming";
    if (reminder.status === "not due") return "not-due";
    if (reminder.status === "declined") return "declined";
    return "unknown";
  };
  const reminderRows = remindersSorted.length
    ? remindersSorted
        .map((reminder) => {
          const reminderType = esc(reminder.typeCode.replace(/_/g, " "));
          const reminderCategory = esc(reminder.category || "uncategorized");
          const reminderStatus = esc(reminder.status || "unknown");
          const statusClass = statusClassForReminder(reminder);
          const markCompleteButton = `<button type="button" data-complete-reminder="${reminder.reminderId}">Make done</button>`;
          return `
      <div class="patient-reminder-item">
        <div class="patient-reminder-head">
          <div class="patient-reminder-type">${reminderType}</div>
          <span class="patient-reminder-status ${statusClass}">${reminderStatus}</span>
        </div>
        <div class="patient-reminder-meta muted">
          <span>Category: ${reminderCategory}</span>
          <span>Due: ${esc(formatDisplayDate(reminder.dueDate))}</span>
          <span>Last completed: ${esc(formatDisplayDate(reminder.lastCompletedDate))}</span>
        </div>
        <div class="patient-reminder-actions">
          ${markCompleteButton}
          <button type="button" data-toggle-decline-reminder="${reminder.reminderId}">${reminder.status === "declined" ? "Undo declined" : "Client declined"}</button>
          <button type="button" data-edit-reminder-due="${reminder.reminderId}">Edit due date</button>
        </div>
      </div>`;
        })
        .join("")
    : "<p class='muted'>No reminders yet.</p>";
  const reminderSummaryChips = `<div class="patient-reminder-summary"><span class="patient-reminder-chip">Overdue: ${reminderSummary.overdue}</span><span class="patient-reminder-chip">Due (±1 week): ${reminderSummary.due}</span><span class="patient-reminder-chip">Upcoming: ${reminderSummary.upcoming}</span><span class="patient-reminder-chip">Not due: ${reminderSummary.notDue}</span><span class="patient-reminder-chip">Paused: ${reminderSummary.paused}</span><span class="patient-reminder-chip">Declined: ${reminderSummary.declined}</span></div>`;
  const latestWeight = latestPatientWeightPoint(patient);
  const latestWeightSignalment = latestWeight
    ? ` • Latest wt ${latestWeight.weightLbs.toFixed(2)} lbs`
    : "";
  els.patientSummary.innerHTML = `<div class="card"><p><button class="name-patient" data-open-patient="${clientId}:${patientId}">${esc(patient.name)}</button></p><p>Owner: <button class="owner-link" data-open-client="${clientId}">${esc(ownerLabel)}</button></p><p>${esc(patient.species || "No species")}${patient.breed ? ` • ${esc(patient.breed)}` : ""} ${patient.sex ? `• ${esc(patient.sex)}` : ""}${latestWeightSignalment}</p><p>Age: ${esc(patient.age || "—")} • DOB: ${esc(patient.dateOfBirth || "—")}</p><details class="collapsible-panel patient-reminder-section"><summary>Preventive Reminders</summary><div class="collapsible-content">${reminderSummaryChips}<div class="patient-reminder-list">${reminderRows}</div></div></details></div>`;
  renderPatientWeightTracker(patient);
  if (els.patientWeightLbsInput) els.patientWeightLbsInput.value = "";
  renderPatientWeightKgPreview();
  if (els.patientCheckoutSummary) {
    els.patientCheckoutSummary.innerHTML = renderPatientCheckoutSummary(
      patient,
      { preferredVisitId: focusCheckoutVisitId },
    );
  }
  els.patientDeclinedServicesLog.innerHTML =
    renderPatientDeclinedServicesLog(patient);

  const allVisits = [...patient.visits].sort(
    (a, b) =>
      String(b.visitDate || "").localeCompare(String(a.visitDate || "")) ||
      String(b.createdAt || b.lastEditedAt || "").localeCompare(
        String(a.createdAt || a.lastEditedAt || ""),
      ),
  );
  const drafts = allVisits.filter((v) => v.status !== "finalized");
  const finalized = allVisits.filter((v) => v.status === "finalized");
  const renderVisitCard = (visit) =>
    `<div class="card visit-row" data-open-visit="${visit.visitId}" role="button" tabindex="0" aria-label="Open visit from ${visit.visitDate}"><p><strong>${visit.visitDate}</strong> • ${visit.reasonForVisit || "No reason"}</p><p>SOAP: ${[visit.soap.subjective, visit.soap.objective, visit.soap.assessment, visit.soap.plan].join(" | ")}</p><p class="muted">Attachments: ${visit.attachments.map((a) => a.name).join(", ") || "None"}</p></div>`;
  const renderVisitSection = (title, visits, emptyMessage) =>
    `<section class="section-gap"><h4>${title}</h4>${visits.length ? visits.map(renderVisitCard).join("") : `<p class="muted">${emptyMessage}</p>`}</section>`;
  els.visitList.innerHTML = `${renderVisitSection("Draft Visits", drafts, "No draft visits.")}${renderVisitSection("Finalized Visits", finalized, "No finalized visits yet.")}`;

  renderPatientMedicalNotes(patient);
  renderPatientDiagnostics(patient);
  renderAttachmentRows(els.patientAttachmentList, patient.priorRecords || [], {
    deleteDataset: "data-delete-prior",
    emptyMessage: "No prior medical records.",
  });

  els.newVisitReason.value = "";
  let schedulerPrefill = appointmentPrefill;
  if (
    !schedulerPrefill &&
    pendingAppointmentSchedulerPrefill &&
    pendingAppointmentSchedulerPrefill.clientId === clientId &&
    pendingAppointmentSchedulerPrefill.patientId === patientId
  ) {
    schedulerPrefill = pendingAppointmentSchedulerPrefill;
    pendingAppointmentSchedulerPrefill = null;
    focusAppointmentScheduler = true;
  }
  renderPatientAppointmentScheduler(patient, { prefill: schedulerPrefill });
  if (els.patientMedicalNoteInput) els.patientMedicalNoteInput.value = "";
  els.patientDetailError.textContent = "";
  if (els.patientCheckoutPanel && focusCheckout) {
    els.patientCheckoutPanel.open = true;
    requestAnimationFrame(() => {
      els.patientCheckoutPanel.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }
  if (els.patientAppointmentSchedulerPanel && focusAppointmentScheduler) {
    els.patientAppointmentSchedulerPanel.open = true;
    requestAnimationFrame(() => {
      els.patientAppointmentSchedulerPanel.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }
  showScreen("patientDetail", {
    route: syncRoute ? routePatient(clientId, patientId) : null,
  });
  return true;
}

async function renderAttachmentPreview(file) {
  const dataUrl = await resolveAttachmentDataUrl(file);
  if (!dataUrl)
    return `<span>${esc(file?.name || "Attachment")}</span><span class="muted"> (unavailable)</span>`;
  if (file.type?.startsWith("image/"))
    return `<img class="attachment-thumb" src="${dataUrl}" alt="${esc(file.name)}" /><a class="attachment-link" href="${dataUrl}" download="${esc(file.name)}">Download ${esc(file.name)}</a>`;
  return `<a class="attachment-link" href="${dataUrl}" download="${esc(file.name)}">📎 ${esc(file.name)}</a>`;
}

async function renderAttachmentRows(
  container,
  attachments,
  { deleteDataset = null, emptyMessage },
) {
  if (!attachments.length) {
    container.innerHTML = `<p class='muted'>${emptyMessage}</p>`;
    return;
  }
  const items = await Promise.all(
    attachments.map(async (file) => {
      const preview = await renderAttachmentPreview(file);
      const deleteButton = deleteDataset
        ? `<button ${deleteDataset}="${file.attachmentId}" class="danger">Delete</button>`
        : "";
      return `<div class="card row">${preview}${deleteButton}</div>`;
    }),
  );
  container.innerHTML = items.join("");
}

function newVisitOrderItem(serviceCode) {
  const createdAt = nowIso();
  return migrateVisitOrderItem({
    orderItemId: crypto.randomUUID(),
    serviceCode,
    status: "completed",
    quantity: 1,
    unitPriceCents: serviceDefaultUnitPriceCents(serviceCode),
    notes: "",
    orderedAt: createdAt,
    completedAt: createdAt,
  });
}

function renderVisitOrders(orderedItems = [], { locked = false } = {}) {
  const normalizedItems = Array.isArray(orderedItems)
    ? orderedItems.map((orderItem) => migrateVisitOrderItem(orderItem))
    : [];
  const visibleItems = normalizedItems.filter(
    (orderItem) => orderItem.status !== "declined",
  );
  els.visitOrderCatalogSelect.innerHTML = `<option value="">Select service</option>${SERVICE_CATALOG.map((service) => `<option value="${service.serviceCode}">${esc(service.name)} ($${centsToDollars(service.defaultUnitPriceCents)})</option>`).join("")}`;
  els.visitOrderCatalogSelect.disabled = locked;
  els.visitOrderError.textContent = "";

  if (!visibleItems.length) {
    els.visitOrderList.innerHTML = normalizedItems.length
      ? "<p class='muted'>No active charges. Declined services moved to the patient declined log.</p>"
      : "<p class='muted'>No visit orders yet.</p>";
    els.visitOrderTotals.textContent = "Subtotal: $0.00";
    return;
  }

  els.visitOrderList.innerHTML = visibleItems
    .map(
      (orderItem) => `
    <div class="visit-order-item">
      <div class="visit-order-head">
        <div>
          <div class="visit-order-name">${esc(serviceLabel(orderItem.serviceCode))}</div>
          <div class="muted">Category: ${esc(serviceCategoryLabel(orderItem.serviceCode))} • Ordered: ${esc(
            String(orderItem.orderedAt || "")
              .slice(0, 16)
              .replace("T", " "),
          )}</div>
          <div class="muted">Status: ${visitOrderStatusLabel(orderItem.status)} • Completed: ${orderItem.completedAt ? esc(String(orderItem.completedAt).slice(0, 16).replace("T", " ")) : "—"} • Line total: $${centsToDollars(orderItemLineTotalCents(orderItem))}</div>
        </div>
        ${locked ? "" : `<div class="row"><button type="button" data-toggle-decline-visit-order="${orderItem.orderItemId}" class="${orderItem.status === "declined" ? "" : "danger"}">${orderItem.status === "declined" ? "Undo declined" : "Client declined"}</button><button type="button" class="danger" data-remove-visit-order="${orderItem.orderItemId}">Remove</button></div>`}
      </div>
      <div class="split">
        <div class="form-group">
          <label class="field-label">Qty</label>
          <input type="number" min="0.1" step="0.1" data-visit-order-qty="${orderItem.orderItemId}" value="${esc(orderItem.quantity)}" ${locked ? "disabled" : ""} />
        </div>
        <div class="form-group">
          <label class="field-label">Unit Price ($)</label>
          <input type="number" min="0" step="0.01" data-visit-order-price="${orderItem.orderItemId}" value="${esc(centsToDollars(orderItem.unitPriceCents))}" ${locked ? "disabled" : ""} />
        </div>
      </div>
      <div class="split">
        <div class="form-group">
          <label class="field-label">Notes</label>
          <input type="text" data-visit-order-notes="${orderItem.orderItemId}" value="${esc(orderItem.notes || "")}" ${locked ? "disabled" : ""} />
        </div>
      </div>
    </div>
  `,
    )
    .join("");
  els.visitOrderTotals.textContent = `Subtotal: $${centsToDollars(visitOrderSubtotalCents(visibleItems))}`;
}

function defaultVisit(reason = "") {
  const createdAt = nowIso();
  return {
    visitId: crypto.randomUUID(),
    visitDate: todayYmd(),
    appointmentStatus: "",
    reasonForVisit: reason,
    status: "draft",
    vitals: { weightLbs: "", weightKg: "" },
    soap: { subjective: "", objective: "", assessment: "", plan: "" },
    orderedItems: [],
    attachments: [],
    estimate: migrateVisitEstimate({
      status: "draft",
      preparedAt: createdAt,
      amountCents: 0,
    }),
    payment: migrateVisitPayment({ status: "unpaid" }),
    versions: [],
    createdAt,
    lastEditedAt: createdAt,
    lastEditedBy: "User",
  };
}

function openVisitEditor(visitId, { syncRoute = true } = {}) {
  const context = findVisitContext(visitId);
  if (!context) return false;
  const { clientId, patientId, visit } = context;
  state.activeClientId = clientId;
  state.activePatientId = patientId;
  state.activeVisitId = visitId;
  if (!state.visitDraft || state.visitDraft.visitId !== visitId)
    state.visitDraft = structuredClone(visit);
  clearVisitMessages();
  els.visitStatusBadge.textContent = `Current status: ${visit.status}`;
  els.visitStatusBadge.className =
    visit.status === "finalized" ? "visit-finalized" : "visit-draft";
  const patient = findPatient(clientId, patientId);
  if (patient) recomputePatientReminderStatuses(patient);
  const client = findClient(clientId);
  const ownerName =
    getPrimaryContact(client)?.name ||
    `${client?.firstName || ""} ${client?.lastName || ""}`.trim() ||
    "Unknown owner";
  els.visitPatientContext.innerHTML = patient
    ? `<p><strong>Patient:</strong> <button class="name-patient" data-open-patient="${clientId}:${patientId}">${esc(patient.name || "Unknown")}</button></p><p><strong>Owner:</strong> <button class="owner-link" data-open-client="${clientId}">${esc(ownerName)}</button></p><p class="muted">${esc(formatPatientSignalment(patient))}</p>`
    : "";
  els.visitMeta.textContent = `Created ${visit.createdAt.slice(0, 10)} • Last edited ${visit.lastEditedAt.slice(0, 10)} by ${visit.lastEditedBy}`;
  const draft = state.visitDraft;
  if (!Array.isArray(draft.orderedItems)) draft.orderedItems = [];
  els.visitDate.value = draft.visitDate;
  els.visitReason.value = draft.reasonForVisit;
  els.visitWeightLbs.value = draft.vitals.weightLbs;
  els.visitWeightKgPreview.textContent = draft.vitals.weightKg || "0.00";
  renderVisitWeightTracker();
  els.soapSubjective.value = draft.soap.subjective;
  els.soapObjective.value = draft.soap.objective;
  els.soapAssessment.value = draft.soap.assessment;
  els.soapPlan.value = draft.soap.plan;
  renderAttachmentRows(els.attachmentList, draft.attachments, {
    deleteDataset:
      visit.status === "finalized" ? null : "data-delete-attachment",
    emptyMessage: "No attachments.",
  });
  const locked = visit.status === "finalized";
  renderVisitOrders(draft.orderedItems, { locked });
  [
    els.visitDate,
    els.visitReason,
    els.visitWeightLbs,
    els.soapSubjective,
    els.soapObjective,
    els.soapAssessment,
    els.soapPlan,
    els.addAttachmentBtn,
    els.saveVisitBtn,
    els.finalizeVisitBtn,
  ].forEach((el) => {
    el.disabled = locked;
  });
  els.deleteVisitBtn.disabled = locked;
  els.deleteVisitBtn.classList.toggle("hidden", locked);
  els.visitDeleteHelpText.textContent = locked
    ? "This visit is finalized and cannot be deleted."
    : "Draft visits can be deleted.";
  showScreen("visitEditor", { route: syncRoute ? routeVisit(visitId) : null });
  return true;
}

async function saveVisit(message = "Visit saved.") {
  const patient = findPatient(state.activeClientId, state.activePatientId);
  const visit = findVisit(patient, state.activeVisitId);
  if (!visit || visit.status === "finalized") return false;
  const nextSnapshot = visitFromInputs();
  Object.assign(visit, nextSnapshot, {
    lastEditedAt: nowIso(),
    lastEditedBy: "User",
  });
  syncVisitEstimateWithCharges(visit, {
    reason: "Charges or pricing changed.",
  });
  syncOrderDrivenReminderEffects(patient);
  state.visitDraft = structuredClone(visit);
  els.visitWeightKgPreview.textContent = visit.vitals.weightKg || "0.00";
  renderVisitWeightTracker();
  const saveResult = await persist();
  if (!saveResult.ok) {
    els.visitEditorError.textContent =
      "Could not save to browser storage; record not persisted.";
    els.visitEditorSuccess.textContent = "";
    return false;
  }
  els.visitEditorSuccess.textContent = message;
  renderSearchResults();
  if (!els.remindersScreen.classList.contains("hidden"))
    renderRemindersListScreen();
  return true;
}
function hasRequiredSoap(v) {
  return [
    v.soap.subjective,
    v.soap.objective,
    v.soap.assessment,
    v.soap.plan,
  ].every((x) => x.trim());
}

function buildRecordLines({ client, patient, visit, draft }) {
  const orderedItemsSummary = (visit.orderedItems || [])
    .map(
      (orderItem) =>
        `${serviceLabel(orderItem.serviceCode)} x${orderItem.quantity || 1} (${visitOrderStatusLabel(orderItem.status)}) $${centsToDollars(orderItemLineTotalCents(orderItem))}`,
    )
    .join(", ");
  const subtotal = visitOrderSubtotalCents(visit.orderedItems || []);
  const estimate = migrateVisitEstimate(visit.estimate || {}, subtotal);
  const payment = migrateVisitPayment(visit.payment || {});
  const paid = Math.max(0, payment.amountPaidCents || 0);
  const due = Math.max(0, subtotal - paid);
  return [
    `${draft ? "DRAFT" : "FINAL"} MEDICAL RECORD`,
    `Client: ${client.firstName} ${client.lastName} (${formatPhone(getPrimaryContact(client)?.phone || "")})`,
    `Patient: ${patient.name}`,
    `Visit Date: ${visit.visitDate}`,
    `Reason: ${visit.reasonForVisit}`,
    `Charges: ${orderedItemsSummary || "None"}`,
    `Subtotal: $${centsToDollars(subtotal)}`,
    `Estimate: ${estimateStatusLabel(estimate.status)} • $${centsToDollars(estimate.amountCents)}`,
    `Payment: ${paymentStatusLabel(payment.status)} • paid $${centsToDollars(paid)} • due $${centsToDollars(due)}`,
    `SOAP:`,
    `- Subjective: ${visit.soap.subjective}`,
    `- Objective: ${visit.soap.objective}`,
    `- Assessment: ${visit.soap.assessment}`,
    `- Plan: ${visit.soap.plan}`,
    `Attachments: ${visit.attachments.map((a) => a.name).join(", ") || "None"}`,
  ];
}

function buildPatientRecordLines({
  client,
  patient,
  visits,
  priorRecords = [],
}) {
  const sections = [
    "FINAL MEDICAL RECORD",
    `Client: ${client.firstName} ${client.lastName} (${formatPhone(getPrimaryContact(client)?.phone || "")})`,
    `Patient: ${patient.name}`,
    `Included Visits: ${visits.length}`,
    `Included Prior Records: ${priorRecords.length}`,
    "",
  ];

  visits.forEach((visit, index) => {
    sections.push(
      `Visit ${index + 1}: ${visit.visitDate} • ${visit.reasonForVisit || "No reason"}`,
    );
    const orderedItemsSummary = (visit.orderedItems || [])
      .map(
        (orderItem) =>
          `${serviceLabel(orderItem.serviceCode)} x${orderItem.quantity || 1} (${visitOrderStatusLabel(orderItem.status)}) $${centsToDollars(orderItemLineTotalCents(orderItem))}`,
      )
      .join(", ");
    const estimate = migrateVisitEstimate(
      visit.estimate || {},
      visitOrderSubtotalCents(visit.orderedItems || []),
    );
    const payment = migrateVisitPayment(visit.payment || {});
    const paid = Math.max(0, payment.amountPaidCents || 0);
    const due = Math.max(
      0,
      visitOrderSubtotalCents(visit.orderedItems || []) - paid,
    );
    sections.push(`Charges: ${orderedItemsSummary || "None"}`);
    sections.push(
      `Subtotal: $${centsToDollars(visitOrderSubtotalCents(visit.orderedItems || []))}`,
    );
    sections.push(
      `Estimate: ${estimateStatusLabel(estimate.status)} • $${centsToDollars(estimate.amountCents)}`,
    );
    sections.push(
      `Payment: ${paymentStatusLabel(payment.status)} • paid $${centsToDollars(paid)} • due $${centsToDollars(due)}`,
    );
    sections.push(`SOAP:`);
    sections.push(`- Subjective: ${visit.soap.subjective}`);
    sections.push(`- Objective: ${visit.soap.objective}`);
    sections.push(`- Assessment: ${visit.soap.assessment}`);
    sections.push(`- Plan: ${visit.soap.plan}`);
    sections.push(
      `Attachments: ${visit.attachments.map((a) => a.name).join(", ") || "None"}`,
    );
    sections.push("");
  });

  if (priorRecords.length) {
    sections.push("Prior Medical Records:");
    priorRecords.forEach((record, index) => {
      sections.push(
        `- Record ${index + 1}: ${record.name || "Unnamed attachment"}`,
      );
      sections.push(`  • Type: ${record.type || "Unknown"}`);
      sections.push(
        `  • Linked: ${record.linkedAt ? String(record.linkedAt).slice(0, 10) : "Unknown"}`,
      );
    });
    sections.push("");
  }

  return sections;
}

function exportPdf(record, filename) {
  const lines = record.visits
    ? buildPatientRecordLines(record)
    : buildRecordLines(record);
  const safe = (txt) =>
    String(txt)
      .replace(/\\/g, "\\\\")
      .replace(/\(/g, "\\(")
      .replace(/\)/g, "\\)");
  const textContent = [
    "BT",
    "/F1 12 Tf",
    "50 780 Td",
    ...lines.map(
      (line, i) => `${i === 0 ? "" : "0 -16 Td"} (${safe(line)}) Tj`,
    ),
    "ET",
  ].join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${textContent.length} >>\nstream\n${textContent}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((obj, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  });
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i < offsets.length; i++)
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  downloadBlob(new Blob([pdf], { type: "application/pdf" }), filename);
}

function crc32(bytes) {
  let c = -1;
  for (let i = 0; i < bytes.length; i++) {
    c ^= bytes[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return (c ^ -1) >>> 0;
}

function makeDocxBlob(record) {
  const textToXml = (t) => esc(t).replace(/\n/g, " ");
  const lines = buildRecordLines(record);
  const body = lines
    .map(
      (line) =>
        `<w:p><w:r><w:t xml:space="preserve">${textToXml(line)}</w:t></w:r></w:p>`,
    )
    .join("");
  const files = [
    [
      "[Content_Types].xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`,
    ],
    [
      "_rels/.rels",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`,
    ],
    [
      "word/document.xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" mc:Ignorable="w14 wp14"><w:body>${body}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr></w:body></w:document>`,
    ],
  ];
  const encoder = new TextEncoder();
  let offset = 0;
  const chunks = [];
  const central = [];
  for (const [name, content] of files) {
    const nameBytes = encoder.encode(name);
    const data = encoder.encode(content);
    const crc = crc32(data);
    const local = new Uint8Array(30 + nameBytes.length + data.length);
    const dv = new DataView(local.buffer);
    dv.setUint32(0, 0x04034b50, true);
    dv.setUint16(4, 20, true);
    dv.setUint16(6, 0, true);
    dv.setUint16(8, 0, true);
    dv.setUint16(10, 0, true);
    dv.setUint16(12, 0, true);
    dv.setUint32(14, crc, true);
    dv.setUint32(18, data.length, true);
    dv.setUint32(22, data.length, true);
    dv.setUint16(26, nameBytes.length, true);
    dv.setUint16(28, 0, true);
    local.set(nameBytes, 30);
    local.set(data, 30 + nameBytes.length);
    chunks.push(local);

    const cd = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(cd.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, 0, true);
    cv.setUint16(14, 0, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, data.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true);
    cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true);
    cv.setUint16(36, 0, true);
    cv.setUint32(38, 0, true);
    cv.setUint32(42, offset, true);
    cd.set(nameBytes, 46);
    central.push(cd);
    offset += local.length;
  }
  const centralSize = central.reduce((sum, c) => sum + c.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);
  ev.setUint16(20, 0, true);
  return new Blob([...chunks, ...central, end], {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
}

function slugifyName(value) {
  return (
    String(value || "patient")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "patient"
  );
}

function buildPatientExportFilename(patient, visits) {
  const patientSlug = slugifyName(patient.name);
  if (visits.length === 1)
    return `patient-record-${patientSlug}-${visits[0].visitDate}.pdf`;
  const first = visits[0]?.visitDate;
  const last = visits[visits.length - 1]?.visitDate;
  if (first && last)
    return `patient-record-${patientSlug}-${first}-to-${last}.pdf`;
  return `patient-record-${patientSlug}-${visits.length}-visits.pdf`;
}

function exportPatientVisitsPdf({
  client,
  patient,
  visits,
  priorRecords = [],
}) {
  const sortedVisits = [...visits].sort((a, b) =>
    a.visitDate.localeCompare(b.visitDate),
  );
  const sortedPriorRecords = [...priorRecords].sort((a, b) =>
    String(a.linkedAt || "").localeCompare(String(b.linkedAt || "")),
  );
  const filename = buildPatientExportFilename(patient, sortedVisits);
  exportPdf(
    { client, patient, visits: sortedVisits, priorRecords: sortedPriorRecords },
    filename,
  );
}

async function exportPatientBundle({
  client,
  patient,
  visits,
  priorRecords = [],
}) {
  const JSZip = await loadZipLibrary();
  const byNewestDate = (a, b, key) =>
    String(b?.[key] || "").localeCompare(String(a?.[key] || ""));
  const sortedVisits = [...visits].sort((a, b) =>
    byNewestDate(a, b, "visitDate"),
  );
  const sortedPriorRecords = [...priorRecords].sort((a, b) =>
    byNewestDate(a, b, "linkedAt"),
  );
  const zip = new JSZip();
  const ownerRecordsFolder = zip.folder("Owner Provided Medical Records");
  const summaryReportsFolder = zip.folder("Dr. Sal's Medical Summary Reports");
  const imagesFolder = zip.folder("Images");
  const usedNames = new Set();

  const uniqueName = (folderName, filename) => {
    const ext = filename.includes(".")
      ? filename.slice(filename.lastIndexOf("."))
      : "";
    const base = ext ? filename.slice(0, -ext.length) : filename;
    let candidate = filename;
    let n = 2;
    while (usedNames.has(`${folderName}/${candidate}`)) {
      candidate = `${base}-${n}${ext}`;
      n += 1;
    }
    usedNames.add(`${folderName}/${candidate}`);
    return candidate;
  };

  const addAttachmentFile = async (attachment, folder, folderName, prefix) => {
    if (!attachment) return;
    const blob = await getAttachmentBlob(
      attachment.blobKey || attachmentBlobKeyFor(attachment),
    );
    if (!blob) return;
    const baseName = sanitizeFilename(attachment.name, `${prefix}-attachment`);
    const filename = uniqueName(folderName, `${prefix}-${baseName}`);
    folder.file(filename, blob);
  };

  const addTextFile = (folder, folderName, filename, content) => {
    const candidate = uniqueName(folderName, filename);
    folder.file(candidate, content);
  };

  const isImageAttachment = (attachment) =>
    String(attachment?.type || "")
      .toLowerCase()
      .startsWith("image/");

  for (const record of sortedPriorRecords) {
    await addAttachmentFile(
      record,
      ownerRecordsFolder,
      "Owner Provided Medical Records",
      "owner-record",
    );
  }

  for (const [index, visit] of sortedVisits.entries()) {
    const reportContent = [
      `Visit Date: ${visit.visitDate || "Unknown"}`,
      `Reason: ${visit.reasonForVisit || "No reason provided"}`,
      "",
      "SOAP",
      `Subjective: ${visit.soap.subjective || ""}`,
      `Objective: ${visit.soap.objective || ""}`,
      `Assessment: ${visit.soap.assessment || ""}`,
      `Plan: ${visit.soap.plan || ""}`,
    ].join("\n");
    const safeDate = String(visit.visitDate || "unknown-date").replace(
      /[^0-9-]/g,
      "",
    );
    const reportFilename = `${safeDate || "unknown-date"}-dr-sal-summary-${index + 1}.txt`;
    addTextFile(
      summaryReportsFolder,
      "Dr. Sal's Medical Summary Reports",
      reportFilename,
      reportContent,
    );
  }

  const imageAttachments = [
    ...sortedPriorRecords.filter(isImageAttachment),
    ...sortedVisits
      .flatMap((visit) =>
        (visit.attachments || []).map((attachment) => ({
          ...attachment,
          linkedAt: attachment.linkedAt || visit.visitDate || "",
        })),
      )
      .filter(isImageAttachment),
  ].sort((a, b) => byNewestDate(a, b, "linkedAt"));

  for (const imageAttachment of imageAttachments) {
    await addAttachmentFile(imageAttachment, imagesFolder, "Images", "image");
  }

  const zipBlob = await zip.generateAsync({ type: "blob" });
  const patientSlug = slugifyName(patient.name);
  downloadBlob(zipBlob, `patient-export-${patientSlug}.zip`);
}

function exportRecord({ client, patient, visit, draft }, format = "pdf") {
  const filename = `${patient.name.replace(/\s+/g, "_")}-${visit.visitDate}.${format}`;
  const record = { client, patient, visit, draft };
  if (format === "pdf") return exportPdf(record, filename);
  if (format === "docx") return downloadBlob(makeDocxBlob(record), filename);
}

// events
els.searchInput.addEventListener("input", renderSearchResults);
els.askClientAiBtn.addEventListener("click", async () => {
  const client = findClient(state.activeClientId);
  const parsed = parseAiQuestionInput(els.clientAiQuestion.value);
  const question = parsed.question;
  els.clientAiError.textContent = "";
  if (!client) {
    els.clientAiError.textContent = "Open a client first.";
    return;
  }
  if (!question) {
    els.clientAiError.textContent = "Enter a question first.";
    return;
  }

  const chat = ensureActiveAiChat(client.clientId);
  const priorMessages = [...chat.messages];
  const askBtnDefaultLabel = els.askClientAiBtn.textContent || "Send";
  chat.messages.push({
    role: "user",
    content: question,
    model: "",
    at: nowIso(),
  });
  renderClientAiMessages(client.clientId);
  renderClientAiChats(client.clientId);
  els.clientAiQuestion.value = "";
  els.askClientAiBtn.disabled = true;
  els.askClientAiBtn.textContent = "Analyzing files...";
  try {
    const result = await askClientAiViaApi(client, question, {
      modelPreference: parsed.modelPreference,
      messages: priorMessages,
    });
    chat.messages.push({
      role: "assistant",
      content: result.answer,
      model: result.model,
      at: nowIso(),
    });
    if (!priorMessages.find((message) => message.role === "user")) {
      chat.title = question.slice(0, 52) || chat.title;
    }
    renderClientAiMessages(client.clientId);
    renderClientAiChats(client.clientId);
    persist().catch(() => {});
  } catch (error) {
    const message = String(error?.message || "");
    const isConnectionIssue =
      error?.name === "AbortError" || error instanceof TypeError;
    els.clientAiError.textContent = isConnectionIssue
      ? "Could not reach OneClick API server on port 4242."
      : message;
    chat.messages.push({
      role: "assistant",
      content: "I could not complete that request. Please try again.",
      model: "error",
      at: nowIso(),
    });
    renderClientAiMessages(client.clientId);
  } finally {
    els.askClientAiBtn.disabled = false;
    els.askClientAiBtn.textContent = askBtnDefaultLabel;
  }
});
if (els.clientAiNewChatBtn) {
  els.clientAiNewChatBtn.addEventListener("click", () => {
    const client = findClient(state.activeClientId);
    if (!client) return;
    createAiChat(client.clientId);
    renderClientAiChats(client.clientId);
    renderClientAiMessages(client.clientId);
    els.clientAiError.textContent = "";
    els.clientAiQuestion.value = "";
    persist().catch(() => {});
  });
}
if (els.clientAiChatSelect) {
  els.clientAiChatSelect.addEventListener("change", () => {
    const client = findClient(state.activeClientId);
    if (!client) return;
    const chatId = String(els.clientAiChatSelect.value || "").trim();
    if (!chatId) return;
    setActiveAiChatId(client.clientId, chatId);
    renderClientAiChats(client.clientId);
    renderClientAiMessages(client.clientId);
    els.clientAiError.textContent = "";
  });
}
if (els.clientAiQuestion) {
  els.clientAiQuestion.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    if (!els.askClientAiBtn.disabled) els.askClientAiBtn.click();
  });
}
els.openAddClientBtn.addEventListener("click", () => {
  state.newClientPatients = [defaultPatientDraft()];
  renderNewPatientRows();
  renderContactRows(els.clientContactsList, [], "new");
  showScreen("addClient", { route: routeAddClient() });
});
els.addPatientRowBtn.addEventListener("click", () => {
  state.newClientPatients.push(defaultPatientDraft());
  renderNewPatientRows();
});
els.addClientContactBtn.addEventListener("click", () => addContactRow("new"));
els.addEditClientContactBtn.addEventListener("click", () =>
  addContactRow("edit"),
);
if (els.inventoryControlled) {
  els.inventoryControlled.addEventListener("change", syncInventoryControlledUi);
  syncInventoryControlledUi();
}
if (els.addInventoryItemBtn) {
  els.addInventoryItemBtn.addEventListener("click", async () => {
    const name = String(els.inventoryName?.value || "").trim();
    const onHandQty = Number.parseFloat(
      String(els.inventoryOnHandQty?.value || "").trim(),
    );
    const reorderLevel = Number.parseFloat(
      String(els.inventoryReorderLevel?.value || "").trim(),
    );
    const unitCostCents = dollarsToCents(els.inventoryUnitCost?.value);
    const controlled = els.inventoryControlled?.value === "yes";
    const deaSchedule = String(els.inventoryDeaSchedule?.value || "")
      .trim()
      .toUpperCase();

    if (!name) {
      els.inventoryError.textContent = "Inventory item name is required.";
      return;
    }
    if (!Number.isFinite(onHandQty) || onHandQty < 0) {
      els.inventoryError.textContent = "On-hand quantity must be 0 or greater.";
      return;
    }
    if (!Number.isFinite(reorderLevel) || reorderLevel < 0) {
      els.inventoryError.textContent = "Reorder level must be 0 or greater.";
      return;
    }
    if (unitCostCents === null || unitCostCents < 0) {
      els.inventoryError.textContent = "Unit cost must be 0 or greater.";
      return;
    }
    if (controlled && !deaSchedule) {
      els.inventoryError.textContent =
        "Select DEA schedule for controlled substances.";
      return;
    }

    if (!Array.isArray(state.inventoryItems)) state.inventoryItems = [];
    state.inventoryItems.push(
      normalizeInventoryItem({
        itemId: crypto.randomUUID(),
        name,
        sku: els.inventorySku?.value || "",
        lotNumber: els.inventoryLotNumber?.value || "",
        expirationDate: els.inventoryExpirationDate?.value || "",
        unit: els.inventoryUnit?.value || "unit",
        onHandQty,
        reorderLevel,
        unitCostCents,
        controlled,
        deaSchedule: controlled ? deaSchedule : "",
        adjustments: [
          {
            adjustmentId: crypto.randomUUID(),
            at: nowIso(),
            deltaQty: onHandQty,
            reason: "Initial inventory entry",
            actor: "User",
          },
        ],
      }),
    );

    const saveResult = await persist();
    if (!saveResult.ok) {
      els.inventoryError.textContent =
        "Could not save inventory to browser storage.";
      state.inventoryItems.pop();
      return;
    }
    els.inventoryError.textContent = "";
    resetInventoryForm();
    renderInventorySection();
    showFlash("success", "Inventory item added.");
  });
}

function renderContactRows(container, contacts, mode) {
  container.innerHTML = contacts
    .map(
      (contact, index) => `
    <div class="card form-stack">
      <div class="form-group"><label class="field-label">Contact Name</label><input data-contact-name="${mode}:${index}" value="${esc(contact.name)}" /></div>
      <div class="form-group"><label class="field-label">Phone</label><input data-contact-phone="${mode}:${index}" value="${esc(formatPhone(contact.phone))}" /></div>
      <div class="actions-row"><button data-remove-contact="${mode}:${index}" class="danger">Remove</button></div>
    </div>`,
    )
    .join("");
}

function contactsFromDom(mode) {
  const selector =
    mode === "new" ? "#clientContactsList" : "#editClientContactsList";
  const container = document.querySelector(selector);
  if (!container) return [];
  const names = Array.from(container.querySelectorAll("[data-contact-name]"));
  return names.map((nameInput, index) => {
    const phoneInput = container.querySelector(
      `[data-contact-phone="${mode}:${index}"]`,
    );
    return {
      name: nameInput.value.trim(),
      phone: normalizePhone(phoneInput?.value || ""),
      isPrimary: false,
    };
  });
}

function addContactRow(mode) {
  const contacts = contactsFromDom(mode);
  contacts.push(defaultContact());
  renderContactRows(
    mode === "new" ? els.clientContactsList : els.editClientContactsList,
    contacts,
    mode,
  );
}

function validateContacts(contacts) {
  const incomplete = contacts.find(
    (contact) =>
      (contact.name && !contact.phone) || (!contact.name && contact.phone),
  );
  if (incomplete)
    return "Each additional contact must include both name and phone.";
  return "";
}

function renderNewPatientRows() {
  const speciesOptions = ["Dog", "Cat", "Bird", "Rabbit", "Other"];
  const sexOptions = [
    "Spayed Female",
    "Neutered Male",
    "Intact Female",
    "Intact Male",
    "Unknown",
  ];
  els.newPatientList.innerHTML = state.newClientPatients
    .map(
      (p, i) =>
        `<div class="card form-stack"><div class="form-group"><label class="field-label">Name</label><input data-newpatient-name="${i}" value="${esc(p.name)}" /></div><div class="form-group"><label class="field-label">Species</label><select data-newpatient-species="${i}"><option value="">Select species</option>${speciesOptions.map((o) => `<option ${p.species === o ? "selected" : ""}>${o}</option>`).join("")}</select></div><div class="form-group"><label class="field-label">Breed</label><input data-newpatient-breed="${i}" value="${esc(p.breed || "")}" /></div><div class="form-group"><label class="field-label">Sex</label><select data-newpatient-sex="${i}"><option value="">Select option</option>${sexOptions.map((o) => `<option ${p.sex === o ? "selected" : ""}>${o}</option>`).join("")}</select></div><div class="split"><div class="form-group"><label class="field-label">Age (years)</label><input data-newpatient-age="${i}" type="number" min="0" value="${esc(p.age || "")}" /></div><div class="form-group"><label class="field-label">Date of Birth</label><input data-newpatient-dob="${i}" type="date" value="${esc(p.dateOfBirth || "")}" /></div></div><div class="actions-row"><button data-remove-newpatient="${i}" class="danger">Remove</button></div></div>`,
    )
    .join("");
}

function syncPatientAgeDob(ageEl, dobEl, source) {
  if (source === "age") {
    dobEl.value = computeDateOfBirthFromAge(ageEl.value);
  } else if (source === "dob") {
    ageEl.value = computeAgeFromDateOfBirth(dobEl.value);
  }
}

els.saveClientBtn.addEventListener("click", async () => {
  const firstName = els.clientFirstName.value.trim(),
    lastName = els.clientLastName.value.trim();
  const primaryPhone = normalizePhone(els.clientPhone.value);
  const contacts = contactsFromDom("new").filter((c) => c.name || c.phone);
  const validPatients = state.newClientPatients
    .map((p) => ({ ...p, name: p.name.trim() }))
    .filter((p) => p.name);
  if (!firstName || !lastName || !primaryPhone)
    return (els.addClientError.textContent =
      "Please complete required client fields.");
  const contactError = validateContacts(contacts);
  if (contactError) return (els.addClientError.textContent = contactError);
  if (!validPatients.length)
    return (els.addClientError.textContent =
      "At least one patient is required.");
  const primaryContact = {
    name: `${firstName} ${lastName}`.trim(),
    phone: primaryPhone,
    isPrimary: true,
  };
  state.clients.push({
    clientId: crypto.randomUUID(),
    firstName,
    lastName,
    contacts: [
      primaryContact,
      ...contacts.map((contact) => ({ ...contact, isPrimary: false })),
    ],
    email: els.clientEmail.value.trim(),
    patients: validPatients.map((p) => {
      const patient = {
        ...p,
        patientId: crypto.randomUUID(),
        medicalNotes: [],
        priorRecords: [],
        preventiveReminders: [],
        visits: [],
        protocolEnabled: false,
      };
      setPatientProtocolEnabled(patient, true);
      return patient;
    }),
  });
  const saveResult = await persist();
  if (!saveResult.ok) {
    els.addClientError.textContent =
      "Could not save to browser storage; record not persisted.";
    return;
  }
  showScreen("home", { route: routeHome() });
  renderSearchResults();
  showFlash("success", "Client created.");
});

els.saveClientEditBtn.addEventListener("click", async () => {
  const client = findClient(state.editingClientId);
  if (!client) return;
  const firstName = els.editClientFirstName.value.trim(),
    lastName = els.editClientLastName.value.trim();
  const primaryPhone = normalizePhone(els.editClientPhone.value);
  const contacts = contactsFromDom("edit").filter((c) => c.name || c.phone);
  if (!firstName || !lastName || !primaryPhone)
    return (els.editClientError.textContent = "Required fields missing.");
  const contactError = validateContacts(contacts);
  if (contactError) return (els.editClientError.textContent = contactError);
  const primaryContact = {
    name: `${firstName} ${lastName}`.trim(),
    phone: primaryPhone,
    isPrimary: true,
  };
  Object.assign(client, {
    firstName,
    lastName,
    contacts: [
      primaryContact,
      ...contacts.map((contact) => ({ ...contact, isPrimary: false })),
    ],
    email: els.editClientEmail.value.trim(),
  });
  const saveResult = await persist();
  if (!saveResult.ok) {
    els.editClientError.textContent =
      "Could not save to browser storage; record not persisted.";
    return;
  }
  openClientDetail(client.clientId);
  renderSearchResults();
});

els.saveDetailPatientBtn.addEventListener("click", async () => {
  const client = findClient(state.activeClientId);
  if (!client) return;
  const name = els.detailPatientName.value.trim();
  if (!name)
    return (els.clientDetailError.textContent = "Patient name is required.");
  const patient = {
    patientId: crypto.randomUUID(),
    name,
    species: els.detailPatientSpecies.value,
    breed: els.detailPatientBreed.value,
    sex: els.detailPatientSex.value,
    age: els.detailPatientAge.value,
    dateOfBirth: els.detailPatientDateOfBirth.value,
    medicalNotes: [],
    priorRecords: [],
    preventiveReminders: [],
    visits: [],
    protocolEnabled: false,
  };
  setPatientProtocolEnabled(patient, true);
  client.patients.push(patient);
  const saveResult = await persist();
  if (!saveResult.ok) {
    els.clientDetailError.textContent =
      "Could not save to browser storage; record not persisted.";
    return;
  }
  openClientDetail(client.clientId);
});

els.savePatientEditBtn.addEventListener("click", async () => {
  const patient = findPatient(state.activeClientId, state.editingPatientId);
  if (!patient) return;
  if (!els.editPatientName.value.trim())
    return (els.editPatientError.textContent = "Patient name is required.");
  Object.assign(patient, {
    name: els.editPatientName.value.trim(),
    species: els.editPatientSpecies.value,
    breed: els.editPatientBreed.value.trim(),
    sex: els.editPatientSex.value,
    age: els.editPatientAge.value,
    dateOfBirth: els.editPatientDateOfBirth.value,
  });
  if (patient.protocolEnabled) seedRemindersFromTemplateCatalog(patient);
  const saveResult = await persist();
  if (!saveResult.ok) {
    els.editPatientError.textContent =
      "Could not save to browser storage; record not persisted.";
    return;
  }
  openClientDetail(state.activeClientId);
  renderSearchResults();
});

els.detailPatientAge.addEventListener("input", () =>
  syncPatientAgeDob(els.detailPatientAge, els.detailPatientDateOfBirth, "age"),
);
els.detailPatientDateOfBirth.addEventListener("input", () =>
  syncPatientAgeDob(els.detailPatientAge, els.detailPatientDateOfBirth, "dob"),
);
els.editPatientAge.addEventListener("input", () =>
  syncPatientAgeDob(els.editPatientAge, els.editPatientDateOfBirth, "age"),
);
els.editPatientDateOfBirth.addEventListener("input", () =>
  syncPatientAgeDob(els.editPatientAge, els.editPatientDateOfBirth, "dob"),
);

els.startVisitBtn.addEventListener("click", async () => {
  const patient = findPatient(state.activeClientId, state.activePatientId);
  if (!patient) {
    els.patientDetailError.textContent =
      "Could not open this patient record. Please reload and try again.";
    return;
  }
  try {
    if (!Array.isArray(patient.visits)) patient.visits = [];
    const visit = defaultVisit(els.newVisitReason.value.trim());
    patient.visits.push(visit);
    const saveResult = await persist();
    if (!saveResult.ok) {
      els.patientDetailError.textContent =
        "Could not save to browser storage; record not persisted.";
      return;
    }
    els.patientDetailError.textContent = "";
    openVisitEditor(visit.visitId);
  } catch {
    els.patientDetailError.textContent =
      "Could not start a new visit. Please try again.";
  }
});

if (els.schedulePatientAppointmentBtn) {
  els.schedulePatientAppointmentBtn.addEventListener("click", async () => {
    const patient = findPatient(state.activeClientId, state.activePatientId);
    if (!patient) {
      if (els.patientAppointmentSchedulerError)
        els.patientAppointmentSchedulerError.textContent =
          "Could not open this patient record. Please reload and try again.";
      return;
    }
    const appointmentDate = String(
      els.patientAppointmentDateInput?.value || "",
    ).trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(appointmentDate)) {
      if (els.patientAppointmentSchedulerError)
        els.patientAppointmentSchedulerError.textContent =
          "Please choose a valid appointment date.";
      return;
    }
    const appointmentStatus = String(
      els.patientAppointmentStatusInput?.value || "scheduled",
    )
      .trim()
      .toLowerCase();
    const reasonForVisit =
      String(els.patientAppointmentReasonInput?.value || "").trim() ||
      "Reminder follow-up";
    if (!Array.isArray(patient.visits)) patient.visits = [];
    const visit = defaultVisit(reasonForVisit);
    visit.visitDate = appointmentDate;
    visit.appointmentStatus = ["scheduled", "confirmed"].includes(
      appointmentStatus,
    )
      ? appointmentStatus
      : "scheduled";
    patient.visits.push(visit);
    const saveResult = await persist();
    if (!saveResult.ok) {
      if (els.patientAppointmentSchedulerError)
        els.patientAppointmentSchedulerError.textContent =
          "Could not save appointment. Please try again.";
      return;
    }
    if (els.patientAppointmentSchedulerError)
      els.patientAppointmentSchedulerError.textContent = "";
    openPatientDetail(state.activeClientId, state.activePatientId, {
      focusAppointmentScheduler: true,
    });
    showFlash(
      "success",
      `Appointment ${visit.appointmentStatus} for ${formatDisplayDate(appointmentDate)}.`,
    );
  });
}

if (els.patientWeightLbsInput) {
  els.patientWeightLbsInput.addEventListener("input", () => {
    renderPatientWeightKgPreview();
  });
}

if (els.savePatientWeightBtn) {
  els.savePatientWeightBtn.addEventListener("click", async () => {
    const patient = findPatient(state.activeClientId, state.activePatientId);
    if (!patient) {
      els.patientDetailError.textContent =
        "Could not open this patient record. Please reload and try again.";
      return;
    }
    const parsedWeightLbs = parseWeightLbs(els.patientWeightLbsInput?.value);
    if (parsedWeightLbs === null) {
      els.patientDetailError.textContent =
        "Enter a valid weight greater than 0.";
      return;
    }

    const weightLbs = parsedWeightLbs.toFixed(2);
    const weightKg = lbsToKg(weightLbs);
    const recordedAt = nowIso();

    try {
      if (!Array.isArray(patient.visits)) patient.visits = [];
      const weightVisit = defaultVisit("Weight update");
      weightVisit.visitDate = todayYmd();
      weightVisit.status = "finalized";
      weightVisit.quickWeightEntry = true;
      weightVisit.vitals = { weightLbs, weightKg };
      weightVisit.soap = {
        subjective: "Weight recheck.",
        objective: `Weight recorded: ${weightLbs} lbs (${weightKg} kg).`,
        assessment: "Weight trend updated.",
        plan: "Continue monitoring body weight.",
      };
      weightVisit.lastEditedAt = recordedAt;
      weightVisit.lastEditedBy = "User";
      patient.visits.push(weightVisit);

      const saveResult = await persist();
      if (!saveResult.ok) {
        els.patientDetailError.textContent =
          "Could not save to browser storage; weight update not persisted.";
        return;
      }
      openPatientDetail(state.activeClientId, state.activePatientId);
      showFlash(
        "success",
        `Weight update saved: ${weightLbs} lbs (${weightKg} kg).`,
      );
    } catch {
      els.patientDetailError.textContent =
        "Could not save weight update. Please try again.";
    }
  });
}

[
  els.visitDate,
  els.visitReason,
  els.visitWeightLbs,
  els.soapSubjective,
  els.soapObjective,
  els.soapAssessment,
  els.soapPlan,
].forEach((input) =>
  input.addEventListener("input", () => {
    clearVisitMessages();
    els.visitWeightKgPreview.textContent = lbsToKg(els.visitWeightLbs.value);
    renderVisitWeightTracker();
  }),
);
els.saveVisitBtn.addEventListener("click", async () => {
  await saveVisit();
});
function addSelectedServiceToVisitOrders() {
  if (!state.visitDraft) return;
  const serviceCode = String(els.visitOrderCatalogSelect.value || "").trim();
  if (!serviceCode) {
    els.visitOrderError.textContent = "Select a service first.";
    return false;
  }
  state.visitDraft = structuredClone(visitFromInputs());
  if (!Array.isArray(state.visitDraft.orderedItems))
    state.visitDraft.orderedItems = [];
  state.visitDraft.orderedItems.push(newVisitOrderItem(serviceCode));
  els.visitOrderCatalogSelect.value = "";
  renderVisitOrders(state.visitDraft.orderedItems, { locked: false });
  clearVisitMessages();
  return true;
}

els.visitOrderCatalogSelect.addEventListener("change", () => {
  addSelectedServiceToVisitOrders();
});

els.addAttachmentBtn.addEventListener("click", () =>
  els.attachmentFileInput.click(),
);
els.attachmentFileInput.addEventListener("change", async () => {
  const file = els.attachmentFileInput.files?.[0];
  if (!file || !state.visitDraft) return;
  try {
    state.visitDraft = structuredClone(visitFromInputs());
    const attachment = normalizeAttachmentMetadata({
      attachmentId: crypto.randomUUID(),
      name: file.name,
      type: file.type || "application/octet-stream",
      linkedAt: nowIso(),
    });
    await putAttachmentBlob(attachment.blobKey, file);
    state.visitDraft.attachments.push(attachment);
    await renderAttachmentRows(
      els.attachmentList,
      state.visitDraft.attachments,
      {
        deleteDataset: "data-delete-attachment",
        emptyMessage: "No attachments.",
      },
    );
  } catch {
    els.visitEditorError.textContent =
      "Could not attach this file. Please try again.";
  } finally {
    els.attachmentFileInput.value = "";
  }
});

els.addPatientAttachmentBtn.addEventListener("click", () =>
  els.patientAttachmentFileInput.click(),
);
els.patientAttachmentFileInput.addEventListener("change", async () => {
  const file = els.patientAttachmentFileInput.files?.[0];
  const patient = findPatient(state.activeClientId, state.activePatientId);
  if (!file) return;
  if (!patient) {
    els.patientDetailError.textContent =
      "Could not open this patient record. Please reload and try again.";
    return;
  }
  try {
    if (!Array.isArray(patient.priorRecords)) patient.priorRecords = [];
    const attachment = normalizeAttachmentMetadata({
      attachmentId: crypto.randomUUID(),
      name: file.name,
      type: file.type || "application/octet-stream",
      linkedAt: nowIso(),
    });
    await putAttachmentBlob(attachment.blobKey, file);
    patient.priorRecords.push(attachment);
    await persist();
    els.patientDetailError.textContent = "";
    els.patientAttachmentFileInput.value = "";
    openPatientDetail(state.activeClientId, state.activePatientId);
  } catch {
    els.patientDetailError.textContent =
      "Could not upload prior medical record. Please try again.";
  }
});

if (els.addPatientMedicalNoteBtn) {
  els.addPatientMedicalNoteBtn.addEventListener("click", async () => {
    const patient = findPatient(state.activeClientId, state.activePatientId);
    if (!patient) {
      els.patientDetailError.textContent =
        "Could not open this patient record. Please reload and try again.";
      return;
    }
    const text = String(els.patientMedicalNoteInput?.value || "").trim();
    if (!text) {
      els.patientDetailError.textContent =
        "Enter a medical note before saving.";
      return;
    }
    if (!Array.isArray(patient.medicalNotes)) patient.medicalNotes = [];
    patient.medicalNotes.push(
      normalizeMedicalNote({
        noteId: crypto.randomUUID(),
        text,
        notedAt: nowIso(),
        createdBy: "User",
      }),
    );
    const saveResult = await persist();
    if (!saveResult.ok) {
      els.patientDetailError.textContent =
        "Could not save to browser storage; note not persisted.";
      return;
    }
    openPatientDetail(state.activeClientId, state.activePatientId);
    showFlash("success", "Medical note added.");
  });
}

els.finalizeVisitBtn.addEventListener("click", async () => {
  const patient = findPatient(state.activeClientId, state.activePatientId);
  const visit = findVisit(patient, state.activeVisitId);
  if (!visit || !patient) return;
  const didSaveVisit = await saveVisit("Visit saved before finalize.");
  if (!didSaveVisit) return;
  if (!hasRequiredSoap(visit))
    return (els.visitEditorError.textContent =
      "Cannot finalize. All SOAP fields are required.");

  visit.versions.push({
    versionAt: nowIso(),
    snapshot: structuredClone(visit),
  });
  visit.status = "finalized";
  visit.lastEditedAt = nowIso();

  state.visitDraft = structuredClone(visit);
  const saveResult = await persist();
  if (!saveResult.ok) {
    els.visitEditorError.textContent =
      "Could not save to browser storage; record not persisted.";
    return;
  }
  openVisitEditor(visit.visitId);
});

els.deleteVisitBtn.addEventListener("click", async () => {
  const patient = findPatient(state.activeClientId, state.activePatientId);
  const visit = findVisit(patient, state.activeVisitId);
  if (!patient || !visit) return;
  if (visit.status === "finalized") {
    els.visitEditorError.textContent =
      "Finalized visits are locked and cannot be deleted.";
    return;
  }
  const yes = await showConfirm(
    "Delete this draft visit? This cannot be undone.",
    [
      { key: "cancel", label: "Cancel" },
      { key: "yes", label: "Delete", className: "danger" },
    ],
  );
  if (yes !== "yes") return;
  await deleteAttachmentCollection(visit.attachments || []);
  patient.visits = patient.visits.filter(
    (v) => v.visitId !== state.activeVisitId,
  );
  const saveResult = await persist();
  if (!saveResult.ok) {
    els.visitEditorError.textContent =
      "Could not save to browser storage; record not persisted.";
    return;
  }
  openPatientDetail(state.activeClientId, state.activePatientId);
});

if (els.exportVisitPdfBtn) {
  els.exportVisitPdfBtn.addEventListener("click", () => {
    const client = findClient(state.activeClientId),
      patient = findPatient(state.activeClientId, state.activePatientId),
      visit = visitFromInputs();
    if (!client || !patient) return;
    exportRecord({ client, patient, visit, draft: draftDirty() }, "pdf");
  });
}
els.exportPatientBtn.addEventListener("click", async () => {
  const client = findClient(state.activeClientId),
    patient = findPatient(state.activeClientId, state.activePatientId);
  if (!client || !patient) return;

  const finalizedVisits = [...patient.visits]
    .filter((visit) => visit.status === "finalized")
    .sort((a, b) => a.visitDate.localeCompare(b.visitDate));

  const priorRecords = patient.priorRecords || [];
  if (!finalizedVisits.length && !priorRecords.length) {
    els.patientDetailError.textContent =
      "No finalized visits or prior medical records available to export.";
    return;
  }

  els.patientDetailError.textContent = "";
  const selected = await openVisitSelectionModal(finalizedVisits, priorRecords);
  if (!selected) return;
  try {
    await exportPatientBundle({
      client,
      patient,
      visits: selected.visits,
      priorRecords: selected.priorRecords,
    });
  } catch (error) {
    els.patientDetailError.textContent = `Export failed: ${error?.message || "Unknown error"}`;
  }
});

if (els.exportFullBackupBtn) {
  els.exportFullBackupBtn.addEventListener("click", async () => {
    try {
      els.exportFullBackupBtn.disabled = true;
      await exportFullBackup();
    } catch (error) {
      showFlash(
        "warning",
        `Backup failed: ${error?.message || "Unknown error"}`,
      );
    } finally {
      els.exportFullBackupBtn.disabled = false;
    }
  });
}

if (els.importFullBackupBtn && els.importFullBackupInput) {
  els.importFullBackupBtn.addEventListener("click", () =>
    els.importFullBackupInput.click(),
  );
  els.importFullBackupInput.addEventListener("change", async () => {
    const file = els.importFullBackupInput.files?.[0];
    if (!file) return;
    const confirmed = await showConfirm(
      "Restore this backup and replace all current clients, patients, visits, inventory, and attachments?",
      [
        { key: "cancel", label: "Cancel" },
        { key: "restore", label: "Restore", className: "danger" },
      ],
    );
    if (confirmed !== "restore") {
      els.importFullBackupInput.value = "";
      return;
    }
    try {
      els.importFullBackupBtn.disabled = true;
      await importFullBackup(file);
    } catch (error) {
      showFlash(
        "warning",
        `Restore failed: ${error?.message || "Unknown error"}`,
      );
    } finally {
      els.importFullBackupBtn.disabled = false;
      els.importFullBackupInput.value = "";
    }
  });
}

if (els.exportCloseoutBtn) {
  els.exportCloseoutBtn.addEventListener("click", () => {
    const selectedDate = /^\d{4}-\d{2}-\d{2}$/.test(
      String(els.closeoutDateInput?.value || ""),
    )
      ? String(els.closeoutDateInput.value)
      : todayYmd();
    if (els.closeoutDateInput) els.closeoutDateInput.value = selectedDate;
    try {
      const report = exportCloseoutCsv(selectedDate);
      showFlash(
        "success",
        `Closeout exported (${selectedDate}): ${report.paymentRows.length} payment${report.paymentRows.length === 1 ? "" : "s"}, $${centsToDollars(report.totalPaymentsCents)} collected, $${centsToDollars(report.totalDueCents)} still due.`,
      );
    } catch (error) {
      showFlash(
        "warning",
        `Closeout export failed: ${error?.message || "Unknown error"}`,
      );
    }
  });
}

document.body.addEventListener("input", (event) => {
  const d = event.target.dataset;
  if (d.visitOrderNotes !== undefined && state.visitDraft) {
    const orderItem = (state.visitDraft.orderedItems || []).find(
      (item) => item.orderItemId === d.visitOrderNotes,
    );
    if (orderItem) orderItem.notes = String(event.target.value || "");
  }
  if (d.newpatientName !== undefined)
    state.newClientPatients[Number(d.newpatientName)].name = event.target.value;
  if (d.newpatientSpecies !== undefined)
    state.newClientPatients[Number(d.newpatientSpecies)].species =
      event.target.value;
  if (d.newpatientBreed !== undefined)
    state.newClientPatients[Number(d.newpatientBreed)].breed =
      event.target.value;
  if (d.newpatientSex !== undefined)
    state.newClientPatients[Number(d.newpatientSex)].sex = event.target.value;
  if (d.newpatientAge !== undefined) {
    state.newClientPatients[Number(d.newpatientAge)].age = event.target.value;
    const dobInput = document.querySelector(
      `[data-newpatient-dob="${d.newpatientAge}"]`,
    );
    if (dobInput) {
      dobInput.value = computeDateOfBirthFromAge(event.target.value);
      state.newClientPatients[Number(d.newpatientAge)].dateOfBirth =
        dobInput.value;
    }
  }
  if (d.newpatientDob !== undefined) {
    state.newClientPatients[Number(d.newpatientDob)].dateOfBirth =
      event.target.value;
    const ageInput = document.querySelector(
      `[data-newpatient-age="${d.newpatientDob}"]`,
    );
    if (ageInput) {
      ageInput.value = computeAgeFromDateOfBirth(event.target.value);
      state.newClientPatients[Number(d.newpatientDob)].age = ageInput.value;
    }
  }
});

document.body.addEventListener("change", (event) => {
  const targetId = String(event.target?.id || "");
  if (targetId === "homeRemindersWindowSelect") {
    remindersUiState.windowKey = String(event.target.value || "next30");
    const today = todayYmd();
    if (!remindersUiState.customStart) remindersUiState.customStart = today;
    if (!remindersUiState.customEnd) remindersUiState.customEnd = today;
    renderSearchResults();
    if (!els.remindersScreen.classList.contains("hidden"))
      renderRemindersListScreen();
    return;
  }
  if (
    targetId === "homeRemindersCustomStart" ||
    targetId === "homeRemindersCustomEnd"
  ) {
    remindersUiState.customStart = String(
      document.getElementById("homeRemindersCustomStart")?.value ||
        remindersUiState.customStart ||
        todayYmd(),
    );
    remindersUiState.customEnd = String(
      document.getElementById("homeRemindersCustomEnd")?.value ||
        remindersUiState.customEnd ||
        todayYmd(),
    );
    renderSearchResults();
    if (!els.remindersScreen.classList.contains("hidden"))
      renderRemindersListScreen();
    return;
  }
  if (!state.visitDraft) return;
  const d = event.target.dataset;
  const orderItemId = d.visitOrderQty || d.visitOrderPrice;
  if (!orderItemId) return;
  const orderItem = (state.visitDraft.orderedItems || []).find(
    (item) => item.orderItemId === orderItemId,
  );
  if (!orderItem) return;

  if (d.visitOrderQty) {
    const quantity = Number.parseFloat(String(event.target.value || "").trim());
    orderItem.quantity =
      Number.isFinite(quantity) && quantity > 0
        ? Number.parseFloat(quantity.toFixed(2))
        : 1;
  }
  if (d.visitOrderPrice) {
    const cents = dollarsToCents(event.target.value);
    orderItem.unitPriceCents =
      cents === null
        ? serviceDefaultUnitPriceCents(orderItem.serviceCode)
        : cents;
  }

  clearVisitMessages();
  renderVisitOrders(state.visitDraft.orderedItems, { locked: false });
});

document.body.addEventListener("keydown", (event) => {
  const openVisitTarget = event.target.closest("[data-open-visit]");
  if (!openVisitTarget?.dataset.openVisit) return;
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  navigateTo(routeVisit(openVisitTarget.dataset.openVisit));
});

document.body.addEventListener("click", async (event) => {
  const t = event.target;
  if (!t.closest(".menu-wrap"))
    document
      .querySelectorAll(".menu-popover")
      .forEach((menu) => menu.classList.add("hidden"));
  const menuToggleTarget = t.closest("[data-menu-toggle]");
  if (menuToggleTarget?.dataset.menuToggle) {
    event.stopPropagation();
    const menu = menuToggleTarget.parentElement.querySelector(".menu-popover");
    if (!menu) return;
    const hidden = menu.classList.contains("hidden");
    document
      .querySelectorAll(".menu-popover")
      .forEach((item) => item.classList.add("hidden"));
    if (hidden) menu.classList.remove("hidden");
    return;
  }

  const routeTarget = t.closest("[data-route-to]");
  if (routeTarget?.dataset.routeTo) {
    if (routeTarget.dataset.routeTo === "#/client")
      return navigateTo(
        state.activeClientId ? routeClient(state.activeClientId) : routeHome(),
      );
    if (routeTarget.dataset.routeTo === "#/patient")
      return navigateTo(
        state.activeClientId && state.activePatientId
          ? routePatient(state.activeClientId, state.activePatientId)
          : routeHome(),
      );
    return navigateTo(routeTarget.dataset.routeTo);
  }

  const saveLabResultTarget = t.closest("[data-save-lab-result]");
  if (saveLabResultTarget?.dataset.saveLabResult) {
    const token = String(
      saveLabResultTarget.dataset.saveLabResult || "",
    ).trim();
    const row = saveLabResultTarget.closest("[data-lab-row]");
    const input = row ? row.querySelector("[data-lab-result-input]") : null;
    const resultText = String(input?.value || "").trim();
    if (!resultText) {
      if (els.labsError)
        els.labsError.textContent = "Enter a lab result before saving.";
      return;
    }
    const context = findDiagnosticLabContext(token);
    if (!context) {
      if (els.labsError)
        els.labsError.textContent = "Could not locate this lab entry.";
      return;
    }
    saveLabResultTarget.disabled = true;
    try {
      const currentOrderItem = migrateVisitOrderItem(
        context.visit.orderedItems[context.orderItemIndex] || {},
      );
      const updatedOrderItem = {
        ...currentOrderItem,
        resultText,
        resultEnteredAt: nowIso(),
      };
      context.visit.orderedItems[context.orderItemIndex] = updatedOrderItem;
      const saveResult = await persist();
      if (!saveResult.ok) {
        if (els.labsError)
          els.labsError.textContent =
            "Could not save to browser storage; lab result not persisted.";
        return;
      }
      if (els.labsError) els.labsError.textContent = "";
      renderLabsScreen();
      showFlash(
        "success",
        `${serviceLabel(updatedOrderItem.serviceCode)} result saved.`,
      );
    } finally {
      saveLabResultTarget.disabled = false;
    }
    return;
  }

  const homeToggleRevenueTarget = t.closest("[data-home-toggle-revenue]");
  if (homeToggleRevenueTarget?.dataset.homeToggleRevenue !== undefined) {
    toggleHomePanelVisibility("revenue");
    const menu = homeToggleRevenueTarget.closest(".menu-popover");
    if (menu) menu.classList.add("hidden");
    return;
  }
  const homeToggleDuePaymentsTarget = t.closest(
    "[data-home-toggle-due-payments]",
  );
  if (
    homeToggleDuePaymentsTarget?.dataset.homeToggleDuePayments !== undefined
  ) {
    toggleHomePanelVisibility("duePayments");
    const menu = homeToggleDuePaymentsTarget.closest(".menu-popover");
    if (menu) menu.classList.add("hidden");
    return;
  }
  const homeToggleRemindersTarget = t.closest("[data-home-toggle-reminders]");
  if (homeToggleRemindersTarget?.dataset.homeToggleReminders !== undefined) {
    toggleHomePanelVisibility("reminders");
    const menu = homeToggleRemindersTarget.closest(".menu-popover");
    if (menu) menu.classList.add("hidden");
    return;
  }
  const homeToggleInventoryTarget = t.closest("[data-home-toggle-inventory]");
  if (homeToggleInventoryTarget?.dataset.homeToggleInventory !== undefined) {
    toggleHomePanelVisibility("inventory");
    const menu = homeToggleInventoryTarget.closest(".menu-popover");
    if (menu) menu.classList.add("hidden");
    return;
  }

  const openReminderCategoryTarget = t.closest(
    "[data-open-reminders-category]",
  );
  if (openReminderCategoryTarget?.dataset.openRemindersCategory) {
    const category = String(
      openReminderCategoryTarget.dataset.openRemindersCategory ||
        REMINDER_CATEGORIES.dueSoonNoAppointment,
    );
    return navigateTo(routeReminders(category));
  }

  const openCheckoutTarget = t.closest("[data-open-checkout]");
  if (openCheckoutTarget?.dataset.openCheckout) {
    const [clientId, patientId, visitId] = String(
      openCheckoutTarget.dataset.openCheckout,
    ).split(":");
    if (!clientId || !patientId) return;
    await guardUnsaved(() => {
      openClientDetail(clientId, { syncRoute: true });
    });
    return;
  }

  if (t.dataset.removeContact) {
    const [mode, idxRaw] = t.dataset.removeContact.split(":");
    const idx = Number(idxRaw);
    const contacts = contactsFromDom(mode).filter((_, i) => i !== idx);
    renderContactRows(
      mode === "new" ? els.clientContactsList : els.editClientContactsList,
      contacts,
      mode,
    );
    return;
  }

  if (t.dataset.openClient)
    return navigateTo(routeClient(t.dataset.openClient));
  if (t.dataset.editClient) {
    document
      .querySelectorAll(".menu-popover")
      .forEach((menu) => menu.classList.add("hidden"));
    const client = findClient(t.dataset.editClient);
    if (!client) return;
    state.editingClientId = client.clientId;
    els.editClientFirstName.value = client.firstName;
    els.editClientLastName.value = client.lastName;
    els.editClientPhone.value = getPrimaryContact(client)?.phone || "";
    els.editClientEmail.value = client.email || "";
    renderContactRows(
      els.editClientContactsList,
      (client.contacts || []).filter((contact) => !contact.isPrimary),
      "edit",
    );
    showScreen("editClient", { route: routeClient(client.clientId) });
    return;
  }
  if (t.dataset.deleteClient) {
    document
      .querySelectorAll(".menu-popover")
      .forEach((menu) => menu.classList.add("hidden"));
    event.stopPropagation();
    const ok = await showConfirm(
      "Delete this client and all patient records?",
      [
        { key: "cancel", label: "Cancel" },
        { key: "yes", label: "Delete", className: "danger" },
      ],
    );
    if (ok !== "yes") return;
    const client = findClient(t.dataset.deleteClient);
    if (client) await deleteClientAttachmentBlobs(client);
    state.clients = state.clients.filter(
      (c) => c.clientId !== t.dataset.deleteClient,
    );
    await persist();
    renderSearchResults();
    return;
  }
  if (t.dataset.openPatient) {
    const [c, p] = t.dataset.openPatient.split(":");
    return navigateTo(routePatient(c, p));
  }
  if (t.dataset.editPatient) {
    document
      .querySelectorAll(".menu-popover")
      .forEach((menu) => menu.classList.add("hidden"));
    const [c, p] = t.dataset.editPatient.split(":");
    state.activeClientId = c;
    state.editingPatientId = p;
    const patient = findPatient(c, p);
    if (!patient) return;
    els.editPatientName.value = patient.name;
    els.editPatientSpecies.value = patient.species || "";
    els.editPatientBreed.value = patient.breed || "";
    els.editPatientSex.value = patient.sex || "";
    els.editPatientAge.value = patient.age || "";
    els.editPatientDateOfBirth.value = patient.dateOfBirth || "";
    showScreen("editPatient");
    return;
  }
  if (t.dataset.deletePatient) {
    document
      .querySelectorAll(".menu-popover")
      .forEach((menu) => menu.classList.add("hidden"));
    event.stopPropagation();
    const ok = await showConfirm("Delete this patient?", [
      { key: "cancel", label: "Cancel" },
      { key: "yes", label: "Delete", className: "danger" },
    ]);
    if (ok !== "yes") return;
    const [c, p] = t.dataset.deletePatient.split(":");
    const client = findClient(c);
    if (!client) return;
    const patientToDelete = client.patients.find((x) => x.patientId === p);
    if (patientToDelete) await deletePatientAttachmentBlobs(patientToDelete);
    client.patients = client.patients.filter((x) => x.patientId !== p);
    await persist();
    openClientDetail(c);
    renderSearchResults();
    return;
  }
  const openVisitTarget = t.closest("[data-open-visit]");
  if (openVisitTarget?.dataset.openVisit)
    return navigateTo(routeVisit(openVisitTarget.dataset.openVisit));

  const reminderRescheduleTarget = t.closest("[data-reminder-reschedule]");
  if (reminderRescheduleTarget?.dataset.reminderReschedule) {
    const visitId = String(
      reminderRescheduleTarget.dataset.reminderReschedule || "",
    ).trim();
    if (!visitId) return;
    showFlash("success", "Update date/time and save to reschedule.");
    return navigateTo(routeVisit(visitId));
  }

  const reminderScheduleTarget = t.closest("[data-reminder-schedule]");
  if (reminderScheduleTarget?.dataset.reminderSchedule) {
    const [clientId, patientId] = String(
      reminderScheduleTarget.dataset.reminderSchedule || "",
    ).split(":");
    if (!clientId || !patientId) return;
    const patient = findPatient(clientId, patientId);
    if (!patient) return;
    const reminderRow =
      remindersRowsByPatient.get(`${clientId}:${patientId}`) || null;
    pendingAppointmentSchedulerPrefill = {
      clientId,
      patientId,
      appointmentDate:
        reminderRow?.dueDate && reminderRow.dueDate >= todayYmd()
          ? reminderRow.dueDate
          : todayYmd(),
      appointmentStatus: "scheduled",
      reasonForVisit: suggestedReminderVisitReason(reminderRow),
    };
    return navigateTo(routePatient(clientId, patientId));
  }

  const estimatePrepareTarget = t.closest("[data-estimate-prepare]");
  if (estimatePrepareTarget?.dataset.estimatePrepare) {
    const visitContext = findVisitContext(
      estimatePrepareTarget.dataset.estimatePrepare,
    );
    if (!visitContext?.visit) return;
    const visitId = visitContext.visit.visitId;
    const estimateUi = findEstimateActionElements(visitId);
    const note = String(estimateUi.noteInput?.value || "").trim();
    clearEstimateActionError(visitId);
    setEstimateActionStatus(visitId, "Preparing estimate...");
    if (estimateUi.prepareBtn) estimateUi.prepareBtn.disabled = true;
    if (estimateUi.approveBtn) estimateUi.approveBtn.disabled = true;
    if (estimateUi.declineBtn) estimateUi.declineBtn.disabled = true;
    try {
      await updateVisitEstimateForAction(visitContext.visit, "prepare", note);
    } catch (error) {
      setEstimateActionError(
        visitId,
        String(error?.message || "Could not prepare estimate."),
      );
      setEstimateActionStatus(visitId, "");
    } finally {
      const latest = findEstimateActionElements(visitId);
      if (latest.prepareBtn) latest.prepareBtn.disabled = false;
      if (latest.approveBtn) latest.approveBtn.disabled = false;
      if (latest.declineBtn) latest.declineBtn.disabled = false;
    }
    return;
  }

  const estimateApproveTarget = t.closest("[data-estimate-approve]");
  if (estimateApproveTarget?.dataset.estimateApprove) {
    const visitContext = findVisitContext(
      estimateApproveTarget.dataset.estimateApprove,
    );
    if (!visitContext?.visit) return;
    const visitId = visitContext.visit.visitId;
    const estimateUi = findEstimateActionElements(visitId);
    const note = String(estimateUi.noteInput?.value || "").trim();
    clearEstimateActionError(visitId);
    setEstimateActionStatus(visitId, "Approving estimate...");
    if (estimateUi.prepareBtn) estimateUi.prepareBtn.disabled = true;
    if (estimateUi.approveBtn) estimateUi.approveBtn.disabled = true;
    if (estimateUi.declineBtn) estimateUi.declineBtn.disabled = true;
    try {
      await updateVisitEstimateForAction(visitContext.visit, "approve", note);
    } catch (error) {
      setEstimateActionError(
        visitId,
        String(error?.message || "Could not approve estimate."),
      );
      setEstimateActionStatus(visitId, "");
    } finally {
      const latest = findEstimateActionElements(visitId);
      if (latest.prepareBtn) latest.prepareBtn.disabled = false;
      if (latest.approveBtn) latest.approveBtn.disabled = false;
      if (latest.declineBtn) latest.declineBtn.disabled = false;
    }
    return;
  }

  const estimateDeclineTarget = t.closest("[data-estimate-decline]");
  if (estimateDeclineTarget?.dataset.estimateDecline) {
    const visitContext = findVisitContext(
      estimateDeclineTarget.dataset.estimateDecline,
    );
    if (!visitContext?.visit) return;
    const visitId = visitContext.visit.visitId;
    const estimateUi = findEstimateActionElements(visitId);
    const note = String(estimateUi.noteInput?.value || "").trim();
    clearEstimateActionError(visitId);
    setEstimateActionStatus(visitId, "Declining estimate...");
    if (estimateUi.prepareBtn) estimateUi.prepareBtn.disabled = true;
    if (estimateUi.approveBtn) estimateUi.approveBtn.disabled = true;
    if (estimateUi.declineBtn) estimateUi.declineBtn.disabled = true;
    try {
      await updateVisitEstimateForAction(visitContext.visit, "decline", note);
    } catch (error) {
      setEstimateActionError(
        visitId,
        String(error?.message || "Could not decline estimate."),
      );
      setEstimateActionStatus(visitId, "");
    } finally {
      const latest = findEstimateActionElements(visitId);
      if (latest.prepareBtn) latest.prepareBtn.disabled = false;
      if (latest.approveBtn) latest.approveBtn.disabled = false;
      if (latest.declineBtn) latest.declineBtn.disabled = false;
    }
    return;
  }

  const manualPayTarget = t.closest("[data-manual-pay-record]");
  if (manualPayTarget?.dataset.manualPayRecord) {
    const visitContext = findVisitContext(
      manualPayTarget.dataset.manualPayRecord,
    );
    if (!visitContext?.visit) return;
    const visitId = visitContext.visit.visitId;
    const ui = findManualPaymentElements(visitId);
    const amountCents = dollarsToCents(ui.amountInput?.value);
    const method = String(ui.methodInput?.value || "other")
      .trim()
      .toLowerCase();
    const note = String(ui.noteInput?.value || "").trim();
    clearManualPaymentError(visitId);
    setManualPaymentStatus(visitId, "Recording payment...");
    if (ui.recordBtn) ui.recordBtn.disabled = true;
    try {
      await recordManualPaymentForVisit(visitContext.visit, {
        amountCents,
        method,
        note,
      });
    } catch (error) {
      setManualPaymentError(
        visitId,
        String(error?.message || "Could not record payment."),
      );
      setManualPaymentStatus(visitId, "");
    } finally {
      const latest = findManualPaymentElements(visitId);
      if (latest.recordBtn) latest.recordBtn.disabled = false;
    }
    return;
  }

  const clientManualPayTarget = t.closest("[data-client-manual-pay-record]");
  if (clientManualPayTarget?.dataset.clientManualPayRecord) {
    const clientId = String(
      clientManualPayTarget.dataset.clientManualPayRecord || "",
    ).trim();
    const client = findClient(clientId);
    if (!client) return;
    const ui = findClientManualPaymentElements(clientId);
    const amountCents = dollarsToCents(ui.amountInput?.value);
    const method = String(ui.methodInput?.value || "other")
      .trim()
      .toLowerCase();
    const note = String(ui.noteInput?.value || "").trim();
    clearClientManualPaymentError(clientId);
    setClientManualPaymentStatus(clientId, "Recording payment...");
    if (ui.recordBtn) ui.recordBtn.disabled = true;
    try {
      await recordManualPaymentForClient(client, { amountCents, method, note });
    } catch (error) {
      setClientManualPaymentError(
        clientId,
        String(error?.message || "Could not record client payment."),
      );
      setClientManualPaymentStatus(clientId, "");
    } finally {
      const latest = findClientManualPaymentElements(clientId);
      if (latest.recordBtn) latest.recordBtn.disabled = false;
    }
    return;
  }

  const makeDoneReminderTarget = t.closest("[data-make-done-reminder]");
  if (makeDoneReminderTarget?.dataset.makeDoneReminder) {
    const [clientId, patientId, visitId, reminderTypeCode] = String(
      makeDoneReminderTarget.dataset.makeDoneReminder || "",
    ).split(":");
    if (!clientId || !patientId || !visitId || !reminderTypeCode) return;
    makeDoneReminderTarget.disabled = true;
    try {
      const didUpdate = await markReminderDoneForVisit(
        clientId,
        patientId,
        visitId,
        reminderTypeCode,
      );
      if (!didUpdate) makeDoneReminderTarget.disabled = false;
    } catch (error) {
      showFlash(
        "warning",
        String(error?.message || "Could not mark reminder done."),
      );
      makeDoneReminderTarget.disabled = false;
    }
    return;
  }

  const deleteWeightTarget = t.closest("[data-delete-patient-weight]");
  if (deleteWeightTarget?.dataset.deletePatientWeight) {
    const [clientIdRaw, patientIdRaw, visitId] = String(
      deleteWeightTarget.dataset.deletePatientWeight || "",
    ).split(":");
    const clientId = String(clientIdRaw || state.activeClientId || "").trim();
    const patientId = String(
      patientIdRaw || state.activePatientId || "",
    ).trim();
    if (!clientId || !patientId || !visitId) return;
    const patient = findPatient(clientId, patientId);
    const visit = findVisit(patient, visitId);
    if (!patient || !visit) return;
    const ok = await showConfirm("Delete this weight entry?", [
      { key: "cancel", label: "Cancel" },
      { key: "yes", label: "Delete", className: "danger" },
    ]);
    if (ok !== "yes") return;

    if (visit.quickWeightEntry) {
      patient.visits = (patient.visits || []).filter(
        (entry) => entry.visitId !== visitId,
      );
    } else {
      visit.vitals = {
        ...(visit.vitals || {}),
        weightLbs: "",
        weightKg: "",
      };
      visit.lastEditedAt = nowIso();
      visit.lastEditedBy = "User";
    }

    const saveResult = await persist();
    if (!saveResult.ok) {
      if (els.patientDetailError)
        els.patientDetailError.textContent =
          "Could not save to browser storage; weight deletion not persisted.";
      return;
    }
    openPatientDetail(clientId, patientId);
    showFlash("success", "Weight entry deleted.");
    return;
  }

  if (t.dataset.toggleDeclineVisitOrder && state.visitDraft) {
    const orderItem = (state.visitDraft.orderedItems || []).find(
      (item) => item.orderItemId === t.dataset.toggleDeclineVisitOrder,
    );
    if (!orderItem) return;
    if (orderItem.status === "declined") {
      orderItem.status = "completed";
      orderItem.completedAt = orderItem.completedAt || nowIso();
    } else {
      orderItem.status = "declined";
      orderItem.completedAt = "";
    }
    renderVisitOrders(state.visitDraft.orderedItems, { locked: false });
    clearVisitMessages();
    return;
  }
  if (t.dataset.removeVisitOrder && state.visitDraft) {
    const ok = await showConfirm("Remove this charge item?", [
      { key: "cancel", label: "Cancel" },
      { key: "yes", label: "Remove", className: "danger" },
    ]);
    if (ok !== "yes") return;
    state.visitDraft.orderedItems = (
      state.visitDraft.orderedItems || []
    ).filter((item) => item.orderItemId !== t.dataset.removeVisitOrder);
    renderVisitOrders(state.visitDraft.orderedItems, { locked: false });
    return;
  }
  if (t.dataset.removeNewpatient !== undefined) {
    state.newClientPatients.splice(Number(t.dataset.removeNewpatient), 1);
    return renderNewPatientRows();
  }
  if (t.dataset.deleteAttachment) {
    const ok = await showConfirm("Delete this attachment?", [
      { key: "cancel", label: "Cancel" },
      { key: "yes", label: "Delete", className: "danger" },
    ]);
    if (ok !== "yes") return;
    const deleted = state.visitDraft.attachments.find(
      (a) => a.attachmentId === t.dataset.deleteAttachment,
    );
    state.visitDraft.attachments = state.visitDraft.attachments.filter(
      (a) => a.attachmentId !== t.dataset.deleteAttachment,
    );
    if (deleted)
      await deleteAttachmentBlob(
        deleted.blobKey || attachmentBlobKeyFor(deleted),
      );
    await renderAttachmentRows(
      els.attachmentList,
      state.visitDraft.attachments,
      {
        deleteDataset: "data-delete-attachment",
        emptyMessage: "No attachments.",
      },
    );
    return;
  }
  if (t.dataset.deletePrior) {
    const ok = await showConfirm("Delete this prior record?", [
      { key: "cancel", label: "Cancel" },
      { key: "yes", label: "Delete", className: "danger" },
    ]);
    if (ok !== "yes") return;
    const patient = findPatient(state.activeClientId, state.activePatientId);
    if (!patient) return;
    const deleted = patient.priorRecords.find(
      (a) => a.attachmentId === t.dataset.deletePrior,
    );
    patient.priorRecords = patient.priorRecords.filter(
      (a) => a.attachmentId !== t.dataset.deletePrior,
    );
    if (deleted)
      await deleteAttachmentBlob(
        deleted.blobKey || attachmentBlobKeyFor(deleted),
      );
    await persist();
    openPatientDetail(state.activeClientId, state.activePatientId);
    return;
  }
  if (t.dataset.deleteMedicalNote) {
    const ok = await showConfirm("Delete this medical note?", [
      { key: "cancel", label: "Cancel" },
      { key: "yes", label: "Delete", className: "danger" },
    ]);
    if (ok !== "yes") return;
    const patient = findPatient(state.activeClientId, state.activePatientId);
    if (!patient) return;
    patient.medicalNotes = (patient.medicalNotes || []).filter(
      (note) => note.noteId !== t.dataset.deleteMedicalNote,
    );
    const saveResult = await persist();
    if (!saveResult.ok) {
      els.patientDetailError.textContent =
        "Could not save to browser storage; note deletion not persisted.";
      return;
    }
    openPatientDetail(state.activeClientId, state.activePatientId);
    return;
  }
  if (t.dataset.deleteInventoryItem) {
    const itemToDelete = findInventoryItem(t.dataset.deleteInventoryItem);
    if (!itemToDelete) return;
    const ok = await showConfirm(
      "Delete this inventory item and its adjustment log?",
      [
        { key: "cancel", label: "Cancel" },
        { key: "yes", label: "Delete", className: "danger" },
      ],
    );
    if (ok !== "yes") return;
    if (itemToDelete.controlled) {
      const controlledLabel = `${itemToDelete.name || "item"}${itemToDelete.deaSchedule ? ` (DEA ${itemToDelete.deaSchedule})` : ""}`;
      const confirmControlled = await showConfirm(
        `ARE YOU SURE you want to delete controlled substance ${controlledLabel}?`,
        [
          { key: "cancel", label: "Cancel" },
          { key: "sure", label: "Are You Sure", className: "danger" },
        ],
      );
      if (confirmControlled !== "sure") return;
    }
    state.inventoryItems = (state.inventoryItems || []).filter(
      (item) => item.itemId !== t.dataset.deleteInventoryItem,
    );
    const saveResult = await persist();
    if (!saveResult.ok) {
      if (els.inventoryError)
        els.inventoryError.textContent = "Could not save inventory deletion.";
      return;
    }
    if (els.inventoryError) els.inventoryError.textContent = "";
    renderInventorySection();
    return;
  }
  if (t.dataset.inventoryAdjust) {
    const [mode, itemId] = String(t.dataset.inventoryAdjust).split(":");
    const item = findInventoryItem(itemId);
    if (!item) return;
    const qtyInput = document.querySelector(
      `[data-inventory-adjust-qty="${itemId}"]`,
    );
    const reasonInput = document.querySelector(
      `[data-inventory-adjust-reason="${itemId}"]`,
    );
    const qty = Number.parseFloat(String(qtyInput?.value || "").trim());
    if (!Number.isFinite(qty) || qty <= 0) {
      if (els.inventoryError)
        els.inventoryError.textContent =
          "Adjustment quantity must be greater than 0.";
      return;
    }
    const reason = String(reasonInput?.value || "").trim();
    if (item.controlled && !reason) {
      if (els.inventoryError)
        els.inventoryError.textContent =
          "Reason is required for controlled-substance adjustments.";
      return;
    }
    const currentQty = Number(item.onHandQty || 0);
    let nextQty = currentQty;
    let deltaQty = 0;
    if (mode === "in") {
      deltaQty = qty;
      nextQty = currentQty + qty;
    } else if (mode === "out") {
      if (qty > currentQty) {
        if (els.inventoryError)
          els.inventoryError.textContent =
            "Cannot use more than current on-hand quantity.";
        return;
      }
      deltaQty = -qty;
      nextQty = currentQty - qty;
    } else if (mode === "set") {
      deltaQty = qty - currentQty;
      nextQty = qty;
    } else {
      return;
    }
    item.onHandQty = Number.parseFloat(nextQty.toFixed(2));
    if (!Array.isArray(item.adjustments)) item.adjustments = [];
    item.adjustments.push(
      normalizeInventoryAdjustment({
        adjustmentId: crypto.randomUUID(),
        at: nowIso(),
        deltaQty,
        reason:
          reason ||
          (mode === "in"
            ? "Stock received"
            : mode === "out"
              ? "Inventory used"
              : "Quantity correction"),
        actor: "User",
      }),
    );

    const saveResult = await persist();
    if (!saveResult.ok) {
      if (els.inventoryError)
        els.inventoryError.textContent = "Could not save inventory adjustment.";
      return;
    }
    if (reasonInput) reasonInput.value = "";
    if (els.inventoryError) els.inventoryError.textContent = "";
    renderInventorySection();
    return;
  }
  if (
    t.dataset.completeReminder ||
    t.dataset.toggleDeclineReminder ||
    t.dataset.editReminderDue
  ) {
    const patient = findPatient(state.activeClientId, state.activePatientId);
    if (!patient) return;
    const reminderId =
      t.dataset.completeReminder ||
      t.dataset.toggleDeclineReminder ||
      t.dataset.editReminderDue;
    const reminderIndex = patient.preventiveReminders.findIndex(
      (reminder) => reminder.reminderId === reminderId,
    );
    if (reminderIndex < 0) return;
    const reminder = patient.preventiveReminders[reminderIndex];

    if (t.dataset.completeReminder) {
      const completedReminder = await completeReminderWithRules(reminder, {
        completedDate: todayYmd(),
      });
      if (!completedReminder) return;
      patient.preventiveReminders[reminderIndex] = completedReminder;
    }
    if (t.dataset.toggleDeclineReminder)
      patient.preventiveReminders[reminderIndex] = {
        ...reminder,
        status:
          reminder.status === "declined"
            ? computeReminderStatus(reminder.dueDate)
            : "declined",
      };
    if (t.dataset.editReminderDue) {
      const dueDate = await openReminderDueDateModal(
        reminder.dueDate || todayYmd(),
      );
      if (!dueDate) return;
      patient.preventiveReminders[reminderIndex] = recomputeReminder({
        ...reminder,
        dueDate,
      });
    }

    await persist();
    if (
      !els.visitEditorScreen.classList.contains("hidden") &&
      state.activeVisitId
    )
      openVisitEditor(state.activeVisitId, { syncRoute: false });
    else openPatientDetail(state.activeClientId, state.activePatientId);
    return;
  }
});

window.addEventListener("hashchange", async () => {
  const next = getRouteHash();
  if (syncingHash) {
    syncingHash = false;
    applyRoute(next);
    return;
  }
  const ok = await guardUnsaved();
  if (!ok) {
    updateHash(lastRouteHash, { replace: true });
    return;
  }
  applyRoute(next);
});

async function bootstrapAttachmentStorage() {
  const migrated = await persistLegacyAttachmentMigrations();
  if (migrated || pendingMigrationWarnings.length) await persist();
  pendingMigrationWarnings.forEach((warning) => showFlash("warning", warning));
  pendingMigrationWarnings = [];
}

async function initializeApp() {
  const loadedState = await loadState();
  Object.assign(state, loadedState);
  syncInventoryControlledUi();
  resetInventoryForm();
  await runStartupStorageCheck();
  setHomePanelVisibility("revenue", homePanelState.revenueVisible);
  setHomePanelVisibility("duePayments", homePanelState.duePaymentsVisible);
  setHomePanelVisibility("reminders", homePanelState.remindersVisible);
  setHomePanelVisibility("inventory", homePanelState.inventoryVisible);
  if (els.closeoutDateInput && !els.closeoutDateInput.value)
    els.closeoutDateInput.value = todayYmd();
  renderSearchResults();
  renderStartupStorageStatus();
  if (!window.location.hash) updateHash(routeHome(), { replace: true });
  applyRoute(getRouteHash());
  bootstrapAttachmentStorage().catch(() =>
    showFlash(
      "warning",
      "Attachment storage is unavailable. Attachments may not persist.",
    ),
  );
}

async function fetchDogBreeds() {
  const response = await fetch("https://dog.ceo/api/breeds/list/all");
  if (!response.ok) {
    console.error(`HTTP error! status: ${response.status}`);
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  const data = await response.json();
  const breedsSelect = document.getElementById("detailPatientBreed");
  const objectLength = Object.keys(data.message).length;
  console.log(`Fetched ${objectLength} dog breeds.`);

  for (let i = 0; i < objectLength; i++) {
    const optionElement = document.createElement("option");
    if (Object.values(data.message) === "") {
      optionElement.innerText = Object.keys(data.message)[i];
      breedsSelect.appendChild(optionElement);
    } else {
      for (let j = 0; j < Object.values(data.message).length; j++) {
        console.log("extras!");
        optionElement.innerText =
          Object.keys(data.message)[i] + " " + Object.values(data.message[j]);
        breedsSelect.appendChild(optionElement);
      }
    }
  }
  console.log(breedsSelect);
  console.log("Dog breeds select populated.");
}

fetchDogBreeds();

initializeApp();
