class CalendarHistogram {
    constructor() {
        this.chart = null;
        this.timeRange = 'custom';
        this.rawCalendarData = null;
        this.combinedCategories = [];
        this.initializeEventListeners();
        this.initializeDatePickers();
        this.initializeCombineControls();
        this.loadData();
    }

    initializeEventListeners() {
        document.getElementById('timeRange').addEventListener('change', (e) => {
            this.timeRange = e.target.value;
            this.updateDatePickers();
            this.loadData();
        });

        document.getElementById('refresh').addEventListener('click', () => {
            this.loadData();
        });

        // Add change listeners to date inputs
        document.getElementById('startDate').addEventListener('change', () => {
            this.timeRange = 'custom';
            document.getElementById('timeRange').value = 'custom';
        });

        document.getElementById('endDate').addEventListener('change', () => {
            this.timeRange = 'custom';
            document.getElementById('timeRange').value = 'custom';
        });

        document.getElementById('prevWeek').addEventListener('click', () => {
            this.shiftDates(-7);
        });

        document.getElementById('nextWeek').addEventListener('click', () => {
            this.shiftDates(7);
        });
    }

    initializeCombineControls() {
        document.getElementById('applyCombine').addEventListener('click', () => {
            this.applyCombination();
        });

        document.getElementById('clearCombine').addEventListener('click', () => {
            this.clearCombination();
        });
    }

    initializeDatePickers() {
        const today = new Date();
        const startDate = document.getElementById('startDate');
        const endDate = document.getElementById('endDate');

        // Set default dates to current week (Monday to Sunday)
        const dayOfWeek = today.getDay();
        const daysFromMonday = (dayOfWeek + 6) % 7; // 0 for Monday, 1 for Tuesday, etc.
        
        const monday = new Date(today);
        monday.setDate(today.getDate() - daysFromMonday);
        
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        
        startDate.value = monday.toISOString().split('T')[0];
        endDate.value = sunday.toISOString().split('T')[0];

        // Set min/max dates
        startDate.max = endDate.value;
        endDate.min = startDate.value;

        // Update min/max when dates change
        startDate.addEventListener('change', () => {
            endDate.min = startDate.value;
        });

        endDate.addEventListener('change', () => {
            startDate.max = endDate.value;
        });
    }

    updateDatePickers() {
        const now = new Date();
        const startDate = document.getElementById('startDate');
        const endDate = document.getElementById('endDate');

        switch (this.timeRange) {
            case 'day':
                startDate.value = now.toISOString().split('T')[0];
                endDate.value = now.toISOString().split('T')[0];
                break;
            case 'week':
                const weekStart = new Date(now.setDate(now.getDate() - now.getDay()));
                const weekEnd = new Date(now.setDate(now.getDate() + 6));
                startDate.value = weekStart.toISOString().split('T')[0];
                endDate.value = weekEnd.toISOString().split('T')[0];
                break;
            case 'month':
                const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
                const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                startDate.value = monthStart.toISOString().split('T')[0];
                endDate.value = monthEnd.toISOString().split('T')[0];
                break;
        }
    }

    shiftDates(days) {
        const startDateInput = document.getElementById('startDate');
        const endDateInput = document.getElementById('endDate');
        
        const currentStart = this.getLocalDateFromInput('startDate');
        const currentEnd = this.getLocalDateFromInput('endDate');
        
        currentStart.setDate(currentStart.getDate() + days);
        currentEnd.setDate(currentEnd.getDate() + days);
        
        startDateInput.value = currentStart.toISOString().split('T')[0];
        endDateInput.value = currentEnd.toISOString().split('T')[0];
        
        this.timeRange = 'custom';
        document.getElementById('timeRange').value = 'custom';
        
        this.loadData();
    }

    // Helper to get local date from input value
    getLocalDateFromInput(inputId, endOfDay = false) {
        const value = document.getElementById(inputId).value;
        const [year, month, day] = value.split('-').map(Number);
        if (endOfDay) {
            return new Date(year, month - 1, day, 23, 59, 59, 999);
        } else {
            return new Date(year, month - 1, day, 0, 0, 0, 0);
        }
    }

    async loadData() {
        try {
            this.showLoading(true);
            console.log("Starting to load calendar data...");
            const tokenResponse = await chrome.identity.getAuthToken({ 
                interactive: true,
                scopes: ['https://www.googleapis.com/auth/calendar.readonly']
            });

            console.log("Auth token response:", tokenResponse);
            if (!tokenResponse || !tokenResponse.token) {
                throw new Error('No auth token available');
            }

            const token = tokenResponse.token;
            console.log("Auth token received:", token ? "Yes" : "No");

            // Get dates from date pickers (local time)
            const startDate = this.getLocalDateFromInput('startDate');
            const endDate = this.getLocalDateFromInput('endDate', true);

            console.log("Time range:", {
                start: startDate.toISOString(),
                end: endDate.toISOString()
            });

            // First, get list of calendars
            const calendarsResponse = await fetch(
                'https://www.googleapis.com/calendar/v3/users/me/calendarList',
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Accept': 'application/json'
                    }
                }
            );

            if (!calendarsResponse.ok) {
                throw new Error('Failed to fetch calendar list');
            }

            const calendarsData = await calendarsResponse.json();
            console.log("Calendars found:", calendarsData.items.length);

            // Fetch events from each calendar
            const allEvents = [];
            for (const calendar of calendarsData.items) {
                const response = await fetch(
                    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendar.id)}/events?` +
                    `timeMin=${startDate.toISOString()}&` +
                    `timeMax=${endDate.toISOString()}&` +
                    `singleEvents=true&` +
                    `orderBy=startTime`,
                    {
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Accept': 'application/json'
                        }
                    }
                );

                if (response.ok) {
                    const data = await response.json();
                    // Add calendar info to each event
                    data.items.forEach(event => {
                        event.calendarId = calendar.id;
                        event.calendarName = calendar.summary;
                    });
                    allEvents.push(...data.items);
                } else {
                    console.warn(`Failed to fetch events for calendar ${calendar.summary}`);
                }
            }

            console.log("Total events found:", allEvents.length);
            this.processData(allEvents);
            this.showLoading(false);
        } catch (error) {
            console.error('Error loading calendar data:', error);
            this.showError('Failed to load calendar data. Please try again.');
            this.showLoading(false);
        }
    }

    processData(events) {
        console.log("Processing events:", events?.length || 0);
        const calendarData = {};

        // Filter out all-day events
        const timedEvents = events.filter(event => {
            if (!event.start || !event.end) {
                console.log("Skipping event with missing start/end:", event);
                return false;
            }
            // Check if it's an all-day event (has date but no dateTime)
            return event.start.dateTime !== undefined;
        });

        console.log("Filtered out all-day events. Processing", timedEvents.length, "timed events");

        // First pass: calculate total hours for each calendar
        timedEvents.forEach(event => {
            const start = new Date(event.start.dateTime);
            const end = new Date(event.end.dateTime);
            const calendarId = event.calendarName || event.calendarId || 'Unknown';
            
            if (!calendarData[calendarId]) {
                calendarData[calendarId] = {
                    totalHours: 0,
                    events: []
                };
            }

            const duration = (end - start) / (1000 * 60 * 60); // Convert to hours
            calendarData[calendarId].totalHours += duration;
            calendarData[calendarId].events.push({
                ...event,
                duration: duration
            });
        });

        // Calculate total hours across all calendars
        const totalHours = Object.values(calendarData).reduce((sum, data) => sum + data.totalHours, 0);

        // Calculate percentages and prepare chart data
        const chartData = Object.entries(calendarData).map(([calendarId, data]) => ({
            calendarId,
            hours: data.totalHours,
            percentage: (data.totalHours / totalHours * 100).toFixed(1),
            events: data.events.sort((a, b) => new Date(b.start.dateTime) - new Date(a.start.dateTime)) // Sort events by start time, newest first
        }));

        // Sort by hours (descending)
        chartData.sort((a, b) => b.hours - a.hours);

        console.log("Processed calendar data:", chartData);
        this.rawCalendarData = chartData;
        this.updateCategoryCheckboxes(chartData);
        this.updateChart(this.applyCombinationsToData(chartData));
    }

    updateCategoryCheckboxes(chartData) {
        const checkboxContainer = document.getElementById('categoryCheckboxes');
        checkboxContainer.innerHTML = '';

        chartData.forEach(data => {
            const div = document.createElement('div');
            div.className = 'category-checkbox';
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = `cat-${data.calendarId}`;
            checkbox.value = data.calendarId;
            
            const label = document.createElement('label');
            label.htmlFor = `cat-${data.calendarId}`;
            label.textContent = `${data.calendarId} (${data.hours.toFixed(1)}h)`;
            
            div.appendChild(checkbox);
            div.appendChild(label);
            checkboxContainer.appendChild(div);
        });

        // Show the combine section if there's data
        if (chartData.length > 0) {
            document.getElementById('combineSection').style.display = 'block';
        }
    }

    applyCombination() {
        const selectedCalendars = [];
        const checkboxes = document.querySelectorAll('#categoryCheckboxes input[type="checkbox"]:checked');
        
        checkboxes.forEach(cb => {
            selectedCalendars.push(cb.value);
        });

        if (selectedCalendars.length < 2) {
            alert('Please select at least 2 calendars to combine');
            return;
        }

        const combinedName = document.getElementById('combinedCategoryName').value.trim();
        if (!combinedName) {
            alert('Please enter a name for the combined category');
            return;
        }

        // Add the combination
        this.combinedCategories.push({
            name: combinedName,
            calendars: selectedCalendars
        });

        // Clear the form
        checkboxes.forEach(cb => cb.checked = false);
        document.getElementById('combinedCategoryName').value = '';

        // Update the chart
        this.updateChart(this.applyCombinationsToData(this.rawCalendarData));
    }

    clearCombination() {
        this.combinedCategories = [];
        document.querySelectorAll('#categoryCheckboxes input[type="checkbox"]').forEach(cb => {
            cb.checked = false;
        });
        document.getElementById('combinedCategoryName').value = '';
        
        // Refresh the chart with original data
        if (this.rawCalendarData) {
            this.updateChart(this.rawCalendarData);
        }
    }

    applyCombinationsToData(chartData) {
        if (this.combinedCategories.length === 0) {
            return chartData;
        }

        const result = [];
        const combinedCalendarIds = new Set();

        // Process each combination
        this.combinedCategories.forEach(combination => {
            const combinedData = {
                calendarId: combination.name,
                hours: 0,
                percentage: 0,
                events: [],
                isCombined: true
            };

            combination.calendars.forEach(calId => {
                combinedCalendarIds.add(calId);
                const calData = chartData.find(d => d.calendarId === calId);
                if (calData) {
                    combinedData.hours += calData.hours;
                    combinedData.events.push(...calData.events);
                }
            });

            // Sort events by start time, newest first
            combinedData.events.sort((a, b) => new Date(b.start.dateTime) - new Date(a.start.dateTime));
            
            result.push(combinedData);
        });

        // Add non-combined calendars
        chartData.forEach(data => {
            if (!combinedCalendarIds.has(data.calendarId)) {
                result.push(data);
            }
        });

        // Recalculate percentages
        const totalHours = result.reduce((sum, data) => sum + data.hours, 0);
        result.forEach(data => {
            data.percentage = (data.hours / totalHours * 100).toFixed(1);
        });

        // Sort by hours (descending)
        result.sort((a, b) => b.hours - a.hours);

        return result;
    }

    updateChart(chartData) {
        console.log("Updating chart with data:", chartData);

        const ctx = document.getElementById('histogramChart').getContext('2d');
        
        if (this.chart) {
            console.log("Destroying existing chart");
            this.chart.destroy();
        }

        // Get the selected date range (local time)
        const startDate = this.getLocalDateFromInput('startDate');
        const endDate = this.getLocalDateFromInput('endDate');

        // Format the time range for display
        let timeRangeText;
        if (startDate.toDateString() === endDate.toDateString()) {
            // Same day
            timeRangeText = startDate.toLocaleDateString();
        } else {
            // Different days
            timeRangeText = `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`;
        }

        // Calculate total hours
        const totalHours = chartData.reduce((sum, data) => sum + data.hours, 0);

        this.chart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: chartData.map(d => d.calendarId),
                datasets: [{
                    label: 'Hours',
                    data: chartData.map(d => d.hours),
                    backgroundColor: chartData.map(d => d.isCombined ? '#FF6B6B' : this.getRandomColor()),
                    borderColor: chartData.map(d => d.isCombined ? '#CC5555' : '#999'),
                    borderWidth: chartData.map(d => d.isCombined ? 2 : 1)
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Hours'
                        }
                    }
                },
                plugins: {
                    title: {
                        display: true,
                        text: [
                            'Calendar Time Distribution',
                            `Time Range: ${timeRangeText}`,
                            `Total Hours: ${totalHours.toFixed(1)}`
                        ],
                        font: {
                            size: 16
                        }
                    },
                    tooltip: {
                        callbacks: {
                            title: function(context) {
                                const data = chartData[context[0].dataIndex];
                                const title = [
                                    data.calendarId + (data.isCombined ? ' (Combined)' : ''),
                                    `Total: ${data.hours.toFixed(1)} hours (${data.percentage}%)`
                                ];
                                return title;
                            },
                            label: function(context) {
                                const data = chartData[context.dataIndex];
                                return data.events.map(event => {
                                    const start = new Date(event.start.dateTime);
                                    const end = new Date(event.end.dateTime);
                                    return [
                                        `${event.summary || 'Untitled'}`,
                                        `${start.toLocaleTimeString()} - ${end.toLocaleTimeString()}`,
                                        `(${event.duration.toFixed(1)} hours)`
                                    ].join(' ');
                                });
                            }
                        }
                    }
                },
                onClick: (event, elements) => {
                    if (elements.length > 0) {
                        const index = elements[0].index;
                        this.showEventTable(chartData[index]);
                    }
                }
            }
        });
    }

    showEventTable(calendarData) {
        const tableContainer = document.getElementById('eventTable');
        const tableTitle = document.getElementById('tableTitle');
        const tableBody = document.getElementById('eventTableBody');

        // Update title
        const combinedLabel = calendarData.isCombined ? ' (Combined Category)' : '';
        tableTitle.textContent = `${calendarData.calendarId}${combinedLabel} - ${calendarData.hours.toFixed(1)} hours (${calendarData.percentage}%)`;

        // Clear existing rows
        tableBody.innerHTML = '';

        // Add event rows
        calendarData.events.forEach(event => {
            const start = new Date(event.start.dateTime);
            const end = new Date(event.end.dateTime);
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${event.summary || 'Untitled'}</td>
                <td>${start.toLocaleDateString()}</td>
                <td>${start.toLocaleTimeString()} - ${end.toLocaleTimeString()}</td>
                <td>${event.duration.toFixed(1)} hours</td>
            `;
            tableBody.appendChild(row);
        });

        // Show the table
        tableContainer.style.display = 'block';
    }

    getRandomColor() {
        const letters = '0123456789ABCDEF';
        let color = '#';
        for (let i = 0; i < 6; i++) {
            color += letters[Math.floor(Math.random() * 16)];
        }
        return color;
    }

    showError(message) {
        const container = document.querySelector('.container');
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error';
        errorDiv.textContent = message;
        container.appendChild(errorDiv);
    }

    showLoading(show) {
        const spinner = document.getElementById('loadingSpinner');
        spinner.style.display = show ? 'flex' : 'none';
    }
}

// Initialize the histogram when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new CalendarHistogram();
}); 