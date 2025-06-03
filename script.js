// script.js
let rawData = [];
let currentSort = { key: '', asc: true };
let pieChartInstance = null;
let barChartInstance = null;
let isFilteringFromChart = false;

// Elementos DOM
const csvFile = document.getElementById("csvFile");
const tableBody = document.querySelector("#userTable tbody");
const licenseFilter = document.getElementById("licenseFilter");
const searchInput = document.getElementById("searchInput");
const exportBtn = document.getElementById("exportBtn");
const historyList = document.getElementById("historyList");
const tableInfo = document.getElementById("tableInfo");

// Event Listeners
csvFile.addEventListener("change", handleCSVUpload);
searchInput.addEventListener("input", () => {
  isFilteringFromChart = false;
  renderTable();
});
licenseFilter.addEventListener("change", () => {
  if (!isFilteringFromChart) renderTable();
  isFilteringFromChart = false;
});
exportBtn.addEventListener("click", exportToCSV);

// Sortable table headers
document.querySelectorAll("th[data-sort]").forEach(th => {
  th.addEventListener("click", () => {
    const key = th.getAttribute("data-sort");
    const isAsc = currentSort.key === key ? !currentSort.asc : true;
    
    // Update sort indicators
    document.querySelectorAll("th").forEach(header => {
      header.classList.remove("asc", "desc", "active");
    });
    
    th.classList.add("active");
    th.classList.add(isAsc ? "asc" : "desc");
    
    currentSort = { key, asc: isAsc };
    renderTable();
  });
});

function handleCSVUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const text = e.target.result;
      parseCSV(text);
      
      // Add to history
      const fileSize = (file.size / 1024).toFixed(2) + ' KB';
      const timestamp = new Date().toLocaleString();
      const historyItem = document.createElement('li');
      historyItem.innerHTML = `
        <span>${file.name}</span>
        <span>${fileSize} - ${timestamp}</span>
      `;
      historyList.insertBefore(historyItem, historyList.firstChild);
      
      showAlert("✅ Dados carregados com sucesso!", "success");
    } catch (error) {
      showAlert("❌ Erro ao processar o arquivo: " + error.message, "danger");
      console.error("CSV processing error:", error);
    }
  };
  reader.onerror = () => {
    showAlert("❌ Erro ao ler o arquivo", "danger");
  };
  reader.readAsText(file);
}

function parseCSV(text) {
  const rows = text.trim().split("\n").map(row => row.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/));
  const headers = rows[0].map(h => h.trim().replace(/"/g, ''));
  
  // Find required columns
  const nameIdx = headers.findIndex(h => h.toLowerCase().includes("display"));
  const emailIdx = headers.findIndex(h => h.toLowerCase().includes("principal"));
  const licenseIdx = headers.findIndex(h => h.toLowerCase().includes("licenses"));

  if (nameIdx < 0 || emailIdx < 0 || licenseIdx < 0) {
    throw new Error("Colunas esperadas não encontradas (Nome, E-mail, Licenças)");
  }

  // Process data rows
  rawData = rows.slice(1).map(r => ({
    name: r[nameIdx].replaceAll('"', '').trim(),
    email: r[emailIdx].replaceAll('"', '').trim(),
    license: r[licenseIdx].replaceAll('"', '').trim() || 'Nenhuma'
  }));

  populateLicenseFilter();
  renderTable();
  renderCharts();
}

function populateLicenseFilter() {
  const licenses = [...new Set(rawData.map(r => r.license))].sort();
  licenseFilter.innerHTML = `
    <option value="">Todas as Licenças</option>
    ${licenses.map(l => `<option value="${l}">${l}</option>`).join("")}
  `;
}

function renderTable() {
  const search = searchInput.value.toLowerCase();
  const selectedLicense = licenseFilter.value;

  // Filter data
  let filteredData = rawData.filter(r =>
    (r.name.toLowerCase().includes(search) || r.email.toLowerCase().includes(search)) &&
    (!selectedLicense || r.license === selectedLicense)
  );

  // Update table info
  tableInfo.textContent = `${filteredData.length} de ${rawData.length} registros`;
  
  // Sort data if needed
  if (currentSort.key) {
    const sortKey = currentSort.key.toLowerCase().replace(' ', '');
    filteredData = filteredData.sort((a, b) => {
      const valA = a[sortKey].toLowerCase();
      const valB = b[sortKey].toLowerCase();
      return currentSort.asc ? valA.localeCompare(valB) : valB.localeCompare(valA);
    });
  }

  // Render table rows
  tableBody.innerHTML = filteredData.map(r => `
    <tr>
      <td>${r.name}</td>
      <td>${r.email}</td>
      <td><span class="license-badge">${r.license}</span></td>
    </tr>`).join("");

  // Update charts highlights
  updateChartsHighlight();
}

function renderCharts() {
  const { labels, values, colors } = getChartData();

  // Destroy existing charts if they exist
  if (pieChartInstance) pieChartInstance.destroy();
  if (barChartInstance) barChartInstance.destroy();

  // Pie Chart
  const pieCtx = document.getElementById('pieChart').getContext('2d');
  pieChartInstance = new Chart(pieCtx, {
    type: "pie",
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: colors,
        borderWidth: 1,
        borderColor: '#fff'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: {
            padding: 20,
            usePointStyle: true,
            pointStyle: 'circle'
          }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              const label = context.label || '';
              const value = context.raw || 0;
              const total = context.dataset.data.reduce((a, b) => a + b, 0);
              const percentage = Math.round((value / total) * 100);
              return `${label}: ${value} (${percentage}%)`;
            }
          }
        }
      },
      onClick: (event, elements) => {
        if (elements.length > 0) {
          isFilteringFromChart = true;
          const label = pieChartInstance.data.labels[elements[0].index];
          licenseFilter.value = label;
          licenseFilter.dispatchEvent(new Event('change'));
          renderTable();
        }
      }
    }
  });

  // Bar Chart
  const barCtx = document.getElementById('barChart').getContext('2d');
  barChartInstance = new Chart(barCtx, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Quantidade",
        data: values,
        backgroundColor: colors,
        borderWidth: 1,
        borderColor: '#fff',
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function(context) {
              return `${context.parsed.y} usuários`;
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            precision: 0
          }
        }
      },
      onClick: (event, elements) => {
        if (elements.length > 0) {
          isFilteringFromChart = true;
          const label = barChartInstance.data.labels[elements[0].index];
          licenseFilter.value = label;
          licenseFilter.dispatchEvent(new Event('change'));
          renderTable();
        }
      }
    }
  });
}

function updateChartsHighlight() {
  const selectedLicense = licenseFilter.value;
  if (!pieChartInstance || !barChartInstance || !selectedLicense) return;

  // Reset all highlights
  pieChartInstance.data.datasets[0].backgroundColor = pieChartInstance.data.labels.map(
    (_, i) => genColors(pieChartInstance.data.labels.length)[i]
  );
  
  barChartInstance.data.datasets[0].backgroundColor = barChartInstance.data.labels.map(
    (_, i) => genColors(barChartInstance.data.labels.length)[i]
  );

  // Highlight selected license
  const licenseIndex = pieChartInstance.data.labels.indexOf(selectedLicense);
  if (licenseIndex !== -1) {
    pieChartInstance.data.datasets[0].backgroundColor[licenseIndex] = '#ef4444'; // Vermelho
    barChartInstance.data.datasets[0].backgroundColor[licenseIndex] = '#ef4444'; // Vermelho
  }

  pieChartInstance.update();
  barChartInstance.update();
}

function getChartData() {
  const licenseCount = {};
  rawData.forEach(r => licenseCount[r.license] = (licenseCount[r.license] || 0) + 1);
  
  const labels = Object.keys(licenseCount).sort();
  const values = labels.map(label => licenseCount[label]);
  const colors = genColors(labels.length);
  
  return { labels, values, colors };
}

function exportToCSV() {
  if (rawData.length === 0) {
    showAlert("❌ Nenhum dado para exportar", "warning");
    return;
  }

  try {
    const headers = ["Nome", "E-mail", "Licença"];
    const rows = [headers, ...rawData.map(r => [r.name, r.email, r.license])];
    const csvContent = rows.map(row => 
      row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(",")
    ).join("\n");
    
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `licencas_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 100);
    
    showAlert("✅ Dados exportados com sucesso!", "success");
  } catch (error) {
    showAlert("❌ Erro ao exportar dados", "danger");
    console.error("Export error:", error);
  }
}

function genColors(n) {
  const baseColors = [
    '#4361ee', '#3f37c9', '#4cc9f0', '#4895ef', 
    '#f72585', '#b5179e', '#7209b7', '#560bad',
    '#3a0ca3', '#480ca8', '#3a86ff', '#8338ec'
  ];
  return Array.from({ length: n }, (_, i) => baseColors[i % baseColors.length]);
}

function showAlert(message, type) {
  const alert = document.createElement('div');
  alert.className = `alert alert-${type}`;
  alert.innerHTML = message;
  alert.style.position = 'fixed';
  alert.style.top = '20px';
  alert.style.right = '20px';
  alert.style.padding = '0.75rem 1.25rem';
  alert.style.borderRadius = '4px';
  alert.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
  alert.style.zIndex = '1000';
  alert.style.animation = 'fadeIn 0.3s ease';
  
  // Style based on type
  const styles = {
    success: {
      background: '#d1fae5',
      color: '#065f46',
      border: '1px solid #a7f3d0'
    },
    warning: {
      background: '#fef3c7',
      color: '#92400e',
      border: '1px solid #fde68a'
    },
    danger: {
      background: '#fee2e2',
      color: '#b91c1c',
      border: '1px solid #fecaca'
    }
  };
  
  Object.assign(alert.style, styles[type] || styles.success);
  
  document.body.appendChild(alert);
  
  // Auto-remove after 3 seconds
  setTimeout(() => {
    alert.style.animation = 'fadeOut 0.3s ease';
    setTimeout(() => alert.remove(), 300);
  }, 3000);
}

// Add CSS animations for alerts
const style = document.createElement('style');
style.textContent = `
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(-20px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes fadeOut {
    from { opacity: 1; transform: translateY(0); }
    to { opacity: 0; transform: translateY(-20px); }
  }
`;
document.head.appendChild(style);
