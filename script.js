// script.js
let rawData = [];
let currentSort = { key: '', asc: true };

const csvFile = document.getElementById("csvFile");
const tableBody = document.querySelector("#userTable tbody");
const licenseFilter = document.getElementById("licenseFilter");
const searchInput = document.getElementById("searchInput");
const exportBtn = document.getElementById("exportBtn");
const historyList = document.getElementById("historyList");

csvFile.addEventListener("change", handleCSVUpload);
searchInput.addEventListener("input", renderTable);
licenseFilter.addEventListener("change", renderTable);
exportBtn.addEventListener("click", exportToCSV);

document.querySelectorAll("th[data-sort]").forEach(th => {
  th.addEventListener("click", () => {
    const key = th.getAttribute("data-sort");
    currentSort.asc = currentSort.key === key ? !currentSort.asc : true;
    currentSort.key = key;
    renderTable();
  });
});

function handleCSVUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (e) {
    const text = e.target.result;
    parseCSV(text);
    historyList.innerHTML += `<li>${file.name} - ${new Date().toLocaleString()}</li>`;
  };
  reader.readAsText(file);
}

function parseCSV(text) {
  const rows = text.trim().split("\n").map(row => row.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/));
  const headers = rows[0];
  const nameIdx = headers.findIndex(h => h.toLowerCase().includes("display"));
  const emailIdx = headers.findIndex(h => h.toLowerCase().includes("principal"));
  const licenseIdx = headers.findIndex(h => h.toLowerCase().includes("licenses"));

  if (nameIdx < 0 || emailIdx < 0 || licenseIdx < 0) {
    alert("⚠️ Arquivo CSV inválido: colunas esperadas não encontradas.");
    return;
  }

  rawData = rows.slice(1).map(r => ({
    name: r[nameIdx].replaceAll('"', ''),
    email: r[emailIdx].replaceAll('"', ''),
    license: r[licenseIdx].replaceAll('"', '') || 'Nenhuma'
  }));

  populateLicenseFilter();
  renderTable();
  renderCharts();
}

function populateLicenseFilter() {
  const unique = [...new Set(rawData.map(r => r.license))];
  licenseFilter.innerHTML = `<option value="">Todas as Licenças</option>` +
    unique.map(l => `<option value="${l}">${l}</option>`).join("");
}

function renderTable() {
  const search = searchInput.value.toLowerCase();
  const selectedLicense = licenseFilter.value;

  let data = rawData.filter(r =>
    (r.name.toLowerCase().includes(search) || r.email.toLowerCase().includes(search)) &&
    (!selectedLicense || r.license === selectedLicense)
  );

  if (currentSort.key) {
    data = data.sort((a, b) => {
      const valA = a[currentSort.key.toLowerCase()].toLowerCase();
      const valB = b[currentSort.key.toLowerCase()].toLowerCase();
      return currentSort.asc ? valA.localeCompare(valB) : valB.localeCompare(valA);
    });
  }

  tableBody.innerHTML = data.map(r => `
    <tr>
      <td>${r.name}</td>
      <td>${r.email}</td>
      <td>${r.license}</td>
    </tr>`).join("");
}

function renderCharts() {
  const count = {};
  rawData.forEach(r => count[r.license] = (count[r.license] || 0) + 1);
  const labels = Object.keys(count);
  const values = Object.values(count);

  new Chart("pieChart", {
    type: "pie",
    data: {
      labels,
      datasets: [{ data: values, backgroundColor: genColors(labels.length) }]
    }
  });

  new Chart("barChart", {
    type: "bar",
    data: {
      labels,
      datasets: [{ label: "Licenças", data: values, backgroundColor: genColors(labels.length) }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true } }
    }
  });
}

function exportToCSV() {
  const rows = [["Nome", "E-mail", "Licença"], ...rawData.map(r => [r.name, r.email, r.license])];
  const csv = rows.map(r => r.map(cell => `"${cell}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "dados_licencas.csv";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function genColors(n) {
  const base = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];
  return Array.from({ length: n }, (_, i) => base[i % base.length]);
}
