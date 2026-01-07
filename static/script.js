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

        // Base DAU
        const currentDauInput = document.getElementById('current-dau');
        // Strip commas for calculation
        let currentDAU = currentDauInput ? parseFloat(currentDauInput.value.replace(/,/g, '')) : 1500000;

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

        for (let i = 0; i <= daysPrediction; i++) {
            labels.push(date.toISOString().split('T')[0]);

            // Push current value
            predictionData.push(currentDAU);

            // Calculate next day
            currentDAU = (currentDAU * retentionRate) + dailyNewUsers;
            date.setDate(date.getDate() + 1);
        }

        dauChart.data.labels = labels;
        // We only show Prediction now, so clear History or leave it empty
        dauChart.data.datasets[0].data = []; // History empty
        dauChart.data.datasets[1].data = predictionData;

        dauChart.update();

        // Update summary numbers
        const lastVal = predictionData[predictionData.length - 1];
        document.querySelector('.value-highlight').textContent =
            (lastVal / 1000000).toLocaleString('en-US', { maximumFractionDigits: 2 }) + ' M';

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
