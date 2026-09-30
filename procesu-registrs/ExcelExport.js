/**
 * Excel eksports (HTML .xls) — kopīgas funkcijas un sadaļu pogas.
 */
(function () {
  "use strict";

  function statusMsg(text, kind) {
    if (typeof window.status === "function") window.status(text, kind || "info");
  }

  function escCell(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function downloadExcelHtml(bodyHtml, filePrefix) {
    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"></head><body>${bodyHtml}</body></html>`;
    const blob = new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8;" });
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${filePrefix}_${stamp}.xls`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  function cloneTableForExport(table) {
    const clone = table.cloneNode(true);
    clone.classList.remove("table-body-hidden", "hidden");
    clone.querySelectorAll("button, .th-filter-wrap, .th-filter-btn, .th-filter-checklist").forEach((el) => {
      el.remove();
    });
    clone.querySelectorAll("tbody").forEach((tb) => {
      tb.style.display = "";
    });
    clone.querySelectorAll("tbody tr").forEach((tr) => {
      tr.style.display = "";
      tr.classList.remove("process-accordion-part");
    });
    return clone;
  }

  function exportTableToExcel(tableId, filePrefix) {
    const table = document.getElementById(tableId);
    if (!table) {
      statusMsg("Eksports nav pieejams: tabula nav atrasta.", "error");
      return;
    }
    const clone = cloneTableForExport(table);
    downloadExcelHtml(clone.outerHTML, filePrefix || "eksports");
    statusMsg("Excel fails lejupielādēts.", "success");
  }

  function exportMultiTablesToExcel(tableIds, filePrefix, sectionTitles) {
    const ids = Array.isArray(tableIds) ? tableIds : [];
    const parts = [];
    ids.forEach((id, i) => {
      const table = document.getElementById(id);
      if (!table) return;
      const title = (sectionTitles && sectionTitles[i]) || id;
      const clone = cloneTableForExport(table);
      parts.push(`<h3 style="font-family:Calibri,sans-serif;margin:16px 0 8px;">${escCell(title)}</h3>${clone.outerHTML}`);
    });
    if (!parts.length) {
      statusMsg("Eksports nav pieejams: nav datu tabulu.", "error");
      return;
    }
    downloadExcelHtml(parts.join("<br/>"), filePrefix || "eksports");
    statusMsg("Excel fails lejupielādēts.", "success");
  }

  function exportRowsToExcel(headers, rows, filePrefix) {
    const ths = (headers || []).map((h) => `<th>${escCell(h)}</th>`).join("");
    const body = (rows || [])
      .map((row) => {
        const tds = (row || []).map((c) => `<td>${escCell(c)}</td>`).join("");
        return `<tr>${tds}</tr>`;
      })
      .join("");
    const tableHtml = `<table border="1"><thead><tr>${ths}</tr></thead><tbody>${body}</tbody></table>`;
    downloadExcelHtml(tableHtml, filePrefix || "eksports");
    statusMsg("Excel fails lejupielādēts.", "success");
  }

  function ensureHiddenExportTable(tableId, headers) {
    let table = document.getElementById(tableId);
    if (!table) {
      table = document.createElement("table");
      table.id = tableId;
      table.className = "ex-export-table hidden";
      table.setAttribute("aria-hidden", "true");
      document.body.appendChild(table);
    }
    const thHtml = (headers || []).map((h) => `<th>${escCell(h)}</th>`).join("");
    table.innerHTML = `<thead><tr>${thHtml}</tr></thead><tbody></tbody>`;
    return table;
  }

  function syncProcessSliceExport(tableId, headers, pickRow) {
    const table = ensureHiddenExportTable(tableId, headers);
    const tbody = table.querySelector("tbody");
    if (!tbody) return;
    const rows =
      typeof window.getProcessRows === "function" ? window.getProcessRows() || [] : [];
    tbody.innerHTML = "";
    rows.forEach((r) => {
      const cells = pickRow(r);
      if (!cells) return;
      const tr = document.createElement("tr");
      tr.innerHTML = cells.map((c) => `<td>${escCell(c)}</td>`).join("");
      tbody.appendChild(tr);
    });
  }

  function syncMetricsExportTable() {
    syncProcessSliceExport(
      "metricsExportTable",
      ["Procesa grupa", "Procesa Nr.", "Process", "Optimizācija", "Citi rādītāji"],
      (r) => [
        r.group || "",
        r.processNo || "",
        r.process || "",
        r.optimization || "",
        r.otherMetrics || "",
      ]
    );
  }

  function syncPlusmasExportTable() {
    syncProcessSliceExport(
      "plusmasExportTable",
      ["Procesa grupa", "Procesa Nr.", "Process", "Plūsmas shēmas"],
      (r) => [r.group || "", r.processNo || "", r.process || "", r.flowcharts || ""]
    );
  }

  function ensureExportStyles() {
    if (document.getElementById("pvExcelExportCss")) return;
    const s = document.createElement("style");
    s.id = "pvExcelExportCss";
    s.textContent = ".ex-export-table.hidden{display:none!important}";
    document.head.appendChild(s);
  }

  function bindClick(id, handler) {
    const el = document.getElementById(id);
    if (!el || el.dataset.pvExcelBound) return;
    el.dataset.pvExcelBound = "1";
    el.addEventListener("click", (ev) => {
      ev.preventDefault();
      try {
        handler();
      } catch (e) {
        console.error("Excel eksports:", e);
        statusMsg("Eksports neizdevās: " + String(e.message || e), "error");
      }
    });
  }

  function wireSectionExportButtons() {
    bindClick("exportProcessExcelBtn", () => exportTableToExcel("processTable", "procesu_registrs"));
    bindClick("exportCatalogExcelBtn", () => exportTableToExcel("catalogTable", "gp_katalogs"));
    bindClick("exportJomasExcelBtn", () => {
      if (typeof window.renderProcessJomasView === "function") window.renderProcessJomasView();
      exportTableToExcel("processJomasTable", "jomas");
    });
    bindClick("exportExecutorsExcelBtn", () => {
      if (typeof window.renderExecutorsView === "function") window.renderExecutorsView();
      exportTableToExcel("executorsTable", "izpilditaji");
    });
    bindClick("exportNormActsExcelBtn", () => exportTableToExcel("naTable", "normativie_akti"));
    bindClick("exportOptimizacijaExcelBtn", () => {
      if (window.Optimizacija && typeof window.Optimizacija.syncExportTable === "function") {
        window.Optimizacija.syncExportTable();
      }
      exportTableToExcel("optimizacijaExportTable", "optimizacija");
    });
    bindClick("exportReportsExcelBtn", () => {
      if (typeof window.renderOrgStats === "function") window.renderOrgStats();
      exportMultiTablesToExcel(
        ["orgStatsTable", "processOutputStatsTable", "jomaStatsTable"],
        "statistika",
        ["Struktūrvienību statistika", "Procesu iznākums", "Jomu statistika"]
      );
    });
    bindClick("exportMetricsExcelBtn", () => {
      syncMetricsExportTable();
      exportTableToExcel("metricsExportTable", "procesu_raditaji");
    });
    bindClick("exportPlusmasExcelBtn", () => {
      syncPlusmasExportTable();
      exportTableToExcel("plusmasExportTable", "plusmas_shemas");
    });
    bindClick("exportTasksExcelBtn", () => {
      if (typeof window.renderTasksView === "function") window.renderTasksView();
      exportTableToExcel("tasksSummaryTable", "uzdevumu_skats");
    });
    bindClick("exportProcessGroupsExcelBtn", () => {
      if (typeof window.renderProcessGroupsView === "function") window.renderProcessGroupsView();
      exportTableToExcel("processGroupsTable", "procesu_grupas");
    });
  }

  window.exportTableToExcel = exportTableToExcel;
  window.PVExcel = {
    exportTableToExcel,
    exportMultiTablesToExcel,
    exportRowsToExcel,
    syncMetricsExportTable,
    syncPlusmasExportTable,
    syncProcessSliceExport,
  };

  function boot() {
    ensureExportStyles();
    wireSectionExportButtons();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
