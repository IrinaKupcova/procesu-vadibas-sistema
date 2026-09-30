/**
 * Obligāti apstiprinājumi pirms kartiņu labošanas/saglabāšanas un dzēšanas.
 */
(function () {
  "use strict";

  function normalizeSubject(label) {
    const s = String(label || "").trim();
    return s || "informāciju";
  }

  function confirmSave(entityLabel) {
    const subject = normalizeSubject(entityLabel);
    return window.confirm(`Vai tiešām gribat labot vai saglabāt — ${subject}?`);
  }

  function confirmDelete(entityLabel) {
    const subject = normalizeSubject(entityLabel);
    return window.confirm(`Vai tiešām gribat dzēst — ${subject}?`);
  }

  window.PVConfirm = {
    confirmSave,
    confirmDelete,
  };
})();
