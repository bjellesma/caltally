class CalendarHistogram {
    constructor() {
        this.chart = null;
        this.timeRange = 'day';
        this.initializeEventListeners();
        this.loadData();
    }

    initializeEventListeners() {
        document.getElementById('timeRange').addEventListener('change', (e) => {
            this.timeRange = e.target.value;
            this.loadData();
        });

        document.getElementById('refresh').addEventListener('click', () => {
            this.loadData();
        });
    }

    async loadData() {
        try {
            const token = await chrome.identity.getAuthToken({ 
                interactive: true,
                scopes: ['https://www.googleapis.com/auth/calendar.readonly']
            });

            if (!token) {
                throw new Error('No auth token available');
            }

            const now = new Date();
            let startTime, endTime;

            switch (this.timeRange) {
                case 'day':
                    startTime = new Date(now.setHours(0, 0, 0, 0));
                    endTime = new Date(now.setHours(23, 59, 59, 999));
                    break;
                case 'week':
                    startTime = new Date(now.setDate(now.getDate() - now.getDay()));
                    endTime = new Date(now.setDate(now.getDate() + 6));
                    break;
                case 'month':
                    startTime = new Date(now.getFullYear(), now.getMonth(), 1);
                    endTime = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                    break;
            }

            const response = await fetch(
                `https://www.googleapis.com/calendar/v3/calendars/primary/events?` +
                `timeMin=${startTime.toISOString()}&` +
                `timeMax=${endTime.toISOString()}&` +
                `singleEvents=true&` +
                `orderBy=startTime`,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Accept': 'application/json'
                    }
                }
            );

            if (!response.ok) {
                throw new Error('Failed to fetch calendar data');
            }

            const data = await response.json();
            this.processData(data.items);
        } catch (error) {
            console.error('Error loading calendar data:', error);
            this.showError('Failed to load calendar data. Please try again.');
        }
    }

    processData(events) {
        const timeSlots = this.createTimeSlots();
        const calendarData = {};

        events.forEach(event => {
            if (!event.start || !event.end) return;

            const start = new Date(event.start.dateTime || event.start.date);
            const end = new Date(event.end.dateTime || event.end.date);
            const calendarId = event.organizer?.email || 'primary';
            
            if (!calendarData[calendarId]) {
                calendarData[calendarId] = Array(timeSlots.length).fill(0);
            }

            const slotIndex = this.getTimeSlotIndex(start);
            if (slotIndex >= 0 && slotIndex < timeSlots.length) {
                calendarData[calendarId][slotIndex] += 
                    (end - start) / (1000 * 60 * 60); // Convert to hours
            }
        });

        this.updateChart(timeSlots, calendarData);
    }

    createTimeSlots() {
        const slots = [];
        const startHour = 0;
        const endHour = 24;
        const interval = 1; // 1-hour intervals

        for (let hour = startHour; hour < endHour; hour += interval) {
            slots.push(`${hour}:00`);
        }

        return slots;
    }

    getTimeSlotIndex(date) {
        const hour = date.getHours();
        return Math.floor(hour);
    }

    updateChart(timeSlots, calendarData) {
        const ctx = document.getElementById('histogramChart').getContext('2d');
        
        if (this.chart) {
            this.chart.destroy();
        }

        const datasets = Object.entries(calendarData).map(([calendarId, data]) => ({
            label: calendarId,
            data: data,
            backgroundColor: this.getRandomColor(),
            borderColor: this.getRandomColor(),
            borderWidth: 1
        }));

        this.chart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: timeSlots,
                datasets: datasets
            },
            options: {
                responsive: true,
                scales: {
                    x: {
                        stacked: true,
                        title: {
                            display: true,
                            text: 'Hour of Day'
                        }
                    },
                    y: {
                        stacked: true,
                        title: {
                            display: true,
                            text: 'Hours'
                        }
                    }
                },
                plugins: {
                    title: {
                        display: true,
                        text: 'Calendar Time Distribution'
                    }
                }
            }
        });
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
        // Implement error display
        console.error(message);
    }
}

// Initialize the histogram when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new CalendarHistogram();
}); 