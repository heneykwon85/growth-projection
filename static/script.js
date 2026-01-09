document.addEventListener('DOMContentLoaded', () => {
    const ctx = document.getElementById('dauChart').getContext('2d');

    // Gradient for the chart areas
    const gradientHistory = ctx.createLinearGradient(0, 0, 0, 400);
    gradientHistory.addColorStop(0, 'rgba(148, 163, 184, 0.4)'); // Slate 400 - faint gray
    gradientHistory.addColorStop(1, 'rgba(148, 163, 184, 0.0)');

    const gradientPrediction = ctx.createLinearGradient(0, 0, 0, 400);
    gradientPrediction.addColorStop(0, 'rgba(15, 23, 42, 0.4)'); // Slate 900 - dark gray
    gradientPrediction.addColorStop(1, 'rgba(15, 23, 42, 0.0)');

    let dauChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                {
                    label: 'History DAU',
                    data: [],
                    borderColor: '#94a3b8', // Gray
                    backgroundColor: gradientHistory,
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 0
                },
                {
                    label: 'Predicted DAU',
                    data: [],
                    borderColor: '#0f172a', // Black
                    backgroundColor: gradientPrediction,
                    borderWidth: 2,
                    borderDash: [5, 5],
                    fill: true,
                    tension: 0.4,
                    pointRadius: 0
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        color: '#475569', // Slate 600
                        font: {
                            family: "'Inter', sans-serif"
                        }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.95)', // Dark Tooltip
                    titleColor: '#f8fafc',
                    bodyColor: '#e2e8f0',
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    borderWidth: 0,
                    padding: 12,
                    displayColors: true,
                    cornerRadius: 8,
                    callbacks: {
                        label: function (context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                label += new Intl.NumberFormat('en-US').format(Math.round(context.parsed.y));
                            }
                            return label;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    },
                    ticks: {
                        color: '#64748b', // Slate 500
                        maxTicksLimit: 10
                    }
                },
                y: {
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    },
                    ticks: {
                        color: '#64748b',
                        callback: function (value) {
                            return value.toLocaleString();
                        }
                    }
                }
            }
        }
    });

    const runBtn = document.querySelector('.btn-primary');

    // Initial Simulation
    generateData();

    runBtn.addEventListener('click', () => {
        // Add a loading effect or just regenerate
        runBtn.textContent = 'Calculating...';
        setTimeout(() => {
            generateData();
            runBtn.textContent = 'Run Projection';
        }, 500);
    });

    const exportBtn = document.getElementById('btn-export');
    if (exportBtn) {
        exportBtn.addEventListener('click', () => {
            if (!window.lastForecastData || window.lastForecastData.length === 0) {
                alert('No data to export. Please run a forecast first.');
                return;
            }

            const headers = ['Date', 'Operating system', 'Forecast DAU (total)', 'Growth (Net)', 'Growth (%)', 'Predict new DAU', 'Forecast stock DAU'];
            const csvContent = [
                headers.join(','),
                ...window.lastForecastData.map(row => [
                    row.date,
                    row.os,
                    Math.round(row.total),
                    Math.round(row.growthNet),
                    row.growthPercent.toFixed(2) + '%',
                    Math.round(row.newUsers),
                    Math.round(row.stock)
                ].join(','))
            ].join('\n');

            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', `dau_forecast_${new Date().toISOString().split('T')[0]}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        });
    }

    // Helper to format inputs with commas
    const formatNumberInput = (input) => {
        let value = input.value.replace(/,/g, '');
        if (!isNaN(value) && value !== '') {
            input.value = parseFloat(value).toLocaleString('en-US');
        }
    };

    const inputsToFormat = ['current-dau', 'dnu'];
    inputsToFormat.forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            // Initial format
            formatNumberInput(input);
            // Format on input
            input.addEventListener('input', (e) => {
                // Remove non-numeric characters except comma (and maybe dot)
                let val = e.target.value.replace(/[^0-9.]/g, '');
                if (val) {
                    const parts = val.split('.');
                    parts[0] = parseInt(parts[0]).toLocaleString('en-US');
                    e.target.value = parts.join('.');
                } else {
                    e.target.value = '';
                }
            });
            input.addEventListener('blur', () => formatNumberInput(input));
        }
    });

    function generateData() {
        const startDateInput = document.getElementById('start-date');
        const endDateInput = document.getElementById('end-date');

        if (!startDateInput || !endDateInput) return;

        const start = new Date(startDateInput.value);
        const end = new Date(endDateInput.value);

        // Calculate difference in days
        const diffTime = Math.abs(end - start);
        const daysPrediction = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (!daysPrediction || daysPrediction < 0) return;

        const predictionData = [];
        const labels = [];
        const stockData = [];
        const newUserData = [];

        // Base DAU
        const currentDauInput = document.getElementById('current-dau');
        // Strip commas for calculation
        let currentDAU = currentDauInput ? parseFloat(currentDauInput.value.replace(/,/g, '')) : 50000;

        // Growth parameters
        const lt365Element = document.getElementById('lt365');
        const dnuElement = document.getElementById('dnu');

        // Safety check
        if (!lt365Element || !dnuElement) return;

        const lt365_val = parseFloat(lt365Element.value);
        const dnu_val = parseFloat(dnuElement.value.replace(/,/g, ''));
        const dailyNewUsers = dnu_val;

        // New parameters logic
        const lt60Element = document.getElementById('lt60');
        const decayElement = document.getElementById('decay-rate');

        const decayRateInput = decayElement ? parseFloat(decayElement.value) : 0;
        const decayFactor = 1 - (decayRateInput / 1000);

        // Retention r ≈ 1 - (1 / LT)
        let retentionRate = lt365_val > 0 ? (1 - (1 / lt365_val)) : 0.98;
        retentionRate *= decayFactor;

        // Generate Prediction (No History, just Forecast range)
        let date = new Date(start);

        // Prepare table data
        window.lastForecastData = [];
        const tableBody = document.getElementById('forecast-table-body');
        if (tableBody) tableBody.innerHTML = '';
        const fragment = document.createDocumentFragment();

        // Helper to get OS value safely (assuming 3rd select)
        const selects = document.querySelectorAll('select.input-premium');
        const osValue = selects[2] ? selects[2].value : 'All';

        for (let i = 0; i <= daysPrediction; i++) {
            const dateStr = date.toISOString().split('T')[0];
            labels.push(dateStr);

            // Push current value
            predictionData.push(currentDAU);

            // Calculate Components
            const newUsers = dailyNewUsers;
            const stockDAU = Math.max(0, currentDAU - newUsers);

            // Calculate Growth
            let netGrowth = 0;
            let growthPercent = 0;
            if (i > 0) {
                const prevDAU = predictionData[i - 1];
                netGrowth = currentDAU - prevDAU;
                growthPercent = (netGrowth / prevDAU) * 100;
            }

            // Store detailed data
            const rowData = {
                date: dateStr,
                os: osValue,
                total: currentDAU,
                growthNet: netGrowth,
                growthPercent: growthPercent,
                newUsers: newUsers,
                stock: stockDAU
            };
            window.lastForecastData.push(rowData);

            // Create Table Row
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${dateStr}</td>
                <td>${osValue}</td>
                <td>${Math.round(currentDAU).toLocaleString()}</td>
                <td class="${netGrowth >= 0 ? 'text-success' : 'text-danger'}">${netGrowth > 0 ? '+' : ''}${Math.round(netGrowth).toLocaleString()}</td>
                <td class="${growthPercent >= 0 ? 'text-success' : 'text-danger'}">${growthPercent > 0 ? '+' : ''}${growthPercent.toFixed(2)}%</td>
                <td>${Math.round(newUsers).toLocaleString()}</td>
                <td>${Math.round(stockDAU).toLocaleString()}</td>
            `;
            fragment.appendChild(tr);

            // Calculate next day
            currentDAU = (currentDAU * retentionRate) + dailyNewUsers;
            date.setDate(date.getDate() + 1);
        }

        if (tableBody) tableBody.appendChild(fragment);

        dauChart.data.labels = labels;
        // We only show Prediction now, so clear History or leave it empty
        dauChart.data.datasets[0].data = []; // History empty
        dauChart.data.datasets[1].data = predictionData;

        dauChart.update();

        // Update summary numbers
        const lastVal = predictionData[predictionData.length - 1];
        document.querySelector('.value-highlight').textContent =
            (lastVal / 1000).toLocaleString('en-US', { maximumFractionDigits: 2 }) + ' K';

        // Update Chart Header Summary
        // Daily New Users (Sync with input)
        document.querySelectorAll('.summary-item .value')[0].textContent =
            parseInt(dnu_val).toLocaleString();
        // Current DAU (Start of period)
        document.querySelectorAll('.summary-item .value')[1].textContent =
            Math.round(predictionData[0]).toLocaleString();
        // Predicted DAU (End of period)
        document.querySelectorAll('.summary-item .value')[2].textContent =
            Math.round(lastVal).toLocaleString();
    }
});
