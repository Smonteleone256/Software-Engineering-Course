(function initRemindersLogic(root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.RemindersLogic = api;
}(typeof globalThis !== "undefined" ? globalThis : this, () => {
  const DAY_MS = 24 * 60 * 60 * 1000;

  const REMINDER_WINDOW_OPTIONS = [
    { key: "next7", label: "Next 7 days", days: 7 },
    { key: "next30", label: "Next 30 days", days: 30 },
    { key: "next60", label: "Next 60 days", days: 60 },
    { key: "next90", label: "Next 90 days", days: 90 },
    { key: "custom", label: "Custom Range", days: null }
  ];

  const REMINDER_CATEGORIES = {
    dueSoonNoAppointment: "dueSoonNoAppointment",
    dueSoonHasAppointment: "dueSoonHasAppointment",
    appointmentsScheduled: "appointmentsScheduled"
  };

  function isYmd(value) {
    return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
  }

  function parseYmd(value) {
    const ymd = String(value || "").trim();
    if (!isYmd(ymd)) return null;
    const date = new Date(`${ymd}T12:00:00`);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function addDaysYmd(ymd, days) {
    const date = parseYmd(ymd);
    if (!date || !Number.isFinite(Number(days))) return "";
    const shifted = new Date(date.getTime() + Math.round(Number(days)) * DAY_MS);
    return shifted.toISOString().slice(0, 10);
  }

  function diffDays(startYmd, endYmd) {
    const start = parseYmd(startYmd);
    const end = parseYmd(endYmd);
    if (!start || !end) return null;
    return Math.round((end.getTime() - start.getTime()) / DAY_MS);
  }

  function resolveReminderWindow({ windowKey = "next30", today, customStart = "", customEnd = "" } = {}) {
    const normalizedToday = isYmd(today) ? String(today) : new Date().toISOString().slice(0, 10);
    const option = REMINDER_WINDOW_OPTIONS.find((item) => item.key === windowKey) || REMINDER_WINDOW_OPTIONS[1];

    if (option.key !== "custom") {
      return {
        key: option.key,
        label: option.label,
        start: normalizedToday,
        end: addDaysYmd(normalizedToday, option.days),
        valid: true,
        error: ""
      };
    }

    const start = isYmd(customStart) ? String(customStart) : normalizedToday;
    const end = isYmd(customEnd) ? String(customEnd) : addDaysYmd(normalizedToday, 30);
    if (end < start) {
      return {
        key: option.key,
        label: option.label,
        start,
        end,
        valid: false,
        error: "Custom range end date must be on or after start date."
      };
    }

    return {
      key: option.key,
      label: option.label,
      start,
      end,
      valid: true,
      error: ""
    };
  }

  function normalizeAppointmentStatus(appointmentStatus, visitStatus) {
    const explicit = String(appointmentStatus || "").trim().toLowerCase();
    if (["scheduled", "confirmed", "cancelled", "no-show", "completed"].includes(explicit)) return explicit;
    return "";
  }

  function deriveDueDate(patient) {
    const direct = String(patient?.dueDate || "").trim();
    if (isYmd(direct)) return direct;

    const reminderDates = Array.isArray(patient?.preventiveReminders)
      ? patient.preventiveReminders
        .map((item) => String(item?.dueDate || "").trim())
        .filter((date) => isYmd(date))
        .sort((a, b) => a.localeCompare(b))
      : [];
    return reminderDates[0] || "";
  }

  function deriveDueReason(patient, dueDate) {
    const direct = String(patient?.dueReason || patient?.dueType || "").trim();
    if (direct) return direct;
    if (!Array.isArray(patient?.preventiveReminders)) return "";
    const match = patient.preventiveReminders.find((item) => String(item?.dueDate || "") === dueDate);
    if (!match) return "";
    return String(match.typeCode || match.category || "").replace(/_/g, " ").trim();
  }

  function findQualifiedAppointment(patient, today, windowEnd) {
    const visits = Array.isArray(patient?.visits) ? patient.visits : [];
    const qualified = visits
      .map((visit) => {
        const status = normalizeAppointmentStatus(visit?.appointmentStatus, visit?.status);
        const start = String(visit?.visitDate || "").trim();
        if (!isYmd(start)) return null;
        if (!["scheduled", "confirmed"].includes(status)) return null;
        if (start < today || start > windowEnd) return null;
        return {
          visitId: String(visit?.visitId || ""),
          appointmentDate: start,
          appointmentStatus: status,
          reasonForVisit: String(visit?.reasonForVisit || "").trim()
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.appointmentDate.localeCompare(b.appointmentDate));
    return qualified[0] || null;
  }

  function isDueSoon(dueDate, today, windowEnd, includeOverdue = true) {
    if (!isYmd(dueDate)) return false;
    if (dueDate > windowEnd) return false;
    if (dueDate >= today) return true;
    return Boolean(includeOverdue);
  }

  function dueRelativeLabel(dueDate, today) {
    if (!isYmd(dueDate) || !isYmd(today)) return "";
    const delta = diffDays(today, dueDate);
    if (delta === null) return "";
    if (delta < 0) return `Overdue by ${Math.abs(delta)} day${Math.abs(delta) === 1 ? "" : "s"}`;
    if (delta === 0) return "Due today";
    return `Due in ${delta} day${delta === 1 ? "" : "s"}`;
  }

  function reminderSortComparator(today) {
    return (a, b) => {
      const aOverdue = isYmd(a.dueDate) && a.dueDate < today;
      const bOverdue = isYmd(b.dueDate) && b.dueDate < today;
      if (aOverdue !== bOverdue) return aOverdue ? -1 : 1;
      const aDue = isYmd(a.dueDate) ? a.dueDate : "9999-12-31";
      const bDue = isYmd(b.dueDate) ? b.dueDate : "9999-12-31";
      if (aDue !== bDue) return aDue.localeCompare(bDue);
      return String(a.patientName || "").localeCompare(String(b.patientName || ""));
    };
  }

  function buildReminderDataset(clients, { today, windowEnd, includeOverdue = true } = {}) {
    const normalizedToday = isYmd(today) ? String(today) : new Date().toISOString().slice(0, 10);
    const normalizedEnd = isYmd(windowEnd) ? String(windowEnd) : addDaysYmd(normalizedToday, 30);
    const rows = [];

    for (const client of Array.isArray(clients) ? clients : []) {
      for (const patient of Array.isArray(client?.patients) ? client.patients : []) {
        const dueDate = deriveDueDate(patient);
        if (!isYmd(dueDate)) continue;
        const dueSoon = isDueSoon(dueDate, normalizedToday, normalizedEnd, includeOverdue);
        const appointment = findQualifiedAppointment(patient, normalizedToday, normalizedEnd);
        const hasAppointment = Boolean(appointment);

        rows.push({
          clientId: String(client?.clientId || ""),
          clientName: `${String(client?.firstName || "").trim()} ${String(client?.lastName || "").trim()}`.trim() || "Unknown client",
          patientId: String(patient?.patientId || ""),
          patientName: String(patient?.name || "Unknown patient"),
          dueDate,
          dueReason: deriveDueReason(patient, dueDate),
          dueRelative: dueRelativeLabel(dueDate, normalizedToday),
          overdue: dueDate < normalizedToday,
          dueSoon,
          hasAppointment,
          appointmentVisitId: appointment?.visitId || "",
          appointmentDate: appointment?.appointmentDate || "",
          appointmentStatus: appointment?.appointmentStatus || "",
          appointmentReason: appointment?.reasonForVisit || ""
        });
      }
    }

    const counts = {
      dueSoonNoAppointment: rows.filter((row) => row.dueSoon && !row.hasAppointment).length,
      dueSoonHasAppointment: rows.filter((row) => row.dueSoon && row.hasAppointment).length,
      appointmentsScheduled: rows.filter((row) => row.hasAppointment).length
    };

    return {
      counts,
      rows: rows.sort(reminderSortComparator(normalizedToday))
    };
  }

  function filterRowsByCategory(rows, category) {
    const list = Array.isArray(rows) ? rows : [];
    if (category === REMINDER_CATEGORIES.dueSoonNoAppointment) return list.filter((row) => row.dueSoon && !row.hasAppointment);
    if (category === REMINDER_CATEGORIES.dueSoonHasAppointment) return list.filter((row) => row.dueSoon && row.hasAppointment);
    if (category === REMINDER_CATEGORIES.appointmentsScheduled) return list.filter((row) => row.hasAppointment);
    return list;
  }

  function remindersRoute(category = REMINDER_CATEGORIES.dueSoonNoAppointment) {
    return `#/reminders/${encodeURIComponent(String(category || REMINDER_CATEGORIES.dueSoonNoAppointment))}`;
  }

  function parseRemindersRouteCategory(rawCategory = "") {
    const normalized = String(rawCategory || "").trim();
    return Object.values(REMINDER_CATEGORIES).includes(normalized)
      ? normalized
      : REMINDER_CATEGORIES.dueSoonNoAppointment;
  }

  return {
    REMINDER_WINDOW_OPTIONS,
    REMINDER_CATEGORIES,
    isYmd,
    addDaysYmd,
    diffDays,
    resolveReminderWindow,
    normalizeAppointmentStatus,
    deriveDueDate,
    deriveDueReason,
    findQualifiedAppointment,
    isDueSoon,
    dueRelativeLabel,
    reminderSortComparator,
    buildReminderDataset,
    filterRowsByCategory,
    remindersRoute,
    parseRemindersRouteCategory
  };
}));
