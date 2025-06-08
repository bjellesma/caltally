class CalendarTimeTracker {
    constructor() {
        this.accessToken = null;
        this.calendars = [];
        this.currentData = null;
        this.settings = {
            excludeAllDay: true,
            groupByColor: true,
            minDuration: 1,
            timezone: 'America/New_York'
        };
        
        this.init();
    }

    async init() {
        // Load settings from storage
        await this.loadSettings();
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Check if user is already signed in
        await this.checkAuthStatus();
        
        // Set default dates
        this.setDefaultDates();
    }

    setupEventListeners() {
        // Auth buttons
        document.getElementById('sign-in-btn').addEventListener('click', () => this.signIn());
        document.getElementById('sign-out-btn').addEventListener('click', () => this.signOut());
        
        // Date controls
        document.getElementById('analyze-btn').addEventListener('click', () => this.analyzeTime());
        
        // Quick date selectors
        document.querySelectorAll('.quick-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.setQuickDate(e.target.dataset.period));
        });
        
        // Export buttons
        document.getElementById('export-csv').addEventListener('click', () => this.exportCSV());
        document.getElementById('export-json').addEventListener('click', () => this.exportJSON());
        document.getElementById('copy-summary').addEventListener('click', () => this.copySummary());
        
        // Settings
        document.getElementById('exclude-all-day').addEventListener('change', (e) => {
            this.settings.excludeAllDay = e.target.checked;
            this.saveSettings();
        });
        
        document.getElementById('group-by-color').addEventListener('change', (e) => {
            this.settings.groupByColor = e.target.checked;
            this.saveSettings();
        });
        
        document.getElementById('min-duration').addEventListener('change', (e) => {
            this.settings.minDuration = parseInt(e.target.value);
            this.saveSettings();
        });
        
        document.getElementById('timezone').addEventListener('change', (e) => {
            this.settings.timezone = e.target.value;
            this.saveSettings();
        });
        
        // Retry button
        document.getElementById('retry-btn').addEventListener('click', () => this.hideError());
    }

    async loadSettings() {
        try {
            const result = await chrome.storage.sync.get('calendarTrackerSettings');
            if (result.calendarTrackerSettings) {
                this.settings = { ...this.settings, ...result.calendarTrackerSettings };
                this.applySettings();
            }
        } catch (error) {
            console.log('Could not load settings:', error);
        }
    }

    async saveSettings() {
        try {
            await chrome.storage.sync.set({ calendarTrackerSettings: this.settings });
        } catch (error) {
            console.log('Could not save settings:', error);
        }
    }

    applySettings() {
        document.getElementById('exclude-all-day').checked = this.settings.excludeAllDay;
        document.getElementById('group-by-color').checked = this.settings.groupByColor;
        document.getElementById('min-duration').value = this.settings.minDuration;
        document.getElementById('timezone').value = this.settings.timezone;
    }

    setDefaultDates() {
        const now = new Date();
        const startOfWeek = new Date(now);
        const dayOfWeek = now.getDay();
        startOfWeek.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
        
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        
        document.getElementById('start-date').value = startOfWeek.toISOString().split('T')[0];
        document.getElementById('end-date').value = endOfWeek.toISOString().split('T')[0];
    }

    setQuickDate(period) {
        const now = new Date();
        let startDate, endDate;
        
        switch (period) {
            case 'this-week':
                const dayOfWeek = now.getDay();
                startDate = new Date(now);
                startDate.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
                endDate = new Date(startDate);
                endDate.setDate(startDate.getDate() + 6);
                break;
                
            case 'last-week':
                const lastWeekStart = new Date(now);
                const lastWeekDay = now.getDay();
                lastWeekStart.setDate(now.getDate() - (lastWeekDay === 0 ? 6 : lastWeekDay - 1) - 7);
                startDate = lastWeekStart;
                endDate = new Date(lastWeekStart);
                endDate.setDate(lastWeekStart.getDate() + 6);
                break;
                
            case 'this-month':
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                break;
                
            case 'last-month':
                startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                endDate = new Date(now.getFullYear(), now.getMonth(), 0);
                break;
        }
        
        document.getElementById('start-date').value = startDate.toISOString().split('T')[0];
        document.getElementById('end-date').value = endDate.toISOString().split('T')[0];
        
        // Update active button
        document.querySelectorAll('.quick-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelector(`[data-period="${period}"]`).classList.add('active');
    }

    async checkAuthStatus() {
        try {
            console.log("Checking auth status...");
            const tokenResponse = await chrome.identity.getAuthToken({ 
                interactive: false,
                scopes: ['https://www.googleapis.com/auth/calendar.readonly']
            });
            console.log("Auth token response:", tokenResponse);
            
            if (tokenResponse && tokenResponse.token) {
                console.log("Setting access token and loading calendars...");
                this.accessToken = tokenResponse.token;
                await this.loadCalendars();
                console.log("Auth check successful, showing app...");
                this.showApp();
            } else {
                console.log("No token found, showing auth screen...");
                this.showAuth();
            }
        } catch (error) {
            console.error("Auth status check error:", error);
            console.error("Error details:", {
                message: error.message,
                stack: error.stack,
                name: error.name
            });
            this.showAuth();
        }
    }

    async signIn() {
        try {
            console.log("Starting sign in process...");
            const tokenResponse = await chrome.identity.getAuthToken({ 
                interactive: true,
                scopes: ['https://www.googleapis.com/auth/calendar.readonly']
            });
            console.log("Got auth token response:", tokenResponse);
            
            if (!tokenResponse || !tokenResponse.token) {
                throw new Error("Failed to get auth token");
            }
            
            this.accessToken = tokenResponse.token;
            console.log("Attempting to load calendars...");
            await this.loadCalendars();
            console.log("Calendars loaded successfully");
            this.showApp();
        } catch (error) {
            console.error("Sign in error:", error);
            console.error("Error details:", {
                message: error.message,
                stack: error.stack,
                name: error.name
            });
            this.showError('Failed to sign in. Please try again.');
        }
    }

    async signOut() {
        try {
            // Get current token
            const token = await chrome.identity.getAuthToken({ interactive: false });
            if (token) {
                // Remove the token
                await chrome.identity.removeCachedAuthToken({ token });
            }
            // Clear storage
            await chrome.storage.local.clear();
            
            this.accessToken = null;
            this.calendars = [];
            this.currentData = null;
            this.showAuth();
        } catch (error) {
            console.error('Sign out error:', error);
            this.showError('Failed to sign out. Please try again.');
        }
    }

    async loadCalendars(retryCount = 0) {
        const MAX_RETRIES = 1; // Only retry once
        
        try {
            console.log("Making calendar API request...");
            console.log("Token type:", typeof this.accessToken);
            console.log("Token value:", this.accessToken);
            
            if (!this.accessToken) {
                throw new Error("No access token available");
            }
            
            const headers = {
                'Authorization': `Bearer ${this.accessToken}`,
                'Accept': 'application/json'
            };
            console.log("Request headers:", headers);
            
            const response = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
                method: 'GET',
                headers: headers
            });
            
            console.log("Calendar API response status:", response.status);
            console.log("Response headers:", Object.fromEntries(response.headers.entries()));
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error("Calendar API error response:", errorText);
                
                // Only try to refresh token if we haven't exceeded retry limit
                if (retryCount < MAX_RETRIES) {
                    console.log("Attempting to refresh token...");
                    const tokenResponse = await chrome.identity.getAuthToken({ 
                        interactive: true,
                        scopes: ['https://www.googleapis.com/auth/calendar.readonly']
                    });
                    
                    if (tokenResponse && tokenResponse.token && tokenResponse.token !== this.accessToken) {
                        console.log("Got new token, retrying request...");
                        this.accessToken = tokenResponse.token;
                        return this.loadCalendars(retryCount + 1); // Retry with new token
                    }
                }
                
                throw new Error(`Failed to load calendars: ${response.status} ${response.statusText}`);
            }
            
            const data = await response.json();
            console.log("Calendar data received:", data);
            this.calendars = data.items.filter(cal => cal.selected !== false);
            console.log("Filtered calendars:", this.calendars);
            
        } catch (error) {
            console.error("Calendar loading error:", error);
            
            // Only attempt token refresh if we haven't exceeded retry limit
            if (retryCount < MAX_RETRIES && (error.message.includes('401') || error.message.includes('token'))) {
                console.log("Authentication error detected, attempting to refresh token...");
                try {
                    const tokenResponse = await chrome.identity.getAuthToken({ 
                        interactive: true,
                        scopes: ['https://www.googleapis.com/auth/calendar.readonly']
                    });
                    if (tokenResponse && tokenResponse.token && tokenResponse.token !== this.accessToken) {
                        console.log("Got new token, retrying request...");
                        this.accessToken = tokenResponse.token;
                        return this.loadCalendars(retryCount + 1); // Retry with new token
                    }
                } catch (refreshError) {
                    console.error("Failed to refresh token:", refreshError);
                }
            }
            
            // If we've exhausted retries or refresh failed, show error to user
            this.showError('Could not load calendars. Please try signing in again.');
            this.showAuth();
            throw new Error('Could not load calendars: ' + error.message);
        }
    }

    async analyzeTime() {
        const startDate = document.getElementById('start-date').value;
        const endDate = document.getElementById('end-date').value;
        
        if (!startDate || !endDate) {
            this.showError('Please select both start and end dates.');
            return;
        }
        
        if (new Date(startDate) > new Date(endDate)) {
            this.showError('Start date must be before end date.');
            return;
        }
        
        this.showLoading();
        
        try {
            const timeData = await this.fetchCalendarData(startDate, endDate);
            this.currentData = timeData;
            this.displayResults(timeData);
        } catch (error) {
            this.showError('Failed to analyze calendar data: ' + error.message);
        }
    }

    async fetchCalendarData(startDate, endDate) {
        const timeMin = new Date(startDate + 'T00:00:00').toISOString();
        const timeMax = new Date(endDate + 'T23:59:59').toISOString();
        
        const calendarData = {};
        const allEvents = [];
        
        for (const calendar of this.calendars) {
            try {
                const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendar.id)}/events?` +
                    `timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime&maxResults=2500`;
                
                const response = await fetch(url, {
                    headers: {
                        'Authorization': `Bearer ${this.accessToken}`
                    }
                });
                
                if (!response.ok) continue;
                
                const data = await response.json();
                const events = data.items || [];
                
                const filteredEvents = events.filter(event => this.shouldIncludeEvent(event));
                const totalMinutes = filteredEvents.reduce((sum, event) => sum + this.calculateEventDuration(event), 0);
                
                calendarData[calendar.id] = {
                    name: calendar.summary,
                    color: calendar.backgroundColor || calendar.colorId || '#4285f4',
                    events: filteredEvents,
                    totalMinutes: totalMinutes,
                    totalHours: totalMinutes / 60
                };
                
                allEvents.push(...filteredEvents.map(event => ({
                    ...event,
                    calendarName: calendar.summary,
                    calendarColor: calendar.backgroundColor || calendar.colorId || '#4285f4'
                })));
                
            } catch (error) {
                console.warn(`Failed to fetch events from ${calendar.summary}:`, error);
            }
        }
        
        return this.processTimeData(calendarData, allEvents, startDate, endDate);
    }

    shouldIncludeEvent(event) {
        // Exclude all-day events if setting is enabled
        if (this.settings.excludeAllDay && event.start.date) {
            return false;
        }
        
        // Exclude events shorter than minimum duration
        const duration = this.calculateEventDuration(event);
        if (duration < this.settings.minDuration) {
            return false;
        }
        
        // Exclude declined events
        if (event.attendees) {
            const userAttendee = event.attendees.find(att => att.self);
            if (userAttendee && userAttendee.responseStatus === 'declined') {
                return false;
            }
        }
        
        return true;
    }

    calculateEventDuration(event) {
        if (!event.start || !event.end) return 0;
        
        // All-day events
        if (event.start.date && event.end.date) {
            return 0; // We're excluding these anyway
        }
        
        const start = new Date(event.start.dateTime || event.start.date);
        const end = new Date(event.end.dateTime || event.end.date);
        
        return Math.round((end - start) / (1000 * 60)); // Convert to minutes
    }

    processTimeData(calendarData, allEvents, startDate, endDate) {
        const totalMinutes = Object.values(calendarData).reduce((sum, cal) => sum + cal.totalMinutes, 0);
        
        // Group events by day
        const dailyBreakdown = {};
        allEvents.forEach(event => {
            const eventDate = (event.start.dateTime || event.start.date).split('T')[0];
            if (!dailyBreakdown[eventDate]) {
                dailyBreakdown[eventDate] = [];
            }
            dailyBreakdown[eventDate].push({
                ...event,
                duration: this.calculateEventDuration(event)
            });
        });
        
        // Calculate active days
        const activeDays = Object.keys(dailyBreakdown).length;
        
        return {
            totalMinutes,
            totalHours: totalMinutes / 60,
            activeDays,
            avgDailyHours: activeDays > 0 ? (totalMinutes / 60) / activeDays : 0,
            calendarData,
            dailyBreakdown,
            dateRange: { start: startDate, end: endDate }
        };
    }

    displayResults(data) {
        // Update summary stats
        document.getElementById('total-hours').textContent = data.totalHours.toFixed(1);
        document.getElementById('active-days').textContent = data.activeDays;
        document.getElementById('avg-daily').textContent = data.avgDailyHours.toFixed(1) + 'h';
        
        // Display calendar breakdown
        this.displayCalendarBreakdown(data.calendarData, data.totalMinutes);
        
        // Display chart
        this.displayChart(data.calendarData, data.totalMinutes);
        
        // Display daily timeline
        this.displayDailyTimeline(data.dailyBreakdown);
        
        this.showResults();
    }

    displayCalendarBreakdown(calendarData, totalMinutes) {
        const container = document.getElementById('calendar-breakdown');
        container.innerHTML = '';
        
        // Sort calendars by time spent
        const sortedCalendars = Object.entries(calendarData)
            .sort(([,a], [,b]) => b.totalMinutes - a.totalMinutes)
            .filter(([,cal]) => cal.totalMinutes > 0);
        
        sortedCalendars.forEach(([id, calendar]) => {
            const percentage = totalMinutes > 0 ? (calendar.totalMinutes / totalMinutes * 100).toFixed(1) : 0;
            
            const item = document.createElement('div');
            item.className = 'calendar-item';
            item.style.setProperty('--calendar-color', calendar.color);
            
            item.innerHTML = `
                <div class="calendar-color" style="background-color: ${calendar.color}"></div>
                <div class="calendar-info">
                    <div class="calendar-name">${calendar.name}</div>
                    <div class="calendar-stats">${calendar.events.length} events • ${percentage}%</div>
                </div>
                <div class="calendar-hours">${calendar.totalHours.toFixed(1)}h</div>
            `;
            
            container.appendChild(item);
        });
    }

    displayChart(calendarData, totalMinutes) {
        const container = document.getElementById('time-chart');
        container.innerHTML = '';
        
        const chartDiv = document.createElement('div');
        chartDiv.className = 'progress-chart';
        
        // Sort and filter calendars
        const sortedCalendars = Object.entries(calendarData)
            .sort(([,a], [,b]) => b.totalMinutes - a.totalMinutes)
            .filter(([,cal]) => cal.totalMinutes > 0)
            .slice(0, 8); // Show top 8 calendars
        
        sortedCalendars.forEach(([id, calendar]) => {
            const percentage = totalMinutes > 0 ? (calendar.totalMinutes / totalMinutes * 100) : 0;
            
            const item = document.createElement('div');
            item.className = 'progress-item';
            
            item.innerHTML = `
                <div class="progress-label">${calendar.name.length > 15 ? calendar.name.substring(0, 15) + '...' : calendar.name}</div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${percentage}%; background-color: ${calendar.color}"></div>
                </div>
                <div class="progress-value">${percentage.toFixed(1)}%</div>
            `;
            
            chartDiv.appendChild(item);
        });
        
        container.appendChild(chartDiv);
    }

    displayDailyTimeline(dailyBreakdown) {
        const container = document.getElementById('daily-timeline');
        container.innerHTML = '';
        
        // Sort days
        const sortedDays = Object.keys(dailyBreakdown).sort();
        
        sortedDays.forEach(date => {
            const events = dailyBreakdown[date];
            const dayTotal = events.reduce((sum, event) => sum + event.duration, 0);
            
            if (dayTotal === 0) return;
            
            const dayItem = document.createElement('div');
            dayItem.className = 'day-item';
            
            const formattedDate = new Date(date + 'T12:00:00').toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric'
            });
            
            dayItem.innerHTML = `
                <div class="day-header">
                    <span>${formattedDate}</span>
                    <span class="day-total">${(dayTotal / 60).toFixed(1)}h</span>
                </div>
                <div class="day-events" id="events-${date}"></div>
            `;
            
            container.appendChild(dayItem);
            
            // Add events
            const eventsContainer = document.getElementById(`events-${date}`);
            events
                .sort((a, b) => new Date(a.start.dateTime || a.start.date) - new Date(b.start.dateTime || b.start.date))
                .forEach(event => {
                    const eventItem = document.createElement('div');
                    eventItem.className = 'event-item';
                    eventItem.style.setProperty('--calendar-color', event.calendarColor);
                    
                    const startTime = event.start.dateTime ? 
                        new Date(event.start.dateTime).toLocaleTimeString('en-US', { 
                            hour: '2-digit', 
                            minute: '2-digit',
                            hour12: false 
                        }) : 'All day';
                    
                    eventItem.innerHTML = `
                        <strong>${startTime}</strong> ${event.summary || 'Untitled'} 
                        <span style="color: #999;">(${event.duration}m)</span>
                    `;
                    
                    eventsContainer.appendChild(eventItem);
                });
        });
    }

    exportCSV() {
        if (!this.currentData) return;
        
        let csv = 'Calendar,Event,Date,Start Time,Duration (minutes),Duration (hours)\n';
        
        Object.values(this.currentData.calendarData).forEach(calendar => {
            calendar.events.forEach(event => {
                const date = (event.start.dateTime || event.start.date).split('T')[0];
                const startTime = event.start.dateTime ? 
                    new Date(event.start.dateTime).toLocaleTimeString('en-US', { hour12: false }) : 
                    'All day';
                const duration = this.calculateEventDuration(event);
                const summary = (event.summary || 'Untitled').replace(/"/g, '""');
                
                csv += `"${calendar.name}","${summary}","${date}","${startTime}",${duration},${(duration/60).toFixed(2)}\n`;
            });
        });
        
        this.downloadFile(csv, 'calendar-time-analysis.csv', 'text/csv');
    }

    exportJSON() {
        if (!this.currentData) return;
        
        const exportData = {
            summary: {
                totalHours: this.currentData.totalHours,
                activeDays: this.currentData.activeDays,
                avgDailyHours: this.currentData.avgDailyHours,
                dateRange: this.currentData.dateRange
            },
            calendars: this.currentData.calendarData,
            dailyBreakdown: this.currentData.dailyBreakdown,
            generatedAt: new Date().toISOString()
        };
        
        this.downloadFile(
            JSON.stringify(exportData, null, 2), 
            'calendar-time-analysis.json', 
            'application/json'
        );
    }

    copySummary() {
        if (!this.currentData) return;
        
        const { start, end } = this.currentData.dateRange;
        let summary = `📊 Calendar Time Analysis (${start} to ${end})\n\n`;
        summary += `⏱️ Total Time: ${this.currentData.totalHours.toFixed(1)} hours\n`;
        summary += `📅 Active Days: ${this.currentData.activeDays}\n`;
        summary += `📈 Average Daily: ${this.currentData.avgDailyHours.toFixed(1)} hours\n\n`;
        
        summary += `📋 Calendar Breakdown:\n`;
        Object.values(this.currentData.calendarData)
            .sort((a, b) => b.totalMinutes - a.totalMinutes)
            .filter(cal => cal.totalMinutes > 0)
            .forEach(calendar => {
                const percentage = (calendar.totalMinutes / this.currentData.totalMinutes * 100).toFixed(1);
                summary += `• ${calendar.name}: ${calendar.totalHours.toFixed(1)}h (${percentage}%)\n`;
            });
        
        navigator.clipboard.writeText(summary).then(() => {
            // Show brief success message
            const btn = document.getElementById('copy-summary');
            const originalText = btn.innerHTML;
            btn.innerHTML = '<span class="btn-icon">✅</span>Copied!';
            setTimeout(() => {
                btn.innerHTML = originalText;
            }, 2000);
        });
    }

    downloadFile(content, filename, contentType) {
        const blob = new Blob([content], { type: contentType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    showAuth() {
        document.getElementById('auth-section').classList.remove('hidden');
        document.getElementById('app-section').classList.add('hidden');
        document.getElementById('error-section').classList.add('hidden');
    }

    showApp() {
        document.getElementById('auth-section').classList.add('hidden');
        document.getElementById('app-section').classList.remove('hidden');
        document.getElementById('error-section').classList.add('hidden');
        
        // Add histogram button if it doesn't exist
        if (!document.getElementById('histogram-button')) {
            const button = document.createElement('button');
            button.id = 'histogram-button';
            button.textContent = 'View Time Distribution';
            button.className = 'histogram-button';
            button.onclick = () => {
                chrome.tabs.create({ url: 'histogram.html' });
            };
            document.getElementById('app-section').appendChild(button);
        }
    }

    showLoading() {
        document.getElementById('loading').classList.remove('hidden');
        document.getElementById('results-section').classList.add('hidden');
        document.getElementById('analyze-btn').disabled = true;
    }

    showResults() {
        document.getElementById('loading').classList.add('hidden');
        document.getElementById('results-section').classList.remove('hidden');
        document.getElementById('analyze-btn').disabled = false;
        
        // Add animation class
        document.getElementById('results-section').classList.add('card-enter');
    }

    showError(message) {
        document.getElementById('error-message').textContent = message;
        document.getElementById('error-section').classList.remove('hidden');
        document.getElementById('auth-section').classList.add('hidden');
        document.getElementById('app-section').classList.add('hidden');
        document.getElementById('loading').classList.add('hidden');
        document.getElementById('analyze-btn').disabled = false;
    }

    hideError() {
        document.getElementById('error-section').classList.add('hidden');
        if (this.accessToken) {
            this.showApp();
        } else {
            this.showAuth();
        }
    }
}

// Initialize the app when the popup loads
document.addEventListener('DOMContentLoaded', () => {
    new CalendarTimeTracker();
});