class CalendarHistogram {
    constructor() {
        this.chart = null;
        this.timeRange = 'custom';
        this.initializeEventListeners();
        this.initializeDatePickers();
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
            this.loadData();
        });

        document.getElementById('endDate').addEventListener('change', () => {
            this.timeRange = 'custom';
            document.getElementById('timeRange').value = 'custom';
            this.loadData();
        });
    }

    initializeDatePickers() {
        const today = new Date();
        const startDate = document.getElementById('startDate');
        const endDate = document.getElementById('endDate');

        // Set default dates to today
        startDate.value = today.toISOString().split('T')[0];
        endDate.value = today.toISOString().split('T')[0];

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
        } catch (error) {
            console.error('Error loading calendar data:', error);
            this.showError('Failed to load calendar data. Please try again.');
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
        this.updateChart(chartData);
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
                    backgroundColor: chartData.map(() => this.getRandomColor()),
                    borderColor: chartData.map(() => this.getRandomColor()),
                    borderWidth: 1
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
                                return [
                                    data.calendarId,
                                    `Total: ${data.hours.toFixed(1)} hours (${data.percentage}%)`
                                ];
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
        tableTitle.textContent = `${calendarData.calendarId} - ${calendarData.hours.toFixed(1)} hours (${calendarData.percentage}%)`;

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
}

// Initialize the histogram when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new CalendarHistogram();
}); 